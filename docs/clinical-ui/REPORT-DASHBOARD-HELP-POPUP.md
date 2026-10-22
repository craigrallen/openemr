# Patient Reports help popup presentation

## Scope

OPEMR-88 phase two adds a screen-only palette to `Documentation/help_files/report_dashboard_help.php`. The two additive seams are an inline style block immediately before `</head>` and a marker class on `<body>`. All five rules require both `html.oe-workbench-context` and `body.oe-report-dashboard-help-popup`. They pair canvas, paper, ink, and petrol colors for the help body, direct container, headings, ordinary links, and redirect icons. The heading background and redirect icon color use the two `!important` overrides needed against existing help-file theme rules.

The source fixture pins the original 26,951 bytes. The inverse of these two additions restores that fixture byte for byte. The existing four sections, five hidden panels and eye-toggle script, 14 illustrative buttons, three external link targets and their `rel="noopener" target="_blank"` metadata, translations, clinical and Direct integration guidance, PHP globals and Header setup, and the 6px border, 15px padding, italic style, fonts, and geometry stay in place. The historical clinical and integration guidance is preserved for this presentation change; this work does not endorse its currency or suitability. The sample buttons remain help-page illustrations, not report actions.

## Actual caller and context

`interface/patient_file/report/patient_report.php` creates `OemrUI` with `show_help_icon => true` and `help_file_name => "report_dashboard_help.php"`. It includes `interface/patient_file/summary/dashboard_header.php`, which passes `pageHeading()` to `templates/patient/dashboard_header.html.twig` as `{{ pageHeading }}`. The help icon's eligibility depends on `enable_help` and the caller's `show_help_icon` setting. `OemrUI` also uses `enable_help` values 1 and 2 for help-title messaging. Icon eligibility and the modal's presentation/settings are distinct; the caller setting alone does not establish a visible or opened modal.

The icon targets `#myModal`, an ordinary Bootstrap modal. Its `#targetiframe` starts with an empty `src` and receives the help URL from `data-src` on the first help-icon click. The workbench context controller follows the same-origin chain from this help iframe through the content frame to the active shell and assigns `oe-workbench-context` to the help document's `<html>`. The modal iframe is not a `.dialogModal` frame, so this path supplies context only, not `oe-workbench-popup`. The route's body marker limits the palette to this help page. Outside that context, the new rules do not match.

The style block is `@media screen`; the body marker remains in the document for every media type, including print, while the five palette rules do not apply in print. This is a source-level media statement, not an operating-system print result.

## Evidence and remaining acceptance

Before production editing, the controller ran the genuine RED command `node tests/js/contracts/report-dashboard-help-popup.cjs`: 40 tests, 39 passed, one failed solely because the live route lacked the presentation seam. The synthetic positive and negative cases passed. The tests-only commit after RED is `5e9b7eee1be49a166faf96261e8f98a4a9c2038d`. This phase did not repeat RED or alter tests. Controller GREEN passed: 40 portable contracts, 41 explicit local history contracts with full original Git-base inverse, 62 Jest suites / 1,260 tests, PHP syntax, ESLint, actual nonignored added-CSS stylelint and diff whitespace. Hosted verification and independent review remain pending at this document checkpoint.

The contract verifies exact source additions, preserved original bytes, pinned caller and theme sources, and simulated lazy iframe/context behavior. Those are source-derived checks. They do not establish native or authenticated runtime acceptance, contrast, modal geometry, keyboard or RTL behavior, operating-system print behavior, or clinician approval. Full researched UI coverage, all 22 work areas, demo and exhaustive popup validation, and the Swedish programme remain open. No ACL, clinical, Direct, report, export, print behavior, deployment, or approval status is changed by this presentation patch.
