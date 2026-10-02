/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');
const postcss = require('postcss');
const { createModeController } = require('../../interface/clinical-workspace/mode.js');

const repo = path.join(__dirname, '../..');
const phpPath = path.join(repo, 'interface/main/calendar/add_edit_event.php');
const cssPath = path.join(repo, 'interface/clinical-workspace/appointment.css');
const SCOPE = 'body.oe-clinical-workspace.oe-clinical-appointment';

const source = () => fs.readFileSync(phpPath, 'utf8');

function inventory(src) {
    const grab = (re) => [...src.matchAll(re)].map((m) => m[1]);
    const count = (list) => list.reduce((acc, k) => ({ ...acc, [k]: (acc[k] || 0) + 1 }), {});
    return {
        ids: count(grab(/\bid=['"]([^'"\s<>]+)['"]/g)),
        names: count(grab(/\bname=['"]([^'"\s<>]+)['"]/g)),
        handlers: count(grab(/\b(on[a-z]+=(['"])[^'"]*\2)/g).map((h) => h.replace(/"/g, "'"))),
        dispatches: count(grab(/AppointmentRenderEvent::(RENDER_[A-Z_]+)/g)),
        jqBindings: count(grab(/\$\("#([a-z_]+)"\)\.(?:click|change)\(/g)),
        guards: count(grab(/<\?php\s+(?:if|elseif|\} elseif|\} else)\s*(\([^\n]*?\))\s*[:{]/g)),
    };
}

// Output of inventory() on add_edit_event.php at 949886b (pre-restyle master).
const BASELINE = {
    ids: { form_action: 1, recurr_affect: 1, selected_date: 1, event_start_date: 1, old_repeats: 1, rt2_flag2: 1, form_category: 1, form_title: 1, facility: 1, patient_details: 1, form_patient: 1, dob_row: 1, form_dob: 1, group_details: 1, form_group: 1, provd: 2, rballday1: 1, tdallday1: 1, form_date: 1, rballday2: 1, tdallday2: 1, tdallday4: 1, tdallday5: 1, form_repeat: 1, tdrepeat1: 1, form_repeat_exdate: 1, tdrepeat2: 1, form_enddate: 1, days_every_week_row: 1, days_every_week: 1, days_label: 1, days: 1, 'day_$key_attr': 1, title_apptstatus: 1, title_prefcat: 1, recurr_popup: 1, all_events: 1, recurr_cancel: 1, future_events: 1, current_event: 1, form_save: 1, find_available: 1, form_delete: 1, cancel: 1, form_duplicate: 1 },
    names: { resname: 1, form_action: 1, recurr_affect: 1, selected_date: 1, event_start_date: 1, old_repeats: 1, rt2_flag2: 1, form_category: 1, form_title: 1, facility: 1, form_patient: 1, form_pid: 1, form_dob: 1, form_group: 1, form_gid: 1, 'form_provider[]': 1, form_provider: 1, form_allday: 2, form_date: 1, form_hour: 1, form_minute: 1, form_ampm: 1, form_duration: 1, form_repeat: 1, form_repeat_exdate: 1, form_repeat_freq: 1, form_repeat_type: 1, form_enddate: 1, days_every_week: 1, 'day_$key_attr': 1, form_prefcat: 1, form_comments: 1, all_events: 1, form_save: 1, form_delete: 1, form_duplicate: 1 },
    handlers: { "onchange='set_category()'": 1, "onclick='sel_patient()'": 1, "onclick='sel_group()'": 1, "onclick='set_allday()'": 2, "onchange='dateChanged()'": 1, "onclick='set_repeat(this)'": 1, "onclick='set_days_every_week()'": 1, "onclick='dlgclose()'": 1 },
    dispatches: { RENDER_JAVASCRIPT: 1, RENDER_BELOW_PATIENT: 1, RENDER_BEFORE_ACTION_BAR: 1 },
    jqBindings: { form_save: 1, form_duplicate: 1, find_available: 1, form_delete: 1, all_events: 1, future_events: 1, current_event: 1, recurr_cancel: 1 },
    guards: {
        '($have_group_global_enabled)': 1,
        '(!empty($_POST["resname"]) && ($_POST["resname"] == "noresult"))': 1,
        "(empty($_GET['prov']) && empty($_GET['group']))": 1,
        "($_GET['group'] === true && $have_group_global_enabled)": 1,
        "($_GET['group'] == true)": 1,
        "(OEGlobalsBag::getInstance()->get('time_display_format') == 1)": 1,
        '(!empty($repeatexdate))': 1,
        "($_GET['group'] != true)": 1,
        "(empty($_GET['prov']))": 1,
        "(OEGlobalsBag::getInstance()->getBoolean('submit_changes_for_all_appts_at_once'))": 1,
        "(!(OEGlobalsBag::getInstance()->getBoolean('select_multi_providers')))": 1,
        '($informant)': 1,
        '($eid)': 1,
        "(!OEGlobalsBag::getInstance()->getBoolean('allow_early_check_in'))": 1,
        "(OEGlobalsBag::getInstance()->getBoolean('select_multi_providers'))": 1,
        '($repeats)': 2,
        "(!(OEGlobalsBag::getInstance()->getBoolean('select_multi_providers')) && empty($_GET['prov']))": 1,
        "(OEGlobalsBag::getInstance()->get('time_display_format')  == 1)": 1,
        '($is_holiday)': 1,
    },
};

// Opening tag of the element carrying a given literal id.
function tagWithId(src, id) {
    const match = src.match(new RegExp(`<[a-z]+\\b[^>]*\\bid=['"]${id}['"][^>]*>`));
    if (!match) throw new Error(`no element with id ${id}`);
    return match[0];
}

describe('appointment editor keeps every existing control', () => {
    const current = inventory(source());

    test.each(Object.keys(BASELINE))('%s are all still present with the same multiplicity', (kind) => {
        Object.entries(BASELINE[kind]).forEach(([key, n]) => {
            expect([kind, key, current[kind][key] || 0]).toEqual([kind, key, n]);
        });
    });

    test('form id, post target and the tab links are unchanged', () => {
        const src = source();
        expect(src).toContain("<form role=\"form\" method='post' name='<?php echo attr($form_id); ?>' id='<?php echo attr($form_id); ?>' action='add_edit_event.php?eid=<?php echo attr_url($eid) ?>'>");
        expect(src).toContain('href="add_edit_event.php?<?php echo attr($baseQuery);?>"');
        expect(src).toContain('href="add_edit_event.php?prov=true&<?php echo attr($baseQuery);?>"');
        expect(src).toContain('href="add_edit_event.php?group=true&<?php echo attr($baseQuery);?>"');
    });

    test('action and recurrence buttons keep their Bootstrap meaning', () => {
        const src = source();
        expect(tagWithId(src, 'form_save')).toMatch(/\bbtn btn-primary\b/);
        expect(tagWithId(src, 'form_delete')).toMatch(/\bbtn btn-danger\b/);
        ['find_available', 'cancel', 'form_duplicate'].forEach((id) => {
            expect(tagWithId(src, id)).toMatch(/\bbtn btn-secondary\b/);
        });
        expect(tagWithId(src, 'recurr_popup')).toMatch(/\balert bg-warning\b/);
        expect(tagWithId(src, 'recurr_popup')).toContain('display: none');
        expect(tagWithId(src, 'dob_row')).toContain("display: <?php echo $dobstyle ?>");
    });
});

describe('appointment editor loads the workbench presentation', () => {
    test('head links appointment.css and the shared mode.js, escaped and cache-busted', () => {
        const src = source();
        const asset = (file) => `<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>/interface/clinical-workspace/${file}?v=<?php echo attr_url(filemtime(__DIR__ . '/../../clinical-workspace/${file}')); ?>`;
        const head = src.slice(src.indexOf('<head>'), src.indexOf('</head>'));
        expect(head).toContain(`<link rel="stylesheet" href="${asset('appointment.css')}">`);
        expect(head).toContain(`<script src="${asset('mode.js')}" defer></script>`);
        // After the theme so the scoped rules win on equal specificity.
        expect(head.indexOf('appointment.css')).toBeGreaterThan(head.indexOf("Header::setupHeader("));
    });

    test('body keeps its original class and gains the route class', () => {
        expect(source()).toContain('<body class="add-edit-event oe-clinical-appointment">');
    });

    test('existing sections carry layout hooks without new wrappers', () => {
        const src = source();
        expect(src).toContain('<nav class="mb-3 oe-appt-tabs">');
        expect(src).toContain('<div class="jumbotron jumbotron-fluid px-3 py-4 my-2 oe-appt-schedule">');
        expect(tagWithId(src, 'patient_details')).toMatch(/\boe-appt-subject\b/);
        expect(tagWithId(src, 'group_details')).toMatch(/\boe-appt-subject\b/);
        expect(src).toContain('<div class="form-row mx-2 mt-3 oe-appt-actions">');
        // EnableForm/DisableForm toggle the form's direct children: no wrapper div may be added.
        const formOpen = src.indexOf("<form role=\"form\"");
        const formClose = src.indexOf('</form>');
        const formBody = src.slice(formOpen, formClose);
        // 34 = <div count inside the form at 949886b.
        expect((formBody.match(/<div\b/g) || []).length).toBe(34);
        expect(formBody).not.toMatch(/oe-appt-[a-z]+-wrap/);
    });

    test('previously unlabelled controls are now programmatically labelled', () => {
        const src = source();
        expect(tagWithId(src, 'tdrepeat1')).toContain("for='form_repeat'");
        expect(src).toContain("<label for='form_room'><?php echo xlt('Room Number'); ?>:</label>");
        expect(src).toContain("<label for='form_comments'><?php echo xlt('Comments'); ?>:</label>");
        expect(src).toMatch(/<input class='form-control' type='text' name='form_comments' id='form_comments' /);
    });
});

describe('mode switch on the real appointment body', () => {
    const origin = window.location.origin;
    let observer;

    function mountBody() {
        const tag = source().match(/<body class="([^"]*)">/);
        document.body.className = tag[1];
        return document.body;
    }

    function mount(parentWindow) {
        return createModeController({
            body: mountBody(),
            parentWindow,
            origin,
            observe: (target, callback) => {
                observer = new MutationObserver(callback);
                observer.observe(target, { attributes: true, attributeFilter: ['class'] });
                return observer;
            },
        });
    }

    afterEach(() => {
        if (observer) observer.disconnect();
        observer = null;
    });

    test('dlgopen iframe under an active workbench top window switches on, and follows legacy toggling', async () => {
        const topBody = document.implementation.createHTMLDocument('top').body;
        topBody.classList.add('workbench-active');
        const controller = mount({ location: { origin }, document: { body: topBody } });
        expect(document.body.classList.contains('oe-clinical-workspace')).toBe(true);
        expect(document.body.classList.contains('oe-clinical-appointment')).toBe(true);

        topBody.classList.remove('workbench-active');
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(document.body.classList.contains('oe-clinical-workspace')).toBe(false);
        controller.dispose();
    });

    test('legacy tabs top window leaves the legacy presentation', () => {
        const topBody = document.implementation.createHTMLDocument('top').body;
        mount({ location: { origin }, document: { body: topBody } });
        expect(document.body.classList.contains('oe-clinical-workspace')).toBe(false);
    });

    test('direct page (parent is itself) stays original', () => {
        mount(window);
        expect(document.body.classList.contains('oe-clinical-workspace')).toBe(false);
        expect(document.body.className).toBe('add-edit-event oe-clinical-appointment');
    });

    test('cross-origin parent is never dereferenced beyond origin', () => {
        const parentWindow = {
            location: { origin: 'https://other.example' },
            get document() { throw new Error('cross-origin document read'); },
        };
        expect(() => mount(parentWindow)).not.toThrow();
        expect(document.body.classList.contains('oe-clinical-workspace')).toBe(false);
    });
});

describe('appointment.css contract', () => {
    const rules = [];
    let root;

    beforeAll(() => {
        root = postcss.parse(fs.readFileSync(cssPath, 'utf8'));
        root.walkRules((rule) => {
            rule.selectors.forEach((selector) => {
                rule.walkDecls((decl) => rules.push({ selector, prop: decl.prop, value: decl.value, important: decl.important, parent: rule.parent }));
            });
        });
    });

    test('every selector is scoped to the workbench appointment body', () => {
        expect(rules.length).toBeGreaterThan(20);
        rules.forEach(({ selector }) => expect(selector.startsWith(`${SCOPE} `) || selector === SCOPE).toBe(true));
    });

    test('everything sits in a screen media query so print keeps the legacy page', () => {
        rules.forEach(({ selector, parent }) => {
            expect([selector, parent.type === 'atrule' && parent.name === 'media' && /\bscreen\b/.test(parent.params)]).toEqual([selector, true]);
        });
    });

    test('no !important, no hidden controls, no fixed positioning, no iframe styling', () => {
        rules.forEach((r) => {
            expect([r.selector, r.prop, Boolean(r.important)]).toEqual([r.selector, r.prop, false]);
            if (r.prop === 'display') expect(r.value).not.toBe('none');
            if (['visibility', 'opacity'].includes(r.prop)) throw new Error(`${r.selector} hides via ${r.prop}`);
            if (r.prop === 'position') expect(r.value).not.toBe('fixed');
            expect(r.selector).not.toMatch(/\biframe\b/);
        });
    });

    test('spacing and alignment use logical properties so RTL mirrors', () => {
        rules.forEach(({ selector, prop, value }) => {
            expect([selector, prop]).not.toEqual([selector, expect.stringMatching(/(^|-)(left|right)($|-)/)]);
            if (prop === 'text-align' || prop === 'float') expect(value).not.toMatch(/left|right/);
        });
    });

    test('clinical, status, alert and danger colours are left to the theme', () => {
        const protectedPattern = /option|#form_category|#form_apptstatus|form_prefcat|\.alert|bg-warning|#recurr_popup|btn-danger|#form_delete|text-danger|\.infobox|#dob_row/;
        rules
            .filter(({ prop }) => /^(color|background|background-color|border-color)$/.test(prop))
            .forEach(({ selector }) => expect(selector).not.toMatch(protectedPattern));
    });

    test('inputs cannot push the dialog wider than its frame', () => {
        const caps = rules.filter(({ prop, value }) => prop === 'max-width' && value === '100%');
        expect(caps.some(({ selector }) => /\.form-control/.test(selector))).toBe(true);
        expect(rules.some(({ prop, value }) => prop === 'min-width' && value === '0')).toBe(true);
    });

    test('focus stays visible on every restyled control', () => {
        const focusRules = rules.filter(({ selector }) => /:focus(-visible)?\b/.test(selector));
        expect(focusRules.some(({ prop }) => prop === 'box-shadow' || prop === 'outline')).toBe(true);
        rules.filter(({ prop, value }) => prop === 'outline' && /^(0|none)$/.test(value))
            .forEach(({ selector }) => expect(selector).toBe('unreachable: outline removed'));
    });

    test('only hooks that exist in the PHP markup are targeted', () => {
        const src = source();
        const used = new Set();
        root.walkRules((rule) => rule.selectors.forEach((s) => (s.match(/\.oe-appt-[a-z-]+|#[a-z_]+/g) || []).forEach((h) => used.add(h))));
        used.forEach((hook) => {
            const needle = hook.startsWith('#') ? new RegExp(`id=['"]${hook.slice(1)}['"]|\\$\\("${hook}"\\)`) : new RegExp(`class="[^"]*\\b${hook.slice(1)}\\b`);
            expect([hook, needle.test(src)]).toEqual([hook, true]);
        });
    });
});
