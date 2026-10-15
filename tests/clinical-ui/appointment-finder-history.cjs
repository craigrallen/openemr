'use strict';

// Explicit local-history suite: needs the baseline commit in the local object store
// (not shallow-clone safe, not run by the Jest wrapper). Compares against
// `git show <baseline>:<path>` bytes; no content hashes are recorded anywhere.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { test } = require('node:test');
const {
    ROOT, BASELINE_COMMIT, ROUTE, ASSETS, CSS, SHEET, UNCHANGED, CALLER_ANCHORS, ROUTE_ADDITIONS, ROUTE_ANCHORS,
    ROUTE_MUTATIONS, ASSET_ADDITIONS, read, count, reverse,
} = require('./appointment-finder-support.cjs');

const git = args => execFileSync('git', args, { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 });
const showBytes = file => git(['show', `${BASELINE_COMMIT}:${file}`]);
const show = file => showBytes(file).toString('utf8');
const isPresentation = anchor => anchor.includes('oe-appointment-finder-popup') || anchor.includes(SHEET) || anchor === 'media="screen"';

const ALLOWED_CHANGES = [
    ROUTE,
    ASSETS,
    CSS,
    'tests/clinical-ui/appointment-finder-support.cjs',
    'tests/clinical-ui/appointment-finder.cjs',
    'tests/clinical-ui/appointment-finder-history.cjs',
    'tests/js/appointment-finder-popup.test.js',
    'docs/clinical-ui/APPOINTMENT-FINDER-POPUP.md',
];

test('declared originals, business anchors and mutation anchors hold at the baseline', () => {
    const original = show(ROUTE);
    for (const [before] of ROUTE_ADDITIONS) assert.equal(count(original, before), 1, before);
    for (const [anchor, expected] of ROUTE_ANCHORS) assert.equal(count(original, anchor), expected, anchor);
    for (const [, anchor] of ROUTE_MUTATIONS) {
        if (!isPresentation(anchor)) assert.equal(count(original, anchor), 1, anchor);
    }
    assert.equal(count(show(ASSETS), ASSET_ADDITIONS[0][0]), 1);
});

test('full inverse of the route equals the baseline bytes exactly', () => {
    const original = show(ROUTE);
    const current = read(ROUTE);
    assert.notEqual(current, original, 'route must carry the planned additions');
    assert.equal(reverse(current, ROUTE_ADDITIONS), original);
});

for (const [label, anchor, replacement] of ROUTE_MUTATIONS) {
    test(`full inverse rejects route edit: ${label}`, () => {
        const original = show(ROUTE);
        const current = read(ROUTE);
        assert.equal(count(current, anchor), 1, anchor);
        const mutated = current.replace(anchor, () => replacement);
        assert.notEqual(mutated, current);
        let restored = null;
        try {
            restored = reverse(mutated, ROUTE_ADDITIONS);
        } catch {
            restored = null;
        }
        assert.notEqual(restored, original);
    });
}

test('asset allowlist inverse equals the baseline bytes exactly', () => {
    const original = show(ASSETS);
    const current = read(ASSETS);
    assert.notEqual(current, original, 'allowlist must carry the new sheet');
    assert.equal(reverse(current, ASSET_ADDITIONS), original);
});

test('stylesheet is new relative to the baseline', () => {
    assert.throws(() => showBytes(CSS), undefined, 'sheet must not exist at the baseline');
    assert.ok(fs.existsSync(path.join(ROOT, CSS)));
});

test('caller, shared popup frame, theme and engine sources are byte-identical to baseline', () => {
    for (const file of UNCHANGED) {
        assert.ok(fs.readFileSync(path.join(ROOT, file)).equals(showBytes(file)), file);
    }
    for (const [file, anchor, expected] of CALLER_ANCHORS) assert.equal(count(show(file), anchor), expected, `${file}: ${anchor}`);
});

test('working tree differs from the baseline only in the declared slice files', () => {
    const lines = buffer => buffer.toString('utf8').split('\n').filter(Boolean);
    const changed = [
        ...lines(git(['diff', '--name-only', BASELINE_COMMIT, '--'])),
        ...lines(git(['ls-files', '--others', '--exclude-standard'])),
    ];
    const unexpected = [...new Set(changed)].filter(file => !ALLOWED_CHANGES.includes(file));
    assert.deepEqual(unexpected, []);
});
