/** @jest-environment node */

// Runs a private JSDOM per scenario so inline handlers execute without loading any resource.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const postcss = require('postcss');
const { JSDOM, VirtualConsole } = require('jsdom');

const root = path.join(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const source = () => read('interface/patient_file/education.php');
const cssFile = 'interface/clinical-workspace/education-popup.css';
const css = () => read(cssFile);
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const count = (text, part) => text.split(part).length - 1;
const scope = 'html.oe-workbench-popup body.oe-education-popup';

// sha256 of education.php at origin/master 18647270, before the workbench presentation edits.
const baselineHash = '013836ec42768c8f817606a79e6863f0ed09d045c16ffc8b3ac8724993e4762a';

// The three callers open the route as a forced window (dlgopen(..., true)); none may change.
const callers = {
    'interface/orders/single_order_results.inc.php': '17b7eb52c209bef3450046eb2aaaea33834bca94713e2ef818e7c0392dff8ce7',
    'interface/patient_file/summary/demographics.php': '00554d54565a92ee3b71a79053ac4f3daf55def3501d3dce6cf284d4615cbd3a',
    'interface/patient_file/summary/stats_full.php': '06be3854bda78f35827ea8e41ab9c35f26ed01147afd83dc2fcb2a1bcdf5e526',
};

const stylesheetLink = '    <?php $clinicalAssets = new ClinicalWorkspaceAssets(); ?>\n'
    + '    <link rel="stylesheet" media="screen" href="<?php echo attr(\\OpenEMR\\Core\\OEGlobalsBag::getInstance()->getWebRoot()); ?>/interface/clinical-workspace/education-popup.css?v=<?php echo attr_url($clinicalAssets->version(\'education-popup.css\')); ?>">\n';

// Every edit is [original, presented]: one import, one screen stylesheet, classes on existing nodes.
const changes = [
    ['use OpenEMR\\BC\\ServiceContainer;\nuse OpenEMR\\Common\\Csrf\\CsrfUtils;', 'use OpenEMR\\BC\\ServiceContainer;\nuse OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;\nuse OpenEMR\\Common\\Csrf\\CsrfUtils;'],
    ['    <?php Header::setupHeader(); ?>\n', '    <?php Header::setupHeader(); ?>\n' + stylesheetLink],
    ['<body>\n    <div class="container mt-3">\n        <div class="row">\n            <div class="col-12">\n                <h3>', '<body class="oe-education-popup">\n    <div class="container mt-3 oe-education-sheet">\n        <div class="row oe-education-head">\n            <div class="col-12">\n                <h3 class="oe-education-title">'],
    ["        <div class='row'>\n            <div class='col-12'>\n                <form method='post'", "        <div class='row oe-education-body'>\n            <div class='col-12'>\n                <form method='post'"],
    ["                    <div class='form-group'>\n                        <label for=\"source\">", "                    <div class='form-group oe-education-source'>\n                        <label for=\"source\">"],
    ["                    <div class='form-group'>\n                        <div class='btn-group' role='group'>", "                    <div class='form-group oe-education-actions'>\n                        <div class='btn-group oe-education-buttons' role='group'>"],
];

// Undo the presentation edits; throws when any edit is missing or ambiguous.
function restore(text) {
    let restored = text;
    for (const [before, after] of changes) {
        if (count(restored, after) !== 1) throw new Error(`Expected exactly one presentation edit: ${after}`);
        restored = restored.replace(after, () => before);
    }
    return restored;
}

describe('route bytes', () => {
    test('only the declared presentation edits restore the exact 168-line original route', () => {
        const restored = restore(source());
        expect(restored.split('\n').length - 1).toBe(168);
        expect(sha(restored)).toBe(baselineHash);
    });

    test('the inverse digest rejects business, wording, session and close mutations', () => {
        const restored = restore(source());
        const mutations = [
            ["<option value='MLP'>", "<option value='Local' selected>"],
            ["<option value='Local'>", "<option value='LOCAL'>"],
            ["name='source' id='source'", "name='src' id='source'"],
            ["onsubmit='return top.restoreSession()'", "onsubmit='return true'"],
            ["onclick='window.close()'", "onclick='history.back()'"],
            ["name='bn_submit' value='bn_submit'", "name='bn_submit' value='1'"],
            ['name="csrf_token_form"', 'name="csrf_token"'],
            ['CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: true);', ''],
            ["'https://connect.medlineplus.gov/application'", "'https://example.invalid/application'"],
            ["$url .= '&informationRecipient.languageCode.c=es';", "$url .= '&informationRecipient.languageCode.c=en';"],
            ['header("Content-Type: application/pdf");', 'header("Content-Type: application/octet-stream");'],
            ['$fileData = $cryptoGen->decryptFromFilesystem($fileData);', ''],
            ["xl('There is no local content for this topic.')", "xl('No local content.')"],
            ["xlt('Select source')", "xlt('Choose source')"],
            ["<p class='text-danger'>", "<p class='text-muted'>"],
            ["action='education.php'", "action='education.php?x=1'"],
        ];
        for (const [before, after] of mutations) {
            expect(count(restored, before)).toBe(1);
            expect(sha(restored.replace(before, () => after))).not.toBe(baselineHash);
        }
    });

    test('a removed or duplicated presentation edit cannot pass the inverse', () => {
        const php = source();
        for (const [, after] of changes) {
            expect(() => restore(php.replace(after, () => ''))).toThrow();
            expect(() => restore(php.replace(after, () => after + after))).toThrow();
        }
    });

    test('all three forced-window callers are byte-identical', () => {
        for (const [file, hash] of Object.entries(callers)) {
            const php = read(file);
            expect(sha(php)).toBe(hash);
            expect(php).toMatch(/education\.php[\s\S]{0,260}'_blank', 1024, 750, ?true\)/);
        }
    });

    test('route links its helper-versioned screen sheet and the helper supports it', () => {
        expect(count(source(), 'education-popup.css')).toBe(2);
        expect(source()).toContain(stylesheetLink);
        const helper = read('src/Common/Assets/ClinicalWorkspaceAssets.php');
        const supported = [...helper.match(/SUPPORTED = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
        expect(supported).toContain('education-popup.css');
        expect(supported).toEqual([...supported].sort());
    });
});

// Minimal stand-in for the markup's PHP blocks; an unexpected block fails loudly.
function renderMarkup(php, scenario) {
    const start = php.indexOf('\n?>\n<html>');
    expect(start).toBeGreaterThan(0);
    const markup = php.slice(start + 4);
    const attrs = { codetype: scenario.type, codevalue: scenario.code, language: scenario.language };
    return markup.replace(/<\?php([\s\S]*?)\?>/g, (block, body) => {
        const code = body.trim();
        let m;
        if ((m = code.match(/^echo xlt\('([^']*)'\);$/))) return m[1];
        if ((m = code.match(/^echo attr\(\$(\w+)\);$/))) return attrs[m[1]];
        if (code === 'Header::setupHeader();' || code === '$clinicalAssets = new ClinicalWorkspaceAssets();') return '';
        if (code === 'echo attr(\\OpenEMR\\Core\\OEGlobalsBag::getInstance()->getWebRoot());') return '/openemr';
        if (code === "echo attr_url($clinicalAssets->version('education-popup.css'));") return '1700000000';
        if (code === 'echo CsrfUtils::collectCsrfToken(session: $session);') return 'csrf-fixture';
        if (code.startsWith("echo xlt('Educational materials for');")) {
            let text = `Educational materials for ${scenario.type} code "${scenario.code}"`;
            if (scenario.language) text += ` with preferred language ${scenario.languageTitle}`;
            return text;
        }
        if (code.startsWith('if ($errmsg) {')) {
            return scenario.errmsg ? `<p class='text-danger'>${scenario.errmsg}</p>\n` : '';
        }
        throw new Error(`Unexpected PHP block: ${code}`);
    });
}

const fixture = { type: 'ICD10', code: 'E11.9', language: 'es', languageTitle: 'Spanish', errmsg: 'There is no local content for this topic.' };

function load(php, scenario = fixture) {
    const errors = [];
    const virtualConsole = new VirtualConsole();
    virtualConsole.on('jsdomError', error => errors.push(error));
    const dom = new JSDOM(renderMarkup(php, scenario), {
        url: 'https://openemr.test/openemr/interface/patient_file/education.php',
        runScripts: 'dangerously',
        virtualConsole,
    });
    return { dom, doc: dom.window.document, errors };
}

function normalised(doc) {
    doc.querySelectorAll('link[href*="education-popup.css"]').forEach(link => link.remove());
    doc.querySelectorAll('[class]').forEach(node => {
        const kept = [...node.classList].filter(name => !name.startsWith('oe-education-'));
        if (kept.length) node.setAttribute('class', kept.join(' ')); else node.removeAttribute('class');
    });
    const walker = doc.createTreeWalker(doc.documentElement, 4);
    const blank = [];
    while (walker.nextNode()) if (!walker.currentNode.nodeValue.trim()) blank.push(walker.currentNode);
    blank.forEach(node => node.remove());
    return doc.documentElement.outerHTML;
}

describe('original controls in the rendered chooser', () => {
    test('rendered DOM equals the original apart from the stylesheet link and oe-education classes', () => {
        const current = load(source()).doc;
        const original = load(restore(source())).doc;
        expect(original.querySelector('[class*="oe-education-"]')).toBeNull();
        expect(normalised(current)).toBe(normalised(original));
    });

    test('presentation classes sit on the existing nodes', () => {
        const { doc } = load(source());
        expect(doc.body.className).toBe('oe-education-popup');
        expect(doc.querySelector('.container.mt-3.oe-education-sheet > .row.oe-education-head > .col-12 > h3.oe-education-title')).not.toBeNull();
        expect(doc.querySelector('.oe-education-sheet > .row.oe-education-body > .col-12 > form')).not.toBeNull();
        expect(doc.querySelector('.form-group.oe-education-source > select#source')).not.toBeNull();
        expect(doc.querySelectorAll('.form-group.oe-education-actions > .btn-group.oe-education-buttons[role="group"] > button')).toHaveLength(2);
        const link = doc.querySelector('head link[rel="stylesheet"]');
        expect(link.getAttribute('media')).toBe('screen');
        expect(link.getAttribute('href')).toBe('/openemr/interface/clinical-workspace/education-popup.css?v=1700000000');
    });

    test('wording, hidden fields, source options and default are unchanged', () => {
        const { doc } = load(source());
        expect(doc.title).toBe('Education');
        expect(doc.querySelector('h3').textContent.replace(/\s+/g, ' ').trim()).toBe('Educational materials for ICD10 code "E11.9" with preferred language Spanish');
        const error = doc.querySelector('p.text-danger');
        expect(error.className).toBe('text-danger');
        expect(error.textContent).toBe('There is no local content for this topic.');
        const form = doc.querySelector('form');
        expect(form.getAttribute('method')).toBe('post');
        expect(form.getAttribute('action')).toBe('education.php');
        expect([...form.querySelectorAll('input[type="hidden"]')].map(i => [i.name, i.value])).toEqual([
            ['csrf_token_form', 'csrf-fixture'], ['type', 'ICD10'], ['code', 'E11.9'], ['language', 'es'],
        ]);
        expect(doc.querySelector('label[for="source"]').textContent).toBe('Select source');
        const select = doc.getElementById('source');
        expect(select.name).toBe('source');
        expect(select.className).toBe('form-control');
        expect([...select.options].map(o => [o.value, o.textContent])).toEqual([['MLP', 'MedlinePlus Connect'], ['Local', 'Local Content']]);
        expect(select.value).toBe('MLP');
        const [submit, cancel] = doc.querySelectorAll('.btn-group button');
        expect([submit.type, submit.className, submit.name, submit.value, submit.textContent.trim()]).toEqual(['submit', 'btn btn-primary btn-search', 'bn_submit', 'bn_submit', 'Submit']);
        expect([cancel.type, cancel.className, cancel.textContent.trim(), cancel.getAttribute('onclick')]).toEqual(['button', 'btn btn-secondary btn-cancel', 'Cancel', 'window.close()']);
    });

    test('heading omits the language clause and error when neither applies', () => {
        const { doc } = load(source(), { type: 'LOINC', code: '2345-7', language: '', errmsg: '' });
        expect(doc.querySelector('h3').textContent.replace(/\s+/g, ' ').trim()).toBe('Educational materials for LOINC code "2345-7"');
        expect(doc.querySelector('.text-danger')).toBeNull();
    });

    test('submit runs top.restoreSession with the original payload and never navigates', () => {
        const { dom, doc, errors } = load(source());
        const restoreSession = jest.fn(() => false);
        dom.window.restoreSession = restoreSession;
        expect(dom.window.top).toBe(dom.window);
        const form = doc.querySelector('form');
        const submit = doc.querySelector('button[name="bn_submit"]');
        doc.getElementById('source').value = 'Local';
        const payload = [...new dom.window.FormData(form, submit).entries()];
        expect(payload).toEqual([
            ['csrf_token_form', 'csrf-fixture'], ['type', 'ICD10'], ['code', 'E11.9'], ['language', 'es'],
            ['source', 'Local'], ['bn_submit', 'bn_submit'],
        ]);
        form.requestSubmit(submit);
        expect(restoreSession).toHaveBeenCalledTimes(1);
        expect(errors).toEqual([]);
        expect(dom.window.location.href).toBe('https://openemr.test/openemr/interface/patient_file/education.php');
    });

    test('Cancel closes the window without submitting', () => {
        const { dom, doc, errors } = load(source());
        const restoreSession = jest.fn(() => false);
        const close = jest.fn();
        dom.window.restoreSession = restoreSession;
        dom.window.close = close;
        doc.querySelector('.btn-cancel').click();
        expect(close).toHaveBeenCalledTimes(1);
        expect(restoreSession).not.toHaveBeenCalled();
        expect(errors).toEqual([]);
    });
});

function rules() {
    const list = [];
    postcss.parse(css()).walkRules(rule => {
        const declarations = {};
        rule.walkDecls(decl => { declarations[decl.prop] = decl.value + (decl.important ? ' !important' : ''); });
        list.push({ selectors: rule.selectors, declarations });
    });
    return list;
}
const declaring = predicate => rules().filter(rule => rule.selectors.some(predicate));
const paired = rule => 'color' in rule.declarations && 'background-color' in rule.declarations;

describe('route stylesheet', () => {
    test('one screen block, every selector scoped to the workbench popup and this route', () => {
        const tree = postcss.parse(css());
        const atRules = [];
        tree.walkAtRules(rule => atRules.push(`${rule.name} ${rule.params}`));
        expect(atRules).toEqual(['media screen']);
        expect(tree.nodes.filter(node => node.type !== 'comment')).toHaveLength(1);
        const all = rules();
        expect(all.length).toBeGreaterThan(0);
        for (const rule of all) {
            for (const selector of rule.selectors) expect(selector).toMatch(/^html\.oe-workbench-popup body\.oe-education-popup(?=[ :.]|$)/);
        }
    });

    test('no fonts, hidden controls, clipping, overflow suppression or !important', () => {
        for (const rule of rules()) {
            for (const [prop, value] of Object.entries(rule.declarations)) {
                expect(prop).not.toMatch(/^(font-family|overflow|overflow-x|overflow-y|max-height|visibility|clip|clip-path)$/);
                if (prop === 'display') expect(value).not.toBe('none');
                if (prop === 'height') expect(value).toBe('auto');
                expect(value).not.toMatch(/!important/);
            }
        }
    });

    test('native theme and user typography: no font size, family or shorthand anywhere', () => {
        const fonts = [];
        for (const rule of rules()) {
            for (const prop of Object.keys(rule.declarations)) {
                if (/^font(-size|-family)?$/.test(prop)) fonts.push(`${rule.selectors.join(', ')} { ${prop} }`);
            }
        }
        expect(fonts).toEqual([]);
    });

    test('semantic text-danger error keeps its own colour', () => {
        expect(css()).not.toMatch(/text-danger/);
    });

    test('heading, select, primary and cancel pair ink with paper in every state', () => {
        const title = declaring(s => s.endsWith('.oe-education-title'));
        expect(title.some(paired)).toBe(true);
        for (const state of ['', ':focus', ':focus-visible']) {
            expect(declaring(s => s.endsWith(`.oe-education-source .form-control${state}`)).some(paired)).toBe(true);
        }
        expect(declaring(s => s.endsWith('.oe-education-source .form-control option')).some(paired)).toBe(true);
        for (const button of ['.btn-primary', '.btn-secondary']) {
            for (const state of ['', ':hover', ':focus', ':active']) {
                const matching = declaring(s => s.endsWith(`.oe-education-buttons > ${button}${state}`));
                expect(matching.length).toBeGreaterThan(0);
                expect(matching.every(rule => paired(rule) && 'border-color' in rule.declarations)).toBe(true);
            }
        }
    });

    test(':focus fallback and :focus-visible ring are separate rules', () => {
        for (const target of ['.oe-education-source .form-control', '.oe-education-buttons > .btn']) {
            const focus = declaring(s => s.endsWith(`${target}:focus`));
            const visible = declaring(s => s.endsWith(`${target}:focus-visible`));
            expect(focus.some(rule => /solid/.test(rule.declarations.outline))).toBe(true);
            expect(visible.some(rule => /solid/.test(rule.declarations.outline))).toBe(true);
            for (const rule of [...focus, ...visible]) {
                expect(rule.selectors.some(s => s.endsWith(':focus')) && rule.selectors.some(s => s.endsWith(':focus-visible'))).toBe(false);
            }
        }
    });

    test('actions wrap and row gutters fit narrow inner windows without shrinking text', () => {
        const group = declaring(s => s.endsWith('.oe-education-buttons'));
        expect(group.some(rule => rule.declarations.display === 'flex' && rule.declarations['flex-wrap'] === 'wrap' && rule.declarations.gap)).toBe(true);
        const buttons = declaring(s => s.endsWith('.oe-education-buttons > .btn'));
        expect(buttons.some(rule => rule.declarations['white-space'] === 'normal' && rule.declarations['margin-left'] === '0')).toBe(true);
        const rows = declaring(s => s.endsWith('.oe-education-sheet > .row'));
        expect(rows.some(rule => rule.declarations['margin-left'] === '0' && rule.declarations['margin-right'] === '0')).toBe(true);
        for (const rule of rules()) {
            for (const prop of ['min-width', 'width']) {
                if (prop in rule.declarations) expect(rule.declarations[prop]).not.toMatch(/\d+(px|rem|em)/);
            }
        }
    });
});
