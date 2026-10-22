# OPEMR-96 Message Center help popup: tests-first phase

Status: contracts and fixture prepared; **no test or linter was run in this phase**. `Documentation/help_files/message_center_help.php` remains byte-for-byte unchanged. The live acceptance contract is intentionally RED until the production presentation change is authorized and made in a later phase.

## Source and entry paths

The original help route is 25,042 bytes, SHA-256 `a82ee97560b1dc79a497c98ffd713018717f53d63fafbbd5f7df5ec78a123ba6`. The complete source is frozen as a nonexecuting `.php.txt` fixture. It has four sections (`messages`, `reminders`, `recalls`, `medex_communication_service`), 21 illustrative buttons, four redirect icons, an existing responsive style block, two external links with `rel="noopener" target="_blank"`, and inherited malformed markup. The historical clinical and MedEx instructions are preserved as source, not endorsed as current guidance.

`interface/main/messages/messages.php` is the actual caller. It configures `OemrUI` with `show_help_icon = true` and `help_file_name = message_center_help.php`; `oeBelowContainerDiv()` supplies the ordinary Bootstrap `#myModal` and lazy `targetiframe`. The same caller also assigns `helpFile = 'message_center_help.php'` and includes `interface/help_modal.php` when `enable_help == 1`. That alternate modal has its own `targetiframe` and click assignment. OemrUI creates its help icon when `enable_help !== 0` and displays enabled/disabled titles for values 1/2; the bottom include is restricted to value 1. The two implementations' eligibility and possible duplicate modal IDs remain a caller behavior to verify in native acceptance, not something this route styling changes.

Actual navigation was excluded: the caller constructs MedEx and may call `login()`, whose API can perform cURL requests and SQL updates, while `prevSetting()` can write user settings even during a GET. It also contains clinical message writes and reads. No PHP, browser, DB, bootstrap, MedEx, or outbound request was executed for this phase.

`Header::setupHeader()` autoloads `workbench-popup` (`popup.js` and `popup.css`). The real popup controller walks same-origin parents from the ordinary help `targetiframe` through `contentframe` to the active workbench shell. It adds `oe-workbench-context` to the help frame's `<html>` and removes it when the shell leaves workbench mode or the frame unloads. The Bootstrap `.modal` is not `.dialogModal`, so this help frame does not receive `oe-workbench-popup`. Standalone, legacy, and foreign-origin frames remain unstyled by the proposed route rules.

## Proposed presentation seam

Only two additions to the help route are accepted: one `oe-message-center-help-popup` class on `<body>` and one new `<style>` block immediately before `</head>`, after the existing responsive block. Five paired `@media screen` rules, all scoped under `html.oe-workbench-context body.oe-message-center-help-popup`, set canvas and ink on the body, paper and ink on its direct `.oe-help-container`, paper and ink on `.oe-help-heading`, transparent background and ink on nonbutton help links, and transparent background and ink on `.oe-help-redirect`. Values use the verified `--oe-wb-canvas`, `--oe-wb-paper`, and `--oe-wb-ink` tokens with their existing `#f3f7f5`, `#fff`, and `#17343b` fallbacks.

The exact style permits `!important` only on heading background and redirect foreground, matching the actual help theme's important declarations. It leaves font, geometry, buttons, semantic warning colors, external `text-primary` icon classes, responsive CSS, print, and legacy mode unchanged. Native contrast and cascade inspection, including the external icon descendants, remains open.

The source contract checks the entire candidate against the original plus exactly those two additions and then removes them to compare every original byte. Anchored negative mutations cover missing, repeated, or moved seams; selector and token widening; each important exception; added declarations, geometry, fonts and print changes; altered PHP, translations, sections, anchors, warnings, buttons, historical text, external link metadata, malformed markup, and injected script. It also pins caller and shared source hashes, source-derived click assignments, and the real popup controller's iframe context and cleanup. The strict Jest adapter requires TAP, child exit zero, zero failures, and exactly ten positive portable tests. It fails during RED; it does not reinterpret missing presentation as success.

## Controller gates, parked

From the repository root, the controller can run:

```sh
node --test --test-reporter=tap tests/js/contracts/message-center-help-popup.cjs
node tests/js/contracts/message-center-help-popup.cjs --history
node_modules/.bin/jest tests/js/message-center-help-popup.test.js --runInBand
```

The first command should have one live-route failure while production is unchanged; the synthetic candidate and independent contracts should pass. `--history` is a mandatory local gate: it authenticates the fixture against Git base `18647270e0c799189d2dc10f801e8de2bff1a360`, pins unchanged protected sources to that base, and enforces an exact five-path allowlist across committed, dirty, staged, and untracked changes. Portable tests require no Git history. Missing history is a failure in local mode. The Jest adapter should fail in RED because its child does not exit zero. These are **expected outcomes, not reported execution results**.

After the later production phase, the controller still owns all execution and native gates: authenticated help eligibility for values 0/1/2 and both modal paths; default/dark/solar theme contrast including button and external icon descendants; ordinary help iframe in active/legacy/standalone contexts; narrow and short viewport, keyboard, RTL, and OS print; clinical wording review and accessibility. The work does not establish all original 22 feature outcomes, a researched UI completion, demo coverage, exhaustive popup migration, or Swedish certificate completion. It does not revisit denied review/PR actions or authorize any checkout, publication, or deployment.
