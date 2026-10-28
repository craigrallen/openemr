# Clinical Instructions editor contract

## Intended screen presentation

The exact `CSS` export in `tests/clinical-ui/clinical-instructions-editor-contract.cjs` is the proposed production addition. The controller can lint that literal CSS before implementation. Insert its `<style>` block immediately after the existing `Header::setupHeader();` line in `interface/forms/clinical_instructions/new.php`, and change only `<body>` to `<body class="oe-clinical-instructions-editor">`. The `@media screen` selectors require `html.oe-workbench-context`; the already autoloaded popup script supplies that class in the active workbench. There is no new script, wrapper, asset, or shared style. The original source bytes, including all print markup and styles, survive the inverse unchanged; the new body class has no print CSS. The legacy screen outside that context receives no matching CSS.

The intended form is one centered white document sheet with an 860px maximum width, natural spacing, and explicit dark ink. The existing title, form, fieldset, legend, textarea and buttons stay in their original order and nesting. The outer `.container.mt-3` is the paper. Its immediate `.row` gets an explicit full width, zero side margins and border-box sizing; its `.col-12` loses local side padding. The fieldset's nested `.container` loses Bootstrap width limits and gutters, so the textarea fills the *outer paper's content width* rather than a narrow inner form. The textarea has a 12rem minimum writing height and may grow vertically. Save and Cancel remain native buttons and wrap on narrow screens. `theme-defaults.scss` sets both fieldset background and color with `!important`; the proposed fieldset rule pairs `background-color: #fff !important` with `color: #182c36 !important` under the exact route, workbench context, and screen scope. The theme also sets legend background and color with `!important`; this proposal adds no important legend override, so its nonimportant legend color does not supersede those theme declarations. Plain `:focus` and `:focus-visible` both specify a visible outline. The paper geometry follows the researched `#encounter` concept at `/Users/craig/artifacts/OpenEMR-Research/researched/index.html`; this is a source proposal, not a rendered fidelity claim.

The source has no supported spellcheck or autocorrect workflow to claim. This change must preserve the original `formFetch` lookup, ID cast, active session, CSRF input, `save.php` action and escaped ID, `instruction` name and ID, escaped textarea value, and both original Save and Cancel callbacks. `view.php` includes `new.php` unchanged. In `library/api.inc.php` lines 109–112, `formFetch` itself queries by ID and the current `pid` from `OEGlobalsBag`, as well as activity. Therefore the absence of an inline guard in `new.php` is not a proven read vulnerability. `save.php` checks CSRF and explicitly invokes `EncounterFormAccess::assertFormBelongsToSessionPatient` before its update or insert. These source checks do not establish authenticated security acceptance.

## Frozen base and scope

The fixture is the complete, nonexecuting byte copy of `new.php` from base `09b29da7771aea334ed5745e058751157af980d7`, SHA256 `a4b0b3fba8ebf54a8fd5268abd66375dafdbff531af546e652e2cfcf7c468382`. The whole-file inverse requires an implemented route to contain exactly the two additions and reproduce every original byte when they are removed. The history mode binds the fixture to the Git base, checks base ancestry, checks `view.php` and `save.php` remain byte unchanged, and restricts committed, working and untracked names to five paths: the route, fixture, portable contract, hosted Jest adapter, and this document.

This is the tests-only phase. It adds the fixture, portable contract, adapter and document; it does not edit production. The synthetic proposed route must pass the inverse before production changes. The current untouched route is intentionally RED on the single `current route has only the exact additions` case, with the other six portable cases expected to pass. The history command adds one positive history case, for eight total. The adapter runs only the seven-case portable mode and requires TAP, child exit zero, exactly seven passes and zero failures. It does not run history in hosted Jest.

## Controller commands and acceptance

Direct portable invocations, with `--history` passed to the script:

```sh
node --test-reporter=tap tests/clinical-ui/clinical-instructions-editor-contract.cjs
node --test-reporter=tap tests/clinical-ui/clinical-instructions-editor-contract.cjs --history
```

The controller should obtain genuine RED from the untouched route, apply the exact two additions, then obtain seven of seven portable and eight of eight history passes. The controller can lint the exported CSS before editing the route. Normal implementation review and approval apply. Rotate any work handoff according to the owning workflow; this document contains no approval or ownership claim.

These source and synthetic checks do not establish rendered DOM, computed style, responsive appearance, color contrast, browser support, authenticated behavior, or clinical Save/Cancel behavior. Native acceptance requires viewing both active workbench and legacy contexts, narrow and wide screens, keyboard focus, print output, and an authorized patient encounter with Save and Cancel. No such runtime or browser acceptance has been performed here. This contract makes no Swedish publication or full 22-item acceptance claim.
