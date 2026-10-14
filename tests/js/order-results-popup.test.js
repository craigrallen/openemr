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
const exists = (file) => fs.existsSync(path.join(root, file));
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const count = (text, needle) => text.split(needle).length - 1;

const ROUTE = 'interface/orders/single_order_results.php';
const RENDERER = 'interface/orders/single_order_results.inc.php';
const LAUNCHER = 'interface/orders/list_reports.php';
const SHEET = 'interface/clinical-workspace/order-results-popup.css';
const DOC = 'docs/clinical-ui/ORDER-RESULTS-POPUP.md';

const route = () => read(ROUTE);
const renderer = () => read(RENDERER);
// Absent before the adaptation: callers assert presence instead of crashing the suite on import.
const css = () => (exists(SHEET) ? read(SHEET) : null);

// Whole-file sha256 of the route at 18647270, before the adaptation.
const ROUTE_BASELINE = '1ebb5143246c0e93f8f4fc83e56220229e83c5c2575a542f650545ed0b44fa48';
// Files the route renders through, is launched from, or shares; none is part of the adaptation.
const UNCHANGED = {
    // Shared renderer: also used by the encounter procedure report and the patient custom report.
    [RENDERER]: '17b7eb52c209bef3450046eb2aaaea33834bca94713e2ef818e7c0392dff8ce7',
    // Launcher: openResults() uses window.open, not dlgopen.
    [LAUNCHER]: 'f357748171626ef52bf2955a37c6013a61d1d5493e8f330f31950e9e0239a8fc',
    // Other renderer consumers, which must not receive the popup presentation.
    'interface/forms/procedure_order/report.php': '7096255b1d67180bd51bea242f430b5689ebff5ae310ca94ce53d3137fd8185d',
    'interface/patient_file/report/custom_report.php': '0d4a7c92a033a7e9a9790bd3218926bba8c8e20bdb049281cc3e81bbdc26035e',
    // Generic activation loaded by Header::setupHeader() (config.yaml workbench-popup, autoload).
    'interface/clinical-workspace/popup.js': 'af967e78fef59e75d2a5a5c4e08916bbea90a7f108c67f3def027b3061dc330f',
    'interface/clinical-workspace/popup.css': 'ea56e9f26990e843219a68f315c188f7e2b0581c20321bac4517dc4ba34e79a9',
    'library/topdialog.js': 'a062c811930409dab5c9a7eae7a1e550694c857d9cef1b912f9655bcb1b1db52',
};

// ClinicalWorkspaceAssets::SUPPORTED at 18647270, in order.
const ASSETS_BASELINE = [
    'ajtooltip.js', 'appointment.css', 'calendar-sidebar.js', 'calendar-workday.css', 'calendar-workday.js',
    'encounter-document.css', 'finder.css', 'global-messages.css', 'history-document.css', 'history-editor.css',
    'issue-popup.css', 'lbf-document.css', 'mode.js', 'patient-messages.css', 'patient-picker-popup.css',
    'patient-results-popup.css', 'patient-search.css', 'soap-document.css', 'soap-document.js', 'soap-reference.css',
    'soap-reference.js', 'visit-history.css', 'visit-history.js', 'workspace.css',
];

// popup.js marks <html> with oe-workbench-popup when the opener chain reaches an active shell;
// the route's own body class confines the sheet to this route rather than every renderer consumer.
const SCOPE = 'html.oe-workbench-popup body.oe-order-results-popup';
const HEADER = '    <?php Header::setupHeader(); ?>\n';
const LINK = '    <?php $clinicalAssets = new ClinicalWorkspaceAssets(); ?>\n'
    + '    <link rel="stylesheet" media="screen" href="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>'
    + "/interface/clinical-workspace/order-results-popup.css?v=<?php echo attr_url($clinicalAssets->version('order-results-popup.css')); ?>\">\n";

// The only intended insertions, as a reversible mapping: [added text, its original form].
const INSERTIONS = [
    ['use OpenEMR\\Common\\Acl\\AclMain;\nuse OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;\n', 'use OpenEMR\\Common\\Acl\\AclMain;\n'],
    [HEADER + LINK, HEADER],
    ['<body class="oe-order-results-popup">\n', '<body>\n'],
];

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

