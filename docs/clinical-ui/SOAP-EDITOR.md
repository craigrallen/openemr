# SOAP editor: input dirty tracking and field labels

## Problem

`interface/forms/soap/templates/soap_form.twig` set `top.isSoapEdit = true` only on `keyup`. Paste from the context menu, cut, drag-and-drop, replacement text and some IME or dictation input change a textarea without a `keyup`. After such an edit, Cancel took the clean-form path. That path calls `top.restoreSession()` and `parent.closeTab(window.name, false)`, so unsaved note text was discarded without the existing warning dialog. `src/Tabs/TabsWrapper.php` checks the same flag when the tab itself is closed. The four textareas also had no programmatic names. The Subjective, Objective, Assessment and Plan legends were visual only.

## Production diff (template only)

Each of the four fieldsets gets the same two changes:

```diff
-                        <legend>{{ 'Subjective' | xlt }}</legend>
+                        <legend id="soap-subjective-label">{{ 'Subjective' | xlt }}</legend>
 ...
-                                <textarea name="subjective" class="form-control" cols="60" rows="6" onkeyup="top.isSoapEdit = true;">{{ data.get_subjective()|text }}</textarea>
+                                <textarea name="subjective" id="soap-subjective" aria-labelledby="soap-subjective-label" class="form-control" cols="60" rows="6" onkeyup="top.isSoapEdit = true;" oninput="top.isSoapEdit = true;">{{ data.get_subjective()|text }}</textarea>
```

The same change applies to `objective`, `assessment` and `plan` (`soap-<name>` and `soap-<name>-label`).

- The existing `onkeyup` handler stays on purpose. If a browser fires `keyup` but no `input` for some edit, the form still gets marked dirty. The two handlers do the same thing, so the change can only mark the form dirty in more cases, never fewer.
- Field `name`s, `class`, `cols`/`rows` (manual sizing), the `|text` escaping of saved values, `|xlt` legends, the form `action`/`method`, `onsubmit="return top.restoreSession()"`, the CSRF hidden input, the hidden `id`/`activity`/`pid`/`process` inputs, and the inline close/`closeSoap` script are byte-for-byte unchanged.
- No `spellcheck`, `autocorrect`, `autocapitalize` or `autocomplete` attribute was added. Nothing reads or rewrites textarea values. The `input` handler only sets the flag. No CSS, PHP, controller, save path or DB change.
- The new IDs are fixed literals with no user data. Only one SOAP form renders per document, so the IDs are unique on the page.

## Test: `tests/js/clinical-soap-editor.test.js`

The test reads the real `soap_form.twig` and turns it into HTML with a small stand-in for the Twig runtime. It puts the `<body>` into jest's jsdom, where jsdom compiles the template's real inline `onkeyup`/`oninput` attributes. It then runs the template's real inline `<script>` text. The test does not copy any handler logic. It stubs `top.restoreSession`, `dlgopen`, `$` (to capture the `#btnClose` click handler) and `parent.closeTab` (in jsdom, `parent === top === window`).

It covers:
- **Input-only edits:** for each of the four fields, an `input` event with no `keyup` sets `top.isSoapEdit`. The `insertFromPaste`, `deleteByCut`, `insertFromDrop`, `insertReplacementText` and `insertCompositionText` (with `isComposing`) input types all set it as well.
- **No false dirty state:** `keyup` still sets the flag, and loading the form or focusing a field does not.
- **Text preservation:** saved values with leading, trailing and internal whitespace, tabs, CRLF, HTML-special characters and an empty field come back unchanged after `|text` escaping. Typed text (including a misspelling) is not rewritten by the handler.
- **Labels:** each textarea has the ID `soap-<name>`, and IDs are unique across the document. Its `aria-labelledby` points to the `<legend>` of its own fieldset, whose text is the translated legend string.
- **Unchanged attributes:** no spellcheck/autocorrect attributes; `cols`, `rows` and `class` unchanged.
- **Save, close, session and CSRF contracts:**
  - The form method, action and `onsubmit` are unchanged, and submit calls `top.restoreSession()`.
  - The CSRF value is rendered, and the ordered list of named form controls is unchanged.
  - After an input-only edit, Cancel opens the existing warning and neither restores the session nor closes the tab.
  - On a clean form, Cancel restores the session and calls `closeTab(window.name, false)`.
  - Confirming the warning clears the flag, restores the session and closes the tab.

### RED (this session, before the production edit)

The first run hit a harness error, not a product result. Running the template's top-level `const close` a second time in the same realm threw `SyntaxError: Identifier 'close' has already been declared`. The test now evaluates the unchanged script text inside a `{ … }` block. The second run also printed `TypeError: parent.closeTab is not a function` from jsdom's asynchronous `javascript:` navigation. The test now stubs `closeTab`. The RED result recorded below is from the third run, against the unmodified template:

