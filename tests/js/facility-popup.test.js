/** @jest-environment jsdom */

const fs = require('fs');
const path = require('path');
const postcss = require('postcss');

const root = path.join(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const count = (text, part) => text.split(part).length - 1;

const TEMPLATE = 'templates/super/facilities/form.html.twig';
const template = () => read(TEMPLATE);
// Byte-identical copy of form.html.twig at origin/master 18647270, before the facility presentation edits.
const fixture = () => read('tests/clinical-ui/fixtures/facility-original.txt');

const LINK = `<link rel="stylesheet" media="screen" href="{{ webroot|attr }}/interface/clinical-workspace/facility-popup.css?v={{ clinicalWorkspaceAssetVersion('facility-popup.css')|attr_url }}">`;

// Every planned template edit is [original, presented]. Nothing else in the 408 lines may change.
const changes = [
    [`{{ setupHeader(['opener', 'erx']) }}\n`, `{{ setupHeader(['opener', 'erx']) }}\n${LINK}\n`],
    ['<body class="body_top">', '<body class="body_top oe-facility-popup">'],
    ['    <div class="container-fluid">\n        <div class="row mb-3">', '    <div class="container-fluid oe-facility-document">\n        <div class="row mb-3">'],
];

// Apply the planned edits to the original; null when any anchor is missing or ambiguous.
const forward = text => {
    let out = text;
    for (const [before, after] of changes) {
        if (count(out, before) !== 1) return null;
        out = out.replace(before, () => after);
    }
    return out;
};

// Undo the planned edits; null when any edit is missing or ambiguous.
const restore = text => {
    let out = text;
    for (const [before, after] of [...changes].reverse()) {
        if (count(out, after) !== 1) return null;
        out = out.replace(after, () => before);
    }
    return out;
};

const firstDifference = (actual, expected) => {
    const a = actual.split('\n');
    const b = expected.split('\n');
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
        if (a[i] !== b[i]) return `line ${i + 1}: ${JSON.stringify(a[i])} != ${JSON.stringify(b[i])}`;
    }
    return null;
};

