# Group Finder popup

`interface/main/calendar/find_group_popup.php` is opened by
`interface/forms/newpatient/newpatient.js` and
`interface/main/calendar/add_edit_event.js`, and returns a group via
`opener.setgroup(gid, name, end_date)`. This slice gives the route a quiet,
document-shaped body when it is open inside an active workbench popup. The
existing popup bundle adds `html.oe-workbench-popup`. The route's original
declarations and behaviour bytes are preserved (see the map below). The
presentation itself does change: added padding, margins and line-height alter
intrinsic layout (see Open gates).

## What changed

The route differs from the original only by this reversible presentation map:

| Original | Presented |
|---|---|
| `use OpenEMR\Common\Csrf\CsrfUtils;` | `ClinicalWorkspaceAssets` import added before it |
| `Header::setupHeader('opener')` line | followed by a versioned `<link media="screen">` to `group-finder-popup.css` |
| `<body class="body_top">` | `<body class="body_top oe-group-finder-popup">` |

`ClinicalWorkspaceAssets` lists `group-finder-popup.css` in its fixed,
sorted basename list.

`interface/clinical-workspace/group-finder-popup.css` has no at-rules, so it
has no media queries and no imports. The link's `media="screen"` keeps it out
of print. Every selector starts with
`html.oe-workbench-popup body.oe-group-finder-popup`. The sheet:

- pairs paper and ink on the body, the search sheet, the select, text field and Search button (resting and focused), the header row, and the result cells;
- keeps the mouseover `.highlight` (petrol/on-petrol) separate from the `noResults` (canvas, muted rule), `tooManyResults` (warning paper/ink) and `howManyResults` (paper, petrol rule) states;
- uses a 2px `:focus` ring as a fallback and a separate 3px `:focus-visible` ring;
- lets the criteria wrap (`white-space: normal`, `overflow-wrap: anywhere`) without shrinking text. The select, text field and Search button keep their padding and full text, and are capped at `max-width: 100%` with `box-sizing: border-box` and no horizontal margin, so padding and border stay inside the cap and the outer box does not exceed the container. No rule declares `font-size`, so text keeps the sizes the route and active theme already give it (including any configured larger text); only `font-weight` changes for emphasis;
- does not declare `width`, `height`, `overflow`, `display`, `visibility` or any font family, font size or `font` shorthand. The route's width, height and percentage declarations (column percentages, the 96% header table, the scrolling `#searchResults` box) are preserved as written in its unchanged inline CSS. This preserves declarations, not native alignment: added cell padding changes intrinsic table sizing, and the criteria line-height, status margins and padding change vertical geometry. Whether the separately laid-out header and result tables still line up, and whether the content fits the dialog frame, is unverified.

**Theme cascade (not accepted).** Existing `.body_top` background declarations in `color_base.scss` use `!important`, so they can override this sheet's normal-priority body background. Paired paper/ink declarations here therefore do not prove a computed paper/ink pair on the body under a compiled theme. This is a pre-existing cascade constraint. This slice does not change the theme and does not accept the compiled-theme result.

`workspace.css` is not loaded.

## Preserved as-is (pre-existing limitations, not fixed)

- The trailing `</center>` has no opening tag.
- `$("#submitbtn").css("disabled", "true")` has no effect, so the button stays enabled.
- `selgid` reads `opener.closed` without a null check, so a null opener throws a `TypeError` and `dlgclose()` is never reached.
- The search field echoes `$searchparam` (a typo for `$searchparm`), so the term is never kept after a search.
- `isset($result)` is always true, so the "No groups found" branch is unreachable.
- `SelectGroup` assigns the implicit global `objID`.

## Verification

`tests/js/group-finder-popup.test.js` (jsdom + postcss) checks the following:

- **Route digest.** Reversing the map gives the original route's SHA-256 byte for byte. Mutations to CSRF, search dispatch, thresholds, the opener callback, the closed-opener guard, selection and row-ID order, escaping, inline CSS, the disabled setter or `</center>` all break the digest. So does an edit outside the map.
- **Callers.** Both caller files match their pinned SHA-256 hashes.
- **Original scripts.** The two inline scripts are run with the single `xlj` echo substituted, against synthetic controls. The tests cover focus on ready, the row click passing ID, name and end date, a closed opener, a missing `setgroup`, a null opener (still throws), the highlight toggle, and submit: the spinner becomes visible, the button is not disabled, and no request is sent.
- **Stylesheet.** Scope, no at-rules, the forbidden properties, paired palettes, the distinct status states and wrapping.
- **Focus rings.** Every ring rule must be homogeneous: every fallback selector ends in `:focus` and every visible selector ends in `:focus-visible`. A mutation that merges the production fallback and visible rules into one combined rule is rejected.
- **Box budget.** Every rule with `max-width: 100%` must declare `box-sizing: border-box` and zero horizontal margin, whether set by shorthand, `margin-left`/`margin-right` or `margin-inline*`. Mutations of the production controls (`margin: 0 4px`, a four-value left margin, `margin-inline`, `content-box`) are rejected. This checks declarations, not rendered geometry.

`tests/Tests/Isolated/Common/Assets/ClinicalWorkspaceAssetsTest.php` covers
the versioning. This is a source-substitution harness. It is not the PHP
runtime, and it measures no native geometry.

## Open gates

Still to check: header/result column alignment and frame fit after the added padding, the computed body paper/ink under `.body_top` `!important` theme backgrounds, compiled theme variables, a tiny dlgopen frame (650×300), keyboard-only flow, a real opener from both callers, translated strings that change wrapping, print, legacy themes, live screen-reader roles, a deployed stack, and ordinary review/approval.
