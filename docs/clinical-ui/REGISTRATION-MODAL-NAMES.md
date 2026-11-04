# OPEMR-208: registration modal names

## Scope and acceptance

This change adds a dialog role and translated accessible name to the existing product registration modal root, plus a translated accessible name to its email input. The email name appears only when `allowEmail` renders that input. The native popup surface, its caller in `main.php`, and its JavaScript opening and transport paths remain unchanged. This is one part of the exhaustive popup programme, not a full UI redesign or completion of the original 22, demo, or Swedish work.

The only template additions are `role="dialog"` and `aria-label="{{ 'Product Registration' | xla }}"` on the modal root, and `aria-label="{{ 'email' | xla }}"` immediately before the email placeholder. Conditions, checked/default values, email ID and classes, registration action, telemetry behavior, layout, visible content, and all other template bytes are preserved. This change does not fix transport or consent behavior.

## Evidence and limits

The controller reported a genuine preimplementation RED run at `f759af01a22728154ca48f82a205ecbc05c85a21`: 21 cases, 14 passing and 7 failing on the missing root role/name, email name, and exact inverse. The supplied original fixture SHA256 is `98a030b56a589d25050e187039c0d690fdb024079cac0b88e5f9a098dcaf602e`. The expected contract command is `node tests/clinical-ui/registration-modal-names-contract.cjs`. These checks inspect source and inverse bytes; they do not establish rendered Twig, browser, screen reader, keyboard, security, consent, or transport behavior. This implementer did not independently verify HEAD, hashes, or execution.

No registration, vendor submission, telemetry, database, network, or production action was activated. Authenticated QA on the native theme across applicable roles, keyboard operation, and screen reader announcement of the actual modal remains pending, as do ordinary approval, exact HEAD CI, and merge gates. There is no deployment, merge, or gate bypass in this handoff.

Rotation run 1 of at most 2 includes implementation and QA. The default next assignment is a different implementation. OPEMR-205 remains parked under its acquisition denial, with all historical boundaries unchanged.
