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
const source = () => read('interface/main/finder/dynamic_finder.php');
const twig = () => read('templates/patient_finder/finder.html.twig');
const css = () => read('interface/clinical-workspace/finder.css');
const scope = 'body.oe-clinical-workspace.oe-clinical-finder';

function selectors() {
    const list = [];
    postcss.parse(css()).walkRules((rule) => list.push(...rule.selectors));
    return list;
}

function declarationsFor(selector) {
    const values = {};
    postcss.parse(css()).walkRules((rule) => {
        if (rule.selectors.includes(selector) && rule.parent.type === 'atrule' && rule.parent.params === 'screen') {
            rule.walkDecls((decl) => { values[decl.prop] = decl.value; });
        }
    });
    return values;
}

// Markup shaped like the rendered page: the shared page heading partial, the finder
// template and the DataTables wrapper produced by the page's `dom` option.
function renderFinderShape(bodyClass) {
    document.body.className = bodyClass;
    document.body.innerHTML = `
        <div id="container_div" class="container mt-3">
            <nav class="navbar navbar-light navbar-expand-sm bg-light">
                <span class="navbar-brand mb-0 h1">Patient Finder</span>
                <div class="collapse navbar-collapse">
                    <ul class="navbar-nav"><li class="nav-item"><a class="nav-link btn-add" href="#">Add New Patient</a></li></ul>
                    <div class="navbar-nav ml-auto" id="pageHeadingNav"><a class="nav-link" id="exp_cont_icon" href="#">x</a></div>
                </div>
            </nav>
            <div class="tab-content"><div class="tab-pane show active" id="list">
                <div class="table-responsive"><div id="pt_table_wrapper" class="dataTables_wrapper">
                    <div class="dataTables_filter" id="pt_table_filter"><label>Search all columns:<input type="search"></label></div>
                    <div class="oe-finder-results"><table id="pt_table" class="table dataTable">
                        <thead><tr id="advanced_search"><td><input class="form-control search_init"></td></tr><tr><th>Name</th></tr></thead>
                        <tbody><tr id="pid_1"><td><a href="">Name</a></td></tr></tbody>
                    </table></div>
                    <div class="mytopdiv"><form name="myform"><label for="form_new_window">Open in New Browser Tab</label></form></div>
                    <div class="dataTables_info" id="pt_table_info">Showing 1</div>
                    <div class="dataTables_paginate" id="pt_table_paginate"><a class="paginate_button">1</a></div>
                </div></div>
            </div></div>
        </div>`;
}

function screenRulesMatching(element) {
    const matched = [];
    postcss.parse(css()).walkRules((rule) => {
        for (const selector of rule.selectors) {
            if (element.matches(selector)) matched.push(selector);
        }
    });
    return matched;
}

test('real Finder route links a helper-versioned finder stylesheet after the shared workspace sheet', () => {
    const php = source();
    expect(php).toContain('use OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;');
    expect(php).toContain('$clinicalAssets = new ClinicalWorkspaceAssets();');
    const lines = php.split('\n');
    const finderIndex = lines.findIndex((line) => line.includes('/interface/clinical-workspace/finder.css?v='));
    const workspaceIndex = lines.findIndex((line) => line.includes('/interface/clinical-workspace/workspace.css?v='));
    expect(finderIndex).toBeGreaterThan(workspaceIndex);
    expect(workspaceIndex).toBeGreaterThan(-1);
    expect(lines[finderIndex]).toContain("attr_url($clinicalAssets->version('finder.css'))");
    expect(lines[finderIndex]).toContain('attr(OEGlobalsBag::getInstance()->getWebRoot())');
    expect(lines[finderIndex]).not.toMatch(/filemtime|__DIR__/);
    expect(php).toContain('/interface/clinical-workspace/mode.js?v=');
    expect(php).toContain('<body class="oe-clinical-finder">');
});