describe('facility template', () => {
    test('the frozen original is the complete 408-line template without presentation hooks', () => {
        const original = fixture();
        const lines = original.split('\n');
        expect(lines).toHaveLength(409);
        expect(lines[408]).toBe('');
        expect(lines.slice(0, 3)).toEqual(['<html>', '<head>', "{{ setupHeader(['opener', 'erx']) }}"]);
        expect(lines[407]).toBe('</html>');
        for (const absent of ['oe-facility', 'facility-popup', 'clinicalWorkspaceAssetVersion', '<link', 'workspace.css', '\r', '\t']) {
            expect(count(original, absent)).toBe(0);
        }
        for (const [before] of changes) expect(count(original, before)).toBe(1);
        expect(forward(original)).not.toBeNull();
        expect(restore(forward(original))).toBe(original);
    });

    test('the live template is either the untouched original or exactly the planned presentation', () => {
        const live = template();
        const original = fixture();
        const presented = forward(original);
        if (live === original || live === presented) return;
        // Partial or undeclared edits: report the nearest drift from the planned presentation.
        expect(firstDifference(live, presented)).toBeNull();
    });

    test('planned presentation: screen-only versioned link, route body class and the existing outer container', () => {
        const live = template();
        const original = fixture();
        expect(firstDifference(live, forward(original))).toBeNull();
        expect(live).toBe(forward(original));
        expect(restore(live)).toBe(original);

        expect(live.split('\n')[3]).toBe(LINK);
        expect(count(live, LINK)).toBe(1);
        expect(count(live, 'facility-popup.css')).toBe(2);
        expect(count(live, 'workspace.css')).toBe(0);
        expect(count(live, '<body')).toBe(1);
        expect(count(live, 'oe-facility-')).toBe(2);
        // Top Save/Cancel stay in the outer container, above (not inside) the form.
        const container = live.indexOf('<div class="container-fluid oe-facility-document">');
        const form = live.indexOf("<form name='facility-form'");
        expect(container).toBeGreaterThan(0);
        expect(live.indexOf("id='cancel'")).toBeGreaterThan(container);
        expect(live.indexOf("id='form_save'")).toBeGreaterThan(container);
        expect(live.indexOf("id='form_save'")).toBeLessThan(form);
    });

    test('partial application of the planned edits is rejected', () => {
        const original = fixture();
        const presented = forward(original);
        changes.forEach((_, skip) => {
            let partial = original;
            changes.forEach(([before, after], i) => {
                if (i !== skip) partial = partial.replace(before, () => after);
            });
            expect([original, presented]).not.toContain(partial);
            expect(restore(partial)).toBeNull();
        });
    });

    test('negative controls: security, behaviour, escaping, layout or stray presentation edits break restoration', () => {
        const original = fixture();
        const presented = forward(original);
        const mutations = [
            // CSRF and session
            ['            <input type="hidden" name="csrf_token_form" value="{{ csrfTokenRaw() }}">\n', ''],
            ['{{ csrfTokenRaw() }}', "{{ csrfTokenRaw('facility') }}"],
            ['    top.restoreSession();\n', ''],
            // submit, AJAX and callback
            ["method='post' action=\"facilities.php\"", "method='get' action=\"facilities.php\""],
            ['url: post_url,', "url: 'facilities.php',"],
            ['type: request_method,', "type: 'GET',"],
            ['data: form_data\n', 'data: {}\n'],
            ["dlgclose('refreshme', false);", 'dlgclose();'],
            ['{% if forceClose %}', '{% if false %}'],
            ['<input type="hidden" name=\'newmode\' value="admin_facility">', '<input type="hidden" name=\'newmode\' value="facility">'],
            // validation
            ["submitme(1, undefined, 'facility-form', collectvalidation)", "submitme(1, undefined, 'facility-form', undefined)"],
            ['    if (!valid) return;\n', ''],
            [".append('*');", ".append('');"],
            // eRx and primary business entity
            ['{% if erxEnabled %}', '{% if not erxEnabled %}'],
            [`{% set _oc = (erxEnabled) ? 'onchange="return displayAlert()"' : '' %}`, "{% set _oc = '' %}"],
            [' {{ disablePBE }}>', '>'],
            // escaping
            ["value='{{ facility.name|default('')|attr }}'", "value='{{ facility.name|default('')|raw }}'"],
            ["{{ my_fid|default('')|attr }}", "{{ my_fid|default('')|raw }}"],
            ["{{ facility.info|default('')|text }}", "{{ facility.info|default('')|raw }}"],
            ['alert({{ alertMsg|xlj }});', 'alert({{ alertMsg|raw }});'],
            // address copy and colour picker
            ['["mail_zip", "postal_code"]', '["mail_zip", "zip"]'],
            ['copyAddress("mailing");', 'copyAddress("physical");'],
            ["onClick=\"pick('pick','newcolor'); return false;\"", 'onClick="return false;"'],
            ["document.getElementById('ncolor').value = color;", ''],
            ["{{ setupHeader(['opener', 'erx']) }}", "{{ setupHeader(['opener']) }}"],
            // controls, tabs and switches
            ["name='billing_location' id='billing_location'", "name='billing_location' id='billing'"],
            ['<select name="pos_code"', '<select name="pos"'],
            ['data-target="#mailingAddress"', 'data-target="#physicalAddress"'],
            ["class='custom-control-input' name='inactive'", "class='form-check-input' name='inactive'"],
            ["<a class=\"btn btn-primary\" name='form_save' id='form_save' onclick='submitform();' href='#'>", "<a class=\"btn btn-primary\" name='form_save' id='form_save' href='#'>"],
            // layout, wrappers and undeclared presentation hooks
            ['<div class="bg-light border">', '<div class="bg-light border d-none">'],
            ['<div class="p-2 bg-light border">', '<div class="p-2 bg-light border oe-facility-panel">'],
            ["<form name='facility-form'", "<div class=\"oe-facility-sheet\"><form name='facility-form'"],
            // the planned link and route class themselves
            ['media="screen" ', ''],
            ['{{ webroot|attr }}', '{{ webroot }}'],
            ["clinicalWorkspaceAssetVersion('facility-popup.css')|attr_url", "clinicalWorkspaceAssetVersion('facility-popup.css')"],
            ['<body class="body_top oe-facility-popup">', '<body class="oe-facility-popup">'],
        ];
        for (const [from, to] of mutations) {
            expect([from, count(presented, from)]).toEqual([from, 1]);
            const mutated = presented.replace(from, () => to);
            expect([from, restore(mutated) === original]).toEqual([from, false]);
        }
    });
});

