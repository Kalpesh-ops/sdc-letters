// Shared letter logic: record building, validation, HTML rendering, PDF output.
import { readFileSync, existsSync, statSync } from 'node:fs';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PDFDocument } from 'pdf-lib';

export const DIR = dirname(fileURLToPath(import.meta.url));
const p = (...f) => join(DIR, ...f);
const readJSON = (f) => JSON.parse(readFileSync(p(f), 'utf8'));

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Reloaded on each call so edits to the JSON files apply without restarting the server.
export function loadData() {
  return {
    copyBook: readJSON('copy.json'),
    roles: readJSON('roles.json'),
    defaults: readJSON('letters.json').defaults,
    sheetTpl: readFileSync(p('sheet.html'), 'utf8'),
    pageTpl: readFileSync(p('page.html'), 'utf8')
  };
}

export const letterTypes = (copyBook) => Object.keys(copyBook).filter((k) => k[0] !== '_');

// "15th September 2026"
export function formatDate(d) {
  const n = d.getDate();
  const suffix = n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th';
  return `${n}${suffix} ${d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`;
}

export function today() {
  return formatDate(new Date());
}

const norm = (s) => String(s ?? '').trim().toLowerCase().replace(/&/g, 'and').replace(/\s+/g, ' ');

// Accepts department by full name or short name, position by label or key. Returns { record, errors }.
export function buildRecord(input, data) {
  const { copyBook, roles, defaults } = data;
  const errors = [];
  const clean = Object.fromEntries(Object.entries(input).filter(([, v]) => v != null && String(v).trim() !== ''));
  const rec = { ...defaults, ...clean };

  rec.type = norm(rec.type);
  if (rec.type === 'tenure completion') rec.type = 'tenure';
  if (!copyBook[rec.type] || rec.type.startsWith('_'))
    errors.push(`unknown type "${input.type ?? ''}" (allowed: ${letterTypes(copyBook).join(', ')})`);

  if (!rec.name) errors.push('name is required');

  const pos = roles.positions.find((x) => norm(x.label) === norm(rec.position) || x.key === norm(rec.position));
  if (!pos) errors.push(`unknown position "${input.position ?? ''}" (allowed: ${roles.positions.map((x) => x.label).join(', ')})`);

  let dept = null;
  if (pos && pos.scoped) {
    dept = roles.departments.find((d) => norm(d.name) === norm(rec.department) || norm(d.short) === norm(rec.department));
    if (!dept) errors.push(`unknown department "${input.department ?? ''}" (allowed: ${roles.departments.map((d) => d.name).join(', ')})`);
  }

  if (rec.type === 'termination' && !rec.effective) rec.effective = rec.date || today();
  if (!rec.date) rec.date = today();
  rec.theme = norm(rec.theme) === 'light' ? 'light' : 'dark';

  if (errors.length) return { record: null, errors };

  rec.position = pos.label;
  rec.positionKey = pos.key;
  rec.department = dept ? dept.name : roles.boardDepartment;
  rec.departmentShort = dept ? dept.short : roles.boardDepartment;
  // Core Member letters name the position alone ("Core Member"); the department appears in the bullets.
  rec.title = dept && pos.titleWithDepartment !== false ? `${dept.name} ${pos.label}` : pos.label;
  rec.sessionLower = String(rec.session).replace(/^Session /, 'session ');
  rec.closingLine = pos.closingLine;
  rec._role = pos;
  if (rec.type !== 'termination' && pos.bullets.some((b) => /TODO/.test(b)))
    rec._warn = `position "${pos.label}" still has TODO bullets in roles.json`;
  return { record: rec, errors: [] };
}

const fill = (str, rec) => String(str).replace(/\{(\w+)\}/g, (_, k) => (rec[k] == null ? '' : esc(rec[k])));

const WATERMARKS = {
  centre: (a) => `<img data-inv data-wm src="${a}/mark-white.webp" alt="" style="position:absolute;left:50%;top:54%;width:520px;transform:translate(-50%,-50%);opacity:.08">`,
  right: (a) => `<img data-inv data-wm src="${a}/mark-white.webp" alt="" style="position:absolute;right:-150px;top:50%;width:420px;transform:translateY(-50%);opacity:.09">`,
  corner: (a) => `<img data-inv data-wm src="${a}/mark-white.webp" alt="" style="position:absolute;left:-110px;bottom:-90px;width:400px;opacity:.085">`,
  none: () => ''
};

