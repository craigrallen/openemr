# OPEMR-197: telehealth invitation popup name

## Scope

This change gives the existing **Invite Third Party Related Person** popup in the video consultation flow an accessible name. It supports that existing video-consultation requirement; it does not establish completion of all 22 clinical UI requirements.

The popup template's root modal element now has `aria-label="{{ "Invite Third Party Related Person" | xla }}"`. The attribute uses translated, attribute-escaped text matching the visible `xlt` heading. The native caller includes this template, clones the root, changes the clone's ID, and passes the clone to Bootstrap. Keeping the name on the root makes it available to each clone without a shared heading ID or `aria-labelledby` reference. No other template bytes or popup behavior were changed.

## Verification

At HEAD `1fc89fa7044cf4c7cd63210c79d09fd9d5fb6f81`, the controller recorded a genuine RED before the production edit: 13 passed, 3 failed, exit 1. The failed cases were `one_approved_root_opening_tag`, `root_attribute_uses_xla`, and `inverse_preserves_original_bytes`.

After the edit, `node tests/clinical-ui/telehealth-invite-name-contract.cjs` reported **16 passed, 0 failed, exit 0**. Node syntax checks passed for the contract and hosted Jest adapter. The contract checks the source change, byte-for-byte inverse against the original fixture, negative mutations, and native caller wiring. The tests and original fixture remain unchanged; the hosted Jest adapter was not run locally.

This evidence does not exercise Twig rendering, an actual cloned DOM, the native authenticated modal, browser focus, a screen reader, roles, security, transport, persistence, or clinical acceptance. Prior denied boundaries remain in force. Ordinary approval and full exact-HEAD hosted CI remain outstanding; this change is not a merge or deployment.
