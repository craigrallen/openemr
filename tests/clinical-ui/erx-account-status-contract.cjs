'use strict';

// Source-only contract. Never load the PHP route, eRxSOAP, a browser, or credentials.
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '../..');
const base = '09b29da7771aea334ed5745e058751157af980d7';
const route = 'interface/soap_functions/soap_accountStatusDetails.php';
const fixture = 'tests/clinical-ui/fixtures/erx-account-status-original.php.txt';
const contract = 'tests/clinical-ui/erx-account-status-contract.cjs';
const adapter = 'tests/js/erx-account-status.test.js';
const docs = 'docs/clinical-ui/ERX-ACCOUNT-STATUS.md';
const read = file => readFileSync(path.join(root, file));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const original = read(fixture);
const plain = original.toString('utf8');
const protectedHashes = {
    'templates/patient/partials/erx.html.twig': '609ef3267e2f57af1a41e4010073cb398ba3fe3be7ade05f7ca3f1afd1d5a2bd',
    'interface/patient_file/summary/demographics.php': '00554d54565a92ee3b71a79053ac4f3daf55def3501d3dce6cf284d4615cbd3a',
    'interface/patient_file/erx_patient_portal_js.php': '132a02e3a6dfdcdf7bd13c5194cbbb88fdddbbf2e6a9e49a3a3195c940d91559',
    'interface/clinical-workspace/popup.css': 'ea56e9f26990e843219a68f315c188f7e2b0581c20321bac4517dc4ba34e79a9',
    'interface/themes/color_base.scss': 'f13d802ca97933d243c67a4474c994db7471e08913a3b8da694d8d953d8325d7'
};

// Exact future additions. Header already autoloads the workbench popup tokens.
const style = `    <style id="oe-erx-account-status-style">
@media screen {
  html.oe-workbench-context body.oe-erx-account-status {
    color: var(--oe-wb-ink, #17343b);
    background-color: var(--oe-wb-canvas, #f3f7f5) !important;
  }

  html.oe-workbench-context body.oe-erx-account-status table.text,
  html.oe-workbench-context body.oe-erx-account-status table.text td {
    color: var(--oe-wb-ink, #17343b);
    background-color: var(--oe-wb-paper, #fff);
  }

  html.oe-workbench-context body.oe-erx-account-status table.text th {
    color: var(--oe-wb-petrol, #086878);
    background-color: var(--oe-wb-paper, #fff);
  }
}
    </style>
`;
const header = '    <?php Header::setupHeader(); ?>\n';
const oldBody = "<body class='body_top'>";
const newBody = "<body class='body_top oe-erx-account-status'>";
const count = (source, needle) => source.split(needle).length - 1;
function replaceAnchor(source, anchor, replacement) {
    assert.equal(count(source, anchor), 1, 'unique mutation anchor: ' + anchor);
    assert.notEqual(anchor, replacement);
    const changed = source.replace(anchor, replacement);
    assert.notEqual(changed, source);
    return changed;
}
const candidate = replaceAnchor(replaceAnchor(plain, header, header + style), oldBody, newBody);

function checkCandidate(source) {
    assert.equal(count(source, newBody), 1, 'missing or duplicate eRx body marker');
    assert.equal(count(source, style), 1, 'missing or altered exact screen style after Header');
    assert.equal(count(source, '<style'), 1, 'exactly one style element');
    assert.equal(source, candidate, 'only the two exact additions are allowed');
    assert.deepEqual(Buffer.from(source.replace(style, '').replace(newBody, oldBody), 'utf8'), original,
        'inverse additions must restore every original PHP byte');
}

