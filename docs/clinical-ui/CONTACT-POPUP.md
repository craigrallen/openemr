# OPEMR-179: native Contact popup presentation

## Scope and provenance

This is a partial implementation of the original UI requirement: a responsive document form inside the existing native Contact popup. It does not implement the full [researched reference](/Users/craig/artifacts/OpenEMR-Research/researched/index.html) or all 22 original requested features. The reference is a synthetic design prototype, not an authenticated OpenEMR acceptance result; it does not establish 22 accepted workflows.

The real popup is `interface/modules/custom_modules/oe-module-faxsms/contact.php`. Its caller, `interface/modules/custom_modules/oe-module-faxsms/public/js/messageUI.js`, opens it through `dlgopen`. The third argument supplies the modal width/class and the fourth supplies its height: `messageReply` uses `modal-sm` with height 700 for SMS, `sendFax` uses `modal-sm` with height 600, and `forwardFax` uses `modal-md` with height 800. This is an independent Contact popup. The nested prescription lookup was rejected as ineligible for this rotation.

The existing `interface/clinical-workspace/popup.css` defines the screen-only workbench popup context and palette. The native template now adds the contract's exact CSS block immediately before `</head>` and changes only `<body>` to `<body class="oe-contact-document">`. Every new selector requires both `html.oe-workbench-context` and `body.oe-contact-document`. The layout gives the form a bounded paper surface, responsive spacing, wrapping controls, and a visible keyboard focus outline. Outside that context or in print, this added CSS is inert. No native ACL, authentication, CSRF, session, patient lookup, form field, visibility condition, callback, or send path was changed.

## Exact five-path change scope

1. `interface/modules/custom_modules/oe-module-faxsms/contact.php` — native presentation addition.
2. `tests/clinical-ui/contact-popup-contract.cjs` — committed static source contract.
3. `tests/js/contact-popup.test.js` — committed source tests.
4. `tests/clinical-ui/fixtures/contact-popup-original.php.txt` — committed whole-original fixture.
5. `docs/clinical-ui/CONTACT-POPUP.md` — this handoff note.

The fixture preserves the entire original `contact.php`, not selected fragments. The contract constructs the exact additive candidate from that fixture, then uses `restoreSource` to remove the frozen CSS block and body-class replacement. It requires the restored source to equal the whole fixture and the candidate to equal the exact constructed result. Its mutation cases reject changes to security, transport, callbacks, fields, conditional visibility, and each frozen CSS declaration. These are source checks; they do not execute the application.

## TDD evidence and acceptance boundary

The tests-only commit is `f1624a7dcd6a7e94983937ef3c253cec7e55571e`. The initial static run in `/Users/craig/.hermes/projects/openemr/verification/contact-popup-20261030/red-initial.tap` recorded 5 tests, 4 pass, 1 fail: the production style marker was missing. The history variant recorded 6 tests, 5 pass, 1 fail for the same genuine historical RED. The synthetic positive, preservation and CSS mutation cases passed. The historical source test name “production remains RED” is a test name, not a claim that production currently fails. The proposed style block's pre-implementation Stylelint result in `/Users/craig/.hermes/projects/openemr/verification/contact-popup-20261030/proposal-stylelint.json` recorded 0 errors, 0 warnings, and no ignored file.

The controller's final local evidence before this documentation-only correction records source checks 5/5 and history checks 6/6 passing, clean syntax, and actual nonignored Stylelint with 0 warnings. Offline browser evidence records 160 rendering cases, 480 inactive/print comparisons, and 1,040 sequential Tab center hits with zero recorded errors or network requests. Those checks used a synthetic PHP BODY with offline native helpers and disabled original JavaScript. They do not accept native show/hide startup behavior, revealed identity fields, callbacks, transports, authentication or security persistence, full contrast and accessibility, or radio navigation. Faint dark-theme placeholders remain an open acceptance concern; the evidence does not confirm they were introduced by this change. The full reference, all 22 original requested features, and clinical acceptance remain incomplete. The controller will rerun its gates after this documentation-only edit. This correction is an independently reviewed documentation-only TDD exception; it adds no production change or new failing regression.

Source tests can establish the bounded additive edit and guard against declared mutations. Authenticated acceptance still needs the actual narrow modal at caller classes/heights, role and ACL variations, CSRF and session behavior, persistence, contact patient queries, email/fax/SMS transports, real templates, all themes and contrast, full keyboard focus and accessibility, real RTL, and OS print behavior. Use synthetic data for presentation checks; never send or retrieve real patient data for presentation.

## Ownership and disposition

Hermes owns this scheduled run 1 of at most 2. Implementation and QA are internal phases of that same run, not additional runs. Worker phases prohibit tests, network, and Git mutations. The controller is authorized to run tests, make Git mutations, and use hosted CI for final gates. The Swedish fresh clone and publication were denied, and those denials bind the controller too; all other separately denied actions remain forbidden in every phase. A denial ends the attempt without retry. Ordinary approval is required before any merge or deployment.

The next different proposal is the actual dated-reminder edit popup. It is pending fresh ownership and eligibility checks; it is not reserved or accepted.
