'use strict';

/*
 * Shared, history-independent helpers for the procedure provider editor guards
 * (interface/orders/procedure_provider_edit.php): real-source readers, the
 * declared route presentation edits and their inverse, preserved business
 * anchors with negative mutations, and a minimal CSS reader. Used by
 * procedure-provider.test.cjs (portable) and procedure-provider-baseline.test.cjs
 * (needs the git base commit).
 */

const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '../..');
const ROUTE = 'interface/orders/procedure_provider_edit.php';
const CALLER = 'interface/orders/procedure_provider_list.php';
const HELPER = 'src/Common/Assets/ClinicalWorkspaceAssets.php';
const SHEET_NAME = 'procedure-provider-popup.css';
const SHEET = `interface/clinical-workspace/${SHEET_NAME}`;
const DOC = 'docs/clinical-ui/PROCEDURE-PROVIDER.md';
const BODY_CLASS = 'oe-procedure-provider-popup';
// popup.js toggles its classes on <html> only; the genuine-popup class activates this sheet.
const SCOPE = `html.oe-workbench-popup body.${BODY_CLASS}`;
const CANVAS = `${BODY_CLASS}__canvas`;
const DOCUMENT = `${BODY_CLASS}__document`;
const ACTIONS = `${BODY_CLASS}__actions`;

const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const exists = file => fs.existsSync(path.join(root, file));
const count = (text, part) => text.split(part).length - 1;

