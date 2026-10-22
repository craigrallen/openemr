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
Package/forge availability is unverified: these builds intentionally fail if the
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
python3 -m unittest discover -s tests/ci -p test_php_runtime_security.py -v
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
