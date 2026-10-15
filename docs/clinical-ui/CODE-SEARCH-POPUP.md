# Dynamic Code Finder popup

Route: `interface/patient_file/encounter/find_code_dynamic.php` (`body#codes_search`).
Branch `feat/popup-code-search-document`, base `18647270e0c799189d2dc10f801e8de2bff1a360`.
This is allocation 1 of a maximum of 2 consecutive implementation/QA runs for this slice.

## What changed and why

Inside a genuine workbench popup, the finder is a bare form on the shared
popup paper. This slice makes the existing `theform` a quiet paper document
sheet on the workbench canvas. It does not add any new wrapper, heading or
action bar.

| File | Change |
|------|--------|
| `find_code_dynamic.php` | Four declared presentation edits: the `ClinicalWorkspaceAssets` import, one screen-only versioned `<link>` directly after `Header::setupHeader(...)`, `class="oe-code-search-popup"` on the existing `<body id="codes_search">`, and `class='oe-code-search-popup__document'` on the existing `<form name='theform'>`. |
| `interface/clinical-workspace/code-search-popup.css` | New sheet: one `@media screen` block, with every selector under `html.oe-workbench-popup body.oe-code-search-popup`. |
| `src/Common/Assets/ClinicalWorkspaceAssets.php` | Adds `code-search-popup.css` to `SUPPORTED`, in sorted order. Nothing else changes. |

What the sheet does, using only existing shared tokens from `popup.css`
(`--oe-wb-ink/canvas/paper/line/petrol/disabled-ink/disabled-paper`):

- **Canvas and sheet:** the body becomes ink on canvas. The form becomes ink on paper, with a 1px line border, an 8px radius and `0.75rem 1rem` padding. That inset is the only geometry change.
- **Fields, selects and the table:** these are painted ink on paper in their normal and `:focus` states. This pins the neutral pair under dark or solar themes. Only `background-color` is used, never the `background` shorthand, so select carets and validation icons survive.
- **Readonly and disabled fields:** the field rules outrank `popup.css`. So that the readonly single code-type input and any disabled control keep their visual state, the `disabled-ink`/`disabled-paper` pair is restated after the field and focus rules.
- **Focus rings:** fields, selects and buttons reserve a `2px solid transparent` outline. They get a petrol outline colour on `:focus`, which acts as the fallback, and again on `:focus-visible`. The Bootstrap button `box-shadow` focus treatment and the original button palettes (`btn-danger` Delete, `btn-secondary` Close, `btn-outline-primary`/`btn-outline-warning` search and clear) are not touched.

## Preservation

- **Exact inverse.** `restore()` in `tests/clinical-ui/code-search-support.cjs` undoes the four declared edits. The baseline suite requires the result to equal the base route byte-for-byte. Everything else in the route is unchanged:
  - mode branching for `codes`/`fields`/`lists`/`groups`;
  - the CSRF `sAjaxSource`, server-side DataTables options and both `fnDrawCallback` declarations;
  - row `role`/`tabindex`;
  - the `limit` logic, the single-selection `promiseData`, every opener callback and the `dlgclose()` calls;
  - controls, labels and the explicit "do not use table-responsive" warning.
- **DataTables.** There is no table wrapper and no width or `table-layout` change. Wrapper, length, filter, info, paginate and processing nodes are untouched, and so are inherited `table-striped`/`table-hover` row semantics and the `moreResults` warning alert.
- **Validation cues.** No control rule sets `border*`, `box-shadow`, `background-image` or `background`, so Bootstrap's `.is-valid`/`.is-invalid`/`.was-validated` borders and icons win as they do today. The same contract appears in `popup.css` ("Borders stay Bootstrap's…").
- **Typography.** This sheet adds no typography. That is a claim about this sheet only. The shared `popup.css` already sets `font-family: Arial, sans-serif` on the popup body before this sheet loads, so the popup does not render with the original pre-workbench font. That pre-existing shared behaviour is out of scope here.
- **No other code changed.** The AJAX endpoint, every caller, the shared popup engine and sheet, `workspace.css`, `dialog.js` and the themes are unchanged; the baseline suite pins them. No behaviour, scripts, URLs or ACLs changed.

## Test correction made before production

The test-first `code-search.test.cjs` originally required
`border-color: var(--oe-wb-line)` on fields and selects and
`border-color: var(--oe-wb-petrol)` on their `:focus`. Those selectors have
specificity 0,4,2 or higher. That beats `.form-control.is-invalid` (0,2,0)
and `.was-validated .form-control:invalid`, so the rules would have repainted
semantic validation borders. They would also contradict the shared sheet's
explicit decision to leave borders to Bootstrap.

The assertion was demonstrably invalid, so it was revised **before** the
production sheet was written, rather than contorting production to satisfy it.
The revised tests:

- reject `border-color` anywhere in the sheet;
- reject `border*`, `box-shadow`, `background-image` and the `background` shorthand on any field, select or button rule;
- reject `is-valid`, `is-invalid`, `was-validated`, `:valid` and `:invalid` selectors;
- add a positive test for that preservation contract;
- add negative self-check fixtures for each banned form.

