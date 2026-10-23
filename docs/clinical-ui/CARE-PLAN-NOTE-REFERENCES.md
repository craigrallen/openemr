# Care plan note references — OPEMR-119

Owner: Hermes. This is run 1 of at most two consecutive scheduled deliveries per surface/PR, covering implementation and QA, not two test attempts. Ordinary approval is required; this change is unmerged and undeployed, with no standing bypass.

## Change and scope

`interface/forms/care_plan/save.php` calls `CarePlanController::saveAction()`. Its `mapPostToRows()` builds each row and passes the submitted description to `CarePlanFormService::parseNote()` for `note_related_to`. The parser's capture is now lazy (`[^\]]*?`), so each match stops at the first `|}` it can use. The original `]` exclusion, method signature, `json_encode()` flags and `'[]'` fallback remain unchanged. The source `description` is stored unchanged.

This is source-level reasoning for this method only, not database or authenticated validation. Existing stored rows are not rewritten. A later save of an existing care plan can rederive `note_related_to` from its unchanged description because saves replace rows. The separate global clinical-note `parse_note()` remains greedy and outside this change; this is not a universal parser fix.

The delimiter handling remains permissive. An opening without its own close can swallow a following opening before the first valid `|}`. The parser does not validate marker syntax or link references to an identity.

## Characterization and acceptance

Committed test file: `tests/Tests/Isolated/Services/Forms/CarePlanFormServiceIsolatedTest.php` at `9e33c4b9`. Before production code changed, the corrected native run was RED: **24 tests, 24 assertions, 8 failures, 0 errors**. Controller post-change native GREEN: **24 tests, 24 assertions, zero issues**; the existing isolated care-plan controller suite also passed **11 tests, 50 assertions**. Removing the sole added `?` reproduces all 9,208 baseline service bytes exactly. These are local isolated checks through an external vendor-only rooted loader, not live SQL or authenticated acceptance.

`parseNoteExtractsIssueReferences` names the preserved cases: `no markers`, `empty string`, `single marker`, `empty marker`, `separated markers`, `adjacent markers`, `duplicate markers retain order`, `multiple empty markers`, `Unicode markers` (JSON escaping retained), `multiline description`, `newline within marker`, `pipe within marker`, `stray closing delimiters`, `malformed closing delimiter` (the nested-ish permissive case), `unclosed marker`, `complete then unclosed marker`, `closing bracket remains a barrier`, `valid marker after rejected bracket marker`, and `invalid UTF-8 falls back to empty JSON array`. `parseNoteUsesTheCarePlanFormServiceImplementation` verifies the actual method, and `normalizeNullableStringTrimsAndNullsBlanks` preserves its four cases. Tests and assertions were not changed for this production edit.

Portable native target command for the controller:

```bash
vendor/bin/phpunit -c phpunit-isolated.xml tests/Tests/Isolated/Services/Forms/CarePlanFormServiceIsolatedTest.php
```

The local rooted dependency harness is external and has limitations; it is not a repository config change. The controller must run the checks and an independent full-diff review. Hosted Codecov, native full and static gates remain to be accepted, as do authenticated encounter/patient roles, ACL, session, CSRF, locked-save, persistence, security/clinical and FHIR/CCDA interpretation. This does not establish UI or original feature 4 completion. A fresh unrelated OPEMR-118 transaction candidate was rejected because of outer transaction and identity semantics; unchanged OPEMR-117 QA should not be repeated.
