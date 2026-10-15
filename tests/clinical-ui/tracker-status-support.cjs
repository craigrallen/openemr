'use strict';

/*
 * Shared, history-independent helpers for the patient tracker status popup
 * guards (interface/patient_tracker/patient_tracker_status.php): source
 * readers, the declared route presentation edits and their exact inverse,
 * preserved business anchors with negative mutations, and a minimal CSS
 * reader. Used by tracker-status.test.cjs (portable),
 * tracker-status-baseline.test.cjs (needs the git base commit) and
 * tests/js/tracker-status-popup.test.js (opener/engine contract).
 */

const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '../..');
const ROUTE = 'interface/patient_tracker/patient_tracker_status.php';
const CALLER = 'interface/patient_tracker/patient_tracker.php';
const HELPER = 'src/Common/Assets/ClinicalWorkspaceAssets.php';
const SHEET_NAME = 'tracker-status-popup.css';
const SHEET = `interface/clinical-workspace/${SHEET_NAME}`;
const BODY_CLASS = 'oe-tracker-status-popup';
// popup.js toggles its classes on <html> only; the genuine-popup class activates this sheet.
const SCOPE = `html.oe-workbench-popup body.${BODY_CLASS}`;
const DOCUMENT = `${BODY_CLASS}__document`;
const TITLE = `${BODY_CLASS}__title`;
const ACTIONS = `${BODY_CLASS}__actions`;

const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const exists = file => fs.existsSync(path.join(root, file));
const count = (text, part) => text.split(part).length - 1;
const lines = (...parts) => parts.join('\n');

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
const HEADER = String.raw`        <?php Header::setupHeader(['common','opener']); ?>`;
const LINK = lines(
    String.raw`        <?php $clinicalAssets = new ClinicalWorkspaceAssets(); ?>`,
    String.raw`        <link rel="stylesheet" media="screen" href="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>/interface/clinical-workspace/${SHEET_NAME}?v=<?php echo attr_url($clinicalAssets->version('${SHEET_NAME}')); ?>">`,
);

