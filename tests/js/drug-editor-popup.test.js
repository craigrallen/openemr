/**
 * @jest-environment node
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const postcss = require('postcss');
const { JSDOM } = require('jsdom');

const root = path.join(__dirname, '../..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const route = () => read('interface/drugs/add_edit_drug.php');
const css = () => read('interface/clinical-workspace/drug-editor-popup.css');
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');

// Whole-file sha256 of interface/drugs/add_edit_drug.php at 18647270, before the adaptation.
const ROUTE_BASELINE = '1e9a5b4336a16cd637dfff2e4cb95fa3da7bf9ee1b459cf19b7b4ea5c977a0fd';
// Files the route depends on or is launched from; none is part of the adaptation.
const UNCHANGED = {
    // Launcher: dodclick() opens this route with dlgopen(..., 900, 600) and owns refreshme().
    'interface/drugs/drug_inventory.php': '6274e2f466498e32988224ba283702f17ed6e6e11f4959cf21934df41365a23a',
    // Same-frame destination after adding a new drug.
    'interface/drugs/add_edit_lot.php': '696e010b78d936b19d82e596527227fde28e2992447ea5932c0add678e58383d',
    // Nested code picker opened by sel_related().
    'interface/patient_file/encounter/find_code_dynamic.php': '8c81201e73131b537556f7145f672c6ad5040a89be58a3e10bdb86bc7f8a74ef',
    // dlgopen sizing.
    'library/dialog.js': 'f9f06fdb1297296cab38cda00f898d12a6a11330c26471e922b02cf624b6a17c',
};
// Shared workbench popup files are not edited by this slice.
const SHARED = ['interface/clinical-workspace/popup.css', 'interface/clinical-workspace/popup.js'];

// ClinicalWorkspaceAssets::SUPPORTED at 18647270, in order.
const ASSETS_BASELINE = [
    'ajtooltip.js', 'appointment.css', 'calendar-sidebar.js', 'calendar-workday.css', 'calendar-workday.js',
    'encounter-document.css', 'finder.css', 'global-messages.css', 'history-document.css', 'history-editor.css',
    'issue-popup.css', 'lbf-document.css', 'mode.js', 'patient-messages.css', 'patient-picker-popup.css',
    'patient-results-popup.css', 'patient-search.css', 'soap-document.css', 'soap-document.js', 'soap-reference.css',
    'soap-reference.js', 'visit-history.css', 'visit-history.js', 'workspace.css',
];

const SCOPE = 'html.oe-workbench-popup body.oe-drug-editor-popup';
const HEADER = '<?php Header::setupHeader(["opener"]); ?>\n';
const LINK = "<?php $clinicalAssets = new ClinicalWorkspaceAssets(); ?>\n"
    + '<link rel="stylesheet" media="screen" href="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>'
    + "/interface/clinical-workspace/drug-editor-popup.css?v=<?php echo attr_url($clinicalAssets->version('drug-editor-popup.css')); ?>\">\n";

// The only intended insertions, as a reversible mapping: [added text, its original form].
const INSERTIONS = [
    ['use OpenEMR\\Common\\Acl\\AclMain;\nuse OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;\n', 'use OpenEMR\\Common\\Acl\\AclMain;\n'],
    [HEADER + LINK, HEADER],
    ['<body class="body_top oe-drug-editor-popup">', '<body class="body_top">'],
    ["<form class='oe-drug-editor-form' method='post' name='theform'", "<form method='post' name='theform'"],
    ['<table class="table table-borderless pl-5 oe-drug-editor-limits">', '<table class="table table-borderless pl-5">'],
    ["<table class='table table-borderless oe-drug-editor-templates'>", "<table class='table table-borderless'>"],
    ['<div class="btn-group oe-drug-editor-actions">', '<div class="btn-group">'],
];

const count = (text, needle) => text.split(needle).length - 1;

// Strict inverse: every insertion occurs exactly once and no original form survives unadapted.
const normalize = (source) => INSERTIONS.reduce((text, [added, original]) => {
    expect([added, count(text, added)]).toEqual([added, 1]);
    if (!added.startsWith(original)) {
        expect([original, count(text, original)]).toEqual([original, 0]);
    }
    return text.split(added).join(original);
}, source);

// Mapping used for mutation checks: tolerates a missing insertion instead of asserting.
const looseNormalize = (source) => INSERTIONS.reduce((text, [added, original]) => text.split(added).join(original), source);

const CONTRACT_KEYS = ['tag', 'id', 'name', 'type', 'value', 'size', 'maxlength', 'min', 'step', 'method', 'action',
    'onsubmit', 'onclick', 'onkeyup', 'onblur', 'title', 'readonly', 'style', 'data-toggle', 'data-placement'];
const controls = (source) => [...source.replace(/<\?php[\s\S]*?\?>/g, '@')
    .matchAll(/<(form|input|select|option|textarea|button|label|th|td|tr|table|div)\b([^>]*)>/g)]
    .map(([, tag, attrs]) => {
        const control = { tag };
        for (const [, key, double, single] of attrs.matchAll(/([\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'))?/g)) {
            if (CONTRACT_KEYS.includes(key.toLowerCase())) control[key.toLowerCase()] = double ?? single ?? true;
        }
        return control;
    });

describe('drug editor route source contract', () => {
    test('launcher, post-save destination, nested picker and dlgopen are byte-identical', () => {
        for (const [file, sha] of Object.entries(UNCHANGED)) {
            expect([file, hash(read(file))]).toEqual([file, sha]);
        }
        const launcher = read('interface/drugs/drug_inventory.php');
        expect(launcher).toContain("dlgopen('add_edit_drug.php?' + params.toString(), '_blank', 900, 600);");
        expect(launcher).toContain("onclick='dodclick(0)'");
        expect(launcher).toContain('function refreshme() {');
    });

    test('shared popup frame files are untouched by this slice', () => {
        const diffFree = SHARED.map((file) => [file, read(file).includes('drug-editor')]);
        expect(diffFree).toEqual(SHARED.map((file) => [file, false]));
    });

    test('route reverses to the exact baseline bytes through the presentation mapping', () => {
        const source = route();
        expect(hash(source)).not.toBe(ROUTE_BASELINE);
        expect(hash(normalize(source))).toBe(ROUTE_BASELINE);
    });

    test('controls, labels, cells, handlers and inline styles are unchanged apart from the added classes', () => {
        const source = route();
        expect(controls(source)).toEqual(controls(normalize(source)));
        // Original classes survive alongside the added ones.
        expect(source).toContain('<body class="body_top oe-drug-editor-popup">');
        expect(source).toContain('<h3 class="ml-1"><?php echo text($title);?></h3>');
        expect(count(source, '<div class="form-group mt-3 drugsonly"')).toBe(8);
        expect(count(source, "<div class=\"form-group mt-3 ippfonly\" style='display:none'>")).toBe(1);
        expect(count(source, "<th class='drugsonly'>")).toBe(5);
        expect(count(source, "<td class='tmplcell drugsonly'>")).toBe(6);
        expect(count(source, "\"  <td class='tmplcell drugsonly'>\"")).toBe(6);
        expect(count(source, "\"  <td class='tmplcell'>\"")).toBe(2);
    });

    test('conditional product, IPPF and template-line behaviour is byte-present', () => {
        const source = route();
        for (const fragment of [
            "<?php if (OEGlobalsBag::getInstance()->get('sell_non_drug_products') == 2) { // \"Products but no prescription drugs and no templates\" ?>\n.drugsonly { display:none; }\n<?php } else { ?>\n.drugsonly { }\n<?php } ?>",
            "<?php if (empty(OEGlobalsBag::getInstance()->get('ippf_specific'))) { ?>\n.ippfonly { display:none; }\n<?php } else { ?>\n.ippfonly { }\n<?php } ?>",
            "$blank_lines = OEGlobalsBag::getInstance()->get('sell_non_drug_products') == 2 ? 1 : 3;",
            "$blank_lines = OEGlobalsBag::getInstance()->get('sell_non_drug_products') == 2 ? 0 : 1;",
            "$selector = OEGlobalsBag::getInstance()->get('sell_non_drug_products') == 2 ? $row['name'] : '';",
            "writeTemplateLine($selector, '', '', '', '', $emptyPrices, '', '1');",
            "<?php echo OEGlobalsBag::getInstance()->get('sell_non_drug_products') == 2 ? xlt('Fees') : xlt('Templates'); ?>:",
            "<?php echo !empty(OEGlobalsBag::getInstance()->get('gbl_min_max_months')) ? xlt('Months') : xlt('Units'); ?>",
            "<?php if (AclMain::aclCheckCore('admin', 'super') && $drug_id) { ?>",
            "$tmpl[\"1\"]['selector'] = $_POST['form_name'];",
        ]) {
            expect([fragment, count(source, fragment)]).toEqual([fragment, 1]);
        }
    });

    test.each([
        ['drug id source', "$drug_id = $_REQUEST['drug'];", "$drug_id = $_GET['drug'];"],
        ['ACL gate', "if (!AclMain::aclCheckCore('admin', 'drugs')) {", 'if (false) {'],
        ['first CSRF check', "if (!empty($_POST['form_save'])) {\n    CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: true);", "if (!empty($_POST['form_save'])) {\n"],
        ['second CSRF check', "&& !$alertmsg) {\n    CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: true);", '&& !$alertmsg) {\n'],
        ['CSRF token field', 'name="csrf_token_form"', 'name="csrf_token_removed"'],
        ['CSRF token session', 'CsrfUtils::collectCsrfToken(session: $session)', 'CsrfUtils::collectCsrfToken()'],
        ['session lookup', '$session = SessionWrapperFactory::getInstance()->getActiveSession();', '$session = null;'],
        ['server name required', "$alertmsg = xl('Drug name is required');", "$alertmsg = '';"],
        ['duplicate SQL', '"drug_id != ?",', '"drug_id != $drug_id",'],
        ['billing units validation', "['options' => ['min_range' => 1, 'max_range' => 2147483647]]", "['options' => ['min_range' => 0]]"],
        ['NDC unit validation', '!array_key_exists($ndc_uom, HcpcsDrugDefaults::NDC_UOM_CHOICES)', 'false'],
        ['NDC pair validation', "(($ndc_uom === '') !== ($ndc_quantity === null))", 'false'],
        ['update SQL', '"consumable = ? " .\n                "WHERE drug_id = ?",', '"consumable = ? ",'],
        ['delete super ACL', "if (AclMain::aclCheckCore('admin', 'super')) {\n                sqlStatement(\"DELETE FROM drug_inventory", "if (true) {\n                sqlStatement(\"DELETE FROM drug_inventory"],
        ['delete drugs SQL', 'sqlStatement("DELETE FROM drugs WHERE drug_id = ?", [$drug_id]);', ''],
        ['insert SQL', '"dispensable, allow_multiple, allow_combining, active, consumable " .', '"dispensable, allow_multiple, active, consumable " .'],
        ['template SQL', '"drug_id, selector, dosage, period, quantity, refills, taxrates, pkgqty " .', '"drug_id, selector, dosage " .'],
        ['price SQL', '[$drug_id, $selector, $key, $value]', '[$drug_id, $selector, $key, 0]'],
        ['warehouse SQL', 'sqlStatement("DELETE FROM product_warehouse WHERE pw_drug_id = ?", [$drug_id]);', ''],
        ['opener refresh', 'echo " if (opener.refreshme) opener.refreshme();\\n";', 'echo " opener.refreshme();\\n";'],
        ['new drug to lot', "echo \" window.location.href='add_edit_lot.php?drug=\" . attr_url($drug_id) . \"&lot=0'\\n\";", 'echo "";'],
        ['window close after save', 'echo " window.close();\\n";', 'echo "\\n";'],
        ['submit validation', "onsubmit='return validate(this);'", "onsubmit='return true;'"],
        ['client name required', "alert(<?php echo xlj('Product name is required'); ?>);", 'void 0;'],
        ['delete confirmation', "xlj('This will permanently delete all lots of this product. Related reports will be incomplete or incorrect. Are you sure?')", "xlj('Delete?')"],
        ['session restore', ' top.restoreSession();\n return true;', ' return true;'],
        ['restoreSession include', '<?php require(OEGlobalsBag::getInstance()->getSrcDir() . "/restoreSession.php"); ?>', ''],
        ['code picker', "dlgopen('../patient_file/encounter/find_code_dynamic.php' + getter, '_blank', 900, 800);", "dlgopen('../patient_file/encounter/find_code_dynamic.php' + getter, '_blank', 600, 400);"],
        ['code duplicate guard', "if (s.indexOf(codetype + ':') == 0 || s.indexOf(';' + codetype + ':') > 0) {", 'if (false) {'],
        ['del_related', 'my_del_related(s, document.forms[0].form_related_code, false);', ''],
        ['dispensable handler', "onclick='dispensable_changed();'", ''],
        ['dispensable load call', '\ndispensable_changed();\n', '\n'],
        ['RXCUI picker handler', 'onclick=\'sel_related("?codetype=RXCUI&limit=1&target_element=form_drug_code")\'', ''],
        ['related picker handler', 'onclick=\'sel_related("?target_element=form_related_code")\'', ''],
        ['NDC mask', "onkeyup='maskkeyup(this,", "onkeyup='void(this,"],
        ['save clicked flag', "name='form_save'\n         value=", "name='form_go'\n         value="],
        ['cancel action', "onclick='window.close()'><?php echo xlt('Cancel'); ?>", "onclick='history.back()'><?php echo xlt('Cancel'); ?>"],
        ['tooltip init', "$('[data-toggle=\"tooltip\"]').tooltip();", ''],
        ['post-load alert', 'echo "alert(" . js_escape($alertmsg) . ");\\n";', ''],
        ['header assets', 'Header::setupHeader(["opener"]);', 'Header::setupHeader();'],
        ['products-only hide', '.drugsonly { display:none; }', '.drugsonly { }'],
        ['IPPF inline hide', "<div class=\"form-group mt-3 ippfonly\" style='display:none'>", '<div class="form-group mt-3 ippfonly">'],
        ['blank template lines', "== 2 ? 1 : 3;", '== 2 ? 1 : 1;'],
        ['title margin', '<h3 class="ml-1">', '<h3>'],
    ])('negative mutation of %s breaks the inverse hash', (label, from, to) => {
        const source = route();
        expect([label, source.includes(from)]).toEqual([label, true]);
        expect(hash(looseNormalize(source.replace(from, to)))).not.toBe(ROUTE_BASELINE);
    });

    test('a presentation insertion left un-mapped also breaks the inverse hash', () => {
        const source = route().replace('oe-drug-editor-actions', 'oe-drug-editor-actions extra');
        expect(hash(looseNormalize(source))).not.toBe(ROUTE_BASELINE);
    });

    test('stylesheet is linked once, screen-only, after Header::setupHeader, versioned by the helper', () => {
        const source = route();
        expect(count(source, 'drug-editor-popup.css')).toBe(2);
        expect(source).toContain(LINK);
        expect(source.indexOf(LINK)).toBeGreaterThan(source.indexOf(HEADER));
        // Before the route's own inline <style>, which keeps owning .drugsonly / .ippfonly.
        expect(source.indexOf(LINK)).toBeLessThan(source.indexOf('<style>'));
    });
});

describe('ClinicalWorkspaceAssets allowlist', () => {
    const supported = () => {
        const assets = read('src/Common/Assets/ClinicalWorkspaceAssets.php');
        return [...assets.match(/SUPPORTED = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    };

    test('keeps the full existing list and adds only drug-editor-popup.css, sorted', () => {
        const list = supported();
        expect(list).toEqual([...ASSETS_BASELINE, 'drug-editor-popup.css'].sort());
        expect(list.filter((name) => !ASSETS_BASELINE.includes(name))).toEqual(['drug-editor-popup.css']);
    });

    test('lookup stays name-based: in_array strict, no path joining before the check', () => {
        const assets = read('src/Common/Assets/ClinicalWorkspaceAssets.php');
        expect(assets).toContain('if (!in_array($asset, self::SUPPORTED, true)) {');
        expect(assets.indexOf('in_array($asset, self::SUPPORTED, true)')).toBeLessThan(assets.indexOf("$path = $this->directory . '/' . $asset;"));
    });

    test('the PHP isolated test pins the full list, the new file and traversal/near-miss rejection', () => {
        const phpTest = read('tests/Tests/Isolated/Common/Assets/ClinicalWorkspaceAssetsTest.php');
        expect(phpTest).toContain('drugEditorPopupStylesheetUsesItsOwnModificationTimeAndMissingFallback');
        expect(phpTest).toContain('shippedDrugEditorPopupStylesheetIsVersioned');
        expect(phpTest).toContain('supportedListIsExactlyTheExistingAssetsPlusTheDrugEditorPopup');
        expect(phpTest).toContain("'near-miss drug editor stylesheet' => ['drug_editor_popup.css'],");
        expect(phpTest).toContain("'drug editor stylesheet traversal' => ['../clinical-workspace/drug-editor-popup.css'],");
        for (const name of ASSETS_BASELINE) expect(phpTest).toContain(`'${name}',`);
    });
});

// ---------------------------------------------------------------------------------------------
// Synthetic DOM built from the route's own markup (PHP resolved to synthetic, non-private values).

const resolvePhp = (markup) => markup
    .replace(/<\?php echo attr_url\(\$drug_id\); \?>/g, '7')
    .replace(/<\?php echo CsrfUtils::collectCsrfToken\(session: \$session\); \?>/, 'synthetic-token')
    .replace(/<\?php echo attr\(js_escape\(OEGlobalsBag::getInstance\(\)->getString\('gbl_mask_product_id'\)\)\); \?>/g, '&quot;#####-####-##&quot;')
    .replace(/<\?php echo (?:xlt|xla)\('([^']*)'\);? ?\?>/g, '$1')
    .replace(/<\?php[\s\S]*?\?>/g, '');

// One synthetic template line and warehouse pair, shaped as writeTemplateLine() and the warehouse
// loop emit them (counts asserted against the source above), with two price levels and one tax rate.
const SYNTHETIC_TEMPLATE_HEAD = '<th>Standard</th><th>Discount</th><th>VAT</th>';
const SYNTHETIC_TEMPLATE_LINE = '<tr>'
    + "<td class='tmplcell drugsonly'><input class='form-control' name='form_tmpl[1][selector]' value='' size='8' maxlength='100'></td>"
    + "<td class='tmplcell drugsonly'><input class='form-control' name='form_tmpl[1][dosage]' value='' size='6' maxlength='10'></td>"
    + "<td class='tmplcell drugsonly'><select name='form_tmpl[1][period]' class='form-control'><option value=''></option></select></td>"
    + "<td class='tmplcell drugsonly'><input class='form-control' name='form_tmpl[1][quantity]' value='' size='3' maxlength='7'></td>"
    + "<td class='tmplcell drugsonly'><input class='form-control' name='form_tmpl[1][refills]' value='' size='3' maxlength='5'></td>"
    + "<td class='tmplcell'><input class='form-control' name='form_tmpl[1][price][standard]' value='' size='6' maxlength='12'></td>"
    + "<td class='tmplcell'><input class='form-control' name='form_tmpl[1][price][discount]' value='' size='6' maxlength='12'></td>"
    + "<td class='tmplcell'><input type='checkbox' name='form_tmpl[1][taxrate][vat]' value='1' /></td>"
    + '</tr>';

function syntheticForm({ withDelete = true } = {}) {
    const source = route();
    let form = resolvePhp(source.slice(source.indexOf('<form'), source.indexOf('</form>') + '</form>'.length));
    expect(form).not.toMatch(/<\?php|\?>/);
    if (!withDelete) {
        form = form.replace(/<button class="btn btn-danger"[\s\S]*?<\/button>/, '');
    }
    return form;
}

// The route's actual inline <style>, resolved for one global configuration.
function inlineStyle({ productsOnly, ippf }) {
    const source = route();
    const block = source.slice(source.indexOf('<style>') + '<style>'.length, source.indexOf('</style>'));
    return block
        .replace(/<\?php if \(OEGlobalsBag::getInstance\(\)->get\('sell_non_drug_products'\) == 2\) \{[^?]*\?>([\s\S]*?)<\?php \} else \{ \?>([\s\S]*?)<\?php \} \?>/, (m, yes, no) => (productsOnly ? yes : no))
        .replace(/<\?php if \(empty\(OEGlobalsBag::getInstance\(\)->get\('ippf_specific'\)\)\) \{ \?>([\s\S]*?)<\?php \} else \{ \?>([\s\S]*?)<\?php \} \?>/, (m, yes, no) => (ippf ? no : yes));
}

// The route's actual inline scripts with only their PHP output expressions resolved.
function routeScripts() {
    const source = route();
    const blocks = [...source.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    const resolve = (js) => js
        .replace(/<\?php echo xlj\('([^']*)'\);? ?\?>/g, (m, text) => JSON.stringify(text))
        .replace(/<\?php[\s\S]*?\?>/g, '');
    const head = resolve(blocks[0]);
    const tail = resolve(blocks[blocks.length - 1]);
    expect(head).toContain('function validate(f) {');
    expect(tail).toContain('dispensable_changed();');
    for (const js of [head, tail]) expect(js).not.toMatch(/<\?php|\?>/);
    return { head, tail };
}

function documentHtml({ workbench = true, bodyClass = 'body_top oe-drug-editor-popup', withCss = true, productsOnly = false, ippf = false, withDelete = true } = {}) {
    return `<!doctype html><html${workbench ? ' class="oe-workbench-context oe-workbench-popup"' : ''}><head>`
        + `<style>${inlineStyle({ productsOnly, ippf })}</style>`
        // Placed after the inline style so that an order-based cascade would let it win if it ever
        // declared display on a conditional element; the route links it before the inline style.
        + `${withCss ? `<style>${css()}</style>` : ''}</head>`
        + `<body class="${bodyClass}"><h3 class="ml-1">Update Drug</h3>${syntheticForm({ withDelete })}</body></html>`;
}

function populate(doc) {
    const templates = doc.querySelector('form table:nth-of-type(2)') || doc.querySelectorAll('form table')[1];
    templates.querySelector('thead tr').insertAdjacentHTML('beforeend', SYNTHETIC_TEMPLATE_HEAD);
    templates.querySelector('tbody').insertAdjacentHTML('beforeend', SYNTHETIC_TEMPLATE_LINE);
    const limits = doc.querySelectorAll('form table')[0];
    const [head, min, max] = limits.querySelectorAll('tr');
    head.insertAdjacentHTML('beforeend', "<td class='align-top'>Main</td>");
    min.insertAdjacentHTML('beforeend', "<td class='align-top'><input class='form-control' name='form_wh_min[main]' value='0' size='5' /></td>");
    max.insertAdjacentHTML('beforeend', "<td class='align-top'><input class='form-control' name='form_wh_max[main]' value='0' size='5' /></td>");
    return doc;
}

// jsdom has no named-control getters on HTMLFormElement; mirror the browser's for the route's names.
function namedControls(form) {
    for (const element of form.elements) {
        if (element.name && !(element.name in form)) {
            Object.defineProperty(form, element.name, { get: () => form.elements.namedItem(element.name) });
        }
    }
    return form;
}

function load(options = {}) {
    const dom = new JSDOM(documentHtml(options), { runScripts: 'dangerously' });
    const win = dom.window;
    populate(win.document);
    const form = namedControls(win.document.forms[0]);
    const calls = [];
    const ready = [];
    win.alert = (message) => calls.push(['alert', message]);
    win.confirmAnswer = false;
    win.confirm = (message) => { calls.push(['confirm', message]); return win.confirmAnswer; };
    // top === window in a lone jsdom document; the spy stands in for the shell's restoreSession.
    win.restoreSession = () => calls.push(['restoreSession']);
    win.close = () => calls.push(['close']);
    win.dlgopen = (...args) => calls.push(['dlgopen', ...args]);
    win.my_del_related = (s, field, flag) => calls.push(['my_del_related', s, field.name, flag]);
    win.maskkeyup = (el, mask) => calls.push(['maskkeyup', el.name, mask]);
    win.maskblur = (el, mask) => calls.push(['maskblur', el.name, mask]);
    win.$ = (arg) => {
        if (typeof arg === 'function') ready.push(arg);
        return { tooltip: () => calls.push(['tooltip', arg]) };
    };
    const { head, tail } = routeScripts();
    win.eval(head);
    win.eval(tail);
    return { win, form, calls, ready };
}

const submit = (win, form) => form.dispatchEvent(new win.Event('submit', { cancelable: true }));
const click = (el) => el.onclick.call(el, new el.ownerDocument.defaultView.Event('click'));

describe('actual inline scripts in jsdom (no submission, no network)', () => {
    test('on load: dispensable_changed() disables lot options when Inventory is unchecked; tooltips bind on ready', () => {
        const { win, form, calls, ready } = load();
        expect(form.form_dispensable.checked).toBe(false);
        expect([form.form_allow_multiple.disabled, form.form_allow_combining.disabled]).toEqual([true, true]);
        form.form_dispensable.checked = true;
        click(form.form_dispensable);
        expect([form.form_allow_multiple.disabled, form.form_allow_combining.disabled]).toEqual([false, false]);
        expect(ready).toHaveLength(1);
        ready[0]();
        expect(calls).toEqual([['tooltip', '[data-toggle="tooltip"]']]);
        void win;
    });

    test('save with a blank name alerts and cancels without restoring the session', () => {
        const { win, form, calls } = load();
        click(form.form_save);
        expect(form.form_save.clicked).toBe(true);
        form.form_name.value = '   ';
        expect(submit(win, form)).toBe(false);
        expect(form.form_save.clicked).toBe(false);
        expect(calls).toEqual([['alert', 'Product name is required']]);
    });

    test('save with a name restores the session and allows the submit event', () => {
        const { win, form, calls } = load();
        form.form_name.value = 'Synthetic product';
        click(form.form_save);
        expect(submit(win, form)).toBe(true);
        expect(calls).toEqual([['restoreSession']]);
    });

    test('delete asks for confirmation; decline cancels, accept restores the session', () => {
        const { win, form, calls } = load();
        click(form.form_delete);
        expect(submit(win, form)).toBe(false);
        win.confirmAnswer = true;
        click(form.form_delete);
        expect(submit(win, form)).toBe(true);
        const question = 'This will permanently delete all lots of this product. Related reports will be incomplete or incorrect. Are you sure?';
        expect(calls).toEqual([['confirm', question], ['confirm', question], ['restoreSession']]);
    });

    test('recorded original behaviour, preserved: without a Delete button validate() throws after the name check', () => {
        const { win, form, calls } = load({ withDelete: false });
        expect(form.form_delete).toBeUndefined();
        form.form_name.value = 'Synthetic product';
        click(form.form_save);
        // The error comes from the jsdom realm, so compare against its TypeError.
        expect(() => win.validate(form)).toThrow(win.TypeError);
        expect(calls).toEqual([]);
    });

    test('code pickers open find_code_dynamic.php at 900x800 with the original getters', () => {
        const { form, calls } = load();
        click(form.form_drug_code);
        click(form.form_related_code);
        expect(calls).toEqual([
            ['dlgopen', '../patient_file/encounter/find_code_dynamic.php?codetype=RXCUI&limit=1&target_element=form_drug_code', '_blank', 900, 800],
            ['dlgopen', '../patient_file/encounter/find_code_dynamic.php?target_element=form_related_code', '_blank', 900, 800],
        ]);
        expect([form.form_drug_code.readOnly, form.form_related_code.readOnly]).toEqual([true, true]);
    });

    test('picker callbacks set, append, reject duplicates, clear, list and delete related codes', () => {
        const { win, form, calls } = load();
        expect(win.set_related_target('RXCUI', '1191', '', 'Synthetic', 'form_drug_code', 1)).toBe('');
        expect(form.form_drug_code.value).toBe('RXCUI:1191');
        expect(win.set_related_target('CPT4', '99999', '', '', 'form_related_code')).toBe('');
        expect(win.set_related_target('CPT4', '99998', '', '', 'form_related_code'))
            .toBe('A code of this type is already selected. Erase the field first if you need to replace it.');
        expect(win.set_related_target('PROD', '5', '', '', 'form_related_code')).toBe('');
        expect(win.set_related_target('PROD', '6', '', '', 'form_related_code')).toBe('');
        expect(form.form_related_code.value).toBe('CPT4:99999;PROD:5;PROD:6');
        expect(win.get_related()).toEqual(['CPT4:99999', 'PROD:5', 'PROD:6']);
        win.del_related('PROD:5');
        expect(calls).toEqual([['my_del_related', 'PROD:5', 'form_related_code', false]]);
        expect(win.set_related_target('CPT4', '', '', '', 'form_related_code')).toBe('');
        expect(form.form_related_code.value).toBe('');
    });

    test('NDC mask handlers and Cancel run their original inline code', () => {
        const { win, form, calls } = load();
        form.form_ndc_number.onkeyup.call(form.form_ndc_number, new win.Event('keyup'));
        form.form_ndc_number.onblur.call(form.form_ndc_number, new win.Event('blur'));
        const cancel = win.document.querySelector('.btn-cancel');
        click(cancel);
        expect(calls).toEqual([
            ['maskkeyup', 'form_ndc_number', '#####-####-##'],
            ['maskblur', 'form_ndc_number', '#####-####-##'],
            ['close'],
        ]);
    });

    test('the same handlers behave identically without the stylesheet or workbench context', () => {
        const { win, form, calls } = load({ withCss: false, workbench: false });
        form.form_name.value = 'Synthetic product';
        click(form.form_save);
        expect(submit(win, form)).toBe(true);
        expect(calls).toEqual([['restoreSession']]);
    });

    test('all buttons and every control remain in the actions and form', () => {
        const { win } = load();
        const actions = [...win.document.querySelectorAll('.btn-group > button')];
        expect(actions.map((b) => [b.type, b.name, b.className])).toEqual([
            ['submit', 'form_save', 'btn btn-primary btn-save'],
            ['submit', 'form_delete', 'btn btn-danger'],
            ['button', '', 'btn btn-secondary btn-cancel'],
        ]);
    });
});

// ---------------------------------------------------------------------------------------------
// Stylesheet guards. cssViolations() is also run against deliberately broken stylesheets below.

const FORBIDDEN_PROPS = ['font', 'font-size', 'font-family', 'font-weight', 'font-style', 'font-stretch', 'line-height',
    'letter-spacing', 'word-spacing', 'text-transform', 'zoom', 'transform', 'scale', 'visibility', 'clip', 'clip-path',
    'height', 'max-height', 'position', 'z-index', 'filter', 'content', 'margin', 'margin-top', 'margin-left',
    'margin-right', 'margin-inline', 'margin-inline-start', 'margin-inline-end', 'margin-block', 'margin-block-start',
    'background'];
const MARGIN_ALLOWED = { 'margin-bottom': [`${SCOPE} .oe-drug-editor-form > .form-group`] };
const OVERFLOW_ALLOWED = [`${SCOPE} .oe-drug-editor-form .oe-drug-editor-limits`, `${SCOPE} .oe-drug-editor-form .oe-drug-editor-templates`];
const CONDITIONAL = '.drugsonly, .ippfonly';

function cssViolations(text) {
    const violations = [];
    const ast = postcss.parse(text);
    const rules = [];
    ast.walkRules((rule) => rules.push(rule));
    ast.walkAtRules((at) => {
        if (`${at.name} ${at.params}` !== 'media screen' || at.parent.type !== 'root') violations.push(['at-rule', `${at.name} ${at.params}`]);
    });
    ast.walkComments(() => {});
    const inside = populate(new JSDOM(documentHtml({ withCss: false })).window.document);
    const productsOnly = populate(new JSDOM(documentHtml({ withCss: false, productsOnly: true, ippf: true })).window.document);
    let focus = 0;
    let focusVisible = 0;
    for (const rule of rules) {
        if (!(rule.parent.type === 'atrule' && rule.parent.params === 'screen')) violations.push(['outside screen', rule.selector]);
        const decls = rule.nodes.filter((n) => n.type === 'decl');
        const props = new Map(decls.map((d) => [d.prop, d]));
        for (const selector of rule.selectors) {
            if (!(selector === SCOPE || selector.startsWith(`${SCOPE} `))) violations.push(['unscoped', selector]);
            if (/drugsonly|ippfonly|\[style/.test(selector)) violations.push(['conditional selector', selector]);
        }
        const kinds = new Set(rule.selectors.filter((s) => /:focus/.test(s)).map((s) => (/:focus-visible/.test(s) ? 'visible' : 'focus')));
        if (kinds.size > 1 || (kinds.size === 1 && rule.selectors.some((s) => !/:focus/.test(s)))) violations.push(['mixed focus', rule.selector]);
        if (kinds.has('visible')) {
            focusVisible += 1;
            if (!/^2px solid var\(--oe-wb-/.test(props.get('outline')?.value ?? '')) violations.push(['focus-visible outline', rule.selector]);
        }
        if (kinds.has('focus')) focus += 1;
        const placeholder = rule.selectors.every((s) => s.endsWith('::placeholder'));
        for (const decl of decls) {
            if (decl.important) violations.push(['important', `${rule.selector} ${decl.prop}`]);
            if (FORBIDDEN_PROPS.includes(decl.prop) && !(MARGIN_ALLOWED[decl.prop] || []).includes(rule.selector)) violations.push(['forbidden', `${rule.selector} ${decl.prop}`]);
            if (decl.prop === 'opacity' && !(placeholder && decl.value === '1')) violations.push(['opacity', rule.selector]);
            if (/^overflow(-[xy])?$/.test(decl.prop) && !OVERFLOW_ALLOWED.includes(rule.selector)) violations.push(['overflow', rule.selector]);
            if (/^(outline|outline-style)$/.test(decl.prop) && /^(0|none)\b/.test(decl.value)) violations.push(['outline removed', rule.selector]);
            if (/color|background|border|outline|shadow/.test(decl.prop) && /#|rgb|hsl|\b(white|black|transparent)\b/.test(decl.value)) violations.push(['raw colour', `${rule.selector} ${decl.prop}`]);
            for (const [, token] of decl.value.matchAll(/var\((--[\w-]+)\)/g)) {
                if (!token.startsWith('--oe-wb-')) violations.push(['token', token]);
            }
            if (decl.prop === 'display') {
                if (decl.value === 'none') violations.push(['display none', rule.selector]);
                for (const selector of rule.selectors) {
                    const structural = selector.replace(/::?(focus-visible|focus|hover|placeholder)/g, '');
                    for (const doc of [inside, productsOnly]) {
                        const hit = [...doc.querySelectorAll(structural)].some((el) => el.matches(CONDITIONAL) || el.closest('[style]'));
                        if (hit) violations.push(['display on conditional element', selector]);
                    }
                }
            }
        }
        // Paper and ink travel together; a placeholder rule pairs with its field's paper.
        const paper = props.has('background-color');
        const ink = props.has('color');
        if (placeholder ? paper || !ink : paper !== ink) violations.push(['unpaired colour', rule.selector]);
        if (rule.selector === SCOPE && (paper || props.has('background'))) violations.push(['body background', rule.selector]);
    }
    if (focus === 0 || focusVisible === 0) violations.push(['focus coverage', `${focus}/${focusVisible}`]);
    return violations;
}

const parse = () => {
    const list = [];
    postcss.parse(css()).walkRules((rule) => list.push(rule));
    return list;
};
const block = (selector) => {
    const found = parse().find((rule) => rule.selector === `${SCOPE} ${selector}`);
    expect([selector, !!found]).toEqual([selector, true]);
    return Object.fromEntries(found.nodes.filter((n) => n.type === 'decl').map((d) => [d.prop, d.value]));
};

describe('drug editor stylesheet', () => {
    test('passes every guard: screen-only scope, typography, conditionals, palette pairing, focus split, no !important', () => {
        expect(cssViolations(css())).toEqual([]);
        expect(css()).not.toMatch(/@media print|@import|@font-face|url\(/);
    });

    test.each([
        ['unscoped rule', (t) => `${t}\n@media screen { .form-group { padding: 0; } }`, 'unscoped'],
        ['print block', (t) => `${t}\n@media print { ${SCOPE} .oe-drug-editor-form { padding: 0; } }`, 'at-rule'],
        ['rule outside @media screen', (t) => `${t}\n${SCOPE} .oe-drug-editor-form { padding: 0; }`, 'outside screen'],
        ['display on conditional rows', (t) => `${t}\n@media screen { ${SCOPE} .oe-drug-editor-form > .form-group { display: flex; } }`, 'display on conditional element'],
        ['display on conditional cells', (t) => `${t}\n@media screen { ${SCOPE} .oe-drug-editor-templates th { display: table-cell; } }`, 'display on conditional element'],
        ['display on the IPPF inline-hidden row child', (t) => `${t}\n@media screen { ${SCOPE} .oe-drug-editor-form input[name='form_cyp_factor'] { display: block; } }`, 'display on conditional element'],
        ['conditional class selector', (t) => `${t}\n@media screen { ${SCOPE} .drugsonly { color: var(--oe-wb-ink); background-color: var(--oe-wb-paper); } }`, 'conditional selector'],
        ['shrunk text', (t) => `${t}\n@media screen { ${SCOPE} .oe-drug-editor-form { font-size: 0.75rem; } }`, 'forbidden'],
        ['margin shorthand', (t) => `${t}\n@media screen { ${SCOPE} h3 { margin: 0; } }`, 'forbidden'],
        ['body background override', (t) => `${t}\n@media screen { ${SCOPE} { color: var(--oe-wb-ink); background-color: var(--oe-wb-canvas) !important; } }`, 'important'],
        ['unpaired ink', (t) => `${t}\n@media screen { ${SCOPE} .oe-drug-editor-form label { color: var(--oe-wb-muted); } }`, 'unpaired colour'],
        ['raw colour', (t) => `${t}\n@media screen { ${SCOPE} .oe-drug-editor-form label { color: #333; background-color: var(--oe-wb-paper); } }`, 'raw colour'],
        ['mixed focus rule', (t) => `${t}\n@media screen { ${SCOPE} .form-control:focus, ${SCOPE} .form-control:focus-visible { outline: 2px solid var(--oe-wb-petrol); } }`, 'mixed focus'],
        ['outline removed', (t) => `${t}\n@media screen { ${SCOPE} .btn:focus { outline: none; } }`, 'outline removed'],
        ['clipping overflow', (t) => `${t}\n@media screen { ${SCOPE} .oe-drug-editor-actions { overflow: hidden; } }`, 'overflow'],
    ])('guard rejects a stylesheet with %s', (label, mutate, kind) => {
        const kinds = cssViolations(mutate(css())).map(([k]) => k);
        expect([label, kinds.includes(kind)]).toEqual([label, true]);
    });

    test('every selector matches the route inside a workbench popup and nothing outside it', () => {
        const inside = populate(new JSDOM(documentHtml({ withCss: false })).window.document);
        const legacy = populate(new JSDOM(documentHtml({ withCss: false, workbench: false })).window.document);
        const other = populate(new JSDOM(documentHtml({ withCss: false, bodyClass: 'body_top' })).window.document);
        for (const rule of parse()) {
            for (const selector of rule.selectors) {
                const structural = selector.replace(/::?(focus-visible|focus|hover|placeholder)/g, '');
                expect([selector, inside.querySelectorAll(structural).length > 0]).toEqual([selector, true]);
                expect([selector, legacy.querySelectorAll(structural).length]).toEqual([selector, 0]);
                expect([selector, other.querySelectorAll(structural).length]).toEqual([selector, 0]);
            }
        }
    });

    test.each([
        ['drug product, no IPPF', { productsOnly: false, ippf: false }],
        ['products only, IPPF', { productsOnly: true, ippf: true }],
    ])('computed display of every form node is unchanged by the sheet except the two tables and actions (%s)', (label, flags) => {
        const displays = (withCss) => {
            const { window } = new JSDOM(documentHtml({ ...flags, withCss }));
            populate(window.document);
            return [...window.document.querySelectorAll('form, form *')].map((el) => [
                el.tagName, el.className, el.getAttribute('name') || '', window.getComputedStyle(el).display,
            ]);
        };
        const before = displays(false);
        const after = displays(true);
        const changed = after.filter((row, i) => row[3] !== before[i][3]).map(([tag, className]) => `${tag}.${className}`);
        expect(changed.sort()).toEqual([
            'DIV.btn-group oe-drug-editor-actions',
            'TABLE.table table-borderless oe-drug-editor-templates',
            'TABLE.table table-borderless pl-5 oe-drug-editor-limits',
        ]);
        const hidden = after.filter(([, className]) => /\b(drugsonly|ippfonly)\b/.test(className));
        expect(hidden.length).toBeGreaterThan(0);
        for (const [tag, className, name, display] of hidden) {
            const expectHidden = /ippfonly/.test(className) || flags.productsOnly;
            expect([tag, className, name, display === 'none']).toEqual([tag, className, name, expectHidden]);
        }
    });

    test('document shape: paper sheet, hairline detail rows, scrollable tables, wrapping actions', () => {
        expect(block('.oe-drug-editor-form')).toMatchObject({
            color: 'var(--oe-wb-ink)', 'background-color': 'var(--oe-wb-paper)', border: '1px solid var(--oe-wb-line)',
        });
        expect(block('.oe-drug-editor-form > .form-group')).toMatchObject({
            'margin-bottom': '0', 'border-bottom': '1px solid var(--oe-wb-line)',
        });
        for (const table of ['.oe-drug-editor-limits', '.oe-drug-editor-templates']) {
            expect(block(`.oe-drug-editor-form ${table}`)).toMatchObject({ display: 'block', 'max-width': '100%', 'overflow-x': 'auto' });
        }
        expect(block('.oe-drug-editor-actions')).toMatchObject({ display: 'flex', 'flex-wrap': 'wrap' });
        expect(block('.oe-drug-editor-actions > .btn')).toMatchObject({ 'max-width': '100%', 'white-space': 'normal', 'overflow-wrap': 'anywhere' });
        // The body keeps its themed .body_top background (colour themes compile it !important).
        expect(parse().filter((rule) => rule.selectors.includes(SCOPE))).toEqual([]);
    });

    test('paired field, read-only, focus, placeholder and native button palette', () => {
        expect(block('.oe-drug-editor-form .form-control')).toMatchObject({ color: 'var(--oe-wb-ink)', 'background-color': 'var(--oe-wb-paper)' });
        expect(block('.oe-drug-editor-form .form-control[readonly]')).toMatchObject({ color: 'var(--oe-wb-disabled-ink)', 'background-color': 'var(--oe-wb-disabled-paper)' });
        expect(block('.oe-drug-editor-form .form-control:not([readonly]):focus')).toMatchObject({ color: 'var(--oe-wb-ink)', 'background-color': 'var(--oe-wb-paper)', 'border-color': 'var(--oe-wb-petrol)' });
        expect(block('.oe-drug-editor-form .form-control::placeholder')).toEqual({ color: 'var(--oe-wb-muted)', opacity: '1' });
        expect(block('.oe-drug-editor-actions > .btn-primary:hover')).toMatchObject({ color: 'var(--oe-wb-on-petrol)', 'background-color': 'var(--oe-wb-ink)' });
        expect(block('.oe-drug-editor-actions > .btn-secondary')).toMatchObject({ color: 'var(--oe-wb-ink)', 'background-color': 'var(--oe-wb-paper)' });
        expect(block('.oe-drug-editor-actions > .btn-secondary:hover')).toMatchObject({ color: 'var(--oe-wb-ink)', 'background-color': 'var(--oe-wb-canvas)' });
        // Delete keeps the theme's danger palette.
        expect(css()).not.toMatch(/btn-danger/);
        const popup = read('interface/clinical-workspace/popup.css');
        for (const [, token] of css().matchAll(/var\((--oe-wb-[\w-]+)\)/g)) expect(popup).toContain(`${token}:`);
    });

    test('focus fallback and focus-visible are separate homogeneous rules', () => {
        const focus = parse().filter((rule) => rule.selector.includes(':focus'));
        const visible = focus.filter((rule) => rule.selectors.every((s) => s.includes(':focus-visible')));
        const fallback = focus.filter((rule) => rule.selectors.every((s) => !s.includes(':focus-visible')));
        expect(visible.length + fallback.length).toBe(focus.length);
        expect(visible.length).toBeGreaterThan(0);
        expect(fallback.length).toBeGreaterThan(0);
        const visibleTargets = visible.flatMap((rule) => rule.selectors);
        for (const target of ['.form-control', "input[type='checkbox']", '.btn']) {
            expect([target, visibleTargets.some((s) => s.includes(target))]).toEqual([target, true]);
        }
    });

    test('table controls keep a readable minimum so narrow sheets scroll rather than crush columns', () => {
        expect(block('.oe-drug-editor-form .oe-drug-editor-limits .form-control, html.oe-workbench-popup body.oe-drug-editor-popup .oe-drug-editor-form .oe-drug-editor-templates .form-control'))
            .toEqual({ 'min-width': '5rem' });
    });
});

describe('documentation', () => {
    test('records launcher geometry from source and leaves every live gate open', () => {
        const doc = read('docs/clinical-ui/DRUG-EDITOR-POPUP.md');
        expect(doc).toContain("dlgopen('add_edit_drug.php?' + params.toString(), '_blank', 900, 600)");
        expect(doc).toContain("dlgopen('../patient_file/encounter/find_code_dynamic.php' + getter, '_blank', 900, 800)");
        expect(doc).toMatch(/innerWidth <= 1080/);
        expect(doc).toMatch(/SizeModaliFrame/);
        expect(doc).toMatch(/94vh/);
        expect(doc).toMatch(/add_edit_lot\.php/);
        for (const gate of [/compiled theme/i, /keyboard/i, /narrow/i, /resiz/i, /RTL/, /translation/i, /code picker/i,
            /opener/i, /print/i, /legacy/i, /role/i, /deployed/i]) {
            expect(doc).toMatch(gate);
        }
        expect(doc).toMatch(/22/);
        expect(doc).toMatch(/Swedish/);
        expect(doc).not.toMatch(/fit is (verified|guaranteed)|visually verified|accepted in (a )?real browser|fits (at|in) (a )?(tiny|320)/i);
    });
});
