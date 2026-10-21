# Add/Edit Transactions Help popup: OPEMR-91

## Bounded change

The source change is confined to `Documentation/help_files/add_edit_transactions_dashboard_help.php`: one `<style>` block immediately before `</head>` and one class on `<body>`. The two CSS rules pair canvas and ink on the body, and paper and ink on its direct `.oe-help-container` child. They use the existing workbench color tokens with fallback values. Both require `html.oe-workbench-context` and are inside `@media screen`. The body marker exists in the DOM in every media mode; only its CSS is screen-only. There is no print rule or `!important`, and no layout, typography, link, alert, button, or clinical-content change.

The original 6,134-byte route is pinned by `tests/js/fixtures/add-edit-transactions-help-popup-original.php.txt` (SHA-256 `0c72b214bcffba5b8aa44a076a352118cfd7f737b93cc0dc7a2729e5eaeecf5b`). Removing the exact added style block and replacing the marked body tag with the original `<body>` restores **all 6,134 bytes**. The historical referral, counter-referral, transaction, Meaningful Use, CCR/CCD, MIPS, and EMR Direct guidance remains byte identical. Preserving that guidance is not an endorsement of its current clinical or regulatory accuracy.

## Source path and execution boundary

The actual caller is `interface/patient_file/transaction/add_transaction.php`. It reads the active session, including `pid` and `userauthorized`; resolves a layout title and may include an LBF plugin; reads transaction and layout data; and has a POST save path that can update or insert `transactions` and `lbt_data` and call `processAmcCall`. It configures `OemrUI` with `show_help_icon` and this help filename, then includes `dashboard_header.php`, which renders the page heading. These are source observations, not exercised runtime behavior. Neither the caller nor the help PHP route was bootstrapped: no session, plugin, database, transaction, referral, or save side effect was executed for this slice.

`OemrUI` registers the help icon only when `enable_help !== 0` and `show_help_icon` is truthy. Its title logic distinguishes `enable_help == "1"` and `== "2"`; the icon targets ordinary Bootstrap `#myModal`. The modal contains `#targetiframe` with an empty `src` and a `data-src` for this route. The delegated `#help-href` click handler assigns `src` on first open if it is still empty. `oeBelowContainerDiv()` is controlled by `show_help_icon`. These gates and the lazy load were left intact.

In the source-tested workbench chain, that ordinary `.modal` iframe sits under a `contentframe` beneath an active shell. The existing `popup.js` gives its document root `oe-workbench-context`, so the two rules can apply, but does not give it `oe-workbench-popup`: neither iframe is a `.dialogModal` popup. The controller follows workbench/legacy class transitions and pagehide cleanup. This contract is limited to that ordinary modal and same-origin shell context; it does not establish behavior for exhaustive popup paths.

## Verification and open acceptance

The controller independently observed genuine RED before the route edit: portable direct Node run 33 tests, 32 pass, 1 failure for missing presentation; direct history run 34 tests, 33 pass, 1 failure; strict Jest adapter failed because 32 passed against the required 33, with one genuine missing-presentation failure. The tests-only commit is `76a623a1` (`test(ui): OPEMR-91 Add/Edit Transactions Help presentation contracts`). Those results describe the pre-implementation state. After the edit, the permitted portable direct Node run passed 33/33 and the direct `--history` run passed 34/34. Controller-run full gates, independent review, hosted CI, and publication are separate and are not claimed here.

Native authenticated role/session checks, contrast, geometry, keyboard and RTL behavior, print, security, clinician review, and ordinary approval remain open. This source adaptation does not establish a full researched UI, all 22 work areas, exhaustive popup coverage, or Swedish completion.
