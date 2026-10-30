# Fax/SMS setup popup presentation (OPEMR-180)

This is a partial researched document-layout slice for the fax/SMS setup form. The added screen CSS places the existing form in a centered paper panel, allows headings and field help to wrap, constrains form controls, gives the message textarea room, and keeps the required-fields note and Save button together when space narrows. A document body class and `html.oe-workbench-context` scope limit the styling to the clinical workbench context. Print and legacy inertness is intended but has not been measured.

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

Tests-first commit `c0b26d924aafdbac45855d9841e5fe584150b453` is the handoff HEAD. The controller recorded genuine RED before this presentation addition: portable contract 5 tests, 4 pass and 1 failure for the missing marker; history contract 6 tests, 5 pass and 1 failure. Exact logs are `/Users/craig/.hermes/projects/openemr/verification/faxsms-setup-popup-20261030/red.tap` and `red-history.tap`. The contract requires precisely its additive CSS before `</head>` and the declared body class, with an inverse check that every original source byte survives. It does not validate secrets, roles, or backend behavior. Controller inverse verification and linting are separate from this implementation handoff.

Offline synthetic BODY rendering with fake credentials and disabled original scripts will be checked separately. Native modal geometry, runtime/provider behavior, credential handling, security, persistence, and Save acceptance are not established by this source change. Full authenticated clinical accessibility, contrast, startup visibility, original error paths, and Save remain open.

All recorded permission denials, including Swedish checkout and publication, remain in force. There is no bypass, merge, deployment, master change, database change, or cron change in this slice. After at most two scheduled consecutive runs, rotate work; `setup_rc.php` is only a proposed next different candidate, subject to a fresh ownership and credential-outbound preflight, and is not reserved.