describe('untouched callers and backend', () => {
    const anchors = {
        'interface/usergroup/facilities.php': [
            `if (!AclMain::aclCheckCore('admin', 'users')) {\n    AccessDeniedHelper::denyWithTemplate("ACL check failed for admin/users: Facilities", xl("Facilities"));\n}`,
            `if (!empty($_POST)) {\n    CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: true);\n}`,
            '"name" => "facility",',
            '"color" => "ncolor",',
            '"facility_code" => "facility_id",',
            '    $insert_id = $facilityService->insertFacility($values);\n    exit(); // sjp 12/20/17 for ajax save',
            '    $facilityService->updateFacility($values);',
            "    $facilityService->updateUsersFacility($values['name'], $values['id']);",
            'function refreshme() {\n    top.restoreSession();\n    document.location.reload();\n}',
            `$(".medium_modal").on('click', function(e) {\n        e.preventDefault();\n        e.stopPropagation();\n        dlgopen('', '', 1020, 900, '', '', {\n            allowResize: true,`,
            `$(".addfac_modal").on('click', function(e) {\n        e.preventDefault();e.stopPropagation();\n        dlgopen('', '', 1020, 620, '', '', {\n            allowResize: false,`,
            '<a href="facilities_add.php" class="addfac_modal btn btn-text btn-add">',
            '<a class="font-weight-bold medium_modal" href="facility_admin.php?fid=<?php echo attr_url($iter3["id"]); ?>">',
            '<body class="">',
        ],
        'interface/usergroup/facility_admin.php': [
            `if (!AclMain::aclCheckCore('admin', 'users')) {\n    AccessDeniedHelper::denyWithTemplate("ACL check failed for admin/users: Facility Admin", xl("Facility Admin"));\n}`,
            '$rules = collectValidationPageRules("/interface/usergroup/facilities_add.php");',
            "    'forceClose' => isset($_POST[\"mode\"]) && $_POST[\"mode\"] == \"facility\",",
            "    'erxEnabled' => OEGlobalsBag::getInstance()->getBoolean('erx_enable'),",
            "    'disablePBE' => $disabled,",
            "    'mode' => 'edit',",
            'echo $t->render("super/facilities/form.html.twig", $args);',
        ],
        'interface/usergroup/facilities_add.php': [
            `if (!AclMain::aclCheckCore('admin', 'users')) {\n    AccessDeniedHelper::denyWithTemplate("ACL check failed for admin/users: Facility Add", xl("Facility Add"));\n}`,
            '$rules = collectValidationPageRules("/interface/usergroup/facilities_add.php");',
            "    'forceClose' => isset($_POST[\"mode\"]) && $_POST[\"mode\"] == \"facility\",",
            "    'erxEnabled' => OEGlobalsBag::getInstance()->getBoolean('erx_enable'),",
            "    'disablePBE' => $disabled,",
            "    'mode' => 'add',",
            'echo $t->render("super/facilities/form.html.twig", $args);',
        ],
    };

    test.each(Object.keys(anchors))('%s keeps its ACL, CSRF, persistence and dialog anchors', file => {
        const source = read(file);
        for (const anchor of anchors[file]) expect([anchor, count(source, anchor)]).toEqual([anchor, 1]);
        // The sheet is linked by the shared template only; callers stay unstyled.
        for (const absent of ['facility-popup', 'oe-facility', 'workspace.css']) expect(count(source, absent)).toBe(0);
    });

    test('Twig still exposes webroot and the allowlisted asset version function', () => {
        const twig = read('src/Common/Twig/TwigExtension.php');
        expect(count(twig, "'webroot' => $kernel->getWebRoot(),")).toBe(1);
        expect(count(twig, "'clinicalWorkspaceAssetVersion',\n                $this->clinicalWorkspaceAssets->version(...)")).toBe(1);
    });

    test('the asset helper registers exactly facility-popup.css and nothing else (controller-owned)', () => {
        const helper = read('src/Common/Assets/ClinicalWorkspaceAssets.php');
        const block = helper.match(/ {4}private const SUPPORTED = \[\n([\s\S]*?)\n {4}\];/);
        expect(block).not.toBeNull();
        const expected = [
            'ajtooltip.js', 'appointment.css', 'calendar-sidebar.js', 'calendar-workday.css', 'calendar-workday.js',
            'encounter-document.css', 'facility-popup.css', 'finder.css', 'global-messages.css', 'history-document.css',
            'history-editor.css', 'issue-popup.css', 'lbf-document.css', 'mode.js', 'patient-messages.css',
            'patient-picker-popup.css', 'patient-results-popup.css', 'patient-search.css', 'soap-document.css',
            'soap-document.js', 'soap-reference.css', 'soap-reference.js', 'visit-history.css', 'visit-history.js',
            'workspace.css',
        ];
        expect(block[1].split('\n')).toEqual(expected.map(name => `        '${name}',`));
        expect(count(helper, 'facility-popup.css')).toBe(1);
        for (const anchor of [
            "        $this->directory = $directory ?? dirname(__DIR__, 3) . '/interface/clinical-workspace';",
            String.raw`        if (!in_array($asset, self::SUPPORTED, true)) {
            throw new \InvalidArgumentException('Unsupported clinical workspace asset');
        }

        $path = $this->directory . '/' . $asset;
        clearstatcache(true, $path);
        if (!is_file($path)) {
            return '0';
        }
        $mtime = filemtime($path);

        return $mtime === false ? '0' : sprintf('%d', $mtime);`,
        ]) expect(count(helper, anchor)).toBe(1);
    });
});

