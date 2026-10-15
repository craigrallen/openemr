'use strict';

// Shared, dependency-free contract for the Appointment Finder popup presentation
// slice (interface/main/calendar/find_appt_popup.php, opened by add_edit_event.js
// via dlgopen(..., 'find_appt_popup', 725, 200, ...)). Source contracts only:
// native control fit, rendered contrast and clinical acceptance are NOT proven here.
// No content hashes: exact byte comparison against the baseline lives in the
// explicit local-history suite (appointment-finder-history.cjs), which uses `git show`.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const BASELINE_COMMIT = '18647270e0c799189d2dc10f801e8de2bff1a360';

const ROUTE = 'interface/main/calendar/find_appt_popup.php';
const ASSETS = 'src/Common/Assets/ClinicalWorkspaceAssets.php';
const CSS = 'interface/clinical-workspace/appointment-finder-popup.css';
const SHEET = 'appointment-finder-popup.css';

const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const count = (text, part) => text.split(part).length - 1;

// ---- Declared route presentation additions: [original, planned].

const LINK = '    <link rel="stylesheet" media="screen" href="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>'
    + `/interface/clinical-workspace/${SHEET}?v=<?php echo attr_url($clinicalAssets->version('${SHEET}')); ?>">`;
const TITLE = "    <title><?php echo xlt('Find Available Appointments'); ?></title>\n";
const BODY = '<body class="body_top oe-appointment-finder-popup">';
const DOCUMENT_DIV = '<div class="container-fluid oe-appointment-finder-popup__document">';

// The sheet is linked after the cktime early-exit block, so the auto-submitting
// "Time slot is available" body is emitted exactly as before.
const ROUTE_ADDITIONS = [
    [
        'use OpenEMR\\Common\\Acl\\AclMain;\nuse OpenEMR\\Common\\Calendar\\ConfiguredScheduleHours;\n',
        'use OpenEMR\\Common\\Acl\\AclMain;\nuse OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;\nuse OpenEMR\\Common\\Calendar\\ConfiguredScheduleHours;\n',
    ],
    [
        '}\n?>\n\n    <script>\n        function setappt(',
        `}\n?>\n    <?php $clinicalAssets = new ClinicalWorkspaceAssets(); ?>\n${LINK}\n\n    <script>\n        function setappt(`,
    ],
    ['<body class="body_top">\n', `${BODY}\n`],
    ['<div class="container-fluid">\n', `${DOCUMENT_DIV}\n`],
];
const ASSET_ADDITIONS = [
    [
        "        'ajtooltip.js',\n        'appointment.css',\n",
        `        'ajtooltip.js',\n        '${SHEET}',\n        'appointment.css',\n`,
    ],
];

// Presentation markers that must not survive the declared inverse.
const PRESENTATION_MARKERS = ['ClinicalWorkspaceAssets', 'appointment-finder-popup', '$clinicalAssets', '<link '];

