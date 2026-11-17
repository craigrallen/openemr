const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const SOURCE = path.resolve(__dirname, '../../interface/patient_file/transaction/add_transaction.php');
const ORIGINAL_SHA256 = '1b3f48c7c7a5d87af1ba71aba43fd051084a0a26be43b8f7d5c7c80c6311c776';
const OLD_BODY = '<body onload="<?php echo $body_onload_code; ?>" >';
const NEW_BODY = '<body class="oe-transaction-editor" onload="<?php echo $body_onload_code; ?>" >';
const BASE = "html.oe-workbench-context body.oe-transaction-editor #container_div > form[name='new_transaction']";
const START = '/* OPEMR-270 transaction editor document start */';
const END = '/* OPEMR-270 transaction editor document end */';
const CSS = [
    START,
    '@media screen {',
    `    ${BASE} {`,
    '        max-width: 78rem;',
    '        margin-inline: auto;',
    '        padding: 1rem;',
    '        border: 1px solid var(--gray300);',
    '        border-radius: 0.5rem;',
    '    }',
    `    ${BASE}::after {`,
    "        content: '';",
    '        display: table;',
    '        clear: both;',
    '    }',
    `    ${BASE} .btn-group {`,
    '        flex-wrap: wrap;',
    '        max-width: 100%;',
    '        gap: 0.25rem;',
    '    }',
    `    ${BASE} .btn-group > .btn {`,
    '        max-width: 100%;',
    '        white-space: normal;',
    '        overflow-wrap: anywhere;',
    '    }',
    `    ${BASE} .btn-group > .btn:focus {`,
    '        outline: 2px solid currentcolor;',
    '        outline-offset: 2px;',
    '    }',
    `    ${BASE} .btn-group > .btn:focus-visible {`,
    '        outline: 2px solid currentcolor;',
    '        outline-offset: 2px;',
    '    }',
    `    ${BASE} ul.tabNav a:focus {`,
    '        outline: 2px solid currentcolor;',
    '        outline-offset: -2px;',
    '    }',
    `    ${BASE} ul.tabNav a:focus-visible {`,
    '        outline: 2px solid currentcolor;',
    '        outline-offset: -2px;',
    '    }',
    '}',
    END,
    ''
].map((line, index, lines) => {
    const formatted = line.replace(/^ +/, spaces => ' '.repeat(spaces.length / 2));
    return (line === '    }' && lines[index + 1] !== '}') || line === '}' ? formatted + '\n' : formatted;
}).join('\n');

function count(haystack, needle) {
    return haystack.split(needle).length - 1;
}

