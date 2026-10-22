// Source contracts only: no PHP, route, log, database, or browser execution.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');
const { execFileSync } = require('node:child_process');

const root = join(__dirname, '../..');
const paths = {
    route: 'interface/billing/customize_log.php',
    helper: 'src/Common/Assets/ClinicalWorkspaceAssets.php',
    css: 'interface/clinical-workspace/billing-log-popup.css',
    popup: 'interface/clinical-workspace/popup.js',
    billingCaller: 'interface/billing/billing_report.php',
    logCaller: 'interface/logview/logview.php',
    originalRoute: 'tests/clinical-ui/fixtures/billing-log-original.php.txt',
    originalHelper: 'tests/clinical-ui/fixtures/billing-log-helper-original.php.txt',
};
const read = (path) => readFileSync(join(root, path), 'utf8');
const optional = (path) => existsSync(join(root, path)) ? read(path) : '';

function replaceOnce(source, before, after) {
    assert.equal(source.split(before).length, 2, `unique edit anchor: ${before}`);
    return source.replace(before, after);
}

const originalRoute = read(paths.originalRoute);
const originalHelper = read(paths.originalHelper);
const acl = `//ensure user has proper access
if (!AclMain::aclCheckCore('acct', 'eob', '', 'write') && !AclMain::aclCheckCore('acct', 'bill', '', 'write')) {
    AccessDeniedHelper::denyWithTemplate("ACL check failed for acct/eob or acct/bill: Billing Log", xl("Billing Log"));
}
`;
const importBefore = 'use OpenEMR\\Common\\Acl\\AclMain;\nuse OpenEMR\\Core\\OEGlobalsBag;';
const importAfter = 'use OpenEMR\\Common\\Acl\\AclMain;\nuse OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;\nuse OpenEMR\\Core\\OEGlobalsBag;';
const gateBefore = `${acl}
$filename`;
const gateAfter = `${acl}
$clinicalAssets = new ClinicalWorkspaceAssets();
?>
<!doctype html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title><?php echo xlt('Billing Log'); ?></title>
    <link rel="stylesheet" media="screen" href="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>/interface/clinical-workspace/billing-log-popup.css?v=<?php echo attr_url($clinicalAssets->version('billing-log-popup.css')); ?>">
    <script src="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>/interface/clinical-workspace/popup.js?v=<?php echo attr_url($clinicalAssets->version('popup.js')); ?>"></script>
</head>
<body class="oe-billing-log">
<main class="oe-billing-log-sheet">
<div class="oe-billing-log-content">
<?php
$filename`;
const earlyBefore = '    echo xlt("Billing log is empty");\n    exit;';
const earlyAfter = `    echo xlt("Billing log is empty");
    ?>
</div>
</main>
</body>
</html>
    <?php
    exit;`;
const footer = `?>
</div>
</main>
</body>
</html>
`;

function proposedRoute() {
    let source = replaceOnce(originalRoute, importBefore, importAfter);
    source = replaceOnce(source, gateBefore, gateAfter);
    source = replaceOnce(source, earlyBefore, earlyAfter);
    return source + footer;
}

function inverseRoute(source) {
    assert.ok(source.endsWith(footer), 'normal branch has a complete close');
    let restored = source.slice(0, -footer.length);
    restored = replaceOnce(restored, earlyAfter, earlyBefore);
    restored = replaceOnce(restored, gateAfter, gateBefore);
    return replaceOnce(restored, importAfter, importBefore);
}

const helperEdits = [
    ["        'appointment.css',\n", "        'appointment.css',\n        'billing-log-popup.css',\n"],
    ["        'patient-search.css',\n", "        'patient-search.css',\n        'popup.js',\n"],
];
function proposedHelper() {
    return helperEdits.reduce((source, [before, after]) => replaceOnce(source, before, after), originalHelper);
}
function inverseHelper(source) {
    return [...helperEdits].reverse().reduce((result, [before, after]) => replaceOnce(result, after, before), source);
}

