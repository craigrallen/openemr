# Billing Log popup presentation (OPEMR-43)

This is a partial implementation of the real Billing Log popup, not full researched popup fidelity or clinical acceptance. The route is `interface/billing/customize_log.php`. The existing launchers remain `interface/billing/billing_report.php:1469` (`dlgopen('customize_log.php', '_blank', 750, 400)`) and `interface/logview/logview.php:496` (`dlgopen('../billing/customize_log.php', '_blank', 500, 400)`). Both retain their original dimensions, session restoration, and callers.

## Source and change rationale

The real route previously emitted the billing log without a document shell or route-local styling. `tests/clinical-ui/billing-log-popup.test.cjs` defines the exact additive source contract from original route and helper fixtures independently checked byte-for-byte against base `18647270e0c799189d2dc10f801e8de2bff1a360`. Its inverse restores both original files. The test keeps the existing ACL, file read, decryption, escaped output, and two empty-log branches in order.

The route now creates `ClinicalWorkspaceAssets` after the `acct/eob` OR `acct/bill` **write** ACL gate, then emits a small HTML document with a viewport, translated title, versioned screen stylesheet, and the existing `popup.js` context detector. Its body, sheet, and content wrappers close on both the missing-file exit and normal completion. The early branch reopens PHP with four-space indentation before `exit`. These wrappers and viewport are real legacy markup changes, even though the new paint is screen-only and active-workbench-context-only. Existing error handling remains unchanged.

`interface/clinical-workspace/billing-log-popup.css` has exactly three scoped rules: canvas and ink, a paper sheet, and long-content wrapping. It changes no font, controls, backend behavior, or print rule. `src/Common/Assets/ClinicalWorkspaceAssets.php` adds sorted allowlist entries for `billing-log-popup.css` and `popup.js`. There is no `Header`, generic workspace CSS, or new JavaScript.

## Evidence and gates

The controller verified genuine RED before production authorization: tests-only `df84b83a8399a2fa8d66adbb588b5ce56870d62b`, hosted JS run `39155113030` completed FAILURE solely because the planned route, helper, and CSS were absent. Four synthetic, inverse, and mutation tests passed; one actual production source mismatch failed. Local RED was identical.

Controller local verification now passes: five portable source-contract tests, six tests with the mandatory full Git-baseline/inverse check, PHP syntax for both changed PHP files, and diff hygiene. Independent controller-owned Gemini 4 Argon High review of all changed files plus shared context and callers found no introduced P1/P2 within this bounded static contract. Hosted GREEN remains pending; the final external delivery evidence supersedes this checkpoint. Rendered/native QA and ordinary approval remain required. This is not security or financial acceptance, full popup migration, a merge, or a deployment.

The original 22 clinical acceptance features and the UI, exhaustive-popup, demo, and Swedish gates remain open and unchanged. The source test does not prove live ACL behavior, rendering, decryption behavior, or real log output. The pre-existing error paths are retained rather than reworked.
