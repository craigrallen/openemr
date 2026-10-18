/*
 * OPEMR-46 patient note print popup: portable source contract.
 *
 * Dependency-free (node:test + node:assert). The verifier undoes ONLY the
 * declared additions to pnotes_print.php and ClinicalWorkspaceAssets.php and
 * compares every remaining byte with the frozen originals in ./fixtures, then
 * checks the screen-only sheet against an exact rule/declaration list.
 *
 * Default runs touch no git history, network, database or browser. Setting
 * PNOTES_PRINT_HISTORY=1 adds mandatory local-history checks against the
 * verified base commit.
 *
 * Run: node --test tests/clinical-ui/pnotes-print-popup.test.cjs
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '../..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const exists = file => fs.existsSync(path.join(ROOT, file));
const count = (text, part) => text.split(part).length - 1;

const BASE_SHA = '18647270e0c799189d2dc10f801e8de2bff1a360';
const ROUTE = 'interface/patient_file/summary/pnotes_print.php';
const HELPER = 'src/Common/Assets/ClinicalWorkspaceAssets.php';
const CSS = 'interface/clinical-workspace/pnotes-print-popup.css';
const ROUTE_FIXTURE = 'tests/clinical-ui/fixtures/pnotes-print-original.php.txt';
const HELPER_FIXTURE = 'tests/clinical-ui/fixtures/pnotes-print-assets-original.php.txt';

const originalRoute = () => read(ROUTE_FIXTURE);
const originalHelper = () => read(HELPER_FIXTURE);

// ---------------------------------------------------------------------------
// Declared additions. Each entry is [original, with-addition]; nothing else in
// either file may change.
// ---------------------------------------------------------------------------

const LINK = '<link rel="stylesheet" media="screen" href="'
    + '<?php echo attr(\\OpenEMR\\Core\\OEGlobalsBag::getInstance()->getWebRoot()); ?>'
    + '/interface/clinical-workspace/pnotes-print-popup.css?v='
    + "<?php echo attr_url((new ClinicalWorkspaceAssets())->version('pnotes-print-popup.css')); ?>"
    + '">';

const ROUTE_ADDITIONS = [
    [
        'use OpenEMR\\Common\\Acl\\AclMain;\nuse OpenEMR\\Core\\Header;',
        'use OpenEMR\\Common\\Acl\\AclMain;\nuse OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;\nuse OpenEMR\\Core\\Header;',
    ],
    [
        '<?php Header::setupHeader(); ?>\n</head>',
        `<?php Header::setupHeader(); ?>\n${LINK}\n</head>`,
    ],
    [
        '<body class="body_top">\n\n<p><?php echo "<b>" .',
        '<body class="body_top oe-pnotes-print">\n\n<div class="oe-pnotes-print-sheet">\n<p><?php echo "<b>" .',
    ],
    [
        '<p><?php echo nl2br(text($body)); ?></p>\n\n<script>',
        '<p><?php echo nl2br(text($body)); ?></p>\n</div>\n\n<script>',
    ],
];

const HELPER_ADDITIONS = [
    [
        "        'patient-search.css',\n        'soap-document.css',",
        "        'patient-search.css',\n        'pnotes-print-popup.css',\n        'soap-document.css',",
    ],
];

const CSS_EXPECTED = {
    media: 'screen',
    rules: [
        {
            selectors: ['html.oe-workbench-context body.oe-pnotes-print'],
            decls: [
                ['background-color', 'var(--oe-wb-canvas, #f3f7f5)'],
                ['color', 'var(--oe-wb-ink, #17343b)'],
            ],
        },
        {
            selectors: ['html.oe-workbench-context .oe-pnotes-print-sheet'],
            decls: [
                ['background-color', 'var(--oe-wb-paper, #fff)'],
                ['color', 'var(--oe-wb-ink, #17343b)'],
                ['margin', '0.75rem'],
                ['padding', '0.75rem'],
                ['border', '1px solid var(--oe-wb-line, #d9e4e2)'],
                ['border-radius', '0.5rem'],
                ['overflow-wrap', 'anywhere'],
            ],
        },
    ],
};

// Canonical sheet text; the production file is expected to match it structurally.
const CANONICAL_CSS = `/*
 * OPEMR-46 patient note print popup, screen only. Paints the window opened
 * by the note print launchers when the workbench context class is present.
 * Screen rules do not apply to print; wrapper/output/audit compatibility
 * remains native QA.
 */