const css = `/* Billing log popup paper, only within an active workbench on screen. */
@media screen {
  html.oe-workbench-context body.oe-billing-log {
    background: var(--oe-wb-canvas, #edf3f4);
    color: var(--oe-wb-ink, #17343b);
  }

  html.oe-workbench-context body.oe-billing-log main.oe-billing-log-sheet {
    background: var(--oe-wb-paper, #fff);
    color: var(--oe-wb-ink, #17343b);
    margin: 0.75rem;
    padding: 0.75rem;
    border: 1px solid var(--oe-wb-border, #c9d7da);
    border-radius: 0.5rem;
  }

  html.oe-workbench-context body.oe-billing-log .oe-billing-log-content {
    overflow-wrap: anywhere;
  }
}
`;

const expected = { route: proposedRoute(), helper: proposedHelper(), css };
function audit(candidate) {
    const issues = [];
    if (candidate.route !== expected.route) issues.push('route');
    if (candidate.helper !== expected.helper) issues.push('helper');
    if (candidate.css !== expected.css) issues.push('css');
    return issues;
}
function current() {
    return { route: read(paths.route), helper: read(paths.helper), css: optional(paths.css) };
}
function mutate(field, before, after) {
    const changed = { ...expected, [field]: replaceOnce(expected[field], before, after) };
    assert.notEqual(changed[field], expected[field], `mutant must change ${field}`);
    return changed;
}

test('complete original fixtures and exact additive inverse', () => {
    assert.equal(originalRoute.split('\n').length - 1, 43);
    assert.equal(originalRoute.startsWith('<?php\n'), true);
    assert.equal(originalRoute.endsWith('}\n'), true);
    assert.equal(originalHelper.startsWith('<?php\n'), true);
    assert.equal(originalHelper.endsWith('}\n'), true);
    assert.equal(inverseRoute(expected.route), originalRoute);
    assert.equal(inverseHelper(expected.helper), originalHelper);
    assert.deepEqual(audit(expected), []);
});

test('original ACL, file, crypto, escaped output and both empty branches retain their order', () => {
    const positions = [
        acl,
        "$filename = OEGlobalsBag::getInstance()->get('OE_SITE_DIR') . '/documents/edi/process_bills.log';",
        'if (!file_exists($filename)) {',
        earlyAfter,
        '$fh = file_get_contents($filename);',
        '$cryptoGen = ServiceContainer::getCrypto();',
        '$fh = $cryptoGen->decryptFromFilesystem($fh);',
        'if (!empty($fh)) {\n    echo nl2br(text($fh));\n} else {\n    echo xlt("Billing log is empty");\n}',
        '}\n' + footer,
    ].map((anchor) => {
        assert.equal(expected.route.split(anchor).length, 2, `one protected anchor: ${anchor}`);
        return expected.route.indexOf(anchor);
    });
    assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
    assert.equal((expected.route.match(/echo xlt\("Billing log is empty"\);/g) || []).length, 2);
    assert.equal((expected.route.match(/\bexit;/g) || []).length, 1);
    assert.equal((expected.route.match(/<\/html>/g) || []).length, 2);
    assert.doesNotMatch(expected.route, /Header::|\/popup\.css|\/workspace\.css|<form\b|<button\b/);
    assert.equal((expected.css.match(/html\.oe-workbench-context/g) || []).length, 3);
    assert.doesNotMatch(expected.css, /font(?:-family|-size)?\s*:|@media print|!important/);
});

test('shared callers retain their controller, dialog size and theme header anchors', () => {
    const billing = read(paths.billingCaller);
    const logview = read(paths.logCaller);
    assert.match(billing, /Header::setupHeader\(\['datetime-picker', 'common'\]\)/);
    assert.match(logview, /Header::setupHeader\(\['datetime-picker'\]\)/);
    assert.ok(billing.includes('$("#view-log-link").click(function() {\n                top.restoreSession();\n                dlgopen(\'customize_log.php\', \'_blank\', 750, 400);'));
    assert.ok(logview.includes('$("#view-billing-log-link").click(function () {\n                    top.restoreSession();\n                    dlgopen(\'../billing/customize_log.php\', \'_blank\', 500, 400);'));
    const popup = read(paths.popup);
    assert.match(popup, /const CONTEXT_CLASS = 'oe-workbench-context';/);
    assert.match(popup, /const POPUP_CLASS = 'oe-workbench-popup';/);
});

