# SDC Official Letters & Booklet Generator

Automated generation engine for official **Software Development Club (SDC), VIT Bhopal University** letters and booklets in the official brand design system.

The system produces production-ready, edge-to-edge vector A4 PDFs:
- **Letters**: Appointment, Promotion, Termination, and Tenure Completion.
- **Booklets**: Official 7-Page SDC Code of Conduct (Dark & Light editions).

---

## Table of Contents
1. [Prerequisites & Setup](#prerequisites--setup)
2. [Generation Workflows](#generation-workflows)
   - [Workflow A: Web Form UI (Single & Team Runs)](#workflow-a-web-form-ui-interactive)
   - [Workflow B: CSV Batch Run (50+ Bulk Generation)](#workflow-b-csv-batch-run-bulk-generation)
   - [Workflow C: JSON & CLI Commands](#workflow-c-json--cli-commands)
   - [Workflow D: Code of Conduct Booklet](#workflow-d-code-of-conduct-booklet)
3. [File Architecture: Where to Edit What](#file-architecture-where-to-edit-what)
4. [Customization & Updates](#customization--updates)
   - [Changing Session or Signatories](#changing-session-or-signatories)
   - [Adding / Editing Roles & Responsibilities](#adding--editing-roles--responsibilities)
   - [Adjusting Letter Copy & Framing](#adjusting-letter-copy--framing)
5. [Engine Details: Sizing, Auto-Fit & Design Integrity](#engine-details-sizing-auto-fit--design-integrity)
6. [Output Directory Reference](#output-directory-reference)
7. [Troubleshooting & Common Questions](#troubleshooting--common-questions)

---

## Prerequisites & Setup

- **Node.js**: Version 18.0.0 or higher.
- **Browser Engine**: Google Chrome or Microsoft Edge installed on the system (or Puppeteer-managed Chromium).

### Installation
Clone the repository and install dependencies:
```bash
git clone git@github.com:Kalpesh-ops/sdc-letters.git
cd sdc-letters
npm install
```

> **Note on Chrome**: Puppeteer looks for system Chrome at standard paths (or `PUPPETEER_EXECUTABLE_PATH`). If you receive a browser error, run:
> ```bash
> npx puppeteer browsers install chrome
> ```

---

## Generation Workflows

### Workflow A: Web Form UI (Interactive)
Ideal for generating one-off letters, testing wording, or running letters for a single team at a time.

1. Start the local server:
   ```bash
   npm start
   ```
2. Open **[http://localhost:4173](http://localhost:4173)** in your browser.
3. Configure the letter:
   - **Letter type**: Appointment, Promotion, Termination, Tenure Completion.
   - **Position**: Select from Executive Board or Team roles.
   - **Department**: Automatically enabled for team-scoped positions (Technical, Design, etc.) and disabled for Executive Board roles (renders as "Executive Board").
   - **Names**: Enter one recipient name per line in the text box.
   - **Theme**: Toggle Dark (standard) or Light.
   - **Date / Effective Date**: Defaults to today if left blank.
4. Preview updates live in the right pane.
5. Click **Generate PDFs**:
   - Generates individual PDFs for each name.
   - If multiple names were entered, automatically generates a combined batch PDF.
   - Download links are displayed directly in the UI.

---

### Workflow B: CSV Batch Run (Bulk Generation)
The standard workflow for club recruitment drives (50+ members).

1. Edit or populate [`batch.csv`](file:///e:/sdc/letters/batch.csv).
2. Execute the batch command:
   ```bash
   npm run batch
   # or explicitly:
   node render.mjs --csv batch.csv --pdf
   ```

#### CSV Columns & Specification:
| Column | Required? | Accepted Values | Defaults if Blank |
|---|---|---|---|
| `type` | **Yes** | `appointment`, `promotion`, `termination`, `tenure` | None (error if missing) |
| `name` | **Yes** | Full Name of the recipient | None (error if missing) |
| `department` | Required for team roles | `Technical`, `Design`, `Event Management`, `PR and Outreach`, `Social Media and Content`, `Videography and Editing` | Ignored for Executive Board roles |
| `position` | **Yes** | `President`, `Vice President`, `General Secretary`, `Operations Lead`, `Financial Lead`, `Student Coordinator`, `Lead`, `Co-Lead`, `Core Member` | None (error if missing) |
| `date` | No | Any date string (e.g. `14 September 2026`) | Today's date (formatted `DDth MMMM YYYY`) |
| `effective` | For termination | Date string (e.g. `20 September 2026`) | Same as `date` |
| `theme` | No | `dark`, `light` | `dark` |

> **Validation Note**: Every row in the CSV is validated before any rendering begins. If row 37 has a typo in the position or department, the CLI will output the exact row number and allowed values, skipping invalid entries without crashing.

---

### Workflow C: JSON & CLI Commands

You can run CLI commands with different flags for rapid iteration:

- **Generate PDFs from [`letters.json`](file:///e:/sdc/letters/letters.json)**:
  ```bash
  node render.mjs --pdf
  ```
- **Generate fast HTML previews only (no PDF engine, instant)**:
  ```bash
  node render.mjs
  # Check out/*.html in browser
  ```
- **Generate single-file preview with all letters**:
  ```bash
  node render.mjs --all
  # Check out/all.html
  ```
- **Generate Specimen showing all 4 letter types in Dark & Light**:
  ```bash
  node render.mjs --specimen
  # Check out/all.html
  ```

---

### Workflow D: Code of Conduct Booklet
Generates the official 7-page SDC Code of Conduct booklet.

```bash
npm run conduct
# or:
node conduct/render.mjs
```

- **Output**:
  - `out/pdf/code-of-conduct-dark.pdf`
  - `out/pdf/code-of-conduct-light.pdf`
- **Browser Preview**:
  ```bash
  node conduct/render.mjs --html
  # Check out/code-of-conduct.html
  ```
- **Content source**: [`conduct/conduct.json`](file:///e:/sdc/letters/conduct/conduct.json)
- **Layout engine**: [`conduct/render.mjs`](file:///e:/sdc/letters/conduct/render.mjs)

---

## File Architecture: Where to Edit What

```
sdc-letters/
├── batch.csv           # Input CSV for bulk batch generation
├── letters.json        # Global defaults (signatories, session) and fallback records
├── roles.json          # Departments, roles, responsibilities (bullets), and closing lines
├── copy.json           # Template wording per letter type (headings, salutations, metadata)
├── tokens.css          # Design system CSS tokens (colors, fonts, borders, themes)
├── sheet.html          # Core A4 layout template for individual letters
├── app.html            # Web UI interface template
├── page.html           # HTML wrapper template for multi-sheet rendering & printing
├── server.mjs          # Node.js HTTP server for local Web UI (http://localhost:4173)
├── render.mjs          # CLI batch runner for letters
├── lib.mjs             # Core rendering engine, validation, Puppeteer PDF & fit algorithms
├── brand/              # Logos and SVG/PNG signature assets
│   ├── mark.svg
│   ├── mark-white.webp
│   ├── logo-circular.webp
│   ├── signature-kalpesh-white.svg
│   └── signature-lalwani-white.svg
├── conduct/            # Code of Conduct booklet
│   ├── conduct.json    # Booklet clauses, commitments, and text
│   └── render.mjs      # Booklet layout builder & PDF generator
└── fonts/              # Offline TTF fonts (Anton, Outfit, Santorini)
```

---

## Customization & Updates

### Changing Session or Signatories
When a new academic session starts or club leadership changes, update **[`letters.json`](file:///e:/sdc/letters/letters.json)**:
```json
"defaults": {
  "session": "Session 2026—27",
  "theme": "dark",
  "watermark": "centre",
  "presidentName": "Kalpesh Parashar",
  "presidentRole": "President",
  "coordinatorName": "Dr. Praveen Lalwani",
  "coordinatorRole": "Faculty Coordinator"
}
```
To update physical signatures:
1. Place transparent SVGs (or PNGs) in [`brand/`](file:///e:/sdc/letters/brand/).
2. Keep names identical or update references in [`sheet.html`](file:///e:/sdc/letters/sheet.html).

### Adding / Editing Roles & Responsibilities
Edit **[`roles.json`](file:///e:/sdc/letters/roles.json)**:
- **`departments`**: Add or rename departments.
- **`positions`**:
  - `scoped: true` indicates team roles (e.g. Lead, Co-Lead, Core Member). Bullet points can use `{department}` interpolation.
  - `scoped: false` indicates Executive Board roles.
  - `titleWithDepartment: false`: Used for Core Member letters so the role says "Core Member" rather than "Technical Core Member".
  - `bullets`: List of responsibilities rendered on the letter.
  - `closingLine`: Single punchy closing sentence for that position.
  - `closing`: Custom override for closing paragraphs (e.g. Core Member appointment closing).

> **Important**: If any position has `TODO` in its bullets (e.g. `Student Coordinator`), the generator will emit a warning on both CLI and Web UI until replaced.

### Adjusting Letter Copy & Framing
Edit **[`copy.json`](file:///e:/sdc/letters/copy.json)**:
- Manages headings, metadata pill labels, salutations, body opening paragraphs, and standard closing copy for `appointment`, `promotion`, `termination`, and `tenure`.
- Available placeholders: `{name}`, `{department}`, `{departmentShort}`, `{position}`, `{title}`, `{session}`, `{sessionLower}`, `{date}`, `{effective}`, `{closingLine}`.

---

## Engine Details: Sizing, Auto-Fit & Design Integrity

### 1. Canvas Dimensions & Edge-to-Edge Print
- Base canvas is fixed A4 at **794 × 1123 px** (matching SDC Design System).
- Letters print edge-to-edge with **zero margins**.
- To prevent sub-pixel white hairline artifacts from Chrome's page rounding, each page prints at **792 × 1121 px** and is trimmed by **1pt** all around using `pdf-lib`.

### 2. Auto-Fit Algorithm (`window.sdcFit`)
- Found in [`lib.mjs`](file:///e:/sdc/letters/lib.mjs).
- Long roles (like Core Member with extended closing paragraphs) automatically step down line height, font size, and element spacing through 6 calibrated steps so content never collides with the signatures or footer.
- Short letters retain the spacious default sizing.

### 3. Overflow Detection & Warnings (`MIN_GAP = 12px`)
- After fitting, the engine measures the distance between the content box and the footer line.
- If distance < 12px, a warning is logged:
  `! text runs into the footer — shorten wording in copy.json / roles.json`
- All standard roles are pre-calibrated to maintain ≥ 37px clearance.

### 4. Background Baking & PDF File Size Optimization
- Letter backgrounds combine ambient glow, paper grain, and watermarks.
- Standard Puppeteer rendering rasterizes CSS blend modes at 300 DPI, bloating each single-page PDF to ~28 MB.
- **Our solution in `lib.mjs`**: The background stack is rendered once per theme as an optimized 2x JPEG. The foreground text, rules, and signatures render as crisp vector layers on top.
- **Result**: Crisp vector text, razor-sharp signatures, and a tiny file size of **~300 KB per letter**.

---

## Output Directory Reference

Generated files are placed in `out/`. This directory is in `.gitignore` and is safe to delete at any time.

```
out/
└── pdf/
    ├── appointment/
    │   ├── technical/
    │   │   └── core-member-naman-tiwari.pdf
    │   └── event-management/
    │       └── co-lead-aashish-prasad.pdf
    ├── promotion/
    │   └── technical/
    │       └── lead-devyanshu-negi.pdf
    ├── tenure/
    │   └── executive-board/
    │       └── president-meet-bikhani.pdf
    ├── termination/
    │   └── design/
    │       └── core-member-lorem-ipsum.pdf
    ├── appointment-all.pdf       # Merged PDF of all appointments from CSV
    ├── promotion-all.pdf         # Merged PDF of all promotions from CSV
    ├── tenure-all.pdf            # Merged PDF of all tenures from CSV
    ├── code-of-conduct-dark.pdf  # 7-page dark booklet
    └── code-of-conduct-light.pdf # 7-page light booklet
```

---

## Troubleshooting & Common Questions

**Q: "No Chrome found" error on startup.**  
Run `npx puppeteer browsers install chrome` or set the environment variable `PUPPETEER_EXECUTABLE_PATH` to your browser path.

**Q: Port 4173 is already in use.**  
Start with a custom port:
```bash
PORT=5000 npm start
```

**Q: The CLI warns that text is running into the footer.**  
Check the recipient's role in [`roles.json`](file:///e:/sdc/letters/roles.json). Ensure responsibility bullet points are concise (3–4 bullets) and avoid overly verbose closing paragraphs.

**Q: Where do I get the combined batch PDF from the form?**  
When entering multiple names in the web form, the engine outputs both individual links and a "Combined PDF" link at the top of the results box.

---
Developed for the **Software Development Club (SDC)**. Maintained by the SDC Executive Board.
