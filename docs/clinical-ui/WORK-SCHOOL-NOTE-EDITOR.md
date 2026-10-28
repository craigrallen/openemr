# Work/School Note document editor contract

## Intended screen layout

The exact `CSS` export in `tests/clinical-ui/work-school-note-editor-contract.cjs` is the implementation specification. Insert its literal `<style>` block immediately after each route's `Header::setupHeader('datetime-picker')` line. Add `oe-work-school-note-editor` to each body and `oe-work-school-note-form` to each form, preserving the existing `body_top` and `form` classes. Those are the only source additions. No wrappers, moved nodes, script, asset link or shared stylesheet are needed. The rules apply under `@media screen` only when `html.oe-workbench-context` is present. Header autoload already supplies the workbench context script.

The document is a centered white writing surface with an 860px maximum width. On `new.php`, the existing title is outside the form but inside `.container`; the screen rules make that container the same white sheet, remove the nested `.row` negative margins and local column padding, and let the form fill it. On `view.php`, the form itself is the sheet and its direct title, select, bold label, textarea and table stay in place. The message field uses full available width and a 12rem minimum writing height. The original Doctor and Date cells wrap into a stacked layout on narrow screens. Both original native action groups remain visible and wrap, including both `View Printable Version` buttons on `view.php`. The paper, fields and table cells have explicit ink and background colors because a dark theme can otherwise put light text on the white sheet. The `body_top` theme uses an `!important` background; the one scoped body background override is intentional. Plain `:focus` selectors provide an older browser focus fallback. The print route and print styling remain untouched.

Doctor, Date and Signature are ordinary original form labels and values. They do not establish authority signing, certification or a new clinical workflow. The contract preserves the native option selection and escaping, patient ownership guard, CSRF, form actions, input names and IDs, date picker, all scripts, Print behavior, and both pairs of Save and Don't Save actions. The complete inverse proof rejects any change to original source bytes, including semantic changes beyond the named negative mutations.

## Seven-path boundary and frozen base

The allowed paths are exactly `interface/forms/note/new.php`, `interface/forms/note/view.php`, `tests/clinical-ui/fixtures/work-school-note-new-original.php.txt`, `tests/clinical-ui/fixtures/work-school-note-view-original.php.txt`, `tests/clinical-ui/work-school-note-editor-contract.cjs`, `tests/js/work-school-note-editor.test.js`, and this document. This tests-only phase writes the last five paths and leaves both routes unchanged.

The original routes are complete nonexecuting byte fixtures from Git base `09b29da7771aea334ed5745e058751157af980d7`. SHA256 values are `a4349012cf7f7538584f8b90d9a483aec0b73bbe5ac66c11a949faa31b892579` for new and `27e3074478a8c7f0d73d5b2489a7b5574d2ac69ea3c67c3e62dbed669578bb44` for view. The history mode checks both blobs against Git and checks the base ancestry and changed path boundary.

## Commands and acceptance limits

Run these direct portable commands, without Jest or a local cache:

```sh
node --test-reporter=tap tests/clinical-ui/work-school-note-editor-contract.cjs
node --test-reporter=tap tests/clinical-ui/work-school-note-editor-contract.cjs --history
```

The portable suite requires exactly 9 tests; the history suite requires exactly 10. The Jest adapter requires exit 0, zero failures and exactly 9 passes, so it fails on the unchanged baseline. Its presence does not authorize running local Jest. Source-only synthetic candidates and negative mutations prove the specified additions and preservation rule. They do not prove rendered DOM, computed style, authenticated behavior, responsive appearance, contrast, native Save/Print workflow or full fidelity to the researched encounter reference. Controller browser and hosted gates must provide that evidence after implementation.

The controller's two consecutive runs are an execution budget, not permission to retry a denied command or repeatedly run a failing test. After that budget, move to a different item. The unchanged routes are expected RED: 9 tests with 7 passes and 2 missing-presentation failures; history is expected 10 tests with 8 passes and the same 2 failures. A GREEN claim requires the exact additions on both routes and later gates.
