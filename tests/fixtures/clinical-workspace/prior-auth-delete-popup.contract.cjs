'use strict';

/**
 * OPEMR-49 source contract for the prior-authorization delete popup
 * (interface/modules/custom_modules/oe-module-prior-authorizations/public/deleter.php).
 *
 * The route is a mutating GET: admin/practice ACL, CSRF and the DELETE all run
 * before any HTML. Nothing here executes it; every check is a source comparison.
 *
 * The only approved change is a screen-only, workbench-gated <style> block
 * immediately after the existing Header popup opt-in, plus a body class marker.
 * Everything else must stay byte-identical to the frozen fixture captured at
 * master 18647270.
 *
 * Usage (dependency-free, Node only):
 *   node tests/fixtures/clinical-workspace/prior-auth-delete-popup.contract.cjs
 *   node tests/fixtures/clinical-workspace/prior-auth-delete-popup.contract.cjs --history
 *   OPEMR49_PRIOR_AUTH_HISTORY=1 node tests/fixtures/clinical-workspace/prior-auth-delete-popup.contract.cjs
 *
 * The default (portable) mode needs no Git history, so it runs in shallow CI
 * checkouts. History mode is opt-in and fails, never skips, when Git or the
 * exact base commit is unavailable.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen <craig@interconnected.au>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

const childProcess = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const BASE_SHA = '18647270e0c799189d2dc10f801e8de2bff1a360';
const HISTORY_ENV = 'OPEMR49_PRIOR_AUTH_HISTORY';

const ROUTE = 'interface/modules/custom_modules/oe-module-prior-authorizations/public/deleter.php';
const CALLER = 'interface/modules/custom_modules/oe-module-prior-authorizations/public/index.php';
const FIXTURE = 'tests/fixtures/clinical-workspace/prior-auth-deleter.master-18647270.txt';
const UNCHANGED_FILES = [
    CALLER,
    'src/Core/Header.php',
    'interface/clinical-workspace/popup.js',
    'interface/clinical-workspace/popup.css',
];
const CHANGE_SCOPE = [
    ROUTE,
    FIXTURE,
    'tests/fixtures/clinical-workspace/prior-auth-delete-popup.contract.cjs',
    'tests/js/clinical-prior-auth-delete-popup.test.js',
    'tests/Tests/Isolated/Common/ClinicalWorkspace/WorkbenchPopupHeaderfreeTest.php',
    'docs/clinical-ui/PRIOR-AUTH-DELETE-POPUP.md',
];

// Existing pin from WorkbenchPopupHeaderfreeTest: sha256 of the route with only
// the Header opt-in lines removed.
const OPT_IN_STRIPPED_DIGEST = 'd29e1fb5695eb192dbfae5e210fd2346b49f401650fbf5a3545d9fd4bdfec10b';
const OPT_IN = "<?php echo Header::setupAssets(['workbench-popup']); ?>";
const USE_HEADER = 'use OpenEMR\\Core\\Header;';

const MARKER = 'oe-prior-auth-delete-popup';
const OPT_IN_LINE = '    ' + OPT_IN + '\n';
const HEAD_CLOSE = '</head>\n';
const BODY_ORIGINAL = '<body>\n';
const BODY_APPROVED = '<body class="' + MARKER + '">\n';
const STYLE_BLOCK = [
    '    <style media="screen">',
    '        html.oe-workbench-context body.oe-prior-auth-delete-popup {',
    '          background-color: var(--oe-wb-canvas, #f3f7f5);',
    '        }',
    '',
    '        html.oe-workbench-context body.oe-prior-auth-delete-popup > p {',
    '          color: var(--oe-wb-ink, #17343b);',
    '          background-color: var(--oe-wb-paper, #fff);',
    '          box-shadow: inset 0 0 0 1px var(--oe-wb-line, #d9e4e2);',
    '        }',
    '    </style>',
    '',
].join('\n');
const ORIGINAL_SEAM = OPT_IN_LINE + HEAD_CLOSE + BODY_ORIGINAL;
const APPROVED_SEAM = OPT_IN_LINE + STYLE_BLOCK + HEAD_CLOSE + BODY_APPROVED;

const APPROVED_RULES = [
    {
        selector: 'html.oe-workbench-context body.oe-prior-auth-delete-popup',
        declarations: ['background-color: var(--oe-wb-canvas, #f3f7f5);'],
    },
    {
        selector: 'html.oe-workbench-context body.oe-prior-auth-delete-popup > p',
        declarations: [
            'color: var(--oe-wb-ink, #17343b);',
            'background-color: var(--oe-wb-paper, #fff);',
            'box-shadow: inset 0 0 0 1px var(--oe-wb-line, #d9e4e2);',
        ],
    },
];

// Lines of the original route that carry security, backend, message, title and
// viewport behaviour. Each must appear exactly once, in this order.
const PRESERVED_LINES = [
    "require_once dirname(__FILE__, 5) . '/globals.php';",
    "if (!AclMain::aclCheckCore('admin', 'practice')) {",
    "    echo xlt('Unauthorized');",
    '    die;',
    '$session = SessionWrapperFactory::getInstance()->getActiveSession();',
    'CsrfUtils::checkCsrfInput(INPUT_GET, dieOnFail: true);',
    'sqlQuery("delete from `module_prior_authorizations` where `id` = ?", [$_GET[\'id\']]);',
    '?>',
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '    <meta charset="UTF-8">',
    '    <meta name="viewport"',
    '          content="width=device-width, user-scalable=no, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0">',
    '    <meta http-equiv="X-UA-Compatible" content="ie=edge">',
    "    <title><?php echo xlt('Delete Record') ?></title>",
    OPT_IN_LINE.trimEnd(),
    '</head>',
    '    <p><?php echo "<br> <br>" .  xlt("If you are seeing this message the record was deleted. Click done, pls"); ?></p>',
    '</body>',
    '</html>',
];

// The real caller: removeEntry opens the route in a 290x290 dlgopen with an
// external Done danger button and refreshes the manager on close.
const CALLER_REMOVE_ENTRY = [
    '        function removeEntry(id) {',
    "            let url = 'deleter.php?id=' + encodeURIComponent(id) + '&csrf_token_form=' + <?php echo js_url(CsrfUtils::collectCsrfToken(session: $session)); ?>;",
    '            ;',
    "            dlgopen(url, '_blank', 290, 290, '', 'Delete Entry', {",
    '                buttons: [',
    "                    {text: <?php echo xlj('Done') ?>, style: 'danger btn-sm', close: true}",
    '                ],',
    "                onClosed: 'refreshme'",
    '            })',
    '        }',
    '',
].join('\n');
const CALLER_REFRESH = [
    '        function refreshme() {',
    '            top.restoreSession();',
    '            location.reload();',
    '        }',
    '',
].join('\n');

/**
 * Unapproved edits applied to the synthetic approved candidate. Each search
 * string must occur exactly once in the candidate.
 */
