# SDC Letters — generator

Generates official SDC letters (Appointment, Promotion, Termination, Tenure Completion) as A4 PDFs
in the house design. Node 18+ and Puppeteer (already installed in `node_modules/`).

## 1. Form (one-off or a team at a time)

    npm start            # → http://localhost:4173

Pick letter type, position, department; paste names one per line; Generate.
Department is disabled for board positions (President … Student Coordinator) — they print as "Executive Board".
The preview updates live. Each name becomes its own PDF; several names also produce one combined PDF.

## 2. CSV batch (the 50+ run)

    node render.mjs --csv batch.csv --pdf      # or: npm run batch

Columns: `type,name,department,position,date,effective,theme`. Blank cells use defaults
(date = today, theme = dark, effective = date). `type` is appointment | promotion | termination | tenure.
Department and position accept full or short names ("PR and Outreach", "PR & Outreach" both work).
Every row is validated first; bad rows are listed with the allowed values and skipped.

## Output

    out/pdf/<type>/<department>/<position>-<name>.pdf     one letter
    out/pdf/<type>-all.pdf                                CSV run: all letters of that type
    out/pdf/<type>-<position>-batch-<time>.pdf            form run with several names

`out/` is regenerated freely — safe to delete.

## Where things live

    roles.json     departments, positions, per-position responsibilities + closing line   ← edit wording here
    copy.json      per-letter-type framing (heading, ribbon, opening, closing)             ← and here
    letters.json   defaults: session, signatory names, theme
    sheet.html     A4 layout (do not edit casually)     tokens.css  colours, fonts, light theme
    lib.mjs        rendering + PDF      render.mjs  CLI      server.mjs + app.html  form
    preview.html   original kit specimen (old wording, reference only)

**Before sending:** Student Coordinator bullets in `roles.json` are still `TODO` — the tool warns until replaced.

## Fit check

The sheet is a fixed A4 canvas. Every PDF is measured; if text comes within 12px of the footer you get
`text runs into the footer — shorten wording`. Current wording leaves ≥37px on every type × position,
tested with the longest department and a three-word name.

## PDF size

Background layers (glow, grain, watermark) are baked once per theme into a 2x JPEG and laid under the
vector text, so each letter is ~300 KB instead of ~28 MB. Tune `BG_SCALE` / `BG_QUALITY` in `lib.mjs`.
Each page prints edge to edge (no white margins): sheets print one per page, clipped, then merged with
`pdf-lib`; page size is 592x839 pt (A4 minus a 1pt trim). Signatures are SVG (`brand/signature-*-white.svg`), traced from the original PNGs, so they stay sharp.

## Design rules — do not drift

- A4 at 794x1123 px, absolute positioning. Anton headline, Outfit body, JetBrains Mono micro-labels.
- Faculty Coordinator signature left, President right. Light theme is a token override only.
- Design source of truth: SDC Design System, `templates/official-letter/OfficialLetter.dc.html`.

## Code of Conduct booklet

    npm run conduct      # → out/pdf/code-of-conduct-dark.pdf and code-of-conduct-light.pdf (7 pages each)

Wording lives in `conduct/conduct.json`; layout in `conduct/render.mjs`. Pages warn if content runs into the footer.
