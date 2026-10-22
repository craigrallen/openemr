/**
 * @jest-environment node
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const postcss = require('postcss');
const { JSDOM } = require('jsdom');

const root = path.join(__dirname, '../..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const route = () => read('interface/drugs/add_edit_lot.php');
const css = () => read('interface/clinical-workspace/inventory-lot-popup.css');
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');

// Whole-file sha256 at 18647270, before the inventory lot adaptation.
const ROUTE_BASELINE = '696e010b78d936b19d82e596527227fde28e2992447ea5932c0add678e58383d';
// The caller is not part of the adaptation and must stay byte-identical.
const CALLER_BASELINE = '6274e2f466498e32988224ba283702f17ed6e6e11f4959cf21934df41365a23a';

const SCOPE = 'html.oe-workbench-popup body.oe-inventory-lot-popup';
const LINK = '    <?php $clinicalAssets = new ClinicalWorkspaceAssets(); ?>\n'
    + '    <link rel="stylesheet" media="screen" href="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>'
    + "/interface/clinical-workspace/inventory-lot-popup.css?v=<?php echo attr_url($clinicalAssets->version('inventory-lot-popup.css')); ?>\">\n";

// The only intended insertions, as a reversible mapping: [added text, its original form, occurrences].
const INSERTIONS = [
    ['use OpenEMR\\Common\\Acl\\AclMain;\nuse OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;\n', 'use OpenEMR\\Common\\Acl\\AclMain;\n', 1],
    ["<?php Header::setupHeader(['datetime-picker', 'opener']); ?>\n" + LINK, "<?php Header::setupHeader(['datetime-picker', 'opener']); ?>\n", 1],
    ['<body class="body_top oe-inventory-lot-popup">', '<body class="body_top">', 1],
    ['<h3 class="ml-1 oe-inventory-lot-title">', '<h3 class="ml-1">', 1],
    ["<form class='oe-inventory-lot-form' method='post' name='theform'", "<form method='post' name='theform'", 1],
    ['<table class="table table-borderless w-100 oe-inventory-lot-fields">', '<table class="table table-borderless w-100">', 1],
    ['<div class="btn-group mt-3 oe-inventory-lot-actions">', '<div class="btn-group mt-3">', 1],
];

const normalize = (source) => INSERTIONS.reduce((text, [added, original, count]) => {
    expect(text.split(added)).toHaveLength(count + 1);
    return text.split(added).join(original);
}, source);

// Mapping used for mutation checks: tolerates a missing insertion instead of asserting.
const looseNormalize = (source) => INSERTIONS.reduce((text, [added, original]) => text.split(added).join(original), source);

const CONTRACT_KEYS = ['tag', 'id', 'name', 'type', 'value', 'size', 'maxlength', 'method', 'action', 'onsubmit', 'onclick', 'onchange', 'title', 'readonly'];
const controls = (source) => [...source.replace(/<\?php[\s\S]*?\?>/g, '@')
    .matchAll(/<(form|input|select|textarea|button|tr|td|option)\b([^>]*)>/g)]
    .map(([, tag, attrs]) => {
        const control = { tag };
        for (const [, key, double, single] of attrs.matchAll(/([\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'))?/g)) {
            if (CONTRACT_KEYS.includes(key.toLowerCase())) control[key.toLowerCase()] = double ?? single ?? true;
        }
        return control;
    });

describe('inventory lot route source contract', () => {
    test('caller drug_inventory.php is byte-identical and launches 600x475', () => {
        const caller = read('interface/drugs/drug_inventory.php');
        expect(hash(caller)).toBe(CALLER_BASELINE);
        expect(caller).toContain("dlgopen('add_edit_lot.php?' + params.toString(), '_blank', 600, 475);");
    });

    test('route reverses to the exact baseline bytes through the presentation mapping', () => {
        const source = route();
        expect(hash(source)).not.toBe(ROUTE_BASELINE);
        expect(hash(normalize(source))).toBe(ROUTE_BASELINE);
    });

    test('form controls, rows and handlers are unchanged apart from the added classes', () => {
        const source = route();
        expect(controls(source)).toEqual(controls(normalize(source)));
        for (const id of ['row_sale_date', 'row_lot_number', 'row_manufacturer', 'row_expiration', 'row_source_lot',
            'row_vendor', 'row_warehouse', 'row_on_hand', 'row_quantity', 'row_cost', 'row_notes', 'label_warehouse']) {
            expect(source.split(`id='${id}'`).length + source.split(`id="${id}"`).length - 2).toBe(1);
        }
    });

    test.each([
        ['CSRF check', 'CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: true);', '/* csrf */'],
        ['CSRF token field', 'name="csrf_token_form"', 'name="csrf_token_removed"'],
        ['ACL gate', "AclMain::aclCheckCore('inventory', 'transfers') ||", "true ||"],
        ['destruction ACL', "AclMain::aclCheckCore('inventory', 'destruction'))) { ?>", 'true)) { ?>'],
        ['SQL parameter', 'WHERE drug_id = ? AND inventory_id = ?', 'WHERE drug_id = $drug_id AND inventory_id = ?'],
        ['opener callback', 'if (opener.refreshme) opener.refreshme();', 'opener.refreshme();'],
        ['submit validation', "onsubmit='return validate()'", "onsubmit='return true'"],
        ['transaction handler', "onchange='trans_type_changed()'", "onchange=''"],
        ['print action', "onclick='window.print()'", "onclick=''"],
        ['cancel action', "onclick='window.close()'", "onclick='history.back()'"],
        ['row id', "<tr id='row_cost'>", "<tr id='row_price'>"],
        ['typography', 'font-size: 0.8125rem;', 'font-size: 0.75rem;'],
    ])('negative mutation of %s breaks the inverse hash', (label, from, to) => {
        const source = route();
        expect(source).toContain(from);
        expect(hash(looseNormalize(source.replace(from, to)))).not.toBe(ROUTE_BASELINE);
    });

    test('stylesheet is linked once, screen-only, versioned through a supported basename', () => {
        const source = route();
        expect(source.split('inventory-lot-popup.css').length - 1).toBe(2);
        expect(source).toContain(LINK);
        const assets = read('src/Common/Assets/ClinicalWorkspaceAssets.php');
        expect(assets).toMatch(/\n {8}'inventory-lot-popup\.css',\n/);
        expect(assets).not.toMatch(/'workspace\.css',\n {8}'inventory-lot-popup\.css'/);
    });
});

