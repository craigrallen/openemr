# OPEMR-137: edit payment popup palette

Owner: Hermes. This is run 1 of at most 2 **consecutive scheduled runs** covering implementation and QA together. The limit counts scheduled runs, not test attempts. OPEMR-136 was rotated and parked before this slice.

## Scope and source path

The exact five-path change set from base `09b29da7771aea334ed5745e058751157af980d7` is:

1. `interface/billing/edit_payment.php` — production route palette.
2. `docs/clinical-ui/EDIT-PAYMENT.md` — this scope and evidence record.
3. `tests/clinical-ui/edit-payment-contract.cjs` — portable source contract.
4. `tests/clinical-ui/fixtures/edit-payment-original.php.txt` — frozen 68,836-byte original route.
5. `tests/js/edit-payment.test.js` — hosted Jest wrapper for the portable contract.

The last three paths were present at tests-only HEAD `220a5eb0548907970e6110b8cec042235cb0f0df` before the production edit. This implementation changes only the route and this document. The source contract defines a full-source inverse: removing the exact new style block and body class restores every one of the original 68,836 bytes. That is a source-preservation claim, not renderer parity or clinical proof. Existing finance, ACL, CSRF, RawPostParser, error handling, financial row colours, input markup, scripts and payment behavior retain their source bytes. Inherited or computed appearance can still change and needs native QA.

This slice supplies the palette substrate for the edit-payment popup. It does not complete the researched UI, the original 22 financial linkage requirements, or clinical acceptance. It adds no controller, asset, JavaScript, shared/caller change, typography, geometry, control, table, row or error styling. No PHP endpoint, payment or database operation was exercised here.

The actual launcher is `interface/billing/search_payments.php`: its `.medium_modal` click handler calls `dlgopen('', '', 'modal-full', 800, '', '', { ... })`, passing `type: 'iframe'`, the clicked link's `href` as `url`, and `onClosed: 'refreshSearch'`. The links point to `edit_payment.php?payment_id=...`. `refreshSearch()` calls `top.restoreSession()` and `SearchPayment()`. The `800` is a requested modal height, not a proven native rendered height. The route already calls `Header::setupHeader(['datetime-picker', 'common'])`; Header's autoload path can load the existing `workbench-popup` assets. `popup.js` sets `oe-workbench-context` on `<html>` only when its same-origin parent/opener walk reaches an active workbench host. No route-local context controller is introduced.

The new `@media screen` rules require both `html.oe-workbench-context` and `body.oe-edit-payment`. Body ink and paper use workbench tokens with fallbacks. Body ink is ordinary; body paper uses `!important` to override the existing `color_base.scss` `.body_top` background, which is important in Cobalt Blue and Forest Green. The other five `!important` declarations cover fieldset ink, paper and border, plus legend ink and canvas. They are necessary because `theme-defaults.scss` sets fieldset and legend colours with `!important`, and this route's earlier fieldset border is also `!important`. The body selector has specificity `(0, 2, 2)`; the fieldset and legend selectors have `(0, 2, 3)`. The legend bottom border colour is non-important and follows the earlier route rule. No blanket override is added. Existing table, form-control, semantic warning and payer-row paint, plus effective contrast, remain native QA questions; preservation of source bytes does not establish unchanged computed appearance.

## Evidence and pending validation

Before production editing, the controller observed genuine RED on the tests-only commit: direct `node --test-reporter=tap tests/clinical-ui/edit-payment-contract.cjs` ran 7 tests, 6 passed and 1 failed for the missing marker/style. Direct `node --test-reporter=tap tests/clinical-ui/edit-payment-contract.cjs --history` ran 9 tests, 8 passed and 1 failed for the same reason. The fixture was verified as the exact 68,836-byte base original. The initial production candidate then passed 7 of 7 direct tests and 9 of 9 direct history tests. Independent review identified the important `.body_top` background from `color_base.scss`; the controller strengthened the contract first, producing a second RED of 7 tests, 6 passed and 1 failed while the route was unchanged. This correction addresses that failure. Final corrected tests remain pending with the controller, so no final green result is claimed. Initial lint of the nonignored extracted CSS reported 0 stylelint warnings, and the adapter reported 0 ESLint errors through installed sibling configs after module resolution setup errors; these checks predate this correction. Hosted `tests/js/edit-payment.test.js` is the authoritative Jest wrapper; local Jest is **NOTRUN** because the cache/Jest boundary was denied. Financial PHP was not executed, so there is no PHP or payment green result to report.

Ordinary approval, complete exact-head hosted CI and Codecov, authenticated financial workflow checks, roles/ACL/session/CSRF checks, opener behavior, and native modal visual checks across mobile, RTL, zoom, keyboard, contrast and print are distinct **OPEN** gates. A passing source contract would not close them. There is no merge, deployment, master change, live-patient, vendor, national-service or cron action in this slice.

Swedish checkout and publication, installation-help preparation, tracker correction, and surgery `/dev/fd` comparisons remain separate work. Previously denied cache, Jest and OS-read boundaries remain in force; they are not retried through rephrasing or equivalent commands here. This document does not claim those tasks or boundaries were resolved.
