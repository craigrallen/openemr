# OPEMR-23 patient XML import popup: phase two source palette and focus

This is a bounded, partial presentation change for the existing patient demographics XML import popup. The screen stylesheet adds workbench palette colors to the body, sheet, and textarea, plus visible focus outlines for the textarea and existing Import and Cancel buttons. It applies only within `html.oe-workbench-context` on screen. The `btn-secondary` Import and `btn-link` Cancel palettes remain inherited from the active theme; the `btn-link` contrast in particular requires a compiled theme check. The stylesheet does not set geometry, fonts, wrappers, or button colors.

## Source contract and preservation

- `custom/import_xml.php` adds the asset helper import, one escaped and versioned screen stylesheet link, and one class each on the existing body and container. All other original route bytes, including the form, onload focus, POST handler, response branch, and Import and Cancel behavior, are preserved by the tests-first exact forward and inverse contract.
- `src/Common/Assets/ClinicalWorkspaceAssets.php` adds only the sorted `patient-xml-import-popup.css` allowlist entry, so the existing per-file version helper can version the new sheet.
- `interface/clinical-workspace/patient-xml-import-popup.css` contains exactly five ordered rules in one `@media screen` context. The body background alone is important. The textarea base and focus colors are paired. Homogeneous `:focus` and `:focus-visible` outline groups cover the field and both buttons separately.
- `tests/js/patient-xml-import-popup.test.js` and `tests/clinical-ui/fixtures/patient-xml-import-popup-original.txt` are frozen and unchanged. The original route and helper fixture baseline was independently byte-compared with `master` by Hermes before implementation. This repository targets `master`, not `main`.

The parser, XML maps, CSRF, ACL, session handling, patient-scope checks, and multiple existing writes are untouched. Source equality establishes only the bounded source contract. It does not establish security clearance, transactionality, clinical acceptance, or absence of partial writes.

## Gate state

The tests-first contract was published at `ad195be9912ca0034924c60e9576ac7f48fc71bf` in draft PR 97. Hosted JS run `39019005681` was genuinely red on exactly the three actual-source missing-production tests; synthetic and negative tests passed. Independent Gemini4ArgonHigh review of all six files found no introduced P1/P2. The controller has since passed PHP syntax checks on the route and helper, full route and helper inverse checks against `origin/master`, and actual nonignored CSS stylelint on one source with zero warnings. Hosted GREEN and full exact-head gates remain pending. No local Node, Jest, history, cache, hash, PHPUnit, bootstrap, browser, application, HTTP, database, or import execution was used for this phase.

This is allocation run 1 of at most 2, independently rotated from PR 96. Older gates remain in force. All 22, demo, exhaustive popup, and Swedish work remain unfinished. Draft PR 97 requires ordinary approval; there is no merge bypass.

## Unverified acceptance work

- Activate the actual PHP route inside the workbench and verify the linked asset loads in the popup.
- Inspect compiled default, dark, and solar themes: textarea base and focus color contrast, Import and Cancel contrast, including the theme-inherited `btn-link`, and focus outline visibility and clipping.
- Check initial and resized narrow presentation: `dlgopen` uses the `modal-mlg` WIDTH class and an initial 500px HEIGHT; `sizeHeight: 'auto'` is subject to the viewport cap. Native fit has not been established.
- Check RTL, translations, print behavior, and roles in the rendered application.
- Exercise real Import and Cancel behavior and opener refresh, plus invalid XML, partial writes, and patient-scope behavior in an authorized controlled environment.

No live GET or POST, database or clinical data operation, national or vendor system, or deployment is evidenced by this source change.
