/** @jest-environment node */

const fs = require('fs');
const path = require('path');
const postcss = require('postcss');

const root = path.join(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const readOptional = file => fs.existsSync(path.join(root, file)) ? read(file) : '';
const ORIGINAL = read('tests/clinical-ui/fixtures/template-profile-popup-original.txt');
// Complete ClinicalWorkspaceAssets.php before the proposed allowlist entry.
const HELPER_ORIGINAL = "<?php\n\n/**\n * Per-file cache versions for the clinical workspace screen assets.\n *\n * Views that link interface/clinical-workspace assets directly append\n * ?v=<version> so a browser refetches a file as soon as it changes. Keeping\n * the filesystem lookup here keeps the view's URL expression free of\n * filesystem roots, and confines which files may be stat()ed to a fixed list.\n *\n * @package   OpenEMR\n * @link      https://www.open-emr.org\n * @author    Craig Allen <craig@interconnected.au>\n * @copyright Copyright (c) 2026 Craig Allen\n * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3\n */\n\ndeclare(strict_types=1);\n\nnamespace OpenEMR\\Common\\Assets;\n\nfinal readonly class ClinicalWorkspaceAssets\n{\n    /**\n     * Supported asset basenames. The directory defaults to the clinical\n     * workspace; a legacy tooltip caller supplies library/js explicitly.\n     */\n    private const SUPPORTED = [\n        'ajtooltip.js',\n        'appointment.css',\n        'calendar-sidebar.js',\n        'calendar-workday.css',\n        'calendar-workday.js',\n        'encounter-document.css',\n        'finder.css',\n        'global-messages.css',\n        'history-document.css',\n        'history-editor.css',\n        'issue-popup.css',\n        'lbf-document.css',\n        'mode.js',\n        'patient-messages.css',\n        'patient-picker-popup.css',\n        'patient-results-popup.css',\n        'patient-search.css',\n        'soap-document.css',\n        'soap-document.js',\n        'soap-reference.css',\n        'soap-reference.js',\n        'visit-history.css',\n        'visit-history.js',\n        'workspace.css',\n    ];\n\n    private string $directory;\n\n    /**\n     * @param ?string $directory Directory holding the assets; defaults to the\n     *                           shipped interface/clinical-workspace.\n     */\n    public function __construct(?string $directory = null)\n    {\n        $this->directory = $directory ?? dirname(__DIR__, 3) . '/interface/clinical-workspace';\n    }\n\n    /**\n     * Modification time of a supported asset as a decimal string, or '0'\n     * when the file is absent.\n     *\n     * @throws \\InvalidArgumentException when $asset is not a supported name\n     */\n    public function version(string $asset): string\n    {\n        if (!in_array($asset, self::SUPPORTED, true)) {\n            throw new \\InvalidArgumentException('Unsupported clinical workspace asset');\n        }\n\n        $path = $this->directory . '/' . $asset;\n        clearstatcache(true, $path);\n        if (!is_file($path)) {\n            return '0';\n        }\n        $mtime = filemtime($path);\n\n        return $mtime === false ? '0' : sprintf('%d', $mtime);\n    }\n}\n";

const ASSET = 'template-profile-popup.css';
const IMPORT = 'use OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;\n';
const IMPORT_ANCHOR = 'use OpenEMR\\Common\\Acl\\AclMain;\nuse OpenEMR\\Common\\Csrf\\CsrfUtils;\n';
const HEAD_END = '        <?php } ?>\n    </head>';
const LINK = '        <link rel="stylesheet" media="screen" href="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>'
    + '/interface/clinical-workspace/' + ASSET + '?v='
    + "<?php echo attr_url((new ClinicalWorkspaceAssets())->version('" + ASSET + "')); ?>\">\n";
const NAV = "<nav id='disposeProfile' class='navbar navbar-light bg-light sticky-top'>";
const MARKED_NAV = "<nav id='disposeProfile' class='navbar navbar-light bg-light sticky-top oe-template-profile-actions'>";
const ENTRY = "        '" + ASSET + "',\n";
const HELPER_ANCHOR = "        'soap-reference.js',\n        'visit-history.css',\n";

const count = (value, part) => value.split(part).length - 1;
const replaceCount = (value, from, to, expected = 1) => {
    if (count(value, from) !== expected) throw new Error('missing or ambiguous anchor: ' + JSON.stringify(from));
    return value.split(from).join(to);
};
const forwardRoute = value => {
    let next = replaceCount(value, IMPORT_ANCHOR,
        'use OpenEMR\\Common\\Acl\\AclMain;\n' + IMPORT + 'use OpenEMR\\Common\\Csrf\\CsrfUtils;\n');
    next = replaceCount(next, HEAD_END, '        <?php } ?>\n' + LINK + '    </head>');
    return replaceCount(next, NAV, MARKED_NAV);
};
const inverseRoute = value => {
    let next = replaceCount(value, MARKED_NAV, NAV);
    next = replaceCount(next, '        <?php } ?>\n' + LINK + '    </head>', HEAD_END);
    return replaceCount(next,
        'use OpenEMR\\Common\\Acl\\AclMain;\n' + IMPORT + 'use OpenEMR\\Common\\Csrf\\CsrfUtils;\n',
        IMPORT_ANCHOR);
};
const forwardHelper = value => replaceCount(value, HELPER_ANCHOR,
    "        'soap-reference.js',\n" + ENTRY + "        'visit-history.css',\n");
const inverseHelper = value => replaceCount(value,
    "        'soap-reference.js',\n" + ENTRY + "        'visit-history.css',\n", HELPER_ANCHOR);
const FUTURE_ROUTE = forwardRoute(ORIGINAL);
const FUTURE_HELPER = forwardHelper(HELPER_ORIGINAL);
const verifyRoute = value => {
    if (value !== FUTURE_ROUTE || inverseRoute(value) !== ORIGINAL) {
        throw new Error('import_template.php differs outside the three exact additions');
    }
};
const verifyHelper = value => {
    if (value !== FUTURE_HELPER || inverseHelper(value) !== HELPER_ORIGINAL) {
        throw new Error('ClinicalWorkspaceAssets.php differs outside one sorted entry');
    }
};

const SCOPE = 'html.oe-workbench-context .oe-template-profile-actions';
const INK = 'var(--oe-wb-ink, #17343b)';
const PAPER = 'var(--oe-wb-paper, #fff)';
const PETROL = 'var(--oe-wb-petrol, #086878)';
const decl = (prop, value, important = false) => ({ prop, value, important });
const RULES = [
    [SCOPE, [decl('color', INK), decl('background-color', PAPER, true)]],
    [SCOPE + ' button:focus', [decl('outline', '2px solid ' + PETROL), decl('outline-offset', '2px')]],
    [SCOPE + ' button:focus-visible', [decl('outline', '2px solid ' + PETROL), decl('outline-offset', '2px')]],
];
const block = ([selector, declarations]) => '  ' + selector + ' {\n'
    + declarations.map(item => '    ' + item.prop + ': ' + item.value
        + (item.important ? ' !important' : '') + ';\n').join('') + '  }\n';
const FUTURE_CSS = '@media screen {\n' + RULES.map(block).join('\n') + '}\n';
const verifyCss = value => {
    const ast = postcss.parse(value);
    if (ast.nodes.length !== 1) throw new Error('expected exactly one screen media block');
    const media = ast.nodes[0];
    if (media.type !== 'atrule' || media.name !== 'media' || media.params !== 'screen' ||
        !media.nodes || media.nodes.length !== RULES.length) throw new Error('unexpected media or rule count');
    media.nodes.forEach((rule, index) => {
        const [selector, declarations] = RULES[index];
        if (rule.type !== 'rule' || rule.selector !== selector ||
            rule.raws.before !== (index ? '\n\n  ' : '\n  ') ||
            !rule.nodes || rule.nodes.length !== declarations.length) throw new Error('unexpected rule ' + index);
        const found = rule.nodes.map(node => {
            if (node.type !== 'decl' || node.raws.before !== '\n    ') throw new Error('unexpected CSS child');
            return decl(node.prop, node.value, Boolean(node.important));
        });
        if (JSON.stringify(found) !== JSON.stringify(declarations)) throw new Error('unexpected declaration ' + index);
    });
    if (value !== FUTURE_CSS) throw new Error('unexpected CSS bytes');
};
const mutate = (value, from, to) => {
    expect(count(value, from)).toBeGreaterThan(0);
    const changed = value.replace(from, () => to);
    expect(changed).not.toBe(value);
    return changed;
};
const rejectMutants = (expected, candidates, verify) => candidates.forEach(candidate => {
    expect(candidate).not.toBe(expected);
    expect(() => verify(candidate)).toThrow();
});

test('frozen baselines and synthetic forward, inverse, and CSS contracts', () => {
    expect(ORIGINAL.endsWith('<?php }\n')).toBe(true);
    expect(count(ORIGINAL, HEAD_END)).toBe(1);
    expect(count(ORIGINAL, NAV)).toBe(1);
    expect(() => verifyRoute(FUTURE_ROUTE)).not.toThrow();
    expect(() => verifyHelper(FUTURE_HELPER)).not.toThrow();
    expect(() => verifyCss(FUTURE_CSS)).not.toThrow();
    expect(inverseRoute(FUTURE_ROUTE)).toBe(ORIGINAL);
    expect(inverseHelper(FUTURE_HELPER)).toBe(HELPER_ORIGINAL);
    expect(() => verifyRoute(ORIGINAL)).toThrow();
    expect(() => verifyHelper(HELPER_ORIGINAL)).toThrow();
    expect(() => verifyCss('')).toThrow();
});

test('synthetic route touches only the profile head and original action nav', () => {
    const editor = FUTURE_ROUTE.split('function renderProfileHtml(): void')[0];
    const profile = FUTURE_ROUTE.split('function renderProfileHtml(): void')[1];
    expect(editor).toBe(ORIGINAL.split('function renderProfileHtml(): void')[0].replace(
        IMPORT_ANCHOR, 'use OpenEMR\\Common\\Acl\\AclMain;\n' + IMPORT + 'use OpenEMR\\Common\\Csrf\\CsrfUtils;\n'));
    expect(editor).toContain("Header::setupHeader(['summernote']); ?>\n    </head>");
    expect(editor).not.toContain(LINK);
    expect(count(profile, LINK)).toBe(1);
    expect(count(profile, MARKED_NAV)).toBe(1);
    expect(profile.indexOf(LINK)).toBeGreaterThan(profile.indexOf('Sortable.min.js'));
    expect(profile.indexOf(LINK)).toBeGreaterThan(profile.indexOf("Header::setupHeader(['opener', 'sortablejs']);"));
    expect(profile.indexOf(LINK)).toBeGreaterThan(profile.indexOf("Header::setupHeader(['opener']);"));
    expect(profile.indexOf(LINK)).toBeLessThan(profile.indexOf('</head>'));
    expect(count(FUTURE_ROUTE, IMPORT)).toBe(1);
    expect(count(FUTURE_ROUTE, 'oe-template-profile-actions')).toBe(1);
    expect(count(FUTURE_ROUTE, '<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>')).toBe(1);
    expect(LINK).not.toContain('$globalsBag->getWebRoot()');
    expect(count(FUTURE_ROUTE, "attr_url((new ClinicalWorkspaceAssets())->version('" + ASSET + "'))")).toBe(1);
    const entries = [...FUTURE_HELPER.matchAll(/^ {8}'([^']+)',$/gm)].map(match => match[1]);
    expect(entries).toEqual([...entries].sort());
    expect(entries.filter(item => item === ASSET)).toHaveLength(1);
    expect(FUTURE_CSS.match(/!important/g)).toHaveLength(1);
});

test('route and helper reject missing, duplicated, misplaced, unsafe, and original-source edits', () => {
    const routeEdits = [
        [IMPORT, ''], [LINK, ''], [MARKED_NAV, NAV],
        [IMPORT, IMPORT + IMPORT], [LINK, LINK + LINK],
        [MARKED_NAV, MARKED_NAV + MARKED_NAV],
        [MARKED_NAV, MARKED_NAV.replace('oe-template-profile-actions',
            'oe-template-profile-actions oe-template-profile-actions')],
        [LINK, LINK.replace('?v=', '?version=')],
        ["class='navbar navbar-light bg-light sticky-top oe-template-profile-actions'",
            "class='navbar navbar-light oe-template-profile-actions'"],
        ['media="screen"', 'media="print"'],
        ['<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>', '<?php echo OEGlobalsBag::getInstance()->getWebRoot(); ?>'],
        ['<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>', '<?php echo attr($globalsBag->getWebRoot()); ?>'],
        ["attr_url((new ClinicalWorkspaceAssets())->version('" + ASSET + "'))",
            "(new ClinicalWorkspaceAssets())->version('" + ASSET + "')"],
        ["use OpenEMR\\Common\\Acl\\AclMain;\n" + IMPORT,
            IMPORT + "use OpenEMR\\Common\\Acl\\AclMain;\n"],
        ["if (!$authUploadTemplates) {", 'if (false) {'],
        ["CsrfUtils::checkCsrfInput(INPUT_POST, subject: 'import-template-save', dieOnFail: true);", 'true;'],
        ["$templateService = new DocumentTemplateService();", '$templateService = null;'],
        ["$templateService->saveAllProfileTemplates($profiles)", 'true'],
        ["$templateService->fetchDefaultProfiles()", '[]'],
        ["$templateService->fetchDefaultCategories()", '[]'],
        ["$templateService->getTemplateListAllCategories(-1, true)", '[]'],
        ["$templateService->getTemplateListByProfile($profile)", '[]'],
        ["$templateService->fetchTemplateEvent($profile, $template_id)", '[]'],
        ['Sortable.create(repository, {', 'repository.remove();'],
        ['Sortable.create(id, {', 'id.remove();'],
        ["to.el.children[i].getAttribute('data-id') === dragEl.getAttribute('data-id')", 'false'],
        ["data.append('mode', 'save_profiles');", "data.append('mode', 'noop');"],
        ["fetch('./import_template.php', {", "fetch('./elsewhere.php', {"],
        ['top.restoreSession();', ''],
        ['opener.document.edit_form.submit();', ''],
        ['dlgclose();', ''],
        ["name=\"recurring\"", 'name="disabled_recurring"'],
        ["name=\"notify_days\"", 'name="disabled_notify_days"'],
        ["js_escape($profile_list)", '$profile_list'],
        ["<li class='list-group-item bg-warning", "<li class='oe-template-profile-actions list-group-item bg-warning"],
        ["<div class='container-fluid'>", "<div class='container-fluid oe-template-profile-actions'>"],
        ['<?php Header::setupHeader([\'summernote\']); ?>', '<?php Header::setupHeader([]); ?>'],
    ].map(([from, to]) => mutate(FUTURE_ROUTE, from, to));
    routeEdits.push(FUTURE_ROUTE + ' ', FUTURE_ROUTE.slice(0, -1), ' ' + FUTURE_ROUTE);
    const misplaced = mutate(FUTURE_ROUTE, '        <?php } ?>\n' + LINK + '    </head>', HEAD_END);
    routeEdits.push(mutate(misplaced, "<?php Header::setupHeader(['summernote']); ?>\n",
        "<?php Header::setupHeader(['summernote']); ?>\n" + LINK));
    rejectMutants(FUTURE_ROUTE, routeEdits, verifyRoute);
    const helperEdits = [
        [ENTRY, ''], [ENTRY, ENTRY + ENTRY],
        ["        'soap-reference.js',\n" + ENTRY, ENTRY + "        'soap-reference.js',\n"],
        ["throw new \\InvalidArgumentException('Unsupported clinical workspace asset');", "return '0';"],
    ].map(([from, to]) => mutate(FUTURE_HELPER, from, to));
    helperEdits.push(FUTURE_HELPER + ' ');
    rejectMutants(FUTURE_HELPER, helperEdits, verifyHelper);
});

test('strict PostCSS AST rejects scope, geometry, native paint, importance, and combined focus', () => {
    const cssEdits = [
        [SCOPE + ' {', '.oe-template-profile-actions {'],
        [SCOPE + ' {', 'html.oe-workbench-popup .oe-template-profile-actions {'],
        ['color: ' + INK + ';', 'color: red;'],
        ['color: ' + INK + ';', 'color: ' + INK + ' !important;'],
        ['background-color: ' + PAPER + ' !important;', 'background-color: ' + PAPER + ';'],
        ['background-color: ' + PAPER + ' !important;', 'background-color: red !important;'],
        [SCOPE + ' button:focus {', 'button:focus {'],
        [SCOPE + ' button:focus-visible {', SCOPE + ' button:focus, ' + SCOPE + ' button:focus-visible {'],
        ['outline: 2px solid ' + PETROL + ';', 'outline: 2px solid ' + PETROL + ' !important;'],
        ['outline-offset: 2px;', 'outline-offset: 0;'],
        ['@media screen {', '@media print {'],
        ['@media screen {', '@media screen {\n  /* no comments */'],
        ['@media screen {', '@import "workspace.css";\n@media screen {'],
        [block(RULES[2]), block(RULES[2]) + '  body { color: red; }\n'],
        [block(RULES[2]), block(RULES[2]) + '  ' + SCOPE + ' { width: 500px; }\n'],
        [block(RULES[2]), block(RULES[2]) + '  ' + SCOPE + ' { font-size: 2rem; }\n'],
        [block(RULES[2]), block(RULES[2]) + '  ' + SCOPE + ' input { background: red; }\n'],
        [block(RULES[2]), block(RULES[2]) + '  ' + SCOPE + ' button { background: red; }\n'],
        [block(RULES[2]), ''],
        [block(RULES[1]) + '\n' + block(RULES[2]),
            '  ' + SCOPE + ' button:focus, ' + SCOPE + ' button:focus-visible {\n'
            + '    outline: 2px solid ' + PETROL + ';\n    outline-offset: 2px;\n  }\n'],
        ['\n\n  ' + SCOPE + ' button:focus', '\n    ' + SCOPE + ' button:focus'],
    ].map(([from, to]) => mutate(FUTURE_CSS, from, to));
    rejectMutants(FUTURE_CSS, cssEdits, verifyCss);
});

test('caller, workbench context, and original profile workflow stay visible', () => {
    const caller = read('portal/import_template_ui.php');
    for (const anchor of [
        "let url = './import_template.php?mode=render_profile';",
        "dlgopen(url, 'pop-profile', 'modal-lg', 850, '', '', {",
    ]) expect(caller).toContain(anchor);
    const popup = read('interface/clinical-workspace/popup.js');
    expect(popup).toContain("const CONTEXT_CLASS = 'oe-workbench-context';");
    const popupCss = read('interface/clinical-workspace/popup.css');
    for (const token of ['--oe-wb-ink: #17343b;', '--oe-wb-paper: #fff;', '--oe-wb-petrol: #086878;']) {
        expect(popupCss).toContain(token);
    }
    for (const anchor of [
        "AclMain::aclCheckCore('admin', 'forms')",
        "CsrfUtils::checkCsrfInput(INPUT_POST, subject: 'import-template-save', dieOnFail: true);",
        "data.append('mode', 'save_profiles');",
        "name=\"recurring\"", "name=\"notify_days\"",
        'Sortable.create(repository, {', 'Sortable.create(id, {',
        'opener.document.edit_form.submit();',
    ]) expect(ORIGINAL).toContain(anchor);
});

// Hosted RED: these three assertions intentionally fail until production implements the contract.
test('actual route has exactly the three declared additions', () => {
    expect(() => verifyRoute(read('portal/import_template.php'))).not.toThrow();
});
test('actual helper has exactly one sorted supported stylesheet', () => {
    expect(() => verifyHelper(read('src/Common/Assets/ClinicalWorkspaceAssets.php'))).not.toThrow();
});
test('actual stylesheet has exactly three scoped screen rules', () => {
    expect(() => verifyCss(readOptional('interface/clinical-workspace/' + ASSET))).not.toThrow();
});
