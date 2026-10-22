# Order Results popup

## Scope delivered in this slice

This is a source-only, screen-only presentation slice for `interface/orders/single_order_results.php`. It is not a claim of visual, theme or clinical acceptance.

- **Activation.** `interface/orders/list_reports.php` opens the route with `window.open`, not `dlgopen`:

  ```js
  window.open('single_order_results.php?orderid=' + encodeURIComponent(orderid), '_blank', 'toolbar=0,location=0,menubar=0,scrollbars=yes')
  ```

  `Header::setupHeader()` autoloads the shared `popup.js`. With no parent frame, it follows the opener (the list_reports frame) up to the shell and marks `<html>` with `oe-workbench-popup` only when the shell body is `workbench-active`. The route adds its own body class, so every rule is scoped to `html.oe-workbench-popup body.oe-order-results-popup`. A legacy shell, a closed or cross-origin opener, or a window with no opener never matches.
- **Route change.** Three reversible insertions, and nothing else in the route changes:
  1. a `use` line for `ClinicalWorkspaceAssets`;
  2. one `media="screen"` stylesheet link after `Header::setupHeader()`, versioned by the helper;
  3. `class="oe-order-results-popup"` on `<body>`.

  The Jest suite reverses these three insertions and checks that the result is byte-identical to the baseline route.
- **Shared renderer unchanged.** `interface/orders/single_order_results.inc.php` is byte-identical. It also renders `interface/forms/procedure_order/report.php` and `interface/patient_file/report/custom_report.php`, which lack the route body class and so get no new styles. `list_reports.php`, `popup.js`, `popup.css` and `topdialog.js` are also byte-identical. Their hashes are pinned in the tests.
- **Stylesheet.** `interface/clinical-workspace/order-results-popup.css` introduces colour, borders and the sheet's `padding: 16px 18px` and `border-radius: 8px`, using the shared popup palette (`--oe-wb-ink`, `--oe-wb-paper`, `--oe-wb-canvas`, `--oe-wb-line`, `--oe-wb-petrol`):
  - The canvas body holds the renderer's existing `form > .labres.table-responsive` wrapper, which becomes a padded, bordered paper sheet.
  - Tables set ink on paper. `tr.head` header rows set ink on canvas. Cells change only their border colour.
  - `:focus` and `:focus-visible` outlines for buttons and links are separate rules, so a browser without `:focus-visible` still gets the fallback.
- **Deliberately untouched:**
  - the route's inline body margin and `sans-serif` / `1em` font
  - every font size, width, display, overflow and position
  - the `.table-responsive` scroller that holds the 13-column results table, the notes and all actions
  - the `text-danger` abnormal flag, which is never selected or restyled
  - the notes `pre`: no colour rule targets it. It keeps the theme's own `pre` ink alongside the renderer's `bg-white` utility, which Bootstrap applies with `!important`. Dark and Solar compile `$white` to `#000`, so a fixed workbench ink there would be dark on black. An earlier draft of this slice painted it, and review caught that.
  - the results table's `table-striped` rows and the notes header row's inline `var(--gray200)` paint
  - button palettes: this stylesheet sets none. The unchanged shared `popup.css` already overrides `btn-primary` colours in every workbench popup. That override is inherited and is not a change made by this slice.

  Paper is set on `.labres .table` only. It is not the effective surface behind every row: the theme's `table-striped` odd rows, the inline `var(--gray200)` notes header and `!important` utilities draw over it. The tests check only nominal popup-palette token pairs, not the compiled cascade.
- **Asset helper.** `order-results-popup.css` is added to `ClinicalWorkspaceAssets::SUPPORTED`. Isolated PHP tests cover:
  - its own modification time
  - the missing-file fallback to `'0'`
  - the shipped version
  - rejection of near-miss, case-variant, query-suffix and traversal names

No source edit changes SQL, signing, authorization, result consolidation, report notes, education or document links, translations, callbacks or control semantics.

## Security note

The route checks `patients/med` before rendering and `patients/sign` before signing. Signing updates only the posted `form_sign_list`, then the order status, then refreshes the opener and navigates. The route has no explicit CSRF token check. That omission is inherited and is **not** fixed by this presentation slice, and nothing here should be read as CSRF coverage.

## Risks

- Popup activation depends on the opener chain when the popup loads. Once activated, the controller observes the resolved shell host's body class, not the opener. Closing or navigating the list_reports window afterwards therefore does not necessarily remove the styling. This lifecycle is unverified in a real browser.
- The 13-column table stays wide. On narrow windows the existing horizontal scroller is the only way to reach every column. This slice does not claim the table fits on mobile, and does not claim translated native button labels wrap.
- **Inherited review finding: stripe contrast.** The independent review estimated that the abnormal flag's `#dc3545` sits at roughly 4.1:1 on Light's existing odd-row stripe, and at a similar level on Bootstrap's default stripe. That is below 4.5:1. This slice does not change stripes or the flag and does not fix this. Effective contrast under the compiled theme cascade is unverified and remains open.
- Native contrast for the notes `pre` in each compiled theme is also unverified. Removing the notes rule restores the theme's original pairing, but no browser has confirmed what it renders.

## Test evidence

Focused Jest: `tests/js/order-results-popup.test.js`, 70 tests. The run uses synthetic markup built from the renderer's own fragments and contains no patient data.

- **RED** (unchanged production, controller run `red-controller.log`): 14 failed, 53 passed, 67 total, exit 1.
- **Review-fix RED** (corrected guards against the reviewed stylesheet and docs, `red-fix.log`): 3 failed, 67 passed, 70 total, exit 1. The failures were the `.labres pre` notes paint, which failed both the guard and the dedicated notes test, and the documentation claims.
- **Review-fix GREEN** (`green-fix.log`): 0 failed, 70 passed, 70 total, exit 0.

These are source contracts and jsdom checks. They do not show that the page renders correctly, and they do not show effective contrast.

## Remaining open gates

Each of these is still a separate gate:

- native rendering against compiled themes (light, dark, solar, high-contrast), including the effective browser cascade for stripes, `bg-white` and inline paint
- keyboard focus order and visibility in a real browser
- translation lengths
- print and print preview
- explicit legacy mode
- opener behaviour: refresh after signing, a closed opener, cross-origin
- signing under real `patients/sign` and `patients/med` role combinations
- independent CLI review
- exact-head hosted CI
- acceptance on the deployed site

Merge and deployment are not authorized by this document.
