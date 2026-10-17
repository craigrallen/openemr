const fs = require('fs');
const path = require('path');
const postcss = require('postcss');

const root = path.join(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
// The absent production sheet must fail its content contract, not file I/O.
const readOptional = file => (fs.existsSync(path.join(root, file)) ? read(file) : '');
const source = () => read('custom/export_xml.php');
const helper = () => read('src/Common/Assets/ClinicalWorkspaceAssets.php');
const css = () => readOptional('interface/clinical-workspace/patient-xml-export-popup.css');

// The complete 262-line route before presentation additions.
const ORIGINAL = read('tests/clinical-ui/fixtures/patient-xml-export-popup-original.txt');
// The complete asset helper before its one sorted entry; kept independent of production.
const HELPER_ORIGINAL = "<?php\n\n/**\n * Per-file cache versions for the clinical workspace screen assets.\n *\n * Views that link interface/clinical-workspace assets directly append\n * ?v=<version> so a browser refetches a file as soon as it changes. Keeping\n * the filesystem lookup here keeps the view's URL expression free of\n * filesystem roots, and confines which files may be stat()ed to a fixed list.\n *\n * @package   OpenEMR\n * @link      https://www.open-emr.org\n * @author    Craig Allen <craig@interconnected.au>\n * @copyright Copyright (c) 2026 Craig Allen\n * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3\n */\n\ndeclare(strict_types=1);\n\nnamespace OpenEMR\\Common\\Assets;\n\nfinal readonly class ClinicalWorkspaceAssets\n{\n    /**\n     * Supported asset basenames. The directory defaults to the clinical\n     * workspace; a legacy tooltip caller supplies library/js explicitly.\n     */\n    private const SUPPORTED = [\n        'ajtooltip.js',\n        'appointment.css',\n        'calendar-sidebar.js',\n        'calendar-workday.css',\n        'calendar-workday.js',\n        'encounter-document.css',\n        'finder.css',\n        'global-messages.css',\n        'history-document.css',\n        'history-editor.css',\n        'issue-popup.css',\n        'lbf-document.css',\n        'mode.js',\n        'patient-messages.css',\n        'patient-picker-popup.css',\n        'patient-results-popup.css',\n        'patient-search.css',\n        'soap-document.css',\n        'soap-document.js',\n        'soap-reference.css',\n        'soap-reference.js',\n        'visit-history.css',\n        'visit-history.js',\n        'workspace.css',\n    ];\n\n    private string $directory;\n\n    /**\n     * @param ?string $directory Directory holding the assets; defaults to the\n     *                           shipped interface/clinical-workspace.\n     */\n    public function __construct(?string $directory = null)\n    {\n        $this->directory = $directory ?? dirname(__DIR__, 3) . '/interface/clinical-workspace';\n    }\n\n    /**\n     * Modification time of a supported asset as a decimal string, or '0'\n     * when the file is absent.\n     *\n     * @throws \\InvalidArgumentException when $asset is not a supported name\n     */\n    public function version(string $asset): string\n    {\n        if (!in_array($asset, self::SUPPORTED, true)) {\n            throw new \\InvalidArgumentException('Unsupported clinical workspace asset');\n        }\n\n        $path = $this->directory . '/' . $asset;\n        clearstatcache(true, $path);\n        if (!is_file($path)) {\n            return '0';\n        }\n        $mtime = filemtime($path);\n\n        return $mtime === false ? '0' : sprintf('%d', $mtime);\n    }\n}\n";

const IMPORT = ' use OpenEMR\\Common\\Acl\\AclMain;\n';
const ASSET_IMPORT = ' use OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;\n';
const HEADER = '<?php Header::setupHeader(); ?>\n';
const LINK = '<link rel="stylesheet" media="screen" href="<?php echo attr(\\OpenEMR\\Core\\OEGlobalsBag::getInstance()->getWebRoot()); ?>'
    + '/interface/clinical-workspace/patient-xml-export-popup.css?v='
    + '<?php echo attr_url((new ClinicalWorkspaceAssets())->version(\'patient-xml-export-popup.css\')); ?>">\n';
const BODY = '<body class="body_top">';
const BODY_CLASSED = '<body class="body_top oe-patient-xml-export-screen">';
const DOCUMENT = '  <div class="container">';
const DOCUMENT_CLASSED = '  <div class="container oe-patient-xml-export-document">';
const ROUTE_EDITS = [
    [IMPORT, IMPORT + ASSET_IMPORT],
    [HEADER, HEADER + LINK],
    [BODY, BODY_CLASSED],
    [DOCUMENT, DOCUMENT_CLASSED],
];
const HELPER_ENTRY = "        'patient-xml-export-popup.css',\n";
const HELPER_EDITS = [
    ["        'patient-search.css',\n", "        'patient-search.css',\n" + HELPER_ENTRY],
];

const count = (text, part) => text.split(part).length - 1;
const apply = (text, edits) => edits.reduce((out, [before, after]) => {
    if (count(out, before) !== 1) throw new Error('missing or ambiguous edit anchor: ' + JSON.stringify(before));
    return out.replace(before, () => after);
}, text);
const invert = edits => edits.map(([before, after]) => [after, before]);
const verifyExact = (candidate, original, edits, label) => {
    if (candidate !== apply(original, edits)) throw new Error(label + ' differs from the complete permitted form');
    if (apply(candidate, invert(edits)) !== original) throw new Error(label + ' does not restore the complete original');
};
const verifyRoute = candidate => verifyExact(candidate, ORIGINAL, ROUTE_EDITS, 'export_xml.php');
const verifyHelper = candidate => verifyExact(candidate, HELPER_ORIGINAL, HELPER_EDITS, 'ClinicalWorkspaceAssets.php');

const BODY_SCOPE = 'html.oe-workbench-context body.oe-patient-xml-export-screen';
const DOCUMENT_SCOPE = 'html.oe-workbench-context .oe-patient-xml-export-document';
const FIELD = DOCUMENT_SCOPE + ' textarea.form-control[readonly]';
const PAPER = 'var(--oe-wb-paper, #fff)';
const INK = 'var(--oe-wb-ink, #172b32)';
const PETROL = 'var(--oe-wb-petrol, #1d5961)';
const PALETTE_SELECTORS = [FIELD, FIELD + ':focus'];
const FOCUS_SELECTORS = [FIELD + ':focus', DOCUMENT_SCOPE + ' button:focus'];
const VISIBLE_SELECTORS = [FIELD + ':focus-visible', DOCUMENT_SCOPE + ' button:focus-visible'];
const decl = (prop, value, important = false) => ({ prop, value, important });
const COLOR = decl('color', INK);
const FOCUS_DECLARATIONS = [
    decl('outline', '2px solid ' + PETROL),
    decl('outline-offset', '2px'),
];
const RULES = [
    [[BODY_SCOPE], [decl('background', 'var(--oe-wb-canvas, #edf2f3)', true), COLOR]],
    [[DOCUMENT_SCOPE], [decl('background', PAPER), COLOR]],
    [PALETTE_SELECTORS, [decl('background', PAPER), COLOR]],
    [FOCUS_SELECTORS, FOCUS_DECLARATIONS],
    [VISIBLE_SELECTORS, FOCUS_DECLARATIONS],
];

// Exactly five ordered rules, including each selector list, declaration and importance flag.
const verifyCss = text => {
    const rules = [];
    postcss.parse(text).each(node => {
        if (node.type === 'comment') return;
        if (node.type !== 'rule') throw new Error('unexpected stylesheet node: ' + node.type);
        rules.push(node);
    });
    if (rules.length !== RULES.length) throw new Error('expected five CSS rules; found ' + rules.length);
    rules.forEach((rule, index) => {
        const [selectors, declarations] = RULES[index];
        if (JSON.stringify(rule.selectors) !== JSON.stringify(selectors)) {
            throw new Error('unexpected selectors in rule ' + index + ': ' + rule.selector);
        }
        const found = rule.nodes.map(node => {
            if (node.type !== 'decl') throw new Error('unexpected child in rule ' + index + ': ' + node.type);
            return decl(node.prop, node.value, Boolean(node.important));
        });
        if (JSON.stringify(found) !== JSON.stringify(declarations)) {
            throw new Error('unexpected declarations in rule ' + index + ': ' + JSON.stringify(found));
        }
    });
};

const FUTURE_ROUTE = apply(ORIGINAL, ROUTE_EDITS);
const FUTURE_HELPER = apply(HELPER_ORIGINAL, HELPER_EDITS);
const block = ([selectors, declarations]) => selectors.join(',\n') + ' {\n'
    + declarations.map(d => '    ' + d.prop + ': ' + d.value + (d.important ? ' !important' : '') + ';\n').join('')
    + '}\n';
const FUTURE_CSS = RULES.map(block).join('\n');

// Construct every mutation before an expected throw. This verifies its anchor and changed bytes.
const mutate = (text, from, to) => {
    expect(count(text, from)).toBe(1);
    const changed = text.replace(from, () => to);
    expect(changed).not.toBe(text);
    return changed;
};
const flip = (text, index) => {
    const changed = text.slice(0, index) + (text[index] === 'X' ? 'Y' : 'X') + text.slice(index + 1);
    expect(changed).not.toBe(text);
    expect(changed).toHaveLength(text.length);
    return changed;
};
const byteMutants = text => [0, Math.floor(text.length / 3), Math.floor(text.length / 2), text.length - 1]
    .map(index => flip(text, index))
    .concat([text + ' ', text.slice(0, -1)]);

describe('frozen originals', () => {
    test('fixture is the entire original route, including its final newline', () => {
        const lines = ORIGINAL.split('\n');
        expect(lines).toHaveLength(263);
        expect(lines[261]).toBe('</html>');
        expect(lines[262]).toBe('');
        for (const [before] of ROUTE_EDITS) expect(count(ORIGINAL, before)).toBe(1);
        for (const [before] of HELPER_EDITS) expect(count(HELPER_ORIGINAL, before)).toBe(1);
    });

    test('current route and helper are either originals or precisely their planned forms', () => {
        expect([ORIGINAL, FUTURE_ROUTE]).toContain(source());
        expect([HELPER_ORIGINAL, FUTURE_HELPER]).toContain(helper());
    });

    test('the untouched originals are rejected as production forms', () => {
        expect(() => verifyRoute(ORIGINAL)).toThrow();
        expect(() => verifyHelper(HELPER_ORIGINAL)).toThrow();
    });
});

describe('production source contract', () => {
    test('the route contains only the sorted import, adjacent screen link and appended classes', () => {
        expect(() => verifyRoute(source())).not.toThrow();
    });

    test('the asset helper contains only the single sorted entry', () => {
        expect(() => verifyHelper(helper())).not.toThrow();
    });

    test('the popup sheet has exactly the five context-gated rules', () => {
        expect(() => verifyCss(css())).not.toThrow();
    });
});

describe('synthetic planned forms', () => {
    test('route, helper and CSS built from the permitted additions pass', () => {
        expect(() => verifyRoute(FUTURE_ROUTE)).not.toThrow();
        expect(() => verifyHelper(FUTURE_HELPER)).not.toThrow();
        expect(() => verifyCss(FUTURE_CSS)).not.toThrow();
    });

    test('inverse edits restore every byte of the route and helper', () => {
        expect(apply(FUTURE_ROUTE, invert(ROUTE_EDITS))).toBe(ORIGINAL);
        expect(apply(FUTURE_HELPER, invert(HELPER_EDITS))).toBe(HELPER_ORIGINAL);
        expect(FUTURE_ROUTE.split('\n')).toHaveLength(ORIGINAL.split('\n').length + 2);
    });

    test('the stylesheet link is adjacent, escaped, versioned and screen only', () => {
        expect(count(FUTURE_ROUTE, LINK)).toBe(1);
        expect(FUTURE_ROUTE).toContain(HEADER + LINK + '<title>');
        expect(FUTURE_ROUTE).toContain(BODY_CLASSED + '\n' + DOCUMENT_CLASSED);
        expect(count(FUTURE_ROUTE, ASSET_IMPORT)).toBe(1);
        expect(FUTURE_ROUTE).toContain('<textarea name="export_data" class="form-control" rows="18" readonly>');
    });

    test('the helper list stays sorted and contains the new name once', () => {
        const entries = [...FUTURE_HELPER.matchAll(/^ {8}'([^']+)',$/gm)].map(match => match[1]);
        expect(entries).toEqual([...entries].sort());
        expect(entries.filter(entry => entry === 'patient-xml-export-popup.css')).toHaveLength(1);
        expect(entries[entries.indexOf('patient-xml-export-popup.css') - 1]).toBe('patient-search.css');
        expect(entries[entries.indexOf('patient-xml-export-popup.css') + 1]).toBe('soap-document.css');
        expect(entries).toHaveLength(25);
    });
});

describe('negative route and helper controls', () => {
    test('arbitrary byte, length and final-newline changes to the full route are rejected', () => {
        for (const mutant of byteMutants(FUTURE_ROUTE)) expect(() => verifyRoute(mutant)).toThrow();
    });

    test('ACL, queries, escaping, field mappings, session PID and popup controls cannot change', () => {
        const mutants = [
            ["AclMain::aclCheckCore('patients', 'demo')", "AclMain::aclCheckCore('patients', 'med')"],
            ['AccessDeniedHelper::denyWithTemplate(', 'AccessDeniedHelper::deny('],
            ['ORDER BY date DESC LIMIT 1', 'ORDER BY date ASC LIMIT 1'],
            ['"WHERE p.pid = ? LIMIT 1"', '"WHERE p.pid = ? ORDER BY p.pid LIMIT 1"'],
            ["($insrow[2]['id'] ?? null), $pid", "($insrow[2]['id'] ?? null), $_GET['pid']"],
            ['xmlEscape($text)', '$text'],
            ['text($out)', '$out'],
            ['custom_xml_Add("pid", $pid);', 'custom_xml_Add("pid", $_GET["pid"]);'],
            ['custom_xml_Add("pubpid", $row[\'pubpid\']);', 'custom_xml_Add("pubpid", $row[\'pid\']);'],
            ['custom_xml_Add("zip", $row[\'postal_code\']);', 'custom_xml_Add("zip", $row[\'zip\']);'],
            ['custom_xml_Add("policy", $row["policy$seq"]);', 'custom_xml_Add("policy", $row["group$seq"]);'],
            ["$rowed = getEmployerData($pid);", "$rowed = getEmployerData($_GET['pid']);"],
            ["addInsurance($row, '2');", ''],
            ['CloseTag("patient");', 'CloseTag("person");'],
            ['rows="18"', 'rows="12"'],
            ['readonly><?php echo', '><?php echo'],
            ['xlt("Close")', 'xlt("Done")'],
            ['onclick="dlgclose()"', 'onclick="window.close()"'],
            ['class="btn btn-secondary btn-cancel"', 'class="btn btn-primary btn-cancel"'],
        ].map(([from, to]) => mutate(FUTURE_ROUTE, from, to));
        for (const mutant of mutants) expect(() => verifyRoute(mutant)).toThrow();
    });

    test('link placement, escaping, version, media and class changes are rejected', () => {
        const mutants = [
            [ASSET_IMPORT, ''],
            [ASSET_IMPORT, ASSET_IMPORT + ASSET_IMPORT],
            ['attr(\\OpenEMR\\Core\\OEGlobalsBag::getInstance()->getWebRoot())', '\\OpenEMR\\Core\\OEGlobalsBag::getInstance()->getWebRoot()'],
            ["attr_url((new ClinicalWorkspaceAssets())->version('patient-xml-export-popup.css'))", "attr((new ClinicalWorkspaceAssets())->version('patient-xml-export-popup.css'))"],
            ["->version('patient-xml-export-popup.css')", "->version('patient-search.css')"],
            ['/interface/clinical-workspace/patient-xml-export-popup.css?v=', '/interface/clinical-workspace/patient-xml-export-popup.css'],
            ['media="screen"', 'media="all"'],
            [LINK, ''],
            [LINK, LINK + LINK],
            [BODY_CLASSED, BODY],
            [DOCUMENT_CLASSED, DOCUMENT],
            [BODY_CLASSED, '<body class="oe-patient-xml-export-screen">'],
            [DOCUMENT_CLASSED, '  <div class="oe-patient-xml-export-document">'],
            [DOCUMENT_CLASSED, '  <div class="oe-patient-xml-export-wrap">\n' + DOCUMENT_CLASSED],
            [HEADER + LINK, LINK + HEADER],
        ].map(([from, to]) => mutate(FUTURE_ROUTE, from, to));
        for (const mutant of mutants) expect(() => verifyRoute(mutant)).toThrow();
    });

    test('unexpected helper entries, sorting and version behaviour changes are rejected', () => {
        const mutants = byteMutants(FUTURE_HELPER).concat([
            [HELPER_ENTRY, ''],
            [HELPER_ENTRY, HELPER_ENTRY + HELPER_ENTRY],
            ["        'patient-search.css',\n" + HELPER_ENTRY, HELPER_ENTRY + "        'patient-search.css',\n"],
            ["        'soap-document.css',\n", "        'soap-document.css',\n        'zz-extra.css',\n"],
            ["throw new \\InvalidArgumentException('Unsupported clinical workspace asset');", "return '0';"],
            ["'/interface/clinical-workspace';", "'/interface/other';"],
        ].map(([from, to]) => mutate(FUTURE_HELPER, from, to)));
        for (const mutant of mutants) expect(() => verifyHelper(mutant)).toThrow();
    });
});

describe('negative CSS AST controls', () => {
    test('scope leaks, unsafe palette selectors, missing focused color, extra paint, at-rules and importance changes are rejected', () => {
        const bodyBlock = block(RULES[0]);
        const paletteBlock = block(RULES[2]);
        const focusBlock = block(RULES[3]);
        const visibleBlock = block(RULES[4]);
        const mutants = [
            [BODY_SCOPE + ' {', 'body.oe-patient-xml-export-screen {'],
            [DOCUMENT_SCOPE + ' {', '.oe-patient-xml-export-document {'],
            [PALETTE_SELECTORS.join(',\n') + ' {', 'textarea.form-control[readonly] {'],
            [FOCUS_SELECTORS.join(',\n') + ' {', FIELD + ':focus,\nbutton:focus {'],
            [VISIBLE_SELECTORS.join(',\n') + ' {', FIELD + ':focus-visible,\nbutton:focus-visible {'],
            [PALETTE_SELECTORS.join(',\n'), [FIELD, FIELD + ':focus-visible'].join(',\n')],
            [PALETTE_SELECTORS.join(',\n'), [FIELD].join(',\n')],
            [PALETTE_SELECTORS.join(',\n'), [FIELD, FIELD + ':focus', FIELD + ':focus-visible'].join(',\n')],
            ['background: var(--oe-wb-canvas, #edf2f3) !important;', 'background: var(--oe-wb-canvas, #edf2f3);'],
            ['background: var(--oe-wb-canvas, #edf2f3) !important;', 'background: var(--oe-wb-canvas, #edf2f3) !important;\n    padding: 1rem;'],
            [paletteBlock, paletteBlock.replace('    color: ' + INK + ';', '    color: ' + INK + ' !important;')],
            [paletteBlock, paletteBlock.replace('    color: ' + INK + ';', '    font-size: 1rem;')],
            [focusBlock, focusBlock.replace('    outline-offset: 2px;', '    outline-offset: 2px !important;')],
            [visibleBlock, ''],
            [bodyBlock, '@media screen {\n' + bodyBlock + '}\n'],
            [bodyBlock, '@import "workspace.css";\n' + bodyBlock],
            [visibleBlock, visibleBlock + '\n' + DOCUMENT_SCOPE + ' button {\n    background: red;\n}\n'],
        ].map(([from, to]) => mutate(FUTURE_CSS, from, to));
        const combined = mutate(
            FUTURE_CSS,
            focusBlock + '\n' + visibleBlock,
            block([[...FOCUS_SELECTORS, ...VISIBLE_SELECTORS], FOCUS_DECLARATIONS]),
        );
        const combinedRules = postcss.parse(combined).nodes;
        expect(combinedRules).toHaveLength(4);
        expect(combinedRules[3].selectors).toHaveLength(4);
        for (const mutant of mutants.concat([combined])) expect(() => verifyCss(mutant)).toThrow();
    });
});

// Read-only caller evidence. This source contract does not execute PHP or certify the UI.
describe('launcher source evidence', () => {
    test.each(['standard', 'front_office'])('%s menu exports this route through the popup target', menu => {
        const tree = JSON.parse(read('interface/main/tabs/menu/menus/' + menu + '.json'));
        const found = [];
        const visit = value => {
            if (!value || typeof value !== 'object') return;
            if (value.url === '/custom/export_xml.php') found.push(value);
            Object.values(value).forEach(visit);
        };
        visit(tree);
        expect(found).toHaveLength(1);
        expect(found[0]).toMatchObject({
            label: 'Export',
            menu_id: 'Popup:Export',
            url: '/custom/export_xml.php',
            target: 'pop',
            acl_req: ['patients', 'demo'],
            global_req: '!ippf_specific',
        });
    });

    test('pop target reaches the 500px modal with auto height', () => {
        const js = read('interface/main/tabs/js/tabs_view_model.js');
        expect(js).toContain("if (data.target === 'pop') {");
        expect(js).toContain('return popMenuDialog(webroot_url + data.url(), title);');
        expect(js).toContain("dlgopen(url, 'menupopup', 'modal-mlg', 500, '', title, {");
        expect(js).toContain("sizeHeight: notlike.search('label') !== -1 ? 'full' : 'auto'");
    });
});
