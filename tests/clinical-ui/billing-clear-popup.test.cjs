'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const routePath = 'interface/billing/clear_log.php';
const helperPath = 'src/Common/Assets/ClinicalWorkspaceAssets.php';
const cssPath = 'interface/clinical-workspace/billing-clear-popup.css';
const originalRoute = read('tests/clinical-ui/fixtures/billing-clear-original.php.txt');
const originalHelper = read('tests/clinical-ui/fixtures/billing-clear-assets-original.php.txt');
const base = '18647270e0c799189d2dc10f801e8de2bff1a360';

const routeEdits = [
    [
        "use OpenEMR\\Common\\Acl\\AclMain;\n",
        "use OpenEMR\\Common\\Acl\\AclMain;\nuse OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;\n",
    ],
    [
        "}\n\n$filename = OEGlobalsBag::getInstance()->get('OE_SITE_DIR')",
        `}

$clinicalAssets = new ClinicalWorkspaceAssets();
?>
<!doctype html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title><?php echo xlt('Billing Log'); ?></title>
    <link rel="stylesheet" media="screen" href="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>/interface/clinical-workspace/billing-clear-popup.css?v=<?php echo attr_url($clinicalAssets->version('billing-clear-popup.css')); ?>">
    <script src="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>/interface/clinical-workspace/popup.js?v=<?php echo attr_url($clinicalAssets->version('popup.js')); ?>"></script>
</head>
<body class="oe-billing-clear">
<main class="oe-billing-clear-sheet">
<div class="oe-billing-clear-content">
<?php

$filename = OEGlobalsBag::getInstance()->get('OE_SITE_DIR')`,
    ],
    [
        '    echo xlt("Log was already empty. Please close window.");\n}\n',
        '    echo xlt("Log was already empty. Please close window.");\n}\n?>\n</div>\n</main>\n</body>\n</html>\n',
    ],
];

const helperEdits = [
    ["        'appointment.css',\n", "        'appointment.css',\n        'billing-clear-popup.css',\n"],
    ["        'patient-search.css',\n", "        'patient-search.css',\n        'popup.js',\n"],
];

const expectedCss = `@media screen {
  html.oe-workbench-context body.oe-billing-clear {
    color: var(--oe-wb-ink, #17343b);
    background: var(--oe-wb-canvas, #edf3f4);
  }

  html.oe-workbench-context body.oe-billing-clear main.oe-billing-clear-sheet {
    color: var(--oe-wb-ink, #17343b);
    background: var(--oe-wb-paper, #fff);
    margin: 0.75rem;
    padding: 0.75rem;
    border: 1px solid var(--oe-wb-border, #c9d7da);
    border-radius: 0.5rem;
  }

  html.oe-workbench-context body.oe-billing-clear .oe-billing-clear-content {
    overflow-wrap: anywhere;
  }
}
`;

function count(source, anchor) {
    return source.split(anchor).length - 1;
}

function replaceOnce(source, before, after) {
    assert.equal(count(source, before), 1, `missing or repeated anchor: ${before}`);
    assert.notEqual(before, after);
    const changed = source.replace(before, () => after);
    assert.notEqual(changed, source);
    return changed;
}

function apply(original, edits) {
    return edits.reduce((source, [before, after]) => replaceOnce(source, before, after), original);
}

function undo(candidate, edits, original) {
    let source = candidate;
    for (const [before, after] of [...edits].reverse()) {
        if (count(source, after) !== 1) return false;
        source = source.replace(after, () => before);
    }
    return source === original;
}

function ordered(source, anchors) {
    let previous = -1;
    for (const anchor of anchors) {
        assert.equal(count(source, anchor), 1, `missing or repeated order anchor: ${anchor}`);
        const position = source.indexOf(anchor);
        assert.ok(position > previous, `out of order: ${anchor}`);
        previous = position;
    }
}

function verifyRoute(source) {
    assert.ok(undo(source, routeEdits, originalRoute), 'route must undo to every original byte');
    ordered(source, [
        'CsrfUtils::checkCsrfInput(INPUT_GET, dieOnFail: true);',
        "if (!AclMain::aclCheckCore('acct', 'eob', '', 'write') && !AclMain::aclCheckCore('acct', 'bill', '', 'write')) {",
        'AccessDeniedHelper::denyWithTemplate(',
        '$clinicalAssets = new ClinicalWorkspaceAssets();',
        '<!doctype html>',
        '    <meta charset="utf-8">',
        '    <meta name="viewport" content="width=device-width, initial-scale=1">',
        "    <title><?php echo xlt('Billing Log'); ?></title>",
        '    <link rel="stylesheet" media="screen"',
        '    <script src="',
        '<body class="oe-billing-clear">',
        '<main class="oe-billing-clear-sheet">',
        '<div class="oe-billing-clear-content">',
        "$filename = OEGlobalsBag::getInstance()->get('OE_SITE_DIR')",
        'if (file_exists($filename)) {',
        'date("Y-m-d-His")',
        'rename($filename, $newlog);',
        'echo xlt("Log is cleared. Please close window.");',
        'echo xlt("Log was already empty. Please close window.");',
        '</div>', '</main>', '</body>', '</html>',
    ]);
}

