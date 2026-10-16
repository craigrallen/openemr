# RxNorm installation details popup (OPEMR-15)

## Rationale

`interface/code_systems/rxnorm_howto.php` is the instruction fragment shown
when an administrator opens "RXNORM Installation Details" from the external
data loads page. Inside the clinical workbench it rendered with the default
theme surface. This change gives the fragment the workbench paper surface,
ink text and petrol links, scoped to the workbench context only, without
touching its content.

This is a source-only paper adaptation. It does not claim complete
researched fidelity, a native fit inside the dialog, or effective contrast
for the warnings.

## Exact scope

Production files:

- `interface/code_systems/rxnorm_howto.php` — three additions only:
  1. imports `OpenEMR\Common\Assets\ClinicalWorkspaceAssets` and
     `OpenEMR\Core\OEGlobalsBag` alongside the existing `Header` import
     (sorted);
  2. one escaped, versioned `media="screen"` stylesheet link directly after
     `Header::setupHeader()`;
  3. the hook class `oe-rxnorm-howto-document` on the existing
     `div.container`.
- `interface/clinical-workspace/rxnorm-howto-popup.css` — four rules, all
  scoped to `html.oe-workbench-context .oe-rxnorm-howto-document`:
  container `background-color`/`color` (paper/ink), links
  `background-color: transparent`/`color` (petrol), and separate `a:focus`
  and `a:focus-visible` outlines (2px petrol, 2px offset). Fallbacks restate
  the `popup.css` workbench tokens.
- `src/Common/Assets/ClinicalWorkspaceAssets.php` — one sorted
  `rxnorm-howto-popup.css` entry in `SUPPORTED`.

Unchanged by design:

- All original fragment content: the translated steps, both NLM links
  (`target="_blank" rel="noopener"`), the `contrib/rxnorm` step, and both
  `h5.text-danger` translated warnings with their original semantic warning
  utility. No CSS targets or repaints the warnings.
- No PHP variables, wrapper elements, `html`/`head`/`body`, inline styles or
  scripts, fonts, geometry or new warning styles.
- No caller, dialog, shared workbench engine, JS, dependency, config or
  policy changes.

## Caller and dialog context (source anchors only)

These are read from source, not observed at runtime:

- The caller is the generic `interface/code_systems/dataloads_ajax.php`
  (around line 213), gated by `aclCheckCore('admin', 'super')` (around
  line 29).
- It opens the fragment with `dlgopen(..., 800, 250, ...)` and the default
  iframe type.
- In `library/dialog.js` an iframe's initial height is clamped up to 300px,
  `sizeHeight` defaults to `auto`, and the content is capped at `94vh`.

## Authorization note

The fragment relies on the global session authentication from
`interface/globals.php`. It has no explicit endpoint ACL check and no CSRF
token of its own. This change neither adds nor removes any check, and it is
not an authorization clearance for the endpoint.

## External links

Both NLM links are informational. They were not visited and must not be
visited as part of this change's verification.

## Verification and limitations

`tests/js/rxnorm-howto-popup.test.js` is a source-only contract: it reads
files as text, restores the route to the original fixture byte for byte,
checks the helper against its baseline, and checks the stylesheet against an
AST allowlist. It does not execute PHP, `Header::setupHeader()`, the
dataloads endpoint or `dialog.js`, and does not test compiled themes. Test
results are reported separately by the controller.

Awaiting QA (not established here):

- actual PHP execution, `Header` output parsing and stylesheet activation;
- warning and link contrast in the compiled default, dark and solar themes;
- keyboard focus visibility and focus clipping inside the dialog;
- initial and resized narrow dialog sizes;
- RTL, translations, print, roles and the Close control.

Ordinary PR approval is required; there is no standing bypass.
