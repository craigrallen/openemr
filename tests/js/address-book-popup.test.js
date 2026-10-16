/** @jest-environment jsdom */

/*
 * OPEMR-6: address book entry popup (addrbook_edit.php) as a document-shaped sheet inside an
 * active workbench.
 *
 * Tests-first slice. Before implementation the intended RED is limited to the planned
 * presentation (route additions, helper registration and the new screen sheet). The fixture,
 * inverse, negative-mutation, protected-behaviour, caller and important-allowlist tests pass both
 * before and after implementation. A missing stylesheet fails each CSS test with an ordinary
 * assertion, never an import or file-system crash.
 *
 * These are source/cascade checks only, not native contrast, layout, compiled-theme, PHP route
 * or clinical acceptance. The NPI overlay keeps its inherited hardcoded palette in this slice;
 * see docs/clinical-ui/ADDRESS-BOOK-POPUP.md.
 */

const fs = require('fs');
const path = require('path');
const postcss = require('postcss');

const root = path.join(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const readOptional = file => {
    try {
        return read(file);
    } catch {
        return null;
    }
};

const ROUTE = 'interface/usergroup/addrbook_edit.php';
const FIXTURE = 'tests/clinical-ui/fixtures/address-book-original.txt';
const CSS_FILE = 'interface/clinical-workspace/address-book-popup.css';
const HELPER = 'src/Common/Assets/ClinicalWorkspaceAssets.php';
const LIST_CALLER = 'interface/usergroup/addrbook_list.php';
const LOOKUP = 'interface/usergroup/npi_lookup.php';
const SCOPES = [
    'html.oe-workbench-context body.oe-address-book-popup',
    'html.oe-workbench-popup body.oe-address-book-popup',
];

const source = () => read(ROUTE);
const fixture = () => read(FIXTURE);
const count = (text, part) => text.split(part).length - 1;

// A missing sheet is a plain assertion failure, never a file-system crash.
const requireCss = () => {
    const text = readOptional(CSS_FILE);
    expect({ file: CSS_FILE, present: text !== null }).toEqual({ file: CSS_FILE, present: true });
    return text;
};

const LINK = '<link rel="stylesheet" media="screen" href="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>/interface/clinical-workspace/address-book-popup.css?v=<?php echo attr_url((new ClinicalWorkspaceAssets())->version(\'address-book-popup.css\')); ?>">';

// Every planned route edit as [original, presented]: two imports, one versioned screen link after
// the existing inline style block (so it follows Header setup and the inline rules), a body class
// beside body_top and a class on the existing form. No wrappers, controls or layout changes.
const changes = [
    ['use OpenEMR\\Common\\Acl\\AclMain;\n', 'use OpenEMR\\Common\\Acl\\AclMain;\nuse OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;\n'],
    ['use OpenEMR\\Core\\Header;\n', 'use OpenEMR\\Core\\Header;\nuse OpenEMR\\Core\\OEGlobalsBag;\n'],
    ['\n</style>\n', `\n</style>\n${LINK}\n`],
    ['\n<body class="body_top">\n', '\n<body class="body_top oe-address-book-popup">\n'],
    ['<form method=\'post\' name=\'theform\' id="theform" action=', '<form method=\'post\' name=\'theform\' id="theform" class="oe-address-book-document" action='],
];

// Forward: original -> presented. Returns null when an original anchor is missing or repeated.
const apply = text => {
    let out = text;
    for (const [before, after] of changes) {
        if (count(out, before) !== 1) return null;
        out = out.replace(before, () => after);
    }
    return out;
};

// Exact inverse: presented -> original. Returns null when a planned addition is missing or repeated.
const restore = text => {
    let out = text;
    for (const [before, after] of [...changes].reverse()) {
        if (count(out, after) !== 1) return null;
        out = out.replace(after, () => before);
    }
    return out;
};

// Security, persistence, lookup and handler behaviour the slice must not touch: [anchor, mutation].
const behaviourMutations = [
    // ACL, session and CSRF
    ["if (!AclMain::aclCheckCore('admin', 'practice')) {", 'if (false) {'],
    ['AccessDeniedHelper::denyWithTemplate("ACL check failed for admin/practice: Address Book", xl("Address Book"));', ''],
    ["<?php if (AclMain::aclCheckCore('admin', 'practice')) { // allow choose type option if have admin access ?>", '<?php if (true) { // allow choose type option if have admin access ?>'],
    ['$session = SessionWrapperFactory::getInstance()->getActiveSession();', '$session = null;'],
    ['if (!empty($_POST)) {', 'if (false) {'],
    ['CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: true);', ''],
    ['<input type="hidden" name="csrf_token_form" value="<?php echo CsrfUtils::collectCsrfToken(session: $session); ?>" />', '<input type="hidden" name="csrf_token_form" value="" />'],
    // SQL save/delete and the internal-user guard
    ['$fld = add_escape_custom(trim((string) $_POST[$name]));', '$fld = trim((string) $_POST[$name]);'],
    ["[trim((string) $_POST['form_abook_type'])]", '[]'],
    ['if ($option_abook_type == 3) {', 'if ($option_abook_type == 2) {'],
    ['    if ($userid) {\n        $query = "UPDATE users SET " .', '    if (true) {\n        $query = "UPDATE users SET " .'],
    ['"WHERE id = \'" . add_escape_custom($userid) . "\'";', '"WHERE id = \'" . $userid . "\'";'],
    ['sqlStatement($query);', ''],
    ["if (!empty($_POST['form_save'])) {", 'if (true) {'],
    ["} elseif (!empty($_POST['form_delete'])) {", '} elseif (true) {'],
    ["sqlStatement(\"DELETE FROM users WHERE id = ? AND (username = '' OR username IS NULL)\", [$userid]);", 'sqlStatement("DELETE FROM users WHERE id = ?", [$userid]);'],
    ["<?php if ($userid && (($row['username'] ?? '') === '')) { ?>", '<?php if ($userid) { ?>'],
    ['$row = sqlQuery("SELECT * FROM users WHERE id = ?", [$userid]);', '$row = sqlQuery("SELECT * FROM users WHERE id = \'$userid\'");'],
    // Close, opener refresh and escaping
    ["if (!empty($_POST['form_save']) || !empty($_POST['form_delete'])) {", 'if (false) {'],
    ['echo " alert(" . js_escape($info_msg) . ");\\n";', 'echo " alert(\'" . $info_msg . "\');\\n";'],
    ['echo " window.close();\\n";', ''],
    ['echo " if (opener.refreshme) opener.refreshme();\\n";', ''],
    ['exit();', ''],
    ["js_escape($row_query['option_value'])", "$row_query['option_value']"],
    ["typeSelect(<?php echo js_escape($row['abook_type'] ?? null); ?>);", "typeSelect(<?php echo $row['abook_type'] ?? 'null'; ?>);"],
    ["action='addrbook_edit.php?userid=<?php echo attr_url($userid) ?>'", "action='addrbook_edit.php?userid=<?php echo $userid ?>'"],
    ["id='form_lname' name='form_lname' class='form-control form-control-sm inputtext' maxlength='50' value='<?php echo attr($row['lname'] ?? ''); ?>'", "id='form_lname' name='form_lname' class='form-control form-control-sm inputtext' maxlength='50' value='<?php echo $row['lname'] ?? ''; ?>'"],
    ["<?php echo text($row['notes'] ?? '') ?>", "<?php echo $row['notes'] ?? '' ?>"],
    ['resultsDiv.html(\'<div class="npi-error">\' + jsXlt("Error") + \': \' + jsXlt(error.message) + \'</div>\');', 'resultsDiv.html(\'<div class="npi-error">\' + error.message + \'</div>\');'],
    // NPI lookup fetch, CSRF and parameters
    ['csrf_token: <?php echo js_escape(CsrfUtils::collectCsrfToken(session: $session)); ?>', 'csrf_token: \'\''],
    ["const proxyUrl = 'npi_lookup.php?' + params.toString();", "const proxyUrl = 'https://npiregistry.cms.hhs.gov/api/?' + params.toString();"],
    ['fetch(proxyUrl)', "fetch(proxyUrl, { method: 'POST' })"],
    ['if (!npi && !lastName && !organization) {', 'if (false) {'],
    ["if (lastName) params.append('last_name', lastName + '*');", "if (lastName) params.append('last_name', lastName);"],
    ["params.append('enumeration_type', 'NPI-2');", "params.append('enumeration_type', 'NPI-1');"],
    ["params.append('limit', limit);", ''],
    ["params.append('skip', currentSkip);", ''],
    ['let limit = 200;', 'let limit = 20;'],
    ["$('#form_abook_type').val('external_provider');", ''],
    ["if (!$(e.target).closest('#npi-lookup-results, #btn-npi-lookup').length) {", "if (!$(e.target).closest('#npi-lookup-results').length) {"],
    ['<button type="button" id="btn-npi-lookup" class="btn btn-sm btn-info" onclick="lookupNPI()"', '<button id="btn-npi-lookup" class="btn btn-sm btn-info" onclick="lookupNPI()"'],
    // Type switch and dynamic visibility
    ["if(a=='ord_lab'){", "if(a=='lab'){"],
    ["$('#form_cpoe').prop('checked', false);", ''],
    ['if (type_options_js[a] == 3) {', 'if (type_options_js[a] == 2) {'],
    ['$(".nameRow").hide();', '$(".nameRow").show();'],
    ["generate_select_list('form_abook_type', 'abook_type', ($row['abook_type'] ?? null), '', 'Unassigned', 'form-control-sm', 'typeSelect(this.value)')", "generate_select_list('form_abook_type', 'abook_type', ($row['abook_type'] ?? null), '', 'Unassigned', 'form-control-sm')"],
    ['<span id=\'cpoe_span\' style="display:none;">', "<span id='cpoe_span'>"],
    // NPI overlay presentation, input group and original controls
    ['    position: absolute;\n', '    position: fixed;\n'],
    ['    display: none;\n', '    display: block;\n'],
    ['<div id="npi-lookup-results"></div>', '<div id="npi-lookup-results" class="oe-address-book-overlay"></div>'],
    ['<div class="input-group input-group-sm">', '<div class="input-group">'],
    ["<?php Header::setupHeader(['opener']); ?>", '<?php Header::setupHeader(); ?>'],
    ["<input type='submit' class='btn btn-primary' name='form_save' value='<?php echo xla('Save'); ?>' />", "<input type='button' class='btn btn-primary' name='form_save' value='<?php echo xla('Save'); ?>' />"],
    ["<input type='submit' class='btn btn-danger' name='form_delete' value='<?php echo xla('Delete'); ?>' />", "<input type='submit' class='btn btn-danger' name='form_remove' value='<?php echo xla('Delete'); ?>' />"],
    ["<input type='button' class='btn btn-secondary' value='<?php echo xla('Cancel'); ?>' onclick='window.close()' />", "<input type='button' class='btn btn-secondary' value='<?php echo xla('Cancel'); ?>' />"],
    ['<?php    $use_validate_js = 1;?>', ''],
    ["<?php validateUsingPageRules($_SERVER['PHP_SELF']);?>", ''],
];

// Edits to the planned presentation itself that the exact inverse must reject.
const presentationMutations = [
    ['media="screen"', 'media="all"'],
    ["?v=<?php echo attr_url((new ClinicalWorkspaceAssets())->version('address-book-popup.css')); ?>", ''],
    ['address-book-popup.css?v=', 'workspace.css?v='],
    ['<body class="body_top oe-address-book-popup">', '<body class="oe-address-book-popup">'],
    ['class="oe-address-book-document" ', 'class="oe-address-book-document container" '],
    ['use OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;\n', ''],
    ['use OpenEMR\\Core\\OEGlobalsBag;\n', ''],
];

describe('fixture and exact inverse (pass before and after implementation)', () => {
    test('the fixture is the unmodified 894-line original route', () => {
        const original = fixture();
        expect(original.split('\n').length - 1).toBe(894);
        expect(original.endsWith('</body>\n</html>\n')).toBe(true);
        expect(original).not.toContain('\r');
        expect(original).not.toMatch(/oe-address-book|ClinicalWorkspaceAssets|<link/);
        expect(original).toContain('\n</style>\n\n<script>\n');
        expect(original).toContain('\n<body class="body_top">\n<?php\n');
    });

    test('the route is either the untouched fixture or exactly the planned presentation', () => {
        expect([fixture(), apply(fixture())]).toContain(source());
    });

    test('every planned addition has one original anchor and round-trips exactly', () => {
        const original = fixture();
        for (const [before] of changes) expect([before, count(original, before)]).toEqual([before, 1]);
        const presented = apply(original);
        expect(presented).not.toBeNull();
        for (const [, after] of changes) expect([after, count(presented, after)]).toEqual([after, 1]);
        expect(restore(presented)).toBe(original);
        // Only the two imports and the link add lines; nothing is reordered or removed.
        expect(presented.split('\n').length - original.split('\n').length).toBe(3);
    });

    test('negative controls: every behaviour mutation survives the inverse and is caught', () => {
        const original = fixture();
        const presented = apply(original);
        for (const [from, to] of behaviourMutations) {
            expect([from, count(original, from)]).toEqual([from, 1]);
            expect([from, count(presented, from)]).toEqual([from, 1]);
            expect(restore(presented.replace(from, () => to))).not.toBe(original);
        }
    });

    test('negative controls: changes to the planned presentation break the inverse', () => {
        const original = fixture();
        const presented = apply(original);
        for (const [from, to] of presentationMutations) {
            expect([from, count(presented, from)]).toEqual([from, 1]);
            expect(restore(presented.replace(from, () => to))).not.toBe(original);
        }
        // A stray wrapper, a dropped link, a duplicated link and a link moved ahead of the inline
        // style block are all rejected.
        expect(restore(presented.replace('<div class="form-group">\n', () => '<div class="form-group oe-address-book-notes">\n'))).not.toBe(original);
        expect(restore(presented.replace(`${LINK}\n`, () => ''))).toBeNull();
        expect(restore(presented.replace('</head>', () => `${LINK}\n</head>`))).not.toBe(original);
        const moved = presented.replace(`\n</style>\n${LINK}\n`, () => '\n</style>\n').replace('\n<style>\n', () => `\n${LINK}\n<style>\n`);
        expect(restore(moved)).not.toBe(original);
    });
});

describe('route (intended RED until the planned additions land)', () => {
    test('the route is the original plus exactly the planned additions', () => {
        const php = source();
        expect(php).toBe(apply(fixture()));
        expect(restore(php)).toBe(fixture());
    });

    test('one versioned screen-only sheet follows Header setup and the inline style block', () => {
        const php = source();
        expect(count(php, 'address-book-popup.css')).toBe(2);
        expect(count(php, LINK)).toBe(1);
        expect(count(php, '<link ')).toBe(1);
        expect(php).not.toMatch(/workspace\.css|mode\.js|popup\.js|<link[^>]*media="(all|print)"/);
        const link = php.indexOf(LINK);
        expect(link).toBeGreaterThan(php.indexOf("<?php Header::setupHeader(['opener']); ?>"));
        expect(link).toBeGreaterThan(php.indexOf('</style>'));
        expect(link).toBeLessThan(php.indexOf('<script>'));
        expect(link).toBeLessThan(php.indexOf('</head>'));
        for (const tag of ['<script', '<div', '<input', '<button', '<span', '<label', '<select', '<textarea', '<style']) {
            expect([tag, count(php, tag)]).toEqual([tag, count(fixture(), tag)]);
        }
        expect(php).toContain('\n<body class="body_top oe-address-book-popup">\n');
        expect(php).toContain('<form method=\'post\' name=\'theform\' id="theform" class="oe-address-book-document" action=\'addrbook_edit.php?userid=');
    });

    test('the asset helper registers exactly one new sheet in its strict, sorted list', () => {
        const helper = read(HELPER);
        const block = helper.match(/private const SUPPORTED = \[\n([\s\S]*?)\n\s*\];/);
        expect(block).not.toBeNull();
        const names = block[1].split('\n').map(line => line.trim()).filter(Boolean)
            .map(line => line.match(/^'([a-z0-9.-]+)',$/)?.[1] ?? `UNPARSED:${line}`);
        const base = [
            'ajtooltip.js', 'appointment.css', 'calendar-sidebar.js', 'calendar-workday.css', 'calendar-workday.js',
            'encounter-document.css', 'finder.css', 'global-messages.css', 'history-document.css', 'history-editor.css',
            'issue-popup.css', 'lbf-document.css', 'mode.js', 'patient-messages.css', 'patient-picker-popup.css',
            'patient-results-popup.css', 'patient-search.css', 'soap-document.css', 'soap-document.js',
            'soap-reference.css', 'soap-reference.js', 'visit-history.css', 'visit-history.js', 'workspace.css',
        ];
        expect(names).toEqual([...base, 'address-book-popup.css'].sort());
        expect(new Set(names).size).toBe(names.length);
        // The lookup stays an exact, strict membership test; no pattern or prefix allowance.
        expect(count(helper, "        'address-book-popup.css',\n")).toBe(1);
        expect(helper).toContain("if (!in_array($asset, self::SUPPORTED, true)) {\n            throw new \\InvalidArgumentException('Unsupported clinical workspace asset');\n        }");
        expect(helper).toContain("$this->directory = $directory ?? dirname(__DIR__, 3) . '/interface/clinical-workspace';");
        expect(helper).not.toMatch(/preg_match|fnmatch|str_(starts|ends)_with|str_contains|glob\(|\*\.css/);
    });
});

describe('protected behaviour (pass before and after implementation)', () => {
    test.each([['fixture', fixture], ['route', source]])('%s keeps ACL, CSRF, SQL guards, lookup, type switch and controls', (label, load) => {
        const php = load();
        expect(php).toContain("if (!AclMain::aclCheckCore('admin', 'practice')) {\n    AccessDeniedHelper::denyWithTemplate(\"ACL check failed for admin/practice: Address Book\", xl(\"Address Book\"));\n}");
        expect(count(php, 'AclMain::aclCheckCore(')).toBe(2);
        expect(php).toContain('$session = SessionWrapperFactory::getInstance()->getActiveSession();\nif (!empty($_POST)) {\n    CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: true);\n}');
        expect(count(php, 'CsrfUtils::checkCsrfInput(')).toBe(1);
        expect(count(php, 'CsrfUtils::collectCsrfToken(session: $session)')).toBe(2);
        expect(php).toContain("sqlStatement(\"DELETE FROM users WHERE id = ? AND (username = '' OR username IS NULL)\", [$userid]);");
        expect(count(php, 'DELETE FROM users')).toBe(1);
        expect(php).toContain("<?php if ($userid && (($row['username'] ?? '') === '')) { ?>");
        expect(php).toContain('"WHERE id = \'" . add_escape_custom($userid) . "\'";');
        expect(php).toContain('$fld = add_escape_custom(trim((string) $_POST[$name]));');
        expect(php).toContain('    echo " window.close();\\n";\n    echo " if (opener.refreshme) opener.refreshme();\\n";\n    echo "</script></body></html>\\n";\n    exit();');
        expect(php).toContain("const proxyUrl = 'npi_lookup.php?' + params.toString();");
        expect(count(php, 'fetch(')).toBe(1);
        expect(php).toContain('csrf_token: <?php echo js_escape(CsrfUtils::collectCsrfToken(session: $session)); ?>');
        expect(php).toContain('if (type_options_js[a] == 3) {');
        expect(php).toContain("'form-control-sm', 'typeSelect(this.value)')");
        expect(php).toContain('<div id="npi-lookup-results"></div>');
        expect(php).toContain('<div class="input-group input-group-sm">');
        expect(php).toContain("<input type='submit' class='btn btn-primary' name='form_save' value='<?php echo xla('Save'); ?>' />");
        expect(php).toContain("<input type='submit' class='btn btn-danger' name='form_delete' value='<?php echo xla('Delete'); ?>' />");
        expect(php).toContain("<input type='button' class='btn btn-secondary' value='<?php echo xla('Cancel'); ?>' onclick='window.close()' />");
        expect(php).toContain("<?php validateUsingPageRules($_SERVER['PHP_SELF']);?>");
        expect(count(php, '<form')).toBe(1);
        expect(count(php, '<body')).toBe(1);
        expect(label).toBeTruthy();
    });

    test('the PHP prologue, inline style, head script and save/delete handler are byte-identical', () => {
        const between = (text, from, to) => {
            const start = text.indexOf(from);
            const end = text.indexOf(to, start);
            expect([from, start >= 0 && end > start]).toEqual([from, true]);
            return text.slice(start, end);
        };
        const slices = [
            ['$session = SessionWrapperFactory', '?>\n<html>'],
            ['<style>\n', '</style>\n'],
            ['<script>\n\n var type_options_js', '</script>\n\n</head>'],
            ["if (!empty($_POST['form_save'])) {", '<form method'],
            ['<input type="hidden" name="csrf_token_form"', '</html>\n'],
        ];
        for (const [from, to] of slices) {
            expect(between(source(), from, to)).toBe(between(fixture(), from, to));
        }
        expect(between(fixture(), '$session = SessionWrapperFactory', '?>\n<html>').length).toBeGreaterThan(400);
    });

    test('the untouched list caller still opens the editor and refreshes on close', () => {
        const php = read(LIST_CALLER);
        expect(php).toContain("if (!AclMain::aclCheckCore('admin', 'practice')) {");
        expect(php).toContain('function refreshme() {\n // location.reload();\n document.forms[0].submit();\n}');
        expect(php).toContain(" let url = 'addrbook_edit.php?type=' + encodeURIComponent(type);");
        expect(php).toContain(" dlgopen(url, '_blank', 650, (screen.availHeight * 75/100));");
        expect(php).toContain(" dlgopen('addrbook_edit.php?userid=' + encodeURIComponent(userid), '_blank', 650, (screen.availHeight * 75/100));");
        expect(php).not.toMatch(/address-book-popup|oe-address-book/);
    });

    test('the untouched NPI proxy keeps its ACL, GET CSRF check, parameter allowlist and cap', () => {
        const php = read(LOOKUP);
        expect(php).toContain("if (!AclMain::aclCheckCore('admin', 'practice')) {\n    AccessDeniedHelper::deny('Unauthorized access to NPI lookup', format: AccessDeniedResponseFormat::Json);\n}");
        expect(php).toContain("!CsrfUtils::verifyCsrfToken($_GET['csrf_token'] ?? '', session: $session)");
        for (const param of ['number', 'enumeration_type', 'first_name', 'last_name', 'organization_name', 'limit', 'skip']) {
            expect(php).toMatch(new RegExp(`\\$allowedParams = \\[[^\\]]*'${param}'`));
        }
        expect(php).toContain("$queryParams['limit'] = '200';");
        expect(php).toContain("$apiUrl = 'https://npiregistry.cms.hhs.gov/api/';");
        expect(php).not.toMatch(/address-book-popup|oe-address-book|ClinicalWorkspaceAssets/);
    });
});

// ---------------------------------------------------------------------------------------------
// Stylesheet: intended RED until address-book-popup.css exists.
// ---------------------------------------------------------------------------------------------

// Palette tokens as popup.css declares them under html.oe-workbench-context.
const tokens = () => {
    const map = {};
    postcss.parse(read('interface/clinical-workspace/popup.css')).walkRules(rule => {
        if (!rule.selectors.includes('html.oe-workbench-context')) return;
        rule.walkDecls(decl => { if (decl.prop.startsWith('--oe-wb-')) map[decl.prop] = decl.value; });
    });
    return map;
};

const rules = text => {
    const out = [];
    postcss.parse(text).walkRules(rule => {
        const decls = {};
        rule.walkDecls(decl => { decls[decl.prop] = `${decl.value}${decl.important ? ' !important' : ''}`; });
        out.push({ selectors: rule.selectors, decls });
    });
    return out;
};
const scopeOf = selector => SCOPES.find(scope => selector === scope || selector.startsWith(`${scope} `));
const restOf = selector => selector.slice(scopeOf(selector).length);
const token = (map, name) => `var(${name}, ${map[name]})`;
const plain = value => (value ?? '').replace(/ !important$/, '');

// What a scoped selector paints. Anything outside these four targets is an unplanned override.
const kindOf = rest => {
    if (rest === '') return 'canvas';
    if (/^ (form)?\.oe-address-book-document$/.test(rest)) return 'document';
    if (/\.btn\b/.test(rest)) return /:focus(-visible)?$/.test(rest) ? 'button' : 'other';
    if (/\.form-control\b/.test(rest)) {
        if (/:disabled|\[disabled\]/.test(rest)) return 'field-disabled';
        if (/\[readonly\]|:read-only/.test(rest)) return 'field-readonly';
        if (/:focus/.test(rest)) return 'field-focus';
        return 'field';
    }
    return 'other';
};

const ALLOWED_PROPS = {
    canvas: ['color', 'background-color'],
    document: ['color', 'background-color'],
    field: ['color', 'background-color', 'border-color'],
    'field-focus': ['color', 'background-color', 'border-color', 'box-shadow'],
    'field-disabled': ['color', 'background-color', 'border-color'],
    'field-readonly': ['color', 'background-color', 'border-color'],
    button: ['outline', 'outline-offset'],
};

// Declaration-level !important allowlist: only color and background-color on the scoped body
// itself (to meet the theme's body_top), and only as a pair.
const importantViolations = text => {
    const out = [];
    postcss.parse(text).walkRules(rule => {
        const important = rule.nodes.filter(node => node.type === 'decl' && node.important);
        if (important.length === 0) return;
        const bodyOnly = rule.selectors.every(s => scopeOf(s) && restOf(s) === '');
        for (const decl of important) {
            if (!bodyOnly || !['color', 'background-color'].includes(decl.prop)) out.push(`${rule.selector} { ${decl.prop} }`);
        }
        const props = important.map(decl => decl.prop);
        if (props.includes('color') !== props.includes('background-color')) out.push(`${rule.selector} unpaired`);
    });
    return out;
};

describe('important allowlist checker (pass before and after implementation)', () => {
    const [ctx, pop] = SCOPES;
    test('accepts paired body ink and canvas, or no important at all', () => {
        expect(importantViolations(`@media screen { ${ctx}, ${pop} { color: a !important; background-color: b !important; } }`)).toEqual([]);
        expect(importantViolations(`@media screen { ${ctx} .form-control { color: a; background-color: b; } }`)).toEqual([]);
    });

    test.each([
        ['unpaired body ink', `${ctx} { color: a !important; background-color: b; }`],
        ['unpaired body canvas', `${ctx} { color: a; background-color: b !important; }`],
        ['a field', `${ctx} .form-control { color: a !important; background-color: b !important; }`],
        ['the document', `${ctx} .oe-address-book-document { color: a !important; background-color: b !important; }`],
        ['a geometry property on the body', `${ctx} { color: a !important; background-color: b !important; display: block !important; }`],
        ['an unscoped body', 'body.oe-address-book-popup { color: a !important; background-color: b !important; }'],
        ['a body grouped with a descendant', `${ctx}, ${ctx} .btn:focus { color: a !important; background-color: b !important; }`],
    ])('rejects important on %s', (label, css) => {
        expect(importantViolations(`@media screen { ${css} }`).length).toBeGreaterThan(0);
        expect(label).toBeTruthy();
    });
});

describe('address-book-popup.css (intended RED until the sheet exists)', () => {
    test('one top-level screen block; no print, import, font face, nested query or custom properties', () => {
        const tree = postcss.parse(requireCss());
        expect(tree.nodes.filter(node => node.type !== 'comment')).toHaveLength(1);
        const at = [];
        tree.walkAtRules(rule => at.push(`${rule.name} ${rule.params}`));
        expect(at).toEqual(['media screen']);
        tree.walkDecls(decl => expect(decl.prop.startsWith('--')).toBe(false));
    });

    test('every selector is scoped to an active workbench and the route body, in mirrored pairs', () => {
        const all = rules(requireCss());
        expect(all.length).toBeGreaterThanOrEqual(6);
        for (const { selectors } of all) {
            for (const selector of selectors) expect([selector, Boolean(scopeOf(selector))]).toEqual([selector, true]);
            const rests = scope => selectors.filter(s => scopeOf(s) === scope).map(restOf).sort();
            expect(rests(SCOPES[0])).toEqual(rests(SCOPES[1]));
        }
    });

    test('only body, document, fields and button focus are painted, with planned properties only', () => {
        for (const { selectors, decls } of rules(requireCss())) {
            for (const selector of selectors) {
                const rest = restOf(selector);
                const kind = kindOf(rest);
                expect([selector, kind]).not.toEqual([selector, 'other']);
                expect(rest).not.toMatch(/npi|\[style|\.is-(in)?valid(?!\))|was-validated|-feedback|\.input-group|nameRow|specialtyRow|nameDirectorRow|cpoe|\.btn-(primary|secondary|danger|info|sm)|\.alert|\.text-|\.bg-|label|\*|\bh6\b|:not\(:focus-visible\)/);
                for (const prop of Object.keys(decls)) expect([selector, prop, ALLOWED_PROPS[kind].includes(prop)]).toEqual([selector, prop, true]);
            }
        }
    });

    test('important appears only as the paired body declarations', () => {
        expect(importantViolations(requireCss())).toEqual([]);
    });

    test('canvas, document and every field state carry paired ink and paper from the existing tokens', () => {
        const all = rules(requireCss());
        const map = tokens();
        const expected = {
            canvas: ['--oe-wb-ink', '--oe-wb-canvas'],
            document: ['--oe-wb-ink', '--oe-wb-paper'],
            field: ['--oe-wb-ink', '--oe-wb-paper'],
            'field-focus': ['--oe-wb-ink', '--oe-wb-paper'],
            'field-disabled': ['--oe-wb-disabled-ink', '--oe-wb-disabled-paper'],
            'field-readonly': ['--oe-wb-disabled-ink', '--oe-wb-disabled-paper'],
        };
        const seen = new Set();
        for (const { selectors, decls } of all) {
            expect('color' in decls).toBe('background-color' in decls);
            for (const selector of selectors) {
                const kind = kindOf(restOf(selector));
                if (!(kind in expected)) continue;
                seen.add(kind);
                const [ink, paper] = expected[kind];
                expect([selector, plain(decls.color), plain(decls['background-color'])])
                    .toEqual([selector, token(map, ink), token(map, paper)]);
            }
        }
        expect([...seen].sort()).toEqual(Object.keys(expected).sort());
    });

    test('palette comes from the existing tokens with matching literal fallbacks', () => {
        const text = requireCss();
        const map = tokens();
        const uses = [...text.matchAll(/var\(\s*(--[\w-]+)\s*(?:,\s*([^)]*?)\s*)?\)/g)];
        expect(uses.length).toBeGreaterThan(0);
        for (const [, name, fallback] of uses) {
            expect(Object.keys(map)).toContain(name);
            expect(fallback).toBe(map[name]);
        }
        const withoutVars = text.replace(/var\([^)]*\)/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
        expect(withoutVars).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|\b(red|purple|green|white|black|blue|gray|grey)\b/i);
    });

    test(':focus and :focus-visible button outlines are separate rules and never removed', () => {
        const text = requireCss();
        const map = tokens();
        const all = rules(text);
        const isButton = s => scopeOf(s) && kindOf(restOf(s)) === 'button';
        const focus = all.filter(r => r.selectors.some(s => isButton(s) && s.endsWith(':focus')));
        const visible = all.filter(r => r.selectors.some(s => isButton(s) && s.endsWith(':focus-visible')));
        expect(focus).toHaveLength(1);
        expect(visible).toHaveLength(1);
        expect(focus[0].selectors.every(s => s.endsWith(':focus'))).toBe(true);
        expect(visible[0].selectors.every(s => s.endsWith(':focus-visible'))).toBe(true);
        const petrol = token(map, '--oe-wb-petrol').replace(/[()]/g, '\\$&');
        for (const rule of [focus[0], visible[0]]) {
            expect(rule.decls.outline).toMatch(new RegExp(`^\\d+px solid ${petrol}$`));
            expect(rule.decls['outline-offset']).toBeDefined();
        }
        expect(text).not.toMatch(/outline:\s*(none|0)\b|outline-width:\s*0/);
    });
});