function verifyHelper(source) {
    assert.ok(undo(source, helperEdits, originalHelper), 'helper must undo to every original byte');
    ordered(source, ["'appointment.css'", "'billing-clear-popup.css'", "'calendar-sidebar.js'"]);
    ordered(source, ["'patient-results-popup.css'", "'patient-search.css'", "'popup.js'", "'soap-document.css'"]);
}

function verifyCss(source) {
    assert.equal(source, expectedCss, 'one scoped screen block with exactly three rules');
    assert.equal(count(source, '@media screen {'), 1);
    assert.equal(count(source, 'html.oe-workbench-context body.oe-billing-clear'), 3);
}

const candidateRoute = apply(originalRoute, routeEdits);
const candidateHelper = apply(originalHelper, helperEdits);

test('frozen originals and exact additions produce a valid synthetic candidate', () => {
    verifyRoute(candidateRoute);
    verifyHelper(candidateHelper);
    verifyCss(expectedCss);
});

test('synthetic route mutations are rejected, with unique anchors and changed input', () => {
    const mutations = [
        ['CsrfUtils::checkCsrfInput(INPUT_GET, dieOnFail: true);', 'CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: true);'],
        ['CsrfUtils::checkCsrfInput(INPUT_GET, dieOnFail: true);', 'CsrfUtils::checkCsrfInput(INPUT_GET, dieOnFail: false);'],
        ["'acct', 'eob', '', 'write') && !AclMain::aclCheckCore", "'acct', 'eob', '', 'write') || !AclMain::aclCheckCore"],
        ["'acct', 'eob', '', 'write'", "'acct', 'eob', '', 'read'"],
        ["'acct', 'bill', '', 'write'", "'acct', 'bill', '', 'read'"],
        ['AccessDeniedHelper::denyWithTemplate(', 'AccessDeniedHelper::denyWithoutTemplate('],
        ['if (file_exists($filename)) {', 'if (!file_exists($filename)) {'],
        ['rename($filename, $newlog);', 'rename($newlog, $filename);'],
        ['date("Y-m-d-His")', 'date("Y-m-d")'],
        ['echo xlt("Log is cleared. Please close window.");', 'echo xlt("Log cleared.");'],
        ['echo xlt("Log was already empty. Please close window.");', 'echo xlt("Log empty.");'],
        ['attr_url($clinicalAssets->version(\'billing-clear-popup.css\'))', '$clinicalAssets->version(\'billing-clear-popup.css\')'],
        ['attr_url($clinicalAssets->version(\'popup.js\'))', '$clinicalAssets->version(\'popup.js\')'],
        ['attr(OEGlobalsBag::getInstance()->getWebRoot())', 'OEGlobalsBag::getInstance()->getWebRoot()'],
        ['    <meta name="viewport" content="width=device-width, initial-scale=1">', '    <meta name="viewport" content="initial-scale=1">'],
        ["    <title><?php echo xlt('Billing Log'); ?></title>", '    <title>Billing Log</title>'],
        ['    <link rel="stylesheet" media="screen"', '    <link rel="stylesheet" media="print"'],
        ['<body class="oe-billing-clear">', '<body>'],
        ['<main class="oe-billing-clear-sheet">', '<main>'],
        ['<div class="oe-billing-clear-content">', '<div>'],
        ['    <script src="', '    <script defer src="'],
        ['<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>/interface/clinical-workspace/popup.js', '<?php echo OEGlobalsBag::getInstance()->getWebRoot(); ?>/interface/clinical-workspace/popup.js'],
        ['process_bills.log', 'other.log'],
        ['interface/billing/clear_log.php - backup, then clear billing log', 'interface/billing/clear_log.php - altered original byte'],
    ];
    for (const [before, after] of mutations) {
        // Some anchors occur twice by design; choose the complete unique statement below.
        const uniqueBefore = before === 'attr(OEGlobalsBag::getInstance()->getWebRoot())'
            ? '    <link rel="stylesheet" media="screen" href="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>'
            : before === 'process_bills.log'
                ? "$filename = OEGlobalsBag::getInstance()->get('OE_SITE_DIR') . '/documents/edi/process_bills.log';"
                : before;
        const uniqueAfter = before === 'attr(OEGlobalsBag::getInstance()->getWebRoot())'
            ? '    <link rel="stylesheet" media="screen" href="<?php echo OEGlobalsBag::getInstance()->getWebRoot(); ?>'
            : before === 'process_bills.log'
                ? "$filename = OEGlobalsBag::getInstance()->get('OE_SITE_DIR') . '/documents/edi/other.log';"
                : after;
        const mutant = replaceOnce(candidateRoute, uniqueBefore, uniqueAfter);
        assert.throws(() => verifyRoute(mutant), `accepted route mutation: ${before}`);
    }
    assert.throws(() => replaceOnce(candidateRoute, 'absent unique anchor', 'replacement'));
});

