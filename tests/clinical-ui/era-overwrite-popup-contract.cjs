'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '../..');
const fixturePath = path.join(__dirname, 'fixtures/era-overwrite-popup-original.php.txt');
const livePath = path.join(root, 'interface/billing/era_payments.php');
const originalSha = 'ee867364a11fa9636acd2e2071730b2856470bd333350bf4fab2d5cf7ce5a03b';
const anchor = '    <!-- Overwrite Confirmation Modal -->';
const styleOpen = '    <style id="oe-era-overwrite-layout">';
const addition = [
    styleOpen,
    '    @media screen {',
    '      html.oe-workbench-context #overwriteConfirmModal .modal-title,',
    '      html.oe-workbench-context #overwriteConfirmModal .modal-body {',
    '        overflow-wrap: anywhere;',
    '      }',
    '',
    '      html.oe-workbench-context #overwriteConfirmModal .modal-footer {',
    '        flex-wrap: wrap;',
    '      }',
    '',
    '      html.oe-workbench-context #overwriteConfirmModal .modal-footer > .btn {',
    '        min-width: 0;',
    '        max-width: calc(100% - 0.5rem);',
    '        margin: 0.25rem;',
    '        white-space: normal;',
    '        overflow-wrap: anywhere;',
    '      }',
    '    }',
    '    </style>',
    '',
    ''
].join('\n');

function sha256(value) {
    return crypto.createHash('sha256').update(value).digest('hex');
}

function count(source, needle) {
    return source.split(needle).length - 1;
}

function replaceUnique(source, before, after) {
    assert.equal(count(source, before), 1, `expected one occurrence: ${before}`);
    return source.replace(before, after);
}

function original() {
    return fs.readFileSync(fixturePath, 'utf8');
}

function live() {
    return fs.readFileSync(livePath, 'utf8');
}

function synthetic() {
    return replaceUnique(original(), anchor, addition + anchor);
}

function hasScopedScreenLayout(source) {
    try {
        assert.equal(count(source, styleOpen), 1);
        assert.equal(count(source, anchor), 1);
        const start = source.indexOf(styleOpen);
        const end = source.indexOf(anchor);
        assert.ok(start >= 0 && end > start);
        const style = source.slice(start, end);
        assert.equal(style, addition);
        assert.ok(style.includes('@media screen {'));
        assert.ok(style.includes('html.oe-workbench-context #overwriteConfirmModal .modal-body {'));
        assert.ok(style.includes('html.oe-workbench-context #overwriteConfirmModal .modal-footer > .btn {'));
        assert.ok(style.includes('overflow-wrap: anywhere;'));
        assert.ok(style.includes('flex-wrap: wrap;'));
        assert.ok(style.includes('max-width: calc(100% - 0.5rem);'));
        assert.ok(!/!important|\b(?:color|background|border|outline)\s*:|:focus\b/i.test(style));
        return true;
    } catch {
        return false;
    }
}

function preservesOriginal(source, fixture) {
    if (sha256(fixture) !== originalSha || !hasScopedScreenLayout(source)) {
        return false;
    }
    return sha256(source.replace(addition + anchor, anchor)) === originalSha;
}

function mutate(source, before, after) {
    return replaceUnique(source, before, after);
}

function assertUnchanged(source, needle) {
    assert.ok(original().includes(needle), `fixture lacks: ${needle}`);
    assert.ok(source.includes(needle), `live source lacks: ${needle}`);
}

