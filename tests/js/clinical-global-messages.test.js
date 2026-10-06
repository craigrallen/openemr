/**
 * @jest-environment jsdom
 */
/* global __dirname */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const postcss = require('postcss');
const { createModeController } = require('../../interface/clinical-workspace/mode.js');

const root = path.join(__dirname, '../..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const phpPath = 'interface/main/messages/messages.php';
const cssPath = 'interface/clinical-workspace/global-messages.css';
const php = () => read(phpPath);
const css = () => read(cssPath);
const scope = 'body.oe-clinical-workspace.oe-clinical-global-messages';
const count = (haystack, needle) => haystack.split(needle).length - 1;

// sha256 of messages.php at 5619373, the base of this slice.
const BASELINE_SHA256 = 'd484fb656cc371ee92eac827f3eff53c2b61a65f4674846239a4977af2eebc8b';
const USE_LINE = 'use OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;\n';
const ASSET_BLOCK = [
    '    <?php $clinicalAssets = new ClinicalWorkspaceAssets(); ?>',
    '    <link rel="stylesheet" media="screen" href="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>/interface/clinical-workspace/workspace.css?v=<?php echo attr_url($clinicalAssets->version(\'workspace.css\')); ?>">',
    '    <link rel="stylesheet" href="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>/interface/clinical-workspace/global-messages.css?v=<?php echo attr_url($clinicalAssets->version(\'global-messages.css\')); ?>">',
    '    <script src="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>/interface/clinical-workspace/mode.js?v=<?php echo attr_url($clinicalAssets->version(\'mode.js\')); ?>" defer></script>',
    ''
].join('\n');
const NEW_BODY = "<body class='body_top oe-clinical-global-messages'>";
const OLD_BODY = "<body class='body_top'>";
// Each selection-class line follows the original line that paints the row; the original stays as it was.
const SELECTION_LINES = [
    {
        after: '                                        echo "document.getElementById(\\"check$i\\").checked=true; document.getElementById(\\"row$i\\").style.background=\'var(--gray200)\';  ";\n',
        added: '                                        echo "document.getElementById(\\"row$i\\").classList.add(\'oe-message-selected\');  ";\n',
    },
    {
        after: '                                        echo "document.getElementById(\\"check$i\\").checked=false; document.getElementById(\\"row$i\\").style.background=\'var(--light)\';  ";\n',
        added: '                                        echo "document.getElementById(\\"row$i\\").classList.remove(\'oe-message-selected\');  ";\n',
    },
    {
        after: '                                document.getElementById(row).style.background = "var(--gray200)";\n',
        added: '                                document.getElementById(row).classList.add(\'oe-message-selected\');\n',
    },
    {
        after: '                                document.getElementById(row).style.background = "var(--light)";\n',
        added: '                                document.getElementById(row).classList.remove(\'oe-message-selected\');\n',
    },
];
const PANE_SCOPE = (pane) => `${scope} ${pane}`;
const OTHER_PANES = ['#reminders-div', '#recalls-div', '#sms-div'];

function rules() {
    const found = [];
    postcss.parse(css()).walkRules((rule) => {
        const declarations = {};
        const important = [];
        rule.walkDecls((decl) => {
            declarations[decl.prop] = decl.value;
            if (decl.important) important.push(decl.prop);
        });
        found.push({ rule, selectors: rule.selectors, declarations, important });
    });
    return found;
}
const selectorsOf = () => rules().flatMap(({ selectors }) => selectors);
const merged = (selector) => {
    const matching = rules().filter(({ selectors }) => selectors.includes(selector));
    expect([selector, matching.length > 0]).toEqual([selector, true]);
    return Object.assign({}, ...matching.map(({ declarations }) => declarations));
};

describe('messages.php: workbench assets are the only change', () => {
    test('removing exactly the import, asset block, body class and selection-class lines restores the baseline byte for byte', () => {
        const source = php();
        expect(count(source, USE_LINE)).toBe(1);
        expect(count(source, ASSET_BLOCK)).toBe(1);
        expect(count(source, NEW_BODY)).toBe(1);
        let restored = source.replace(USE_LINE, '').replace(ASSET_BLOCK, '').replace(NEW_BODY, OLD_BODY);
        for (const { after, added } of SELECTION_LINES) {
            // The added line sits directly after its original line, exactly once.
            expect([added, count(restored, after + added)]).toEqual([added, 1]);
            restored = restored.replace(after + added, after);
        }
        expect(crypto.createHash('sha256').update(restored).digest('hex')).toBe(BASELINE_SHA256);
    });

    test('selection class is toggled only beside the original row painting, with no new handlers', () => {
        const source = php();
        expect(count(source, 'oe-message-selected')).toBe(4);
        expect(count(source, "classList.add('oe-message-selected')")).toBe(2);
        expect(count(source, "classList.remove('oe-message-selected')")).toBe(2);
        // Counts recorded from 5619373: the original painting, checks and listeners are unchanged.
        expect(count(source, 'style.background')).toBe(4);
        expect(count(source, 'checked=true')).toBe(1);
        expect(count(source, 'checked=false')).toBe(1);
        expect(count(source, 'addEventListener')).toBe(2);
        expect(count(source, 'classList')).toBe(4);
    });

    test('import sits alphabetically in the existing use list', () => {
        expect(php()).toContain('use OpenEMR\\Common\\Acl\\AclMain;\n' + USE_LINE + 'use OpenEMR\\Common\\Csrf\\CsrfUtils;');
    });

    test('assets load only on the default message board, after the legacy head and before </head>', () => {
        const source = php();
        const goStart = source.indexOf("if (!empty($_REQUEST['go'])) {");
        const boardStart = source.indexOf('//original message.php stuff');
        const assets = source.indexOf(ASSET_BLOCK);
        const headEnd = source.indexOf('</head>');
        expect(goStart).toBeGreaterThan(0);
        // MedEx go branches (setup, addRecall, Recalls, Preferences, icons, SMS_bot) never see the assets.
        expect(source.slice(goStart, boardStart)).not.toMatch(/clinical-workspace|ClinicalWorkspaceAssets|oe-clinical/);
        expect(source.slice(0, goStart)).not.toMatch(/clinical-workspace\/|new ClinicalWorkspaceAssets/);
        expect(assets).toBeGreaterThan(source.indexOf("echo \"<title>\" .  xlt('Message Center') . \"</title>\";"));
        expect(assets + ASSET_BLOCK.length).toBe(headEnd);
        // The legacy stylesheet and script stay first; the workbench sheet overrides them, mode.js loads last.
        expect(source.indexOf('reminder_style.css')).toBeLessThan(assets);
        expect(source.indexOf('reminder_appts.js')).toBeLessThan(assets);
    });

    test('asset URLs are escaped and versioned per file by the helper, never by filesystem metadata', () => {
        const lines = php().split('\n');
        for (const asset of ['workspace.css', 'global-messages.css', 'mode.js']) {
            const line = lines.find((l) => l.includes(`/interface/clinical-workspace/${asset}?v=`));
            expect(line).toBeDefined();
            expect(line).toContain('attr(OEGlobalsBag::getInstance()->getWebRoot())');
            expect(line).toContain(`attr_url($clinicalAssets->version('${asset}'))`);
            expect(line).not.toMatch(/filemtime|__DIR__|v_js_includes/);
        }
        // workspace.css is not media-scoped internally, so the link keeps it off print.
        expect(php()).toMatch(/<link rel="stylesheet" media="screen" href="[^"]*workspace\.css\?v=/);
        expect(read('src/Common/Assets/ClinicalWorkspaceAssets.php')).toMatch(/^\s*'global-messages\.css',$/m);
    });

    test('route body class is distinct from the patient messages routes', () => {
        const source = php();
        expect(count(source, '<body')).toBe(1);
        expect(source).not.toMatch(/oe-clinical-messages|oe-clinical-message-compose|patient-messages\.css/);
        expect(source).not.toMatch(/global-messages\.js/);
    });

    test('every control, gate, handler and hook keeps its count and order', () => {
        const source = php();
        // Counts recorded from 5619373.
        const original = {
            'top.restoreSession()': 25,
            'aclCheckCore(': 1,
            'checkPnotesNoteId(': 4,
            'CsrfUtils::collectCsrfToken(': 2,
            '$MedEx->': 10,
            '$_REQUEST[': 25,
            'class="btn': 9,
            "class='btn": 2,
            'onclick=': 23,
            'dlgopen(': 2,
            'sqlStatement(': 2,
            'sqlQuery(': 2,
            'generate_form_field(': 3,
            'EventAuditLogger': 2,
            'getPnotesByUser(': 2,
            'window.open(': 3,
            'messages-item-row': 2,
            'messages-item-link': 2,
            'confirmDeleteSelected': 2,
            'selectRow(': 4,
            'deselectRow(': 2,
            'data-toggle="pill"': 4,
            'tab-pane': 4,
            '$oemr_ui->pageHeading()': 1,
            '$oemr_ui->oeBelowContainerDiv()': 1,
            'help_modal.php': 2,
            'dated_reminders.php': 1,
            'goReminderRecall(': 2,
            'SMS_direct()': 2,
            'trusted-messages-force-check': 2,
            '<title>': 8,
            'exit': 4,
        };
        for (const [token, expected] of Object.entries(original)) {
            expect([token, count(source, token)]).toEqual([token, expected]);
        }
        const ids = [...source.matchAll(/\b(?:id|name)=(['"])([^'"<>]*?)\1/g)].map((m) => m[2]);
        expect(ids).toEqual(['description', 'author', 'help-href', 'help-href', 'help-href', 'help-href', 'container_div',
            'main-nav-pills', 'li-mess', 'messages-li', 'li-remi', 'reminders-li', 'li-reca', 'recalls-li', 'li-sms', 'sms-li',
            'content', 'messages-div', 'Just Mine', 'just-mine-tooltip', 'See All', 'see-all-tooltip', 'form_patient', 'new_note',
            'noteid', 'noteid', 'task', 'task', 'attachment_id', 'attachment_id', 'attachment_type', 'attachment_type',
            'form_patient', 'form_patient', 'reply_to', 'reply_to', 'clear_patients', 'assigned_to_text', 'assigned_to_text',
            'assigned_to', 'assigned_to', 'users', 'users', 'clear_user', 'clear_user', 'note', 'note', 'newnote', 'printnote',
            'cancel', 'newnote', 'cancel', 'MessageList', 'MessageList', 'task', 'checkAll', 'reminders-div', 'recalls-div',
            'sms-div', 'smsForm', 'SMS_patient', 'open-sms-tooltip', 'sms_pid', 'sms_mobile', 'sms_allow']);
    });
});

describe('global-messages.css contract', () => {
    test('every rule is screen-only and scoped to the active workbench message board', () => {
        const found = rules();
        expect(found.length).toBeGreaterThan(15);
        for (const { rule, selectors } of found) {
            expect(rule.parent.type).toBe('atrule');
            expect(rule.parent.params).toBe('screen');
            for (const selector of selectors) {
                expect([selector, selector === scope || selector.startsWith(`${scope} `)]).toEqual([selector, true]);
            }
        }
        postcss.parse(css()).walkAtRules((atRule) => {
            // No width queries: keeps the stylelint prefix-notation allowlist unchanged.
            expect([atRule.name, atRule.params]).toEqual(['media', 'screen']);
        });
        expect(css()).not.toMatch(/@import|\bcontent:/);
    });

    test('reference Arial 14px rhythm on the board', () => {
        const body = merged(scope);
        expect(body['font-family']).toBe('Arial, Helvetica, sans-serif');
        expect(body['font-size']).toBe('14px');
        expect(body['line-height']).toBe('1.5');
        expect(body.overflow).toBeUndefined();
        expect(body['overflow-x']).toBeUndefined();
    });

    test('page heading is a 28px wrapping document title with readable heading actions', () => {
        const navbar = `${scope} #container_div > .row .navbar`;
        const bar = rules().find(({ selectors }) => selectors.includes(navbar));
        expect(bar).toBeDefined();
        // The heading partial is bg-light (an !important utility); a transparent heading needs the same weight.
        expect(bar.declarations.background).toBe('transparent');
        expect(bar.important).toEqual(['background']);
        expect(bar.declarations['flex-wrap']).toBe('wrap');
        const brand = merged(`${navbar} .navbar-brand`);
        expect(brand['font-size']).toBe('28px');
        expect(brand['font-weight']).toBe('650');
        expect(brand['line-height']).toBe('1.2');
        expect(brand['white-space']).toBe('normal');
        expect(brand['overflow-wrap']).toBe('anywhere');
        expect(brand.color).toBe('var(--oe-ink, #17343b)');
        // Dark navbar-light links are translucent white; on the light canvas they need their own ink.
        expect(merged(`${navbar} #pageHeadingNav .nav-link`).color).toBe('var(--oe-muted, #526a70)');
    });

    test('tabs and filter toolbar wrap and pair their colours', () => {
        const pills = rules().find(({ selectors }) => selectors.includes(`${scope} #main-nav-pills`));
        expect(pills.declarations['background-color']).toBe('var(--oe-paper, #fff)');
        expect(pills.important).toEqual(['background-color']);
        expect(pills.declarations['flex-wrap']).toBe('wrap');
        expect(merged(`${scope} #main-nav-pills .nav-link`).color).toBe('var(--oe-petrol, #086878)');
        const active = merged(`${scope} #main-nav-pills .nav-link.active`);
        expect(active.color).toBe('#fff');
        expect(active['background-color']).toBe('var(--oe-petrol, #086878)');

        const toolbar = merged(`${scope} #messages-div > .col-sm-12 > .d-flex`);
        expect(toolbar['flex-wrap']).toBe('wrap');
        const filters = merged(`${scope} #messages-div > .col-sm-12 > .d-flex > .nav`);
        expect(filters['flex-wrap']).toBe('wrap');
        // Current filter (a disabled span) reads as the selected chip, not as low-contrast grey.
        const current = merged(`${scope} #messages-div > .col-sm-12 > .d-flex .nav-link.disabled`);
        expect(current.color).toBe('var(--oe-ink, #17343b)');
        expect(current['background-color']).toBe('#e4f0f1');
        // The See All / Just Mine icon is the only content of its link; .text-body is an !important utility.
        const icon = rules().find(({ selectors }) => selectors.includes(`${scope} #messages-div .more .text-body`));
        expect(icon.declarations.color).toBe('var(--oe-petrol, #086878)');
        expect(icon.important).toEqual(['color']);
    });

    test('only the Messages pane is a paper sheet; tab visibility stays owned by Bootstrap', () => {
        const pane = merged(PANE_SCOPE('#messages-div'));
        expect(pane.background).toBe('var(--oe-paper, #fff)');
        expect(pane.color).toBe('var(--oe-ink, #17343b)');
        expect(pane.border).toBe('1px solid var(--oe-line, #d9e4e2)');
        // No rule paints every pane: reminders, recalls and SMS keep the theme surface.
        for (const selector of selectorsOf()) {
            expect(selector).not.toMatch(/\.tab-pane|\.tab-content|#content\b/);
        }
        for (const { selectors, declarations } of rules()) {
            // Subject is a pane (toolbars inside a pane may still be flex).
            if (selectors.some((s) => /#[a-z]+-div$/.test(s))) {
                expect([selectors.join(), declarations.display]).toEqual([selectors.join(), undefined]);
            }
        }
    });

    test('reminders, recalls and SMS panes get the theme surface and colours back from the generic workspace rules', () => {
        // workspace.css paints the body canvas/ink and colours every h4 ink and every link petrol.
        // The included dated_reminders.php emits theme .text-body progress text (#f8f9fa !important in dark),
        // so these panes take the theme's own pair: --white is the theme surface, --body-color its text.
        for (const pane of OTHER_PANES) {
            const surface = merged(PANE_SCOPE(pane));
            expect([pane, surface['background-color'], surface.color]).toEqual([pane, 'var(--white)', 'var(--body-color)']);
            expect([pane, merged(`${PANE_SCOPE(pane)} h4`).color]).toEqual([pane, 'var(--body-color)']);
            expect([pane, merged(`${PANE_SCOPE(pane)} a:not(.btn)`).color]).toEqual([pane, 'var(--body-color)']);
            // workspace.css's link colour outranks the theme's .btn-secondary text, and no single theme variable
            // equals that text in both themes (light #111827 on #e5e7eb, dark #212529 on #f8f9fa). A foreground alone
            // against the theme's background measured 1.24:1 in light (native QA), so the button sets a theme pair:
            // --gray200/--body-color is exactly the light theme's button and #f8f9fa on #343a40 in dark.
            const button = merged(`${PANE_SCOPE(pane)} a.btn-secondary`);
            expect([pane, button.color, button['background-color']]).toEqual([pane, 'var(--body-color)', 'var(--gray200)']);
        }
        // Guard: a rule in these panes that sets a foreground on a button also sets that button's background.
        for (const { selectors, declarations } of rules()) {
            // Subject is a button (a.btn…), not a:not(.btn).
            if (selectors.some((s) => OTHER_PANES.some((pane) => s.includes(pane)) && /\ba\.btn/.test(s)) && declarations.color) {
                expect([selectors.join(), declarations['background-color']]).not.toEqual([selectors.join(), undefined]);
            }
        }
        // No workspace token (paper/ink/petrol/line) reaches these panes.
        for (const { selectors, declarations } of rules()) {
            if (selectors.some((s) => OTHER_PANES.some((pane) => s.includes(pane)))) {
                expect([selectors.join(), /--oe-|#[0-9a-f]{3,6}/i.test(JSON.stringify(declarations))]).toEqual([selectors.join(), false]);
            }
        }
        expect(selectorsOf().some((s) => /text-body/.test(s) && OTHER_PANES.some((pane) => s.includes(pane)))).toBe(false);
    });

    test('the original message table scrolls horizontally inside the sheet instead of widening the page', () => {
        const outer = merged(`${scope} #messages-div > .col-sm-12 > table`);
        expect(outer['table-layout']).toBe('fixed');
        const form = merged(`${scope} #MessageList`);
        expect(form['overflow-x']).toBe('auto');
        expect(form['max-width']).toBe('100%');
        expect(merged(`${scope} #MessageList > .table`)['min-width']).toMatch(/^\d+px$/);
    });

    test('table head and cells pair ink on paper, including hover and the selected-row state', () => {
        const ink = 'var(--oe-ink, #17343b)';
        const table = merged(`${scope} #MessageList > .table`);
        expect(table.color).toBe(ink);
        const th = merged(`${scope} #MessageList thead th`);
        expect(th['background-color']).toBe('#f6f8f9');
        expect(th.color).toBe('var(--oe-muted, #526a70)');
        const td = merged(`${scope} #MessageList .messages-item-row > td`);
        expect(td.color).toBe(ink);
        expect(td['background-color']).toBe('var(--oe-paper, #fff)');
        const hover = merged(`${scope} #MessageList .messages-item-row:hover > td`);
        expect(hover.color).toBe(ink);
        expect(hover['background-color']).toBe('#f0f5f6');
        // selectRow()/deselectRow()/selectAll() paint the row with theme greys (dark in the dark theme) and also
        // toggle .oe-message-selected; the cells show selection from that class in every supported browser.
        const checked = merged(`${scope} #MessageList .messages-item-row.oe-message-selected > td`);
        expect(checked['background-color']).toBe('#e4f0f1');
        expect(checked.color).toBe(ink);
        expect(css()).not.toMatch(/:has\(/);
    });

    test('action toolbar wraps and keeps theme danger; secondary links pair their own colours', () => {
        const actions = merged(`${scope} #messages-div .row.oe-margin-t-10 > div`);
        expect(actions.display).toBe('flex');
        expect(actions['flex-wrap']).toBe('wrap');
        // workspace.css colours every link petrol; the danger link gets the theme's white text back.
        expect(merged(`${scope} #messages-div a.btn-danger`)).toEqual({ color: '#fff' });
        const secondary = merged(`${scope} #messages-div a.btn-secondary`);
        expect(secondary.color).toBe('var(--oe-ink, #17343b)');
        expect(secondary['background-color']).toBe('var(--oe-paper, #fff)');
        for (const selector of selectorsOf()) {
            expect(selector).not.toMatch(/text-danger|bg-dark|bg-light|btn-delete|\.text-muted|\.bg-/);
            if (selector.includes('btn-danger')) expect(selector).toBe(`${scope} #messages-div a.btn-danger`);
        }
    });

    test('compose sheet pairs ink on paper without restyling its fields', () => {
        const sheet = merged(`${scope} #messages-div .jumbotron`);
        expect(sheet.background).toBe('var(--oe-paper, #fff)');
        expect(sheet.color).toBe('var(--oe-ink, #17343b)');
        for (const selector of selectorsOf()) {
            expect(selector).not.toMatch(/form-control|#note\b|textarea/);
        }
    });

    test('nothing is hidden, clipped or forced except the three documented utility overrides', () => {
        expect(css()).not.toMatch(/display:\s*none|visibility:\s*hidden|opacity:\s*0[;\s]|\bresize:|outline:\s*(0|none)/);
        const forced = rules().flatMap(({ selectors, important }) => important.map((prop) => `${selectors.join()}|${prop}`));
        expect(forced.sort()).toEqual([
            `${scope} #container_div > .row .navbar|background`,
            `${scope} #main-nav-pills|background-color`,
            `${scope} #messages-div .more .text-body|color`,
        ].sort());
        const hex = new Set((css().match(/#[0-9a-f]{3,6}\b/gi) || []).map((h) => h.toLowerCase()));
        const allowed = ['#17343b', '#526a70', '#d9e4e2', '#fff', '#086878', '#f6f8f9', '#e1e8eb', '#f0f5f6', '#e4f0f1'];
        for (const value of hex) expect([value, allowed.includes(value)]).toEqual([value, true]);
    });
});

describe('workbench mode controller on the message board', () => {
    const origin = () => window.location.origin;
    const frame = (body, parent) => {
        const win = { location: { origin: origin() }, document: { body } };
        win.parent = parent || win;
        return win;
    };

    test('activates under a same-origin workbench ancestor and leaves the board untouched', () => {
        document.body.className = 'body_top oe-clinical-global-messages';
        document.body.innerHTML = `<form name="MessageList" id="MessageList"><input type="hidden" name="task" value="delete">
            <input type="checkbox" id="check1" name="delete_id[]" value="7"></form>`;
        document.getElementById('check1').checked = true;
        const before = document.getElementById('MessageList').outerHTML;
        const topBody = document.createElement('body');
        topBody.className = 'workbench-active';
        const controller = createModeController({
            body: document.body,
            parentWindow: frame(document.createElement('body'), frame(topBody)),
            origin: origin(),
            observe: () => ({ disconnect() {} })
        });
        expect(document.body.className).toBe('body_top oe-clinical-global-messages oe-clinical-workspace');
        expect(document.getElementById('MessageList').outerHTML).toBe(before);
        expect(document.getElementById('check1').checked).toBe(true);
        controller.dispose();
        expect(document.body.className).toBe('body_top oe-clinical-global-messages');
    });

    test('legacy shell and direct loads keep the original presentation', () => {
        document.body.className = 'body_top oe-clinical-global-messages';
        const legacy = createModeController({
            body: document.body,
            parentWindow: frame(document.createElement('body')),
            origin: origin(),
            observe: () => ({ disconnect() {} })
        });
        expect(legacy.active).toBe(false);
        const direct = createModeController({ body: document.body, parentWindow: window, origin: origin(), observe: () => ({ disconnect() {} }) });
        expect(direct.active).toBe(false);
        expect(document.body.className).toBe('body_top oe-clinical-global-messages');
        legacy.dispose();
        direct.dispose();
    });
});