// Business and legacy-presentation anchors with their baseline occurrence counts.
// The explicit-history suite validates every count against the baseline commit.
const ROUTE_ANCHORS = [
    // Access control (inherited: no CSRF on this route; not a presentation concern).
    ["AclMain::aclCheckCore('patients', 'appt', '', ['write','wsome'])", 1],
    ['AccessDeniedHelper::denyWithTemplate(', 1],
    ["AclMain::aclCheckCore('patients', 'appt', '', 'write')", 1],
    ['CsrfUtils', 0],
    // SQL, recurrence, slot, holiday and configured-hours logic.
    ['"pc_recurrtype, pc_recurrspec, pc_alldayevent, pc_catid, pc_prefcatid " .', 1],
    ['"FROM openemr_postcalendar_events " .', 1],
    ['"pc_eid != ? AND " .', 1],
    ['array_push($sqlBindArray, $providerid, $eid, $sdate, $edate, $sdate, $edate);', 1],
    ['$query .= " AND pc_facility = ?";', 1],
    ['fetchEvents($sdate, $edate, null, null, false, 0, $sqlBindArray, $query);', 1],
    ['$slots[$i] |= 4;', 2],
    ['$holidays = $holidayService->getHolidaysByDateRange($sdateStr, $edate);', 1],
    ['if (in_array($sdateStr, $holidays, true)) {', 1],
    ['ConfiguredScheduleHours::normalizeWindow(', 1],
    ['ConfiguredScheduleHours::containsSlot(', 2],
    ['if (!ConfiguredScheduleHours::containsSlot($utime, $evslots, $slotsecs, $scheduleStartHour, $scheduleEndHour)) {', 1],
    ['$i += $evslots - 1;', 1],
    // cktime early exit: auto-submits the opener; must stay byte-for-byte.
    ["if (isset($_REQUEST['cktime'])) {", 1],
    [String.raw`echo " opener.document.forms[0].submit();\n";`, 1],
    [String.raw`setTimeout(\"mytimeout()\",2500);`, 1],
    ["xlt('Time slot is available, saving event')", 1],
    ['exit();', 1],
    // Opener callbacks and confirmations.
    ['opener.document.forms[0].submit();', 3],
    ['opener.top.restoreSession();', 3],
    ['dlgclose();', 4],
    ['if (opener.closed || ! opener.setappt) {', 1],
    ['opener.setappt(year,mon,mday,hours,minutes);', 1],
    ["onclick='return setappt(", 1],
    ["xlj('On this date there is a holiday, use it anyway?')", 2],
    ["xlj('Provider not available, use it anyway?')", 1],
    ["xlj('This appointment slot is already used, use it anyway?')", 1],
    // Original scripts: hover highlights and date picker.
    ['$(".oneresult").mouseover(function() { $(this).toggleClass("highlight"); });', 1],
    ['$(".oneresult").mouseout(function() { $(this).toggleClass("highlight"); });', 1],
    ['$(".oneresult a").mouseover(function () { $(this).toggleClass("blue_highlight"); $(this).children().toggleClass("blue_highlight"); });', 1],
    ['$(".oneresult a").mouseout(function() { $(this).toggleClass("blue_highlight"); $(this).children().toggleClass("blue_highlight"); });', 1],
    ["$('.datepicker').datetimepicker({", 1],
    ["<?php Header::setupHeader(['common', 'datetime-picker', 'opener']); ?>", 1],
    // Controls and result structure.
    [`<form class="form-inline" method='post' name='theform' action='find_appt_popup.php?providerid=<?php echo attr_url($providerid) ?>&catid=<?php echo attr_url($input_catid) ?>'>`, 1],
    ["<input type='text' class='datepicker input-sm form-control' name='startdate' id='startdate' size='10'", 1],
    [`<input type='text' class="input-sm form-control" name='searchdays' size='3'`, 1],
    ["<button type='submit' class='btn btn-primary btn-search'>", 1],
    ['<div id="searchCriteria">', 1],
    ['<div class="table-responsive">', 1],
    ['<table class="table">', 1],
    ['<thead id="searchResultsHeader" class="head">', 1],
    ['<tbody id="searchResults">', 1],
    [`echo "<div id='am'>AM ";`, 1],
    [`echo "</div><div id='pm'>PM ";`, 1],
    // Original inline <style>: unchanged, including AM/PM semantics and highlights.
    ['<style>', 1],
    ['</style>', 1],
    ['background-color: #ddddff;', 1],
    ['background-color: var(--white);', 2],
    ['background-color: #ff9;', 1],
    ['background-color: #336699;', 1],
    ['#am {\n            border-bottom: 1px solid var(--gray);\n            color: var(--primary);\n        }', 1],
    ['#pm {\n            color: var(--danger);\n        }', 1],
    ['#pm a {\n            color: var(--danger);\n        }', 1],
    // No wrappers, no inline style attributes, no font or !important changes.
    ['<div', 5],
    ['<body', 2],
    ['<script>', 3],
    ['style=', 0],
    ['font-size', 2],
    ['!important', 0],
];

function reverse(text, additions) {
    let restored = text;
    for (const [before, after] of additions) {
        if (count(restored, after) !== 1) {
            throw new Error(`planned addition must occur exactly once: ${JSON.stringify(after)}`);
        }
        restored = restored.replace(after, () => before);
    }
    return restored;
}