test('DataTables results sit in an additive sheet wrapper with every original dom feature in order', () => {
    const dom = source().match(/"dom":\s*'([^']*)'/);
    expect(dom).not.toBeNull();
    expect(dom[1]).toBe('R<"oe-search-toolbar"lf><"oe-finder-results"rt><"oe-search-footer"<"mytopdiv">ip>');
    // Strip the quoted wrapper class names first, so letters inside them (e.g. the "t" and "r"
    // in "toolbar") can't masquerade as DataTables tokens; what remains must be exactly the
    // original R, l, f, r, t, i, p tokens, in their original relative order.
    expect(dom[1].replace(/"[^"]*"/g, '').replace(/[^Rlfrtip]/g, '')).toBe('Rlfrtip');
    expect(twig()).toMatch(/<div class="table mt-2 oe-finder-results">/);
});

test('Finder keeps search, filter, new-tab, create-patient, ACL, CSRF, session and help behaviour', () => {
    const php = source();
    for (const token of [
        '"serverSide": true', '"sAjaxSource": serverUrl', 'dynamic_finder_ajax.php', '"fnServerParams"',
        '$("#setting_search_type:checked").length > 0', '"name": "searchType"', 'search_any',
        "xlt('Open in New Browser Tab')", "xlt('Search with exact method')", 'gbl_pt_list_new_window',
        "onchange='persistCriteria(this, event)'", 'patient_finder_exact_search', 'gbl_pt_list_page_size',
        'oTable.fnFilter(this.value, $("thead input").index(this))', "xla('Search all columns')",
        'document.myform.form_new_window.checked', 'openNewTopWindow(newpid)', 'top.restoreSession();',
        'demographics.php?set_pid=', 'CsrfUtils::collectCsrfToken(session: $session)', 'library/ajax/user_settings.php',
        "'heading_title' => xl('Patient Finder')", "'expandable' => true", "'expandable_files' => ['dynamic_finder_xpd']",
        "'action' => \"search\"", "'page_id' => 'dynamic_finder'", 'PageHeadingRenderEvent::EVENT_PAGE_HEADING_RENDER',
        "'displayText' => xl('Add New Patient')", "'linkClassList' => ['btn-add']", '/interface/new/new.php',
        "'acl' => ['patients', 'demo', ['write', 'addonly']]", "getRecentPatientList()",
        "$t->render('patient_finder/finder.html.twig', $templateVars)", 'wrapInLink',
    ]) expect(php).toContain(token);
    const template = twig();
    for (const token of [
        '{{ pageHeading }}', '{{ oeBelowContainerDiv }}', '"Patient List"|xlt', '"Recent Patients"|xlt',
        '"No recent patients"|xlt', 'id="advanced_search" class="hideaway d-none"', '{{ header0 }}', '{{ header }}',
        "<form name='fnew' method='post' target='_blank'", "{{ csrfToken('', 'csrf_token_form') }}",
        'data-pid="{{ p.pid|attr }}"', "$('div.dataTables_filter input').focus();", 'id="pt_table"',
    ]) expect(template).toContain(token);
});

