/** @jest-environment jsdom */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const postcss = require('postcss');

const root = path.join(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const source = () => read('interface/patient_file/summary/add_edit_issue.php');
const css = () => read('interface/clinical-workspace/issue-popup.css');
// sha256 of add_edit_issue.php before the workbench presentation edits.
const baselineHash = '2b5ef5dde0f28164529a8ed98ded4eee7ec66338db06d558b5ba699171258224';
const scope = 'html.oe-workbench-popup body.oe-issue-editor';

// Every edit is [original, presented]. Only classes and layout-only wrappers are added.
const changes = [
    ['use OpenEMR\\Common\\Acl\\AclMain;\nuse OpenEMR\\Common\\Csrf\\CsrfUtils;', 'use OpenEMR\\Common\\Acl\\AclMain;\nuse OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;\nuse OpenEMR\\Common\\Csrf\\CsrfUtils;'],
    ["<title><?php echo ($issue) ? xlt('Edit Issue') : xlt('Add New Issue'); ?></title>\n", "<title><?php echo ($issue) ? xlt('Edit Issue') : xlt('Add New Issue'); ?></title>\n<?php $clinicalAssets = new ClinicalWorkspaceAssets(); ?>\n<link rel=\"stylesheet\" media=\"screen\" href=\"<?php echo attr($webroot); ?>/interface/clinical-workspace/issue-popup.css?v=<?php echo attr_url($clinicalAssets->version('issue-popup.css')); ?>\">\n"],
    ['</head>\n<body>\n    <div class="container-fluid mt-3">\n        <ul class="tabNav">', '</head>\n<body class="oe-issue-editor">\n    <div class="container-fluid mt-3 oe-issue-sheet">\n        <ul class="tabNav oe-issue-tabs">'],
    ["        <div class=\"tabContainer\">\n            <div class='tab current h-auto'>\n                <form name='theform' method=\"post\" onsubmit='return validate()'>\n                    <div class=\"container-fluid\">\n                        <div class=\"row\">\n                            <div class='col-sm-6'>", "        <div class=\"tabContainer oe-issue-tab-container\">\n            <div class='tab current h-auto'>\n                <form name='theform' method=\"post\" onsubmit='return validate()' class=\"oe-issue-form\">\n                    <div class=\"container-fluid oe-issue-document\">\n                        <div class=\"row oe-issue-header\">\n                            <div class='col-sm-6 oe-issue-type'>"],
    ["                                    <label><?php echo xlt('Type'); ?>:</label>\n                                    <?php\n                                    $index = 0;", "                                    <label><?php echo xlt('Type'); ?>:</label>\n                                    <div class=\"oe-issue-type-options\">\n                                    <?php\n                                    $index = 0;"],
    ["                                        ++$index;\n                                    }\n                                    ?>\n                            </div>\n                            <div class=\"col-md-6 d-flex justify-content-end\">", "                                        ++$index;\n                                    }\n                                    ?>\n                                    </div>\n                            </div>\n                            <div class=\"col-md-6 d-flex justify-content-end oe-issue-status\">"],
    ["                        <div class=\"row\">\n                            <div class=\"form-group col\" id='row_titles'>", "                        <div class=\"row oe-issue-identity\">\n                            <div class=\"form-group col\" id='row_titles'>"],
    ["                            <div class=\"form-group col\">\n                                <label for=\"title_diagnosis\">", "                            <div class=\"form-group col oe-issue-title\">\n                                <label for=\"title_diagnosis\">"],
    ["                            <div class=\"form-group col-sm-12 col-md-3\">\n                                <label for=\"form_begin\"><?php echo xlt('Begin Date and Time'); ?>:</label>", "                            <div class=\"form-group col-sm-12 col-md-3 oe-issue-date\">\n                                <label for=\"form_begin\"><?php echo xlt('Begin Date and Time'); ?>:</label>"],
    ["                            <div class=\"form-group col-sm-12 col-md-3\" id='row_enddate'>", "                            <div class=\"form-group col-sm-12 col-md-3 oe-issue-date\" id='row_enddate'>"],
    ["                        <div class=\"row\">\n                            <!-- Reaction For Medication Allergy -->", "                        <div class=\"row oe-issue-allergy\">\n                            <!-- Reaction For Medication Allergy -->"],
    ["                        <div class=\"row\">\n                            <div class=\"form-group col-12\">\n                                <label class=\"col-form-label\" for=\"form_udi\">", "                        <div class=\"row oe-issue-device\">\n                            <div class=\"form-group col-12\">\n                                <label class=\"col-form-label\" for=\"form_udi\">"],
    ["                        <div class=\"row\">\n                            <?php if (($irow['type'] ?? '') == 'medication') : ?>", "                        <div class=\"row oe-issue-medication\">\n                            <?php if (($irow['type'] ?? '') == 'medication') : ?>"],
    ["                        <div class=\"row\">\n                            <div class=\"form-group col-12\" id='row_comments'>", "                        <div class=\"row oe-issue-notes\">\n                            <div class=\"form-group col-12\" id='row_comments'>"],
    ['<div id="expanded_options" class="collapse">\n                            <div class="row">', '<div id="expanded_options" class="collapse oe-issue-more">\n                            <div class="row oe-issue-more-row">'],
    ["                            <div class=\"row\">\n                                <div class=\"form-group col-sm-12 col-md-4\" id='row_occurrence'>", "                            <div class=\"row oe-issue-more-row\">\n                                <div class=\"form-group col-sm-12 col-md-4\" id='row_occurrence'>"],
    ["                            <div class=\"row\">\n                                <!-- Verification Status for Medication Allergy -->", "                            <div class=\"row oe-issue-more-row\">\n                                <!-- Verification Status for Medication Allergy -->"],
    ["                        <div class=\"row\">\n                            <div class=\"col-12\">\n                                <h5><?php echo xlt(\"Medication Adherence\"); ?></h5>", "                        <div class=\"row oe-issue-adherence-heading\">\n                            <div class=\"col-12\">\n                                <h5><?php echo xlt(\"Medication Adherence\"); ?></h5>"],
    ["                        <div class=\"row\">\n\n                            <div class=\"form-group col-sm-12 col-md-6\">\n                                <label class=\"col-form-label\" for=\"form_medication[medication_adherence_date_asserted]\">", "                        <div class=\"row oe-issue-adherence\">\n\n                            <div class=\"form-group col-sm-12 col-md-6\">\n                                <label class=\"col-form-label\" for=\"form_medication[medication_adherence_date_asserted]\">"],
    ["                        <div class=\"row\">\n                            <div class=\"col d-flex justify-content-end\">\n                                <button type=\"button\" class=\"btn btn-text mr-3\" data-toggle=\"collapse\"", "                        <div class=\"row oe-issue-actions-row\">\n                            <div class=\"col d-flex justify-content-end oe-issue-actions\">\n                                <button type=\"button\" class=\"btn btn-text mr-3 oe-issue-disclosure\" data-toggle=\"collapse\""],
    ["                                <div class=\"btn-group\" role=\"group\">\n                                    <button type='submit' name='form_save'", "                                <div class=\"btn-group oe-issue-commit\" role=\"group\">\n                                    <button type='submit' name='form_save'"],
    ["                        <div class=\"row\">\n                            <?php\n                            if (!empty($ISSUE_TYPES['ippf_gcac'])) {", "                        <div class=\"row oe-issue-ippf\">\n                            <?php\n                            if (!empty($ISSUE_TYPES['ippf_gcac'])) {"],
];
const count = (text, part) => text.split(part).length - 1;
const sha = text => crypto.createHash('sha256').update(text).digest('hex');

// Undo the presentation edits; returns null when any edit is missing or ambiguous.
const restore = text => {
    let restored = text;
    for (const [before, after] of changes) {
        if (count(restored, after) !== 1) return null;
        restored = restored.replace(after, () => before);
    }
    return restored;
};

test('only the explicit presentation edits restore the exact original route', () => {
    const php = source();
    for (const [, after] of changes) expect(count(php, after)).toBe(1);
    expect(sha(restore(php))).toBe(baselineHash);
});

test('negative controls: any control, callback, guard or script mutation breaks restoration', () => {
    const php = source();
    const mutations = [
        ["onclick=\"newtype(%s)\"", "onclick=\"newtypex(%s)\""],
        ["['write', 'addonly'])) ? \" disabled\"", "['write'])) ? \" disabled\""],
        ["onclick='activeClicked(this);'", "onclick='activeClicked();'"],
        ["onchange='set_text()'", "onchange=''"],
        ["onclick=\"onAddCode()\" title=", "onclick=\"\" title="],
        ["name='form_end' id='form_end'", "name='form_end' id='form_finish'"],
        ["name='form_begin' id='form_begin'", "name='form_begin' id='form_begin' readonly"],
        ["name='form_comments' id='form_comments' rows=\"2\"", "name='form_comments' id='form_comments' rows=\"6\""],
        ["value='<?php echo attr($irow['diagnosis'] ?? '') ?>' onclick='onAddCode()'", "value='' onclick='onAddCode()'"],
        ['title=\'<?php echo xla(\'Click to select or change coding\'); ?>\' readonly />', 'title=\'<?php echo xla(\'Click to select or change coding\'); ?>\' />'],
        ["onclick='closeme();'", "onclick='window.close();'"],
        ["type='submit' name='form_save'", "type='button' name='form_save'"],
        ["onsubmit='return validate()'", "onsubmit='return true'"],
        ['data-toggle="collapse" data-target="#expanded_options"', 'data-toggle="collapse" data-target="#more"'],
        ["querySelector('button[data-target=\"#expanded_options\"]')", "querySelector('button')"],
        ['onkeydown="processUdiEnter(event)"', ''],
        ["'outcomeClicked(this);'", "''"],
        ["\n\nif (!empty($_POST['form_save'])) {\n    CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: true);", "\n\nif (!empty($_POST['form_save'])) {"],
        ["//\nif (!empty($_POST['form_save'])) {\n    CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: true);", "//\nif (!empty($_POST['form_save'])) {"],
        ["CsrfUtils::collectCsrfToken(session: $session)", "''"],
        ["generate_select_list('form_reaction', 'reaction'", "generate_select_list('form_reaction', 'reactions'"],
        ['include "add_edit_issue_medication_fragment.php";', ''],
        ["    $('div').hide();\n", ''],
        ['    tabbify();\n', ''],
        ["$('#expanded_options').on('shown.bs.collapse hidden.bs.collapse', toggleBtnExpOpts);", ''],
        ["<?php validateUsingPageRules($_SERVER['PHP_SELF']); ?>", ''],
        ["<?php echo $tabcontents; ?>", ''],
    ];
    for (const [from, to] of mutations) {
        expect(count(php, from)).toBe(1);
        const mutated = php.replace(from, () => to);
        const restored = restore(mutated);
        expect(restored === null ? null : sha(restored)).not.toBe(baselineHash);
    }
    // A stray presentation edit outside the declared list is also caught.
    expect(sha(restore(php.replace("id='row_active'", "id='row_active' class='oe-extra'")))).not.toBe(baselineHash);
});

test('wrappers keep the tab, disclosure and type-branch structure the scripts rely on', () => {
    const php = source();
    // tabbify(): the tab strip is followed by its container, whose first child is the issue tab.
    expect(php).toMatch(/<ul class="tabNav oe-issue-tabs">[\s\S]*?<\/ul>\n {8}<div class="tabContainer oe-issue-tab-container">\n {12}<div class='tab current h-auto'>/);
    expect(php).toMatch(/<\/form>\n {12}<\/div>\n {12}<\?php echo \$tabcontents; \?>\n {8}<\/div>/);
    // newtype() toggles these by id; each stays a single element.
    for (const id of ['row_titles', 'row_active_codes', 'row_enddate', 'row_active', 'row_selected_codes', 'row_occurrence',
        'row_classification', 'row_reinjury_id', 'row_severity', 'row_reaction', 'row_verification', 'row_referredby',
        'row_comments', 'row_subtype', 'row_returndate', 'expanded_options', 'form_titles', 'form_title', 'btnCodeSearch',
        'form_begin', 'form_end', 'form_active', 'form_comments', 'form_udi', 'udi_display', 'form_selected_codes']) {
        expect(count(php, `id='${id}'`) + count(php, `id="${id}"`)).toBeGreaterThanOrEqual(1);
    }
    expect(php).toContain('<div id="expanded_options" class="collapse oe-issue-more">');
    // The type option wrapper holds the PHP loop that emits radios or the fixed read-only type.
    expect(php).toMatch(/<div class="oe-issue-type-options">\n {36}<\?php\n {36}\$index = 0;[\s\S]*?\$str = '<input type="radio" name="form_type" value="%s" onclick="newtype\(%s\)" %s %s>';[\s\S]*?\+\+\$index;\n {36}}\n {36}\?>\n {36}<\/div>/);
    expect(php).toContain("<input type='hidden' name='form_type' value='\" . attr($index) . \"' />");
    expect(php).toContain('<body class="oe-issue-editor">');
    expect(php.match(/<body[ >]/g)).toHaveLength(2); // the save-response body stays bare
    expect(php).toContain('echo "<html><body><script>\\n";');
});

