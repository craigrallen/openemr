# Amendments presentation

## Scope

This is a bounded presentation slice for two routes:

- `interface/patient_file/summary/list_amendments.php` (the request register)
- `interface/patient_file/summary/add_edit_amendments.php` (the request editor and its history)

### How the routes are reached

The demographics Amendments card renders its Edit button (`linkMethod: 'html'`) and its per-amendment links as plain anchors. They navigate the normal patient content frame. `demographics.php` binds a `.rx_modal` dlgopen handler, but no card link carries that class. In practice, then, the routes run in the workbench tab frame, not in a dialog. `demographics.php` is unchanged, so this navigation is preserved.

### Activation

Every rule requires `html.oe-workbench-context` plus the route's body class (`oe-amendments-list` or `oe-amendments-editor`). The existing `popup.js` sets `oe-workbench-context` for any same-origin frame or popup of an active workbench. `popup.css` defines the `--oe-wb-*` tokens on that same marker. As a result, the sheet engages:

- in the normal tab frame;
- in a dlgopen dialog, should one ever load these routes.

No new JS is involved. With an inactive or legacy shell, a standalone window, a non-workbench opener, or print (the sheet is `media="screen"`), the legacy rendering stays. The shared `workspace.css` is not linked.

### Route edits

Each route gets:

- one `use` line;
- one versioned `<link>` through `ClinicalWorkspaceAssets` (one allowlisted basename);
- classes on existing elements.

No nodes, wrappers, controls, scripts, SQL, ACL, CSRF or session code changed.

### Presentation

- The page is a paper sheet with a ruled heading and wrapping action groups.
- The request register is bordered.
- The editor is a single-column field stack. Short fields are capped at 22rem, and textareas resize vertically.
- Text-bearing descendants restate an explicit ink and surface pair, so the dark theme's light ink and link colour stay readable.
- Spacing uses logical properties.
- Disabled and readonly controls use the disabled token pair.
- Validation states are excluded from the neutral resets, `text-danger` keeps its colour, and focus outlines are drawn.

### Narrow frames

The sheet pads by `clamp(12px, 4vw, 24px)`. Under the sheet, Bootstrap's `.row` negative gutters and column padding are set to 0, so content cannot poke past the sheet border when the padding drops below 15px.

The history table is a direct flex item of `.row`. Its table grid cannot shrink below its min-content width, so the sheet is `overflow-x: auto`. A wide history scrolls inside the sheet instead of spilling past its border. Nothing is `overflow: hidden`, `nowrap` or truncated.

This is reasoned from the CSS. Layout was not measured.

## Evidence

`tests/js/amendments-popup.test.js` (Jest, node environment) checks the following.

**Route edits.** It undoes exactly the declared edits on each route and compares the result with the master `18647270` sha256. Negative mutations to ACL, SQL, CSRF, session, callbacks and scripts must break that restoration.

**Real `popup.js` controllers.** It runs `createPopupController` in JSDOM windows wired as in `workbench-popup.test.js` and checks the route sheet's selectors against each window's DOM:

- A normal tab frame and a dlgopen frame both engage.
- Legacy mode, then reactivation, toggles the sheet.
- An inactive shell, a standalone window, a non-workbench opener and the shell document never match.

**Sheet contracts.** Screen-only scope, RTL, dark-theme pairing, the semantic, locked and focus states, and the narrow-frame gutter and overflow declarations.

## Limitations

- **No browser evidence.** There are no screenshots, no browser or Selenium rendering, no measured layout at 146px or any other width, no real-role or ACL runs, and no read-only versus editable runtime checks.
- **Activation is simulated.** The JSDOM tests prove class activation and selector matching only. They do not prove cascade, computed style or layout.
- **Original markup kept.** The pages have no doctype (quirks mode), the labels have no `for` attributes, and the history table has a malformed closing `echo "<tr>"`. All are original and unchanged, so table font size is set explicitly.
- **Out of scope:** `print_amendments.php`, which opens with `window.open`.
