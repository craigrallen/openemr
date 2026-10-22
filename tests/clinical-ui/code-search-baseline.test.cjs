'use strict';

/*
 * Dynamic code finder popup baseline guards. Mandatory for local source
 * verification and never skipped: without the base commit in git history
 * every test here fails.
 *
 *   node --test tests/clinical-ui/code-search-baseline.test.cjs
 *
 * The base route, AJAX endpoint, callers, shared popup engine, themes and
 * asset helper are read as raw git blobs at BASE_COMMIT and compared
 * byte-for-byte as strings (no hashing). History-independent guards live in
 * code-search.test.cjs.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const {
    root, ROUTE, AJAX, CALLERS, HELPER, SHEET, SHEET_NAME, BASELINE_SUPPORTED, ANCHORS, MUTATIONS,
    PRESENTATION_MUTATIONS, changes, read, count, restore, supportedList,
} = require('./code-search-support.cjs');

const BASE_COMMIT = '18647270e0c799189d2dc10f801e8de2bff1a360';
// Throws (and so fails the test) when the commit or path is unavailable.
const base = file => execFileSync('git', ['show', `${BASE_COMMIT}:${file}`], {
    cwd: root, maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'pipe'],
}).toString('utf8');
const same = (actual, expected, message) => assert.ok(actual === expected, message);

test('base commit is readable (history is required, not optional)', () => {
    assert.ok(base(ROUTE).length > 0);
});

test('route: inverting the declared presentation edits restores the ENTIRE base route', () => {
    const original = base(ROUTE);
    for (const [before, after] of changes) {
        assert.equal(count(original, before), 1, `anchor not unique in base: ${before}`);
        assert.equal(count(original, after), 0);
    }
    for (const [anchor, times] of ANCHORS) assert.equal(count(original, anchor), times, `anchor count differs in base: ${anchor}`);
    const restored = restore(read(ROUTE));
    assert.notEqual(restored, null, 'a declared presentation edit is missing or ambiguous');
    same(restored, original, 'route differs from the base outside the declared presentation edits');
});

test('route: every business, presentation and stray mutation breaks exact restoration', () => {
    const php = read(ROUTE);
    const original = base(ROUTE);
    for (const [from, to] of [...MUTATIONS, ...PRESENTATION_MUTATIONS]) {
        assert.equal(count(php, from), 1, `mutation anchor not unique: ${from}`);
        assert.ok(restore(php.replace(from, () => to)) !== original, `mutation survived: ${from}`);
    }
    const strays = [
        ["<th><?php echo xlt('Code'); ?></th>", "<th class=\"oe-extra\"><?php echo xlt('Code'); ?></th>"],
        ['// TODO: Make more intuitive', '// TODO: Make more intuitive.'],
        ['</html>\n', '</html>'],
    ];
    for (const [from, to] of strays) {
        assert.equal(count(php, from), 1, `stray anchor not unique: ${from}`);
        assert.ok(restore(php.replace(from, () => to)) !== original, `stray survived: ${to}`);
    }
});

test('AJAX endpoint, callers, popup engine, dialog and themes are byte-identical to the base', () => {
    const pinned = [
        AJAX,
        ...Object.keys(CALLERS),
        'interface/patient_file/encounter/select_codes.php',
        'interface/clinical-workspace/popup.css',
        'interface/clinical-workspace/popup.js',
        'interface/clinical-workspace/workspace.css',
        'library/dialog.js',
        'custom/code_types.inc.php',
        'src/Core/Header.php',
        'config/config.yaml',
        'interface/themes/theme-defaults.scss',
        'interface/themes/colors/utilities/bootstrap.scss',
        'interface/themes/oe-styles/style_dark.scss',
        'interface/themes/oe-styles/style_solar.scss',
        'interface/themes/oe-styles/style_light.scss',
        'interface/themes/oe-styles/style_manila.scss',
    ];
    for (const file of pinned) same(read(file), base(file), `changed: ${file}`);

    const listing = base('interface/clinical-workspace/').split('\n').slice(1).map(s => s.trim()).filter(Boolean);
    assert.ok(listing.includes('popup.css') && listing.includes('popup.js'));
    for (const name of listing) {
        const file = `interface/clinical-workspace/${name}`;
        same(read(file), base(file), `changed: ${file}`);
    }
    const now = fs.readdirSync(path.join(root, 'interface/clinical-workspace'));
    assert.deepEqual(now.filter(name => !listing.includes(name)), [path.basename(SHEET)]);
});

test('asset helper: exactly one allowlist line added, nothing else changed', () => {
    const entry = `        '${SHEET_NAME}',\n`;
    const php = read(HELPER);
    assert.equal(count(php, entry), 1);
    same(php.replace(entry, () => ''), base(HELPER), 'helper changed beyond the allowlist entry');
    assert.deepEqual(supportedList(base(HELPER)), BASELINE_SUPPORTED);
});
