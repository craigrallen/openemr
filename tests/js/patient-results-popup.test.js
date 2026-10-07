/** @jest-environment node */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const postcss = require('postcss');

const root = path.join(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const source = () => read('interface/main/finder/patient_select.php');
const css = () => read('interface/clinical-workspace/patient-results-popup.css');
test('results popup has no context width queries', () => {
    const media = [];
    postcss.parse(css()).walkAtRules('media', rule => media.push(rule.params));
    expect(media).toEqual(['screen']);
});
const baselineHash = '7c728ed57e987c663a4d000fe4a765e78e68d12a516fd4691b7f9ea19005c6a9';
const presentationChanges = [
    ['use OpenEMR\\Common\\Acl\\AclMain;', 'use OpenEMR\\Common\\Acl\\AclMain;\nuse OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;'],
    ["    <?php Header::setupHeader('opener'); ?>", "    <?php Header::setupHeader('opener'); ?>\n    <?php $clinicalAssets = new ClinicalWorkspaceAssets(); ?>\n    <link rel=\"stylesheet\" media=\"screen\" href=\"<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>/interface/clinical-workspace/patient-results-popup.css?v=<?php echo attr_url($clinicalAssets->version('patient-results-popup.css')); ?>\">"],
    ['<body class="body_top">', '<body class="body_top oe-patient-results">'],
    ['<table class="w-100 border-0" cellpadding=', '<table class="w-100 border-0 oe-results-toolbar" cellpadding='],
    ['<div id="searchResultsHeader" class="head">', '<div class="oe-results-scroll" role="region" aria-label="<?php echo xla(\'Patient search results\'); ?>" tabindex="0">\n<div id="searchResultsHeader" class="head">'],
    ['</div>  <!-- end searchResults DIV -->', '</div>  <!-- end searchResults DIV -->\n</div>  <!-- end shared results scroll -->'],
    ['<div id="searchResults">\n\n<table>\n<tr>\n<?php', '<div id="searchResults">\n\n<table>\n<?php'],
];
const count = (value, part) => value.split(part).length - 1;

function restorePresentation(php) {
    let restored = php;
    for (const [before, after] of presentationChanges) {
        if (count(restored, after) !== 1) throw new Error(`Expected one presentation change: ${after}`);
        restored = restored.replace(after, before);
    }
    return restored;
}

test('only allowed presentation changes restore the exact 567-line route', () => {
    const restored = restorePresentation(source());
    expect(restored.split('\n').length - 1).toBe(567);
    expect(crypto.createHash('sha256').update(restored).digest('hex')).toBe(baselineHash);
});

test('the invariant rejects changes to controls, headers, routing, and selection callbacks', () => {
    const restored = restorePresentation(source());
    const mutations = [
        ["name='fstart'", "name='page_offset'"],
        ["xlt('Name')", "xlt('Patient')"],
        ["basename(__FILE__)", "'another_route.php'"],
        ['dlgclose("srchDone", parts[0]);', 'dlgclose("srchDone", parts[1]);'],
    ];
    for (const [before, after] of mutations) {
        expect(restored).toContain(before);
        const changed = restored.replace(before, after);
        expect(crypto.createHash('sha256').update(changed).digest('hex')).not.toBe(baselineHash);
    }
});

test('workbench screen sheet keeps toolbar, both full tables, and one shared scroll surface', () => {
    const php = source();
    expect(php).toContain('media="screen" href="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>/interface/clinical-workspace/patient-results-popup.css?v=<?php echo attr_url($clinicalAssets->version(\'patient-results-popup.css\')); ?>"');
    expect(read('src/Common/Assets/ClinicalWorkspaceAssets.php')).toMatch(/^\s*'patient-results-popup\.css',$/m);
    expect(php).toMatch(/<div class="oe-results-scroll"[^>]*>[\s\S]*<div id="searchResultsHeader"[\s\S]*<div id="searchResults"[\s\S]*<\/div> {2}<!-- end shared results scroll -->/);
    expect(php).toContain('class="w-100 border-0 oe-results-toolbar"');
    for (const column of ['srName', 'srGender', 'srPhone', 'srSS', 'srDOB', 'srID', 'srPID', 'srNumEnc', 'srNumDays', 'srDateLast', 'srDateNext', 'srMisc']) {
        expect(php).toContain(column);
    }
    for (const behavior of ['patient_select_help.php', 'Print Entire Listing', 'Return To Report Results', 'PaginationUtils', 'SelectPatient(this)', 'dlgclose("srchDone", parts[0])']) {
        expect(php).toContain(behavior);
    }
});

test('scoped CSS gives both tables identical fixed geometry inside the sole scroller', () => {
    const tree = postcss.parse(css());
    expect(tree.nodes.filter(node => node.type !== 'comment')).toHaveLength(1);
    expect(tree.nodes.find(node => node.type === 'atrule')?.params).toBe('screen');
    const rules = [];
    tree.walkRules(rule => {
        const declarations = {};
        rule.walkDecls(decl => { declarations[decl.prop] = decl.value; });
        for (const selector of rule.selectors) {
            expect(selector).toMatch(/^html\.oe-workbench-popup body\.oe-patient-results(?: |$)/);
            rules.push({ selector, declarations });
        }
    });
    const matching = fragment => rules.filter(rule => rule.selector.includes(fragment));
    expect(matching('.oe-results-scroll').some(rule => rule.declarations.overflow === 'auto'
        || (rule.declarations['overflow-x'] === 'auto' && rule.declarations['overflow-y'] === 'auto'))).toBe(true);
    const tables = rules.find(rule => rule.selector.endsWith('#searchResultsHeader table'));
    expect(tables?.declarations['table-layout']).toBe('fixed');
    expect(tables?.declarations.width).toMatch(/max\(/);
    expect(rules.find(rule => rule.selector.endsWith('#searchResults table'))?.declarations).toMatchObject({
        'table-layout': tables.declarations['table-layout'], width: tables.declarations.width,
    });
    expect(matching('#searchResults').some(rule => rule.declarations.overflow === 'visible')).toBe(true);
    for (const column of ['srName', 'srGender', 'srPhone', 'srSS', 'srDOB', 'srID', 'srPID', 'srNumEnc', 'srNumDays', 'srNumDay', 'srDateLast', 'srDateNext', 'srMisc']) {
        expect(matching(`.${column}`).some(rule => rule.declarations.width)).toBe(true);
    }
    expect(css()).not.toMatch(/display:\s*none|visibility:\s*hidden/);
});
