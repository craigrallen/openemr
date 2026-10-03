# Clinical UI — incremental plan

This plan turns the researched direction (light compact workbench, one petrol
action colour, persistent patient identity, document-shaped note, actionable
schedule) into a series of separately reviewable OpenEMR changes. The design
artifacts are reference only. Mock data, static menu inventories and pretend
services from the prototype are not carried into the app.

The "All menus" launcher from slice 1 has since been retired from the shell
in favour of area navigation; partial slices now exist for the workbench
shell, patient workspace, visit history, calendar, appointment editor and the
SOAP document sheet (see [STATUS.md](STATUS.md) and
[DESIGN-FIDELITY.md](DESIGN-FIDELITY.md)). **The design is not complete.** Every later slice
below needs its own clinician and accessibility review.

## Hard rule: no existing feature is dropped

Modernisation must keep every existing workflow. A new surface is **additive**
until it has passed the parity gate below. Until then the old UI stays in place
and reachable, and nothing is removed, hidden or rerouted. Slice 1 is additive
only: the dropdown menu and every other entry point are unchanged.

### Parity gate (must pass before any old UI is replaced or removed)

A static inventory, such as the shipped `menus/*.json` files or a prototype
menu list, is **not** exhaustive and cannot prove parity. The menu a user
actually sees is assembled at runtime. Before any old surface is retired, a
recorded check against a running OpenEMR must show that the new surface
covers all of the following, or that each gap has been explicitly approved:

1. **Runtime menu variants:** every role menu (`standard`, `front_office`,
   `answering_service`, `chart_review` and custom role files), ACL and
   globals filtering, facility-dependent configuration, and entries added or
   removed by `MenuEvent::MENU_UPDATE` / `MENU_RESTRICT` listeners from
   installed modules.
2. **Form-generated entries:** visit forms, LBF forms (including blank LBF
   popups) and any registry-driven or module-registered forms.
3. **Separate menus:** the patient menu (`patient_menus/`, `PatientMenuRole`)
   and the encounter forms menu (`interface/patient_file/encounter/forms.php`,
   `EncounterMenuEvent`). These are separate menus, not part of the global
   tree.
4. **Every action, not just links:** popups (`target: 'pop'`), tab/iframe
   targets, `onclick`-style actions, the patient finder, search, and anything
   reached from inside a page rather than from a menu.
5. **Permissions and clinical context:** the same ACL outcome per role, and
   the same patient, encounter and therapy-group requirements, encounter
   locks, ESign/lock behaviour, CSRF, `restoreSession` and telemetry.
6. **Evidence:** the check is run as admin and as at least one restricted
   role, with modules enabled, and the results are recorded in STATUS.md.

## Gates every slice must pass

0. **Additive until parity.** See the hard rule above. No existing feature,
   entry point or workflow is removed in any slice that has not passed the
   parity gate.
1. **Preservation.** The existing route, dropdown, popup, tab/iframe
   navigation, `restoreSession`, CSRF, ACL, encounter lock, the patient finder
   and telemetry keep working unchanged, or the change is called out and
   approved. Reuse the existing entry points (e.g. `menuActionClick`,
   `navigateTab`, `dlgopen`) rather than parallel paths.
2. **Tests first.** Write failing tests and run them (RED) before writing
   production code. Record the commands and output in STATUS.md. Use Jest
   (jsdom) for shell JS, PHPUnit isolated/Twig render fixtures for templates
   and services, and E2E (Panther/Selenium) for flows that cross frames.
3. **Static checks.** `lint:js`, stylelint, `php -l`, PHPStan level 10 with no
   new baseline entries, Rector, phpcs and codespell.
4. **Accessibility.** Keyboard-only paths, visible focus, focus restore,
   status announcements, colour never the only signal, 200–400% zoom, narrow
   width and RTL. These are provisions to verify manually, not a conformance
   claim.
5. **Safety.** Patient identity stays visible in patient-scoped work. Nothing
   puts patient data in storage or URLs it didn't already use. Untrusted text
   is never inserted with `innerHTML`.
6. **Scope.** No global CSS rewrite, new build system or new dependency, and
   no schema change unless the slice explicitly needs it and it goes through
   `sql_upgrade`.

## Upcoming slices (proposed order)

| # | Slice | Builds on existing | New service dependency? | Key extra tests |
|---|---|---|---|---|
| 2 | **Shell tokens and navigation chrome**: CSS custom properties for ink, surface and petrol, scoped to the tabs shell. Compact navbar and tab strip. | `tabs-theme`, `tabs_template.html.twig` | No | Theme build diff, stylelint, Twig render fixtures, visual check across the existing themes |
| 3 | **Patient identity region**: a persistent identity banner (name, DOB, ID, encounter) with similar-name cues. | `patient_data_template.php`, `patient_data_view_model.js` | No | Patient switch clears context; banner visible in every patient tab; screen-reader name |
| 4 | **Patient workspace**: Work / Patient / Practice grouping and a same-patient reference pane. | Dashboard cards (`src/Patient/Cards/`), existing summary endpoints | No | ACL per card, no cross-patient leakage on switch, E2E |
| 5 | **Note editor**: document-shaped encounter note with explicit save and template insertion that only appends. | SOAP and LBF forms, `load_form.php` | No (no durable autosave in this slice) | Lock/ESign respected, CSRF, draft keyed by patient and encounter, loss-on-switch warnings |
| 6 | **Calendar and schedule**: actionable provider schedule and a single appointment detail surface. | `interface/main/calendar`, the appointment editor | No | Recurrence scopes, conflicts, status changes keep audit; front-desk E2E |
| 7+ | **Service-dependent features**: AI draft review, booking conversations, payment, telehealth and certificate workflows. | Modules (e.g. Comlink), portal | **Yes**: each needs a real service contract, audit, consent and an owner | Explicit human acceptance; certificates never shown as signed without real e-signing; failure and offline states |

**Scope supersession (2026-10-02).** The earlier rule that kept slice 7+
"out of scope until the external contract is agreed" is superseded. External
onboarding (certificate issuer, unit entitlement, signing method, SMS/email,
payment, telehealth and model providers) gates only the **live** steps:
signing, submission to an authority, sending messages, taking payments,
starting real calls and transmitting records to a model. It does **not** block
independent draft and backend work: data models, drafts, templates, review
and approval flows, recording test transports and their tests proceed now.
Nothing may present a simulated service as real: no certificate is shown as
signed or submitted, and no message as sent, without the real integration.
All 22 original features are tracked in [ACCEPTANCE.md](ACCEPTANCE.md).

## Follow-ups from slice 1

- Run the PHP and Twig suites and PHPStan in a dev container (blocked locally,
  see STATUS.md).
- Live browser verification with Panther, as admin and as a restricted role,
  including module-added menu entries. This also checks the pointer-focus and
  IME fixes in real engines: Chrome, Firefox and Safari, each with a CJK IME.
- Decide whether the patient and encounter menus get their own launcher
  coverage. Today they are not indexed, so slice 1 is not a full-app feature
  finder.
- Add the new strings to translations.
- Decide with clinicians whether a keyboard shortcut is wanted. It must not
  steal keys from iframes or text fields. None ships today.
- Usability study tasks from the research (e.g. "find an uncommon report and
  explain its prerequisite") before claiming any discoverability improvement.
