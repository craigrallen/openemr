# Terminal payment popup (OPEMR-216)

Owner: Hermes. Scheduled allocation: 1, maximum 2, covering implementation and QA; internal phases do not add allocations.

## Scope and implementation

The native terminal payment flow opens with `dlgopen` in `modal-md` at an initial height of 550. Its caller in `front_payment.php` (PR 104) is outside this change. This change adds only the exact screen and workbench-context style from the contract and a body marker in `front_payment_terminal.php`. It gives the popup a bounded paper surface, a full-width amount row, wrapping action buttons that retain their `d-none` states, paired log ink and background, and containment for long log text. The direct `#logs > .row` rule resets native log-row negative side margins to zero so log descendants stay inside the progress panel border. Separate `:focus` and `:focus-visible` rules provide a focus outline fallback.

The full original route is recovered byte for byte by removing those two additions. Native PHP, JavaScript, amount handling, opener interactions, Stripe transport and SDK calls, and charge actions remain as in the original.

## Evidence and remaining checks

Tests-first commit: `29c0254d0bc448acfe15052232873a55ec2df3f9`. Before the initial product edit, the controller recorded genuine RED: 7 tests, 6 passed, 1 semantic missing-style failure. Initial proposal lint errors were corrected in tests only before production. Verification of that earlier style: portable 7/7, explicit Git-history 8/8, PHP syntax, Node syntax, diff checks and real nonignored stylelint PASS with zero warnings. The frozen original is authenticated against the pinned Git blob; every original route byte restores exactly.

An independent reviewer found a P3 issue: native rows inside `#logs` have negative side gutters that place log descendants outside the panel border. The prior browser PASS did not test those gutters. At tests-only HEAD `a3641f45`, before this source correction, the controller recorded actual RED (8 tests, 7 passed, 1 semantic failure) in `controller-gutter-red.log`; the strengthened browser check found log descendants outside the border in 120 of 180 cells in `browser-gutter-red.json`. The real CSS proposal passed lint with zero warnings. The source correction is limited to the direct native log-row margin reset above. Final controller GREEN: portable 8/8 and explicit history 9/9, nonignored CSS lint and PHP/Node syntax/diff pass. The strengthened unchanged 180-cell browser matrix now passes, including direct-row/pre/code containment, 540 inactive/print comparisons and 180 Tab center hits; pre-fix failures remain retained. Native QA remains pending.

Offline scripts-disabled source-derived BODY checks passed 180 unique cells (five compiled themes, three synthetic visibility states, widths 900/390/146, popup and ordinary-frame contexts, two forced computed directions), 540 complete original-body inactive-screen/print comparisons and 180 real Tab center hits with 3px outline checks; no requests or page errors. PHP labels/total were replaced by explicit synthetic strings. No native PHP rendering/bootstrap, application/payment JavaScript, actual modal, Stripe SDK/provider/reader/transaction or live request executed. Font URLs were disabled; this is not full contrast, full-outline clearance, icon, native RTL, financial, authenticated or clinical acceptance. PHP was syntax-checked only. No local Jest/emulation or PHPUnit ran. Factual documentation corrections are a nonproduction TDD exception subject to independent review.

Native and authenticated behavior, financial and security behavior, roles, clinical context, persistence, the actual modal, all themes, focus, RTL, print, and full design remain awaiting QA. A strict hosted adapter, complete exact-head CI, and ordinary approval are separate gates. This does not complete all 22 areas, a demo, or Swedish localization.

There are no merge, master, deployment, database, or cron changes. Inherited denied-action boundaries remain in force. A different candidate needs fresh clearance; prior PR 273 and parked 55/settled 47 are not automatically replayed.
