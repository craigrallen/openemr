# Portal appointment openings popup (OPEMR-44)

## Scope and design

The existing patient portal popup remains a small search sheet. Its criteria strip gets a paper background, ink text and a quiet inset bottom rule. Available time links get a visible petrol keyboard focus outline. This is a narrow presentation change, not a full researched UI or a clinical acceptance claim.

Only `portal/find_appt_popup_user.php` changes in production: `oe-portal-openings` is added to the existing body class, and a second standalone inline `<style>` block is placed after the original style block, immediately before `</head>`. Its three rules sit inside `@media screen` and use the `body.oe-portal-openings` scope: one rule for `#searchCriteria`, plus separate `:focus` and `:focus-visible` rules for `#searchResults a`. The original style, PHP, JavaScript and markup remain unchanged except for the explicit body class and style additions. The body scope opts this portal route into the styling; it does not activate the clinical workbench, inspect the parent context, or restore opener state. The original layout, fonts, native controls, result palette, hover behavior and print styles remain as written.

Files for this slice:

- `portal/find_appt_popup_user.php` — the two production additions above.
- `tests/clinical-ui/portal-openings-popup.test.cjs` — existing source contract defining the exact addition and whole-file inverse; unchanged here.
- `tests/js/portal-openings-popup.test.js` — existing test wrapper; unchanged here.
- `tests/clinical-ui/fixtures/portal-openings-original.php.txt` — existing 448-line baseline fixture; unchanged here.
- `docs/clinical-ui/PORTAL-OPENINGS-POPUP.md` — this record.

## Preserved route behavior

The existing session gate requires both a portal `pid` and `patient_portal_onsite_two`; its failure branch destroys the portal session and redirects to the portal landing page. The existing `ignoreAuth_onsite_portal` setting, globals and appointment library loads, request handling, date window and category-duration calculation are unchanged. Provider-filtered event fetching, preferred-category in-office treatment, out-of-office and reserved slot bits, configured schedule hours, availability filtering and no-openings result remain source-preserved. Output escaping, the date picker, result hover classes, time-link `setappt`/`opener.setappt` call and dialog close remain source-preserved. The caller in `portal/add_edit_event_user.php` and `Header::setupHeader(['no_main-theme',  'portal-theme', 'datetime-picker', 'opener'])` are unchanged.

The existing malformed form closing and duplicate `searchResultsHeader` IDs are retained; this slice does not repair them. Source equality is not runtime security clearance or proof of booking safety.

## TDD checkpoint and review state

The controller reported a hosted JavaScript RED run (39162162743) before the production edit: five portable positive, inverse and mutant tests passed; the actual-source test failed because the production addition was missing. The other 61 suites and 1,259 tests passed. The controller also verified that the full 448-line fixture equals fork base `18647270`. This work did not run tests or PHP after the edit. The controller owns subsequent verification and review.

Native PHP, authentication, portal eligibility, CSRF, booking availability and save behavior remain open for runtime review. Focus and hover clipping, portal compiled themes, a short or narrow popup opened and resized as a 300-height modal, RTL, legacy print and roles also remain open. This is a draft PR scope: unmerged and undeployed, with ordinary approval required and no bypass. There is no no-risk or clinical acceptance claim.
