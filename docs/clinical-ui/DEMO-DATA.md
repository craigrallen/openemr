# Synthetic demo data seeder

Status: synthetic fixtures have now been applied to Railway `openemr-ui-test/testing` and independently read back: 6 synthetic patients, 183 tracked inserted entries across 39 tables, 54 manifest categories covered; rerun inserted 0. Nine manifest gaps remain (see below), so **all-entry-type coverage is not complete**. Code is on branch `feat/synthetic-demo-data`; PR/CI state must be checked live.

Before live mutation, the controller exported the database and sites directory to restrictive local backup storage. The initial 283-table/0-patient backup was restored successfully into isolated MariaDB 11.4. A fresh pre-write backup is `/Users/craig/.hermes/projects/openemr/backups/pre-demo-20261002T013548Z`. Live reports are under `/Users/craig/.hermes/projects/openemr/verification/demo-*`; no secrets are in these docs.

## What it is

`contrib/util/demo-seed/demo-seed.php` loads
`contrib/util/demo-seed/fixtures/synthetic-demo-v1.json` through
`OpenEMR\Demo\Seed\DemoSeeder` into one OpenEMR site inside a single DB
transaction. Every row is marked (patients: `genericval1` = fixture seed key;
other rows: `[SYNTHETIC-DEMO-SEED ...]` text markers). No real people, no
credentials, no outbound channels.

## Invocation (run as the web user, never root)

OpenEMR CLI refuses UID 0 (`RootCliGuard`), so run as `apache` inside the app
container:

```bash
docker exec demoseed-app su -s /bin/sh apache -c \
  'cd /var/www/localhost/htdocs/openemr && php contrib/util/demo-seed/demo-seed.php inventory --site=default'
# read-only modes: inventory | dry-run | verify
docker exec demoseed-app su -s /bin/sh apache -c \
  'cd /var/www/localhost/htdocs/openemr && php contrib/util/demo-seed/demo-seed.php verify --site=default'
# write mode (requires the environment gate below):
docker exec demoseed-app su -s /bin/sh apache -c \
  'cd /var/www/localhost/htdocs/openemr && php contrib/util/demo-seed/demo-seed.php seed --site=default --confirm-synthetic-seed=default'
```

Optional `--fixture=<path>` selects another fixture file.

## Fail-closed prerequisites (`SafetyGate`)

`seed` refuses unless all hold:

- `OPENEMR_DEMO_SEED_ALLOWED=synthetic-test-only` and `OPENEMR_DEMO_SEED_TARGET=railway-testing` (or `local-dev` for disposable local tests).
- CLI SAPI, explicit `--confirm-synthetic-seed=<site>` matching `--site`.
- Target is `local-dev` (no `RAILWAY_ENVIRONMENT_NAME`) or `railway-testing`
  (`RAILWAY_ENVIRONMENT_NAME=testing`); anything else is refused.
- The runtime marker (`/run/openemr-railway/ready.json`) matches the DB
  `globals` table for the canonical settings, and outbound features are
  disabled: `EMAIL_METHOD=SMTP` to `127.0.0.1:9`, `payment_gateway=InHouse`,
  `gateway_mode_production=0`, `medex_enable=0`, `phimail_enable=0`,
  `portal_onsite_two_enable=0`, `erx_enable=0`, `erx_upload_active=0`,
  **`rx_send_email=0`**.
- **Stock OpenEMR ships `rx_send_email=1`.** It must be set to `0` in `globals`
  before seeding or the gate refuses (the local DB was set to 0 by the controller).

Document storage is additionally enforced per document
(`OpenEmrSeedGateway::assertLocalDocumentStorage`): `document_storage_method`
must be filesystem (0, not CouchDB), `documentStoredRemotely` false,
`enable_atna_audit` off, no listener on
`PatientDocumentStoreOffsite::REMOTE_STORAGE_LOCATION`, and no `image/*`
documents (thumbnail paths).

## Failure behaviour

- Observed exceptions roll back the DB transaction and unlink only the document
  files this run wrote. The gateway now uses the repository's `QueryUtils::inTransaction()` wrapper rather than deprecated manual transaction methods. The underlying legacy ADODB/mysqli commit path does not surface every COMMIT failure; commit acknowledgement and cleanup under such an unreported failure remain an inherited, unverified limitation. This is a test-only seeder, not a production-safe commit guarantee. Independent review raised this limitation; no core database behavior was broadened during the CI repair. Core `Document` persistence is switched to throwing
  (`setThrowExceptionOnError(true)`) so an SQL failure no longer `HelpfulDie()`s
  past the rollback; files written before a uuid/persist exception are tracked
  and removed. Error-string returns from core are never treated as our file
  (they occur before the write or name a preexisting file). Empty patient
  subdirectories created by core may remain.
- Re-run is idempotent: complete patients are skipped; a patient that fails
  `SeedVerifier::verifyPatient` (e.g. missing rows or missing/repointed
  `issue_encounter` links) is refused as *incomplete* with no mutation.

## Known coverage gaps (truthful)

See `CoverageManifest` for the authoritative list. The live inventory's nine gap categories are: staff login credentials, facility-specific user attributes (`FACUSR`), dated reminders, Eye Exam, questionnaire assessments, video appointment integration, X12 claims, CCDA generation, and patient contacts/care teams. These are unfinished, not accepted exemptions from Craig's requirement. Disabled group therapy, eRx, portal and dispensing remain separately classified as not applicable to the current configuration. Notably:
- Documents: core `createDocument()` does not link an encounter and stamps
  `docdate` itself — the fixture's document `encounter`/date are not applied.
- Registry forms/LBFs not in `FormCatalog` are classified as not seeded.
- No portal users, credentials, eRx, fax/SMS, email or claims submission are
  created by design.

## Test evidence (local only)

| Suite | Result | Context |
|---|---|---|
| Isolated `tests/Tests/Isolated/Demo` | 87 tests / 525 assertions PASS | Controller rerun with `vendor/bin/phpunit -c phpunit-isolated.xml tests/Tests/Isolated/Demo/Seed` |
| Real CLI/database/storage integration | 9 tests / 343 assertions PASS | Controller restored disposable baseline, disabled `rx_send_email`, and ran both suites as `apache` with `--no-configuration --bootstrap vendor/autoload.php --do-not-cache-result`; includes duplicate rerun, relationships/UUIDs, mid-run rollback, post-file-write failure cleanup and preservation of preexisting document contents |
| PHPCS | PASS | `vendor/bin/phpcs --report=summary src/Demo contrib/util/demo-seed tests/Tests/Isolated/Demo tests/Tests/Demo` |
| Live Railway read-back | PASS | 6 synthetic patients, 183 tracked entries, expected fixture/relationships verified, rerun 0 inserts; 9 coverage gaps retained |

The post-write Document rollback regression did not have a valid pre-fix RED run: initial failures were bootstrap/setup errors, not a reproduced bug. This is an explicit TDD-process exception, not claimed as test-first. Independent review identified the defect; controller then verified the injection regression and complete real-database rollback suite. The rollback assertion was strengthened from top-level directory names to recursive file paths plus SHA256 contents because empty directories may safely remain; preexisting files must remain byte-identical.

RED evidence for this change: the three new isolated `issue_encounter` tests
failed before the `SeedVerifier` fix (86 tests, 3 failures) and pass after.

Rollback/restore: the controller's restore-tested backup (283 tables, 0
patients) is recorded in `ACTIVE-DATA.md`; use it to return the local DB to the
zero-patient baseline before re-running `DemoSeedContainerTest`.