// Portable route contract: declared inverse is possible and strips every
// presentation marker; additions are exact and correctly placed; business anchors
// keep their baseline counts in both the working tree and the inverse.
function routeContractErrors(php) {
    const errors = [];
    let restored = null;
    try {
        restored = reverse(php, ROUTE_ADDITIONS);
    } catch (error) {
        errors.push(`inverse: ${error.message}`);
    }
    if (restored !== null) {
        for (const marker of PRESENTATION_MARKERS) {
            if (restored.includes(marker)) errors.push(`inverse retains presentation marker: ${marker}`);
        }
    }
    const exact = [
        ['use OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;', 1],
        ['$clinicalAssets = new ClinicalWorkspaceAssets();', 1],
        ['ClinicalWorkspaceAssets', 2],
        ['$clinicalAssets', 2],
        [LINK, 1],
        [SHEET, 2],
        ['<link ', 1],
        ['media="screen"', 1],
        [BODY, 1],
        [DOCUMENT_DIV, 1],
        ['container-fluid', 1],
    ];
    for (const [part, expected] of exact) {
        if (count(php, part) !== expected) errors.push(`presentation ${JSON.stringify(part)}: ${count(php, part)} != ${expected}`);
    }
    // Class tokens, not substrings: the document class shares the body class prefix.
    const tokens = (php.match(/\boe-appointment-finder-popup(?:__[\w-]+)?\b/g) || []).sort();
    if (JSON.stringify(tokens) !== JSON.stringify(['oe-appointment-finder-popup', 'oe-appointment-finder-popup__document'])) {
        errors.push(`popup class tokens: ${JSON.stringify(tokens)}`);
    }
    // Placement: after the cktime early exit, before the original setappt script and </head>.
    const link = php.indexOf(LINK);
    const cktime = php.indexOf("if (isset($_REQUEST['cktime'])) {");
    const exit = php.indexOf('exit();');
    const setappt = php.indexOf('function setappt(');
    const head = php.lastIndexOf('\n</head>');
    if (!(link > 0 && cktime > 0 && exit > cktime && link > exit && link < setappt && link < head)) {
        errors.push('stylesheet link must follow the cktime early exit and precede the original script');
    }
    if (cktime > 0 && exit > cktime) {
        const early = php.slice(cktime, exit);
        for (const marker of PRESENTATION_MARKERS) {
            if (early.includes(marker)) errors.push(`early-success body carries presentation marker: ${marker}`);
        }
    }
    for (const [anchor, expected] of ROUTE_ANCHORS) {
        if (count(php, anchor) !== expected) errors.push(`anchor ${JSON.stringify(anchor)}: ${count(php, anchor)} != ${expected}`);
        if (restored !== null && count(restored, anchor) !== expected) {
            errors.push(`inverse anchor ${JSON.stringify(anchor)}: ${count(restored, anchor)} != ${expected}`);
        }
    }
    return errors;
}

// Route edits the contract must reject: [label, unique anchor, replacement].
const ROUTE_MUTATIONS = [
    ['ACL widened', "['write','wsome']", "['write','wsome','addonly']"],
    ['confirm ACL relaxed', "AclMain::aclCheckCore('patients', 'appt', '', 'write')", "AclMain::aclCheckCore('patients', 'appt', '', 'wsome')"],
    ['reserved-slot SQL changed', '"pc_eid != ? AND " .', '"pc_eid >= ? AND " .'],
    ['facility filter removed', '            $query .= " AND pc_facility = ?";\n', ''],
    ['recurrence fetch changed', 'fetchEvents($sdate, $edate, null, null, false, 0, $sqlBindArray, $query);', 'fetchEvents($sdate, $edate, null, null, true, 0, $sqlBindArray, $query);'],
    ['holiday check removed', 'if (in_array($sdateStr, $holidays, true)) {', 'if (false) {'],
    ['configured hours ignored', 'if (!ConfiguredScheduleHours::containsSlot($utime, $evslots, $slotsecs, $scheduleStartHour, $scheduleEndHour)) {', 'if (false) {'],
    ['cktime auto-submit removed', String.raw`            echo " opener.document.forms[0].submit();\n";` + '\n', ''],
    ['cktime delay changed', String.raw`setTimeout(\"mytimeout()\",2500);`, String.raw`setTimeout(\"mytimeout()\",0);`],
    ['setappt callback rewired', 'opener.setappt(year,mon,mday,hours,minutes);', 'opener.set_appt(year,mon,mday,hours,minutes);'],
    ['row hover highlight removed', '$(".oneresult").mouseover(function() { $(this).toggleClass("highlight"); });', ''],
    ['search control removed', "<button type='submit' class='btn btn-primary btn-search'>", "<button type='button' class='btn btn-primary btn-search'>"],
    ['inline criteria colour changed', 'background-color: #ddddff;', 'background-color: #fff;'],
    ['PM semantic colour dropped', '#pm a {\n            color: var(--danger);\n        }', '#pm a {\n        }'],
    ['wrapper div added', '    <div id="searchCriteria">', '    <div class="oe-appointment-finder-popup__criteria"><div id="searchCriteria">'],
    ['inline style attribute added', '<table class="table">', '<table class="table" style="font-size: 12px">'],
    ['CSRF retrofitted in presentation slice', 'use OpenEMR\\Common\\Calendar\\ConfiguredScheduleHours;\n', 'use OpenEMR\\Common\\Calendar\\ConfiguredScheduleHours;\nuse OpenEMR\\Common\\Csrf\\CsrfUtils;\n'],
    ['body popup scope dropped', BODY, '<body class="body_top">'],
    ['body_top dropped', BODY, '<body class="oe-appointment-finder-popup">'],
    ['document scope dropped', DOCUMENT_DIV, '<div class="container-fluid">'],
    ['stylesheet leaks to print', 'media="screen"', 'media="all"'],
    ['wrong asset version key', `version('${SHEET}')`, "version('appointment.css')"],
];

