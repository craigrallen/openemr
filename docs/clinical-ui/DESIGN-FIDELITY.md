# Accepted research design: fidelity acceptance register

The accepted research-based OpenEMR workbench proposal—not a new concept—is the reference. Its local review package is `OpenEMR-Research/researched/index.html`, `README.md`, `RESEARCH.md` and `ORIGINAL-REQUIREMENTS.md`. The newer user instruction retires All menus, overriding that control in the historical mockup. A screenshot/source comparison is evidence for design alignment, not proof of clinical workflow completeness.

## Implemented in this branch, pending hosted and deployment gates

- Top Work / Patient / Practice area navigation with contextual left rail, using original live authorized menu objects.
- Global sidebar search across areas and restoration of selected context when cleared.
- Reference 66px desktop header, 206px rail, existing neutral/petrol palette and current/hover/focus treatment.
- No All menus button or popup in the main shell; shared menu helpers and legacy fallback retained.
- Local real-browser acceptance: area switching without iframe replacement, all 119 admin runtime action labels retained, synthetic Finder/patient/SOAP route and unsaved drafts preserved, native/fallback layouts and mobile drawer checked. Other roles and installed module combinations require their own runtime acceptance.

## Explicitly unfinished

1. Task-led Work landing surface: build on actual day schedule and real data; next action/follow-up panels must use authenticated backend state, never the mock's synthetic counts or fabricated statuses.
2. Persistent patient context: align the existing live name, DOB, record ID and encounter header with the accepted composition. Allergy verification state needs a real ACL-protected source and safe unknown handling; do not infer normal/no-allergy from missing data.
3. Encounter document and same-patient reference: align existing note editing with the reference's central document plus read-only longitudinal context. Preserve original save, CSRF, note authority and encounter identity; do not treat local prototype drafts or sample chart content as implemented features.
4. Remaining typography and hierarchy: reference Arial/14px base, 28px workspace headings and approximately 39px navigation rhythm. Match clinical surfaces after preserving every control, semantic alert contrast, zoom and translated content. Patient Finder now has a local-only, workspace-mode heading/toolbar/results-sheet slice (28px heading) with source/DOM tests and authenticated local-browser LTR/RTL search/geometry/control evidence; full research fidelity, zoom, print, role and module verification remain open ([FINDER.md](FINDER.md)).
5. Wider acceptance: actual restricted roles, enabled modules, RTL/long translations, assistive technology and keyboard focus through full menu/search rebuilds. The existing branch-summary focus-restoration limitation is not resolved by area-switch tests.

## Scope boundaries

The original 22 requested features and demo-data coverage gaps remain tracked work, not waived requirements. Real messaging, payment, AI, telehealth and authority-valid certificate/signature workflows require real integrations and validation. No mock integrations, authority claims, patient data or proposal-only behavior should be substituted for production support.

## Delivery gates

Require independent diff review, genuine regression-first tests, exact-head hosted tests/static/coverage checks and authenticated browser verification on the actual deployed Git SHA. PRs must target a workflow-supported base for real JavaScript coverage uploads (`master`/`rel-*`); do not interpret omitted coverage as source correctness or lower thresholds to compensate. Compare representative rendered screens with the accepted reference, and report the implemented subset rather than declaring the full redesign complete.