test('scoped screen-only stylesheet composes the real heading, toolbar and results', () => {
    const list = selectors();
    expect(list.length).toBeGreaterThan(10);
    expect(list.every((selector) => selector.startsWith(scope))).toBe(true);
    for (const target of ['.navbar-brand', '#pageHeadingNav', '#pt_table_filter', '.oe-finder-results', '#advanced_search',
        '.mytopdiv', '.dataTables_info', '.dataTables_paginate', '#pt_table', '#recent']) {
        expect(list.some((selector) => selector.includes(target))).toBe(true);
    }
    postcss.parse(css()).walkRules((rule) => {
        let parent = rule.parent;
        let screen = false;
        while (parent && parent.type !== 'root') {
            if (parent.type === 'atrule' && /^screen\b/.test(parent.params)) screen = true;
            parent = parent.parent;
        }
        expect(screen).toBe(true);
    });
    const text = css();
    expect(text).not.toMatch(/@media print/);
    expect(text).not.toMatch(/(?:display:\s*none|visibility:\s*hidden)/);
    // RTL safety: logical properties only, no physical sides or floats.
    expect(text).not.toMatch(/(?:margin|padding|border)-(?:left|right)\s*:|text-align:\s*(?:left|right)|float:\s*(?:left|right)/);

    const heading = declarationsFor(`${scope} #container_div > .navbar .navbar-brand`);
    expect(heading['font-size']).toBe('1.75rem');
    expect(heading['white-space']).toBe('normal');
    const results = declarationsFor(`${scope} .oe-finder-results`);
    expect(results['overflow-x']).toBe('auto');
    expect(results['max-width']).toBe('100%');
    // overflow-x makes the sheet a block formatting context, which would otherwise sit
    // beside the original floated DataTables filter instead of below it.
    expect(results.clear).toBe('both');
    const search = declarationsFor(`${scope} #pt_table_filter input`);
    expect(search['min-width']).toBe('0');
});

test('narrow Finder query uses prefix syntax the declared older browsers understand', () => {
    // Engines without Media Queries 4 range syntax drop a `(width <= 640px)` block
    // entirely, which would leave Bootstrap hiding Add New Patient below 576px.
    const queries = [];
    postcss.parse(css()).walkAtRules('media', (atRule) => queries.push(atRule.params));
    expect(queries).toEqual(['screen', 'screen and (max-width: 640px)']);
    for (const query of queries) {
        expect(query).not.toMatch(/[<>]/);
    }

    const narrow = {};
    postcss.parse(css()).walkRules((rule) => {
        if (rule.parent.type === 'atrule' && rule.parent.params === 'screen and (max-width: 640px)') {
            for (const selector of rule.selectors) {
                narrow[selector] = {};
                rule.walkDecls((decl) => { narrow[selector][decl.prop] = decl.value; });
            }
        }
    });
    expect(narrow[`${scope} #container_div > .navbar .navbar-collapse`]).toEqual({
        display: 'flex', 'flex-basis': '100%', 'flex-wrap': 'wrap'
    });
    expect(narrow[`${scope} #container_div > .navbar .navbar-brand`]).toEqual({ 'font-size': '1.5625rem' });
});

test('rendered Finder shape is styled only in workspace mode, never in legacy mode', () => {
    renderFinderShape('oe-clinical-finder');
    for (const element of document.body.querySelectorAll('*')) {
        expect(screenRulesMatching(element)).toEqual([]);
    }

    renderFinderShape('oe-clinical-finder oe-clinical-workspace');
    for (const query of ['.navbar-brand', '#pt_table_filter input', '.oe-finder-results', '#pt_table th', '#pt_table td', '.mytopdiv', '#pt_table_paginate']) {
        expect(screenRulesMatching(document.querySelector(query))).not.toEqual([]);
    }
    // Every original control remains in the DOM, in its original order.
    const order = ['#pt_table_filter', '.oe-finder-results', '.mytopdiv', '#pt_table_info', '#pt_table_paginate']
        .map((query) => document.querySelector(query));
    for (let i = 1; i < order.length; i++) {
        expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
});

test('explicit legacy toggle returns the Finder to its original body class', () => {
    document.body.className = 'oe-clinical-finder';
    const host = document.createElement('body');
    host.className = 'workbench-active';
    let notify;
    const controller = createModeController({
        body: document.body,
        parentWindow: { location: { origin: window.location.origin }, document: { body: host } },
        origin: window.location.origin,
        observe: (target, callback) => { notify = callback; return { disconnect() {} }; }
    });
    expect(document.body.classList.contains('oe-clinical-workspace')).toBe(true);
    host.classList.remove('workbench-active');
    notify();
    expect(document.body.className).toBe('oe-clinical-finder');
    controller.dispose();
});
