# Railway test server (TEST USE ONLY)

Builds this fork's checked-out branch on the pinned upstream release runtime
and runs it on Railway with a private MariaDB. Synthetic data only; not
approved for clinical use, real patient data, or any outbound communication.

## How the build gets its source

Railway builds from GitHub's source archive of the linked branch. That archive
honours `.gitattributes` `export-ignore`, which excludes `docker/*` upstream.
`.gitattributes` therefore carves out `docker/railway/**` and
`docker/release/**` (the upstream startup this image reuses). Without the
carve-out the build fails with "cannot find docker/railway/Dockerfile".
`acceptance-test.sh` builds from the same kind of archive to catch this.

There is no `Dockerfile.dockerignore`: the CI hadolint job lints every
`docker/**/Dockerfile*` path, and the archive already omits `.git`,
`vendor/` and `node_modules/`.

## Service settings (set through the Railway CLI/API; config-as-code is not used)

| Setting | Value |
|---|---|
| Source | GitHub `craigrallen/openemr`, branch `feat/clinical-menu-launcher` |
| Dockerfile path | `docker/railway/Dockerfile` (root directory: repository root) |
| Healthcheck path | `/meta/railway/readyz` |
| Healthcheck timeout | 1800 s (first boot installs the schema) |
| Volume | mounted at `/var/www/localhost/htdocs/openemr/sites` |
| Public domain | none until the secured runtime is verified |

`railway.json` mirrors these for reference only.

Required variables: `MYSQL_HOST` (private `*.railway.internal` host),
`MYSQL_ROOT_PASS`, `MYSQL_PASS`, `OE_USER`, `OE_PASS`; optional
`OE_HTTP_BOUNDARY_USER`/`OE_HTTP_BOUNDARY_PASS`. Passwords must be at least 16
characters from `A-Z a-z 0-9 _ -` (upstream splits on whitespace and `=`).
Values are stored only in Railway and `~/.hermes/secrets`, never in the repo.

## Startup guarantees

`railway-start.sh` (before upstream `openemr.sh`):

- redacts every password value from all container output, including upstream
  installer errors that print failed SQL;
- refuses missing, default, short or unsafe-charset credentials,
  `MANUAL_SETUP=yes`, and an unmounted `sites/` (no silent ephemeral state);
- seeds an empty volume; adds the optional basic-auth boundary with
  `AuthMerging And`, so Files/Directory denials still apply to authenticated
  users; only the readiness path is anonymous;
- scopes its restrictive umask to the password file, so upstream's root-created
  `TEMPsql_upgrade.php` stays readable by apache.

`railway-serve.sh` replaces upstream's final `exec httpd` (the build fails if
that line changes):

- `railway-verify.php` writes the mail/SMS/payment safety globals to the
  `globals` table and reads them back; any failure keeps Apache down
  (upstream's `setGlobalSettings || true` is not relied on);
- Apache's PHP scans only `railway-web.d`: the image's `conf.d` minus the SOAP
  and Redis extensions (`railway-web-ini.sh`; PHP 8.5 cannot disable classes)
  plus `php-railway-egress.ini` (`allow_url_fopen`/`allow_url_include` off; no
  curl, socket, stream-client/server, mail, IMAP, FTP, LDAP or process
  functions). The CLI install/upgrade keeps the full `conf.d`. MySQL is
  unaffected.
- One restriction set, `railway_web_guard_violations()` in `railway-safety.php`,
  is checked before Apache starts and on every readiness probe; any listed
  function or class still available fails closed.

`/meta/railway/readyz` (an `AliasMatch` to `readyz.php`; Railway rejects
healthcheck paths ending in `.php`) returns 200 only when the verification
marker exists, the site is installed and the database answers, the safety
globals still match, and the guard is active; otherwise 503. It is the only
URL exempt from the HTTP boundary; `/meta/railway/readyz.php` itself is 403.

## Known limits

- No network-level egress firewall: Railway containers have no `NET_ADMIN`,
  so the guard is PHP-level. The CLI startup scripts and the optional
  `ccdaservice` Node process are not covered by it; `ccdaservice` is off by
  default.
- Not blocked by the PHP guard: `mysqli`/PDO connections (needed for the
  database), DNS lookups, and ImageMagick (`imagick`) URL delegates.

## Local acceptance

```bash
docker/railway/acceptance-test.sh          # build from archive + run all checks
docker/railway/acceptance-test.sh --skip-build
```
