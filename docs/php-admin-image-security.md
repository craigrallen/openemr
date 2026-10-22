# TECH-84 PHP admin image pins

This companion change pins only the declared admin sidecar images. No application
runtime pins, Composer/npm locks, app code, ports, environment, security settings,
volumes, ENTRYPOINT or CMD bytes are changed. Commented declarations stay commented.

The controller supplied these immutable references and isolated native PHP CLI
results; this work did not independently build or execute any image:
- Adminer: PHP 8.4.27.
- LinuxServer phpMyAdmin: PHP 8.5.12.
- Official phpMyAdmin: PHP 8.3.36.

Exact references and original image declarations are in
`scripts/check_php_admin_images.py`. LinuxServer and official vendor families
remain distinct; the deprecated `phpmyadmin/phpmyadmin` alias, where present,
becomes the official `phpmyadmin` image.

Run with Python 3.9+ and no dependencies:
```sh
python3 -B scripts/test_php_admin_images.py
python3 -B scripts/check_php_admin_images.py
git diff --check
```
Tests reject missing, old, floating, wrong-family, wrong-digest and duplicate
declarations and accept the declared pins. The inverse test restores only the
original image lines and compares SHA-256 with the real clean baseline captured
before editing. Baseline commit: 18647270e0c799189d2dc10f801e8de2bff1a360.
It deliberately fails if any other bytes in these scoped files change; legitimate
future edits require separately reviewing and refreshing that baseline evidence.
The guard checks exact declaration positions and spelling, including commented
examples, without loading YAML, dotenv, credentials or application configuration.
Actual RED and GREEN command receipts are in `evidence/TECH-84-red.txt` and
`evidence/TECH-84-green.txt`.

An immutable image is not configured-application or deployed-target acceptance.
Rebuilding derived images or moving from a previous/default `latest` image may
change the vendor application version even when the PHP version is acceptable.
The controller/operator must independently verify image provenance, target
architecture, vendor application version and compatibility, backups and restore,
configuration, and staged rollout/rollback before accepting any target.
No image entrypoint, application, real database login or live target ran here.
No live target is claimed patched. Review, builds, native checks, commits, PRs
and rollout belong to the controller.

## OpenEMR acceptance gate

The previous image was phpMyAdmin 5.2.3 with digest
`7ebeef41095cbe071a00e3c85c8b44309f110eee546c7b3a6d1fcfe259d58e59`.
This uses the controller-supplied official `latest@sha256` reference. Its
phpMyAdmin application version was not supplied or verified here. Preserve 5.x
compatibility as an operator acceptance requirement: confirm the actual version
and accept any change from 5.2.3 before rollout. PHP 8.3.36 alone does not prove it.
