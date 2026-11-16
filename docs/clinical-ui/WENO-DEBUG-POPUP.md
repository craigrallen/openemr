# OPEMR-252 — Weno debug popup label containment

Owner: Hermes controller. Allocation **1/max2 consecutive scheduled delivery runs INCLUDING implementation AND QA**, independently rotated from OPEMR-251/PR308. Internal author/implementation/review phases are not additional scheduled runs. After the budget, select a different independent implementation; unchanged QA polling is not delivery.

## Bounded change

`interface/modules/custom_modules/oe-module-weno/templates/indexrx.php` retains its real show callers and original modal, controls, translations and all PHP/JavaScript. One style block immediately before `</head>` scopes layout to screen, `html.oe-workbench-context` and `#debugModal`. The title can shrink and wrap beside the nonshrinking close control; body and download/footer labels wrap within bounded widths. Footer width accounts for its existing horizontal button margins. No new palette, font, outline or focus selectors are added. Existing theme cascades remain; this is not effective contrast acceptance or the full researched redesign.

The original fixture at `tests/clinical-ui/fixtures/weno-debug-popup-original.php.txt` has SHA-256 `4210b1ff293577a7a63d72ad62fa41ffcd603a382e9ddbf40157fa8977c3ae86`. The live inverse removes only the complete exact added block at its approved position and demands original byte equality and that digest. Duplicate/moved styles and unrelated PHP/JS/iframe/download/translation edits fail preservation. Separate semantic mutations must fail without relying on the preservation oracle. Unchanged debug fields are retained, not security-cleared.

## Executed and outstanding verification

Coding-CLI tests-only authorship preceded product. Controller corrected two nonunique mutation anchors before committing tests: the original proposal reported 23 passes/4 failures, including two harness-anchor failures, not four product regressions. Tests-only `3d997c93` then produced genuine RED: 27 cases, 25 passes and two live layout/inverse failures with empty stderr. A separate wrapped implementation proposed the exact style insertion only after that RED. Controller GREEN: 27/27, empty stderr; PHP and JavaScript syntax plus diff checks pass. The real Jest adapter is syntax-checked locally; local Jest/emulation is not authorized, so its execution remains a hosted gate.

Scripts-disabled Chrome source-derived fixture completed 60 unique five-theme/three-width/two-direction/ordinary-or-long-label cells: 30 baseline cells overflowed, zero candidate cells overflowed. All 180 actual Tab-center checks passed. Another 180 complete original-body DOM/computed-style/geometry comparisons passed in inactive screen and both print activation states. No network requests or page errors occurred. Synthetic PHP labels, filename hash and inert href simulate focusability after generated download assignment; no action was clicked. These are historical compiled themes with fonts/remote resources disabled, forced direction rather than a translated RTL theme, and deterministic animation settling. They do not prove font fidelity, full focus/contrast, native modal lifecycle, assistive technology, print preview or clinical acceptance.

Independent complete frozen-content review and hosted checks are required separately; this document does not invent their outcomes. Ordinary approval and authenticated native accessibility/modal/keyboard/roles/security/persistence/clinical acceptance remain open. No merge or deployment is implied. Original 22 features, exhaustive popup/demo coverage and Swedish programme remain open.

## Safety boundaries

No PHP route/bootstrap, SQL, HTTP, vendor iframe, provider/eRx action, debug generation, logging, download or support communication was executed as UI QA. No local Jest/emulation/PHPUnit/PHPStan/install. Historical denied-action boundaries, including Swedish clone/publication/installation and root NEXT-WORK/STATUS writes, remain parked. No direct master writes, clinical go-live, real patients, national integration, vendor contact, cron changes or audit-reviewer restart.