const LABEL = 'font-family:var(--sdc-font-micro);font-size:9px;font-weight:400;letter-spacing:.3em;text-transform:uppercase;color:var(--sdc-micro-quiet)';
const VALUE = 'font-family:var(--sdc-font-ui);font-weight:500;font-size:14.5px;line-height:1.4;letter-spacing:.01em;color:var(--sdc-paper)';
const RULE = 'flex:none;width:14px;height:1px;background:var(--sdc-hairline-strong);transform:translateY(-6px)';

function buildMeta(spec, rec) {
  return spec.map(({ label, value }) =>
    `<div style="display:flex;flex-direction:column;gap:7px">` +
    `<div style="${LABEL}">${esc(label)}</div>` +
    `<div style="${VALUE}">${fill(value, rec)}</div>` +
    `</div>`
  ).join('\n');
}

function buildBody(copy, rec) {
  const listIntro = copy.listIntro === '@role' ? rec._role.listIntro : copy.listIntro;
  const bullets = copy.bullets === '@role' ? rec._role.bullets : copy.bullets;
  const out = [`<p style="margin:0 0 16px">${fill(copy.salutation, rec)}</p>`];
  for (const para of copy.paragraphs || []) {
    out.push(`<p style="margin:0 0 16px">${fill(para, rec).replace(/<strong>/g, '<strong style="font-weight:600;color:var(--sdc-paper)">')}</p>`);
  }
  if (listIntro) out.push(`<p style="margin:0 0 14px">${fill(listIntro, rec)}</p>`);
  if (bullets?.length) {
    const items = bullets.map((b) =>
      `<div style="display:flex;align-items:baseline;gap:14px"><div style="${RULE}"></div><div>${fill(b, rec)}</div></div>`
    ).join('');
    out.push(`<div style="display:flex;flex-direction:column;gap:11px;margin:0 0 18px">${items}</div>`);
  }
  const closing = (rec._role.closing?.[rec.type]) || copy.closing || [];
  closing.forEach((c, i) => {
    const last = i === closing.length - 1;
    out.push(`<p style="margin:${last ? '0' : '0 0 16px'}">${fill(c, rec)}</p>`);
  });
  return out.join('\n');
}

// Auto-fit: long letters (e.g. Core Member with its fuller wording) step body spacing down until the
// signatures clear the footer. Short letters keep the roomy default. Runs in the preview and before PDF export.
const FIT_SCRIPT = `<script>
window.sdcFit = function () {
  const STEPS = [
    { lh: 1.78, fs: 16, li: 11, pm: 16, sig: 34 },
    { lh: 1.68, fs: 16, li: 8, pm: 13, sig: 30 },
    { lh: 1.6, fs: 16, li: 6, pm: 11, sig: 26 },
    { lh: 1.52, fs: 16, li: 5, pm: 10, sig: 22 },
    { lh: 1.5, fs: 15.5, li: 4, pm: 9, sig: 20 },
    { lh: 1.46, fs: 15, li: 4, pm: 8, sig: 18 }
  ];
  document.querySelectorAll('.letter-sheet').forEach((s) => {
    const body = s.querySelector('[data-body]');
    const footer = [...s.children].find((k) => k.style.bottom === '44px');
    const content = [...s.children].find((k) => k.style.top === '146px');
    if (!body || !footer || !content) return;
    for (const st of STEPS) {
      body.style.lineHeight = st.lh;
      body.style.fontSize = st.fs + 'px';
      body.querySelectorAll(':scope>p').forEach((p) => { if (p.style.marginBottom !== '0px' && p.style.margin !== '0px') p.style.marginBottom = st.pm + 'px'; });
      body.querySelectorAll(':scope>div').forEach((d) => { d.style.gap = st.li + 'px'; d.style.marginBottom = (st.pm + 2) + 'px'; });
      if (body.nextElementSibling) body.nextElementSibling.style.marginTop = st.sig + 'px';
      if (footer.getBoundingClientRect().top - content.getBoundingClientRect().bottom >= 16) break;
    }
  });
};
(document.fonts ? document.fonts.ready : Promise.resolve()).then(() => window.sdcFit());
</script>`;