test('the issue sheet is versioned, linked once and screen only', () => {
    const php = source();
    expect(count(php, 'issue-popup.css')).toBe(2);
    expect(php).toContain('<link rel="stylesheet" media="screen" href="<?php echo attr($webroot); ?>/interface/clinical-workspace/issue-popup.css?v=<?php echo attr_url($clinicalAssets->version(\'issue-popup.css\')); ?>">');
    const tree = postcss.parse(css());
    expect(tree.nodes.filter(node => node.type !== 'comment')).toHaveLength(1);
    expect(tree.nodes.find(node => node.type === 'atrule')?.params).toBe('screen');
});

test('the asset helper registers the issue sheet basename (controller-owned)', () => {
    expect(read('src/Common/Assets/ClinicalWorkspaceAssets.php')).toMatch(/^\s*'issue-popup\.css',$/m);
});

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

test('scoped CSS is positive, popup-only and never overrides script-owned visibility', () => {
    const all = rules();
    expect(all.length).toBeGreaterThan(25);
    for (const { selectors, decls } of all) {
        for (const selector of selectors) {
            expect(selector.startsWith(`${scope} `) || selector === scope).toBe(true);
            if (selector.includes(':not(')) {
                expect(selector).toContain('.oe-issue-document .form-control:not(.is-invalid, .is-valid, .was-validated *)');
            }
            // Script/Bootstrap-owned visibility: inline display from newtype(), .collapse, .tab/.current.
            if (/#row_|#expanded_options|\.collapse|\.tab\b|\.tab[.:]|\.current|#udi_display|#form_titles/.test(selector.split(' ').pop())) {
                expect(decls.display).toBeUndefined();
                expect(decls.visibility).toBeUndefined();
            }
        }
        expect(String(decls.display ?? '')).not.toMatch(/none|!important/);
        expect(decls.visibility).toBeUndefined();
        expect(decls.position).not.toBe('fixed');
    }
    expect(css()).not.toMatch(/pointer-events|user-select|opacity:\s*0[;\s]/);
});

