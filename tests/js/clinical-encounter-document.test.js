/**
 * @jest-environment node
 */
/* global __dirname */

// Contracts for the New/Edit Encounter form's workbench sheet styling. The form's fields,
// IDs, actions and include hooks must be untouched; only screen + workbench presentation
// is added, through the same workspace.css + mode.js integration SOAP uses.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const process = require('node:process');

const repo = path.join(__dirname, '../..');
const read = (relative) => fs.readFileSync(path.join(repo, relative), 'utf8');

const COMMON = 'interface/forms/newpatient/templates/newpatient/common.html.twig';
const HEAD = 'interface/forms/newpatient/templates/newpatient/partials/common/_head.html.twig';
const CSS = 'interface/clinical-workspace/encounter-document.css';
const CONTROLS = 'interface/forms/newpatient/templates/newpatient/partials/common/_form-controls.html.twig';
const PAGE_HEADING = 'templates/oemr_ui/page_heading/partials/page_heading.html.twig';
// The id outranks workspace.css's shared `body.oe-clinical-workspace #container_div` rule.
const SCOPE = 'body.oe-clinical-encounter.oe-clinical-workspace #container_div.oe-encounter-document';

// The include hooks of common.html.twig at ba11545, in order. Modules and sites override
// these partials, so neither the set nor the order may change.
const COMMON_INCLUDES = [
    '_head', '_form-start', 'fields/_hidden-fields', '_form-heading',
    'fields/_visit-category', 'fields/_class', 'fields/_type', 'fields/_sensitivities',
    'fields/_provider', 'fields/_provider-referring', 'fields/_provider-ordering',
    'fields/_facility', 'fields/_facility-billing',
    'fields/_date-of-service', 'fields/_date-of-onset', 'fields/_referral',
    'fields/_point-of-service', 'fields/_in-collection',
    'fields/_discharge-disposition', 'fields/_group-name',
    'fields/_reason-for-visit', 'fields/_issues',
    '_form-controls', '_form-end', '_body-scripts', '_body-end'
].map((name) => `newpatient/partials/common/${name}.html.twig`);