test('anchored negative mutants reject protected source and style changes', () => {
    const assetLines = expected.route.split('\n').filter((line) =>
        line.startsWith('    <link ') || line.startsWith('    <script '));
    assert.equal(assetLines.length, 2, 'one stylesheet then one popup script');
    const cases = [
        ['route', ' * interface/billing/customize_log.php', ' * changed route fixture'],
        ['route', "'acct', 'eob', '', 'write'", "'acct', 'eob', '', 'read'"],
        ['route', "'acct', 'bill', '', 'write'", "'acct', 'bill', '', 'read'"],
        ['route', "'', 'write') && !AclMain", "'', 'write') || !AclMain"],
        ['route', '    AccessDeniedHelper::denyWithTemplate', '    // AccessDeniedHelper::denyWithTemplate'],
        ['route', '$fh = $cryptoGen->decryptFromFilesystem($fh);', '$fh = $cryptoGen->decrypt($fh);'],
        ['route', 'echo nl2br(text($fh));', 'echo nl2br($fh);'],
        ['route', '    <?php\n    exit;', '    <?php\n    return;'],
        ['route', '    ?>\n</div>\n</main>\n</body>\n</html>\n    <?php', '    ?>\n    <?php'],
        ['route', '<link rel="stylesheet" media="screen" href="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>', '<link rel="stylesheet" media="screen" href="<?php echo OEGlobalsBag::getInstance()->getWebRoot(); ?>'],
        ['route', "attr_url($clinicalAssets->version('popup.js'))", "$clinicalAssets->version('popup.js')"],
        ['route', "attr_url($clinicalAssets->version('billing-log-popup.css'))", "$clinicalAssets->version('billing-log-popup.css')"],
        ['route', "version('billing-log-popup.css')", "version('workspace.css')"],
        ['route', '    <link rel="stylesheet" media="screen"', '    <link rel="stylesheet" media="print"'],
        ['route', '    <script src=', '    <script defer src='],
        ['route', assetLines.join('\n'), [...assetLines].reverse().join('\n')],
        ['helper', "        'billing-log-popup.css',\n", ''],
        ['helper', "        'popup.js',\n", ''],
        ['helper', "        'appointment.css',\n        'billing-log-popup.css',\n", "        'billing-log-popup.css',\n        'appointment.css',\n"],
        ['css', '@media screen {', '@media print {'],
        ['css', 'html.oe-workbench-context body.oe-billing-log {', 'body.oe-billing-log {'],
        ['css', '#edf3f4', '#000'],
        ['css', '#c9d7da', '#000'],
        ['css', 'margin: 0.75rem;', 'margin: 2rem;'],
        ['css', 'padding: 0.75rem;', 'padding: 2rem;'],
        ['css', 'border-radius: 0.5rem;', 'border-radius: 0;'],
        ['css', 'overflow-wrap: anywhere;', 'overflow-wrap: normal;'],
        ['css', '  html.oe-workbench-context body.oe-billing-log {', '  html.oe-workbench-context body.oe-billing-log {\n    font-family: Arial;'],
    ];
    for (const [field, before, after] of cases) {
        assert.deepEqual(audit(mutate(field, before, after)), [field], `${field}: ${before}`);
    }
});

test('checked-in route, helper and stylesheet match the proposed source', () => {
    assert.deepEqual(audit(current()), []);
    assert.equal(inverseRoute(read(paths.route)), originalRoute);
    assert.equal(inverseHelper(read(paths.helper)), originalHelper);
});

if (process.argv.includes('--history')) {
    test('history fixtures equal 18647270e0c799189d2dc10f801e8de2bff1a360 and the full inverse', () => {
        for (const [source, fixture, inverse] of [
            [paths.route, originalRoute, inverseRoute],
            [paths.helper, originalHelper, inverseHelper],
        ]) {
            const historical = execFileSync('git', ['show', `18647270e0c799189d2dc10f801e8de2bff1a360:${source}`], {
                cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
            });
            assert.equal(fixture, historical, `historical fixture: ${source}`);
            assert.equal(inverse(read(source)), historical, `full inverse: ${source}`);
        }
    });
}
