# Popup: Nation Notes Add Category (TECH-65)

Route: `library/custom_template/add_template.php`. Sheet:
`interface/clinical-workspace/add-category-popup.css`. Contract:
`tests/js/add-category-popup.test.js` against the frozen fixture
`tests/clinical-ui/fixtures/add-category-original.txt`.

## Rationale

Add Category is a small legacy form (context multiselect, category name, ADD)
opened from Personalize. Inside a workbench popup it rendered on the theme's
`$paler` canvas with unstyled native controls. This change gives it quiet
document paper: workbench canvas, one paper form, and token-painted controls.
It is a **partial design adaptation** (reference tokens plus document paper
only), not reference-fidelity acceptance.

## Exact scope

Route: exactly four edits, each restorable by exact inverse to the fixture.

1. `use` lines add `ClinicalWorkspaceAssets` and `OEGlobalsBag` around the
   existing `Header` import.
2. After `Header::setupHeader('opener')`, one `media="screen"` stylesheet link
   versioned through `ClinicalWorkspaceAssets::version()`.
3. `<body class="body_top">` gains `oe-add-category`.
4. `<form >` gains `class="oe-add-category-form"`.

`add-category-popup.css` is registered in `ClinicalWorkspaceAssets::SUPPORTED`
in sorted order.

Sheet: one `@media screen` block. Every selector is scoped to
`html.oe-workbench-context.oe-workbench-popup body.body_top.oe-add-category`
or its `form.oe-add-category-form`. Declarations are presentation-only, including geometry (colour,
background, border, radius, outline, shadow, padding, margin) using
`popup.css` tokens:

- Body: workbench ink and canvas. `interface/themes/color_base.scss`
  (lines 119-122) sets `.body_top, .bgcolor2, .body_nav { background-color:
  $paler !important }`, so the scoped body canvas is the sheet's single
  `!important`.
- Form: paired ink/paper, 1px line border, 12px padding, 6px radius.
- `#template_name` and `#multi_context`: normal, `:focus` and `:focus-visible`
  states use `ink`/`paper`; `:disabled` uses `disabledink`/`disabledpaper`.
  All states keep the line border except focus states, which use the petrol
  border and outline. `:focus-visible` is a separate rule.

Unchanged: the table, the `.text` row (its theme ink stays inherited, not
overridden), fonts, control sizes (`size="5"`), the natural inline control
flow, and the ADD `btn btn-primary` link. No wrappers, flex, grid, reflow, or
action redesign. The original fixed table is **not** responsive.

The form padding and border consume width inside the popup. The total width
against the original has not been measured.

## Inherited behaviour (deliberately preserved)

- No explicit CSRF token in the form or the `ajax_code.php` POST.
- Access rests on global auth from `interface/globals.php`. The caller is
  gated, but `ajax_code.php` `add_template` is a per-user endpoint
  (`template_users` insert for `$authUserID`).
- Result written to `window.opener.opener.document` (`#templateDD`).
- `$.ajax` with `async: false`; the `error` callback is empty.
- `$list_id = $_REQUEST['list_id']` with no default for a missing key.
- ADD is `<a href="#" onclick="add_template()">`, so the default `#` anchor
  navigation still follows.
- Context SQL, `js_escape($list_id)`, and option `htmlspecialchars` escaping
  are byte-identical.
- Caller: `personalize.php` opens it through `dlgopen(..., 400, 250, ...)`.

## Gates

Source gates are the Jest contract: exact-inverse fixture restore, negative
mutations, caller and endpoint anchors, sorted registration, selector scope,
declaration allowlist, and the paired-paint state map.

Still open, not accepted:

- Runtime render in a live workbench popup
- Native control rendering
- Compiled-theme contrast. The inherited `.text` ink on the canvas and paper
  has not been verified against real compiled themes.
- Print, and the standalone legacy (non-workbench) page
- Keyboard and focus traversal
- Narrow widths inside the original 400×250 dialog
- Translations and roles
- A real save, and the opener/opener `#templateDD` update

No API GET/POST, SQL, or live calls were made. There are no schema, deploy,
or metadata changes. Independent Codex Astra source review found no confirmed introduced P1/P2 defects; native and runtime acceptance remain open.

## Next candidate

Controller inspected: `library/custom_template/delete_category.php` (119
lines, untouched). It has a legacy body and table, and its actual caller is
`personalize.php:335`, which opens it in an `iframe_medium` 500×500
dialog. This is the next, different candidate only. A fresh
ownership/security preflight is required before any work. Any change must
preserve the category and shared-user checks, the confirm step, the delete
AJAX call, escaping, and the reload. No deletion was exercised.
