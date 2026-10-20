# OPEMR-62 patient-linked notes popup

## Scope and TDD handoff

This is a source presentation partial for `interface/patient_file/summary/pnotes.php`, the patient-linked summary route opened by eye_mag `showpnotes(docid)`. It is distinct from `pnotes_full.php`, `pnotes_print.php`, and global messages. This tests-only phase freezes the 5,464-byte original route and proposes a screen-only color seam. Production has not been edited. RED execution by the controller is pending; no pass, design fidelity, contrast clearance, or clinical acceptance is claimed.

The controller should run `node --test tests/patient-linked-notes.contract.test.cjs` and `node tests/patient-linked-notes.contract.test.cjs --history` before requesting production. The first suite has one deliberate live-route failure on the untouched route; its synthetic candidate and negative mutations must pass. The Jest adapter runs only the portable suite. History mode authenticates the fixture against base `18647270e0c799189d2dc10f801e8de2bff1a360` and pins unchanged launch, asset, popup, and theme sources. Neither mode renders PHP or verifies a browser.

## Proposed production seam

Add `oe-patient-linked-notes` to the existing `body_bottom` class, leaving the body element and all other attributes intact. Place one inline `<style>` immediately after `Header::setupHeader()` and before `</head>`. Use one `@media screen` wrapper. Within it, `html.oe-workbench-context body.oe-patient-linked-notes` pairs canvas and ink; its existing `#pnotes` pairs paper and ink with an inset neutral edge; its direct raw table pairs paper and ink; its direct title link uses petrol ink. The source contract fixes the exact four selectors and declarations. The body class is an all-media DOM delta, while its new CSS is inert in print and outside active workbench context. No opener asset is needed: the real `dlgopen` iframe's same-origin parent traversal reaches the active shell.

The inverse contract removes only that style block and body class and requires every remaining byte of the route to equal the frozen original. It therefore preserves PHP, SQL, ACL and squad checks, session and document/order patient authority, escaping, note count and order, note-type helper output, billing red spans, alert link, mouseover highlight behavior, title markup, and all existing links. It allows no geometry, font, border layout, control, wrapper, JavaScript, or query change. The inset box shadow is an edge without box geometry change. Existing theme billing backgrounds and highlight colors are intentionally retained; the contract does not repaint descendants or rows.

## Outstanding acceptance

- Controller RED output, subsequent production request, GREEN result, and independent Codex review are outstanding.
- Native default, Dark, and Solar checks must inspect effective title and link color, raw table foreground and background, note hover, billing red and warning contrast, and note-type helper output. Compiled theme cascade may limit the proposed source colors; source contracts do not clear contrast.
- Open the real `modal-xl`, 500-height, auto-height iframe from `showpnotes`, then resize the desktop modal and check narrow and short viewports. Check keyboard behavior, RTL, roles including restricted access, legacy mode, print, and patient, document, and order authority with appropriate approved test data.
- Original feature 6 staff send/read/restricted acceptance and ordinary approval remain open. All 22 feature acceptance, UI/demo evidence, and Swedish work remain open. Preserve the Swedish clone and publication denial and the PR 112 edits and denied review; this slice does not imply their approval.
- No live bootstrap, database, patient, billing, or document requests occurred here. No merge, deploy, master change, policy or cron change is part of this handoff. Branch, commit, and PR naming must retain `OPEMR-62`; the canonical fork's default branch exception is `master`. No independent review was launched.
