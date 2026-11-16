'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const fixturePath = path.join(__dirname, 'fixtures/weno-debug-popup-original.php.txt');
const livePath = path.join(root, 'interface/modules/custom_modules/oe-module-weno/templates/indexrx.php');
const originalHash = '4210b1ff293577a7a63d72ad62fa41ffcd603a382e9ddbf40157fa8977c3ae86';
const style = `    <style id="oe-weno-debug-layout">
    @media screen {
      html.oe-workbench-context #debugModal .modal-title {
        min-width: 0;
        overflow-wrap: anywhere;
      }

      html.oe-workbench-context #debugModal .modal-header > .close {
        flex-shrink: 0;
      }

      html.oe-workbench-context #debugModal .modal-body {
        overflow-wrap: anywhere;
      }

      html.oe-workbench-context #debugModal #downloadLink {
        min-width: 0;
        max-width: 100%;
        white-space: normal;
        overflow-wrap: anywhere;
      }

      html.oe-workbench-context #debugModal .modal-footer > .btn {
        min-width: 0;
        max-width: calc(100% - 0.5rem);
        white-space: normal;
        overflow-wrap: anywhere;
      }
    }
    </style>
`;
const expectedRules = new Map([
    ['html.oe-workbench-context #debugModal .modal-title', ['min-width: 0', 'overflow-wrap: anywhere']],
    ['html.oe-workbench-context #debugModal .modal-header > .close', ['flex-shrink: 0']],
    ['html.oe-workbench-context #debugModal .modal-body', ['overflow-wrap: anywhere']],
    ['html.oe-workbench-context #debugModal #downloadLink', ['min-width: 0', 'max-width: 100%', 'white-space: normal', 'overflow-wrap: anywhere']],
    ['html.oe-workbench-context #debugModal .modal-footer > .btn', ['min-width: 0', 'max-width: calc(100% - 0.5rem)', 'white-space: normal', 'overflow-wrap: anywhere']]
]);
const cases = [];
let original;
let candidate;
let live;

function sha256(value) {
    return crypto.createHash('sha256').update(value).digest('hex');
}

function occurrences(value, needle) {
    return value.split(needle).length - 1;
}

function replaceOnce(value, before, after) {
    assert.equal(occurrences(value, before), 1, `mutation anchor must occur once: ${before}`);
    const changed = value.replace(before, after);
    assert.notEqual(changed, value, `mutation must change source: ${before}`);
    return changed;
}

function hasLayoutSemantics(source) {
    const blocks = [...source.matchAll(/<style id="oe-weno-debug-layout">([\s\S]*?)<\/style>/g)];
    if (blocks.length !== 1 || occurrences(source, 'id="oe-weno-debug-layout"') !== 1) {
        return false;
    }
    const body = blocks[0][1].trim();
    const media = /^@media screen\s*\{([\s\S]*)\}$/.exec(body);
    if (!media) {
        return false;
    }
    let remaining = media[1];
    const found = new Map();
    const rule = /^\s*([^{}]+?)\s*\{([^{}]*)\}/;
    while (remaining.trim()) {
        const match = rule.exec(remaining);
        if (!match) {
            return false;
        }
        const selector = match[1].trim();
        const declarations = match[2].split(';').map((part) => part.trim()).filter(Boolean);
        if (found.has(selector) || declarations.some((part) => !/^[a-z-]+:\s*[^:;{}]+$/.test(part))) {
            return false;
        }
        found.set(selector, declarations);
        remaining = remaining.slice(match[0].length);
    }
    if (found.size !== expectedRules.size) {
        return false;
    }
    for (const [selector, declarations] of expectedRules) {
        if (!found.has(selector)) {
            return false;
        }
        try {
            assert.deepEqual(found.get(selector), declarations);
        } catch {
            return false;
        }
    }
    return true;
}

function preservesOriginal(source) {
    if (!original || sha256(original) !== originalHash || occurrences(original, '</head>') !== 1) {
        return false;
    }
    if (occurrences(source, style) !== 1 || occurrences(source, '</head>') !== 1) {
        return false;
    }
    if (!source.includes(style + '</head>')) {
        return false;
    }
    const inverse = source.replace(style, '');
    return sha256(inverse) === originalHash && inverse === original;
}

function runCase(name, check) {
    try {
        check();
        cases.push({name, ok: true});
    } catch {
        cases.push({name, ok: false});
    }
}

function rejectSemantic(before, after) {
    const mutation = replaceOnce(candidate, before, after);
    assert.equal(hasLayoutSemantics(mutation), false);
}

function rejectPreservation(before, after) {
    const mutation = replaceOnce(candidate, before, after);
    assert.equal(preservesOriginal(mutation), false);
}

