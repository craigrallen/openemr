/** @jest-environment node */

// Diagnosis Codes History picker (find_code_history.php): presentation-only workbench sheet.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const process = require('node:process');
const postcss = require('postcss');
const { JSDOM, VirtualConsole } = require('jsdom');

const root = path.join(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const ROUTE = 'interface/patient_file/encounter/find_code_history.php';
const LAUNCHER = 'interface/forms/procedure_order/common.php';
const SHEET = 'interface/clinical-workspace/code-history.css';
const DOC = 'docs/clinical-ui/CODE-HISTORY.md';
const css = () => read(SHEET);
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const count = (text, part) => text.split(part).length - 1;

// sha256 of find_code_history.php (236 lines) and its launcher at master 18647270.
const BASELINE = '90432e0729a5849b893ece0bd2b0d9b6aad2da9d99b1060e73ec87cc1c6e05cf';
const LAUNCHER_BASELINE = 'c0cdd93ca36ba1b9d5c490d19ce87bf0bb2c17463432fc9dccf2d8173f6ceb28';
const STYLELINT_RC_BASELINE = '7578dfe64a6e9df4dadd97c75ad5ce443134b133914ed54000a78ac4272adf6e';

const WEBROOT = '<?php echo attr(\\OpenEMR\\Core\\OEGlobalsBag::getInstance()->getWebRoot()); ?>';
const assetLines = '    <?php $clinicalAssets = new ClinicalWorkspaceAssets(); // Screen-only; inert until mode.js finds an active workbench. ?>\n'
    + `    <link rel="stylesheet" media="screen" href="${WEBROOT}/interface/clinical-workspace/code-history.css?v=<?php echo attr_url($clinicalAssets->version('code-history.css')); ?>">\n`
    + `    <script src="${WEBROOT}/interface/clinical-workspace/mode.js?v=<?php echo attr_url($clinicalAssets->version('mode.js')); ?>" defer></script>\n`;

// The complete presentation edit map, each entry [original, presented].
const changes = [
    ['\nuse OpenEMR\\Common\\Session\\SessionWrapperFactory;\n', '\nuse OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;\nuse OpenEMR\\Common\\Session\\SessionWrapperFactory;\n'],
    ["    <?php Header::setupHeader(['opener']); ?>\n", `    <?php Header::setupHeader(['opener']); ?>\n${assetLines}`],
    ['\n<body>\n', '\n<body class="oe-code-history">\n'],
    ['<div class="container-fluid sticky-top">', '<div class="container-fluid sticky-top oe-code-history-editor">'],
    ['<div class="input-group bg-white">', '<div class="input-group bg-white oe-code-history-dx">'],
    ['<div id="tips" class="d-none">', '<div id="tips" class="d-none oe-code-history-tips">'],
    ['<div class="container-fluid">\n        <div class="table-responsive mt-1">', '<div class="container-fluid oe-code-history-sheet">\n        <div class="table-responsive mt-1 oe-code-history-results">'],
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

describe('find_code_history.php carries only the declared presentation edits', () => {
    test('reversing the full edit map restores the exact original 236-line route digest', () => {
        const php = read(ROUTE);
        for (const [, after] of changes) expect([after, count(php, after)]).toEqual([after, 1]);
        const restored = restore(php);
        expect(restored).not.toBeNull();
        expect(restored.split('\n').length - 1).toBe(236);
        expect(sha(restored)).toBe(BASELINE);
    });

    test('negative guards: SQL, session, grouping, sort, callbacks, DOM ids, wording and controls cannot change unnoticed', () => {
        const php = read(ROUTE);
        const mutations = [
            ['require_once(__DIR__ . "/../../globals.php");', 'require_once(__DIR__ . "/../globals.php");'],
            ['"/options.inc.php");', '"/options.inc.php"); require_once("x.php");'],
            ["get('pid', 0)", "get('pid', 1)"],
            ['"Where activity = 1 And type = ? And pid = ? Group By lists.diagnosis",', '"Where activity = 1 And type = ? And pid = ?",'],
            ["['medical_problem', $pid]", "['medical_problem', 0]"],
            ['"Where procedure_order_code.diagnoses > \'\' Group By procedure_order_code.diagnoses"', '"Where procedure_order_code.diagnoses > \'\' And procedure_order.patient_id = ?"'],
            ["preg_replace('/^;+|;+$/', '', (string) $diag['codes']);", "trim((string) $diag['codes'], ';');"],
            ['array_unique(array_map(serialize(...), $dxcodes))', 'array_unique(array_map(json_encode(...), $dxcodes))'],
            ["array_column($dxcodes, 'procedure'),\n        SORT_ASC,", "array_column($dxcodes, 'procedure'),\n        SORT_DESC,"],
            ['return array_merge($probcodes, $dxcodes);', 'return array_merge($dxcodes, $probcodes);'],
            ["$origin = xlt('Procedures');", "$origin = xlt('Orders');"],
            ["Header::setupHeader(['opener'])", "Header::setupHeader(['opener', 'common'])"],
            ['xlj("Error finding diagnosis element. Try again.")', 'xlj("Error.")'],
            ["currentDx = currentDx.replace(';;', ';');", "currentDx = currentDx.replace(/;;/g, ';');"],
            ['opener.targetElement.value = currentDx;', 'opener.targetElement.value = currentDx.trim();'],
            ['            dlgclose();\n', '            dlgclose("dxDone");\n'],
            ["if (currentDx.indexOf(codeElement.value) !== -1) {", "if (currentDx.split(';').includes(codeElement.value)) {"],
            ['if (currentDx.length > 1) {', 'if (currentDx.length > 0) {'],
            ["opener.targetElement.value = '';", "opener.targetElement.value = opener.targetElement.value;"],
            ['document.getElementById(\'workingDx\').value = opener.targetElement.value;', 'document.getElementById(\'workingDx\').value = "";'],
            ["top.document.getElementById('saveDx')", "document.getElementById('saveDx')"],
            ["top.document.getElementById('showTips')", "top.document.getElementById('help')"],
            ['opener.targetProcedure.children[1].value', 'opener.targetProcedure.children[0].value'],
            ['$("#historyTable tr td").filter(":contains(" + src + ")")', '$("#historyTable tr td").filter(":contains(\'" + src + "\')")'],
            ["'<mark>' + rows[i].innerHTML + '</mark>'", "rows[i].innerHTML"],
            ["addClass('text-danger ')", "addClass('table-warning')"],
            ["$(rows[0]).closest('tr').addClass('active');", ''],
            ["$(window).scrollTop($(rows[0]).offset().top - ($(window).height() / 2));", ''],
            ["$('.spinner-border').fadeOut();", "$('.spinner-border').hide();"],
            ["onclick='clearCodes(this)'", "onclick='clearCodes()'"],
            ['<i class="fa fa-trash fa-1x"></i>', '<i class="fa fa-times"></i>'],
            ["<input class='form-control text-danger' type='text' id='workingDx'", "<input class='form-control' type='text' id='workingDx'"],
            ["xla('Current Working Procedure Diagnoses')", "xla('Diagnoses')"],
            ['<section class="card bg-warning">', '<section class="card bg-light">'],
            ["xlt('Usage Tips')", "xlt('Tips')"],
            ['xlt("The legacy code finder is still available for codes not found in this finder or code list editing.")', 'xlt("Use the legacy finder.")'],
            ["onclick='$(\"#tips\").toggleClass(\"d-none\");return false;'", "onclick='$(\"#tips\").addClass(\"d-none\");return false;'"],
            ["xlt('Dismiss')", "xlt('Close')"],
            ['<div class="spinner-border" role="status">', '<div class="spinner-border d-none" role="status">'],
            ['<table class="table table-sm table-hover" id="historyTable">', '<table class="table table-sm" id="historyTable">'],
            ["<th><?php echo xlt('Origin Description'); ?></th>", "<th><?php echo xlt('Procedure'); ?></th>"],
            ["onclick='rtnCode(this)' value='<?php echo attr($pc['code']); ?>'", "onclick='rtnCode(this)' value='<?php echo text($pc['code']); ?>'"],
            ["<u class='text-danger'><?php echo $code[1]; ?></u>", "<u><?php echo $code[1]; ?></u>"],
            ['<?php echo $pc[\'origin\']; ?>', '<?php echo text($pc[\'origin\']); ?>'],
        ];
        for (const [from, to] of mutations) {
            expect([from, php.includes(from)]).toEqual([from, true]);
            const restored = restore(php.replace(from, () => to));
            expect([from, restored === null ? null : sha(restored)]).not.toEqual([from, BASELINE]);
        }
        // Dropping any presentation hook is caught too.
        for (const [, after] of changes.slice(2)) {
            expect(restore(php.replace(after, () => after.replace(/ ?oe-code-history[a-z-]*/, '').replace(' class=""', '')))).toBeNull();
        }
    });

    test('the route sheet and mode.js are linked once, screen-only, versioned, after the original Header', () => {
        const php = read(ROUTE);
        expect(count(php, assetLines)).toBe(1);
        expect(count(php, 'code-history.css')).toBe(2);
        expect(count(php, 'mode.js')).toBe(3);
        expect(php.indexOf('code-history.css')).toBeGreaterThan(php.indexOf("Header::setupHeader(['opener'])"));
        expect(php.indexOf('mode.js?v=')).toBeLessThan(php.indexOf('</head>'));
        // No generic workspace.css activation, no shared popup asset, no print sheet.
        expect(php).not.toMatch(/clinical-workspace\/(workspace|popup)\.(css|js)|media="print"|@media print/);
    });

    test('the asset helper allowlists exactly the new basename, in order', () => {
        const helper = read('src/Common/Assets/ClinicalWorkspaceAssets.php');
        expect(helper).toMatch(/\n {8}'calendar-workday\.js',\n {8}'code-history\.css',\n {8}'encounter-document\.css',\n/);
        expect(count(helper, 'code-history')).toBe(1);
    });

    test('the launcher is byte-identical and still opens the route with Save/Help ids in an iframe dialog', () => {
        const launcher = read(LAUNCHER);
        expect(sha(launcher)).toBe(LAUNCHER_BASELINE);
        expect(count(launcher, "dlgopen('find_code_history.php', 'dxDialog', 'modal-mlg', 450, '', title, {")).toBe(1);
        expect(launcher).toContain("id: 'saveDx'");
        expect(launcher).toContain("id: 'showTips'");
        expect(launcher).toContain("type: 'iframe'");
    });

    test('inherited data scope is pinned and disclosed: the procedure query is not patient-filtered', () => {
        const php = read(ROUTE);
        const procedureSql = php.slice(php.indexOf('"Select procedure_order_code.diagnoses'), php.indexOf('$origin = xlt(\'Procedures\');'));
        expect(procedureSql).not.toMatch(/pid|patient_id/);
        expect(procedureSql).not.toContain('$pid');
        const doc = read(DOC);
        expect(doc).toMatch(/not patient-filtered/i);
        expect(doc).not.toMatch(/patient-only (codes|history|provenance)|only this patient/i);
    });

    test('documentation is precise about baseline assets, activation paths, estimates and open acceptance gaps', () => {
        const doc = read(DOC).replace(/\s+/g, ' ');
        expect(doc).not.toMatch(/shared popup assets are not activated/i);
        expect(doc).toMatch(/`popup\.css` and `popup\.js` already autoload through `Header` at baseline/i);
        expect(doc).toMatch(/not newly added by this change/i);
        expect(doc).toMatch(/standalone window whose opener is an active workbench can activate/i);
        expect(doc).toMatch(/declared-box (estimates|arithmetic)[^.]*not native (browser )?geometry/i);
        expect(doc).toMatch(/trash button[^.]*input/i);
        for (const gap of [/tips?[^.]*(height|reachab|scroll)/i, /hover/i, /focus[^.]*(native|browser|rendered)/i, /native (visual|browser)[^.]*acceptance/i]) {
            expect(doc).toMatch(gap);
        }
    });
});

// --- The original inline script, executed under jsdom in a dialog frame of a synthetic shell ----

const callbackSource = () => {
    const php = read(ROUTE);
    const start = php.indexOf('<script>\n') + '<script>\n'.length;
    const script = php.slice(start, php.indexOf('</script>', start));
    expect(count(script, '<?php')).toBe(1);
    // xlj() with translation disabled is json_encode().
    return script.replace(/<\?php echo xlj\("([^"]*)"\); \?>/, (_, message) => JSON.stringify(message));
};
const ERROR = 'Error finding diagnosis element. Try again.';
const esc = value => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');

// SYNTHETIC rows in the order get_history_codes() returns them: problems, then procedures.
const ROWS = [
    ['Problems', 'ICD10:SYN.1', 'Synthetic description one', 'Synthetic problem'],
    ['Procedures', 'ICD10:SYN.2', 'Synthetic description two', 'Synthetic order CPT4:99999'],
    ['Procedures', 'ICD10:SYN.3', 'Synthetic description three', 'Synthetic order CPT4:99999'],
    ['Procedures', 'ICD10:SYN.4', 'Synthetic description four', 'Other synthetic order'],
];

// The route body with PHP echoes resolved as translation-disabled helpers would.
const bodyMarkup = () => {
    const php = read(ROUTE);
    let body = php.slice(php.indexOf('<body'), php.indexOf('</body>') + '</body>'.length);
    const loop = body.match(/<\?php\n\s*\$dxcodes = get_history_codes\(\$pid\);[\s\S]*?text\(\$code\[1\]\); \?>([\s\S]*?)<\?php \} \?>/);
    expect(loop).not.toBeNull();
    const rows = ROWS.map(([origin, code, desc, proc]) => {
        const [type, value] = code.split(':');
        return loop[1]
            .replace("<?php echo $pc['origin']; ?>", origin)
            .replace("<?php echo attr($pc['code']); ?>", esc(code))
            .replace('<?php echo $code[0]; ?>', esc(type))
            .replace('<?php echo $code[1]; ?>', esc(value))
            .replace("<?php echo text($pc['desc']); ?>", esc(desc))
            .replace("<?php echo text($pc['procedure']); ?>", esc(proc));
    }).join('');
    body = body.replace(loop[0], () => rows);
    body = body.replace(/<\?php\s*((?:echo "<li>" \. xlt\("[^"]*"\) \. "<\/li>";\s*)+)\?>/, (_, list) =>
        [...list.matchAll(/xlt\("([^"]*)"\)/g)].map(([, text]) => `<li>${esc(text)}</li>`).join(''));
    body = body.replace(/<\?php echo (?:xlt|xla)\((['"])(.*?)\1\);? \?>/g, (_, q, text) => esc(text));
    expect(body).not.toContain('<?php');
    return body;
};

const openDialog = async ({ opener = 'live', targetValue = 'ICD10:OLD', procedure = 'CPT4:99999' } = {}) => {
    const errors = [];
    const virtualConsole = new VirtualConsole();
    virtualConsole.on('jsdomError', error => errors.push(String(error.message)));
    const shell = new JSDOM('<body class="workbench-active"><button id="saveDx">Save</button><button id="showTips">Help</button>'
        + '<div class="modal dialogModal"><iframe class="modalIframe"></iframe></div></body>',
    { url: 'https://emr.test/interface/main/tabs/main.php', runScripts: 'dangerously', virtualConsole });
    const frame = shell.window.document.querySelector('iframe').contentWindow;
    const body = bodyMarkup();
    frame.document.documentElement.innerHTML = `<head></head>${body}`;
    frame.document.body.className = (body.match(/^<body class="([^"]*)"/) || [null, ''])[1];
    const calls = { alerts: [], closed: 0 };
    frame.alert = message => { calls.alerts.push(message); };
    frame.dlgclose = (...args) => { calls.closed++; calls.closeArgs = args; };
    const procedureRow = frame.document.createElement('div');
    procedureRow.innerHTML = `<label>Procedure</label><input value="${esc(procedure)}">`;
    const targetElement = frame.document.createElement('input');
    targetElement.value = targetValue;
    const openerWindow = opener === 'live' ? { targetElement, targetProcedure: procedureRow } : null;
    Object.defineProperty(frame, 'opener', { configurable: true, writable: true, value: openerWindow });
    frame.eval(fs.readFileSync(require.resolve('jquery/dist/jquery.js'), 'utf8'));
    frame.jQuery.fx.off = true;
    frame.eval(callbackSource());
    // jQuery rethrows ready-handler errors from a later timer; let those land too.
    for (let i = 0; i < 6; i++) await new Promise(resolve => frame.setTimeout(resolve, 0));
    const $ = selector => frame.document.querySelector(selector);
    const dx = () => $('#workingDx').value;
    const codeButton = code => frame.document.querySelector(`#historyTable button[value="${code}"]`);
    return { shell, frame, calls, errors, $, dx, codeButton, targetElement };
};

describe('original setCodes/rtnCode/clearCodes/setFormDx and top Save/Help hookups run unchanged', () => {
    test('opening copies the opener diagnoses, marks matching procedure rows red, activates the first and stops the spinner', async () => {
        const { frame, dx, errors } = await openDialog();
        expect(dx()).toBe('ICD10:OLD');
        const trs = [...frame.document.querySelectorAll('#historyTable tbody tr')];
        expect(trs.map(tr => tr.querySelector('button').value)).toEqual(ROWS.map(r => r[1]));
        expect(trs.map(tr => tr.classList.contains('text-danger'))).toEqual([false, true, true, false]);
        expect(trs.map(tr => tr.classList.contains('active'))).toEqual([false, true, false, false]);
        expect(trs.map(tr => tr.querySelectorAll('mark').length)).toEqual([0, 1, 1, 0]);
        expect(trs[1].querySelector('td:last-child mark').textContent.trim()).toBe('Synthetic order CPT4:99999');
        expect(frame.document.querySelector('.spinner-border').style.display).toBe('none');
        expect(errors.filter(e => !/scrollTo/.test(e))).toEqual([]);
        // The original controls and source text survive in order.
        expect(frame.document.querySelector('#workingDx').className).toBe('form-control text-danger');
        expect(frame.document.querySelectorAll('#tips li')).toHaveLength(7);
        expect([...frame.document.querySelectorAll('#historyTable th')].map(th => th.textContent)).toEqual(['Origin', 'Code', 'Code Description', 'Origin Description']);
    });

    test('rtnCode appends a clicked code, removes it on a second click, and assigns when the editor is empty', async () => {
        const { dx, codeButton } = await openDialog();
        codeButton('ICD10:SYN.1').click();
        expect(dx()).toBe('ICD10:OLD;ICD10:SYN.1');
        codeButton('ICD10:SYN.1').click();
        expect(dx()).toBe('ICD10:OLD');
        const empty = await openDialog({ targetValue: '' });
        empty.codeButton('ICD10:SYN.4').click();
        expect(empty.dx()).toBe('ICD10:SYN.4');
    });

    test('top Save runs setFormDx: inherited single ;; collapse and edge trim, writes the opener target, closes', async () => {
        const { shell, $, calls, targetElement } = await openDialog();
        $('#workingDx').value = ';;ICD10:A;;ICD10:B;';
        shell.window.document.getElementById('saveDx').click();
        expect(targetElement.value).toBe('ICD10:A;;ICD10:B');
        expect(calls).toMatchObject({ alerts: [], closed: 1, closeArgs: [] });
    });

    test('the trash control runs clearCodes: empties both the opener target and the editor', async () => {
        const { $, dx, targetElement, calls } = await openDialog();
        $('.input-group-prepend button.btn-danger').click();
        expect([targetElement.value, dx(), calls.alerts]).toEqual(['', '', []]);
    });

    test('top Help toggles the tips and Dismiss toggles them back', async () => {
        const { shell, $ } = await openDialog();
        expect($('#tips').classList.contains('d-none')).toBe(true);
        shell.window.document.getElementById('showTips').click();
        expect($('#tips').classList.contains('d-none')).toBe(false);
        $('#tips button.btn-success').click();
        expect($('#tips').classList.contains('d-none')).toBe(true);
    });

    test('without an opener: setCodes, Save and clear alert the original message; the ready handler then fails as before', async () => {
        const { shell, $, calls, errors, frame } = await openDialog({ opener: null });
        expect(calls.alerts).toEqual([ERROR]);
        shell.window.document.getElementById('saveDx').click();
        expect(calls.alerts).toEqual([ERROR, ERROR]);
        expect(calls.closed).toBe(1);
        $('.input-group-prepend button.btn-danger').click();
        expect(calls.alerts).toEqual([ERROR, ERROR, ERROR]);
        // Inherited: the ready handler dereferences opener.targetProcedure, so the spinner stays.
        expect(errors.some(e => /targetProcedure|null/.test(e))).toBe(true);
        expect(frame.document.querySelector('.spinner-border').style.display).not.toBe('none');
        expect(() => frame.rtnCode($('#historyTable button'))).toThrow();
    });
});

// --- Route stylesheet ---------------------------------------------------------------------------

const SCOPE = 'body.oe-code-history.oe-clinical-workspace';
const at = part => `${SCOPE} ${part}`;
const rules = () => {
    const out = [];
    postcss.parse(css()).walkRules(rule => {
        const decls = {};
        rule.walkDecls(d => { decls[d.prop] = `${d.value}${d.important ? ' !important' : ''}`; });
        out.push({ selectors: rule.selectors, decls });
    });
    return out;
};
const declsFor = selector => Object.assign({}, ...rules().filter(r => r.selectors.includes(selector)).map(r => r.decls));
const tokens = () => declsFor(SCOPE);

// Declared-box estimate of the editor row: the frame's 4vw-capped gutters, the framed group's border
// and padding, the trash button (Bootstrap .btn inline padding and border around a 1em glyph
// estimate) and the input (Bootstrap .form-control inline padding and border, and its effective
// declared minimum border-box from this sheet or Bootstrap's input-group rule). Arithmetic over
// declarations only; no native layout is performed.
const MIN_INPUT_TEXT = 40;
const bootstrapDecls = selector => {
    const out = {};
    postcss.parse(fs.readFileSync(require.resolve('bootstrap/dist/css/bootstrap.css'), 'utf8')).walkRules(rule => {
        if (rule.selectors.includes(selector)) rule.walkDecls(d => { out[d.prop] = d.value; });
    });
    return out;
};
const length = (value, basis = NaN) => {
    const m = /^(-?[\d.]+)(px|rem|em|%)?$/.exec(String(value).trim());
    if (!m) return NaN;
    const n = parseFloat(m[1]);
    if (!m[2]) return n === 0 ? 0 : NaN;
    return { px: n, rem: n * 16, em: n * 16, '%': (n * basis) / 100 }[m[2]];
};
const inlinePad = padding => { const parts = padding.trim().split(/\s+/); return length(parts[1] ?? parts[0]); };
const borderWidth = border => length(border.trim().split(/\s+/)[0]);
const editorEstimate = (sheetText, width) => {
    const sheet = {};
    postcss.parse(sheetText).walkRules(rule => rule.walkDecls(d => {
        for (const s of rule.selectors) (sheet[s] ??= {})[d.prop] = d.value;
    }));
    const own = part => sheet[at(part)] ?? {};
    expect(own('.oe-code-history-editor')['padding-inline']).toBe('min(1rem, 4vw)');
    const dx = own('.oe-code-history-dx');
    const editorInner = width - 2 * Math.min(16, 0.04 * width) - 2 * borderWidth(dx.border) - 2 * inlinePad(dx.padding);
    const btn = { ...bootstrapDecls('.btn'), ...own('.oe-code-history-dx .btn') };
    const trash = Math.max(2 * inlinePad(btn.padding) + 2 * borderWidth(btn.border) + length('1em'), length(btn['min-width'] ?? '0'));
    const control = bootstrapDecls('.form-control');
    const grouped = bootstrapDecls('.input-group > .form-control');
    const input = { ...grouped, ...own('.oe-code-history-dx #workingDx') };
    const inputChrome = 2 * inlinePad(control.padding) + 2 * borderWidth(control.border);
    const flex = (input.flex ?? '').trim();
    const inputShrinks = input['flex-shrink'] !== '0' && flex !== 'none' && !/^\S+\s+0(\s|$)/.test(flex);
    let inputMin = length(input['min-width'] ?? 'auto', editorInner);
    if (!inputShrinks) inputMin = Math.max(inputMin, length(input['flex-basis'] ?? input.width ?? 'auto', editorInner));
    inputMin = Math.max(inputMin, inputChrome);
    const inputBox = editorInner - trash;
    const inputText = inputBox - inputChrome;
    const overflow = !(Number.isFinite(inputMin) && inputBox >= inputMin && inputText >= MIN_INPUT_TEXT);
    return { editorInner, trash, inputChrome, inputMin, inputBox, inputText, inputShrinks, overflow };
};

describe('code-history.css', () => {
    test('one @media screen block without width queries, positive-scoped to the route body plus the mode.js marker', () => {
        const tree = postcss.parse(css());
        const top = tree.nodes.filter(node => node.type !== 'comment');
        expect(top).toHaveLength(1);
        const media = [];
        tree.walkAtRules(rule => media.push(`${rule.name} ${rule.params}`));
        expect(media).toEqual(['media screen']);
        expect(rules().length).toBeGreaterThan(10);
        for (const { selectors } of rules()) {
            for (const selector of selectors) {
                expect([selector, selector === SCOPE || selector.startsWith(`${SCOPE} `)]).toEqual([selector, true]);
                // Semantic red/warning, selection, hidden and spinner states are left to the theme.
                expect(selector).not.toMatch(/text-danger|btn-danger|bg-warning|\bmark\b|\.active|:hover|table-hover|d-none|spinner|print|workbench-active|oe-workbench/);
            }
        }
        expect(sha(read('.stylelintrc.json'))).toBe(STYLELINT_RC_BASELINE);
    });

    test('route-local tokens only; every colour pairs ink with a surface at readable contrast', () => {
        const declared = tokens();
        const names = Object.keys(declared).filter(p => p.startsWith('--'));
        expect(names.length).toBeGreaterThanOrEqual(5);
        for (const name of names) expect(name).toMatch(/^--oe-ch-[a-z]+$/);
        for (const used of css().match(/var\(--[a-z-]+\)/g)) expect(names).toContain(used.slice(4, -1));
        const value = v => declared[v.match(/^var\((--oe-ch-[a-z]+)\)$/)[1]];
        const lum = hex => {
            const full = hex.length === 4 ? `#${[...hex.slice(1)].map(c => c + c).join('')}` : hex;
            return [1, 3, 5].map(i => parseInt(full.slice(i, i + 2), 16) / 255)
                .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
                .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
        };
        let pairs = 0;
        for (const { selectors, decls } of rules()) {
            const ink = decls.color;
            const surface = decls['background-color'] ?? decls.background;
            expect([selectors[0], ink === undefined]).toEqual([selectors[0], surface === undefined]);
            if (!ink) continue;
            pairs++;
            const [hi, lo] = [lum(value(ink)), lum(value(surface))].sort((a, b) => b - a);
            expect([selectors[0], (hi + 0.05) / (lo + 0.05) >= 4.5]).toEqual([selectors[0], true]);
        }
        expect(pairs).toBeGreaterThanOrEqual(4);
        for (const { selectors, decls } of rules()) {
            if (selectors[0] === SCOPE) continue;
            for (const v of Object.values(decls)) expect(v).not.toMatch(/#[0-9a-f]{3,8}\b|\b(white|black|red|yellow)\b/i);
        }
        // Cells and rows never set ink, so the original red row/mark/active states still show.
        for (const { selectors, decls } of rules()) {
            if (selectors.some(s => /(td|tr|th)(\s|$|:)|\.btn|#workingDx|\.oe-code-history-tips/.test(s) && !/thead th$/.test(s))) {
                expect([selectors[0], decls.color, decls['background-color'], decls.background]).toEqual([selectors[0], undefined, undefined, undefined]);
            }
        }
    });

    test('typography and visibility are inherited: nothing hidden, re-fonted, forced or repositioned', () => {
        for (const { decls } of rules()) {
            for (const prop of ['font', 'font-family', 'font-size', 'line-height', 'letter-spacing', 'text-transform', 'display', 'visibility', 'position', 'z-index', 'top', 'height', 'max-height', 'transform', 'float', 'order']) {
                expect(decls[prop]).toBeUndefined();
            }
            expect(decls.overflow ?? '').not.toMatch(/hidden|clip/);
            expect(decls['white-space'] ?? 'normal').toBe('normal');
        }
        expect(css()).not.toMatch(/!important|outline:\s*(0|none)|pointer-events|opacity|content:|text-overflow/);
    });

    test('document shape: canvas body, opaque sticky editor band, framed editor, ruled results sheet with contained scroll', () => {
        expect(declsFor(SCOPE)).toMatchObject({ color: 'var(--oe-ch-ink)', 'background-color': 'var(--oe-ch-canvas)' });
        expect(declsFor(at('.oe-code-history-editor'))).toMatchObject({ color: 'var(--oe-ch-ink)', 'background-color': 'var(--oe-ch-canvas)', 'padding-inline': 'min(1rem, 4vw)' });
        expect(declsFor(at('.oe-code-history-dx'))).toMatchObject({ border: '1px solid var(--oe-ch-line)', 'border-radius': expect.any(String), padding: expect.stringMatching(/rem$/) });
        expect(declsFor(at('.oe-code-history-sheet'))).toMatchObject({
            color: 'var(--oe-ch-ink)', 'background-color': 'var(--oe-ch-paper)', border: '1px solid var(--oe-ch-line)',
            width: 'auto', 'margin-inline': 'min(1rem, 4vw)', 'padding-inline': '0',
        });
        expect(declsFor(at('.oe-code-history-results'))).toMatchObject({ 'overflow-x': 'auto' });
        expect(declsFor(at('#historyTable'))).toMatchObject({ 'min-width': '32rem', color: 'var(--oe-ch-ink)', 'background-color': 'var(--oe-ch-paper)' });
        expect(declsFor(at('#historyTable thead th'))).toMatchObject({ color: 'var(--oe-ch-muted)', 'background-color': 'var(--oe-ch-canvas)', 'white-space': 'normal' });
        expect(declsFor(at('#historyTable td'))).toMatchObject({ 'overflow-wrap': 'anywhere' });
        expect(declsFor(at('.oe-code-history-tips .card'))).toMatchObject({ 'border-radius': expect.any(String) });
    });

    test('full-size code labels wrap inside their cell', () => {
        const button = declsFor(at('#historyTable td .btn'));
        expect(button).toMatchObject({ 'white-space': 'normal', 'overflow-wrap': 'anywhere', 'max-width': '100%', 'text-align': 'start' });
        expect(button['font-size']).toBeUndefined();
        expect(button.padding).toBeUndefined();
    });

    test('focus: a :focus fallback rule and a separate :focus-visible rule keep a visible ring on every control', () => {
        const ring = { outline: '2px solid var(--oe-ch-petrol)', 'outline-offset': '2px' };
        for (const control of ['.oe-code-history-dx .btn', '#workingDx', '#historyTable td .btn', '.oe-code-history-tips .btn']) {
            const fallback = rules().find(r => r.selectors.includes(at(`${control}:focus`)));
            const visible = rules().find(r => r.selectors.includes(at(`${control}:focus-visible`)));
            expect([control, fallback?.decls]).toEqual([control, expect.objectContaining(ring)]);
            expect([control, visible?.decls]).toEqual([control, expect.objectContaining(ring)]);
            expect(fallback).not.toBe(visible);
            expect(fallback.selectors.every(s => !s.includes(':focus-visible'))).toBe(true);
        }
    });

    // Declared-box arithmetic at 16px/rem over this sheet plus Bootstrap 4.6 declarations; these are
    // estimates from declarations, NOT native browser geometry.
    test.each([146, 180, 390])('%ipx frame (declared estimate): trash button, input chrome and input minimum fit the editor; table scrolls inside the sheet', width => {
        const estimate = editorEstimate(css(), width);
        expect(estimate.overflow).toBe(false);
        expect(estimate.inputBox).toBeGreaterThanOrEqual(estimate.inputMin);
        expect(estimate.inputText).toBeGreaterThanOrEqual(MIN_INPUT_TEXT);
        expect(estimate.inputShrinks).toBe(true);
        const sheetInner = width - 2 * Math.min(16, 0.04 * width) - 2;
        expect(sheetInner).toBeGreaterThanOrEqual(120);
        // The 32rem table exceeds the sheet, so it scrolls in .oe-code-history-results, not the page.
        expect(32 * 16).toBeGreaterThan(sheetInner);
        expect(declsFor(at('.oe-code-history-results'))['overflow-x']).toBe('auto');
    });

    test('negative mutations: an oversized or intrinsic input minimum makes the declared estimate fail', () => {
        const rule = /(#workingDx \{\s*min-width:) 0;/;
        expect(css()).toMatch(rule);
        const oversized = css().replace(rule, '$1 300px;');
        for (const width of [146, 180, 390]) expect([width, editorEstimate(oversized, width).overflow]).toEqual([width, true]);
        expect(editorEstimate(css().replace(rule, '$1 auto;'), 146).overflow).toBe(true);
        const rigid = css().replace(rule, '$1 0;\n    flex: none;\n    width: 12rem;');
        expect(editorEstimate(rigid, 146).overflow).toBe(true);
    });

    test('jsdom: rules engage only with the route body class AND the mode.js workbench marker', () => {
        const { document } = new JSDOM('').window;
        const selectors = rules().flatMap(r => r.selectors).filter(s => s.endsWith('.oe-code-history-sheet'));
        const matches = bodyClass => {
            document.body.className = bodyClass;
            document.body.innerHTML = '<div class="container-fluid oe-code-history-sheet"></div>';
            return selectors.some(s => document.querySelector('.oe-code-history-sheet').matches(s));
        };
        expect(matches('oe-code-history oe-clinical-workspace')).toBe(true);
        expect(matches('oe-code-history')).toBe(false);
        expect(matches('oe-clinical-workspace')).toBe(false);
        expect(matches('')).toBe(false);
    });

    test('stylelint: the new sheet lints clean under the unchanged repo config', () => {
        const bin = path.join(path.dirname(require.resolve('stylelint/package.json')), 'bin/stylelint.mjs');
        const configBasedir = path.resolve(path.dirname(require.resolve('stylelint-config-standard')), '../..');
        const run = spawnSync(process.execPath, [bin, '--config', path.join(root, '.stylelintrc.json'), '--config-basedir', configBasedir, '--formatter', 'json', path.join(root, SHEET)], { encoding: 'utf8' });
        expect(run.error).toBeUndefined();
        const report = JSON.parse(run.stderr || run.stdout);
        expect(report.flatMap(r => [...r.parseErrors, ...r.invalidOptionWarnings, ...r.warnings.map(w => `${w.rule}: ${w.text}`)])).toEqual([]);
        expect(run.status).toBe(0);
    });
});

// Real mode.js (with the real popup.js discovery) in JSDOM windows wired as dlgopen exposes them.
describe('route sheet follows the real mode.js workbench marker', () => {
    const ORIGIN = 'https://emr.test';
    const makeWindow = (markup, { url = `${ORIGIN}/interface/patient_file/encounter/find_code_history.php`, parent, frameElement, opener } = {}) => {
        const { window } = new JSDOM(markup, { url });
        if (parent) Object.defineProperty(window, 'parent', { configurable: true, get: () => parent });
        if (frameElement) Object.defineProperty(window, 'frameElement', { configurable: true, get: () => frameElement });
        if (opener) window.opener = opener;
        return window;
    };
    const makeShell = () => makeWindow('<body class="workbench-active"><div id="mainBox"><button data-workbench-mode></button></div>'
        + '<div class="modal dialogModal"><iframe class="modalIframe"></iframe></div></body>', { url: `${ORIGIN}/interface/main/tabs/main.php` });
    const route = '<body class="oe-code-history"><div class="container-fluid oe-code-history-sheet"></div></body>';
    const start = win => {
        jest.resetModules();
        return require('../../interface/clinical-workspace/mode.js').createModeController({
            body: win.document.body, parentWindow: win.parent, openerWindow: win.opener, origin: win.location.origin,
            observe: (target, callback) => {
                const observer = new target.ownerDocument.defaultView.MutationObserver(callback);
                observer.observe(target, { attributes: true, attributeFilter: ['class'] });
                return observer;
            },
        });
    };
    const engaged = win => rules().flatMap(r => r.selectors).filter(s => s.endsWith(' .oe-code-history-sheet'))
        .some(s => win.document.querySelector('.oe-code-history-sheet').matches(s));
    const flush = () => new Promise(resolve => setTimeout(resolve, 0));

    test('the dialog frame of an active workbench engages; legacy mode disengages and restores', async () => {
        const shell = makeShell();
        const win = makeWindow(route, { parent: shell, frameElement: shell.document.querySelector('iframe') });
        expect(start(win).active).toBe(true);
        expect(engaged(win)).toBe(true);
        shell.document.body.classList.remove('workbench-active');
        await flush();
        expect(engaged(win)).toBe(false);
        shell.document.body.classList.add('workbench-active');
        await flush();
        expect(engaged(win)).toBe(true);
    });

    test('a standalone window and a non-workbench parent stay legacy; mode.js only toggles the body marker', () => {
        const standalone = makeWindow(route);
        start(standalone);
        expect(engaged(standalone)).toBe(false);
        const legacy = makeWindow('<body class="body_top"></body>');
        const framed = makeWindow(route, { parent: legacy });
        start(framed);
        expect(engaged(framed)).toBe(false);
        const shell = makeShell();
        const win = makeWindow(route, { parent: shell, frameElement: shell.document.querySelector('iframe') });
        const before = win.document.body.innerHTML;
        start(win).dispose();
        expect(win.document.body.innerHTML).toBe(before);
        expect(win.document.body.className).toBe('oe-code-history');
    });
});
