# OPEMR-170 Questionnaire assessment document presentation

Owner: Hermes. Allocation: 1 scheduled run of a maximum of 2, including QA. Internal worker phases are part of the same scheduled run, not separate cron runs.

## Scope and intended files

This is a partial adaptation of the researched document presentation at `/Users/craig/artifacts/OpenEMR-Research/researched/index.html`. It applies a staff workbench screen presentation to the existing shared Questionnaire assessment form. It does not complete the original 22 requested features or the full design, and it is not authenticated or clinical acceptance.

The exact five intended files across the tests-only commit and this production change are:

1. `interface/forms/questionnaire_assessments/questionnaire_assessments.php`
2. `tests/clinical-ui/questionnaire-assessment-document-contract.cjs`
3. `tests/clinical-ui/fixtures/questionnaire-assessment-original.php.txt`
4. `tests/js/questionnaire-assessment-document.test.js`
5. `docs/clinical-ui/QUESTIONNAIRE-ASSESSMENT-DOCUMENT.md`

Only the form and this document are edited in the production step. The tests and original fixture remain as committed at `ec2b7d5aa7ad26181008f615b26b116646417242`.

## Presentation boundary

The style block is screen-only. Its selectors require both `html.oe-workbench-context` and the `body.oe-qa-document` marker. The body marker is emitted only when `$isPortal` is false. Within that scope, the existing container gets a white paper surface with a `1000px` maximum width, a `24px` outer margin, responsive width and padding, and a subtle border. The existing title gets document spacing and a bottom rule. Existing metadata controls and action groups gain natural wrapping and width limits, and focus-visible outlines remain clear.

The portal branch has no document marker, and print has no document style. Native FHIR questionnaire widgets and validation styles are unchanged. The form's original PHP, JavaScript, ACL, CSRF, services, FHIR runtime, fields, ordering, visibility, portal behavior, imports and links remain byte-for-byte after reversing the style insertion and body-class substitution.

## Evidence and verification boundary

The controller ran genuine RED before production edits on the tests-only commit. The portable run recorded 5 tests, 4 passes, and 1 intended missing-presentation failure in `/Users/craig/.hermes/projects/openemr/verification/questionnaire-assessment-document-20261029/red.tap`. The final history run recorded 6 tests, 5 passes, and the same intended failure in `red-final.tap`. The final proposal stylelint result was nonignored with zero warnings after a CSS declaration-indentation correction to the proposal before the tests commit. Production remained byte-identical to base for those RED runs.

The source contract requires the exact frozen style and portal-conditional marker. Its full inverse must restore the complete original fixture byte-for-byte. Four supporting-source guards require the original bytes of `new.php`, `view.php`, `save.php`, and `openemr_questionnaire_components.php` under `interface/forms/questionnaire_assessments/`. The contract also checks the five-file mutation scope against the base Git blob.

Independent review and hosted gates are pending. No browser, actual generated FHIR widget, Save/register/reopen, restricted role, theme, print, localization, or persistence acceptance is claimed here.

Prior unrelated denials and the Swedish publication and installation blockers remain in place. The parked 55 and settled 47 remain unchanged. This work makes no merge, deployment, database, or cron change.
