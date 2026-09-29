#!/usr/bin/env node
// SDC letter renderer.
//   node render.mjs                     every record in letters.json → out/*.html
//   node render.mjs --csv batch.csv     read records from a CSV instead
//   node render.mjs --pdf               also write PDFs to out/pdf/<type>/<department>/ and out/pdf/<type>-all.pdf
//   node render.mjs --all               also write out/all.html (every letter, one file)
//   node render.mjs --specimen          out/all.html only: every type × dark and light
// Flags combine: node render.mjs --csv batch.csv --pdf

import { readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import {
  DIR, MIN_GAP, today, loadData, letterTypes, buildRecord, renderSheet, renderPage, slug, pdfPath, launchBrowser, htmlToPdf
} from './lib.mjs';

const OUT = join(DIR, 'out');

// Minimal CSV: comma-separated, double-quoted fields may contain commas and "" escapes.
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [header, ...body] = rows.filter((r) => r.some((f) => f.trim()));
  const keys = header.map((h) => h.trim().replace(/^﻿/, ''));
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])));
}

async function main() {
  const args = process.argv.slice(2);
  const data = loadData();
  const csvAt = args.indexOf('--csv');
  const wantPdf = args.includes('--pdf');

  await mkdir(OUT, { recursive: true });
  for (const asset of ['brand', 'fonts', 'tokens.css'])
    if (existsSync(join(DIR, asset))) await cp(join(DIR, asset), join(OUT, asset), { recursive: true });

  const writePage = async (file, title, sheets) => {
    await writeFile(join(OUT, file), renderPage(title, sheets, data), 'utf8');
    console.log('  out/' + file);
  };

  console.log('SDC letters →');

  if (args.includes('--specimen')) {
    const sample = { name: 'Aashish Prasad', department: 'Event Management', position: 'Co-Lead', date: today() };
    const sheets = [];
    for (const theme of ['dark', 'light'])
      for (const type of letterTypes(data.copyBook))
        sheets.push(renderSheet(buildRecord({ ...sample, type, theme }, data).record, data));
    await writePage('all.html', 'SDC Letters — Specimen', sheets);
    return;
  }

  let inputs;
  if (csvAt !== -1) {
    const file = args[csvAt + 1];
    if (!file) throw new Error('--csv needs a file path');
    inputs = parseCSV(await readFile(file, 'utf8'));
  } else {
    inputs = JSON.parse(await readFile(join(DIR, 'letters.json'), 'utf8')).letters;
  }

  // Validate everything first so a typo on row 40 is reported before any work is done.
  const records = [];
  let failed = 0;
  inputs.forEach((input, i) => {
    const where = csvAt !== -1 ? `row ${i + 2}` : `letter ${i + 1}`;
    const { record, errors } = buildRecord(input, data);
    if (errors.length) {
      failed++;
      console.error(`  ✗ ${where} (${input.name || 'no name'}): ${errors.join('; ')}`);
    } else {
      if (record._warn) console.warn(`  ! ${where} (${record.name}): ${record._warn}`);
      records.push(record);
    }
  });

  const sheets = [];
  const byType = {};
  for (const rec of records) {
    const sheet = renderSheet(rec, data);
    sheets.push(sheet);
    (byType[rec.type] ||= []).push({ rec, sheet });
    await writePage(`${rec.type}-${slug(rec.name)}.html`, `${rec.type} — ${rec.name}`, [sheet]);
  }
  if (args.includes('--all')) await writePage('all.html', 'SDC Letters', sheets);

  if (wantPdf && records.length) {
    const browser = await launchBrowser();
    try {
      for (const [type, items] of Object.entries(byType)) {
        for (const { rec, sheet } of items) {
          const { pdf, gaps } = await htmlToPdf(browser, renderPage(rec.name, [sheet], data));
          const out = join(DIR, pdfPath(rec));
          await mkdir(dirname(out), { recursive: true });
          await writeFile(out, pdf);
          const tight = gaps[0] < MIN_GAP ? `  ! text is ${gaps[0]}px from footer — shorten wording` : '';
          console.log('  ' + pdfPath(rec).replaceAll('\\', '/') + tight);
        }
        const { pdf } = await htmlToPdf(browser, renderPage(`SDC ${type}`, items.map((x) => x.sheet), data));
        await writeFile(join(OUT, 'pdf', `${type}-all.pdf`), pdf);
        console.log(`  out/pdf/${type}-all.pdf  (${items.length} letters)`);
      }
    } finally {
      await browser.close();
    }
  }

  console.log(`done: ${records.length} letter(s)` + (failed ? `, ${failed} skipped with errors` : ''));
  if (failed) process.exitCode = 1;
}

main().catch((e) => { console.error('render failed:', e.message); process.exit(1); });
