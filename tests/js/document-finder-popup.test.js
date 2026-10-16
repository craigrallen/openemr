/** @jest-environment node */

/*
 * Document Finder (interface/main/finder/document_select.php) inside a workbench popup.
 *
 * The route may change by exactly four presentation additions: the asset helper import,
 * one escaped, versioned, screen-only stylesheet link after Header::setupHeader, a body
 * class appended to body_top, and a class appended to the existing container-responsive
 * div. Undoing them must give back tests/clinical-ui/fixtures/document-finder-original.txt
 * byte for byte, so the backend, session, CSRF, optional patient scope, the 26-row search
 * limit, Document::can_access() filtering, escaping, status alerts, hover rule, selection
 * callback and every control survive untouched.
 *
 * Two inherited defects are deliberately kept and pinned here rather than fixed in a UI
 * slice: the data-category attribute is emitted without its opening quote, and the search
 * is only patient-scoped when the request carries a pid that resolves to a patient (a
 * session-only pid fills the hidden field but leaves the search unscoped).
 *
 * The sheet only paints paired ink/background, the opaque placeholder and focus rings.
 * Source tests cannot prove rendered geometry, so none is claimed.
 */

const fs = require('fs');
const path = require('path');
const postcss = require('postcss');

const root = path.join(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const ROUTE = 'interface/main/finder/document_select.php';
const SHEET = 'interface/clinical-workspace/document-finder-popup.css';
const HELPER = 'src/Common/Assets/ClinicalWorkspaceAssets.php';
const FIXTURE = 'tests/clinical-ui/fixtures/document-finder-original.txt';
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
        'use OpenEMR\\Common\\Csrf\\CsrfUtils;',
        'use OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;\nuse OpenEMR\\Common\\Csrf\\CsrfUtils;',
    ],
    [
        "    <?php Header::setupHeader(['common', 'opener']); ?>",
        "    <?php Header::setupHeader(['common', 'opener']); ?>\n"
            + '    <?php $clinicalAssets = new ClinicalWorkspaceAssets(); ?>\n'
            + '    <link rel="stylesheet" media="screen" href="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>/interface/clinical-workspace/document-finder-popup.css?v=<?php echo attr_url($clinicalAssets->version(\'document-finder-popup.css\')); ?>">',
    ],
    ['<body class="body_top">', '<body class="body_top document-finder-popup">'],
    ['<div class="container-responsive">', '<div class="container-responsive document-finder-document">'],
];

const applyAdditions = php => ADDITIONS.reduce((text, [before, after]) => replaceUnique(text, before, after), php);

function restoreRoute(php) {
    let restored = php;
    for (const [before, after] of ADDITIONS) restored = replaceUnique(restored, after, before);
    return restored;
}

