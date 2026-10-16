/** @jest-environment node */

/*
 * Patient search help (interface/main/finder/patient_select_help.php) inside the workbench.
 *
 * The route may change by exactly three presentation additions: the asset helper and
 * OEGlobalsBag imports before the Header import, one escaped, versioned, screen-only
 * stylesheet link after Header::setupHeader, and a class on the bare <body>. Undoing them
 * must give back tests/clinical-ui/fixtures/patient-search-help-original.txt byte for byte,
 * so the bootstrap, Header, title, headings, the untranslated instruction text and the
 * trailing empty heading and paragraph all survive untouched. The instructions are kept
 * as written; these tests do not certify that they still describe the search accurately.
 *
 * The sheet only pairs ink/paper on the body and petrol/ink on the existing headings, and
 * only under html.oe-workbench-context, which the shared Header popup controller sets when a
 * same-origin parent or opener chain reaches an active workbench shell. The caller opens the
 * help with a named target=_new link; a window that ends up without a reachable opener keeps
 * its original styling. Source tests cannot prove the rendered colours, which window the
 * browser reuses for the named target, or whether it keeps the opener; none of that is claimed.
 */

const fs = require('fs');
const path = require('path');
const postcss = require('postcss');

const root = path.join(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const ROUTE = 'interface/main/finder/patient_select_help.php';
const CALLER = 'interface/main/finder/patient_select.php';
const POPUP = 'interface/clinical-workspace/popup.js';
const SHEET = 'interface/clinical-workspace/patient-search-help.css';
const HELPER = 'src/Common/Assets/ClinicalWorkspaceAssets.php';
const FIXTURE = 'tests/clinical-ui/fixtures/patient-search-help-original.txt';
const originalBytes = () => fs.readFileSync(path.join(root, FIXTURE));
const original = () => originalBytes().toString('utf8');
const count = (text, part) => text.split(part).length - 1;

function replaceUnique(text, before, after) {
    if (count(text, before) !== 1) throw new Error(`Expected one occurrence of: ${before}`);
    return text.replace(before, () => after);
}

// [original text, text after the addition]
const ADDITIONS = [
    [
        'use OpenEMR\\Core\\Header;',
        'use OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;\nuse OpenEMR\\Core\\OEGlobalsBag;\nuse OpenEMR\\Core\\Header;',
    ],
    [
        '<?php Header::setupHeader(); ?>',
        '<?php Header::setupHeader(); ?>\n'
            + '<?php $clinicalAssets = new ClinicalWorkspaceAssets(); ?>\n'
            + '<link rel="stylesheet" media="screen" href="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>/interface/clinical-workspace/patient-search-help.css?v=<?php echo attr_url($clinicalAssets->version(\'patient-search-help.css\')); ?>">',
    ],
    ['<body>', '<body class="patient-search-help">'],
];

const applyAdditions = php => ADDITIONS.reduce((text, [before, after]) => replaceUnique(text, before, after), php);

function restoreRoute(php) {
    let restored = php;
    for (const [before, after] of ADDITIONS) restored = replaceUnique(restored, after, before);
    return restored;
}

function verifyRoute(php) {
    if (!Buffer.from(restoreRoute(php), 'utf8').equals(originalBytes())) {
        throw new Error('Route differs from the original beyond the three declared additions');
    }
}

// The complete asset helper before this slice, so the inverse needs no Git history.
const ORIGINAL_HELPER = String.raw`<?php

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

const ADDED_ASSET_LINE = "        'patient-search-help.css',\n";
const NEXT_ASSET_LINE = "        'patient-search.css',\n";
const applyHelper = php => replaceUnique(php, NEXT_ASSET_LINE, ADDED_ASSET_LINE + NEXT_ASSET_LINE);

function supportedAssets(php) {
    const block = php.match(/private const SUPPORTED = \[\n([\s\S]*?)\n {4}\];/);
    if (!block) throw new Error('SUPPORTED list not found');
    return block[1].split('\n').map(line => line.trim().replace(/^'(.*)',$/, '$1'));
}

function verifyHelper(php) {
    if (count(php, ADDED_ASSET_LINE) !== 1) throw new Error('Expected exactly one patient-search-help.css entry');
    if (php.replace(ADDED_ASSET_LINE, '') !== ORIGINAL_HELPER) throw new Error('Helper differs beyond the one new asset');
    const assets = supportedAssets(php);
    if (assets.join('\n') !== [...assets].sort().join('\n')) throw new Error('SUPPORTED is not sorted');
    if (new Set(assets).size !== assets.length) throw new Error('SUPPORTED has duplicates');
}

// The complete sheet, rule by rule and in cascade order. Palette only: no geometry,
// typography, borders, visibility or behaviour, and no !important.
const P = 'html.oe-workbench-context body.patient-search-help';
const ink = 'var(--oe-wb-ink, #17343b)';
const paper = 'var(--oe-wb-paper, #fff)';
const petrol = 'var(--oe-wb-petrol, #086878)';
const SPEC = [
    [P, { color: ink, 'background-color': paper }],
    [`${P} h1`, { color: petrol, 'background-color': paper }],
    [`${P} h2`, { color: ink, 'background-color': paper }],
];

const renderSheet = spec => '/* Patient search help inside an active workbench context: palette only. */\n@media screen {\n'
    + spec.map(([selector, decls]) => `  ${selector} {\n${Object.entries(decls).map(([prop, value]) => `    ${prop}: ${value};`).join('\n')}\n  }`).join('\n\n')
    + '\n}\n';

function sheetRules(text) {
    const tree = postcss.parse(text);
    const nodes = tree.nodes.filter(node => node.type !== 'comment');
    if (nodes.length !== 1 || nodes[0].type !== 'atrule' || nodes[0].name !== 'media' || nodes[0].params !== 'screen') {
        throw new Error('Sheet must be a single @media screen block');
    }
    const rules = [];
    for (const node of nodes[0].nodes) {
        if (node.type === 'comment') continue;
        if (node.type !== 'rule') throw new Error(`Unexpected ${node.type} inside @media screen`);
        if (node.selectors.length !== 1) throw new Error(`Selector lists are not allowed: ${node.selector}`);
        const decls = {};
        for (const decl of node.nodes.filter(child => child.type !== 'comment')) {
            if (decl.type !== 'decl' || decl.prop in decls) throw new Error(`Unexpected declaration in ${node.selector}`);
            decls[decl.prop] = `${decl.value}${decl.important ? ' !important' : ''}`;
        }
        rules.push([node.selector, decls]);
    }
    return rules;
}

function verifySheet(text) {
    if (JSON.stringify(sheetRules(text)) !== JSON.stringify(SPEC)) {
        throw new Error('Sheet differs from the declared selector/declaration allowlist');
    }
}

function luminance(hex) {
    const full = hex.length === 4 ? hex.replace(/#(.)(.)(.)/, '#$1$1$2$2$3$3') : hex;
    const [r, g, b] = [1, 3, 5].map(i => parseInt(full.slice(i, i + 2), 16) / 255)
        .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
}

const fallback = value => value.match(/^var\(--oe-wb-[a-z]+, (#[0-9a-f]{3,6})\)$/)[1];

test('the fixture is the complete original route, final newline included', () => {
    const php = original();
    expect(php.startsWith('<?php\n\nrequire_once("../../globals.php");\n\nuse OpenEMR\\Core\\Header;\n\n?>\n<html>\n<head>\n')).toBe(true);
    expect(php.endsWith('\n<h2>\n</h2>\n<p>\n\n</p>\n</body>\n</html>\n')).toBe(true);
    expect(php.split('\n')).toHaveLength(48);
    expect(php).not.toContain('\r');
    for (const [before] of ADDITIONS) expect(count(php, before)).toBe(1);
    expect(php).toContain('<title>\nHelp Searching for Patients\n</title>');
    expect(php).toContain('<h1>\nHelp Searching for Patients\n</h1>');
    for (const heading of ['Explanation of columns', 'How to search for a name.', 'Advanced - X days from last encounter']) {
        expect(php).toContain(`<h2>\n${heading}\n</h2>\n<p>\n`);
    }
    expect(php).toContain('phone number.  To view additional phone numbers');
    expect(php).toContain('place a comma before the search string.  You can also');
    expect(php).toContain('type 21Smith in the search box.\n</p>');
    expect(php).not.toMatch(/\bxl[a-z]*\(/);
    expect(php).not.toContain('ClinicalWorkspaceAssets');
    expect(php).not.toContain('patient-search-help');
    expect(count(php, '<h1>')).toBe(1);
    expect(count(php, '<h2>')).toBe(4);
    expect(count(php, '<p>')).toBe(4);
});

test('undoing only the three declared additions restores every original route byte', () => {
    expect(() => verifyRoute(applyAdditions(original()))).not.toThrow();
    expect(() => verifyRoute(read(ROUTE))).not.toThrow();
});

test('the stylesheet link is escaped, versioned and screen only, after Header and before the title', () => {
    const php = read(ROUTE);
    expect(php).toContain(ADDITIONS[0][1]);
    expect(php).toContain(ADDITIONS[1][1]);
    expect(php.indexOf('new ClinicalWorkspaceAssets()')).toBeGreaterThan(php.indexOf('Header::setupHeader('));
    expect(php.indexOf('patient-search-help.css?v=')).toBeLessThan(php.indexOf('<title>'));
    expect(count(php, '<link rel="stylesheet"')).toBe(1);
    expect(count(php, '<script')).toBe(0);
    expect(php).toContain('<body class="patient-search-help">');
});

test('the route invariant rejects bootstrap, Header, text, data and empty-element edits', () => {
    const production = applyAdditions(original());
    const mutations = [
        ['require_once("../../globals.php");', 'require_once("../globals.php");'],
        ['<?php Header::setupHeader(); ?>', "<?php Header::setupHeader(['common', 'opener']); ?>"],
        ['use OpenEMR\\Core\\Header;', 'use OpenEMR\\Core\\Header as H;'],
        ['<title>\nHelp Searching for Patients\n</title>', '<title>\n<?php echo xlt(\'Help Searching for Patients\'); ?>\n</title>'],
        ['<h1>\nHelp Searching for Patients\n</h1>', '<h2>\nHelp Searching for Patients\n</h2>'],
        ['<h2>\nExplanation of columns\n</h2>', "<h2>\n<?php echo xlt('Explanation of columns'); ?>\n</h2>"],
        ['type 21Smith in the search box.', 'type Smith21 in the search box.'],
        ['phone number.  To view', 'phone number. To view'],
        ["containing 'Smith' and", "containing '<?php echo text($pid); ?>' and"],
        ['<body class="patient-search-help">', '<body class="patient-search-help">\n<?php echo text($_GET[\'pid\'] ?? \'\'); ?>'],
        ['\n<h2>\n</h2>\n<p>\n\n</p>\n', '\n'],
        ['</body>\n</html>\n', '</body>\n</html>'],
        ['media="screen" href=', 'media="all" href='],
        ["attr_url($clinicalAssets->version('patient-search-help.css'))", "$clinicalAssets->version('patient-search-help.css')"],
        ['attr(OEGlobalsBag::getInstance()->getWebRoot())', "attr($GLOBALS['webroot'])"],
        ['<body class="patient-search-help">', '<body class="body_top patient-search-help">'],
    ];
    expect(() => verifyRoute(production)).not.toThrow();
    for (const [before, after] of mutations) {
        // Build the mutant outside toThrow so a missing or duplicate anchor fails here, not as a false pass.
        const mutated = replaceUnique(production, before, after);
        expect(mutated).not.toBe(production);
        expect(() => verifyRoute(mutated)).toThrow();
    }
});

test('the helper adds exactly one sorted asset to the complete original', () => {
    expect(() => verifyHelper(applyHelper(ORIGINAL_HELPER))).not.toThrow();
    expect(() => verifyHelper(read(HELPER))).not.toThrow();
});

test('the helper invariant rejects unlisted, misplaced, duplicate or unrelated changes', () => {
    const production = applyHelper(ORIGINAL_HELPER);
    const mutations = [
        ["        'workspace.css',\n", "        'workspace.css',\n        'unlisted.css',\n"],
        [ADDED_ASSET_LINE + NEXT_ASSET_LINE, NEXT_ASSET_LINE],
        [ADDED_ASSET_LINE + NEXT_ASSET_LINE, NEXT_ASSET_LINE + ADDED_ASSET_LINE],
        ["        'workspace.css',\n", "        'workspace.css',\n" + ADDED_ASSET_LINE],
        ["        'patient-picker-popup.css',\n", ''],
        ['in_array($asset, self::SUPPORTED, true)', 'in_array($asset, self::SUPPORTED)'],
        ["return '0';", "return '1';"],
    ];
    expect(supportedAssets(production)).toHaveLength(supportedAssets(ORIGINAL_HELPER).length + 1);
    for (const [before, after] of mutations) {
        const mutated = replaceUnique(production, before, after);
        expect(mutated).not.toBe(production);
        expect(() => verifyHelper(mutated)).toThrow();
    }
});

test('the sheet matches the exact screen-scoped selector and declaration allowlist', () => {
    expect(() => verifySheet(renderSheet(SPEC))).not.toThrow();
    expect(() => verifySheet(read(SHEET))).not.toThrow();
});

test('the allowlist only pairs colours on the context-scoped body and existing headings', () => {
    for (const [selector, decls] of SPEC) {
        expect([P, `${P} h1`, `${P} h2`]).toContain(selector);
        expect(Object.keys(decls).sort()).toEqual(['background-color', 'color']);
        for (const value of Object.values(decls)) expect(value).not.toMatch(/!important/);
    }
    expect(SPEC.find(([selector]) => selector === `${P} h1`)[1].color).toBe(petrol);
    // Each paired fallback meets WCAG AA for normal text; the live tokens are not checked here.
    for (const [, decls] of SPEC) {
        expect(contrast(fallback(decls.color), fallback(decls['background-color']))).toBeGreaterThanOrEqual(4.5);
    }
});

test('the sheet invariant rejects unscreened rules, leaks, geometry, typography and unpaired colours', () => {
    const sheet = renderSheet(SPEC);
    const mutations = [
        ['@media screen {', '@media all {'],
        ['\n}\n', `\n}\n${P} p {\n  color: ${ink};\n  background-color: ${paper};\n}\n`],
        ['\n}\n', `\n\n  ${P} p {\n    color: ${ink};\n    background-color: ${paper};\n  }\n}\n`],
        [`  ${P} h1 {`, '  body.patient-search-help h1 {'],
        [`  ${P} h2 {`, `  html.oe-workbench-popup body.patient-search-help h2 {`],
        [`  ${P} h2 {`, `  ${P} h2, ${P} p {`],
        [`  ${P} {\n`, `  ${P} {\n    margin: 0;\n`],
        [`  ${P} {\n    color: ${ink};`, `  ${P} {\n    color: ${ink} !important;`],
        [`  ${P} h1 {\n    color: ${petrol};`, `  ${P} h1 {\n    color: ${petrol};\n    font-size: 1.5rem;`],
        [`  ${P} h1 {\n    color: ${petrol};`, `  ${P} h1 {\n    color: ${petrol};\n    border-bottom: 1px solid ${petrol};`],
        [`  ${P} h2 {\n    color: ${ink};\n    background-color: ${paper};\n`, `  ${P} h2 {\n    color: ${ink};\n`],
        [`  ${P} h2 {\n`, `  ${P} h2 {\n    display: none;\n`],
        ['#086878', '#0a7a8c'],
    ];
    expect(() => verifySheet(sheet)).not.toThrow();
    for (const [before, after] of mutations) {
        const mutated = replaceUnique(sheet, before, after);
        expect(mutated).not.toBe(sheet);
        expect(() => verifySheet(mutated)).toThrow();
    }
});

test('the original and candidate help bodies omit the body_top theme class', () => {
    expect(original()).toContain('\n<body>\n<h1>');
    expect(original()).not.toContain('body_top');
    // The colour themes force .body_top's background; the help page is not .body_top before or after.
    expect(read('interface/themes/color_base.scss')).toContain('.body_top,\n.bgcolor2,');
    expect(read(ROUTE)).not.toContain('body_top');
});

test('the caller keeps its named target=_new help link unchanged', () => {
    const caller = read(CALLER);
    expect(caller).toContain(`<a href="./patient_select_help.php" target=_new onclick='top.restoreSession()'>[<?php echo xlt('Help'); ?>]&nbsp;</a>`);
    expect(count(caller, 'patient_select_help.php')).toBe(1);
    expect(caller).not.toMatch(/patient_select_help\.php[^>]*noopener/);
});

test('styling follows the shared controller context class, with no opener fallback added', () => {
    const popup = read(POPUP);
    expect(popup).toContain("const CONTEXT_CLASS = 'oe-workbench-context';");
    // A top-level window reaches the shell only through a same-origin opener chain.
    expect(popup).toContain('if (!current && openerWindow) {\n            current = openerWindow;');
    expect(popup).toContain('const body = attempt(() => (!win.closed && win.location.origin === origin ? win.document.body : null));');
    // Without a parent or opener only the shell root itself gets the class, so a help window
    // that lost its opener keeps the original styling; this slice adds no fallback for it.
    expect(popup).toContain('if ((!parentWindow || parentWindow === win) && !openerWindow) {');
    expect(popup).toContain('return body && isWorkbenchRoot(win.document) ? { body, popup: false } : null;');
    expect(popup).toContain('set(CONTEXT_CLASS, active);');
    // The route and sheet add no script, preference or bootstrap of their own.
    for (const part of ['<script', 'localStorage', 'workbench-active', 'OpenEMRWorkbenchPopup']) {
        expect(applyAdditions(original())).not.toContain(part);
    }
    expect(renderSheet(SPEC)).not.toContain('oe-workbench-popup');
});