const cases = [
    ['original fixture SHA authentic', () => assert.equal(sha256(original()), originalSha)],
    ['actual showOverwriteConfirm caller unchanged', () => assertUnchanged(live(), '    <?php if ($showOverwriteConfirm) { ?>\n        $(showOverwriteConfirm);\n    <?php } ?>')],
    ['title accessible linkage role backdrop preserved', () => {
        const source = live();
        assertUnchanged(source, 'id="overwriteConfirmModal" tabindex="-1" role="dialog" aria-labelledby="overwriteConfirmModalLabel" aria-hidden="true" data-backdrop="static" data-keyboard="false"');
        assertUnchanged(source, '<h5 class="modal-title" id="overwriteConfirmModalLabel"><?php echo xlt(\'File Already Exists\'); ?></h5>');
    }],
    ['warning and processed info preserved', () => {
        const source = live();
        assertUnchanged(source, '<p class="text-warning"><strong><?php echo xlt(\'Warning\'); ?>:</strong> <?php echo xlt(\'This file has already been processed.\'); ?></p>');
        assertUnchanged(source, '<p class="text-info"><?php echo xlt(\'This file has not yet been processed.\'); ?></p>');
    }],
    ['escaped pending name and both native actions unchanged', () => {
        const source = live();
        assertUnchanged(source, '<strong><?php echo text($pending_eraname); ?></strong>');
        assertUnchanged(source, 'onclick="cancelOverwrite();"');
        assertUnchanged(source, 'onclick="confirmOverwrite();"');
        assertUnchanged(source, "document.getElementById('confirm_overwrite').value = 'yes';\n        document.forms[0].submit();");
        assertUnchanged(source, "document.getElementById('confirm_overwrite').value = 'no';\n        document.forms[0].submit();");
    }],
    ['live source has scoped screen layout', () => assert.equal(hasScopedScreenLayout(live()), true)],
    ['full live source exact addition inverse matches original SHA', () => assert.equal(preservesOriginal(live(), original()), true)],
    ['synthetic minimal addition passes layout', () => assert.equal(hasScopedScreenLayout(synthetic()), true)],
    ['synthetic minimal addition passes preservation', () => assert.equal(preservesOriginal(synthetic(), original()), true)],
    ['missing screen mutant rejects layout', () => assert.equal(hasScopedScreenLayout(mutate(synthetic(), '@media screen {', '@media print {')), false)],
    ['removed context mutant rejects layout', () => assert.equal(hasScopedScreenLayout(synthetic().replaceAll('html.oe-workbench-context ', 'html ')), false)],
    ['wrong modal scope mutant rejects layout', () => assert.equal(hasScopedScreenLayout(synthetic().replaceAll('#overwriteConfirmModal', '#otherModal')), false)],
    ['missing filename wrap mutant rejects layout', () => assert.equal(hasScopedScreenLayout(mutate(synthetic(), 'html.oe-workbench-context #overwriteConfirmModal .modal-title,\n      html.oe-workbench-context #overwriteConfirmModal .modal-body', 'html.oe-workbench-context #overwriteConfirmModal .modal-title')), false)],
    ['unbounded buttons mutant rejects layout', () => assert.equal(hasScopedScreenLayout(mutate(synthetic(), 'max-width: calc(100% - 0.5rem);', 'max-width: none;')), false)],
    ['no footer wrap mutant rejects layout', () => assert.equal(hasScopedScreenLayout(mutate(synthetic(), 'flex-wrap: wrap;', 'flex-wrap: nowrap;')), false)],
    ['unrelated PHP edit rejects preservation', () => {
        const changed = mutate(synthetic(), 'require_once("../globals.php");', 'require_once("../other-globals.php");');
        assert.equal(hasScopedScreenLayout(changed), true);
        assert.equal(preservesOriginal(changed, original()), false);
    }]
];

function run() {
    const results = cases.map(([name, check]) => {
        try {
            check();
            return { name, ok: true };
        } catch {
            return { name, ok: false };
        }
    });
    const passed = results.filter(result => result.ok).length;
    const failed = results.length - passed;
    process.stdout.write(JSON.stringify({ passed, failed, cases: results }) + '\n');
    if (failed) {
        process.exitCode = 1;
    }
}

module.exports = { hasScopedScreenLayout, preservesOriginal, cases };
if (require.main === module) {
    run();
}
