/** @jest-environment node */

/*
 * Patient tracker status popup: opener and popup-engine contract, as source
 * checks. Dependency-free; runs under `node --test` (node:test) and, when the
 * Jest runner supplies a global `test`, under that runner unchanged.
 *
 *   node --test tests/js/tracker-status-popup.test.js
 *
 * Not proved here: native geometry, rendered contrast, assistive-technology
 * roles, or that a real status submit reaches manage_tracker_status().
 */

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const test = globalThis.test ?? require('node:test').test;
const {
    root, ROUTE, CALLER, SHEET, SCOPE, BODY_CLASS, read, exists, count, parseCss, walkRules,
} = require('../clinical-ui/tracker-status-support.cjs');

// Hosted Jest runs only tests/js, so it delegates the portable (history-free)
// suite to node:test here. The baseline suite needs git history and is never
// run from Jest. Under `node --test` the portable suite is run directly instead.
if (typeof jest !== 'undefined') {
    test('portable tracker status suite passes under node:test', () => {
        try {
            execFileSync(process.execPath, ['--test', 'tests/clinical-ui/tracker-status.test.cjs'], {
                cwd: root,
                encoding: 'utf8',
                stdio: 'pipe',
                timeout: 120000,
            });
        } catch (error) {
            assert.fail(`portable suite failed:\n${error.stdout ?? ''}${error.stderr ?? ''}`);
        }
    }, 130000);
}

test('popup engine marks <html> only, so the sheet scope is the genuine-popup marker', () => {
    const engine = read('interface/clinical-workspace/popup.js');
    assert.ok(engine.includes("const POPUP_CLASS = 'oe-workbench-popup';"));
    assert.ok(engine.includes('html.classList.add(name);'));
    assert.doesNotMatch(engine, /body\.classList\.(add|toggle)\(/);
    const config = read('config/config.yaml');
    assert.ok(config.includes("  workbench-popup:\n    basePath: '%webroot%/interface/clinical-workspace/'\n    script: popup.js\n    link: popup.css\n    autoload: true"));
});

test('route keeps the opener refresh, dlgclose and in-form submit contract', () => {
    const php = read(ROUTE);
    assert.equal(count(php, "Header::setupHeader(['common','opener']);"), 1);
    assert.equal(count(php, String.raw`echo " window.opener.document.flb.submit();\n";`), 1);
    assert.equal(count(php, String.raw`echo " dlgclose();\n";`), 1);
    assert.equal(count(php, 'onclick="dlgclose();"'), 1);
    assert.equal(count(php, `onclick='document.getElementById("form_note").submit();'`), 1);
    assert.equal(count(php, '<form id="form_note" method="post"'), 1);
    // The echoed POST response body stays unclassed: the sheet only styles the rendered form.
    assert.equal(count(php, String.raw`echo "<body>\n<script>\n";`), 1);
    assert.equal(count(php, `<body class="${BODY_CLASS}">`), 1);
    const caller = read(CALLER);
    assert.equal(count(caller, 'function bpopup(tkid) {'), 1);
    assert.equal(count(caller, "dlgopen('../patient_tracker/patient_tracker_status.php?tracker_id=' + encodeURIComponent(tkid) + '&csrf_token_form=' + <?php echo js_url(CsrfUtils::collectCsrfToken($session)); ?>, '_blank', 500, 250);"), 1);
});

test('sheet never reaches the opener, the dialog frame or the shared context scope', () => {
    assert.ok(exists(SHEET), `${SHEET} is missing`);
    const selectors = walkRules(parseCss(read(SHEET))).flatMap(r => r.selectors);
    assert.ok(selectors.length > 0);
    for (const selector of selectors) {
        assert.ok(selector === SCOPE || selector.startsWith(`${SCOPE} `), `unscoped selector: ${selector}`);
        assert.doesNotMatch(selector, /dialogModal|modal|iframe|workbench-active|oe-workbench-context|#flb|\[name=['"]?flb/);
    }
});
