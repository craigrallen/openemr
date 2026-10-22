# Procedure Picker (order type) popup

`interface/orders/find_order_popup.php` is the Procedure Picker both callers open with `dlgopen(..., '_blank', 850, 500, '', title)`: the procedure order form (`interface/forms/procedure_order/common.php`, `sel_proc_type()`) and the order type editor's favorites picker (`interface/orders/types_edit.php`, `doOrdPicker()`, `addfav=1`). Inside an active workbench it now renders as a document sheet: a framed search/actions editor band above a ruled results table that scrolls inside its own frame.

## Scope delivered

- Presentation only. The route gains a body class (`oe-order-type`), seven wrapper hook classes and a screen-only link to `interface/clinical-workspace/order-type-popup.css`, versioned through `ClinicalWorkspaceAssets` (fixed basename `order-type-popup.css` added to its allowlist).
- Activation reuses the existing Header popup controller: `popup.js` and `popup.css` already autoload through `Header` at baseline and are not changed. Every rule requires `html.oe-workbench-popup` (set by `popup.js` only for a dlgopen dialog or opener chain reaching an active workbench) plus the route body class, so a top-level page, a workbench tab frame, explicit legacy mode and print keep the original rendering. `workspace.css` and `mode.js` are not linked.
- Colours come from the shared `--oe-wb-*` tokens; field, placeholder, primary buttons (with hover/focus/active), editor band, header cells and both striped row surfaces each pair ink with a surface. Erase keeps its theme danger palette.
- The search group and action row wrap (no width media queries, so the stylelint prefix-override allowlist is unchanged); the input may shrink, button labels wrap, cells wrap long descriptions. No font size, hiding, clipping or single-line forcing is declared. `:focus` and `:focus-visible` each keep a visible ring on the input, buttons and result links.

Unchanged: all SQL and binds, `$_GET`/`$_POST`/`$_REQUEST` reads, the selection branch (`set_proc_type`, group expansion with countdown, QOE generation via `generate_qoe_html`, `set_proc_html`, `set_new_fav`, closed-opener alert, `window.close()`), the inline `selcode()`, the form action, every control, id, name, value and text, and both callers.

## Evidence

- `tests/js/order-type-popup.test.js` (Jest): reversible edit map back to the original 209-line route digest, with negative guards over SQL, request reads, grouping, QOE, callbacks, controls and wording; both callers, `popup.js`/`popup.css`/`config.yaml`, `.stylelintrc.json`, `ACCEPTANCE.md` and `PLAN.md` byte-identical.
- The real route runs on host PHP through `tests/js/fixtures/find-order-popup-harness.php` with stubbed Header and SQL helpers, real escaping/translation helpers and SYNTHETIC rows. For search, favorites, addfav and initial requests its output equals the reconstructed baseline route's output apart from the hooks and stylesheet link; the selection branches are byte-identical. The rendered `selcode()` and selection scripts then run under jsdom (only `location` is shadowed to record navigation).
- Stylesheet: scope, screen-only, token pairing and contrast, separate focus rules, narrow wrapping contract with negative mutations, stylelint under the unchanged repo config; engagement through the real `popup.js` controller in dialog, tab, top-level and legacy-opener contexts and across a legacy-mode transition.
- `tests/Tests/Isolated/Common/Assets/ClinicalWorkspaceAssetsTest.php`: the new basename versions from its own file; near-miss names are rejected.

## Limits and inherited behaviour

- The narrow-width checks are declarations, not native geometry: no browser layout, fonts, zoom or scrollbars were measured.
- Fixture confinement: the harness is CLI-only; any other SAPI (for example a web request to a source checkout that serves `tests/`) gets an empty 404 before any alias, argument, include or SQL double is set up, even with `register_argc_argv` on. Its route override is accepted only for a file named `find_order_popup.php` inside the system temp directory, so the reconstructed-baseline comparison still runs. There are no other fixture entrypoints: the `globals.php` and `qoe.inc.php` include doubles are generated per run, guarded against the real functions, into a temp tree in the system temp directory that is removed when the run ends. Their procedural adapters delegate to typed methods, so the analysed fixture declares no global functions, and malformed synthetic scenarios are rejected before anything renders. A loopback-only PHP built-in server test checks the 404.
- The PHP harness uses stubbed Header and SQL helpers and a generated stub `qoe.inc.php`; the real database, session, `Header` output and QOE markup are not exercised.
- Inherited: with `addfav`, the selection branch calls `set_new_fav()` and `window.close()`, then still emits `opener.set_proc_type(...)`, which `types_edit.php` does not define; the test pins that thrown error rather than fixing it. That trailing `set_proc_type` call is inherited and deliberately left unchanged.
- No native visual or browser acceptance (live, real-role, real-data, keyboard, opener or print) of this route has been performed. This slice is not evidence for any of the 22 features in [ACCEPTANCE.md](ACCEPTANCE.md).