// ---------------------------------------------------------------------------
// facility-popup.css
//
// A missing sheet is an ordinary expectation failure inside each test, never a
// module-load crash. These tests check the sheet's selectors and declarations
// structurally and model selector matching with jsdom's element.matches(). They
// do NOT compute the compiled theme cascade, native control rendering or real
// PHP/Twig output; those need the hosted browser checks.
// ---------------------------------------------------------------------------

const CSS = 'interface/clinical-workspace/facility-popup.css';
const CONTEXTS = ['oe-workbench-context', 'oe-workbench-popup'];
const PREFIXES = CONTEXTS.map(context => `html.${context} body.oe-facility-popup`);
const PAINT = ['color', 'background-color', 'border-color'];
const OUTLINE = ['outline', 'outline-color', 'outline-style', 'outline-width', 'outline-offset'];
const ALLOWED = new Set([...PAINT, 'box-shadow', 'opacity', ...OUTLINE]);

const sheet = () => {
    const file = path.join(root, CSS);
    expect([CSS, fs.existsSync(file)]).toEqual([CSS, true]);
    return postcss.parse(fs.readFileSync(file, 'utf8'), { from: file });
};

const rulesOf = tree => {
    const out = [];
    tree.walkRules(rule => {
        const decls = [];
        rule.walkDecls(d => decls.push({ prop: d.prop, value: d.value, important: Boolean(d.important) }));
        out.push({ selectors: rule.selectors, decls, props: new Set(decls.map(d => d.prop)) });
    });
    return out;
};

const tailOf = selector => {
    for (const prefix of PREFIXES) {
        if (selector === prefix || selector.startsWith(`${prefix} `)) return selector.slice(prefix.length);
    }
    return null;
};
const isPlaceholder = selector => selector.endsWith('::placeholder');
const isFocusRing = tail => /^ \.oe-facility-document \.(btn|nav-link):focus(-visible)?$/.test(tail);

// The one theme-owned utility the sheet may target. The dark workbench ink is inherited by labels in the
// existing bg-light panels, so the panel itself must be painted with the matching paper. Bootstrap's
// .bg-light utility is background-color !important, so only this one background answers it with !important.
const PANEL = ' .oe-facility-document .bg-light';
const PANEL_SELECTORS = PREFIXES.map(prefix => `${prefix}${PANEL}`).sort();
const PANEL_DECLS = [
    { prop: 'color', value: 'var(--oe-facility-ink)', important: false },
    { prop: 'background-color', value: 'var(--oe-facility-paper)', important: true },
];
// Returns the reasons the panel rule is wrong; an empty list is a pass.
const panelOffenders = rules => {
    const owners = rules.filter(r => r.selectors.some(s => tailOf(s) === PANEL));
    if (owners.length !== 1) return [['panel rule count', owners.length]];
    const [owner] = owners;
    const offenders = [];
    if (JSON.stringify([...owner.selectors].sort()) !== JSON.stringify(PANEL_SELECTORS)) offenders.push(['panel selectors', owner.selectors]);
    if (JSON.stringify(owner.decls) !== JSON.stringify(PANEL_DECLS)) offenders.push(['panel declarations', owner.decls]);
    return offenders;
};
// Every !important in the sheet, as `tail|property`.
const importantOf = rules => {
    const important = new Set();
    for (const { selectors, decls } of rules) {
        for (const d of decls.filter(decl => decl.important)) {
            for (const selector of selectors) important.add(`${tailOf(selector)}|${d.prop}`);
        }
    }
    return [...important].sort();
};

