# ACL administration help popup presentation

## Scope and source chain

OPEMR-86 changes the presentation of `Documentation/help_files/adminacl_help.php` in a workbench context. The production change is one screen-only style block and one body class. Its five palette rules pair canvas, sheet, heading, ordinary non-button links, and redirect icon backgrounds and ink. The two `!important` declarations address the existing heading and redirect theme overrides. The original 768 px responsive rule, PHP session setup, translations, all three ACL sections, hidden ACO list, eye toggle and title timing, four sample controls, warnings, semantic icons, external link, font and geometry rules, and ACL guidance remain in the route.

`interface/usergroup/adminacl.php` checks `AclMain::aclCheckCore('admin', 'acl')` and uses `AccessDeniedHelper::denyWithTemplate` on failure. It passes `show_help_icon` and `help_file_name = "adminacl_help.php"` to `src/OeUI/OemrUI.php`. OemrUI checks `enable_help` before registering the help icon listener, with separate setting values for the icon title. Its ordinary `#myModal` contains `#targetiframe`; the delegated `#help-href` click copies the iframe's `data-src` into `src` on first open. `src/Core/Header.php` loads autoload assets registered in `config/config.yaml`, including `interface/clinical-workspace/popup.js` and `popup.css`. The unchanged popup controller follows same-origin frame ancestry to an active workbench shell and places `oe-workbench-context` on the help document's `html` element. This ordinary OemrUI modal ancestry supplies context only; it does not assign `oe-workbench-popup` to the help document. The new rules require both that context class and the route's body class. Standalone, legacy, and cross-origin help remain outside this scoped palette.

The relevant source contract is `tests/js/contracts/adminacl-help-popup.cjs`; `tests/js/adminacl-help-popup.test.js` invokes it through Jest. The byte-pinned original is `tests/js/fixtures/adminacl-help-popup-original.php.txt`. Those tests and the caller, controller, shared assets, and themes were not changed for this route implementation.

## Evidence and pending verification

Before the production edit, the controller ran the portable contract with test files still uncommitted on actual base `18647270e0c799189d2dc10f801e8de2bff1a360`; tests-only commit `7cdcd240` was created afterward. The recorded RED result in `/Users/craig/.hermes/projects/openemr/verification/adminacl-help-20261021/red.log` is 36 tests, 35 passed, 1 failed. The sole failure was the expected live-route missing-presentation assertion. The synthetic candidate, mutation checks, unchanged `popup.js` VM cases, extracted OemrUI lazy handler, and original help show/hide handler execution passed. The tests-only commit followed that RED run.

Controller GREEN passed: portable 36 tests, mandatory local history 37 tests, full Jest 62 suites/1,260 tests, PHP syntax, ESLint, actual nonignored inline CSS lint, full original-byte inverse, and diff hygiene. Independent review and exact-head hosted CI remain pending at this documentation checkpoint. Relevant commands are:

```sh
node --test --test-reporter=tap tests/js/contracts/adminacl-help-popup.cjs
node tests/js/contracts/adminacl-help-popup.cjs --require-history
npx jest tests/js/adminacl-help-popup.test.js --runInBand
```

The optional history mode checks the authentic base and changed-file scope. The controller also owns exact-head hosted CI and any publication gate. No native authenticated session, user role, or ACL eligibility path has been exercised for this implementation. Source preservation and synthetic execution do not establish computed contrast, browser geometry, keyboard behavior, RTL, print behavior, or security acceptance. The inherited ACL guidance remains source content, not a clinical or security endorsement. This route is a limited part of the researched clinical UI, the original 22-feature register, exhaustive popup inventory, demo acceptance, and the Swedish programme; their separate gates remain open.