test('synthetic order changes and extra output cannot pass the inverse', () => {
    const swaps = [
        ['    <link rel="stylesheet" media="screen"', '    <script src="'],
        ['<main class="oe-billing-clear-sheet">', '<div class="oe-billing-clear-content">'],
    ];
    for (const [first, second] of swaps) {
        assert.equal(count(candidateRoute, first), 1);
        assert.equal(count(candidateRoute, second), 1);
        const swapped = candidateRoute.replace(first, '\u0000').replace(second, first).replace('\u0000', second);
        assert.notEqual(swapped, candidateRoute);
        assert.throws(() => verifyRoute(swapped));
    }
    const extra = replaceOnce(candidateRoute, '</html>\n', '</html>\nextra\n');
    assert.throws(() => verifyRoute(extra));
    const beforeAcl = replaceOnce(candidateRoute, '//ensure user has proper access\n', "//ensure user has proper access\n?>\n<title><?php echo xlt('Billing Log'); ?></title>\n<?php\n");
    assert.throws(() => verifyRoute(beforeAcl));
    const assetBeforeAcl = replaceOnce(candidateRoute, '//ensure user has proper access\n', '//ensure user has proper access\n$clinicalAssets = new ClinicalWorkspaceAssets();\n');
    assert.throws(() => verifyRoute(assetBeforeAcl));
});

test('helper inverse rejects missing, reordered, and changed asset entries', () => {
    for (const [before, after] of [
        ["        'billing-clear-popup.css',\n", ''],
        ["        'popup.js',\n", "        'other.js',\n"],
        ["        'patient-search.css',\n        'popup.js',\n", "        'popup.js',\n        'patient-search.css',\n"],
        ["        'appointment.css',\n        'billing-clear-popup.css',\n", "        'billing-clear-popup.css',\n        'appointment.css',\n"],
        ["return '0';", "return '1';"],
    ]) {
        const mutant = replaceOnce(candidateHelper, before, after);
        assert.throws(() => verifyHelper(mutant));
    }
});

test('CSS rejects print, legacy leakage, font, geometry, hidden controls, and extra declarations', () => {
    for (const [before, after] of [
        ['@media screen {', '@media print {'],
        ['html.oe-workbench-context body.oe-billing-clear {', 'body.oe-billing-clear {'],
        ['overflow-wrap: anywhere;', 'overflow-wrap: anywhere;\n    font-family: Arial;'],
        ['margin: 0.75rem;', 'margin: 0.75rem;\n    width: 500px;'],
        ['padding: 0.75rem;', 'padding: 0.75rem;\n    height: 400px;'],
        ['overflow-wrap: anywhere;', 'overflow-wrap: anywhere;\n    .button { display: none; }'],
        ['border-radius: 0.5rem;', 'border-radius: 0.5rem;\n    opacity: 0.5;'],
        ['#edf3f4', '#fff'],
        ['#c9d7da', '#d9e4e2'],
    ]) {
        const mutant = replaceOnce(expectedCss, before, after);
        assert.throws(() => verifyCss(mutant));
    }
});

test('production route, helper, and stylesheet match the presentation contract', () => {
    verifyRoute(read(routePath));
    verifyHelper(read(helperPath));
    verifyCss(read(cssPath));
});

if (process.env.BILLING_CLEAR_HISTORY === '1') {
    test('verified base and exact OPEMR-45 changed-file allowlist', () => {
        const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
        assert.equal(git('show', `${base}:${routePath}`), originalRoute);
        assert.equal(git('show', `${base}:${helperPath}`), originalHelper);
        for (const file of [
            'interface/billing/billing_report.php',
            'interface/clinical-workspace/popup.js',
            'interface/clinical-workspace/popup.css',
            'interface/themes/oe-styles/style_dark.scss',
            'interface/themes/oe-styles/style_solar.scss',
            'interface/themes/theme-defaults.scss',
        ]) {
            assert.equal(read(file), git('show', `${base}:${file}`), `${file} changed`);
        }
        const changed = new Set([
            ...git('diff', '--name-only', base).trim().split('\n').filter(Boolean),
            ...git('ls-files', '--others', '--exclude-standard').trim().split('\n').filter(Boolean),
        ]);
        assert.deepEqual([...changed].sort(), [
            routePath,
            helperPath,
            cssPath,
            'tests/clinical-ui/billing-clear-popup.test.cjs',
            'tests/clinical-ui/fixtures/billing-clear-original.php.txt',
            'tests/clinical-ui/fixtures/billing-clear-assets-original.php.txt',
            'tests/js/billing-clear-popup.test.js',
            'docs/clinical-ui/BILLING-CLEAR-POPUP.md',
        ].sort());
    });
}
