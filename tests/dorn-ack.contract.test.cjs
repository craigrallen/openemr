'use strict';

/**
 * OPEMR-63 DORN acknowledge-result screen source contract.
 * Portable: node --test tests/dorn-ack.contract.test.cjs
 * Local provenance: node --test tests/dorn-ack.contract.test.cjs --history
 *
 * Text only. The route's GET calls ConnectorApi::sendAck against the external
 * DORN connector, so nothing here executes, bootstraps or requests PHP. No
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
const ROUTE = 'interface/modules/custom_modules/oe-module-dorn/public/ack_lab_results.php';
const CALLER = 'interface/modules/custom_modules/oe-module-dorn/public/results.php';
const FIXTURE = 'tests/fixtures/dorn-ack-original.php.txt';
const HASH = '7ec2c52b05b9822d6af41d842bf5d2e78cd2551899c43bd6fa0747972bc222fb';
const HISTORY = process.argv.includes('--history');

const HEADER = "        <?php Header::setupHeader(['opener']);?>\n";
const TITLE = '        <title><?php echo xlt("Alert"); ?></title>\n';
const HEAD_CLOSE = '    </head>\n';
const BODY = '<body>';
const MARKED_BODY = '<body class="oe-dorn-ack-result">';
const PREFIX = 'html.oe-workbench-context body.oe-dorn-ack-result';
const RULES = [
    [PREFIX, [['background-color', 'var(--oe-wb-canvas)'], ['color', 'var(--oe-wb-ink)']]],
    [`${PREFIX} > h3`, [['background-color', 'var(--oe-wb-paper)'], ['color', 'var(--oe-wb-ink)'], ['box-shadow', 'inset 0 0 0 1px var(--oe-wb-line)']]]
];
const PALETTE = ['--oe-wb-canvas', '--oe-wb-ink', '--oe-wb-paper', '--oe-wb-line'];
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
const embed = (css) => css.split('\n').map((line) => (line ? CSS_INDENT + line : line)).join('\n');
const SEAM = `${STYLE_INDENT}<style>\n${embed(CSS)}\n${STYLE_INDENT}</style>\n`;
const BODY_RULE = embed(ruleText(RULES[0]));
const H3_RULE = embed(ruleText(RULES[1]));

// Behaviour that must survive the presentation change byte for byte.
const PRESERVED = [
    'require_once __DIR__ . "/../../../../globals.php";',
    '$session = SessionWrapperFactory::getInstance()->getActiveSession();',
    'CsrfUtils::checkCsrfInput(INPUT_GET, dieOnFail: true);',
    'CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: true);',
    "if (!AclMain::aclCheckCore('admin', 'users')) {",
    'AccessDeniedHelper::denyWithTemplate("ACL check failed for admin/users: Acknowledge Lab Results", xl("Acknowledge Lab Results"));',
    "$resultsGuid = $_REQUEST['resultGuid'];",
    "$rejectResults = $_REQUEST['rejectResults'];",
    '$rejectResults = $rejectResults == "true";',
    'ConnectorApi::sendAck($resultsGuid, $rejectResults, null);',
    HEADER,
    TITLE,
    '    <h3><?php echo xlt("Results Rejected"); ?></h3>\n',
    '        <h3><?php echo xlt("Results Accepted"); ?></h3>\n'
];
const UNCHANGED = [
    CALLER,
    'config/config.yaml',
    'src/Core/Header.php',
    'interface/clinical-workspace/popup.js',
    'interface/clinical-workspace/popup.css',
    'library/dialog.js'
];
const ALLOWED = [ROUTE, FIXTURE, 'tests/dorn-ack.contract.test.cjs', 'tests/js/dorn-ack.test.js', 'docs/clinical-ui/DORN-ACK-RESULT.md'];

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
    assert.equal(css, CSS, 'no geometry, typography, status colour, wrapper or extra CSS');
}

function verifyCandidate(source, original) {
    assert.equal(count(source, '<body'), 1, 'one body element');
    assert.equal(count(source, MARKED_BODY), 1, 'route-specific body marker');
    assert.equal(count(source, '<style'), 1, 'one inline style');
    assert.equal(count(source, '</style>'), 1, 'balanced inline style');
    assert.equal(count(source, '<script'), 0, 'no JavaScript added');
    for (const anchor of PRESERVED) assert.equal(count(source, anchor), 1, `preserved: ${anchor}`);
    const start = source.indexOf(TITLE) + TITLE.length;
    const end = source.indexOf(HEAD_CLOSE, start);
    assert.ok(end > start, 'head closes after the title');
    const region = source.slice(start, end);
    const open = `${STYLE_INDENT}<style>\n`;
    const close = `\n${STYLE_INDENT}</style>\n`;
    assert.ok(region.startsWith(open) && region.endsWith(close), 'style directly after the original title, before </head>');
    const embedded = region.slice(open.length, -close.length);
    assert.ok(embedded.split('\n').every((line) => line === '' || line.startsWith(CSS_INDENT)), 'consistent embedding');
    inspectCss(embedded.split('\n').map((line) => line.slice(CSS_INDENT.length)).join('\n'));
    assert.equal(region, SEAM, 'exact style seam');
    assert.equal(inverse(source), original, 'full inverse reproduces every original PHP, ACL, CSRF, sendAck and markup byte');
}

describe('frozen original route', () => {
    test('fixture has the base digest', () => {
        assert.equal(sha(originalBytes), HASH);
    });

    test('anchors are present once and the original has no seam', () => {
        for (const anchor of [...PRESERVED, BODY, HEAD_CLOSE]) assert.equal(count(ORIGINAL, anchor), 1, anchor);
        assert.equal(count(ORIGINAL, '<style'), 0);
        assert.equal(count(ORIGINAL, '<script'), 0);
        assert.equal(count(ORIGINAL, 'oe-dorn-ack-result'), 0);
        assert.equal(count(ORIGINAL, '<h3>'), 2);
        assert.equal(ORIGINAL.split('\n').length - 1, 66, '66-line route');
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
        assert.ok(RULES.every(([selector]) => selector.startsWith(`${PREFIX}`)));
        assert.ok(!CSS.includes('oe-workbench-popup') && !CSS.includes('print'));
    });

    const h3 = (from, to) => (s) => replaceOnce(s, H3_RULE, H3_RULE.replace(from, to));
    const bodyRule = (from, to) => (s) => replaceOnce(s, BODY_RULE, BODY_RULE.replace(from, to));
    const mutations = [
        ['missing seam', (s) => replaceOnce(s, SEAM, '')],
        ['duplicate seam', (s) => replaceOnce(s, SEAM, SEAM + SEAM)],
        ['seam before title', (s) => replaceOnce(replaceOnce(s, SEAM, ''), TITLE, SEAM + TITLE)],
        ['seam after head', (s) => replaceOnce(replaceOnce(s, SEAM, ''), HEAD_CLOSE, HEAD_CLOSE + SEAM)],
        ['missing body marker', (s) => replaceOnce(s, MARKED_BODY, BODY)],
        ['extra body class', (s) => replaceOnce(s, MARKED_BODY, '<body class="oe-dorn-ack-result body_top">')],
        ['body inline style', (s) => replaceOnce(s, MARKED_BODY, '<body class="oe-dorn-ack-result" style="margin:0">')],
        ['print media', (s) => replaceOnce(s, `${CSS_INDENT}@media screen {`, `${CSS_INDENT}@media screen, print {`)],
        ['all media', (s) => replaceOnce(s, `${CSS_INDENT}@media screen {`, `${CSS_INDENT}@media all {`)],
        ['global body rule', bodyRule(PREFIX, 'body')],
        ['no context class', h3(`${PREFIX} > h3`, 'body.oe-dorn-ack-result > h3')],
        ['popup-only context', bodyRule('oe-workbench-context', 'oe-workbench-popup')],
        ['descendant h3', h3(`${PREFIX} > h3`, `${PREFIX} h3`)],
        ['missing palette', bodyRule('var(--oe-wb-canvas)', '#f3f7f5')],
        ['different palette', bodyRule('var(--oe-wb-canvas)', 'var(--oe-wb-paper)')],
        ['unknown token', h3('var(--oe-wb-line)', 'var(--oe-wb-border)')],
        ['semantic status colour', h3('color: var(--oe-wb-ink);', 'color: var(--oe-wb-warning-ink);')],
        ['hard-coded status colour', h3('color: var(--oe-wb-ink);', 'color: green;')],
        ['geometry', h3('box-shadow: inset 0 0 0 1px var(--oe-wb-line);', 'padding: 1rem;')],
        ['extra layout', bodyRule('color: var(--oe-wb-ink);', 'color: var(--oe-wb-ink);\n                margin: 0;')],
        ['typography', h3('box-shadow: inset 0 0 0 1px var(--oe-wb-line);', 'font-size: 1rem;')],
        ['reordered declarations', bodyRule('background-color: var(--oe-wb-canvas);\n                color: var(--oe-wb-ink);', 'color: var(--oe-wb-ink);\n                background-color: var(--oe-wb-canvas);')],
        ['important', bodyRule('var(--oe-wb-canvas);', 'var(--oe-wb-canvas) !important;')],
        ['extra rule', (s) => replaceOnce(s, `${H3_RULE}\n`, `${H3_RULE}\n\n${CSS_INDENT}  ${PREFIX} p {\n${CSS_INDENT}    color: var(--oe-wb-ink);\n${CSS_INDENT}  }\n`)],
        ['inconsistent indent', (s) => replaceOnce(s, `${CSS_INDENT}@media screen {`, '@media screen {')],
        ['JavaScript', (s) => replaceOnce(s, SEAM, `${SEAM}${STYLE_INDENT}<script>document.body.focus();</script>\n`)],
        ['new wrapper', (s) => replaceOnce(s, '    <h3><?php echo xlt("Results Rejected"); ?></h3>\n', '    <div class="card"><h3><?php echo xlt("Results Rejected"); ?></h3></div>\n')],
        ['status swap', (s) => replaceOnce(s, 'xlt("Results Rejected")', 'xlt("Results Accepted")')],
        ['status text', (s) => replaceOnce(s, 'xlt("Results Accepted")', 'xlt("Accepted")')],
        ['status branch', (s) => replaceOnce(s, 'if ($rejectResults == true) {', 'if ($rejectResults) {')],
        ['ACL', (s) => replaceOnce(s, "AclMain::aclCheckCore('admin', 'users')", "AclMain::aclCheckCore('patients', 'lab')")],
        ['ACL denial', (s) => replaceOnce(s, 'AccessDeniedHelper::denyWithTemplate(', 'error_log(')],
        ['GET CSRF', (s) => replaceOnce(s, 'CsrfUtils::checkCsrfInput(INPUT_GET, dieOnFail: true);', 'CsrfUtils::checkCsrfInput(INPUT_GET, dieOnFail: false);')],
        ['POST CSRF', (s) => replaceOnce(s, '    CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: true);\n', '')],
        ['session', (s) => replaceOnce(s, '$session = SessionWrapperFactory::getInstance()->getActiveSession();\n', '')],
        ['parameter source', (s) => replaceOnce(s, "$_REQUEST['resultGuid']", "$_GET['resultGuid']")],
        ['reject parsing', (s) => replaceOnce(s, '$rejectResults == "true";', '(bool) $rejectResults;')],
        ['sendAck arguments', (s) => replaceOnce(s, 'ConnectorApi::sendAck($resultsGuid, $rejectResults, null);', 'ConnectorApi::sendAck($resultsGuid, false, null);')],
        ['sendAck removed', (s) => replaceOnce(s, '    ConnectorApi::sendAck($resultsGuid, $rejectResults, null);\n', '')],
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

    test('popup.css defines every palette token the seam uses, screen only', () => {
        const popupCss = text('interface/clinical-workspace/popup.css');
        assert.ok(popupCss.includes('@media screen {\n  html.oe-workbench-context,\n  body.workbench-active > .dialogModal {'));
        for (const token of ['--oe-wb-ink: #17343b;', '--oe-wb-line: #d9e4e2;', '--oe-wb-paper: #fff;', '--oe-wb-canvas: #f3f7f5;']) {
            assert.ok(popupCss.includes(token), token);
        }
    });

    test('real caller opens the route through dlgopen 800x750 with CSRF', () => {
        const caller = text(CALLER);
        const from = caller.indexOf('function ackResults(resultGuid, isRejected) {');
        const to = caller.indexOf('$(function () {', from);
        assert.ok(from > 0 && to > from);
        const fn = caller.slice(from, to);
        assert.ok(fn.includes("'ack_lab_results.php?resultGuid=' + encodeURIComponent(resultGuid) + '&rejectResults=' + encodeURIComponent(isRejected) + '&csrf_token_form='"));
        assert.ok(fn.includes("dlgopen(scriptTitle, '_blank', 800, 750, false, addTitle);"));
        assert.ok(fn.includes('top.restoreSession();'));
    });

    test('real popup.js marks a dlgopen iframe inside an active shell and clears on legacy mode', () => {
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
    const git = (args) => execFileSync('git', ['-c', 'core.quotepath=off', ...args], { cwd: ROOT, maxBuffer: 16 * 1024 * 1024 });
    const lines = (bytes) => bytes.toString('utf8').split('\n').filter(Boolean);
    describe('local Git provenance (--history)', () => {
        test('base commit exists and is a HEAD ancestor', () => {
            git(['cat-file', '-e', `${BASE}^{commit}`]);
            git(['merge-base', '--is-ancestor', BASE, 'HEAD']);
        });
        test('fixture and restored live route equal the base blob', () => {
            const blob = git(['show', `${BASE}:${ROUTE}`]);
            assert.equal(sha(blob), HASH);
            assert.ok(blob.equals(originalBytes), 'fixture');
            assert.ok(Buffer.from(inverse(text(ROUTE)), 'utf8').equals(blob), 'restored route');
        });
        test('caller, Header, config and popup sources equal base', () => {
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
