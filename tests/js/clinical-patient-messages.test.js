/**
 * @jest-environment jsdom
 */
/* global __dirname */

const fs = require('fs');
const path = require('path');
const postcss = require('postcss');
const { createModeController } = require('../../interface/clinical-workspace/mode.js');

const root = path.join(__dirname, '../..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const listSource = () => read('interface/patient_file/summary/pnotes_full.php');
const composeSource = () => read('interface/patient_file/summary/pnotes_full_add.php');
const cssPath = 'interface/clinical-workspace/patient-messages.css';
const css = () => read(cssPath);
const listScope = 'body.oe-clinical-workspace.oe-clinical-messages';
const composeScope = 'body.oe-clinical-workspace.oe-clinical-message-compose';
const count = (haystack, needle) => haystack.split(needle).length - 1;

function rules() {
    const found = [];
    postcss.parse(css()).walkRules((rule) => {
        const declarations = {};
        rule.walkDecls((decl) => { declarations[decl.prop] = decl.value; });
        found.push({ rule, selectors: rule.selectors, declarations });
    });
    return found;
}

function expectWorkbenchAssets(php) {
    expect(php).toContain('use OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;');
    expect(php).toContain('$clinicalAssets = new ClinicalWorkspaceAssets();');
    const lines = php.split('\n');
    const lineFor = (asset) => lines.find((line) => line.includes(`/interface/clinical-workspace/${asset}?v=`));
    for (const asset of ['workspace.css', 'patient-messages.css', 'mode.js']) {
        const line = lineFor(asset);
        expect(line).toBeDefined();
        expect(line).toContain('attr(OEGlobalsBag::getInstance()->getWebRoot())');
        expect(line).toContain(`attr_url($clinicalAssets->version('${asset}'))`);
        expect(line).not.toMatch(/filemtime|__DIR__/);
    }
    // workspace.css is not media-scoped internally, so the link keeps it off print.
    expect(lineFor('workspace.css')).toMatch(/<link rel="stylesheet" media="screen" href=/);
    expect(lineFor('patient-messages.css')).toMatch(/<link rel="stylesheet" href=/);
    expect(lineFor('mode.js')).toMatch(/<script src=.*" defer><\/script>/);
    // Shared tokens load before the page sheet; the presentation switch loads last.
    const order = ['workspace.css', 'patient-messages.css', 'mode.js'].map((asset) => lines.indexOf(lineFor(asset)));
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    // Presentation only: no new production script, and no writing-assistance attributes.
    expect(php).not.toMatch(/patient-messages\.js/);
    expect(php).not.toMatch(/autocorrect|spellcheck|autocapitalize|data-ai|aria-live/i);
}

describe('patient messages list (pnotes_full.php)', () => {
    test('loads escaped, per-file versioned workbench assets and scopes the body', () => {
        const php = listSource();
        expectWorkbenchAssets(php);
        expect(php).toContain('<body class="oe-clinical-messages">');
        expect(count(php, '<body')).toBe(1);
        // The existing head setup is still the first asset call.
        expect(php.indexOf("Header::setupHeader(['common', 'opener']);")).toBeLessThan(php.indexOf('$clinicalAssets = new'));
    });

    test('keeps every existing control, gate, handler and link exactly as often as before', () => {
        const php = listSource();
        // Counts recorded from ba11545 (the base of this slice).
        const original = {
            'csrf_token_form': 4,
            'checkCsrfInput(': 1,
            'aclCheckCore(': 4,
            'squad': 6,
            'top.restoreSession()': 26,
            'note_modal': 6,
            'deletenote': 3,
            'change_activity': 2,
            "name='chk": 2,
            "name='lnk": 2,
            "name='act": 2,
            'id="new_note"': 1,
            "id='update_activity'": 1,
            'dlgopen(': 1,
            'show_div': 1,
            'refreshme': 1,
            'outbox_div table-resonsive': 1,
            'text-danger': 1,
            'get_patient_balance(': 1,
            'setGpRelation(': 4,
            'isGpRelation(': 4,
            'pnotes_full_add.php?': 5,
            'demographics.php': 2,
            'Update Active': 1,
            'form_doc_only': 17,
            'offset_sent': 15,
            'table-responsive': 2,
            'window.open(': 2,
            'setPatient(': 1,
        };
        for (const [token, expected] of Object.entries(original)) {
            expect([token, count(php, token)]).toEqual([token, expected]);
        }
        expect(php).toMatch(/^<!DOCTYPE html>$/m);
    });
});

describe('patient message compose dialog (pnotes_full_add.php)', () => {
    test('loads escaped, per-file versioned workbench assets and scopes the body', () => {
        const php = composeSource();
        expectWorkbenchAssets(php);
        expect(php).toContain('<body class="oe-clinical-message-compose">');
        expect(count(php, '<body')).toBe(1);
        expect(php.indexOf("Header::setupHeader(['common', 'datetime-picker', 'opener']);")).toBeLessThan(php.indexOf('$clinicalAssets = new'));
        // The legacy dialog has no doctype; adding one would change its legacy layout mode.
        expect(php).not.toMatch(/<!DOCTYPE/i);
    });

    test('keeps the compose form, recipients, status, save paths and dialog plumbing unchanged', () => {
        const php = composeSource();
        const original = {
            'csrf_token_form': 2,
            'checkCsrfInput(': 1,
            'aclCheckCore(': 2,
            'squad': 6,
            'top.restoreSession()': 8,
            'id="new_note"': 1,
            "id='update_activity'": 1,
            "<textarea name='note' id='note' class='form-control' rows='4' cols='58'></textarea>": 1,
            "id='assigned_to'": 1,
            'Mark Message as Completed': 1,
            '#newnote': 1,
            '#appendnote': 1,
            '#printnote': 1,
            '#cancel': 1,
            'dlgclose(': 2,
            '$.ajax(': 1,
            'datetimepicker': 6,
            'messages_due_date': 1,
            'pnotes_print.php': 1,
            'generate_form_field(': 2,
            'setGpRelation(': 4,
            'form_doc_only': 9,
            'window.open(': 2,
        };
        for (const [token, expected] of Object.entries(original)) {
            expect([token, count(php, token)]).toEqual([token, expected]);
        }
    });
});

describe('patient-messages.css contract', () => {
    test('every rule is screen-only and scoped to an active workbench page', () => {
        const parsed = postcss.parse(css());
        const found = rules();
        expect(found.length).toBeGreaterThan(15);
        for (const { rule, selectors } of found) {
            expect(rule.parent.type).toBe('atrule');
            expect(rule.parent.name).toBe('media');
            expect(rule.parent.params).toBe('screen');
            for (const selector of selectors) {
                expect(selector.startsWith(`${listScope} `) || selector === listScope ||
                    selector.startsWith(`${composeScope} `) || selector === composeScope).toBe(true);
            }
        }
        parsed.walkAtRules((atRule) => {
            expect(atRule.name).toBe('media');
            expect(atRule.params).toBe('screen');
        });
        expect(css()).not.toMatch(/@media print|@import/);
    });

    test('styles the real list and compose controls', () => {
        const selectors = rules().flatMap(({ selectors: list }) => list);
        const listTargets = ['#pnotes', 'h3', '.btn-group', '.tabContainer', '#inbox_div', 'th', 'td', '.noterow', '.billing', '.btn-sm', "[id^='outbox_div']"];
        const composeTargets = ['#pnotes', '.title', '.btn-group', 'label', '.form-control', '#note', '.text'];
        for (const target of listTargets) {
            expect([target, selectors.some((s) => s.startsWith(listScope) && s.includes(target))]).toEqual([target, true]);
        }
        for (const target of composeTargets) {
            expect([target, selectors.some((s) => s.startsWith(composeScope) && s.includes(target))]).toEqual([target, true]);
        }
    });

    test('uses the reference Arial 14px rhythm and existing workspace tokens', () => {
        for (const scope of [listScope, composeScope]) {
            const body = rules().find(({ selectors }) => selectors.includes(scope));
            expect(body).toBeDefined();
            expect(body.declarations['font-family']).toBe('Arial, Helvetica, sans-serif');
            expect(body.declarations['font-size']).toBe('14px');
            expect(body.declarations['line-height']).toBe('1.5');
        }
        expect(css()).toMatch(/var\(--oe-petrol, #086878\)/);
        expect(css()).toMatch(/var\(--oe-line, #d9e4e2\)/);
        expect(css()).toMatch(/var\(--oe-ink, #17343b\)/);
        // Only workspace tokens or the reference's neutral literals; no new brand hues.
        const hex = new Set(css().match(/#[0-9a-f]{3,6}\b/gi).map((h) => h.toLowerCase()));
        const allowed = ['#086878', '#d9e4e2', '#17343b', '#526a70', '#fff', '#f3f7f5', '#f6f8f9', '#e1e8eb', '#f0f5f6', '#e4f0f1', '#fff3d9', '#79531d', '#a9bbc3', '#dce4e7', '#fbfdfe'];
        for (const value of hex) expect([value, allowed.includes(value)]).toEqual([value, true]);
    });

    test('toolbars wrap and tables scroll inside their existing containers without hiding anything', () => {
        const found = rules();
        const declsFor = (scope, fragment) => found.filter(({ selectors }) => selectors.some((s) => s.startsWith(scope) && s.endsWith(fragment)));
        const listToolbar = declsFor(listScope, '.btn-group');
        const composeToolbar = declsFor(composeScope, '.btn-group');
        for (const toolbar of [listToolbar, composeToolbar]) {
            expect(toolbar.some(({ declarations }) => declarations.display === 'flex' && declarations['flex-wrap'] === 'wrap')).toBe(true);
        }
        // The original page never closes its first .row, so .tabContainer is a flex item there;
        // without these bounds the table min-width would widen the whole page instead of #inbox_div.
        const sheet = declsFor(listScope, '.tabContainer');
        expect(sheet.some(({ declarations }) => declarations.flex === '0 0 100%' && declarations['max-width'] === '100%' && declarations['min-width'] === '0')).toBe(true);
        const inbox = declsFor(listScope, '#inbox_div');
        expect(inbox.some(({ declarations }) => declarations['overflow-x'] === 'auto' && declarations['max-width'] === '100%')).toBe(true);
        const outbox = declsFor(listScope, "[id^='outbox_div']");
        expect(outbox.some(({ declarations }) => declarations['overflow-x'] === 'auto')).toBe(true);
        // The outbox visibility is owned by its inline style; never override display there.
        for (const { declarations } of outbox) expect(declarations.display).toBeUndefined();
        const tables = found.filter(({ selectors }) => selectors.some((s) => /#inbox_div table|outbox_div'\] table/.test(s)));
        expect(tables.some(({ declarations }) => /^\d+(px|rem)$/.test(declarations['min-width'] || ''))).toBe(true);

        expect(css()).not.toMatch(/display:\s*none|visibility:\s*hidden|opacity:\s*0[;\s]/);
        expect(css()).not.toMatch(/!important/);
        expect(css()).not.toMatch(/\bcontent:/);
        for (const { selectors, declarations } of found) {
            const onBody = selectors.some((s) => s === listScope || s === composeScope);
            if (onBody) {
                expect(declarations.overflow).toBeUndefined();
                expect(declarations['overflow-x']).toBeUndefined();
            }
        }
    });

    test('compose textarea reads as a document field and keeps native resize', () => {
        const note = rules().filter(({ selectors }) => selectors.some((s) => s.startsWith(composeScope) && /#note(?![\w-])/.test(s)));
        expect(note.length).toBeGreaterThan(0);
        const merged = Object.assign({}, ...note.filter(({ selectors }) => !selectors.some((s) => s.includes(':'))).map(({ declarations }) => declarations));
        expect(merged['border-bottom']).toMatch(/1px solid/);
        expect(merged['border-radius']).toBe('0');
        expect(merged['min-height']).toBe('104px');
        expect(merged.width).toBe('100%');
        expect(note.some(({ selectors }) => selectors.some((s) => s.endsWith('#note:focus')))).toBe(true);
        expect(css()).not.toMatch(/\bresize:/);
        // Focus stays visible: never remove the outline the workspace sets.
        expect(css()).not.toMatch(/outline:\s*(0|none)/);
    });

    test('billing balance/note keeps the theme warning text colour', () => {
        for (const { selectors, declarations } of rules()) {
            for (const selector of selectors) {
                expect(selector).not.toMatch(/text-danger|deletenote|btn-delete/);
                // The cell itself carries ink (a balance with no billing note has no text-danger span);
                // nothing targets .text-danger, so the theme's danger colour still wins on its spans.
                if (selector.includes('.billing')) expect(declarations.color).toBe('var(--oe-ink, #17343b)');
                // workspace.css colours every link petrol; the only btn-danger rule restores the theme's text colour.
                // Literal: the dark theme maps --white to #000 but keeps .btn-danger text #fff.
                if (selector.includes('btn-danger')) expect(declarations).toEqual({ color: '#fff' });
            }
        }
        const restore = rules().find(({ selectors }) => selectors.includes(`${listScope} #pnotes a.btn-danger`));
        expect(restore).toBeDefined();
        const billing = rules().filter(({ selectors }) => selectors.some((s) => s.includes('.billing')));
        // Paper behind the danger text keeps the theme's own text-danger contrast (a warm tint lowered it to 4.1:1).
        expect(billing.some(({ declarations }) => declarations.background === 'var(--oe-paper, #fff)' && declarations['border-left'] === '4px solid #79531d')).toBe(true);
        expect(css()).not.toMatch(/#fff3d9/);
    });
});

describe('compose dialog resized after open (dialog.js keeps the open-time percentage)', () => {
    // A dialog opened at 1440px and resized to 390/320px leaves a 180/146px iframe; the original
    // unstyled page fits every control there, so the workbench sheet must too.
    const frameWidths = [146, 180];
    const px = (value, frame) => {
        const clamp = /^clamp\(\s*([\d.]+)px\s*,\s*([\d.]+)vw\s*,\s*([\d.]+)px\s*\)$/.exec(value);
        if (clamp) {
            return Math.min(Math.max(Number(clamp[1]), (Number(clamp[2]) * frame) / 100), Number(clamp[3]));
        }
        const plain = /^([\d.]+)px$/.exec(value);
        expect([value, plain !== null]).toEqual([value, true]);
        return Number(plain[1]);
    };
    const inline = (shorthand) => {
        const parts = shorthand.match(/clamp\([^)]*\)|\S+/g);
        return parts.length > 1 ? parts[1] : parts[0];
    };
    // Every rule listing the selector, merged in source order (later declarations win, as in the cascade).
    const find = (selector) => {
        const matching = rules().filter(({ selectors }) => selectors.includes(selector));
        expect([selector, matching.length > 0]).toEqual([selector, true]);
        return Object.assign({}, ...matching.map(({ declarations }) => declarations));
    };

    test('the sheet chrome leaves room for the longest original action word at 146px and 180px', () => {
        const container = find(`${composeScope} .container`);
        const sheet = find(`${composeScope} #pnotes`);
        const border = Number(/^(\d+)px/.exec(sheet.border)[1]);
        for (const frame of frameWidths) {
            const chrome = 2 * px(container['padding-inline'], frame) + 2 * px(inline(sheet.padding), frame) + 2 * border;
            // 110px fits "Printable"/"Message" at the 14px/600 button weight plus the button padding.
            expect([frame, frame - chrome >= 110]).toEqual([frame, true]);
        }
    });

    test('original action buttons wrap their labels inside the sheet instead of overflowing it', () => {
        const buttons = find(`${composeScope} #pnotes .btn-group > .btn`);
        // Shrinkable flex items with wrapping labels; the 14px label size itself is kept.
        expect(buttons.flex).not.toMatch(/^\d+ 0 /);
        expect(buttons['min-width']).toBe('0');
        expect(buttons['max-width']).toBe('100%');
        expect(buttons['white-space']).toBe('normal');
        expect(buttons['font-size']).toBe('14px');
        const group = find(`${composeScope} #pnotes .btn-group`);
        expect(group['max-width']).toBe('100%');
        expect(group['flex-wrap']).toBe('wrap');
        // Nothing is hidden, clipped or scaled down to make it fit.
        for (const { selectors, declarations } of rules().filter(({ selectors }) => selectors.some((s) => s.startsWith(composeScope)))) {
            expect([selectors.join(), declarations.overflow, declarations['overflow-x']]).toEqual([selectors.join(), undefined, undefined]);
            expect([selectors.join(), declarations.transform, declarations.zoom]).toEqual([selectors.join(), undefined, undefined]);
        }
        expect(css()).not.toMatch(/@media[^{]*(max|min)-width/);
    });
});

describe('surfaces pair their own foreground and background (dark theme cascade)', () => {
    const ink = 'var(--oe-ink, #17343b)';
    const paper = 'var(--oe-paper, #fff)';
    const find = (selector) => rules().find(({ selectors }) => selectors.includes(selector));

    test('message sheet, tables and cells set ink against the white sheet', () => {
        const sheet = find(`${listScope} #pnotes .tabContainer`);
        expect(sheet.declarations.color).toBe(ink);
        expect(sheet.declarations.background).toBe(paper);
        const table = find(`${listScope} #pnotes .tabContainer .table`);
        expect(table).toBeDefined();
        expect(table.declarations.color).toBe(ink);
        expect(table.declarations['background-color']).toBe('transparent');
        expect(find(`${listScope} #pnotes .tabContainer td`).declarations.color).toBe(ink);
        // Paper behind the billing cell must pair with ink: PHP omits the text-danger spans when the billing note is empty.
        expect(find(`${listScope} #pnotes .table-responsive .billing td`).declarations.color).toBe(ink);
    });

    test('compose fields pair ink on paper, including focus', () => {
        for (const selector of [`${composeScope} #pnotes .form-control`, `${composeScope} #pnotes .form-control:focus`]) {
            const rule = find(selector);
            expect([selector, rule && rule.declarations.color]).toEqual([selector, ink]);
            expect([selector, rule.declarations['background-color']]).toEqual([selector, paper]);
        }
        const sheet = find(`${composeScope} #pnotes`);
        expect(sheet.declarations.color).toBe(ink);
        expect(sheet.declarations.background).toBe(paper);
    });

    test('list gutters absorb the legacy nested .row so the page does not scroll sideways', () => {
        expect(find(`${listScope} #pnotes`).declarations['padding-inline']).toBe('clamp(15px, 2vw, 28px)');
        expect(find(`${listScope} #pnotes .row > .row`).declarations['margin-inline']).toBe('0');
    });
});

describe('workbench mode controller on the messages routes', () => {
    const origin = () => window.location.origin;
    const frame = (body, parent) => {
        const win = { location: { origin: origin() }, document: { body } };
        win.parent = parent || win;
        return win;
    };

    test('list page inside a tab frame follows the workbench body two levels up', async () => {
        document.body.className = 'oe-clinical-messages';
        const topBody = document.createElement('body');
        topBody.className = 'workbench-active';
        const top = frame(topBody);
        const tab = frame(document.createElement('body'), top);
        let observer;
        const controller = createModeController({
            body: document.body,
            parentWindow: tab,
            origin: origin(),
            observe: (target, callback) => {
                observer = new MutationObserver(callback);
                observer.observe(target, { attributes: true, attributeFilter: ['class'] });
                return observer;
            }
        });
        expect(document.body.className).toBe('oe-clinical-messages oe-clinical-workspace');
        topBody.classList.remove('workbench-active');
        await Promise.resolve();
        expect(document.body.className).toBe('oe-clinical-messages');
        topBody.classList.add('workbench-active');
        await Promise.resolve();
        expect(document.body.classList.contains('oe-clinical-workspace')).toBe(true);
        controller.dispose();
        expect(document.body.className).toBe('oe-clinical-messages');
    });

    test('compose dialog mounted in top follows the top workbench body and leaves the form untouched', () => {
        document.body.className = 'oe-clinical-message-compose';
        document.body.innerHTML = `
            <div class="container"><div id="pnotes">
              <form class="border-0" method="post" name="new_note" id="new_note" action="pnotes_full.php?docid=0&amp;orderid=0">
                <input type="hidden" name="csrf_token_form" value="fixture-token">
                <input type="hidden" name="mode" id="mode" value="new">
                <select name="assigned_to" id="assigned_to" class="form-control"><option value="fixture">Fixture</option><option value="">Mark Message as Completed</option></select>
                <textarea name="note" id="note" class="form-control" rows="4" cols="58"></textarea>
              </form></div></div>`;
        const note = document.getElementById('note');
        note.value = 'synthetic fixture text';
        const before = document.getElementById('pnotes').outerHTML;
        const topBody = document.createElement('body');
        topBody.className = 'workbench-active';
        const controller = createModeController({
            body: document.body,
            parentWindow: frame(topBody),
            origin: origin(),
            observe: () => ({ disconnect() {} })
        });
        expect(controller.active).toBe(true);
        expect(document.body.className).toBe('oe-clinical-message-compose oe-clinical-workspace');
        expect(document.getElementById('pnotes').outerHTML).toBe(before);
        expect(note.value).toBe('synthetic fixture text');
        expect(document.getElementById('assigned_to').value).toBe('fixture');
        controller.dispose();
        expect(document.body.className).toBe('oe-clinical-message-compose');
    });

    test('legacy shell and direct loads keep the original presentation', () => {
        document.body.className = 'oe-clinical-messages';
        const legacyTop = frame(document.createElement('body'));
        const controller = createModeController({
            body: document.body,
            parentWindow: frame(document.createElement('body'), legacyTop),
            origin: origin(),
            observe: () => ({ disconnect() {} })
        });
        expect(controller.active).toBe(false);
        expect(document.body.className).toBe('oe-clinical-messages');
        const direct = createModeController({ body: document.body, parentWindow: window, origin: origin(), observe: () => ({ disconnect() {} }) });
        expect(direct.active).toBe(false);
        controller.dispose();
        direct.dispose();
    });
});