function checkProtected(sources) {
    for (const [file, digest] of Object.entries(protectedHashes)) {
        assert.equal(sha(sources[file]), digest, 'unchanged source: ' + file);
    }
    const twig = sources['templates/patient/partials/erx.html.twig'].toString('utf8');
    const demographics = sources['interface/patient_file/summary/demographics.php'].toString('utf8');
    const popupCaller = sources['interface/patient_file/erx_patient_portal_js.php'].toString('utf8');
    const css = sources['interface/clinical-workspace/popup.css'].toString('utf8');
    const scss = sources['interface/themes/color_base.scss'].toString('utf8');
    assert.ok(twig.includes('/interface/soap_functions/soap_accountStatusDetails.php'));
    assert.ok(twig.includes('iframe1'));
    assert.ok(demographics.includes("render('patient/partials/erx.html.twig'"));
    assert.ok(popupCaller.includes('$(".iframe1").on(\'click\''));
    assert.ok(popupCaller.includes("type: 'iframe'"));
    for (const token of ['--oe-wb-ink: #17343b;', '--oe-wb-paper: #fff;',
        '--oe-wb-canvas: #f3f7f5;', '--oe-wb-petrol: #086878;']) {
        assert.ok(css.includes(token), 'popup token: ' + token);
    }
    assert.match(scss, /\.body_top,\s*\.bgcolor2,\s*\.body_nav\s*\{\s*background-color: \$paler !important;/);
}
const protectedSources = () => Object.fromEntries(Object.keys(protectedHashes).map(file => [file, read(file)]));

test('fixture freezes all 3221 original bytes and exact insertion anchors', () => {
    assert.equal(original.length, 3221);
    assert.equal(sha(original), '28f52dcfa471950c79367d2b7dc58395e7cb36a91a25fcdd06e5728d430156b1');
    assert.equal(count(plain, header), 1);
    assert.equal(count(plain, oldBody), 1);
    assert.equal(count(plain, '$eRxSOAP->getAccountStatus()'), 1);
    assert.equal(count(plain, '<table'), 1);
    assert.equal(count(plain, '<script'), 0);
});

test('callers, popup palette and important body background are source-pinned', () => {
    checkProtected(protectedSources());
    const headerSource = read('src/Core/Header.php').toString('utf8');
    const config = read('config/config.yaml').toString('utf8');
    const popup = read('interface/clinical-workspace/popup.js').toString('utf8');
    assert.ok(headerSource.includes('self::setupAssets(is_array($assets) ? $assets : [$assets], true)'));
    assert.ok(headerSource.includes('$autoload === true'));
    assert.match(config, /workbench-popup:\s*basePath: '%webroot%\/interface\/clinical-workspace\/'\s*script: popup\.js\s*link: popup\.css\s*autoload: true/);
    assert.ok(popup.includes("const CONTEXT_CLASS = 'oe-workbench-context'"));
    assert.ok(popup.includes("body.classList.contains('workbench-active')"));
});

test('synthetic future source satisfies scoped palette and complete restoration before production changes', () => {
    checkCandidate(candidate);
    assert.equal(count(style, '@media screen {'), 1);
    assert.equal(count(style, 'html.oe-workbench-context body.oe-erx-account-status'), 4);
    assert.equal(count(style, '    color:'), 3);
    assert.equal(count(style, '    background-color:'), 3);
    assert.equal(count(style, '!important'), 1);
    assert.doesNotMatch(style, /\b(?:font(?:-\w+)?|margin(?:-\w+)?|padding(?:-\w+)?|width|height|display|visibility|border(?:-width)?|outline(?:-width)?)\s*:/);
});

test('unique-anchor mutants reject source, caller, scope, declaration and forbidden styling changes', () => {
    const mutants = {
        missingStyle: s => replaceAnchor(s, style, ''),
        duplicateStyle: s => replaceAnchor(s, style, style + style),
        missingMarker: s => replaceAnchor(s, newBody, oldBody),
        duplicateMarker: s => replaceAnchor(s, newBody, newBody + newBody),
        styleBeforeHeader: s => replaceAnchor(s, header + style, style + header),
        styleAfterHead: s => replaceAnchor(s, style + '</head>', '</head>' + style),
        printMedia: s => replaceAnchor(s, '@media screen {', '@media print {'),
        allMedia: s => replaceAnchor(s, '@media screen {', '@media all {'),
        wrongContext: s => replaceAnchor(s, style, style.replaceAll('html.oe-workbench-context', 'html.oe-workbench-popup')),
        unscopedRoute: s => replaceAnchor(s, style, style.replaceAll('body.oe-erx-account-status', 'body')),
        wrongTableSelector: s => replaceAnchor(s, 'table.text td {', 'table td {'),
        wrongBodyInk: s => replaceAnchor(s, '    color: var(--oe-wb-ink, #17343b);\n    background-color: var(--oe-wb-canvas', '    color: var(--oe-wb-ink, #000);\n    background-color: var(--oe-wb-canvas'),
        wrongCanvas: s => replaceAnchor(s, 'var(--oe-wb-canvas, #f3f7f5)', 'var(--oe-wb-canvas, #fff)'),
        missingBodyImportant: s => replaceAnchor(s, 'var(--oe-wb-canvas, #f3f7f5) !important;', 'var(--oe-wb-canvas, #f3f7f5);'),
        bodyInkImportant: s => replaceAnchor(s, '    color: var(--oe-wb-ink, #17343b);\n    background-color: var(--oe-wb-canvas', '    color: var(--oe-wb-ink, #17343b) !important;\n    background-color: var(--oe-wb-canvas'),
        unpairedBody: s => replaceAnchor(s, '    color: var(--oe-wb-ink, #17343b);\n    background-color: var(--oe-wb-canvas', '    background-color: var(--oe-wb-canvas'),
        wrongTableInk: s => replaceAnchor(s, 'table.text td {\n    color: var(--oe-wb-ink, #17343b);', 'table.text td {\n    color: var(--oe-wb-ink, #000);'),
        wrongTablePaper: s => replaceAnchor(s, 'table.text td {\n    color: var(--oe-wb-ink, #17343b);\n    background-color: var(--oe-wb-paper, #fff);', 'table.text td {\n    color: var(--oe-wb-ink, #17343b);\n    background-color: var(--oe-wb-paper, #eee);'),
        tablePaperImportant: s => replaceAnchor(s, 'table.text td {\n    color: var(--oe-wb-ink, #17343b);\n    background-color: var(--oe-wb-paper, #fff);', 'table.text td {\n    color: var(--oe-wb-ink, #17343b);\n    background-color: var(--oe-wb-paper, #fff) !important;'),
        unpairedTable: s => replaceAnchor(s, 'table.text td {\n    color: var(--oe-wb-ink, #17343b);', 'table.text td {'),
        wrongHeadingPetrol: s => replaceAnchor(s, 'table.text th {\n    color: var(--oe-wb-petrol, #086878);', 'table.text th {\n    color: var(--oe-wb-petrol, #000);'),
        wrongHeadingPaper: s => replaceAnchor(s, 'table.text th {\n    color: var(--oe-wb-petrol, #086878);\n    background-color: var(--oe-wb-paper, #fff);', 'table.text th {\n    color: var(--oe-wb-petrol, #086878);\n    background-color: var(--oe-wb-paper, #eee);'),
        headingInkImportant: s => replaceAnchor(s, 'table.text th {\n    color: var(--oe-wb-petrol, #086878);', 'table.text th {\n    color: var(--oe-wb-petrol, #086878) !important;'),
        headingPaperImportant: s => replaceAnchor(s, 'table.text th {\n    color: var(--oe-wb-petrol, #086878);\n    background-color: var(--oe-wb-paper, #fff);', 'table.text th {\n    color: var(--oe-wb-petrol, #086878);\n    background-color: var(--oe-wb-paper, #fff) !important;'),
        unpairedHeading: s => replaceAnchor(s, 'table.text th {\n    color: var(--oe-wb-petrol, #086878);', 'table.text th {'),
        tableImportant: s => replaceAnchor(s, 'table.text td {\n    color: var(--oe-wb-ink, #17343b);', 'table.text td {\n    color: var(--oe-wb-ink, #17343b) !important;'),
        font: s => replaceAnchor(s, 'table.text th {\n', 'table.text th {\n    font-family: Arial;\n'),
        geometry: s => replaceAnchor(s, 'table.text th {\n', 'table.text th {\n    width: 100%;\n'),
        borderWidth: s => replaceAnchor(s, 'table.text th {\n', 'table.text th {\n    border-width: 2px;\n'),
        visibility: s => replaceAnchor(s, 'table.text th {\n', 'table.text th {\n    visibility: hidden;\n'),
        semanticStatus: s => replaceAnchor(s, 'table.text th {\n', 'table.text th {\n    background-color: red;\n'),
        php: s => replaceAnchor(s, '?>\n<head>', '?>\n<?php echo 1; ?>\n<head>'),
        soap: s => replaceAnchor(s, '$eRxSOAP->getAccountStatus()', '$eRxSOAP->getAccountStatusCached()'),
        patientSelection: s => replaceAnchor(s, "$_REQUEST['patient']", "$_REQUEST['other_patient']"),
        session: s => replaceAnchor(s, "$session->get('authUserID')", "$session->get('otherUserID')"),
        countExpression: s => replaceAnchor(s, '$accountStatus->PendingRxCount;', '$accountStatus->AlertCount;'),
        label: s => replaceAnchor(s, "xlt('Pending Rx Count')", "xlt('Pending Count')"),
        tableWidth: s => replaceAnchor(s, "width='90%'", "width='100%'"),
        tableHeight: s => replaceAnchor(s, "height='80%'", "height='90%'"),
        originalPadding: s => replaceAnchor(s, "style='padding-top:6%'", "style='padding-top:7%'"),
        originalFont: s => replaceAnchor(s, "style='padding-top:6%'", "style='padding-top:6%;font-size:12px'"),
        newScript: s => replaceAnchor(s, style + '</head>', style + '<script>alert(1)</script>\n</head>'),
        newImport: s => replaceAnchor(s, style + '</head>', style + '<link rel="stylesheet" href="extra.css">\n</head>')
    };
    for (const [name, mutate] of Object.entries(mutants)) {
        const changed = mutate(candidate); // Unique anchor and changed bytes asserted before rejection.
        assert.notEqual(changed, candidate, name);
        assert.throws(() => checkCandidate(changed), assert.AssertionError, name);
    }
    for (const [file, anchor, replacement] of [
        ['templates/patient/partials/erx.html.twig', 'iframe1', 'iframe2'],
        ['interface/patient_file/summary/demographics.php', "render('patient/partials/erx.html.twig'", "render('patient/partials/other.html.twig'"],
        ['interface/patient_file/erx_patient_portal_js.php', "dlgopen('', '', 350, 300, '', '', {\n            buttons: [\n                {text: <?php echo xlj('Close'); ?>, close: true, style: 'default btn-sm'}\n            ],\n            allowResize: true,\n            allowDrag: true,\n            dialogId: '',\n            type: 'iframe'", "dlgopen('', '', 350, 300, '', '', {\n            buttons: [\n                {text: <?php echo xlj('Close'); ?>, close: true, style: 'default btn-sm'}\n            ],\n            allowResize: true,\n            allowDrag: true,\n            dialogId: '',\n            type: 'window'"],
        ['interface/clinical-workspace/popup.css', '--oe-wb-petrol: #086878;', '--oe-wb-petrol: #000;'],
        ['interface/themes/color_base.scss', '.body_nav {\n  background-color: $paler !important;', '.body_nav {\n  background-color: $paler;']
    ]) {
        const sources = protectedSources();
        const before = sources[file].toString('utf8');
        sources[file] = Buffer.from(replaceAnchor(before, anchor, replacement));
        assert.notEqual(sources[file].toString('utf8'), before, file);
        assert.throws(() => checkProtected(sources), assert.AssertionError, file);
    }
});

test('live eRx route has the exact two-addition candidate', () => {
    checkCandidate(read(route).toString('utf8')); // Deliberately RED until the production phase.
});

if (process.argv.includes('--history')) {
    test('explicit local history authenticates fixture and limits all changed paths to five', () => {
        const git = args => execFileSync('git', args, { cwd: root });
        assert.equal(path.resolve(git(['rev-parse', '--show-toplevel']).toString().trim()), root);
        assert.equal(git(['rev-parse', base]).toString().trim(), base);
        assert.deepEqual(original, git(['show', base + ':' + route]));
        for (const file of Object.keys(protectedHashes)) assert.deepEqual(read(file), git(['show', base + ':' + file]), file);
        const names = args => git(args).toString('utf8').split('\0').filter(Boolean);
        const changed = new Set([
            ...names(['diff', '--no-renames', '--name-only', '-z', base, 'HEAD']),
            ...names(['diff', '--no-renames', '--name-only', '-z', 'HEAD']),
            ...names(['diff', '--no-renames', '--cached', '--name-only', '-z']),
            ...names(['ls-files', '--others', '--exclude-standard', '-z'])
        ]);
        const allowed = new Set([route, fixture, contract, adapter, docs]);
        assert.deepEqual([...changed].filter(file => !allowed.has(file)), [], 'only five scoped paths may change');
    });
}
