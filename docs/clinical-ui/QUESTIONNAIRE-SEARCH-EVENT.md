# OPEMR-224 QuestionnaireResponse search event

The `fhir.questionnaire_response.search` event may supply a `ProcessingResult`. A supplied value of any other type must produce a fresh `ProcessingResult` with the translated internal error and return before mapped backend search. This also applies when the event stopped propagation. The service must not call methods on the supplied wrong-type value.

The CLI fixture loads the actual `FhirQuestionnaireResponseService`, four native traits, native interfaces, `ProcessingResult`, and `QueryPagination`. It calls the service's actual `getAll()` method. A declaration-only parent supplies framework method signatures; synthetic Symfony event classes and a synthetic mapped backend isolate the event and backend boundaries. The backend records filtered search parameters and patient binding. These synthetic boundaries do not establish native Symfony, authenticated route, database, or HTTP acceptance.

The cases cover wrong-type values, a hostile object, stopped propagation, validation-invalid result identity, a no-result mapped search, event/backend data merging, and the existing internal-error-but-valid merge behavior. A whole-source SHA-256 check accepts only the original source or a source that reverses to it through exactly one approved fragment replacement. Original wrong-type behavior still fails the behavior cases.

Actual RED/GREEN execution and review are pending controller materialization. Ordinary approval and full hosted gates remain pending. The Jest adapter is a strict wrapper around the PHP fixture; it does not emulate PHP behavior.
