/** @jest-environment node */

const fs = require('fs');
const path = require('path');
const postcss = require('postcss');

const root = path.join(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const readOptional = file => fs.existsSync(path.join(root, file)) ? read(file) : '';
const route = () => read('interface/reports/appointments_report.php');
const helper = () => read('src/Common/Assets/ClinicalWorkspaceAssets.php');
const css = () => readOptional('interface/clinical-workspace/appointments-report-popup.css');

// All 689 original route lines, including both HTML and CSV branches.
const ORIGINAL = read('tests/clinical-ui/fixtures/appointments-report-popup-original.txt');
// All 87 original helper lines before the one sorted asset entry.
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

const IMPORT_ANCHOR = '    Acl\\AclMain,\n';
const ASSET_IMPORT = '    Assets\\ClinicalWorkspaceAssets,\n';
const HEADER = '    <?php Header::setupHeader(["datetime-picker","report-helper"]); ?>\n';
const LINK = '    <link rel="stylesheet" media="screen" href="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>'
    + '/interface/clinical-workspace/appointments-report-popup.css?v='
    + '<?php echo attr_url((new ClinicalWorkspaceAssets())->version(\'appointments-report-popup.css\')); ?>">\n';
const SHEET = '<div id="report_parameters">';
const MARKED_SHEET = '<div id="report_parameters" class="oe-appointments-report-sheet">';
const ROUTE_EDITS = [
    [IMPORT_ANCHOR, IMPORT_ANCHOR + ASSET_IMPORT],
    [HEADER, HEADER + LINK],
    [SHEET, MARKED_SHEET],
];
const ENTRY = "        'appointments-report-popup.css',\n";
const HELPER_EDITS = [["        'appointment.css',\n", "        'appointment.css',\n" + ENTRY]];

const count = (value, part) => value.split(part).length - 1;
const apply = (value, edits) => edits.reduce((out, [before, after]) => {
    if (count(out, before) !== 1) throw new Error('missing or ambiguous anchor: ' + JSON.stringify(before));
    return out.replace(before, () => after);
}, value);
const inverse = edits => edits.map(([before, after]) => [after, before]);
const verifyExact = (candidate, original, edits, label) => {
    const future = apply(original, edits);
    if (candidate !== future) throw new Error(label + ' differs outside exact additions');
    if (apply(candidate, inverse(edits)) !== original) throw new Error(label + ' does not restore every original byte');
};
const verifyRoute = candidate => verifyExact(candidate, ORIGINAL, ROUTE_EDITS, 'appointments_report.php');
const verifyHelper = candidate => verifyExact(candidate, HELPER_ORIGINAL, HELPER_EDITS, 'ClinicalWorkspaceAssets.php');

const SCOPE = 'html.oe-workbench-context #report_parameters.oe-appointments-report-sheet';
const INK = 'var(--oe-wb-ink, #17343b)';
const PAPER = 'var(--oe-wb-paper, #fff)';
const PETROL = 'var(--oe-wb-petrol, #086878)';
const decl = (prop, value, important = false) => ({ prop, value, important });
const OUTLINE = [decl('outline', '2px solid ' + PETROL), decl('outline-offset', '2px')];
const controls = suffix => [
    SCOPE + ' .form-control' + suffix,
    SCOPE + ' input[type=checkbox]' + suffix,
    SCOPE + ' a.btn' + suffix,
];
const RULES = [
    [[SCOPE], [decl('color', INK), decl('background', PAPER)]],
    [[SCOPE + ' .text'], [decl('color', INK, true)]],
    [controls(':focus'), OUTLINE],
    [controls(':focus-visible'), OUTLINE],
];
const block = ([selectors, declarations]) => selectors.join(',\n') + ' {\n'
    + declarations.map(d => '    ' + d.prop + ': ' + d.value + (d.important ? ' !important' : '') + ';\n').join('') + '}\n';
const FUTURE_CSS = '@media screen {\n' + RULES.map(block).join('\n') + '}\n';

// Reject all nodes outside one screen media and the four ordered rules. PostCSS
// normalizes spacing while retaining selectors, declarations and importance.
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

test('synthetic forward and full inverse contracts accept only the declared additions', () => {
    expect(ORIGINAL.split('\n')).toHaveLength(690);
    expect(ORIGINAL.endsWith('</html>\n\n    <?php\n}\n')).toBe(true);
    expect(HELPER_ORIGINAL.split('\n')).toHaveLength(88);
    expect(() => verifyRoute(FUTURE_ROUTE)).not.toThrow();
    expect(() => verifyHelper(FUTURE_HELPER)).not.toThrow();
    expect(() => verifyCss(FUTURE_CSS)).not.toThrow();
    expect(apply(FUTURE_ROUTE, inverse(ROUTE_EDITS))).toBe(ORIGINAL);
    expect(apply(FUTURE_HELPER, inverse(HELPER_EDITS))).toBe(HELPER_ORIGINAL);
    expect(() => verifyRoute(ORIGINAL)).toThrow();
    expect(() => verifyHelper(HELPER_ORIGINAL)).toThrow();
});

test('synthetic route preserves the report entry, results, export and native controls', () => {
    expect(FUTURE_ROUTE).toContain(HEADER + LINK + '\n    <script>');
    expect(count(FUTURE_ROUTE, LINK)).toBe(1);
    expect(count(FUTURE_ROUTE, ASSET_IMPORT)).toBe(1);
    expect(count(FUTURE_ROUTE, MARKED_SHEET)).toBe(1);
    for (const original of [
        '$sessionAllowWrite = true;',
        "CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: true);",
        "AclMain::aclCheckCore('patients', 'appt')",
        "SessionUtil::unsetSession(['pidList', 'apptdateList']);",
        "if (empty($_POST['form_csvexport'])) {",
        "<form method='post' name='theform' id='theform' action='appointments_report.php' onsubmit='return top.restoreSession()'>",
        'CsrfUtils::collectCsrfToken(session: $session)',
        "name='form_provider[]' class='form-control'  multiple",
        "name='form_from_date' id=\"form_from_date\"",
        "name='form_to_date' id=\"form_to_date\"",
        "'field_id' => 'apptstatus'",
        'id="form_apptcat" name="form_apptcat"',
        "name='form_show_available'", 'name="incl_reminders"',
        'name="with_out_provider"', 'name="with_out_facility"',
        'name="with_day_of_week"', 'name="with_canceled_appt"', 'name="show_address"',
        '$("#theform").submit();', "window.open(\"../patient_file/printed_fee_sheet.php?fill=2\"",
        "window.open(\"../patient_file/addr_appt_label.php\"", "xlt('Export to CSV')",
        '<div id="report_results">', "sortAppointments($appointments, $form_orderby)",
        "fetchAppointments($from_date, $to_date, $patient, $provider, $facility",
        '$spreadsheet->downloadSpreadsheet();', "appointments_fetch_reminders($patient_id, $appointment['pc_eventDate'])",
        "xlt('Please input search criteria above, and click Submit to view results.')",
    ]) expect(FUTURE_ROUTE).toContain(original);
    const entries = [...FUTURE_HELPER.matchAll(/^ {8}'([^']+)',$/gm)].map(match => match[1]);
    expect(entries).toEqual([...entries].sort());
    expect(entries.filter(entry => entry === 'appointments-report-popup.css')).toHaveLength(1);
    expect(entries).toHaveLength(25);
});

test('exact contracts reject route, helper and behavior mutations', () => {
    const routeMutants = [
        ["CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: true);", ''],
        ["AclMain::aclCheckCore('patients', 'appt')", 'false'],
        ["SessionUtil::unsetSession(['pidList', 'apptdateList']);", ''],
        ["$provider  = $_POST['form_provider'] ?? null;", '$provider = null;'],
        ["'SELECT title, seq from list_options WHERE list_id = ? AND option_id = ? AND activity = 1'", "'SELECT title FROM list_options'"],
        ["test_rules_clinic('', 'passive_alert', $appt_date, 'reminders-due', $pid)", '[]'],
        ["$spreadsheet->downloadSpreadsheet();", ''],
        ["$session->set('pidList', $pid_list);", ''],
        ["xlt('Export to CSV')", "xlt('Export')"],
        ["xlt('Print')", "xlt('Preview')"],
        ["action='appointments_report.php' onsubmit='return top.restoreSession()'", "action='appointments_report.php' onsubmit='return true'"],
        ["action='appointments_report.php'", "action='other_report.php'"],
        ["name='form_from_date'", "name='from_date'"],
        ["name='form_provider[]'", "name='provider'"],
        ["name=\"incl_reminders\"", "name=\"no_reminders\""],
        ["<div id=\"report_results\">", "<div id=\"report_results\" class=\"oe-sheet\">"],
        [MARKED_SHEET, '<section class="oe-wrapper">' + MARKED_SHEET],
        [LINK, LINK + LINK],
        ['media="screen"', 'media="all"'],
        ["attr_url((new ClinicalWorkspaceAssets())->version", "attr((new ClinicalWorkspaceAssets())->version"],
    ].map(([from, to]) => mutate(FUTURE_ROUTE, from, to));
    routeMutants.push(FUTURE_ROUTE + ' ', FUTURE_ROUTE.slice(0, -1));
    routeMutants.forEach(candidate => expect(() => verifyRoute(candidate)).toThrow());

    const helperMutants = [
        [ENTRY, ''], [ENTRY, ENTRY + ENTRY],
        ["        'appointment.css',\n" + ENTRY, ENTRY + "        'appointment.css',\n"],
        ["throw new \\InvalidArgumentException('Unsupported clinical workspace asset');", "return '0';"],
    ].map(([from, to]) => mutate(FUTURE_HELPER, from, to));
    helperMutants.push(FUTURE_HELPER + ' ');
    helperMutants.forEach(candidate => expect(() => verifyHelper(candidate)).toThrow());
});

test('strict CSS AST rejects broader scope, mixed focus, paint and non-screen additions', () => {
    const mutants = [
        [SCOPE + ' {', '#report_parameters.oe-appointments-report-sheet {'],
        [SCOPE + ' .text {', SCOPE + ' .text,\n#report_results .text {'],
        [RULES[2][0].join(',\n'), RULES[2][0].slice(0, 2).concat(controls(':focus-visible').slice(2)).join(',\n')],
        [block(RULES[1]), block(RULES[1]).replace('color: ' + INK + ' !important;', 'color: red !important;')],
        [block(RULES[1]), block(RULES[1]).replace('color: ' + INK + ' !important;', 'color: ' + INK + ';')],
        ['background: ' + PAPER + ';', 'background: ' + PAPER + ' !important;'],
        [block(RULES[1]), block(RULES[1]).replace('color: ' + INK + ' !important;', 'font-size: 1rem;')],
        [block(RULES[3]), block(RULES[3]).replace('outline-offset: 2px;', 'outline-offset: 3px;')],
        [block(RULES[3]), ''],
        ['@media screen {', '@media print {'],
        ['@media screen {', '@import "workspace.css";\n@media screen {'],
        [block(RULES[3]), block(RULES[3]) + '\n' + SCOPE + ' table { padding: 1rem; }\n'],
        [block(RULES[3]), block(RULES[3]) + '\n' + SCOPE + ' input:disabled { color: red; }\n'],
        [block(RULES[3]), block(RULES[3]) + '\n' + SCOPE + ' .is-invalid { border: 0; }\n'],
    ].map(([from, to]) => mutate(FUTURE_CSS, from, to));
    mutants.forEach(candidate => expect(() => verifyCss(candidate)).toThrow());
});

// These three assertions are intentionally RED until hosted production work is allowed.
test('actual route has only the declared filter sheet additions', () => {
    expect(() => verifyRoute(route())).not.toThrow();
});

test('actual helper has only the sorted stylesheet entry', () => {
    expect(() => verifyHelper(helper())).not.toThrow();
});

test('actual CSS has exactly four screen-only filter sheet rules', () => {
    expect(() => verifyCss(css())).not.toThrow();
});

test('existing standard menu has both appointment report entry paths', () => {
    const tree = JSON.parse(read('interface/main/tabs/menu/menus/standard.json'));
    const found = [];
    const visit = value => {
        if (!value || typeof value !== 'object') return;
        if (typeof value.url === 'string' && value.url.startsWith('/interface/reports/appointments_report.php')) found.push(value);
        Object.values(value).forEach(visit);
    };
    visit(tree);
    expect(found).toHaveLength(2);
    expect(found).toEqual(expect.arrayContaining([
        expect.objectContaining({ label: 'Appointments', menu_id: 'Popup:Appts', target: 'pop', url: '/interface/reports/appointments_report.php?patient=', acl_req: ['patients', 'appt'] }),
        expect.objectContaining({ label: 'Appointments', menu_id: 'rep0', target: 'rep', url: '/interface/reports/appointments_report.php', acl_req: ['patients', 'appt'] }),
    ]));
});

test('generic popup launcher provides modal-mlg and initial 500 with auto height', () => {
    const js = read('interface/main/tabs/js/tabs_view_model.js');
    expect(js).toContain("if (data.target === 'pop') {");
    expect(js).toContain('return popMenuDialog(webroot_url + data.url(), title);');
    expect(js).toContain("dlgopen(url, 'menupopup', 'modal-mlg', 500, '', title, {");
    expect(js).toContain("sizeHeight: notlike.search('label') !== -1 ? 'full' : 'auto'");
});