@media screen {
  html.oe-workbench-context body.oe-pnotes-print {
    background-color: var(--oe-wb-canvas, #f3f7f5);
    color: var(--oe-wb-ink, #17343b);
  }

  html.oe-workbench-context .oe-pnotes-print-sheet {
    background-color: var(--oe-wb-paper, #fff);
    color: var(--oe-wb-ink, #17343b);
    margin: 0.75rem;
    padding: 0.75rem;
    border: 1px solid var(--oe-wb-line, #d9e4e2);
    border-radius: 0.5rem;
    overflow-wrap: anywhere;
  }
}
`;

// ---------------------------------------------------------------------------
// Verifier
// ---------------------------------------------------------------------------

const firstDiff = (a, b) => {
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    return i;
};

// Undo the declared additions. Returns { restored } or { reason } when any
// addition is absent, duplicated or altered.
const undo = (text, additions) => {
    let restored = text;
    for (const [index, [before, after]] of additions.entries()) {
        const n = count(restored, after);
        if (n !== 1) return { reason: `declared addition ${index + 1} found ${n} times (expected exactly 1)` };
        restored = restored.replace(after, () => before);
    }
    return { restored };
};

const compareRestored = (text, additions, original, label) => {
    const { restored, reason } = undo(text, additions);
    if (reason) return [`${label}: ${reason}`];
    if (restored !== original) {
        return [`${label}: bytes outside the declared additions differ from the frozen original at offset ${firstDiff(restored, original)}`];
    }
    return [];
};

const verifyRoute = (text, original = originalRoute()) => {
    const reasons = compareRestored(text, ROUTE_ADDITIONS, original, 'route');
    if (reasons.length === 0) {
        // Implied by the byte comparison; stated so a failure names the structure.
        const open = text.indexOf('<div class="oe-pnotes-print-sheet">');
        const close = text.indexOf('</div>', open);
        const sheet = text.slice(open, close);
        if (count(text, '<div') !== 1 || count(text, '</div>') !== 1) reasons.push('route: exactly one wrapper div expected');
        if (count(sheet, '<p>') !== 4 || count(sheet, '</p>') !== 4) reasons.push('route: wrapper must hold exactly the four original paragraphs');
        if (!(close < text.indexOf('<script>'))) reasons.push('route: wrapper must close before the print script');
        if (!(text.indexOf('Header::setupHeader()') < text.indexOf('pnotes-print-popup.css'))) reasons.push('route: sheet must link after Header::setupHeader()');
    }
    return { ok: reasons.length === 0, reasons };
};

const supportedList = text => {
    const block = text.match(/private const SUPPORTED = \[\n([\s\S]*?)\n {4}\];/);
    if (!block) return null;
    return block[1].split('\n').map(line => {
        const m = line.match(/^ {8}'([^']+)',$/);
        return m ? m[1] : null;
    });
};

const verifyHelper = (text, original = originalHelper()) => {
    const reasons = compareRestored(text, HELPER_ADDITIONS, original, 'helper');
    if (reasons.length === 0) {
        const list = supportedList(text);
        if (!list || list.includes(null)) {
            reasons.push('helper: SUPPORTED list is not one quoted basename per line');
        } else {
            const sorted = [...list].sort();
            if (list.join('\n') !== sorted.join('\n')) reasons.push('helper: SUPPORTED list is not sorted');
            if (new Set(list).size !== list.length) reasons.push('helper: SUPPORTED list has duplicates');
            if (list.filter(name => name === 'pnotes-print-popup.css').length !== 1) reasons.push('helper: pnotes-print-popup.css must be listed once');
        }
    }
    return { ok: reasons.length === 0, reasons };
};

// Minimal parser for the one shape this sheet may take: optional comments and
// a single top-level @media block of flat rules.
const parseCss = text => {
    const bare = text.replace(/\/\*[\s\S]*?\*\//g, comment => comment.replace(/[^\n]/g, ''));
    const top = bare.trim().match(/^@media\s+([^{]+?)\s*\{([\s\S]*)\}$/);
    if (!top) return { error: 'expected a single top-level @media block and nothing else' };
    const [, media, body] = top;
    if (body.includes('@')) return { error: 'nested at-rules are not allowed' };
    const rules = [];
    const leftover = body.replace(/([^{}]+)\{([^{}]*)\}/g, (_, selector, block) => {
        const decls = [];
        for (const raw of block.split(';')) {
            const decl = raw.trim();
            if (!decl) continue;
            const colon = decl.indexOf(':');
            if (colon < 1) {
                decls.push(['<invalid>', decl]);
                continue;
            }
            decls.push([decl.slice(0, colon).trim(), decl.slice(colon + 1).trim()]);
        }
        rules.push({ selectors: selector.split(',').map(s => s.trim().replace(/\s+/g, ' ')), decls });
        return '';
    });
    if (leftover.trim()) return { error: 'unparsed content inside @media' };
    return { media: media.trim(), rules, bare };
};

// Two-space stylelint indentation: @media at 0, rules at 2, declarations at 4.
const indentationReasons = bare => {
    const reasons = [];
    bare.split('\n').forEach((line, i) => {
        if (!line.trim()) return;
        if (line.includes('\t')) reasons.push(`css line ${i + 1}: tab indentation`);
        const indent = line.length - line.trimStart().length;
        const body = line.trim();
        const want = body.startsWith('@media') ? 0
            : body.endsWith(';') ? 4
            : body.endsWith('{') ? 2
            : body === '}' ? (indent === 0 ? 0 : 2)
            : -1;
        if (want !== indent) reasons.push(`css line ${i + 1}: indentation ${indent}, expected ${want}`);
    });
    return reasons;
};

const verifyCss = text => {
    const parsed = parseCss(text);
    if (parsed.error) return { ok: false, reasons: [`css: ${parsed.error}`] };
    const reasons = [];
    if (parsed.media !== CSS_EXPECTED.media) reasons.push(`css: media "${parsed.media}" (expected "screen")`);
    if (parsed.rules.length !== CSS_EXPECTED.rules.length) reasons.push(`css: ${parsed.rules.length} rules (expected ${CSS_EXPECTED.rules.length})`);
    CSS_EXPECTED.rules.forEach((want, i) => {
        const got = parsed.rules[i];
        if (!got) return;
        if (JSON.stringify(got.selectors) !== JSON.stringify(want.selectors)) {
            reasons.push(`css rule ${i + 1}: selectors ${JSON.stringify(got.selectors)} (expected ${JSON.stringify(want.selectors)})`);
        }
        if (JSON.stringify(got.decls) !== JSON.stringify(want.decls)) {
            reasons.push(`css rule ${i + 1}: declarations ${JSON.stringify(got.decls)} (expected ${JSON.stringify(want.decls)})`);
        }
    });
    reasons.push(...indentationReasons(parsed.bare));
    return { ok: reasons.length === 0, reasons };
};

// Synthetic complete candidates: the frozen originals with the declared additions applied.
const apply = (text, additions) => additions.reduce((out, [before, after]) => {
    assert.equal(count(out, before), 1, `fixture anchor must occur exactly once: ${JSON.stringify(before)}`);
    return out.replace(before, () => after);
}, text);
const candidateRoute = () => apply(originalRoute(), ROUTE_ADDITIONS);
const candidateHelper = () => apply(originalHelper(), HELPER_ADDITIONS);

// A mutant must hit a unique anchor and actually change the input; both are
// asserted before (and independently of) the rejection check.
const mutate = (text, from, to) => {
    assert.equal(count(text, from), 1, `mutation anchor must occur exactly once: ${JSON.stringify(from)}`);
    const out = text.replace(from, () => to);
    assert.notEqual(out, text, `mutation must change the input: ${JSON.stringify(from)}`);
    return out;
};

const expectRejected = (verify, input, label) => {
    const result = verify(input);
    assert.equal(result.ok, false, `mutant must be rejected: ${label}`);
    assert.ok(result.reasons.length > 0, `rejection must carry a reason: ${label}`);
};

// ---------------------------------------------------------------------------
// Frozen originals
// ---------------------------------------------------------------------------

test('frozen route original has the observed base shape', () => {
    const php = originalRoute();
    assert.equal(php.split('\n').length - 1, 75, '75 lines, newline-terminated');
    assert.ok(php.endsWith('</html>\n'));
    assert.equal(count(php, '<?php Header::setupHeader(); ?>'), 1);
    assert.equal(count(php, '<body class="body_top">'), 1);
    assert.equal(count(php, '<p>'), 4);
    assert.equal(count(php, 'opener.top.printLogPrint(window);'), 1);
    assert.equal(count(php, "$pid = $session->get('pid', 0);"), 1);
    assert.equal(count(php, "getPnoteById($noteid, 'title,assigned_to,activity,body')"), 1);
    assert.equal(count(php, '<!DOCTYPE'), 0);
    assert.equal(count(php, 'viewport'), 0);
    for (const [before] of ROUTE_ADDITIONS) assert.equal(count(php, before), 1);
});

test('frozen helper original has the observed base SUPPORTED list', () => {
    const php = originalHelper();
    const list = supportedList(php);
    assert.ok(list && !list.includes(null));
    assert.equal(list.length, 24);
    assert.deepEqual(list, [...list].sort());
    assert.equal(list.includes('pnotes-print-popup.css'), false);
    for (const [before] of HELPER_ADDITIONS) assert.equal(count(php, before), 1);
});

test('production files are either the frozen originals or verified candidates', () => {
    // Passes before and after the production edit; before it, this proves the
    // fixtures are byte-identical to the checkout.
    const route = read(ROUTE);
    const helper = read(HELPER);
    assert.ok(route === originalRoute() || verifyRoute(route).ok, 'route is neither the frozen original nor a verified candidate');
    assert.ok(helper === originalHelper() || verifyHelper(helper).ok, 'helper is neither the frozen original nor a verified candidate');
});

// ---------------------------------------------------------------------------
// Positive: synthetic complete candidate
// ---------------------------------------------------------------------------

test('synthetic complete candidate passes the verifier', () => {
    assert.deepEqual(verifyRoute(candidateRoute()), { ok: true, reasons: [] });
    assert.deepEqual(verifyHelper(candidateHelper()), { ok: true, reasons: [] });
    assert.deepEqual(verifyCss(CANONICAL_CSS), { ok: true, reasons: [] });
});

test('verifier rejects the untouched originals and each partial candidate', () => {
    expectRejected(verifyRoute, originalRoute(), 'untouched route');
    expectRejected(verifyHelper, originalHelper(), 'untouched helper');
    ROUTE_ADDITIONS.forEach((_, skip) => {
        const partial = apply(originalRoute(), ROUTE_ADDITIONS.filter((__, i) => i !== skip));
        expectRejected(verifyRoute, partial, `route without addition ${skip + 1}`);
    });
    expectRejected(verifyCss, '', 'empty sheet');
});

// ---------------------------------------------------------------------------
// Negative: changed-input mutants
// ---------------------------------------------------------------------------

const ROUTE_MUTANTS = [
    ['ACL resource', "AclMain::aclCheckCore('patients', 'notes')", "AclMain::aclCheckCore('patients', 'demo')"],
    ['ACL deny guard', 'if (!$thisauth) {', 'if (false) {'],
    ['squad check', "! AclMain::aclCheckCore('squads', $prow['squad'])", 'false'],
    ['session PID', "$pid = $session->get('pid', 0);", "$pid = $_REQUEST['pid'] ?? $session->get('pid', 0);"],
    ['noteid source', "$noteid = $_REQUEST['noteid'];", "$noteid = (int) $_GET['noteid'];"],
    ['lookup columns', "getPnoteById($noteid, 'title,assigned_to,activity,body')", "getPnoteById($noteid, '*')"],
    ['lookup guard (ownership change out of scope)', 'if ($noteid) {', 'if ($noteid && $pid) {'],
    ['patient name escaping', '"<b>" . attr($ptname) . "</b>"', '"<b>" . $ptname . "</b>"'],
    ['assigned-to escaping', 'text($assigned_to)', '$assigned_to'],
    ['body escaping', 'nl2br(text($body))', 'nl2br($body)'],
    ['label translation', "xlt('Assigned To')", "xl('Assigned To')"],
    ['paragraph removed', "<p><?php echo xlt('Assigned To'); ?>: <?php echo text($assigned_to); ?></p>\n\n", ''],
    ['paragraph added', '<p><?php echo nl2br(text($body)); ?></p>\n</div>', '<p><?php echo nl2br(text($body)); ?></p>\n<p></p>\n</div>'],
    ['print call', 'opener.top.printLogPrint(window);', 'window.print();'],
    ['print script removed', '<script>\nopener.top.printLogPrint(window);\n</script>\n', ''],
    ['header arguments', '<?php Header::setupHeader(); ?>', "<?php Header::setupHeader(['opener']); ?>"],
    ['wrapper closes after script', '</p>\n</div>\n\n<script>\nopener.top.printLogPrint(window);\n</script>\n', '</p>\n\n<script>\nopener.top.printLogPrint(window);\n</script>\n</div>\n'],
    ['wrapper class', 'class="oe-pnotes-print-sheet"', 'class="oe-pnotes-print-sheet container"'],
    ['body class', '<body class="body_top oe-pnotes-print">', '<body class="oe-pnotes-print">'],
    ['asset order', `<?php Header::setupHeader(); ?>\n${LINK}\n`, `${LINK}\n<?php Header::setupHeader(); ?>\n`],
    ['media all', 'media="screen" href=', 'media="all" href='],
    ['media removed', ' media="screen"', ''],
    ['webroot escaping', 'attr(\\OpenEMR\\Core\\OEGlobalsBag::getInstance()->getWebRoot())', '\\OpenEMR\\Core\\OEGlobalsBag::getInstance()->getWebRoot()'],
    ['version escaping', 'attr_url((new ClinicalWorkspaceAssets())', '((new ClinicalWorkspaceAssets())'],
    ['import order', 'use OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;\nuse OpenEMR\\Core\\Header;', 'use OpenEMR\\Core\\Header;\nuse OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;'],
    ['inline geometry', '<div class="oe-pnotes-print-sheet">', '<div class="oe-pnotes-print-sheet" style="width: 600px">'],
    ['viewport added', '<head>\n', '<head>\n<meta name="viewport" content="width=device-width, initial-scale=1">\n'],
    ['doctype added', '?>\n<html>', '?>\n<!DOCTYPE html>\n<html>'],
    ['font added', '</head>', '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter">\n</head>'],
    ['hidden control', '<div class="oe-pnotes-print-sheet">\n', '<div class="oe-pnotes-print-sheet">\n<input type="hidden" name="noteid" value="">\n'],
    ['visible control', '</div>\n\n<script>', '</div>\n<button type="button" onclick="window.print()">Print</button>\n\n<script>'],
    ['extra script', '</body>', '<script src="pnotes-print.js"></script>\n</body>'],
    ['original header bytes', ' * Display patient notes.', ' * Display a patient note.'],
];

test('route mutants are rejected', () => {
    const candidate = candidateRoute();
    for (const [label, from, to] of ROUTE_MUTANTS) {
        expectRejected(verifyRoute, mutate(candidate, from, to), label);
    }
    assert.ok(candidate.endsWith('</html>\n'));
    expectRejected(verifyRoute, candidate.slice(0, -1), 'trailing newline removed');
    expectRejected(verifyRoute, candidate.replace(/\n/g, '\r\n'), 'line endings changed');
});

const HELPER_MUTANTS = [
    ['unrelated entry added', "        'workspace.css',\n    ];", "        'workspace.css',\n        'extra-popup.css',\n    ];"],
    ['unrelated entry removed', "        'finder.css',\n", ''],
    ['entry order', "        'patient-search.css',\n        'pnotes-print-popup.css',", "        'pnotes-print-popup.css',\n        'patient-search.css',"],
    ['entry duplicated', "        'workspace.css',\n    ];", "        'workspace.css',\n        'pnotes-print-popup.css',\n    ];"],
    ['version fallback', "            return '0';\n", "            return '';\n"],
    ['strict lookup', 'in_array($asset, self::SUPPORTED, true)', 'in_array($asset, self::SUPPORTED)'],
];

test('helper mutants are rejected', () => {
    const candidate = candidateHelper();
    for (const [label, from, to] of HELPER_MUTANTS) {
        expectRejected(verifyHelper, mutate(candidate, from, to), label);
    }
});

const CSS_MUTANTS = [
    ['canvas rule bleeds to body', 'html.oe-workbench-context body.oe-pnotes-print {', 'body {'],
    ['sheet rule loses context scope', 'html.oe-workbench-context .oe-pnotes-print-sheet {', '.oe-pnotes-print-sheet {'],
    ['popup scope instead of context', 'html.oe-workbench-context body.oe-pnotes-print {', 'html.oe-workbench-popup body.oe-pnotes-print {'],
    ['unsupported descendant selector', 'html.oe-workbench-context .oe-pnotes-print-sheet {', 'html.oe-workbench-context .oe-pnotes-print-sheet p {'],
    ['selector list bleed', 'html.oe-workbench-context .oe-pnotes-print-sheet {', 'html.oe-workbench-context .oe-pnotes-print-sheet, html.oe-workbench-context p {'],
    ['font declaration', '    overflow-wrap: anywhere;\n', '    overflow-wrap: anywhere;\n    font-family: Georgia, serif;\n'],
    ['hidden content', '    overflow-wrap: anywhere;\n', '    overflow-wrap: anywhere;\n    display: none;\n'],
    ['geometry declaration', '    overflow-wrap: anywhere;\n', '    overflow-wrap: anywhere;\n    width: 600px;\n'],
    ['important', 'color: var(--oe-wb-ink, #17343b);\n  }\n\n', 'color: var(--oe-wb-ink, #17343b) !important;\n  }\n\n'],
    ['paper fallback', '#fff)', '#ffffff)'],
    ['canvas pair broken', '    background-color: var(--oe-wb-canvas, #f3f7f5);\n', ''],
    ['line token', 'var(--oe-wb-line, #d9e4e2)', 'var(--oe-wb-ink, #17343b)'],
    ['print media', '@media screen {', '@media print {'],
    ['screen and print media', '@media screen {', '@media screen, print {'],
    ['nested at-rule', '\n}\n', '\n  @supports (display: grid) {\n    html.oe-workbench-context body.oe-pnotes-print {\n      display: grid;\n    }\n  }\n}\n'],
    ['rule outside media', '\n}\n', '\n}\n\nbody {\n  color: red;\n}\n'],
    ['extra rule', '    overflow-wrap: anywhere;\n  }\n', '    overflow-wrap: anywhere;\n  }\n\n  html.oe-workbench-context .oe-pnotes-print-sheet {\n    color: red;\n  }\n'],
    ['tab indentation', '    margin: 0.75rem;', '\tmargin: 0.75rem;'],
    ['four-space rule indentation', '  html.oe-workbench-context body.oe-pnotes-print {', '    html.oe-workbench-context body.oe-pnotes-print {'],
];

test('css mutants are rejected', () => {
    for (const [label, from, to] of CSS_MUTANTS) {
        expectRejected(verifyCss, mutate(CANONICAL_CSS, from, to), label);
    }
});

// ---------------------------------------------------------------------------
// Inherited behaviour that this slice preserves but does not accept
// ---------------------------------------------------------------------------

test('inherited: three launchers open the route at 600x500', () => {
    const launchers = [
        'interface/main/messages/messages.php',
        'interface/patient_file/summary/pnotes_full.php',
        'interface/patient_file/summary/pnotes_full_add.php',
    ];
    for (const file of launchers) {
        const lines = read(file).split('\n').filter(line => line.includes('window.open(') && line.includes('pnotes_print.php?noteid='));
        assert.equal(lines.length, 1, file);
        assert.match(lines[0], /window\.open\(.*'_blank', 'resizable=1,scrollbars=1,width=600,height=500'\);/, file);
    }
});

test('inherited: note lookup is not bound to the session patient (not a security clearance)', () => {
    const lib = read('library/pnotes.inc.php');
    const fn = lib.match(/function getPnoteById\(\$id, \$cols = "\*"\)\n\{\n([\s\S]*?)\n\}/);
    assert.ok(fn, 'getPnoteById found');
    assert.match(fn[1], /FROM pnotes WHERE id=\? /);
    assert.match(fn[1], /deleted != 1/);
    assert.doesNotMatch(fn[1], /pid/);
});

test('inherited: printLogPrint calls native print and may POST the body to the print log', () => {
    const js = read('library/restoreSession.php');
    const fn = js.match(/function printLogPrint\(elem\) \{[\s\S]*?\n\}/);
    assert.ok(fn, 'printLogPrint found');
    assert.match(fn[0], /win\.print\(\);/);
    assert.match(fn[0], /comments = win\.printlogdata \|\| win\.document\.body\.innerHTML;/);
    assert.match(fn[0], /\/library\/ajax\/log_print_action_ajax\.php/);
});

// ---------------------------------------------------------------------------
// Production (RED until the declared additions land)
// ---------------------------------------------------------------------------

test('production carries exactly the declared OPEMR-46 additions', () => {
    const reasons = [
        ...verifyRoute(read(ROUTE)).reasons,
        ...verifyHelper(read(HELPER)).reasons,
        ...(exists(CSS) ? verifyCss(read(CSS)).reasons : [`css: ${CSS} is missing`]),
    ];
    assert.deepEqual(reasons, [], `production additions missing or wrong:\n${reasons.join('\n')}`);
});

// ---------------------------------------------------------------------------
// Optional local history (PNOTES_PRINT_HISTORY=1); mandatory once enabled.
// ---------------------------------------------------------------------------

const HISTORY = process.env.PNOTES_PRINT_HISTORY === '1';
const historyOptions = { skip: HISTORY ? false : 'set PNOTES_PRINT_HISTORY=1 for local-history checks' };

const git = (...args) => require('node:child_process').execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
});

const UNCHANGED = [
    'interface/main/messages/messages.php',
    'interface/patient_file/summary/pnotes_full.php',
    'interface/patient_file/summary/pnotes_full_add.php',
    'interface/clinical-workspace/popup.js',
    'interface/clinical-workspace/workspace.css',
    'interface/themes',
    'public/themes',
    'library/pnotes.inc.php',
    'library/restoreSession.php',
    'src/Core/Header.php',
    'config/config.yaml',
];

const ALLOWED_CHANGES = [
    'docs/clinical-ui/PNOTES-PRINT-POPUP.md',
    'interface/clinical-workspace/pnotes-print-popup.css',
    ROUTE,
    HELPER,
    'tests/clinical-ui/pnotes-print-popup.test.cjs',
    ROUTE_FIXTURE,
    HELPER_FIXTURE,
    'tests/js/pnotes-print-popup.test.js',
];

test('history: fixtures are the exact base bytes', historyOptions, () => {
    assert.equal(git('rev-parse', '--verify', `${BASE_SHA}^{commit}`).trim(), BASE_SHA);
    assert.equal(git('show', `${BASE_SHA}:${ROUTE}`), originalRoute());
    assert.equal(git('show', `${BASE_SHA}:${HELPER}`), originalHelper());
});

test('history: callers, shared assets, themes and inherited code are unchanged', historyOptions, () => {
    const changed = git('diff', '--name-only', BASE_SHA, '--', ...UNCHANGED).split('\n').filter(Boolean);
    assert.deepEqual(changed, []);
});

test('history: changed files stay within the OPEMR-46 allowlist', historyOptions, () => {
    const changed = new Set([
        ...git('diff', '--name-only', BASE_SHA).split('\n'),
        ...git('ls-files', '--others', '--exclude-standard').split('\n'),
    ].filter(Boolean));
    assert.deepEqual([...changed].filter(file => !ALLOWED_CHANGES.includes(file)).sort(), []);
});
