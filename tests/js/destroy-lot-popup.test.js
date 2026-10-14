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
const route = () => read('interface/drugs/destroy_lot.php');
const css = () => read('interface/clinical-workspace/destroy-lot-popup.css');
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');

// Whole-file sha256 of interface/drugs/destroy_lot.php at 18647270, before the adaptation.
const ROUTE_BASELINE = '8c25ef448cab5fbf774bbb408fec7a5ebf9a3b5b233427503412e60e348e9dc3';
// The callers are not part of the adaptation and must stay byte-identical.
const CALLER_BASELINE = '696e010b78d936b19d82e596527227fde28e2992447ea5932c0add678e58383d';
const INVENTORY_BASELINE = '6274e2f466498e32988224ba283702f17ed6e6e11f4959cf21934df41365a23a';

const SCOPE = 'html.oe-workbench-popup body.oe-destroy-lot-popup';
const LINK = "<?php $clinicalAssets = new ClinicalWorkspaceAssets(); ?>\n"
    + '<link rel="stylesheet" media="screen" href="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>'
    + "/interface/clinical-workspace/destroy-lot-popup.css?v=<?php echo attr_url($clinicalAssets->version('destroy-lot-popup.css')); ?>\">\n";

// The only intended insertions, as a reversible mapping: [added text, its original form, occurrences].
const INSERTIONS = [
    ['use OpenEMR\\Common\\Acl\\AclMain;\nuse OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;\n', 'use OpenEMR\\Common\\Acl\\AclMain;\n', 1],
    ["<?php Header::setupHeader(['datetime-picker', 'opener']); ?>\n" + LINK, "<?php Header::setupHeader(['datetime-picker', 'opener']); ?>\n", 1],
    ['<body class="body_top oe-destroy-lot-popup">', '<body class="body_top">', 1],
    ["<form class='oe-destroy-lot-form' method='post' name='theform'", "<form method='post' name='theform'", 1],
    ["<table class='table-borderless w-100 oe-destroy-lot-fields'>", "<table class='table-borderless w-100'>", 1],
    ['<div class="btn-group oe-destroy-lot-actions">', '<div class="btn-group">', 1],
];

const normalize = (source) => INSERTIONS.reduce((text, [added, original, count]) => {
    expect([added, text.split(added).length - 1]).toEqual([added, count]);
    return text.split(added).join(original);
}, source);

// Mapping used for mutation checks: tolerates a missing insertion instead of asserting.
const looseNormalize = (source) => INSERTIONS.reduce((text, [added, original]) => text.split(added).join(original), source);

