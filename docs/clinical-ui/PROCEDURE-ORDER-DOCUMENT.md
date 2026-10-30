# Procedure Order document presentation

Owner: Hermes. Allocation: 1 of a maximum of 2 **SCHEDULED** delivery runs, including QA. This is the current independent rotation from OPEMR-172.

## Scope

OPEMR-173 is a partial adaptation of the document intent in `/Users/craig/artifacts/OpenEMR-Research/researched/index.html` to the existing native Procedure Order route. In an active workbench on screen, `interface/forms/procedure_order/common.php` gives the native container a centered paper surface with a maximum width of 1100px and natural spacing around the heading and form. The native fieldsets, controls, table, actions, PHP expressions, SQL, and JavaScript remain as they were. The theme continues to style fieldsets and controls. The new selectors require `html.oe-workbench-context` and `body.oe-procedure-order-document`; the rules are inside `@media screen`.

The addition is the exact `ADDED_STYLE` block and `BODY_AFTER` class declared in `tests/clinical-ui/procedure-order-document-contract.cjs`. Its inverse is intended to recover the original source fixture byte for byte. This is a presentation slice, not an adaptation of all 22 researched features, the full design, or clinical acceptance. No mock behavior or data is copied into production.

## Existing route hazards and boundaries

The route can save an order, alter existing order data, generate or transmit HL7, dispatch Quest and DORN events, call LabCorp functions, create or save requisition PDFs, and write logs. Its form ID comes from `$_REQUEST`; a GET with an existing lab order can reach the log-directory `mkdir` branch. Merely opening the route is therefore not treated as harmless. The route was not executed for this slice. Source preservation does not establish authenticated security, persistence, or transmission acceptance.

## Evidence and remaining gates

The genuine tests-only RED evidence predates the change: portable `red.tap` has 4 passes and 1 failure; history `red-history.tap` has 5 passes and 1 failure. Both fail because the document body class is absent. The files are in `/Users/craig/.hermes/projects/openemr/verification/procedure-order-document-20261030/`. Proposal stylelint evidence at `stylelint.json` in that directory reports a nonignored result with zero warnings. These are RED and proposal-lint records, not post-change green results.

Browser and native acceptance, full accessibility, contrast, RTL, roles, and conditional modes remain unpassed. Ordinary review and complete hosted exact-head CI remain unpassed. There is no merge, deployment, or standing bypass.

The earlier OPEMR-172 permission failure remains a boundary. The Swedish clone, denied cache, Jest, ESLint, and supplemental source-byte checks were not retried here. This rotation makes no claim from those unavailable checks.