test('composed editor: header, identity grid, legible dates and notes, disclosure and actions', () => {
    const selectors = rules().flatMap(r => r.selectors);
    for (const part of [
        '.oe-issue-sheet', '.oe-issue-tabs', '.oe-issue-document', '.oe-issue-header', '.oe-issue-type-options',
        "input[type='radio']", '.oe-issue-status', '.oe-issue-identity', '.oe-issue-date', '#form_begin', '#form_end',
        '#form_comments', '.oe-issue-allergy', '.oe-issue-device', '.oe-issue-medication', '.oe-issue-more',
        '.oe-issue-adherence', '.oe-issue-disclosure', '.btn-save', '.btn-cancel', ':disabled', '[readonly]', ':focus',
    ]) expect(selectors.some(selector => selector.includes(part))).toBe(true);

    expect(declsFor(`${scope}`)).toMatchObject({ background: 'var(--oe-wb-canvas)' });
    expect(declsFor(`${scope} .oe-issue-document`)).toMatchObject({ background: 'var(--oe-wb-paper)' });
    expect(declsFor(`${scope} .oe-issue-document > .oe-issue-identity`)).toMatchObject({ display: 'grid' });
    expect(declsFor(`${scope} .oe-issue-document > .oe-issue-header`)).toMatchObject({ display: 'grid' });
    expect(declsFor(`${scope} .oe-issue-notes #form_comments`)).toMatchObject({ resize: 'vertical' });
    expect(declsFor(`${scope} .oe-issue-date .form-control`)).toMatchObject({ 'font-variant-numeric': 'tabular-nums' });
    expect(declsFor(`${scope} .oe-issue-actions .btn-save`)).toMatchObject({ background: 'var(--oe-wb-petrol)' });
    expect(declsFor(`${scope} .oe-issue-actions .btn-cancel`)).toMatchObject({ background: 'var(--oe-wb-paper)' });
    expect(declsFor(`${scope} .oe-issue-actions`)).toMatchObject({ 'flex-wrap': 'wrap' });

    // A narrow frame collapses the composed grids to one readable column.
    const narrow = [];
    postcss.parse(css()).walkAtRules('media', at => { if (/width\s*<=|max-width/.test(at.params)) at.walkRules(r => narrow.push(...r.selectors)); });
    for (const part of ['.oe-issue-header', '.oe-issue-identity', '.oe-issue-more-row']) {
        expect(narrow.some(selector => selector.includes(part))).toBe(true);
    }
});