```
$ npx jest tests/js/clinical-soap-editor.test.js --runInBand
FAIL tests/js/clinical-soap-editor.test.js
  SOAP editor template dirty tracking
    ✕ subjective: input without keyup marks the note dirty (12 ms)
    ✕ objective: input without keyup marks the note dirty (3 ms)
    ✕ assessment: input without keyup marks the note dirty (2 ms)
    ✕ plan: input without keyup marks the note dirty (2 ms)
    ✕ insertFromPaste input marks the note dirty with no key events (3 ms)
    ✕ deleteByCut input marks the note dirty with no key events (2 ms)
    ✕ insertFromDrop input marks the note dirty with no key events (1 ms)
    ✕ insertReplacementText input marks the note dirty with no key events (1 ms)
    ✕ insertCompositionText input marks the note dirty with no key events (1 ms)
    ✓ keyup still marks the note dirty (1 ms)
    ✓ loading the form and focusing fields does not mark it dirty (1 ms)
    ✓ saved whitespace and escaped markup round-trip unchanged, and input does not rewrite text (2 ms)
  SOAP editor template field names and labels
    ✕ each textarea has a stable unique id and is named by its translated legend (1 ms)
    ✓ no spellcheck/autocorrect behaviour is introduced (1 ms)
  SOAP editor unchanged save/close/session/CSRF contracts
    ✓ form posts to save.php through top.restoreSession with the CSRF token and named fields (2 ms)
    ✕ close after input-only edit raises the existing warning instead of closing (3 ms)
    ✓ close on a clean form restores the session and closes the tab without a warning (13 ms)
    ✕ confirming the warning clears the dirty flag, restores the session and closes the tab (13 ms)

Tests:       12 failed, 6 passed, 18 total
```

Representative failures:
- Dirty tracking: `Expected: true / Received: undefined` at `expect(top.isSoapEdit).toBe(true)`.
- Labels: `Expected: "soap-subjective" / Received: ""`.
- Input-only close: `dlgopen` was called 0 times.
- Confirm test: `expect(window.closeTab).not.toHaveBeenCalled()` received one call, `"", false`. After a drop-style edit, the tab closed without any warning.

### GREEN (this session, after the production edit)

```
$ npx jest tests/js/clinical-soap-editor.test.js --runInBand
PASS tests/js/clinical-soap-editor.test.js
Tests:       18 passed, 18 total
```

Other gates run in this session:
- `npx jest --runInBand --silent`: 27 suites and 426 tests passed.
- `npx eslint tests/js/clinical-soap-editor.test.js` and `npm run lint:js`: clean.
- `php vendor/bin/phpunit -c phpunit-isolated.xml --filter Twig`: OK, 386 tests and 712 assertions. This used this worktree's own `vendor/` (PHPUnit 11.5.56, PHP 8.5.11).
- `--filter "TwigTemplateCompilationTest.*soap"`: `soap_form.twig` compiles.
- `git diff --check`: clean.

No Twig render fixture exists for the SOAP form, so none was regenerated or added. The controller separately reported 426 JS tests, lint and 537 Twig/asset tests green. That run was not repeated here.

## Controller verification

- Independent Codex GPT-6 Astra reviewed the complete template/test/document diff and found no blocking P1/P2 regression. The shared global dirty flag's cross-tab limitations are preexisting, not resolved by this slice.
- Full JS: 27 suites / 426 tests passed; ESLint and `git diff --check` passed.
- Full PHPStan CI configuration over the whole repository: no errors.
- Full isolated PHPUnit: 5,867 tests completed, exit 0; existing warnings, skipped and incomplete cases remain disclosed in the controller log. Focused Twig/asset suite: 537 tests / 863 assertions passed.
- Actual headless Chrome against the disposable local application, navigating Finder → synthetic patient → Visit History → nested SOAP: all four accessible names resolved; `fill()` fired input with zero keyups and set the actual top-level dirty flag for every field; multiline spaces/tabs stayed unchanged. The real Cancel button opened the existing warning; warning Cancel retained all four drafts. Original DOM values/dirty state restored. No clinical save POST or page error.
- Browser evidence: mission `browser-qa/soap-input-guard-local.json` and `soap-input-guard-local.png`. This is local evidence, not a Railway deployment of this change. The existing warning's wording and appearance are unchanged.

## Limitations

- **Twig stand-in:**
  - The test does not use the Twig runtime. A regex replaces `'…'|xlt`/`xla` with the source string, replaces `data.get_*()|text` and `csrfTokenRaw()|attr` with fixed values, and renders every other expression empty. That includes `setupHeader()`, `FORM_ACTION` (so the action is checked as `/interface/forms/soap/save.php`) and asset URLs.
  - The test fails if any `{{`/`{%` is left over. It does not prove real translation, escaping or header output.
  - The real template is covered only by the existing isolated Twig compilation test.
- **jsdom vs. browsers:**
  - Synthetic `InputEvent`s with an `inputType` stand in for real paste, cut, drop, IME composition and dictation. jsdom does not produce these from real user actions, and has no clipboard, drag-and-drop, IME or speech engine.
  - This shows the template's handler fires on `input`. It does not show that every browser, OS dictation tool or assistive technology fires `input` on a textarea. Native dictation or extensions that set `.value` directly without firing `input` would still not mark the note dirty.
  - The inline script runs inside a block because of the realm `const` collision. In jsdom, `top`, `parent` and `window` are the same object, unlike the real tab iframe.
- **Accessibility:** the test checks only that `aria-labelledby` resolves to the legend text in the DOM. Screen-reader output (NVDA, JAWS, VoiceOver) was not verified in this session.
- **Scope:** no spellcheck, autocorrect or dictation feature is added or claimed. Not tested or claimed:
  - Saving a note (`save.php`), persisting `|text` values, or encounter or note locking.
  - Browser `beforeunload`, or the `TabsWrapper.php` tab-close path beyond its shared use of `top.isSoapEdit`.
  - Railway deployment, native dictation/clipboard/IME, assistive-technology output, or clinical acceptance. Controller local-browser input/Cancel checks are recorded above; they do not close these remaining gates.
