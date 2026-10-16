# OPEMR-5: deletion confirmation popup

Status: implementation run 1 of 2. Genuine hosted RED observed; hosted GREEN pending.
Not complete, not accepted, not approved for merge.

## Rationale

`interface/patient_file/deleter.php` is the shared confirmation step for deleting a patient,
encounter, form, issue, document, payment, billing record or transaction. Inside the active
workbench it still renders as a bare legacy page. OPEMR-5 presents it as a paper document on
the workbench canvas so it reads as part of the workspace, without touching anything that
decides, authorises, performs or reports a deletion.

The paper/canvas treatment is a reference direction only. It is not full design fidelity and
does not claim native equivalence with the target design.

## Exact scope

Route (`interface/patient_file/deleter.php`), exactly four forward additions, each with one
original anchor and an exact inverse (`tests/js/deleter-popup.test.js`, `changes`):

1. `use OpenEMR\Common\Assets\ClinicalWorkspaceAssets;` after the `AclMain` import.
2. After `Header::setupHeader('opener')`: one `ClinicalWorkspaceAssets` instance and one
   `media="screen"` link to `interface/clinical-workspace/deleter-popup.css?v=<mtime>`.
3. `class="oe-deleter-popup"` on the existing `<body>` and `oe-deleter-document` appended to
   the existing `container mt-3` div.
4. `class="oe-deleter-form"` on the existing `deletefrm` form.

No wrappers, no new BODY elements (one `<link>` is new), no new scripts, no reordering, no removed lines.

Asset helper (`src/Common/Assets/ClinicalWorkspaceAssets.php`): `deleter-popup.css` added to
the strict, sorted `SUPPORTED` allowlist; `in_array(..., true)` unchanged.

Stylesheet (`interface/clinical-workspace/deleter-popup.css`): one `@media screen` block,
four rules, each mirrored for `html.oe-workbench-context` and `html.oe-workbench-popup`:

- body canvas: `--oe-wb-ink` on `--oe-wb-canvas`;
- existing container as paper: `--oe-wb-ink` on `--oe-wb-paper`;
- original buttons `:focus`: 2px solid `--oe-wb-petrol` outline, 2px offset;
- original buttons `:focus-visible`: same, as a separate rule.

Every token carries its literal fallback from `popup.css`. No `!important`, no custom
properties, no margin/padding/width/border/typography/display/overflow/position changes.
With neither workbench class on `<html>` (legacy direct page) the sheet matches nothing.

## Ownership

Owner: Hermes controller. Implementer: Claude Opus5.5. Reviewer: independent Codex Astra.
Run 1 of 2 (implementation). The controller performs lint, tests, commit and push. Branch, commits and PR carry the `OPEMR-5` key and target the fork's
`master`.

## Evidence

- Genuine hosted RED at `bdea9f5f`, JS run 38833088306: 13 intended missing-presentation
  failures, 1267 passed, 62 suites. Fixture, exact-inverse, negative-control, protected
  behaviour/security and caller tests all passed at RED.
- The implementing agent ran no local lint or Jest. The controller's PHP syntax check
  passed. CSSlint and hosted GREEN are pending (controller runs, not yet observed).

## Preservation controls

- Fixture `tests/clinical-ui/fixtures/deleter-original.txt` (534 lines) plus forward/inverse
  round trip: the route must equal the original plus exactly the four additions.
- Behaviour negative controls: CSRF on GET and POST, ACL checks (`admin/super` +
  `allow_pat_delete`, `patients/docs_rm`, `acct/disc`), document/patient context check,
  `AccessDeniedHelper::deny`, `EventAuditLogger`, soft-delete SQL, row deletes, POST gate,
  `js_escape` callbacks, `dlgclose`/`dlgSetCallBack`, `exit()`, `top.restoreSession()`,
  `xlt`/`text` escaping, both original buttons (including the Yes button with no `type`),
  and the hidden `form_submit` value.
- The destructive PHP before the markup and the POST branch are byte-identical to the original.
- SQL echo (`sql_string_no_show_screen`), status messages and controls are untouched; the
  sheet hides, clips, pins and resizes nothing.

## Callers

- `interface/patient_file/summary/demographics.php`: `dlgopen('../deleter.php?…', '_blank',
  500, 450, …)` iframe dialog `patdel`, no resize/drag. Asserted against source by the caller
  test, which passed at hosted RED. The controller also confirmed the 500x450 call at
  `demographics.php:433`. The file is not modified.
- Second caller: the controller read `demographics.php:793`, `dlgopen('', '', 600, 360, '', '', {...})`,
  triggered by the `.deleter` click handler at `demographics.php:790`. This is controller-verified
  from source only. It is not native geometry: no real-browser rendering at 600x360 or 500x450
  has been observed.

## Not established / still open

- Native QA in a real browser at the caller sizes, narrow widths and zoom.
- Role coverage (super/admin, docs_rm, acct/disc, denied users).
- Legacy and print rendering (sheet is screen only; print not exercised).
- Translations and long-string layout (including Swedish).
- Keyboard focus visibility in native browsers (jsdom/source checks only).
- Clinical acceptance.
- A complete authorisation audit of the endpoint. None is claimed here.

New screen-only CSS and classes do not establish native, visual or behavioural equivalence.
No claim of complete equivalence, to the original page or the target design, is made.
Tests are source/cascade checks, not contrast, layout or compiled-theme checks.

## Safety constraints for this run

- The endpoint is destructive. No direct GET or POST was made to it in this run, even though
  the confirmation GET normally does not enter the POST mutations.
- No merge, deploy, database access, live HTTP, secrets, policy or scheduler changes.

## Retained gates

The original 22 FEATURE requirements are a feature list; the exhaustive popup inventory is
tracked separately and is not the "22-surface" set. All original FEATURE, demo and Swedish
programme gates, and the earlier parked QA, approval and coverage gates, remain in force and
are not discharged by this slice.