export function renderSheet(rec, data, assets = './brand') {
  const copy = data.copyBook[rec.type];
  const wmKey = WATERMARKS[rec.watermark] ? rec.watermark : 'centre';
  const wm = WATERMARKS[wmKey];
  return data.sheetTpl
    .replace('class="letter-sheet"', `class="letter-sheet" data-bg="${rec.theme}-${wmKey}"`)
    .replace('<div style="margin-top:28px;font-size:16px', '<div data-body style="margin-top:28px;font-size:16px')
    .replaceAll('{{THEME}}', rec.theme)
    .replaceAll('{{ASSETS}}', assets)
    .replaceAll('{{WATERMARK}}', wm(assets))
    .replaceAll('{{HEADING_1}}', esc(copy.heading[0]))
    .replaceAll('{{HEADING_2}}', esc(copy.heading[1]))
    .replaceAll('{{DATE}}', esc(rec.date || ''))
    .replaceAll('{{META}}', buildMeta(copy.meta, rec))
    .replaceAll('{{BODY}}', buildBody(copy, rec))
    .replaceAll('{{COORDINATOR_NAME}}', esc(rec.coordinatorName))
    .replaceAll('{{COORDINATOR_ROLE}}', esc(rec.coordinatorRole))
    .replaceAll('{{PRESIDENT_NAME}}', esc(rec.presidentName))
    .replaceAll('{{PRESIDENT_ROLE}}', esc(rec.presidentRole))
    .replaceAll('{{SESSION}}', esc(rec.session));
}

export function renderPage(title, sheets, data, css = './tokens.css') {
  return data.pageTpl
    .replaceAll('{{TITLE}}', esc(title))
    .replaceAll('{{CSS}}', css)
    .replaceAll('{{SHEETS}}', sheets.join('\n'))
    .replace('</body>', FIT_SCRIPT + '</body>');
}

export const pdfPath = (rec) =>
  join('out', 'pdf', rec.type, slug(rec.department), `${slug(rec.position)}-${slug(rec.name)}.pdf`);

// ---- PDF ----

const BROWSERS = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
];

export async function launchBrowser() {
  const puppeteer = (await import('puppeteer')).default;
  try {
    return await puppeteer.launch({ headless: true });
  } catch {
    // Puppeteer's bundled Chrome is missing (postinstall skipped) — fall back to an installed browser.
    const executablePath = BROWSERS.find((b) => b && existsSync(b));
    if (!executablePath) throw new Error('No Chrome found. Run `npx puppeteer browsers install chrome`.');
    return puppeteer.launch({ headless: true, executablePath });
  }
}

// Space in px between the last body line and the footer rule. Negative = text runs into the footer.
const OVERFLOW_JS = `(() => {
  const sheets = [...document.querySelectorAll('.letter-sheet')];
  return sheets.map((s) => {
    const top = s.getBoundingClientRect().top;
    const kids = [...s.children];
    const content = s.querySelector(':scope>[data-content]') || kids.find((k) => k.style.top === '146px');
    const footer = s.querySelector(':scope>[data-footer]') || kids.find((k) => k.style.bottom === '44px');
    if (!content || !footer) return null;
    return Math.round(footer.getBoundingClientRect().top - content.getBoundingClientRect().bottom);
  });
})()`;

// Background layers (glow, grain, watermark) use blend modes that Chrome's PDF backend rasterises at
// print resolution, bloating each page to ~28 MB. Instead each distinct background is screenshotted once
// at BG_SCALE and laid in as a JPEG; text, rules, logo and signatures stay vector/crisp on top.
const BG_SCALE = 2;
const PAGE_W = 792;  // sheet is 794x1123; 1px trimmed from each edge (frame is 22px in, unaffected)
const PAGE_H = 1121;
const TRIM_PT = 1;
const BG_QUALITY = 82;
const bgCache = new Map();
const HIDE_FOREGROUND = '.letter-sheet>:not([data-glow]):not([data-wm]):not([data-bgfx]):not(.sdc-grain){visibility:hidden!important}';
const DROP_BACKGROUND = '.letter-sheet>[data-glow],.letter-sheet>[data-wm],.letter-sheet>[data-bgfx],.letter-sheet>.sdc-grain{display:none!important}';

