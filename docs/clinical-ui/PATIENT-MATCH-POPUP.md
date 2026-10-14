# Patient Matching popup

## Scope

This slice changes how the lab-results Patient Matching dialog looks
(`interface/orders/patient_match_dialog.php`). It is a presentation-only change, and the styling
applies only inside an active clinical workbench popup. `interface/orders/list_reports.php` opens the
dialog through `openPtMatch(args)` with `dlgopen('patient_match_dialog.php?key=…', '_blank', 850, 400, '', dlgtitle)`.

The existing results table is restyled as a quiet document: a paper surface, paired ink and paper
colours, cells that wrap at the configured font size, and an action row that wraps. Every original
node, control, string, the closeness-scoring SQL, the escaping calls, the ACL check, the CSRF token,
the inline scripts and the callbacks are byte-preserved. A reversible map in the test enforces this.

The slice does not change workflow, does not load the generic `workspace.css`, and does not change
the shared popup styling or the stylelint configuration.

## Files

| File | Change |
|------|--------|
| `interface/orders/patient_match_dialog.php` | Seven mapped presentation edits: an asset `use`, a screen-only `<link>` with a versioned URL, and classes on existing nodes (`body`, `#searchResults`, `table`, `h5`, `p`). |
| `interface/clinical-workspace/patient-match-popup.css` | New file. Scoped under `html.oe-workbench-popup body.oe-patient-match-popup` and contains no at-rules. |
| `src/Common/Assets/ClinicalWorkspaceAssets.php` | Adds `patient-match-popup.css` to `SUPPORTED`, in sorted position. |
| `tests/Tests/Isolated/Common/Assets/ClinicalWorkspaceAssetsTest.php` | Extends the existing popup stylesheet version cases. The original brief gave a `tests/Tests/Unit/...` path, which was stale; this is the actual file. |
| `tests/js/patient-match-popup.test.js` | New focused Jest suite. |
| `docs/clinical-ui/PATIENT-MATCH-POPUP.md` | This document. |

`list_reports.php` is unchanged. A test pins its SHA-256 (`f3577481…a0fc`).

## TDD evidence

Logs are saved in `~/.hermes/projects/openemr/verification/patient-match-20261014/`.

1. **`red-jest.log`**: run against unchanged production. Result: 12 failed, 6 passed, 18 total.
   - The 6 passing tests are preservation baselines that are meant to pass on the original: the caller hash, the row and opener callbacks, the highlight toggle, and the restore path.
   - Two earlier runs failed because of harness defects, not production behaviour, and are not counted as RED:
     - jsdom `outside-only` mode does not run inline `onclick` handlers.
     - jsdom has no named-property access on forms (`f[name]`), so the test models it through `elements.namedItem`.
2. **`green-jest.log`**: 18 passed after the implementation.
3. **`php-lint.log`** (no syntax errors) and **`diff-check.log`** (clean).
4. **Geometry correction after independent review** (Codex P2, `CODEX-REVIEW.md`). The original budget test treated every width as a fresh open, used Bootstrap margins, and left out cell padding.
   - **`geometry-red-jest.log`**: the corrected assertions run against the old helper. Result: 2 failed, 18 passed, 20 total. The old helper gives a 294px frame where the correct model gives 300.4px.
     - An earlier attempt hit a splice syntax error, so that suite never ran. It is not counted as RED.
   - **`geometry-green-jest.log`**: 20 passed after correcting only the test helper.

## Selection and opener semantics (unchanged)

- **Row click.** Clicking a row runs `openPatient("<pid>")`. This writes the pid into `opener.document.forms[0]["select[<key>]"]` and calls `window.close()`.
- **Add New Patient.** Runs `openPatient(0)`, which writes `0` and closes the window.
- **Cancel.** Calls `window.close()`.
- **Missing field.** If the opener field is missing, the dialog calls `alert('Form element not found: select[<key>]')` and does not close.
- **Form submit.** `myRestoreSession()` calls `top.restoreSession` if it exists, otherwise `opener.top.restoreSession`.
- **Hover highlight.** Mouseover adds `.highlight` and mouseout removes it.
  - The compiled theme's `.highlight` sets colour and background with `!important`. The workbench CSS restates both as a paired tint, so the highlighted row stays visibly distinct.
  - The CSS adds no extra `:hover` state.