runCase('fixture SHA-256 matches frozen original', () => {
    original = fs.readFileSync(fixturePath, 'utf8');
    assert.equal(sha256(original), originalHash);
    assert.equal(occurrences(original, '</head>'), 1);
});
runCase('original native modal and callers remain identifiable', () => {
    assert.ok(original);
    for (const anchor of [
        '<?php Header::setupHeader(); ?>',
        "$('#trigger-debug').dblclick(function () {",
        "$('#triggerButton').click(function () {",
        "$('#debugModal').modal('show');",
        'id="debugModal" tabindex="-1" role="dialog" aria-labelledby="debugModalLabel" aria-hidden="true"',
        '<h5 class="modal-title" id="debugModalLabel"><?php echo xlt("Weno Debug Information"); ?></h5>',
        '<button type="button" class="close" data-dismiss="modal" aria-label="Close">',
        '<a id="downloadLink" class="btn btn-success" download="debug_info_<?php echo md5((string) $provider_info[\'email\']); ?>.txt"><?php echo xlt("Download Debug File"); ?></a>',
        '<button type="button" class="btn btn-secondary" data-dismiss="modal"><?php echo xlt("Close"); ?></button>'
    ]) {
        assert.ok(original.includes(anchor), `missing native anchor: ${anchor}`);
    }
});
runCase('positive candidate has exact scoped screen semantics', () => {
    candidate = replaceOnce(original, '</head>', style + '</head>');
    assert.equal(hasLayoutSemantics(candidate), true);
});
runCase('positive candidate preserves every original byte', () => {
    assert.equal(preservesOriginal(candidate), true);
});
runCase('original source lacks proposed style semantics', () => {
    assert.equal(hasLayoutSemantics(original), false);
});
runCase('live source has proposed style semantics', () => {
    live = fs.readFileSync(livePath, 'utf8');
    assert.equal(hasLayoutSemantics(live), true);
});
runCase('live inverse matches frozen original SHA-256', () => {
    if (live === undefined) {
        live = fs.readFileSync(livePath, 'utf8');
    }
    assert.equal(preservesOriginal(live), true);
});
runCase('missing screen media is rejected', () => rejectSemantic('@media screen {', '@media print {'));
runCase('missing workbench context is rejected', () => rejectSemantic('html.oe-workbench-context #debugModal .modal-title', 'html #debugModal .modal-title'));
runCase('missing modal scope is rejected', () => rejectSemantic('html.oe-workbench-context #debugModal .modal-title', 'html.oe-workbench-context .modal-title'));
runCase('added focus rule is rejected', () => rejectSemantic('      html.oe-workbench-context #debugModal .modal-title {', '      html.oe-workbench-context #debugModal .close:focus { outline: none; }\n      html.oe-workbench-context #debugModal .modal-title {'));
runCase('added paint declaration is rejected', () => rejectSemantic('flex-shrink: 0;', 'flex-shrink: 0; color: red;'));
runCase('missing title min-width is rejected', () => rejectSemantic('        min-width: 0;\n        overflow-wrap: anywhere;\n      }', '        overflow-wrap: anywhere;\n      }'));
runCase('missing title wrapping is rejected', () => rejectSemantic('        min-width: 0;\n        overflow-wrap: anywhere;\n      }', '        min-width: 0;\n      }'));
runCase('missing close flex-shrink is rejected', () => rejectSemantic('        flex-shrink: 0;', '        flex-shrink: 1;'));
runCase('missing body wrapping is rejected', () => rejectSemantic('      html.oe-workbench-context #debugModal .modal-body {\n        overflow-wrap: anywhere;', '      html.oe-workbench-context #debugModal .modal-body {\n        overflow-wrap: normal;'));
runCase('missing download width is rejected', () => rejectSemantic('        max-width: 100%;', '        max-width: none;'));
runCase('missing download wrapping is rejected', () => rejectSemantic('      html.oe-workbench-context #debugModal #downloadLink {\n        min-width: 0;\n        max-width: 100%;\n        white-space: normal;\n        overflow-wrap: anywhere;', '      html.oe-workbench-context #debugModal #downloadLink {\n        min-width: 0;\n        max-width: 100%;\n        white-space: nowrap;\n        overflow-wrap: anywhere;'));
runCase('missing footer margin budget is rejected', () => rejectSemantic('max-width: calc(100% - 0.5rem);', 'max-width: 100%;'));
runCase('missing footer wrapping is rejected', () => rejectSemantic('      html.oe-workbench-context #debugModal .modal-footer > .btn {\n        min-width: 0;\n        max-width: calc(100% - 0.5rem);\n        white-space: normal;\n        overflow-wrap: anywhere;', '      html.oe-workbench-context #debugModal .modal-footer > .btn {\n        min-width: 0;\n        max-width: calc(100% - 0.5rem);\n        white-space: nowrap;\n        overflow-wrap: anywhere;'));
runCase('duplicate style fails inverse', () => {
    const mutation = candidate.replace(style, style + style);
    assert.notEqual(mutation, candidate);
    assert.equal(preservesOriginal(mutation), false);
});
runCase('moved style fails unique placement', () => {
    const mutation = candidate.replace(style, '').replace('</head>', '</head>\n' + style);
    assert.notEqual(mutation, candidate);
    assert.equal(preservesOriginal(mutation), false);
});
runCase('PHP edit fails inverse', () => rejectPreservation('require_once("../../../../globals.php");', 'require_once("../../../globals.php");'));
runCase('JavaScript edit fails inverse', () => rejectPreservation("$('#triggerButton').click(function () {", "$('#triggerButton').dblclick(function () {"));
runCase('iframe edit fails inverse', () => rejectPreservation('height="900" src="<?php echo attr($urlOut); ?>"', 'height="901" src="<?php echo attr($urlOut); ?>"'));
runCase('download attribute edit fails inverse', () => rejectPreservation('download="debug_info_<?php echo md5((string) $provider_info[\'email\']); ?>.txt"', 'download="changed.txt"'));
runCase('translation edit fails inverse', () => rejectPreservation('xlt("Weno Debug Information")', 'xlt("Changed Debug Information")'));

const passed = cases.filter((item) => item.ok).length;
const failed = cases.length - passed;
process.stdout.write(JSON.stringify({passed, failed, cases}) + '\n');
if (failed !== 0) {
    process.exitCode = 1;
}
