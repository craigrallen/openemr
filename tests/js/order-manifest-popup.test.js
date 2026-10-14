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
const exists = (file) => fs.existsSync(path.join(root, file));
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const count = (text, needle) => text.split(needle).length - 1;

const ROUTE = 'interface/orders/order_manifest.php';
const SHEET = 'interface/clinical-workspace/order-manifest-popup.css';
const ASSETS = 'src/Common/Assets/ClinicalWorkspaceAssets.php';
const ASSETS_TEST = 'tests/Tests/Isolated/Common/Assets/ClinicalWorkspaceAssetsTest.php';
const DOC = 'docs/clinical-ui/ORDER-MANIFEST-POPUP.md';

const route = () => read(ROUTE);
// Absent before the adaptation: tests assert presence instead of crashing the suite on import.
const css = () => (exists(SHEET) ? read(SHEET) : null);

// Whole-file sha256 of the route at 18647270, before the adaptation.
const ROUTE_BASELINE = '9a4e86bbe1933e932eec5483ea1c51b4c1995cb32413b6abad79402dfeb55c8f';
const UNCHANGED = {
    // Both callers open the manifest with a plain target='_blank' link (no dlgopen, no window.open).
    'interface/orders/list_reports.php': 'f357748171626ef52bf2955a37c6013a61d1d5493e8f330f31950e9e0239a8fc',
    'interface/orders/single_order_results.inc.php': '17b7eb52c209bef3450046eb2aaaea33834bca94713e2ef818e7c0392dff8ce7',
    // Shared activation autoloaded by Header::setupHeader(); not part of this adaptation.
    'interface/clinical-workspace/popup.js': 'af967e78fef59e75d2a5a5c4e08916bbea90a7f108c67f3def027b3061dc330f',
    'interface/clinical-workspace/popup.css': 'ea56e9f26990e843219a68f315c188f7e2b0581c20321bac4517dc4ba34e79a9',
};

// ClinicalWorkspaceAssets::SUPPORTED at 18647270, in order.
const ASSETS_BASELINE = [
    'ajtooltip.js', 'appointment.css', 'calendar-sidebar.js', 'calendar-workday.css', 'calendar-workday.js',
    'encounter-document.css', 'finder.css', 'global-messages.css', 'history-document.css', 'history-editor.css',
    'issue-popup.css', 'lbf-document.css', 'mode.js', 'patient-messages.css', 'patient-picker-popup.css',
    'patient-results-popup.css', 'patient-search.css', 'soap-document.css', 'soap-document.js', 'soap-reference.css',
    'soap-reference.js', 'visit-history.css', 'visit-history.js', 'workspace.css',
];

const BODY_CLASS = 'oe-order-manifest';
// Context, not popup: a standalone tab gets the shared tokens without popup.css body typography.
const SCOPE = `html.oe-workbench-context body.${BODY_CLASS}`;
const MODE_KEY = 'openemr.navigation.mode';
const HEADER = '<?php Header::setupHeader(); ?>\n';
const LINK = '<?php $clinicalAssets = new ClinicalWorkspaceAssets(); ?>\n'
    + '<link rel="stylesheet" media="screen" href="<?php echo attr(\\OpenEMR\\Core\\OEGlobalsBag::getInstance()->getWebRoot()); ?>'
    + "/interface/clinical-workspace/order-manifest-popup.css?v=<?php echo attr_url($clinicalAssets->version('order-manifest-popup.css')); ?>\">\n";
// The exact route-local bootstrap. Tests execute the copy extracted from the route, not this constant.
const BOOTSTRAP_BODY = [
    "    // A target=_blank tab opens without an opener, so popup.js cannot reach the shell.",
    "    // Follow the saved navigation mode instead, as main.php does: anything but 'legacy' is workbench.",
    '    (function (win) {',
    '        if ((win.parent && win.parent !== win) || win.opener) {',
    '            return;',
    '        }',
    '        var html = win.document.documentElement;',
    '        var owned = false;',
    '        var running = false;',
    '        function set(enabled) {',
    "            if (enabled && !html.classList.contains('oe-workbench-context')) {",
    "                html.classList.add('oe-workbench-context');",
    '                owned = true;',
    '            } else if (!enabled && owned) {',
    '                owned = false;',
    "                html.classList.remove('oe-workbench-context');",
    '            }',
    '        }',
    '        function sync() {',
    '            var legacy;',
    '            try {',
    `                legacy = win.localStorage.getItem('${MODE_KEY}') === 'legacy';`,
    '            } catch (error) {',
    '                legacy = true;',
    '            }',
    '            set(!legacy);',
    '        }',
    '        function onStorage(event) {',
    `            if (event.key === null || event.key === '${MODE_KEY}') {`,
    '                sync();',
    '            }',
    '        }',
    '        function start() {',
    '            if (!running) {',
    '                running = true;',
    "                win.addEventListener('storage', onStorage);",
    '                sync();',
    '            }',
    '        }',
    '        function stop() {',
    '            running = false;',
    "            win.removeEventListener('storage', onStorage);",
    '            set(false);',
    '        }',
    "        win.addEventListener('pagehide', stop);",
    "        win.addEventListener('pageshow', function (event) {",
    '            if (event.persisted) {',
    '                start();',
    '            }',
    '        });',
    '        start();',
    '    }(window));',
    '',
].join('\n');
const BOOTSTRAP = `<script data-order-manifest-mode>\n${BOOTSTRAP_BODY}</script>\n`;

// The only intended insertions, as a reversible mapping: [adapted text, original text].
const INSERTIONS = [
    ['use OpenEMR\\Common\\Acl\\AclMain;\nuse OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;\n', 'use OpenEMR\\Common\\Acl\\AclMain;\n'],
    [HEADER + LINK + BOOTSTRAP, HEADER],
    [`<body class="${BODY_CLASS}">\n`, '<body>\n'],
];

// Strict inverse: each adapted form occurs exactly once, and no unadapted original survives.
const normalize = (source) => INSERTIONS.reduce((text, [added, original]) => {
    expect([added, count(text, added)]).toEqual([added, 1]);
    if (!added.startsWith(original)) {
        expect([original, count(text, original)]).toEqual([original, 0]);
    }
    return text.split(added).join(original);
}, source);
const looseNormalize = (source) => INSERTIONS.reduce((text, [added, original]) => text.split(added).join(original), source);

// The bootstrap as the route actually ships it; fails while the route has none.
const bootstrapSource = () => {
    const match = route().match(/<script data-order-manifest-mode>\n([\s\S]*?)<\/script>\n/);
    expect(['data-order-manifest-mode script', match !== null]).toEqual(['data-order-manifest-mode script', true]);
    return match[1];
};
const runBootstrap = (win) => new Function('window', bootstrapSource())(win);

