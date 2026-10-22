# Advance Directives popup (`interface/patient_file/summary/advancedirectives.php`)

Screen-only document presentation for the Advance Directives dialog that the patient summary
(`interface/patient_file/summary/demographics.php`) opens with
`dlgopen('advancedirectives.php', '_blank', 400, 500)`. The caller is unchanged.

## What changed

The complete set of presentation edits. `tests/js/advance-directives-document.test.js` reverses them and
checks the result against the master `18647270` digest `fb173795…cbd3a`:

1. `use OpenEMR\Common\Assets\ClinicalWorkspaceAssets;`
2. After the original `Header::setupHeader(['datetime-picker','opener'])`: one `media="screen"` link to
   `interface/clinical-workspace/advance-directives-document.css`, versioned through `ClinicalWorkspaceAssets`.
3. Classes added to existing elements:
   - `body_top oe-advance-directives` on the body (route);
   - `container oe-ad-document` (document);
   - `col-12 oe-ad-fields` around the form (fields);
   - `btn-group oe-ad-actions` (actions);
   - `col-12 oe-ad-documents` around the filed-document links (documents);
   - `col-12 alert-danger oe-ad-attestation` (NPI warning).
4. `'advance-directives-document.css'` added to the `ClinicalWorkspaceAssets` allowlist.

`advance-directives-document.css` is one `@media screen` block with no breakpoints. Every selector starts
with `html.oe-workbench-context body.oe-advance-directives`, so the styles apply only when the production
`popup.js`, which Header already loads, finds an active workbench. Legacy mode, a standalone window and
print keep the original rendering. The generic `workspace.css` is not loaded.

Layout:

- A quiet canvas behind one paper sheet.
- Completed and Last Reviewed stack as label-above-field entries.
- The document links area breaks long names.
- The original NPI attestation warning is shown as a warning notice using the `popup.css` warning tokens.

Theming:

- Colours come from the fixed `popup.css` tokens, with explicit text/surface pairs for the body, heading,
  labels, fields, focused fields, links (including hover), Save, Cancel and the warning. Placeholder text
  uses the muted colour on the field's paper.
- The tests check the declared pairs (each meets 4.5:1). They do not prove what a compiled theme
  renders: any theme rule that wins the cascade replaces a declared pair.
- One such rule is known and answered. The colour themes (`color_base.scss` via
  `colors/utilities/bootstrap.scss`) paint every `.btn-link`, Cancel included, with `!important` ink and
  surface in all states. Cancel's colour and background are therefore `!important`, and its selector
  out-specifies every theme `.btn-link` selector. A test parses the theme source and checks this. No other
  declaration is `!important`. Cancel's border is left to the theme.
- Other compiled themes, including dark and Solar (whose `.btn-secondary` rules affect Save), have not been
  checked against the cascade.

Focus and actions:

- Links and buttons have a `:focus` outline as a fallback, plus `:focus-visible`. They are separate rules,
  so a browser that does not know `:focus-visible` still applies the `:focus` rule.
- Save and Cancel wrap with `flex-wrap`, and long labels break.
- Fonts are inherited and never resized.
- Field paint skips Bootstrap validation states.
- The inline `color:red` EMPTY marker is untouched.

## Frozen (pinned by tests)

Source tests pin these verbatim, and mutating any of them fails the digest:

- The POST branch, the CSRF check, `filter_input` reads and the `UPDATE patient_data` statement with its
  bindings.
- The opener refresh and `dlgclose()` script, and the `SELECT` statements for `patient_data`, `categories`
  and `documents` (including `deleted = 0` and `ORDER BY … DESC`).
- `UserService`, the `npi` condition and both warning sentences.
- Both `generate_form_field` descriptors and the CSRF hidden input.
- The form action and `onsubmit`, button ids, types and classes, the Cancel handler and the date picker
  settings.
- The document link URL and the EMPTY marker.

The original `validate()` also runs in jsdom through the original `onsubmit`. An empty Last Reviewed value
gives a native alert, moves focus to the field and blocks submission. A synthetic date submits.

## Not a legal statement

The warning text and its condition are unchanged. This presentation makes no claim about legal
attestation, NPI substitutes or any national (for example Swedish) acceptance of advance-directive
review.

## Evidence levels

- **Source contract (Jest, jsdom, postcss):**
  - the edit-map digest and negative mutations;
  - CSS scoping, typography, logical properties and declared token contrast;
  - Cancel's `!important` pair against the colour themes' `.btn-link` source rules (specificity and
    importance, not a compiled-theme render);
  - separate `:focus` and `:focus-visible` rules;
  - the real `popup.js` controller turning the sheet on, off for legacy mode, and back on;
  - declared-box width estimates at 146px and 180px. These estimates are not browser measurements.
- **PHPUnit:** the asset helper only.
- **Not done:**
  - Native PHP execution of this route. It needs the real session factory, CSRF, `UserService` and the
    database query helpers. No guarded harness was built in this slice.
  - Real-browser acceptance: compiled theme, dark theme, keyboard, date picker, real opener refresh, print,
    legacy mode, and 146px/180px pixels.
  - Deployed acceptance.
