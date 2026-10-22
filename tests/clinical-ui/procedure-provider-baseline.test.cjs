'use strict';

/*
 * Procedure provider editor baseline guards. Mandatory for local source
 * verification and never skipped: without the base commit in git history
 * every test here fails.
 *
 *   node --test tests/clinical-ui/procedure-provider-baseline.test.cjs
 *
 * The base route, caller, shared popup engine and themes are read as raw git
 * blobs at BASE_COMMIT and compared byte-for-byte as strings (no hashing).
 * History-independent guards live in procedure-provider.test.cjs.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const {
    root, ROUTE, CALLER, HELPER, SHEET, SHEET_NAME, BASELINE_SUPPORTED, ANCHORS, MUTATIONS, PRESENTATION_MUTATIONS,
    changes, read, count, restore, supportedList,
} = require('./procedure-provider-support.cjs');

const BASE_COMMIT = '18647270';
const base = file => execFileSync('git', ['show', `${BASE_COMMIT}:${file}`], { cwd: root, maxBuffer: 1 << 26 }).toString('utf8');
const same = (actual, expected, message) => assert.ok(actual === expected, message);

test('base commit is readable (history is required, not optional)', () => {
    assert.ok(base(ROUTE).length > 0);
});

test('route: inverting the declared presentation edits restores the exact base route', () => {
    const original = base(ROUTE);
    for (const [before, after] of changes) {
        assert.equal(count(original, before), 1, `anchor not unique in base: ${before}`);
        assert.equal(count(original, after), 0);
    }
    const restored = restore(read(ROUTE));
    assert.notEqual(restored, null, 'a declared presentation edit is missing or ambiguous');
    same(restored, original, 'route differs from the base outside the declared presentation edits');
});

test('route: the portable anchors are faithful copies of the base route', () => {
    const original = base(ROUTE);
    for (const anchor of ANCHORS) assert.equal(count(original, anchor), 1, `anchor not in base exactly once: ${anchor}`);
});

test('route: every ACL, SQL, CSRF, credential, control, callback and font mutation breaks restoration', () => {
    const php = read(ROUTE);
    const original = base(ROUTE);
    for (const [from, to] of [...MUTATIONS, ...PRESENTATION_MUTATIONS]) {
        assert.equal(count(php, from), 1, `mutation anchor not unique: ${from}`);
        const restored = restore(php.replace(from, () => to));
        assert.ok(restored !== original, `mutation survived: ${from}`);
    }
    const stray = restore(php.replace("id='form_remote_host'", () => "id='form_remote_host' class='oe-extra'"));
    assert.ok(stray !== original, 'stray attribute survived');
});

test('caller, shared popup engine and themes are byte-identical to the base', () => {
    const pinned = [
        CALLER,
        'interface/clinical-workspace/popup.css',
        'interface/clinical-workspace/popup.js',
        'library/dialog.js',
        'src/Core/Header.php',
        'config/config.yaml',
        'interface/themes/theme-defaults.scss',
        'interface/themes/oe-styles/style_dark.scss',
        'interface/themes/oe-styles/style_solar.scss',
        'interface/themes/oe-styles/style_light.scss',
    ];
    for (const file of pinned) same(read(file), base(file), `changed: ${file}`);
    // The caller still opens this route through dlgopen at 800x750, add and edit.
    assert.equal(count(read(CALLER), "dlgopen(scriptTitle, '_blank', 800, 750, false,"), 2);

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
