'use strict';

/*
 * Shared, history-independent helpers for the procedure type editor guards:
 * real-source readers, the declared route presentation edits and their inverse,
 * and a minimal CSS reader. Used by procedure-editor.test.cjs (portable) and
 * procedure-editor-baseline.test.cjs (needs the git base commit).
 */

const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '../..');
const ROUTE = 'interface/orders/types_edit.php';
const HELPER = 'src/Common/Assets/ClinicalWorkspaceAssets.php';
const SHEET = 'interface/clinical-workspace/procedure-editor-popup.css';
const SHEET_NAME = 'procedure-editor-popup.css';
const DOC = 'docs/clinical-ui/PROCEDURE-EDITOR.md';
const SCOPE = 'html.oe-workbench-popup body.oe-procedure-editor';

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

// Names in the helper's SUPPORTED constant, in source order; null when the constant is absent.
const supportedList = text => {
    const body = text.match(/private const SUPPORTED = \[\n([\s\S]*?)\n {4}\];/);
    return body ? [...body[1].matchAll(/'([^']+)'/g)].map(m => m[1]) : null;
};

// ---------------------------------------------------------------------------
// Route: every presentation edit is [original, presented]. Classes, one import
// and one screen-only versioned link only.
// ---------------------------------------------------------------------------
const LINK = '    <?php $clinicalAssets = new ClinicalWorkspaceAssets(); ?>\n'
    + '    <link rel="stylesheet" media="screen" href="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>'
    + `/interface/clinical-workspace/${SHEET_NAME}?v=<?php echo attr_url($clinicalAssets->version('${SHEET_NAME}')); ?>">\n`;

const changes = [
    [
        'use OpenEMR\\Common\\Acl\\AclMain;\nuse OpenEMR\\Common\\Csrf\\CsrfUtils;',
        'use OpenEMR\\Common\\Acl\\AclMain;\nuse OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;\nuse OpenEMR\\Common\\Csrf\\CsrfUtils;',
    ],
    ['    </style>\n\n    <script>\n', `    </style>\n${LINK}\n    <script>\n`],
    [
        '<body>\n    <div class="container mt-3">',
        '<body class="oe-procedure-editor">\n    <div class="container mt-3 oe-procedure-sheet">',
    ],
    [
        "<form method='post' name='theform' class=\"form-horizontal\"",
        "<form method='post' name='theform' class=\"form-horizontal oe-procedure-form\"",
    ],
    ['                    <fieldset>\n', '                    <fieldset class="oe-procedure-document">\n'],
    [
        '<div class="form-group" id="button-container">\n'
        + '                        <div class="col-sm-12 text-left position-override">\n'
        + '                            <div class="btn-group" role="group">',
        '<div class="form-group oe-procedure-actions-row" id="button-container">\n'
        + '                        <div class="col-sm-12 text-left position-override oe-procedure-actions">\n'
        + '                            <div class="btn-group oe-procedure-commit" role="group">',
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
// Minimal CSS reader (comments, nested @media, quoted strings, :not() lists).
// ---------------------------------------------------------------------------
function splitTop(text, separator) {
    const parts = [];
    let depth = 0;
    let quote = null;
    let start = 0;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (quote) {
            if (ch === '\\') i++;
            else if (ch === quote) quote = null;
        } else if (ch === '"' || ch === "'") quote = ch;
        else if (ch === '(' || ch === '[') depth++;
        else if (ch === ')' || ch === ']') depth--;
        else if (depth === 0 && ch === separator) {
            parts.push(text.slice(start, i).trim());
            start = i + 1;
        }
    }
    parts.push(text.slice(start).trim());
    return parts.filter(Boolean);
}

function parseCss(input) {
    const src = input.replace(/\/\*[\s\S]*?\*\//g, '');
    let i = 0;
    const scan = stops => {
        const start = i;
        let depth = 0;
        let quote = null;
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
        return src.slice(start, i);
    };
    const decls = () => {
        const body = scan('}');
        i++;
        return splitTop(body, ';').map(raw => {
            const colon = raw.indexOf(':');
            const prop = raw.slice(0, colon).trim().toLowerCase();
            let value = raw.slice(colon + 1).trim();
            const important = /!\s*important\s*$/i.test(value);
            value = value.replace(/\s*!\s*important\s*$/i, '');
            return { prop, value, important };
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
            const prelude = scan('{;').trim();
            if (src[i] === ';') {
                i++;
                nodes.push({ type: 'statement', prelude });
                continue;
            }
            i++;
            if (prelude.startsWith('@')) {
                const [, name, params] = prelude.match(/^@([\w-]+)\s*([\s\S]*)$/);
                if (name === 'media' || name === 'supports') nodes.push({ type: 'atrule', name, params: params.trim(), nodes: block() });
                else nodes.push({ type: 'atrule', name, params: params.trim(), decls: decls() });
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
    HELPER,
    SHEET,
    SHEET_NAME,
    DOC,
    SCOPE,
    BASELINE_SUPPORTED,
    LINK,
    changes,
    read,
    exists,
    count,
    restore,
    supportedList,
    splitTop,
    parseCss,
    walkRules,
};