function verifyRoute(php) {
    if (!Buffer.from(restoreRoute(php), 'utf8').equals(originalBytes())) {
        throw new Error('Route differs from the original beyond the four declared additions');
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

const ADDED_ASSET_LINE = "        'document-finder-popup.css',\n";
const applyHelper = php => replaceUnique(php, "        'encounter-document.css',\n", ADDED_ASSET_LINE + "        'encounter-document.css',\n");

function supportedAssets(php) {
    const block = php.match(/private const SUPPORTED = \[\n([\s\S]*?)\n {4}\];/);
    if (!block) throw new Error('SUPPORTED list not found');
    return block[1].split('\n').map(line => line.trim().replace(/^'(.*)',$/, '$1'));
}

function verifyHelper(php) {
    if (count(php, ADDED_ASSET_LINE) !== 1) throw new Error('Expected exactly one document-finder-popup.css entry');
    if (php.replace(ADDED_ASSET_LINE, '') !== ORIGINAL_HELPER) throw new Error('Helper differs beyond the one new asset');
    const assets = supportedAssets(php);
    if (assets.join('\n') !== [...assets].sort().join('\n')) throw new Error('SUPPORTED is not sorted');
    if (new Set(assets).size !== assets.length) throw new Error('SUPPORTED has duplicates');
}

// The complete sheet, rule by rule and in cascade order. One selector per rule, so an
// unsupported pseudo-class (:focus-visible) cannot drop the :focus fallback with it.
const P = 'html.oe-workbench-popup body.document-finder-popup';
const FIELD = `${P} #theform:not(.was-validated) #searchparm:not(.is-invalid):not(.is-valid)`;
const ink = 'var(--oe-wb-ink, #17343b)';
const muted = 'var(--oe-wb-muted, #526a70)';
const paper = 'var(--oe-wb-paper, #fff)';
const canvas = 'var(--oe-wb-canvas, #f3f7f5)';
const disabledInk = 'var(--oe-wb-disabled-ink, #4a5f64)';
const disabledPaper = 'var(--oe-wb-disabled-paper, #eef2f1)';
const ring = { outline: '2px solid var(--oe-wb-petrol, #086878)', 'outline-offset': '1px' };
const SPEC = [
    // .body_top carries the colour themes' background-color !important (color_base.scss).
    [P, { color: ink, 'background-color': `${canvas} !important` }],
    [`${P} .document-finder-document`, { color: ink, 'background-color': paper }],
    // Bootstrap's .bg-light is background-color !important.
    [`${P} #searchCriteria.bg-light`, { color: ink, 'background-color': `${canvas} !important` }],
    // Only the neutral status; .alert-success/.alert-danger keep their semantic palettes.
    [`${P} #searchstatus:not(.alert)`, { color: ink, 'background-color': paper }],
    [`${P} #searchResultsHeader th`, { color: muted, 'background-color': canvas }],
    // Hovered rows keep the original #336699 highlight painted on the row.
    [`${P} #searchResults .oneresult:not(:hover) > td`, { color: ink, 'background-color': paper }],
    [FIELD, { color: ink, 'background-color': paper }],
    [`${FIELD}:focus`, { color: ink, 'background-color': paper }],
    [`${FIELD}:disabled`, { color: disabledInk, 'background-color': disabledPaper }],
    [`${FIELD}[readonly]`, { color: disabledInk, 'background-color': disabledPaper }],
    [`${FIELD}::placeholder`, { color: muted, opacity: '1' }],
    [`${P} #searchparm:focus`, ring],
    [`${P} #searchparm:focus-visible`, ring],
    [`${P} #submitbtn:focus`, ring],
    [`${P} #submitbtn:focus-visible`, ring],
];

const renderSheet = spec => '/* Document Finder inside an active workbench popup: paint only. */\n@media screen {\n'
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

test('the fixture is the documented original route', () => {
    const php = original();
    expect(php.startsWith('<?php\n\n/**\n * document_select.php is intended')).toBe(true);
    expect(php.endsWith('</div>\n</body>\n</html>\n')).toBe(true);
    for (const [before] of ADDITIONS) expect(count(php, before)).toBe(1);
    expect(php).not.toContain('ClinicalWorkspaceAssets');
    expect(php).not.toContain('document-finder-popup');
});

test('undoing only the four declared additions restores every original route byte', () => {
    expect(() => verifyRoute(applyAdditions(original()))).not.toThrow();
    expect(() => verifyRoute(read(ROUTE))).not.toThrow();
});

test('the stylesheet link is escaped, versioned and screen only, after Header', () => {
    const php = read(ROUTE);
    expect(php).toContain(ADDITIONS[1][1]);
    expect(php.indexOf('ClinicalWorkspaceAssets();')).toBeGreaterThan(php.indexOf('Header::setupHeader('));
    expect(php.indexOf('document-finder-popup.css?v=')).toBeLessThan(php.indexOf('<title>'));
    expect(count(php, '<link rel="stylesheet"')).toBe(1);
    expect(php).toContain('<body class="body_top document-finder-popup">');
    expect(php).toContain('<div class="container-responsive document-finder-document">');
});

test('the route invariant rejects backend, security, callback, control and hover edits', () => {
    const production = applyAdditions(original());
    const mutations = [
        ['if (!CsrfUtils::verifyCsrfToken(', 'if (CsrfUtils::verifyCsrfToken('],
        ['CsrfUtils::collectCsrfToken(session: $session)', "'static-token'"],
        ['if ($document->can_access()) {', 'if (true) {'],
        ["$searchArray['foreign_id'] = $pid;", "$searchArray['foreign_id'] = $session->get('pid');"],
        ["if (!empty($_REQUEST['pid'])) {", 'if (!empty($pid)) {'],
        ['$pid = intval($rawPid);', '$pid = $rawPid;'],
        ['$MAX_RECORDS = 25;', '$MAX_RECORDS = 50;'],
        ['count($result) >= $MAX_RECORDS', 'count($result) > $MAX_RECORDS'],
        ['SearchModifier::CONTAINS', 'SearchModifier::EXACT'],
        ["\"  <td class='srName'>\" . text($name)", "\"  <td class='srName'>\" . $name"],
        ['value="<?php echo attr($pid); ?>"', 'value="<?php echo $pid; ?>"'],
        ["value='<?php echo attr($_REQUEST['searchparm'] ?? ''); ?>'", "value='<?php echo $_REQUEST['searchparm'] ?? ''; ?>'"],
        ['opener.setSelectedDocument(did, name, category, date);', 'opener.setSelectedDocument(did, category, name, date);'],
        ["id='searchparm' name='searchparm'", "id='searchparm' name='query'"],
        ['type=\'submit\' id="submitbtn"', 'type=\'button\' id="submitbtn"'],
        ['.oneresult:hover {', '.oneresult:focus {'],
        ['background-color: #336699;', 'background-color: var(--oe-wb-petrol);'],
        ['class="alert alert-success rounded-0"', 'class="alert alert-info rounded-0"'],
        ['"\' data-category="', '"\' data-category=\'"'],
        ['media="screen" href=', 'media="all" href='],
        ["attr_url($clinicalAssets->version('document-finder-popup.css'))", "$clinicalAssets->version('document-finder-popup.css')"],
        ['<body class="body_top document-finder-popup">', '<body class="document-finder-popup">'],
    ];
    expect(() => verifyRoute(production)).not.toThrow();
    for (const [before, after] of mutations) {
        expect(() => verifyRoute(replaceUnique(production, before, after))).toThrow();
    }
});

test('inherited data-category and patient-scope gaps are pinned unchanged, not fixed here', () => {
    for (const php of [original(), read(ROUTE)]) {
        expect(php).toContain(". \"' data-category=\" . attr($category) . \"' data-date='\" . attr($date) . \"'>\";");
        expect(php).toContain("$pid = $_REQUEST['pid'] ?? $session->get('pid') ?? null;");
        expect(php).toMatch(/if \(!empty\(\$_REQUEST\['pid'\]\)\) \{[\s\S]*?if \(!empty\(\$patientArray\)\) \{[\s\S]*?\$searchArray\['foreign_id'\] = \$pid;/);
        expect(php).toContain("<?php if (!empty($pid)) : ?>\n                <input type=\"hidden\" name=\"pid\"");
    }
});

test('the helper adds exactly one sorted asset to the complete original', () => {
    expect(() => verifyHelper(applyHelper(ORIGINAL_HELPER))).not.toThrow();
    expect(() => verifyHelper(read(HELPER))).not.toThrow();
});

test('the helper invariant rejects unlisted, misplaced or duplicate assets', () => {
    const production = applyHelper(ORIGINAL_HELPER);
    const mutations = [
        ["        'workspace.css',\n", "        'workspace.css',\n        'unlisted.css',\n"],
        [ADDED_ASSET_LINE + "        'encounter-document.css',\n", "        'encounter-document.css',\n"],
        [ADDED_ASSET_LINE + "        'encounter-document.css',\n", "        'encounter-document.css',\n" + ADDED_ASSET_LINE],
        ["        'workspace.css',\n", "        'workspace.css',\n" + ADDED_ASSET_LINE],
        ['in_array($asset, self::SUPPORTED, true)', 'in_array($asset, self::SUPPORTED)'],
    ];
    expect(supportedAssets(production)).toHaveLength(supportedAssets(ORIGINAL_HELPER).length + 1);
    for (const [before, after] of mutations) {
        expect(() => verifyHelper(replaceUnique(production, before, after))).toThrow();
    }
});

test('the sheet matches the exact screen-scoped selector and declaration allowlist', () => {
    expect(() => verifySheet(renderSheet(SPEC))).not.toThrow();
    expect(() => verifySheet(read(SHEET))).not.toThrow();
});

test('the allowlist only pairs colours, rings focus and keeps the original geometry', () => {
    const allowed = new Set(['color', 'background-color', 'outline', 'outline-offset', 'opacity']);
    for (const [selector, decls] of SPEC) {
        expect(selector.startsWith(`${P} `) || selector === P).toBe(true);
        for (const prop of Object.keys(decls)) expect(allowed.has(prop)).toBe(true);
        if ('background-color' in decls) expect(decls).toHaveProperty('color');
        if ('color' in decls && !selector.endsWith('::placeholder')) expect(decls).toHaveProperty('background-color');
        expect(selector).not.toMatch(/\.alert-|(?<!:not\():hover/);
    }
    const important = SPEC.flatMap(([selector, decls]) => Object.entries(decls)
        .filter(([, value]) => value.endsWith('!important')).map(([prop]) => `${selector} | ${prop}`));
    expect(important).toEqual([`${P} | background-color`, `${P} #searchCriteria.bg-light | background-color`]);
    for (const control of ['#searchparm', '#submitbtn']) {
        expect(SPEC.filter(([selector]) => selector === `${P} ${control}:focus`)).toHaveLength(1);
        expect(SPEC.filter(([selector]) => selector === `${P} ${control}:focus-visible`)).toHaveLength(1);
    }
    for (const state of ['', ':focus', ':disabled', '[readonly]', '::placeholder']) {
        expect(SPEC.some(([selector]) => selector === `${FIELD}${state}`)).toBe(true);
    }
    expect(SPEC.find(([selector]) => selector.endsWith('::placeholder'))[1]).toEqual({ color: muted, opacity: '1' });
});

test('both !important allowances answer an actual !important in the theme cascade', () => {
    expect(read('interface/themes/color_base.scss')).toMatch(/\.body_top,\n\.bgcolor2,\n\.body_nav \{\n {2}background-color: \$paler !important;\n\}/);
    expect(read('node_modules/bootstrap/dist/css/bootstrap.css')).toMatch(/\.bg-light \{\n {2}background-color: #f8f9fa !important;\n\}/);
    expect(original()).toContain('<body class="body_top">');
    expect(original()).toContain('<div id="searchCriteria" class="bg-light p-2 pt-3">');
    // The original hover paints the row; the cell rule must leave hovered cells transparent.
    expect(original()).toContain('.oneresult:hover {\n            background-color: #336699;\n            color: var(--white);\n        }');
});

test('the sheet invariant rejects extra selectors, properties, importants and geometry', () => {
    const sheet = renderSheet(SPEC);
    const mutations = [
        ['\n}\n', `\n\n  ${P} #searchResults td {\n    color: ${ink};\n    background-color: ${paper};\n  }\n}\n`],
        ['    opacity: 1;', '    opacity: 1;\n    padding: 0;'],
        ['    opacity: 1;', '    opacity: 1 !important;'],
        [`#searchstatus:not(.alert) {\n`, `#searchstatus:not(.alert) {\n    margin: 0;\n`],
        [`bg-light {\n    color: ${ink};\n    background-color: ${canvas} !important;`, `bg-light {\n    color: ${ink};\n    background-color: ${canvas};`],
        ['.oneresult:not(:hover) > td', '.oneresult > td'],
        ['#searchstatus:not(.alert)', '#searchstatus'],
        [`${FIELD}::placeholder`, `${P} #searchparm::placeholder`],
        [`  ${P} #submitbtn:focus {`, `  ${P} #searchparm:focus, ${P} #submitbtn:focus {`],
        [`  ${P} #searchResultsHeader th {`, '  #searchResultsHeader th {'],
        ['@media screen {', '@media all {'],
        [`  ${P} {\n    color: ${ink};\n`, `  ${P} {\n    color: ${ink};\n    font-size: 0.9rem;\n`],
    ];
    expect(() => verifySheet(sheet)).not.toThrow();
    for (const [before, after] of mutations) {
        expect(() => verifySheet(replaceUnique(sheet, before, after))).toThrow();
    }
});
