/** @jest-environment node */

const fs = require('fs');
const path = require('path');
const postcss = require('postcss');

const root = path.join(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const readOptional = file => fs.existsSync(path.join(root, file)) ? read(file) : '';
const ORIGINAL = read('tests/clinical-ui/fixtures/eob-invoice-popup-original.txt');
const HELPER_ORIGINAL = "<?php\n\n/**\n * Per-file cache versions for the clinical workspace screen assets.\n *\n * Views that link interface/clinical-workspace assets directly append\n * ?v=<version> so a browser refetches a file as soon as it changes. Keeping\n * the filesystem lookup here keeps the view's URL expression free of\n * filesystem roots, and confines which files may be stat()ed to a fixed list.\n *\n * @package   OpenEMR\n * @link      https://www.open-emr.org\n * @author    Craig Allen <craig@interconnected.au>\n * @copyright Copyright (c) 2026 Craig Allen\n * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3\n */\n\ndeclare(strict_types=1);\n\nnamespace OpenEMR\\Common\\Assets;\n\nfinal readonly class ClinicalWorkspaceAssets\n{\n    /**\n     * Supported asset basenames. The directory defaults to the clinical\n     * workspace; a legacy tooltip caller supplies library/js explicitly.\n     */\n    private const SUPPORTED = [\n        'ajtooltip.js',\n        'appointment.css',\n        'calendar-sidebar.js',\n        'calendar-workday.css',\n        'calendar-workday.js',\n        'encounter-document.css',\n        'finder.css',\n        'global-messages.css',\n        'history-document.css',\n        'history-editor.css',\n        'issue-popup.css',\n        'lbf-document.css',\n        'mode.js',\n        'patient-messages.css',\n        'patient-picker-popup.css',\n        'patient-results-popup.css',\n        'patient-search.css',\n        'soap-document.css',\n        'soap-document.js',\n        'soap-reference.css',\n        'soap-reference.js',\n        'visit-history.css',\n        'visit-history.js',\n        'workspace.css',\n    ];\n\n    private string $directory;\n\n    /**\n     * @param ?string $directory Directory holding the assets; defaults to the\n     *                           shipped interface/clinical-workspace.\n     */\n    public function __construct(?string $directory = null)\n    {\n        $this->directory = $directory ?? dirname(__DIR__, 3) . '/interface/clinical-workspace';\n    }\n\n    /**\n     * Modification time of a supported asset as a decimal string, or '0'\n     * when the file is absent.\n     *\n     * @throws \\InvalidArgumentException when $asset is not a supported name\n     */\n    public function version(string $asset): string\n    {\n        if (!in_array($asset, self::SUPPORTED, true)) {\n            throw new \\InvalidArgumentException('Unsupported clinical workspace asset');\n        }\n\n        $path = $this->directory . '/' . $asset;\n        clearstatcache(true, $path);\n        if (!is_file($path)) {\n            return '0';\n        }\n        $mtime = filemtime($path);\n\n        return $mtime === false ? '0' : sprintf('%d', $mtime);\n    }\n}\n";

const IMPORT = 'use OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;\n';
const IMPORT_ANCHOR = 'use OpenEMR\\Common\\Acl\\AclMain;\nuse OpenEMR\\Common\\Csrf\\CsrfUtils;\n';
const HEADER = "    <?php Header::setupHeader(['datetime-picker', 'opener', 'no_dialog']); ?>\n";
const LINK = '    <link rel="stylesheet" media="screen" href="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>'
    + '/interface/clinical-workspace/eob-invoice-popup.css?v='
    + '<?php echo attr_url((new ClinicalWorkspaceAssets())->version(\'eob-invoice-popup.css\')); ?>">\n';
const ACTIONS = "            <fieldset>\n                <legend><?php echo xlt('Invoice Actions'); ?></legend>";
const MARKED_ACTIONS = "            <fieldset class=\"oe-eob-invoice-actions\">\n                <legend><?php echo xlt('Invoice Actions'); ?></legend>";
const ROUTE_EDITS = [
    [IMPORT_ANCHOR, 'use OpenEMR\\Common\\Acl\\AclMain;\n' + IMPORT + 'use OpenEMR\\Common\\Csrf\\CsrfUtils;\n'],
    [HEADER, HEADER + LINK],
    [ACTIONS, MARKED_ACTIONS],
];
const ENTRY = "        'eob-invoice-popup.css',\n";
const HELPER_ANCHOR = "        'encounter-document.css',\n        'finder.css',\n";
const HELPER_EDITS = [[HELPER_ANCHOR, "        'encounter-document.css',\n" + ENTRY + "        'finder.css',\n"]];

const count = (value, part) => value.split(part).length - 1;
const apply = (value, edits) => edits.reduce((out, [before, after]) => {
    if (count(out, before) !== 1) throw new Error('missing or ambiguous anchor: ' + JSON.stringify(before));
    return out.replace(before, () => after);
}, value);
const inverse = edits => edits.map(([before, after]) => [after, before]);
const verifyExact = (candidate, original, edits, label) => {
    const expected = apply(original, edits);
    if (candidate !== expected) throw new Error(label + ' differs outside exact additions');
    if (apply(candidate, inverse(edits)) !== original) throw new Error(label + ' fails complete inverse');
};
const verifyRoute = value => verifyExact(value, ORIGINAL, ROUTE_EDITS, 'sl_eob_invoice.php');
const verifyHelper = value => verifyExact(value, HELPER_ORIGINAL, HELPER_EDITS, 'ClinicalWorkspaceAssets.php');

const SCOPE = 'html.oe-workbench-context .oe-eob-invoice-actions';
const INK = 'var(--oe-wb-ink, #17343b)';
const PAPER = 'var(--oe-wb-paper, #fff)';
const DECLARATIONS = [
    { prop: 'color', value: INK, important: true },
    { prop: 'background-color', value: PAPER, important: true },
];
const SELECTORS = [SCOPE, SCOPE + ' > legend', SCOPE + ' .card.bg-light'];
const cssRule = selector => '  ' + selector + ' {\n'
    + '    color: ' + INK + ' !important;\n'
    + '    background-color: ' + PAPER + ' !important;\n'
    + '  }\n';
const FUTURE_CSS = '@media screen {\n' + SELECTORS.map(cssRule).join('\n') + '}\n';

const verifyCss = value => {
    const ast = postcss.parse(value);
    if (ast.nodes.length !== 1) throw new Error('expected one screen media block');
    const media = ast.nodes[0];
    if (media.type !== 'atrule' || media.name !== 'media' || media.params !== 'screen') {
        throw new Error('unexpected stylesheet context');
    }
    if (!media.nodes || media.nodes.length !== SELECTORS.length) throw new Error('unexpected CSS rule count');
    media.nodes.forEach((rule, index) => {
        if (rule.type !== 'rule' || rule.selector !== SELECTORS[index]) {
            throw new Error('unexpected selector at ' + index);
        }
        const found = rule.nodes.map(node => {
            if (node.type !== 'decl') throw new Error('unexpected CSS child at ' + index);
            return { prop: node.prop, value: node.value, important: Boolean(node.important) };
        });
        if (JSON.stringify(found) !== JSON.stringify(DECLARATIONS)) {
            throw new Error('unexpected declaration at ' + index);
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

test('synthetic additions and inverse preserve every original route and helper byte', () => {
    expect(ORIGINAL.split('\n')).toHaveLength(834);
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

test('synthetic route targets only Invoice Actions and its insurance card', () => {
    expect(count(FUTURE_ROUTE, HEADER + LINK)).toBe(1);
    expect(count(FUTURE_ROUTE, MARKED_ACTIONS)).toBe(1);
    expect(count(FUTURE_ROUTE, '<fieldset>\n                <legend><?php echo xlt(\'Invoice Details\'); ?></legend>')).toBe(1);
    expect(count(FUTURE_ROUTE, '<div class="card bg-light col-lg-4">')).toBe(1);
    expect(FUTURE_ROUTE.indexOf(LINK)).toBeLessThan(FUTURE_ROUTE.indexOf('<title>'));
    expect(FUTURE_ROUTE.indexOf(MARKED_ACTIONS)).toBeLessThan(FUTURE_ROUTE.indexOf("<legend><?php echo xlt('Invoice Details'); ?></legend>"));
    const entries = [...FUTURE_HELPER.matchAll(/^ {8}'([^']+)',$/gm)].map(match => match[1]);
    expect(entries).toEqual([...entries].sort());
    expect(entries.filter(item => item === 'eob-invoice-popup.css')).toHaveLength(1);
    expect(entries).toHaveLength(25);
});

test('route and helper reject misplaced additions, weakened escaping, and changed original bytes', () => {
    const routeMutants = [
        [IMPORT, ''],
        [LINK, ''],
        [LINK, LINK + LINK],
        [MARKED_ACTIONS, ACTIONS],
        ['media="screen"', 'media="print"'],
        ['<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>', '<?php echo OEGlobalsBag::getInstance()->getWebRoot(); ?>'],
        ["attr_url((new ClinicalWorkspaceAssets())->version('eob-invoice-popup.css'))", "(new ClinicalWorkspaceAssets())->version('eob-invoice-popup.css')"],
        [MARKED_ACTIONS, '<div class="oe-eob-invoice-actions">\n' + MARKED_ACTIONS],
        ["<fieldset>\n                <legend><?php echo xlt('Invoice Details'); ?></legend>", "<fieldset class=\"oe-eob-invoice-actions\">\n                <legend><?php echo xlt('Invoice Details'); ?></legend>"],
        ["AclMain::aclCheckCore('acct', 'eob', '', 'write')", "AclMain::aclCheckCore('acct', 'eob')"],
        ['CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: true);', ''],
        ['$trans_id = (int) $_GET[\'id\'];', '$trans_id = 0;'],
        ['InvoiceSummary::arGetInvoiceSummary($patient_id, $encounter_id, true)', 'InvoiceSummary::arGetInvoiceSummary($patient_id, $encounter_id, false)'],
        ['function validate(f) {', 'function validateDisabled(f) {'],
        ["$form_pay_total = (!empty($_POST['form_pay_total'])) ? (0 + $_POST['form_pay_total']) : 0;", '$form_pay_total = 0;'],
        ["<?php echo xlt('Invoice Actions'); ?>", "<?php echo xlt('Payment Actions'); ?>"],
        ['<div class="card bg-light col-lg-4">', '<div class="card col-lg-4">'],
        ["<?php echo xlt('Insurance'); ?>", "<?php echo xlt('Payer'); ?>"],
        ['function doClose() {', 'function doNotClose() {'],
        ["        .table {\n", "        .table {\n            font-size: 2rem;\n"],
    ].map(([from, to]) => mutate(FUTURE_ROUTE, from, to));
    routeMutants.push(mutate(FUTURE_ROUTE, '</html>\n', '</html>\n '));
    routeMutants.forEach(candidate => expect(() => verifyRoute(candidate)).toThrow());

    const helperMutants = [
        [ENTRY, ''],
        [ENTRY, ENTRY + ENTRY],
        ["        'encounter-document.css',\n" + ENTRY, ENTRY + "        'encounter-document.css',\n"],
        ["throw new \\InvalidArgumentException('Unsupported clinical workspace asset');", "return '0';"],
    ].map(([from, to]) => mutate(FUTURE_HELPER, from, to));
    helperMutants.forEach(candidate => expect(() => verifyHelper(candidate)).toThrow());
});

test('strict CSS AST rejects other contexts, selectors, declarations, and importance', () => {
    const mutants = [
        [SCOPE + ' {', '.oe-eob-invoice-actions {'],
        [SCOPE + ' > legend {', SCOPE + ' legend {'],
        [SCOPE + ' .card.bg-light {', SCOPE + ' .card {'],
        [cssRule(SELECTORS[0]), cssRule(SELECTORS[0]).replace('color: ' + INK + ' !important;', 'color: red !important;')],
        [cssRule(SELECTORS[1]), cssRule(SELECTORS[1]).replace('background-color: ' + PAPER + ' !important;', 'background-color: ' + PAPER + ';')],
        [cssRule(SELECTORS[2]), cssRule(SELECTORS[2]).replace('background-color: ' + PAPER + ' !important;', 'background: ' + PAPER + ' !important;')],
        ['@media screen {', '@media print {'],
        ['@media screen {', '@media screen and (min-width: 600px) {'],
        ['@media screen {', '@import "workspace.css";\n@media screen {'],
        [cssRule(SELECTORS[2]), cssRule(SELECTORS[2]) + '\n' + cssRule(SCOPE + ' input')],
        [cssRule(SELECTORS[2]), cssRule(SELECTORS[2]) + '\n' + cssRule(SCOPE + ' .form-control')],
        [cssRule(SELECTORS[2]), cssRule(SELECTORS[2]) + '\n' + cssRule(SCOPE + ' body')],
        [cssRule(SELECTORS[2]), cssRule(SELECTORS[2]) + '\n  ' + SCOPE + ' { width: 500px; }\n'],
        [cssRule(SELECTORS[2]), ''],
        [cssRule(SELECTORS[0]), cssRule(SELECTORS[0]).replace('  }', '    border: 0;\n  }')],
        [cssRule(SELECTORS[1]), cssRule(SELECTORS[1]).replace('  }', '    font-size: 2rem;\n  }')],
    ].map(([from, to]) => mutate(FUTURE_CSS, from, to));
    mutants.forEach(candidate => expect(() => verifyCss(candidate)).toThrow());
});

// The controller owns hosted RED and any production authorization.
test('actual invoice route has exactly the approved additions', () => {
    expect(() => verifyRoute(read('interface/billing/sl_eob_invoice.php'))).not.toThrow();
});
test('actual asset helper has exactly one sorted supported stylesheet', () => {
    expect(() => verifyHelper(read('src/Common/Assets/ClinicalWorkspaceAssets.php'))).not.toThrow();
});
test('actual stylesheet has exactly three scoped screen rules', () => {
    expect(() => verifyCss(readOptional('interface/clinical-workspace/eob-invoice-popup.css'))).not.toThrow();
});
test('launcher, context, and theme retain the source contracts for this popup', () => {
    const launcher = read('interface/billing/sl_eob_search.php');
    const launch = launcher.slice(launcher.indexOf('        function reSubmit() {'), launcher.indexOf('        function checkAll(checked) {'));
    expect(launch).toBe(`        function reSubmit() {
            opener.$('#btn-inv-search').click();
        }
        function editInvoice(e, id) {
            e.preventDefault();
            const params = new URLSearchParams({
                id: id,
                isPosting: '1'
            });
            const url = './sl_eob_invoice.php?' + params;
            <?php if (isset($_FILES['form_erafile']['size']) && !$_FILES['form_erafile']['size']) { ?>
            dlgopen(url,'editInvoiceDlg','modal-full', false, false, '', {
                sizeHeight: 'full',
                onClosed: 'reSubmit'
            });
            <?php } else { // keep era page up so can check on other remits ?>
            dlgopen(url, 'editInvoiceDlg', 'modal-full', false, false, '', {
                sizeHeight: 'full',
                onClosed: ''
            });
            <?php } ?>
        }

`);
    const popup = read('interface/clinical-workspace/popup.js');
    expect(popup).toContain("const CONTEXT_CLASS = 'oe-workbench-context';");
    expect(popup).toContain("const SHELL_ROOT = '#mainBox [data-workbench-mode]';");
    expect(popup).toContain("body.classList.contains('workbench-active')");
    expect(popup).toContain('const html = doc.documentElement;');
    const popupCss = read('interface/clinical-workspace/popup.css');
    expect(popupCss).toContain('--oe-wb-ink: #17343b;');
    expect(popupCss).toContain('--oe-wb-paper: #fff;');
    const theme = read('interface/themes/theme-defaults.scss');
    expect(theme).toContain('legend {\n  background-color: $gray-300 !important;\n  color: $body-color !important;\n}');
    expect(theme).toContain('fieldset {\n  background-color: $light !important;\n  color: $body-color !important;\n}');
});
