'use strict';

/**
 * OPEMR-64 DORN receive-results screen source contract.
 * Portable: node --test tests/dorn-receive.contract.test.cjs
 * Local provenance: node tests/dorn-receive.contract.test.cjs --history
 * (run directly; `node --test ... --history` does not forward the flag and
 * silently runs only the portable tests)
 *
 * Text only. The route's GET calls ReceiveHl7Results::receiveResults, which
 * fetches and acknowledges against the external DORN connector and writes
 * clinical results, so nothing here executes, bootstraps or requests PHP. No
 * rendering, contrast, browser or clinical acceptance is asserted.
 */
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const BASE = '18647270e0c799189d2dc10f801e8de2bff1a360';
const ROUTE = 'interface/modules/custom_modules/oe-module-dorn/public/get_lab_results.php';
const CALLER = 'interface/modules/custom_modules/oe-module-dorn/public/results.php';
const FIXTURE = 'tests/fixtures/dorn-receive-original.php.txt';
const HASH = 'e0910b5fa6fce3c9f11871f35f237b0e56ab0058570b2030a034f344644fa7b7';
const HISTORY = process.argv.includes('--history');

const HEADER = "        <?php Header::setupHeader(['opener']); ?>\n";
const TITLE = '        <title><?php echo xlt("Alert"); ?></title>\n';
const HEAD_CLOSE = '    </head>\n';
const BODY = '<body>';
const MARKED_BODY = '<body class="oe-dorn-receive-results">';
const PREFIX = 'html.oe-workbench-context body.oe-dorn-receive-results';
const RULES = [
    [PREFIX, [['background-color', 'var(--oe-wb-canvas)'], ['color', 'var(--oe-wb-ink)']]]
];
const PALETTE = ['--oe-wb-canvas', '--oe-wb-ink'];
// Standalone CSS: 2-space selectors and 4-space declarations inside @media.
const ruleText = ([selector, declarations]) => [
    `  ${selector} {`,
    ...declarations.map(([property, value]) => `    ${property}: ${value};`),
    '  }'
].join('\n');
const CSS = ['@media screen {', RULES.map(ruleText).join('\n\n'), '}'].join('\n');
// Embedded one level inside the 8-space <style>, i.e. every non-blank CSS line +12.
const STYLE_INDENT = '        ';
const CSS_INDENT = '            ';
const DECL_INDENT = `${CSS_INDENT}    `;
const embed = (css) => css.split('\n').map((line) => (line ? CSS_INDENT + line : line)).join('\n');
const SEAM = `${STYLE_INDENT}<style>\n${embed(CSS)}\n${STYLE_INDENT}</style>\n`;
const BODY_RULE = embed(ruleText(RULES[0]));

// Behaviour that must survive the presentation change byte for byte.
const PRESERVED = [
    'require_once __DIR__ . "/../../../../globals.php";',
    '    use OpenEMR\\Modules\\Dorn\\ReceiveHl7Results;\n',
    '$session = SessionWrapperFactory::getInstance()->getActiveSession();',
    'CsrfUtils::checkCsrfInput(INPUT_GET, dieOnFail: true);',
    'CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: true);',
    "if (!AclMain::aclCheckCore('admin', 'users')) {",
    'AccessDeniedHelper::denyWithTemplate("ACL check failed for admin/users: Get Lab Results", xl("Get Lab Results"));',
    "$resultsGuid = $_REQUEST['resultGuid'];",
    "$rejectResults = $_REQUEST['rejectResults'];",
    '$rejectResults = false;',
    '$hl7Results = new ReceiveHl7Results();',
    '$response = $hl7Results->receiveResults($resultsGuid, $rejectResults);',
    HEADER,
    TITLE,
    'if (isset($response) && is_array($response)) {',
    'if (count($response) > 1) {',
    `echo '<div class="alert alert-info" role="alert">';`,
    "echo xlt('Results are split.');",
    `echo '<div class="alert ' . ($resultModel->isSuccess ? 'alert-success' : 'alert-danger') . '" role="alert">';`,
    `echo '<strong>' . ($resultModel->isSuccess ? xlt('Success') : xlt('Error')) . ':</strong> ' . text("$resultModel->message");`,
    `echo '<div class="alert alert-warning" role="alert">';`,
    "echo xlt('No results to display.');"
];
const UNCHANGED = [
    CALLER,
    'config/config.yaml',
    'src/Core/Header.php',
    'interface/clinical-workspace/popup.js',
    'interface/clinical-workspace/popup.css',
    'library/dialog.js'
];
const ALLOWED = [ROUTE, FIXTURE, 'tests/dorn-receive.contract.test.cjs', 'tests/js/dorn-receive.test.js', 'docs/clinical-ui/DORN-RECEIVE-RESULTS.md'];