describe('inventory lot stylesheet', () => {
    const rules = () => {
        const ast = postcss.parse(css());
        const list = [];
        ast.walkRules((rule) => list.push(rule));
        return { ast, list };
    };

    test('every rule is scoped to the workbench popup route body, without media queries', () => {
        const { ast, list } = rules();
        expect(list.length).toBeGreaterThan(5);
        let atRules = 0;
        ast.walkAtRules(() => { atRules++; });
        expect(atRules).toBe(0);
        for (const rule of list) {
            for (const selector of rule.selectors) expect(selector.startsWith(`${SCOPE} `) || selector === SCOPE).toBe(true);
        }
    });

    test('preserves typography and never hides, reveals or forces row display', () => {
        const { list } = rules();
        for (const rule of list) {
            rule.walkDecls((decl) => {
                expect(['font-size', 'font', 'line-height', 'visibility', 'zoom', 'transform']).not.toContain(decl.prop);
                if (decl.prop === 'display') {
                    expect(decl.important === true).toBe(false);
                    expect(decl.value).not.toBe('none');
                }
                if (decl.important) expect(['color', 'background-color', 'border-color', 'width']).toContain(decl.prop);
            });
            expect(rule.selector).not.toMatch(/#row_|#label_warehouse|\[style/);
        }
    });

    test('focus and focus-visible rules are separate and homogeneous', () => {
        const { list } = rules();
        const focus = list.filter((rule) => rule.selector.includes(':focus'));
        expect(focus.some((rule) => /:focus-visible/.test(rule.selector))).toBe(true);
        expect(focus.some((rule) => /:focus(?!-)/.test(rule.selector))).toBe(true);
        for (const rule of focus) {
            const kinds = new Set(rule.selectors.map((s) => (/:focus-visible/.test(s) ? 'visible' : 'focus')));
            expect(kinds.size).toBe(1);
        }
    });

    test('paper and ink are paired wherever either is set, including placeholder and focus', () => {
        const { list } = rules();
        for (const rule of list) {
            const props = new Set();
            rule.walkDecls((decl) => props.add(decl.prop));
            const paper = props.has('background') || props.has('background-color');
            if (paper || props.has('color')) {
                if (rule.selector.includes('::placeholder')) continue;
                expect({ selector: rule.selector, paired: paper && props.has('color') }).toEqual({ selector: rule.selector, paired: true });
            }
        }
        expect(list.some((rule) => rule.selector.includes('::placeholder') && /color:/.test(rule.toString()))).toBe(true);
    });

    test('native action labels do not wrap and keep semantic colours', () => {
        const text = css();
        expect(text).toMatch(/\.oe-inventory-lot-actions \.btn \{[^}]*white-space: nowrap;/);
        for (const kind of ['btn-primary', 'btn-danger', 'btn-warning']) {
            expect(text).toContain(`.oe-inventory-lot-actions .${kind} {`);
        }
    });
});

// Executes the route's actual inline <head> script in jsdom against a synthetic form.
function resolveScript(source, lotId) {
    const head = source.slice(source.indexOf('<script>'), source.indexOf('</script>'));
    let js = head.replace('<script>', '')
        .replace(/<\?php if \(!\$lot_id\) \{[^?]*\?>([\s\S]*?)<\?php \} \?>/g, (m, body) => (lotId ? '' : body))
        .replace(/<\?php if \(\$lot_id\) \{[^?]*\?>([\s\S]*?)<\?php \} else \{[^?]*\?>([\s\S]*?)<\?php \} \?>/g,
            (m, yes, no) => (lotId ? yes : no))
        .replace("<?php echo areVendorsUsed() ? 'true' : 'false'; ?>", 'true')
        .replace("<?php echo js_escape(date('Y-m-d')) ?>", JSON.stringify('2026-10-14'))
        .replace(/<\?php echo xlj\('([^']*)'\); \?>/g, (m, text) => JSON.stringify(text))
        .replace(/<\?php[\s\S]*?\?>/g, '');
    expect(js).not.toMatch(/<\?php|\?>/);
    return js;
}

function syntheticForm(source, lotId) {
    const start = source.indexOf('<table class="table');
    const end = source.indexOf('</form>');
    const markup = source.slice(start, end)
        .replace(/<select name='form_trans_type'([^>]*)>[\s\S]*?<\/select>/,
            "<select name='form_trans_type'$1><option value='2'>Purchase/Receipt</option><option value='3'>Return</option>"
            + "<option value='4'>Transfer</option><option value='5'>Adjustment</option><option value='7'>Consumption</option>"
            + "<option value='0'>Edit Only</option></select>")
        .replace(/<option value='0'><\/option>\s*<\?php[\s\S]*?\?>/, "<option value='0'></option><option value='9|1'>L9</option><option value='8|2'>L8</option>")
        .replace(/<\?php\s*\/\/ Address book[\s\S]*?\?>/, "<select name='form_vendor_id' id='form_vendor_id'><option value=''></option></select>")
        .replace(/<\?php\s*if \(\s*!genWarehouseList[\s\S]*?\?>/, "<select name='form_warehouse_id' id='form_warehouse_id'><option value=''>Unassigned</option><option value='W1|1'>W1</option></select>")
        .replace(/<\?php if \(\$lot_id && [\s\S]*?<\?php \} \?>/, lotId ? "<input type='button' class='btn btn-danger' value='Destroy' />" : '')
        .replace(/<\?php[\s\S]*?\?>/g, '');
    expect(markup).not.toMatch(/<\?php/);
    return `<form method='post' name='theform' onsubmit='return validate()'>${markup}</form>`;
}

// jsdom does not implement the form's named-control getters (f.form_trans_type) that browsers
// provide and the route's script relies on; expose them from form.elements.
function shimNamedControls(form) {
    for (const element of form.elements) {
        if (element.name && !(element.name in form)) {
            Object.defineProperty(form, element.name, { get: () => form.elements.namedItem(element.name) });
        }
    }
}

function load(lotId, withCss = true) {
    const source = route();
    const dom = new JSDOM(`<!doctype html><html class="oe-workbench-popup"><head>${withCss ? `<style>${css()}</style>` : ''}</head>`
        + `<body class="body_top oe-inventory-lot-popup">${syntheticForm(source, lotId)}</body></html>`, { runScripts: 'outside-only' });
    const win = dom.window;
    shimNamedControls(win.document.forms[0]);
    win.alerts = [];
    win.alert = (msg) => win.alerts.push(msg);
    win.confirmAnswer = true;
    win.confirm = (msg) => { win.alerts.push(msg); return win.confirmAnswer; };
    win.$ = () => undefined;
    win.eval(resolveScript(source, lotId));
    return win;
}

const ROWS = ['quantity', 'on_hand', 'sale_date', 'cost', 'source_lot', 'notes', 'manufacturer', 'vendor', 'lot_number', 'warehouse', 'expiration'];
const all = (except) => ROWS.filter((row) => !except.includes(row));
// Expected visible rows per transaction type, written independently from the route's branches.
const VISIBLE = {
    new: {
        2: all(['source_lot', 'on_hand']),
        3: all(['source_lot', 'manufacturer', 'vendor']),
        4: all(['cost', 'manufacturer', 'vendor', 'lot_number', 'expiration', 'on_hand']),
        5: all(['cost', 'source_lot', 'manufacturer', 'vendor']),
        7: all(['cost', 'source_lot', 'manufacturer', 'vendor']),
        0: all(['quantity', 'sale_date', 'cost', 'source_lot', 'notes']),
    },
    lot: {
        2: all(['source_lot']),
        4: all(['cost', 'manufacturer', 'vendor', 'lot_number', 'expiration', 'warehouse']),
    },
};

describe('actual trans_type_changed in jsdom', () => {
    const cases = [];
    for (const [branch, types] of Object.entries(VISIBLE)) {
        for (const [type, visible] of Object.entries(types)) cases.push([branch, type, visible]);
    }
    test.each(cases)('%s lot, type %s shows only its rows; stylesheet keeps hidden rows hidden', (branch, type, visible) => {
        const win = load(branch === 'lot');
        const f = win.document.forms[0];
        f.form_trans_type.value = type;
        win.trans_type_changed();
        for (const row of ROWS) {
            const tr = win.document.getElementById(`row_${row}`);
            expect([row, tr.style.display]).toEqual([row, visible.includes(row) ? '' : 'none']);
            expect([row, win.getComputedStyle(tr).display === 'none']).toEqual([row, !visible.includes(row)]);
        }
        const editable = type === '2' || type === '0';
        expect([f.form_manufacturer.readOnly, f.form_lot_number.readOnly, f.form_expiration.readOnly]).toEqual([!editable, !editable, !editable]);
        expect(win.document.getElementById('label_warehouse').innerHTML).toBe(type === '4' ? 'Destination Warehouse' : 'Warehouse');
    });

    test('the same visibility results without the stylesheet (legacy rendering)', () => {
        const win = load(false, false);
        win.document.forms[0].form_trans_type.value = '4';
        win.trans_type_changed();
        expect(win.document.getElementById('row_cost').style.display).toBe('none');
        expect(win.getComputedStyle(win.document.getElementById('row_cost')).display).toBe('none');
    });
});

describe('actual validate in jsdom (no submission)', () => {
    const fill = (win, values) => {
        const f = win.document.forms[0];
        for (const [name, value] of Object.entries(values)) f[name].value = value;
        return f;
    };
    const base = { form_trans_type: '2', form_sale_date: '2026-10-14', form_quantity: '5', form_lot_number: 'L1', form_warehouse_id: 'W1|1', form_notes: 'AB' };

    test.each([
        ['future date', { form_sale_date: '2026-10-15' }, 'Transaction date must not be in the future or before 2000'],
        ['pre-2000 date', { form_sale_date: '1999-12-31' }, 'Transaction date must not be in the future or before 2000'],
        ['missing quantity', { form_quantity: '' }, 'A quantity is required'],
        ['negative purchase', { form_quantity: '-1' }, 'Quantity cannot be negative for this transaction type'],
        ['missing lot number', { form_lot_number: ' ' }, 'A lot number is required'],
        ['missing warehouse', { form_warehouse_id: '' }, 'A warehouse is required'],
        ['missing comments', { form_notes: ' ' }, 'Comments are required'],
    ])('rejects %s', (label, override, message) => {
        const win = load(false);
        expect(win.validate.call(null, fill(win, { ...base, ...override }))).toBe(false);
        expect(win.alerts).toEqual([message]);
    });

    test('valid purchase returns undefined (original non-transfer fall-through, submit not blocked)', () => {
        const win = load(false);
        fill(win, base);
        expect(win.validate()).toBeUndefined();
        expect(win.alerts).toEqual([]);
    });

    test('transfer requires a source lot and confirms cross-facility moves', () => {
        let win = load(false);
        fill(win, { ...base, form_trans_type: '4' });
        expect(win.validate()).toBe(false);
        expect(win.alerts).toEqual(['A source lot is required']);

        win = load(false);
        fill(win, { ...base, form_trans_type: '4', form_source_lot: '8|2' });
        win.confirmAnswer = false;
        expect(win.validate()).toBe(false);
        expect(win.alerts).toEqual(['Warning: Source and target facilities differ. Continue anyway?']);

        win = load(false);
        fill(win, { ...base, form_trans_type: '4', form_source_lot: '9|1' });
        expect(win.validate()).toBe(true);
        expect(win.alerts).toEqual([]);
    });

    test('adjustment allows a negative quantity', () => {
        const win = load(true);
        fill(win, { ...base, form_trans_type: '5', form_quantity: '-2' });
        expect(win.validate()).toBeUndefined();
        expect(win.alerts).toEqual([]);
    });
});

describe('native actions', () => {
    test('print and cancel run their original inline handlers', () => {
        const source = route();
        const dom = new JSDOM(`<!doctype html><body>${syntheticForm(source, true)}</body>`, { runScripts: 'dangerously' });
        const win = dom.window;
        const calls = [];
        win.print = () => calls.push('print');
        win.close = () => calls.push('close');
        const buttons = [...win.document.querySelectorAll('.btn-group input')];
        // The synthetic Destroy stand-in is not clicked: its handler navigates (source-asserted above).
        expect(buttons.map((b) => b.value)).toEqual(['', 'Destroy', '', '']);
        buttons[2].click();
        buttons[3].click();
        expect(calls).toEqual(['print', 'close']);
    });
});

describe('dialog dimensions from library/dialog.js', () => {
    test('600x475 caller: width class chosen once at open, percentage retained on resize, height initial only', () => {
        const dialog = read('library/dialog.js');
        // Opened at <= 1080px: modal-full, 97% of the viewport.
        expect(dialog).toContain('if (where.innerWidth <= 1080) {\n        width = "modal-full";');
        expect(dialog).toContain("msSize = '<style>.modal-custom-' + winname + ' {max-width:97% !important;}</style>';");
        // Opened wider: 600 / innerWidth rounded to one decimal percent, written once; a later
        // resize keeps that percentage of the new viewport (no 1080px re-check, no 600px cap).
        expect(dialog).toContain("mWidth = (width / where.innerWidth * 100).toFixed(1) + '%';");
        expect(dialog).not.toMatch(/addEventListener\(['"]resize|\.on\(['"]resize/);
        // 475 is the initial height; auto sizing replaces it after load, capped at the viewport.
        expect(dialog).toContain('max-height: 94vh');
        expect(dialog).toContain("sizeHeight: 'auto'");
        expect(dialog).toContain('frameContentHt = Math.max(jQuery(idoc).height(), idoc.body.offsetHeight) + 60;');
        expect(dialog).toContain('frameContentHt = frameContentHt <= minSize ? minSize : frameContentHt;');

        // Iframe content width needed for label beside value, derived from the stylesheet (see below).
        const { total } = twoColumnWidth();
        // A 97% dialog at a 320px viewport is ~310px before modal chrome: cells stack there.
        expect(0.97 * 320).toBeLessThan(total);
        // Opened at 1920px then resized to 1000px: 31.3% of 1000 = 313px, also below the threshold.
        const percent = Number((600 / 1920 * 100).toFixed(1));
        expect(percent).toBe(31.3);
        expect(percent / 100 * 1000).toBeLessThan(total);
        // At open above 1080px the dialog is ~600px; only the remainder over the threshold is left
        // for unmeasured modal chrome (modal-body px-1, dialog borders) and any label wider than
        // its basis, so two columns there are not claimed as measured.
        expect(total).toBeLessThan(600);
    });
});

// Horizontal geometry read from the shipped stylesheet, at a 16px root.
const px = (value) => {
    const match = /^(-?[\d.]+)(px|rem)$/.exec(value.trim());
    if (!match) throw new Error(`unsupported length ${value}`);
    return Number(match[1]) * (match[2] === 'rem' ? 16 : 1);
};
const box = (value) => {
    const parts = value.trim().split(/\s+/).map(px);
    return { top: parts[0], right: parts[1] ?? parts[0], bottom: parts[2] ?? parts[0], left: parts[3] ?? parts[1] ?? parts[0] };
};
function twoColumnWidth() {
    const decls = {};
    postcss.parse(css()).walkRules((rule) => {
        rule.walkDecls((decl) => { decls[`${rule.selector}|${decl.prop}`] = decl.value; });
    });
    const get = (suffix, prop) => {
        const value = decls[`${SCOPE}${suffix}|${prop}`];
        if (value === undefined) throw new Error(`missing ${prop} on ${suffix || 'body'}`);
        return value;
    };
    const row = ' .oe-inventory-lot-fields > tbody > tr';
    const bodyPad = box(get('', 'padding'));
    const formPad = box(get(' .oe-inventory-lot-form', 'padding'));
    const formBorder = px(get(' .oe-inventory-lot-form', 'border').split(/\s+/)[0]);
    const formMargin = px(get(' .oe-inventory-lot-form', 'margin-left'));
    const rowGap = get(row, 'gap').split(/\s+/);
    const columnGap = px(rowGap[1] ?? rowGap[0]);
    const label = px(get(`${row} > td:first-child`, 'flex').split(/\s+/)[2]);
    const value = px(get(`${row} > td:last-child`, 'flex').split(/\s+/)[2]);
    const parts = {
        bodyPadding: bodyPad.left + bodyPad.right,
        formMargin,
        formBorder: 2 * formBorder,
        formPadding: formPad.left + formPad.right,
        label,
        columnGap,
        value,
    };
    return { parts, total: Object.values(parts).reduce((a, b) => a + b, 0) };
}

describe('two-column geometry derived from the stylesheet', () => {
    test('row cells, column gap and every body/form padding, border and margin are counted', () => {
        const { parts, total } = twoColumnWidth();
        // Label basis + value basis alone is not the threshold; the gap and the sheet's chrome count too.
        expect(parts.columnGap).toBeGreaterThan(0);
        expect(total).toBe(parts.label + parts.value + parts.columnGap + parts.bodyPadding
            + parts.formMargin + parts.formBorder + parts.formPadding);
        expect(total).toBeGreaterThan(parts.label + parts.value + parts.columnGap);
    });

    test('documentation states the derived threshold and qualifies dialog, height and translation claims', () => {
        const { total } = twoColumnWidth();
        const doc = read('docs/clinical-ui/INVENTORY-LOT-POPUP.md');
        expect(doc).toContain(`${total}px`);
        expect(doc).not.toMatch(/416px/);
        expect(doc).not.toMatch(/never truncate/i);
        expect(doc).not.toMatch(/native inputs never wrap/i);
        // Opening at a narrow viewport differs from opening wide and then resizing.
        expect(doc).toMatch(/toFixed\(1\)/);
        expect(doc).toMatch(/resiz/i);
        // 475 is the initial/minimum height; SizeModaliFrame may change it after load.
        expect(doc).toMatch(/SizeModaliFrame/);
        expect(doc).not.toMatch(/fit is (verified|guaranteed)/i);
    });
});
