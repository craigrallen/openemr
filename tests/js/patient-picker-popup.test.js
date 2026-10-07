/** @jest-environment jsdom */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const postcss = require('postcss');

const root = path.join(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const source = () => read('interface/main/finder/multi_patients_finder.php');
const css = () => read('interface/clinical-workspace/patient-picker-popup.css');
test('popup breakpoints use prefix syntax at their original widths', () => {
    const media = [];
    postcss.parse(css()).walkAtRules('media', rule => media.push(rule.params));
    expect(media).toEqual(['screen', '(max-width: 720px)', '(max-width: 480px)']);
});
const baselineHash = 'e4983cd6c38fbe1c24d7da0a3e91835fcb850f3156b80852e155d726d9f2e2d0';
const changes = [
    ['use OpenEMR\\Common\\Csrf\\CsrfUtils;', 'use OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;\nuse OpenEMR\\Common\\Csrf\\CsrfUtils;'],
    ["    <title><?php echo xlt('Patient Finder'); ?></title>", "    <title><?php echo xlt('Patient Finder'); ?></title>\n    <?php $clinicalAssets = new ClinicalWorkspaceAssets(); ?>\n    <link rel=\"stylesheet\" media=\"screen\" href=\"<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>/interface/clinical-workspace/patient-picker-popup.css?v=<?php echo attr_url($clinicalAssets->version('patient-picker-popup.css')); ?>\">"],
    ['<body>', '<body class="oe-patient-picker">'],
    ['<div class="container-fluid">', '<div class="container-fluid oe-picker-sheet">'],
    ['<div id="searchCriteria">', '<div id="searchCriteria" class="oe-picker-search">'],
    ['        <form>', '        <form class="oe-picker-form">'],
    ['            <div class="row align-items-center">', '            <div class="row align-items-center oe-picker-layout">'],
    ['                <div class="col-4">\n                    <div class="select-box form-inline">\n                        <label for="by-name">', '                <div class="col-4 oe-picker-field oe-picker-name">\n                    <div class="select-box form-inline">\n                        <label for="by-name">'],
    ['                <div class="col-4">\n                    <div class="select-box form-inline">\n                        <label for="by-id">', '                <div class="col-4 oe-picker-field oe-picker-id">\n                    <div class="select-box form-inline">\n                        <label for="by-id">'],
    ['                <div class="col-4">\n                    <div class="btn-group" role="group" aria-label="Form Buttons">', '                <div class="col-4 oe-picker-action-column">\n                    <div class="btn-group oe-picker-actions" role="group" aria-label="Form Buttons">'],
    ['<div class="table-responsive">', '<div class="table-responsive oe-picker-results">'],
    ['<table id="results-table" class="table table-sm">', '<table id="results-table" class="table table-sm oe-picker-table">'],
];
const count = (text, part) => text.split(part).length - 1;

test('only the explicit presentation edits restore the exact original route', () => {
    let restored = source();
    for (const [before, after] of changes) {
        expect(count(restored, after)).toBe(1);
        restored = restored.replace(after, before);
    }
    expect(crypto.createHash('sha256').update(restored).digest('hex')).toBe(baselineHash);
});

test('the route preserves every control, column, PHP guard and original script', () => {
    const php = source();
    expect(php.match(/<script>[\s\S]*?<\/script>/)?.[0]).toContain("$('#by-id, #by-name').select2({");
    for (const value of ['by-name', 'by-id', 'add-to-list', 'send-patients', 'results-table', 'searchResultsHeader', 'searchResults']) {
        expect(count(php, `id="${value}"`)).toBe(1);
    }
    for (const column of ['srName', 'srPhone', 'srSS', 'srDOB', 'srID']) {
        expect(count(php, `class="${column}"`)).toBe(1);
    }
    expect(php).toContain('onclick="selPatients()"');
    expect(php).toContain('type="button" class="btn btn-primary btn-add btn-sm"');
    expect(php).toContain('type="button" class="btn btn-primary btn-save btn-sm"');
    expect(php).toContain("if (isset($_GET['patients']))");
    expect(php).toContain("CsrfUtils::checkCsrfInput(INPUT_GET, dieOnFail: true)");
});

test('the new sheet is versioned and screen only', () => {
    expect(source()).toContain('media="screen" href="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>/interface/clinical-workspace/patient-picker-popup.css?v=<?php echo attr_url($clinicalAssets->version(\'patient-picker-popup.css\')); ?>"');
    expect(read('src/Common/Assets/ClinicalWorkspaceAssets.php')).toMatch(/^\s*'patient-picker-popup\.css',$/m);
    const tree = postcss.parse(css());
    expect(tree.nodes.filter(node => node.type !== 'comment')).toHaveLength(1);
    expect(tree.nodes.find(node => node.type === 'atrule')?.params).toBe('screen');
});

test('scoped CSS sizes the rendered Select2 widget and its dropdown states', () => {
    const tree = postcss.parse(css());
    const selectors = [];
    const declarations = new Map();
    tree.walkRules(rule => selectors.push(...rule.selectors));
    tree.walkRules(rule => {
        const values = {};
        rule.walkDecls(decl => { values[decl.prop] = `${decl.value}${decl.important ? ' !important' : ''}`; });
        for (const selector of rule.selectors) declarations.set(selector, values);
    });
    expect(selectors.length).toBeGreaterThan(15);
    for (const selector of selectors) expect(selector).toMatch(/^html\.oe-workbench-popup /);
    for (const part of [
        '#searchCriteria', '.oe-picker-layout', '#by-name', '#by-id',
        '.select2-container--bootstrap4', '.select2-selection--single',
        '.select2-selection__rendered', '.select2-selection__arrow',
        '.select2-container--open', '.select2-dropdown', '.select2-search__field',
        '.select2-results__option', '.select2-results__option--highlighted',
        '#add-to-list', '#send-patients', '#results-table', '.remove-patient'
    ]) expect(selectors.some(selector => selector.includes(part))).toBe(true);
    expect(declarations.get('html.oe-workbench-popup body.oe-patient-picker #searchCriteria')).toMatchObject({
        'text-align': 'left',
        background: 'var(--oe-wb-canvas)',
    });
    expect(declarations.get('html.oe-workbench-popup body.oe-patient-picker .oe-picker-field .select2-container')).toMatchObject({ width: '100% !important' });
    expect(declarations.get('html.oe-workbench-popup body.oe-patient-picker .select2-container--bootstrap4 .select2-selection--single')).toMatchObject({ height: '40px' });
    expect(declarations.get('html.oe-workbench-popup body.oe-patient-picker .select2-container--bootstrap4 .select2-selection--single .select2-selection__arrow')).toMatchObject({ top: '0' });
    expect(declarations.get('html.oe-workbench-popup body.oe-patient-picker #add-to-list')).toMatchObject({ background: 'var(--oe-wb-paper)' });
    expect(declarations.get('html.oe-workbench-popup body.oe-patient-picker #send-patients')).toMatchObject({ background: 'var(--oe-wb-petrol)' });
    expect(declarations.get('html.oe-workbench-popup .select2-container--bootstrap4 .select2-results__option--highlighted[aria-selected]')).toMatchObject({ background: 'var(--oe-wb-petrol)' });
    expect(css()).not.toMatch(/display:\s*none|visibility:\s*hidden/);
});
