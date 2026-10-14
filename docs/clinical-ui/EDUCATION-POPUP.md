# Education Popup

Presentation-only slice for the patient education materials chooser
(`interface/patient_file/education.php`) when it renders inside an active
workbench popup. It is a source-only change: no route logic, wording,
request handling, session, CSRF, download or redirect behaviour changes.

## Files

| File | Change |
|------|--------|
| `interface/patient_file/education.php` | One `use` import, one screen-only stylesheet link, `oe-education-*` classes on existing nodes |
| `interface/clinical-workspace/education-popup.css` | New route stylesheet, one `@media screen` block |
| `src/Common/Assets/ClinicalWorkspaceAssets.php` | Allows `education-popup.css` as a versioned asset |
| `tests/Tests/Isolated/Common/Assets/ClinicalWorkspaceAssetsTest.php` | Covers the new asset basename |
| `tests/js/education-popup.test.js` | Focused Jest suite (18 tests) |

## Route bytes: exact inverse digest

The Jest suite declares six `[original, presented]` edits. Undoing them must
reproduce the 168-line original route byte for byte, with sha256
`013836ec42768c8f817606a79e6863f0ed09d045c16ffc8b3ac8724993e4762a`
(`education.php` at `origin/master` 18647270). Each edit must occur exactly
once, so a removed or duplicated edit fails the inverse, and any business,
wording, session or close mutation changes the restored digest.

The three callers open the route as a forced window (`dlgopen(..., true)`)
and are byte-identical to master:

| Caller | sha256 |
|--------|--------|
| `interface/orders/single_order_results.inc.php` | `17b7eb52c209bef3450046eb2aaaea33834bca94713e2ef818e7c0392dff8ce7` |
| `interface/patient_file/summary/demographics.php` | `00554d54565a92ee3b71a79053ac4f3daf55def3501d3dce6cf284d4615cbd3a` |
| `interface/patient_file/summary/stats_full.php` | `06be3854bda78f35827ea8e41ab9c35f26ed01147afd83dc2fcb2a1bcdf5e526` |

## Controls preserved

All original controls stay present and behave as before: the heading (with
its optional language clause and `text-danger` error paragraph), the hidden
fields, the source `<select>` with its original options and default, the
submit button (runs `top.restoreSession` with the original payload and does
not navigate in the fixture), and Cancel (closes the window without
submitting). The rendered DOM equals the original apart from the stylesheet
link and the `oe-education-*` classes.

## Scope

- Every selector is scoped to
  `html.oe-workbench-popup body.oe-education-popup`, so styling applies only
  when the route is inside an active workbench popup. Opened outside the
  workbench, the route keeps legacy rendering.
- Stylesheet link and all rules are `media="screen"` / `@media screen`;
  print and print preview keep the legacy rendering.
- Openers are untouched (see caller digests above).
- No `font`, `font-size` or `font-family` declarations: this slice introduces
  no typography override and preserves existing typography. The shared
  `popup.css` already sets Arial, so native or user typography alone does not
  determine the face. The heading keeps the legacy Bootstrap `h3` size; an
  earlier 1.25rem override (smaller than the legacy 1.75rem) was removed
  test-first.
- No `!important`, hidden controls, clipping, overflow suppression, fixed
  heights or fixed widths. Buttons wrap and row gutters fit narrow inner
  windows.
- The semantic `text-danger` error keeps its own colour; the stylesheet does
  not name it.

## Verification

External logs: `~/.hermes/projects/openemr/verification/education-popup-20261014/`.
Jest runs use the sibling `openemr-workbench-shell/node_modules` via
`NODE_PATH`; nothing was installed in this worktree.

| Log | Result |
|-----|--------|
| `RED-jest.txt` | Before product edits: 11 failed, 6 passed, 17 total |
| `RED-helper-probe.txt` | Helper rejected `education-popup.css` before the allowlist edit |
| `GREEN-jest.txt` | 17 of 17 passed |
| `GREEN-helper-probe.txt` (in `GREEN-mutations.txt` run) | Helper versions `education-popup.css`, still rejects `education_popup.css` |
| `GREEN-mutations.txt` | 16 negative product mutations (route, CSS, helper), each caught by 1–5 failing tests, each restored |
| `GREEN-php-lint-diffcheck.txt` | `php -l` clean on three PHP files, `git diff --check` exit 0, caller digests match |
| `RED-typography-jest.txt` | New typography guard: 1 failed, 17 passed (18) — flagged `.oe-education-title { font-size }` |
| `GREEN-typography-jest.txt` | After removing the heading `font-size`: 18 of 18 passed, no font declarations remain |
| `GREEN-typography-php-lint-diffcheck.txt` | `php -l` clean, `git diff --check` exit 0, untracked files have no trailing whitespace, caller digests match |

The earlier implementation run ended at its turn limit after its gates had
recovered to GREEN; that is a handoff, not a failed run. The typography
follow-up also ended at `max_turns` after useful changes. Neither CLI final
process exit is a success claim; the controller independently exercised the
focused gates below.

Controller-run checks:

- Asset helper PHPUnit ran with an external target-rooted bootstrap and the
  existing workbench-shell `vendor/`; reflection confirmed the helper path was
  the education checkout's. PHP 8.5.11, PHPUnit 11.5.56: OK, 50 tests, 105
  assertions. Sibling Composer files still load sibling procedural helpers, so
  this is asset-only scope, not full PHP application parity.
- Focused Jest reproduced: 18 of 18 passed. PHP syntax check and
  `git diff --check` were clean.
- A combined full Jest / ESLint / stylelint invocation was blocked before
  execution by a lifecycle scan-budget guard. No test failure was
  demonstrated, and no retry was authorised in that run. Full hosted gates
  remain pending.
- An independent Codex (Astra) review of all six files found no introduced
  P1/P2 issues. Its own Jest run was blocked by a denied temporary haste-map
  write, so that review does not count as an independent test pass.

## Acceptance gaps

This slice is verified at source level only. The Jest fixture is a
source-substituted rendering of the route's markup with PHP expressions
replaced by fixed strings; it does not execute PHP. Not yet proven:

- a real PHP render of the route through the application;
- the native compiled theme (Bootstrap/OpenEMR theme CSS actually loaded);
- tiny popup frames and narrow inner windows in a real browser;
- print and print preview;
- legacy (non-workbench) rendering;
- the forced-window path from each of the three callers;
- translated labels and longer wording;
- a real POST, the download response, and the redirect;
- a deployed instance;
- role and permission parity.

`text-danger` error contrast on the light paper surface is a native
acceptance item. Leaving the semantic class unstyled does not by itself
prove adequate contrast against `--oe-wb-paper`.

Native acceptance remains unverified. It is mandatory for every item above
before merge. This
document does not authorise a merge.
