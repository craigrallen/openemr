# OPEMR-104: common encounter help in the workbench

## Route and scope

`interface/forms/newpatient/common.php` renders `C_EncounterVisitForm`. Its UI settings set `show_help_icon` to `true` and `help_file_name` to `common_help.php`. The encounter Twig page calls `oemrUiPageHeading(oemrUiSettings)` for the help action and `oemrUiBelowContainerDiv(oemrUiSettings)` for the modal. `OemrUI` renders an ordinary Bootstrap `#myModal`, with a `#targetiframe` whose `data-src` points to `Documentation/help_files/common_help.php`; the click handler copies that URL to `src` on first open. This help frame is not a `.dialogModal` popup.

`show_help_icon` is an unconditional caller setting, not a claim that every user always sees enabled help. `OemrUI` registers its heading action only when `enable_help !== 0` and the caller flag is true. Its title is “Click to view Help” for setting `1`, and directs the user to enable the help modal in user settings for setting `2`. The below-container modal markup is governed by the caller flag. The actual behavior for each setting still needs authenticated verification.

The production workbench controller follows the same-origin parent chain from `targetiframe` to an active workbench shell. For this ordinary nested modal frame it adds `oe-workbench-context` to the frame's `<html>` only; it does not add `oe-workbench-popup`. It removes its owned class when the host mode turns off or the frame unloads. Standalone, legacy, and foreign-origin frames do not receive this context in the source contract.

## Presentation change

The help page adds `oe-common-help-popup` to its `<body>` and one second style block before `</head>`. Five `@media screen` rules require both `html.oe-workbench-context` and this route class. They pair workbench canvas and ink on the body, paper and ink on the direct help container, paper and ink on section headings, and transparent backgrounds with ink on ordinary links and `.oe-help-redirect`. CSS variables have the default workbench palette fallbacks (`#f3f7f5`, `#fff`, `#17343b`). The heading background and redirect ink carry the only two new `!important` declarations, matching existing important theme utilities. No font, spacing, geometry, breakpoint, script, or print rule was changed. Outside this screen and context scope, the original presentation remains in place.

All original help text, translations, anchors, URLs, and historical clinical guidance remain byte unchanged. That includes the existing sensitivity and ACL guidance about Physicians and Administrators, and both administrator warning icons. Preservation does not endorse that guidance as current clinical or security policy. The “Add Issue” anchor and “Save” button are illustrative controls inside help text, not encounter actions. Their own classes and the anchor's inline white text are unchanged. Changing ancestor palette colors does not establish contrast for either warning or either illustrative control; those require rendered checks.

## Evidence and controller gates

The controller recorded genuine RED before this edit: portable contract 9 tests/8 passed/1 missing-presentation failure, direct history 10/9/1, and a strict Jest adapter failure on child status 1. The initial missing sibling Jest path was a setup issue; `RED-history-corrected.tap` and `RED-jest-actual.log` in `/Users/craig/.hermes/projects/openemr/verification/common-help-20261022` contain the corrected evidence. The committed fixture freezes the original 6,582 bytes. The contract compares the entire live source with its exact two-addition candidate, checks the byte-for-byte inverse, and pins the relevant caller, modal, controller, and palette sources. These are source-only assertions; they do not prove translated rendering, computed contrast, ACL outcomes, or live modal behavior.

From the repository root, the controller can run:

```sh
node --test --test-reporter=tap tests/clinical-ui/common-help-contract.cjs
node tests/clinical-ui/common-help-contract.cjs --history
NODE_PATH=/Users/craig/.hermes/workspaces/openemr-popup-immunization/node_modules node /Users/craig/.hermes/workspaces/openemr-popup-immunization/node_modules/jest/bin/jest.js --rootDir "$PWD" --runInBand tests/js/common-help.test.js
git diff --check
git diff -- Documentation/help_files/common_help.php docs/clinical-ui/COMMON-HELP.md
```

The direct contract is portable; direct `node <contract> --history` additionally checks the local base and five-path scope (10 tests rather than the portable 9). Do not pass `--history` after `node --test`: that invocation can silently omit the history test. The Jest command uses the existing sibling dependency tree while preserving the target configuration, since this checkout has no `node_modules`. Controller execution has passed portable 9/9, history 10/10, the strict Jest adapter, PHP syntax and `git diff --check`. The controller owns publication. Rotation is at most two consecutive scheduled delivery runs on this surface/PR, counting implementation and QA—not a two-attempt limit per test command. Default next delivery must select a different untouched eligible item; unchanged CI polling does not justify re-entering this lane.

Authenticated checks remain pending for roles, help settings, the real modal and lazy iframe, focus, default/dark/solar compiled themes, narrow and short viewport resizing, RTL and print. Clinical and security review gates are also pending. This source change is not full research, all-22 coverage, demo acceptance, Swedish acceptance, clinical acceptance, or deployment.
