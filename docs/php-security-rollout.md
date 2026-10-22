# TECH-83 runtime source acceptance

Scope: runtime sources only, based on local `origin/master`
`18647270e0c799189d2dc10f801e8de2bff1a360`, on
`TECH-83-php-runtime-security`. No upstream fork PRs were copied.

## Supported paths

| Build source | Source change / acceptance floor |
| --- | --- |
| `docker/railway/Dockerfile` | Controller-supplied `openemr/openemr:latest@sha256:def5407b07d56acf74e733a8dad5f2c086b06f98454c606ef07c9f785fb8da9b`; immediate PHP 8.5.12 stable floor in the shared runtime stage, before Composer or application dependencies |
| `docker/library/dockers/dev-php-fpm-8-{2,3,4,5}/Dockerfile` | Exact controller-supplied FPM patch/digest pairs: 8.2.35, 8.3.36, 8.4.27, 8.5.12; immediate matching-branch floor |
| `docker/release/Dockerfile`, `docker/flex/Dockerfile` | Post-APK engine assertion before PHP use; accepts only requested stable branch 8.2 >= 35, 8.3 >= 36, 8.4 >= 27, or 8.5 >= 12 |
| `docker/binary/Dockerfile` | Post-install checks for both independently downloaded CLI and FPM engines, using the same bounded branch floors before Composer/PHAR use |

The pure PHP assertions use `-n` (no php.ini) and no application bootstrap.
Stable higher patches within the requested supported branch pass; higher minors,
prereleases, unsupported branches, and mismatched engines fail. APK package
revisions, floating tags, and forge release dates alone are not fix evidence.
APK availability is unverified; forge evidence is described below: these builds intentionally fail if the
available engine is below its floor. Existing build arguments, extension logic,
nonruntime instructions, and fork startup/security/migration behavior are preserved.

## Experimental production blockers

`dev-php-fpm-8-6` remains `php:8.6-rc-fpm`; `dev-php-fpm-8-7` remains
`openemr/dev-php-fpm:pre-build-dev-87`. The custom native source build in
`docker/library/dockers/dev-php-fpm/Dockerfile` clones php-src master and targets
8.7; its commented historical version examples are not active version pins.
All three remain **experimental / nonproduction blockers**, explicitly marked in
their Dockerfiles. They are not declared fixed or upgraded to a stable major.
Production acceptance requires upstream fix/backport evidence for the exact
source revision, immutable source/image provenance, and independent engine and
image verification. Existing experimental CI may continue; this source guard
is not a production deployment gate for those paths.

## Evidence and remaining gates

Run the isolated offline suite (Python 3.9+, standard library only):

```sh
python3 -B -m unittest discover -s tests/ci -p test_php_runtime_security.py -v
```

`evidence/TECH-83-red.txt` records the real pre-production-edit run: 7 test
methods, 15 failures, exit 1. `evidence/TECH-83-green.txt` records the final
7 passing methods, exit 0. Tests cover eight supported Dockerfiles, exact pins,
missing/late assertions, experimental disposition, and the actual shipped PHP
expressions via native CLI and synthetic engine versions. Native behavior tests
skip explicitly if PHP is absent; source tests still run. Local execution had PHP
available. `evidence/TECH-83-source-check.txt` records preservation/diff checks
and local tool versions. Synthetic versions exercise the shipped expression;
they do not emulate a container engine or prove image contents.

The dedicated source workflow has only `contents: read`, checkout without
persistent credentials, official checkout/setup-python v7, and the offline test
command. No secrets, dependency installs, deployment, or existing gate/baseline
changes are introduced.

The controller reports registry-manifest verification and isolated network-none,
read-only CLI verification of PHP 8.5.12 on **arm64** for the replacement base.
That evidence was supplied, not independently reproduced here. Source checks
are **not registry authenticity proof**. Target AMD64 image build and engine
verification, extension/runtime compatibility, application/security/startup and
migration acceptance, publication, and live rollout remain controller gates.
No Docker, network, installs, application routes, clinical acceptance, or live
acceptance were executed by this change. No commit, push, or deploy was made.


## Binary repair follow-up (2026-10-22)

The old forge PHP assets contained 8.5.11 and correctly failed the floor.
Only CLI/FPM now use `PHP_BINARY_RELEASE_DATE=10212026`. The application PHAR
retains `BINARY_RELEASE_DATE=10032026`, and `OPENEMR_VERSION=8_4_1` is unchanged.
The selector accepts only Linux amd64/arm64, PHP 8.5 (abbreviation 85), OpenEMR
8_4_1 and that exact PHP release date; every other combination exits before
curl. Both assets must match their exact SHA256 before chmod or execution.
Checksum verification replaces the old heuristic size checks. The independent
pure CLI/FPM floor assertions remain byte-for-byte unchanged.

Hash provenance: controller report
`/Users/craig/.hermes/reports/php-security-2026-10-22/TECH-83-verified-forge-binary-versions.json`.
It records matching GitHub asset SHA256 and isolated version-only CLI/FPM
8.5.12 execution for both architectures. This implementer read that evidence;
no downloads, Docker builds or asset execution were repeated locally.