const MUTANTS = [
    // Presentation block and body marker.
    ['style block missing', STYLE_BLOCK, ''],
    ['body marker missing', BODY_APPROVED, BODY_ORIGINAL],
    ['block relocated after </head>', STYLE_BLOCK + HEAD_CLOSE, HEAD_CLOSE + STYLE_BLOCK],
    ['block relocated before opt-in', OPT_IN_LINE + STYLE_BLOCK, STYLE_BLOCK + OPT_IN_LINE],
    ['block duplicated', STYLE_BLOCK, STYLE_BLOCK + STYLE_BLOCK],
    ['blank line between rules removed', '        }\n\n        html', '        }\n        html'],
    ['declaration indentation changed', '          background-color: var(--oe-wb-canvas, #f3f7f5);\n', '        background-color: var(--oe-wb-canvas, #f3f7f5);\n'],
    ['closing brace dropped', '          box-shadow: inset 0 0 0 1px var(--oe-wb-line, #d9e4e2);\n        }\n', '          box-shadow: inset 0 0 0 1px var(--oe-wb-line, #d9e4e2);\n'],
    ['media widened to all', '<style media="screen">', '<style media="all">'],
    ['media removed', '<style media="screen">', '<style>'],
    ['canvas fallback changed', 'var(--oe-wb-canvas, #f3f7f5)', 'var(--oe-wb-canvas, #fff)'],
    ['ink token changed', 'color: var(--oe-wb-ink, #17343b);', 'color: var(--oe-wb-muted, #526a70);'],
    ['paper token swapped', 'background-color: var(--oe-wb-paper, #fff);', 'background-color: var(--oe-wb-canvas, #f3f7f5);'],
    ['box shadow removed', '          box-shadow: inset 0 0 0 1px var(--oe-wb-line, #d9e4e2);\n', ''],
    ['important added', 'var(--oe-wb-line, #d9e4e2);', 'var(--oe-wb-line, #d9e4e2) !important;'],
    ['padding added', '          background-color: var(--oe-wb-paper, #fff);\n', '          background-color: var(--oe-wb-paper, #fff);\n          padding: 1rem;\n'],
    ['margin added', '          background-color: var(--oe-wb-canvas, #f3f7f5);\n', '          background-color: var(--oe-wb-canvas, #f3f7f5);\n          margin: 0;\n'],
    ['font added', '          color: var(--oe-wb-ink, #17343b);\n', '          color: var(--oe-wb-ink, #17343b);\n          font-family: Arial, sans-serif;\n'],
    ['workbench gate dropped', 'html.oe-workbench-context body.oe-prior-auth-delete-popup {', 'body.oe-prior-auth-delete-popup {'],
    ['child combinator widened', 'body.oe-prior-auth-delete-popup > p {', 'body.oe-prior-auth-delete-popup p {'],
    // Added assets, styles and JS.
    ['stylesheet link added', '    </style>\n', '    </style>\n    <link rel="stylesheet" href="extra.css">\n'],
    ['head script added', '    </style>\n', '    </style>\n    <script src="extra.js"></script>\n'],
    ['body script added', BODY_APPROVED, BODY_APPROVED + '    <script>window.close();</script>\n'],
    ['second asset bundle', "Header::setupAssets(['workbench-popup'])", "Header::setupAssets(['workbench-popup', 'no-bootstrap'])"],
    ['setupHeader added', OPT_IN_LINE, '    <?php Header::setupHeader(); ?>\n' + OPT_IN_LINE],
    // Body marker variants.
    ['body class extended', '<body class="oe-prior-auth-delete-popup">', '<body class="oe-prior-auth-delete-popup container">'],
    ['body attribute added', '<body class="oe-prior-auth-delete-popup">', '<body class="oe-prior-auth-delete-popup" onload="window.close()">'],
    ['body class single-quoted', '<body class="oe-prior-auth-delete-popup">', "<body class='oe-prior-auth-delete-popup'>"],
    ['marker copied onto html', '<html lang="en">', '<html lang="en" class="oe-prior-auth-delete-popup">'],
    ['paragraph class added', '    <p><?php', '    <p class="m-2"><?php'],
    // Security, SQL, CSRF, session, message, title, viewport.
    ['acl permission changed', "aclCheckCore('admin', 'practice')", "aclCheckCore('admin', 'super')"],
    ['acl check inverted', 'if (!AclMain::', 'if (AclMain::'],
    ['unauthorized message changed', "echo xlt('Unauthorized');", "echo xlt('Not allowed');"],
    ['unauthorized die removed', '    die;\n', ''],
    ['bootstrap depth changed', "dirname(__FILE__, 5) . '/globals.php'", "dirname(__FILE__, 4) . '/globals.php'"],
    ['csrf source changed', 'checkCsrfInput(INPUT_GET', 'checkCsrfInput(INPUT_POST'],
    ['csrf no longer dies', 'dieOnFail: true', 'dieOnFail: false'],
    ['csrf check removed', 'CsrfUtils::checkCsrfInput(INPUT_GET, dieOnFail: true);\n', ''],
    ['delete table changed', '`module_prior_authorizations`', '`module_prior_authorizations_archive`'],
    ['delete scope widened', 'where `id` = ?', 'where `id` >= ?'],
    ['delete id source changed', "[$_GET['id']]", "[$_REQUEST['id']]"],
    ['session line removed', '$session = SessionWrapperFactory::getInstance()->getActiveSession();\n', ''],
    ['message text changed', 'Click done, pls', 'Click Done'],
    ['message spacing removed', '"<br> <br>" .  ', ''],
    ['title changed', "xlt('Delete Record')", "xlt('Delete Prior Authorization')"],
    ['viewport scaling changed', 'user-scalable=no', 'user-scalable=yes'],
    ['document language changed', '<html lang="en">', '<html lang="sv">'],
];