The typography test was renamed from "original font" to "no added
typography", for the reason given under Typography above. The controller's
RED run, saved at
`/Users/craig/.hermes/projects/openemr/verification/code-search-20261015/red.log`,
predates this correction. The revised assertions have not been independently
RED-run.

Initial controller RED for the portable suite: 20 tests, 15 failed, 5 passed.
Not all of those failures are production defects: one test was itself invalid.
The helper's `routeViolations` guard reported "original form still present"
for the two original `use` lines. The presented import block contains those two
lines as a substring, so the additive import tripped the check even though the
production route was correct, and the exact full inverse baseline passed. The
guard now allows the original text to appear only as often as it does inside
one presented form (`count(php, before) === count(after, before)`). The exact
single-occurrence check on each presented form, the `restore()` inverse, the
business anchors and the mandatory whole-route baseline are unchanged. No
production change was needed for this. The portable suite now has 21 tests. No
PHP helper tests were run locally; the controller runs all gates.

`tests/Tests/Isolated/Common/Assets/ClinicalWorkspaceAssetsTest.php` gains
the following, all written **after** production:

- a per-file version test for `code-search-popup.css`;
- a shipped-mtime test for `code-search-popup.css`;
- two near-miss/traversal rejection cases.

None of these were independently RED.

### Test-oracle correction: stray-mutation anchors

A review found that two of the "stray" negative fixtures in
`code-search.test.cjs` used `'    </head>'` (four-space indent) as their
insertion anchor. The route's head close is unindented (`</head>`), so
`String.replace` never matched, the route was left unchanged, and the
`notDeepEqual(routeViolations(...), [])` assertion could not distinguish a
working guard from a fixture that never ran. This was a genuine test-oracle
defect, not a production one.

The two fixtures (an added `<style>` block and an added `workspace.css`
`<link>`) now anchor on the actual unindented `</head>`. Every stray source
anchor is also asserted to occur exactly once in the route, and the
replacement is asserted to change the source, before the guard is evaluated.
No negative fixture or guard was removed or weakened. No production file
changed. This correction has not been run locally; the controller runs all gates.

## What the source tests prove, and what they do not

| Suite | Proves |
|-------|--------|
| `node --test tests/clinical-ui/code-search.test.cjs` | Declared route edits, preserved anchors and element counts, and rejection of business, presentation and stray mutations. Also checks the helper allowlist, the popup engine marking `<html>` only, callers' original URLs, and the sheet guard: scope, screen-only, paint pairs, the semantic-cue ban, no typography, layout, `!important` or custom properties, focus fallback order, and readonly/disabled restatement. |
| `node --test tests/clinical-ui/code-search-baseline.test.cjs` | Exact inverse equality with the base route. Byte-identity of the AJAX endpoint, callers, shared popup files, dialog, Header, config and themes. Exactly one allowlist line added. Requires git history. |
| `tests/js/code-search-popup.test.js` | Portable wrapper; under Jest it delegates to the portable suite. |

These are source checks only. No browser, database, network or clinical
exercise was run in this slice, and **native acceptance is not claimed**. The
following gates remain open:

1. **Native theme:** the compiled light, dark, solar and manila themes render the sheet, fields, selects, readonly and disabled states and the table with their intended contrast. This includes validation borders and icons, and the `custom-select` caret on the DataTables length menu.
2. **Keyboard:** the search input's initial focus, Enter-to-search, Tab order through the controls, focus rings (both the `:focus` fallback and `:focus-visible`), and row activation through `role="button"`/`tabindex="0"`.
3. **Narrow:** behaviour inside the 850–900px dialog sizes and below, with the padding inset, and no horizontal overflow beyond today's.
4. **Direct and resized:** opening the route directly, outside the workbench, must stay unstyled because the sheet is inert. The dialog must also hold up when resized.
5. **Print:** print and print preview keep the legacy rendering, because the link and the sheet are `screen` only.
6. **Legacy:** with the workbench inactive, legacy navigation must render exactly as before.
7. **Opener:** a real selection reaches each caller in every mode:
   - `set_related`/`set_related_target`, `del_related`, `SetField`, `SetList` and `MoveFields`;
   - the procedure-order single-selection promise;
   - the immunizations 900×600 caller.
8. **Live role:** an administrator and a restricted role, against a deployed stack, with the global auth the route inherits. The route has no explicit ACL of its own.

## Run allocation

- **Run 1 (this allocation):** test-first guards, controller RED, minimal production and this document. GREEN, static checks and an independent review are for the controller to run; they have not been run here.
- **Run 2 (if needed):** fixes from that review or GREEN failures only. After that the budget is spent: the slice is parked behind its remaining native and acceptance gates, and the next independent selection follows `SELECTION.md`.

Nothing here is committed, pushed, merged or deployed. Shared status and
acceptance documents are deliberately not edited.