const read = (rel) => fs.readFileSync(path.join(ROOT, rel));
const text = (rel) => read(rel).toString('utf8');
const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const count = (source, needle) => source.split(needle).length - 1;
const originalBytes = read(FIXTURE);
const ORIGINAL = originalBytes.toString('utf8');

function replaceOnce(source, from, to) {
    assert.equal(count(source, from), 1, `anchor must be unique: ${from}`);
    const changed = source.replace(from, () => to);
    assert.notEqual(changed, source, 'mutation must change the source');
    return changed;
}

function buildCandidate(original) {
    return replaceOnce(replaceOnce(original, TITLE, TITLE + SEAM), BODY, MARKED_BODY);
}

// Removes exactly the declared style insertion and body marker; nothing else.
function inverse(source) {
    return replaceOnce(replaceOnce(source, SEAM, ''), MARKED_BODY, BODY);
}

function inspectCss(css) {
    assert.ok(!css.includes('!important'), 'no important overrides');
    assert.ok(!/\.alert|role=|\bprint\b/.test(css), 'no semantic alert, role or print selectors');
    assert.equal(count(css, '@media'), 1, 'one media wrapper');
    assert.ok(css.startsWith('@media screen {\n') && css.endsWith('\n}'), 'screen-only CSS');
    const blocks = css.slice('@media screen {\n'.length, -2).split('\n\n');
    assert.equal(blocks.length, RULES.length, 'exact rule allowlist');
    blocks.forEach((block, index) => {
        const match = /^ {2}([^\n{}]+) \{\n((?: {4}[^\n]+\n)+) {2}\}$/.exec(block);
        assert.ok(match, 'two-space selector, four-space declaration format');
        assert.equal(match[1], RULES[index][0], 'exact context-scoped selector');
        const lines = match[2].trimEnd().split('\n');
        assert.equal(lines.length, RULES[index][1].length, 'exact declaration allowlist');
        lines.forEach((line, at) => {
            const declaration = /^ {4}([a-z-]+): ([^;]+);$/.exec(line);
            assert.ok(declaration, 'declaration format');
            assert.deepEqual(declaration.slice(1), RULES[index][1][at], 'approved property and palette token');
        });
    });
    const tokens = [...css.matchAll(/var\((--[a-z-]+)\)/g)].map((m) => m[1]);
    assert.ok(tokens.every((token) => PALETTE.includes(token)), 'existing popup palette tokens only');
    assert.equal(css, CSS, 'no geometry, typography, alert/status colour, wrapper or extra CSS');
}

function verifyCandidate(source, original) {
    assert.equal(count(source, '<body'), 1, 'one body element');
    assert.equal(count(source, MARKED_BODY), 1, 'route-specific body marker');
    assert.equal(count(source, '<style'), 1, 'one inline style');
    assert.equal(count(source, '</style>'), 1, 'balanced inline style');
    assert.equal(count(source, '<script'), 0, 'no JavaScript added');
    assert.equal(count(source, 'role="alert"'), 3, 'three alert roles');
    for (const anchor of PRESERVED) assert.equal(count(source, anchor), 1, `preserved: ${anchor}`);
    const start = source.indexOf(TITLE) + TITLE.length;
    const end = source.indexOf(HEAD_CLOSE, start);
    assert.ok(start >= TITLE.length && end > start, 'head closes after the title');
    const region = source.slice(start, end);
    const open = `${STYLE_INDENT}<style>\n`;
    const close = `\n${STYLE_INDENT}</style>\n`;
    assert.ok(region.startsWith(open) && region.endsWith(close), 'style directly after the original title, before </head>');
    const embedded = region.slice(open.length, -close.length);
    assert.ok(embedded.split('\n').every((line) => line === '' || line.startsWith(CSS_INDENT)), 'consistent embedding');
    inspectCss(embedded.split('\n').map((line) => line.slice(CSS_INDENT.length)).join('\n'));
    assert.equal(region, SEAM, 'exact style seam');
    assert.equal(inverse(source), original, 'full inverse reproduces every original PHP, ACL, CSRF, receiveResults, escaping and alert byte');
}

