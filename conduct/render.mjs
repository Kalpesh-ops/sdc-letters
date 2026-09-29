#!/usr/bin/env node
// Code of Conduct booklet.
//   node conduct/render.mjs            → out/pdf/code-of-conduct-dark.pdf and -light.pdf
//   node conduct/render.mjs --html     → also out/code-of-conduct.html (browser preview, both themes)
// Wording lives in conduct/conduct.json; layout and styling live here.

import { readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import { join } from 'node:path';
import { DIR, esc, launchBrowser, htmlToPdf, MIN_GAP } from '../lib.mjs';

const OUT = join(DIR, 'out');
const A = './brand';

// Wording may carry <strong>; everything else is escaped.
const rich = (s) => esc(s).replace(/&lt;(\/?)strong&gt;/g, '<$1strong>');
const pad = (n) => String(n).padStart(2, '0');

const CSS = `
.page{position:relative;width:794px;height:1123px;margin:0 auto;background:var(--sdc-ink-900);color:var(--sdc-paper);overflow:hidden;isolation:isolate;font-family:var(--sdc-font-ui)}
.fill{position:absolute;inset:0}
.micro{font-family:var(--sdc-font-micro);font-size:9px;font-weight:400;letter-spacing:.32em;text-transform:uppercase;color:var(--sdc-micro-quiet)}
.micro.strong{color:var(--sdc-micro-strong)}
.frame{position:absolute;inset:22px;border:1px solid var(--sdc-hairline);pointer-events:none}
.tick{position:absolute;width:10px;height:10px;border-color:var(--sdc-hairline-strong);border-style:solid;border-width:0}
.tick.tl{left:22px;top:22px;border-left-width:1px;border-top-width:1px}
.tick.tr{right:22px;top:22px;border-right-width:1px;border-top-width:1px}
.tick.bl{left:22px;bottom:22px;border-left-width:1px;border-bottom-width:1px}
.tick.br{right:22px;bottom:22px;border-right-width:1px;border-bottom-width:1px}
.mast{position:absolute;left:66px;right:66px;top:46px}
.mast-row{display:flex;align-items:center;justify-content:space-between;gap:24px}
.mast-row img{width:38px;height:38px;display:block}
.mast-id{text-align:right;display:flex;flex-direction:column;gap:5px}
.fade-rule{height:1px;margin-top:16px;background:linear-gradient(90deg,rgba(246,238,248,0) 0%,rgba(246,238,248,.4) 18%,rgba(246,238,248,.4) 82%,rgba(246,238,248,0) 100%)}
[data-theme="light"] .fade-rule{background:linear-gradient(90deg,rgba(26,16,36,0) 0%,rgba(26,16,36,.28) 18%,rgba(26,16,36,.28) 82%,rgba(26,16,36,0) 100%)}
.grad-rule{height:3px;width:120px;background:linear-gradient(90deg,var(--sdc-ramp-1),var(--sdc-ramp-2),var(--sdc-ramp-3),rgba(123,52,220,0))}
.content{position:absolute;left:66px;right:66px;top:140px}
.foot{position:absolute;left:66px;right:66px;bottom:44px}
.foot-rule{height:1px;margin-bottom:14px;background:var(--sdc-hairline)}
.foot-row{display:flex;align-items:center;justify-content:space-between;gap:24px}
.foot-row img{width:30px;opacity:.75;display:block}
.h2{margin:14px 0 0;font-family:var(--sdc-font-display);font-weight:400;font-size:48px;line-height:1;letter-spacing:.03em;text-transform:uppercase;color:var(--sdc-paper);text-shadow:0 0 30px rgba(255,150,205,.14)}
[data-theme="light"] .h2{text-shadow:0 0 34px rgba(123,52,220,.14)}
.intro{margin:18px 0 0;max-width:600px;font-size:15.5px;font-weight:300;line-height:1.7;color:var(--sdc-micro-strong)}
strong{font-weight:600;color:var(--sdc-paper)}
.clauses{margin-top:30px;border-top:1px solid var(--sdc-hairline)}
.clause{display:grid;grid-template-columns:44px 188px 1fr;gap:0 20px;padding:20px 0;border-bottom:1px solid var(--sdc-hairline)}
.clauses.tight .clause{padding:12px 0}
.clauses.roomy .clause{padding:32px 0}
.clauses.roomy .points{gap:9px}
[data-theme="light"] img[data-bgfx]{opacity:.045!important}
[data-theme="light"] div[data-bgfx]{opacity:.09!important}
.clause .num{font-family:var(--sdc-font-micro);font-size:10px;letter-spacing:.2em;color:var(--sdc-micro-quiet);padding-top:4px}
.clause .title{font-weight:600;font-size:16.5px;line-height:1.35;color:var(--sdc-paper)}
.points{display:flex;flex-direction:column;gap:7px;font-size:14.5px;font-weight:300;line-height:1.6;color:var(--sdc-micro-strong)}
.clauses.tight .points{gap:4px;font-size:14px;line-height:1.5}
.pt{display:flex;gap:12px;align-items:baseline}
.pt:before{content:"";flex:none;width:12px;height:1px;background:var(--sdc-hairline-strong);transform:translateY(-5px)}
.block{margin-top:30px}
.block-label{display:flex;align-items:center;gap:14px;margin-bottom:14px}
.block-label:after{content:"";flex:1;height:1px;background:var(--sdc-hairline)}
.steps{display:grid;gap:14px}
.card{position:relative;border:1px solid var(--sdc-hairline);border-radius:3px;padding:18px 20px;background:rgba(246,238,248,.025)}
[data-theme="light"] .card{background:rgba(255,255,255,.45)}
.card .k{font-family:var(--sdc-font-micro);font-size:9px;letter-spacing:.3em;text-transform:uppercase;color:var(--sdc-micro-quiet)}
.card .who{margin-top:8px;font-weight:600;font-size:16px;color:var(--sdc-paper)}
.card .what{margin-top:6px;font-size:14px;font-weight:300;line-height:1.6;color:var(--sdc-micro-strong)}
.arrow{position:absolute;right:-13px;top:50%;width:12px;height:1px;background:var(--sdc-hairline-strong)}
.arrow:after{content:"";position:absolute;right:0;top:-3px;border:3.5px solid transparent;border-left:5px solid var(--sdc-hairline-strong);border-right:0}
.card.end{border-color:var(--sdc-hairline-strong)}
.severe{display:grid;grid-template-columns:1fr 1.35fr;gap:24px;align-items:start;border:1px solid var(--sdc-hairline-strong);border-radius:3px;padding:18px 20px;background:linear-gradient(90deg,rgba(214,58,156,.10),rgba(123,52,220,.04))}
.severe .lead{font-size:14px;font-weight:300;line-height:1.6;color:var(--sdc-micro-strong);margin-top:8px}
.appeal{display:flex;gap:18px;align-items:center;margin-top:26px}
.appeal p{margin:0;font-size:15px;font-weight:300;line-height:1.65;color:var(--sdc-micro-strong)}
.teams{margin-top:28px;display:grid;grid-template-columns:1fr 1fr;gap:14px}
.team{border:1px solid var(--sdc-hairline);border-radius:3px;padding:18px 20px 20px;background:rgba(246,238,248,.025)}
[data-theme="light"] .team{background:rgba(255,255,255,.45)}
.team .name{margin-top:8px;font-family:var(--sdc-font-display);font-weight:400;font-size:21px;line-height:1.05;letter-spacing:.03em;text-transform:uppercase;color:var(--sdc-paper)}
.team .role{margin-top:9px;font-size:14px;font-weight:500;line-height:1.5;color:var(--sdc-paper)}
.team .duties{margin-top:6px;font-size:13.5px;font-weight:300;line-height:1.6;color:var(--sdc-micro-strong)}
`;

function shell({ theme, bg, body, pageNo, total, session, extraBg = '', ticks = false, foot = true }) {
  const mast = `<div class="mast"><div class="mast-row">
<img src="${A}/logo-circular.webp" alt="Software Development Club">
<div class="mast-id"><div class="micro strong" style="letter-spacing:.34em">Software Development Club</div>
<div class="micro" style="letter-spacing:.34em;font-weight:300">VIT Bhopal University · Kothri Kalan · Madhya Pradesh</div></div>
</div><div class="fade-rule"></div></div>`;
  const footer = foot ? `<div class="foot" data-footer><div class="foot-rule"></div><div class="foot-row">
<div class="micro" style="font-size:8px;font-weight:300;letter-spacing:.34em">Code of Conduct · ${esc(session)}</div>
<div class="micro" style="font-size:8px;letter-spacing:.34em">${pad(pageNo)} / ${pad(total)}</div>
<img data-inv src="${A}/mark-white.webp" alt=""></div></div>` : '';
  return `<div class="letter-sheet page" data-theme="${theme}" data-bg="${theme}-coc-${bg}">
<div data-glow class="fill" style="background:radial-gradient(64% 30% at 50% 0%, rgba(160,64,128,.22) 0%, rgba(7,4,15,0) 72%)"></div>
<div data-glow class="fill" style="background:radial-gradient(36% 20% at 50% 34%, rgba(255,158,205,.10), transparent)"></div>
${extraBg}
${mast}
${body}
${footer}
<div class="sdc-grain" style="opacity:.3"></div>
<div class="frame"></div>
${ticks ? '<div class="tick tl"></div><div class="tick tr"></div><div class="tick bl"></div><div class="tick br"></div>' : ''}
</div>`;
}

const pts = (list) => `<div class="points">${list.map((p) => `<div class="pt"><div>${rich(p)}</div></div>`).join('')}</div>`;
const head = (pg) => `<div class="micro strong">${esc(pg.eyebrow)}</div><h2 class="h2">${esc(pg.title)}</h2>` +
  (pg.intro ? `<p class="intro">${rich(pg.intro)}</p>` : '');

function coverPage(c, ctx) {
  const extraBg = `
<img data-inv data-bgfx src="${A}/mark-white.webp" alt="" style="position:absolute;left:250px;top:430px;width:900px;transform:rotate(90deg);opacity:.07">
<div data-bgfx style="position:absolute;left:300px;top:250px;font-family:'Santorini',cursive;font-size:200px;line-height:1;color:var(--sdc-paper);opacity:.11;transform:rotate(-8deg)">${esc(c.script)}</div>`;
  const body = `<div data-content style="position:absolute;left:66px;right:66px;top:300px">
<div class="micro strong">${esc(c.kicker)} · ${esc(ctx.session)}</div>
<h1 style="margin:22px 0 0;font-family:var(--sdc-font-display);font-weight:400;font-size:150px;line-height:.92;letter-spacing:.02em;text-transform:uppercase;color:var(--sdc-paper);text-shadow:0 0 40px rgba(255,150,205,.18)">${c.title.map(esc).join('<br>')}</h1>
<div class="grad-rule" style="margin-top:34px;width:160px"></div>
<p style="margin:26px 0 0;max-width:470px;font-size:18px;font-weight:300;line-height:1.65;color:var(--sdc-micro-strong)">${rich(c.lede)}</p>
</div>
<div class="foot" data-footer><div class="foot-rule"></div><div class="foot-row">
<div class="micro" style="font-size:8px;font-weight:300;letter-spacing:.34em">${esc(ctx.session)}</div>
<div class="micro" style="font-size:8px;letter-spacing:.34em">Software Development Club · VIT Bhopal University</div>
<img data-inv src="${A}/mark-white.webp" alt=""></div></div>`;
  return shell({ ...ctx, bg: 'cover', body, extraBg, ticks: true, foot: false });
}

function clausePage(pg, ctx, startNo) {
  const tight = pg.clauses.length > 5 ? ' tight' : pg.clauses.length < 4 ? ' roomy' : '';
  const rows = pg.clauses.map((cl, i) =>
    `<div class="clause"><div class="num">${pad(startNo + i)}</div><div class="title">${esc(cl.title)}</div>${pts(cl.points)}</div>`).join('');
  return shell({ ...ctx, bg: 'page', body: `<div class="content" data-content>${head(pg)}<div class="clauses${tight}">${rows}</div></div>` });
}

function processPage(pg, ctx) {
  const r = pg.reporting, l = pg.ladder, s = pg.severe, ap = pg.appeal;
  const reporting = `<div class="block"><div class="block-label"><span class="micro strong">${esc(r.label)}</span></div>
<div class="steps" style="grid-template-columns:repeat(${r.steps.length},1fr);gap:26px">${r.steps.map((st, i) =>
    `<div class="card${i === r.steps.length - 1 ? ' end' : ''}"><div class="k">${i === 0 ? 'First' : 'Then'}</div><div class="who">${esc(st.who)}</div><div class="what">${rich(st.what)}</div>${i < r.steps.length - 1 ? '<div class="arrow"></div>' : ''}</div>`).join('')}</div></div>`;
  const ladder = `<div class="block"><div class="block-label"><span class="micro strong">${esc(l.label)}</span></div>
<div class="steps" style="grid-template-columns:repeat(${l.steps.length},1fr);gap:26px">${l.steps.map((st, i) =>
    `<div class="card${i === l.steps.length - 1 ? ' end' : ''}"><div class="k">Step ${pad(i + 1)}</div><div class="who">${esc(st.step)}</div><div class="what">${rich(st.what)}</div>${i < l.steps.length - 1 ? '<div class="arrow"></div>' : ''}</div>`).join('')}</div></div>`;
  const severe = `<div class="block"><div class="severe"><div><div class="micro strong">${esc(s.label)}</div><div class="lead">${rich(s.intro)}</div></div>${pts(s.points)}</div></div>`;
  const appeal = `<div class="appeal"><div class="grad-rule" style="flex:none;width:56px"></div><p><span class="micro strong" style="display:block;margin-bottom:6px">${esc(ap.label)}</span>${rich(ap.text)}</p></div>`;
  return shell({ ...ctx, bg: 'page', body: `<div class="content" data-content>${head(pg)}${reporting}${ladder}${severe}${appeal}</div>` });
}

function teamsPage(pg, ctx) {
  const cards = pg.teams.map((t, i) =>
    `<div class="team"><div class="micro">Team ${pad(i + 1)}</div><div class="name">${esc(t.name)}</div><div class="role">${rich(t.role)}</div><div class="duties">${rich(t.duties)}</div></div>`).join('');
  return shell({ ...ctx, bg: 'page', body: `<div class="content" data-content>${head(pg)}<div class="teams">${cards}</div></div>` });
}

function closingPage(data, closing, ctx) {
  const extraBg = `<img data-inv data-bgfx src="${A}/mark-white.webp" alt="" style="position:absolute;right:-190px;top:330px;width:620px;opacity:.07">`;
  const body = `<div data-content style="position:absolute;left:66px;right:66px;top:330px">
<div class="micro strong">In closing</div>
<p style="margin:26px 0 0;max-width:560px;font-family:var(--sdc-font-display);font-weight:400;font-size:40px;line-height:1.12;letter-spacing:.02em;text-transform:uppercase;color:var(--sdc-paper)">${esc(closing)}</p>
<div class="grad-rule" style="margin-top:34px;width:160px"></div>
<div style="margin-top:70px;width:260px">
<div style="height:82px;display:flex;align-items:flex-end"><img data-inv src="${A}/signature-kalpesh-white.svg" alt="" style="height:60px;display:block;opacity:.95;margin-bottom:-4px"></div>
<div style="height:1px;background:var(--sdc-hairline-strong)"></div>
<div style="font-weight:600;font-size:15px;color:var(--sdc-paper);margin-top:10px">${esc(data.president.name)}</div>
<div class="micro" style="font-weight:300;letter-spacing:.28em;margin-top:6px;line-height:1.8">${esc(data.president.role)}<br>Software Development Club</div>
</div></div>`;
  return shell({ ...ctx, bg: 'closing', body, extraBg });
}

export async function buildBooklet(theme) {
  const data = JSON.parse(await readFile(join(DIR, 'conduct', 'conduct.json'), 'utf8'));
  const total = 2 + data.pages.length;
  let pageNo = 1;
  const ctx = () => ({ theme, session: data.session, pageNo, total });
  const sheets = [coverPage(data.cover, ctx())];
  const counters = {};
  let closing = null;
  for (const pg of data.pages) {
    pageNo++;
    if (pg.kind === 'process') sheets.push(processPage(pg, ctx()));
    else if (pg.kind === 'teams') { sheets.push(teamsPage(pg, ctx())); closing = pg.closing; }
    else {
      const start = (counters[pg.eyebrow] ||= 1);
      sheets.push(clausePage(pg, ctx(), start));
      counters[pg.eyebrow] += pg.clauses.length;
    }
  }
  pageNo++;
  sheets.push(closingPage(data, closing, ctx()));
  return sheets;
}

const doc = (title, sheets) => `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<title>${esc(title)}</title><link rel="stylesheet" href="./tokens.css">
<style>@font-face{font-family:"Santorini";src:url("./fonts/Santorini.ttf") format("truetype")}${CSS}</style></head>
<body><div class="sheet-stack">${sheets.join('\n')}</div></body></html>`;

async function main() {
  const wantHtml = process.argv.includes('--html');
  await mkdir(join(OUT, 'pdf'), { recursive: true });
  const browser = await launchBrowser();
  try {
    const all = [];
    for (const theme of ['dark', 'light']) {
      const sheets = await buildBooklet(theme);
      all.push(...sheets);
      const { pdf, gaps } = await htmlToPdf(browser, doc(`Code of Conduct (${theme})`, sheets));
      const file = `code-of-conduct-${theme}.pdf`;
      await writeFile(join(OUT, 'pdf', file), pdf);
      console.log(`  out/pdf/${file}  (${sheets.length} pages, ${Math.round(pdf.length / 1024)} KB)`);
      gaps.forEach((g, i) => { if (g != null && g < MIN_GAP) console.warn(`  ! ${theme} page ${i + 1}: content is ${g}px from the footer — shorten it`); });
    }
    if (wantHtml) {
      for (const asset of ['brand', 'fonts', 'tokens.css']) await cp(join(DIR, asset), join(OUT, asset), { recursive: true });
      await writeFile(join(OUT, 'code-of-conduct.html'), doc('Code of Conduct', all));
      console.log('  out/code-of-conduct.html');
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error('render failed:', e.message); process.exit(1); });
