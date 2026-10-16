/**
 * OPEMR-13 Birthday Alert popup: source-level contract for a partial palette adaptation.
 *
 * These checks read source text only. They never execute birthday_pop.php, whose automatic
 * mode posts to the turnoff endpoint on open. Passing them proves which bytes changed and
 * what the new sheet declares; it is not proof of real cascade, contrast, theme, keyboard,
 * RTL, narrow-width or print behaviour (see docs/clinical-ui/BIRTHDAY-ALERT-POPUP.md).
 */

const fs = require('fs');
const path = require('path');
const postcss = require('postcss');

const root = path.join(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
// A missing sheet reads as empty, so the intended RED is assertion failures, not loader errors.
const readOptional = file => (fs.existsSync(path.join(root, file)) ? read(file) : '');
const ROUTE = 'interface/patient_file/birthday_alert/birthday_pop.php';
const SHEET = 'interface/clinical-workspace/birthday-alert-popup.css';
const HELPER = 'src/Common/Assets/ClinicalWorkspaceAssets.php';
const original = read('tests/clinical-ui/fixtures/birthday-alert-popup-original.txt');
const count = (text, part) => text.split(part).length - 1;

// popup.js puts oe-workbench-context on <html>, never on <body>; tokens come from popup.css.
const CONTEXT = 'html.oe-workbench-context body.oe-birthday-alert-popup';
const LINK = '    <link rel="stylesheet" media="screen" href="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>'
    + '/interface/clinical-workspace/birthday-alert-popup.css?v=<?php echo attr_url((new ClinicalWorkspaceAssets())->version(\'birthday-alert-popup.css\')); ?>">';

// Every presentation edit as [original, presented]; nothing else may differ.
const edits = [
    ['use OpenEMR\\Common\\Acl\\AclMain;\nuse OpenEMR\\Common\\Csrf\\CsrfUtils;\n',
        'use OpenEMR\\Common\\Acl\\AclMain;\nuse OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;\nuse OpenEMR\\Common\\Csrf\\CsrfUtils;\n'],
    ['    <?php Header::setupHeader(); ?>\n', `    <?php Header::setupHeader(); ?>\n${LINK}\n`],
    ['<body>\n    <div style="padding: 15px; text-align: center">\n',
        '<body class="oe-birthday-alert-popup">\n    <div class="oe-birthday-alert-document" style="padding: 15px; text-align: center">\n'],
];

const forward = text => edits.reduce((t, [before, after]) => t.replace(before, () => after), text);
// Undo the edits; null when any presented edit is missing or ambiguous.
const inverse = text => {
    let restored = text;
    for (const [before, after] of edits) {
        if (count(restored, after) !== 1) return null;
        restored = restored.replace(after, () => before);
    }
    return restored;
};
const presented = forward(original);

describe('frozen original route', () => {
    test('fixture is the 97-line original with every edit anchor unique', () => {
        expect(original.split('\n')).toHaveLength(98); // 97 lines plus the final newline
        expect(original.endsWith('</html>\n')).toBe(true);
        for (const [before, after] of edits) {
            expect(count(original, before)).toBe(1);
            expect(count(original, after)).toBe(0);
        }
        expect(inverse(presented)).toBe(original);
    });

    test('the actual route inverts to the full frozen original byte for byte', () => {
        const restored = inverse(read(ROUTE));
        expect(restored).not.toBeNull();
        expect(restored).toBe(original);
    });

    test('the route carries the sorted import, one escaped screen link and both hook classes', () => {
        const php = read(ROUTE);
        expect(php).toContain(edits[0][1]);
        expect(count(php, LINK)).toBe(1);
        expect(count(php, 'birthday-alert-popup.css')).toBe(2); // path and version argument
        expect(count(php, '<body class="oe-birthday-alert-popup">')).toBe(1);
        expect(count(php, 'style="padding: 15px; text-align: center"')).toBe(1);
        expect(php).not.toMatch(/\$\w*[Aa]ssets\w*\s*=/); // no new PHP variable
    });
});

describe('negative controls: mutants of the presented route never restore the original', () => {
    const mutants = [
        ['ACL', "aclCheckCore('patients', 'appt')", "aclCheckCore('patients', 'demo')"],
        ['PID guard', 'if ($pid <= 0) {', 'if ($pid < 0) {'],
        ['PID source', "$pid = $query->getInt('pid');", "$pid = $query->getInt('pid', 1);"],
        ['CSRF token', 'CsrfUtils::collectCsrfToken(session: $session)', "''"],
        ['manual hidden checkbox', '<div class="checkbox" style="visibility: hidden;">', '<div class="checkbox">'],
        ['automatic script', '$("#turnOff").change(function () {', '$(function () {'],
        ['endpoint', 'url: "../../../library/ajax/turnoff_birthday_alert.php",', 'url: "turnoff.php",'],
        ['user id', "$userId = $query->getInt('user_id');", '$userId = 0;'],
        ['balloon', 'balloons-154949_960_720.png" height="42" width="42"', 'balloons-154949_960_720.png" height="64" width="64"'],
        ['geometry', 'style="padding: 15px; text-align: center"', 'style="padding: 0; text-align: center"'],
        ['header', '<?php Header::setupHeader(); ?>', "<?php Header::setupHeader(['no_main-theme']); ?>"],
        ['title string', '<title><?php echo xlt("Happy Birthday"); ?></title>', '<title><?php echo xlt("Birthday"); ?></title>'],
        ['error string', "xlt('Missing PID.')", "xlt('Missing patient.')"],
        ['stray class', '<div class="checkbox">', '<div class="checkbox oe-extra">'],
        ['link escaping', 'attr(OEGlobalsBag::getInstance()->getWebRoot())', 'OEGlobalsBag::getInstance()->getWebRoot()'],
        ['version escaping', "attr_url((new ClinicalWorkspaceAssets())->version('birthday-alert-popup.css'))",
            "(new ClinicalWorkspaceAssets())->version('birthday-alert-popup.css')"],
        ['version basename', "->version('birthday-alert-popup.css')", "->version('workspace.css')"],
        ['screen media', 'media="screen"', 'media="all"'],
        ['new PHP variable', LINK, `    <?php $assets = new ClinicalWorkspaceAssets(); ?>\n${LINK}`],
        ['duplicate link', LINK, `${LINK}\n${LINK}`],
        ['import order', 'use OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;\nuse OpenEMR\\Common\\Csrf\\CsrfUtils;\n',
            'use OpenEMR\\Common\\Csrf\\CsrfUtils;\nuse OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;\n'],
    ];

    test.each(mutants)('%s', (_name, from, to) => {
        // Anchor and change are checked here, outside any rejection assertion.
        expect(count(presented, from)).toBe(1);
        const mutated = presented.replace(from, () => to);
        expect(mutated).not.toBe(presented);
        expect(inverse(mutated)).not.toBe(original);
    });
});

// Exact original helper; the only permitted change is one sorted basename.
const helperBaseline = String.raw`<?php

/**
 * Per-file cache versions for the clinical workspace screen assets.
 *
 * Views that link interface/clinical-workspace assets directly append
 * ?v=<version> so a browser refetches a file as soon as it changes. Keeping
 * the filesystem lookup here keeps the view's URL expression free of
 * filesystem roots, and confines which files may be stat()ed to a fixed list.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Common\Assets;

final readonly class ClinicalWorkspaceAssets
{
    /**
     * Supported asset basenames. The directory defaults to the clinical
     * workspace; a legacy tooltip caller supplies library/js explicitly.
     */
    private const SUPPORTED = [
        'ajtooltip.js',
        'appointment.css',
        'calendar-sidebar.js',
        'calendar-workday.css',
        'calendar-workday.js',
        'encounter-document.css',
        'finder.css',
        'global-messages.css',
        'history-document.css',
        'history-editor.css',
        'issue-popup.css',
        'lbf-document.css',
        'mode.js',
        'patient-messages.css',
        'patient-picker-popup.css',
        'patient-results-popup.css',
        'patient-search.css',
        'soap-document.css',
        'soap-document.js',
        'soap-reference.css',
        'soap-reference.js',
        'visit-history.css',
        'visit-history.js',
        'workspace.css',
    ];

    private string $directory;

    /**
     * @param ?string $directory Directory holding the assets; defaults to the
     *                           shipped interface/clinical-workspace.
     */
    public function __construct(?string $directory = null)
    {
        $this->directory = $directory ?? dirname(__DIR__, 3) . '/interface/clinical-workspace';
    }

    /**
     * Modification time of a supported asset as a decimal string, or '0'
     * when the file is absent.
     *
     * @throws \InvalidArgumentException when $asset is not a supported name
     */
    public function version(string $asset): string
    {
        if (!in_array($asset, self::SUPPORTED, true)) {
            throw new \InvalidArgumentException('Unsupported clinical workspace asset');
        }

        $path = $this->directory . '/' . $asset;
        clearstatcache(true, $path);
        if (!is_file($path)) {
            return '0';
        }
        $mtime = filemtime($path);

        return $mtime === false ? '0' : sprintf('%d', $mtime);
    }
}
`;
const supported = text => [...(text.match(/SUPPORTED = \[([\s\S]*?)\];/)?.[1] ?? '').matchAll(/'([^']+)'/g)].map(m => m[1]);

test('helper keeps its whole baseline and adds only the sorted birthday basename', () => {
    const anchor = "        'appointment.css',\n";
    expect(count(helperBaseline, anchor)).toBe(1);
    expect(read(HELPER)).toBe(helperBaseline.replace(anchor, () => `${anchor}        'birthday-alert-popup.css',\n`));
    const after = supported(read(HELPER));
    expect(after).toEqual([...after].sort());
    expect(after.filter(name => !supported(helperBaseline).includes(name))).toEqual(['birthday-alert-popup.css']);
});

// Strict CSS allowlist: exact rule order, selectors and declarations; nothing else.
const DOC = `${CONTEXT} .oe-birthday-alert-document`;
const FOCUS = { outline: '2px solid var(--oe-wb-petrol)', 'outline-offset': '2px' };
const expectedRules = [
    [CONTEXT, { background: 'var(--oe-wb-canvas)', color: 'var(--oe-wb-ink)' }],
    [DOC, { background: 'var(--oe-wb-paper)', color: 'var(--oe-wb-ink)' }],
    [`${DOC} .h2`, { background: 'var(--oe-wb-paper)', color: 'var(--oe-wb-petrol)' }],
    [`${DOC} input[type='checkbox']:focus`, FOCUS],
    [`${DOC} input[type='checkbox']:focus-visible`, FOCUS],
];

// Returns the list of violations; an empty list means the sheet matches the allowlist.
const sheetProblems = text => {
    let tree;
    try {
        tree = postcss.parse(text);
    } catch {
        return ['unparseable'];
    }
    const problems = [];
    const rules = [];
    for (const node of tree.nodes) {
        if (node.type === 'comment') {
            if (/[{}]/.test(node.text)) problems.push('comment hides a rule');
        } else if (node.type === 'rule') {
            rules.push(node);
        } else {
            problems.push(`unexpected ${node.type}`);
        }
    }
    if (rules.length !== expectedRules.length) problems.push(`expected ${expectedRules.length} rules, got ${rules.length}`);
    rules.forEach((rule, i) => {
        const [selector, decls] = expectedRules[i] ?? [null, {}];
        if (rule.selectors.length !== 1 || rule.selector !== selector) problems.push(`rule ${i} selector`);
        const actual = rule.nodes.map(n => (n.type === 'decl' ? [n.prop, n.value, Boolean(n.important)] : [n.type]));
        const wanted = Object.entries(decls).map(([prop, value]) => [prop, value, false]);
        if (JSON.stringify(actual) !== JSON.stringify(wanted)) problems.push(`rule ${i} declarations`);
    });
    return problems;
};

const validSheet = expectedRules
    .map(([selector, decls]) => `${selector} {\n${Object.entries(decls).map(([p, v]) => `  ${p}: ${v};\n`).join('')}}\n`)
    .join('\n');

test('the birthday sheet matches the exact five-rule allowlist', () => {
    expect(sheetProblems(validSheet)).toEqual([]);
    expect(sheetProblems(readOptional(SHEET))).toEqual([]);
});

describe('negative controls: sheet mutants are rejected', () => {
    const rule0 = `${CONTEXT} {\n`;
    const docRule = `${DOC} {\n  background: var(--oe-wb-paper);\n  color: var(--oe-wb-ink);\n}\n`;
    const focusPair = `${DOC} input[type='checkbox']:focus {\n  outline: 2px solid var(--oe-wb-petrol);\n  outline-offset: 2px;\n}\n\n`
        + `${DOC} input[type='checkbox']:focus-visible {\n  outline: 2px solid var(--oe-wb-petrol);\n  outline-offset: 2px;\n}\n`;
    const mutants = [
        ['context removed', rule0, 'body.oe-birthday-alert-popup {\n'],
        ['context on body', rule0, 'body.oe-workbench-context.oe-birthday-alert-popup {\n'],
        ['legacy leak', docRule, `${docRule}\nbody .h2 {\n  color: red;\n}\n`],
        ['print rule', docRule, `${docRule}\n@media print {\n  ${DOC} {\n    color: black;\n  }\n}\n`],
        ['import', rule0, `@import url('popup.css');\n${rule0}`],
        ['important', '  background: var(--oe-wb-canvas);\n', '  background: var(--oe-wb-canvas) !important;\n'],
        ['duplicate rule', docRule, `${docRule}\n${docRule}`],
        ['geometry', '  background: var(--oe-wb-paper);\n  color: var(--oe-wb-ink);\n', '  background: var(--oe-wb-paper);\n  color: var(--oe-wb-ink);\n  padding: 0;\n'],
        ['visibility', '  color: var(--oe-wb-petrol);\n', '  color: var(--oe-wb-petrol);\n  visibility: visible;\n'],
        ['display', '  color: var(--oe-wb-petrol);\n', '  color: var(--oe-wb-petrol);\n  display: block;\n'],
        ['font', '  color: var(--oe-wb-petrol);\n', '  color: var(--oe-wb-petrol);\n  font-size: 1.2rem;\n'],
        ['native checkbox paint', "input[type='checkbox']:focus {\n", "input[type='checkbox']:focus {\n  accent-color: var(--oe-wb-petrol);\n"],
        ['focus selectors combined', focusPair,
            `${DOC} input[type='checkbox']:focus,\n${DOC} input[type='checkbox']:focus-visible {\n  outline: 2px solid var(--oe-wb-petrol);\n  outline-offset: 2px;\n}\n`],
        ['wrong token', '  color: var(--oe-wb-petrol);\n', '  color: var(--oe-wb-ink);\n'],
        ['comment hiding a rule', rule0, `/* body { color: red; } */\n${rule0}`],
        ['screen wrapper', validSheet, `@media screen {\n${validSheet}}\n`],
    ];

    test.each(mutants)('%s', (_name, from, to) => {
        expect(count(validSheet, from)).toBe(1);
        const mutated = validSheet.replace(from, () => to);
        expect(mutated).not.toBe(validSheet);
        expect(sheetProblems(mutated)).not.toEqual([]);
    });
});