describe('frozen original route', () => {
    test('fixture has the base digest', () => {
        assert.equal(sha(originalBytes), HASH);
    });

    test('anchors are present once and the original has no seam', () => {
        for (const anchor of [...PRESERVED, BODY, HEAD_CLOSE]) assert.equal(count(ORIGINAL, anchor), 1, anchor);
        assert.equal(count(ORIGINAL, '<style'), 0);
        assert.equal(count(ORIGINAL, '<script'), 0);
        assert.equal(count(ORIGINAL, 'oe-dorn-receive-results'), 0);
        assert.equal(count(ORIGINAL, 'role="alert"'), 3);
        assert.equal(ORIGINAL.split('\n').length - 1, 76, '76-line route');
    });
});

describe('planned presentation seam', () => {
    const candidate = buildCandidate(ORIGINAL);

    test('synthetic candidate passes and its inverse is the original', () => {
        assert.notEqual(candidate, ORIGINAL);
        assert.doesNotThrow(() => verifyCandidate(candidate, ORIGINAL));
        assert.equal(inverse(candidate), ORIGINAL);
    });

    test('untouched original is rejected', () => {
        assert.throws(() => verifyCandidate(ORIGINAL, ORIGINAL), /route-specific body marker/);
    });

    test('legacy, print and missing-context paths have no matching selector', () => {
        inspectCss(CSS);
        assert.ok(RULES.every(([selector]) => selector.startsWith('html.oe-workbench-context ')));
        assert.ok(!CSS.includes('oe-workbench-popup') && !CSS.includes('print') && !CSS.includes('.alert'));
    });

    const bodyRule = (from, to) => (s) => replaceOnce(s, BODY_RULE, BODY_RULE.replace(from, to));
    const extraRule = (selector, declaration) => (s) => replaceOnce(s, `${BODY_RULE}\n`, `${BODY_RULE}\n\n${CSS_INDENT}  ${selector} {\n${DECL_INDENT}${declaration}\n${CSS_INDENT}  }\n`);
    const mutations = [
        // Seam placement and marker.
        ['missing seam', (s) => replaceOnce(s, SEAM, '')],
        ['duplicate seam', (s) => replaceOnce(s, SEAM, SEAM + SEAM)],
        ['seam before title', (s) => replaceOnce(replaceOnce(s, SEAM, ''), TITLE, SEAM + TITLE)],
        ['seam after head', (s) => replaceOnce(replaceOnce(s, SEAM, ''), HEAD_CLOSE, HEAD_CLOSE + SEAM)],
        ['missing body marker', (s) => replaceOnce(s, MARKED_BODY, BODY)],
        ['extra body class', (s) => replaceOnce(s, MARKED_BODY, '<body class="oe-dorn-receive-results body_top">')],
        ['body inline style', (s) => replaceOnce(s, MARKED_BODY, '<body class="oe-dorn-receive-results" style="margin:0">')],
        // Media and selector scope.
        ['print media', (s) => replaceOnce(s, `${CSS_INDENT}@media screen {`, `${CSS_INDENT}@media screen, print {`)],
        ['all media', (s) => replaceOnce(s, `${CSS_INDENT}@media screen {`, `${CSS_INDENT}@media all {`)],
        ['extra print block', (s) => replaceOnce(s, `${STYLE_INDENT}</style>`, `${CSS_INDENT}@media print {\n${CSS_INDENT}  body.oe-dorn-receive-results {\n${DECL_INDENT}color: #000;\n${CSS_INDENT}  }\n${CSS_INDENT}}\n${STYLE_INDENT}</style>`)],
        ['global body rule', bodyRule(PREFIX, 'body')],
        ['no context class', bodyRule(PREFIX, 'body.oe-dorn-receive-results')],
        ['popup-only context', bodyRule('oe-workbench-context', 'oe-workbench-popup')],
        ['descendant overreach', bodyRule(`${PREFIX} {`, `${PREFIX} * {`)],
        // Palette.
        ['missing palette', bodyRule('var(--oe-wb-canvas)', '#f3f7f5')],
        ['different palette', bodyRule('var(--oe-wb-canvas)', 'var(--oe-wb-paper)')],
        ['unknown token', bodyRule('var(--oe-wb-ink)', 'var(--oe-wb-text)')],
        ['semantic status colour', bodyRule('color: var(--oe-wb-ink);', 'color: var(--oe-wb-warning-ink);')],
        ['hard-coded colour', bodyRule('color: var(--oe-wb-ink);', 'color: green;')],
        // Geometry, typography and ordering.
        ['geometry', bodyRule('color: var(--oe-wb-ink);', `color: var(--oe-wb-ink);\n${DECL_INDENT}padding: 1rem;`)],
        ['typography', bodyRule('color: var(--oe-wb-ink);', `color: var(--oe-wb-ink);\n${DECL_INDENT}font-size: 1rem;`)],
        ['font family', bodyRule('color: var(--oe-wb-ink);', `color: var(--oe-wb-ink);\n${DECL_INDENT}font-family: serif;`)],
        ['reordered declarations', bodyRule(`background-color: var(--oe-wb-canvas);\n${DECL_INDENT}color: var(--oe-wb-ink);`, `color: var(--oe-wb-ink);\n${DECL_INDENT}background-color: var(--oe-wb-canvas);`)],
        ['important', bodyRule('var(--oe-wb-canvas);', 'var(--oe-wb-canvas) !important;')],
        // Semantic alert overrides and extra rules.
        ['alert override', extraRule(`${PREFIX} .alert`, 'color: var(--oe-wb-ink);')],
        ['alert-success override', extraRule(`${PREFIX} .alert-success`, 'background-color: var(--oe-wb-canvas);')],
        ['alert geometry', extraRule(`${PREFIX} .alert`, 'margin: 0;')],
        ['global alert rule', extraRule('.alert-danger', 'color: var(--oe-wb-ink);')],
        ['role selector', extraRule(`${PREFIX} [role="alert"]`, 'color: var(--oe-wb-ink);')],
        ['wrapper rule', extraRule(`${PREFIX} > div`, 'color: var(--oe-wb-ink);')],
        ['inconsistent indent', (s) => replaceOnce(s, `${CSS_INDENT}@media screen {`, '@media screen {')],
        // Markup additions.
        ['JavaScript', (s) => replaceOnce(s, SEAM, `${SEAM}${STYLE_INDENT}<script>document.body.focus();</script>\n`)],
        ['new wrapper', (s) => replaceOnce(s, '    <?php\n    if (isset($response)', '    <div class="card">\n    <?php\n    if (isset($response)')],
        // Semantic alert classes, roles, text and branches.
        ['info class', (s) => replaceOnce(s, 'alert alert-info', 'alert alert-primary')],
        ['success class', (s) => replaceOnce(s, "'alert-success' : 'alert-danger'", "'alert-primary' : 'alert-danger'")],
        ['danger class', (s) => replaceOnce(s, "'alert-success' : 'alert-danger'", "'alert-success' : 'alert-warning'")],
        ['status swap', (s) => replaceOnce(s, "'alert-success' : 'alert-danger'", "'alert-danger' : 'alert-success'")],
        ['warning class', (s) => replaceOnce(s, 'alert alert-warning', 'alert alert-secondary')],
        ['warning role removed', (s) => replaceOnce(s, 'class="alert alert-warning" role="alert"', 'class="alert alert-warning"')],
        ['info role changed', (s) => replaceOnce(s, 'class="alert alert-info" role="alert"', 'class="alert alert-info" role="status"')],
        ['result role removed', (s) => replaceOnce(s, `. '" role="alert">';`, `. '">';`)],
        ['success text', (s) => replaceOnce(s, "xlt('Success')", "xlt('Done')")],
        ['error text', (s) => replaceOnce(s, "xlt('Error')", "xlt('Failed')")],
        ['split text', (s) => replaceOnce(s, "xlt('Results are split.')", "xlt('Split.')")],
        ['empty text', (s) => replaceOnce(s, "xlt('No results to display.')", "xlt('Nothing.')")],
        ['message escaping', (s) => replaceOnce(s, 'text("$resultModel->message")', '$resultModel->message')],
        ['translation escaping', (s) => replaceOnce(s, "echo xlt('No results to display.');", "echo xl('No results to display.');")],
        ['split condition', (s) => replaceOnce(s, 'count($response) > 1', 'count($response) > 0')],
        ['response guard', (s) => replaceOnce(s, 'isset($response) && is_array($response)', 'is_array($response ?? null)')],
        // Security and result processing.
        ['ACL', (s) => replaceOnce(s, "AclMain::aclCheckCore('admin', 'users')", "AclMain::aclCheckCore('patients', 'lab')")],
        ['ACL denial', (s) => replaceOnce(s, 'AccessDeniedHelper::denyWithTemplate(', 'error_log(')],
        ['GET CSRF', (s) => replaceOnce(s, 'CsrfUtils::checkCsrfInput(INPUT_GET, dieOnFail: true);', 'CsrfUtils::checkCsrfInput(INPUT_GET, dieOnFail: false);')],
        ['POST CSRF', (s) => replaceOnce(s, '    CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: true);\n', '')],
        ['session', (s) => replaceOnce(s, '$session = SessionWrapperFactory::getInstance()->getActiveSession();\n', '')],
        ['parameter source', (s) => replaceOnce(s, "$_REQUEST['resultGuid']", "$_GET['resultGuid']")],
        ['reject default', (s) => replaceOnce(s, '$rejectResults = false;', '$rejectResults = true;')],
        ['receiveResults arguments', (s) => replaceOnce(s, 'receiveResults($resultsGuid, $rejectResults)', 'receiveResults($resultsGuid, false)')],
        ['receiveResults removed', (s) => replaceOnce(s, '    $response = $hl7Results->receiveResults($resultsGuid, $rejectResults);\n', '')],
        ['receiver import removed', (s) => replaceOnce(s, '    use OpenEMR\\Modules\\Dorn\\ReceiveHl7Results;\n', '')],
        ['popup opt-out', (s) => replaceOnce(s, "Header::setupHeader(['opener']);", "Header::setupHeader(['opener', 'no_workbench-popup']);")],
        ['PHP import', (s) => replaceOnce(s, '    use OpenEMR\\Core\\Header;\n', '    use OpenEMR\\Core\\Header;\n    use OpenEMR\\Core\\OEGlobalsBag;\n')],
        ['title', (s) => replaceOnce(s, 'xlt("Alert")', 'xlt("Results")')]
    ];
    for (const [name, mutate] of mutations) {
        test(`rejects ${name}`, () => {
            const changed = mutate(candidate);
            assert.notEqual(changed, candidate);
            assert.throws(() => verifyCandidate(changed, ORIGINAL));
        });
    }
});

