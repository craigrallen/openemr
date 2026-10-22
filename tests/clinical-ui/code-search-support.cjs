'use strict';

/*
 * Shared, history-independent helpers for the dynamic code finder popup
 * guards (interface/patient_file/encounter/find_code_dynamic.php): source
 * readers, the declared route presentation edits and their exact inverse,
 * preserved business anchors with negative mutations, and a minimal CSS
 * reader. Used by code-search.test.cjs (portable),
 * code-search-baseline.test.cjs (needs the git base commit) and
 * tests/js/code-search-popup.test.js (Jest wrapper).
 */

const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '../..');
const ROUTE = 'interface/patient_file/encounter/find_code_dynamic.php';
const AJAX = 'interface/patient_file/encounter/find_code_dynamic_ajax.php';
const HELPER = 'src/Common/Assets/ClinicalWorkspaceAssets.php';
const SHEET_NAME = 'code-search-popup.css';
const SHEET = `interface/clinical-workspace/${SHEET_NAME}`;
const BODY_CLASS = 'oe-code-search-popup';
// popup.js toggles its classes on <html> only; the genuine-popup class activates this sheet.
const SCOPE = `html.oe-workbench-popup body.${BODY_CLASS}`;
// The existing theform is the document sheet: no wrapper, title or actions markup is added.
const DOCUMENT = `${BODY_CLASS}__document`;

// Routes that open the finder, each with the exact opener line(s) it uses today.
const CALLERS = {
    'interface/patient_file/summary/immunizations.php': [
        "dlgopen('../encounter/find_code_dynamic.php?codetype=CVX,VALUESET', '_blank', 900, 600);",
    ],
    'interface/forms/procedure_order/common.php': [
        "let url = top.webroot_url + '/interface/patient_file/encounter/find_code_dynamic.php?codetype=LOINC,SNOMED-CT,SNOMED,RXCUI,CPT4,VALUESET,OID&singleCodeSelection=1';",
        "resolvePromiseOn: 'close'",
        'let codeData = JSON.parse(promiseData);',
    ],
    'interface/drugs/add_edit_drug.php': [
        "dlgopen('../patient_file/encounter/find_code_dynamic.php' + getter, '_blank', 900, 800);",
    ],
    'interface/super/edit_layout.php': [
        `dlgopen('../patient_file/encounter/find_code_dynamic.php?what=lists',"_blank", 850, 750, "", title);`,
        "dlgopen('../patient_file/encounter/find_code_dynamic.php?what=fields&source='",
    ],
    'interface/super/edit_list.php': [
        "dlgopen('../patient_file/encounter/find_code_dynamic.php?codetype=CVX', '_blank', 900, 600);",
    ],
    'interface/patient_file/encounter/superbill_custom_full.php': [
        "dlgopen('find_code_dynamic.php', '_blank', 900, 600);",
    ],
    'interface/orders/types_edit.php': ["let url = '../patient_file/encounter/find_code_dynamic.php';"],
    'interface/super/edit_layout_props.php': ['/patient_file/encounter/find_code_dynamic.php'],
    'interface/forms/LBF/new.php': ['/patient_file/encounter/find_code_dynamic.php'],
};

const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const exists = file => fs.existsSync(path.join(root, file));
const count = (text, part) => text.split(part).length - 1;
const lines = (...parts) => parts.join('\n');

// Allowlist names in ClinicalWorkspaceAssets at the base commit, copied from the source.
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
// screen-only versioned link, and classes on the existing body and form.
// ---------------------------------------------------------------------------
const HEADER = String.raw`    <?php Header::setupHeader(['opener', 'datatables', 'datatables-bs', 'datatables-colreorder']); ?>`;
const LINK = lines(
    String.raw`    <?php $clinicalAssets = new ClinicalWorkspaceAssets(); ?>`,
    String.raw`    <link rel="stylesheet" media="screen" href="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>/interface/clinical-workspace/${SHEET_NAME}?v=<?php echo attr_url($clinicalAssets->version('${SHEET_NAME}')); ?>">`,
);

