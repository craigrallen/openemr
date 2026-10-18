// Bounded source contracts for the proposed CouchDB log popup. These tests do not
// execute PHP, open a popup, read a log, or prove native ACL/theme behaviour.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');
const { createHash } = require('node:crypto');

const root = join(__dirname, '../..');
const paths = {
    route: 'interface/couchdb/couchdb_log.php',
    assets: 'src/Common/Assets/ClinicalWorkspaceAssets.php',
    css: 'interface/clinical-workspace/couchdb-log-popup.css',
    caller: 'interface/logview/logview.php',
    popup: 'interface/clinical-workspace/popup.js',
    originalRoute: 'tests/clinical-ui/fixtures/couchdb-log-original.php.txt',
    originalAssets: 'tests/clinical-ui/fixtures/clinical-workspace-assets-original.php.txt',
};
const read = (path) => readFileSync(join(root, path), 'utf8');
const readOptional = (path) => existsSync(join(root, path)) ? read(path) : '';
const sha256 = (source) => createHash('sha256').update(source).digest('hex');

function replaceOnce(source, before, after) {
    assert.equal(source.split(before).length, 2, `fixture anchor must occur once: ${before}`);
    return source.replace(before, after);
}

const originalRoute = read(paths.originalRoute);
const originalAssets = read(paths.originalAssets);
const originalCaller = read(paths.caller);
const originalPopup = read(paths.popup);

// This is the whole proposed route, derived from all 34 frozen original lines.
// The only replacements are imports/gate/head/wrappers and the two HTML closes.
const originalRouteHead = 'use OpenEMR\\BC\\ServiceContainer;\nuse OpenEMR\\Core\\OEGlobalsBag;\n\n$filename';
const proposedRouteHead = `use OpenEMR\\BC\\ServiceContainer;
use OpenEMR\\Common\\Acl\\AccessDeniedHelper;
use OpenEMR\\Common\\Acl\\AclMain;
use OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;
use OpenEMR\\Core\\OEGlobalsBag;

if (!AclMain::aclCheckCore('admin', 'users')) {
    AccessDeniedHelper::denyWithTemplate('ACL check failed for admin/users: CouchDB log', xl('Logs Viewer'));
}

$clinicalAssets = new ClinicalWorkspaceAssets();
?>
<!doctype html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title><?php echo xlt('Logs Viewer'); ?></title>
    <link rel="stylesheet" media="screen" href="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>/interface/clinical-workspace/couchdb-log-popup.css?v=<?php echo attr_url($clinicalAssets->version('couchdb-log-popup.css')); ?>">
    <script src="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>/interface/clinical-workspace/popup.js?v=<?php echo attr_url($clinicalAssets->version('popup.js')); ?>"></script>
</head>
<body class="oe-couchdb-log">
<main class="oe-couchdb-log-sheet">
<div class="oe-couchdb-log-content">
<?php
$filename`;
const originalEmptyExit = '    echo xlt("CouchDB error log is empty");\n    exit;';
const proposedEmptyExit = `    echo xlt("CouchDB error log is empty");
    ?>
</div>
</main>
</body>
</html>
<?php
    exit;`;
const proposedRouteFooter = `?>
</div>
</main>
</body>
</html>
`;

function proposedRoute() {
    let route = replaceOnce(originalRoute, originalRouteHead, proposedRouteHead);
    route = replaceOnce(route, originalEmptyExit, proposedEmptyExit);
    return route + proposedRouteFooter;
}

function restoreOriginalRoute(route) {
    let restored = replaceOnce(route, proposedRouteHead, originalRouteHead);
    restored = replaceOnce(restored, proposedEmptyExit, originalEmptyExit);
    assert.ok(restored.endsWith(proposedRouteFooter), 'proposed route must end with the declared HTML close');
    return restored.slice(0, -proposedRouteFooter.length);
}

function proposedAssets() {
    let assets = replaceOnce(originalAssets,
        "        'calendar-workday.js',\n",
        "        'calendar-workday.js',\n        'couchdb-log-popup.css',\n");
    return replaceOnce(assets,
        "        'patient-search.css',\n",
        "        'patient-search.css',\n        'popup.js',\n");
}

const proposedCss = `/* Local CouchDB log sheet, active only in a workbench popup on screen. */
@media screen {
  html.oe-workbench-context body.oe-couchdb-log {
    background: var(--oe-wb-canvas, #edf3f4);
    color: var(--oe-wb-ink, #17343b);
  }

  html.oe-workbench-context body.oe-couchdb-log main.oe-couchdb-log-sheet {
    background: var(--oe-wb-paper, #fff);
    color: var(--oe-wb-ink, #17343b);
    margin: 0.75rem;
    padding: 0.75rem;
    border: 1px solid var(--oe-wb-border, #c9d7da);
    border-radius: 0.5rem;
  }

  html.oe-workbench-context body.oe-couchdb-log .oe-couchdb-log-content {
    overflow-wrap: anywhere;
  }
}
`;

const expected = {
    route: proposedRoute(),
    assets: proposedAssets(),
    css: proposedCss,
    caller: originalCaller,
    popup: originalPopup,
};

