/** @jest-environment node */

const fs = require('fs');
const path = require('path');
const postcss = require('postcss');

const root = path.join(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const readOptional = file => fs.existsSync(path.join(root, file)) ? read(file) : '';
const ORIGINAL = read('tests/clinical-ui/fixtures/portal-template-assignments-popup-original.txt');
// Complete, exact 87-line helper before the one proposed allowlist entry.
const HELPER_ORIGINAL = "<?php\n\n/**\n * Per-file cache versions for the clinical workspace screen assets.\n *\n * Views that link interface/clinical-workspace assets directly append\n * ?v=<version> so a browser refetches a file as soon as it changes. Keeping\n * the filesystem lookup here keeps the view's URL expression free of\n * filesystem roots, and confines which files may be stat()ed to a fixed list.\n *\n * @package   OpenEMR\n * @link      https://www.open-emr.org\n * @author    Craig Allen <craig@interconnected.au>\n * @copyright Copyright (c) 2026 Craig Allen\n * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3\n */\n\ndeclare(strict_types=1);\n\nnamespace OpenEMR\\Common\\Assets;\n\nfinal readonly class ClinicalWorkspaceAssets\n{\n    /**\n     * Supported asset basenames. The directory defaults to the clinical\n     * workspace; a legacy tooltip caller supplies library/js explicitly.\n     */\n    private const SUPPORTED = [\n        'ajtooltip.js',\n        'appointment.css',\n        'calendar-sidebar.js',\n        'calendar-workday.css',\n        'calendar-workday.js',\n        'encounter-document.css',\n        'finder.css',\n        'global-messages.css',\n        'history-document.css',\n        'history-editor.css',\n        'issue-popup.css',\n        'lbf-document.css',\n        'mode.js',\n        'patient-messages.css',\n        'patient-picker-popup.css',\n        'patient-results-popup.css',\n        'patient-search.css',\n        'soap-document.css',\n        'soap-document.js',\n        'soap-reference.css',\n        'soap-reference.js',\n        'visit-history.css',\n        'visit-history.js',\n        'workspace.css',\n    ];\n\n    private string $directory;\n\n    /**\n     * @param ?string $directory Directory holding the assets; defaults to the\n     *                           shipped interface/clinical-workspace.\n     */\n    public function __construct(?string $directory = null)\n    {\n        $this->directory = $directory ?? dirname(__DIR__, 3) . '/interface/clinical-workspace';\n    }\n\n    /**\n     * Modification time of a supported asset as a decimal string, or '0'\n     * when the file is absent.\n     *\n     * @throws \\InvalidArgumentException when $asset is not a supported name\n     */\n    public function version(string $asset): string\n    {\n        if (!in_array($asset, self::SUPPORTED, true)) {\n            throw new \\InvalidArgumentException('Unsupported clinical workspace asset');\n        }\n\n        $path = $this->directory . '/' . $asset;\n        clearstatcache(true, $path);\n        if (!is_file($path)) {\n            return '0';\n        }\n        $mtime = filemtime($path);\n\n        return $mtime === false ? '0' : sprintf('%d', $mtime);\n    }\n}\n";

const ASSET = 'portal-template-assignments-popup.css';
const IMPORT = 'use OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;\n';
const IMPORT_ANCHOR = 'use OpenEMR\\Common\\Csrf\\CsrfUtils;\n';
const HEADER = "    <?php Header::setupHeader(['datetime-picker', 'select2', 'summernote']); ?>\n";
const LINK = '    <link rel="stylesheet" media="screen" href="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>'
    + '/interface/clinical-workspace/' + ASSET + '?v='
    + "<?php echo attr_url((new ClinicalWorkspaceAssets())->version('" + ASSET + "')); ?>\">\n";
const NAV = "        <nav class='nav navbar bg-light text-dark sticky-top'>\n";
const MARKED_NAV = "        <nav class='nav navbar bg-light text-dark sticky-top oe-portal-template-heading'>\n";
const ENTRY = "        '" + ASSET + "',\n";
const HELPER_ANCHOR = "        'patient-search.css',\n        'soap-document.css',\n";
const ROUTE_EDITS = [
    [IMPORT_ANCHOR, IMPORT + IMPORT_ANCHOR],
    [HEADER, HEADER + LINK],
    [NAV, MARKED_NAV],
];
const HELPER_EDITS = [[HELPER_ANCHOR, "        'patient-search.css',\n" + ENTRY + "        'soap-document.css',\n"]];

const count = (value, part) => value.split(part).length - 1;
const apply = (value, edits) => edits.reduce((out, [before, after]) => {
    if (count(out, before) !== 1) throw new Error('missing or ambiguous anchor: ' + JSON.stringify(before));
    return out.replace(before, () => after);
}, value);
const inverse = edits => edits.map(([before, after]) => [after, before]);
const verifyExact = (candidate, original, edits, label) => {
    if (candidate !== apply(original, edits)) throw new Error(label + ' differs outside exact additions');
    if (apply(candidate, inverse(edits)) !== original) throw new Error(label + ' fails complete inverse');
};
const verifyRoute = value => verifyExact(value, ORIGINAL, ROUTE_EDITS, 'import_template_ui.php');
const verifyHelper = value => verifyExact(value, HELPER_ORIGINAL, HELPER_EDITS, 'ClinicalWorkspaceAssets.php');

const SCOPE = 'html.oe-workbench-context .oe-portal-template-heading';
const INK = 'var(--oe-wb-ink, #17343b)';
const PAPER = 'var(--oe-wb-paper, #fff)';
const PETROL = 'var(--oe-wb-petrol, #086878)';
const decl = (prop, value, important = false) => ({ prop, value, important });
const RULES = [
    [SCOPE, [decl('color', INK, true), decl('background-color', PAPER, true)]],
    [SCOPE + ' button:focus', [decl('outline', '2px solid ' + PETROL), decl('outline-offset', '2px')]],
    [SCOPE + ' button:focus-visible', [decl('outline', '2px solid ' + PETROL), decl('outline-offset', '2px')]],
];
const block = ([selector, declarations]) => '  ' + selector + ' {\n'
    + declarations.map(item => '    ' + item.prop + ': ' + item.value + (item.important ? ' !important' : '') + ';\n').join('')
    + '  }\n';
const FUTURE_CSS = '@media screen {\n' + RULES.map(block).join('\n') + '}\n';

const verifyCss = value => {
    const ast = postcss.parse(value);
    if (ast.nodes.length !== 1) throw new Error('expected only one media block');
    const media = ast.nodes[0];
    if (media.type !== 'atrule' || media.name !== 'media' || media.params !== 'screen') {
        throw new Error('expected screen media');
    }
    if (!media.nodes || media.nodes.length !== 3) throw new Error('expected exactly three rules');
    media.nodes.forEach((rule, index) => {
        const [selector, declarations] = RULES[index];
        if (rule.type !== 'rule' || rule.selector !== selector || rule.raws.before !== (index ? '\n\n  ' : '\n  ')) {
            throw new Error('unexpected or unindented selector ' + index);
        }
        if (rule.nodes.length !== declarations.length) throw new Error('unexpected declaration count ' + index);
        const found = rule.nodes.map(node => {
            if (node.type !== 'decl' || node.raws.before !== '\n    ') throw new Error('unexpected CSS child');
            return decl(node.prop, node.value, Boolean(node.important));
        });
        if (JSON.stringify(found) !== JSON.stringify(declarations)) throw new Error('unexpected declaration ' + index);
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

test('synthetic forward and inverse preserve every original route and helper byte', () => {
    expect(ORIGINAL.split('\n')).toHaveLength(1070);
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

test('synthetic contract places a versioned screen link after Header and marks only the top nav', () => {
    expect(count(FUTURE_ROUTE, HEADER + LINK)).toBe(1);
    expect(count(FUTURE_ROUTE, MARKED_NAV)).toBe(1);
    expect(FUTURE_ROUTE.indexOf(LINK)).toBeLessThan(FUTURE_ROUTE.indexOf('    <script>'));
    expect(FUTURE_ROUTE.indexOf(MARKED_NAV)).toBeLessThan(FUTURE_ROUTE.indexOf("<nav class='navbar navbar-dark bg-dark text-light sticky-top'>"));
    expect(FUTURE_ROUTE).toContain("<nav class='navbar navbar-dark bg-dark text-light sticky-top'>");
    const entries = [...FUTURE_HELPER.matchAll(/^ {8}'([^']+)',$/gm)].map(match => match[1]);
    expect(entries).toEqual([...entries].sort());
    expect(entries).toHaveLength(25);
    expect(entries.filter(item => item === ASSET)).toHaveLength(1);
});

test('route and helper reject placement, escaping, utility, workflow, and byte mutations', () => {
    const routeMutants = [
        [LINK, ''], [LINK, LINK + LINK], [MARKED_NAV, NAV],
        [MARKED_NAV, "        <nav class='nav navbar oe-portal-template-heading'>\n"],
        [MARKED_NAV, "        <div class='oe-portal-template-heading'>\n" + NAV],
        ["<body class=\"body-top\">", "<body class=\"body-top oe-portal-template-heading\">"],
        ["<form id=\"edit_form\" name=\"edit_form\" class=\"row form-inline w-100\"", "<form id=\"edit_form\" name=\"edit_form\" class=\"row form-inline w-100 oe-portal-template-heading\""],
        ['media="screen"', 'media="print"'],
        ['<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>', '<?php echo OEGlobalsBag::getInstance()->getWebRoot(); ?>'],
        ["attr_url((new ClinicalWorkspaceAssets())->version('" + ASSET + "'))", "(new ClinicalWorkspaceAssets())->version('" + ASSET + "')"],
        ["$portalService::authPortalUser('admin', 'forms')", 'true'],
        ['new DocumentTemplateService()', 'null'],
        ["$_REQUEST['selected_patients'] ?? null", 'null'],
        ["$_REQUEST['upload_pid'] ?? 0", '0'],
        ["CsrfUtils::collectCsrfToken($session, 'import-template-upload')", "'disabled'"],
        ["CsrfUtils::collectCsrfToken($session, 'import-template-delete')", "'disabled'"],
        ['SendNotificationEvent::JAVASCRIPT_READY_NOTIFICATION_POST', "'disabled'"],
        ['SendNotificationEvent::ACTIONS_RENDER_NOTIFICATION_POST', "'disabled'"],
        ["function sendTemplate(mode = 'send', content = '') {\n            top.restoreSession();\n            let url = 'import_template.php';", "function sendTemplate(mode = 'send', content = '') {\n            top.restoreSession();\n            let url = 'other.php';"],
        ["let ids = $('#selected_patients').select2('val');", 'let ids = [];'],
        ["<form id='form_upload' class='form-inline row' action='import_template.php'", "<form id='form_upload' class='form-inline row' action='other.php'"],
        ["selectDropdown.select2({", 'selectDropdown.disabled = true;'],
        ["ourSelect.select2({", 'ourSelect.disabled = true;'],
        ["let renderUrl = 'import_template.php?mode=editor_render_html&docid=' + id;", 'let renderUrl = id;'],
        ["document.getElementById('is_modal').checked", 'false'],
        ["$('#persist_checks').val(JSON.stringify(selectedValues));", "$('#persist_checks').val('');"],
    ].map(([from, to]) => mutate(FUTURE_ROUTE, from, to));
    routeMutants.push(FUTURE_ROUTE + ' ', FUTURE_ROUTE.slice(0, -1), ' ' + FUTURE_ROUTE);
    const displaced = mutate(FUTURE_ROUTE, HEADER + LINK, HEADER);
    routeMutants.push(mutate(displaced, "    <style>\n", LINK + "    <style>\n"));
    const wrongNav = mutate(FUTURE_ROUTE, MARKED_NAV, NAV);
    routeMutants.push(mutate(wrongNav,
        "<nav class='navbar navbar-dark bg-dark text-light sticky-top'>",
        "<nav class='navbar navbar-dark bg-dark text-light sticky-top oe-portal-template-heading'>"));
    routeMutants.forEach(candidate => expect(() => verifyRoute(candidate)).toThrow());
    const helperMutants = [
        [ENTRY, ''], [ENTRY, ENTRY + ENTRY],
        ["        'patient-search.css',\n" + ENTRY, ENTRY + "        'patient-search.css',\n"],
        ["throw new \\InvalidArgumentException('Unsupported clinical workspace asset');", "return '0';"],
    ].map(([from, to]) => mutate(FUTURE_HELPER, from, to));
    helperMutants.push(FUTURE_HELPER + ' ');
    helperMutants.forEach(candidate => expect(() => verifyHelper(candidate)).toThrow());
});

test('strict CSS AST rejects print, global, control paint, geometry, importance, and grouped focus', () => {
    const mutants = [
        [SCOPE + ' {', '.oe-portal-template-heading {'],
        [SCOPE + ' {', 'html.oe-workbench-popup .oe-portal-template-heading {'],
        [SCOPE + ' button:focus {', 'button:focus {'],
        [SCOPE + ' button:focus-visible {', SCOPE + ' button:focus,\n  ' + SCOPE + ' button:focus-visible {'],
        ['color: ' + INK + ' !important;', 'color: ' + INK + ';'],
        ['background-color: ' + PAPER + ' !important;', 'background-color: ' + PAPER + ';'],
        ['background-color: ' + PAPER + ' !important;', 'background-color: ' + PAPER + ' !important !important;'],
        ['color: ' + INK + ' !important;', 'color: red !important;'],
        [block(RULES[1]), block(RULES[1]).replace('outline: 2px solid ' + PETROL + ';', 'outline: 2px solid ' + PETROL + ' !important;')],
        [block(RULES[2]), block(RULES[2]).replace('outline-offset: 2px;', 'outline-offset: 0;')],
        ['@media screen {', '@media print {'],
        ['@media screen {', '@media screen and (min-width: 600px) {'],
        ['@media screen {', '@import "workspace.css";\n@media screen {'],
        [block(RULES[2]), block(RULES[2]) + '  ' + SCOPE + ' { width: 500px; }\n'],
        [block(RULES[2]), block(RULES[2]) + '  body { background: red; }\n'],
        [block(RULES[2]), block(RULES[2]) + '  ' + SCOPE + ' select { color: red; }\n'],
        [block(RULES[2]), block(RULES[2]) + '  ' + SCOPE + ' .select2-container { color: red; }\n'],
        [block(RULES[2]), block(RULES[2]) + '  ' + SCOPE + ' .note-editor { color: red; }\n'],
        [block(RULES[2]), block(RULES[2]) + '  ' + SCOPE + ' table { background: red; }\n'],
        [block(RULES[2]), block(RULES[2]) + '  ' + SCOPE + ' .btn-success { background: red; }\n'],
        [block(RULES[2]), block(RULES[2]) + '  ' + SCOPE + ' { margin: 1rem; }\n'],
        [block(RULES[2]), block(RULES[2]) + '  ' + SCOPE + ' { font-size: 2rem; }\n'],
        [block(RULES[2]), ''],
        [block(RULES[1]) + '\n' + block(RULES[2]), '  ' + SCOPE + ' button:focus,\n  ' + SCOPE + ' button:focus-visible {\n    outline: 2px solid ' + PETROL + ';\n    outline-offset: 2px;\n  }\n'],
    ].map(([from, to]) => mutate(FUTURE_CSS, from, to));
    mutants.forEach(candidate => expect(() => verifyCss(candidate)).toThrow());
});

test('caller, shared context, and source-only security boundaries remain visible', () => {
    const caller = read('interface/main/tabs/main.php');
    for (const anchor of [
        'function assignPatientDocuments(patientId) {',
        "'/portal/import_template_ui.php?from_demo_pid=' + encodeURIComponent(patientId)",
        "dlgopen(url, 'pop-assignments', 'modal-lg', 850, '', '', {",
        "<?php Header::setupHeader(['knockout', 'tabs-theme', 'i18next', 'hotkeys', 'i18formatting']); ?>",
    ]) expect(caller).toContain(anchor);
    const popup = read('interface/clinical-workspace/popup.js');
    expect(popup).toContain("const CONTEXT_CLASS = 'oe-workbench-context';");
    expect(popup).toContain("body.classList.contains('workbench-active')");
    const popupCss = read('interface/clinical-workspace/popup.css');
    for (const token of ['--oe-wb-ink: #17343b;', '--oe-wb-paper: #fff;', '--oe-wb-petrol: #086878;']) {
        expect(popupCss).toContain(token);
    }
    const config = read('config/config.yaml');
    expect(config).toContain('    script: popup.js\n    link: popup.css\n    autoload: true');
    const portalService = read('src/Services/PatientPortalService.php');
    expect(portalService).toContain("public static function authPortalUser(string $sect = 'admin', string $v = 'docs', $u = null): bool");
    const templateService = read('src/Services/DocumentTemplates/DocumentTemplateService.php');
    for (const anchor of ['function searchPatients(', 'function getTemplateCategoriesByPids(', 'function sendTemplate(']) {
        expect(templateService).toContain(anchor);
    }
    const actions = read('portal/import_template.php');
    for (const anchor of [
        "AclMain::aclCheckCore('admin', 'forms')", "($_POST['mode'] ?? null) === 'send'",
        "($_POST['mode'] ?? null) === 'send_profiles'", "($_POST['mode'] ?? null) === 'delete'",
        "CsrfUtils::checkCsrfInput(INPUT_POST, subject: 'import-template-upload', dieOnFail: true)",
        "CsrfUtils::checkCsrfInput(INPUT_POST, subject: 'import-template-delete', dieOnFail: true)",
    ]) expect(actions).toContain(anchor);
});

// Hermes obtains hosted genuine RED before any production edit. No local execution in this phase.
test('actual route has exactly the declared heading additions', () => {
    expect(() => verifyRoute(read('portal/import_template_ui.php'))).not.toThrow();
});
test('actual helper has exactly one sorted supported stylesheet', () => {
    expect(() => verifyHelper(read('src/Common/Assets/ClinicalWorkspaceAssets.php'))).not.toThrow();
});
test('actual stylesheet has exactly three scoped screen rules', () => {
    expect(() => verifyCss(readOptional('interface/clinical-workspace/' + ASSET))).not.toThrow();
});