The jsdom tests execute the route's own inline script. They use a synthetic opener form and stubbed
`close`, `alert` and jQuery.

## Geometry: declared budgets only

The caller requests 850px. `dialog.js` turns that into a `max-width` percentage, computed once at
open time:

- **Window 1080px wide or narrower:** `modal-full`, which is 97%.
- **Wider than 1080px:** `(850 / innerWidth * 100).toFixed(1)` percent.

After the dialog is appended, `dialog.js` sets an inline `margin: 0.75rem auto auto` on the dialog.
This makes the horizontal margins `auto`, which overrides Bootstrap's `.5rem` and `1.75rem auto`
margins. The resulting widths:

- **Dialog width:** `min(percent × current width, current width)`.
- **iframe width:** the dialog width minus 2px for the `.modal-content` border and minus 8px for `.modal-body.px-1`. The iframe itself is `border-0 w-100`.

The CSS declares the following horizontal decoration:

- **Body and document box:** 46px in total (body padding 10+10, document padding 12+12, document border 1+1).
- **Six table cells:** 96px in total (8+8 padding each).

| Case | Percent | iframe | Minus 46 + 96 | Remainder for text |
|------|---------|--------|---------------|--------------------|
| Direct open at 320px | 97% | 300.4px | 142px | 158.4px |
| Direct open at 1081px | 78.6% | ≈839.7px | 142px | ≈697.7px |
| Opened at 1920px, then resized to 320px | 44.3% (frozen at open) | 131.76px | 142px | **−10.24px** |

What the remainder column does and does not show:

- **The text min-content is unknown.** Real names, addresses, translations, the theme font and the font size decide whether six columns fit. The remainder is a declared budget, not a usability result.
- **The open-then-resize case is negative before any text.** The frame width comes from the existing `dialog.js` sizing, which is inherited. The NEW body/document decoration in this patch still contributes to the negative declared text budget. No native baseline comparison was run, so neither whole failure nor non-regression is established. It is pinned as a diagnostic assertion, not a pass. Narrow-frame usability stays **OPEN**.

## Inherited behaviours disclosed, not repaired

These are intentionally left alone in this presentation slice:

- **`<h5>` inside `<table>`.** The parser moves the heading out so it renders before the table. CSS targets `.oe-match-heading` wherever it ends up.
- **Unmatched `</center>`.** There is no opening `<center>`; the parser ignores the closing tag.
- **Click-only result rows.** Rows have no keyboard focus or activation. Only the two buttons are keyboard reachable.
- **No null-opener guard.** Opening the dialog without an opener makes `openPatient` throw.
- **Native-window `window.close()`.** In a `dlgopen` iframe, whether this actually closes the modal depends on the host's dialog integration, which is unverified here.
- **No rows scored above zero.** The table shows only the header, and Add New Patient and Cancel remain.

## Limits of this evidence

All evidence comes from source hashing, PostCSS parsing, and jsdom running the inline script. None
of the following was exercised:

- PHP rendering, the database, or the real closeness rows.
- The real opener page or `dlgopen` and Bootstrap modal behaviour.
- Browser layout or the compiled theme cascade.

## Open acceptance gates

None of these is claimed:

- Native rendering across all compiled themes (light, dark, and the colour themes), including the real cascade against `!important` rules on `.body_top`, `.table-striped` rows, `.highlight` and `input[type=button]`.
- Configured font family and size, and wrapping with real data at the narrowest direct-open and open-then-resize frames.
- Keyboard use, the focus ring (`:focus` fallback and `:focus-visible`) and contrast measurement.
- The real opener in `list_reports.php`, including selection write-back, modal close and the restore-session path.
- Translations with long strings and right-to-left languages.
- Print: the stylesheet link is `media="screen"`, but print output is unverified.
- Legacy (non-workbench) mode: the styling should be inert because of the `html.oe-workbench-popup` scope, but this is unverified natively.
- Live roles with ACL `patients/med`, and an ACL-denied render.
- A deployed instance.
- Ordinary independent review and approval, and exact-head CI.

Merge and deployment are not authorized by this document.