// Compiled theme rules (public/themes/style_light.css; style_solar.css differs only in :root),
// verbatim except the validation icons, which are shortened data URLs.
const themeRoots = {
    light: { '--danger': '#dc3545', '--success': '#28a745' },
    solar: { '--danger': '#d33682', '--success': '#2aa198' },
};
const themeCss = theme => `
.form-control{background-color:#fff;border:1px solid #9ca3af;border-radius:.25rem;color:#374151}
.form-control:focus{background-color:#fff;border-color:#80bdff;box-shadow:0 0 0 .2rem rgba(0,123,255,.25);color:#374151;outline:0}
.form-control.is-invalid,.was-validated .form-control:invalid{background-image:url("data:image/svg+xml,invalid");border-color:${themeRoots[theme]['--danger']};padding-right:calc(1.5em + .75rem)!important}
.form-control.is-invalid:focus,.was-validated .form-control:invalid:focus{border-color:${themeRoots[theme]['--danger']};box-shadow:0 0 0 .2rem ${rgba(themeRoots[theme]['--danger'], 0.25)}}
.form-control.is-valid,.was-validated .form-control:valid{background-image:url("data:image/svg+xml,valid");border-color:${themeRoots[theme]['--success']};padding-right:calc(1.5em + .75rem)!important}
.form-control.is-valid:focus,.was-validated .form-control:valid:focus{border-color:${themeRoots[theme]['--success']};box-shadow:0 0 0 .2rem ${rgba(themeRoots[theme]['--success'], 0.25)}}
`;
function rgba(hex, alpha) {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    return `rgba(${r},${g},${b},${alpha})`;
}

