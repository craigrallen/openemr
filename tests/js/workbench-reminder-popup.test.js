/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const postcss = require('postcss');

const root = path.join(__dirname, '../..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const add = () => read('interface/main/dated_reminders/dated_reminders_add.php');
const log = () => read('interface/main/dated_reminders/dated_reminders_log.php');
const css = () => read('interface/clinical-workspace/reminder-popup.css');
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');

// Whole-file sha256 of each route at 5619373, before the reminder adaptation.
const BASELINE = {
    add: '391272be3710dc07bda2769c2b827792cce53c23f538aa3e22d1698415a71d7e',
    log: '0adc62ad63ca1a464f033aadb2e2c25cb32c036d153c1f0f31b49d61a1737243',
};

// The only intended insertions: [added text, its pre-adaptation form, occurrences].
const INSERTIONS = {
    add: [
        [", 'moment', 'workbench-reminder-popup']);", ", 'moment']);", 1],
        ['<body class="oe-reminder-editor">', '<body>', 1],
        ['<div class="container oe-reminder-sheet">', '<div class="container">', 1],
        ['<div class="card oe-reminder-document">', '<div class="card">', 1],
        ['<div class="card-header bg-primary text-white oe-reminder-heading">', '<div class="card-header bg-primary text-white">', 1],
        ['<div class="section-header mb-2 oe-reminder-section"', '<div class="section-header mb-2"', 1],
        ['<div class="section-header mt-4 mb-2 oe-reminder-section"', '<div class="section-header mt-4 mb-2"', 2],
        ['<div class="card-footer oe-reminder-actions">', '<div class="card-footer">', 1],
        ['<div class="col-12 mt-4 oe-reminder-results">', '<div class="col-12 mt-4">', 1],
    ],
    log: [
        ["Header::setupHeader(['datetime-picker', 'workbench-reminder-popup']);", "Header::setupHeader(['datetime-picker']);", 1],
        ['<body class="oe-reminder-log">', '<body>', 1],
        ['<div class="container oe-reminder-sheet">', '<div class="container">', 1],
        ['<div class="row oe-reminder-results">', '<div class="row">', 1],
        ['<h2 class="title oe-reminder-heading">', '<h2 class="title">', 1],
        ['<div class="section-header mb-2 oe-reminder-section">', '<div class="section-header mb-2">', 1],
        ['<div class="section-header mt-4 mb-2 oe-reminder-section">', '<div class="section-header mt-4 mb-2">', 2],
        ['<div class="card-footer oe-reminder-actions">', '<div class="card-footer">', 1],
    ],
};

// Independent upstream fix (5619373..9cbb8ee), not part of the reminder adaptation: the
// patientName title now echoes its escaped translation instead of discarding it.
const PATIENT_NAME_TITLE_FIX = [
    "onclick='sel_patient()' title='<?php echo xla('Click to select patient'); ?>' readonly />",
    "onclick='sel_patient()' title='<?php xla('Click to select patient'); ?>' readonly />",
];
const UPSTREAM = {
    add: [PATIENT_NAME_TITLE_FIX],
    log: [],
};

const revertUpstream = (source, fixes) => fixes.reduce((text, [fixed, original]) => {
    expect(text.split(fixed)).toHaveLength(2);
    return text.replace(fixed, original);
}, source);

const normalize = (source, insertions, upstream = []) => insertions.reduce((text, [added, original, count]) => {
    expect(text.split(added)).toHaveLength(count + 1);
    return text.split(added).join(original);
}, revertUpstream(source, upstream));

const CONTRACT_KEYS = ['tag', 'id', 'name', 'type', 'value', 'method', 'action', 'onsubmit', 'onclick', 'onchange', 'onkeydown', 'onkeyup', 'multiple', 'readonly'];

// Every form control across all server branches, PHP blocks reduced to '@'.
const controls = (source) => [...source.replace(/<\?php[\s\S]*?\?>/g, '@')
    .matchAll(/<(form|input|select|textarea|button)\b([^>]*)>/g)]
    .map(([, tag, attrs]) => {
        const control = { tag };
        for (const [, key, double, single] of attrs.matchAll(/([\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'))?/g)) {
            if (CONTRACT_KEYS.includes(key.toLowerCase())) control[key.toLowerCase()] = double ?? single ?? true;
        }
        return control;
    });

test('only the reminder stylesheet is registered and both rendered heads request it', () => {
    const config = read('config/config.yaml');
    expect(config).toMatch(/ {2}workbench-popup:[\s\S]*?autoload: true\n {2}workbench-reminder-popup:\n {4}basePath: '%webroot%\/interface\/clinical-workspace'\n {4}link: \/reminder-popup\.css\n {2}select2:/);
    expect((config.match(/^ {2}workbench-reminder-popup:/gm) || [])).toHaveLength(1);
    expect(add()).toContain("Header::setupHeader(['datetime-picker', 'opener' ,'topdialog', 'common', 'moment', 'workbench-reminder-popup'])");
    expect(log()).toContain("Header::setupHeader(['datetime-picker', 'workbench-reminder-popup'])");
    expect(add()).toMatch(/<body class="oe-reminder-editor">/);
    expect(log()).toMatch(/<body class="oe-reminder-log">/);
});

test('whole route sources differ from the baseline only by the enumerated insertions and upstream fix', () => {
    expect(hash(normalize(add(), INSERTIONS.add, UPSTREAM.add))).toBe(BASELINE.add);
    expect(hash(normalize(log(), INSERTIONS.log, UPSTREAM.log))).toBe(BASELINE.log);
});

test('patientName keeps the upstream escaped translated title echo', () => {
    const input = add().split('\n').filter(line => line.includes("id='patientName'"));
    expect(input).toHaveLength(1);
    expect(input[0]).toContain("title='<?php echo xla('Click to select patient'); ?>'");
    expect(input[0]).toContain(PATIENT_NAME_TITLE_FIX[0]);
});

test('upstream fix normalization is exact and still guards the patientName contract', () => {
    for (const mutate of [
        (s) => s.replace("title='<?php echo xla('Click to select patient'); ?>'", "title='<?php echo xla('Click to pick patient'); ?>'"),
        (s) => s.replace("title='<?php echo xla('Click to select patient'); ?>'", "title='<?php echo xlt('Click to select patient'); ?>'"),
        (s) => s.replace("title='<?php echo xla('Click to select patient'); ?>'", "title='<?php xla('Click to select patient'); ?>'"),
        (s) => s.replace("onclick='sel_patient()' title=", "onclick='pick_patient()' title="),
        (s) => s.replace(PATIENT_NAME_TITLE_FIX[0], `${PATIENT_NAME_TITLE_FIX[0]}\n${PATIENT_NAME_TITLE_FIX[0]}`),
    ]) {
        const mutated = mutate(add());
        expect(mutated).not.toBe(add());
        expect(() => normalize(mutated, INSERTIONS.add, UPSTREAM.add)).toThrow();
    }
});

test('normalization rejects changed control contracts', () => {
    for (const [mutate, source, key] of [
        [(s) => s.replace('name="sendTo[]"', 'name="sendTo"'), add(), 'add'],
        [(s) => s.replace("id=\"priority_2\" value='2'", "id=\"priority_2\" value='4'"), add(), 'add'],
        [(s) => s.replace("<button type='submit'", "<button type='button'"), add(), 'add'],
        [(s) => s.replace("id='patientName' name='patientName'", "id='patientName' name='patient'"), add(), 'add'],
        [(s) => s.replace("<input type='text' id='patientName'", "<input type='search' id='patientName'"), add(), 'add'],
        [(s) => s.replace('name="PatientID" id="PatientID"', 'name="pid" id="PatientID"'), add(), 'add'],
        [(s) => s.replace('id="addDR" class="form-horizontal" method="post" onsubmit="return top.restoreSession()"', 'id="addDR" class="form-horizontal" method="post" action="other.php" onsubmit="return top.restoreSession()"'), add(), 'add'],
        [(s) => s.replace('method="get" id="logForm"', 'method="post" id="logForm"'), log(), 'log'],
    ]) {
        const mutated = mutate(source);
        expect(mutated).not.toBe(source);
        expect(hash(normalize(mutated, INSERTIONS[key], UPSTREAM[key]))).not.toBe(BASELINE[key]);
        expect(controls(mutated)).not.toEqual(controls(source));
    }
    for (const mutate of [
        (s) => s.replace("$patID = $_POST['PatientID'];", "$patID = $_GET['PatientID'];"),
        (s) => s.replace('$("#PatientID").val(pid);', '$("#PatientID").val(0);'),
        (s) => s.replace('attr(getPatName($patientID))', 'text(getPatName($patientID))'),
    ]) {
        const mutated = mutate(add());
        expect(mutated).not.toBe(add());
        expect(hash(normalize(mutated, INSERTIONS.add, UPSTREAM.add))).not.toBe(BASELINE.add);
    }
});

test('editor form controls keep exact names, types, values, actions and handlers', () => {
    expect(controls(add())).toEqual([
        { tag: 'form', id: 'addDR', method: 'post', onsubmit: 'return top.restoreSession()' },
        { tag: 'input', type: 'hidden', name: 'csrf_token_form', value: '@' },
        { tag: 'input', type: 'text', id: 'patientName', name: 'patientName', value: '@', onclick: 'sel_patient()', readonly: true },
        { tag: 'input', type: 'hidden', name: 'PatientID', id: 'PatientID', value: '@' },
        { tag: 'button', type: 'button', id: 'removePatient' },
        { tag: 'select', id: 'sendTo', name: 'sendTo[]', multiple: 'multiple' },
        { tag: 'button', type: 'button', onclick: 'selectAll();' },
        { tag: 'input', type: 'checkbox', name: 'sendSeperately', id: 'sendSeperately' },
        { tag: 'input', type: 'text', name: 'dueDate', id: 'dueDate', value: '@' },
        { tag: 'select', id: 'timeSpan' },
        { tag: 'input', type: 'radio', name: 'priority', id: 'priority_3', value: '3' },
        { tag: 'input', type: 'radio', name: 'priority', id: 'priority_2', value: '2' },
        { tag: 'input', type: 'radio', name: 'priority', id: 'priority_1', value: '1' },
        { tag: 'textarea', onkeydown: 'limitText(this.form.message,this.form.countdown,@);', onkeyup: 'limitText(this.form.message,this.form.countdown,@);', name: 'message', id: 'message' },
        { tag: 'input', readonly: true, type: 'text', name: 'countdown', id: 'countdown', value: '@' },
        { tag: 'button', type: 'submit', name: 'sendButton', id: 'sendButton', value: '@', onclick: 'return this.clicked = true;' },
        { tag: 'button', type: 'reset' },
    ]);
});

test('log filter controls keep exact names, types, values, method and handlers', () => {
    expect(controls(log())).toEqual([
        { tag: 'form', method: 'get', id: 'logForm', onsubmit: 'return top.restoreSession()' },
        { tag: 'input', type: 'hidden', name: 'csrf_token_form', value: '@' },
        { tag: 'input', id: 'sd', type: 'text', name: 'sd', value: '' },
        { tag: 'input', id: 'ed', type: 'text', name: 'ed', value: '' },
        { tag: 'select', id: 'sentBy', name: 'sentBy[]', multiple: 'multiple' },
        { tag: 'select', id: 'sentTo', name: 'sentTo[]', multiple: 'multiple' },
        { tag: 'input', type: 'checkbox', name: 'processed', id: 'processed' },
        { tag: 'input', type: 'checkbox', name: 'pending', id: 'pending' },
        { tag: 'button', type: 'button', id: 'submitForm' },
        { tag: 'button', type: 'reset' },
    ]);
});

test('route hooks cover headings, sections, actions and result tables without changing controls', () => {
    for (const source of [add(), log()]) {
        for (const hook of ['oe-reminder-sheet', 'oe-reminder-heading', 'oe-reminder-section', 'oe-reminder-actions', 'oe-reminder-results']) {
            expect(source).toContain(hook);
        }
    }
});

test('diagnostic HTML projection retains labeled editor and filter controls', () => {
    // Diagnostic projection only: PHP output branches require a native controller fixture.
    for (const [source, ids] of [
        [add(), ['patientName', 'sendTo', 'dueDate', 'timeSpan', 'message', 'countdown']],
        [log(), ['sd', 'ed', 'sentBy', 'sentTo']],
    ]) {
        const markup = source.slice(source.indexOf('<html>')).replace(/<\?php[\s\S]*?\?>/g, '');
        const doc = new DOMParser().parseFromString(markup, 'text/html');
        expect(doc.querySelector('.oe-reminder-sheet')).not.toBeNull();
        expect(doc.querySelector('.oe-reminder-actions button')).not.toBeNull();
        for (const id of ids) {
            expect(doc.getElementById(id)).not.toBeNull();
            expect(doc.querySelector(`label[for="${id}"]`)).not.toBeNull();
        }
    }
});

test('stylesheet is screen only and every selector needs popup context and a reminder route', () => {
    const ast = postcss.parse(css());
    const rules = [];
    ast.walkRules(rule => rules.push(...rule.selectors));
    expect(rules.length).toBeGreaterThan(10);
    expect(rules.every(selector => /^html\.oe-workbench-popup body\.oe-reminder-(?:editor|log)\b/.test(selector))).toBe(true);
    expect(ast.nodes.every(node => node.type === 'comment' || (node.type === 'atrule' && node.name === 'media' && node.params === 'screen'))).toBe(true);
    expect(css()).not.toMatch(/(?:display:\s*none|visibility:\s*hidden|@media print)/);
    for (const target of ['.oe-reminder-sheet', '.oe-reminder-heading', '.oe-reminder-section', '.oe-reminder-actions', '.oe-reminder-results', '.table', '.thead-light', '.alert-info', '.oe-error-modal']) {
        expect(rules.some(selector => selector.includes(target))).toBe(true);
    }
});

describe('palette reaches neutral reminder chrome and leaves semantic variants alone', () => {
    const PAINT = ['color', 'background', 'background-color'];

    // Properties the reminder stylesheet assigns to an element, by real selector matching.
    const painted = (element) => {
        const props = new Set();
        postcss.parse(css()).walkRules(rule => {
            if (!rule.selectors.some(selector => element.matches(selector))) return;
            rule.walkDecls(decl => {
                if (PAINT.includes(decl.prop)) props.add(decl.prop === 'background-color' ? 'background' : decl.prop);
            });
        });
        return [...props].sort();
    };

    const route = (body, markup) => {
        document.documentElement.className = 'oe-workbench-popup';
        document.body.className = body;
        document.body.innerHTML = markup;
    };

    const table = (tableClass, theadClass, trClass, thClass) => `
        <table class="table table-striped table-hover ${tableClass}">
            <thead class="${theadClass}"><tr class="${trClass}"><th class="${thClass}">ID</th></tr></thead>
            <tbody><tr><td>1</td></tr></tbody>
        </table>`;

    const editor = (header, tbl) => route('oe-reminder-editor', `
        <div class="container oe-reminder-sheet"><div class="row">
            <div class="card oe-reminder-document">
                <div class="card-header bg-primary text-white oe-reminder-heading" id="heading"><h5>Send</h5></div>
                <div class="card-body">
                    <div class="section-header mb-2 oe-reminder-section"><h6 class="text-muted" id="muted">Recipients</h6><h6 class="text-danger" id="danger-h6">Required</h6></div>
                    <div class="form-group"><label id="plain-label">Due</label><label class="text-danger" id="danger-label">Due</label></div>
                </div>
            </div>
            <div class="col-12 mt-4 oe-reminder-results"><div class="card">
                <div class="${header}" id="results-header"><h5>Messages Sent Today</h5></div>
                <div class="table-responsive">${tbl}</div>
            </div></div>
        </div></div>`);

    const logPage = (header, tbl) => route('oe-reminder-log', `
        <div class="container oe-reminder-sheet">
            <h2 class="title oe-reminder-heading" id="heading">Dated Message Log</h2>
            <div class="filter-section"><form><div class="card">
                <div class="${header}" id="filter-header"><h5>Filters</h5></div>
            </div></form></div>
            <div id="resultsDiv"><div class="row oe-reminder-results"><div class="col-12 results-section mb-3"><div class="card">
                <div class="${header}" id="results-header"><h5>Results</h5></div>
                <div class="table-responsive">${tbl}</div>
            </div></div></div></div>
        </div>`);

    const NEUTRAL_HEADER = 'card-header bg-primary text-white';
    const NEUTRAL_TABLE = table('', 'thead-light', '', '');

    test.each([['editor', editor], ['log', logPage]])('%s neutral headings and thead-light cells get paired ink and paper', (_name, render) => {
        render(NEUTRAL_HEADER, NEUTRAL_TABLE);
        for (const selector of ['#heading', '#results-header', 'table', 'thead.thead-light th']) {
            expect([selector, painted(document.querySelector(selector))]).toEqual([selector, ['background', 'color']]);
        }
        if (render === logPage) expect(painted(document.getElementById('filter-header'))).toEqual(['background', 'color']);
    });

    test.each([
        ['warning header', 'card-header bg-warning'],
        ['danger header', 'card-header bg-danger text-white'],
        ['primary plus danger header', 'card-header bg-primary bg-danger text-white'],
        ['primary plus warning header', 'card-header bg-primary bg-warning text-white'],
        ['white plus danger text header', 'card-header bg-primary text-white text-danger'],
        ['info header', 'card-header bg-info text-white'],
        ['dark header', 'card-header bg-dark text-white'],
        ['explicit text header', 'card-header text-danger'],
        ['custom background header', 'card-header bg-brand text-white'],
        ['custom text header', 'card-header bg-primary text-brand'],
    ])('%s keeps its palette on both routes', (_name, header) => {
        for (const render of [editor, logPage]) {
            render(header, NEUTRAL_TABLE);
            for (const element of document.querySelectorAll('[id$="-header"]')) expect([element.id, painted(element)]).toEqual([element.id, []]);
        }
    });

    test.each([
        ['bg-danger', 'text-white'],
        ['bg-warning', 'text-white'],
        ['text-danger', 'bg-primary'],
    ])('editor primary heading with %s keeps explicit semantic paint', (semantic, other) => {
        editor(NEUTRAL_HEADER, NEUTRAL_TABLE);
        const heading = document.getElementById('heading');
        heading.classList.add(semantic, other);
        expect(painted(heading)).toEqual([]);
    });

    test.each([
        ['dark table', table('table-dark', '', '', '')],
        ['light table', table('table-light', 'thead-light', '', '')],
        ['active table', table('table-active', 'thead-light', '', '')],
        ['warning table', table('table-warning', 'thead-light', '', '')],
        ['dark thead', table('', 'thead-dark', '', '')],
        ['danger row in thead-light', table('', 'thead-light', 'table-danger', '')],
        ['info cell in thead-light', table('', 'thead-light', '', 'table-info')],
        ['bg-warning cell in thead-light', table('', 'thead-light', '', 'bg-warning')],
        ['text-danger cell in thead-light', table('', 'thead-light', '', 'text-danger')],
    ])('%s is not repainted on either route', (_name, tbl) => {
        for (const render of [editor, logPage]) {
            render(NEUTRAL_HEADER, tbl);
            const th = document.querySelector('thead th');
            expect(painted(th)).toEqual([]);
            if (/table-(?:dark|light|active|warning)/.test(tbl)) expect(painted(document.querySelector('table'))).toEqual([]);
        }
    });

    test('explicit text classes on section headings and labels are not repainted', () => {
        editor(NEUTRAL_HEADER, NEUTRAL_TABLE);
        expect(painted(document.getElementById('muted'))).toEqual(['color']);
        expect(painted(document.getElementById('plain-label'))).toEqual(['color']);
        expect(painted(document.getElementById('danger-h6'))).toEqual([]);
        expect(painted(document.getElementById('danger-label'))).toEqual([]);
        document.getElementById('muted').classList.add('text-danger');
        expect(painted(document.getElementById('muted'))).toEqual([]);
    });

    // Border declarations the reminder stylesheet assigns to an element, by real selector matching.
    const bordered = (element) => {
        const props = [];
        postcss.parse(css()).walkRules(rule => {
            if (!rule.selectors.some(selector => element.matches(selector))) return;
            rule.walkDecls(/^border(?:-(?:top|bottom|left|right))?(?:-color)?$/, decl => props.push(decl.prop));
        });
        return props;
    };

    test('semantic table cells keep their own border cues on both routes', () => {
        const semantic = `
            <table class="table table-danger"><tbody><tr><td id="danger-td">x</td></tr></tbody></table>
            <table class="table"><thead class="thead-dark"><tr><th id="dark-th">x</th></tr></thead>
                <tbody><tr class="table-warning"><td id="warning-td">x</td></tr><tr><th class="bg-danger text-white" id="bg-danger-th">x</th></tr></tbody></table>
            <table class="table"><thead class="thead-light"><tr><th class="text-danger" id="text-danger-th">x</th></tr></thead></table>`;
        for (const render of [editor, logPage]) {
            render(NEUTRAL_HEADER, semantic);
            for (const id of ['danger-td', 'dark-th', 'warning-td', 'bg-danger-th', 'text-danger-th']) {
                expect([id, bordered(document.getElementById(id))]).toEqual([id, []]);
            }
        }
    });

    test('only tables inside a scrolling wrapper get a minimum width', () => {
        const minWidth = (element) => {
            let found = false;
            postcss.parse(css()).walkRules(rule => {
                if (rule.selectors.some(selector => element.matches(selector))) rule.walkDecls('min-width', () => { found = true; });
            });
            return found;
        };
        for (const render of [editor, logPage]) {
            render(NEUTRAL_HEADER, NEUTRAL_TABLE);
            expect(minWidth(document.querySelector('.table-responsive > .table'))).toBe(true);
            document.querySelector('.oe-reminder-results .card').insertAdjacentHTML('beforeend', '<table class="table" id="loose"></table>');
            expect(minWidth(document.getElementById('loose'))).toBe(false);
        }
    });
});

test('workbench countdown is sized to the glyphs of its largest value without touching the control', () => {
    // The readonly counter starts at $max_reminder_words and only counts down, so that literal bounds its digits.
    const max = /\$max_reminder_words\s*=\s*(\d+);/.exec(add());
    expect(max).not.toBeNull();
    const digits = max[1].length;

    const rules = [];
    postcss.parse(css()).walkRules(rule => rules.push(rule));
    const declsFor = (selector) => Object.fromEntries(rules
        .filter(rule => rule.selectors.includes(selector))
        .flatMap(rule => rule.nodes.filter(node => node.type === 'decl').map(decl => [decl.prop, decl.value])));

    // form-control-sm: 0.5rem inline padding each side, 1px border each side, border-box sizing.
    const field = declsFor('html.oe-workbench-popup body.oe-reminder-editor #countdown');
    expect(field).toEqual({
        'font-variant-numeric': 'tabular-nums',
        'box-sizing': 'border-box',
        width: `calc(${digits}ch + 1rem + 2px)`,
    });

    // The .col-2 wrapper is 1/6 of the row (32px at a 320px viewport); let it hug the field instead.
    const column = declsFor('html.oe-workbench-popup body.oe-reminder-editor .form-row > .col-2:has(> #countdown)');
    expect(column).toEqual({ flex: '0 0 auto', 'max-width': 'none', width: 'auto' });

    // No control/value/type/handler or print/legacy path is involved.
    expect(add()).toContain('<input class="form-control form-control-sm" readonly type="text" name="countdown" id="countdown" value="<?php echo attr($max_reminder_words); ?>" />');
});

describe('native readable and narrow popup regressions', () => {
    const route = (body, markup) => {
        document.documentElement.className = 'oe-workbench-popup';
        document.body.className = body;
        document.body.innerHTML = markup;
    };
    const declarations = (element, state = '') => {
        const values = {};
        postcss.parse(css()).walkRules(rule => {
            if (rule.selectors.some(selector => {
                if (state && selector.endsWith(state)) return element.matches(selector.slice(0, -state.length));
                return !/:hover|:focus|:disabled/.test(selector) && element.matches(selector);
            })) {
                rule.walkDecls(decl => { values[decl.prop] = `${decl.value}${decl.important ? ' !important' : ''}`; });
            }
        });
        return values;
    };
    const luminance = (hex) => {
        const full = hex.length === 4 ? `#${[...hex.slice(1)].map(digit => digit + digit).join('')}` : hex;
        const channels = full.match(/[\da-f]{2}/gi).map(channel => parseInt(channel, 16) / 255);
        return channels.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
            .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
    };
    const contrast = (a, b) => {
        const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
        return (light + 0.05) / (dark + 0.05);
    };

    test.each(['oe-reminder-editor', 'oe-reminder-log'])('%s pairs neutral small helper ink with document paper', body => {
        const source = body === 'oe-reminder-editor' ? add() : log();
        expect(source).toMatch(/<small class="text-muted">/);
        route(body, '<div class="oe-reminder-sheet"><div class="card"><div class="card-body"><small class="text-muted" id="helper">Hint</small><small class="text-muted text-danger" id="danger">Error</small><small class="text-muted bg-warning" id="warning">Warning</small></div></div></div>');
        const helper = declarations(document.getElementById('helper'));
        expect(contrast(helper.color, '#ffffff')).toBeGreaterThanOrEqual(4.5);
        expect(declarations(document.getElementById('danger')).color).toBeUndefined();
        expect(declarations(document.getElementById('warning')).color).toBeUndefined();
    });

    test('editor neutral outline buttons have readable paint in each state and a visible focus cue', () => {
        expect(add()).toMatch(/class="btn btn-sm btn-outline-secondary mt-2" onclick="selectAll\(\);"/);
        route('oe-reminder-editor', '<div class="oe-reminder-document"><button class="btn btn-sm btn-outline-secondary" id="select">Select All</button><button class="btn btn-sm btn-outline-secondary" id="disabled" disabled>Disabled</button><button class="btn btn-sm btn-outline-secondary disabled" id="disabled-class">Disabled</button><button class="btn btn-outline-secondary btn-danger" id="danger">Danger</button></div>');
        const button = document.getElementById('select');
        for (const state of ['', ':hover', ':focus']) {
            const values = declarations(button, state);
            expect(contrast(values.color, values.background || values['background-color'])).toBeGreaterThanOrEqual(4.5);
            expect(values['border-color']).toMatch(/^#[\da-f]{6}$/i);
            if (state === ':focus') expect(values.outline).toMatch(/^[^0]/);
        }
        const disabled = declarations(document.getElementById('disabled'), ':disabled');
        expect(contrast(disabled.color, disabled.background || disabled['background-color'])).toBeGreaterThanOrEqual(4.5);
        expect(disabled['border-color']).toMatch(/^#[\da-f]{6}$/i);
        const disabledClass = declarations(document.getElementById('disabled-class'));
        expect(contrast(disabledClass.color, disabledClass.background || disabledClass['background-color'])).toBeGreaterThanOrEqual(4.5);
        expect(disabledClass['border-color']).toMatch(/^#[\da-f]{6}$/i);
        const semantic = declarations(document.getElementById('danger'));
        expect(semantic.color).toBeUndefined();
        expect(semantic.background).toBeUndefined();
        expect(semantic['border-color']).toBeUndefined();
    });

    test.each(['oe-reminder-editor', 'oe-reminder-log'])('%s overrides only fixed legacy section headers without clipping', body => {
        const source = body === 'oe-reminder-editor' ? add() : log();
        expect(source).toContain('section-header mb-2 oe-reminder-section');
        expect(read('interface/themes/core/tabs.scss')).toMatch(/\.section-header\s*\{[^}]*width:\s*685px/s);
        route(body, '<div class="oe-reminder-sheet"><div class="card-body"><div class="section-header oe-reminder-section" style="max-width: 100%; box-sizing: border-box; overflow: hidden;"><h6>Long translated section title</h6><button>Action</button></div><div class="section-header" id="legacy">Legacy</div></div></div>');
        const section = declarations(document.querySelector('.oe-reminder-section'));
        expect(section.width).toBe('100%');
        expect(section['min-width']).toBe('0');
        expect(section['max-width']).toBe('100%');
        expect(section['flex-wrap']).toBe('wrap');
        expect(section.overflow).toBe('visible !important');
        expect(declarations(document.getElementById('legacy')).width).toBeUndefined();
        expect(css()).not.toMatch(/overflow:\s*hidden/);
    });
});