function audit(candidate) {
    const issues = [];
    if (candidate.route !== expected.route) issues.push('route transformation');
    if (candidate.assets !== expected.assets) issues.push('asset allowlist');
    if (candidate.css !== expected.css) issues.push('scoped screen CSS');
    if (candidate.caller !== expected.caller) issues.push('caller changed');
    if (candidate.popup !== expected.popup) issues.push('popup engine changed');
    return issues;
}

function current() {
    return {
        route: read(paths.route),
        assets: read(paths.assets),
        css: readOptional(paths.css),
        caller: read(paths.caller),
        popup: read(paths.popup),
    };
}

test('frozen source fixtures have the original shape and the caller/engine remain untouched', () => {
    assert.equal(originalRoute.split('\n').length - 1, 34);
    assert.equal(originalRoute, read(paths.originalRoute));
    assert.equal(originalAssets, read(paths.originalAssets));
    assert.equal(sha256(read(paths.caller)), '3e6edcf5690b32916a0c33269c9446239450d3a20258664484609d4c4de8ab2b');
    assert.equal(sha256(read(paths.popup)), 'af967e78fef59e75d2a5a5c4e08916bbea90a7f108c67f3def027b3061dc330f');
    assert.match(originalCaller, /top\.restoreSession\(\);\s*dlgopen\('\.\.\/couchdb\/couchdb_log\.php', '_blank', 500, 400\);/);
});

test('complete proposed candidate satisfies every source contract', () => {
    assert.deepEqual(audit(expected), []);
});

test('removing only declared route additions restores every original route byte', () => {
    assert.deepEqual(Buffer.from(restoreOriginalRoute(expected.route), 'utf8'),
        readFileSync(join(root, paths.originalRoute)));
});

test('the original is missing only the proposed route, allowlist and CSS', () => {
    assert.deepEqual(audit({ ...expected, route: originalRoute, assets: originalAssets, css: '' }),
        ['route transformation', 'asset allowlist', 'scoped screen CSS']);
});

test('anchored mutations reject ACL, output, assets, scope, palette and caller drift', () => {
    // Construct all mutants before the assertions. A failed anchor cannot make a mutant pass.
    const mutants = [
        [{ ...expected, route: replaceOnce(expected.route, "'admin', 'users'", "'patients', 'med'") }, 'route transformation'],
        [{ ...expected, route: replaceOnce(expected.route, "if (!AclMain::aclCheckCore('admin', 'users')) {\n    AccessDeniedHelper::denyWithTemplate('ACL check failed for admin/users: CouchDB log', xl('Logs Viewer'));\n}\n\n", '') }, 'route transformation'],
        [{ ...expected, route: replaceOnce(replaceOnce(expected.route, "$filename = OEGlobalsBag::getInstance()->get('OE_SITE_DIR') . '/documents/couchdb/log.txt';\n\n", ''), "if (!AclMain::aclCheckCore('admin', 'users')) {", "$filename = OEGlobalsBag::getInstance()->get('OE_SITE_DIR') . '/documents/couchdb/log.txt';\n\nif (!AclMain::aclCheckCore('admin', 'users')) {") }, 'route transformation'],
        [{ ...expected, route: replaceOnce(expected.route, "    exit;\n}", "    return;\n}") }, 'route transformation'],
        [{ ...expected, route: replaceOnce(expected.route, "</html>\n<?php\n    exit;", "<?php\n    exit;") }, 'route transformation'],
        [{ ...expected, route: replaceOnce(expected.route, 'echo nl2br(text($fh));', 'echo nl2br($fh);') }, 'route transformation'],
        [{ ...expected, route: replaceOnce(expected.route, "version('popup.js')", "version('mode.js')") }, 'route transformation'],
        [{ ...expected, assets: replaceOnce(expected.assets, "        'popup.js',\n", '') }, 'asset allowlist'],
        [{ ...expected, css: replaceOnce(expected.css, '@media screen {', '@media print {') }, 'scoped screen CSS'],
        [{ ...expected, css: replaceOnce(expected.css, 'html.oe-workbench-context body.oe-couchdb-log {', 'body.oe-couchdb-log {') }, 'scoped screen CSS'],
        [{ ...expected, css: replaceOnce(expected.css, '#edf3f4', '#000') }, 'scoped screen CSS'],
        [{ ...expected, css: replaceOnce(expected.css, 'overflow-wrap: anywhere;', 'overflow: hidden;') }, 'scoped screen CSS'],
        [{ ...expected, caller: replaceOnce(expected.caller, "dlgopen('../couchdb/couchdb_log.php', '_blank', 500, 400);", "dlgopen('../couchdb/couchdb_log.php', '_blank', 600, 400);") }, 'caller changed'],
    ];
    for (const [mutant, issue] of mutants) assert.deepEqual(audit(mutant), [issue]);
});

test('checked-in route matches the exact proposed transformation', () => {
    assert.deepEqual(audit(current()).filter((issue) => issue === 'route transformation'), []);
});

test('checked-in allowlist matches the exact proposed transformation', () => {
    assert.deepEqual(audit(current()).filter((issue) => issue === 'asset allowlist'), []);
});

test('checked-in CSS matches the exact scoped declaration allowlist', () => {
    assert.deepEqual(audit(current()).filter((issue) => issue === 'scoped screen CSS'), []);
});
