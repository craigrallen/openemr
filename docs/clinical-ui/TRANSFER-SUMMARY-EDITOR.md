# Transfer Summary editor presentation

OPEMR-151 adds the frozen, screen-only presentation proposal to the existing Transfer Summary form. The accepted visual reference is the Encounter view in `researched/index.html`. This is a source-level implementation, not a claim that the complete reference or a clinical workflow has been accepted.

## Change and scope

The proposal inserts one fixed `<style>` block immediately before the form's original `</head>` and adds `oe-transfer-summary-editor` to the existing `body_top` class in `interface/forms/transfer_summary/new.php`. The bytes are the `proposed(original())` export from `tests/clinical-ui/transfer-summary-editor-contract.cjs`. Removing that style insertion and class addition restores the entire original source byte for byte.

The publication boundary contains exactly these five files:

1. `interface/forms/transfer_summary/new.php` — product presentation.
2. `tests/clinical-ui/fixtures/transfer-summary-new-original.php.txt` — frozen original source.
3. `tests/clinical-ui/transfer-summary-editor-contract.cjs` — portable source contract and inverse.
4. `tests/js/transfer-summary-editor.test.js` — test adapter.
5. `docs/clinical-ui/TRANSFER-SUMMARY-EDITOR.md` — this record.

This implementation phase changes only the first and fifth files. The fixture, contract and adapter remain as published at head `e2b8b94dc6204a4bdba40d2d7adf97e767de07f8`.

## Presentation covered

The screen rules require the workbench context and the form's new body class. They give the four narrative textareas—Status Of Admission, Diagnosis, Intervention Provided and Overall Status Of Discharge—the full paper-relative width, generous writing height, line spacing and vertical resize. The Client Name and DOB display, Transfer to and Transfer date inputs, and narrow-screen wrapping stay readable within the paper. Save, Print and Cancel have explicit normal, hover, focus, active and disabled colors, with visible keyboard focus. The native Print input lacks the `button-css` class; the proposal explicitly targets `#printbutton` so it is covered.

The source retains its original malformed nested `<html>` structure and table attributes. Browser repair of that legacy markup is part of the source contract; this change does not correct it. Existing scripts, CSRF token, escaping, field names, actions, print setup, and shared Save and view paths remain intact. The rules are screen-only; no print stylesheet or native handler changes are included.

## Evidence and remaining gates

Before the product edit, the controller reported lint with zero warnings and genuine portable RED results of 8 tests / 7 pass / 1 fail, including `--history` with 9 tests / 8 pass / 1 fail, at the tests-only head above. The failure was the expected missing product insertion. For the history gate, the exact command is `node tests/clinical-ui/transfer-summary-editor-contract.cjs --history`. The history option is an argument to the contract script, not to `node --test`.

This phase performed a byte-level application and full original inverse check. Controller tests and lint cited above are the prior tests-only results; product-phase QA and hosted exact-head gates remain pending. The owner has scheduled run 1 of at most 2, including QA; phases are not additional runs. No authenticated route, bootstrap, SQL, native Save/Print handling, persistence, full accessibility, localization or old-engine behavior was verified here. The two original-source supporting checks do not constitute all 22 checks, full reference fidelity or clinical acceptance. Ordinary approval and complete exact-head hosted gates are required before any merge or deployment.
