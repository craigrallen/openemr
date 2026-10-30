# Fax/SMS setup popup presentation (OPEMR-180)

This is a partial researched document-layout slice for the fax/SMS setup form. The added screen CSS places the existing form in a centered paper panel, allows headings and field help to wrap, constrains form controls, gives the message textarea room, and keeps the required-fields note and Save button together when space narrows. A document body class and `html.oe-workbench-context` scope limit the styling to the clinical workbench context. The initial browser comparison passed 720 inactive and print inertness comparisons. The latest scoped 12px form-group spacing correction has not yet had its final browser run.

The original 22-feature register in [ACCEPTANCE.md](ACCEPTANCE.md) remains **OPEN**. This slice does not close any of those rows.

## Paths and existing behavior

The frozen five-path scope is:

1. `interface/modules/custom_modules/oe-module-faxsms/setup.php` — production presentation addition.
2. `tests/clinical-ui/faxsms-setup-popup-contract.cjs` — source and history contract.
3. `tests/js/faxsms-setup-popup.test.js` — JavaScript contract.
4. `tests/clinical-ui/fixtures/faxsms-setup-original.php.txt` — pinned original source.
5. `docs/clinical-ui/FAXSMS-SETUP-POPUP.md` — this handoff note.

The caller's `doSetup` chooses `setup_rc.php` for RingCentral and `setup.php` otherwise, then opens `dlgopen('', 'setup', 'modal-md', 700, ...)`. `setup_rc.php` is a separate path and is outside this change. The form, service branches, ACL check, credential read, CSRF field, JavaScript escaping, POST serialization, messages, close/reload timing, and Save control remain in their original source positions. Existing markup and behavior, including existing error paths, were not repaired here.

## Evidence and limits

Tests-first commit `fba836629b26226013857da14cb860cf8b05c812` is the correction handoff HEAD. The controller recorded genuine RED for the updated frozen style block: 6 tests, 5 pass and 1 failure because the production block lacked the scoped 12px form-group rule. The exact log is `/Users/craig/.hermes/projects/openemr/verification/faxsms-setup-popup-20261030/red-spacing.tap`. The earlier tests-first and presentation evidence remains in `red.tap` and `red-history.tap`. The contract requires precisely its additive CSS before `</head>` and the declared body class, with an inverse check that every original source byte survives. It does not validate secrets, roles, or backend behavior. The controller will run green, lint, and final browser checks after this correction.

The initial offline browser run covered 240 cases, 720 inactive and print comparisons, and 1,480 Tab stops. It found 20 center misses on `form_message` for Twilio and RingCentral at 1366px, in both directions and all themes. In the controlled 700px viewport comparison, the original textarea began at y=616.8 with height 86, putting its center at 659.8 (pass); the candidate began at y=657.8 with height 86, putting its center at 700.8 (outside the viewport, fail). Native keyboard focus still reached the field; this was a geometry miss, not data loss. Exact evidence is `/Users/craig/.hermes/projects/openemr/verification/faxsms-setup-popup-20261030/browser.json` and `keyboard-comparison.json`. The new 12px form-group margin reduces cumulative vertical spacing, but final browser evidence is not yet available and resolution is not claimed. Native startup and Save remain unexercised. The original 22-feature register, UI acceptance, Swedish clinical review, authenticated accessibility, contrast, runtime/provider behavior, security, persistence, and original error paths remain **OPEN**.

All recorded permission denials, including Swedish checkout and publication, remain in force. There is no bypass, merge, deployment, master change, database change, or cron change in this slice. After at most two scheduled consecutive runs, rotate work; `setup_rc.php` is only a proposed next different candidate, subject to a fresh ownership and credential-outbound preflight, and is not reserved.
