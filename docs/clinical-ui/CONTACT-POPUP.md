# OPEMR-179: native Contact popup presentation

## Scope and provenance

This is a partial implementation of the original UI requirement: a responsive document form inside the existing native Contact popup. It does not implement the full [researched reference](/Users/craig/artifacts/OpenEMR-Research/researched/index.html) or all 22 researched workflows. The reference is a synthetic design prototype, not an authenticated OpenEMR acceptance result.

The real popup is `interface/modules/custom_modules/oe-module-faxsms/contact.php`. Its caller, `interface/modules/custom_modules/oe-module-faxsms/public/js/messageUI.js`, opens it through `dlgopen`: `messageReply` uses `modal-sm` at width 700, `sendFax` uses `modal-sm` at width 600, and `forwardFax` uses `modal-md` at width 800. This is an independent Contact popup. The nested prescription lookup was rejected as ineligible for this rotation.

The existing `interface/clinical-workspace/popup.css` defines the screen-only workbench popup context and palette. The native template now adds the contract's exact CSS block immediately before `</head>` and changes only `<body>` to `<body class="oe-contact-document">`. Every new selector requires both `html.oe-workbench-context` and `body.oe-contact-document`. The layout gives the form a bounded paper surface, responsive spacing, wrapping controls, and a visible keyboard focus outline. Outside that context or in print, this added CSS is inert. No native ACL, authentication, CSRF, session, patient lookup, form field, visibility condition, callback, or send path was changed.

## Exact five-path change scope

1. `interface/modules/custom_modules/oe-module-faxsms/contact.php` — native presentation addition.
2. `tests/clinical-ui/contact-popup-contract.cjs` — committed static source contract.
3. `tests/js/contact-popup.test.js` — committed source tests.
4. `tests/clinical-ui/fixtures/contact-popup-original.php.txt` — committed whole-original fixture.
5. `docs/clinical-ui/CONTACT-POPUP.md` — this handoff note.

The fixture preserves the entire original `contact.php`, not selected fragments. The contract constructs the exact additive candidate from that fixture, then uses `restoreSource` to remove the frozen CSS block and body-class replacement. It requires the restored source to equal the whole fixture and the candidate to equal the exact constructed result. Its mutation cases reject changes to security, transport, callbacks, fields, conditional visibility, and each frozen CSS declaration. These are source checks; they do not execute the application.

## TDD evidence and acceptance boundary

The tests-only commit is `f1624a7dcd6a7e94983937ef3c253cec7e55571e`. The initial static run in `/Users/craig/.hermes/projects/openemr/verification/contact-popup-20261030/red-initial.tap` recorded 5 tests, 4 pass, 1 fail: the production style marker was missing. The history variant recorded 6 tests, 5 pass, 1 fail for the same genuine RED. The synthetic positive, preservation and CSS mutation cases passed. The proposed style block was checked separately by Stylelint: `/Users/craig/.hermes/projects/openemr/verification/contact-popup-20261030/proposal-stylelint.json` reports 0 errors, 0 warnings, and no ignored file. These are pre-implementation artifacts. No tests or application runtime were executed in this implementation turn; the controller will execute final gates.

Source tests can establish the bounded additive edit and guard against declared mutations. Authenticated acceptance still needs the actual narrow native modal at its caller widths, role and ACL variations, CSRF and session behavior, persistence, contact patient queries, email/fax/SMS transports, real templates, all themes and contrast, full keyboard focus and accessibility, real RTL, and OS print behavior. Use synthetic data for presentation checks; never send or retrieve real patient data for presentation.

## Ownership and disposition

Hermes owns this scheduled run 1 of at most 2. Implementation and QA are internal phases of that same run, not additional runs. The recorded boundaries remain in force: no nested agents or reviewers, authentication probes, network or remote MCP, PHP/project/test runtime, Git mutations, installs, heredocs, inline interpreters, broad discovery, supplemental byte comparisons, Swedish fresh clone, or publication. A denial ends the attempt without retry. The controller performs final gates; ordinary approval is required before any merge or deployment.

The next different proposal is the actual dated-reminder edit popup. It is pending fresh ownership and eligibility checks; it is not reserved or accepted.
