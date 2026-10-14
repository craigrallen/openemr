/** @jest-environment node */

// Procedure Picker (interface/orders/find_order_popup.php): presentation-only workbench sheet.
// The route itself is executed on host PHP through tests/js/fixtures/find-order-popup-harness.php
// (synthetic rows, stubbed Header and SQL helpers); its rendered output then runs under jsdom.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const process = require('node:process');
const postcss = require('postcss');
const { JSDOM, VirtualConsole } = require('jsdom');

const root = path.join(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const ROUTE = 'interface/orders/find_order_popup.php';
const SHEET = 'interface/clinical-workspace/order-type-popup.css';
const DOC = 'docs/clinical-ui/ORDER-TYPE.md';
const HARNESS = path.join(__dirname, 'fixtures/find-order-popup-harness.php');
const css = () => read(SHEET);
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const count = (text, part) => text.split(part).length - 1;

// sha256 at master 18647270: the 209-line route, both callers, shared popup activation and lint config.
const BASELINE = 'b59261a82e98c73ff1d5cb25c79daebb3342b284ae23ae743e508b3cd74f92f7';
const UNCHANGED = {
    'interface/forms/procedure_order/common.php': 'c0cdd93ca36ba1b9d5c490d19ce87bf0bb2c17463432fc9dccf2d8173f6ceb28',
    'interface/orders/types_edit.php': 'fbc10cf69eb9d32e3aeb5bcca9fcd553ab80525add9f8dd8a35b4b613a03195c',
    'interface/clinical-workspace/popup.js': 'af967e78fef59e75d2a5a5c4e08916bbea90a7f108c67f3def027b3061dc330f',
    'interface/clinical-workspace/popup.css': 'ea56e9f26990e843219a68f315c188f7e2b0581c20321bac4517dc4ba34e79a9',
    'config/config.yaml': '5f99c981f570a2f94917d68a4abcedf086eb75a102364bf71f1cb44ccfe461b7',
    '.stylelintrc.json': '7578dfe64a6e9df4dadd97c75ad5ce443134b133914ed54000a78ac4272adf6e',
    'docs/clinical-ui/ACCEPTANCE.md': '4da96cca6eaeb633c87a97bea87e8b0180ce6e6b128bf26ebc38716d84af33f8',
    'docs/clinical-ui/PLAN.md': 'af7ffa3640ecd6646ae1d28b3b8551e3393d163de4648fb45aa3d32ad74f3e3c',
};

const assetLines = '    <?php $clinicalAssets = new ClinicalWorkspaceAssets(); // Screen-only; inert until popup.js marks an active workbench popup. ?>\n'
    + '    <link rel="stylesheet" media="screen" href="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>/interface/clinical-workspace/order-type-popup.css?v=<?php echo attr_url($clinicalAssets->version(\'order-type-popup.css\')); ?>">\n';

// The complete presentation edit map, each entry [original, presented].
const changes = [
    ['\nuse OpenEMR\\Core\\Header;\n', '\nuse OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;\nuse OpenEMR\\Core\\Header;\n'],
    ["    <title><?php echo xlt('Procedure Picker'); ?></title>\n", `    <title><?php echo xlt('Procedure Picker'); ?></title>\n${assetLines}`],
    ['\n<body>\n', '\n<body class="oe-order-type">\n'],
    ['<div class="container">\n    <div class="row">', '<div class="container oe-order-type-sheet">\n    <div class="row oe-order-type-layout">'],
    ['<form class="form-inline" method=\'post\'', '<form class="form-inline oe-order-type-form" method=\'post\''],
    ['<div class="col-sm-12">\n                <div class="input-group">', '<div class="col-sm-12 oe-order-type-editor">\n                <div class="input-group oe-order-type-search">'],
    ['<span class="input-group-append">', '<span class="input-group-append oe-order-type-actions">'],
    ['<div class="table-responsive mt-3">\n                <table class="table table-striped table-sm">', '<div class="table-responsive mt-3 oe-order-type-results">\n                <table class="table table-striped table-sm oe-order-type-table">'],
];

// Undo every presentation edit; null when any edit is missing or ambiguous.
const restore = text => {
    let restored = text;
    for (const [before, after] of changes) {
        if (count(restored, after) !== 1) return null;
        restored = restored.replace(after, () => before);
    }
    return restored;
};

describe('find_order_popup.php carries only the declared presentation edits', () => {
    test('reversing the full edit map restores the exact original 209-line route digest', () => {
        const php = read(ROUTE);
        for (const [, after] of changes) expect([after, count(php, after)]).toEqual([after, 1]);
        const restored = restore(php);
        expect(restored).not.toBeNull();
        expect(restored.split('\n').length - 1).toBe(209);
        expect(sha(restored)).toBe(BASELINE);
    });

    test('negative guards: SQL, GET/POST/REQUEST, grouping, QOE, callbacks, controls and wording cannot change unnoticed', () => {
        const php = read(ROUTE);
        const mutations = [
            ['require_once("../globals.php");', 'require_once("../../globals.php");'],
            ["$order = (int) ($_GET['order'] ?? null);", "$order = (int) ($_REQUEST['order'] ?? null);"],
            ["$labid = (int) ($_GET['labid'] ?? null);", "$labid = (int) ($_POST['labid'] ?? null);"],
            ['"SELECT * FROM procedure_type WHERE procedure_type_id = ?"', '"SELECT * FROM procedure_type WHERE procedure_type_id = ? AND activity = 1"'],
            ["$codes = ($proctype === 'pro') ? '' : $ptrow['related_code'];", "$codes = $ptrow['related_code'];"],
            ["if ($ptrow['procedure_type'] == 'fgp') {", "if ($ptrow['procedure_type'] == 'grp') {"],
            ["parent = ? && procedure_type = 'for' ORDER BY seq, name, procedure_type_id", "parent = ? ORDER BY seq, name, procedure_type_id"],
            ['echo "opener.set_new_fav($order);\\nwindow.close();";', 'echo "opener.set_new_fav($order);";'],
            ['$t = count($grporders) - $i;', '$t = $i;'],
            ['js_escape($testid) . ", \'0\');\\n";', 'js_escape($testid) . ", 0);\\n";'],
            ['require_once("qoe.inc.php");', 'require_once("./qoe.inc.php");'],
            ["generate_qoe_html($typeid, (int)$_GET['formid'], 0, (int)$_GET['formseq'])", "generate_qoe_html($typeid, (int)$_GET['formid'], 1, (int)$_GET['formseq'])"],
            ["echo ' opener.set_proc_html(\"\", \"\");' . \"\\n\";", "echo '';"],
            ["} while ($grporders[$i]['procedure_type_id'] ?? null);", "} while (false);"],
            ["alert(<?php echo xlj('The destination form was closed; I cannot act on your selection.'); ?>);", 'alert("closed");'],
            ["Header::setupHeader(['opener'])", "Header::setupHeader(['opener', 'common'])"],
            ["<?php echo xlt('Procedure Picker'); ?>", "<?php echo xlt('Order Picker'); ?>"],
            ['echo ", addfav: " . js_escape($_GET[\'addfav\']);', 'echo ", addfav: 1";'],
            ['echo ", typeid: typeid";', 'echo ", typeid: Number(typeid)";'],
            ["location.href = 'find_order_popup.php?' + params.toString();", "location.replace('find_order_popup.php?' + params.toString());"],
            ['            return false;\n        }\n        // AI-generated code end', '            return true;\n        }\n        // AI-generated code end'],
            ["method='post' name='theform'", "method='get' name='theform'"],
            ["echo '&addfav=' . attr_url($_GET['addfav']);", "echo '&fav=' . attr_url($_GET['addfav']);"],
            ["name='isfav' value='<?php echo attr($_REQUEST['ordLookup'] ?? ''); ?>'", "name='isfav' value=''"],
            ["id='search_term' name='search_term'", "id='search_term' name='term'"],
            ["xla('Any part of the desired code or its description')", "xla('Search')"],
            ['placeholder="<?php echo xla(\'Search for\') ?>&hellip;"', 'placeholder="<?php echo xla(\'Search\') ?>"'],
            ["name='bn_search' value=\"true\"><?php echo xlt('Search'); ?>", "name='bn_search' value=\"1\"><?php echo xlt('Search'); ?>"],
            ["<?php if (!isset($_REQUEST['addfav'])) { ?>", "<?php if (true) { ?>"],
            ["name='bn_grpsearch' value=\"true\"><?php echo xlt('Favorites'); ?>", "name='bn_grpsearch' value=\"true\"><?php echo xlt('Groups'); ?>"],
            ['<button type="button" class="btn btn-danger btn-delete" onclick="selcode(0)">', '<button type="button" class="btn btn-secondary btn-delete" onclick="selcode(0)">'],
            ["<?php echo xlt('Erase'); ?>", "<?php echo xlt('Clear'); ?>"],
            ["if (!empty($_REQUEST['bn_search']) || !empty($_REQUEST['bn_grpsearch'])) {", "if (!empty($_REQUEST['bn_search'])) {"],
            ["<th><?php echo xlt('Description'); ?></th>", "<th><?php echo xlt('Name'); ?></th>"],
            ["$ord = isset($_REQUEST['bn_search']) ? 'ord' : 'fgp';", "$ord = isset($_POST['bn_search']) ? 'ord' : 'fgp';"],
            ["$sub = \"OR procedure_type LIKE 'pro'\";", "$sub = '';"],
            ["$search_term = '%' . $_REQUEST['search_term'] . '%';", "$search_term = $_REQUEST['search_term'] . '%';"],
            ['"activity = 1 AND " .', '"activity >= 0 AND " .'],
            ['"ORDER BY seq, procedure_code";', '"ORDER BY procedure_code";'],
            ['[$labid, $ord, $search_term, $search_term]', '[$labid, $ord, $search_term, \'%\']'],
            ["$itertype = strtoupper((string) $row['procedure_type']);", "$itertype = (string) $row['procedure_type'];"],
            ["$anchor = \"<a href='' onclick='return selcode(\" . attr_js($itertypeid) . \")'>\";", "$anchor = \"<a href='#' onclick='return selcode(\" . attr_js($itertypeid) . \")'>\";"],
            ['echo "  <td>$anchor" . text($itertext) . "</a></td>\\n";', 'echo "  <td>$anchor" . $itertext . "</a></td>\\n";'],
        ];
        for (const [from, to] of mutations) {
            expect([from, php.includes(from)]).toEqual([from, true]);
            const restored = restore(php.replace(from, () => to));
            expect([from, restored === null ? null : sha(restored)]).not.toEqual([from, BASELINE]);
        }
        // Dropping any presentation hook is caught too.
        for (const [, after] of changes.slice(2)) {
            expect(restore(php.replace(after, () => after.replace(/ ?oe-order-type[a-z-]*/, '')))).toBeNull();
        }
    });

    test('the route sheet is linked once, screen-only and versioned after the original Header; no workspace/mode/print asset', () => {
        const php = read(ROUTE);
        expect(count(php, assetLines)).toBe(1);
        expect(count(php, 'order-type-popup.css')).toBe(2);
        expect(php.indexOf('order-type-popup.css')).toBeGreaterThan(php.indexOf("Header::setupHeader(['opener'])"));
        expect(php.indexOf('order-type-popup.css')).toBeLessThan(php.indexOf('</head>'));
        expect(php).not.toMatch(/clinical-workspace\/(workspace|popup|mode)\.(css|js)|media="print"|@media print/);
    });

    test('the fixed-basename asset helper allowlists exactly the new name, in order', () => {
        const helper = read('src/Common/Assets/ClinicalWorkspaceAssets.php');
        expect(helper).toMatch(/\n {8}'mode\.js',\n {8}'order-type-popup\.css',\n {8}'patient-messages\.css',\n/);
        expect(count(helper, 'order-type')).toBe(1);
        expect(read('tests/Tests/Isolated/Common/Assets/ClinicalWorkspaceAssetsTest.php')).toContain("'order-type-popup.css'");
    });

    test('both callers, shared Header popup activation, lint config and the all-22 register are byte-identical', () => {
        for (const [file, digest] of Object.entries(UNCHANGED)) expect([file, sha(read(file))]).toEqual([file, digest]);
        expect(count(read('interface/forms/procedure_order/common.php'), "dlgopen('../../orders/find_order_popup.php?' + params,\n                '_blank', 850, 500, '', title);")).toBe(1);
        expect(count(read('interface/orders/types_edit.php'), "dlgopen('find_order_popup.php?addfav=1&labid=' + labid, '_blank', 850, 500, '', title);")).toBe(1);
        expect(read('config/config.yaml')).toMatch(/ {2}workbench-popup:\n {4}basePath: '%webroot%\/interface\/clinical-workspace\/'\n {4}script: popup\.js\n {4}link: popup\.css\n {4}autoload: true\n/);
    });
});

// --- The actual route, executed on PHP --------------------------------------------------------

const scratch = fs.mkdtempSync(path.join(require('os').tmpdir(), 'oe-order-type-'));
afterAll(() => fs.rmSync(scratch, { recursive: true, force: true }));
const baselineFile = () => {
    const file = path.join(scratch, 'find_order_popup.php');
    if (!fs.existsSync(file)) {
        const restored = restore(read(ROUTE));
        expect(sha(restored)).toBe(BASELINE);
        fs.writeFileSync(file, restored);
    }
    return file;
};
const run = (scenario, routeFile) => {
    const result = spawnSync('php', [HARNESS, JSON.stringify(scenario), ...(routeFile ? [routeFile] : [])], { encoding: 'utf8' });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    return { html: result.stdout, log: JSON.parse(result.stderr) };
};

// SYNTHETIC compendium rows; nothing here is real data.
const ROWS = [
    { procedure_type_id: 11, procedure_code: 'SYN-1', procedure_type: 'ord', name: ' Synthetic <order> one ' },
    { procedure_type_id: 12, procedure_code: 'SYN-PRO', procedure_type: 'pro', name: 'Synthetic profile' },
];
const PICKER = {
    search: { get: { order: '5', labid: '3', formid: '9', formseq: '2' }, post: { search_term: 'syn', bn_search: 'true' }, rows: ROWS },
    favorites: { get: { order: '5', labid: '3', formid: '9', formseq: '2' }, post: { search_term: '', bn_grpsearch: 'true' }, rows: ROWS.slice(0, 1) },
    addfav: { get: { addfav: '1', labid: '4' }, post: { search_term: 'x', bn_search: 'true' }, rows: ROWS.slice(0, 1) },
    initial: { get: { order: '0', labid: '3', formid: '9', formseq: '0' } },
};

// Strip only the presentation additions from rendered output.
const unpresent = html => html
    // The PHP asset line emits only its indent (its newline follows ?>), so the link sits 8 spaces in.
    .replace(/(<\/title>\n) {8}<link rel="stylesheet" media="screen" href="\/webroot\/interface\/clinical-workspace\/order-type-popup\.css\?v=\d+">\n/, '$1')
    .replace(/ oe-order-type[a-z-]*/g, '')
    .replace('<body class="oe-order-type">', '<body>');

describe('rendered route output (host PHP, synthetic rows)', () => {
    test.each(Object.keys(PICKER))('%s: output equals the baseline route output apart from hooks and the screen sheet', key => {
        const presented = run(PICKER[key]);
        const original = run(PICKER[key], baselineFile());
        expect(presented.html).not.toBe(original.html);
        expect(unpresent(presented.html)).toBe(original.html);
        expect(presented.log).toEqual(original.log);
        expect(presented.html).toMatch(/<link rel="stylesheet" media="screen" href="\/webroot\/interface\/clinical-workspace\/order-type-popup\.css\?v=[1-9]\d*">/);
    });

    test('selection branches are byte-identical to the baseline (no presentation reaches callbacks)', () => {
        for (const scenario of [
            { get: { typeid: '11', formid: '9', formseq: '2' }, ptrow: { name: 'Syn', procedure_type: 'ord', related_code: 'ICD10:X', transport: '', procedure_code: 'SYN-1', procedure_type_name: 'lab' } },
            { get: { typeid: '0', formid: '9', formseq: '2' } },
            { get: { typeid: '7', addfav: '1' }, ptrow: { name: 'Fav', procedure_type: 'ord', related_code: '', transport: '', procedure_code: 'F', procedure_type_name: 'lab' } },
        ]) {
            expect(run(scenario).html).toBe(run(scenario, baselineFile()).html);
        }
    });

    test('Search and Favorites keep their SQL, binds and lab scope; addfav hides Favorites', () => {
        const [search] = run(PICKER.search).log;
        expect(search[0]).toBe('sqlStatement');
        expect(search[1][0]).toContain("(procedure_type LIKE ? OR procedure_type LIKE 'pro')");
        expect(search[1][1]).toEqual([3, 'ord', '%syn%', '%syn%']);
        const [fav] = run(PICKER.favorites).log;
        expect(fav[1][0]).toContain('(procedure_type LIKE ? ) AND activity = 1');
        expect(fav[1][1]).toEqual([3, 'fgp', '%%', '%%']);
        expect(run(PICKER.initial).log).toEqual([]);
        const doc = new JSDOM(run(PICKER.addfav).html).window.document;
        expect(doc.querySelector('[name="bn_grpsearch"]')).toBeNull();
        expect(doc.querySelector('form').getAttribute('action')).toBe('find_order_popup.php?order=0&labid=4&addfav=1');
    });

    test('controls, wording and result rows render in the original order inside the new hooks', () => {
        const doc = new JSDOM(run(PICKER.search).html).window.document;
        expect(doc.body.className).toBe('oe-order-type');
        const form = doc.querySelector('form.oe-order-type-form');
        expect(form.getAttribute('action')).toBe('find_order_popup.php?order=5&labid=3&formid=9&formseq=2');
        expect([form.method, form.name, form.className]).toEqual(['post', 'theform', 'form-inline oe-order-type-form']);
        const search = doc.querySelector('.oe-order-type-editor .oe-order-type-search');
        expect([...search.querySelectorAll('input, button')].map(el => [el.tagName, el.name || '', el.type, el.value || el.textContent.trim()])).toEqual([
            ['INPUT', 'isfav', 'hidden', ''],
            ['INPUT', 'search_term', 'text', 'syn'],
            ['BUTTON', 'bn_search', 'submit', 'true'],
            ['BUTTON', 'bn_grpsearch', 'submit', 'true'],
            ['BUTTON', '', 'button', 'Erase'],
        ]);
        expect([...doc.querySelectorAll('.oe-order-type-actions button')].map(b => b.textContent)).toEqual(['Search', 'Favorites', 'Erase']);
        expect(doc.getElementById('search_term').getAttribute('placeholder')).toBe('Search for…');
        expect(doc.getElementById('search_term').title).toBe('Any part of the desired code or its description');
        const table = doc.querySelector('.oe-order-type-results > table.oe-order-type-table');
        expect(table.className).toBe('table table-striped table-sm oe-order-type-table');
        expect([...table.querySelectorAll('th')].map(th => th.textContent)).toEqual(['Type', 'Code', 'Description']);
        expect([...table.querySelectorAll('tbody tr')].map(tr => [...tr.cells].map(td => td.textContent))).toEqual([
            ['ORD', 'SYN-1', 'Synthetic <order> one'],
            ['PRO', 'SYN-PRO', 'Synthetic profile'],
        ]);
        expect(doc.title).toBe('Procedure Picker');
    });
});

// The rendered inline selcode script, executed with a recording location object.
const openPicker = scenario => {
    const errors = [];
    const virtualConsole = new VirtualConsole();
    virtualConsole.on('jsdomError', error => errors.push(String(error.message)));
    const html = run(scenario).html;
    const { window } = new JSDOM(html, { url: 'https://emr.test/interface/orders/find_order_popup.php', runScripts: 'dangerously', virtualConsole });
    const script = [...window.document.querySelectorAll('head script')].map(s => s.textContent).find(t => t.includes('function selcode'));
    const location = { href: null };
    // Same script text; only `location` is shadowed so navigation is recorded instead of performed.
    window.selcode = window.eval(`(function (location) {\n${script}\nreturn selcode;\n})`)(location);
    const navigated = () => {
        const url = new URL(location.href, 'https://emr.test/interface/orders/');
        return [url.pathname, Object.fromEntries(url.searchParams)];
    };
    return { window, location, navigated, errors };
};

describe('original selcode() runs from the rendered route', () => {
    test('result links reload with order, labid, formid, formseq and typeid, and cancel the link', () => {
        const { window, navigated, errors } = openPicker(PICKER.search);
        const link = window.document.querySelectorAll('.oe-order-type-table td a')[4];
        const event = new window.MouseEvent('click', { bubbles: true, cancelable: true });
        link.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(true);
        expect(navigated()).toEqual(['/interface/orders/find_order_popup.php', { order: '5', labid: '3', formid: '9', formseq: '2', typeid: '12' }]);
        expect(errors).toEqual([]);
    });

    test('Erase selects type 0; addfav is carried and formid/formseq are omitted when absent', () => {
        const picker = openPicker(PICKER.search);
        picker.window.document.querySelector('.btn-delete').click();
        expect(picker.navigated()[1]).toEqual({ order: '5', labid: '3', formid: '9', formseq: '2', typeid: '0' });
        const fav = openPicker(PICKER.addfav);
        fav.window.document.querySelector('.oe-order-type-table td a').click();
        expect(fav.navigated()[1]).toEqual({ order: '0', labid: '4', addfav: '1', typeid: '11' });
    });
});

// The rendered selection branch, executed against a recording opener.
const select = (scenario, openerOverrides = {}) => {
    const calls = [];
    const errors = [];
    const virtualConsole = new VirtualConsole();
    virtualConsole.on('jsdomError', error => errors.push(String(error.message)));
    const html = run(scenario).html;
    new JSDOM(`<!DOCTYPE html><html><head></head><body>${html}</body></html>`, {
        url: 'https://emr.test/interface/orders/find_order_popup.php', runScripts: 'dangerously', virtualConsole,
        beforeParse(window) {
            window.opener = {
                closed: false,
                set_proc_type: (...args) => calls.push(['set_proc_type', ...args]),
                set_proc_html: (...args) => calls.push(['set_proc_html', ...args]),
                set_new_fav: (...args) => calls.push(['set_new_fav', ...args]),
                ...openerOverrides,
            };
            window.alert = message => calls.push(['alert', message]);
            window.close = () => calls.push(['close']);
        },
    });
    return { calls, errors };
};

describe('original selection callbacks run from the rendered route', () => {
    const ptrow = { name: 'Synthetic order', procedure_type: 'ord', related_code: 'ICD10:SYN', transport: ' t ', procedure_code: ' SYN-1 ', procedure_type_name: ' laboratory ' };

    test('a single order sets the type and QOE html, then closes', () => {
        expect(select({ get: { typeid: '11', formid: '9', formseq: '2' }, ptrow }).calls).toEqual([
            ['set_proc_type', 11, 'Synthetic order', 'ICD10:SYN', 't', 'laboratory', 'SYN-1', '0'],
            ['set_proc_html', 'QOE-11-9-0-2', ''],
            ['close'],
        ]);
        expect(select({ get: { typeid: '12' }, ptrow: { ...ptrow, procedure_type: 'pro' } }).calls[0][3]).toBe('');
    });

    test('a favorite group expands each member with a countdown and its own QOE', () => {
        const group = [
            { procedure_type_id: 21, name: 'Member one', related_code: 'ICD10:A' },
            { procedure_type_id: 22, name: 'Member two', related_code: 'ICD10:B' },
        ];
        const { calls } = select({ get: { typeid: '20', formid: '9', formseq: '1' }, ptrow: { ...ptrow, procedure_type: 'fgp' }, group });
        expect(calls).toEqual([
            ['set_proc_type', 21, 'Member one', 'ICD10:A', 't', 'laboratory', 'SYN-1', 2],
            ['set_proc_html', 'QOE-21-9-0-1', ''],
            ['set_proc_type', 22, 'Member two', 'ICD10:B', 't', 'laboratory', 'SYN-1', 1],
            ['set_proc_html', 'QOE-22-9-0-1', ''],
            ['close'],
        ]);
    });

    test('Erase clears type and QOE; a closed opener alerts and closes', () => {
        expect(select({ get: { typeid: '0', formid: '9', formseq: '2' } }).calls).toEqual([
            ['set_proc_type', 0, '', '', '', '', '', '0'],
            ['set_proc_html', '', ''],
            ['close'],
        ]);
        expect(select({ get: { typeid: '11' }, ptrow }, { closed: true }).calls).toEqual([
            ['alert', 'The destination form was closed; I cannot act on your selection.'],
            ['close'],
        ]);
    });

    test('addfav passes the full row to set_new_fav and closes; the inherited follow-on set_proc_type call is pinned', () => {
        const { calls, errors } = select({ get: { typeid: '7', addfav: '1' }, ptrow }, { set_proc_type: undefined });
        expect(calls).toEqual([['set_new_fav', ptrow], ['close']]);
        // Inherited: types_edit.php defines no set_proc_type, so the next statement throws after close().
        expect(errors.some(e => /set_proc_type/.test(e))).toBe(true);
    });
});

// --- Route stylesheet ---------------------------------------------------------------------------

const SCOPE = 'html.oe-workbench-popup body.oe-order-type';
const at = part => `${SCOPE} ${part}`;
const rulesOf = text => {
    const out = [];
    postcss.parse(text).walkRules(rule => {
        const decls = {};
        rule.walkDecls(d => { decls[d.prop] = `${d.value}${d.important ? ' !important' : ''}`; });
        out.push({ selectors: rule.selectors, decls });
    });
    return out;
};
const rules = () => rulesOf(css());
const declsIn = (text, selector) => Object.assign({}, ...rulesOf(text).filter(r => r.selectors.includes(selector)).map(r => r.decls));
const declsFor = selector => declsIn(css(), selector);
const TOKENS = (() => {
    const map = {};
    postcss.parse(read('interface/clinical-workspace/popup.css')).walkDecls(/^--oe-wb-/, d => { map[d.prop] = d.value.trim(); });
    return map;
})();
const tokenValue = value => TOKENS[(/^var\((--oe-wb-[a-z-]+)\)$/.exec(value) || [])[1]];
const luminance = hex => {
    const full = hex.length === 4 ? `#${[...hex.slice(1)].map(c => c + c).join('')}` : hex;
    return [1, 3, 5].map(i => parseInt(full.slice(i, i + 2), 16) / 255)
        .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
        .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
};
const contrast = (a, b) => {
    const [hi, lo] = [luminance(tokenValue(a)), luminance(tokenValue(b))].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
};

// Declared contract that keeps every control on screen at narrow widths: the search group and
// action row wrap, the input may shrink, buttons wrap their label, nothing is hidden, clipped or
// re-fonted. Returns violations; declarations only, not native layout.
const narrowViolations = text => {
    const v = [];
    const d = part => declsIn(text, at(part));
    if (d('.oe-order-type-form')['min-width'] !== '0') v.push('form min-width');
    if (d('.oe-order-type-search')['flex-wrap'] !== 'wrap') v.push('search wrap');
    if (d('.oe-order-type-search').width !== '100%') v.push('search width');
    const input = d('.oe-order-type-search > #search_term');
    if (input['min-width'] !== '0') v.push('input min-width');
    if (!/^1 1 \d+(\.\d+)?rem$/.test(input.flex ?? '')) v.push('input flex');
    if (parseFloat((input.flex ?? '').split(' ')[2]) > 12) v.push('input basis');
    const actions = d('.oe-order-type-actions');
    if (actions['flex-wrap'] !== 'wrap') v.push('actions wrap');
    if (actions['max-width'] !== '100%') v.push('actions max-width');
    if (actions['margin-left'] !== '0') v.push('actions margin');
    const button = d('.oe-order-type-actions > .btn');
    if (button['white-space'] !== 'normal') v.push('button white-space');
    if (button['max-width'] !== '100%') v.push('button max-width');
    if (button['overflow-wrap'] !== 'anywhere') v.push('button overflow-wrap');
    if (d('.oe-order-type-results')['overflow-x'] !== 'auto') v.push('results scroll');
    if (d('.oe-order-type-table td')['overflow-wrap'] !== 'anywhere') v.push('cell wrap');
    for (const { selectors, decls } of rulesOf(text)) {
        for (const prop of ['font', 'font-size', 'line-height', 'display', 'visibility', 'height', 'max-height', 'position', 'text-overflow']) {
            if (decls[prop] !== undefined) v.push(`${selectors[0]} ${prop}`);
        }
        if (/hidden|clip/.test(decls.overflow ?? '') || /hidden|clip/.test(decls['overflow-x'] ?? '')) v.push(`${selectors[0]} overflow`);
        if ((decls['white-space'] ?? 'normal') !== 'normal') v.push(`${selectors[0]} white-space`);
        if (/^-/.test(decls['margin-inline'] ?? '')) v.push(`${selectors[0]} negative margin`);
    }
    if (/!important|@media print|opacity:\s*0|outline:\s*(0|none)/.test(text)) v.push('forbidden text');
    return v;
};

describe('order-type-popup.css', () => {
    test('one @media screen block, no width queries, every selector positive-scoped to popup context plus route', () => {
        const tree = postcss.parse(css());
        expect(tree.nodes.filter(node => node.type !== 'comment')).toHaveLength(1);
        const media = [];
        tree.walkAtRules(rule => media.push(`${rule.name} ${rule.params}`));
        expect(media).toEqual(['media screen']);
        expect(rules().length).toBeGreaterThan(15);
        for (const { selectors } of rules()) {
            for (const selector of selectors) {
                expect([selector, selector === SCOPE || selector.startsWith(`${SCOPE} `)]).toEqual([selector, true]);
                // The Erase control keeps its theme danger palette.
                expect(selector).not.toMatch(/btn-danger|btn-delete|print|workbench-active|oe-clinical-workspace/);
            }
        }
    });

    test('the complete prefix-override allowlist is unchanged and the new sheet lints clean under the repo config', () => {
        const rc = JSON.parse(read('.stylelintrc.json'));
        expect(rc.rules['media-feature-range-notation']).toBeUndefined();
        expect(rc.overrides.flatMap(o => o.files)).toEqual([
            'interface/clinical-workspace/calendar.css', 'interface/clinical-workspace/finder.css', 'interface/clinical-workspace/soap-document.css', 'interface/clinical-workspace/encounter-document.css',
            'interface/forms/vitals/vitals.css',
            'interface/clinical-workspace/patient-picker-popup.css', 'interface/clinical-workspace/patient-results-popup.css', 'interface/clinical-workspace/issue-popup.css',
            'interface/clinical-workspace/patient-search.css',
        ]);
        const bin = path.join(path.dirname(require.resolve('stylelint/package.json')), 'bin/stylelint.mjs');
        const configBasedir = path.resolve(path.dirname(require.resolve('stylelint-config-standard')), '../..');
        const lint = (args, input) => {
            const result = spawnSync(process.execPath, [bin, '--config', path.join(root, '.stylelintrc.json'), '--config-basedir', configBasedir, '--formatter', 'json', ...args], { encoding: 'utf8', input });
            expect(result.error).toBeUndefined();
            const report = JSON.parse(result.stderr || result.stdout);
            return { status: result.status, rules: report.flatMap(r => [...r.parseErrors, ...r.invalidOptionWarnings, ...r.warnings.map(w => w.rule)]) };
        };
        expect(lint([path.join(root, SHEET)])).toEqual({ status: 0, rules: [] });
        // Not in the allowlist: a prefix width query in this file would be rejected.
        expect(lint(['--stdin-filename', path.join(root, SHEET)], '@media (max-width: 480px) {\n  a {\n    color: #fff;\n  }\n}\n'))
            .toEqual({ status: 2, rules: ['media-feature-range-notation'] });
    });

    test('field, placeholder, button, editor and table colours are paired from popup tokens at readable contrast', () => {
        let pairs = 0;
        for (const { selectors, decls } of rules()) {
            const ink = decls.color;
            const surface = decls['background-color'];
            expect(decls.background).toBeUndefined();
            for (const value of Object.values(decls)) expect(value).not.toMatch(/#[0-9a-f]{3,8}\b|\b(white|black|red|yellow)\b|rgb/i);
            if (selectors.every(s => /td a(:[a-z-]+)?$|::placeholder$/.test(s))) continue;
            expect([selectors[0], ink === undefined]).toEqual([selectors[0], surface === undefined]);
            if (!ink) continue;
            pairs++;
            expect([selectors[0], contrast(ink, surface) >= 4.5]).toEqual([selectors[0], true]);
        }
        expect(pairs).toBeGreaterThanOrEqual(8);
        const pair = (part, ink, surface) => expect(declsFor(at(part))).toMatchObject({ color: `var(--oe-wb-${ink})`, 'background-color': `var(--oe-wb-${surface})` });
        pair('#search_term', 'ink', 'paper');
        pair('.oe-order-type-editor', 'ink', 'canvas');
        pair('.oe-order-type-actions > .btn-primary', 'on-petrol', 'petrol');
        pair('.oe-order-type-actions > .btn-primary:hover', 'on-petrol', 'ink');
        pair('.oe-order-type-table', 'ink', 'paper');
        pair('.oe-order-type-table th', 'muted', 'canvas');
        pair('.oe-order-type-table td', 'ink', 'paper');
        pair('.oe-order-type-table tbody tr:nth-of-type(odd) td', 'ink', 'canvas');
        // Placeholder on the field's paper; links on both row surfaces.
        const placeholder = declsFor(at('#search_term::placeholder'));
        expect(placeholder).toMatchObject({ color: 'var(--oe-wb-muted)', opacity: '1' });
        expect(contrast(placeholder.color, 'var(--oe-wb-paper)')).toBeGreaterThanOrEqual(4.5);
        const link = declsFor(at('.oe-order-type-table td a'));
        for (const surface of ['paper', 'canvas']) expect(contrast(link.color, `var(--oe-wb-${surface})`)).toBeGreaterThanOrEqual(4.5);
        for (const state of [':hover', ':focus']) expect(contrast(declsFor(at(`.oe-order-type-table td a${state}`)).color, 'var(--oe-wb-canvas)')).toBeGreaterThanOrEqual(4.5);
    });

    test('focus: a :focus fallback rule and a separate :focus-visible rule keep a visible ring on every control', () => {
        const ring = { outline: '2px solid var(--oe-wb-petrol)', 'outline-offset': '2px' };
        for (const control of ['#search_term', '.oe-order-type-actions > .btn', '.oe-order-type-table td a']) {
            const fallback = rules().find(r => r.selectors.includes(at(`${control}:focus`)) && r.decls.outline);
            const visible = rules().find(r => r.selectors.includes(at(`${control}:focus-visible`)));
            expect([control, fallback?.decls]).toEqual([control, expect.objectContaining(ring)]);
            expect([control, visible?.decls]).toEqual([control, expect.objectContaining(ring)]);
            expect(fallback).not.toBe(visible);
            expect(fallback.selectors.every(s => !s.includes(':focus-visible'))).toBe(true);
        }
    });

    test('document shape: centred sheet, framed search/actions editor, contained ruled results table', () => {
        expect(declsFor(at('.oe-order-type-sheet'))).toMatchObject({ 'max-width': expect.stringMatching(/px$/), 'padding-inline': expect.stringMatching(/^min\(/) });
        expect(declsFor(at('.oe-order-type-layout'))).toMatchObject({ 'margin-inline': '0' });
        expect(declsFor(at('.oe-order-type-editor'))).toMatchObject({ border: '1px solid var(--oe-wb-line)', 'border-radius': '8px' });
        expect(declsFor(at('.oe-order-type-results'))).toMatchObject({ border: '1px solid var(--oe-wb-line)', 'border-radius': '8px', 'overflow-x': 'auto' });
        expect(declsFor(at('.oe-order-type-table'))).toMatchObject({ 'margin-bottom': '0' });
        expect(declsFor(at('.oe-order-type-actions > .btn'))).toMatchObject({ 'border-radius': '6px', 'margin-left': '0' });
        expect(declsFor(at('.oe-order-type-search > #search_term'))).toMatchObject({ 'border-radius': '6px' });
    });

    test('narrow wrapping contract holds, with no reduced font, hiding or clipping', () => {
        expect(narrowViolations(css())).toEqual([]);
    });

    test('negative mutations of the narrow contract are detected', () => {
        const sheet = css();
        const mutate = (from, to) => {
            expect([from, sheet.includes(from)]).toEqual([from, true]);
            return narrowViolations(sheet.replace(from, to));
        };
        expect(mutate('flex-wrap: wrap;', 'flex-wrap: nowrap;')).not.toEqual([]);
        expect(mutate('white-space: normal;', 'white-space: nowrap;')).not.toEqual([]);
        expect(mutate('overflow-x: auto;', 'overflow-x: hidden;')).not.toEqual([]);
        expect(mutate('max-width: 100%;', 'max-width: none;')).not.toEqual([]);
        expect(mutate('min-width: 0;', 'min-width: auto;')).not.toEqual([]);
        expect(mutate('overflow-wrap: anywhere;', 'overflow-wrap: normal;')).not.toEqual([]);
        expect(narrowViolations(sheet.replace(/flex: 1 1 [\d.]+rem;/, 'flex: none;'))).not.toEqual([]);
        expect(narrowViolations(sheet.replace(/flex: 1 1 [\d.]+rem;/, 'flex: 1 1 30rem;'))).not.toEqual([]);
        expect(narrowViolations(sheet.replace('border-radius: 6px;', 'border-radius: 6px;\n    font-size: 0.75rem;'))).not.toEqual([]);
        expect(narrowViolations(sheet.replace('border-radius: 6px;', 'border-radius: 6px;\n    display: none;'))).not.toEqual([]);
    });
});

// --- Real popup.js activation of the rendered route --------------------------------------------

describe('route sheet follows the real Header popup.js controller', () => {
    const ORIGIN = 'https://emr.test';
    const makeWindow = (markup, { parent, frameElement, opener, url = `${ORIGIN}/interface/orders/find_order_popup.php` } = {}) => {
        const { window } = new JSDOM(markup, { url });
        if (parent) Object.defineProperty(window, 'parent', { configurable: true, get: () => parent });
        if (frameElement) Object.defineProperty(window, 'frameElement', { configurable: true, get: () => frameElement });
        if (opener) window.opener = opener;
        return window;
    };
    const makeShell = () => makeWindow('<body class="workbench-active"><div id="mainBox"><button data-workbench-mode></button></div>'
        + '<div class="modal dialogModal"><iframe class="modalIframe"></iframe></div><iframe name="pat"></iframe></body>', { url: `${ORIGIN}/interface/main/tabs/main.php` });
    const routeHtml = () => run(PICKER.search).html;
    const start = win => {
        jest.resetModules();
        return require('../../interface/clinical-workspace/popup.js').createPopupController({ win });
    };
    const ENGAGE = ['.oe-order-type-sheet', '.oe-order-type-editor', '#search_term', '.oe-order-type-actions > .btn-primary', '.oe-order-type-table td'];
    const engaged = win => ENGAGE.map(part => {
        const element = win.document.querySelector(part.replace(/^.* > /, ''));
        return rules().some(r => r.selectors.some(s => s === at(part) && element.matches(s)));
    });
    const flush = () => new Promise(resolve => setTimeout(resolve, 0));

    test('both callers open it in a dlgopen dialog of an active workbench: engaged; legacy mode disengages and restores', async () => {
        const shell = makeShell();
        const win = makeWindow(routeHtml(), { parent: shell, frameElement: shell.document.querySelector('iframe.modalIframe') });
        expect(start(win).active).toBe(true);
        expect(engaged(win)).toEqual(ENGAGE.map(() => true));
        shell.document.body.classList.remove('workbench-active');
        await flush();
        expect(engaged(win)).toEqual(ENGAGE.map(() => false));
        shell.document.body.classList.add('workbench-active');
        await flush();
        expect(engaged(win)).toEqual(ENGAGE.map(() => true));
    });

    test('normal contexts stay legacy: top-level page, workbench tab frame and a legacy opener', () => {
        const top = makeWindow(routeHtml());
        start(top);
        expect(engaged(top)).toEqual(ENGAGE.map(() => false));
        const shell = makeShell();
        const tab = makeWindow(routeHtml(), { parent: shell, frameElement: shell.document.querySelector('iframe[name="pat"]') });
        start(tab);
        expect(tab.document.documentElement.classList.contains('oe-workbench-context')).toBe(true);
        expect(engaged(tab)).toEqual(ENGAGE.map(() => false));
        const legacy = makeWindow(routeHtml(), { opener: makeWindow('<body class="body_top"></body>', { url: `${ORIGIN}/interface/legacy.php` }) });
        start(legacy);
        expect(engaged(legacy)).toEqual(ENGAGE.map(() => false));
    });

    test('activation only toggles <html> classes: body, form and controls are untouched', () => {
        const shell = makeShell();
        const win = makeWindow(routeHtml(), { parent: shell, frameElement: shell.document.querySelector('iframe.modalIframe') });
        const before = win.document.body.outerHTML;
        start(win).dispose();
        expect(win.document.body.outerHTML).toBe(before);
        expect(win.document.documentElement.className).toBe('');
    });
});

describe('documentation', () => {
    test('is bounded and discloses evidence limits without claiming acceptance', () => {
        const doc = read(DOC).replace(/\s+/g, ' ');
        expect(doc).toMatch(/not native (browser )?geometry/i);
        expect(doc).toMatch(/stubbed (Header|SQL)/i);
        expect(doc).toMatch(/no native (visual|browser)[^.]*acceptance/i);
        expect(doc).toMatch(/not evidence for any of the 22/i);
        expect(doc).toMatch(/set_proc_type[^.]*inherited/i);
        expect(doc).toMatch(/CLI-only[^.]*404/i);
        expect(doc).toMatch(/system temp directory/i);
        expect(doc).not.toMatch(/\bAccepted\b/);
    });
});

test('host PHP is the harness interpreter', () => {
    expect(execFileSync('php', ['-r', 'echo PHP_MAJOR_VERSION >= 8 ? "ok" : "old";'], { encoding: 'utf8' })).toBe('ok');
});

// --- Fixture confinement: the harness must never act as a web entry point -----------------------

describe('find-order-popup harness is CLI-only and confines its route override', () => {
    const harnessSource = () => fs.readFileSync(HARNESS, 'utf8');

    test('source: the CLI SAPI guard fails closed before any alias, argument, include or SQL double', () => {
        const php = harnessSource();
        const body = php.slice(php.indexOf('\nnamespace {'));
        const guard = body.indexOf("if (PHP_SAPI !== 'cli') {");
        expect(guard).toBeGreaterThan(0);
        expect(body.slice(guard, body.indexOf('}', guard))).toMatch(/http_response_code\(404\);\s*exit\(1\);/);
        for (const later of ['class_alias(', '$argv', '$_SERVER', 'json_decode(', 'require ', 'function sqlQuery', 'chdir(']) {
            expect([later, body.indexOf(later) > guard]).toEqual([later, true]);
        }
        // The only route include is the confined, validated path.
        expect(count(php, 'require $route;')).toBe(1);
        expect(php).not.toMatch(/require \$argv/);
    });

    test('CLI import (require from another script) defines no aliases or SQL doubles and prints nothing', () => {
        const probe = `require ${JSON.stringify(HARNESS)}; echo json_encode([class_exists('OpenEMR\\\\Core\\\\Header', false), function_exists('sqlQuery'), getcwd() === ${JSON.stringify(root)}]);`;
        const result = spawnSync('php', ['-r', probe], { cwd: root, encoding: 'utf8' });
        expect([result.status, result.stderr, result.stdout]).toEqual([0, '', '[false,false,true]']);
    });

    test('CLI route override accepts only a find_order_popup.php copy inside the system temp directory', () => {
        const outside = path.join(__dirname, 'fixtures/find-order-popup/globals.php');
        const misnamed = path.join(scratch, 'other.php');
        fs.writeFileSync(misnamed, '<?php echo "INCLUDED";');
        for (const route of [outside, misnamed, path.join(scratch, 'missing', 'find_order_popup.php'), `${scratch}/../${path.basename(scratch)}/other.php`]) {
            const result = spawnSync('php', [HARNESS, '{}', route], { encoding: 'utf8' });
            expect([route, result.status, result.stdout]).toEqual([route, 1, '']);
            expect(result.stderr).toContain('Unsupported route override');
        }
        // The supported override still renders the reconstructed baseline.
        expect(run(PICKER.initial, baselineFile()).html).toContain('<title>Procedure Picker</title>');
    });

    test('HTTP: a loopback php built-in server answers 404 and never renders or includes, even with register_argc_argv', async () => {
        const sentinel = path.join(scratch, 'sentinel.php');
        fs.writeFileSync(sentinel, '<?php echo "INCLUDED";');
        const port = 20000 + Math.floor(Math.random() * 30000);
        const { spawn } = require('child_process');
        const server = spawn('php', ['-d', 'register_argc_argv=1', '-S', `127.0.0.1:${port}`, '-t', path.join(__dirname, 'fixtures')], { stdio: 'ignore' });
        const http = require('http');
        // With register_argc_argv=1, PHP 8.5 itself prints one startup deprecation notice into every
        // response; remove exactly that notice so only script output is compared.
        const scriptOutput = body => body.replace(/^<br \/>\n<b>Deprecated<\/b>: {2}Deriving \$_SERVER\['argv'\] from the query string is deprecated\.[^\n]*\n/, '');
        const get = url => new Promise((resolve, reject) => {
            http.get({ host: '127.0.0.1', port, path: url }, res => {
                let body = '';
                res.on('data', chunk => { body += chunk; });
                res.on('end', () => resolve({ status: res.statusCode, body }));
            }).on('error', reject);
        });
        try {
            let ready = null;
            for (let i = 0; i < 50 && !ready; i++) {
                ready = await get('/find-order-popup/globals.php').catch(() => null);
                if (!ready) await new Promise(resolve => setTimeout(resolve, 100));
            }
            expect(ready).not.toBeNull();
            for (const query of ['', `?${encodeURIComponent('{}')}+${encodeURIComponent(sentinel)}`]) {
                const response = await get(`/find-order-popup-harness.php${query}`);
                expect([query, response.status, scriptOutput(response.body)]).toEqual([query, 404, '']);
                expect(response.body).not.toMatch(/Procedure Picker|INCLUDED|sqlStatement/);
            }
            // Sibling fixture entrypoints only declare strict types or a function: no output.
            for (const file of ['/find-order-popup/globals.php', '/find-order-popup/cwd/qoe.inc.php']) {
                expect([file, scriptOutput((await get(file)).body)]).toEqual([file, '']);
            }
        } finally {
            server.kill();
        }
    });
});