// ---- Callers, shared popup frame, theme and engine sources that stay unchanged.

const UNCHANGED = [
    'interface/main/calendar/add_edit_event.js',
    'interface/main/calendar/add_edit_event.php',
    'library/dialog.js',
    'library/appointments.inc.php',
    'src/Common/Calendar/ConfiguredScheduleHours.php',
    'src/Services/HolidayService.php',
    'interface/clinical-workspace/popup.js',
    'interface/clinical-workspace/popup.css',
    'interface/clinical-workspace/workspace.css',
    'interface/themes/theme-defaults.scss',
    'interface/themes/default-variables.scss',
    'interface/themes/oe-styles/style_dark.scss',
    'interface/themes/color_base.scss',
    'interface/themes/colors/style_cobalt_blue.scss',
];

// Workbench tokens as actually defined by the shared popup frame; the sheet's
// var() fallbacks must equal these.
const TOKEN_VALUES = { ink: '#17343b', paper: '#fff', canvas: '#f3f7f5', line: '#d9e4e2', petrol: '#086878' };

const CALLER_ANCHORS = [
    ['interface/main/calendar/add_edit_event.js', "dlgopen(url.pathname + url.search + extra, 'find_appt_popup', 725, 200, '', title);", 1],
    ['interface/main/calendar/add_edit_event.js', "addEditEventConfig.webRoot + '/interface/main/calendar/find_appt_popup.php',", 1],
    ['interface/main/calendar/add_edit_event.js', 'function setappt(year, mon, mday, hours, minutes) {', 1],
    ['interface/clinical-workspace/popup.css', 'html.oe-workbench-popup body {', 1],
    ['interface/clinical-workspace/popup.css', 'html.oe-workbench-popup .btn-primary,', 1],
    ...Object.entries(TOKEN_VALUES).map(([name, value]) => ['interface/clinical-workspace/popup.css', `    --oe-wb-${name}: ${value};`, 1]),
    // Dark theme inverts $white, so the route's own var(--white) table fills are dark there.
    ['interface/themes/oe-styles/style_dark.scss', '$white: #000;', 1],
    ['interface/themes/oe-styles/style_dark.scss', '$body-color: $gray-900;', 1],
    // Dark theme links are near-white: on the new paper, AM anchors need the AM ink.
    ['interface/themes/oe-styles/style_dark.scss', '$link-color: #f0f0f0;', 1],
    // Source proof for the single allowlisted !important (colour themes import color_base).
    ['interface/themes/color_base.scss', '.body_top,\n.bgcolor2,\n.body_nav {\n  background-color: $paler !important;\n}', 1],
    ['interface/themes/colors/style_cobalt_blue.scss', '@import "../color_base";', 1],
];

// ---- Minimal CSS reader (comments stripped, nested blocks, paren-aware selectors).

function splitTopLevel(text, separator) {
    const parts = [];
    let depth = 0;
    let current = '';
    for (const ch of text) {
        if (ch === '(' || ch === '[') depth++;
        if (ch === ')' || ch === ']') depth--;
        if (ch === separator && depth === 0) {
            parts.push(current);
            current = '';
        } else {
            current += ch;
        }
    }
    parts.push(current);
    return parts;
}

