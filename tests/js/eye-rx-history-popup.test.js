/** @jest-environment node */

const fs = require('fs');
const path = require('path');
const postcss = require('postcss');

const root = path.join(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const readOptional = file => fs.existsSync(path.join(root, file)) ? read(file) : '';
const route = () => read('interface/forms/eye_mag/SpectacleRx.php');
const helper = () => read('src/Common/Assets/ClinicalWorkspaceAssets.php');
const css = () => readOptional('interface/clinical-workspace/eye-rx-history-popup.css');

// All 1576 original route lines, including both branches, query and mutation paths.
const ORIGINAL = read('tests/clinical-ui/fixtures/eye-rx-history-popup-original.txt');
// The complete helper source before its one proposed allowlist addition.
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
const HISTORY_HEADER = "        <?php Header::setupHeader(['opener', 'pure', 'jscolor']); ?>\n";
const LINK = '        <link rel="stylesheet" media="screen" href="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>'
    + '/interface/clinical-workspace/eye-rx-history-popup.css?v='
    + '<?php echo attr_url((new ClinicalWorkspaceAssets())->version(\'eye-rx-history-popup.css\')); ?>">\n';
const HEADING = '        <div class="col-sm-8 offset-sm-2 text-center m-3">\n            <table>';
const MARKED_HEADING = '        <div class="col-sm-8 offset-sm-2 text-center m-3">\n            <table class="oe-eye-rx-history-heading">';
const ROUTE_EDITS = [
    [CSRF_IMPORT, IMPORT + CSRF_IMPORT],
    [HISTORY_HEADER, HISTORY_HEADER + LINK],
    [HEADING, MARKED_HEADING],
];
const ENTRY = "        'eye-rx-history-popup.css',\n";
const HELPER_EDITS = [["        'encounter-document.css',\n        'finder.css',\n",
    "        'encounter-document.css',\n" + ENTRY + "        'finder.css',\n"]];

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
const verifyRoute = candidate => verifyExact(candidate, ORIGINAL, ROUTE_EDITS, 'SpectacleRx.php');
const verifyHelper = candidate => verifyExact(candidate, HELPER_ORIGINAL, HELPER_EDITS, 'ClinicalWorkspaceAssets.php');

const SCOPE = 'html.oe-workbench-context table.oe-eye-rx-history-heading';
const INK = 'var(--oe-wb-ink, #17343b)';
const PAPER = 'var(--oe-wb-paper, #fff)';
const PETROL = 'var(--oe-wb-petrol, #086878)';
const decl = (prop, value) => ({ prop, value, important: false });
const RULES = [
    [[SCOPE], [decl('color', INK), decl('background', PAPER)]],
    [[SCOPE + ' h4.underline'], [decl('color', PETROL), decl('background', 'transparent')]],
];
const block = ([selectors, declarations]) => selectors.join(',\n') + ' {\n'
    + declarations.map(d => '    ' + d.prop + ': ' + d.value + ';\n').join('') + '}\n';
const FUTURE_CSS = '@media screen {\n' + RULES.map(block).join('\n') + '}\n';

// The whole AST is an allowlist: media, selectors, declaration order and importance.
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
            throw new Error('unexpected CSS selector at ' + index);
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

test('synthetic forward, full inverse and CSS AST accept only the planned additions', () => {
    expect(ORIGINAL.split('\n')).toHaveLength(1577);
    expect(ORIGINAL.endsWith('?>\n')).toBe(true);
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

test('synthetic route changes the first history Header and heading table only', () => {
    expect(FUTURE_ROUTE).toContain(HISTORY_HEADER + LINK);
    for (const addition of [IMPORT, LINK, MARKED_HEADING]) expect(count(FUTURE_ROUTE, addition)).toBe(1);
    expect(count(FUTURE_ROUTE, 'Header::setupHeader(')).toBe(2);
    expect(FUTURE_ROUTE).toContain("Header::setupHeader([ 'opener', 'jquery-ui', 'jquery-ui-redmond', 'pure', 'jscolor' ]);");
    expect(FUTURE_ROUTE).toContain('<td colspan="2"><h4 class="underline"><?php echo xlt(\'Rx History\'); ?></h4></td>');
    expect(FUTURE_ROUTE).toContain("xlt('There are no Glasses or Contact Lens Presciptions on file for this patient')");
    for (const anchor of [
        "AclMain::aclCheckCore('patients', 'med')",
        '$pid = PatientSessionUtil::getPid();',
        "CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: true);",
        "'SELECT pid FROM form_eye_mag_dispense WHERE id = ? AND pid = ?'",
        "'SELECT * FROM form_eye_mag_dispense WHERE pid = ? ORDER BY date DESC'",
        'sqlStatement($query, [$_REQUEST[\'delete_id\'], $pid]);',
        '$insert_this_id = formSubmit($table_name, $fields, $form_id, $session->get(\'userauthorized\'));',
        'function delete_me(delete_id) {',
        'function pick_rxType(rxtype, id) {',
        'function submit_form() {',
        'function reverse_cylinder() {',
        'win.printLogSetup(document.getElementById(\'printbutton\'));',
        '<?php echo report_header((string) $pid, "web"); ?>',
    ]) expect(FUTURE_ROUTE).toContain(anchor);
    const entries = [...FUTURE_HELPER.matchAll(/^ {8}'([^']+)',$/gm)].map(match => match[1]);
    expect(entries).toEqual([...entries].sort());
    expect(entries.filter(entry => entry === 'eye-rx-history-popup.css')).toHaveLength(1);
    expect(entries).toHaveLength(25);
});

test('exact source contracts reject missing additions, clinical mutations and arbitrary drift', () => {
    const routeMutants = [
        [IMPORT, ''],
        [LINK, ''],
        [MARKED_HEADING, HEADING],
        [LINK, LINK + LINK],
        ['media="screen"', 'media="all"'],
        ["attr(OEGlobalsBag::getInstance()->getWebRoot())", 'OEGlobalsBag::getInstance()->getWebRoot()'],
        ["attr_url((new ClinicalWorkspaceAssets())->version('eye-rx-history-popup.css'))", "attr((new ClinicalWorkspaceAssets())->version('eye-rx-history-popup.css'))"],
        ["AclMain::aclCheckCore('patients', 'med')", 'true'],
        ['$pid = PatientSessionUtil::getPid();', '$pid = (int) ($_REQUEST[\'pid\'] ?? 0);'],
        ["$form_id = $_REQUEST['form_id'] ?? null;", '$form_id = null;'],
        ["forms.deleted != '1'  and", "forms.deleted = '1'  and"],
        ['forms.pid=? ";', 'forms.pid=1 ";'],
        ["[$_REQUEST['encounter'] ?? '', $pid]", "[$_REQUEST['encounter'] ?? '', 1]"],
        ["if (($_REQUEST['mode'] ?? '') == \"update\")", 'if (false)'],
        ["if ($updateId <= 0) {", 'if (false) {'],
        ["'SELECT pid FROM form_eye_mag_dispense WHERE id = ? AND pid = ?'", "'SELECT pid FROM form_eye_mag_dispense WHERE id = ?'"],
        ["if ($ownerPid === null) {", 'if (false) {'],
        ["$insert_this_id = formUpdate($table_name, $fields, $updateId, $session->get('userauthorized'));", '$insert_this_id = null;'],
        ["elseif (($_REQUEST['mode'] ?? '') == \"remove\")", 'elseif (false)'],
        ["DELETE FROM form_eye_mag_dispense where id=? AND pid=?", 'DELETE FROM form_eye_mag_dispense where id=?'],
        ["sqlStatement($query, [$_REQUEST['delete_id'], $pid]);", "sqlStatement($query, [$_REQUEST['delete_id']]);"],
        ["UPDATE form_eye_mag_dispense set RXTYPE=? where id=? AND pid=?", 'UPDATE form_eye_mag_dispense set RXTYPE=? where id=?'],
        ["if ($refType !== null) {", 'if (true) {'],
        ["AND PID = ?", ''],
        ["$insert_this_id = formSubmit($table_name, $fields, $form_id, $session->get('userauthorized'));", '$insert_this_id = null;'],
        ["'SELECT * FROM form_eye_mag_dispense WHERE pid = ? ORDER BY date DESC'", "'SELECT * FROM form_eye_mag_dispense ORDER BY date DESC'"],
        ["if ($_REQUEST['dispensed'] ?? '') {", 'if (false) {'],
        ["Header::setupHeader([ 'opener', 'jquery-ui', 'jquery-ui-redmond', 'pure', 'jscolor' ]);", "Header::setupHeader(['opener']);"],
        ['<div class="row">\n        <div class="col-sm-8 offset-sm-2 text-center m-3">', '<div class="row"><section>\n        <div class="col-sm-8 offset-sm-2 text-center m-3">'],
        ["xlt('There are no Glasses or Contact Lens Presciptions on file for this patient')", "xlt('No Rx')"],
        ['function delete_me(delete_id) {', 'function delete_me() {'],
        ['win.printLogSetup(document.getElementById(\'printbutton\'));', 'win.printLogSetup(null);'],
        ['function reverse_cylinder() {', 'function reverse_cylinder(x) {'],
        ["<?php echo report_header((string) $pid, \"web\");  ?>", ''],
    ].map(([from, to]) => mutate(FUTURE_ROUTE, from, to));
    routeMutants.push(FUTURE_ROUTE + ' ', FUTURE_ROUTE.slice(0, -1), ' ' + FUTURE_ROUTE);
    const middleMutation = FUTURE_ROUTE.slice(0, Math.floor(FUTURE_ROUTE.length / 2))
        + 'x' + FUTURE_ROUTE.slice(Math.floor(FUTURE_ROUTE.length / 2));
    expect(middleMutation).not.toBe(FUTURE_ROUTE);
    routeMutants.push(middleMutation);
    routeMutants.forEach(candidate => {
        expect(candidate).not.toBe(FUTURE_ROUTE);
        expect(() => verifyRoute(candidate)).toThrow();
    });

    // All three POST branches must keep CSRF, so change one occurrence at a time.
    expect(count(FUTURE_ROUTE, 'CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: true);')).toBe(3);
    for (let index = 0; index < 3; index++) {
        let seen = 0;
        const candidate = FUTURE_ROUTE.replace(/CsrfUtils::checkCsrfInput\(INPUT_POST, dieOnFail: true\);/g, match => seen++ === index ? '' : match);
        expect(candidate).not.toBe(FUTURE_ROUTE);
        expect(() => verifyRoute(candidate)).toThrow();
    }

    const helperMutants = [
        [ENTRY, ''], [ENTRY, ENTRY + ENTRY],
        ["        'encounter-document.css',\n" + ENTRY, ENTRY + "        'encounter-document.css',\n"],
        ["throw new \\InvalidArgumentException('Unsupported clinical workspace asset');", "return '0';"],
    ].map(([from, to]) => mutate(FUTURE_HELPER, from, to));
    helperMutants.push(FUTURE_HELPER + ' ');
    helperMutants.forEach(candidate => {
        expect(candidate).not.toBe(FUTURE_HELPER);
        expect(() => verifyHelper(candidate)).toThrow();
    });
});

test('strict CSS AST rejects leaks, semantic paint, focus, print and layout changes', () => {
    const mutants = [
        [SCOPE + ' {', 'html.oe-workbench-popup table.oe-eye-rx-history-heading {'],
        [SCOPE + ' h4.underline', SCOPE + ' h4'],
        ['color: ' + INK + ';', 'color: red;'],
        ['background: ' + PAPER + ';', 'background: ' + PAPER + ' !important;'],
        ['color: ' + PETROL + ';', 'color: var(--danger);'],
        ['background: transparent;', 'background: red;'],
        ['@media screen {', '@media print {'],
        ['@media screen {', '@media screen and (min-width: 600px) {'],
        ['@media screen {', '@import "workspace.css";\n@media screen {'],
        [block(RULES[1]), block(RULES[1]) + '\n' + SCOPE + ' .refraction { color: red; }\n'],
        [block(RULES[1]), block(RULES[1]) + '\n' + SCOPE + ' input { background: red; }\n'],
        [block(RULES[1]), block(RULES[1]) + '\n' + SCOPE + ' .text-danger { color: red; }\n'],
        [block(RULES[1]), block(RULES[1]) + '\n' + SCOPE + ' .fa-times { color: red; }\n'],
        [block(RULES[1]), block(RULES[1]) + '\n' + SCOPE + ' table { width: 100%; }\n'],
        [block(RULES[1]), block(RULES[1]) + '\n' + SCOPE + ' h4 { font-size: 2rem; }\n'],
        [block(RULES[1]), block(RULES[1]) + '\n' + SCOPE + ' :focus { outline: none; }\n'],
        [block(RULES[1]), block(RULES[1]) + '\n' + SCOPE + ' tr { border: 1px solid red; }\n'],
        [block(RULES[1]), ''],
        [block(RULES[0]) + '\n' + block(RULES[1]), block(RULES[1]) + '\n' + block(RULES[0])],
    ].map(([from, to]) => mutate(FUTURE_CSS, from, to));
    mutants.forEach(candidate => {
        expect(candidate).not.toBe(FUTURE_CSS);
        expect(() => verifyCss(candidate)).toThrow();
    });
});

// Controller owns hosted RED execution before any production edit.
test('actual route has only the three declared history additions', () => {
    expect(() => verifyRoute(route())).not.toThrow();
});

test('actual helper has only the sorted stylesheet entry', () => {
    expect(() => verifyHelper(helper())).not.toThrow();
});

test('actual CSS has exactly two screen-only heading rules', () => {
    expect(() => verifyCss(css())).not.toThrow();
});

test('actual caller and workbench context retain the existing activation and popup sizes', () => {
    const caller = read('interface/forms/eye_mag/view.php');
    expect(caller).toContain("dlgopen('../../forms/eye_mag/SpectacleRx.php?' + params.toString(), '_blank', 660, 700,'', <?php echo xlj('Dispense Rx'); ?>);");
    expect(caller).toContain("dlgopen('../../forms/eye_mag/SpectacleRx.php?' + params.toString(), '_blank', 560, 590, '', <?php echo xlj('Rx History'); ?>);");
    expect(caller).toContain("dispensed: '1'");
    const popup = read('interface/clinical-workspace/popup.js');
    expect(popup).toContain("const CONTEXT_CLASS = 'oe-workbench-context';");
    expect(popup).toContain("const SHELL_ROOT = '#mainBox [data-workbench-mode]';");
    expect(popup).toContain("body.classList.contains('workbench-active')");
    const popupCss = read('interface/clinical-workspace/popup.css');
    expect(popupCss).toContain('--oe-wb-ink: #17343b;');
    expect(popupCss).toContain('--oe-wb-paper: #fff;');
    expect(popupCss).toContain('--oe-wb-petrol: #086878;');
});