describe('order results route source contract', () => {
    test('shared renderer, window.open launcher, other consumers and popup activation are byte-identical', () => {
        for (const [file, sha] of Object.entries(UNCHANGED)) {
            expect([file, hash(read(file))]).toEqual([file, sha]);
        }
        expect(read(LAUNCHER)).toContain(
            "window.open('single_order_results.php?orderid=' + encodeURIComponent(orderid), '_blank', 'toolbar=0,location=0,menubar=0,scrollbars=yes');"
        );
        for (const file of [RENDERER, LAUNCHER, 'interface/clinical-workspace/popup.js', 'interface/clinical-workspace/popup.css']) {
            expect([file, /oe-order-results|order-results-popup/.test(read(file))]).toEqual([file, false]);
        }
    });

    test('Header::setupHeader autoloads the generic workbench popup activation', () => {
        const config = read('config/config.yaml');
        expect(config).toContain("  workbench-popup:\n    basePath: '%webroot%/interface/clinical-workspace/'\n    script: popup.js\n    link: popup.css\n    autoload: true\n");
    });

    test('route reverses to the exact baseline bytes through the presentation mapping', () => {
        const source = route();
        expect(hash(source)).not.toBe(ROUTE_BASELINE);
        expect(hash(normalize(source))).toBe(ROUTE_BASELINE);
    });

    test('stylesheet is linked once, screen-only, after Header::setupHeader and before the route style, versioned by the helper', () => {
        const source = route();
        expect(count(source, 'order-results-popup.css')).toBe(2);
        expect(source).toContain(HEADER + LINK);
        expect(source.indexOf(LINK)).toBeGreaterThan(source.indexOf(HEADER));
        expect(source.indexOf(LINK)).toBeLessThan(source.indexOf('<title>'));
        expect(source.indexOf(LINK)).toBeLessThan(source.indexOf('<style>'));
        expect(count(source, '<link ')).toBe(1);
    });

    test('body carries only the route class; the shared renderer call is unchanged', () => {
        const source = route();
        expect(count(source, '<body')).toBe(1);
        expect(source).toContain('<body class="oe-order-results-popup">\n<?php if (empty($_POST[\'form_sign\'])) {\n    generate_order_report($orderid, true, true, $finals_only);\n');
    });

    test.each([
        ['patients/med ACL', "$thisauth = AclMain::aclCheckCore('patients', 'med');", '$thisauth = true;'],
        ['ACL denial template', 'AccessDeniedHelper::denyWithTemplate("ACL check failed for patients/med: Order Results", xl("Order Results"));', ''],
        ['patients/sign ACL', "if (!AclMain::aclCheckCore('patients', 'sign')) {", 'if (false) {'],
        ['sign denial', "AccessDeniedHelper::deny('Not authorized to sign order results');", ''],
        ['order id integer parse', '$orderid = intval($rawOrderId);', '$orderid = $rawOrderId;'],
        ['consolidation switch', "$finals_only = empty($_POST['form_showall']);", '$finals_only = true;'],
        ['sign requires posted list', "if (!empty($_POST['form_sign']) && !empty($_POST['form_sign_list'])) {", "if (!empty($_POST['form_sign'])) {"],
        ['sign only posted reports', "$arrSign = explode(',', (string) $_POST['form_sign_list']);", '$arrSign = [];'],
        ['review SQL binding', '"procedure_report_id = ?", [$id]);', '"procedure_report_id = $id");'],
        ['review status value', "\"review_status = 'reviewed' WHERE \" .", "\"review_status = 'final' WHERE \" ."],
        ['order status SQL', "\"order_status = 'complete' WHERE \" .", "\"order_status = 'reviewed' WHERE \" ."],
        ['order status guard', '    if ($orderid) {\n', '    if (true) {\n'],
        ['renderer arguments', 'generate_order_report($orderid, true, true, $finals_only);', 'generate_order_report($orderid, false, true, $finals_only);'],
        ['sign branch', "<?php if (empty($_POST['form_sign'])) {", '<?php if (true) {'],
        ['opener refresh flag', "f.form_external_refresh.value = '1';", ''],
        ['opener resubmit', '            f.submit();\n', ''],
        ['order id escaping', '<?php echo js_escape($orderid); ?>', '<?php echo $orderid; ?>'],
        ['stay-here navigation', 'window.location.assign(stayHere);', 'window.close();'],
        ['translated title', "<title><?php echo xlt('Order Results'); ?></title>", '<title>Order Results</title>'],
        ['header assets', 'Header::setupHeader();', 'Header::setupHeader(["opener"]);'],
        ['topdialog include', '<script src="../../library/topdialog.js?v=', '<script src="../../library/dialog.js?v='],
        ['restoreSession include', '<?php require(OEGlobalsBag::getInstance()->getSrcDir() . "/restoreSession.php"); ?>', ''],
        ['route body font size', ' font-size: 1em;\n', ' font-size: 0.8em;\n'],
        ['route body margin', ' margin: 9pt;\n', ' margin: 0;\n'],
    ])('negative mutation of %s breaks the inverse hash', (label, from, to) => {
        const source = route();
        expect([label, source.includes(from)]).toEqual([label, true]);
        expect(hash(looseNormalize(source.replace(from, to)))).not.toBe(ROUTE_BASELINE);
    });

    test.each([
        ['un-mapped extra body class', (s) => s.replace('oe-order-results-popup">', 'oe-order-results-popup extra">')],
        ['second stylesheet link', (s) => s.replace('</title>', '</title>\n<link rel="stylesheet" href="x.css">')],
        ['print-capable link', (s) => s.replace('media="screen"', 'media="all"')],
        ['wrapper added around the renderer', (s) => s.replace('    generate_order_report(', '    echo "<div class=\'oe-order-results-sheet\'>";\n    generate_order_report(')],
    ])('presentation tampering (%s) breaks the inverse hash', (label, mutate) => {
        const source = route();
        const mutated = mutate(source);
        expect([label, mutated !== source]).toEqual([label, true]);
        expect(hash(looseNormalize(mutated))).not.toBe(ROUTE_BASELINE);
    });
});