`evidence/TECH-83-binary-red.txt` records the real initial regression run:
10 methods, three new failures, all seven existing methods passing, exit 1,
before Dockerfile changes. `evidence/TECH-83-binary-green.txt` records the final
11 methods passing on both `python3 -B` and Apple `/usr/bin/python3 -B`.
The additional test executes the shipped shell chain with inert command doubles
to prove download/checksum failures stop installation. Selector tests execute
only the shell selector; PHP tests invoke only pure engine expressions.
These are offline source/control-flow checks, not actual asset verification.
`evidence/TECH-83-binary-source-check.txt` records syntax/lint, exact controller
hash comparison, preservation checks and diff checks with commands and exits.
Existing CI workflows and binary functionality coverage remain unchanged.

SC2016 is suppressed only immediately before each TECH-83 literal PHP RUN,
with rationale: PHP variables must reach PHP without shell expansion. Literal
single-quoted PHP remains unchanged; no other lint rules are suppressed.
Only the two introduced trailing spaces in the original RED receipt were
normalized. Its original raw bytes were retained before normalization at
`/private/tmp/php-security-2026-10-22/TECH-83-red.original-raw.txt`, SHA256
`9f03c0ea25a81a29d74f24098de9829919f5ca5d0606c12353fd1be7399feda0`.
The sandbox denied writing that backup to the controller's report directory;
the temporary task report directory is the retained copy location.

The controller reports that the release build passed the engine floor and then
failed because `ccdaservice` was absent during npm setup. Comparing the exact
current release Dockerfile to baseline `18647270e0c799189d2dc10f801e8de2bff1a360`
shows only the added runtime floor and its comments: application asset stages,
npm setup and ccdaservice COPY are unchanged. This remains a separate baseline/
compatibility blocker; no bypass or application/dependency changes were made.

Hosted CI has not been rerun by this implementer and is not claimed passing.
Controller review of exact source, real binary builds and CLI/FPM checks on both
architectures, resolution of the separate release compatibility blocker,
extension/runtime compatibility, application/security/startup/migration and
clinical acceptance, and deployment approval remain required. No credentials,
database, live application bootstrap, network, global configuration, commit,
push, merge, deployment, or nested agents were used.


## Release application source repair (2026-10-22)

The release default now fetches the public fork
`https://github.com/craigrallen/openemr.git` at reviewed security candidate
`d2b5e698299fa2c6597da7561aa7083d42f1c575`. Local Git tree inspection confirms
that candidate contains `ccdaservice`. This addresses the source-selection
cause of the controller-reported build blocker; a real build is still required.

`OPENEMR_VERSION` defaults to that full commit and still accepts explicit
branches/tags. Optional `OPENEMR_COMMIT` takes precedence over VERSION and
accepts only a full 40-character lowercase hexadecimal commit ID. Commit
selection initializes a repository, shallow-fetches the exact ID, checks out
FETCH_HEAD detached, and verifies HEAD equals the requested ID before removing
Git metadata. Invalid explicit commits, Git failures, or mismatches stop the
build without fallback. `OPENEMR_GIT` remains a public fork/mirror override.
The revision label reflects the effective selector, including COMMIT overrides.

Argument routing was inspected before edits: the orchestrator passes
release-targets.yml's `openemr_version_ref` to docker-build-release.yml, whose
gated and non-gated builds both pass `OPENEMR_VERSION` with docker/release as
context. The selectors are declared in base and inherited by openemr-source
and final. Existing workflows explicitly select branches/tags (including
master), so those builds override the default pin; the optional COMMIT argument
is available to direct Docker builds, not newly wired into workflow dispatch.
Workflows also retain their existing upstream-only execution and metadata
lookup behavior. No workflow or release-target data was changed.

`evidence/TECH-83-release-red.txt` records the pre-fix regression run: 17 test
methods, 19 failing assertions/subtests, exit 1; all 11 existing security test
methods passed. `evidence/TECH-83-release-green.txt` records 17 passing methods,
exit 0, after the fix and additional mirror/commit-label assertions. Both
`python3 -B` and Apple `/usr/bin/python3 -B` passed the existing security-suite
command above, with no skips. New tests run the shipped source shell using
inert Git/removal doubles: default fork/pin, branch/tag overrides, full commit
and repository overrides, invalid commits, Git failures, and HEAD mismatch.
These are offline control-flow tests, not Git transport or Docker build proof.
Hadolint and git diff --check passed. Source preservation checks confirm all
Dockerfile content outside source selection and the revision label is unchanged,
including PHP engine checks, CQM/CCDA dependency/build/copy steps and runtime.

No network fetch, real image build, application/DB/mail/cron bootstrap,
credential/config/environment-file read, authentication probe, nested agent,
commit, push, deployment, publication, or new Jira ticket was performed.
Independent review, real builds, functionality acceptance and publication
remain with the controller; this follow-up does not declare all TECH-83
production acceptance gates complete.
