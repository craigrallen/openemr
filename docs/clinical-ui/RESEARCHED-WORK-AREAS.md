# Research-based work-area navigation

This slice implements the agreed research proposal's top-level Work, Patient and Practice navigation with a contextual left rail. It is not a claim that the full proposal is complete.

## Reference and behavior

The accepted reference is `OpenEMR-Research/researched/index.html`: a light 66px top header, 206px contextual rail, petrol action/current states and continuous clinical workspace. The newer user instruction retires All menus even though that control exists in the historical prototype.

Area switching changes only menu-section visibility. Original live menu nodes, ACL/context guards and dispatch are retained. Search reaches matches across every area; clearing restores the chosen area. Empty ACL-filtered areas announce the absence of available navigation. Native buttons expose their current state. Legacy mode hides the area controls; mobile uses a scrollable area row and the existing navigation drawer. Shared helper scripts remain loaded. Clinical iframe ancestry is not changed by area switches.

## Verification

Controller verification: 422 JavaScript tests across 27 suites, full ESLint and Stylelint, PHP syntax and diff checks passed. Claude added failing tests before implementing the navigation behavior. Independent Codex diff review found no actionable P1/P2; it did not claim runtime approval.

Real local authenticated browser checks passed in both native and forced-fallback modes: actual area buttons and contextual rail, global cross-area search, current-state announcements, unchanged clinical iframe identities, measured 66px header/206px rail, all 119 admin menu action labels retained, actual Finder-to-synthetic-patient-to-SOAP navigation, multiline unsaved draft preservation, mobile focus/drawer and document overflow. All menus button/popup absent; no clinical save or JavaScript errors.

## Remaining design and validation gaps

The independent reference/screenshot audit identifies task-led schedule content, persistent patient identity/allergy verification context, an encounter document with same-patient read-only reference, and remaining typography/hierarchy alignment as unfinished. Do not copy synthetic mock bookings, counts, chart information, AI, signing or integrations into production.

The existing renderer restores focused action nodes but does not restore focused branch summaries on a full search/menu rebuild. Real role/theme/RTL/long-translation and assistive-technology acceptance remains broader than the demonstrated admin browser path. Hosted exact-head CI and live Git deployment are separate from the local results above.