describe('shared renderer behaviour stays in the unchanged renderer', () => {
    test('signing, consolidation, escaping, abnormal flag, notes and actions are byte-present', () => {
        const source = renderer();
        for (const fragment of [
            "<form method='post' action='single_order_results.php?orderid=<?php echo attr_url($orderid); ?>'>",
            "<div class='labres table-responsive'>",
            '<table class="table table-sm table-striped">',
            "<td class=\"font-weight-bold\" colspan='5'><?php echo xlt('Report'); ?></td>",
            "<td class=\"font-weight-bold\" colspan='7'><?php echo xlt('Results'); ?></td>",
            "echo \"<p class='font-weight-bold text-danger'>$tmp</p>\";",
            "echo \"  <td><pre class='border-0 bg-white' style='white-space:pre-wrap;'>\" . text($value) . \"</pre></td>\\n\";",
            "$finals[$key] = [$row, $rrowset, isset($finals[$key])];",
            "if ($input_form && !empty($ctx['priors_omitted']) /* empty($_POST['form_showall']) */) { ?>",
            "<input type='hidden' class='btn btn-primary' name='form_sign_list' value='<?php echo attr($ctx['sign_list']); ?>'/>",
            "name='form_sign' value='<?php echo xla('Sign Results'); ?>'",
            "onclick='showpnotes(<?php echo attr_js($orderid); ?>)' />",
            "<input type='button' class='btn btn-danger' value='<?php echo xla('Close'); ?>' onclick='window.close()'/>",
            "dlgopen(url, 'notes', 950, 750, false, '');",
            "'_blank', 1024, 750, true); // Force a new window instead of iframe to address cross site scripting potential",
        ]) {
            expect([fragment, count(source, fragment)]).toEqual([fragment, 1]);
        }
        // Thirteen result columns: the procedure plus five report and seven result cells.
        const subhead = source.slice(source.indexOf("<td><?php echo xlt('Reported'); ?></td>"), source.indexOf('</tr>', source.indexOf("xlt('Reported')")));
        expect(count(subhead, '<td><?php echo xlt(')).toBe(12);
    });
});

describe('workbench activation reaches a window.open popup without caller changes', () => {
    // Real popup.js factory; synthetic same-origin windows stand in for the shell, the list_reports frame and this popup.
    const popupApi = require(path.join(root, 'interface/clinical-workspace/popup.js'));
    const ORIGIN = 'http://openemr';

    function windows({ active }) {
        const shellDoc = new JSDOM(`<body class="${active ? 'workbench-active' : ''}"><div id="mainBox"><div data-workbench-mode></div></div></body>`).window.document;
        const shell = { closed: false, location: { origin: ORIGIN }, document: shellDoc, opener: null };
        shell.parent = shell;
        const listDoc = new JSDOM('<body><form></form></body>').window.document;
        const list = { closed: false, location: { origin: ORIGIN }, document: listDoc, parent: shell, opener: null, frameElement: null };
        const popupDoc = new JSDOM('<html><head></head><body class="oe-order-results-popup"></body></html>').window.document;
        const popup = { closed: false, location: { origin: ORIGIN }, document: popupDoc, opener: list, frameElement: null, addEventListener() {}, removeEventListener() {} };
        popup.parent = popup;
        return { popup, popupDoc };
    }

    test.each([
        ['active workbench shell', true, true],
        ['legacy navigation shell', false, false],
    ])('%s sets html.oe-workbench-popup only when the opener chain is active', (label, active, expected) => {
        const { popup, popupDoc } = windows({ active });
        popupApi.createPopupController({ win: popup, observe: () => ({ disconnect() {} }) });
        expect(popupDoc.documentElement.classList.contains(popupApi.POPUP_CLASS)).toBe(expected);
        expect(popupDoc.body.matches('html.oe-workbench-popup body.oe-order-results-popup')).toBe(expected);
    });
});