// Allowlist names in ClinicalWorkspaceAssets before this slice, copied from the source.
const BASELINE_SUPPORTED = [
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

// Names in the helper's SUPPORTED constant, in source order; null when absent.
const supportedList = text => {
    const body = text.match(/private const SUPPORTED = \[\n([\s\S]*?)\n {4}\];/);
    return body ? [...body[1].matchAll(/'([^']+)'/g)].map(m => m[1]) : null;
};

// ---------------------------------------------------------------------------
// Route presentation edits, each [original, presented]: one import, one
// screen-only versioned link, and classes on four existing elements.
// ---------------------------------------------------------------------------
const LINK = '<?php $clinicalAssets = new ClinicalWorkspaceAssets(); ?>\n'
    + '<link rel="stylesheet" media="screen" href="<?php echo attr(\\OpenEMR\\Core\\OEGlobalsBag::getInstance()->getWebRoot()); ?>'
    + `/interface/clinical-workspace/${SHEET_NAME}?v=<?php echo attr_url($clinicalAssets->version('${SHEET_NAME}')); ?>">\n`;

const changes = [
    [
        'use OpenEMR\\Common\\Acl\\AclMain;\nuse OpenEMR\\Common\\Csrf\\CsrfUtils;',
        'use OpenEMR\\Common\\Acl\\AclMain;\nuse OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;\nuse OpenEMR\\Common\\Csrf\\CsrfUtils;',
    ],
    ['</style>\n\n</head>', `</style>\n${LINK}\n</head>`],
    [
        '<body>\n<div class="container-fluid">',
        `<body class="${BODY_CLASS}">\n<div class="container-fluid ${CANVAS}">`,
    ],
    [
        "<form method='post' name='theform' action=",
        `<form method='post' name='theform' class='${DOCUMENT}' action=`,
    ],
    [
        '<div class="btn-group" role="group">',
        `<div class="btn-group ${ACTIONS}" role="group">`,
    ],
];

// Undo the presentation edits; null when any edit is missing or ambiguous.
const restore = text => {
    let restored = text;
    for (const [before, after] of changes) {
        if (count(restored, after) !== 1) return null;
        restored = restored.replace(after, () => before);
    }
    return restored;
};

// ---------------------------------------------------------------------------
// Preserved business source, copied byte-for-byte from the base route. Each
// must appear exactly once; the baseline suite proves they match the base.
// ---------------------------------------------------------------------------
const ANCHORS = [
    // Session, CSRF, ACL, request
    '$session = SessionWrapperFactory::getInstance()->getActiveSession();',
    'if (!empty($_GET)) {\n    CsrfUtils::checkCsrfInput(INPUT_GET, dieOnFail: true);\n}',
    'if (!empty($_POST)) {\n    CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: true);\n}',
    "if (!AclMain::aclCheckCore('admin', 'users')) {\n"
        + '    AccessDeniedHelper::denyWithTemplate("ACL check failed for admin/users: Edit/Add Procedure Provider", xl("Edit/Add Procedure Provider"));\n}',
    "$ppid = $_REQUEST['ppid'];",
    "<?php Header::setupHeader(['opener']);?>",
    // SQL
    '"SELECT organization FROM users WHERE id = ?"',
    '"SELECT name FROM procedure_providers WHERE ppid = ?"',
    '"password = ?, orders_path = ?, results_path = ?, notes = ?, active = ?";',
    "'form_protocol', 'form_remote_host', 'form_login', 'form_password',",
    "$params[] = (($_POST['form_active'] ?? '') == 'on') ? '1' : '0';",
    '$query = "UPDATE procedure_providers SET $sets WHERE ppid = ?";',
    '$ppid = sqlInsert("INSERT INTO `procedure_providers` SET $sets", $params);',
    'sqlStatement("DELETE FROM procedure_providers WHERE ppid = ?", [$ppid]);',
    '$row = sqlQuery("SELECT * FROM procedure_providers WHERE ppid = ?", [$ppid]);',
    "$org_query = \"SELECT id, organization FROM users WHERE abook_type LIKE 'ord_%'\";",
    '$checkName = sqlQuery("SELECT `name` FROM `procedure_providers` WHERE `name` = ?", [$org_name]);',
    // Save/delete response and opener callback
    'echo " window.close();\\n";',
    'echo " if (opener.refreshme) opener.refreshme();\\n";',
    'echo "</script></body></html>\\n";',
    // CSRF on the form
    'action="procedure_provider_edit.php?ppid=<?php echo attr_url($ppid); ?>&csrf_token_form=<?php echo CsrfUtils::collectCsrfToken(session: $session); ?>">',
    '<input type="hidden" name="csrf_token_form" value="<?php echo CsrfUtils::collectCsrfToken(session: $session); ?>" />',
    // Integration credentials
    "<input type='text' name='form_login' id='form_login' maxlength='255' value='<?php echo attr($row['login'] ?? ''); ?>' placeholder='<?php echo xla('Enter User Login ID'); ?>' class='form-control' />",
    "<input type='text' name='form_password' id='form_password' maxlength='255' value='<?php echo attr($row['password'] ?? ''); ?>' placeholder='<?php echo xla('Enter Password'); ?>' class='form-control' />",
    // Controls and options
    "<input type='checkbox' class='form-check-input' name='form_active' id='form_active'",
    "<input type='text' name='form_npi' id='form_npi' maxlength='10' value='<?php echo attr($row['npi'] ?? ''); ?>' class='form-control' />",
    "<textarea rows='3' name='form_notes' id='form_notes' wrap='virtual' class='form-control'><?php echo text($row['notes'] ?? ''); ?></textarea>",
    "'DORN' => xl('Dorn'),",
    "'Q' => xl('Quest Cert Debug'),",
    "'R' => xl('Results Only'),",
    "<button type='submit' name='form_save' class=\"btn btn-primary btn-save\" value='<?php echo xla('Save'); ?>'><?php echo xlt('Save'); ?></button>",
    "<button type=\"button\" class=\"btn btn-secondary btn-cancel\" onclick='window.close()' ;><?php echo xlt('Cancel'); ?></button>",
    "<?php if ($ppid) { ?>\n                                <button type='submit' name='form_delete' class=\"btn btn-danger btn-cancel btn-delete\" value='<?php echo xla('Delete'); ?>'><?php echo xlt('Delete'); ?></button>",
    // Original typography and inline help presentation
    '    td {\n        font-size: 0.8125rem;\n    }',
    '     font-family:sans-serif;\n        font-size: 0.75rem;\n     font-weight:bold;',
    '    .label-div:hover > a {\n       display:inline-block;\n    }',
    '        background: #F7FAB3;\n        color: #000;',
    '<h4><?php echo xlt(\'Enter Provider Details\'); ?><i id="enter-details-tooltip" class="fa fa-info-circle oe-text-black oe-superscript ml-2" aria-hidden="true"></i></h4>',
    "$('.icon-tooltip i').attr({\"title\": <?php echo xlj('Click to see more information'); ?>, \"data-toggle\": \"tooltip\", \"data-placement\": \"bottom\"}).tooltip({",
];

// Exact element counts in the base route; presentation edits add none.
const ELEMENT_COUNTS = [
    [/<form[ >]/g, 1],
    [/<input[ >]/g, 12],
    [/<select[ >]/g, 4],
    [/<textarea[ >]/g, 1],
    [/<button[ >]/g, 3],
    [/<body[ >]/g, 1],
    [/<h[1-6][ >]/g, 1],
    [/id="\w+_info" class="collapse"/g, 11],
    // The page script plus the echoed save/delete response script.
    [/<script[ >]/g, 2],
];

// Negative mutations [from, to]: each must be rejected by both suites.
const MUTATIONS = [
    // ACL
    ["aclCheckCore('admin', 'users')", "aclCheckCore('admin', 'super')"],
    ['if (!AclMain::aclCheckCore(', 'if (false && !AclMain::aclCheckCore('],
    // CSRF and session
    ['CsrfUtils::checkCsrfInput(INPUT_GET, dieOnFail: true);', ''],
    ['checkCsrfInput(INPUT_POST, dieOnFail: true)', 'checkCsrfInput(INPUT_POST, dieOnFail: false)'],
    ['<input type="hidden" name="csrf_token_form"', '<input type="hidden" name="csrf_token"'],
    ['&csrf_token_form=<?php', '&token=<?php'],
    ['getActiveSession()', 'getSession()'],
    // SQL
    ['"UPDATE procedure_providers SET $sets WHERE ppid = ?"', '"UPDATE procedure_providers SET $sets"'],
    ['"DELETE FROM procedure_providers WHERE ppid = ?"', '"DELETE FROM procedure_providers"'],
    ["abook_type LIKE 'ord_%'", "abook_type LIKE '%'"],
    ['sqlInsert("INSERT INTO `procedure_providers` SET $sets", $params)', 'sqlInsert("INSERT INTO procedure_providers SET $sets", [])'],
    ["== 'on') ? '1' : '0'", "== 'on') ? '0' : '1'"],
    // Credentials
    ["'form_login', 'form_password',", "'form_login',"],
    ["attr($row['password'] ?? '')", "attr('')"],
    ["type='text' name='form_password'", "type='password' name='form_password'"],
    ["name='form_password' id='form_password'", "name='form_password' id='form_password' autocomplete='off'"],
    // Controls and options
    ["'DORN' => xl('Dorn'),", ''],
    ["maxlength='10'", "maxlength='12'"],
    ["class='form-check-input' name='form_active'", "class='form-check-input' disabled name='form_active'"],
    ['<?php if ($ppid) { ?>', '<?php if (true) { ?>'],
    ["type='submit' name='form_save'", "type='button' name='form_save'"],
    // Callbacks
    ['echo " if (opener.refreshme) opener.refreshme();\\n";', ''],
    ['echo " window.close();\\n";', 'echo "";'],
    ["onclick='window.close()' ;", "onclick='dlgclose()'"],
    ["Header::setupHeader(['opener'])", 'Header::setupHeader([])'],
    // Fonts and inline presentation
    ['font-size: 0.8125rem;', 'font-size: 0.875rem;'],
    ['font-family:sans-serif;', 'font-family:Arial;'],
    ['font-weight:bold;', 'font-weight:600;'],
    ["<h4><?php echo xlt('Enter Provider Details'); ?>", "<h5><?php echo xlt('Enter Provider Details'); ?>"],
    ['background: #F7FAB3;', 'background: #fff;'],
    ['"data-placement": "bottom"}).tooltip({', '"data-placement": "top"}).tooltip({'],
];

// Mutations inside the declared presentation edits: restore() must refuse them.
const PRESENTATION_MUTATIONS = [
    [`<body class="${BODY_CLASS}">`, `<body class="${BODY_CLASS}" onload="init()">`],
    ['media="screen" href="<?php echo attr(\\OpenEMR', 'media="all" href="<?php echo attr(\\OpenEMR'],
    [`class='${DOCUMENT}' action=`, `class='${DOCUMENT}' autocomplete='off' action=`],
    [`<div class="btn-group ${ACTIONS}" role="group">`, `<div class="btn-group ${ACTIONS}" role="toolbar">`],
];

// Portable route guard: [] when every declared edit and preserved anchor holds.
function routeViolations(php) {
    const out = [];
    for (const [before, after] of changes) {
        if (count(php, after) !== 1) out.push(`presentation edit missing: ${after}`);
        if (count(php, before) !== 0) out.push(`original form still present: ${before}`);
    }
    for (const anchor of ANCHORS) if (count(php, anchor) !== 1) out.push(`preserved source changed: ${anchor}`);
    for (const [pattern, n] of ELEMENT_COUNTS) {
        const seen = (php.match(pattern) || []).length;
        if (seen !== n) out.push(`${pattern} count ${seen}, expected ${n}`);
    }
    if (count(php, BODY_CLASS) !== 4) out.push(`${BODY_CLASS} used outside the four declared classes`);
    if (count(php, SHEET_NAME) !== 2) out.push('stylesheet referenced other than by the single link');
    return out;
}

// ---------------------------------------------------------------------------
// Minimal CSS reader: comments, nested @media, quoted strings, () and [].
// ---------------------------------------------------------------------------
function scanTo(src, start, stops) {
    let depth = 0;
    let quote = null;
    let i = start;
    for (; i < src.length; i++) {
        const ch = src[i];
        if (quote) {
            if (ch === '\\') i++;
            else if (ch === quote) quote = null;
        } else if (ch === '"' || ch === "'") quote = ch;
        else if (ch === '(' || ch === '[') depth++;
        else if (ch === ')' || ch === ']') depth--;
        else if (depth === 0 && stops.includes(ch)) break;
    }
    return i;
}

function splitTop(text, separator) {
    const parts = [];
    let start = 0;
    for (let i = scanTo(text, 0, separator); i < text.length; i = scanTo(text, start, separator)) {
        parts.push(text.slice(start, i).trim());
        start = i + 1;
    }
    parts.push(text.slice(start).trim());
    return parts.filter(Boolean);
}

function parseCss(input) {
    const src = input.replace(/\/\*[\s\S]*?\*\//g, '');
    let i = 0;
    const decls = () => {
        const end = scanTo(src, i, '}');
        const body = src.slice(i, end);
        i = end + 1;
        return splitTop(body, ';').map(raw => {
            const colon = raw.indexOf(':');
            const value = raw.slice(colon + 1).trim();
            return {
                prop: raw.slice(0, colon).trim().toLowerCase(),
                value: value.replace(/\s*!\s*important\s*$/i, ''),
                important: /!\s*important\s*$/i.test(value),
            };
        });
    };
    const block = () => {
        const nodes = [];
        while (i < src.length) {
            while (i < src.length && /\s/.test(src[i])) i++;
            if (i >= src.length) break;
            if (src[i] === '}') {
                i++;
                return nodes;
            }
            const end = scanTo(src, i, '{;');
            const prelude = src.slice(i, end).trim();
            i = end + 1;
            if (src[end] === ';' || end >= src.length) {
                nodes.push({ type: 'statement', prelude });
            } else if (prelude.startsWith('@')) {
                const [, name, params] = prelude.match(/^@([\w-]+)\s*([\s\S]*)$/);
                nodes.push({ type: 'atrule', name, params: params.trim(), nodes: block() });
            } else {
                nodes.push({ type: 'rule', selectors: splitTop(prelude, ','), decls: decls() });
            }
        }
        return nodes;
    };
    return block();
}

function walkRules(nodes, media = [], out = []) {
    for (const node of nodes) {
        if (node.type === 'rule') out.push({ ...node, media });
        else if (node.nodes) walkRules(node.nodes, [...media, `@${node.name} ${node.params}`], out);
    }
    return out;
}

module.exports = {
    root,
    ROUTE,
    CALLER,
    HELPER,
    SHEET,
    SHEET_NAME,
    DOC,
    BODY_CLASS,
    SCOPE,
    CANVAS,
    DOCUMENT,
    ACTIONS,
    BASELINE_SUPPORTED,
    LINK,
    changes,
    ANCHORS,
    MUTATIONS,
    PRESENTATION_MUTATIONS,
    read,
    exists,
    count,
    restore,
    routeViolations,
    supportedList,
    parseCss,
    walkRules,
};