function parseCss(text) {
    const src = text.replace(/\/\*[\s\S]*?\*\//g, '');
    if (src.includes('/*')) throw new Error('unterminated comment');
    let i = 0;
    const flush = (buffer, nodes) => {
        const raw = buffer.trim();
        if (raw === '') return;
        const colon = raw.indexOf(':');
        if (colon < 1) throw new Error(`unparsable declaration: ${raw}`);
        let value = raw.slice(colon + 1).trim();
        const important = /!\s*important$/i.test(value);
        if (important) value = value.replace(/\s*!\s*important$/i, '');
        nodes.push({ type: 'decl', prop: raw.slice(0, colon).trim().toLowerCase(), value: value.replace(/\s+/g, ' '), important });
    };
    const block = depth => {
        const nodes = [];
        let buffer = '';
        while (i < src.length) {
            const ch = src[i++];
            if (ch === '{') {
                const head = buffer.trim();
                buffer = '';
                const children = block(depth + 1);
                if (head.startsWith('@')) {
                    const match = head.match(/^@([\w-]+)\s*([\s\S]*)$/);
                    nodes.push({ type: 'atrule', name: match[1], params: match[2].trim().replace(/\s+/g, ' '), nodes: children });
                } else {
                    nodes.push({ type: 'rule', selectors: splitTopLevel(head, ',').map(s => s.trim().replace(/\s+/g, ' ')), nodes: children });
                }
            } else if (ch === '}') {
                if (depth === 0) throw new Error('unbalanced closing brace');
                flush(buffer, nodes);
                return nodes;
            } else if (ch === ';') {
                flush(buffer, nodes);
                buffer = '';
            } else {
                buffer += ch;
            }
        }
        if (depth !== 0) throw new Error('unclosed block');
        flush(buffer, nodes);
        return nodes;
    };
    return block(0);
}

// ---- Exact planned stylesheet contract.

const SCOPE = 'html.oe-workbench-popup body.oe-appointment-finder-popup';
const DOC = `${SCOPE} .oe-appointment-finder-popup__document`;
const token = name => `var(--oe-wb-${name}, ${TOKEN_VALUES[name]})`;
const INK = token('ink');
const PAPER = token('paper');
const CANVAS = token('canvas');
const LINE = token('line');
const ACCENT = token('petrol');

// Typeable text fields only: readonly, disabled, native widgets (non-text types)
// and explicit Bootstrap validation states (.is-*, or a .was-validated form) keep
// their own palette. Complex :not() list (the repo's stylelint requires this
// notation); engines without selector-list :not() skip these rules, see the doc.
// The real inputs are direct children of the original .form-inline form.
const FIELD_EXCLUSION = ':not([readonly], :disabled, .is-invalid, .is-valid)';
const FIELD_FORM = '#searchCriteria > form.form-inline:not(.was-validated) > ';
const FIELD_BARE = `${DOC} ${FIELD_FORM}input.form-control[type='text']`;
const FIELD = `${FIELD_BARE}${FIELD_EXCLUSION}`;
const FIELD_RING = [['outline', `2px solid ${ACCENT}`], ['outline-offset', '1px']];
// Result links sit inside .table-responsive (overflow-x: auto): an inset ring is not clipped.
const LINK_RING = [['outline', `2px solid ${ACCENT}`], ['outline-offset', '-2px']];

// Ordered. Every colour is paired with a background on the same rule. Neutral table
// ink is set on the table/header/body containers only, so #am/#pm, links and the
// .highlight/.blue_highlight hover classes keep their own colours. Simple :focus
// fallbacks and :focus-visible rules are separate rules so a browser that rejects
// :focus-visible does not drop the fallback. No button, font or layout changes.
// Specificity (ids + scoped classes) outranks the route's inline #id rules and the
// dark theme's var(--white) fill without !important; only the body canvas needs it.
// One intentional corrective exception: AM result anchors inherit the route's own
// #am var(--primary) ink instead of the theme link colour (dark $link-color is
// near-white on paper). Hovered anchors (.blue_highlight) and PM anchors are
// excluded, and the background stays transparent so row highlights show through.
// This is not the unchanged computed link colour; effective contrast stays open.
const AM_ANCHOR = `${DOC} #am a:not(.blue_highlight)`;
const AM_ANCHOR_DECLS = [['color', 'inherit'], ['background-color', 'transparent']];
const CSS_RULES = [
    { selectors: [SCOPE], decls: [['color', INK], ['background-color', `${CANVAS} !important`]] },
    { selectors: [DOC], decls: [['color', INK], ['background-color', PAPER], ['border', `1px solid ${LINE}`]] },
    { selectors: [`${DOC} #searchCriteria`], decls: [['color', INK], ['background-color', CANVAS], ['border-bottom', `1px solid ${LINE}`]] },
    { selectors: [`${DOC} #searchCriteria > .form-inline`], decls: [['flex-wrap', 'wrap']] },
    {
        selectors: [`${DOC} .table-responsive > .table`, `${DOC} #searchResultsHeader`, `${DOC} #searchResults`],
        decls: [['color', INK], ['background-color', PAPER]],
    },
    { selectors: [FIELD], decls: [['color', INK], ['background-color', PAPER]] },
    { selectors: [`${FIELD}:focus`], decls: [['color', INK], ['background-color', PAPER], ...FIELD_RING] },
    { selectors: [`${FIELD}:focus-visible`], decls: [...FIELD_RING] },
    { selectors: [`${DOC} #searchResults a:focus`], decls: [...LINK_RING] },
    { selectors: [`${DOC} #searchResults a:focus-visible`], decls: [...LINK_RING] },
    { selectors: [AM_ANCHOR], decls: AM_ANCHOR_DECLS },
];

// Exact [selector, property, value] triples allowed to carry !important. Source
// proof: interface/themes/color_base.scss (imported by the colour themes) sets
// `.body_top { background-color: $paler !important; }`, and this body is .body_top,
// so only the scoped body canvas needs it. No theme source read sets an !important
// ink colour on .body_top, .table or the result table, so ink stays normal.
const IMPORTANT_ALLOWLIST = [[SCOPE, 'background-color', CANVAS]];

const ALLOWED_PROPS = ['color', 'background-color', 'border', 'border-bottom', 'flex-wrap', 'outline', 'outline-offset'];
const RING_PROPS = ['outline', 'outline-offset'];
// Semantic colours, hover highlights, buttons, cells and descendants stay with the route/theme.
const FORBIDDEN_SELECTOR = /#am\b|#pm\b|\.highlight|\.blue_highlight|\.oneresult|\.srDate|\.srTimes|\.invisible|:hover|:active|\.btn|\bbutton\b|\btd\b|\btr\b|\bth\b|\bdiv\b|\bspan\b|\bselect\b|\btextarea\b|\*/;
const LINK_SELECTOR = /(?:^|\s)a(?=[:.[\s]|$)/;

function serializeCss(rules = CSS_RULES) {
    const body = rules.map(rule => `  ${rule.selectors.join(',\n  ')} {\n${rule.decls.map(([p, v]) => `    ${p}: ${v};`).join('\n')}\n  }`).join('\n\n');
    return `@media screen {\n${body}\n}\n`;
}

const asRules = nodes => nodes.filter(n => n.type === 'rule').map(n => ({
    selectors: n.selectors,
    decls: n.nodes.filter(d => d.type === 'decl').map(d => [d.prop, d.important ? `${d.value} !important` : d.value]),
}));

// Real sheet as contract-shaped rules (for per-rule targeted mutations).
function sheetRules(text) {
    const tree = parseCss(text);
    if (tree.length !== 1 || tree[0].type !== 'atrule') throw new Error('expected a single at-rule');
    return asRules(tree[0].nodes);
}

function cssContractErrors(text) {
    let tree;
    try {
        tree = parseCss(text);
    } catch (error) {
        return [`parse: ${error.message}`];
    }
    const errors = [];
    if (tree.length !== 1 || tree[0].type !== 'atrule' || tree[0].name !== 'media' || tree[0].params !== 'screen') {
        return ['top level must be exactly one @media screen block (print and legacy keep their rendering)'];
    }
    const focusSelectors = new Set();
    for (const node of tree[0].nodes) {
        if (node.type !== 'rule') {
            errors.push(`unexpected ${node.type} inside @media screen`);
            continue;
        }
        const props = new Map();
        for (const child of node.nodes) {
            if (child.type !== 'decl') {
                errors.push(`nested ${child.type} in ${node.selectors[0]}`);
                continue;
            }
            props.set(child.prop, child.value);
            if (!ALLOWED_PROPS.includes(child.prop)) errors.push(`forbidden property: ${child.prop}`);
            if (child.important && !node.selectors.every(s => IMPORTANT_ALLOWLIST.some(([sel, prop, value]) => sel === s && prop === child.prop && value === child.value))) {
                errors.push(`!important outside allowlist: ${child.prop}`);
            }
            for (const ref of child.value.match(/var\([^()]*\)/g) || []) {
                const match = ref.match(/^var\(--oe-wb-([\w-]+), (#[0-9a-f]+)\)$/);
                if (!match || TOKEN_VALUES[match[1]] !== match[2]) errors.push(`token without real fallback: ${ref}`);
            }
        }
        if (props.has('color') !== props.has('background-color')) errors.push(`unpaired ink/background: ${node.selectors[0]}`);
        const ringOnly = [...props.keys()].every(p => RING_PROPS.includes(p));
        const kinds = new Set(node.selectors.map(s => (/:focus-visible$/.test(s) ? 'visible' : /:focus$/.test(s) ? 'focus' : 'other')));
        if (kinds.size > 1) errors.push(`:focus, :focus-visible and plain selectors must be separate rules: ${node.selectors[0]}`);
        if (kinds.has('visible') && !ringOnly) errors.push(`:focus-visible rule changes more than the ring: ${node.selectors[0]}`);
        for (const selector of node.selectors) {
            if (selector !== SCOPE && !selector.startsWith(`${SCOPE} `)) errors.push(`unscoped selector: ${selector}`);
            if (selector === AM_ANCHOR) {
                // The only permitted #am / link paint: exact, alone, inherit + transparent.
                if (node.selectors.length !== 1 || JSON.stringify([...props]) !== JSON.stringify(AM_ANCHOR_DECLS)) {
                    errors.push(`AM anchor rule must be exactly color: inherit; background-color: transparent: ${selector}`);
                }
                continue;
            }
            if (FORBIDDEN_SELECTOR.test(selector)) errors.push(`forbidden selector: ${selector}`);
            if (selector.includes('.form-control') && !(selector.includes(FIELD_FORM) && selector.includes(`[type='text']${FIELD_EXCLUSION}`))) {
                errors.push(`field selector lacks readonly/disabled/native/validation exclusion: ${selector}`);
            }
            if (LINK_SELECTOR.test(selector)) {
                if (!/:focus(?:-visible)?$/.test(selector) || !ringOnly) errors.push(`link selector beyond a focus ring: ${selector}`);
                if (!/^-/.test(props.get('outline-offset') || '')) errors.push(`link ring would be clipped by .table-responsive: ${selector}`);
            }
            if (/:focus$/.test(selector)) focusSelectors.add(selector);
        }
        if (kinds.has('visible')) {
            for (const selector of node.selectors) {
                if (!focusSelectors.has(selector.replace(/:focus-visible$/, ':focus'))) errors.push(`:focus-visible without a preceding :focus fallback: ${selector}`);
            }
        }
    }
    if (JSON.stringify(asRules(tree[0].nodes)) !== JSON.stringify(CSS_RULES)) {
        errors.push(`rules differ from contract:\n${JSON.stringify(asRules(tree[0].nodes), null, 1)}`);
    }
    return errors;
}

// Per-rule targeted stylesheet mutations. Each locates its rule by an exact
// selector (asserted unique) so no mutation can hit an unintended duplicate.
function ruleIndex(rules, selector) {
    const hits = rules.map((r, i) => (r.selectors.includes(selector) ? i : -1)).filter(i => i >= 0);
    if (hits.length !== 1) throw new Error(`selector must match exactly one rule: ${selector} (${hits.length})`);
    return hits[0];
}
const editRule = (selector, fn) => rules => {
    const i = ruleIndex(rules, selector);
    rules[i] = fn(rules[i]);
    return rules;
};
const setDecl = (prop, value) => rule => ({ ...rule, decls: rule.decls.map(([p, v]) => (p === prop ? [p, value] : [p, v])) });
const addDecl = (prop, value) => rule => ({ ...rule, decls: [...rule.decls, [prop, value]] });
const dropDecl = prop => rule => ({ ...rule, decls: rule.decls.filter(([p]) => p !== prop) });
const renameSelector = (from, to) => rule => ({ ...rule, selectors: rule.selectors.map(s => (s === from ? to : s)) });
const addSelector = selector => rule => ({ ...rule, selectors: [...rule.selectors, selector] });
const removeRule = selector => rules => rules.filter((_, i) => i !== ruleIndex(rules, selector));
const insertRule = rule => rules => [...rules, rule];

const CSS_MUTATIONS = [
    ['canvas swapped for paper', editRule(SCOPE, setDecl('background-color', `${PAPER} !important`))],
    ['body canvas loses its theme-proven important', editRule(SCOPE, setDecl('background-color', CANVAS))],
    ['important spread to body ink', editRule(SCOPE, setDecl('color', `${INK} !important`))],
    ['document ink unpaired', editRule(DOC, dropDecl('color'))],
    ['criteria background without ink', editRule(`${DOC} #searchCriteria`, dropDecl('color'))],
    ['header background dropped', editRule(`${DOC} #searchResultsHeader`, dropDecl('background-color'))],
    ['token fallback dropped', editRule(DOC, setDecl('color', 'var(--oe-wb-ink)'))],
    ['token fallback invented', editRule(DOC, setDecl('background-color', 'var(--oe-wb-paper, #fafafa)'))],
    ['criteria font weight changed', editRule(`${DOC} #searchCriteria`, addDecl('font-weight', 'normal'))],
    ['document font size added', editRule(DOC, addDecl('font-size', '14px'))],
    ['important override', editRule(`${DOC} #searchResults`, setDecl('color', `${INK} !important`))],
    ['wrapping removed', editRule(`${DOC} #searchCriteria > .form-inline`, setDecl('flex-wrap', 'nowrap'))],
    ['ring clipped by overflow', editRule(`${DOC} #searchResults a:focus-visible`, setDecl('outline-offset', '2px'))],
    ['overflow clipping added', editRule(`${DOC} #searchResults`, addDecl('overflow', 'hidden'))],
    ['field readonly/validation exclusion dropped', editRule(FIELD, renameSelector(FIELD, FIELD_BARE))],
    ['field was-validated exclusion dropped', editRule(FIELD, renameSelector(FIELD, FIELD.replace(':not(.was-validated)', '')))],
    ['field focus fallback dropped', removeRule(`${FIELD}:focus`)],
    ['field focus-visible dropped', removeRule(`${FIELD}:focus-visible`)],
    ['field focus pair unpaired', editRule(`${FIELD}:focus`, dropDecl('background-color'))],
    ['field focus fallback merged into focus-visible', rules => editRule(
        `${FIELD}:focus-visible`,
        rule => ({ ...rule, selectors: [`${FIELD}:focus`, ...rule.selectors] }),
    )(removeRule(`${FIELD}:focus`)(rules))],
    ['link focus fallback dropped', removeRule(`${DOC} #searchResults a:focus`)],
    ['link focus palette change', editRule(`${DOC} #searchResults a:focus`, rule => addDecl('background-color', PAPER)(addDecl('color', INK)(rule)))],
    ['AM anchor rule missing', removeRule(AM_ANCHOR)],
    ['AM anchor hover exclusion removed', editRule(AM_ANCHOR, renameSelector(AM_ANCHOR, `${DOC} #am a`))],
    ['AM anchor inheritance changed', editRule(AM_ANCHOR, setDecl('color', INK))],
    ['AM anchor repaints hover background', editRule(AM_ANCHOR, setDecl('background-color', PAPER))],
    ['AM anchor widened to all result links', editRule(AM_ANCHOR, renameSelector(AM_ANCHOR, `${DOC} #searchResults a:not(.blue_highlight)`))],
    ['AM anchor rule shared with another selector', editRule(AM_ANCHOR, addSelector(`${DOC} #pm a:not(.blue_highlight)`))],
    ['AM/PM semantic colour overridden',insertRule({ selectors: [`${DOC} #pm a`], decls: [['color', INK], ['background-color', PAPER]] })],
    ['hover highlight masked by cell fill', insertRule({ selectors: [`${DOC} #searchResults td`], decls: [['color', INK], ['background-color', PAPER]] })],
    ['descendant ink override', editRule(`${DOC} #searchResults`, addSelector(`${DOC} #searchResults *`))],
    ['button palette changed', insertRule({ selectors: [`${DOC} .btn-primary`], decls: [['color', INK], ['background-color', PAPER]] })],
    ['selector unscoped', editRule(`${DOC} .table-responsive > .table`, renameSelector(`${DOC} .table-responsive > .table`, '.table-responsive > .table'))],
    ['legacy body_top targeted outside workbench', editRule(SCOPE, renameSelector(SCOPE, 'body.body_top'))],
];

module.exports = {
    ROOT,
    BASELINE_COMMIT,
    ROUTE,
    ASSETS,
    CSS,
    SHEET,
    UNCHANGED,
    CALLER_ANCHORS,
    ROUTE_ADDITIONS,
    ROUTE_ANCHORS,
    ROUTE_MUTATIONS,
    ASSET_ADDITIONS,
    PRESENTATION_MARKERS,
    LINK,
    TITLE,
    CSS_RULES,
    CSS_MUTATIONS,
    SCOPE,
    DOC,
    read,
    count,
    reverse,
    routeContractErrors,
    parseCss,
    sheetRules,
    serializeCss,
    cssContractErrors,
};
