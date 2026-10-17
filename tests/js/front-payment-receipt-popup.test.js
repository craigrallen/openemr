/** @jest-environment node */

const fs = require('fs');
const path = require('path');
const postcss = require('postcss');

const root = path.join(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const readOptional = file => fs.existsSync(path.join(root, file)) ? read(file) : '';
const route = () => read('interface/patient_file/front_payment.php');
const helper = () => read('src/Common/Assets/ClinicalWorkspaceAssets.php');
const css = () => readOptional('interface/clinical-workspace/front-payment-receipt-popup.css');

// Complete 1887-line payment route before the three proposed receipt-only edits.
const ORIGINAL = read('tests/clinical-ui/fixtures/front-payment-receipt-popup-original.txt');
// Complete 87-line helper before its one supported-basename addition.
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
const IMPORT_ANCHOR = 'use OpenEMR\\Common\\Acl\\AclMain;\nuse OpenEMR\\Common\\Crypto\\CryptoGen;\n';
const HEADER = '    <?php Header::setupHeader(); ?>\n';
const LINK = '    <link rel="stylesheet" media="screen" href="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>'
    + '/interface/clinical-workspace/front-payment-receipt-popup.css?v='
    + '<?php echo attr_url((new ClinicalWorkspaceAssets())->version(\'front-payment-receipt-popup.css\')); ?>">\n';
const CONTAINER = '    <div class="container mt-3">\n        <div class="row">\n';
const MARKED_CONTAINER = '    <div class="container mt-3 oe-front-payment-receipt">\n        <div class="row">\n';
const ROUTE_EDITS = [
    [IMPORT_ANCHOR, 'use OpenEMR\\Common\\Acl\\AclMain;\n' + IMPORT + 'use OpenEMR\\Common\\Crypto\\CryptoGen;\n'],
    [HEADER, HEADER + LINK],
    [CONTAINER, MARKED_CONTAINER],
];
const ENTRY = "        'front-payment-receipt-popup.css',\n";
const HELPER_ANCHOR = "        'finder.css',\n        'global-messages.css',\n";
const HELPER_EDITS = [[HELPER_ANCHOR, "        'finder.css',\n" + ENTRY + "        'global-messages.css',\n"]];

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
const verifyRoute = value => verifyExact(value, ORIGINAL, ROUTE_EDITS, 'front_payment.php');
const verifyHelper = value => verifyExact(value, HELPER_ORIGINAL, HELPER_EDITS, 'ClinicalWorkspaceAssets.php');

const SCOPE = 'html.oe-workbench-context .oe-front-payment-receipt';
const INK = 'var(--oe-wb-ink, #17343b)';
const PAPER = 'var(--oe-wb-paper, #fff)';
const PETROL = 'var(--oe-wb-petrol, #086878)';
const decl = (prop, value) => ({ prop, value, important: false });
const FOCUS = [decl('outline', '2px solid ' + PETROL), decl('outline-offset', '2px')];
const focusSelector = pseudo => SCOPE + ' button:' + pseudo + ',\n  ' + SCOPE + " input[type='button']:" + pseudo;
const RULES = [
    [SCOPE + ' .section-2', [decl('color', INK), decl('background', PAPER)]],
    [focusSelector('focus'), FOCUS],
    [focusSelector('focus-visible'), FOCUS],
];
const block = ([selector, declarations]) => selector + ' {\n'
    + declarations.map(item => '    ' + item.prop + ': ' + item.value + ';\n').join('') + '}\n';
const FUTURE_CSS = '@media screen {\n' + RULES.map(block).join('\n') + '}\n';

// All nodes and declarations are accounted for; focus lists use one pseudo each.
const verifyCss = value => {
    const ast = postcss.parse(value);
    if (ast.nodes.length !== 1) throw new Error('expected one screen media block');
    const media = ast.nodes[0];
    if (media.type !== 'atrule' || media.name !== 'media' || media.params !== 'screen') {
        throw new Error('unexpected stylesheet context');
    }
    if (!media.nodes || media.nodes.length !== RULES.length) throw new Error('unexpected CSS rule count');
    media.nodes.forEach((rule, index) => {
        const [selector, declarations] = RULES[index];
        if (rule.type !== 'rule' || rule.selector !== selector) throw new Error('unexpected selector at ' + index);
        const found = rule.nodes.map(node => {
            if (node.type !== 'decl') throw new Error('unexpected CSS child at ' + index);
            return { prop: node.prop, value: node.value, important: Boolean(node.important) };
        });
        if (JSON.stringify(found) !== JSON.stringify(declarations)) {
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

test('synthetic forward and inverse retain all original route and helper bytes', () => {
    expect(ORIGINAL.split('\n')).toHaveLength(1888);
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

test('synthetic route confines link and marker to receipt branch and keeps controls', () => {
    expect(count(FUTURE_ROUTE, HEADER + LINK)).toBe(1);
    expect(count(FUTURE_ROUTE, MARKED_CONTAINER)).toBe(1);
    expect(count(FUTURE_ROUTE, '<?php Header::setupHeader([\'opener\']);?>')).toBe(1);
    expect(FUTURE_ROUTE.indexOf(LINK)).toBeGreaterThan(FUTURE_ROUTE.indexOf("if ($alertmsg === '' && (!empty($_POST['form_save']) || !empty($_REQUEST['receipt'])))"));
    expect(FUTURE_ROUTE.indexOf(LINK)).toBeLessThan(FUTURE_ROUTE.indexOf('<script>\n\n    <?php require($srcdir . "/restoreSession.php"); ?>'));
    expect(FUTURE_ROUTE.indexOf(MARKED_CONTAINER)).toBeLessThan(FUTURE_ROUTE.indexOf('} else {\n    //\n    // Here we display the form for data entry.'));
    expect(FUTURE_ROUTE).toContain('<div class="container mt-3"><!--begin container div for form-->');
    for (const anchor of [
        "AclMain::aclCheckCore('acct', 'bill', '', 'write')", "AclMain::aclCheckCore('acct', 'rep_a')",
        "AclMain::aclCheckCore('patients', 'rx')", 'CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: true);',
        '$invoice_refno = BillingUtilities::updateInvoiceRefNumber();', "$form_pid = $_GET['patient'];",
        '$pid = $session->get(\'pid\', 0);', '$pid = (is_numeric($hiddenPatientCode)',
        'frontPayment($form_pid', '$recorder->recordActivity([', 'function deleteme() {',
        "dlgopen('deleter.php?' + params.toString()", 'function printlog_before_print() {',
        "win.printLogSetup(document.getElementById('printbutton'));", "<?php require($srcdir . \"/restoreSession.php\"); ?>",
        'function toencounter(enc, datestr, topframe) {', '<button type="button" class="btn btn-primary btn-print"',
        "<input type='button' class='btn btn-primary'", 'class="btn btn-danger btn-delete"',
        'class="btn btn-secondary btn-cancel"', 'function validate(notSubmit = false) {',
        "fetch('./front_payment_cc.php'", "new SpherePayment('clinic', $sanitizedPid)",
        "'endpoint' => 'front_payment.rainforest.php'", 'new PostFrontPayment()',
    ]) expect(FUTURE_ROUTE).toContain(anchor);
    const entries = [...FUTURE_HELPER.matchAll(/^ {8}'([^']+)',$/gm)].map(match => match[1]);
    expect(entries).toEqual([...entries].sort());
    expect(entries.filter(item => item === 'front-payment-receipt-popup.css')).toHaveLength(1);
    expect(entries).toHaveLength(25);
});

test('route and helper reject misplaced additions, weakened escaping, wrappers and changed original bytes', () => {
    const routeMutants = [
        [LINK, ''], [LINK, LINK + LINK], [MARKED_CONTAINER, CONTAINER],
        [MARKED_CONTAINER, MARKED_CONTAINER + MARKED_CONTAINER],
        ['media="screen"', 'media="print"'],
        ['<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>', '<?php echo OEGlobalsBag::getInstance()->getWebRoot(); ?>'],
        ["attr_url((new ClinicalWorkspaceAssets())->version('front-payment-receipt-popup.css'))", "(new ClinicalWorkspaceAssets())->version('front-payment-receipt-popup.css')"],
        [HEADER + LINK, HEADER],
        ['<div class="container mt-3"><!--begin container div for form-->', '<div class="container mt-3 oe-front-payment-receipt"><!--begin container div for form-->'],
        [MARKED_CONTAINER, '<div class="oe-front-payment-receipt">\n' + MARKED_CONTAINER],
        ["AclMain::aclCheckCore('acct', 'bill', '', 'write')", "AclMain::aclCheckCore('acct', 'bill')"],
        ['CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: true);', ''],
        ['$invoice_refno = BillingUtilities::updateInvoiceRefNumber();', '$invoice_refno = 0;'],
        ["$form_pid = $_GET['patient'];", '$form_pid = $pid;'],
        ["dlgopen('deleter.php?' + params.toString()", "dlgopen('deleter.php?'"],
        ['function printlog_before_print() {', 'function printlog_before_print_disabled() {'],
        ['class="btn btn-danger btn-delete"', 'class="btn btn-primary btn-delete"'],
        ['Accept.dispatchData(secureData, acceptResponseHandler);', 'return false;'],
    ].map(([from, to]) => mutate(FUTURE_ROUTE, from, to));
    routeMutants.push(FUTURE_ROUTE + ' ', FUTURE_ROUTE.slice(0, -1), ' ' + FUTURE_ROUTE);
    const wrongBranch = mutate(FUTURE_ROUTE, HEADER + LINK, HEADER);
    routeMutants.push(mutate(wrongBranch, '<?php Header::setupHeader([\'opener\']);?>\n', '<?php Header::setupHeader([\'opener\']);?>\n' + LINK));
    routeMutants.forEach(candidate => {
        expect(candidate).not.toBe(FUTURE_ROUTE);
        expect(() => verifyRoute(candidate)).toThrow();
    });
    const helperMutants = [
        [ENTRY, ''], [ENTRY, ENTRY + ENTRY],
        ["        'finder.css',\n" + ENTRY, ENTRY + "        'finder.css',\n"],
        ["throw new \\InvalidArgumentException('Unsupported clinical workspace asset');", "return '0';"],
    ].map(([from, to]) => mutate(FUTURE_HELPER, from, to));
    helperMutants.push(FUTURE_HELPER + ' ');
    helperMutants.forEach(candidate => {
        expect(candidate).not.toBe(FUTURE_HELPER);
        expect(() => verifyHelper(candidate)).toThrow();
    });
});

test('strict CSS AST rejects global, print, paint, geometry, importance and mixed focus', () => {
    const mutants = [
        [SCOPE + ' .section-2 {', '.section-2 {'],
        [SCOPE + ' .section-2 {', 'html.oe-workbench-popup .section-2 {'],
        [focusSelector('focus') + ' {', SCOPE + ' :focus {'],
        [focusSelector('focus-visible') + ' {', focusSelector('focus') + ',\n' + SCOPE + ' button:focus-visible {'],
        ['color: ' + INK + ';', 'color: red;'],
        ['background: ' + PAPER + ';', 'background: ' + PAPER + ' !important;'],
        ['background: ' + PAPER + ';', 'background: var(--oe-wb-ink, #17343b);'],
        [block(RULES[1]), block(RULES[1]).replace('outline: 2px solid ' + PETROL + ';', 'outline: none;')],
        [block(RULES[2]), block(RULES[2]).replace('outline-offset: 2px;', 'outline-offset: 0;')],
        ['@media screen {', '@media print {'],
        ['@media screen {', '@media screen and (min-width: 600px) {'],
        ['@media screen {', '@import "workspace.css";\n@media screen {'],
        [block(RULES[2]), block(RULES[2]) + '\n' + SCOPE + ' body { color: red; }\n'],
        [block(RULES[2]), block(RULES[2]) + '\n' + SCOPE + ' table { background: red; }\n'],
        [block(RULES[2]), block(RULES[2]) + '\n' + SCOPE + ' input { background: red; }\n'],
        [block(RULES[2]), block(RULES[2]) + '\n' + SCOPE + ' .bg-color { color: red; }\n'],
        [block(RULES[2]), block(RULES[2]) + '\n' + SCOPE + ' { width: 550px; }\n'],
        [block(RULES[2]), block(RULES[2]) + '\n' + SCOPE + ' { padding: 1rem; }\n'],
        [block(RULES[2]), block(RULES[2]) + '\n' + SCOPE + ' { font-size: 2rem; }\n'],
        [block(RULES[2]), ''],
        [block(RULES[1]) + '\n' + block(RULES[2]), SCOPE + ' button:focus, ' + SCOPE + ' button:focus-visible {\n    outline: 2px solid ' + PETROL + ';\n    outline-offset: 2px;\n}\n'],
    ].map(([from, to]) => mutate(FUTURE_CSS, from, to));
    mutants.forEach(candidate => {
        expect(candidate).not.toBe(FUTURE_CSS);
        expect(() => verifyCss(candidate)).toThrow();
    });
});

// Hermes owns hosted genuine RED before any production edit.
test('actual route has only the declared receipt additions', () => {
    expect(() => verifyRoute(route())).not.toThrow();
});
test('actual helper has exactly one sorted supported stylesheet', () => {
    expect(() => verifyHelper(helper())).not.toThrow();
});
test('actual stylesheet has exactly three scoped screen rules', () => {
    expect(() => verifyCss(css())).not.toThrow();
});
test('caller and shared context retain their source contracts', () => {
    const caller = read('interface/reports/front_receipts_report.php');
    for (const anchor of [
        "AclMain::aclCheckCore('acct', 'rep_a')", 'CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: true);',
        "patient: pid,", "receipt: '1',", 'time: timestamp',
        "dlgopen('../patient_file/front_payment.php?' + params, '_blank', 850, 550",
        "<?php require(OEGlobalsBag::getInstance()->getSrcDir() . \"/restoreSession.php\"); ?>",
        "preg_replace('/[^0-9]/', '', (string) $row['dtime'])", 'attr_js($row[\'pid\'])',
        'attr_js($timestamp)',
    ]) expect(caller).toContain(anchor);
    const popup = read('interface/clinical-workspace/popup.js');
    expect(popup).toContain("const CONTEXT_CLASS = 'oe-workbench-context';");
    expect(popup).toContain("const SHELL_ROOT = '#mainBox [data-workbench-mode]';");
    expect(popup).toContain("body.classList.contains('workbench-active')");
    const popupCss = read('interface/clinical-workspace/popup.css');
    for (const token of ['--oe-wb-ink: #17343b;', '--oe-wb-paper: #fff;', '--oe-wb-petrol: #086878;']) {
        expect(popupCss).toContain(token);
    }
    const config = read('config/config.yaml');
    expect(config).toContain('  workbench-popup:\n');
    expect(config).toContain('    script: popup.js\n    link: popup.css\n    autoload: true');
});
