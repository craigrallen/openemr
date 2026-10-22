/** @jest-environment node */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const postcss = require('postcss');
const selectorParser = require('postcss-selector-parser');
const { JSDOM } = require('jsdom');

const root = path.join(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const ROUTE = 'interface/patient_file/summary/advancedirectives.php';
const CALLER = 'interface/patient_file/summary/demographics.php';
const SHEET = 'interface/clinical-workspace/advance-directives-document.css';
const css = () => read(SHEET);
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const count = (text, part) => text.split(part).length - 1;

// sha256 of advancedirectives.php at master 18647270, before the workbench presentation edits.
const BASELINE = 'fb17379526f613dc9eeff48e99eafbdfda171222f9b556bbc1fe13a77d6844f5';

const link = '    <?php $clinicalAssets = new ClinicalWorkspaceAssets(); ?>\n'
    + '    <link rel="stylesheet" media="screen" href="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>'
    + '/interface/clinical-workspace/advance-directives-document.css?v=<?php echo attr_url($clinicalAssets->version(\'advance-directives-document.css\')); ?>">\n';

// The complete presentation edit map, each entry [original, presented]: one use line, one
// versioned screen link, and route/document/fields/actions/documents/attestation classes added
// to existing elements. Nothing else in the route may differ from master.
const changes = [
    ['\nuse OpenEMR\\Common\\Csrf\\CsrfUtils;\n', '\nuse OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;\nuse OpenEMR\\Common\\Csrf\\CsrfUtils;\n'],
    ["    <?php Header::setupHeader(['datetime-picker','opener']); ?>\n",
        `    <?php Header::setupHeader(['datetime-picker','opener']); ?>\n${link}`],
    ['<body class="body_top">\n    <div class="container">\n',
        '<body class="body_top oe-advance-directives">\n    <div class="container oe-ad-document">\n'],
    ['            <div class="col-12">\n                <form action=',
        '            <div class="col-12 oe-ad-fields">\n                <form action='],
    ['<div class="btn-group" role="group">', '<div class="btn-group oe-ad-actions" role="group">'],
    ['            <div class="col-12">\n                <?php\n                $query = "SELECT id FROM categories WHERE name=\'Advance Directive\'";',
        '            <div class="col-12 oe-ad-documents">\n                <?php\n                $query = "SELECT id FROM categories WHERE name=\'Advance Directive\'";'],
    ['<div class="col-12 alert-danger">', '<div class="col-12 alert-danger oe-ad-attestation">'],
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

describe('advancedirectives.php carries only the declared presentation edits', () => {
    test('reversing the full edit map restores the exact original route digest', () => {
        const php = read(ROUTE);
        for (const [, after] of changes) expect([after, count(php, after)]).toEqual([after, 1]);
        const restored = restore(php);
        expect(restored).not.toBeNull();
        expect(sha(restored)).toBe(BASELINE);
    });

    test('the route sheet is linked once, screen only, versioned through the helper, after the original Header', () => {
        const php = read(ROUTE);
        expect(count(php, 'advance-directives-document.css')).toBe(2);
        expect(count(php, link)).toBe(1);
        expect(php).not.toMatch(/clinical-workspace\/(workspace|popup|mode)\.(css|js)/);
        expect(php).not.toMatch(/setupAssets|mode\.js|workspace\.css/);
        expect(php.indexOf('advance-directives-document.css')).toBeGreaterThan(php.indexOf('Header::setupHeader('));
        // Before the POST branch and the inline script: the link is inside <head> on every path.
        expect(php.indexOf('advance-directives-document.css')).toBeLessThan(php.indexOf("if ($_POST['form_yesno'])"));
        expect(php).not.toMatch(/media="print"|@media print/);
    });

    test('original SQL, session, CSRF, user, fields, controls, links and warning text are present verbatim', () => {
        const php = read(ROUTE);
        for (const fragment of [
            'require_once("../../globals.php");\n',
            '$session = \\OpenEMR\\Common\\Session\\SessionWrapperFactory::getInstance()->getActiveSession();\n',
            "    <?php Header::setupHeader(['datetime-picker','opener']); ?>\n",
            "$pid ??= $session->get('pid');",
            "if ($_POST['form_yesno']) {\n        CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: true);",
            "$form_yesno = filter_input(INPUT_POST, 'form_yesno');",
            "$form_adreviewed = DateTimeToYYYYMMDDHHMMSS(filter_input(INPUT_POST, 'form_adreviewed'));",
            'QueryUtils::sqlStatementThrowException("UPDATE patient_data SET completed_ad = ?, ad_reviewed = ?"\n        . " ,advance_directive_user_authenticator = ? where pid = ?"\n            , [$form_yesno,$form_adreviewed, $session->get(\'authUserID\'), $pid]);',
            'echo " if (!opener.closed && opener.refreshme) opener.refreshme();\\n";\n        echo " dlgclose();\\n";',
            '$sql = "select completed_ad, ad_reviewed from patient_data where pid = ?";',
            "$userRecord = $userService->getUser($session->get('authUserID'));",
            "if (f.form_adreviewed.value == \"\") {\n                  alert(<?php echo xlj('Please enter a date for Last Reviewed.'); ?>);\n                  f.form_adreviewed.focus();\n                  return false;\n            }\n            return true;",
            '$("#cancel").click(function() { dlgclose(); });',
            "<form action='advancedirectives.php' method='post' onsubmit='return validate(this)'>",
            '<input type="hidden" name="csrf_token_form" value="<?php echo CsrfUtils::collectCsrfToken(session: $session); ?>" />',
            '<label for="form_yesno"><?php echo xlt(\'Completed\'); ?></label>',
            "<?php generate_form_field(['data_type' => 1,'field_id' => 'yesno','list_id' => 'yesno','empty_title' => 'SKIP'], $form_completedad); ?>",
            '<label for="form_adreviewed"><?php echo xlt(\'Last Reviewed\'); ?></label>',
            "<?php generate_form_field(['data_type' => 4,'field_id' => 'adreviewed', 'edit_options' => 'F'], $form_adreviewed); ?>",
            '<button type="submit" id="create" class="btn btn-secondary btn-save"><?php echo xla(\'Save\'); ?></button>',
            '<button type="button" id="cancel" class="btn btn-link btn-cancel"><?php echo xla(\'Cancel\'); ?></button>',
            '$query = "SELECT id, name FROM categories WHERE parent = ?";',
            '"AND documents.foreign_id=? AND documents.deleted = 0 " .',
            '"ORDER BY documents.date DESC";',
            "<a href='<?php echo $web_root; ?>/controller.php?document&retrieve&patient_id=<?php echo attr_url($pid); ?>&document_id=<?php echo attr_url($idDoc); ?>&as_file=true'>",
            '<?php echo text(xl_document_category($nameDoc)); ?>',
            "<br /><?php echo text($nameDoc); ?><span style='color:red;'>[<?php echo xlt('EMPTY'); ?>]</span>",
            "<?php if (empty($userRecord['npi'])) : ?>",
            '<!-- API will not be able to provide the legal attestation for which user that reviewed this information without a valid medical license number (NPI) -->',
            '<p><?php echo xlt("No national provider number is setup for your account."); ?></p>',
            '<p><?php echo xlt("The system will not be able to provide legal attestation that you have reviewed this information without a valid national provider number."); ?></p>',
        ]) {
            expect([fragment, count(php, fragment)]).toEqual([fragment, 1]);
        }
    });

    test('the real demographics caller is byte-identical and still opens the route through dlgopen at 400x500', () => {
        const caller = read(CALLER);
        expect(sha(caller)).toBe('00554d54565a92ee3b71a79053ac4f3daf55def3501d3dce6cf284d4615cbd3a');
        expect(count(caller, "dlgopen('advancedirectives.php', '_blank', 400, 500);")).toBe(1);
    });
});

test('negative controls: SQL, CSRF, session, user, fields, controls, links or warning cannot change unnoticed', () => {
    const mutations = [
        ["if ($_POST['form_yesno']) {", "if (!empty($_POST['form_yesno'])) {"],
        ['CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: true);', ''],
        ["filter_input(INPUT_POST, 'form_yesno')", "filter_input(INPUT_GET, 'form_yesno')"],
        ['UPDATE patient_data SET completed_ad = ?, ad_reviewed = ?', 'UPDATE patient_data SET completed_ad = ?'],
        [" ,advance_directive_user_authenticator = ? where pid = ?", ' where pid = ?'],
        ["$session->get('authUserID'), $pid]", '$pid, $pid]'],
        ['opener.refreshme();\\n', 'opener.location.reload();\\n'],
        ['echo " dlgclose();\\n";', 'echo " window.close();\\n";'],
        ['select completed_ad, ad_reviewed from patient_data where pid = ?', 'select * from patient_data where pid = ?'],
        ["$userRecord = $userService->getUser($session->get('authUserID'));", '$userRecord = [];'],
        ['if (f.form_adreviewed.value == "") {', 'if (!f.form_adreviewed.value.trim()) {'],
        ["xlj('Please enter a date for Last Reviewed.')", "xlj('Date?')"],
        ['$("#cancel").click(function() { dlgclose(); });', '$("#cancel").click(function() { window.close(); });'],
        ['<?php $datetimepicker_showseconds = true; ?>', '<?php $datetimepicker_showseconds = false; ?>'],
        ["method='post' onsubmit='return validate(this)'", "method='post'"],
        ['name="csrf_token_form"', 'name="csrf_token"'],
        ["'list_id' => 'yesno','empty_title' => 'SKIP'", "'list_id' => 'yesno','empty_title' => 'Unassigned'"],
        ["'data_type' => 4,'field_id' => 'adreviewed', 'edit_options' => 'F'", "'data_type' => 4,'field_id' => 'adreviewed'"],
        ['type="submit" id="create"', 'type="button" id="create"'],
        ['id="cancel" class="btn btn-link btn-cancel"', 'id="cancel" class="btn btn-secondary btn-cancel"'],
        ["WHERE name='Advance Directive'", "WHERE name='Advance Directives'"],
        ['AND documents.deleted = 0 ', ''],
        ['ORDER BY documents.date DESC', 'ORDER BY documents.date ASC'],
        ['&as_file=true', '&as_file=false'],
        ["<span style='color:red;'>", "<span class='text-danger'>"],
        ["<?php if (empty($userRecord['npi'])) : ?>", '<?php if (false) : ?>'],
        ['No national provider number is setup for your account.', 'No national provider number is set up for your account.'],
        ['The system will not be able to provide legal attestation', 'The system will provide legal attestation'],
    ];
    const php = read(ROUTE);
    for (const [from, to] of mutations) {
        expect([from, count(php, from)]).toEqual([from, 1]);
        const restored = restore(php.replace(from, () => to));
        expect([from, restored === null ? null : sha(restored)]).not.toEqual([from, BASELINE]);
    }
    // A stray attribute or a dropped presentation hook is caught too.
    expect(sha(restore(php.replace('id="create" class=', 'id="create" disabled class=')))).not.toBe(BASELINE);
    expect(restore(php.replace(' oe-ad-attestation', ''))).toBeNull();
    expect(restore(php.replace('<body class="body_top oe-advance-directives">', '<body class="body_top">'))).toBeNull();
});

test('the asset helper allowlists exactly the new basename, in order', () => {
    const helper = read('src/Common/Assets/ClinicalWorkspaceAssets.php');
    expect(helper).toMatch(/\[\n {8}'advance-directives-document\.css',\n {8}'ajtooltip\.js',\n/);
    expect(count(helper, 'advance-directives')).toBe(1);
});

// --- The original validate() callback, executed in a real DOM ------------------------------------

const validateSource = () => {
    const php = read(ROUTE);
    const start = php.indexOf('        function validate(f) {');
    const end = php.indexOf('        $(function () {', start);
    const js = php.slice(start, end).replace(/<\?php echo xlj\('([^']*)'\); \?>/g, (_, text) => JSON.stringify(text));
    expect(js).not.toContain('<?php');
    return js;
};
const formTag = () => read(ROUTE).match(/<form action='advancedirectives\.php'[^>]*>/)[0];

describe('original validate() runs unchanged through the original onsubmit', () => {
    const page = () => {
        const { window } = new JSDOM(`${formTag()}<input type="text" name="form_adreviewed" id="form_adreviewed"></form>`, { runScripts: 'dangerously' });
        const calls = { alerts: [], submitted: 0 };
        window.alert = message => { calls.alerts.push(message); };
        window.eval(validateSource());
        const form = window.document.forms[0];
        Object.defineProperty(form, 'form_adreviewed', { get: () => form.elements.namedItem('form_adreviewed') });
        form.addEventListener('submit', event => { if (!event.defaultPrevented) calls.submitted++; event.preventDefault(); });
        return { window, form, calls };
    };

    test('an empty Last Reviewed date: native alert, focus returns to the field, no submit', () => {
        const { window, form, calls } = page();
        form.requestSubmit();
        expect(calls).toEqual({ alerts: ['Please enter a date for Last Reviewed.'], submitted: 0 });
        expect(window.document.activeElement).toBe(form.form_adreviewed);
    });

    test('a synthetic date submits without an alert', () => {
        const { form, calls } = page();
        form.form_adreviewed.value = '2000-01-01 00:00:00';
        form.requestSubmit();
        expect(calls).toEqual({ alerts: [], submitted: 1 });
    });
});

// --- Route stylesheet ----------------------------------------------------------------------------

const SCOPE = 'html.oe-workbench-context body.oe-advance-directives';
const at = part => `${SCOPE} ${part}`;
const GUARD = ':not(.is-invalid, .is-valid, .was-validated *)';
const FIELD = `.oe-ad-fields .form-control${GUARD}`;
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

test('the sheet is one @media screen block, positive-scoped to the context marker and the route body', () => {
    const tree = postcss.parse(css());
    const top = tree.nodes.filter(node => node.type !== 'comment');
    expect(top).toHaveLength(1);
    expect(top[0].type === 'atrule' && top[0].name === 'media' && top[0].params).toBe('screen');
    const media = [];
    tree.walkAtRules(rule => media.push(`${rule.name} ${rule.params}`));
    expect(media).toEqual(['media screen']);
    const all = rules();
    expect(all.length).toBeGreaterThan(10);
    for (const { selectors } of all) {
        for (const selector of selectors) {
            expect(selector === SCOPE || selector.startsWith(`${SCOPE} `)).toBe(true);
            expect(selector).not.toMatch(/oe-clinical-workspace|workbench-active|oe-workbench-popup|print|xdsoft|select2|\.modal|\[style/);
        }
    }
});

test('typography is inherited: no font family, size, spacing or case replacement', () => {
    for (const { decls } of rules()) {
        for (const prop of ['font', 'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'text-transform', 'zoom', 'transform']) {
            expect(decls[prop]).toBeUndefined();
        }
    }
});

test('nothing is hidden, clipped, shrunk, disabled or reordered; logical properties only', () => {
    for (const { decls } of rules()) {
        expect(decls.display ?? '').not.toMatch(/none|contents|grid/);
        expect(decls.visibility).toBeUndefined();
        expect(decls.order).toBeUndefined();
        expect(decls.position ?? '').not.toMatch(/fixed|absolute|sticky/);
        expect(decls['text-overflow']).toBeUndefined();
        expect(decls['white-space'] ?? 'normal').toBe('normal');
        expect(decls.overflow ?? '').not.toMatch(/hidden|clip/);
        expect(decls['overflow-x'] ?? '').not.toMatch(/hidden|clip/);
        expect(decls.height).toBeUndefined();
        expect(decls['max-height']).toBeUndefined();
        expect(decls['min-width']).toBeUndefined();
        expect(decls.width ?? '100%').toBe('100%');
        for (const prop of Object.keys(decls)) {
            expect(prop).not.toMatch(/(^|-)(left|right|top|bottom)($|-)/);
            expect(prop).not.toBe('float');
        }
        expect(decls['text-align'] ?? 'start').toMatch(/^(start|end)$/);
    }
    expect(css()).not.toMatch(/pointer-events|user-select|opacity|content:|clip-path/);
    // !important exists only to answer the theme's own !important .btn-link paint on Cancel.
    const important = rules().flatMap(({ selectors, decls }) => Object.entries(decls)
        .filter(([, value]) => value.endsWith(' !important')).map(([prop]) => `${selectors.join(', ')} ${prop}`));
    expect(important).toEqual([`${at('.oe-ad-actions .btn-cancel')} color`, `${at('.oe-ad-actions .btn-cancel')} background`]);
});

test('document shape: canvas body, paper sheet, stacked fields, document links area and attestation warning', () => {
    expect(declsFor(SCOPE)).toMatchObject({ margin: '0', color: 'var(--oe-wb-ink)', background: 'var(--oe-wb-canvas)' });
    expect(declsFor(at('.oe-ad-document'))).toMatchObject({
        color: 'var(--oe-wb-ink)', background: 'var(--oe-wb-paper)', border: '1px solid var(--oe-wb-line)',
        'border-radius': expect.any(String), 'padding-inline': expect.stringMatching(/rem$/), 'overflow-x': 'auto',
    });
    expect(declsFor(at('.oe-ad-fields .form-group'))).toMatchObject({ 'margin-block-end': expect.any(String) });
    expect(declsFor(at('.oe-ad-fields label'))).toMatchObject({ display: 'block', color: 'var(--oe-wb-ink)', background: 'var(--oe-wb-paper)' });
    expect(declsFor(at('.oe-ad-documents'))).toMatchObject({
        color: 'var(--oe-wb-ink)', background: 'var(--oe-wb-paper)', 'overflow-wrap': 'anywhere',
    });
    expect(declsFor(at('hr'))).toMatchObject({ 'border-block-start-color': 'var(--oe-wb-line)' });
    expect(declsFor(at('.oe-ad-attestation'))).toMatchObject({
        color: 'var(--oe-wb-warning-ink)', background: 'var(--oe-wb-warning-paper)', 'border-inline-start': expect.stringContaining('var(--oe-wb-warning-ink)'),
    });
});

const tokens = (() => {
    const out = {};
    postcss.parse(read('interface/clinical-workspace/popup.css')).walkRules(rule => {
        if (!rule.selectors.includes('html.oe-workbench-context')) return;
        rule.walkDecls(d => { if (d.prop.startsWith('--oe-wb-')) out[d.prop] = d.value; });
    });
    return out;
})();
const luminance = hex => {
    const full = hex.length === 4 ? `#${[...hex.slice(1)].map(c => c + c).join('')}` : hex;
    const [r, g, b] = [1, 3, 5].map(i => parseInt(full.slice(i, i + 2), 16) / 255)
        .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
};
const tokenValue = value => tokens[value.match(/^var\((--oe-wb-[a-z-]+)\)( !important)?$/)[1]];
const LINK = '.oe-ad-documents a';
const SAVE = '.oe-ad-actions .btn-save';
const CANCEL = '.oe-ad-actions .btn-cancel';

test('light and dark themes: fields, focus, links, actions and warning pair fixed ink with a surface', () => {
    const paired = [
        SCOPE, at('h3'), at('.oe-ad-document'), at('.oe-ad-fields label'),
        at(FIELD), at(`${FIELD}:focus`),
        at('.oe-ad-documents'), at(LINK), at(`${LINK}:hover`),
        at(SAVE), at(CANCEL), at('.oe-ad-attestation'),
    ];
    for (const selector of paired) {
        const { color, background } = declsFor(selector);
        expect([selector, color]).toEqual([selector, expect.stringMatching(/^var\(--oe-wb-[a-z-]+\)( !important)?$/)]);
        expect([selector, background]).toEqual([selector, expect.stringMatching(/^var\(--oe-wb-[a-z-]+\)( !important)?$/)]);
        expect([selector, contrast(tokenValue(color), tokenValue(background)) >= 4.5]).toEqual([selector, true]);
    }
    // Placeholder text has no surface of its own: it sits on the field's paper.
    const placeholder = declsFor(at(`${FIELD}::placeholder`));
    expect(placeholder.color).toBe('var(--oe-wb-muted)');
    expect(contrast(tokenValue(placeholder.color), tokenValue(declsFor(at(FIELD)).background))).toBeGreaterThanOrEqual(4.5);
    for (const { selectors, decls } of rules()) {
        if (selectors.every(s => s.endsWith('::placeholder'))) continue;
        const hasInk = 'color' in decls;
        const hasSurface = 'background' in decls || 'background-color' in decls;
        expect([selectors[0], hasInk]).toEqual([selectors[0], hasSurface]);
    }
    for (const { decls } of rules()) {
        for (const value of Object.values(decls)) expect(value).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|hsl\(|\b(white|black|red)\b/i);
    }
    for (const used of css().match(/--oe-wb-[a-z-]+/g)) {
        expect(['--oe-wb-ink', '--oe-wb-muted', '--oe-wb-canvas', '--oe-wb-paper', '--oe-wb-petrol', '--oe-wb-on-petrol',
            '--oe-wb-line', '--oe-wb-warning-ink', '--oe-wb-warning-paper']).toContain(used);
    }
});

test('validation semantics: field paint skips Bootstrap validation states and inline styles', () => {
    const paint = /^(color|background|background-color|border|border-color|outline|box-shadow)$/;
    for (const { selectors, decls } of rules()) {
        if (!Object.keys(decls).some(prop => paint.test(prop))) continue;
        for (const selector of selectors.filter(s => /form-control|select|input/.test(s))) {
            expect(selector).toContain(GUARD);
        }
    }
    expect(css()).not.toMatch(/\[style|text-danger|bg-danger|\.alert-danger|is-invalid\b(?!, \.is-valid)/);
});

test('focus stays visible: :focus fallback plus :focus-visible on links and buttons, focused fields restated', () => {
    expect(declsFor(at(`${FIELD}:focus`))).toMatchObject({
        color: 'var(--oe-wb-ink)', background: 'var(--oe-wb-paper)', outline: '2px solid var(--oe-wb-petrol)', 'outline-offset': expect.any(String),
    });
    for (const target of [LINK, '.oe-ad-actions .btn']) {
        for (const state of [':focus', ':focus-visible']) {
            expect(declsFor(at(`${target}${state}`))).toMatchObject({ outline: '2px solid var(--oe-wb-petrol)', 'outline-offset': expect.any(String) });
            // Each state is its own rule: a browser without :focus-visible drops the whole
            // selector list it appears in, which would take the :focus fallback with it.
            const owners = rules().filter(r => r.selectors.includes(at(`${target}${state}`)));
            expect(owners.map(r => r.selectors)).toEqual([[at(`${target}${state}`)]]);
        }
    }
    for (const { selectors } of rules()) {
        if (selectors.some(s => s.includes(':focus-visible'))) expect(selectors).toHaveLength(1);
    }
    expect(css()).not.toMatch(/outline:\s*(0|none)|outline-color:\s*transparent/);
});

// The colour themes (color_base.scss imports colors/utilities/bootstrap.scss) paint every
// .btn-link, Cancel included, with !important ink and surface in every state. Header loads the
// theme before the route sheet. An !important author declaration beats any normal one, so
// Cancel's paired palette only reaches the button if its ink and surface are !important too and
// its selector out-specifies every theme selector.
const specificity = selector => {
    const score = [0, 0, 0];
    selectorParser(nodes => nodes.walk(node => {
        if (node.type === 'id') score[0] += 1;
        else if (node.type === 'class' || node.type === 'attribute') score[1] += 1;
        else if (node.type === 'pseudo') score[node.value.startsWith('::') ? 2 : 1] += 1;
        else if (node.type === 'tag') score[2] += 1;
    })).processSync(selector);
    return score;
};
const beats = (a, b) => a[0] !== b[0] ? a[0] > b[0] : a[1] !== b[1] ? a[1] > b[1] : a[2] > b[2];
const themeBtnLink = (() => {
    const out = [];
    const resolve = (rule, parents) => rule.selectors.flatMap(s => (parents.length
        ? parents.map(p => (s.includes('&') ? s.replace(/&/g, p) : `${p} ${s}`)) : [s]));
    const walk = (node, parents) => node.each(child => {
        if (child.type === 'atrule') walk(child, parents);
        if (child.type !== 'rule') return;
        const selectors = resolve(child, parents);
        child.each(d => {
            if (d.type === 'decl' && d.important && ['color', 'background', 'background-color'].includes(d.prop)) {
                for (const selector of selectors.filter(s => s.includes('.btn-link'))) out.push({ selector, prop: d.prop });
            }
        });
        walk(child, selectors);
    });
    walk(postcss.parse(read('interface/themes/colors/utilities/bootstrap.scss')), []);
    return out;
})();

test('Cancel keeps its paired palette against the colour themes\' !important .btn-link paint', () => {
    expect(themeBtnLink.map(r => r.selector)).toEqual(expect.arrayContaining(['.btn-link', '.btn-link:hover', '.btn-link:focus', '.btn-link:active']));
    expect(new Set(themeBtnLink.map(r => r.prop))).toEqual(new Set(['color', 'background']));
    const cancel = declsFor(at(CANCEL));
    expect(cancel).toMatchObject({ color: 'var(--oe-wb-petrol) !important', background: 'var(--oe-wb-paper) !important' });
    for (const { selector } of themeBtnLink) {
        expect([selector, beats(specificity(at(CANCEL)), specificity(selector))]).toEqual([selector, true]);
    }
});

test('jsdom: rules only match under the context marker plus the route body', () => {
    const { document } = new JSDOM('').window;
    const selectors = rules().flatMap(r => r.selectors).filter(s => s.endsWith('.oe-ad-document'));
    const matches = (htmlClass, bodyClass) => {
        document.documentElement.className = htmlClass;
        document.body.className = bodyClass;
        document.body.innerHTML = '<div class="container oe-ad-document"></div>';
        return selectors.some(s => document.querySelector('.oe-ad-document').matches(s));
    };
    expect(matches('oe-workbench-context oe-workbench-popup', 'body_top oe-advance-directives')).toBe(true);
    expect(matches('oe-workbench-popup', 'body_top oe-advance-directives')).toBe(false);
    expect(matches('', 'body_top oe-advance-directives')).toBe(false);
    expect(matches('oe-workbench-context', 'body_top')).toBe(false);
});

// Real popup.js controllers in real JSDOM windows; the shell is synthetic and toggled by hand.
describe('route sheet follows the real production popup.js context', () => {
    const ORIGIN = 'https://emr.test';
    const makeWindow = (markup, { url = `${ORIGIN}/interface/patient_file/summary/advancedirectives.php`, parent, opener, frameElement } = {}) => {
        const { window } = new JSDOM(markup, { url, runScripts: 'outside-only' });
        if (parent) Object.defineProperty(window, 'parent', { configurable: true, get: () => parent });
        if (frameElement) Object.defineProperty(window, 'frameElement', { configurable: true, get: () => frameElement });
        if (opener) window.opener = opener;
        return window;
    };
    const makeShell = () => makeWindow(
        '<body class="workbench-active"><div id="mainBox"><button type="button" data-workbench-mode></button></div>'
        + '<div class="modal fade dialogModal"><div class="modal-dialog"><div class="modal-content">'
        + '<iframe class="modalIframe"></iframe></div></div></div></body>',
        { url: `${ORIGIN}/interface/main/tabs/main.php` },
    );
    const route = '<body class="body_top oe-advance-directives"><div class="container oe-ad-document"></div></body>';
    const controller = win => {
        jest.resetModules();
        return require('../../interface/clinical-workspace/popup.js').createPopupController({ win });
    };
    const engaged = win => {
        const sheet = win.document.querySelector('.oe-ad-document');
        return rules().flatMap(r => r.selectors).filter(s => s.endsWith(' .oe-ad-document')).some(s => sheet.matches(s));
    };
    const flush = () => new Promise(resolve => setTimeout(resolve, 0));

    test('the dlgopen frame of an active workbench engages the sheet; legacy mode removes and restores it', async () => {
        const shell = makeShell();
        const win = makeWindow(route, { parent: shell, frameElement: shell.document.querySelector('iframe.modalIframe') });
        expect(controller(win).active).toBe(true);
        expect(engaged(win)).toBe(true);
        shell.document.body.classList.remove('workbench-active');
        await flush();
        expect(engaged(win)).toBe(false);
        shell.document.body.classList.add('workbench-active');
        await flush();
        expect(engaged(win)).toBe(true);
    });

    test('an inactive shell, a standalone window and a non-workbench opener stay legacy', () => {
        const inactive = makeShell();
        inactive.document.body.classList.remove('workbench-active');
        const dialogWin = makeWindow(route, { parent: inactive, frameElement: inactive.document.querySelector('iframe.modalIframe') });
        expect(controller(dialogWin).active).toBe(false);
        expect(engaged(dialogWin)).toBe(false);
        const standalone = makeWindow(route);
        controller(standalone);
        expect(engaged(standalone)).toBe(false);
        const opened = makeWindow(route, { opener: makeWindow('<body class="body_top"></body>') });
        controller(opened);
        expect(engaged(opened)).toBe(false);
    });
});

// Declared-box estimate (16px rem), not a browser layout measurement.
describe.each([146, 180])('narrow %ipx frame: declared-box estimate', width => {
    const px = value => {
        if (value === '0' || value === 'auto') return 0;
        const m = String(value).match(/^(\d*\.?\d+)(px|rem)$/);
        expect(m).not.toBeNull();
        return Number(m[1]) * (m[2] === 'rem' ? 16 : 1);
    };

    test('Save and Cancel keep full-size type, wrap onto separate lines and break long labels', () => {
        const body = declsFor(SCOPE);
        const sheet = declsFor(at('.oe-ad-document'));
        const inner = width - 2 * px(body.margin) - 2 * px(sheet['margin-inline'] ?? '0')
            - 2 * px(sheet['padding-inline']) - 2 * px(sheet.border.split(' ')[0]);
        expect(inner).toBeGreaterThanOrEqual(100);
        expect(declsFor(at('.oe-ad-actions'))).toMatchObject({ 'flex-wrap': 'wrap', 'max-width': '100%', gap: expect.any(String) });
        const button = declsFor(at('.oe-ad-actions .btn'));
        expect(button).toMatchObject({ 'max-width': '100%', 'white-space': 'normal', 'overflow-wrap': 'anywhere' });
        for (const prop of ['font-size', 'width', 'padding', 'display']) expect(button[prop]).toBeUndefined();
    });
});
