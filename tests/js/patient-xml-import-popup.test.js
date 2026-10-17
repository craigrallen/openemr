/** @jest-environment node */

const fs = require('fs');
const path = require('path');
const postcss = require('postcss');

const root = path.join(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const readOptional = file => (fs.existsSync(path.join(root, file)) ? read(file) : '');
const source = () => read('custom/import_xml.php');
const helper = () => read('src/Common/Assets/ClinicalWorkspaceAssets.php');
const css = () => readOptional('interface/clinical-workspace/patient-xml-import-popup.css');

// The complete 235-line route before presentation changes, including the response branch.
const ORIGINAL = read('tests/clinical-ui/fixtures/patient-xml-import-popup-original.txt');
// The complete 87-line helper before its single sorted entry.
const HELPER_ORIGINAL = String.raw`<?php

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

const IMPORT = 'use OpenEMR\\Common\\Acl\\AclMain;\n';
const ASSET_IMPORT = 'use OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;\n';
const HEADER = '    <?php Header::setupHeader(); ?>\n';
const LINK = '    <link rel="stylesheet" media="screen" href="<?php echo attr(\\OpenEMR\\Core\\OEGlobalsBag::getInstance()->getWebRoot()); ?>'
    + '/interface/clinical-workspace/patient-xml-import-popup.css?v='
    + '<?php echo attr_url((new ClinicalWorkspaceAssets())->version(\'patient-xml-import-popup.css\')); ?>">\n';
const BODY = '<body class="body_top" onload="javascript:document.forms[0].form_import_data.focus()">';
const BODY_MARKED = '<body class="body_top oe-patient-xml-import-popup" onload="javascript:document.forms[0].form_import_data.focus()">';
const SHEET = '    <div class="container">';
const SHEET_MARKED = '    <div class="container oe-patient-xml-import-sheet">';
const ROUTE_EDITS = [
    [IMPORT, IMPORT + ASSET_IMPORT],
    [HEADER, HEADER + LINK],
    [BODY, BODY_MARKED],
    [SHEET, SHEET_MARKED],
];
const ENTRY = "        'patient-xml-import-popup.css',\n";
const HELPER_EDITS = [["        'patient-search.css',\n", "        'patient-search.css',\n" + ENTRY]];

const count = (value, part) => value.split(part).length - 1;
const apply = (value, edits) => edits.reduce((out, [before, after]) => {
    if (count(out, before) !== 1) throw new Error('missing or ambiguous anchor: ' + JSON.stringify(before));
    return out.replace(before, () => after);
}, value);
const inverse = edits => edits.map(([before, after]) => [after, before]);
const verifyExact = (candidate, original, edits, label) => {
    if (candidate !== apply(original, edits)) throw new Error(label + ' differs outside the exact additions');
    if (apply(candidate, inverse(edits)) !== original) throw new Error(label + ' does not restore every original byte');
};
const verifyRoute = candidate => verifyExact(candidate, ORIGINAL, ROUTE_EDITS, 'import_xml.php');
const verifyHelper = candidate => verifyExact(candidate, HELPER_ORIGINAL, HELPER_EDITS, 'ClinicalWorkspaceAssets.php');

const BODY_SCOPE = 'html.oe-workbench-context body.oe-patient-xml-import-popup';
const SHEET_SCOPE = BODY_SCOPE + ' .oe-patient-xml-import-sheet';
const FIELD = SHEET_SCOPE + ' textarea.form-control';
const BUTTONS = [SHEET_SCOPE + ' button.btn-save', SHEET_SCOPE + ' button.btn-cancel'];
const INK = 'var(--oe-wb-ink, #17343b)';
const PAPER = 'var(--oe-wb-paper, #fff)';
const CANVAS = 'var(--oe-wb-canvas, #f3f7f5)';
const PETROL = 'var(--oe-wb-petrol, #086878)';
const decl = (prop, value, important = false) => ({ prop, value, important });
const OUTLINE = [decl('outline', '2px solid ' + PETROL), decl('outline-offset', '2px')];
const RULES = [
    [[BODY_SCOPE], [decl('color', INK), decl('background', CANVAS, true)]],
    [[SHEET_SCOPE], [decl('color', INK), decl('background', PAPER)]],
    [[FIELD, FIELD + ':focus'], [decl('color', INK), decl('background', PAPER)]],
    [[FIELD + ':focus', ...BUTTONS.map(button => button + ':focus')], OUTLINE],
    [[FIELD + ':focus-visible', ...BUTTONS.map(button => button + ':focus-visible')], OUTLINE],
];
const block = ([selectors, declarations]) => selectors.join(',\n') + ' {\n'
    + declarations.map(d => '    ' + d.prop + ': ' + d.value + (d.important ? ' !important' : '') + ';\n').join('')
    + '}\n';
const FUTURE_CSS = '@media screen {\n' + RULES.map(block).join('\n') + '}\n';

// Exact PostCSS AST allowlist: one screen context, five ordered rules, exact selectors,
// declarations, values and importance. No imports, nested media, comments or extra rules.
const verifyCss = value => {
    const rootNode = postcss.parse(value);
    if (rootNode.nodes.length !== 1) throw new Error('expected one screen media rule');
    const media = rootNode.nodes[0];
    if (media.type !== 'atrule' || media.name !== 'media' || media.params !== 'screen') {
        throw new Error('unexpected stylesheet context');
    }
    if (media.nodes.length !== RULES.length) throw new Error('unexpected number of CSS rules');
    media.nodes.forEach((rule, index) => {
        const [selectors, declarations] = RULES[index];
        if (rule.type !== 'rule' || JSON.stringify(rule.selectors) !== JSON.stringify(selectors)) {
            throw new Error('unexpected CSS selector or grouping at ' + index);
        }
        const found = rule.nodes.map(node => {
            if (node.type !== 'decl') throw new Error('unexpected CSS child at ' + index);
            return decl(node.prop, node.value, Boolean(node.important));
        });
        if (JSON.stringify(found) !== JSON.stringify(declarations)) {
            throw new Error('unexpected CSS declaration at ' + index);
        }
    });
};

const FUTURE_ROUTE = apply(ORIGINAL, ROUTE_EDITS);
const FUTURE_HELPER = apply(HELPER_ORIGINAL, HELPER_EDITS);
const mutate = (value, from, to) => {
    expect(count(value, from)).toBe(1);
    const changed = value.replace(from, () => to);
    expect(changed).not.toBe(value);
    return changed;
};

test('frozen full originals and exact forward/inverse forms are coherent', () => {
    expect(ORIGINAL.split('\n')).toHaveLength(236);
    expect(ORIGINAL.endsWith('</html>\n')).toBe(true);
    expect(HELPER_ORIGINAL.split('\n')).toHaveLength(88);
    expect(() => verifyRoute(FUTURE_ROUTE)).not.toThrow();
    expect(() => verifyHelper(FUTURE_HELPER)).not.toThrow();
    expect(() => verifyCss(FUTURE_CSS)).not.toThrow();
    expect(apply(FUTURE_ROUTE, inverse(ROUTE_EDITS))).toBe(ORIGINAL);
    expect(apply(FUTURE_HELPER, inverse(HELPER_EDITS))).toBe(HELPER_ORIGINAL);
    expect(() => verifyRoute(ORIGINAL)).toThrow();
    expect(() => verifyHelper(HELPER_ORIGINAL)).toThrow();
});

test('future route links one escaped, versioned screen sheet and preserves the original form', () => {
    expect(FUTURE_ROUTE).toContain(HEADER + LINK + '    <title>');
    expect(count(FUTURE_ROUTE, LINK)).toBe(1);
    expect(count(FUTURE_ROUTE, ASSET_IMPORT)).toBe(1);
    expect(FUTURE_ROUTE).toContain(BODY_MARKED + '\n<form method=\'post\' action="import_xml.php" onsubmit="return top.restoreSession()">');
    expect(FUTURE_ROUTE).toContain(SHEET_MARKED);
    for (const original of [
        "if (!empty($_POST['form_import'])) {", "(string) $_POST['form_import_data']",
        "name='form_import_data' class='form-control' rows='10'", "name='form_import' value='bn_import'",
        'onclick="dlgclose()"', "CsrfUtils::collectCsrfToken(session: $session)",
        "setInsurance($pid, $ainsurance, $asubscriber, '1');",
        "setInsurance($pid, $ainsurance, $asubscriber, '2');",
        "setInsurance($pid, $ainsurance, $asubscriber, '3');",
    ]) expect(FUTURE_ROUTE).toContain(original);
    const entries = [...FUTURE_HELPER.matchAll(/^ {8}'([^']+)',$/gm)].map(match => match[1]);
    expect(entries).toEqual([...entries].sort());
    expect(entries.filter(entry => entry === 'patient-xml-import-popup.css')).toHaveLength(1);
    expect(entries).toHaveLength(25);
});

test('full route and helper reject source, behavior, markup and asset mutations', () => {
    const routeMutants = [
        ["AclMain::aclCheckCore('patients', 'demo', '', 'write')", "AclMain::aclCheckCore('patients', 'demo', '', 'read')"],
        ['CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: true);', ''],
        ["$parser = xml_parser_create();", "$parser = null;"],
        ["$tag = strtolower((string) $taginfo['tag']);", "$tag = (string) $taginfo['tag'];"],
        ["$apatient[$tag] = $tagval;", "$apcp[$tag] = $tagval;"],
        ["AclMain::aclCheckCore('squads', $olddata['squad'])", "AclMain::aclCheckCore('squads', '')"],
        ["($olddata['squad'] ?? 0)", '0'],
        ['newPatientData(\n', 'oldPatientData(\n'],
        ["newEmployerData(\n", "oldEmployerData(\n"],
        ['newInsuranceData(\n', 'oldInsuranceData(\n'],
        ["setInsurance($pid, $ainsurance, $asubscriber, '3');", ''],
        ['if (!opener.closed && opener.refreshme) opener.refreshme();', 'opener.refreshme();'],
        ["onsubmit=\"return top.restoreSession()\"", 'onsubmit="return true"'],
        ["rows='10'", "rows='12'"],
        ["value='bn_import'", "value='import'"],
        ['onclick="dlgclose()"', 'onclick="window.close()"'],
        ["xlt('Import')", "xlt('Save')"],
        [SHEET_MARKED, '<div class="oe-extra">\n' + SHEET_MARKED],
        [BODY_MARKED, BODY_MARKED.replace('onload=', 'data-no-focus=')],
        ['media="screen"', 'media="all"'],
        ['attr_url((new ClinicalWorkspaceAssets())->version', 'attr((new ClinicalWorkspaceAssets())->version'],
        [LINK, LINK + LINK],
    ].map(([from, to]) => mutate(FUTURE_ROUTE, from, to));
    routeMutants.push(FUTURE_ROUTE + ' ', FUTURE_ROUTE.slice(0, -1));
    routeMutants.forEach(candidate => expect(() => verifyRoute(candidate)).toThrow());

    const helperMutants = [
        [ENTRY, ''], [ENTRY, ENTRY + ENTRY],
        ["        'patient-search.css',\n" + ENTRY, ENTRY + "        'patient-search.css',\n"],
        ["throw new \\InvalidArgumentException('Unsupported clinical workspace asset');", "return '0';"],
    ].map(([from, to]) => mutate(FUTURE_HELPER, from, to));
    helperMutants.push(FUTURE_HELPER + ' ');
    helperMutants.forEach(candidate => expect(() => verifyHelper(candidate)).toThrow());
});

test('strict CSS AST rejects scope leaks, unsafe grouping, extra paint, imports and importance changes', () => {
    const mutants = [
        [BODY_SCOPE + ' {', 'body.oe-patient-xml-import-popup {'],
        [SHEET_SCOPE + ' {', '.oe-patient-xml-import-sheet {'],
        [FIELD + ',\n' + FIELD + ':focus', FIELD + ',\n' + FIELD + ':focus-visible'],
        [FIELD + ':focus-visible,\n', 'button:focus-visible,\n'],
        [RULES[3][0].join(',\n'), RULES[3][0].concat(RULES[4][0]).join(',\n')],
        ['background: ' + CANVAS + ' !important;', 'background: ' + CANVAS + ';'],
        ['background: ' + CANVAS + ' !important;', 'background: ' + CANVAS + ' !important;\n    padding: 1rem;'],
        [block(RULES[2]), block(RULES[2]).replace('color: ' + INK + ';', 'font-size: 1rem;')],
        [block(RULES[4]), block(RULES[4]).replace('outline-offset: 2px;', 'outline-offset: 2px !important;')],
        [block(RULES[4]), ''],
        ['@media screen {', '@media print {'],
        ['@media screen {', '@import "workspace.css";\n@media screen {'],
        ['@media screen {', '@media screen {\n@media screen {'],
        [block(RULES[4]), block(RULES[4]) + '\n' + SHEET_SCOPE + ' button { background: red; }\n'],
    ].map(([from, to]) => mutate(FUTURE_CSS, from, to));
    mutants.forEach(candidate => expect(() => verifyCss(candidate)).toThrow());
});

test('actual route matches exactly the four declared additions', () => {
    expect(() => verifyRoute(source())).not.toThrow();
});

test('actual helper matches exactly the single sorted entry', () => {
    expect(() => verifyHelper(helper())).not.toThrow();
});

test('actual stylesheet matches the screen-only route palette and focus allowlist', () => {
    expect(() => verifyCss(css())).not.toThrow();
});

test.each(['standard', 'front_office'])('%s menu source launches the existing import popup', menu => {
    const tree = JSON.parse(read('interface/main/tabs/menu/menus/' + menu + '.json'));
    const found = [];
    const visit = value => {
        if (!value || typeof value !== 'object') return;
        if (value.url === '/custom/import_xml.php') found.push(value);
        Object.values(value).forEach(visit);
    };
    visit(tree);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
        label: 'Import', menu_id: 'Popup:Import', target: 'pop',
        acl_req: ['patients', 'demo', 'write'], global_req: '!ippf_specific',
    });
});

test('generic pop launcher source starts at 500 pixels with auto height', () => {
    const js = read('interface/main/tabs/js/tabs_view_model.js');
    expect(js).toContain("if (data.target === 'pop') {");
    expect(js).toContain('return popMenuDialog(webroot_url + data.url(), title);');
    expect(js).toContain("dlgopen(url, 'menupopup', 'modal-mlg', 500, '', title, {");
    expect(js).toContain("sizeHeight: notlike.search('label') !== -1 ? 'full' : 'auto'");
});
