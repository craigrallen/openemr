# CCDA preview single read (OPEMR-192)

## Scope

`EncountermanagerController::previewDocumentAction()` now passes the content from its first `Document::get_data()` call to `CcdaUserPreferencesTransformer::transform()`. The first read remains after the existing access and deleted checks, and the empty-content check still runs before transformation. The only product change removes the second `get_data()` call. The original four failures support this retrieval fix; they do not establish full side-by-side delivery.

## RED and GREEN evidence

At tests-only HEAD `634b5955c7dddb6c956c6aa90073a1ce7197a977`, the standalone synthetic PHP test produced `cases=9 passed=5 failed=4` before the controller edit. The four failures covered a hypothetical empty second value, different second bytes, a second-read exception, and replacement of non-ASCII first bytes. The controller-managed RED record is `controller-red.log` under `/Users/craig/.hermes/projects/openemr/verification/ccda-preview-single-read-20261031/`.

After the edit, the standalone PHP test produced `cases=9 passed=9 failed=0`. `php -l` passed for the controller and standalone PHP test, `node --check` passed for `tests/js/ccda-preview-single-read.test.js`, and `git diff --check` passed. At that historical GREEN run, the test file was named `tests/clinical-ui/ccda-preview-single-read.php`.

The final standalone command is `php tests/clinical-ui/ccda-preview-single-read.php.fixture`. PHP executes the fixture by explicit path. Its `.fixture` suffix keeps the synthetic declarations outside default `.php` static discovery, including level-10 PHPStan scanning; the Jest adapter invokes the same path.

## Test seam and limits

The standalone PHP test loads the complete native controller file. It bypasses the controller constructor with reflection and supplies fully synthetic boundary doubles for the document, request, Twig, response, terminator, configuration, transformer, and logger. It does not construct a real app `Document`, bootstrap OpenEMR, access storage, or use patient or clinical documents.

The synthetic transformer records the exact content and throws a sentinel before stylesheet lookup. Therefore the test does not exercise successful XSL transformation, rendering, or delivery. Its synthetic `RequestTerminator` throws a marker that reaches the controller's existing catch block; that observed generic output and log are specific to the test double, unlike the real terminator's response behavior. The access-denied, deleted, and empty-content paths are preserved in this test, but this is not a security proof.

`tests/js/ccda-preview-single-read.test.js` is a Jest adapter that starts the PHP test. The hosted JS workflow at `.github/workflows/js-test.yml` sets up Node and runs `npm ci` and `npm run test:js-coverage`; it does not explicitly install or verify PHP. Its ability to run this adapter depends on PHP being available on the runner. No hosted CI result is claimed here.

Ordinary approval, full hosted CI, authenticated persistence and roles, successful XSL output, and full clinical UI acceptance remain separate gates. This phase did not run PHPUnit or alternate denied tests, including the OPEMR-186 PHPUnit runtime path. It did not repeat the denied OPEMR-190 Git action. No merge, deployment, or other Git write is part of this phase.
