/** @jest-environment node */

const fs = require('fs');
const path = require('path');
const postcss = require('postcss');

const root = path.join(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const readOptional = file => fs.existsSync(path.join(root, file)) ? read(file) : '';
const ORIGINAL = read('tests/clinical-ui/fixtures/patient-groups-popup-original.txt');
// Complete, exact 87-line helper before the proposed allowlist entry.
const HELPER_ORIGINAL = "<?php\n\n/**\n * Per-file cache versions for the clinical workspace screen assets.\n *\n * Views that link interface/clinical-workspace assets directly append\n * ?v=<version> so a browser refetches a file as soon as it changes. Keeping\n * the filesystem lookup here keeps the view's URL expression free of\n * filesystem roots, and confines which files may be stat()ed to a fixed list.\n *\n * @package   OpenEMR\n * @link      https://www.open-emr.org\n * @author    Craig Allen <craig@interconnected.au>\n * @copyright Copyright (c) 2026 Craig Allen\n * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3\n */\n\ndeclare(strict_types=1);\n\nnamespace OpenEMR\\Common\\Assets;\n\nfinal readonly class ClinicalWorkspaceAssets\n{\n    /**\n     * Supported asset basenames. The directory defaults to the clinical\n     * workspace; a legacy tooltip caller supplies library/js explicitly.\n     */\n    private const SUPPORTED = [\n        'ajtooltip.js',\n        'appointment.css',\n        'calendar-sidebar.js',\n        'calendar-workday.css',\n        'calendar-workday.js',\n        'encounter-document.css',\n        'finder.css',\n        'global-messages.css',\n        'history-document.css',\n        'history-editor.css',\n        'issue-popup.css',\n        'lbf-document.css',\n        'mode.js',\n        'patient-messages.css',\n        'patient-picker-popup.css',\n        'patient-results-popup.css',\n        'patient-search.css',\n        'soap-document.css',\n        'soap-document.js',\n        'soap-reference.css',\n        'soap-reference.js',\n        'visit-history.css',\n        'visit-history.js',\n        'workspace.css',\n    ];\n\n    private string $directory;\n\n    /**\n     * @param ?string $directory Directory holding the assets; defaults to the\n     *                           shipped interface/clinical-workspace.\n     */\n    public function __construct(?string $directory = null)\n    {\n        $this->directory = $directory ?? dirname(__DIR__, 3) . '/interface/clinical-workspace';\n    }\n\n    /**\n     * Modification time of a supported asset as a decimal string, or '0'\n     * when the file is absent.\n     *\n     * @throws \\InvalidArgumentException when $asset is not a supported name\n     */\n    public function version(string $asset): string\n    {\n        if (!in_array($asset, self::SUPPORTED, true)) {\n            throw new \\InvalidArgumentException('Unsupported clinical workspace asset');\n        }\n\n        $path = $this->directory . '/' . $asset;\n        clearstatcache(true, $path);\n        if (!is_file($path)) {\n            return '0';\n        }\n        $mtime = filemtime($path);\n\n        return $mtime === false ? '0' : sprintf('%d', $mtime);\n    }\n}\n";

const ASSET = 'patient-groups-popup.css';
const IMPORT = 'use OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;\n';
const IMPORT_ANCHOR = 'use OpenEMR\\Core\\Header;\n';
const HEAD_END = '    <?php } ?>\n</head>';
const LINK = '    <link rel="stylesheet" media="screen" href="<?php echo attr($globalsBag->getWebRoot()); ?>'
    + '/interface/clinical-workspace/' + ASSET + '?v='
    + "<?php echo attr_url((new ClinicalWorkspaceAssets())->version('" + ASSET + "')); ?>\">\n";
const NAV = "class='navbar navbar-light bg-light sticky-top'";
const MARKED_NAV = "class='navbar navbar-light bg-light sticky-top oe-patient-groups-heading'";
const ENTRY = "        '" + ASSET + "',\n";
const HELPER_ANCHOR = "        'mode.js',\n        'patient-messages.css',\n";

const count = (value, part) => value.split(part).length - 1;
const replaceCount = (value, from, to, expected) => {
    if (count(value, from) !== expected) throw new Error('missing or ambiguous anchor: ' + JSON.stringify(from));
    return value.split(from).join(to);
};
const forwardRoute = value => {
    let next = replaceCount(value, IMPORT_ANCHOR, IMPORT + IMPORT_ANCHOR, 1);
    next = replaceCount(next, HEAD_END, '    <?php } ?>\n' + LINK + '</head>', 2);
    return replaceCount(next, NAV, MARKED_NAV, 4);
};
const inverseRoute = value => {
    let next = replaceCount(value, MARKED_NAV, NAV, 4);
    next = replaceCount(next, '    <?php } ?>\n' + LINK + '</head>', HEAD_END, 2);
    return replaceCount(next, IMPORT + IMPORT_ANCHOR, IMPORT_ANCHOR, 1);
};
const forwardHelper = value => replaceCount(value, HELPER_ANCHOR,
    "        'mode.js',\n" + ENTRY + "        'patient-messages.css',\n", 1);
const inverseHelper = value => replaceCount(value,
    "        'mode.js',\n" + ENTRY + "        'patient-messages.css',\n",
    HELPER_ANCHOR, 1);
const FUTURE_ROUTE = forwardRoute(ORIGINAL);
const FUTURE_HELPER = forwardHelper(HELPER_ORIGINAL);
const verifyRoute = value => {
    if (value !== FUTURE_ROUTE || inverseRoute(value) !== ORIGINAL) {
        throw new Error('patient_groups.php differs outside exact additions');
    }
};
const verifyHelper = value => {
    if (value !== FUTURE_HELPER || inverseHelper(value) !== HELPER_ORIGINAL) {
        throw new Error('ClinicalWorkspaceAssets.php differs outside one allowlist entry');
    }
};

const SCOPE = 'html.oe-workbench-context .oe-patient-groups-heading';
const INK = 'var(--oe-wb-ink, #17343b)';
const PAPER = 'var(--oe-wb-paper, #fff)';
const PETROL = 'var(--oe-wb-petrol, #086878)';
const decl = (prop, value, important = false) => ({ prop, value, important });
const RULES = [
    [SCOPE, [decl('color', INK), decl('background-color', PAPER, true)]],
    [SCOPE + ' .navbar-brand', [decl('color', 'inherit')]],
    [SCOPE + ' button:focus', [decl('outline', '2px solid ' + PETROL), decl('outline-offset', '2px')]],
    [SCOPE + ' button:focus-visible', [decl('outline', '2px solid ' + PETROL), decl('outline-offset', '2px')]],
];
const block = ([selector, declarations]) => '  ' + selector + ' {\n'
    + declarations.map(item => '    ' + item.prop + ': ' + item.value
        + (item.important ? ' !important' : '') + ';\n').join('') + '  }\n';
const FUTURE_CSS = '@media screen {\n' + RULES.map(block).join('\n') + '}\n';
const verifyCss = value => {
    const ast = postcss.parse(value);
    if (ast.nodes.length !== 1) throw new Error('expected one media block');
    const media = ast.nodes[0];
    if (media.type !== 'atrule' || media.name !== 'media' || media.params !== 'screen') {
        throw new Error('expected screen media');
    }
    if (!media.nodes || media.nodes.length !== 4) throw new Error('expected exactly four rules');
    media.nodes.forEach((rule, index) => {
        const [selector, declarations] = RULES[index];
        if (rule.type !== 'rule' || rule.selector !== selector ||
            rule.raws.before !== (index ? '\n\n  ' : '\n  ')) {
            throw new Error('unexpected selector or continuation indentation ' + index);
        }
        if (!rule.nodes || rule.nodes.length !== declarations.length) {
            throw new Error('unexpected declaration count ' + index);
        }
        const found = rule.nodes.map(node => {
            if (node.type !== 'decl' || node.raws.before !== '\n    ') {
                throw new Error('unexpected CSS child');
            }
            return decl(node.prop, node.value, Boolean(node.important));
        });
        if (JSON.stringify(found) !== JSON.stringify(declarations)) {
            throw new Error('unexpected declaration ' + index);
        }
    });
    if (value !== FUTURE_CSS) throw new Error('unexpected CSS bytes');
};
const mutate = (value, from, to) => {
    expect(count(value, from)).toBeGreaterThan(0);
    const changed = value.replace(from, () => to);
    expect(changed).not.toBe(value);
    return changed;
};

test('synthetic forward, inverse, and CSS contracts pass independently of absent production', () => {
    expect(ORIGINAL.split('\n')).toHaveLength(567);
    expect(ORIGINAL.endsWith('<?php }\n')).toBe(true);
    expect(HELPER_ORIGINAL.split('\n')).toHaveLength(88);
    expect(count(ORIGINAL, HEAD_END)).toBe(2);
    expect(count(ORIGINAL, NAV)).toBe(4);
    expect(() => verifyRoute(FUTURE_ROUTE)).not.toThrow();
    expect(() => verifyHelper(FUTURE_HELPER)).not.toThrow();
    expect(() => verifyCss(FUTURE_CSS)).not.toThrow();
    expect(inverseRoute(FUTURE_ROUTE)).toBe(ORIGINAL);
    expect(inverseHelper(FUTURE_HELPER)).toBe(HELPER_ORIGINAL);
    expect(() => verifyRoute(ORIGINAL)).toThrow();
    expect(() => verifyHelper(HELPER_ORIGINAL)).toThrow();
    expect(() => verifyCss('')).toThrow();
});

test('synthetic additions cover both branches, both Header versions, and all four navs', () => {
    const branches = FUTURE_ROUTE.split("<?php } elseif ($_GET['render_group_assignments'] === 'true') { ?>");
    expect(branches).toHaveLength(2);
    for (const branch of branches) {
        expect(count(branch, "Header::setupHeader(['opener','datetime-picker', 'sortablejs']);")).toBe(1);
        expect(count(branch, "Header::setupHeader(['opener','datetime-picker']);")).toBe(1);
        expect(count(branch, LINK)).toBe(1);
        expect(count(branch, MARKED_NAV)).toBe(2);
        expect(branch.indexOf(LINK)).toBeLessThan(branch.indexOf('</head>'));
        expect(branch.indexOf(LINK)).toBeGreaterThan(branch.indexOf('Sortable.min.js'));
    }
    expect(count(FUTURE_ROUTE, IMPORT)).toBe(1);
    expect(count(FUTURE_ROUTE, NAV)).toBe(0);
    expect(count(FUTURE_ROUTE, 'oe-patient-groups-heading')).toBe(4);
    expect(count(FUTURE_ROUTE, '<?php echo attr($globalsBag->getWebRoot()); ?>')).toBe(2);
    expect(count(FUTURE_ROUTE, "attr_url((new ClinicalWorkspaceAssets())->version('" + ASSET + "'))")).toBe(2);
    const entries = [...FUTURE_HELPER.matchAll(/^ {8}'([^']+)',$/gm)].map(match => match[1]);
    expect(entries).toEqual([...entries].sort());
    expect(entries.filter(item => item === ASSET)).toHaveLength(1);
    expect(entries).toHaveLength(25);
    expect(FUTURE_CSS.match(/!important/g)).toHaveLength(1);
    // Local theme uses .navbar-light .navbar-brand (0,2,0); this has html + three classes.
    expect(RULES[1][0]).toBe(SCOPE + ' .navbar-brand');
});

test('route and helper reject workflow, security-boundary, placement, and byte mutations', () => {
    const routeMutants = [
        [IMPORT, ''], [LINK, ''], [MARKED_NAV, NAV],
        [MARKED_NAV, "class='navbar navbar-light bg-light oe-patient-groups-heading'"],
        [MARKED_NAV, "class='navbar oe-patient-groups-heading'"],
        ['media="screen"', 'media="print"'],
        ['<?php echo attr($globalsBag->getWebRoot()); ?>', '<?php echo $globalsBag->getWebRoot(); ?>'],
        ["attr_url((new ClinicalWorkspaceAssets())->version('" + ASSET + "'))",
            "(new ClinicalWorkspaceAssets())->version('" + ASSET + "')"],
        ["if ($_POST['mode'] === 'save_profile_groups')", "if (false && $_POST['mode'] === 'save_profile_groups')"],
        ["if ($_POST['mode'] === 'save_groups')", "if (false && $_POST['mode'] === 'save_groups')"],
        ['require_once(\'./../../interface/globals.php\');', '// require removed'],
        ["$templateService->savePatientGroupsByProfile($work_ids)", 'true'],
        ["$templateService->updateGroupsInPatients($master_ids)", 'true'],
        ["$templateService->fetchDefaultGroups()", '[]'],
        ["$templateService->fetchDefaultProfiles()", '[]'],
        ["$templateService->getPatientsByAllGroups()", '[]'],
        ['getPatientLnames("$searchparm"', 'getPatientLnames(""'],
        ['getPatientPhone("$searchparm")', '[]'],
        ['getPatientId("$searchparm")', '[]'],
        ['getPatientDOB(DateToYYYYMMDD($searchparm))', '[]'],
        ['getPatientSSN("$searchparm")', '[]'],
        ['fetchPatientListByIssuesSearch("$searchparm")', '[]'],
        ["Sortable.create(patientRepository, {", 'patientRepository.remove();'],
        ["Sortable.create(dropGroup, {", 'dropGroup.remove();'],
        ["Sortable.create(id, {", 'id.remove();'],
        ['multiDrag: true,', 'multiDrag: false,'],
        ["if (dedup[toEl.getAttribute('data-pid')])", 'if (false)'],
        ["if (dedup[toEl.getAttribute('data-group')])", 'if (false)'],
        ["data.append('mode', 'save_groups');", "data.append('mode', 'none');"],
        ["data.append('mode', 'save_profile_groups');", "data.append('mode', 'none');"],
        ["fetch('./patient_groups.php', {", "fetch('./other.php', {"],
        ["top.restoreSession();", ''],
        ["opener.document.edit_form.submit();", ''],
        ["dlgclose();", ''],
        ["xlt('Patient Groups')", "'Patient Groups'"],
        ["xlt('Profiles')", "'Profiles'"],
        ["js_escape($group_list)", "$group_list"],
        ["attr($pt['pid'])", "$pt['pid']"],
        ["<h5 class='bg-dark text-light text-center'", "<h5 class='oe-patient-groups-heading bg-dark text-light text-center'"],
        ["<li class='list-group-item move-handle", "<li class='oe-patient-groups-heading list-group-item move-handle"],
        ["<div class='container-fluid'>", "<div class='container-fluid oe-patient-groups-heading'>"],
    ].map(([from, to]) => mutate(FUTURE_ROUTE, from, to));
    routeMutants.push(FUTURE_ROUTE + ' ', FUTURE_ROUTE.slice(0, -1), ' ' + FUTURE_ROUTE);
    routeMutants.push(mutate(FUTURE_ROUTE, LINK, LINK + LINK));
    routeMutants.push(mutate(FUTURE_ROUTE, MARKED_NAV, MARKED_NAV + ' '));
    routeMutants.push(mutate(FUTURE_ROUTE, "if ($_POST['mode'] === 'save_groups')",
        "if (CsrfUtils::checkCsrfInput(INPUT_POST) && $_POST['mode'] === 'save_groups')"));
    routeMutants.push(mutate(FUTURE_ROUTE, "if ($_POST['mode'] === 'save_groups')",
        "if (AclMain::aclCheckCore('admin', 'forms') && $_POST['mode'] === 'save_groups')"));
    const misplaced = mutate(FUTURE_ROUTE, '    <?php } ?>\n' + LINK + '</head>', HEAD_END);
    routeMutants.push(mutate(misplaced, '<body>\n', '<body>\n' + LINK));
    routeMutants.forEach(candidate => expect(() => verifyRoute(candidate)).toThrow());
    const helperMutants = [
        [ENTRY, ''], [ENTRY, ENTRY + ENTRY],
        ["        'mode.js',\n" + ENTRY, ENTRY + "        'mode.js',\n"],
        ["throw new \\InvalidArgumentException('Unsupported clinical workspace asset');", "return '0';"],
    ].map(([from, to]) => mutate(FUTURE_HELPER, from, to));
    helperMutants.push(FUTURE_HELPER + ' ');
    helperMutants.forEach(candidate => expect(() => verifyHelper(candidate)).toThrow());
});

test('strict CSS AST rejects print, global paint, list paint, geometry, font, and extra importance', () => {
    const mutants = [
        [SCOPE + ' {', '.oe-patient-groups-heading {'],
        [SCOPE + ' {', 'html.oe-workbench-popup .oe-patient-groups-heading {'],
        [SCOPE + ' .navbar-brand {', '.navbar-light .navbar-brand {'],
        ['color: inherit;', 'color: red;'],
        ['color: inherit;', 'color: inherit !important;'],
        ['color: ' + INK + ';', 'color: ' + INK + ' !important;'],
        ['background-color: ' + PAPER + ' !important;', 'background-color: ' + PAPER + ';'],
        ['background-color: ' + PAPER + ' !important;', 'background-color: red !important;'],
        [SCOPE + ' button:focus {', 'button:focus {'],
        [SCOPE + ' button:focus-visible {', SCOPE + ' button:focus,\n  ' + SCOPE + ' button:focus-visible {'],
        ['outline: 2px solid ' + PETROL + ';', 'outline: 2px solid ' + PETROL + ' !important;'],
        ['outline-offset: 2px;', 'outline-offset: 0;'],
        ['@media screen {', '@media print {'],
        ['@media screen {', '@media screen and (min-width: 600px) {'],
        ['@media screen {', '@import "workspace.css";\n@media screen {'],
        [block(RULES[3]), block(RULES[3]) + '  body { background: red; }\n'],
        [block(RULES[3]), block(RULES[3]) + '  ' + SCOPE + ' .list-group-item { color: red; }\n'],
        [block(RULES[3]), block(RULES[3]) + '  ' + SCOPE + ' .active { background: red; }\n'],
        [block(RULES[3]), block(RULES[3]) + '  ' + SCOPE + ' .alert { color: red; }\n'],
        [block(RULES[3]), block(RULES[3]) + '  ' + SCOPE + ' h5 { color: red; }\n'],
        [block(RULES[3]), block(RULES[3]) + '  ' + SCOPE + ' { width: 500px; }\n'],
        [block(RULES[3]), block(RULES[3]) + '  ' + SCOPE + ' { font-size: 2rem; }\n'],
        [block(RULES[3]), ''],
        [block(RULES[2]) + '\n' + block(RULES[3]),
            '  ' + SCOPE + ' button:focus,\n  ' + SCOPE + ' button:focus-visible {\n'
            + '    outline: 2px solid ' + PETROL + ';\n    outline-offset: 2px;\n  }\n'],
        ['\n\n  ' + SCOPE + ' .navbar-brand', '\n    ' + SCOPE + ' .navbar-brand'],
    ].map(([from, to]) => mutate(FUTURE_CSS, from, to));
    mutants.forEach(candidate => expect(() => verifyCss(candidate)).toThrow());
});

test('caller, context activation, theme source, and existing security boundary stay visible', () => {
    const caller = read('portal/import_template_ui.php');
    for (const anchor of [
        "let url = './lib/patient_groups.php';",
        "let url = './lib/patient_groups.php?render_group_assignments=true';",
        "dlgopen(url, 'pop-profile', 'modal-lg', 850, '', '', {",
        "dlgopen(url, 'pop-groups', 'modal-lg', 850, '', '', {",
        "$portalService::authPortalUser('admin', 'forms')",
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
    const globals = read('interface/globals.php');
    expect(globals).toContain('require_once("$srcdir/auth.inc.php");');
    const service = read('src/Services/DocumentTemplates/DocumentTemplateService.php');
    for (const anchor of [
        'function fetchDefaultGroups(', 'function fetchDefaultProfiles(',
        'function savePatientGroupsByProfile(', 'function updateGroupsInPatients(',
        'function getPatientsByAllGroups(', 'function fetchPatientListByIssuesSearch(',
        'DELETE From \`document_template_profiles\`', 'UPDATE \`patient_data\` SET \`patient_groups\`',
    ]) expect(service).toContain(anchor);
    expect(ORIGINAL).not.toMatch(/AclMain|CsrfUtils|checkCsrfInput/);
    expect(ORIGINAL).toContain("if ($_POST['mode'] === 'save_groups')");
    expect(ORIGINAL).toContain("if ($_POST['mode'] === 'save_profile_groups')");
    const theme = read('interface/themes/colors/utilities/bootstrap-nav-menu.scss');
    expect(theme).toContain('.navbar-light {');
    expect(theme).toContain('background-color: $dark !important;');
});

// Hosted RED is required before production. These three intentionally fail on this untouched branch.
test('actual route has exactly the declared additions', () => {
    expect(() => verifyRoute(read('portal/lib/patient_groups.php'))).not.toThrow();
});
test('actual helper has exactly one sorted supported stylesheet', () => {
    expect(() => verifyHelper(read('src/Common/Assets/ClinicalWorkspaceAssets.php'))).not.toThrow();
});
test('actual stylesheet has exactly four scoped screen rules', () => {
    expect(() => verifyCss(readOptional('interface/clinical-workspace/' + ASSET))).not.toThrow();
});