describe('unchanged activation chain (text only)', () => {
    test('Header autoloads workbench-popup and the route does not opt out', () => {
        const header = text('src/Core/Header.php');
        const config = text('config/config.yaml');
        assert.ok(header.includes('self::setupAssets(is_array($assets) ? $assets : [$assets], true)'));
        assert.ok(header.includes("$autoload = $opts['autoload'] ?? false;"));
        assert.ok(header.includes('if (in_array("no_" . $k, $selectedAssets)) {'));
        assert.ok(config.includes("  workbench-popup:\n    basePath: '%webroot%/interface/clinical-workspace/'\n    script: popup.js\n    link: popup.css\n    autoload: true\n"));
        assert.ok(config.includes("  opener:\n    basePath: '%webroot%/interface/main/tabs/js/'\n    script: include_opener.js\n"));
        assert.ok(ORIGINAL.includes(HEADER) && !ORIGINAL.includes('no_workbench-popup'));
    });

    test('popup.css defines both palette tokens the seam uses, screen only', () => {
        const popupCss = text('interface/clinical-workspace/popup.css');
        assert.ok(popupCss.includes('@media screen {\n  html.oe-workbench-context,\n  body.workbench-active > .dialogModal {'));
        for (const token of ['--oe-wb-ink: #17343b;', '--oe-wb-canvas: #f3f7f5;']) {
            assert.ok(popupCss.includes(token), token);
        }
    });

    test('real caller opens the route through dlgopen 800x750 with CSRF', () => {
        const caller = text(CALLER);
        const from = caller.indexOf('function getResults(resultGuid) {');
        const to = caller.indexOf('function ackResults(', from);
        assert.ok(from > 0 && to > from);
        const fn = caller.slice(from, to);
        assert.ok(fn.includes("'get_lab_results.php?resultGuid=' + encodeURIComponent(resultGuid) + '&csrf_token_form='"));
        assert.ok(fn.includes("dlgopen(scriptTitle, '_blank', 800, 750, false, addTitle);"));
        assert.ok(fn.includes('top.restoreSession();'));
    });

    // Synthetic only: popup.js runs in a vm sandbox against stub windows. This
    // is not runtime, browser or route evidence.
    test('synthetic popup.js marks a dlgopen iframe inside an active shell and clears on legacy mode', () => {
        const classes = (...initial) => {
            const values = new Set(initial);
            return { contains: (n) => values.has(n), add: (n) => values.add(n), remove: (n) => values.delete(n) };
        };
        const listeners = new Map();
        const shell = { location: { origin: 'https://emr.test' }, closed: false, document: { body: { classList: classes('workbench-active') } } };
        shell.parent = shell;
        const html = { classList: classes() };
        const frame = {
            parent: shell, opener: null, frameElement: { closest: (sel) => (sel === '.dialogModal' ? {} : null) },
            location: { origin: 'https://emr.test' },
            document: { documentElement: html, readyState: 'complete' },
            addEventListener: (name, cb) => listeners.set(name, cb)
        };
        let sync;
        const ctx = vm.createContext({ module: { exports: {} } });
        vm.runInContext(text('interface/clinical-workspace/popup.js'), ctx);
        const controller = ctx.module.exports.createPopupController({ win: frame, observe: (_b, cb) => { sync = cb; return { disconnect() {} }; } });
        assert.equal(controller.active, true);
        assert.ok(html.classList.contains('oe-workbench-context'));
        shell.document.body.classList.remove('workbench-active');
        sync();
        assert.ok(!html.classList.contains('oe-workbench-context'));
        listeners.get('pagehide')();
    });
});

