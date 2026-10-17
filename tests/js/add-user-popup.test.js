/** @jest-environment node */

// OPEMR-19: Add User popup (interface/usergroup/usergroup_admin_add.php).
//
// Source-only contract. These tests read files as text; they never execute PHP,
// globals.php, Header::setupHeader(), dialog.js or the usergroup_admin.php backend,
// and they establish neither security clearance nor effective contrast. The CSRF,
// ACL, admin/super, password, LDAP, validation, eRx, event, SQL and caller anchors
// below are read-only source pins, not an authorization audit. The body canvas and
// document paper rules are source rules, not native effective-cascade claims: .text
// also sits on <td> cells that contain form controls, so those controls may inherit
// the ink fallback, and markup injected through UserEditRenderEvent may inherit ink
// too. Acceptance of the mandatory markers, password strength meter, native fields,
// buttons and module-injected content stays open and is not proven here.
//
// The original route's quirks are deliberately preserved: the 600px field table with
// 120px inline widths, both new_group forms, the unclosed <tr> before the NPI row and
// the trailing empty <table> inside the single container stay byte identical.
// Backgrounds are pinned as the background-color longhand; the background shorthand
// is rejected so no image, position or repeat is reset.

const fs = require('fs');
const path = require('path');
const postcss = require('postcss');

