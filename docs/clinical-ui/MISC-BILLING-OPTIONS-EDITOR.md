# Miscellaneous Billing Options editor — OPEMR-167

## Scope and source preservation

The native `interface/forms/misc_billing_options/new.php` document gains exactly two presentation additions: the CSS block exported by `tests/clinical-ui/misc-billing-options-editor-contract.cjs` immediately before `</head>`, and `class="misc-billing-options-document-editor"` on `<body>`. The CSS applies to screens only, under `html.oe-workbench-context`, and uses the existing workbench palette variables with fallbacks. It gives the original form a responsive document surface capped at 1000px, keeps the existing field hierarchy and lets the native Additional Notes textarea grow vertically within its bounded height. The source reference is `/Users/craig/artifacts/OpenEMR-Research/researched/index.html`; this slice is the actual route's document and workspace treatment, not acceptance of the full reference, original 2, or all 22 areas.

The complete 23,722-byte original route is pinned by `tests/clinical-ui/fixtures/misc-billing-options-new-original.php.txt` (SHA-256 `a5855f5d78028500f5bb6d456ae1a7023b6cfc169ff4da01c04bdb872d99c1d9`). The contract's inverse must recover every original byte. No PHP, JavaScript, CSRF, session, SQL, field names or values, radio and label pairing, billing actions, or widget configuration is changed. The existing `view.php`, `save.php`, `src/Billing/MiscBillingOptions.php`, datetimepicker bridge, `OemrUI.php`, `config/config.yaml`, workbench popup CSS, and theme files are support paths and remain unchanged. After initial RED and implementation, the controller strengthened negative tests by constructing every mutation outside `assert.throws`; this changes tests only, not the CSS proposal or production behavior.

## Recorded RED and verification

The controller recorded tests-only HEAD `fd9677da614ca44df6d283e6c732efea95c3bcf7` before these two additions. The portable contract was **9 tests, 8 passed, 1 failed**; the explicit history mode was **11 tests, 10 passed, 1 failed**. Both failed only `actual route has the exact presentation proposal`, with the missing body class seam. Evidence: `/Users/craig/.hermes/projects/openemr/verification/misc-billing-options-editor-20261029/red-portable.log` and `red-history.log` in the same directory. These are RED results; no GREEN, browser, or CI result is claimed here.

For the independent verifier, the commands are:

```sh
node --test-reporter=tap tests/clinical-ui/misc-billing-options-editor-contract.cjs
node --test-reporter=tap tests/clinical-ui/misc-billing-options-editor-contract.cjs --history
```

The portable contract checks exact CSS, the positive proposal and inverse, protected source semantics, and mutation rejection. The explicit history mode additionally authenticates the base fixture and nine unchanged support paths, and checks the combined five-file change scope. After implementation and test-only negative-mutation strengthening, the controller ran portable 9/9 and history 11/11 successfully, PHP syntax and `git diff --check`, and actual nonignored scoped CSS Stylelint with zero warnings. Local Jest/combined ESLint were not rerun; previously recorded denial boundaries remain in force.

Initial native-PHP-body offline browser evidence found a new Comments keyboard-center visibility failure at desktop width with long English labels: the unchanged original center is visible while the candidate center falls below the viewport. Native focus and a 3px outline remain present; this does not prove data loss or inability to type. This is an open acceptance blocker, not a passed keyboard gate. The fixture uses native MiscBillingOptions date/provider markup but synthetic helpers/header/records and no route bootstrap, SQL, session, date-widget initialization or Save. Final controller evidence in the task verification directory supersedes preliminary browser counts; no full reference or authenticated acceptance is claimed.

## Acceptance still open

Native authenticated verification must cover Save and reopen with persisted values, the billing dialog and tab contexts including Cancel behavior, authorization and other security behavior, session and CSRF behavior, date and select widgets, light and dark themes, keyboard focus and navigation, full accessibility, old engine compatibility, and OS print behavior. All of these runtime gates are **not yet accepted**. Source preservation and the portable contract do not establish those outcomes. Clinical acceptance, the full reference, and other work areas are **not yet accepted**.

This implementation run is owner run 1 of at most 2 runs including QA. The next run rotates to a **different independent implementation**, not unchanged QA. This branch has no master write, merge, or deploy authority, and there is no standing approval bypass.