function count(haystack, needle) {
    if (needle === '') {
        throw new Error('count() needs a non-empty needle');
    }
    return haystack.split(needle).length - 1;
}

function replaceOnce(haystack, search, replacement) {
    if (count(haystack, search) !== 1) {
        throw new Error('replaceOnce() anchor is not unique: ' + JSON.stringify(search));
    }
    return haystack.split(search).join(replacement);
}

function read(relative) {
    return fs.readFileSync(path.join(ROOT, relative), 'utf8');
}

function sha256(text) {
    return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

/** Mirror of WorkbenchPopupHeaderfreeTest::withoutOptIn(). */
function withoutOptIn(source) {
    return source
        .split(/(?<=\n)/)
        .filter((line) => ![OPT_IN, USE_HEADER].includes(line.trim()))
        .join('');
}

/** Build the exact approved future route from the frozen original. */
function applyPresentation(original) {
    return replaceOnce(original, ORIGINAL_SEAM, APPROVED_SEAM);
}

/**
 * Strict inverse: remove the approved presentation once, as one seam.
 * Returns null for any missing, relocated, duplicated or malformed block.
 */
function restorePresentation(candidate) {
    if (count(candidate, APPROVED_SEAM) !== 1 || count(candidate, STYLE_BLOCK) !== 1) {
        return null;
    }
    const restored = candidate.split(APPROVED_SEAM).join(ORIGINAL_SEAM);
    for (const residue of [MARKER, '<style', '</style', 'media=']) {
        if (restored.includes(residue)) {
            return null;
        }
    }
    return restored;
}

/**
 * Mirror of the PHP shared-test normalizer: identity when no trace of the
 * presentation exists, otherwise the strict inverse.
 */
function normalizeShared(source) {
    const traced = [MARKER, '<style', '</style'].some((residue) => source.includes(residue));
    return traced ? restorePresentation(source) : source;
}

/** Production acceptance: full restored-route equality plus exact candidate. */
function accepts(candidate, fixture) {
    const restored = restorePresentation(candidate);
    return restored !== null
        && restored === fixture
        && sha256(withoutOptIn(restored)) === OPT_IN_STRIPPED_DIGEST
        && candidate === applyPresentation(fixture);
}

function firstDifference(actual, expected) {
    const a = actual.split('\n');
    const e = expected.split('\n');
    for (let i = 0; i < Math.max(a.length, e.length); i++) {
        if (a[i] !== e[i]) {
            return 'line ' + (i + 1) + ': expected ' + JSON.stringify(e[i]) + ', got ' + JSON.stringify(a[i]);
        }
    }
    return 'no line difference';
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function assertSameSource(actual, expected, label) {
    assert(actual === expected, label + ' differs (' + firstDifference(actual, expected) + ')');
}

function parseRules(block) {
    const body = block.replace(/^ {4}<style media="screen">\n/, '').replace(/ {4}<\/style>\n$/, '');
    const rules = [];
    const pattern = /^ {8}([^\n{}]+) \{\n((?: {10}[^\n]+\n)+) {8}\}\n/gm;
    let match;
    while ((match = pattern.exec(body)) !== null) {
        rules.push({
            selector: match[1],
            declarations: match[2].split('\n').filter(Boolean).map((line) => line.trim()),
        });
    }
    return { rules, leftover: body.replace(pattern, '') };
}

function portableChecks() {
    const fixture = () => read(FIXTURE);
    const live = () => read(ROUTE);
    const candidate = () => applyPresentation(fixture());

    const checks = [
        ['frozen fixture matches the existing opt-in-stripped pin', () => {
            assert(sha256(withoutOptIn(fixture())) === OPT_IN_STRIPPED_DIGEST, 'fixture digest drifted from ' + OPT_IN_STRIPPED_DIGEST);
        }],
        ['frozen fixture keeps every security, message, title and viewport line in order', () => {
            const lines = fixture().split('\n');
            let cursor = -1;
            for (const expected of PRESERVED_LINES) {
                assert(lines.filter((line) => line === expected).length === 1, 'fixture line not unique: ' + JSON.stringify(expected));
                const at = lines.indexOf(expected);
                assert(at > cursor, 'fixture line out of order: ' + JSON.stringify(expected));
                cursor = at;
            }
            const html = fixture().indexOf('<!doctype html>');
            for (const backend of ["AclMain::aclCheckCore('admin', 'practice')", 'CsrfUtils::checkCsrfInput(INPUT_GET, dieOnFail: true);', 'sqlQuery("delete from']) {
                const at = fixture().indexOf(backend);
                assert(at >= 0 && at < html, 'backend step must run before HTML: ' + backend);
            }
        }],
        ['frozen fixture is the untouched original seam', () => {
            assert(count(fixture(), ORIGINAL_SEAM) === 1, 'original opt-in/head/body seam missing');
            for (const residue of [MARKER, '<style', '</style', '<script', '<link']) {
                assert(!fixture().includes(residue), 'fixture already contains ' + residue);
            }
        }],
        ['approved block has exactly two screen-only workbench-gated rules', () => {
            const block = STYLE_BLOCK;
            assert(count(block, '<style media="screen">') === 1, 'block must open with one screen-only style tag');
            assert(count(block, '        }\n\n        html') === 1, 'rules must be separated by one blank line');
            const { rules, leftover } = parseRules(block);
            assert(leftover === '\n', 'unexpected text between rules: ' + JSON.stringify(leftover));
            assert(JSON.stringify(rules) === JSON.stringify(APPROVED_RULES), 'rules differ from the approved selectors/declarations');
            for (const forbidden of ['padding', 'margin', 'font', 'width', 'height', 'border', '!important', 'url(', '@import']) {
                assert(!block.includes(forbidden), 'approved block must not contain ' + forbidden);
            }
        }],
        ['untouched original normalizes to itself in the shared verifier', () => {
            assertSameSource(normalizeShared(fixture()), fixture(), 'shared normalization of the untouched route');
            assert(restorePresentation(fixture()) === null, 'strict inverse must reject a route without the presentation');
            assert(!accepts(fixture(), fixture()), 'untouched route must not satisfy production acceptance');
        }],
        ['synthetic candidate restores byte-for-byte to the frozen route', () => {
            assert(candidate() !== fixture(), 'candidate must differ from the original');
            assertSameSource(restorePresentation(candidate()), fixture(), 'strict inverse of the candidate');
            assertSameSource(normalizeShared(candidate()), fixture(), 'shared normalization of the candidate');
            assert(accepts(candidate(), fixture()), 'candidate must satisfy production acceptance');
        }],
        ['live route equals the approved presentation candidate', () => {
            assertSameSource(live(), candidate(), ROUTE);
        }],
        ['live route restores byte-for-byte to the frozen route', () => {
            const restored = restorePresentation(live());
            assert(restored !== null, 'live route does not carry exactly one approved presentation seam');
            assertSameSource(restored, fixture(), 'restored live route');
            assert(accepts(live(), fixture()), 'live route fails production acceptance');
        }],
        ['caller keeps removeEntry dlgopen 290x290, Done danger button and refreshme', () => {
            const caller = read(CALLER);
            assert(count(caller, CALLER_REMOVE_ENTRY) === 1, 'removeEntry block changed');
            assert(count(caller, CALLER_REFRESH) === 1, 'refreshme block changed');
            assert(count(caller, 'deleter.php') === 1, 'caller must reach deleter.php exactly once');
        }],
    ];

    for (const [label, search, replacement] of MUTANTS) {
        checks.push(['mutant rejected: ' + label, () => checkMutant(candidate(), fixture(), search, replacement)]);
    }

    return checks;
}

function checkMutant(candidate, fixture, search, replacement) {
    // Preconditions, outside the expected-failure assertion.
    assert(accepts(candidate, fixture), 'baseline candidate must be accepted before mutation');
    assert(count(candidate, search) === 1, 'mutant anchor must be unique: ' + JSON.stringify(search));
    const edited = replaceOnce(candidate, search, replacement);
    assert(edited !== candidate, 'mutant must actually change the candidate');
    // Expected failure.
    assert(!accepts(edited, fixture), 'mutant was accepted');
    const normalized = normalizeShared(edited);
    assert(normalized === null || normalized !== fixture, 'mutant restores to the frozen route in the shared verifier');
}

function git(args) {
    const result = childProcess.spawnSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (result.error) {
        throw new Error('git ' + args.join(' ') + ' could not run: ' + result.error.message);
    }
    if (result.status !== 0) {
        throw new Error('git ' + args.join(' ') + ' failed: ' + result.stderr.trim());
    }
    return result.stdout;
}

function historyChecks() {
    return [
        ['history: base commit resolves to the exact verified SHA', () => {
            const resolved = git(['rev-parse', '--verify', BASE_SHA + '^{commit}']).trim();
            assert(resolved === BASE_SHA, 'base resolved to ' + resolved);
        }],
        ['history: frozen fixture equals the base route', () => {
            assertSameSource(read(FIXTURE), git(['show', BASE_SHA + ':' + ROUTE]), FIXTURE);
        }],
        ['history: live route inverse equals the base route', () => {
            const restored = restorePresentation(read(ROUTE));
            assert(restored !== null, 'live route does not carry exactly one approved presentation seam');
            assertSameSource(restored, git(['show', BASE_SHA + ':' + ROUTE]), 'restored live route');
        }],
        ['history: caller, Header, popup.js and popup.css unchanged from base', () => {
            for (const file of UNCHANGED_FILES) {
                assertSameSource(read(file), git(['show', BASE_SHA + ':' + file]), file);
            }
        }],
        ['history: change scope stays inside the OPEMR-49 whitelist', () => {
            const changed = git(['diff', '--name-only', BASE_SHA, '--'])
                .concat(git(['ls-files', '--others', '--exclude-standard']))
                .split('\n')
                .filter(Boolean);
            const outside = [...new Set(changed)].filter((file) => !CHANGE_SCOPE.includes(file));
            assert(outside.length === 0, 'changes outside scope: ' + outside.join(', '));
        }],
    ];
}

function historyRequested(argv, env) {
    return argv.includes('--history') || env[HISTORY_ENV] === '1';
}

function run(checks) {
    const failures = [];
    for (const [label, check] of checks) {
        try {
            check();
            process.stdout.write('ok - ' + label + '\n');
        } catch (error) {
            failures.push(label);
            process.stdout.write('not ok - ' + label + '\n    ' + error.message + '\n');
        }
    }
    process.stdout.write(checks.length - failures.length + '/' + checks.length + ' passed\n');
    return failures.length === 0;
}

module.exports = {
    APPROVED_SEAM,
    BASE_SHA,
    HISTORY_ENV,
    MUTANTS,
    ORIGINAL_SEAM,
    STYLE_BLOCK,
    accepts,
    applyPresentation,
    historyChecks,
    historyRequested,
    normalizeShared,
    portableChecks,
    restorePresentation,
    withoutOptIn,
};

if (require.main === module) {
    const checks = portableChecks().concat(historyRequested(process.argv.slice(2), process.env) ? historyChecks() : []);
    process.exitCode = run(checks) ? 0 : 1;
}