const root = path.join(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
// An absent production file reads as empty so contract assertions fail, not the harness.
const readOptional = file => {
    try {
        return read(file);
    } catch (error) {
        if (error.code === 'ENOENT') return '';
        throw error;
    }
};

const ROUTE = 'interface/usergroup/usergroup_admin_add.php';
const CALLER = 'interface/usergroup/usergroup_admin.php';
const STYLESHEET = 'interface/clinical-workspace/add-user-popup.css';
const HELPER = 'src/Common/Assets/ClinicalWorkspaceAssets.php';
const FIXTURE = 'tests/clinical-ui/fixtures/add-user-popup-original.txt';
const BASENAME = 'add-user-popup.css';
const SCREEN_HOOK = 'oe-add-user-screen';
const DOCUMENT_HOOK = 'oe-add-user-document';
const CONTEXT = 'html.oe-workbench-context';

const original = () => read(FIXTURE);
const count = (text, part) => text.split(part).length - 1;

// Builds a mutant; a missing or ambiguous anchor, or a no-op, is a construction error.
const mutate = (text, from, to) => {
    if (from === to) throw new Error(`mutation does not change its anchor: ${from}`);
    if (count(text, from) !== 1) throw new Error(`mutation anchor must occur exactly once: ${from}`);
    const out = text.replace(from, () => to);
    if (out === text) throw new Error(`mutation left input unchanged: ${from}`);
    return out;
};
const mutateAll = (text, from, to) => {
    if (from === to || count(text, from) < 1) throw new Error(`mutation anchor missing: ${from}`);
    const out = text.split(from).join(to);
    if (out === text) throw new Error(`mutation left input unchanged: ${from}`);
    return out;
};
// Every mutant set must be built before assertions, differ from its base and be unique.
const expectDistinctMutants = (mutants, base) => {
    expect(mutants.length).toBeGreaterThan(0);
    for (const mutant of mutants) expect(mutant).not.toBe(base);
    expect(new Set(mutants).size).toBe(mutants.length);
};

// ---------------------------------------------------------------- route

const LINK = `<link rel="stylesheet" media="screen" href="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>/interface/clinical-workspace/${BASENAME}?v=<?php echo attr_url((new ClinicalWorkspaceAssets())->version('${BASENAME}')); ?>">`;
const ASSETS_IMPORT = 'use OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;';
const IMPORTS = [
    'use OpenEMR\\Common\\Acl\\AccessDeniedHelper;',
    'use OpenEMR\\Common\\Acl\\AclExtended;',
    'use OpenEMR\\Common\\Acl\\AclMain;',
    ASSETS_IMPORT,
    'use OpenEMR\\Common\\Csrf\\CsrfUtils;',
    'use OpenEMR\\Common\\Session\\SessionWrapperFactory;',
    'use OpenEMR\\Core\\Header;',
    'use OpenEMR\\Core\\OEGlobalsBag;',
    'use OpenEMR\\Events\\User\\UserEditRenderEvent;',
    'use OpenEMR\\Menu\\MainMenuRole;',
    'use OpenEMR\\Menu\\PatientMenuRole;',
    'use OpenEMR\\Services\\FacilityService;',
    'use OpenEMR\\Services\\UserService;',
];
const ACL_MAIN = 'use OpenEMR\\Common\\Acl\\AclMain;\n';
const CSRF = 'use OpenEMR\\Common\\Csrf\\CsrfUtils;\n';
const HEADER_CALL = "<?php Header::setupHeader(['common','opener', 'erx']); ?>\n";
const BODY = '<body class="body_top">\n';
const HOOKED_BODY = `<body class="body_top ${SCREEN_HOOK}">\n`;
// The single container is the one directly followed by the Save/Cancel title table.
const CONTAINER = '<div class="container">\n\n<table><tr><td>\n';
const HOOKED_CONTAINER = `<div class="container ${DOCUMENT_HOOK}">\n\n<table><tr><td>\n`;
// The original ends with an empty table, then closes the container, body and html.
const TRAILING = '<table>\n\n</table>\n\n</div>\n\n</body>\n</html>\n';

// The four permitted route additions as [original, presented].
const ROUTE_EDITS = [
    [`${ACL_MAIN}${CSRF}`, `${ACL_MAIN}${ASSETS_IMPORT}\n${CSRF}`],
    [HEADER_CALL, `${HEADER_CALL}${LINK}\n`],
    [BODY, HOOKED_BODY],
    [CONTAINER, HOOKED_CONTAINER],
];

const applyRouteEdits = text => ROUTE_EDITS.reduce((out, [before, after]) => mutate(out, before, after), text);
// Undo the permitted additions; null when any addition is missing or ambiguous.
const restoreRoute = text => {
    let restored = text;
    for (const [before, after] of ROUTE_EDITS) {
        if (count(restored, after) !== 1) return null;
        restored = restored.replace(after, () => before);
    }
    return restored;
};

const routeViolations = php => {
    const violations = [];
    // Complete source preservation: undoing the four permitted additions must give back the
    // frozen original byte for byte, which also catches wrappers and any other change to it.
    if (restoreRoute(php) !== original()) violations.push('only the four permitted additions may differ from the original route byte for byte');
    if (count(php, LINK) !== 1) violations.push('escaped versioned screen link must appear exactly once');
    if (count(php, BASENAME) !== 2) violations.push('basename must appear only in the link href and version()');
    if (count(php, '<link') !== 1) violations.push('exactly one <link> may be added');
    // The original keeps a blank line between the Header call and the validation script.
    if (count(php, `${HEADER_CALL}${LINK}\n\n<script src="checkpwd_validation.js`) !== 1) {
        violations.push('link must directly follow Header::setupHeader() before the original blank line');
    }
    const uses = php.match(/^use [^;\n]+;$/gm) || [];
    if (JSON.stringify(uses) !== JSON.stringify(IMPORTS)) violations.push('imports must be the original set plus ClinicalWorkspaceAssets');
    if (JSON.stringify(uses) !== JSON.stringify([...uses].sort())) violations.push('imports must be sorted');
    if (count(php, HOOKED_BODY) !== 1) violations.push('screen hook must be appended to the original body_top body');
    if (count(php, SCREEN_HOOK) !== 1 || count(php, '<body') !== 1) violations.push('screen hook must appear only on the one body');
    if (count(php, HOOKED_CONTAINER) !== 1) violations.push('document hook must be appended to the single container');
    if (count(php, DOCUMENT_HOOK) !== 1 || count(php, '<div class="container') !== 1) {
        violations.push('document hook must appear only on the single container');
    }
    if (count(php, TRAILING) !== 1 || !php.endsWith(TRAILING)) violations.push('trailing empty table and closing markup must stay byte identical');
    if (count(php, '<style') !== 1 || count(php, '<script') !== 3) violations.push('no style or script blocks may be added');
    return violations;
};

// Security, control, form and geometry anchors, each exactly once, verbatim from the original.
const SECURITY_ANCHORS = [
    "if (!AclMain::aclCheckCore('admin', 'users')) {\n    AccessDeniedHelper::denyWithTemplate(\"ACL check failed for admin/users: Add User\", xl(\"Add User\"));\n}\n",
    '$session = SessionWrapperFactory::getInstance()->getActiveSession();\n',
    HEADER_CALL,
    `<script src="checkpwd_validation.js?v=<?php echo attr_url(OEGlobalsBag::getInstance()->getString('v_js_includes')); ?>"></script>\n`,
    '$collectthis = collectValidationPageRules("/interface/usergroup/usergroup_admin_add.php");\n',
    "    var valid = submitme(1, undefined, 'new_user', collectvalidation);\n",
    '   top.restoreSession();\n',
    '    if(document.new_user.secure_pwd.value == 1){\n',
    '            var pwdresult = passwordvalidate(password);\n',
    "    <?php if (OEGlobalsBag::getInstance()->getBoolean('erx_enable')) { ?>\n",
    "    $.ajax({\n        url: post_url,\n        type: request_method,\n        data: form_data\n    }).done(function (r) {\n        if (r) {\n            alert(r);\n        } else {\n            dlgclose('reload', false);\n        }\n    }).fail(function (xhr, status, error) {\n        alert(<?php echo xlj('Error creating user'); ?> + ': ' + status);\n    });\n",
    'function authorized_clicked() {\n     var f = document.forms[0];\n     f.calendar.disabled = !f.authorized.checked;\n     f.calendar.checked  =  f.authorized.checked;\n}\n',
    '<style>\n  .physician_type_class {\n    width: 120px !important;\n  }\n  #main_menu_role {\n    width: 120px !important;\n  }\n</style>\n',
    `<a class="btn btn-secondary btn-save" name='form_save' id='form_save' href='#' onclick="return submitform()">\n`,
    "<a class=\"btn btn-link btn-cancel\" id='cancel' href='#'>\n",
    `<form name='new_user' id="new_user" method='post' action="usergroup_admin.php">\n<input type="hidden" name="csrf_token_form" value="<?php echo CsrfUtils::collectCsrfToken(session: $session); ?>" />\n\n<input type='hidden' name='mode' value='new_user'>\n<input type='hidden' name='secure_pwd' value="<?php echo attr((int) OEGlobalsBag::getInstance()->getBoolean('secure_password')); ?>">\n`,
    `<table class="border-0" cellpadding='0' cellspacing='0' style="width:600px;">\n`,
    "        $preRenderEvent = new UserEditRenderEvent('usergroup_admin_add');\n        OEGlobalsBag::getInstance()->getKernel()->getEventDispatcher()->dispatch($preRenderEvent, UserEditRenderEvent::EVENT_USER_EDIT_RENDER_BEFORE);\n",
    "            $preRenderEvent = new UserEditRenderEvent('usergroup_admin_add.php');\n            OEGlobalsBag::getInstance()->getKernel()->getEventDispatcher()->dispatch($preRenderEvent, UserEditRenderEvent::EVENT_USER_EDIT_RENDER_AFTER);\n",
    '<input type="text" name="rumple" style="width:120px;" class="form-control"><span class="mandatory"></span>',
    "<?php if (!OEGlobalsBag::getInstance()->getBoolean('gbl_ldap_enabled') || empty(OEGlobalsBag::getInstance()->getString('gbl_ldap_exclusions'))) { ?>\n",
    '    <input type="password" style="width:120px;" name="stiltskin" id="stiltskin" class="form-control" onkeyup="checkPasswordStrength(this);">\n',
    '    <div id="password_strength_meter" class="progress mt-2">\n',
    '        <td><input type="hidden" value="124" name="stiltskin" /></td>\n',
    `    <td class='text' style="width:280px;"><input type='password' name=adminPass style="width:120px;"  value="" autocomplete='off' class="form-control"><font class="mandatory"></font></td>\n`,
    "<input type='checkbox' name='authorized' value='1' onclick='authorized_clicked()' />\n",
    "<input type='checkbox' name='calendar' disabled /></span>\n",
    `    echo " <option value='" . attr($key) . "'";\n`,
    `</select></td>\n\n<tr>\n<td><span class="text"><?php echo xlt('NPI'); ?>: </span>`,
    '    $menuMain = new MainMenuRole(OEGlobalsBag::getInstance()->getKernel()->getEventDispatcher());\n',
    '    $menuPatient = new PatientMenuRole();\n    echo $menuPatient->displayMenuRoleSelector();\n',
    `    <?php echo generate_select_list("erxrole", "newcrop_erx_role", '', '', '--Select Role--', '', '', '', ['style' => 'width:120px']); ?>\n`,
    '   <select name="schedule_facility[]" multiple style="width:490px;">\n',
    `                    "list_id = ? AND option_value = ? ORDER BY seq, title",\n                    ['warehouse', $frow['id']]\n`,
    ' <td><select name="access_group[]" multiple style="width:120px;" class="form-control">\n',
    "$is_super_user = AclMain::aclCheckCore('admin', 'super');\n$list_acl_groups = AclExtended::aclGetGroupTitleList($is_super_user);\n",
    `<form name='new_group' method='post' action="usergroup_admin.php"\n onsubmit='return top.restoreSession()'>\n<input type="hidden" name="csrf_token_form" value="<?php echo CsrfUtils::collectCsrfToken(session: $session); ?>" />\n<br />\n<input type='hidden' name='mode' value='new_group' />\n<span class="bold"><?php echo xlt('New Group'); ?>:</span>\n`,
    `<input type="hidden" name="csrf_token_form" value="<?php echo CsrfUtils::collectCsrfToken(session: $session); ?>" />\n<input type='hidden' name='mode' value='new_group' />\n<span class="bold"><?php echo xlt('Add User To Group'); ?>:</span>\n`,
    'if (!OEGlobalsBag::getInstance()->getBoolean(\'disable_non_default_groups\')) {\n    $res = sqlStatement("select * from `groups` order by name");\n',
    `        attr_url($iter["id"]) . "&csrf_token_form=" . CsrfUtils::collectCsrfToken(session: $session) . "' onclick='top.restoreSession()'>" . xlt("Remove") . "</a>), ";\n`,
    '        text(substr($list, 0, strlen($list) - 2)) . "</span><br />\\n";\n',
    `    echo "alert('" . js_escape($alertmsg) . "');\\n";\n`,
    '    $("#cancel").click(function() {\n          dlgclose();\n     });\n',
    TRAILING,
];
// Token counts that must match the original once the single permitted link is set aside.
const STABLE_TOKENS = [
    'style="width:', 'class="mandatory"', 'dlgclose(', 'aclCheckCore(', 'CsrfUtils::', 'csrf_token_form',
    'sqlStatement(', "type='password'", 'type="password"', 'xlt(', 'xla(', 'xlj(', 'attr(', 'attr_url(', 'text(',
    '<form', '<input', '<select', '<table', '</table>', '<tr', '<div', '</div>', 'class="text"', "class='text'",
    'class=text', 'class="title"', '!important', 'opener', 'restoreSession', 'new_user', 'new_group',
    'stiltskin', 'adminPass', 'access_group', 'erx', '$_GET', '$_POST', 'dispatch(',
];

const securityViolations = php => {
    const violations = [];
    const fixture = original();
    const withoutLink = php.split(`${LINK}\n`).join('');
    for (const anchor of SECURITY_ANCHORS) {
        if (count(php, anchor) !== 1) violations.push(`anchor must stay unchanged once: ${anchor.trim().split('\n')[0]}`);
    }
    for (const token of STABLE_TOKENS) {
        if (count(withoutLink, token) !== count(fixture, token)) violations.push(`${token} count must not change`);
    }
    return violations;
};

test('fixture is the original 686-line Add User route', () => {
    const fixture = original();
    expect(fixture.replace(/\n+$/, '').split('\n')).toHaveLength(686);
    expect(fixture.startsWith('<?php\n')).toBe(true);
    expect(fixture.endsWith(TRAILING)).toBe(true);
    expect(fixture.endsWith('</html>\n')).toBe(true);
    expect(fixture.endsWith('</html>\n\n')).toBe(false);
    expect(fixture).not.toContain('\r');
    for (const [before] of ROUTE_EDITS) expect(count(fixture, before)).toBe(1);
    expect(count(fixture, '<div class="container')).toBe(1);
    expect(count(fixture, '<body')).toBe(1);
    expect(count(fixture, '<style')).toBe(1);
    expect(count(fixture, '<script')).toBe(3);
    expect(count(fixture, '<form')).toBe(3);
    expect(count(fixture, "name='new_group'")).toBe(2);
    expect(count(fixture, `${HEADER_CALL}\n<script src="checkpwd_validation.js`)).toBe(1);
    for (const marker of [BASENAME, SCREEN_HOOK, DOCUMENT_HOOK, 'ClinicalWorkspaceAssets', '<link']) {
        expect(fixture).not.toContain(marker);
    }
    expect(securityViolations(fixture)).toEqual([]);
});

const routeCandidate = applyRouteEdits(original());

test('positive candidate: permitted additions restore exactly and satisfy the route contract', () => {
    expect(routeCandidate).not.toBe(original());
    expect(restoreRoute(routeCandidate)).toBe(original());
    expect(routeViolations(routeCandidate)).toEqual([]);
    expect(securityViolations(routeCandidate)).toEqual([]);
    expect(routeViolations(original())).not.toEqual([]);
    expect(restoreRoute(original())).toBeNull();
});

test('route negative controls: CSRF, ACL, super, password, LDAP, validation, eRx, events, SQL, forms, Save/Cancel, session, opener, widths', () => {
    const csrfInput = '<input type="hidden" name="csrf_token_form" value="<?php echo CsrfUtils::collectCsrfToken(session: $session); ?>" />\n';
    const mutants = [
        mutate(routeCandidate, "aclCheckCore('admin', 'users')", "aclCheckCore('admin', 'acl')"),
        mutate(routeCandidate, 'admin/users: Add User", xl("Add User")', 'admin/users: Edit User", xl("Edit User")'),
        mutate(routeCandidate, 'getActiveSession()', 'getSession()'),
        mutate(routeCandidate, "aclCheckCore('admin', 'super')", "aclCheckCore('admin', 'users')"),
        mutate(routeCandidate, 'AclExtended::aclGetGroupTitleList($is_super_user)', 'AclExtended::aclGetGroupTitleList(true)'),
        mutate(routeCandidate, 'name="access_group[]" multiple', 'name="access_group[]"'),
        mutate(routeCandidate, `id="new_user" method='post'`, `id="new_user" method='get'`),
        mutate(routeCandidate, "name='mode' value='new_user'", "name='mode' value='update'"),
        mutate(routeCandidate, `action="usergroup_admin.php">\n${csrfInput}\n`, 'action="usergroup_admin.php">\n\n'),
        mutate(routeCandidate, `onsubmit='return top.restoreSession()'>\n${csrfInput}<br />\n`, "onsubmit='return top.restoreSession()'>\n<br />\n"),
        mutate(routeCandidate, `${csrfInput}<input type='hidden' name='mode' value='new_group' />\n`, "<input type='hidden' name='mode' value='new_group' />\n"),
        mutate(routeCandidate, `value='new_group' />\n<span class="bold"><?php echo xlt('Add User To Group')`, `value='delete_group' />\n<span class="bold"><?php echo xlt('Add User To Group')`),
        mutate(routeCandidate, '"&csrf_token_form=" . CsrfUtils::collectCsrfToken(session: $session) . "\' onclick', '"\' onclick'),
        mutate(routeCandidate, 'type="password" style="width:120px;" name="stiltskin"', 'type="text" style="width:120px;" name="stiltskin"'),
        mutate(routeCandidate, ' onkeyup="checkPasswordStrength(this);"', ''),
        mutate(routeCandidate, "<input type='password' name=adminPass", "<input type='text' name=adminPass"),
        mutate(routeCandidate, `value="" autocomplete='off' class="form-control"><font`, 'value="" class="form-control"><font'),
        mutate(routeCandidate, 'class="form-control"><font class="mandatory"></font></td>', 'class="form-control"></td>'),
        mutate(routeCandidate, "getBoolean('gbl_ldap_enabled')", "getBoolean('gbl_ldap_disabled')"),
        mutate(routeCandidate, 'value="124" name="stiltskin"', 'value="" name="stiltskin"'),
        mutate(routeCandidate, 'secure_pwd.value == 1', 'secure_pwd.value == 0'),
        mutate(routeCandidate, "'new_user', collectvalidation", "'user_form', collectvalidation"),
        mutate(routeCandidate, '"/interface/usergroup/usergroup_admin_add.php"', '"/interface/usergroup/user_admin.php"'),
        mutate(routeCandidate, "getBoolean('erx_enable')", "getBoolean('erx_disabled')"),
        mutate(routeCandidate, '}).done(function (r) {', '}).then(function (r) {'),
        mutate(routeCandidate, '}).fail(function (xhr, status, error) {', '}).always(function (xhr, status, error) {'),
        mutate(routeCandidate, "dlgclose('reload', false);", 'dlgclose();'),
        mutate(routeCandidate, "id='form_save' href='#' onclick=\"return submitform()\"", "id='form_save' href='#' onclick=\"submitform()\""),
        mutate(routeCandidate, "id='cancel' href='#'", "id='cancel-button' href='#'"),
        mutate(routeCandidate, '          dlgclose();\n', '          window.close();\n'),
        mutate(routeCandidate, '   top.restoreSession();\n', ''),
        mutate(routeCandidate, "['common','opener', 'erx']", "['common', 'erx']"),
        mutate(routeCandidate, 'f.calendar.disabled = !f.authorized.checked;', 'f.calendar.disabled = false;'),
        mutate(routeCandidate, " onclick='authorized_clicked()'", ''),
        mutate(routeCandidate, 'EVENT_USER_EDIT_RENDER_BEFORE', 'EVENT_USER_EDIT_RENDER_AFTER'),
        mutate(routeCandidate, 'EVENT_USER_EDIT_RENDER_AFTER', 'EVENT_USER_EDIT_RENDER_BEFORE'),
        mutate(routeCandidate, 'new MainMenuRole(OEGlobalsBag::getInstance()->getKernel()->getEventDispatcher())', 'new MainMenuRole()'),
        mutate(routeCandidate, 'echo $menuPatient->displayMenuRoleSelector();', "echo '';"),
        mutate(routeCandidate, `. attr($key) .`, '. $key .'),
        mutate(routeCandidate, "['warehouse', $frow['id']]", '[]'),
        mutate(routeCandidate, 'text(substr($list, 0, strlen($list) - 2))', 'substr($list, 0, strlen($list) - 2)'),
        mutate(routeCandidate, 'js_escape($alertmsg)', '$alertmsg'),
        mutate(routeCandidate, "if (!OEGlobalsBag::getInstance()->getBoolean('disable_non_default_groups')) {", "if (OEGlobalsBag::getInstance()->getBoolean('disable_non_default_groups')) {"),
        mutate(routeCandidate, 'style="width:600px;"', 'style="width:100%;"'),
        mutate(routeCandidate, 'style="width:490px;"', 'style="width:100%;"'),
        mutate(routeCandidate, '.physician_type_class {\n    width: 120px !important;', '.physician_type_class {\n    width: auto !important;'),
        mutate(routeCandidate, '#main_menu_role {\n    width: 120px !important;', '#main_menu_role {\n    width: 100% !important;'),
        mutate(routeCandidate, 'name="rumple" style="width:120px;"', 'name="rumple"'),
        mutate(routeCandidate, 'class="form-control"><span class="mandatory"></span></td>\n<?php if', 'class="form-control"></td>\n<?php if'),
        mutate(routeCandidate, `</select></td>\n\n<tr>\n<td><span class="text"><?php echo xlt('NPI')`, `</select></td>\n</tr>\n<tr>\n<td><span class="text"><?php echo xlt('NPI')`),
        mutate(routeCandidate, '<table>\n\n</table>\n', ''),
    ];
    expectDistinctMutants(mutants, routeCandidate);
    for (const mutant of mutants) {
        expect(restoreRoute(mutant)).not.toBe(original());
        expect(routeViolations(mutant)).not.toEqual([]);
        expect(securityViolations(mutant)).not.toEqual([]);
    }
});

test('route negative controls: imports, link escaping, cache, media, hooks, trailing markup and wrappers', () => {
    const mutants = [
        mutate(routeCandidate, `${ASSETS_IMPORT}\n`, ''),
        mutate(routeCandidate, `${ACL_MAIN}${ASSETS_IMPORT}\n`, `${ASSETS_IMPORT}\n${ACL_MAIN}`),
        mutate(routeCandidate, CSRF, `${CSRF}use OpenEMR\\Core\\Kernel;\n`),
        mutate(routeCandidate, 'attr(OEGlobalsBag::getInstance()->getWebRoot())', 'OEGlobalsBag::getInstance()->getWebRoot()'),
        mutate(routeCandidate, 'attr_url((new ClinicalWorkspaceAssets())', 'attr((new ClinicalWorkspaceAssets())'),
        mutate(routeCandidate, 'media="screen"', 'media="all"'),
        mutate(routeCandidate, ' media="screen"', ''),
        mutate(routeCandidate, `version('${BASENAME}')`, "version('workspace.css')"),
        mutate(routeCandidate, `${BASENAME}?v=`, `${BASENAME}?`),
        mutate(routeCandidate, `${HEADER_CALL}${LINK}\n`, `${LINK}\n${HEADER_CALL}`),
        mutate(routeCandidate, `${LINK}\n`, `${LINK}\n${LINK}\n`),
        mutate(routeCandidate, `${LINK}\n`, `${LINK}\n<link rel="stylesheet" href="https://fonts.example/inter.css">\n`),
        mutate(routeCandidate, `${LINK}\n\n<script`, `${LINK}\n<script`),
        mutate(routeCandidate, HOOKED_BODY, BODY),
        mutate(routeCandidate, HOOKED_BODY, `<body class="${SCREEN_HOOK} body_top">\n`),
        mutate(routeCandidate, HOOKED_BODY, `<body class="${SCREEN_HOOK}">\n`),
        mutate(routeCandidate, HOOKED_BODY, `<body class="body_top ${SCREEN_HOOK} ${DOCUMENT_HOOK}">\n`),
        mutate(routeCandidate, HOOKED_CONTAINER, CONTAINER),
        mutate(routeCandidate, HOOKED_CONTAINER, `<div class="${DOCUMENT_HOOK} container">\n\n<table><tr><td>\n`),
        mutate(routeCandidate, HOOKED_CONTAINER, `<div class="container ${DOCUMENT_HOOK}" style="max-width:none">\n\n<table><tr><td>\n`),
        mutate(routeCandidate, HOOKED_CONTAINER, `<div class="container ${DOCUMENT_HOOK}">\n<div class="oe-add-user-frame">\n<table><tr><td>\n`),
        mutate(routeCandidate, '<div id="password_strength_meter" class="progress mt-2">', `<div id="password_strength_meter" class="progress mt-2 ${DOCUMENT_HOOK}">`),
        mutate(routeCandidate, `<table class="border-0" cellpadding='0'`, `<table class="border-0 ${DOCUMENT_HOOK}" cellpadding='0'`),
        mutate(routeCandidate, HOOKED_BODY, `${HOOKED_BODY}<div class="oe-add-user-frame">\n`),
        mutate(routeCandidate, '</body>\n</html>\n', '</body>\n</html>'),
        mutate(routeCandidate, '</div>\n\n</body>\n', '</div>\n</div>\n\n</body>\n'),
        mutate(routeCandidate, '</style>\n', `</style>\n<style>.${DOCUMENT_HOOK} { color: red; }</style>\n`),
        mutate(routeCandidate, '</style>\n', '</style>\n<script>document.title = "x";</script>\n'),
    ];
    expectDistinctMutants(mutants, routeCandidate);
    for (const mutant of mutants) {
        expect(restoreRoute(mutant)).not.toBe(original());
        expect(routeViolations(mutant)).not.toEqual([]);
    }
});

test('actual route: only the four permitted additions restore the original route byte for byte', () => {
    expect(restoreRoute(read(ROUTE))).toBe(original());
});

test('actual route: escaped versioned screen link, sorted imports, body and container hooks', () => {
    expect(routeViolations(read(ROUTE))).toEqual([]);
});

test('actual route: security, control, form and inline width anchors unchanged', () => {
    expect(securityViolations(read(ROUTE))).toEqual([]);
});

// ---------------------------------------------------------------- asset helper

// Full ClinicalWorkspaceAssets.php as found in this worktree before OPEMR-19.
const HELPER_BASELINE = String.raw`<?php

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

// 'add-…' sorts before 'ajtooltip.js' ('d' < 'j'), so the new basename opens the list.
const NEXT = 'ajtooltip.js';
const HELPER_LINE = `        '${BASENAME}',\n`;
const supported = text => {
    const block = text.match(/private const SUPPORTED = \[\n([\s\S]*?)\n {4}\];/);
    if (!block) return null;
    return block[1].split('\n').map(line => (line.match(/^ {8}'([^']+)',$/) || [null, `<malformed:${line}>`])[1]);
};
const helperViolations = text => {
    const violations = [];
    const without = count(text, HELPER_LINE) === 1 ? text.replace(HELPER_LINE, '') : null;
    if (without !== HELPER_BASELINE) violations.push('helper must equal the baseline plus exactly one supported line');
    const list = supported(text);
    if (!list) return [...violations, 'SUPPORTED list not found'];
    if (JSON.stringify(list) !== JSON.stringify([...list].sort())) violations.push('SUPPORTED must stay sorted');
    if (new Set(list).size !== list.length) violations.push('SUPPORTED must not repeat a basename');
    if (list.filter(name => name === BASENAME).length !== 1) violations.push(`SUPPORTED must list ${BASENAME} once`);
    if (list[0] !== BASENAME || list[1] !== NEXT) violations.push(`${BASENAME} must open the list directly before ${NEXT}`);
    return violations;
};

test('helper baseline is self-consistent and fixes the sorted slot for the new basename', () => {
    const list = supported(HELPER_BASELINE);
    expect(list).toHaveLength(24);
    expect(list).toEqual([...list].sort());
    expect(new Set(list).size).toBe(list.length);
    expect(list[0]).toBe(NEXT);
    expect(HELPER_BASELINE).not.toContain(BASENAME);
    expect([...list, BASENAME].sort().indexOf(BASENAME)).toBe(0);
});

const helperCandidate = mutate(HELPER_BASELINE, `        '${NEXT}',\n`, `${HELPER_LINE}        '${NEXT}',\n`);

test('positive candidate: one sorted supported entry is the only helper change', () => {
    expect(helperViolations(helperCandidate)).toEqual([]);
    expect(supported(helperCandidate)).toHaveLength(25);
    expect(helperCandidate.replace(HELPER_LINE, '')).toBe(HELPER_BASELINE);
});

test('helper negative controls: missing, unsorted, duplicate, misspelt, extra entry and behaviour edits', () => {
    const mutants = [
        HELPER_BASELINE,
        mutate(HELPER_BASELINE, `        '${NEXT}',\n`, `        '${NEXT}',\n${HELPER_LINE}`),
        mutate(HELPER_BASELINE, "        'appointment.css',\n", `        'appointment.css',\n${HELPER_LINE}`),
        mutate(HELPER_BASELINE, "        'workspace.css',\n", `        'workspace.css',\n${HELPER_LINE}`),
        mutate(helperCandidate, HELPER_LINE, `${HELPER_LINE}${HELPER_LINE}`),
        mutate(helperCandidate, HELPER_LINE, "        'add-user.css',\n"),
        mutate(helperCandidate, HELPER_LINE, `    '${BASENAME}',\n`),
        mutate(helperCandidate, HELPER_LINE, `        "${BASENAME}",\n`),
        mutate(helperCandidate, "        'workspace.css',\n", "        'workspace.css',\n        'zz-extra.css',\n"),
        mutate(helperCandidate, "        'mode.js',\n", ''),
        mutate(helperCandidate, "$mtime === false ? '0'", "$mtime === false ? '1'"),
        mutate(helperCandidate, 'clearstatcache(true, $path);\n', ''),
        mutate(helperCandidate, 'in_array($asset, self::SUPPORTED, true)', 'in_array($asset, self::SUPPORTED)'),
        mutate(helperCandidate, 'final readonly class', 'final class'),
    ];
    expectDistinctMutants(mutants, helperCandidate);
    for (const mutant of mutants) expect(helperViolations(mutant)).not.toEqual([]);
});

test('actual helper: baseline preserved plus exactly one sorted supported basename', () => {
    expect(helperViolations(read(HELPER))).toEqual([]);
});

// ---------------------------------------------------------------- stylesheet

const CANVAS = 'var(--oe-wb-canvas, #f3f7f5)';
const PAPER = 'var(--oe-wb-paper, #fff)';
const INK = 'var(--oe-wb-ink, #17343b)';
const PETROL = 'var(--oe-wb-petrol, #086878)';
const SCREEN = `${CONTEXT} body.${SCREEN_HOOK}`;
const DOC = `${CONTEXT} .${DOCUMENT_HOOK}`;
const FOCUS = { outline: [`2px solid ${PETROL}`, false], 'outline-offset': ['2px', false] };
// Ordered allowlist: selector -> { property: [value, important] }. Only the canvas paint
// is !important, to win against the theme's own !important .body_top background.
const EXPECTED_RULES = {
    [SCREEN]: { 'background-color': [CANVAS, true], color: [INK, false] },
    [DOC]: { 'background-color': [PAPER, false], color: [INK, false] },
    [`${DOC} .text`]: { color: [INK, false] },
    [`${DOC} .title`]: { color: [PETROL, false] },
    [`${DOC} a:focus`]: FOCUS,
    [`${DOC} a:focus-visible`]: FOCUS,
};

test('canvas, ink, paper and petrol fallbacks match the popup.css workbench context tokens (source anchor)', () => {
    const tokens = {};
    postcss.parse(read('interface/clinical-workspace/popup.css')).walkRules(rule => {
        if (!rule.selectors.includes(CONTEXT)) return;
        rule.walkDecls(/^--oe-wb-/, decl => { tokens[decl.prop] = decl.value; });
    });
    expect(CANVAS).toBe(`var(--oe-wb-canvas, ${tokens['--oe-wb-canvas']})`);
    expect(PAPER).toBe(`var(--oe-wb-paper, ${tokens['--oe-wb-paper']})`);
    expect(INK).toBe(`var(--oe-wb-ink, ${tokens['--oe-wb-ink']})`);
    expect(PETROL).toBe(`var(--oe-wb-petrol, ${tokens['--oe-wb-petrol']})`);
});

const norm = value => value.replace(/\s+/g, ' ').trim();
const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

const cssViolations = text => {
    if (!text.trim()) return ['stylesheet missing or empty'];
    let tree;
    try {
        tree = postcss.parse(text);
    } catch (error) {
        return [`stylesheet does not parse: ${error.message}`];
    }
    const violations = [];
    const order = [];
    for (const node of tree.nodes) {
        if (!['rule', 'comment'].includes(node.type)) violations.push(`unexpected top-level ${node.type}`);
    }
    tree.walkAtRules(at => violations.push(`unexpected at-rule @${at.name} ${at.params}`));
    tree.walkRules(rule => {
        const selector = norm(rule.selector);
        if (rule.parent !== tree) violations.push(`nested rule ${selector}`);
        if (rule.selectors.length !== 1) {
            violations.push(`grouped selector ${selector}`);
            return;
        }
        if (!has(EXPECTED_RULES, selector)) {
            violations.push(`unexpected selector ${selector}`);
            return;
        }
        if (order.includes(selector)) {
            violations.push(`duplicate rule ${selector}`);
            return;
        }
        order.push(selector);
        const expected = EXPECTED_RULES[selector];
        const found = {};
        for (const node of rule.nodes) {
            if (node.type === 'comment') continue;
            if (node.type !== 'decl') {
                violations.push(`unexpected ${node.type} inside ${selector}`);
                continue;
            }
            if (!has(expected, node.prop)) {
                violations.push(`unexpected declaration ${selector} { ${node.prop} }`);
                continue;
            }
            if (has(found, node.prop)) {
                violations.push(`duplicate declaration ${selector} { ${node.prop} }`);
                continue;
            }
            found[node.prop] = true;
            const [value, important] = expected[node.prop];
            if (norm(node.value) !== value) violations.push(`${selector} { ${node.prop}: ${norm(node.value)} } expected ${value}`);
            if (Boolean(node.important) !== important) violations.push(`${selector} { ${node.prop} } !important must be ${important}`);
        }
        for (const prop of Object.keys(expected)) {
            if (!has(found, prop)) violations.push(`missing declaration ${selector} { ${prop} }`);
        }
    });
    for (const selector of Object.keys(EXPECTED_RULES)) {
        if (!order.includes(selector)) violations.push(`missing rule ${selector}`);
    }
    const expectedOrder = Object.keys(EXPECTED_RULES).filter(selector => order.includes(selector));
    if (JSON.stringify(order) !== JSON.stringify(expectedOrder)) violations.push('rules must keep the stated order');
    return violations;
};

const SCREEN_BLOCK = `${SCREEN} {\n  background-color: ${CANVAS} !important;\n  color: ${INK};\n}\n`;
const DOC_BLOCK = `${DOC} {\n  background-color: ${PAPER};\n  color: ${INK};\n}\n`;
const TEXT_BLOCK = `${DOC} .text {\n  color: ${INK};\n}\n`;
const TITLE_BLOCK = `${DOC} .title {\n  color: ${PETROL};\n}\n`;
const FOCUS_BLOCK = `${DOC} a:focus {\n  outline: 2px solid ${PETROL};\n  outline-offset: 2px;\n}\n`;
const FOCUS_VISIBLE_BLOCK = `${DOC} a:focus-visible {\n  outline: 2px solid ${PETROL};\n  outline-offset: 2px;\n}\n`;
const cssCandidate = [
    '/* Add User popup: canvas, paper, ink, title and link focus only. */\n',
    SCREEN_BLOCK, DOC_BLOCK, TEXT_BLOCK, TITLE_BLOCK, FOCUS_BLOCK, FOCUS_VISIBLE_BLOCK,
].join('\n');

test('positive candidate: exactly six ordered single-selector scoped rules satisfy the AST allowlist', () => {
    expect(cssViolations(cssCandidate)).toEqual([]);
    const tree = postcss.parse(cssCandidate);
    const rules = tree.nodes.filter(node => node.type === 'rule');
    expect(rules.map(rule => rule.selector)).toEqual(Object.keys(EXPECTED_RULES));
    for (const rule of rules) {
        expect(rule.selector.startsWith(`${CONTEXT} `)).toBe(true);
        expect(rule.selector.includes(SCREEN_HOOK) || rule.selector.includes(DOCUMENT_HOOK)).toBe(true);
    }
    let importantCount = 0;
    tree.walkDecls(decl => { if (decl.important) importantCount += 1; });
    expect(importantCount).toBe(1);
    expect(cssViolations('')).toEqual(['stylesheet missing or empty']);
});

test('stylesheet negative controls: scope, hooks, paint, important, order, focus, geometry, leakage, at-rules', () => {
    const grouped = `${DOC} a:focus,\n${DOC} a:focus-visible {\n  outline: 2px solid ${PETROL};\n  outline-offset: 2px;\n}\n`;
    const mutants = [
        mutateAll(cssCandidate, `${CONTEXT} `, ''),
        mutateAll(cssCandidate, `${CONTEXT} `, 'body.oe-workbench-context '),
        mutate(cssCandidate, `body.${SCREEN_HOOK} {`, 'body {'),
        mutate(cssCandidate, `body.${SCREEN_HOOK} {`, `.${SCREEN_HOOK} {`),
        mutateAll(cssCandidate, `.${DOCUMENT_HOOK}`, '.container'),
        mutate(cssCandidate, `${CANVAS} !important;`, `${CANVAS};`),
        mutate(cssCandidate, `background-color: ${CANVAS}`, `background-color: ${PAPER}`),
        mutate(cssCandidate, `background-color: ${CANVAS}`, `background: ${CANVAS}`),
        mutate(cssCandidate, `background-color: ${CANVAS}`, 'background-color: var(--oe-wb-canvas, #f4f8f6)'),
        mutate(cssCandidate, `background-color: ${CANVAS}`, 'background-color: #f3f7f5'),
        mutate(cssCandidate, `background-color: ${PAPER};`, `background-color: ${PAPER} !important;`),
        mutate(cssCandidate, `background-color: ${PAPER};`, `background-color: ${CANVAS};`),
        mutate(cssCandidate, `background-color: ${PAPER};`, `background: ${PAPER};`),
        mutate(cssCandidate, SCREEN_BLOCK, SCREEN_BLOCK.replace(`color: ${INK};`, `color: ${INK} !important;`)),
        mutate(cssCandidate, TEXT_BLOCK, `${DOC} .text {\n  color: ${INK} !important;\n}\n`),
        mutate(cssCandidate, TEXT_BLOCK, `${DOC} .text {\n  color: ${INK};\n  background-color: ${PAPER};\n}\n`),
        mutate(cssCandidate, TEXT_BLOCK, `${DOC} .text {\n  color: var(--oe-wb-muted, #526a70);\n}\n`),
        mutate(cssCandidate, TITLE_BLOCK, `${DOC} .title {\n  color: ${INK};\n}\n`),
        mutate(cssCandidate, TITLE_BLOCK, `${DOC} .title {\n  color: ${PETROL};\n  font-weight: 600;\n}\n`),
        mutate(cssCandidate, `${TEXT_BLOCK}\n${TITLE_BLOCK}`, `${TITLE_BLOCK}\n${TEXT_BLOCK}`),
        mutate(cssCandidate, `${SCREEN_BLOCK}\n${DOC_BLOCK}`, `${DOC_BLOCK}\n${SCREEN_BLOCK}`),
        mutate(cssCandidate, `${FOCUS_BLOCK}\n${FOCUS_VISIBLE_BLOCK}`, grouped),
        mutate(cssCandidate, `\n${FOCUS_VISIBLE_BLOCK}`, ''),
        mutate(cssCandidate, FOCUS_VISIBLE_BLOCK, FOCUS_VISIBLE_BLOCK.replace('outline-offset: 2px;', 'outline-offset: 1px;')),
        mutate(cssCandidate, FOCUS_BLOCK, FOCUS_BLOCK.replace(`2px solid ${PETROL}`, `1px dotted ${PETROL}`)),
        mutate(cssCandidate, FOCUS_BLOCK, FOCUS_BLOCK.replace(`2px solid ${PETROL};`, `2px solid ${PETROL} !important;`)),
        mutate(cssCandidate, FOCUS_BLOCK, FOCUS_BLOCK.replace('a:focus {', 'a:hover {')),
        mutate(cssCandidate, FOCUS_BLOCK, FOCUS_BLOCK.replace('a:focus {', ':focus {')),
        mutate(cssCandidate, DOC_BLOCK, DOC_BLOCK.replace(`color: ${INK};`, `color: ${INK};\n  padding: 1rem;`)),
        mutate(cssCandidate, DOC_BLOCK, DOC_BLOCK.replace(`color: ${INK};`, `color: ${INK};\n  max-width: 60rem;`)),
        mutate(cssCandidate, DOC_BLOCK, DOC_BLOCK.replace(`color: ${INK};`, `color: ${INK};\n  border-radius: 8px;`)),
        mutate(cssCandidate, SCREEN_BLOCK, SCREEN_BLOCK.replace(`color: ${INK};`, `color: ${INK};\n  font-family: Inter, sans-serif;`)),
        mutate(cssCandidate, SCREEN_BLOCK, SCREEN_BLOCK.replace(`color: ${INK};`, `color: ${INK};\n  font-size: 14px;`)),
        mutate(cssCandidate, SCREEN_BLOCK, SCREEN_BLOCK.replace(`color: ${INK};`, `color: ${INK};\n  color: ${INK};`)),
        `${cssCandidate}\n${DOC_BLOCK}`,
        `${cssCandidate}\n${DOC} .mandatory {\n  color: ${INK};\n}\n`,
        `${cssCandidate}\n${DOC} .bold {\n  color: ${INK};\n}\n`,
        `${cssCandidate}\n${DOC} .form-control {\n  border-color: ${PETROL};\n}\n`,
        `${cssCandidate}\n${DOC} .btn-save {\n  background-color: ${PETROL};\n}\n`,
        `${cssCandidate}\n${DOC} .progress-bar {\n  background-color: ${PETROL};\n}\n`,
        `${cssCandidate}\n${DOC} a {\n  color: ${PETROL};\n}\n`,
        `${cssCandidate}\n${DOC} td {\n  width: auto;\n}\n`,
        `${cssCandidate}\n${DOC} table {\n  width: 100%;\n}\n`,
        `${cssCandidate}\n${DOC} * {\n  color: ${INK};\n}\n`,
        `${cssCandidate}\n${CONTEXT} .text {\n  color: ${INK};\n}\n`,
        `${cssCandidate}\n${CONTEXT} body {\n  background-color: ${CANVAS};\n}\n`,
        `${cssCandidate}\n.${DOCUMENT_HOOK} .title {\n  color: ${PETROL};\n}\n`,
        mutate(cssCandidate, TEXT_BLOCK, `${DOC} .text,\n${DOC} .mandatory {\n  color: ${INK};\n}\n`),
        mutate(cssCandidate, TITLE_BLOCK, TITLE_BLOCK.replace('}\n', '  &:hover {\n    color: #000;\n  }\n}\n')),
        `@media screen {\n${cssCandidate}}\n`,
        `@import url("popup.css");\n${cssCandidate}`,
        `@font-face {\n  font-family: Inter;\n  src: url("inter.woff2");\n}\n${cssCandidate}`,
        `${cssCandidate}\n${DOC} {\n`,
    ];
    expectDistinctMutants(mutants, cssCandidate);
    for (const mutant of mutants) expect(cssViolations(mutant)).not.toEqual([]);
});

test('actual stylesheet: exactly the six allowlisted rules and declarations', () => {
    expect(cssViolations(readOptional(STYLESHEET))).toEqual([]);
});

// ---------------------------------------------------------------- unchanged caller and backend (source anchors)

test('source anchor: usergroup_admin.php launches Add User as a modal-mlg 450 iframe dlgopen', () => {
    const caller = read(CALLER);
    expect(count(caller, `$(".medium_modal").on('click', function(e) {\n        e.preventDefault();e.stopPropagation();\n        dlgopen('', '', 'modal-mlg', 450, '', '', {\n            type: 'iframe',\n            url: $(this).attr('href')\n        });\n    });`)).toBe(1);
    expect(count(caller, 'medium_modal')).toBe(3);
    expect(count(caller, `<a href="usergroup_admin_add.php" class="medium_modal btn btn-secondary btn-add"><?php echo xlt('Add User'); ?></a>`)).toBe(1);
    expect(count(caller, 'usergroup_admin_add.php')).toBe(1);
    for (const marker of [BASENAME, SCREEN_HOOK, DOCUMENT_HOOK, 'ClinicalWorkspaceAssets']) {
        expect(caller).not.toContain(marker);
    }
});

test('source anchor: usergroup_admin.php backend CSRF, ACL, admin/super, create, group and AJAX reply stay in place', () => {
    const caller = read(CALLER);
    for (const anchor of [
        'if (!empty($_REQUEST)) {\n    if (!CsrfUtils::verifyCsrfToken($_REQUEST["csrf_token_form"], session: $session)) {\n        CsrfUtils::csrfNotVerified();\n    }\n}\n',
        "if (!AclMain::aclCheckCore('admin', 'users')) {\n    AccessDeniedHelper::denyWithTemplate(\"ACL check failed for admin/users: User / Groups\", xl(\"User / Groups\"));\n}\n",
        "if (!AclMain::aclCheckCore('admin', 'super')) {\n    //block non-administrator user from create administrator\n    if (!empty($_POST['access_group'])) {\n        foreach ($_POST['access_group'] as $aro_group) {\n            if (AclExtended::isGroupIncludeSuperuser($aro_group)) {\n                die(xlt('Saving denied'));\n            };\n        }\n    }\n",
        '                $mail = new MyMailer();\n',
        'if (isset($_POST["mode"])) {\n    if ($_POST["mode"] == "new_user") {\n',
        "        $res = sqlQuery(\"select username from users where username = ?\", [trim((string) $_POST['rumple'])]);\n",
        "            $success = $authUtilsNewPassword->updatePassword(\n                $session->get('authUserID'),\n                0,\n                $_POST['adminPass'],\n                $_POST['stiltskin'],\n                true,\n                $userData,\n                $newUsername\n            );\n",
        '                $uuid = UuidRegistry::getRegistryForTable(\'users\')->createUuid();\n',
        'OEGlobalsBag::getInstance()->getKernel()->getEventDispatcher()->dispatch($userCreatedEvent, UserCreatedEvent::EVENT_HANDLE);',
        '    } elseif ($_POST["mode"] == "new_group") {\n',
        '    if ($_GET["mode"] == "delete_group") {\n',
        'if (isset($_REQUEST["mode"])) {\n    echo text(trim($alertmsg));\n    return;\n}\n',
    ]) {
        expect(count(caller, anchor)).toBe(1);
    }
    expect(count(caller, 'AclExtended::setUserAro(')).toBe(2);
});

test('shared workbench engine carries no Add User specific rules', () => {
    for (const shared of [
        'interface/clinical-workspace/workspace.css',
        'interface/clinical-workspace/popup.css',
        'interface/clinical-workspace/popup.js',
        'library/dialog.js',
    ]) {
        const text = read(shared);
        expect(text).not.toContain('oe-add-user');
        expect(text).not.toContain(BASENAME);
    }
});
