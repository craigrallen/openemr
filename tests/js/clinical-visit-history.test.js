/**
 * @jest-environment jsdom
 */
/* global __dirname */

const fs = require('fs');
const path = require('path');
const postcss = require('postcss');
const { createModeController } = require('../../interface/clinical-workspace/mode.js');

const root = path.join(__dirname, '../..');
const source = () => fs.readFileSync(path.join(root, 'interface/patient_file/history/encounters.php'), 'utf8');
const css = () => fs.readFileSync(path.join(root, 'interface/clinical-workspace/visit-history.css'), 'utf8');
const scope = 'body.oe-clinical-workspace.oe-clinical-history';

test('real Visit History route loads escaped, independently versioned assets and keeps its direct-page fallback', () => {
    const php = source();
    expect(php).toMatch(/<body class="oe-clinical-history">/);
    expect(php).toContain('use OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;');
    expect(php).toContain('$clinicalAssets = new ClinicalWorkspaceAssets();');
    expect(php).toContain("$clinicalTooltipAssets = new ClinicalWorkspaceAssets(dirname(__DIR__, 3) . '/library/js');");
    for (const asset of ['visit-history.css', 'mode.js', 'visit-history.js']) {
        const url = php.split('\n').find(line => line.includes(`/interface/clinical-workspace/${asset}?v=`));
        expect(url).toContain(`attr_url($clinicalAssets->version('${asset}'))`);
        expect(url).not.toMatch(/filemtime|__DIR__/);
    }
    const tooltipUrl = php.split('\n').find(line => line.includes('/library/js/ajtooltip.js?v='));
    expect(tooltipUrl).toContain("attr_url($clinicalTooltipAssets->version('ajtooltip.js'))");
    expect(tooltipUrl).not.toMatch(/filemtime|__DIR__/);
    expect(php).toMatch(/attr\(OEGlobalsBag::getInstance\(\)->getWebRoot\(\)\)/);

    document.body.className = 'oe-clinical-history';
    const host = document.createElement('body');
    host.className = 'workbench-active';
    const controller = createModeController({
        body: document.body,
        parentWindow: { location: { origin: window.location.origin }, document: { body: host } },
        origin: window.location.origin,
        observe: () => ({ disconnect() {} })
    });
    expect(document.body.classList.contains('oe-clinical-workspace')).toBe(true);
    controller.dispose();
    expect(document.body.className).toBe('oe-clinical-history');
});

test('scoped stylesheet styles real controls, keeps all columns scrollable, and leaves print to the theme', () => {
    const rules = [];
    postcss.parse(css()).walkRules((rule) => rules.push(...rule.selectors));
    expect(rules.length).toBeGreaterThan(8);
    expect(rules.every((selector) => selector.startsWith(scope))).toBe(true);
    for (const target of ['#encounters', '.title', '.heading', '#selPagesize', '#printbutton', '.table-responsive', '.encrow', '.docrow', '.billing_note_text']) {
        expect(rules.some((selector) => selector.includes(target))).toBe(true);
    }
    expect(css()).toMatch(/overflow-x:\s*auto/);
    expect(css()).toMatch(/min-width:\s*\d/);
    expect(css()).toMatch(/@media screen/);
    expect(css()).not.toMatch(/@media print/);
    expect(css()).not.toMatch(/(?:display:\s*none|visibility:\s*hidden)/);
});

test('page-size controls wrap inside narrow clinical frames without hiding content', () => {
    const declarations = new Map();
    postcss.parse(css()).walkRules(rule => {
        if (rule.selector === `${scope} #encounters .oe-history-page-size` ||
            rule.selector === `${scope} #encounters .oe-history-page-size label`) {
            const values = {};
            rule.walkDecls(decl => { values[decl.prop] = decl.value; });
            declarations.set(rule.selector, values);
        }
    });
    const control = declarations.get(`${scope} #encounters .oe-history-page-size`);
    const label = declarations.get(`${scope} #encounters .oe-history-page-size label`);
    expect(control['flex-wrap']).toBe('wrap');
    expect(control['max-width']).toBe('100%');
    expect(control['min-width']).toBe('0');
    expect(label['white-space']).toBe('normal');
});

test('page keeps source workflows and permission gates in their existing branches', () => {
    const php = source();
    for (const token of [
        "if ($billing_view)", "if ($issue)", "$attendant_type == 'pid'", "if ($auth_med)",
        '$auth_sensitivity && $authPostCalendarCategory', 'getFormByEncounter(',
        'hasFormPermission(', 'generatePageElement(', 'changePageSize',
        'top.printLogSetup', 'editInvoice(event,', 'createFollowUpEncounter(event,',
        '$(".encrow").on("click"', '$(".docrow").on("click"',
        '$(".billing_note_text").on("click"', 'getPatientNameFirstLast($pid)',
        "getPatientData($pid, \"DOB\")", 'getPatientData($pid, "pubpid")'
    ]) expect(php).toContain(token);
    expect(php).toMatch(/<label[^>]*for="selPagesize"/);
    expect(php).toContain("<caption class='oe-history-pagination'>");
    expect(php).toMatch(/class='encrow text'[^>]*tabindex='0'/);
    expect(php).toMatch(/class='text docrow'[^>]*tabindex='0'/);
    expect(php).toContain('oeVisitHistory.bindRowKeyboard(document, { openEncounter: toencounter, openDocument: todocument });');
});