const specificity = selector => {
    const bare = selector.replace(/\[[^\]]*\]/g, '.a').replace(/::[\w-]+/g, ' x');
    const ids = (bare.match(/#[\w-]+/g) || []).length;
    const classes = (bare.match(/\.[\w-]+|:[\w-]+/g) || []).length;
    const types = (bare.replace(/[#.:][\w-]+/g, ' ').match(/(^|[\s>+~])[a-z][\w-]*/gi) || []).length;
    return ids * 1e6 + classes * 1e3 + types;
};

// Theme sheet, then the screen-only issue sheet, as the page links them.
const cascade = theme => {
    const out = [];
    let order = 0;
    const take = (tree, inScreen) => tree.walkRules(rule => {
        const media = [];
        for (let p = rule.parent; p && p.type === 'atrule'; p = p.parent) media.push(p.params);
        if (media.some(m => m !== 'screen') || (inScreen && !media.includes('screen'))) return;
        for (const selector of rule.selectors) {
            rule.walkDecls(d => out.push({ selector, prop: d.prop, value: d.value, important: d.important, spec: specificity(selector), order: order++ }));
        }
    });
    take(postcss.parse(themeCss(theme)), false);
    take(postcss.parse(css()), true);
    return out;
};
const longhand = (prop, value) => {
    if (prop === 'border') return { 'border-color': value.split(/\s+/).slice(2).join(' ') };
    if (prop === 'background') return { 'background-color': value, 'background-image': /url\(/.test(value) ? value : 'none' };
    return { [prop]: value };
};
const resolve = (value, theme) => value
    .replace(/var\((--[\w-]+)\)/g, (m, name) => themeRoots[theme][name] ?? m)
    .replace(/color-mix\(in srgb, (#[0-9a-f]{6}) (\d+)%, transparent\)/gi, (m, hex, pct) => rgba(hex, Number(pct) / 100))
    .replace(/(^|[\s,(])\.(?=\d)/g, (_, prefix) => `${prefix}0.`)
    .replace(/\s*,\s*/g, ',');
const computed = (element, prop, theme) => {
    let winner = null;
    for (const d of cascade(theme)) {
        const value = longhand(d.prop, d.value)[prop];
        if (value === undefined) continue;
        let matches = false;
        try { matches = element.matches(d.selector); } catch { continue; }
        if (!matches) continue;
        const rank = [d.important ? 1 : 0, d.spec, d.order];
        if (!winner || rank[0] > winner.rank[0] || (rank[0] === winner.rank[0] && (rank[1] > winner.rank[1] || (rank[1] === winner.rank[1] && rank[2] > winner.rank[2])))) {
            winner = { rank, value };
        }
    }
    return winner ? resolve(winner.value, theme) : undefined;
};

// A control inside the composed sheet: the form is the native-validation container.
const mount = ({ cls = '', value = '', wasValidated = false, focus = false, disabled = false, readonly = false }) => {
    document.documentElement.className = 'oe-workbench-popup';
    document.body.className = 'oe-issue-editor';
    document.body.innerHTML = `<div class="tabContainer oe-issue-tab-container"><div class="tab current"><form class="oe-issue-form${wasValidated ? ' was-validated' : ''}"><div class="container-fluid oe-issue-document"><div class="row oe-issue-identity"><div class="form-group col oe-issue-title"><input type="text" id="form_title" class="form-control ${cls}" required value="${value}"${disabled ? ' disabled' : ''}${readonly ? ' readonly' : ''}></div></div></div></form></div></div>`;
    const input = document.getElementById('form_title');
    if (focus) input.focus();
    return input;
};
const danger = theme => themeRoots[theme]['--danger'];
const success = theme => themeRoots[theme]['--success'];
const validationStates = [
    ['is-invalid', { cls: 'is-invalid', value: 'x' }, danger],
    ['is-valid', { cls: 'is-valid', value: '' }, success],
    ['was-validated :invalid', { wasValidated: true, value: '' }, danger],
    ['was-validated :valid', { wasValidated: true, value: 'x' }, success],
];

test.each(['light', 'solar'])('validation borders, focus rings and icons keep the %s theme semantic palette', theme => {
    for (const [, state, colour] of validationStates) {
        const rest = mount(state);
        expect(computed(rest, 'border-color', theme)).toBe(colour(theme));
        expect(computed(rest, 'background-image', theme)).toMatch(/^url\("data:image\/svg\+xml,(in)?valid"\)$/);
        const focused = mount({ ...state, focus: true });
        expect(focused.matches(':focus')).toBe(true);
        expect(computed(focused, 'border-color', theme)).toBe(colour(theme));
        expect(computed(focused, 'box-shadow', theme)).toBe(`0 0 0 0.2rem ${rgba(colour(theme), 0.25)}`);
    }
});

test('ordinary controls keep the neutral popup surface, petrol focus and disabled/readOnly paper', () => {
    for (const theme of ['light', 'solar']) {
        const plain = mount({ value: 'x' });
        expect(computed(plain, 'border-color', theme)).toBe('var(--oe-wb-line)');
        expect(computed(plain, 'background-color', theme)).toBe('var(--oe-wb-paper)');
        expect(computed(plain, 'background-image', theme)).toBe('none');
        const focused = mount({ value: 'x', focus: true });
        expect(computed(focused, 'border-color', theme)).toBe('var(--oe-wb-petrol)');
        expect(computed(focused, 'box-shadow', theme)).toBe('0 0 0 3px rgb(8 104 120 / 18%)');
        // Unvalidated required-but-empty controls stay neutral: :invalid alone is not a cue.
        expect(computed(mount({ value: '' }), 'border-color', theme)).toBe('var(--oe-wb-line)');
        for (const flag of ['disabled', 'readonly']) {
            const locked = mount({ value: 'x', [flag]: true });
            expect(computed(locked, 'background-color', theme)).toBe('var(--oe-wb-disabled-paper)');
            expect(computed(locked, 'color', theme)).toBe('var(--oe-wb-disabled-ink)');
        }
    }
    // Neutral resets exclude validation states inside the positive popup scope.
    const validation = rules().flatMap(r => r.selectors).filter(s => /is-(in)?valid|was-validated/.test(s));
    expect(validation).toHaveLength(2);
    for (const selector of validation) {
        expect(selector.startsWith(`${scope} `)).toBe(true);
        expect(selector).toContain('.form-control:not(.is-invalid, .is-valid, .was-validated *)');
    }
    expect(validation.some(selector => selector.endsWith(':focus'))).toBe(true);
    expect(css()).not.toMatch(/#dc3545|#28a745|#d33682|#2aa198/i);
});
