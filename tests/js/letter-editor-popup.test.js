/** @jest-environment node */

const fs = require('fs');
const path = require('path');
const postcss = require('postcss');

const root = path.join(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const readOptional = file => (fs.existsSync(path.join(root, file)) ? read(file) : '');
const source = () => read('interface/patient_file/letter.php');
const helper = () => read('src/Common/Assets/ClinicalWorkspaceAssets.php');
const css = () => readOptional('interface/clinical-workspace/letter-editor-popup.css');

// Every byte of the original 754-line route, including the generated HTML/PDF branch.
const ORIGINAL = read('tests/clinical-ui/fixtures/letter-editor-popup-original.txt');
// Every byte of the original 87-line helper, before the one sorted entry.
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

const IMPORT = 'use OpenEMR\\BC\\ServiceContainer;\n';
const ASSET_IMPORT = 'use OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;\n';
const HEADER = "<?php Header::setupHeader(['datetime-picker', 'topdialog']); ?>\n";
const LINK = '<link rel="stylesheet" media="screen" href="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>'
    + '/interface/clinical-workspace/letter-editor-popup.css?v='
    + "<?php echo attr_url((new ClinicalWorkspaceAssets())->version('letter-editor-popup.css')); ?>\">\n";
const BODY = '<body class="body_top" onunload=\'imclosing()\'>';
const BODY_MARKED = '<body class="body_top oe-letter-editor-popup" onunload=\'imclosing()\'>';
const FORM = '<form method=\'post\' action=\'letter.php\' id="theform" name="theform" onsubmit="return top.restoreSession()">';
const FORM_MARKED = '<form method=\'post\' action=\'letter.php\' id="theform" class="oe-letter-editor-sheet" name="theform" onsubmit="return top.restoreSession()">';
const ROUTE_EDITS = [
    [IMPORT, IMPORT + ASSET_IMPORT],
    [HEADER, HEADER + LINK],
    [BODY, BODY_MARKED],
    [FORM, FORM_MARKED],
];
const ENTRY = "        'letter-editor-popup.css',\n";
const HELPER_EDITS = [["        'lbf-document.css',\n", "        'lbf-document.css',\n" + ENTRY]];

const count = (value, part) => value.split(part).length - 1;
const apply = (value, edits) => edits.reduce((out, [before, after]) => {
    if (count(out, before) !== 1) throw new Error('missing or ambiguous anchor: ' + JSON.stringify(before));
    return out.replace(before, () => after);
}, value);
const inverse = edits => edits.map(([before, after]) => [after, before]);
const verifyExact = (candidate, original, edits, label) => {
    const future = apply(original, edits);
    if (candidate !== future) throw new Error(label + ' differs outside the exact additions');
    if (apply(candidate, inverse(edits)) !== original) throw new Error(label + ' does not restore every original byte');
};
const verifyRoute = candidate => verifyExact(candidate, ORIGINAL, ROUTE_EDITS, 'letter.php');
const verifyHelper = candidate => verifyExact(candidate, HELPER_ORIGINAL, HELPER_EDITS, 'ClinicalWorkspaceAssets.php');

const BODY_SCOPE = 'html.oe-workbench-context body.oe-letter-editor-popup';
const FORM_SCOPE = BODY_SCOPE + ' #theform.oe-letter-editor-sheet';
const CONTROL = FORM_SCOPE + ' .form-control';
const BUTTON = FORM_SCOPE + ' button';
const INK = 'var(--oe-wb-ink, #17343b)';
const PAPER = 'var(--oe-wb-paper, #fff)';
const CANVAS = 'var(--oe-wb-canvas, #f3f7f5)';
const PETROL = 'var(--oe-wb-petrol, #086878)';
const decl = (prop, value, important = false) => ({ prop, value, important });
const OUTLINE = [decl('outline', '2px solid ' + PETROL), decl('outline-offset', '2px')];
const RULES = [
    [[BODY_SCOPE], [decl('color', INK), decl('background', CANVAS, true)]],
    [[FORM_SCOPE], [decl('color', INK), decl('background', PAPER)]],
    [[FORM_SCOPE + ' #letter_toolbar.text'], [decl('color', '#17343b')]],
    [[CONTROL + ':focus', BUTTON + ':focus'], OUTLINE],
    [[CONTROL + ':focus-visible', BUTTON + ':focus-visible'], OUTLINE],
];
const block = ([selectors, declarations]) => selectors.join(',\n') + ' {\n'
    + declarations.map(d => '    ' + d.prop + ': ' + d.value + (d.important ? ' !important' : '') + ';\n').join('')
    + '}\n';
const FUTURE_CSS = '@media screen {\n' + RULES.map(block).join('\n') + '}\n';

// PostCSS AST allowlist: one screen media, exactly five ordered rules, exact
// selectors, declaration values and importance. All other nodes are rejected.
const verifyCss = value => {
    const ast = postcss.parse(value);
    if (ast.nodes.length !== 1) throw new Error('expected one screen media rule');
    const media = ast.nodes[0];
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

test('frozen complete originals and forward/inverse contracts are coherent', () => {
    expect(ORIGINAL.split('\n')).toHaveLength(755);
    expect(ORIGINAL.endsWith('</html>\n')).toBe(true);
    expect(HELPER_ORIGINAL.split('\n')).toHaveLength(88);
    expect(ORIGINAL).toContain('} else { // $form_format = html');
    expect(ORIGINAL).toContain('        $pdf->ezStream();\n        exit;');
    expect(() => verifyRoute(FUTURE_ROUTE)).not.toThrow();
    expect(() => verifyHelper(FUTURE_HELPER)).not.toThrow();
    expect(() => verifyCss(FUTURE_CSS)).not.toThrow();
    expect(apply(FUTURE_ROUTE, inverse(ROUTE_EDITS))).toBe(ORIGINAL);
    expect(apply(FUTURE_HELPER, inverse(HELPER_EDITS))).toBe(HELPER_ORIGINAL);
    expect(() => verifyRoute(ORIGINAL)).toThrow();
    expect(() => verifyHelper(HELPER_ORIGINAL)).toThrow();
});

test('synthetic route changes only the entry editor, preserving generated output and native form', () => {
    expect(FUTURE_ROUTE).toContain(HEADER + LINK + '\n<script>');
    expect(count(FUTURE_ROUTE, LINK)).toBe(1);
    expect(count(FUTURE_ROUTE, ASSET_IMPORT)).toBe(1);
    expect(FUTURE_ROUTE).toContain(BODY_MARKED + '\n\n' + FORM_MARKED);
    expect(FUTURE_ROUTE).toContain('id="letter_toolbar" class=\'text\' style="width: 100%; background-color: #ddd; padding: 5px; margin: 0px;"');
    for (const original of [
        "CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: true);",
        "CsrfUtils::checkCsrfInput(INPUT_GET, dieOnFail: true);",
        "CsrfUtils::collectCsrfToken(session: $session)",
        "ServiceContainer::getCrypto()", "encryptForFilesystem", "decryptFromFilesystem",
        'sqlQuery("SELECT ', "sqlStatement(\"SELECT id, fname, lname, specialty FROM users \"",
        'foreach ($FIELD_TAG as $key => $value)', "xlt('Generate Letter regarding ')",
        "name='form_body' id=\"form_body\" class='form-control' rows='20' cols='30'",
        'window.print();', "$pdf->ezStream();", "$('#newtemplatedetail').css('display', 'block');",
        'onsubmit="return top.restoreSession()"', "onunload='imclosing()'",
    ]) expect(FUTURE_ROUTE).toContain(original);
    const entries = [...FUTURE_HELPER.matchAll(/^ {8}'([^']+)',$/gm)].map(match => match[1]);
    expect(entries).toEqual([...entries].sort());
    expect(entries.filter(entry => entry === 'letter-editor-popup.css')).toHaveLength(1);
    expect(entries).toHaveLength(25);
});

test('full route and helper reject behavior, security, output, markup and asset mutations', () => {
    const routeMutants = [
        ["CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: true);", ''],
        ["CsrfUtils::checkCsrfInput(INPUT_GET, dieOnFail: true);", ''],
        ["$pid = $session->get('pid', 0);", '$pid = 0;'],
        ["$cryptoGen = ServiceContainer::getCrypto();", '$cryptoGen = null;'],
        ["p.fname, p.mname, p.lname, p.pubpid, p.DOB, ", "p.fname, p.lname, p.pubpid, p.DOB, "],
        ['$fh = fopen("$template_dir/autosaved", \'w\');', '$fh = fopen("$template_dir/other", \'w\');'],
        ['if (!empty($_POST[\'formaction\']) && ($_POST[\'formaction\'] == "generate")) {', 'if (false) {'],
        ["$pdf->ezStream();", ''],
        ["$cpstring = text($cpstring); //escape to prevent stored cross script attack", '$cpstring = $cpstring;'],
        ['window.print();', ''],
        ["xlt('Generate Letter regarding ')", "xlt('Letter regarding ')"],
        ["rows='20' cols='30'", "rows='24' cols='30'"],
        ["$('#newtemplatedetail').css('display', 'block');", "$('#newtemplatedetail').css('display', 'none');"],
        [FORM_MARKED, '<div class="oe-extra">\n' + FORM_MARKED],
        [FORM_MARKED, FORM_MARKED.replace('class="oe-letter-editor-sheet"', 'class="oe-letter-editor-sheet form-control"')],
        [BODY_MARKED, BODY_MARKED.replace("onunload='imclosing()'", '')],
        ["onsubmit=\"return top.restoreSession()\"", 'onsubmit="return true"'],
        [LINK, LINK + LINK],
        ['media="screen"', 'media="all"'],
        ["attr_url((new ClinicalWorkspaceAssets())->version", "attr((new ClinicalWorkspaceAssets())->version"],
    ].map(([from, to]) => mutate(FUTURE_ROUTE, from, to));
    routeMutants.push(FUTURE_ROUTE + ' ', FUTURE_ROUTE.slice(0, -1));
    routeMutants.forEach(candidate => expect(() => verifyRoute(candidate)).toThrow());

    const helperMutants = [
        [ENTRY, ''], [ENTRY, ENTRY + ENTRY],
        ["        'lbf-document.css',\n" + ENTRY, ENTRY + "        'lbf-document.css',\n"],
        ["throw new \\InvalidArgumentException('Unsupported clinical workspace asset');", "return '0';"],
    ].map(([from, to]) => mutate(FUTURE_HELPER, from, to));
    helperMutants.push(FUTURE_HELPER + ' ');
    helperMutants.forEach(candidate => expect(() => verifyHelper(candidate)).toThrow());
});

test('strict CSS AST rejects scope, screen, palette, focus, paint and import mutations', () => {
    const mutants = [
        [BODY_SCOPE + ' {', 'body.oe-letter-editor-popup {'],
        [FORM_SCOPE + ' {', '#theform.oe-letter-editor-sheet {'],
        [FORM_SCOPE + ' #letter_toolbar.text {', '#letter_toolbar.text {'],
        ['color: #17343b;', 'color: ' + INK + ';'],
        [CONTROL + ':focus,\n' + BUTTON + ':focus', CONTROL + ':focus,\n' + BUTTON + ':focus-visible'],
        [RULES[3][0].join(',\n'), RULES[3][0].concat(RULES[4][0]).join(',\n')],
        ['background: ' + CANVAS + ' !important;', 'background: ' + CANVAS + ';'],
        ['background: ' + CANVAS + ' !important;', 'background: ' + CANVAS + ' !important;\n    padding: 1rem;'],
        [block(RULES[1]), block(RULES[1]).replace('color: ' + INK + ';', 'font-size: 1rem;')],
        [block(RULES[4]), block(RULES[4]).replace('outline-offset: 2px;', 'outline-offset: 2px !important;')],
        [block(RULES[4]), ''],
        ['@media screen {', '@media print {'],
        ['@media screen {', '@import "workspace.css";\n@media screen {'],
        ['@media screen {', '@media screen {\n@media screen {'],
        [block(RULES[4]), block(RULES[4]) + '\n' + FORM_SCOPE + ' button { background: red; }\n'],
        [block(RULES[4]), block(RULES[4]) + '\n' + FORM_SCOPE + ' input:disabled { color: red; }\n'],
    ].map(([from, to]) => mutate(FUTURE_CSS, from, to));
    mutants.forEach(candidate => expect(() => verifyCss(candidate)).toThrow());
});

// These are the deliberately RED assertions until the controller permits production edits.
test('actual route matches exactly the four declared editor-only additions', () => {
    expect(() => verifyRoute(source())).not.toThrow();
});

test('actual helper matches exactly the one sorted asset entry', () => {
    expect(() => verifyHelper(helper())).not.toThrow();
});

test('actual stylesheet matches the five screen-only rules', () => {
    expect(() => verifyCss(css())).not.toThrow();
});

test.each(['standard', 'front_office'])('%s menu source launches the existing Letter popup', menu => {
    const tree = JSON.parse(read('interface/main/tabs/menu/menus/' + menu + '.json'));
    const found = [];
    const visit = value => {
        if (!value || typeof value !== 'object') return;
        if (value.url === '/interface/patient_file/letter.php') found.push(value);
        Object.values(value).forEach(visit);
    };
    visit(tree);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
        label: 'Letter', menu_id: 'Popup:Letter', target: 'pop',
        acl_req: ['patients', 'med'],
    });
});

test('generic pop launcher source passes 500 and auto height without proving native fit', () => {
    const js = read('interface/main/tabs/js/tabs_view_model.js');
    expect(js).toContain("if (data.target === 'pop') {");
    expect(js).toContain('return popMenuDialog(webroot_url + data.url(), title);');
    expect(js).toContain("dlgopen(url, 'menupopup', 'modal-mlg', 500, '', title, {");
    expect(js).toContain("sizeHeight: notlike.search('label') !== -1 ? 'full' : 'auto'");
});