describe('order manifest route source contract', () => {
    test('both target=_blank callers and the shared popup activation are byte-identical', () => {
        for (const [file, sha] of Object.entries(UNCHANGED)) {
            expect([file, hash(read(file))]).toEqual([file, sha]);
        }
        for (const file of Object.keys(UNCHANGED)) {
            expect([file, /oe-order-manifest|order-manifest-popup/.test(read(file))]).toEqual([file, false]);
        }
    });

    test('the route reverses to the exact baseline bytes through the insertion map', () => {
        const source = route();
        expect(hash(source)).not.toBe(ROUTE_BASELINE);
        expect(hash(normalize(source))).toBe(ROUTE_BASELINE);
    });

    test('one helper-versioned screen-only stylesheet directly after Header::setupHeader, before title and route style', () => {
        const source = route();
        expect(source).toContain(HEADER + LINK);
        expect(count(source, 'order-manifest-popup.css')).toBe(2);
        expect(count(source, '<link ')).toBe(1);
        expect(source.indexOf(LINK)).toBeLessThan(source.indexOf('<title>'));
        expect(source.indexOf(LINK)).toBeLessThan(source.lastIndexOf('<style>'));
    });

    test('one exact mode bootstrap directly after the stylesheet link, still in <head>', () => {
        const source = route();
        expect(source).toContain(HEADER + LINK + BOOTSTRAP);
        expect(count(source, '<script')).toBe(1);
        expect(count(source, MODE_KEY)).toBe(2);
        expect(source.indexOf(BOOTSTRAP)).toBeLessThan(source.indexOf('<title>'));
        expect(source.indexOf(BOOTSTRAP)).toBeLessThan(source.indexOf('</head>'));
        // Context only: popup body typography stays with the shared controller.
        expect(source).not.toContain('oe-workbench-popup');
        // `\.open\s*\(` forbids window.open() calls without matching the required win.opener read.
        expect(bootstrapSource()).not.toMatch(/setItem|removeItem|clear|fetch|XMLHttpRequest|location|\.open\s*\(|opener\s*=|\btop\b|\bforms?\b|querySelector|getElement/);
    });

    test('body carries only the route class; no form class, workspace mode or shared typography activation', () => {
        const source = route();
        expect(source).toContain(`<body class="${BODY_CLASS}">\n<?php\n  generate_order_summary($orderid);\n?>\n</body>`);
        expect(source).toContain("<form method='post' action='order_manifest.php?orderid=<?php echo attr_url($orderid); ?>'>");
        expect(source).not.toMatch(/workspace\.css|mode\.js|oe-clinical-workspace|dlgopen|CsrfUtils/);
    });

    test.each([
        ['patients/med ACL', "$thisauth = AclMain::aclCheckCore('patients', 'med');", '$thisauth = true;'],
        ['ACL denial template', 'AccessDeniedHelper::denyWithTemplate("ACL check failed for patients/med: Order Summary", xl("Order Summary"));', ''],
        ['save trigger', "if ($_POST['bn_save']) {", 'if (true) {'],
        ['omission reset SQL', '"SET do_not_send = 0 WHERE " .', '"SET do_not_send = 1 WHERE " .'],
        ['omission set SQL', '"SET do_not_send = 1 WHERE " .', '"SET do_not_send = 0 WHERE " .'],
        ['omission seq binding', '[$orderid, intval($key)]', '[$orderid, $key]'],
        ['sendable filter', '$query .= "AND do_not_send = 0 ";', ''],
        ['sendable trigger', "if (!empty($_POST['bn_show_sendable'])) {", "if (!empty($_POST['bn_show_all'])) {"],
        ['procedure order', '$query .= "ORDER BY procedure_order_seq";', ''],
        ['checkbox name', "name='form_omit[\" . attr($order_seq) . \"]' value='1'", "name='form_omit[]' value='1'"],
        ['checkbox state', '        echo " checked";\n', ''],
        ['inline stripes', '$bgcolor = "#" . (($encount & 1) ? "ddddff" : "ffdddd");', '$bgcolor = "transparent";'],
        ['notes escaping', "$notes .= text($qrow['question_text'] . ': ' . $answer);", "$notes .= $qrow['question_text'] . ': ' . $answer;"],
        ['cell escaping', 'echo "  <td>" . myCellText("$procedure_code") . "</td>\\n";', 'echo "  <td>$procedure_code</td>\\n";'],
        ['form action escaping', '<?php echo attr_url($orderid); ?>', '<?php echo $orderid; ?>'],
        ['order id parse', "$orderid = intval($_GET['orderid']);", "$orderid = $_GET['orderid'];"],
        ['save action', "name='bn_save' value='<?php echo xla('Save omission selections'); ?>'", "name='bn_save' value='Save'"],
        ['show all action', "name='bn_show_all' value='<?php echo xla('Show all procedures'); ?>'", "name='bn_show_all' value='All'"],
        ['sendable action', "name='bn_show_sendable' value='<?php echo xla('Show only procedures not omitted'); ?>'", "name='bn_show_sendable' value='Sendable'"],
        ['print exclusion', "<div class='btn-group d-print-none'>", "<div class='btn-group'>"],
        ['responsive scroller', "<div class='ordsum table-responsive'>", "<div class='ordsum'>"],
        ['route print block', '@media print {\n    body {\n        margin: 9pt;', '@media screen {\n    body {\n        margin: 9pt;'],
        ['body margin', '    margin: 0.75rem;\n', '    margin: 0;\n'],
        ['body font', '    font-family: sans-serif;\n', '    font-family: Arial;\n'],
        ['translated title', "<title><?php echo xlt('Order Summary'); ?></title>", '<title>Order Summary</title>'],
    ])('mutation of %s breaks the inverse hash', (label, from, to) => {
        const source = route();
        expect([label, source.includes(from)]).toEqual([label, true]);
        expect(hash(looseNormalize(source.replace(from, to)))).not.toBe(ROUTE_BASELINE);
    });

    test.each([
        ['extra body class', (s) => s.replace(`${BODY_CLASS}">`, `${BODY_CLASS} extra">`)],
        ['print-capable link', (s) => s.replace('media="screen"', 'media="all"')],
        ['unversioned link', (s) => s.replace('?v=<?php', '<?php')],
        ['form class', (s) => s.replace("<form method='post'", "<form class='oe-order-manifest-sheet' method='post'")],
        ['second stylesheet', (s) => s.replace('</title>', '</title>\n<link rel="stylesheet" href="x.css">')],
        ['bootstrap writes storage', (s) => s.replace('        start();\n    }(window));', `        win.localStorage.setItem('${MODE_KEY}', 'workbench');\n        start();\n    }(window));`)],
        ['bootstrap fails open', (s) => s.replace('                legacy = true;\n', '                legacy = false;\n')],
        ['bootstrap adds popup class', (s) => s.replace("html.classList.add('oe-workbench-context');", "html.classList.add('oe-workbench-context', 'oe-workbench-popup');")],
        ['bootstrap ignores opener', (s) => s.replace(' || win.opener) {', ') {')],
    ])('presentation tampering (%s) breaks the inverse hash', (label, mutate) => {
        const source = route();
        const mutated = mutate(source);
        expect([label, mutated !== source]).toEqual([label, true]);
        expect(hash(looseNormalize(mutated))).not.toBe(ROUTE_BASELINE);
    });
});

describe('workbench activation of a target=_blank window', () => {
    const popupApi = require(path.join(root, 'interface/clinical-workspace/popup.js'));
    const ORIGIN = 'http://openemr';

    test('both callers use a plain target=_blank link with no rel, no dlgopen and no window.open', () => {
        const list = read('interface/orders/list_reports.php');
        const single = read('interface/orders/single_order_results.inc.php');
        for (const [file, source] of [['list_reports', list], ['single_order_results', single]]) {
            const at = source.indexOf('/interface/orders/order_manifest.php?orderid=');
            const link = source.slice(at, source.indexOf('>', source.indexOf("target='_blank'", at)));
            expect([file, link]).toEqual([file, expect.stringContaining("' target='_blank' onclick='top.restoreSession()'")]);
            expect([file, /rel=|dlgopen|window\.open/.test(link)]).toEqual([file, false]);
        }
    });

    // Synthetic same-origin windows: shell, the caller frame, and the manifest tab. The tab
    // records every property the bootstrap reads, and its storage records every call.
    function manifestTab({ active = true, opener = false, framed = false, stored, preset = '', controller = true } = {}) {
        const shellDoc = new JSDOM(`<body class="${active ? 'workbench-active' : ''}"><div id="mainBox"><div data-workbench-mode></div></div></body>`).window.document;
        const shell = { closed: false, location: { origin: ORIGIN }, document: shellDoc, opener: null };
        shell.parent = shell;
        const caller = { closed: false, location: { origin: ORIGIN }, document: new JSDOM('<body></body>').window.document, parent: shell, opener: null, frameElement: null };
        const doc = new JSDOM(`<html class="${preset}"><head></head><body class="${BODY_CLASS}"><form></form></body></html>`).window.document;
        const store = new Map(stored === undefined ? [] : [[MODE_KEY, stored]]);
        const reads = [];
        const writes = [];
        const touched = new Set();
        const listeners = [];
        let deny = null;
        const storage = {
            getItem(key) {
                reads.push(key);
                if (deny === 'getItem') throw new Error('SecurityError');
                return store.has(key) ? store.get(key) : null;
            },
            setItem: () => writes.push('setItem'),
            removeItem: () => writes.push('removeItem'),
            clear: () => writes.push('clear'),
            key: () => writes.push('key'),
        };
        const target = {
            closed: false,
            location: { origin: ORIGIN },
            frameElement: null,
            opener: opener ? caller : null,
            document: new Proxy(doc, {
                get(t, prop) {
                    touched.add(`document.${String(prop)}`);
                    const value = Reflect.get(t, prop);
                    return typeof value === 'function' ? value.bind(t) : value;
                },
            }),
            addEventListener(type, fn) { listeners.push([type, fn]); },
            removeEventListener(type, fn) {
                const at = listeners.findIndex(([t, f]) => t === type && f === fn);
                if (at >= 0) listeners.splice(at, 1);
            },
        };
        Object.defineProperty(target, 'localStorage', {
            get() {
                if (deny === 'getter') throw new Error('SecurityError');
                return storage;
            },
        });
        const win = new Proxy(target, {
            get(t, prop) {
                touched.add(String(prop));
                return Reflect.get(t, prop);
            },
        });
        target.parent = framed ? caller : win;
        if (controller) popupApi.createPopupController({ win, observe: () => ({ disconnect() {} }) });
        return {
            doc,
            html: doc.documentElement,
            store,
            reads,
            writes,
            touched,
            deny: (mode) => { deny = mode; },
            types: () => listeners.map(([type]) => type).sort(),
            dispatch: (type, event = {}) => listeners.filter(([t]) => t === type).map(([, fn]) => fn).forEach((fn) => fn(event)),
            storageEvent(key) { this.dispatch('storage', { key, storageArea: storage }); },
            boot() { runBootstrap(win); return this; },
        };
    }
    const contextOn = (tab) => tab.html.classList.contains(popupApi.CONTEXT_CLASS);
    const popupOn = (tab) => tab.html.classList.contains(popupApi.POPUP_CLASS);
    const ALLOWED = ['addEventListener', 'document', 'document.documentElement', 'localStorage', 'opener', 'parent', 'removeEventListener'];
    const STANDALONE_LISTENERS = ['pagehide', 'pageshow', 'storage'];

    // The shared controller alone: the defect the route-local bootstrap exists for.
    test.each([
        ['opener retained, active workbench', true, true, true],
        ['opener retained, legacy shell', false, true, false],
        // Current browsers treat target=_blank without rel as noopener: popup.js cannot reach the shell.
        ['implicit noopener, active workbench', true, false, false],
    ])('shared controller only: %s', (label, active, opener, expected) => {
        const tab = manifestTab({ active, opener });
        expect([label, tab.doc.body.matches(SCOPE)]).toEqual([label, expected]);
    });

    describe('route-local navigation-mode bootstrap (executed from the route source)', () => {
        test.each([
            ['missing key follows the shell default', undefined, true],
            ['stored workbench', 'workbench', true],
            ['stored legacy', 'legacy', false],
            ['empty value is not legacy', '', true],
            ['only the exact legacy value counts', 'Legacy', true],
        ])('standalone tab: %s', (label, stored, expected) => {
            const tab = manifestTab({ stored, controller: false }).boot();
            expect([label, contextOn(tab), popupOn(tab), tab.doc.body.matches(SCOPE)]).toEqual([label, expected, false, expected]);
            expect(tab.reads).toEqual([MODE_KEY]);
            expect(tab.writes).toEqual([]);
            expect(tab.types()).toEqual(STANDALONE_LISTENERS);
            expect([...tab.touched].filter((p) => !ALLOWED.includes(p))).toEqual([]);
        });

        test.each([['localStorage getter'], ['getItem']])('storage denial (%s) fails closed to legacy', (where) => {
            const tab = manifestTab({ stored: 'workbench', controller: false });
            tab.deny(where === 'getItem' ? 'getItem' : 'getter');
            tab.boot();
            expect([where, contextOn(tab), popupOn(tab)]).toEqual([where, false, false]);
            expect(tab.writes).toEqual([]);
            // Denial that appears later also falls back to legacy.
            const later = manifestTab({ controller: false }).boot();
            expect(contextOn(later)).toBe(true);
            later.deny(where === 'getItem' ? 'getItem' : 'getter');
            later.storageEvent(MODE_KEY);
            expect(contextOn(later)).toBe(false);
        });

        test('storage events for the mode key toggle legacy, workbench and clear', () => {
            const tab = manifestTab({ stored: 'legacy', controller: false }).boot();
            expect(contextOn(tab)).toBe(false);
            const steps = [];
            for (const [change, key] of [
                [() => tab.store.set(MODE_KEY, 'workbench'), MODE_KEY],
                [() => tab.store.set(MODE_KEY, 'legacy'), MODE_KEY],
                [() => tab.store.clear(), null],
                [() => tab.store.set(MODE_KEY, 'legacy'), MODE_KEY],
                [() => tab.store.delete(MODE_KEY), MODE_KEY],
            ]) {
                change();
                tab.storageEvent(key);
                steps.push(contextOn(tab));
            }
            expect(steps).toEqual([true, false, true, false, true]);
            expect(popupOn(tab)).toBe(false);
            expect(tab.writes).toEqual([]);
        });

        test('irrelevant storage events neither read storage nor change the class', () => {
            const tab = manifestTab({ controller: false }).boot();
            tab.store.set(MODE_KEY, 'legacy');
            tab.storageEvent('openemr.other');
            tab.storageEvent('');
            expect([contextOn(tab), tab.reads.length]).toEqual([true, 1]);
        });

        test.each([
            ['an opener', { opener: true }],
            ['a parent frame', { framed: true }],
        ])('a tab with %s is left entirely to the shared controller', (label, where) => {
            const tab = manifestTab({ ...where, stored: 'workbench', controller: false }).boot();
            expect([label, contextOn(tab), tab.types(), tab.reads]).toEqual([label, false, [], []]);
            expect([...tab.touched].filter((p) => !['opener', 'parent'].includes(p))).toEqual([]);
        });

        test('never removes a context class it did not add', () => {
            const tab = manifestTab({ stored: 'legacy', preset: popupApi.CONTEXT_CLASS, controller: false }).boot();
            expect(contextOn(tab)).toBe(true);
            tab.store.set(MODE_KEY, 'workbench');
            tab.storageEvent(MODE_KEY);
            tab.store.set(MODE_KEY, 'legacy');
            tab.storageEvent(MODE_KEY);
            tab.dispatch('pagehide', { persisted: false });
            expect(contextOn(tab)).toBe(true);
        });

        test('pagehide drops the owned class and storage listener; a bfcache restore restarts once', () => {
            const tab = manifestTab({ controller: false }).boot();
            tab.dispatch('pageshow', { persisted: false });
            expect([contextOn(tab), tab.types()]).toEqual([true, STANDALONE_LISTENERS]);
            tab.dispatch('pagehide', { persisted: true });
            expect([contextOn(tab), tab.types()]).toEqual([false, ['pagehide', 'pageshow']]);
            tab.store.set(MODE_KEY, 'workbench');
            tab.storageEvent(MODE_KEY);
            expect(contextOn(tab)).toBe(false);
            // Restored from bfcache after legacy was chosen elsewhere: re-read, not remembered.
            tab.store.set(MODE_KEY, 'legacy');
            tab.dispatch('pageshow', { persisted: true });
            tab.dispatch('pageshow', { persisted: true });
            expect([contextOn(tab), tab.types()]).toEqual([false, STANDALONE_LISTENERS]);
            tab.store.set(MODE_KEY, 'workbench');
            tab.storageEvent(MODE_KEY);
            expect(contextOn(tab)).toBe(true);
            tab.dispatch('pagehide', { persisted: false });
            tab.dispatch('pagehide', { persisted: false });
            expect([contextOn(tab), tab.types()]).toEqual([false, ['pagehide', 'pageshow']]);
            expect(tab.writes).toEqual([]);
        });
    });

    describe('shared controller and bootstrap together, in page order', () => {
        test.each([
            ['opener retained, active workbench, storage legacy', { active: true, opener: true, stored: 'legacy' }, true, true],
            ['opener retained, legacy shell, storage workbench', { active: false, opener: true, stored: 'workbench' }, false, false],
            ['implicit noopener, storage default', { active: true, opener: false }, true, false],
            ['implicit noopener, storage legacy', { active: true, opener: false, stored: 'legacy' }, false, false],
        ])('%s', (label, options, context, popup) => {
            const tab = manifestTab(options).boot();
            expect([label, contextOn(tab), popupOn(tab), tab.doc.body.matches(SCOPE)]).toEqual([label, context, popup, context]);
            expect([label, tab.reads]).toEqual([label, options.opener ? [] : [MODE_KEY]]);
            expect(tab.writes).toEqual([]);
        });

        test('with an opener the bootstrap adds no listener, so the controller alone tears down', () => {
            const bare = manifestTab({ opener: true });
            const booted = manifestTab({ opener: true }).boot();
            expect(booted.types()).toEqual(bare.types());
            booted.dispatch('pagehide', { persisted: false });
            expect([contextOn(booted), popupOn(booted)]).toEqual([false, false]);
        });
    });
});

describe('ClinicalWorkspaceAssets allowlist', () => {
    const supported = () => [...read(ASSETS).match(/SUPPORTED = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);

    test('keeps every existing name and adds only order-manifest-popup.css, sorted', () => {
        expect(supported()).toEqual([...ASSETS_BASELINE, 'order-manifest-popup.css'].sort());
    });

    test('the isolated PHP test covers the new name', () => {
        expect(read(ASSETS_TEST)).toContain("'order-manifest-popup.css'");
    });
});

// ---------------------------------------------------------------------------------------------
// Rendered-shape fixture: the route's markup for two procedures, built from its own source fragments.

// mode: 'popup' (shared controller via a retained opener), 'standalone' (route bootstrap), 'legacy'.
const HTML_CLASSES = { popup: 'oe-workbench-context oe-workbench-popup', standalone: 'oe-workbench-context', legacy: '' };
function documentHtml({ mode = 'popup', bodyClass = BODY_CLASS } = {}) {
    const info = Array.from({ length: 10 }, (_, i) => `<tr><td class="text-nowrap">L${i}</td><td>v</td><td class="text-nowrap">R${i}</td><td>v</td></tr>`).join('');
    const detail = (seq, bg, checked) => `<tr class='detail'style='background-color: #${bg};'>`
        + `<td><input type='checkbox' name='form_omit[${seq}]' value='1'${checked ? ' checked' : ''} /></td>`
        + '<td>C</td><td>N</td><td>D</td><td>&nbsp;</td></tr>';
    return `<html class="${HTML_CLASSES[mode]}"><head></head>`
        + `<body class="${bodyClass}"><form method='post' action='order_manifest.php?orderid=1'>`
        + `<div class='ordsum table-responsive'><table class='table table-active'>${info}</table><br />`
        + "<table class='table'><thead><tr class='head'><th>Omit</th><th>Code</th><th>Description</th><th>Diagnoses</th><th>Notes</th></tr></thead>"
        + `${detail(1, 'ddddff', false)}${detail(2, 'ffdddd', true)}</table></div>`
        + "<div class='btn-group d-print-none'>"
        + "<input type='submit' class='btn btn-primary' name='bn_save' value='Save omission selections' />"
        + "<input type='submit' class='btn btn-primary' name='bn_show_all' value='Show all procedures' />"
        + "<input type='submit' class='btn btn-primary' name='bn_show_sendable' value='Show only procedures not omitted' />"
        + '</div></form></body></html>';
}

test('fixture shape is taken from the route source', () => {
    const source = route();
    for (const fragment of [
        "<div class='ordsum table-responsive'>", "<table class='table table-active'>", "<table class='table'>",
        "<tr class='head'>", "echo \" <tr class='detail'style='background-color: $bgcolor;'>\\n\";",
        "<div class='btn-group d-print-none'>", "    </table>\n\n    <br />\n\n    <table class='table'>",
    ]) {
        expect([fragment, count(source, fragment)]).toEqual([fragment, 1]);
    }
    expect(count(source, "<input type='submit' class='btn btn-primary' name='bn_")).toBe(3);
});

// ---------------------------------------------------------------------------------------------
// Stylesheet guards. cssViolations() also runs against deliberately broken sheets below.

const tokens = () => {
    const found = {};
    for (const [, name, value] of read('interface/clinical-workspace/popup.css').matchAll(/(--oe-wb-[\w-]+):\s*(#[0-9a-f]{3,6})/gi)) {
        found[name] = value;
    }
    return found;
};
const luminance = (hex) => {
    const full = hex.length === 4 ? `#${[...hex.slice(1)].map((c) => c + c).join('')}` : hex;
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(full.slice(i, i + 2), 16) / 255)
        .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
};
const resolve = (value) => tokens()[value.match(/^var\((--oe-wb-[\w-]+)\)$/)?.[1]] ?? null;

const FORBIDDEN_PROPS = ['font', 'font-size', 'font-family', 'font-weight', 'font-style', 'font-stretch', 'line-height',
    'letter-spacing', 'word-spacing', 'text-transform', 'text-align', 'direction', 'unicode-bidi', 'zoom', 'transform',
    'scale', 'visibility', 'clip', 'clip-path', 'display', 'float', 'position', 'z-index', 'filter', 'content',
    'opacity', 'pointer-events', 'appearance', '-webkit-appearance', 'accent-color', 'cursor', 'width', 'min-width',
    'max-width', 'height', 'min-height', 'max-height', 'white-space', 'table-layout', 'margin', 'margin-top',
    'margin-left', 'margin-right', 'margin-bottom', 'margin-inline', 'margin-inline-start', 'margin-inline-end',
    'margin-block', 'margin-block-start', 'margin-block-end', 'background', 'overflow', 'overflow-x', 'overflow-y',
    'contain', 'columns', 'flex-direction', 'order'];
const PAINT = /^(color|background-color)$/;
const structural = (selector) => selector.replace(/::?(focus-visible|focus|hover)/g, '');

function cssViolations(text) {
    const violations = [];
    const ast = postcss.parse(text);
    ast.walkAtRules((at) => {
        if (`${at.name} ${at.params}` !== 'media screen' || at.parent.type !== 'root') violations.push(['at-rule', `${at.name} ${at.params}`]);
    });
    const doc = new JSDOM(documentHtml()).window.document;
    // Only these elements may take ink/background, and only as a pair. The .table-active info table
    // sits on the new paper sheet, so its explicit theme ink must be overridden on the table itself;
    // its cells, the procedure table, the inline-striped rows, checkboxes and buttons keep their paint.
    const paintable = [...doc.querySelectorAll('body, body > form, .ordsum > table.table-active, .ordsum tr.head')];
    const palette = tokens();
    let focus = 0;
    let focusVisible = 0;
    ast.walkRules((rule) => {
        if (!(rule.parent.type === 'atrule' && rule.parent.params === 'screen')) violations.push(['outside screen', rule.selector]);
        const decls = rule.nodes.filter((n) => n.type === 'decl');
        const props = new Map(decls.map((d) => [d.prop, d.value]));
        for (const selector of rule.selectors) {
            if (!(selector === SCOPE || selector.startsWith(`${SCOPE} `))) violations.push(['unscoped', selector]);
            if (/\[style|\[type=.?checkbox|\[name/.test(selector) && decls.some((d) => PAINT.test(d.prop))) violations.push(['semantic paint', selector]);
        }
        const kinds = new Set(rule.selectors.filter((s) => /:focus/.test(s)).map((s) => (/:focus-visible/.test(s) ? 'visible' : 'focus')));
        if (kinds.size > 1 || (kinds.size === 1 && rule.selectors.some((s) => !/:focus/.test(s)))) violations.push(['mixed focus', rule.selector]);
        if (kinds.size === 1) {
            if (!/^2px solid var\(--oe-wb-/.test(props.get('outline') ?? '')) violations.push(['focus outline', rule.selector]);
            if (kinds.has('visible')) focusVisible += 1; else focus += 1;
        }
        for (const decl of decls) {
            if (decl.important) violations.push(['important', `${rule.selector} ${decl.prop}`]);
            if (FORBIDDEN_PROPS.includes(decl.prop)) violations.push(['forbidden', `${rule.selector} ${decl.prop}`]);
            if (/^(outline|outline-style)$/.test(decl.prop) && /^(0|none)\b/.test(decl.value)) violations.push(['outline removed', rule.selector]);
            if (/color|background|border|outline|shadow/.test(decl.prop) && /#|rgb|hsl|\b(white|black|transparent|currentcolor|inherit|initial|unset)\b/i.test(decl.value)) violations.push(['raw colour', `${rule.selector} ${decl.prop}`]);
            for (const [, token] of decl.value.matchAll(/var\((--[\w-]+)\)/g)) {
                if (!(token in palette)) violations.push(['token', token]);
            }
        }
        // Ink and paper travel together. The 4.5:1 figure is nominal (popup.css tokens only); it does
        // not model the compiled theme cascade, .table-active, inline stripes or !important utilities.
        const paper = props.get('background-color');
        const ink = props.get('color');
        if (!!paper !== !!ink) violations.push(['unpaired colour', rule.selector]);
        if (paper && ink && !(contrast(resolve(ink) ?? '#000', resolve(paper) ?? '#000') >= 4.5)) violations.push(['contrast', rule.selector]);
        if (decls.some((d) => PAINT.test(d.prop))) {
            for (const selector of rule.selectors) {
                if ([...doc.querySelectorAll(structural(selector))].some((el) => !paintable.includes(el))) violations.push(['semantic paint', selector]);
            }
        }
    });
    if (focus === 0 || focusVisible === 0) violations.push(['focus coverage', `${focus}/${focusVisible}`]);
    return violations;
}

const rules = () => {
    const list = [];
    postcss.parse(css() ?? '').walkRules((rule) => list.push(rule));
    return list;
};
// Declarations of every rule listing `${SCOPE} ${suffix}` among its selectors, merged in order.
const block = (suffix) => {
    const want = `${SCOPE} ${suffix}`.trim();
    const found = rules().filter((rule) => rule.selectors.map((s) => s.replace(/\s+/g, ' ')).includes(want));
    expect([want, found.length > 0]).toEqual([want, true]);
    return Object.fromEntries(found.flatMap((rule) => rule.nodes.filter((n) => n.type === 'decl').map((d) => [d.prop, d.value])));
};

describe('order manifest stylesheet', () => {
    test('exists and passes every guard', () => {
        expect([SHEET, css() !== null]).toEqual([SHEET, true]);
        expect(cssViolations(css())).toEqual([]);
        expect(css()).not.toMatch(/@media print|@import|@font-face|url\(|!important|btn-primary/);
    });

    test.each([
        ['unscoped rule', (t) => `${t}\n@media screen { .ordsum { padding: 0; } }`, 'unscoped'],
        ['missing route class', (t) => `${t}\n@media screen { html.oe-workbench-context .ordsum { padding: 0; } }`, 'unscoped'],
        ['missing context class', (t) => `${t}\n@media screen { body.${BODY_CLASS} .ordsum { padding: 0; } }`, 'unscoped'],
        ['popup-only scope misses standalone tabs', (t) => `${t}\n@media screen { html.oe-workbench-popup body.${BODY_CLASS} .ordsum { padding: 0; } }`, 'unscoped'],
        ['print block', (t) => `${t}\n@media print { ${SCOPE} .ordsum { padding: 0; } }`, 'at-rule'],
        ['breakpoint block', (t) => `${t}\n@media screen and (max-width: 600px) { ${SCOPE} .ordsum { padding: 0; } }`, 'at-rule'],
        ['rule outside @media screen', (t) => `${t}\n${SCOPE} .ordsum { padding: 0; }`, 'outside screen'],
        ['clipped scroller', (t) => `${t}\n@media screen { ${SCOPE} .ordsum { overflow: hidden; } }`, 'forbidden'],
        ['squeezed table', (t) => `${t}\n@media screen { ${SCOPE} .ordsum .table { max-width: 100%; } }`, 'forbidden'],
        ['hidden action', (t) => `${t}\n@media screen { ${SCOPE} .btn-group .btn { display: none; } }`, 'forbidden'],
        ['forced label wrap', (t) => `${t}\n@media screen { ${SCOPE} .btn-group .btn { white-space: normal; } }`, 'forbidden'],
        ['restyled checkbox', (t) => `${t}\n@media screen { ${SCOPE} .ordsum input { appearance: none; } }`, 'forbidden'],
        ['shrunk text', (t) => `${t}\n@media screen { ${SCOPE} .ordsum tr.detail { font-size: 0.7rem; } }`, 'forbidden'],
        ['body margin', (t) => `${t}\n@media screen { ${SCOPE} { margin: 0; } }`, 'forbidden'],
        ['repainted stripes', (t) => `${t}\n@media screen { ${SCOPE} .ordsum tr.detail { color: var(--oe-wb-ink); background-color: var(--oe-wb-paper); } }`, 'semantic paint'],
        ['repainted stripe cells', (t) => `${t}\n@media screen { ${SCOPE} .ordsum td { color: var(--oe-wb-ink); background-color: var(--oe-wb-paper); } }`, 'semantic paint'],
        ['repainted info-table cells', (t) => `${t}\n@media screen { ${SCOPE} .ordsum > table.table-active td { color: var(--oe-wb-ink); background-color: var(--oe-wb-paper); } }`, 'semantic paint'],
        ['repainted every table', (t) => `${t}\n@media screen { ${SCOPE} .ordsum .table { color: var(--oe-wb-ink); background-color: var(--oe-wb-paper); } }`, 'semantic paint'],
        ['repainted procedure table', (t) => `${t}\n@media screen { ${SCOPE} .ordsum table:not(.table-active) { color: var(--oe-wb-ink); background-color: var(--oe-wb-paper); } }`, 'semantic paint'],
        ['repainted checkboxes', (t) => `${t}\n@media screen { ${SCOPE} .ordsum input { color: var(--oe-wb-ink); background-color: var(--oe-wb-paper); } }`, 'semantic paint'],
        ['repainted actions', (t) => `${t}\n@media screen { ${SCOPE} > form > .btn-group .btn { color: var(--oe-wb-ink); background-color: var(--oe-wb-paper); } }`, 'semantic paint'],
        ['unpaired info-table ink', (t) => `${t}\n@media screen { ${SCOPE} .ordsum > table.table-active { color: var(--oe-wb-ink); } }`, 'unpaired colour'],
        ['unpaired ink', (t) => `${t}\n@media screen { ${SCOPE} .ordsum tr.head { color: var(--oe-wb-muted); } }`, 'unpaired colour'],
        ['raw colour', (t) => `${t}\n@media screen { ${SCOPE} .ordsum { color: #333; background-color: var(--oe-wb-paper); } }`, 'raw colour'],
        ['unknown token', (t) => `${t}\n@media screen { ${SCOPE} .ordsum { border-color: var(--gray200); } }`, 'token'],
        ['low-contrast pair', (t) => `${t}\n@media screen { ${SCOPE} .ordsum tr.head { color: var(--oe-wb-line); background-color: var(--oe-wb-paper); } }`, 'contrast'],
        ['important', (t) => `${t}\n@media screen { ${SCOPE} .ordsum { border-color: var(--oe-wb-line) !important; } }`, 'important'],
        ['mixed focus rule', (t) => `${t}\n@media screen { ${SCOPE} .btn:focus, ${SCOPE} .btn:focus-visible { outline: 2px solid var(--oe-wb-petrol); } }`, 'mixed focus'],
        ['outline removed', (t) => `${t}\n@media screen { ${SCOPE} .btn:focus { outline: none; } }`, 'outline removed'],
        ['missing focus fallback', () => `@media screen { ${SCOPE} .btn:focus-visible { outline: 2px solid var(--oe-wb-petrol); } }`, 'focus coverage'],
    ])('guard rejects a stylesheet with %s', (label, mutate, kind) => {
        const kinds = cssViolations(mutate(css() ?? '')).map(([k]) => k);
        expect([label, kinds.includes(kind)]).toEqual([label, true]);
    });

    test('every selector matches the route in a popup and a standalone tab, and nothing in a legacy window or another page', () => {
        expect([SHEET, css() !== null]).toEqual([SHEET, true]);
        const inside = new JSDOM(documentHtml()).window.document;
        const standalone = new JSDOM(documentHtml({ mode: 'standalone' })).window.document;
        const legacy = new JSDOM(documentHtml({ mode: 'legacy' })).window.document;
        const other = new JSDOM(documentHtml({ bodyClass: '' })).window.document;
        expect(rules().length).toBeGreaterThan(0);
        for (const rule of rules()) {
            for (const selector of rule.selectors) {
                expect([selector, inside.querySelectorAll(structural(selector)).length > 0]).toEqual([selector, true]);
                expect([selector, standalone.querySelectorAll(structural(selector)).length > 0]).toEqual([selector, true]);
                expect([selector, legacy.querySelectorAll(structural(selector)).length]).toEqual([selector, 0]);
                expect([selector, other.querySelectorAll(structural(selector)).length]).toEqual([selector, 0]);
            }
        }
    });

    // Tokens live on html.oe-workbench-context; body typography is popup-only and must not reach a standalone tab.
    test('a standalone tab inherits the shared tokens and no shared popup or font rule', () => {
        const shared = [];
        postcss.parse(read('interface/clinical-workspace/popup.css')).walkRules((rule) => shared.push(rule));
        const doc = new JSDOM(documentHtml({ mode: 'standalone' })).window.document;
        const applied = shared.filter((rule) => rule.selectors.some((s) => doc.querySelectorAll(structural(s)).length > 0));
        const decls = applied.flatMap((rule) => rule.nodes.filter((n) => n.type === 'decl'));
        expect(decls.map((d) => d.prop)).toEqual(expect.arrayContaining(Object.keys(tokens())));
        expect(applied.flatMap((rule) => rule.selectors).filter((s) => s.includes('oe-workbench-popup'))).toEqual([]);
        expect(decls.filter((d) => /^(font|line-height|letter-spacing)/.test(d.prop)).map((d) => d.prop)).toEqual([]);
        expect(doc.documentElement.matches('html.oe-workbench-context')).toBe(true);
    });

    test('document sheet: canvas body around the original form as a paper sheet', () => {
        expect(block('')).toEqual({ color: 'var(--oe-wb-ink)', 'background-color': 'var(--oe-wb-canvas)' });
        const sheet = block('> form');
        expect(sheet).toMatchObject({ color: 'var(--oe-wb-ink)', 'background-color': 'var(--oe-wb-paper)', border: '1px solid var(--oe-wb-line)' });
        expect(Object.keys(sheet)).toEqual(expect.arrayContaining(['padding', 'border-radius']));
    });

    test('ordsum rules use the line token; only the info table and plain header row are repainted, as pairs', () => {
        expect(block('.ordsum table')).toEqual({ 'border-color': 'var(--oe-wb-line)' });
        expect(block('.ordsum td')).toEqual({ 'border-color': 'var(--oe-wb-line)' });
        expect(block('.ordsum th')).toEqual({ 'border-color': 'var(--oe-wb-line)' });
        expect(block('.ordsum tr.head')).toEqual({ color: 'var(--oe-wb-ink)', 'background-color': 'var(--oe-wb-canvas)' });
        // Canvas, not paper, keeps the info table visibly distinct from the sheet it sits on.
        expect(block('.ordsum > table.table-active')).toEqual({ color: 'var(--oe-wb-ink)', 'background-color': 'var(--oe-wb-canvas)' });
        expect(tokens()['--oe-wb-canvas']).not.toBe(tokens()['--oe-wb-paper']);
    });

    test('original tables stay inside the responsive scroller; checkboxes and all three actions are retained', () => {
        expect([SHEET, css() !== null]).toEqual([SHEET, true]);
        const doc = new JSDOM(documentHtml()).window.document;
        const scroller = doc.querySelector('form > .ordsum.table-responsive');
        expect([...scroller.querySelectorAll(':scope > table')].map((t) => t.className)).toEqual(['table table-active', 'table']);
        expect([...scroller.querySelectorAll('input')].map((el) => [el.type, el.name, el.value, el.checked]))
            .toEqual([['checkbox', 'form_omit[1]', '1', false], ['checkbox', 'form_omit[2]', '1', true]]);
        const actions = [...doc.querySelectorAll('form > .btn-group.d-print-none > input')].map((el) => [el.type, el.name, el.value]);
        expect(actions).toEqual([
            ['submit', 'bn_save', 'Save omission selections'],
            ['submit', 'bn_show_all', 'Show all procedures'],
            ['submit', 'bn_show_sendable', 'Show only procedures not omitted'],
        ]);
    });

    // Wrapping lets whole buttons move to a new line; it does not make any one translated label fit.
    test('original action group wraps whole buttons without touching label whitespace', () => {
        expect(block('> form > .btn-group')).toMatchObject({ 'flex-wrap': 'wrap' });
        expect(css() ?? '').not.toMatch(/white-space|text-overflow|word-break|overflow-wrap|hyphens/);
    });

    test('separate :focus fallback and :focus-visible rules cover the actions and the omit checkboxes', () => {
        const focus = rules().filter((rule) => rule.selector.includes(':focus'));
        const visible = focus.filter((rule) => rule.selectors.every((s) => s.includes(':focus-visible')));
        const fallback = focus.filter((rule) => rule.selectors.every((s) => !s.includes(':focus-visible')));
        expect(visible.length + fallback.length).toBe(focus.length);
        for (const [name, group] of [['fallback', fallback], ['visible', visible]]) {
            const targets = group.flatMap((rule) => rule.selectors.map((s) => s.replace(/\s+/g, ' ')));
            for (const target of [`${SCOPE} > form > .btn-group .btn:focus`, `${SCOPE} .ordsum input[type='checkbox']:focus`]) {
                const wanted = name === 'visible' ? `${target}-visible` : target;
                expect([name, wanted, targets.includes(wanted)]).toEqual([name, wanted, true]);
            }
        }
    });
});

// ---------------------------------------------------------------------------------------------
// Synthetic cascade: a dark-theme-shaped fixture (Bootstrap 4 gives .table its own $table-color and
// .table-active a translucent rgba($black, .075) tint; style_dark.scss inverts $black to #fff and
// $body-color to #f8f9fa), then popup.css tokens and the route sheet. This is a cascade regression
// over the declarations below only. It is not the compiled theme, a browser, or a contrast result.

const THEME_FIXTURE = `
body { color: #f8f9fa; background-color: #000; }
.table { color: #f8f9fa; }
.table-active, .table-active > th, .table-active > td { background-color: rgba(255, 255, 255, 0.075); }
`;
const specificity = (selector) => [
    count(selector, '#'),
    (selector.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+/g) ?? []).length,
    (selector.match(/(?:^|[\s>+~])[a-z][\w-]*/gi) ?? []).length,
];
const beats = (a, b) => {
    for (let i = 0; i < 3; i += 1) if (a[i] !== b[i]) return a[i] > b[i];
    return true; // equal specificity: later source order wins
};
// The cascaded value of `prop` on `el` (no inheritance), from the inline style or the given sheets in order.
function cascaded(el, prop, sheets, { inline: withInline = true } = {}) {
    const inline = withInline && (el.getAttribute('style') ?? '').match(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`));
    if (inline) return { value: inline[1].trim(), source: 'inline' };
    let best = null;
    sheets.forEach(([source, text]) => postcss.parse(text).walkDecls(prop, (decl) => {
        const rule = decl.parent;
        if (rule.type !== 'rule' || (rule.parent.type === 'atrule' && rule.parent.params !== 'screen')) return;
        for (const selector of rule.selectors) {
            const spec = specificity(selector);
            if (el.matches(selector) && (best === null || beats(spec, best.spec))) best = { value: decl.value, source, spec };
        }
    }));
    return best && { value: best.value, source: best.source };
}
const inkOf = (el, sheets) => {
    for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
        const found = cascaded(node, 'color', sheets);
        if (found) return { ...found, from: node };
    }
    return null;
};
const cascadeSheets = (sheet) => [['theme', THEME_FIXTURE], ['popup.css', read('interface/clinical-workspace/popup.css')], ['route', sheet]];
// Effective ink and own background of the information table under the white form sheet.
function infoTableCascade(sheet) {
    const doc = new JSDOM(documentHtml({ mode: 'standalone' })).window.document;
    const sheets = cascadeSheets(sheet);
    const table = doc.querySelector('.ordsum > table.table-active');
    return {
        form: cascaded(doc.querySelector('body > form'), 'background-color', sheets),
        ink: inkOf(table.querySelector('td'), sheets),
        background: cascaded(table, 'background-color', sheets),
        cellBackground: cascaded(table.querySelector('td'), 'background-color', sheets),
        table,
    };
}

describe('information table cascade (synthetic dark-theme fixture, not compiled or native)', () => {
    const WANT_INK = { value: 'var(--oe-wb-ink)', source: 'route' };
    const WANT_BACKGROUND = { value: 'var(--oe-wb-canvas)', source: 'route' };

    test('the fixture reproduces the defect without the route sheet: near-white theme ink under a white form', () => {
        const without = infoTableCascade('');
        expect(without.ink).toMatchObject({ value: '#f8f9fa', source: 'theme' });
        expect(without.background).toEqual({ value: 'rgba(255, 255, 255, 0.075)', source: 'theme' });
        const withSheet = infoTableCascade(css() ?? '');
        expect(withSheet.form).toEqual({ value: 'var(--oe-wb-paper)', source: 'route' });
        expect(resolve(withSheet.form.value)).toBe('#fff');
    });

    test('the route sheet gives the info table itself an explicit ink/canvas pair that beats the theme', () => {
        const result = infoTableCascade(css() ?? '');
        expect(result.ink).toMatchObject(WANT_INK);
        expect(result.ink.from).toBe(result.table);
        expect(result.background).toEqual(WANT_BACKGROUND);
        // Cells take no paint of their own: they inherit the table ink and show the table canvas.
        expect(result.cellBackground).toBeNull();
        expect(resolve(result.background.value)).not.toBe(resolve(result.form.value));
    });

    test.each([
        ['table foreground', /(\.ordsum > table\.table-active\s*\{[^}]*?)\n\s*color:[^;]*;/],
        ['table background', /(\.ordsum > table\.table-active\s*\{[^}]*?)\n\s*background-color:[^;]*;/],
    ])('removing the info-table %s fails the cascade regression', (label, pattern) => {
        const mutated = (css() ?? '').replace(pattern, '$1');
        expect([label, mutated !== css()]).toEqual([label, true]);
        const result = infoTableCascade(mutated);
        const ok = JSON.stringify([result.ink && { value: result.ink.value, source: result.ink.source }, result.background])
            === JSON.stringify([WANT_INK, WANT_BACKGROUND]);
        expect([label, ok]).toEqual([label, false]);
    });

    test('procedure stripes keep their inline backgrounds and theme ink; the header pair and borders stay narrow', () => {
        const doc = new JSDOM(documentHtml({ mode: 'standalone' })).window.document;
        const sheets = cascadeSheets(css() ?? '');
        const stripes = [...doc.querySelectorAll('.ordsum tr.detail')];
        expect(stripes.map((tr) => cascaded(tr, 'background-color', sheets))).toEqual([
            { value: '#ddddff', source: 'inline' }, { value: '#ffdddd', source: 'inline' },
        ]);
        // Inherited, not introduced: the stripe ink is still the theme .table ink (a native gate).
        expect(stripes.map((tr) => inkOf(tr.querySelector('td'), sheets)).map(({ value, source }) => [value, source]))
            .toEqual([['#f8f9fa', 'theme'], ['#f8f9fa', 'theme']]);
        for (const el of [...doc.querySelectorAll('.ordsum tr.detail, .ordsum tr.detail *, .ordsum input, .btn-group, .btn-group *')]) {
            for (const prop of ['color', 'background-color']) {
                expect([el.outerHTML.slice(0, 40), prop, cascaded(el, prop, [['route', css() ?? '']], { inline: false })]).toEqual([el.outerHTML.slice(0, 40), prop, null]);
            }
        }
        expect(cascaded(doc.querySelector('.ordsum tr.head'), 'background-color', sheets)).toEqual({ value: 'var(--oe-wb-canvas)', source: 'route' });
        const painted = rules().filter((rule) => rule.nodes.some((n) => n.type === 'decl' && PAINT.test(n.prop)))
            .flatMap((rule) => rule.selectors.map((s) => s.replace(/\s+/g, ' ').slice(SCOPE.length).trim()));
        expect(painted).toEqual(['', '> form', '.ordsum > table.table-active', '.ordsum tr.head']);
    });
});

describe('documentation', () => {
    const doc = () => (exists(DOC) ? read(DOC) : '');

    test('records the target=_blank callers, noopener reachability and the inherited missing CSRF check', () => {
        expect([DOC, exists(DOC)]).toEqual([DOC, true]);
        for (const phrase of ['list_reports.php', 'single_order_results.inc.php', 'target=_blank', 'noopener', 'CSRF']) {
            expect([phrase, doc().includes(phrase)]).toEqual([phrase, true]);
        }
    });

    test('classifies the info-table ink as an introduced, resolved defect and the stripes as inherited', () => {
        const text = doc();
        expect(text).toMatch(/introduced[^.]*information[- ]table/i);
        expect(text).toMatch(/inherited[^.]*stripe/i);
        expect(text).not.toMatch(/\.table-active` information table and the inline[^.]*keep their original/i);
    });

    test('leaves native gates open and makes no effective-contrast or fit claim', () => {
        expect(doc()).not.toMatch(/WCAG (AA|AAA) (pass|compliant)|contrast (is )?verified|fits (on|at) (all|narrow)|CSRF (fixed|protected)/i);
        for (const gate of ['contrast', 'keyboard', 'narrow', 'translation', 'RTL', 'print']) {
            expect([gate, doc().toLowerCase().includes(gate.toLowerCase())]).toEqual([gate, true]);
        }
    });
});