test('live route contains exactly the approved presentation delta', () => {
    verifyCandidate(text(ROUTE), ORIGINAL);
});

if (HISTORY) {
    const git = (args) => execFileSync('git', ['-c', 'core.quotepath=off', ...args], { cwd: ROOT, maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
    const lines = (bytes) => bytes.toString('utf8').split('\n').filter(Boolean);
    describe('local Git provenance (--history)', () => {
        test('base commit exists and is a HEAD ancestor', () => {
            assert.doesNotThrow(() => git(['cat-file', '-e', `${BASE}^{commit}`]), 'base commit missing: --history requires full Git history');
            assert.doesNotThrow(() => git(['merge-base', '--is-ancestor', BASE, 'HEAD']), 'base is not an ancestor of HEAD');
        });
        test('fixture and restored live route equal the base blob', () => {
            const blob = git(['show', `${BASE}:${ROUTE}`]);
            assert.equal(sha(blob), HASH);
            assert.ok(blob.equals(originalBytes), 'fixture');
            assert.ok(Buffer.from(inverse(text(ROUTE)), 'utf8').equals(blob), 'restored route');
        });
        test('caller, Header, config, popup and dialog sources equal base', () => {
            for (const rel of UNCHANGED) assert.ok(read(rel).equals(git(['show', `${BASE}:${rel}`])), rel);
        });
        test('exactly the five intended files changed, including the untracked doc', () => {
            const changed = new Set([
                ...lines(git(['diff', '--name-only', '--no-renames', BASE])),
                ...lines(git(['ls-files', '--others', '--exclude-standard']))
            ]);
            assert.deepEqual([...changed].sort(), [...ALLOWED].sort());
        });
    });
}

module.exports = { buildCandidate, verifyCandidate, inverse, SEAM, MARKED_BODY };
