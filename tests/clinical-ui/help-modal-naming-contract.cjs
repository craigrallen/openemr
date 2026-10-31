'use strict';

// Source-only contract. PHP and browser code are read as text and never executed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const original = fs.readFileSync(path.join(__dirname, 'fixtures/help-modal-naming-original.php.txt'));
const actual = fs.readFileSync(path.join(root, 'interface/help_modal.php'));

const binding = '$help = xla("Help");\n';
const printBinding = '$print = xla("Print");\n';
const oldDialogName = 'aria-labelledby="myModalLabel"';
const newDialogName = 'aria-label="$help"';
const oldIframe = 'id="targetiframe" class="border-0 h-100 w-100"';
const newIframe = 'id="targetiframe" title="$help" class="border-0 h-100 w-100"';

function replaceOne(source, before, after, label) {
    assert.equal(source.split(before).length - 1, 1, `${label}: expected exactly one occurrence`);
    return source.replace(before, after);
}

function proposedSource() {
    let source = original.toString('utf8');
    source = replaceOne(source, printBinding, printBinding + binding, 'Help binding insertion point');
    source = replaceOne(source, oldDialogName, newDialogName, 'dialog naming replacement');
    return replaceOne(source, oldIframe, newIframe, 'iframe title insertion point');
}

function assertBinding(source) {
    assert.equal(source.split(binding).length - 1, 1, 'one attribute-escaped Help binding is required');
    assert.match(source, /\$help\s*=\s*xla\("Help"\);/, 'Help must use xla for attribute escaping');
}

function assertDialogName(source) {
    assert.match(source, /<div class="modal fade" id="myModal"[^>]*\saria-label="\$help"[^>]*>/, 'dialog needs a quoted translated name');
}

function assertIframeTitle(source) {
    assert.match(source, /<iframe\s[^>]*id="targetiframe"[^>]*\stitle="\$help"[^>]*><\/iframe>/, 'existing iframe needs a quoted translated title');
}

function assertNames(source) {
    assertBinding(source);
    assertDialogName(source);
    assertIframeTitle(source);
    assertNoDanglingLabel(source);
}

function assertNoDanglingLabel(source) {
    assert.ok(!source.includes(oldDialogName), 'dangling dialog label reference remains');
}

function assertExactInverse(source) {
    let restored = source;
    restored = replaceOne(restored, binding, '', 'Help binding');
    restored = replaceOne(restored, newDialogName, oldDialogName, 'dialog name');
    restored = replaceOne(restored, newIframe, oldIframe, 'iframe title');
    assert.deepEqual(Buffer.from(restored, 'utf8'), original,
        'inverse of only the three approved changes must reproduce every original byte');
}

function assertNoNewIds(source) {
    const ids = (text) => [...text.matchAll(/\bid="([^"]*)"/g)].map((match) => match[1]);
    assert.deepEqual(ids(source), ids(original.toString('utf8')), 'IDs must be unchanged');
}

function rejectMutation(label, mutate, guard) {
    const changed = mutate(proposedSource());
    assert.notEqual(changed, proposedSource(), `${label}: mutation did not change the source`);
    assert.throws(() => guard(changed), undefined, `${label}: guard accepted mutation`);
}

const cases = [
    ['fixture is the complete unchanged native source', () => {
        assert.match(original.toString('utf8'), /^<\?php\n/);
        assert.match(original.toString('utf8'), /<\/script>\n$/);
        assert.match(original.toString('utf8'), /require_once\('globals.php'\)/);
        assert.match(original.toString('utf8'), /helpFilePath = '<\?php echo "\$webroot\/Documentation\/help_files\/"\?>'/);
    }],
    ['approved synthetic change has an exact original inverse', () => assertExactInverse(proposedSource())],
    ['approved synthetic change has safe quoted names', () => assertNames(proposedSource())],
    ['native source has the exact original inverse', () => assertExactInverse(actual.toString('utf8'))],
    ['native source binds attribute-escaped Help', () => assertBinding(actual.toString('utf8'))],
    ['native dialog has a quoted translated name', () => assertDialogName(actual.toString('utf8'))],
    ['native iframe has a quoted translated title', () => assertIframeTitle(actual.toString('utf8'))],
    ['native dialog has no dangling label reference', () => assertNoDanglingLabel(actual.toString('utf8'))],
    ['native source has no new IDs', () => assertNoNewIds(actual.toString('utf8'))],
    ['script mutation is rejected by inverse', () => rejectMutation('script', (s) => s.replace(".addClass('drag-action')", ".addClass('drag-changed')"), assertExactInverse)],
    ['close action mutation is rejected by inverse', () => rejectMutation('close action', (s) => s.replace('data-dismiss="modal"', 'data-dismiss="changed"'), assertExactInverse)],
    ['session/global mutation is rejected by inverse', () => rejectMutation('globals', (s) => s.replace("require_once('globals.php')", "require_once('changed.php')"), assertExactInverse)],
    ['help URL mutation is rejected by inverse', () => rejectMutation('URL', (s) => s.replace('Documentation/help_files/', 'Documentation/changed/'), assertExactInverse)],
    ['removed dialog name is rejected', () => rejectMutation('dialog name', (s) => s.replace(newDialogName, ''), assertNames)],
    ['unquoted iframe title is rejected', () => rejectMutation('iframe title', (s) => s.replace('title="$help"', 'title=$help'), assertNames)],
    ['non-attribute-safe translation is rejected', () => rejectMutation('translation', (s) => s.replace(binding, '$help = xlt("Help");\n'), assertNames)],
];

const EXPECTED_COUNT = 16;

function runContract() {
    return cases.map(([name, check]) => {
        try {
            check();
            return { name, status: 'passed' };
        } catch (error) {
            return { name, status: 'failed', error: error.message };
        }
    });
}

module.exports = { EXPECTED_COUNT, runContract };

if (require.main === module) {
    const results = runContract();
    for (const result of results) {
        process.stdout.write(`${result.status.toUpperCase()} ${result.name}${result.error ? `: ${result.error}` : ''}\n`);
    }
    const failed = results.filter((result) => result.status === 'failed').length;
    process.stdout.write(`${results.length} cases; ${failed} failed\n`);
    if (results.length !== EXPECTED_COUNT || failed) process.exitCode = 1;
}