async function bakeBackgrounds(page) {
  const stamp = statSync(p('tokens.css')).mtimeMs;
  const keys = await page.$$eval('.letter-sheet[data-bg]', (els) => [...new Set(els.map((e) => e.dataset.bg))]);
  const missing = keys.filter((k) => !bgCache.has(`${k}|${stamp}`));
  if (missing.length) {
    const hide = await page.addStyleTag({ content: HIDE_FOREGROUND });
    for (const k of missing) {
      const el = await page.$(`.letter-sheet[data-bg="${k}"]`);
      const jpg = await el.screenshot({ type: 'jpeg', quality: BG_QUALITY, encoding: 'base64' });
      bgCache.set(`${k}|${stamp}`, `data:image/jpeg;base64,${jpg}`);
    }
    await hide.evaluate((n) => n.remove());
  }
  const rules = keys.map((k) =>
    `.letter-sheet[data-bg="${k}"]{background:url("${bgCache.get(`${k}|${stamp}`)}") 0 0/100% 100% no-repeat!important}`);
  await page.addStyleTag({ content: rules.join('') + DROP_BACKGROUND });
  // Make sure the data-URL backgrounds are decoded before printing.
  await page.evaluate((urls) => Promise.all(urls.map((u) => { const i = new Image(); i.src = u; return i.decode(); })),
    keys.map((k) => bgCache.get(`${k}|${stamp}`)));
}

// Renders full HTML (asset paths relative to DIR) to a PDF buffer. Returns { pdf, gaps }.
export async function htmlToPdf(browser, html) {
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 900, height: 1200, deviceScaleFactor: BG_SCALE });
    // A <base> pointing at the kit folder lets ./fonts, ./brand and ./tokens.css resolve.
    const base = `<base href="${pathToFileURL(DIR + '/').href}">`;
    const tmp = join(DIR, 'out', `.render-${process.pid}-${Math.random().toString(36).slice(2)}.html`);
    await mkdir(dirname(tmp), { recursive: true });
    await writeFile(tmp, html.replace('<head>', '<head>' + base), 'utf8');
    await page.goto(pathToFileURL(tmp).href, { waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {});
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => window.sdcFit && window.sdcFit());
    const gaps = await page.evaluate(OVERFLOW_JS);
    await bakeBackgrounds(page);
    // Chrome snaps the page size to whole points, so a page exactly the sheet's size leaves a sub-pixel white
    // hairline. Instead each sheet prints alone on a page 2px smaller, centred and clipped to the page, so the
    // letter background always reaches every edge. Pages are then merged into one document.
    await page.addStyleTag({ content:
      '@page{margin:0}html,body{margin:0!important;height:100vh!important;overflow:hidden!important;background:var(--sdc-ink-900)!important}' +
      '.sheet-stack{display:block!important;padding:0!important}.sheet-stack>.letter-sheet{display:none!important;margin:0!important}' +
      '.sheet-stack>.letter-sheet[data-print]{display:block!important;position:fixed!important;left:-1px!important;top:-1px!important}' });
    const count = await page.$$eval('.letter-sheet', (els) => els.length);
    const out = await PDFDocument.create();
    for (let i = 0; i < count; i++) {
      await page.$$eval('.letter-sheet', (els, n) => {
        els.forEach((e, j) => e.toggleAttribute('data-print', j === n));
        document.documentElement.dataset.theme = els[n].dataset.theme; // page ground matches this sheet's theme
      }, i);
      const one = await page.pdf({ width: `${PAGE_W}px`, height: `${PAGE_H}px`, printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
      const src = await PDFDocument.load(one);
      const [pg] = await out.copyPages(src, [0]);
      // Chrome clips a sub-point band on one edge when it snaps the page size; trim 1pt all round so only
      // the letter background remains.
      const { width, height } = pg.getSize();
      pg.setMediaBox(TRIM_PT, TRIM_PT, width - 2 * TRIM_PT, height - 2 * TRIM_PT);
      pg.setCropBox(TRIM_PT, TRIM_PT, width - 2 * TRIM_PT, height - 2 * TRIM_PT);
      out.addPage(pg);
    }
    const pdf = Buffer.from(await out.save());
    await rm(tmp, { force: true });
    return { pdf, gaps };
  } finally {
    await page.close();
  }
}

export const MIN_GAP = 12;