const changes = [
    [
        lines('use OpenEMR\\Common\\Csrf\\CsrfUtils;', 'use OpenEMR\\Common\\Session\\SessionWrapperFactory;'),
        lines('use OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;', 'use OpenEMR\\Common\\Csrf\\CsrfUtils;', 'use OpenEMR\\Common\\Session\\SessionWrapperFactory;'),
    ],
    [lines(HEADER, '', '    <script>'), lines(HEADER, LINK, '', '    <script>')],
    ['<body id="codes_search">', `<body id="codes_search" class="${BODY_CLASS}">`],
    ["<form method='post' name='theform'>", `<form method='post' name='theform' class='${DOCUMENT}'>`],
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
// Preserved business source, copied from the base route as [text, times].
// The baseline suite proves each count against the base.
// ---------------------------------------------------------------------------
const MORE_RESULTS = String.raw`$(".dataTables_wrapper .dataTables_info").parent().parent().prepend("<div class='col-sm-12'><p class='alert alert-warning moreResults'>" + <?php echo xlj("Maximum displayable results reached. Narrow your search"); ?> +"</p></div>");`;
const NOT_OPEN = "alert('The destination form was closed; I cannot act on your selection.');";
const ANCHORS = [
    // Session, request parsing, mode and limits
    ['$session = SessionWrapperFactory::getInstance()->getActiveSession();', 1],
    ["$what = empty($_GET['what']) ? 'codes' : $_GET['what'];", 1],
    ["$codetype = empty($_GET['codetype']) ? '' : $_GET['codetype'];", 1],
    ['    $allowed_codes = split_csv_line($codetype);', 1],
    ["$target_element = empty($_GET['target_element']) ? '' : $_GET['target_element'];", 1],
    ["$source = empty($_GET['source']) ? 'D' : $_GET['source'];", 1],
    ["$layout_id = empty($_GET['layout_id']) ? '' : $_GET['layout_id'];", 1],
    ["$limit = empty($_GET['limit']) ? 0 : (int)$_GET['limit'];", 1],
    ["$singleCodeSelection = $_GET['singleCodeSelection'] ?? null;", 1],
    [HEADER, 1],
    ["        var singleCodeSelection = <?php echo (isset($_GET['singleCodeSelection'])) ? js_escape($_GET['singleCodeSelection']) : 0 ?>;", 1],
    // DataTables: AJAX source with CSRF token, paging, columns and server params
    ['"bServerSide": true,', 1],
    ['"sAjaxSource": "find_code_dynamic_ajax.php?csrf_token_form=" + <?php echo js_url(CsrfUtils::collectCsrfToken(session: $session)); ?>,', 1],
    ['"aLengthMenu": [15, 25, 50, 100],', 1],
    ['"iDisplayLength": 50,', 1],
    ['"searchDelay": 350,', 1],
    ['"aoColumns": [{"sWidth": "20%"}, {"sWidth": "60%"}, {"sWidth": "10%"}],', 1],
    ['aoData.push({"name": "what", "value": <?php echo js_escape($what); ?>});', 1],
    ['aoData.push({"name": "codetype", "value": document.forms[0].form_code_type.value});', 1],
    ['aoData.push({"name": "inactive", "value": (document.forms[0].form_include_inactive.checked ? 1 : 0)});', 1],
    ['aoData.push({"name": "source", "value": <?php echo js_escape($source); ?>});', 1],
    ['aoData.push({"name": "layout_id", "value": <?php echo js_escape($layout_id); ?>});', 1],
    // Draw callback is declared twice in the base; both stay.
    ['fnDrawCallback: function (obj) {', 2],
    [MORE_RESULTS, 2],
    ["nRow.setAttribute('role', 'button');", 1],
    ["nRow.setAttribute('tabindex', '0');", 1],
    ["nRow.style.cursor = 'pointer';", 1],
    ["nRow.style.fontWeight = 'bold';", 1],
    ["return <?php echo xlj('Please enter a search term to search for a code'); ?>;", 1],
    [`$searchButton = $('<button class="btn btn-sm btn-outline-primary fa fa-search p-2">').click(function (e) {`, 1],
    [`$clearButton = $('<button type="button" class="btn btn-sm btn-outline-warning fa-solid fa-eraser p-2">').click(function () {`, 1],
    ["$('.dataTables_filter').append($searchButton, $clearButton);", 1],
    ["$('#my_data_table_filter input').focus();", 1],
    // Row selection: limit, then one branch per mode
    ["$('#my_data_table').on('click', 'tbody tr', function () {", 1],
    ['var limit = <?php echo js_escape($limit); ?>;', 1],
    ['var target_element = <?php echo js_escape($target_element); ?>;', 1],
    ['if (Object.values(oChosenIDs).length < limit || limit <= 0) {', 1],
    ['var jobj = JSON.parse(this.id.substring(4));', 1],
    ["selcode(jobj['codetype'], codesel[0] || codeStr, selector, jobj['description'], target_element, limit, jobj['modifier']);", 1],
    ['                    selectField(jobj);', 1],
    ['                    SelectList(jobj);', 1],
    ['                    SelectItem(jobj);', 1],
    ["<?php if ($what == 'codes') { ?>", 4],
    ["<?php } elseif ($what == 'fields') { ?>", 3],
    ["<?php } elseif ($what == 'lists') { ?>", 2],
    ["<?php } elseif ($what == 'groups') { ?>", 3],
    // Opener callbacks, single-selection promise and closing
    ['if (opener.get_related) {', 1],
    ['var acodes = opener.get_related();', 1],
    ["function selcode(codetype, code, selector, codedesc, target_element, limit = 0, modifier = '') {", 1],
    ['if (opener.closed || (!opener.set_related && !opener.set_related_target)) {', 1],
    ['var msg = opener.set_related_target(codetype, code, selector, codedesc, target_element, limit);', 1],
    [lines(
        "                    } else if (singleCodeSelection == '1') {",
        '                        opener.promiseData = JSON.stringify({codetype, code, selector, codedesc});',
        '                        dlgclose();',
    ), 1],
    ['var msg = opener.set_related(codetype, code, selector, codedesc, modifier);', 1],
    ['if (opener.closed || !opener.del_related) {', 1],
    ['opener.del_related(sel.value);', 1],
    ['oTable.fnDraw();', 1],
    ["alert(<?php echo xlj('The destination form was closed; I cannot act on your selection.'); ?>);", 2],
    ['if (opener.closed || !opener.SetField) {', 1],
    ["opener.SetField(jobj['field_id'], jobj['title'], jobj['data_type'], jobj['uor'], jobj['fld_length'],", 1],
    ['"field_id": document.forms[0].new_field_id.value,', 1],
    ['if (opener.closed || !opener.SetList)', 1],
    ["opener.SetList(jobj['code']);", 1],
    ["opener.MoveFields(jobj['code']);", 1],
    [NOT_OPEN, 3],
    ['dlgclose();', 4],
    // Original labels, controls and form
    ['<div class="container-fluid">', 1],
    ['echo "<div class=\'form-group row mb-3\'>\\n";', 1],
    [`echo "<div class='col'><input type='text' class='form-control' name='form_code_type' value='" . attr($codetype) . "' size='5' readonly /></div>\\n";`, 1],
    [`echo "<div class='col'><select name='form_code_type' onchange='oTable.fnDraw()'>\\n";`, 1],
    [`echo "<div class='col'><select class='form-control' name='form_code_type' onchange='oTable.fnDraw()'>\\n";`, 1],
    [`echo ">" . xlt("Product") . "</option>\\n";`, 1],
    [`echo "<input type='checkbox' name='form_include_inactive' value='1' onclick='oTable.fnDraw()' />" .`, 1],
    [`    xlt('Include Inactive') . "\\n";`, 1],
    [`echo "<button class='btn btn-danger btn-sm btn-delete' value='" . xla('Delete') . "' onclick='delcode()'>" . xla('Delete') . "</button>\\n";`, 1],
    [`echo "<select name='form_delcodes'>\\n";`, 1],
    [`echo " <option value=''>" . xlt('All') . "</option>\\n";`, 1],
    [`echo "<button class='btn btn-secondary btn-sm btn-cancel' value='" . xla('Close') . "' onclick='dlgclose()'>" . xla('Close') . "</button>\\n";`, 1],
    [`echo "<button class='btn btn-secondary btn-sm btn-delete' value='" . xla('Delete') . "' onclick='SelectList({\\"code\\":\\"\\"})'>" . xla('Delete') . "</button>\\n";`, 1],
    [lines(
        '            <!-- Exception here: Do not use table-responsive as it breaks datatables',
        '            note by sjp: table-responsive does not go in table but the container div!',
        '            !-->',
        '            <table id="my_data_table" class="table table-striped table-hover table-sm w-100">',
    ), 1],
    ["<th><?php echo xlt('Code'); ?></th>", 1],
    ["<th><?php echo xlt('Description'); ?></th>", 1],
    ["<th><?php echo xlt('Modifier'); ?></th>", 1],
    ['<td colspan="2" class="dataTables_empty">...</td>', 1],
    ["<?php if ($what == 'fields' && $source == 'E') { ?>", 1],
    ["<input type='text' class=\"form-control\" name='new_field_id' size='20' />", 1],
    ["<button class=\"btn btn-secondary\" value='<?php echo xla('Or create this new field ID') ?>' onclick='newField()'>", 1],
];

// Exact element counts in the base route; presentation edits add only the <link>.
const ELEMENT_COUNTS = [
    [/<form[ >]/g, 1],
    [/<input[ >]/g, 3],
    [/<button[ >]/g, 6],
    [/<select[ >]/g, 3],
    [/<option[ >]/g, 4],
    [/<div[ >]/g, 11],
    [/<table[ >]/g, 1],
    [/<h[1-6][ >]/g, 0],
    [/<body[ >]/g, 1],
    [/<script[ >]/g, 1],
    [/<link[ >]/g, 1],
    [/<label[ >]/g, 0],
    [/table-responsive/g, 2],
];

// Business mutations [from, to]: each must be rejected by both suites.
const MUTATIONS = [
    ['find_code_dynamic_ajax.php?csrf_token_form=', 'find_code_dynamic_ajax.php?csrf='],
    ['js_url(CsrfUtils::collectCsrfToken(session: $session))', "js_url('')"],
    ['"bServerSide": true,', '"bServerSide": false,'],
    ['"iDisplayLength": 50,', '"iDisplayLength": 10,'],
    ['"searchDelay": 350,', '"searchDelay": 0,'],
    ['{"sWidth": "60%"}', '{"sWidth": "70%"}'],
    ['{"name": "inactive", "value": (document.forms[0].form_include_inactive.checked ? 1 : 0)}', '{"name": "inactive", "value": 1}'],
    ["$limit = empty($_GET['limit']) ? 0 : (int)$_GET['limit'];", "$limit = 1;"],
    ['length < limit || limit <= 0', 'length < limit'],
    ["jobj['description'], target_element, limit, jobj['modifier']);", "jobj['description'], target_element, limit);"],
    ['                    SelectItem(jobj);', '                    SelectList(jobj);'],
    ['                    selectField(jobj);', '                    newField();'],
    ["} else if (singleCodeSelection == '1') {", "} else if (singleCodeSelection == 1) {"],
    ['opener.promiseData = JSON.stringify({codetype, code, selector, codedesc});', 'opener.promiseData = JSON.stringify({codetype, code});'],
    ['var msg = opener.set_related_target(', 'var msg = opener.set_related('],
    ['opener.del_related(sel.value);', 'opener.del_related();'],
    ["opener.MoveFields(jobj['code']);", "opener.SetList(jobj['code']);"],
    ["nRow.setAttribute('tabindex', '0');", "nRow.setAttribute('tabindex', '-1');"],
    ["$('#my_data_table_filter input').focus();", ''],
    ["<th><?php echo xlt('Modifier'); ?></th>", "<th><?php echo xlt('Mod'); ?></th>"],
    ["xlt('Include Inactive')", "xlt('Show Inactive')"],
    ["btn btn-danger btn-sm btn-delete", "btn btn-secondary btn-sm btn-delete"],
    ['class="table table-striped table-hover table-sm w-100"', 'class="table table-hover table-sm w-100"'],
    ['<div class="container-fluid">', '<div class="container">'],
    [HEADER, String.raw`    <?php Header::setupHeader(['opener', 'datatables', 'datatables-bs']); ?>`],
];

// Mutations inside the declared presentation edits: restore() must refuse them.
const PRESENTATION_MUTATIONS = [
    [`<body id="codes_search" class="${BODY_CLASS}">`, `<body class="${BODY_CLASS}">`],
    ['media="screen" href=', 'media="all" href='],
    [`?v=<?php echo attr_url($clinicalAssets->version('${SHEET_NAME}')); ?>`, ''],
    [`name='theform' class='${DOCUMENT}'>`, `name='theform' class='${DOCUMENT}' style='font-size: 14px'>`],
    ['use OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;', 'use OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets as Assets;'],
];

// Portable route guard: [] when every declared edit and preserved anchor holds.
function routeViolations(php) {
    const out = [];
    for (const [before, after] of changes) {
        if (count(php, after) !== 1) out.push(`presentation edit missing: ${after}`);
        // An additive edit (the import) keeps the original text as a substring of the
        // presented form, so the original may appear exactly as often as inside one `after`.
        if (count(php, before) !== count(after, before)) out.push(`original form still present: ${before}`);
    }
    for (const [anchor, times] of ANCHORS) {
        if (count(php, anchor) !== times) out.push(`preserved source changed: ${anchor}`);
    }
    for (const [pattern, n] of ELEMENT_COUNTS) {
        const seen = (php.match(pattern) || []).length;
        if (seen !== n) out.push(`${pattern} count ${seen}, expected ${n}`);
    }
    // BODY_CLASS once on <body>, once as the prefix of the form's document class.
    if (count(php, BODY_CLASS) !== 2) out.push(`${BODY_CLASS} used outside the two declared classes`);
    if (count(php, SHEET_NAME) !== 2) out.push('stylesheet referenced other than by the single link');
    if (count(php, 'clinical-workspace/') !== 1) out.push('another clinical-workspace asset linked');
    for (const banned of ['<style', 'style=', 'font-family', 'font-size', '<font', 'd-none', 'sr-only', 'visually-hidden', ' hidden', '__title', '__actions', 'workspace.css']) {
        if (count(php, banned) !== 0) out.push(`inline presentation, hiding or invented markup: ${banned}`);
    }
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
    AJAX,
    CALLERS,
    HELPER,
    SHEET,
    SHEET_NAME,
    BODY_CLASS,
    SCOPE,
    DOCUMENT,
    BASELINE_SUPPORTED,
    HEADER,
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