function sha256(value) {
    return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function originalFrom(source) {
    if (count(source, '</style>') !== 1) return null;
    if (sha256(source) === ORIGINAL_SHA256) return source;
    if (count(source, CSS) !== 1 || count(source, NEW_BODY) !== 1) return null;
    const inverse = source.replace(CSS, '').replace(NEW_BODY, OLD_BODY);
    return sha256(inverse) === ORIGINAL_SHA256 ? inverse : null;
}

function candidateFrom(original) {
    return original.replace('</style>', CSS + '</style>').replace(OLD_BODY, NEW_BODY);
}

function rulesFrom(source) {
    if (count(source, NEW_BODY) !== 1 || count(source, START) !== 1 || count(source, END) !== 1) return null;
    const begin = source.indexOf(START);
    const end = source.indexOf(END, begin + START.length);
    if (end < 0) return null;
    const marked = source.slice(begin + START.length, end).trim();
    const media = /^@media screen\s*\{([\s\S]*)\}$/.exec(marked);
    if (!media) return null;
    const inner = media[1];
    const rulePattern = /([^{}]+)\{([^{}]*)\}/g;
    const rules = new Map();
    let cursor = 0;
    for (const match of inner.matchAll(rulePattern)) {
        if (inner.slice(cursor, match.index).trim()) return null;
        cursor = match.index + match[0].length;
        const selector = match[1].trim();
        if (!selector || selector.split(',').some(part => !part.trim().startsWith(BASE))) return null;
        if (rules.has(selector)) return null;
        const declarations = new Map();
        for (const fragment of match[2].split(';')) {
            if (!fragment.trim()) continue;
            const colon = fragment.indexOf(':');
            if (colon < 1) return null;
            const property = fragment.slice(0, colon).trim();
            const value = fragment.slice(colon + 1).trim();
            if (!property || !value || declarations.has(property)) return null;
            declarations.set(property, value);
        }
        rules.set(selector, declarations);
    }
    return !inner.slice(cursor).trim() && rules.size ? rules : null;
}

function has(rules, selector, required) {
    const declarations = rules && rules.get(selector);
    return !!declarations && Object.entries(required).every(([key, value]) => declarations.get(key) === value);
}

function sheet(source) {
    const rules = rulesFrom(source);
    if (!has(rules, BASE, {
        'max-width': '78rem', 'margin-inline': 'auto', padding: '1rem',
        border: '1px solid var(--gray300)', 'border-radius': '0.5rem'
    })) return false;
    for (const [selector, declarations] of rules) {
        if (/\b(?:table|td|th|fieldset|input|select|textarea)\b/.test(selector)) return false;
        for (const property of declarations.keys()) {
            if (/^(?:background(?:-.+)?|color|font(?:-.+)?|width|height|inline-size|block-size)$/.test(property)) return false;
        }
    }
    return true;
}

function clearfix(source) {
    return has(rulesFrom(source), BASE + '::after', {
        content: "''", display: 'table', clear: 'both'
    });
}

function actions(source) {
    const rules = rulesFrom(source);
    return has(rules, BASE + ' .btn-group', {
        'flex-wrap': 'wrap', 'max-width': '100%', gap: '0.25rem'
    }) && has(rules, BASE + ' .btn-group > .btn', {
        'max-width': '100%', 'white-space': 'normal', 'overflow-wrap': 'anywhere'
    });
}

function focus(source) {
    const rules = rulesFrom(source);
    return [':focus', ':focus-visible'].every(state =>
        has(rules, BASE + ' .btn-group > .btn' + state, {
            outline: '2px solid currentcolor', 'outline-offset': '2px'
        }) && has(rules, BASE + ' ul.tabNav a' + state, {
            outline: '2px solid currentcolor', 'outline-offset': '-2px'
        })
    );
}

const CASES = [
    ['native Header context source linkage', source => {
        const root = path.resolve(__dirname, '../..');
        const config = fs.readFileSync(path.join(root, 'config/config.yaml'), 'utf8');
        const header = fs.readFileSync(path.join(root, 'src/Core/Header.php'), 'utf8');
        const popup = fs.readFileSync(path.join(root, 'interface/clinical-workspace/popup.js'), 'utf8');
        return source.includes("Header::setupHeader(['common','datetime-picker','select2'])") &&
            /workbench-popup:[\s\S]*?script: popup\.js\s+link: popup\.css\s+autoload: true/.test(config) &&
            header.includes('self::setupAssets(is_array($assets) ? $assets : [$assets], true)') &&
            popup.includes("const CONTEXT_CLASS = 'oe-workbench-context'") &&
            popup.includes('const html = doc.documentElement') && popup.includes('html.classList.add(name)') &&
            popup.includes('set(CONTEXT_CLASS, active)') &&
            BASE.startsWith('html.oe-workbench-context body.oe-transaction-editor ');
    }],
    ['original source preservation', source => originalFrom(source) !== null],
    ['screen scoped theme preserving sheet', sheet],
    ['floated tab content clearfix', clearfix],
    ['wrapped actions and long labels', actions],
    ['button and tab keyboard focus fallbacks', focus],
    ['semantic mutations rejected', source => {
        const original = originalFrom(source);
        if (!original) return false;
        const candidate = candidateFrom(original);
        const predicates = [sheet, clearfix, actions, focus];
        if (!predicates.every(predicate => predicate(candidate) && !predicate(original))) return false;
        const mutations = [
            [sheet, candidate.replace('@media screen {', '@media print {')],
            [sheet, candidate.replace('    border-radius: 0.5rem;', '    background: red;')],
            [clearfix, candidate.replace('    clear: both;', '    clear: none;')],
            [actions, candidate.replace('    overflow-wrap: anywhere;', '    overflow-wrap: normal;')],
            [focus, candidate.replace(`${BASE} ul.tabNav a:focus-visible {`, `${BASE} ul.tabNav a:hover {`)]
        ];
        return mutations.every(([predicate, mutation]) => !predicate(mutation));
    }],
    ['preservation mutations rejected', source => {
        const original = originalFrom(source);
        if (!original) return false;
        const candidate = candidateFrom(original);
        if (originalFrom(candidate) !== original) return false;
        return [
            candidate.replace('add_transaction.php?transid=', 'changed_transaction.php?transid='),
            candidate.replace(NEW_BODY, NEW_BODY.replace('oe-transaction-editor', 'oe-transaction-editor changed')),
            candidate.replace('    padding: 1rem;', '    padding: 2rem;'),
            candidate.replace('</style>', 'body { color: red; }\n</style>')
        ].every(mutation => originalFrom(mutation) === null);
    }]
];

function run() {
    let source;
    try {
        source = fs.readFileSync(SOURCE, 'utf8');
    } catch (_) {
        source = null;
    }
    const cases = CASES.map(([name, predicate]) => {
        let passed = false;
        try {
            passed = source !== null && predicate(source) === true;
        } catch (_) {
            passed = false;
        }
        return {name, passed};
    });
    const passed = cases.filter(result => result.passed).length;
    return {total: cases.length, passed, failed: cases.length - passed, cases};
}

module.exports = {run};
if (require.main === module) {
    const result = run();
    process.stdout.write(JSON.stringify(result) + '\n');
    process.exitCode = result.failed === 0 ? 0 : 1;
}
