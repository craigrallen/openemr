'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const repo = path.resolve(__dirname, '../..');
const sourcePath = path.join(repo, 'interface/billing/sl_eob_search.php');
const fixturePath = path.join(__dirname, 'fixtures/billing-search-spinner-original.php.txt');
const originalHash = '3e520de0689f34bed847cb8015ea0b9ac7db4872c08ceab1ffd40b3638dbe273';
const originalHeading = "<h5 class=\"mt-3\"><?php echo xlt('Searching...'); ?></h5>";
const correctedHeading = "<h5 class=\"mt-3\" id=\"searchSpinnerModalLabel\"><?php echo xlt('Searching...'); ?></h5>";
const modalStart = '<div class="modal fade" id="searchSpinnerModal"';
const modalEnd = '\n<script>';
const launcher = "if (buttonName === 'form_search' ||\n                    clickedButton.attr('id') === 'btn-inv-search') {\n                    $('#searchSpinnerModal').modal('show');\n                }";
const cases = [];

function count(source, fragment) {
    return source.split(fragment).length - 1;
}

function sha256(source) {
    return crypto.createHash('sha256').update(source).digest('hex');
}

function modal(source) {
    const start = source.indexOf(modalStart);
    if (start < 0 || source.indexOf(modalStart, start + 1) !== -1) {
        return null;
    }
    const end = source.indexOf(modalEnd, start);
    return end < 0 ? null : source.slice(start, end);
}

function actualLabelIdCount(source) {
    return [...source.matchAll(/(?:^|[\s<])id=(['"])searchSpinnerModalLabel\1/g)].length;
}

function semantics(source) {
    const body = modal(source);
    return {
        launcher: source.includes(launcher),
        root: body !== null && body.startsWith('<div class="modal fade" id="searchSpinnerModal" data-backdrop="static" data-keyboard="false" tabindex="-1" role="dialog" aria-labelledby="searchSpinnerModalLabel" aria-hidden="true">'),
        backdrop: body !== null && body.includes('data-backdrop="static"'),
        keyboard: body !== null && body.includes('data-keyboard="false"'),
        status: body !== null && body.includes('<div class="spinner-border text-primary" role="status" style="width: 3rem; height: 3rem;">\n                    <span class="sr-only"><?php echo xlt(\'Loading...\'); ?></span>'),
        heading: count(source, correctedHeading) === 1 && count(source, originalHeading) === 0,
        linkage: body !== null && body.includes(correctedHeading) && actualLabelIdCount(source) === 1
    };
}

function semanticPasses(source) {
    return Object.values(semantics(source)).every(Boolean);
}

function preserved(source) {
    if (count(source, correctedHeading) !== 1 || count(source, originalHeading) !== 0) {
        return false;
    }
    return sha256(source.replace(correctedHeading, originalHeading)) === originalHash;
}

function check(name, action) {
    try {
        action();
        cases.push({ name, ok: true });
    } catch (_) {
        cases.push({ name, ok: false });
    }
}

let original;
let live;
try {
    original = fs.readFileSync(fixturePath, 'utf8');
} catch (_) {
    original = null;
}
try {
    live = fs.readFileSync(sourcePath, 'utf8');
} catch (_) {
    live = null;
}

function requireOriginal() {
    assert.notEqual(original, null);
    assert.equal(sha256(original), originalHash);
    return original;
}

function requireLive() {
    assert.notEqual(live, null);
    return live;
}

function correctedOriginal() {
    const source = requireOriginal();
    assert.equal(count(source, originalHeading), 1);
    return source.replace(originalHeading, correctedHeading);
}

check('fixture pinned SHA-256', () => {
    requireOriginal();
});
check('fixture has exactly one original heading', () => {
    assert.equal(count(requireOriginal(), originalHeading), 1);
});
check('original fixture fails semantic linkage', () => {
    assert.equal(semanticPasses(requireOriginal()), false);
});
check('corrected fixture passes semantics', () => {
    assert.equal(semanticPasses(correctedOriginal()), true);
});
check('corrected fixture preserves all other bytes', () => {
    assert.equal(preserved(correctedOriginal()), true);
});
check('missing aria linkage fails semantics', () => {
    const source = correctedOriginal().replace('aria-labelledby="searchSpinnerModalLabel"', 'aria-labelledby=""');
    assert.equal(semanticPasses(source), false);
});
check('wrong heading target fails semantics', () => {
    const source = correctedOriginal().replace(correctedHeading, originalHeading).replace('<p class="text-muted">', '<p class="text-muted" id="searchSpinnerModalLabel">');
    assert.equal(semanticPasses(source), false);
});
check('duplicate label targets fail semantics', () => {
    const source = correctedOriginal().replace('<p class="text-muted">', '<p class="text-muted" id="searchSpinnerModalLabel">');
    assert.equal(semanticPasses(source), false);
});
check('off-modal label target fails semantics', () => {
    const source = correctedOriginal().replace(correctedHeading, '').replace(modalStart, correctedHeading + '\n' + modalStart);
    assert.equal(count(source, correctedHeading), 1);
    assert.equal(semantics(source).heading, true);
    assert.equal(semantics(source).linkage, false);
    assert.equal(semanticPasses(source), false);
});
check('unrelated native caller edit fails preservation', () => {
    const source = correctedOriginal().replace("$('#searchSpinnerModal').modal('show');", "$('#searchSpinnerModal').modal('hide');");
    assert.equal(preserved(source), false);
});
check('unrelated PHP edit fails preservation', () => {
    const source = correctedOriginal().replace('$DEBUG = 0;', '$DEBUG = 1;');
    assert.equal(preserved(source), false);
});
check('live native launcher unchanged', () => {
    assert.equal(requireOriginal().includes(launcher), true);
    assert.equal(requireLive().includes(launcher), true);
});
check('live modal root role and label', () => {
    assert.equal(semantics(requireLive()).root, true);
});
check('live static backdrop', () => {
    assert.equal(semantics(requireLive()).backdrop, true);
});
check('live keyboard setting', () => {
    assert.equal(semantics(requireLive()).keyboard, true);
});
check('live Loading status text', () => {
    assert.equal(semantics(requireLive()).status, true);
});
check('live translated Searching heading unchanged', () => {
    const source = requireLive();
    assert.equal(count(source, originalHeading) + count(source, correctedHeading), 1);
});
check('live unique heading is contained label target', () => {
    const result = semantics(requireLive());
    assert.equal(result.heading, true);
    assert.equal(result.linkage, true);
});
check('live source has only approved insertion', () => {
    assert.equal(preserved(requireLive()), true);
});

const passed = cases.filter((item) => item.ok).length;
const failed = cases.length - passed;
process.stdout.write(JSON.stringify({ passed, failed, cases }) + '\n');
process.exitCode = failed === 0 ? 0 : 1;
