/** @jest-environment node */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const postcss = require('postcss');
const { JSDOM } = require('jsdom');

const root = path.join(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const source = () => read('interface/orders/patient_match_dialog.php');
const cssPath = 'interface/clinical-workspace/patient-match-popup.css';
const css = () => read(cssPath);

const SCOPE = 'html.oe-workbench-popup body.oe-patient-match-popup';
const baselineHash = '6bb7cf7a7fc555eaa9d8d1e88a693eb582002c99ee7307e84105ea01e45ea4f7';
const callerHash = 'f357748171626ef52bf2955a37c6013a61d1d5493e8f330f31950e9e0239a8fc';

// Explicit, reversible presentation map: [original, presented]. Nothing else may differ.
const presentationChanges = [
    ['use OpenEMR\\Common\\Acl\\AclMain;', 'use OpenEMR\\Common\\Acl\\AclMain;\nuse OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;'],
    ["<?php Header::setupHeader(['opener']); ?>", "<?php Header::setupHeader(['opener']); ?>\n<?php $clinicalAssets = new ClinicalWorkspaceAssets(); ?>\n<link rel=\"stylesheet\" media=\"screen\" href=\"<?php echo attr(\\OpenEMR\\Core\\OEGlobalsBag::getInstance()->getWebRoot()); ?>/interface/clinical-workspace/patient-match-popup.css?v=<?php echo attr_url($clinicalAssets->version('patient-match-popup.css')); ?>\">"],
    ['<body class="body_top">', '<body class="body_top oe-patient-match-popup">'],
    ['<div id="searchResults">', '<div id="searchResults" class="oe-match-document">'],
    ['<table class="table table-striped table-sm">', '<table class="table table-striped table-sm oe-match-table">'],
    ['            <h5>\n', '            <h5 class="oe-match-heading">\n'],
    ['<p>\n    <input', '<p class="oe-match-actions">\n    <input'],
];
const count = (value, part) => value.split(part).length - 1;

function restorePresentation(php) {
    let restored = php;
    for (const [before, after] of presentationChanges) {
        if (count(restored, after) !== 1) throw new Error(`Expected one presentation change: ${after}`);
        restored = restored.replace(after, before);
    }
    return restored;
}

describe('route source invariant', () => {
    test('only the explicit presentation map separates the route from its 186-line original', () => {
        const restored = restorePresentation(source());
        expect(restored.split('\n').length - 1).toBe(186);
        expect(sha(restored)).toBe(baselineHash);
    });

    test('ACL, CSRF, SQL scoring, escaping and callback mutations break the restored digest', () => {
        const restored = restorePresentation(source());
        const mutations = [
            ["aclCheckCore('patients', 'med')", "aclCheckCore('patients', 'demo')"],
            ['CsrfUtils::collectCsrfToken(session: $session)', "'static-token'"],
            ["onsubmit='return myRestoreSession()'", "onsubmit='return true'"],
            ['((fname IS NOT NULL AND fname = ?) * 5)', '((fname IS NOT NULL AND fname = ?) * 6)'],
            ['((ss IS NOT NULL AND ss LIKE ?) * 10)', '((ss IS NOT NULL AND ss LIKE ?) * 5)'],
            ['$clarr[] = "%" . $form_ss;', '$clarr[] = $form_ss;'],
            ['ORDER BY closeness DESC, lname, fname LIMIT 10', 'ORDER BY closeness ASC, lname, fname LIMIT 10'],
            ["if ($row['closeness'] == 0) {", "if ($row['closeness'] < 0) {"],
            ["text($row['ss'])", "$row['ss']"],
            ['attr_js($row[\'pid\'])', 'js_escape($row[\'pid\'])'],
            ['onclick="openPatient(0)"', 'onclick="openPatient(-1)"'],
            ['onclick="window.close()"', 'onclick="dlgclose()"'],
            ["xla('Add New Patient')", "xla('Add Patient')"],
            ['js_escape("select[$form_key]")', 'js_escape("pid[$form_key]")'],
            ["xlj('Form element not found')", "xlj('Missing')"],
            ['$(this).addClass("highlight");', '$(this).addClass("active");'],
            ['opener.top.restoreSession();', 'top.restoreSession();'],
            ['</form>\n</center>', '</form>'],
        ];
        for (const [before, after] of mutations) {
            expect(restored).toContain(before);
            expect(sha(restored.replace(before, after))).not.toBe(baselineHash);
        }
    });

    test('the dlgopen caller is byte-identical', () => {
        expect(sha(read('interface/orders/list_reports.php'))).toBe(callerHash);
        expect(read('interface/orders/list_reports.php')).toContain(
            "dlgopen('patient_match_dialog.php?key=' + encodeURIComponent(args), '_blank', 850, 400, '', dlgtitle);"
        );
    });

    test('route links only its own screen sheet through the fixed versioned basename', () => {
        const php = source();
        expect(php).toContain('<link rel="stylesheet" media="screen" href="<?php echo attr(\\OpenEMR\\Core\\OEGlobalsBag::getInstance()->getWebRoot()); ?>/interface/clinical-workspace/patient-match-popup.css?v=<?php echo attr_url($clinicalAssets->version(\'patient-match-popup.css\')); ?>">');
        expect(php).not.toContain('workspace.css');
        expect(count(php, 'rel="stylesheet"')).toBe(1);
        const assets = read('src/Common/Assets/ClinicalWorkspaceAssets.php');
        const supported = [...assets.match(/SUPPORTED = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
        expect(supported).toContain('patient-match-popup.css');
        expect(supported).toEqual([...supported].sort());
    });
});

// Executes the route's own inline script against synthetic opener forms.
function routeDom({ withElement = true, ownRestore = true } = {}) {
    const php = source();
    const key = '{"ss":"1234","fname":"Ann","lname":"Lee","DOB":"1970-01-01"}';
    const script = php.match(/<script>([\s\S]*?)<\/script>/)[1]
        .replace('<?php echo js_escape("select[$form_key]"); ?>', JSON.stringify(`select[${key}]`))
        .replace("<?php echo xlj('Form element not found'); ?>", JSON.stringify('Form element not found'));
    expect(script).not.toContain('<?php');
    const body = php.slice(php.indexOf('<body'), php.indexOf('</html>')).replace(/<\?php[\s\S]*?\?>/g, '');
    const dom = new JSDOM(`<!DOCTYPE html><html><head></head>${body}</html>`, { runScripts: 'dangerously' });
    const { window } = dom;
    const table = window.document.querySelector('#searchResults table');
    // Mirrors the route's echo: attr_js('7') decodes to "7" inside the double-quoted attribute.
    table.insertAdjacentHTML('beforeend', '<tr class=\'oneresult\' onclick="openPatient(&quot;7&quot;)"><td>Lee, Ann</td><td>1970-01-01</td><td>F</td><td>555</td><td>1234</td><td>1 Main 2000</td></tr>');

    const openerDoc = new JSDOM('<form><input name="other"></form>').window.document;
    if (withElement) {
        const input = openerDoc.createElement('input');
        input.name = `select[${key}]`;
        openerDoc.forms[0].appendChild(input);
    }
    const openerRestore = jest.fn();
    // Browsers expose form controls as named properties (f[name]); jsdom does not, so model it via namedItem.
    const form = openerDoc.forms[0];
    const namedForm = new Proxy(form, {
        get: (target, prop) => (typeof prop === 'string' && !(prop in target) ? target.elements.namedItem(prop) ?? undefined : target[prop]),
    });
    const opener = { document: { forms: [namedForm] }, top: { restoreSession: openerRestore } };
    Object.defineProperty(window, 'opener', { configurable: true, value: opener });
    window.close = jest.fn();
    window.alert = jest.fn();
    if (ownRestore) window.restoreSession = jest.fn();

    // Minimal jQuery surface used by the route: ready, .mouseover/.mouseout and add/removeClass.
    const ready = [];
    window.$ = window.jQuery = arg => {
        if (typeof arg === 'function') { ready.push(arg); return undefined; }
        const nodes = arg.nodeType ? [arg] : [...window.document.querySelectorAll(arg)];
        const on = type => fn => { nodes.forEach(n => n.addEventListener(type, () => fn.call(n))); return api; };
        const api = {
            mouseover: on('mouseover'),
            mouseout: on('mouseout'),
            addClass: c => nodes.forEach(n => n.classList.add(c)),
            removeClass: c => nodes.forEach(n => n.classList.remove(c)),
        };
        return api;
    };
    window.eval(script);
    ready.forEach(fn => fn());
    return { window, openerDoc, openerRestore, key };
}

describe('original inline callbacks in jsdom', () => {
    test('clicking a match row writes its pid into the opener field and closes natively', () => {
        const { window, openerDoc, key } = routeDom();
        window.document.querySelector('tr.oneresult').click();
        expect(openerDoc.forms[0].elements[`select[${key}]`].value).toBe('7');
        expect(window.close).toHaveBeenCalledTimes(1);
        expect(window.alert).not.toHaveBeenCalled();
    });

    test('hover keeps the original highlight class toggle', () => {
        const { window } = routeDom();
        const row = window.document.querySelector('tr.oneresult');
        row.dispatchEvent(new window.MouseEvent('mouseover'));
        expect(row.classList.contains('highlight')).toBe(true);
        row.dispatchEvent(new window.MouseEvent('mouseout'));
        expect(row.classList.contains('highlight')).toBe(false);
    });

    test('Add New Patient writes zero and closes; Cancel closes natively', () => {
        const { window, openerDoc, key } = routeDom();
        const buttons = [...window.document.querySelectorAll('p input[type=button]')];
        expect(buttons.map(b => b.getAttribute('onclick'))).toEqual(['openPatient(0)', 'window.close()']);
        buttons[0].click();
        expect(openerDoc.forms[0].elements[`select[${key}]`].value).toBe('0');
        expect(window.close).toHaveBeenCalledTimes(1);
        buttons[1].click();
        expect(window.close).toHaveBeenCalledTimes(2);
    });

    test('a missing opener element alerts with the field name and does not close', () => {
        const { window, key } = routeDom({ withElement: false });
        window.document.querySelector('tr.oneresult').click();
        expect(window.alert).toHaveBeenCalledWith(`Form element not found: select[${key}]`);
        expect(window.close).not.toHaveBeenCalled();
    });

    test('form submit restores session through top, else through opener.top', () => {
        const own = routeDom();
        expect(own.window.myRestoreSession()).toBe(true);
        expect(own.window.restoreSession).toHaveBeenCalledTimes(1);
        expect(own.openerRestore).not.toHaveBeenCalled();
        expect(own.window.document.forms[0].getAttribute('onsubmit')).toBe('return myRestoreSession()');

        const fallback = routeDom({ ownRestore: false });
        expect(fallback.window.myRestoreSession()).toBe(true);
        expect(fallback.openerRestore).toHaveBeenCalledTimes(1);
    });

    test('presentation classes sit on existing nodes; all six columns and the foster-parented heading remain', () => {
        const { window } = routeDom();
        const doc = window.document;
        expect(doc.body.className).toBe('body_top oe-patient-match-popup');
        expect(doc.querySelector('#searchResults').className).toBe('oe-match-document');
        expect(doc.querySelector('#searchResults table').className).toBe('table table-striped table-sm oe-match-table');
        expect(doc.querySelectorAll('#searchResults th')).toHaveLength(6);
        expect(doc.querySelector('#searchResults > h5.oe-match-heading')).not.toBeNull();
        expect(doc.querySelector('p.oe-match-actions').querySelectorAll('input')).toHaveLength(2);
    });
});

function rules() {
    const tree = postcss.parse(css());
    const list = [];
    tree.walkRules(rule => {
        const decls = {};
        const important = {};
        rule.walkDecls(d => { decls[d.prop] = d.value; important[d.prop] = d.important; });
        list.push({ selectors: rule.selectors, decls, important });
    });
    return { tree, list };
}
const find = (list, re) => list.filter(r => r.selectors.some(s => re.test(s)));
const px = value => {
    const parts = String(value).trim().split(/\s+/).map(v => parseFloat(v));
    const [t, r = t, , l = r] = parts;
    return { top: t, right: r, left: l };
};

// Width of the patient_match_dialog iframe for the list_reports.php caller: dlgopen(..., 850, 400).
// dialog.js freezes max-width as a percentage of the width at OPEN time (97% for modal-full at
// <= 1080px, else 850/width toFixed(1)); later shell resizes keep that percentage. Its inline
// "0.75rem auto auto" margin makes horizontal margins auto, so the dialog is min(percent, 100%)
// of the current width. Then subtract the 1px .modal-content border each side and px-1 (.25rem
// at a 16px root) each side of .modal-body; the iframe itself is border-0 and w-100.
function dialogGeometry({ openWidth, resizedWidth = openWidth }) {
    const percent = openWidth <= 1080 ? 97 : Number((850 / openWidth * 100).toFixed(1));
    const dialog = Math.min(resizedWidth * percent / 100, resizedWidth);
    return { percent, frame: dialog - 2 * 1 - 2 * 4 };
}

describe('scoped screen stylesheet', () => {
    test('every rule is scoped and no at-rule (media, supports) appears', () => {
        const { tree, list } = rules();
        const atRules = [];
        tree.walkAtRules(a => atRules.push(a.name));
        expect(atRules).toEqual([]);
        expect(list.length).toBeGreaterThan(0);
        for (const r of list) for (const s of r.selectors) expect(s.startsWith(`${SCOPE}`)).toBe(true);
        for (const r of list) for (const s of r.selectors) expect(s === SCOPE || s.startsWith(`${SCOPE} `) || s.startsWith(`${SCOPE}.`) || s.startsWith(`${SCOPE}:`)).toBe(true);
    });

    test('colour and background are always declared as a pair', () => {
        const { list } = rules();
        for (const r of list) {
            const hasInk = 'color' in r.decls;
            const hasPaper = 'background' in r.decls || 'background-color' in r.decls;
            expect([r.selectors.join(','), hasInk]).toEqual([r.selectors.join(','), hasPaper]);
        }
    });

    test('paper/ink pairs override the compiled body_top, striped-row and highlight !important rules', () => {
        const { list } = rules();
        const paired = re => {
            const hits = find(list, re).filter(r => 'color' in r.decls);
            expect(hits.length).toBeGreaterThan(0);
            for (const r of hits) {
                expect(r.important.color).toBe(true);
                expect(r.important.background || r.important['background-color']).toBe(true);
            }
            return hits;
        };
        paired(new RegExp(`^${SCOPE.replace(/\./g, '\\.')}$`));
        paired(/\.oe-match-table tr:nth-of-type\(odd\)/);
        paired(/\.oe-match-heading$/);
        paired(/\.oe-match-table th$/);
        paired(/\.oe-match-table td$/);
        const highlight = paired(/tr\.oneresult\.highlight(?: td)?$/);
        const td = find(list, /\.oe-match-table td$/)[0];
        const bg = r => r.decls.background || r.decls['background-color'];
        expect(bg(highlight[0])).not.toBe(bg(td));
    });

    test('original typography is untouched and nothing hides content', () => {
        const text = css();
        expect(text).not.toMatch(/(?:^|[\s;{])(?:font|font-size|font-family|line-height|letter-spacing|zoom|transform)\s*:/m);
        expect(text).not.toMatch(/display:\s*none|visibility:\s*hidden|overflow:\s*hidden|text-overflow/);
    });

    test('cells wrap at the inherited size inside a full-width table', () => {
        const { list } = rules();
        const table = find(list, /\.oe-match-table$/)[0];
        expect(table.decls.width).toBe('100%');
        expect(table.decls['min-width']).toBeUndefined();
        for (const cell of ['th', 'td']) {
            const r = find(list, new RegExp(`\\.oe-match-table ${cell}$`))[0];
            expect(r.decls['white-space']).toBe('normal');
            expect(r.decls['overflow-wrap']).toBe('anywhere');
        }
    });

    test('actions wrap with zero horizontal margins and a bounded width', () => {
        const { list } = rules();
        const bar = find(list, /\.oe-match-actions$/)[0];
        expect(bar.decls.display).toBe('flex');
        expect(bar.decls['flex-wrap']).toBe('wrap');
        const input = find(list, /\.oe-match-actions input$/)[0];
        expect(input.decls['margin-left']).toBe('0');
        expect(input.decls['margin-right']).toBe('0');
        expect(input.decls['max-width']).toBe('100%');
        expect(input.decls['white-space']).toBe('normal');
    });

    test(':focus fallback and :focus-visible are separate rules', () => {
        const { list } = rules();
        const focus = list.filter(r => r.selectors.some(s => /:focus$/.test(s)));
        const visible = list.filter(r => r.selectors.some(s => /:focus-visible$/.test(s)));
        expect(focus.length).toBeGreaterThan(0);
        expect(visible.length).toBeGreaterThan(0);
        for (const r of [...focus, ...visible]) {
            expect(r.selectors.every(s => /:focus$/.test(s)) || r.selectors.every(s => /:focus-visible$/.test(s))).toBe(true);
            expect(r.decls.outline).toMatch(/solid/);
        }
    });

    test('dialog.js sizing branches the geometry model depends on are present', () => {
        const dialog = read('library/dialog.js');
        expect(dialog).toContain('if (where.innerWidth <= 1080) {\n        width = "modal-full";');
        expect(dialog).toContain("mWidth = (width / where.innerWidth * 100).toFixed(1) + '%';");
        expect(dialog).toContain('{max-width:97% !important;}');
        // Inline style applied after append: horizontal margins become auto, overriding Bootstrap's.
        expect(dialog).toContain(`jQuery('div.modal-dialog', modalwin).css({'margin': "0.75rem auto auto"});`);
        expect(dialog).toContain('<div class="modal-body px-1 h-100">');
        expect(dialog).toContain('<iframe id="modalframe" class="modalIframe w-100 h-100 border-0"');
    });

    test('iframe width: direct open versus desktop open then resize (percent frozen at open)', () => {
        // Direct narrow open: modal-full 97% of 320 = 310.4, minus 2px content border and 8px px-1.
        expect(dialogGeometry({ openWidth: 320 }).frame).toBeCloseTo(300.4, 2);
        // First width-honouring open: 850/1081 = 78.6%.
        expect(dialogGeometry({ openWidth: 1081 }).percent).toBe(78.6);
        expect(dialogGeometry({ openWidth: 1081 }).frame).toBeCloseTo(1081 * 0.786 - 10, 2);
        // Desktop open at 1920 freezes 44.3%; resizing the shell to 320 keeps it.
        const resized = dialogGeometry({ openWidth: 1920, resizedWidth: 320 });
        expect(resized.percent).toBe(44.3);
        expect(resized.frame).toBeCloseTo(131.76, 2);
    });

    test('declared horizontal budget includes body, document and six cell paddings; text min-content is unknown', () => {
        const { list } = rules();
        const body = find(list, new RegExp(`^${SCOPE.replace(/\./g, '\\.')}$`))[0];
        const docBox = find(list, /\.oe-match-document$/)[0];
        const td = find(list, /\.oe-match-table td$/)[0];
        const th = find(list, /\.oe-match-table th$/)[0];
        expect(docBox.decls['max-width']).toBe('100%');
        expect(docBox.decls['box-sizing']).toBe('border-box');
        const bodyPad = px(body.decls.padding);
        const docPad = px(docBox.decls.padding);
        const cellPad = r => { const p = px(r.decls.padding); return p.left + p.right; };
        const decoration = bodyPad.left + bodyPad.right + docPad.left + docPad.right + 2 * parseFloat(docBox.decls.border);
        const cells = 6 * Math.max(cellPad(td), cellPad(th));
        expect(decoration).toBe(46);
        expect(cells).toBe(96);
        const textBudget = frame => frame - decoration - cells;

        // Direct narrow open leaves a positive declared remainder; whether six columns of real
        // text fit in it (min-content, font, translation) is UNKNOWN without native layout.
        expect(textBudget(dialogGeometry({ openWidth: 320 }).frame)).toBeCloseTo(158.4, 2);

        // Diagnostic, not a pass: desktop-open-then-resize leaves a NEGATIVE declared remainder.
        // Frame sizing is inherited from dialog.js, but the NEW body/document decoration contributes
        // to the negative declared budget. No native baseline comparison was run, so neither whole
        // failure nor non-regression is established; native tiny-frame acceptance stays OPEN.
        expect(textBudget(dialogGeometry({ openWidth: 1920, resizedWidth: 320 }).frame)).toBeCloseTo(-10.24, 2);
    });
});
