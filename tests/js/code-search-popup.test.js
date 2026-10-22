/** @jest-environment node */

/*
 * Dynamic code finder popup: portable wrapper. Dependency-free; runs under
 * `node --test` (node:test) and, when the Jest runner supplies a global
 * `test`, under that runner unchanged. Needs no git history.
 *
 *   node --test tests/js/code-search-popup.test.js
 *
 * Not proved here: native geometry, rendered contrast, keyboard use, real
 * DataTables AJAX or a real selection reaching an opener.
 */

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const test = globalThis.test ?? require('node:test').test;
const {
    root, ROUTE, SHEET, SCOPE, read, exists, count, parseCss, walkRules,
} = require('../clinical-ui/code-search-support.cjs');

// Hosted Jest runs only tests/js, so it delegates the portable (history-free)
// suite to node:test here. The baseline suite needs git history and is never
// run from Jest. Under `node --test` the portable suite is run directly instead.
if (typeof jest !== 'undefined') {
    test('portable code search suite passes under node:test', () => {
        try {
            execFileSync(process.execPath, ['--test', 'tests/clinical-ui/code-search.test.cjs'], {
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

test('route keeps the CSRF AJAX source, single-selection promise and opener callbacks', () => {
    const php = read(ROUTE);
    assert.equal(count(php, '"sAjaxSource": "find_code_dynamic_ajax.php?csrf_token_form=" + <?php echo js_url(CsrfUtils::collectCsrfToken(session: $session)); ?>,'), 1);
    assert.equal(count(php, 'opener.promiseData = JSON.stringify({codetype, code, selector, codedesc});'), 1);
    for (const callback of ['opener.set_related_target(', 'opener.set_related(', 'opener.del_related(', 'opener.SetField(', 'opener.SetList(', 'opener.MoveFields(']) {
        assert.equal(count(php, callback), 1, callback);
    }
    assert.equal(count(php, '<body id="codes_search" class="oe-code-search-popup">'), 1);
});

test('sheet never reaches the opener, the dialog frame, DataTables wrappers or the shared context scope', () => {
    assert.ok(exists(SHEET), `${SHEET} is missing`);
    const selectors = walkRules(parseCss(read(SHEET))).flatMap(r => r.selectors);
    assert.ok(selectors.length > 0);
    for (const selector of selectors) {
        assert.ok(selector === SCOPE || selector.startsWith(`${SCOPE} `), `unscoped selector: ${selector}`);
        assert.doesNotMatch(selector, /dialogModal|modal|iframe|workbench-active|oe-workbench-context|table-responsive|dataTables_wrapper/);
    }
});
