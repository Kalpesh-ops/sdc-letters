#!/usr/bin/env node
// Local letter form.  node server.mjs  →  http://localhost:4173
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname, extname, normalize } from 'node:path';
import {
  DIR, MIN_GAP, loadData, letterTypes, buildRecord, renderSheet, renderPage, pdfPath, slug, launchBrowser, htmlToPdf
} from './lib.mjs';

const PORT = Number(process.env.PORT) || 4173;
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.pdf': 'application/pdf', '.json': 'application/json' };

let browserPromise;
const browser = () => (browserPromise ||= launchBrowser());

const send = (res, status, body, type = 'application/json') => {
  res.writeHead(status, { 'Content-Type': type });
  res.end(type === 'application/json' ? JSON.stringify(body) : body);
};

const readBody = async (req) => {
  let s = '';
  for await (const chunk of req) s += chunk;
  return JSON.parse(s || '{}');
};

// One form submission → one record per non-empty name line.
function recordsFrom(body, data) {
  const names = String(body.names || '').split(/\r?\n/).map((n) => n.trim()).filter(Boolean);
  if (!names.length) return { records: [], errors: ['Enter at least one name.'] };
  const records = [], errors = [];
  for (const name of names) {
    const r = buildRecord({ ...body, name }, data);
    if (r.errors.length) errors.push(`${name}: ${r.errors.join('; ')}`);
    else records.push(r.record);
  }
  return { records, errors };
}

async function handle(req, res) {
  const url = new URL(req.url, 'http://x');
  const data = loadData();

  if (req.method === 'GET' && url.pathname === '/') {
    return send(res, 200, await readFile(join(DIR, 'app.html')), TYPES['.html']);
  }

  if (req.method === 'GET' && url.pathname === '/options') {
    return send(res, 200, {
      types: letterTypes(data.copyBook).map((k) => ({ key: k, label: data.copyBook[k].label || k })),
      departments: data.roles.departments.map((d) => d.name),
      positions: data.roles.positions.map((p) => ({ label: p.label, scoped: p.scoped })),
      session: data.defaults.session
    });
  }

  if (req.method === 'POST' && url.pathname === '/preview') {
    const body = await readBody(req);
    const { record, errors } = buildRecord({ ...body, name: body.name || 'Recipient Name' }, data);
    if (errors.length) return send(res, 200, `<p style="font:14px sans-serif;color:#c33;padding:24px">${errors.join('<br>')}</p>`, TYPES['.html']);
    const html = renderPage(record.name, [renderSheet(record, data)], data).replace('<head>', '<head><base href="/"><style>html,body{overflow:hidden}.sheet-stack{padding:0!important}</style>');
    return send(res, 200, html, TYPES['.html']);
  }

  if (req.method === 'POST' && url.pathname === '/generate') {
    const body = await readBody(req);
    const { records, errors } = recordsFrom(body, data);
    if (errors.length) return send(res, 400, { errors });

    const b = await browser();
    const saved = [], warnings = [], sheets = [];
    for (const rec of records) {
      const sheet = renderSheet(rec, data);
      sheets.push(sheet);
      const { pdf, gaps } = await htmlToPdf(b, renderPage(rec.name, [sheet], data));
      const rel = pdfPath(rec);
      await mkdir(dirname(join(DIR, rel)), { recursive: true });
      await writeFile(join(DIR, rel), pdf);
      saved.push(rel.replaceAll('\\', '/'));
      if (rec._warn) warnings.push(`${rec.name}: ${rec._warn}`);
      if (gaps[0] < MIN_GAP) warnings.push(`${rec.name}: text runs into the footer — shorten wording in copy.json / roles.json`);
    }
    let combined = null;
    if (records.length > 1) {
      const first = records[0];
      const { pdf } = await htmlToPdf(b, renderPage('SDC letters', sheets, data));
      combined = `out/pdf/${first.type}-${slug(first.position)}-batch-${Date.now()}.pdf`;
      await writeFile(join(DIR, combined), pdf);
    }
    return send(res, 200, { saved, combined, warnings });
  }

  // Static: brand/, fonts/, tokens.css, and generated PDFs under out/pdf/.
  if (req.method === 'GET') {
    const rel = normalize(decodeURIComponent(url.pathname)).replace(/^[\\/]+/, '');
    const allowed = /^(brand|fonts|out[\\/]pdf)[\\/]/.test(rel) || rel === 'tokens.css';
    const file = join(DIR, rel);
    if (allowed && !rel.includes('..') && existsSync(file)) {
      return send(res, 200, await readFile(file), TYPES[extname(file)] || 'application/octet-stream');
    }
  }
  send(res, 404, { error: 'not found' });
}

createServer((req, res) => handle(req, res).catch((e) => {
  console.error(e);
  send(res, 500, { errors: [e.message] });
})).listen(PORT, '127.0.0.1', () => console.log(`SDC letters → http://localhost:${PORT}`));