const CONTRACT_KEYS = ['tag', 'id', 'name', 'type', 'value', 'size', 'maxlength', 'method', 'action', 'onsubmit', 'onclick', 'title', 'width'];
const controls = (source) => [...source.replace(/<\?php[\s\S]*?\?>/g, '@')
    .matchAll(/<(form|input|select|textarea|button|tr|td|center)\b([^>]*)>/g)]
    .map(([, tag, attrs]) => {
        const control = { tag };
        for (const [, key, double, single] of attrs.matchAll(/([\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'))?/g)) {
            if (CONTRACT_KEYS.includes(key.toLowerCase())) control[key.toLowerCase()] = double ?? single ?? true;
        }
        return control;
    });

describe('destroy lot route source contract', () => {
    test('caller add_edit_lot.php and its opener drug_inventory.php are byte-identical', () => {
        const caller = read('interface/drugs/add_edit_lot.php');
        expect(hash(caller)).toBe(CALLER_BASELINE);
        // Destroy is reached by same-frame navigation from the Add/Update Lot dialog.
        expect(caller).toContain("onclick=\"window.location.href='destroy_lot.php?drug=<?php echo attr_url($drug_id); ?>&lot=<?php echo attr_url($lot_id); ?>'\" />");
        const inventory = read('interface/drugs/drug_inventory.php');
        expect(hash(inventory)).toBe(INVENTORY_BASELINE);
        expect(inventory).toContain("dlgopen('add_edit_lot.php?' + params.toString(), '_blank', 600, 475);");
    });

    test('route reverses to the exact baseline bytes through the presentation mapping', () => {
        const source = route();
        expect(hash(source)).not.toBe(ROUTE_BASELINE);
        expect(hash(normalize(source))).toBe(ROUTE_BASELINE);
    });

    test('form, cells, controls and handlers are unchanged apart from the added classes', () => {
        const source = route();
        expect(controls(source)).toEqual(controls(normalize(source)));
        // Original classes survive alongside the added ones.
        expect(source).toContain('<body class="body_top oe-destroy-lot-popup">');
        expect(source).toContain("<table class='table-borderless w-100 oe-destroy-lot-fields'>");
        expect(source.split('<td class="text-nowrap align-top"').length - 1).toBe(8);
        expect(source).toContain('<center>');
        expect(source).toContain('</center>');
    });

    test.each([
        ['ACL gate', "if (!AclMain::aclCheckCore('admin', 'drugs')) {", 'if (false) {'],
        ['drug guard', "die(xlt('Drug ID missing!'));", '/* drug */'],
        ['lot guard', "die(xlt('Lot ID missing!'));", '/* lot */'],
        ['save condition', "if ($_POST['form_save']) {", "if ($_REQUEST['form_save']) {"],
        ['CSRF check', 'CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: true);', '/* csrf */'],
        ['CSRF token field', 'name="csrf_token_form"', 'name="csrf_token_removed"'],
        ['CSRF token session', 'CsrfUtils::collectCsrfToken(session: $session)', 'CsrfUtils::collectCsrfToken()'],
        ['update SQL', '"WHERE drug_id = ? AND inventory_id = ?",', '"WHERE drug_id = $drug_id AND inventory_id = ?",'],
        ['null date binding', '(empty($_POST[\'form_date\']) ? "NULL" : $_POST[\'form_date\'])', "$_POST['form_date']"],
        ['select SQL', '"AND inventory_id = ?", [$drug_id,$lot_id]);', '"AND inventory_id = $lot_id", [$drug_id]);'],
        ['window close after save', 'echo " window.close();\\n";', 'echo "\\n";'],
        ['opener refresh', 'echo " if (opener.refreshme) opener.refreshme();\\n";', 'echo " opener.refreshme();\\n";'],
        ['submit validation', "onsubmit='return validate(this);'", "onsubmit='return true;'"],
        ['confirmation text', "xlj('Really destroy this lot?')", "xlj('Destroy?')"],
        ['confirmation result', 'return false;\n        }\n        top.restoreSession();', 'return true;\n        }\n        top.restoreSession();'],
        ['session restore', 'top.restoreSession();', '/* session */'],
        ['datepicker init', "$('.datepicker').datetimepicker({", "$('.date').datetimepicker({"],
        ['datepicker options', '<?php $datetimepicker_timepicker = false; ?>', '<?php $datetimepicker_timepicker = true; ?>'],
        ['cancel action', "onclick='window.close()'", "onclick='history.back()'"],
        ['submit control', "name='form_save'", "name='form_go'"],
        ['header assets', "Header::setupHeader(['datetime-picker', 'opener']);", "Header::setupHeader(['datetime-picker']);"],
        ['typography', 'font-size: 0.8125rem;', 'font-size: 0.75rem;'],
        ['legacy centre', '<center>', '<div>'],
    ])('negative mutation of %s breaks the inverse hash', (label, from, to) => {
        const source = route();
        expect(source).toContain(from);
        expect(hash(looseNormalize(source.replace(from, to)))).not.toBe(ROUTE_BASELINE);
    });

    test('stylesheet is linked once, screen-only, versioned through a supported basename', () => {
        const source = route();
        expect(source.split('destroy-lot-popup.css').length - 1).toBe(2);
        expect(source).toContain(LINK);
        // Linked after Header::setupHeader so it follows popup.css in the cascade.
        expect(source.indexOf(LINK)).toBeGreaterThan(source.indexOf("Header::setupHeader(['datetime-picker', 'opener']);"));
        const assets = read('src/Common/Assets/ClinicalWorkspaceAssets.php');
        const list = [...assets.match(/SUPPORTED = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
        expect(list).toContain('destroy-lot-popup.css');
        expect(list).toEqual([...list].sort());
        expect(assets).toMatch(/\n {8}'destroy-lot-popup\.css',\n/);
        const phpTest = read('tests/Tests/Isolated/Common/Assets/ClinicalWorkspaceAssetsTest.php');
        expect(phpTest).toContain("['destroy-lot-popup.css', 'issue-popup.css', 'patient-picker-popup.css', 'patient-results-popup.css']");
        expect(phpTest).toContain("'near-miss destroy lot stylesheet' => ['destroy_lot_popup.css'],");
    });
});

// Markup of the route's form with PHP replaced by synthetic, non-private values.
function syntheticForm(source) {
    const start = source.indexOf('<form');
    const end = source.indexOf('</form>') + '</form>'.length;
    return source.slice(start, end)
        .replace(/<\?php echo attr_url\(\$drug_id\) \?>/, '7')
        .replace(/<\?php echo attr_url\(\$lot_id\) \?>/, '9')
        .replace(/<\?php echo CsrfUtils::collectCsrfToken\(session: \$session\); \?>/, 'synthetic-token')
        .replace(/<\?php echo text\(\$row\['lot_number'\]\) \?>/, 'LOT-SYNTHETIC-0000000000000000000000000000000000000000000001')
        .replace(/<\?php echo text\(\$row\['manufacturer'\]\) \?>/, 'Synthetic Manufacturer')
        .replace(/<\?php echo text\(\$row\['on_hand'\]\) \?>/, '12')
        .replace(/<\?php echo text\(\$row\['expiration'\]\) \?>/, '2027-01-31')
        .replace(/<\?php echo xlt\('([^']*)'\); \?>/g, '$1')
        .replace(/<\?php echo xla\('([^']*)'\) ?;\?>/g, '$1')
        .replace(/<\?php echo xla\('([^']*)'\); \?>/g, '$1')
        .replace(/<\?php[\s\S]*?\?>/g, '');
}

// The route's actual inline <head> script with only its PHP output expressions resolved.
function resolveScript(source) {
    const block = source.slice(source.indexOf('<script>') + '<script>'.length, source.indexOf('</script>'));
    const js = block
        .replace("<?php echo xlj('Really destroy this lot?'); ?>", JSON.stringify('Really destroy this lot?'))
        .replace(/<\?php[\s\S]*?\?>/g, '');
    expect(js).not.toMatch(/<\?php|\?>/);
    return js;
}

function load({ withCss = true, workbench = true } = {}) {
    const source = route();
    const dom = new JSDOM(`<!doctype html><html${workbench ? ' class="oe-workbench-context oe-workbench-popup"' : ''}><head>`
        + `${withCss ? `<style>${css()}</style>` : ''}</head>`
        + `<body class="body_top oe-destroy-lot-popup">${syntheticForm(source)}</body></html>`, { runScripts: 'dangerously' });
    const win = dom.window;
    const calls = [];
    const ready = [];
    win.confirmAnswer = false;
    win.confirm = (message) => { calls.push(['confirm', message]); return win.confirmAnswer; };
    // top === window in a lone jsdom document; the spy stands in for the shell's restoreSession.
    win.restoreSession = () => calls.push(['restoreSession']);
    win.close = () => calls.push(['close']);
    win.$ = (arg) => {
        if (typeof arg === 'function') ready.push(arg);
        return { datetimepicker: (options) => calls.push(['datetimepicker', arg, options]) };
    };
    win.eval(resolveScript(source));
    return { win, calls, ready };
}

describe('actual validate(f) and inline handlers in jsdom (no submission)', () => {
    test('declining the confirmation returns false and never restores the session', () => {
        const { win, calls } = load();
        expect(win.validate(win.document.forms[0])).toBe(false);
        expect(calls).toEqual([['confirm', 'Really destroy this lot?']]);
    });

    test('accepting the confirmation restores the session, then returns true', () => {
        const { win, calls } = load();
        win.confirmAnswer = true;
        expect(win.validate(win.document.forms[0])).toBe(true);
        expect(calls).toEqual([['confirm', 'Really destroy this lot?'], ['restoreSession']]);
    });

    test('the form onsubmit attribute cancels on decline and allows on accept', () => {
        const { win, calls } = load();
        const form = win.document.forms[0];
        expect(form.getAttribute('onsubmit')).toBe('return validate(this);');
        // A dispatched submit event runs handlers only; jsdom does not navigate or post.
        expect(form.dispatchEvent(new win.Event('submit', { cancelable: true }))).toBe(false);
        win.confirmAnswer = true;
        expect(form.dispatchEvent(new win.Event('submit', { cancelable: true }))).toBe(true);
        expect(calls).toEqual([['confirm', 'Really destroy this lot?'], ['confirm', 'Really destroy this lot?'], ['restoreSession']]);
    });

    test('cancel runs its original window.close handler; datepicker binds on ready', () => {
        const { win, calls, ready } = load();
        const buttons = [...win.document.querySelectorAll('.btn-group input')];
        expect(buttons.map((b) => [b.type, b.name, b.className])).toEqual([
            ['submit', 'form_save', 'btn btn-primary'],
            ['button', '', 'btn btn-secondary'],
        ]);
        buttons[1].click();
        expect(ready).toHaveLength(1);
        ready[0]();
        expect(calls[0]).toEqual(['close']);
        expect(calls[1][0]).toBe('datetimepicker');
        expect(calls[1][1]).toBe('.datepicker');
        expect(win.document.querySelectorAll('.datepicker')).toHaveLength(1);
        expect(win.document.querySelector('.datepicker').id).toBe('form_date');
    });

    test('the same handlers behave identically without the stylesheet or workbench context', () => {
        const { win, calls } = load({ withCss: false, workbench: false });
        win.confirmAnswer = true;
        expect(win.validate(win.document.forms[0])).toBe(true);
        expect(calls).toEqual([['confirm', 'Really destroy this lot?'], ['restoreSession']]);
    });
});

describe('destroy lot stylesheet', () => {
    const parse = () => {
        const ast = postcss.parse(css());
        const list = [];
        ast.walkRules((rule) => list.push(rule));
        return { ast, list };
    };
    const decls = (list) => list.flatMap((rule) => rule.nodes.filter((n) => n.type === 'decl').map((decl) => ({ rule, decl })));

    test('a single @media screen block holds every rule, each scoped to the route body', () => {
        const { ast, list } = parse();
        const atRules = [];
        ast.walkAtRules((at) => atRules.push(`${at.name} ${at.params}`));
        expect(atRules).toEqual(['media screen']);
        expect(list.length).toBeGreaterThan(8);
        for (const rule of list) {
            expect(rule.parent.type === 'atrule' && rule.parent.params === 'screen').toBe(true);
            for (const selector of rule.selectors) {
                expect([selector, selector === SCOPE || selector.startsWith(`${SCOPE} `)]).toEqual([selector, true]);
            }
        }
        expect(css()).not.toMatch(/@media print|@import/);
    });

    test('every selector matches the route markup inside a workbench popup and nothing outside it', () => {
        const { list } = parse();
        const source = route();
        const inside = new JSDOM(`<!doctype html><html class="oe-workbench-popup"><body class="body_top oe-destroy-lot-popup">${syntheticForm(source)}</body></html>`).window.document;
        const legacy = new JSDOM(`<!doctype html><html><body class="body_top oe-destroy-lot-popup">${syntheticForm(source)}</body></html>`).window.document;
        const other = new JSDOM(`<!doctype html><html class="oe-workbench-popup"><body class="body_top">${syntheticForm(source)}</body></html>`).window.document;
        for (const rule of list) {
            for (const selector of rule.selectors) {
                const structural = selector.replace(/::?(focus-visible|focus|hover|placeholder)/g, '');
                expect([selector, inside.querySelectorAll(structural).length > 0]).toEqual([selector, true]);
                expect(legacy.querySelectorAll(structural)).toHaveLength(0);
                expect(other.querySelectorAll(structural)).toHaveLength(0);
            }
        }
    });

    test('preserves typography and never hides, clips, fixes height or creates stacking contexts', () => {
        const { list } = parse();
        const forbidden = ['font', 'font-size', 'font-family', 'font-weight', 'font-style', 'line-height', 'letter-spacing',
            'text-transform', 'zoom', 'transform', 'visibility', 'opacity', 'clip', 'clip-path', 'overflow', 'overflow-x',
            'overflow-y', 'text-overflow', 'height', 'max-height', 'position', 'z-index', 'filter', 'isolation', 'contain',
            'will-change', 'content'];
        for (const { rule, decl } of decls(list)) {
            expect([rule.selector, decl.prop, forbidden.includes(decl.prop)]).toEqual([rule.selector, decl.prop, false]);
            if (decl.prop === 'display') expect(decl.value).not.toBe('none');
            if (decl.prop === 'min-height') expect(decl.value).toBe('0');
        }
    });

    test('!important is limited to the compiled-theme body background and the legacy nowrap label', () => {
        const { list } = parse();
        const important = decls(list).filter(({ decl }) => decl.important).map(({ rule, decl }) => [rule.selector, decl.prop]);
        expect(important).toEqual([
            [SCOPE, 'background-color'],
            [`${SCOPE} .oe-destroy-lot-fields > tbody > tr > td:first-child`, 'white-space'],
        ]);
    });

    test('colours use only popup.css workbench tokens, paired paper with ink', () => {
        const { list } = parse();
        const popup = read('interface/clinical-workspace/popup.css');
        for (const { rule, decl } of decls(list)) {
            if (/color|background|border|outline|box-shadow/.test(decl.prop)) {
                expect([decl.prop, decl.value]).not.toEqual([decl.prop, expect.stringMatching(/#|rgb|hsl/)]);
            }
            for (const [, token] of decl.value.matchAll(/var\((--[\w-]+)\)/g)) {
                expect(token.startsWith('--oe-wb-')).toBe(true);
                expect(popup).toContain(`${token}:`);
            }
            void rule;
        }
        for (const rule of list) {
            const props = new Set(rule.nodes.filter((n) => n.type === 'decl').map((d) => d.prop));
            const paper = props.has('background') || props.has('background-color');
            if (paper || props.has('color')) {
                expect({ selector: rule.selector, paired: paper && props.has('color') }).toEqual({ selector: rule.selector, paired: true });
            }
        }
    });

    test('rows wrap: label and value cells may shrink, labels wrap, long display values break', () => {
        const text = css();
        const block = (selector) => {
            const found = parse().list.find((rule) => rule.selector === `${SCOPE} ${selector}`);
            expect([selector, !!found]).toEqual([selector, true]);
            return Object.fromEntries(found.nodes.filter((n) => n.type === 'decl').map((d) => [d.prop, d.value]));
        };
        expect(block('.oe-destroy-lot-fields > tbody > tr')).toMatchObject({ display: 'flex', 'flex-wrap': 'wrap' });
        expect(block('.oe-destroy-lot-fields > tbody > tr > td')).toMatchObject({ 'min-width': '0' });
        expect(block('.oe-destroy-lot-fields > tbody > tr > td:first-child')).toMatchObject({ 'white-space': 'normal', 'overflow-wrap': 'anywhere' });
        expect(block('.oe-destroy-lot-fields > tbody > tr > td:last-child')).toMatchObject({ 'overflow-wrap': 'anywhere', 'min-width': '0' });
        expect(block('.oe-destroy-lot-fields input[type=\'text\']')).toMatchObject({ 'max-width': '100%' });
        expect(block('.oe-destroy-lot-actions')).toMatchObject({ display: 'flex', 'flex-wrap': 'wrap' });
        expect(block('.oe-destroy-lot-form > center')).toEqual({ 'text-align': 'start' });
        for (const { decl } of decls(parse().list)) expect(decl.value).not.toMatch(/max-content|min-content|nowrap/);
        expect(text).not.toMatch(/\btext-nowrap\s*[,{]/);
    });

    test('focus and focus-visible rules are separate, homogeneous and visible', () => {
        const { list } = parse();
        const focus = list.filter((rule) => rule.selector.includes(':focus'));
        expect(focus.some((rule) => /:focus-visible/.test(rule.selector))).toBe(true);
        for (const rule of focus) {
            const kinds = new Set(rule.selectors.map((s) => (/:focus-visible/.test(s) ? 'visible' : 'focus')));
            expect(kinds.size).toBe(1);
            if (kinds.has('visible')) expect(rule.toString()).toMatch(/outline: 2px solid var\(--oe-wb-/);
            expect(rule.toString()).not.toMatch(/outline: (0|none)/);
        }
    });
});

describe('documentation', () => {
    test('records caller geometry from source and qualifies unverified acceptance gates', () => {
        const doc = read('docs/clinical-ui/DESTROY-LOT-POPUP.md');
        expect(doc).toContain("dlgopen('add_edit_lot.php?' + params.toString(), '_blank', 600, 475)");
        expect(doc).toMatch(/window\.location\.href/);
        expect(doc).toMatch(/SizeModaliFrame/);
        expect(doc).toMatch(/innerWidth <= 1080/);
        for (const gate of [/compiled theme/i, /keyboard/i, /translation/i, /print/i, /opener/i, /narrow/i, /approval/i]) {
            expect(doc).toMatch(gate);
        }
        expect(doc).not.toMatch(/fit is (verified|guaranteed)|visually verified|accepted in (a )?real browser/i);
    });
});