const changes = [
    [
        lines(String.raw`require_once("$srcdir/patient_tracker.inc.php");`, '', String.raw`use OpenEMR\Common\Csrf\CsrfUtils;`),
        lines(String.raw`require_once("$srcdir/patient_tracker.inc.php");`, '', String.raw`use OpenEMR\Common\Assets\ClinicalWorkspaceAssets;`, String.raw`use OpenEMR\Common\Csrf\CsrfUtils;`),
    ],
    [lines(HEADER, '    </head>'), lines(HEADER, LINK, '    </head>')],
    [
        lines('<body>', '    <div class="container mt-3">'),
        lines(`<body class="${BODY_CLASS}">`, `    <div class="container mt-3 ${DOCUMENT}">`),
    ],
    [
        String.raw`<h2><?php echo xlt('Change Status for')`,
        String.raw`<h2 class="${TITLE}"><?php echo xlt('Change Status for')`,
    ],
    ['<div class="btn-group" role="group">', `<div class="btn-group ${ACTIONS}" role="group">`],
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
// Preserved business source, copied from the base route. Each must appear
// exactly once; the baseline suite proves they match the base.
// ---------------------------------------------------------------------------
const ANCHORS = [
    // Session, CSRF, request
    '$session = SessionWrapperFactory::getInstance()->getActiveSession();',
    lines('if (!empty($_GET)) {', '    CsrfUtils::checkCsrfInput(INPUT_GET, dieOnFail: true);', '}'),
    "$tracker_id = $_GET['tracker_id'];",
    HEADER,
    // Tracker SQL and fields
    lines(
        '$trow = sqlQuery("SELECT apptdate, appttime, patient_tracker_element.room AS lastroom, " .',
        '                        "patient_tracker_element.status AS laststatus, eid, random_drug_test, encounter, pid " .',
        '                        "FROM patient_tracker " .',
        '                        "LEFT JOIN patient_tracker_element " .',
        '                        "ON patient_tracker.id = patient_tracker_element.pt_tracker_id " .',
        '                        "AND patient_tracker.lastseq = patient_tracker_element.seq " .',
        String.raw`                        "WHERE patient_tracker.id =?", [$_GET['tracker_id']]);`,
    ),
    lines("$tkpid = $trow['pid'];", "$appttime = $trow['appttime'];", "$apptdate = $trow['apptdate'];", "$pceid = $trow['eid'];", "$theroom = '';"),
    // Status write with automatic encounter
    lines("if (!empty($_POST['statustype'])) {", '    CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: true);'),
    lines("    $status = $_POST['statustype'];", "    if (strlen((string) $_POST['roomnum']) != 0) {", "         $theroom = $_POST['roomnum'];", '    }'),
    '$is_tracker = is_tracker_encounter_exist($apptdate, $appttime, $tkpid, $pceid);',
    "if (OEGlobalsBag::getInstance()->get('auto_create_new_encounters') && $apptdate == date('Y-m-d') && (is_checkin($status) == '1') && !$is_tracker) {",
    lines(
        '$genenc = sqlQuery("select pc_catid as category, pc_hometext as reason, pc_aid as provider, pc_facility as facility, pc_billing_location as billing_facility " .',
        '                      "from openemr_postcalendar_events where pc_eid =? ", [$pceid]);',
    ),
    "$encounter = todaysEncounterCheck($tkpid, $apptdate, $genenc['reason'], $genenc['facility'], $genenc['billing_facility'], $genenc['provider'], $genenc['category'], false);",
    "manage_tracker_status($apptdate, $appttime, $pceid, $tkpid, $session->get('authUser'), $status, $theroom, $encounter);",
    "manage_tracker_status($apptdate, $appttime, $pceid, $tkpid, $session->get('authUser'), $status, $theroom, $is_tracker);",
    // Opener refresh and close
    lines(
        String.raw`    echo "<body>\n<script>\n";`,
        String.raw`    echo " window.opener.document.flb.submit();\n";`,
        String.raw`    echo " dlgclose();\n";`,
        String.raw`    echo "</script></body></html>\n";`,
        '    exit();',
    ),
    lines('$row = sqlQuery("select fname, lname " .', '"from patient_data where pid =? limit 1", [$tkpid]);'),
    // Form, labels, controls and options
    String.raw`<?php echo xlt('Change Status for') . " " . text($row['fname']) . " " . text($row['lname']); ?></h2>`,
    String.raw`<form id="form_note" method="post" action="patient_tracker_status.php?tracker_id=<?php echo attr_url($tracker_id) ?>&csrf_token_form=<?php echo CsrfUtils::collectCsrfToken(session: $session); ?>" enctype="multipart/form-data" >`,
    String.raw`<input type="hidden" name="csrf_token_form" value="<?php echo CsrfUtils::collectCsrfToken(session: $session); ?>" />`,
    String.raw`<label for="statustype"><?php echo xlt('Status Type'); ?></label>`,
    String.raw`<?php echo generate_select_list('statustype', 'apptstat', $trow['laststatus'], xl('Status Type')); ?>`,
    String.raw`<label for="roomnum"><?php  echo xlt('Exam Room Number'); ?></label>`,
    String.raw`<?php echo generate_select_list('roomnum', 'patient_flow_board_rooms', $trow['lastroom'], xl('Exam Room Number')); ?>`,
    '<div class="position-override">',
    String.raw`<button type="button" class='btn btn-primary btn-save btn-sm' onclick='document.getElementById("form_note").submit();'><?php echo xlt('Save')?></button>`,
    String.raw`<button type="button" class='btn btn-secondary btn-cancel btn-sm' onclick="dlgclose();" ><?php echo xlt('Cancel'); ?></button>`,
];

// Exact element counts in the base route; presentation edits add only the <link>.
const ELEMENT_COUNTS = [
    [/<form[ >]/g, 1],
    [/<input[ >]/g, 1],
    [/<button[ >]/g, 2],
    [/<label[ >]/g, 2],
    [/<div[ >]/g, 7],
    [/<h[1-6][ >]/g, 1],
    // The rendered body plus the echoed POST response body.
    [/<body[ >]/g, 2],
    [/<script[ >]/g, 1],
    [/<link[ >]/g, 1],
    [/generate_select_list\(/g, 2],
];

// Business mutations [from, to]: each must be rejected by both suites.
const MUTATIONS = [
    ['CsrfUtils::checkCsrfInput(INPUT_GET, dieOnFail: true);', ''],
    ['checkCsrfInput(INPUT_POST, dieOnFail: true)', 'checkCsrfInput(INPUT_POST, dieOnFail: false)'],
    ['getActiveSession()', 'getSession()'],
    ['<input type="hidden" name="csrf_token_form"', '<input type="hidden" name="csrf_token"'],
    ['AND patient_tracker.lastseq = patient_tracker_element.seq', 'AND 1'],
    ["get('auto_create_new_encounters')", "get('auto_create_encounters')"],
    ["(is_checkin($status) == '1')", "(is_checkin($status) == '0')"],
    ['$status, $theroom, $is_tracker);', '$status, $theroom, 0);'],
    [String.raw`    echo " window.opener.document.flb.submit();\n";`, ''],
    [String.raw`echo " dlgclose();\n";`, String.raw`echo " window.close();\n";`],
    ['onclick="dlgclose();"', 'onclick="window.close();"'],
    ["generate_select_list('statustype', 'apptstat',", "generate_select_list('statustype', 'apptstat_custom',"],
    ["'patient_flow_board_rooms', $trow['lastroom']", "'patient_flow_board_rooms', ''"],
    ["<?php  echo xlt('Exam Room Number'); ?>", "<?php echo xlt('Room'); ?>"],
    ["xlt('Save')?>", "xlt('Submit')?>"],
    ['btn btn-secondary btn-cancel btn-sm', 'btn btn-secondary btn-cancel'],
    ["Header::setupHeader(['common','opener'])", "Header::setupHeader(['common'])"],
    ['<div class="position-override">', '<div class="position-override d-none">'],
    ['enctype="multipart/form-data"', 'enctype="application/x-www-form-urlencoded"'],
];

// Mutations inside the declared presentation edits: restore() must refuse them.
const PRESENTATION_MUTATIONS = [
    [`<body class="${BODY_CLASS}">`, `<body class="${BODY_CLASS}" hidden>`],
    ['media="screen" href=', 'media="all" href='],
    [`<div class="container mt-3 ${DOCUMENT}">`, `<div class="container-fluid mt-3 ${DOCUMENT}">`],
    [`<h2 class="${TITLE}">`, `<h3 class="${TITLE}">`],
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
    for (const banned of ['<style', 'style=', 'font', 'd-none', 'sr-only', 'visually-hidden', ' hidden>', ' hidden ']) {
        if (count(php, banned) !== 0) out.push(`inline presentation or hiding added: ${banned}`);
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
    CALLER,
    HELPER,
    SHEET,
    SHEET_NAME,
    BODY_CLASS,
    SCOPE,
    DOCUMENT,
    TITLE,
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
