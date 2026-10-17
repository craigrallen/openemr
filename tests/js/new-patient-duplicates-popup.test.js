/** @jest-environment node */

const fs = require('fs');
const path = require('path');
const postcss = require('postcss');

const root = path.join(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const readOptional = file => fs.existsSync(path.join(root, file)) ? read(file) : '';
const route = () => read('interface/new/new_search_popup.php');
const helper = () => read('src/Common/Assets/ClinicalWorkspaceAssets.php');
const css = () => readOptional('interface/clinical-workspace/new-patient-duplicates-popup.css');

// Every byte of the 294-line route before this change, including query and popup behavior.
const ORIGINAL = read('tests/clinical-ui/fixtures/new-patient-duplicates-popup-original.txt');
// The complete original helper, before adding the one supported stylesheet.
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

const IMPORT = 'use OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;\n';
const CSRF_IMPORT = 'use OpenEMR\\Common\\Csrf\\CsrfUtils;\n';
const HEADER = "    <?php Header::setupHeader('opener'); ?>\n";
const LINK = '    <link rel="stylesheet" media="screen" href="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>'
    + '/interface/clinical-workspace/new-patient-duplicates-popup.css?v='
    + '<?php echo attr_url((new ClinicalWorkspaceAssets())->version(\'new-patient-duplicates-popup.css\')); ?>">\n';
const SHEET = '<div id="searchResultsHeader" class="table-responsive">';
const MARKED_SHEET = '<div id="searchResultsHeader" class="table-responsive oe-new-patient-duplicates-sheet">';
const ACTIONS = '        <div style="text-align: center;">';
const MARKED_ACTIONS = '        <div class="oe-new-patient-duplicates-actions" style="text-align: center;">';
const ROUTE_EDITS = [
    [CSRF_IMPORT, IMPORT + CSRF_IMPORT],
    [HEADER, HEADER + LINK],
    [SHEET, MARKED_SHEET],
    [ACTIONS, MARKED_ACTIONS],
];
const ENTRY = "        'new-patient-duplicates-popup.css',\n";
const HELPER_EDITS = [["        'mode.js',\n        'patient-messages.css',\n",
    "        'mode.js',\n" + ENTRY + "        'patient-messages.css',\n"]];

const count = (value, part) => value.split(part).length - 1;
const apply = (value, edits) => edits.reduce((out, [before, after]) => {
    if (count(out, before) !== 1) throw new Error('missing or ambiguous anchor: ' + JSON.stringify(before));
    return out.replace(before, () => after);
}, value);
const inverse = edits => edits.map(([before, after]) => [after, before]);
const verifyExact = (candidate, original, edits, label) => {
    const expected = apply(original, edits);
    if (candidate !== expected) throw new Error(label + ' differs outside exact additions');
    if (apply(candidate, inverse(edits)) !== original) throw new Error(label + ' does not restore every original byte');
};
const verifyRoute = candidate => verifyExact(candidate, ORIGINAL, ROUTE_EDITS, 'new_search_popup.php');
const verifyHelper = candidate => verifyExact(candidate, HELPER_ORIGINAL, HELPER_EDITS, 'ClinicalWorkspaceAssets.php');

const SCOPE = 'html.oe-workbench-context #searchResultsHeader.oe-new-patient-duplicates-sheet';
const INK = 'var(--oe-wb-ink, #17343b)';
const PAPER = 'var(--oe-wb-paper, #fff)';
const PETROL = 'var(--oe-wb-petrol, #086878)';
const decl = (prop, value) => ({ prop, value, important: false });
const focus = suffix => [SCOPE + ' .oe-new-patient-duplicates-actions button' + suffix,
    SCOPE + " .oe-new-patient-duplicates-actions input[type='button']" + suffix];
const RULES = [
    [[SCOPE + ' > table > thead.thead-light > tr > th'], [decl('color', INK), decl('background', PAPER)]],
    [[SCOPE + ' .oe-new-patient-duplicates-actions'], [decl('color', INK), decl('background', PAPER)]],
    [focus(':focus'), [decl('outline', '2px solid ' + PETROL), decl('outline-offset', '2px')]],
    [focus(':focus-visible'), [decl('outline', '2px solid ' + PETROL), decl('outline-offset', '2px')]],
];
const block = ([selectors, declarations]) => selectors.join(',\n') + ' {\n'
    + declarations.map(d => '    ' + d.prop + ': ' + d.value + ';\n').join('') + '}\n';
const FUTURE_CSS = '@media screen {\n' + RULES.map(block).join('\n') + '}\n';

// PostCSS enforces the complete AST allowlist, including order and !important state.
const verifyCss = value => {
    const ast = postcss.parse(value);
    if (ast.nodes.length !== 1) throw new Error('expected one screen media rule');
    const media = ast.nodes[0];
    if (media.type !== 'atrule' || media.name !== 'media' || media.params !== 'screen') {
        throw new Error('unexpected stylesheet context');
    }
    if (media.nodes.length !== RULES.length) throw new Error('unexpected CSS rule count');
    media.nodes.forEach((rule, index) => {
        const [selectors, declarations] = RULES[index];
        if (rule.type !== 'rule' || JSON.stringify(rule.selectors) !== JSON.stringify(selectors)) {
            throw new Error('unexpected CSS selector or focus grouping at ' + index);
        }
        const found = rule.nodes.map(node => {
            if (node.type !== 'decl') throw new Error('unexpected CSS child at ' + index);
            return { prop: node.prop, value: node.value, important: Boolean(node.important) };
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

test('synthetic forward and full inverse contracts accept only declared additions', () => {
    expect(ORIGINAL.split('\n')).toHaveLength(295);
    expect(ORIGINAL.endsWith('</html>\n')).toBe(true);
    expect(HELPER_ORIGINAL.split('\n')).toHaveLength(88);
    expect(() => verifyRoute(FUTURE_ROUTE)).not.toThrow();
    expect(() => verifyHelper(FUTURE_HELPER)).not.toThrow();
    expect(() => verifyCss(FUTURE_CSS)).not.toThrow();
    expect(apply(FUTURE_ROUTE, inverse(ROUTE_EDITS))).toBe(ORIGINAL);
    expect(apply(FUTURE_HELPER, inverse(HELPER_EDITS))).toBe(HELPER_ORIGINAL);
    expect(() => verifyRoute(ORIGINAL)).toThrow();
    expect(() => verifyHelper(HELPER_ORIGINAL)).toThrow();
    expect(() => verifyCss('')).toThrow();
});

test('synthetic route retains query, session, escaping, selection and creation behavior', () => {
    expect(FUTURE_ROUTE).toContain(HEADER + LINK);
    for (const addition of [IMPORT, LINK, MARKED_SHEET, MARKED_ACTIONS]) {
        expect(count(FUTURE_ROUTE, addition)).toBe(1);
    }
    for (const anchor of [
        "CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: true);",
        "AclMain::aclCheckCore('patients', 'demo')",
        "SessionWrapperFactory::getInstance()->getActiveSession()",
        "$request->request->has('fstart')",
        "$request->query->get('fstart')",
        "$MAXSHOW = 100;",
        "$pdColumns = sqlListFields('patient_data');",
        "if (!in_array($fldname, $pdColumns)) {",
        "if ($fldname == 'pubpid') {",
        "$relevance .= \" + 1000 * ( \" . $quotedField . \" LIKE ? )\";",
        "array_push($sqlBindArraySpecial, $value);",
        '"FROM patient_data WHERE $where " .',
        '"ORDER BY relevance DESC, lname, fname, mname " .',
        '"LIMIT ? OFFSET ?";',
        '$sqlBindArray = array_merge($sqlBindArray, $sqlBindArraySpecial);',
        '_set_patient_inc_count($MAXSHOW, count($result), $where, $sqlBindArraySpecial);',
        "CsrfUtils::collectCsrfToken(session: $session)",
        'attr((string) $fstart)',
        'attr($key)',
        'attr($value)',
        'text($message)',
        "text(xl_layout_label($trow['title']))",
        "attr($iter['pid'])",
        'text($relevance)',
        "text($iter['lname'] . \", \" . $iter['fname'])",
        'text($iter[$field_id])',
        "<?php if ($pubpid_matched) { ?>",
        "id='confirmCreate'",
        "onclick='dlgclose(\"srcConfirmSave\", false);'",
        "onclick='dlgclose();'",
        'if (empty($simpleSearch))',
        'SelectPatient(this);',
        'var SelectPatient = function (eObj)',
        "opener.<?php echo $target; ?>.location.href = '<?php echo $newPage; ?>' + parts[0];",
        'var f = opener.document.forms[0];',
        'f.create.value =',
        "background-color: <?php echo attr($searchcolor); ?>;",
        '.topResult {',
        '.billing {',
        '.highlight {',
    ]) expect(FUTURE_ROUTE).toContain(anchor);
    const entries = [...FUTURE_HELPER.matchAll(/^ {8}'([^']+)',$/gm)].map(match => match[1]);
    expect(entries).toEqual([...entries].sort());
    expect(entries.filter(entry => entry === 'new-patient-duplicates-popup.css')).toHaveLength(1);
    expect(entries).toHaveLength(25);
});

test('exact source contracts reject each omitted addition, behavior mutations and arbitrary drift', () => {
    const routeMutants = [
        [IMPORT, ''], [LINK, ''], [MARKED_SHEET, SHEET], [MARKED_ACTIONS, ACTIONS],
        [LINK, LINK + LINK],
        ['media="screen"', 'media="all"'],
        ["attr(OEGlobalsBag::getInstance()->getWebRoot())", 'OEGlobalsBag::getInstance()->getWebRoot()'],
        ["attr_url((new ClinicalWorkspaceAssets())->version", "attr((new ClinicalWorkspaceAssets())->version"],
        ["CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: true);", ''],
        ["AclMain::aclCheckCore('patients', 'demo')", 'true'],
        ["SessionWrapperFactory::getInstance()->getActiveSession()", 'null'],
        ["$request->query->get('fstart')", '0'],
        ['$MAXSHOW = 100;', '$MAXSHOW = 1000;'],
        ["$pdColumns = sqlListFields('patient_data');", '$pdColumns = [];'],
        ["if (!in_array($fldname, $pdColumns)) {", 'if (false) {'],
        ["if ($fldname == 'pubpid') {", 'if (false) {'],
        ["$relevance .= \" + 1000 * ( \" . $quotedField . \" LIKE ? )\";", '$relevance .= "0";'],
        ["array_push($sqlBindArraySpecial, $value);", ''],
        ['"FROM patient_data WHERE $where " .', '"FROM patient_data " .'],
        ['"ORDER BY relevance DESC, lname, fname, mname " .', '"ORDER BY lname " .'],
        ['"LIMIT ? OFFSET ?";', '"LIMIT 100";'],
        ['$sqlBindArray = array_merge($sqlBindArray, $sqlBindArraySpecial);', ''],
        ['_set_patient_inc_count($MAXSHOW, count($result), $where, $sqlBindArraySpecial);', ''],
        ["CsrfUtils::collectCsrfToken(session: $session)", "'token'"],
        ['attr((string) $fstart)', '$fstart'],
        ['attr($key)', '$key'],
        ['attr($value)', '$value'],
        ['text($message)', '$message'],
        ["text(xl_layout_label($trow['title']))", "$trow['title']"],
        ["attr($iter['pid'])", "$iter['pid']"],
        ['text($relevance)', '$relevance'],
        ["text($iter['lname'] . \", \" . $iter['fname'])", "$iter['lname']"],
        ['text($iter[$field_id])', '$iter[$field_id]'],
        ["<?php if ($pubpid_matched) { ?>\n                <input", '<?php if (false) { ?>\n                <input'],
        ["id='confirmCreate'", "id='create'"],
        ["onclick='dlgclose(\"srcConfirmSave\", false);'", "onclick='dlgclose();'"],
        ['if (empty($simpleSearch))', 'if (true)'],
        ['SelectPatient(this);', 'dlgclose();'],
        ['var SelectPatient = function (eObj)', 'var SelectPatient = function ()'],
        ["opener.<?php echo $target; ?>.location.href = '<?php echo $newPage; ?>' + parts[0];", 'dlgclose();'],
        ['var f = opener.document.forms[0];', 'var f = document.forms[0];'],
        ['f.create.value =', 'f.create.disabled ='],
        ['.topResult {', '.topResult, .billing {'],
        ['.highlight {', '.highlight, tr {'],
    ].map(([from, to]) => mutate(FUTURE_ROUTE, from, to));
    routeMutants.push(FUTURE_ROUTE + ' ', FUTURE_ROUTE.slice(0, -1));
    routeMutants.forEach(candidate => expect(() => verifyRoute(candidate)).toThrow());

    const helperMutants = [
        [ENTRY, ''], [ENTRY, ENTRY + ENTRY],
        ["        'mode.js',\n" + ENTRY, ENTRY + "        'mode.js',\n"],
        ["throw new \\InvalidArgumentException('Unsupported clinical workspace asset');", "return '0';"],
    ].map(([from, to]) => mutate(FUTURE_HELPER, from, to));
    helperMutants.push(FUTURE_HELPER + ' ');
    helperMutants.forEach(candidate => expect(() => verifyHelper(candidate)).toThrow());
});

test('strict CSS AST rejects row repaint, layout, palette, scope, focus and media mutations', () => {
    const mutants = [
        [SCOPE + ' > table', '#searchResultsHeader > table'],
        [SCOPE + ' .oe-new-patient-duplicates-actions button:focus,\n',
            SCOPE + ' .oe-new-patient-duplicates-actions button:focus-visible,\n'],
        [SCOPE + " .oe-new-patient-duplicates-actions input[type='button']:focus {",
            SCOPE + " .oe-new-patient-duplicates-actions input[type='submit']:focus {"],
        [block(RULES[0]), block(RULES[0]).replace('color: ' + INK + ';', 'color: red;')],
        [block(RULES[1]), block(RULES[1]).replace('background: ' + PAPER + ';',
            'background: ' + PAPER + ' !important;')],
        [block(RULES[2]), block(RULES[2]).replace('outline: 2px solid ' + PETROL + ';', 'outline: none;')],
        [block(RULES[3]), ''],
        ['@media screen {', '@media print {'],
        ['@media screen {', '@media screen and (min-width: 600px) {'],
        ['@media screen {', '@import "workspace.css";\n@media screen {'],
        [block(RULES[3]), block(RULES[3]) + '\n' + SCOPE + ' tr { background: red; }\n'],
        [block(RULES[3]), block(RULES[3]) + '\n' + SCOPE + ' .topResult { background: red; }\n'],
        [block(RULES[3]), block(RULES[3]) + '\n' + SCOPE + ' .billing { color: red; }\n'],
        [block(RULES[3]), block(RULES[3]) + '\n' + SCOPE + ' .highlight { background: red; }\n'],
        [block(RULES[3]), block(RULES[3]) + '\n' + SCOPE + ' table { width: 100%; }\n'],
        [block(RULES[3]), block(RULES[3]) + '\n' + SCOPE + ' button { font-size: 1rem; }\n'],
        [block(RULES[3]), block(RULES[3]) + '\n' + SCOPE + ' .table-responsive { padding: 1rem; }\n'],
        [block(RULES[3]), block(RULES[3]) + '\n' + SCOPE + ' button { background: red; }\n'],
    ].map(([from, to]) => mutate(FUTURE_CSS, from, to));
    mutants.forEach(candidate => expect(() => verifyCss(candidate)).toThrow());
});

// Controller owns execution of these intended hosted RED assertions.
test('actual route has only the declared duplicate popup additions', () => {
    expect(() => verifyRoute(route())).not.toThrow();
});

test('actual helper has only the sorted stylesheet entry', () => {
    expect(() => verifyHelper(helper())).not.toThrow();
});

test('actual CSS has exactly four screen-only duplicate popup rules', () => {
    expect(() => verifyCss(css())).not.toThrow();
});

test('existing new patient caller keeps popup geometry and save callback', () => {
    const caller = read('interface/new/new_comprehensive.php');
    expect(caller).toContain("var url = 'new_search_popup.php';");
    expect(caller).toContain("url += 'mf_' + flds[i] + '=' + encodeURIComponent(fval);");
    expect(caller).toContain("dlgopen(url, '_blank', 875, 500);");
    expect(caller).toContain('function srcConfirmSave() {\n    document.forms[0].submit();\n}');
});

test('existing popup context supplies scoped tokens only in active workbench', () => {
    const popupJs = read('interface/clinical-workspace/popup.js');
    const popupCss = read('interface/clinical-workspace/popup.css');
    expect(popupJs).toContain("const CONTEXT_CLASS = 'oe-workbench-context';");
    expect(popupJs).toContain("active = !!attempt(() => host.body.classList.contains('workbench-active'));");
    expect(popupJs).toContain('set(CONTEXT_CLASS, active);');
    expect(popupCss).toContain('html.oe-workbench-context,');
    expect(popupCss).toContain('--oe-wb-ink: #17343b;');
    expect(popupCss).toContain('--oe-wb-paper: #fff;');
    expect(popupCss).toContain('--oe-wb-petrol: #086878;');
});
