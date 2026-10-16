# Patient search help (OPEMR-11)

`interface/main/finder/patient_select_help.php` is the static help page the
patient finder opens from its `[Help]` link. OPEMR-11 makes a source-only,
palette-only adaptation of it for the clinical workbench. This page records
exactly what changed, what is kept, and what has not been verified.

## Status

- Contract: `tests/js/patient-search-help.test.js`, with the original route
  recorded byte for byte in
  `tests/clinical-ui/fixtures/patient-search-help-original.txt`.
- The hosted run before this change was RED (tests-only commit `a328a37b`,
  four intended missing-production failures). This source change has **not**
  been run here; it is not GREEN until the controller's hosted run says so.
- This is a partial palette adaptation. It is not acceptance against the
  research reference, and it does not complete layout, hierarchy, or
  persistent patient context.

## Exact changes

Route, `interface/main/finder/patient_select_help.php` — three additions and
nothing else:

1. Two imports placed before the existing `Header` import, in the order the
   contract fixes (the original order is not normalised):
   `ClinicalWorkspaceAssets`, then `OEGlobalsBag`, then `Header`.
2. After `Header::setupHeader()`, one stylesheet link for
   `interface/clinical-workspace/patient-search-help.css`, with
   `media="screen"`, the web root escaped with `attr()`, and a `?v=` cache
   version from `ClinicalWorkspaceAssets::version()` escaped with
   `attr_url()`. It sits before `<title>`.
3. `class="patient-search-help"` on the previously bare `<body>`.

Removing those three additions gives back the original route exactly. The
bootstrap (`require_once("../../globals.php")`), the default
`Header::setupHeader()` call, title, headings, the three populated
instruction paragraphs and the trailing empty paragraph (with its empty
`<h2>`/`<p>`), and the final newline are untouched. No
script, translation call, wrapper element or new text was added.

Asset helper, `src/Common/Assets/ClinicalWorkspaceAssets.php` — one entry,
`patient-search-help.css`, added to `SUPPORTED` in sorted position (before
`patient-search.css`). Nothing else in the class changed.

Stylesheet, `interface/clinical-workspace/patient-search-help.css` — a single
`@media screen` block with three rules, all scoped to
`html.oe-workbench-context body.patient-search-help`:

| Selector | color | background-color |
|----------|-------|------------------|
| body | `--oe-wb-ink` (`#17343b`) | `--oe-wb-paper` (`#fff`) |
| `h1` | `--oe-wb-petrol` (`#086878`) | `--oe-wb-paper` (`#fff`) |
| `h2` | `--oe-wb-ink` (`#17343b`) | `--oe-wb-paper` (`#fff`) |

Colour is always paired with a background. There is no `!important`, no font,
size, spacing, border, display or other geometry, and no selector outside the
context class. No print, font or geometry declarations were added; rendered
legacy/print equivalence is not yet verified. The fallback pairs meet 4.5:1 by
calculation; the live token values are not checked.

The body colour is inherited, so compiled-theme paragraph rules can override
the inherited body ink. Ordinary low-specificity theme heading rules cannot
defeat the higher-specificity explicit `h1`/`h2` rules here, but `!important`
declarations, theme layers and runtime behaviour remain for the native gate.

No shared workbench popup typography was added for this page.

## How the styling is reached

The sheet applies only while `html.oe-workbench-context` is set. The shared
Header popup controller (`interface/clinical-workspace/popup.js`) sets it
when a same-origin parent or opener chain reaches an active workbench shell.
The finder opens the help with an unchanged named `target=_new` link; this
change does not touch the caller, add `noopener`, set dialog dimensions, add
a route bootstrap, or add a `localStorage` or other fallback. A help window
with no reachable opener keeps the original styling.

## Caveats and open QA

- The themes' `.body_top` background rule uses `!important`, but this page's
  body has never carried `body_top`, before or after. Whether broad theme
  `h1`/`h2` rules or other cascade layers override these rules, and the
  resulting effective contrast, still needs native QA; source reading is not
  a verdict.
- Not verified: native PHP rendering, which window the browser reuses for the
  named target and whether it keeps the opener, compiled-theme contrast,
  narrow and resized windows, RTL and translations, keyboard and reading
  order, legacy print, behaviour across roles.
- The inherited English instructions may no longer describe the current
  search. They were kept as written and are not certified documentation.
- Security: the route still relies on the global session/auth from
  `globals.php`. It has no per-route ACL and no CSRF token, and none is added;
  the page is static and takes no input. This is not a security clearance,
  and no live request was made.