describe('facility-popup.css structure', () => {
    test('one screen-only block: no imports, breakpoints or nested at-rules', () => {
        const tree = sheet();
        const top = tree.nodes.filter(node => node.type !== 'comment');
        expect(top.map(node => (node.type === 'atrule' ? `@${node.name} ${node.params}` : node.type))).toEqual(['@media screen']);
        const atRules = [];
        tree.walkAtRules(at => atRules.push(`@${at.name} ${at.params}`));
        expect(atRules).toEqual(['@media screen']);
        expect(rulesOf(tree).length).toBeGreaterThan(0);
    });

    test('every rule is paired across both workbench contexts and confined to the route and outer container', () => {
        const offenders = [];
        for (const { selectors } of rulesOf(sheet())) {
            const tails = selectors.map(tailOf);
            if (tails.includes(null)) offenders.push(['unscoped', selectors]);
            const byContext = PREFIXES.map(prefix => selectors.filter(s => s === prefix || s.startsWith(`${prefix} `)).map(tailOf).sort());
            if (JSON.stringify(byContext[0]) !== JSON.stringify(byContext[1]) || byContext[0].length * 2 !== selectors.length) {
                offenders.push(['unpaired', selectors]);
            }
            for (const tail of tails.filter(t => t !== null)) {
                if (tail !== '' && !/^ \.oe-facility-document(?![\w-])/.test(tail)) offenders.push(['outside container', tail]);
                const bare = tail.replace(/:not\([^()]*\)/g, '');
                // Bootstrap tab/switch/active state, validation state and theme utilities stay theme-owned.
                if (tail !== PANEL && /\.(active|show|fade|collapse|tab-pane|tab-content|custom-[\w-]+|is-invalid|is-valid|was-validated|bg-[\w-]+|text-[\w-]+|btn-[\w-]+)(?![\w-])/.test(bare)) {
                    offenders.push(['theme-owned target', tail]);
                }
                if (/::(?!placeholder$)/.test(tail)) offenders.push(['pseudo-element', tail]);
            }
        }
        expect(offenders).toEqual([]);
    });

    test('paint only: no geometry, typography or display declarations', () => {
        const tree = sheet();
        const rules = rulesOf(tree);
        const declared = new Set(rules.flatMap(r => r.decls.map(d => d.prop)).filter(p => p.startsWith('--')));
        const offenders = [];
        for (const { selectors, decls } of rules) {
            for (const { prop, value } of decls) {
                const custom = /^--oe-facility-[\w-]+$/.test(prop);
                if (!ALLOWED.has(prop) && !custom) offenders.push(['property', prop]);
                if (prop === 'opacity' && !selectors.every(isPlaceholder)) offenders.push(['opacity outside placeholder', selectors]);
                // Without workspace.css an unresolved token would drop the paint, so each var() resolves here or falls back.
                for (const [, name, fallback] of value.matchAll(/var\(\s*(--[\w-]+)\s*(,)?/g)) {
                    if (!fallback && !declared.has(name)) offenders.push(['unresolved var', name]);
                }
            }
        }
        expect(offenders).toEqual([]);
    });

    test('!important is limited to the route canvas, answering color_base .body_top', () => {
        // The real theme rule that the canvas has to answer.
        expect(count(read('interface/themes/color_base.scss'), '.body_top,\n.bgcolor2,\n.body_nav {\n  background-color: $paler !important;\n}')).toBe(1);
        // Plus the single bg-light panel background, which has to beat Bootstrap's own !important utility.
        expect(importantOf(rulesOf(sheet()))).toEqual(['|background-color', '|color', `${PANEL}|background-color`].sort());
    });

    test('bg-light panels get the paired ink and paper (the only theme-utility target, in both contexts)', () => {
        expect(panelOffenders(rulesOf(sheet()))).toEqual([]);
    });

    describe('panel rule check rejects mutations', () => {
        const rule = ({ selectors = PANEL_SELECTORS, color = 'color: var(--oe-facility-ink);', bg = 'background-color: var(--oe-facility-paper) !important;', extra = '' } = {}) =>
            rulesOf(postcss.parse(`@media screen { ${selectors.join(', ')} { ${color} ${bg} ${extra} } }`));
        const wrongTarget = PREFIXES.map(prefix => `${prefix} .oe-facility-document .bg-white`);
        const broadTarget = PREFIXES.map(prefix => `${prefix} .bg-light`);

        test('the exact rule passes', () => {
            expect(panelOffenders(rule())).toEqual([]);
            expect(importantOf(rule())).toEqual([`${PANEL}|background-color`]);
        });

        test.each([
            ['wrong target', { selectors: wrongTarget }],
            ['target outside the container', { selectors: broadTarget }],
            ['one context only', { selectors: [PANEL_SELECTORS[0]] }],
            ['background without !important', { bg: 'background-color: var(--oe-facility-paper);' }],
            ['foreground removed', { color: '' }],
            ['foreground !important', { color: 'color: var(--oe-facility-ink) !important;' }],
            ['wrong background value', { bg: 'background-color: #fff !important;' }],
            ['extra !important property', { extra: 'border-color: var(--oe-facility-line) !important;' }],
            ['extra plain property', { extra: 'border-color: var(--oe-facility-line);' }],
        ])('%s', (name, options) => {
            expect([name, panelOffenders(rule(options)).length > 0]).toEqual([name, true]);
        });

        test('an extra !important property is also caught by the sheet-wide allowlist', () => {
            const extra = importantOf(rule({ extra: 'border-color: var(--oe-facility-line) !important;' }));
            expect(extra).not.toEqual([`${PANEL}|background-color`]);
        });
    });

    test('declarations are paired: surfaces ink+background, controls ink+background+border, placeholder ink+opacity', () => {
        const offenders = [];
        for (const { selectors, props } of rulesOf(sheet())) {
            const tails = selectors.map(tailOf).filter(t => t !== null);
            const has = list => list.every(p => props.has(p));
            if (selectors.some(isPlaceholder)) {
                if (!selectors.every(isPlaceholder)) offenders.push(['mixed placeholder list', selectors]);
                if (JSON.stringify([...props].sort()) !== JSON.stringify(['color', 'opacity'])) offenders.push(['placeholder', selectors]);
            } else if (tails.some(isFocusRing)) {
                if (!tails.every(isFocusRing)) offenders.push(['mixed focus-ring list', selectors]);
                if (![...props].every(p => OUTLINE.includes(p))) offenders.push(['focus ring paints palette', selectors]);
            } else if (tails.some(t => t.includes('.form-control'))) {
                if (!has(PAINT)) offenders.push(['control unpaired', selectors]);
                // Syntax is the implementer's choice; the jsdom tests below check the exclusion behaviourally.
                for (const tail of tails) {
                    const excluded = (tail.match(/:not\([^()]*\)/g) || []).join(' ');
                    for (const state of ['.is-invalid', '.is-valid', '.was-validated']) {
                        if (!excluded.includes(state)) offenders.push(['control without validation exclusion', state, tail]);
                    }
                }
            } else if ((props.has('color') || props.has('background-color')) && !has(['color', 'background-color'])) {
                offenders.push(['surface unpaired', selectors]);
            }
        }
        expect(offenders).toEqual([]);
    });

    test('focus fallbacks: separate :focus and :focus-visible outline lists for .btn and .nav-link', () => {
        const rules = rulesOf(sheet());
        // A browser that rejects one selector drops the whole list, so the two pseudos never share one.
        const mixed = rules.filter(r => r.selectors.some(s => s.includes(':focus-visible')) && r.selectors.some(s => /:focus(?!-)/.test(s)));
        expect(mixed.map(r => r.selectors)).toEqual([]);
        for (const target of ['.btn', '.nav-link']) {
            for (const pseudo of [':focus', ':focus-visible']) {
                const tail = ` .oe-facility-document ${target}${pseudo}`;
                const owners = rules.filter(r => r.selectors.some(s => tailOf(s) === tail));
                expect([tail, owners.length > 0]).toEqual([tail, true]);
                for (const owner of owners) {
                    expect([tail, [...owner.props].every(p => OUTLINE.includes(p)), [...owner.props].some(p => OUTLINE.includes(p))]).toEqual([tail, true, true]);
                }
            }
        }
    });
});

// jsdom model. jsdom cannot evaluate ::placeholder or :focus-visible: placeholder selectors are
// matched against their originating control with only the pseudo-element stripped, and
// :focus-visible selectors are skipped here (they are checked structurally above). Selector
// errors are not caught; an unsupported selector fails the test.
const matches = (rules, element, { placeholder = false } = {}) => {
    const out = [];
    for (const rule of rules) {
        for (const selector of rule.selectors) {
            if (selector.includes(':focus-visible') || isPlaceholder(selector) !== placeholder) continue;
            if (element.matches(placeholder ? selector.slice(0, -'::placeholder'.length) : selector)) out.push({ rule, selector });
        }
    }
    return out;
};
const propsMatched = found => new Set(found.flatMap(({ rule }) => [...rule.props]));

const mount = ({ context = CONTEXTS[1], bodyClass = 'body_top oe-facility-popup', formClass = '', inputClass = '', attrs = '' } = {}) => {
    document.documentElement.className = context;
    document.body.className = bodyClass;
    document.body.innerHTML = `<div class="container-fluid oe-facility-document">
        <div class="row mb-3"><div class="col-sm-12 d-flex"><h5 class="m-0">Edit Facility</h5><div>
            <a class="btn btn-text" id="cancel" href="#">Cancel</a>
            <a class="btn btn-primary" name="form_save" id="form_save" href="#">Save</a>
        </div></div></div>
        <form name="facility-form" id="facility-form" class="${formClass}">
            <div class="bg-light border"><label class="mb-0" id="panel-label" for="probe">Street</label><ul class="nav nav-pills mt-2" id="addressTab" role="tablist">
                <li class="nav-item py-1 px-2"><button type="button" class="nav-link py-1 px-2 active" id="physical-address-tab">Physical</button></li>
                <li class="nav-item py-1 px-2"><button type="button" class="nav-link py-1 px-2" id="mailing-address-tab">Mailing</button></li>
            </ul><div class="input-group"><div class="input-group-prepend"><button type="button" id="btnCopyMailing" class="btn btn-outline-secondary">Copy</button></div>
            <input type="text" id="probe" class="form-control ${inputClass}" name="street" placeholder="Address" ${attrs}></div></div>
        </form>
    </div>`;
    const byId = id => document.getElementById(id);
    return {
        body: document.body,
        container: document.querySelector('.oe-facility-document'),
        input: byId('probe'),
        panel: document.querySelector('.bg-light'),
        panelLabel: byId('panel-label'),
        buttons: [byId('cancel'), byId('form_save'), byId('btnCopyMailing'), byId('physical-address-tab'), byId('mailing-address-tab')],
    };
};

describe('facility-popup.css in a jsdom model of the popup', () => {
    afterEach(() => {
        document.documentElement.className = '';
        document.body.className = '';
        document.body.innerHTML = '';
    });

    test.each(CONTEXTS)('html.%s: route canvas answers body_top and the outer container gets paired paper', context => {
        const rules = rulesOf(sheet());
        const { body, container } = mount({ context });
        const canvas = matches(rules, body).flatMap(({ rule }) => rule.decls.filter(d => d.important).map(d => d.prop));
        expect(new Set(canvas)).toEqual(new Set(['background-color', 'color']));
        const paper = matches(rules, container);
        expect(paper.some(({ rule }) => rule.props.has('background-color') && rule.props.has('color') && rule.decls.every(d => !d.important))).toBe(true);
    });

    test.each(CONTEXTS)('html.%s: ordinary controls get paired neutral paint at rest, focus, disabled and readonly', context => {
        const rules = rulesOf(sheet());
        const states = [
            ['rest', {}, null],
            ['focus', {}, [':focus']],
            ['disabled', { attrs: 'disabled' }, [':disabled', '[disabled]']],
            ['readonly', { attrs: 'readonly' }, ['[readonly]', ':read-only']],
        ];
        for (const [name, options, tokens] of states) {
            const { input } = mount({ context, ...options });
            if (name === 'focus') input.focus();
            if (name === 'focus') expect(input.matches(':focus')).toBe(true);
            const found = matches(rules, input).filter(({ selector }) => tokens === null || tokens.some(token => selector.includes(token)));
            expect([name, found.some(({ rule }) => PAINT.every(p => rule.props.has(p)))]).toEqual([name, true]);
        }
        const { input } = mount({ context });
        const placeholder = matches(rules, input, { placeholder: true });
        expect(placeholder.some(({ rule }) => rule.props.has('color') && rule.props.has('opacity'))).toBe(true);
    });

    test.each(CONTEXTS)('html.%s: a focused read-only control keeps its locked ink and paper; placeholder ink is opaque', context => {
        const rules = rulesOf(sheet());
        const { input } = mount({ context, attrs: 'readonly' });
        input.focus();
        expect(input.matches(':focus')).toBe(true);
        // Equal specificity, so the last matching rule in source order wins per property (a source-order model only).
        const winner = prop => matches(rules, input).filter(({ rule }) => rule.props.has(prop)).map(({ rule }) => rule.decls.find(d => d.prop === prop).value).pop();
        expect([winner('color'), winner('background-color')]).toEqual(['var(--oe-facility-disabled-ink)', 'var(--oe-facility-disabled-paper)']);
        const placeholder = matches(rules, input, { placeholder: true }).map(({ rule }) => rule.decls);
        expect(placeholder.flat().map(d => `${d.prop}:${d.value}`).sort()).toEqual(['color:var(--oe-facility-muted)', 'opacity:1']);
    });

    test.each(CONTEXTS)('html.%s: the bg-light panel holding a label gets the paired rule (rule application only, not computed contrast)', context => {
        const rules = rulesOf(sheet());
        const { panel, panelLabel } = mount({ context });
        expect(panel.contains(panelLabel)).toBe(true);
        const found = matches(rules, panel).filter(({ rule }) => rule.selectors.some(s => tailOf(s) === PANEL));
        expect(found.length).toBe(1);
        expect(found[0].rule.decls).toEqual(PANEL_DECLS);
        // Only the panel is matched directly. The label has no rule of its own (zero matches), but it still
        // inherits the panel's ink through normal color inheritance; other controls and pills keep their own palette.
        expect(matches(rules, panelLabel).length).toBe(0);
    });

    test.each(CONTEXTS)('html.%s: validation states keep the theme palette (no facility paint reaches them)', context => {
        const rules = rulesOf(sheet());
        const painted = ['color', 'background-color', 'border-color', 'box-shadow', 'opacity'];
        for (const [name, options] of [
            ['is-invalid', { inputClass: 'is-invalid' }],
            ['is-valid', { inputClass: 'is-valid' }],
            ['was-validated descendant', { formClass: 'was-validated' }],
        ]) {
            for (const focus of [false, true]) {
                const { input } = mount({ context, ...options });
                if (focus) input.focus();
                const reached = [...propsMatched(matches(rules, input)), ...propsMatched(matches(rules, input, { placeholder: true }))];
                expect([name, focus, reached.filter(p => painted.includes(p))]).toEqual([name, focus, []]);
            }
        }
    });

    test.each(CONTEXTS)('html.%s: buttons and nav pills keep their semantic palettes; focus adds only an outline', context => {
        const rules = rulesOf(sheet());
        for (const button of mount({ context }).buttons) {
            expect([button.id, matches(rules, button).length]).toEqual([button.id, 0]);
        }
        for (const id of ['form_save', 'cancel', 'physical-address-tab', 'mailing-address-tab']) {
            mount({ context });
            const button = document.getElementById(id);
            button.focus();
            expect(button.matches(':focus')).toBe(true);
            const props = [...propsMatched(matches(rules, button))];
            expect([id, props.length > 0, props.every(p => OUTLINE.includes(p))]).toEqual([id, true, true]);
        }
    });

    test('nothing matches off the facility route or outside a workbench context', () => {
        const rules = rulesOf(sheet());
        for (const options of [
            { context: '' },
            { context: 'oe-workbench' },
            { bodyClass: 'body_top' },
            { bodyClass: '' },
        ]) {
            const { body, container, input, buttons, panel, panelLabel } = mount(options);
            for (const element of [document.documentElement, body, container, input, panel, panelLabel, ...buttons]) {
                const found = [...matches(rules, element), ...matches(rules, element, { placeholder: true })];
                expect([options, element.id || element.tagName, found.length]).toEqual([options, element.id || element.tagName, 0]);
            }
        }
    });
});