// Scoping in jsdom. Not a native cascade or contrast test.
describe('source scoping in jsdom (intended RED until the sheet exists)', () => {
    // Focus pseudo-classes are stripped so the static element can be tested against the rule.
    const matching = element => rules(requireCss()).flatMap(r => r.selectors)
        .map(s => s.replace(/:focus(-visible)?(?![\w-])/g, ''))
        .filter(s => { try { return element.matches(s); } catch { return false; } });

    const mount = (htmlClass, bodyClass = 'body_top oe-address-book-popup') => {
        document.documentElement.className = htmlClass;
        document.body.className = bodyClass;
        document.body.innerHTML = `<form method="post" name="theform" id="theform" class="oe-address-book-document" action="addrbook_edit.php?userid=7">
<input type="hidden" name="csrf_token_form" value="t" />
<div id="npi-lookup-results"><div class="npi-result-item"><h6>Ada</h6><div class="text-muted">NPI</div></div><div class="npi-error">Error</div></div>
<div class="form-row nameRow my-1"><div class="col-auto"><label for="form_lname" class="font-weight-bold col-form-label col-form-label-sm">Last</label></div>
<div class="col-auto"><input type="text" id="form_lname" class="form-control form-control-sm inputtext" /></div></div>
<select id="form_abook_type" name="form_abook_type" class="form-control form-control-sm"><option>x</option></select>
<input type="text" id="disabled" class="form-control form-control-sm" disabled />
<input type="text" id="readonly" class="form-control form-control-sm" readonly />
<input type="text" id="invalid" class="form-control form-control-sm is-invalid" />
<input type="text" id="valid" class="form-control form-control-sm is-valid" />
<input type="text" id="invalid-disabled" class="form-control is-invalid" disabled />
<input type="text" id="valid-readonly" class="form-control is-valid" readonly />
<span id="cpoe_span" style="display:none;"><input type="checkbox" id="form_cpoe" /></span>
<div class="input-group input-group-sm"><input type="text" id="form_npi" class="form-control form-control-sm inputtext" />
<div class="input-group-append"><button type="button" id="btn-npi-lookup" class="btn btn-sm btn-info">Lookup</button></div></div>
<textarea id="form_notes" class="form-control inputtext w-100"></textarea>
<input type="submit" id="save" class="btn btn-primary" name="form_save" value="Save" />
<input type="submit" id="delete" class="btn btn-danger" name="form_delete" value="Delete" />
<input type="button" id="cancel" class="btn btn-secondary" value="Cancel" onclick="window.close()" />
</form>`;
    };
    const $ = selector => document.querySelector(selector);

    afterEach(() => {
        document.documentElement.className = '';
        document.body.className = '';
        document.body.innerHTML = '';
    });

    test.each([['active workbench context', 'oe-workbench-context'], ['workbench popup', 'oe-workbench-popup']])('%s: body, document, field states and button focus are styled', (label, htmlClass) => {
        mount(htmlClass);
        expect(matching(document.body).length).toBeGreaterThan(0);
        expect(matching($('#theform')).length).toBeGreaterThan(0);
        for (const id of ['#form_lname', '#form_abook_type', '#form_npi', '#form_notes']) {
            expect([id, matching($(id)).length > 0]).toEqual([id, true]);
        }
        expect(matching($('#disabled')).some(s => /:disabled|\[disabled\]/.test(s))).toBe(true);
        expect(matching($('#readonly')).some(s => /\[readonly\]|:read-only/.test(s))).toBe(true);
        for (const id of ['#save', '#delete', '#cancel', '#btn-npi-lookup']) {
            expect([id, matching($(id)).length > 0]).toEqual([id, true]);
        }
        expect(label).toBeTruthy();
    });

    test.each([['active workbench context', 'oe-workbench-context'], ['workbench popup', 'oe-workbench-popup']])('%s: validation states, NPI overlay, type rows and input group are untouched', (label, htmlClass) => {
        mount(htmlClass);
        for (const id of ['#invalid', '#valid', '#invalid-disabled', '#valid-readonly']) {
            expect([id, matching($(id))]).toEqual([id, []]);
        }
        const untouched = ['#npi-lookup-results', '.npi-result-item', '.npi-result-item h6', '.npi-error', '.nameRow', 'label',
            '#cpoe_span', '#form_cpoe', '.input-group', '.input-group-append'];
        for (const selector of untouched) {
            for (const element of document.querySelectorAll(selector)) expect([selector, matching(element)]).toEqual([selector, []]);
        }
        expect($('#save').getAttribute('type')).toBe('submit');
        expect($('#save').className).toBe('btn btn-primary');
        expect($('#delete').className).toBe('btn btn-danger');
        expect($('#cancel').className).toBe('btn btn-secondary');
        expect($('#btn-npi-lookup').className).toBe('btn btn-sm btn-info');
        expect(label).toBeTruthy();
    });

    test.each([
        ['legacy direct page', '', 'body_top oe-address-book-popup'],
        ['unrelated html class', 'oe-unrelated-shell', 'body_top oe-address-book-popup'],
        ['another workbench popup body', 'oe-workbench-popup', 'body_top'],
    ])('%s: the sheet is inert', (label, htmlClass, bodyClass) => {
        mount(htmlClass, bodyClass);
        for (const element of [document.body, ...document.body.querySelectorAll('*')]) {
            expect(matching(element)).toEqual([]);
        }
        expect(label).toBeTruthy();
    });
});
