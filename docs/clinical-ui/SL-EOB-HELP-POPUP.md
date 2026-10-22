# OPEMR-97 SL EOB help: tests-first contract

Status: tests-first only. Production `Documentation/help_files/sl_eob_help.php` remains untouched. The controller owns the first RED run and all later test, lint, runtime, financial, security, clinician, and approval gates. No such result is claimed here.

## Actual route and proposal

The full original route is 12,515 bytes, SHA-256 `e9cfa71d44a6cc5bb1d6e1dc16cb45d35fd4986b5202efbfcc567db31c5b093e`. Its complete bytes are frozen in a nonexecuting `.php.txt` fixture. It includes the responsive style block, forms and six radios with empty `onclick`, duplicated illustration IDs, headings and anchors, translated instructions, inline blue/black/green/red report semantics, and a constructed ERA documents URL. The title says “EOB Posting - Instructions” while the visible h2 says “EOB Data Entry.” The URL interpolation is inherited and unescaped. These are recorded as pre-existing behavior, not repaired or endorsed; every original byte must survive.

The source-only proposal allows two additions to this route: one body class `oe-sl-eob-help-popup` and one `@media screen` style block before `</head>`. Seven exact rules under `html.oe-workbench-context body.oe-sl-eob-help-popup` pair canvas/ink on body, paper/ink on its direct help container, paper/ink on help headings, transparent/ink on nonbutton help links and redirect icons, and paper/ink on fieldsets and legends. Values use the real `--oe-wb-canvas`, `--oe-wb-paper`, and `--oe-wb-ink` tokens with `#f3f7f5`, `#fff`, and `#17343b` fallbacks. Only six declarations have `!important`: heading background, redirect foreground, and fieldset and legend background and foreground. Those match actual important theme declarations. No new font, geometry, border, handler, layout, print, or legacy rule is proposed. This paired nominal palette does not prove native cascade or contrast clearance.

## Source and side-effect boundary

The actual 1,404-line caller is `interface/billing/sl_eob_search.php`. It gates on `acct/eob` write ACL and passes `show_help_icon = true` and `help_file_name = sl_eob_help.php` to OemrUI. OemrUI checks `enable_help`, emits an ordinary Bootstrap `#myModal` with a lazy `targetiframe`, and loads the help route on first click. Its help icon title distinguishes enabled value 1 from value 2; value 0 suppresses listener registration. `Header::setupHeader()` autoloads the shared popup controller. In the active workbench, the controller walks the same-origin `targetiframe` → `contentframe` → shell chain and gives the help document `oe-workbench-context` only. The modal is not `.dialogModal`, so this help frame does not gain `oe-workbench-popup`. Context is removed on mode exit or page hide. Standalone, legacy, and foreign-origin frames have no workbench context.

The caller has `prevSetting()` initialization for posting adjustment and OemrUI expandable settings; both can write user settings even on GET. It also contains CSRF-gated statement paths, search/upload and ERA parsing, file moves/copies, posting/report links, PDF and statement generation, patient portal notification, and email. This phase reads their source without executing the caller, help PHP, financial paths, bootstrap, database, or network.

## Controller commands and remaining gates

From the repository root, the controller can run:

```sh
node --test --test-reporter=tap tests/js/contracts/sl-eob-help-popup.cjs
node tests/js/contracts/sl-eob-help-popup.cjs --history
node_modules/.bin/jest tests/js/sl-eob-help-popup.test.js --runInBand
```

Expected before production: portable 9 tests with the single live-route test failing; history mode 10 tests with that same live-route failure; strict Jest fails because its child exits nonzero. This is an expectation, not an observed result. The synthetic candidate must pass independently. The adapter requires TAP, child exit zero, zero failures, and exactly nine positive passes. Direct `--history` additionally requires real local Git history, authenticates the fixture against verified base `18647270e0c799189d2dc10f801e8de2bff1a360`, and checks committed, dirty, staged, and untracked changes against the five permitted paths. Portable mode needs no Git history; missing history in local history mode is a failure.

The controller still owns RED execution, any production edit, GREEN, native workbench/legacy/print and theme inspection, keyboard/RTL/viewport and contrast checks, financial and security review, clinician review, and approval. This is run 1 of at most 2 rotated from OPEMR-96/168. It does not establish a fully researched UI, all 22 areas, a demo, exhaustive popup coverage, or Swedish acceptance. It does not revisit denied checkout/publication or PR review actions.