const includes = (source) => [...source.matchAll(/{%\s*include\s+"([^"]+)"\s*%}/g)].map((m) => m[1]);

// Minimal CSS reader: top-level @media blocks and their rules, comments stripped.
function parseCss(source) {
    const css = source.replace(/\/\*[\s\S]*?\*\//g, '');
    const blocks = [];
    let depth = 0;
    let media = null;
    let start = 0;
    let selector = '';
    for (let i = 0; i < css.length; i++) {
        if (css[i] === '{') {
            const head = css.slice(start, i).trim();
            if (depth === 0) {
                media = head;
            } else {
                selector = head;
            }
            depth++;
            start = i + 1;
        } else if (css[i] === '}') {
            if (depth === 2) {
                const declarations = Object.fromEntries(css.slice(start, i).split(';')
                    .map((d) => d.trim()).filter(Boolean)
                    .map((d) => [d.slice(0, d.indexOf(':')).trim(), d.slice(d.indexOf(':') + 1).trim()]));
                blocks.push({ media, selectors: selector.split(',').map((s) => s.trim()), declarations });
            } else if (depth === 1 && css.slice(start, i).trim() !== '') {
                // Declarations straight inside @media would mean a rule escaped the media wrapper.
                blocks.push({ media: null, selectors: [media], declarations: {} });
            }
            depth--;
            start = i + 1;
        } else if (depth === 0 && css[i] === ';') {
            start = i + 1;
        }
    }
    return blocks;
}

const workspaceVars = () => Object.fromEntries(
    [...read('interface/clinical-workspace/workspace.css').match(/body\.oe-clinical-workspace\s*{([^}]*)}/)[1]
        .matchAll(/(--oe-[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()])
);

function resolveColor(value, vars) {
    const plain = value.replace(/\s*!important$/, '').trim();
    const ref = plain.match(/^var\((--oe-[\w-]+)\)$/);
    const hex = ref ? vars[ref[1]] : plain;
    if (hex === 'transparent') return null;
    const m = (hex || '').match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (!m) throw new Error(`Unresolvable colour ${value}`);
    const digits = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
    return [0, 2, 4].map((i) => parseInt(digits.slice(i, i + 2), 16));
}

function contrast(a, b) {
    const lum = (rgb) => {
        const [r, g, bl] = rgb.map((c) => {
            const s = c / 255;
            return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
    };
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
}

describe('encounter form template wiring', () => {
    test('common.html.twig keeps every include hook in its original order', () => {
        expect(includes(read(COMMON))).toEqual(COMMON_INCLUDES);
    });

    test('form element, field grouping and container are preserved, with scope hooks added', () => {
        const source = read(COMMON);
        expect(source).toContain('<form id="new-encounter-form" method="post" action="{{ webroot }}{{ formAction }}" name="new_encounter" class="mt-3">');
        expect(source).toContain('<body class="{{ bodyClass|attr }} oe-clinical-encounter">');
        expect(source).toContain('<div id="container_div" class="{{ oemrUiContainerClass(oemrUiSettings) }} mt-3 oe-encounter-document">');
        // Original four field rows of #visit-details, then reason/issues, then controls.
        const visit = source.slice(source.indexOf('<div id="visit-details" class="px-3">'), source.indexOf('</fieldset>'));
        expect(visit.match(/<div class="form-row align-items-center">/g)).toHaveLength(4);
        expect(source.indexOf('_reason-for-visit')).toBeGreaterThan(source.indexOf('</fieldset>'));
        expect(source.indexOf('_form-controls')).toBeGreaterThan(source.indexOf('_issues'));
    });

    test('head partial adds workspace.css, mode.js and encounter-document.css after the original assets', () => {
        const head = read(HEAD);
        const setup = "{{ setupHeader(['datetime-picker', 'datetime-picker-translated', 'common', 'moment', 'validation_script']) }}";
        const newpatientJs = '<script src="{{ webroot|attr }}/interface/forms/newpatient/newpatient.js?v={{ assetVersion|attr_url }}"></script>';
        // media="screen": workspace.css has unscoped-by-media rules that must not reach print.
        const workspace = '<link rel="stylesheet" href="{{ webroot|attr }}/interface/clinical-workspace/workspace.css?v={{ assetVersion|attr_url }}" media="screen">';
        const mode = '<script src="{{ webroot|attr }}/interface/clinical-workspace/mode.js?v={{ assetVersion|attr_url }}" defer></script>';
        const sheet = `<link rel="stylesheet" href="{{ webroot|attr }}/interface/clinical-workspace/encounter-document.css?v={{ clinicalWorkspaceAssetVersion('encounter-document.css')|attr_url }}">`;
        const order = [setup, newpatientJs, workspace, mode, sheet, '</style>', '_head-after.html.twig'].map((s) => head.indexOf(s));
        expect(order.every((i) => i >= 0)).toBe(true);
        expect(order).toEqual([...order].sort((a, b) => a - b));
        expect(includes(head)).toEqual([
            'newpatient/partials/common/_head-before.html.twig',
            'newpatient/partials/common/_head-after.html.twig'
        ]);
    });

    test('the Save/Cancel row gains a stable class while keeping its attributes, buttons and hooks', () => {
        const controls = read(CONTROLS);
        expect(controls).toContain('<div class="form-row oe-encounter-actions">\n    <div class="col-sm-12 text-left position-override pl-3">');
        expect(controls).toContain('<button id="saveEncounter" type="button" class="btn btn-primary btn-save">');
        expect(controls).toContain(`<button type="button" class="btn btn-cancel {{ viewmode or autoloaded ? '' : 'link_submit' }}">`);
        expect(controls.match(/<button/g)).toHaveLength(2);
    });

    test('the sheet version comes from the shared Twig function over the fixed asset allowlist', () => {
        expect(read('src/Common/Assets/ClinicalWorkspaceAssets.php')).toMatch(/'encounter-document\.css',/);
        expect(read('src/Common/Twig/TwigExtension.php'))
            .toMatch(/new TwigFunction\(\s*'clinicalWorkspaceAssetVersion',\s*\$this->clinicalWorkspaceAssets->version\(\.\.\.\)\s*\)/);
        // No controller-only version parameter remains.
        const controller = read('interface/forms/newpatient/C_EncounterVisitForm.class.php');
        expect(controller).not.toMatch(/encounterDocumentCssVersion|ClinicalWorkspaceAssets/);
    });
});

describe('encounter-document.css', () => {
    const blocks = () => parseCss(read(CSS));

    test('every rule is screen-only and scoped to the encounter route inside an active workbench', () => {
        const all = blocks();
        expect(all.length).toBeGreaterThan(8);
        for (const block of all) {
            // Prefix notation only: range media queries and :has() are unsupported by older declared engines.
            expect(block.media).toMatch(/^@media screen( and \(max-width: \d+px\))?$/);
            for (const selector of block.selectors) {
                expect(selector.startsWith(SCOPE)).toBe(true);
            }
        }
    });

    test('no rule hides, removes or disables a control', () => {
        for (const { declarations } of blocks()) {
            expect(declarations.display).not.toBe('none');
            expect(declarations.visibility).toBeUndefined();
            expect(declarations['pointer-events']).toBeUndefined();
            expect(declarations.opacity).toBeUndefined();
            expect(declarations.content).toBeUndefined();
        }
        expect(read(CSS)).not.toMatch(/:has\(|width\s*[<>]=?/);
    });

    test('!important only re-pairs the colours theme-defaults.scss forces on legend and fieldset', () => {
        const important = blocks().flatMap((b) => Object.entries(b.declarations)
            .filter(([, v]) => v.endsWith('!important')).map(([p, v]) => [b.selectors.join(','), p, v]));
        // theme-defaults.scss: legend/fieldset { background-color: ... !important; color: $body-color !important }.
        expect(important).toEqual([
            [`${SCOPE} fieldset`, 'background-color', 'var(--oe-paper) !important'],
            [`${SCOPE} fieldset`, 'color', 'var(--oe-ink) !important'],
            [`${SCOPE} legend`, 'background-color', 'var(--oe-paper) !important'],
            [`${SCOPE} legend`, 'color', 'var(--oe-ink) !important'],
        ]);
    });

    test('every text colour is paired with its background and meets WCAG AA', () => {
        const vars = workspaceVars();
        const paired = blocks().filter((b) => 'color' in b.declarations);
        expect(paired.length).toBeGreaterThanOrEqual(4);
        for (const { selectors, declarations } of paired) {
            const bg = declarations['background-color'] ?? declarations.background;
            expect([selectors.join(','), bg]).not.toEqual([selectors.join(','), undefined]);
            // No transparent pairs: a transparent box would show whatever a theme painted beneath it.
            const back = resolveColor(bg, vars);
            expect([selectors.join(','), back]).not.toEqual([selectors.join(','), null]);
            expect(contrast(resolveColor(declarations.color, vars), back)).toBeGreaterThanOrEqual(4.5);
        }
    });

    test('field and button focus keep a visible petrol outline with 3:1 contrast on paper', () => {
        const vars = workspaceVars();
        const focus = blocks().filter((b) => b.selectors.some((s) => s.includes(':focus')));
        const selectors = focus.flatMap((b) => b.selectors);
        expect(selectors).toEqual(expect.arrayContaining([
            `${SCOPE} .form-control:focus`,
            `${SCOPE} .btn:focus-visible`
        ]));
        for (const { declarations } of focus) {
            const [width, style, colour] = declarations.outline.split(/\s+/);
            expect(parseFloat(width)).toBeGreaterThanOrEqual(2);
            expect(style).toBe('solid');
            expect(contrast(resolveColor(colour, vars), resolveColor('var(--oe-paper)', vars))).toBeGreaterThanOrEqual(3);
        }
    });

    test('the sheet keeps original headings and gives the action row its own ruled area', () => {
        const bySelector = Object.fromEntries(blocks().filter((b) => b.media === '@media screen').flatMap((b) => b.selectors.map((s) => [s, b.declarations])));
        expect(bySelector[SCOPE]['max-width']).toBeDefined();
        expect(bySelector[`${SCOPE} legend`]['font-weight']).toBe('700');
        expect(bySelector[`${SCOPE} .oe-encounter-actions`]['border-top']).toMatch(/var\(--oe-line\)/);
        // Sheet geometry must beat workspace.css's shared #container_div width and physical padding:
        // the shorthand resets both sides, and the id-bearing SCOPE outranks that rule.
        expect(bySelector[SCOPE]).toEqual(expect.objectContaining({ 'max-width': '1100px', padding: '1.5rem clamp(1rem, 3vw, 2rem) 1.25rem' }));
        expect(read('interface/clinical-workspace/workspace.css')).toMatch(/body\.oe-clinical-workspace #container_div,[\s\S]*?max-width: 1480px;/);
    });

    test('narrow widths stack every field column full-width', () => {
        const narrow = blocks().filter((b) => /max-width: \d+px/.test(b.media));
        expect(narrow.length).toBeGreaterThan(0);
        const stack = narrow.find((b) => b.selectors.includes(`${SCOPE} .form-row > [class*='col-']`));
        expect(stack.declarations).toEqual(expect.objectContaining({ flex: '0 0 100%', 'max-width': '100%' }));
        // The heading's Bootstrap .row pulls out 15px each side; narrower inline padding overflows
        // the frame (observed natively: 3px horizontal scroll at 390/320 with 0.75rem).
        const sheet = narrow.find((b) => b.selectors.includes(SCOPE));
        const parts = sheet.declarations.padding.split(/\s+/);
        const inline = parts.length === 1 ? parts[0] : parts[1];
        const px = inline.endsWith('rem') ? parseFloat(inline) * 16 : parseFloat(inline);
        expect(px).toBeGreaterThanOrEqual(15);
    });

    test('the page heading title wraps inside the sheet, screen and workbench only, without shrinking or eliding', () => {
        // OemrUI::pageHeading() renders the title (with the patient name) as nav.navbar > span.navbar-brand, which
        // Bootstrap 4 sets white-space: nowrap. Observed live at frame widths 372/302: the span ran to 581/582px.
        expect(read(PAGE_HEADING)).toContain('<span class="navbar-brand mb-0 h1">{{ heading|text }}</span>');
        const title = blocks().filter((b) => b.selectors.includes(`${SCOPE} .navbar > .navbar-brand`));
        expect(title).toHaveLength(1);
        expect(title[0].media).toBe('@media screen');
        expect(title[0].declarations).toEqual({
            'max-width': '100%',
            'min-width': '0',
            'overflow-wrap': 'break-word',
            'white-space': 'normal'
        });
    });

    test('Save and Cancel separate into two buttons with a real gap, screen and workbench only', () => {
        // Bootstrap 4 joins .btn-group buttons by pulling every later one back over its neighbour's border
        // (bootstrap-4-rtl mirrors it to margin-right). Observed live: Cancel at margin-left -1px, a 1px overlap.
        const bootstrap = fs.readFileSync(require.resolve('bootstrap/dist/css/bootstrap.min.css'), 'utf8');
        const joins = [...bootstrap.matchAll(/([^{}]*\.btn-group>\.btn[^{}]*){([^}]*margin-(?:left|right)[^}]*)}/g)]
            .flatMap((m) => m[1].split(',').filter((s) => /^\.btn-group>\.btn(?![\w-])/.test(s)).map((s) => [s, m[2]]));
        expect(joins).toEqual([['.btn-group>.btn:not(:first-child)', 'margin-left:-1px']]);
        // Specificity [ids, classes/pseudo-classes, types]; :not() counts its argument.
        const specificity = (selector) => {
            const s = selector.replace(/:not\(([^)]*)\)/g, ' $1');
            return [/#[\w-]+/g, /\.[\w-]+|\[[^\]]*\]|:[\w-]+/g, /(?:^|[\s>+~])[a-z][\w-]*/gi]
                .map((re) => (s.match(re) || []).length);
        };
        const outranks = (a, b) => {
            const i = a.findIndex((n, k) => n !== b[k]);
            return i >= 0 && a[i] > b[i];
        };

        const screen = blocks().filter((b) => b.media === '@media screen');
        const rule = (selector) => screen.filter((b) => b.selectors.includes(selector)).map((b) => b.declarations);
        const group = rule(`${SCOPE} .oe-encounter-actions .btn-group`);
        const buttons = rule(`${SCOPE} .oe-encounter-actions .btn-group > .btn`);
        expect(group).toHaveLength(1);
        expect(buttons).toHaveLength(1);
        // Both physical sides reset, so LTR and RTL builds alike lose the -1px pull; nothing hidden, resized or reordered.
        expect(buttons[0]).toEqual({ 'margin-right': '0', 'margin-left': '0' });
        for (const [selector] of joins) {
            expect(specificity(selector)).toEqual([0, 3, 0]);
            expect(outranks(specificity(`${SCOPE} .oe-encounter-actions .btn-group > .btn`), specificity(selector))).toBe(true);
        }
        // The group wraps at 320px and tighter frames instead of overflowing, and the gap clears a focused
        // button's ring (outline width + offset) so keyboard focus never paints over its neighbour.
        expect(group[0]).toEqual({ 'flex-wrap': 'wrap', gap: '0.5rem' });
        const ring = rule(`${SCOPE} .btn:focus-visible`)[0];
        const ringPx = parseFloat(ring.outline) + parseFloat(ring['outline-offset']);
        expect(parseFloat(group[0].gap) * 16).toBeGreaterThan(ringPx);
        // Only the 640px rule lives outside plain screen; it must not undo the separation.
        for (const b of blocks().filter((x) => x.media !== '@media screen')) {
            expect(b.selectors.some((s) => s.includes('.btn-group'))).toBe(false);
        }
    });

    test('lints clean as itself under the repo config and ignore file, and the lint is not a no-op', () => {
        const bin = path.join(path.dirname(require.resolve('stylelint/package.json')), 'bin/stylelint.mjs');
        // stylelint-config-standard 40 is ESM and exports only its entry (no ./package.json), so locate
        // the installed package from that entry and confirm it before rooting --config-basedir there.
        const configStandardDir = path.dirname(require.resolve('stylelint-config-standard'));
        expect(JSON.parse(fs.readFileSync(path.join(configStandardDir, 'package.json'), 'utf8')).name).toBe('stylelint-config-standard');
        const configBasedir = path.resolve(configStandardDir, '../..');
        const file = path.join(repo, CSS);
        fs.mkdirSync(path.join(repo, 'tmp'), { recursive: true });
        const dir = fs.mkdtempSync(path.join(repo, 'tmp', 'stylelint-encounter-'));
        const emptyIgnore = path.join(dir, 'empty-ignore');
        fs.writeFileSync(emptyIgnore, '');
        // Overrides resolve against --config-basedir, so root the repo config's override paths (as
        // clinical-calendar-stylelint.test.js does); every other setting is the repo config verbatim.
        const config = JSON.parse(read('.stylelintrc.json'));
        config.overrides = config.overrides.map((o) => ({ ...o, files: o.files.map((f) => path.join(repo, f)) }));
        const configFile = path.join(dir, 'stylelintrc.json');
        fs.writeFileSync(configFile, JSON.stringify(config));
        const lint = (args, input) => {
            const run = spawnSync(process.execPath, [bin, '--config', configFile, '--config-basedir', configBasedir, '--formatter', 'json', ...args], { cwd: repo, input, encoding: 'utf8' });
            expect(run.error).toBeUndefined();
            const report = JSON.parse(run.stderr);
            expect(report).toHaveLength(1);
            expect(report[0].ignored).toBeUndefined();
            expect(report[0].source).toBe(file);
            return { status: run.status, rules: report[0].warnings.map((w) => w.rule) };
        };
        try {
            // Repo .stylelintignore (default) and a test-local empty ignore give the same verdicts.
            for (const ignore of [[], ['--ignore-path', emptyIgnore]]) {
                expect(lint([...ignore, file])).toEqual({ status: 0, rules: [] });
                const sentinel = '@media (width <= 640px) {\n  a {\n    color: #fff;\n  }\n}\n';
                expect(lint([...ignore, '--stdin-filename', file], sentinel)).toEqual({ status: 2, rules: ['media-feature-range-notation'] });
            }
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});