describe('ClinicalWorkspaceAssets allowlist', () => {
    const supported = () => {
        const assets = read('src/Common/Assets/ClinicalWorkspaceAssets.php');
        return [...assets.match(/SUPPORTED = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    };

    test('keeps the full existing list and adds only order-results-popup.css, sorted', () => {
        const list = supported();
        expect(list).toEqual([...ASSETS_BASELINE, 'order-results-popup.css'].sort());
        expect(list.filter((name) => !ASSETS_BASELINE.includes(name))).toEqual(['order-results-popup.css']);
    });

    test('lookup stays name-based: strict in_array before any path join', () => {
        const assets = read('src/Common/Assets/ClinicalWorkspaceAssets.php');
        expect(assets.indexOf('if (!in_array($asset, self::SUPPORTED, true)) {')).toBeGreaterThan(-1);
        expect(assets.indexOf('in_array($asset, self::SUPPORTED, true)')).toBeLessThan(assets.indexOf("$path = $this->directory . '/' . $asset;"));
    });

    test('the PHP isolated test pins the new file, its shipped version and near-miss/traversal rejection', () => {
        const phpTest = read('tests/Tests/Isolated/Common/Assets/ClinicalWorkspaceAssetsTest.php');
        expect(phpTest).toContain('orderResultsPopupStylesheetUsesItsOwnModificationTimeAndMissingFallback');
        expect(phpTest).toContain('shippedOrderResultsPopupStylesheetIsVersioned');
        expect(phpTest).toContain("'near-miss order results stylesheet' => ['order_results_popup.css'],");
        expect(phpTest).toContain("'order results stylesheet traversal' => ['../clinical-workspace/order-results-popup.css'],");
    });
});

// ---------------------------------------------------------------------------------------------
// Synthetic renderer output built from the renderer's own markup, with non-private values.

function documentHtml({ workbench = true, bodyClass = 'oe-order-results-popup', withCss = false } = {}) {
    const sheet = withCss && css() ? `<style>${css()}</style>` : '';
    return `<!DOCTYPE html><html class="${workbench ? 'oe-workbench-context oe-workbench-popup' : ''}"><head>${sheet}</head>
<body class="${bodyClass}">
<form method='post' action='single_order_results.php?orderid=1'>
    <div class='labres table-responsive'>
        <table class="table table-sm"><tr><td class="font-weight-bold text-nowrap" width='5%'>Patient ID</td><td>1</td></tr></table>
        <table class="table table-sm"><tr></tr><tr><td>R00.0</td><td>Synthetic</td></tr></table>
        <br/>
        <table class="table table-sm table-striped">
            <tr class='head'><td class="font-weight-bold align-middle" rowspan='2'>Ordered Procedure</td><td class="font-weight-bold" colspan='5'>Report</td><td class="font-weight-bold" colspan='7'>Results</td></tr>
            <tr class='head'>${'<td>h</td>'.repeat(12)}</tr>
            <tr class='detail'><td><a href='javascript:educlick("LOINC","0000-0")'>X: Synthetic</a></td><td>d</td><td>d</td><td>s</td><td title='t'>Final &#x2713;</td><td class='text-center'>1</td>
                <td><a href='javascript:educlick("LOINC","0000-1")'>0000-1</a></td><td>Synthetic</td><td><p class='font-weight-bold text-danger'>High</p></td><td>9</td><td>1-5</td><td>u</td><td class='text-center'>1</td></tr>
        </table>
        <br/>
        <table class="table table-sm border-0"><tr>
            <td class="border-0"><div class='table-responsive'><table class='table'>
                <tr style='background-color: var(--gray200);'><th class='text-center' colspan='2'>Notes</th></tr>
                <tr><td class='align-top' style='padding:5px 5px;'>1</td><td><pre class='border-0 bg-white' style='white-space:pre-wrap;'>Synthetic note</pre></td></tr>
            </table></div></td>
            <td class="border-0 text-right align-top">
                <input type='submit' class='btn btn-primary' name='form_showall' value='Show All Results' title='t'/>
                &nbsp;<input type='button' class='btn btn-primary' value='Related Patient Notes' onclick='showpnotes(1)' />
                &nbsp;<input type='hidden' class='btn btn-primary' name='form_sign_list' value='1'/>
                <input type='submit' class='btn btn-primary' name='form_sign' value='Sign Results' title='t'/>
                &nbsp;<input type='button' class='btn btn-danger' value='Close' onclick='window.close()'/>
            </td>
        </tr></table>
    </div>
</form>
</body></html>`;
}

// Tokens restated by the shared popup frame for html.oe-workbench-context.
const tokens = () => {
    const values = {};
    postcss.parse(read('interface/clinical-workspace/popup.css')).walkRules((rule) => {
        if (!rule.selectors.includes('html.oe-workbench-context')) return;
        rule.walkDecls(/^--oe-wb-/, (d) => { values[d.prop] = d.value; });
    });
    return values;
};

const luminance = (hex) => {
    const full = hex.length === 4 ? `#${[...hex.slice(1)].map((c) => c + c).join('')}` : hex;
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(full.slice(i, i + 2), 16) / 255)
        .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
};
const resolve = (value) => tokens()[value.match(/^var\((--oe-wb-[\w-]+)\)$/)?.[1]] ?? null;

// ---------------------------------------------------------------------------------------------
// Stylesheet guards. cssViolations() is also run against deliberately broken stylesheets below.

const FORBIDDEN_PROPS = ['font', 'font-size', 'font-family', 'font-weight', 'font-style', 'font-stretch', 'line-height',
    'letter-spacing', 'word-spacing', 'text-transform', 'text-align', 'direction', 'unicode-bidi', 'zoom', 'transform',
    'scale', 'visibility', 'clip', 'clip-path', 'display', 'float', 'position', 'z-index', 'filter', 'content',
    'opacity', 'pointer-events', 'width', 'min-width', 'max-width', 'height', 'min-height', 'max-height',
    'white-space', 'table-layout', 'margin', 'margin-top', 'margin-left', 'margin-right', 'margin-bottom',
    'margin-inline', 'margin-inline-start', 'margin-inline-end', 'margin-block', 'margin-block-start',
    'margin-block-end', 'background', 'overflow', 'overflow-x', 'overflow-y', 'contain', 'columns'];
const structural = (selector) => selector.replace(/::?(focus-visible|focus|hover)/g, '');

function cssViolations(text) {
    const violations = [];
    const ast = postcss.parse(text);
    const rules = [];
    ast.walkRules((rule) => rules.push(rule));
    ast.walkAtRules((at) => {
        if (`${at.name} ${at.params}` !== 'media screen' || at.parent.type !== 'root') violations.push(['at-rule', `${at.name} ${at.params}`]);
    });
    const doc = new JSDOM(documentHtml()).window.document;
    const abnormal = doc.querySelector('p.text-danger');
    // The renderer's notes <pre class='border-0 bg-white'> keeps the theme's own pre ink beside the
    // theme's !important bg-white utility; Dark and Solar compile $white to #000 there.
    const notes = doc.querySelector('pre.bg-white');
    const palette = tokens();
    let focus = 0;
    let focusVisible = 0;
    for (const rule of rules) {
        if (!(rule.parent.type === 'atrule' && rule.parent.params === 'screen')) violations.push(['outside screen', rule.selector]);
        const decls = rule.nodes.filter((n) => n.type === 'decl');
        const props = new Map(decls.map((d) => [d.prop, d.value]));
        for (const selector of rule.selectors) {
            if (!(selector === SCOPE || selector.startsWith(`${SCOPE} `))) violations.push(['unscoped', selector]);
            if (/text-danger|\[style|bg-white|\[type=.?hidden/.test(selector)) violations.push(['semantic selector', selector]);
        }
        const kinds = new Set(rule.selectors.filter((s) => /:focus/.test(s)).map((s) => (/:focus-visible/.test(s) ? 'visible' : 'focus')));
        if (kinds.size > 1 || (kinds.size === 1 && rule.selectors.some((s) => !/:focus/.test(s)))) violations.push(['mixed focus', rule.selector]);
        if (kinds.size === 1) {
            if (!/^2px solid var\(--oe-wb-/.test(props.get('outline') ?? '')) violations.push(['focus outline', rule.selector]);
            if (kinds.has('visible')) focusVisible += 1; else focus += 1;
        }
        for (const decl of decls) {
            if (decl.important) violations.push(['important', `${rule.selector} ${decl.prop}`]);
            if (FORBIDDEN_PROPS.includes(decl.prop)) violations.push(['forbidden', `${rule.selector} ${decl.prop}`]);
            if (/^(outline|outline-style)$/.test(decl.prop) && /^(0|none)\b/.test(decl.value)) violations.push(['outline removed', rule.selector]);
            if (/color|background|border|outline|shadow/.test(decl.prop) && /#|rgb|hsl|\b(white|black|transparent|currentcolor|inherit|initial|unset)\b/i.test(decl.value)) violations.push(['raw colour', `${rule.selector} ${decl.prop}`]);
            for (const [, token] of decl.value.matchAll(/var\((--[\w-]+)\)/g)) {
                if (!(token in palette)) violations.push(['token', token]);
            }
        }
        // Paper and ink travel together. The 4.5:1 check is a nominal token pair from popup.css only:
        // it does not model the compiled theme cascade, table stripes, inline paint or !important utilities.
        const paper = props.get('background-color');
        const ink = props.get('color');
        if (!!paper !== !!ink) violations.push(['unpaired colour', rule.selector]);
        if (paper && ink && !(contrast(resolve(ink) ?? '#000', resolve(paper) ?? '#000') >= 4.5)) violations.push(['contrast', rule.selector]);
        for (const selector of rule.selectors) {
            const targets = [...doc.querySelectorAll(structural(selector))];
            // The abnormal flag keeps the theme's semantic danger ink untouched.
            if (targets.includes(abnormal) && decls.length) violations.push(['abnormal restyled', selector]);
            // No colour intervention on the notes pre: its theme ink and bg-white utility stay a pair.
            if (targets.includes(notes) && decls.some((d) => /^(color|background|background-color)$/.test(d.prop))) {
                violations.push(['notes paint', selector]);
            }
        }
    }
    if (focus === 0 || focusVisible === 0) violations.push(['focus coverage', `${focus}/${focusVisible}`]);
    return violations;
}

const parse = () => {
    const list = [];
    postcss.parse(css() ?? '').walkRules((rule) => list.push(rule));
    return list;
};
// Declarations of every rule listing `${SCOPE} ${suffix}` among its selectors, merged in order.
const block = (suffix) => {
    const found = parse().filter((rule) => rule.selectors.map((s) => s.replace(/\s+/g, ' ')).includes(`${SCOPE} ${suffix}`.trim()));
    expect([suffix, found.length > 0]).toEqual([suffix, true]);
    return Object.fromEntries(found.flatMap((rule) => rule.nodes.filter((n) => n.type === 'decl').map((d) => [d.prop, d.value])));
};

describe('order results stylesheet', () => {
    test('exists and passes every guard: screen-only scope, typography, sizing, scroller, palette pairing, abnormal flag, focus split', () => {
        expect([SHEET, css() !== null]).toEqual([SHEET, true]);
        expect(cssViolations(css())).toEqual([]);
        expect(css()).not.toMatch(/@media print|@import|@font-face|url\(|!important/);
    });

    test.each([
        ['unscoped rule', (t) => `${t}\n@media screen { .labres { padding: 0; } }`, 'unscoped'],
        ['context-only scope reaching other renderer consumers', (t) => `${t}\n@media screen { html.oe-workbench-popup .labres { padding: 0; } }`, 'unscoped'],
        ['print block', (t) => `${t}\n@media print { ${SCOPE} .labres { padding: 0; } }`, 'at-rule'],
        ['breakpoint block', (t) => `${t}\n@media screen and (max-width: 600px) { ${SCOPE} .labres { padding: 0; } }`, 'at-rule'],
        ['rule outside @media screen', (t) => `${t}\n${SCOPE} .labres { padding: 0; }`, 'outside screen'],
        ['clipped scroller', (t) => `${t}\n@media screen { ${SCOPE} .labres { overflow: hidden; } }`, 'forbidden'],
        ['squeezed results table', (t) => `${t}\n@media screen { ${SCOPE} .labres .table { max-width: 100%; } }`, 'forbidden'],
        ['hidden action', (t) => `${t}\n@media screen { ${SCOPE} .labres .btn-danger { display: none; } }`, 'forbidden'],
        ['shrunk text', (t) => `${t}\n@media screen { ${SCOPE} .labres tr.detail { font-size: 0.7rem; } }`, 'forbidden'],
        ['neutralised abnormal flag', (t) => `${t}\n@media screen { ${SCOPE} .labres p { color: var(--oe-wb-ink); background-color: var(--oe-wb-paper); } }`, 'abnormal restyled'],
        ['dark notes ink overwrite', (t) => `${t}\n@media screen { ${SCOPE} .labres pre { color: var(--oe-wb-ink); background-color: var(--oe-wb-paper); } }`, 'notes paint'],
        ['notes ink via a descendant wildcard', (t) => `${t}\n@media screen { ${SCOPE} .labres td > * { color: var(--oe-wb-ink); background-color: var(--oe-wb-paper); } }`, 'notes paint'],
        ['text-danger selector', (t) => `${t}\n@media screen { ${SCOPE} .text-danger { border-color: var(--oe-wb-line); } }`, 'semantic selector'],
        ['unpaired ink', (t) => `${t}\n@media screen { ${SCOPE} .labres tr.detail { color: var(--oe-wb-muted); } }`, 'unpaired colour'],
        ['raw colour', (t) => `${t}\n@media screen { ${SCOPE} .labres { color: #333; background-color: var(--oe-wb-paper); } }`, 'raw colour'],
        ['unknown token', (t) => `${t}\n@media screen { ${SCOPE} .labres { border-color: var(--gray200); } }`, 'token'],
        ['low-contrast pair', (t) => `${t}\n@media screen { ${SCOPE} .labres tr.head { color: var(--oe-wb-line); background-color: var(--oe-wb-paper); } }`, 'contrast'],
        ['important', (t) => `${t}\n@media screen { ${SCOPE} .labres { border-color: var(--oe-wb-line) !important; } }`, 'important'],
        ['mixed focus rule', (t) => `${t}\n@media screen { ${SCOPE} .labres .btn:focus, ${SCOPE} .labres .btn:focus-visible { outline: 2px solid var(--oe-wb-petrol); } }`, 'mixed focus'],
        ['outline removed', (t) => `${t}\n@media screen { ${SCOPE} .labres .btn:focus { outline: none; } }`, 'outline removed'],
        ['missing focus fallback', () => `@media screen { ${SCOPE} .labres .btn:focus-visible { outline: 2px solid var(--oe-wb-petrol); } }`, 'focus coverage'],
    ])('guard rejects a stylesheet with %s', (label, mutate, kind) => {
        const kinds = cssViolations(mutate(css() ?? '')).map(([k]) => k);
        expect([label, kinds.includes(kind)]).toEqual([label, true]);
    });

    test('every selector matches the route inside a workbench popup and nothing in legacy or other renderer pages', () => {
        expect([SHEET, css() !== null]).toEqual([SHEET, true]);
        const inside = new JSDOM(documentHtml()).window.document;
        const legacy = new JSDOM(documentHtml({ workbench: false })).window.document;
        // Encounter and custom reports render the same markup without the route body class.
        const other = new JSDOM(documentHtml({ bodyClass: '' })).window.document;
        const rules = parse();
        expect(rules.length).toBeGreaterThan(0);
        for (const rule of rules) {
            for (const selector of rule.selectors) {
                expect([selector, inside.querySelectorAll(structural(selector)).length > 0]).toEqual([selector, true]);
                expect([selector, legacy.querySelectorAll(structural(selector)).length]).toEqual([selector, 0]);
                expect([selector, other.querySelectorAll(structural(selector)).length]).toEqual([selector, 0]);
            }
        }
    });

    test('document sheet: canvas around a paper sheet built on the existing labres scroller', () => {
        expect(block('')).toMatchObject({ color: 'var(--oe-wb-ink)', 'background-color': 'var(--oe-wb-canvas)' });
        const sheet = block('.labres');
        expect(sheet).toMatchObject({ color: 'var(--oe-wb-ink)', 'background-color': 'var(--oe-wb-paper)', border: '1px solid var(--oe-wb-line)' });
        expect(Object.keys(sheet)).toEqual(expect.arrayContaining(['padding', 'border-radius']));
    });

    test('paired table (ink/paper) and header-row (ink/canvas) palette; cell rules only by the shared line token', () => {
        expect(block('.labres .table')).toMatchObject({ color: 'var(--oe-wb-ink)', 'background-color': 'var(--oe-wb-paper)' });
        expect(block('.labres tr.head')).toMatchObject({ color: 'var(--oe-wb-ink)', 'background-color': 'var(--oe-wb-canvas)' });
        expect(block('.labres td')).toEqual({ 'border-color': 'var(--oe-wb-line)' });
        expect(block('.labres th')).toEqual({ 'border-color': 'var(--oe-wb-line)' });
    });

    test('notes pre keeps the theme pre ink paired with the renderer bg-white utility: no colour intervention', () => {
        expect([SHEET, css() !== null]).toEqual([SHEET, true]);
        // The unchanged renderer puts Bootstrap's !important bg-white utility on every notes pre.
        expect(renderer()).toContain("<pre class='border-0 bg-white' style='white-space:pre-wrap;'>");
        const doc = new JSDOM(documentHtml()).window.document;
        const notes = doc.querySelector('pre.bg-white');
        const painting = parse().flatMap((rule) => rule.selectors
            .filter((s) => [...doc.querySelectorAll(structural(s))].includes(notes))
            .filter(() => rule.nodes.some((n) => n.type === 'decl' && /^(color|background|background-color)$/.test(n.prop))));
        expect(painting).toEqual([]);
        // Nominal source tokens only (not the compiled cascade): Dark and Solar invert $white to #000 and
        // lighten $gray-900, so bg-white is black there and a fixed workbench ink on it would be dark-on-black.
        for (const theme of ['interface/themes/oe-styles/style_dark.scss', 'interface/themes/oe-styles/style_solar.scss']) {
            const source = read(theme);
            expect([theme, source.includes('$white: #000;'), source.includes('$gray-900: #f8f9fa;')]).toEqual([theme, true, true]);
        }
        expect(contrast(resolve('var(--oe-wb-ink)'), '#000')).toBeLessThan(3);
    });

    test('original thirteen-column results stay inside the original responsive scroller with every action', () => {
        expect([SHEET, css() !== null]).toEqual([SHEET, true]);
        const doc = new JSDOM(documentHtml({ withCss: true })).window.document;
        const scroller = doc.querySelector('form > .labres.table-responsive');
        const results = scroller.querySelector('table.table-striped');
        expect(results.rows[0].cells[0].colSpan + results.rows[0].cells[1].colSpan + results.rows[0].cells[2].colSpan).toBe(13);
        expect(results.querySelector('tr.detail').cells).toHaveLength(13);
        const actions = [...scroller.querySelectorAll('input')].map((el) => [el.type, el.name, el.value, el.getAttribute('onclick')]);
        expect(actions).toEqual([
            ['submit', 'form_showall', 'Show All Results', null],
            ['button', '', 'Related Patient Notes', 'showpnotes(1)'],
            ['hidden', 'form_sign_list', '1', null],
            ['submit', 'form_sign', 'Sign Results', null],
            ['button', '', 'Close', 'window.close()'],
        ]);
        // No sheet rule may size, clip, hide or reposition the scroller, its tables or any control.
        const offending = parse().flatMap((rule) => rule.nodes.filter((n) => n.type === 'decl' && FORBIDDEN_PROPS.includes(n.prop)).map((d) => `${rule.selector} ${d.prop}`));
        expect(offending).toEqual([]);
    });

    test('focus fallback and focus-visible are separate rules covering buttons and links', () => {
        const focus = parse().filter((rule) => rule.selector.includes(':focus'));
        const visible = focus.filter((rule) => rule.selectors.every((s) => s.includes(':focus-visible')));
        const fallback = focus.filter((rule) => rule.selectors.every((s) => !s.includes(':focus-visible')));
        expect(visible.length + fallback.length).toBe(focus.length);
        for (const [name, group] of [['visible', visible], ['fallback', fallback]]) {
            const targets = group.flatMap((rule) => rule.selectors);
            for (const target of [`${SCOPE} .labres .btn:focus`, `${SCOPE} .labres a:focus`]) {
                const wanted = name === 'visible' ? `${target}-visible` : target;
                expect([name, wanted, targets.includes(wanted)]).toEqual([name, wanted, true]);
            }
        }
    });

    // Shared popup.css (unchanged) already restyles .btn-primary; this sheet adds no control palette of its own.
    test('adds no primary, danger or abnormal-flag palette rules of its own', () => {
        expect(css() ?? '').not.toMatch(/btn-primary|btn-danger|text-danger/);
    });
});

describe('documentation', () => {
    test('records the window.open launcher, the unchanged renderer and leaves every live gate open', () => {
        expect([DOC, exists(DOC)]).toEqual([DOC, true]);
        const doc = read(DOC);
        expect(doc).toContain("window.open('single_order_results.php?orderid=' + encodeURIComponent(orderid), '_blank', 'toolbar=0,location=0,menubar=0,scrollbars=yes')");
        expect(doc).toContain('single_order_results.inc.php');
        expect(doc).toContain(SCOPE);
        for (const gate of [/compiled theme/i, /keyboard/i, /translation/i, /print/i, /legacy/i, /opener/i, /signing/i, /role/i, /deployed/i, /CSRF/]) {
            expect(doc).toMatch(gate);
        }
        expect(doc).not.toMatch(/CSRF[- ]protected|adds? CSRF|visually verified|accepted in (a )?real browser|clinically (approved|validated)/i);
    });

    test('makes no effective-contrast claim and records the review corrections', () => {
        expect([DOC, exists(DOC)]).toEqual([DOC, true]);
        const doc = read(DOC);
        // No nearest-surface abnormal-flag oracle, no all-white claim, no "colour and borders only".
        expect(doc).not.toMatch(/nearest painted surface|keeps at least 4\.5:1|behind every results row|colou?r and borders? only/i);
        // Closing or navigating the opener does not necessarily drop the styling: the controller observes the resolved host.
        expect(doc).not.toMatch(/popup falls back to the legacy presentation/i);
        expect(doc).toMatch(/observes the resolved (shell|host)/i);
        expect(doc).toMatch(/padding/);
        expect(doc).toMatch(/table-striped/);
        expect(doc).toMatch(/var\(--gray200\)/);
        expect(doc).toMatch(/bg-white/);
        expect(doc).toMatch(/inherited/i);
        expect(doc).toMatch(/unverified/i);
        expect(doc).toMatch(/popup\.css[^\n]*btn-primary/);
        const sheet = css() ?? '';
        expect(sheet).not.toMatch(/Colou?r and border only|abnormal flag keeps its theme contrast/i);
    });
});
