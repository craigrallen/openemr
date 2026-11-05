# Terminal payment popup (OPEMR-216)

Owner: Hermes. Scheduled allocation: 1, maximum 2, covering implementation and QA; internal phases do not add allocations.

## Scope and implementation

The native terminal payment flow opens with `dlgopen` in `modal-md` at an initial height of 550. Its caller in `front_payment.php` (PR 104) is outside this change. This change adds only the exact screen and workbench-context style from the contract and a body marker in `front_payment_terminal.php`. It gives the popup a bounded paper surface, a full-width amount row, wrapping action buttons that retain their `d-none` states, paired log ink and background, and containment for long log text. Separate `:focus` and `:focus-visible` rules provide a focus outline fallback.

The full original route is recovered byte for byte by removing those two additions. Native PHP, JavaScript, amount handling, opener interactions, Stripe transport and SDK calls, and charge actions remain as in the original.

## Evidence and remaining checks

Tests-first commit: `29c0254d0bc448acfe15052232873a55ec2df3f9`. Before the product edit, the controller recorded genuine RED: 7 tests, 6 passed, 1 semantic missing-style failure. Initial proposal lint errors were corrected in tests only before production. Final controller verification: portable 7/7, explicit Git-history 8/8, PHP syntax, Node syntax, diff checks and real nonignored stylelint PASS with zero warnings. The frozen original is authenticated against the pinned Git blob; every original route byte restores exactly.

Offline scripts-disabled source-derived BODY checks passed 180 unique cells (five compiled themes, three synthetic visibility states, widths 900/390/146, popup and ordinary-frame contexts, two forced computed directions), 540 complete original-body inactive-screen/print comparisons and 180 real Tab center hits with 3px outline checks; no requests or page errors. PHP labels/total were replaced by explicit synthetic strings. No native PHP rendering/bootstrap, application/payment JavaScript, actual modal, Stripe SDK/provider/reader/transaction or live request executed. Font URLs were disabled; this is not full contrast, full-outline clearance, icon, native RTL, financial, authenticated or clinical acceptance. PHP was syntax-checked only. No local Jest/emulation or PHPUnit ran. Factual documentation corrections are a nonproduction TDD exception subject to independent review.

Native and authenticated behavior, financial and security behavior, roles, clinical context, persistence, the actual modal, all themes, focus, RTL, print, and full design remain awaiting QA. A strict hosted adapter, complete exact-head CI, and ordinary approval are separate gates. This does not complete all 22 areas, a demo, or Swedish localization.

There are no merge, master, deployment, database, or cron changes. Inherited denied-action boundaries remain in force. A different candidate needs fresh clearance; prior PR 273 and parked 55/settled 47 are not automatically replayed.
