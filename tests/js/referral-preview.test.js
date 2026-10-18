/** @jest-environment node */

const fs = require('fs');
const path = require('path');
const postcss = require('postcss');

const root = path.join(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const readOptional = file => fs.existsSync(path.join(root, file)) ? read(file) : '';
const ROUTE = 'interface/patient_file/transaction/print_referral.php';
const TEMPLATE = 'sites/default/referral_template.html';
const HELPER = 'src/Common/Assets/ClinicalWorkspaceAssets.php';
const CSS = 'interface/clinical-workspace/referral-preview.css';
const originalRoute = read('tests/clinical-ui/fixtures/referral-preview-route-original.txt');
const originalTemplate = read('tests/clinical-ui/fixtures/referral-preview-template-original.txt');
const originalHelper = read('tests/clinical-ui/fixtures/referral-preview-helper-original.txt');

const count = (source, part) => source.split(part).length - 1;
const replaceOnce = (source, from, to) => {
    if (count(source, from) !== 1) throw new Error('Missing or ambiguous anchor: ' + JSON.stringify(from));
    return source.replace(from, () => to);
};
const IMPORT = 'use OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;\n';
const IMPORT_ANCHOR = 'use OpenEMR\\Common\\Acl\\AclMain;\nuse OpenEMR\\Core\\OEGlobalsBag;\n';
const IMPORTED = 'use OpenEMR\\Common\\Acl\\AclMain;\n' + IMPORT + 'use OpenEMR\\Core\\OEGlobalsBag;\n';
const ROUTE_ANCHOR = 'fclose($fh);\n\n$s = str_replace("{header1}"';
const LINK = '<link rel="stylesheet" media="screen" href="';
const SCRIPT = '<script src="';
const WEBROOT = 'attr(OEGlobalsBag::getInstance()->getWebRoot())';
const VERSION_CSS = "attr_url((new ClinicalWorkspaceAssets())->version('referral-preview.css'))";
const VERSION_JS = "attr_url((new ClinicalWorkspaceAssets())->version('popup.js'))";
const REPLACEMENT = '$s = str_replace(\n'
    + '    "{referral_preview_assets}",\n'
    + '    \'' + LINK + '\' . ' + WEBROOT + ' .\n'
    + '        \'/interface/clinical-workspace/referral-preview.css?v=\' .\n'
    + '        ' + VERSION_CSS + ' . \'">\' . "\\n  " .\n'
    + '    \'' + SCRIPT + '\' . ' + WEBROOT + ' .\n'
    + '        \'/interface/clinical-workspace/popup.js?v=\' .\n'
    + '        ' + VERSION_JS + " . '\"></script>',\n"
    + '    $s\n'
    + ');\n\n';
const FUTURE_ROUTE = replaceOnce(replaceOnce(originalRoute, IMPORT_ANCHOR, IMPORTED),
    ROUTE_ANCHOR, 'fclose($fh);\n\n' + REPLACEMENT + '$s = str_replace("{header1}"');
const inverseRoute = source => replaceOnce(replaceOnce(source,
    'fclose($fh);\n\n' + REPLACEMENT + '$s = str_replace("{header1}"', ROUTE_ANCHOR),
    IMPORTED, IMPORT_ANCHOR);

const TEMPLATE_HEAD = '  </style>\n</head>';
const TEMPLATE_HEAD_FUTURE = '  </style>\n  {referral_preview_assets}\n</head>';
const BODY = '<body>';
const BODY_FUTURE = '<body class="oe-referral-preview">';
const FUTURE_TEMPLATE = replaceOnce(replaceOnce(originalTemplate, TEMPLATE_HEAD, TEMPLATE_HEAD_FUTURE), BODY, BODY_FUTURE);
const inverseTemplate = source => replaceOnce(replaceOnce(source, BODY_FUTURE, BODY),
    TEMPLATE_HEAD_FUTURE, TEMPLATE_HEAD);

const HELPER_ANCHOR = "        'patient-search.css',\n        'soap-document.css',\n";
const HELPER_FUTURE = "        'patient-search.css',\n        'popup.js',\n        'referral-preview.css',\n        'soap-document.css',\n";
const FUTURE_HELPER = replaceOnce(originalHelper, HELPER_ANCHOR, HELPER_FUTURE);
const inverseHelper = source => replaceOnce(source, HELPER_FUTURE, HELPER_ANCHOR);

const verifyRoute = source => {
    if (source !== FUTURE_ROUTE || inverseRoute(source) !== originalRoute) {
        throw new Error('print_referral.php differs outside the import and one replacement block');
    }
};
const verifyTemplate = source => {
    if (source !== FUTURE_TEMPLATE || inverseTemplate(source) !== originalTemplate) {
        throw new Error('referral_template.html differs outside the head placeholder and body class');
    }
};
const verifyHelper = source => {
    if (source !== FUTURE_HELPER || inverseHelper(source) !== originalHelper) {
        throw new Error('ClinicalWorkspaceAssets.php differs outside two sorted entries');
    }
};

const INK = 'var(--oe-wb-ink, #17343b)';
const PAPER = 'var(--oe-wb-paper, #fff)';
const CANVAS = 'var(--oe-wb-canvas, #f3f7f5)';
const LINE = 'var(--oe-wb-line, #d9e4e2)';
const RULES = [
    ['html.oe-workbench-context body.oe-referral-preview', [['color', INK], ['background-color', CANVAS]]],
    ['html.oe-workbench-context .oe-referral-preview .borderdiv',
        [['color', INK], ['background-color', PAPER], ['border-color', LINE]]],
    ['html.oe-workbench-context .oe-referral-preview td', [['color', INK], ['background-color', PAPER]]],
];
const block = ([selector, declarations]) => '  ' + selector + ' {\n'
    + declarations.map(([prop, value]) => '    ' + prop + ': ' + value + ';\n').join('') + '  }\n';
const FUTURE_CSS = '@media screen {\n' + RULES.map(block).join('\n') + '}\n';
const verifyCss = source => {
    const ast = postcss.parse(source);
    if (ast.nodes.length !== 1) throw new Error('Expected one media block');
    const media = ast.nodes[0];
    if (media.type !== 'atrule' || media.name !== 'media' || media.params !== 'screen' ||
        !media.nodes || media.nodes.length !== 3) throw new Error('Expected exactly three screen rules');
    media.nodes.forEach((rule, index) => {
        const [selector, declarations] = RULES[index];
        if (rule.type !== 'rule' || rule.selector !== selector ||
            rule.raws.before !== (index ? '\n\n  ' : '\n  ') ||
            !rule.nodes || rule.nodes.length !== declarations.length) throw new Error('Unexpected rule');
        rule.nodes.forEach((node, declarationIndex) => {
            const [prop, value] = declarations[declarationIndex];
            if (node.type !== 'decl' || node.prop !== prop || node.value !== value ||
                node.important || node.raws.before !== '\n    ') throw new Error('Unexpected declaration');
        });
    });
    if (source !== FUTURE_CSS) throw new Error('Unexpected CSS bytes');
};

const mutate = (source, from, to) => {
    expect(count(source, from)).toBeGreaterThan(0);
    const changed = source.replace(from, () => to);
    expect(changed).not.toBe(source);
    return changed;
};
const reject = (expected, mutations, verify) => mutations.forEach(mutant => {
    expect(mutant).not.toBe(expected);
    expect(() => verify(mutant)).toThrow();
});

test('complete frozen originals support exact forward and inverse contracts', () => {
    expect(originalRoute.startsWith('<?php\n')).toBe(true);
    expect(originalRoute.endsWith('echo $s;\n')).toBe(true);
    expect(originalTemplate.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(originalTemplate.endsWith('</html>\n')).toBe(true);
    expect(originalHelper.startsWith('<?php\n')).toBe(true);
    expect(originalHelper.endsWith('}\n')).toBe(true);
    expect(count(originalRoute, ROUTE_ANCHOR)).toBe(1);
    expect(count(originalTemplate, TEMPLATE_HEAD)).toBe(1);
    expect(count(originalTemplate, BODY)).toBe(1);
    expect(count(originalHelper, HELPER_ANCHOR)).toBe(1);
    expect(count(originalTemplate, "<div class='borderdiv'>")).toBe(2);
    expect(count(originalTemplate, '{label_subhead_clinic}')).toBe(1);
    expect(count(originalTemplate, '{label_subhead_patient}')).toBe(1);
    expect(count(originalTemplate, '{label_subhead_referred}')).toBe(1);
    expect(count(originalTemplate, '{header1}')).toBe(2);
    expect(count(originalTemplate, '{header2}')).toBe(1);
    expect(count(originalTemplate, "<p style='page-break-after: always'></p>")).toBe(1);
    expect(inverseRoute(FUTURE_ROUTE)).toBe(originalRoute);
    expect(inverseTemplate(FUTURE_TEMPLATE)).toBe(originalTemplate);
    expect(inverseHelper(FUTURE_HELPER)).toBe(originalHelper);
    expect(() => verifyRoute(FUTURE_ROUTE)).not.toThrow();
    expect(() => verifyTemplate(FUTURE_TEMPLATE)).not.toThrow();
    expect(() => verifyHelper(FUTURE_HELPER)).not.toThrow();
    expect(() => verifyCss(FUTURE_CSS)).not.toThrow();
    expect(() => verifyRoute(originalRoute)).toThrow();
    expect(() => verifyTemplate(originalTemplate)).toThrow();
    expect(() => verifyHelper(originalHelper)).toThrow();
    expect(() => verifyCss('')).toThrow();
});

test('synthetic route links escaped versioned assets; substitution is placeholder-only', () => {
    expect(count(FUTURE_ROUTE, IMPORT)).toBe(1);
    expect(count(FUTURE_ROUTE, 'str_replace(\n    "{referral_preview_assets}"')).toBe(1);
    expect(count(REPLACEMENT, WEBROOT)).toBe(2);
    expect(count(REPLACEMENT, VERSION_CSS)).toBe(1);
    expect(count(REPLACEMENT, VERSION_JS)).toBe(1);
    expect(REPLACEMENT).toContain(LINK);
    expect(REPLACEMENT).toContain(SCRIPT);
    expect(REPLACEMENT).toContain('media="screen"');
    expect(REPLACEMENT).toContain('"\\n  "');
    expect(FUTURE_ROUTE.indexOf(REPLACEMENT)).toBe(FUTURE_ROUTE.indexOf('fclose($fh);') + 'fclose($fh);\n\n'.length);
    expect(FUTURE_ROUTE).not.toContain('Header::setupHeader');
    expect(REPLACEMENT).not.toMatch(/popup\.css|workspace\.css|mode\.js|<script>\s*\S|opener|storage/i);
    const rendered = '<head>\n  {referral_preview_assets}\n</head>';
    const injected = rendered.replace('{referral_preview_assets}', '<link rel="stylesheet" media="screen">\n  <script src="popup.js"></script>');
    expect(injected).toContain('<link rel="stylesheet" media="screen">\n  <script src="popup.js"></script>');
    const custom = '<head><title>Custom</title></head><body>{header1}</body>';
    expect(custom.replace('{referral_preview_assets}', 'asset tags')).toBe(custom);
    expect(custom).not.toContain('{referral_preview_assets}');
});

test('synthetic template keeps all three labeled portions and existing inline print behavior', () => {
    expect(count(FUTURE_TEMPLATE, '{referral_preview_assets}')).toBe(1);
    expect(count(FUTURE_TEMPLATE, BODY_FUTURE)).toBe(1);
    expect(count(FUTURE_TEMPLATE, "<div class='borderdiv'>")).toBe(2);
    expect(count(FUTURE_TEMPLATE, '{label_subhead_clinic}')).toBe(1);
    expect(count(FUTURE_TEMPLATE, '{label_subhead_patient}')).toBe(1);
    expect(count(FUTURE_TEMPLATE, '{label_subhead_referred}')).toBe(1);
    expect(count(FUTURE_TEMPLATE, '{header1}')).toBe(2);
    expect(count(FUTURE_TEMPLATE, '{header2}')).toBe(1);
    expect(count(FUTURE_TEMPLATE, "<p style='page-break-after: always'></p>")).toBe(1);
    for (const token of ['{header1}', '{header2}', '{ref_body}', '{label_ref_reason}',
        'win.printLogPrint(window);', 'font-family: sans-serif;', 'width: 524pt;', 'height: 668pt;']) {
        expect(FUTURE_TEMPLATE).toContain(token);
    }
    const entries = [...FUTURE_HELPER.matchAll(/^ {8}'([^']+)',$/gm)].map(match => match[1]);
    expect(entries).toEqual([...entries].sort());
    expect(entries.filter(name => name === 'popup.js')).toHaveLength(1);
    expect(entries.filter(name => name === 'referral-preview.css')).toHaveLength(1);
});

test('route mutations reject moved, unsafe, duplicated, and workflow-changing edits', () => {
    const edits = [
        [IMPORT, ''], [IMPORT, IMPORT + IMPORT], [REPLACEMENT, ''],
        [REPLACEMENT, REPLACEMENT + REPLACEMENT],
        [REPLACEMENT, REPLACEMENT.replace('{referral_preview_assets}', '{header1}')],
        [REPLACEMENT, REPLACEMENT.replace('media="screen"', 'media="print"')],
        [REPLACEMENT, REPLACEMENT.replace('?v=', '?version=')],
        [REPLACEMENT, REPLACEMENT.replace(WEBROOT, 'OEGlobalsBag::getInstance()->getWebRoot()')],
        [REPLACEMENT, REPLACEMENT.replace(WEBROOT, 'attr($globalsBag->getWebRoot())')],
        [REPLACEMENT, REPLACEMENT.replace(VERSION_CSS, "(new ClinicalWorkspaceAssets())->version('referral-preview.css')")],
        [REPLACEMENT, REPLACEMENT.replace(VERSION_JS, "(new ClinicalWorkspaceAssets())->version('popup.js')")],
        [REPLACEMENT, REPLACEMENT.replace(VERSION_JS, "attr_url((new ClinicalWorkspaceAssets())->version('mode.js'))")],
        [REPLACEMENT, REPLACEMENT.replace('popup.js?v=', 'popup.css?v=')],
        [REPLACEMENT, REPLACEMENT.replace('referral-preview.css?v=', 'workspace.css?v=')],
        [REPLACEMENT, REPLACEMENT.replace(SCRIPT, '<script>window.opener.localStorage;')],
        [REPLACEMENT, REPLACEMENT + 'Header::setupHeader([]);\n'],
        [IMPORTED, IMPORT + 'use OpenEMR\\Common\\Acl\\AclMain;\nuse OpenEMR\\Core\\OEGlobalsBag;\n'],
        ["AclMain::aclCheckCore('patients', 'med')", "AclMain::aclCheckCore('patients', 'demo')"],
        ["$session = \\OpenEMR\\Common\\Session\\SessionWrapperFactory::getInstance()->getActiveSession();", '$session = null;'],
        ["$_REQUEST['transid'] + 0", '0'],
        ["$_REQUEST['patient_id'] + 0", '0'],
        ['getTransById($transid)', 'getTransById(0)'],
        ['getPatientData($patient_id)', 'getPatientData(0)'],
        ['getInsuranceData($patient_id)', '[]'],
        ['SELECT * FROM form_vitals WHERE ', 'SELECT * FROM other_table WHERE '],
        ["'label_ref_reason'            => xlt('Reference Reason')", "'label_ref_reason'            => xlt('Other')"],
        ['generate_display_field($frow, $currvalue)', 'text($currvalue)'],
        ["generate_display_field(['data_type' => '1','list_id' => 'sex'], $value)", 'text($value)'],
        ["$s = preg_replace('/\\{\\S+\\}/', '', $s);", '$s = $s;'],
        ['echo $s;', 'echo "";'],
    ].map(([from, to]) => mutate(FUTURE_ROUTE, from, to));
    const removed = mutate(FUTURE_ROUTE, REPLACEMENT, '');
    edits.push(mutate(removed, '$s = str_replace("{header2}"', REPLACEMENT + '$s = str_replace("{header2}"'));
    edits.push(FUTURE_ROUTE + ' ');
    reject(FUTURE_ROUTE, edits, verifyRoute);
});

test('template and helper mutations reject all edits beyond their exact additions', () => {
    const templateEdits = [
        [TEMPLATE_HEAD_FUTURE, TEMPLATE_HEAD],
        [TEMPLATE_HEAD_FUTURE, TEMPLATE_HEAD_FUTURE.replace('{referral_preview_assets}', '{other_assets}')],
        [TEMPLATE_HEAD_FUTURE, TEMPLATE_HEAD_FUTURE.replace('  {referral_preview_assets}', '{referral_preview_assets}')],
        [TEMPLATE_HEAD_FUTURE, TEMPLATE_HEAD_FUTURE.replace('  {referral_preview_assets}', '  {referral_preview_assets}\n  {referral_preview_assets}')],
        [BODY_FUTURE, BODY], [BODY_FUTURE, '<body class="oe-workbench-context oe-referral-preview">'],
        ["<div class='borderdiv'>", "<div class='borderdiv changed'>"],
        ["<p style='page-break-after: always'></p>", ''],
        ['{header1}', '{different_header}'], ['{ref_body}', '{other_body}'],
        ['font-family: sans-serif;', 'font-family: serif;'],
        ['win.printLogPrint(window);', 'window.print();'],
    ].map(([from, to]) => mutate(FUTURE_TEMPLATE, from, to));
    const withoutHead = mutate(FUTURE_TEMPLATE, TEMPLATE_HEAD_FUTURE, TEMPLATE_HEAD);
    templateEdits.push(mutate(withoutHead, '<body class="oe-referral-preview">',
        '<body class="oe-referral-preview">{referral_preview_assets}'));
    templateEdits.push(FUTURE_TEMPLATE + ' ');
    reject(FUTURE_TEMPLATE, templateEdits, verifyTemplate);
    const helperEdits = [
        ["        'popup.js',\n", ''], ["        'referral-preview.css',\n", ''],
        ["        'popup.js',\n", "        'popup.js',\n        'popup.js',\n"],
        [HELPER_FUTURE, HELPER_FUTURE.replace("        'popup.js',\n        'referral-preview.css',\n",
            "        'referral-preview.css',\n        'popup.js',\n")],
        [HELPER_FUTURE, HELPER_FUTURE.replace("        'popup.js',\n", '')],
        ["throw new \\InvalidArgumentException('Unsupported clinical workspace asset');", "return '0';"],
    ].map(([from, to]) => mutate(FUTURE_HELPER, from, to));
    helperEdits.push(FUTURE_HELPER + ' ');
    reject(FUTURE_HELPER, helperEdits, verifyHelper);
});

test('PostCSS rejects unscoped, print, geometry, font, importance, comments and extra rules', () => {
    const cssEdits = [
        ['@media screen {', '@media print {'],
        ['@media screen {', '@media screen {\n  /* comment */'],
        ['@media screen {', '@import "popup.css";\n@media screen {'],
        [RULES[0][0], 'body.oe-referral-preview'],
        [RULES[1][0], '.oe-referral-preview .borderdiv'],
        [RULES[2][0], 'html.oe-workbench-context td'],
        ['color: ' + INK + ';', 'color: red;'],
        ['color: ' + INK + ';', 'color: ' + INK + ' !important;'],
        ['background-color: ' + CANVAS + ';', 'background-color: ' + PAPER + ';'],
        ['border-color: ' + LINE + ';', 'border-color: #000;'],
        [block(RULES[2]), ''],
        [block(RULES[2]), block(RULES[2]) + '\n' + block(RULES[2])],
        [block(RULES[0]) + '\n' + block(RULES[1]), block(RULES[1]) + '\n' + block(RULES[0])],
        [block(RULES[2]), block(RULES[2]) + '  body { color: red; }\n'],
        [block(RULES[2]), block(RULES[2]) + '  .oe-referral-preview { width: 550px; }\n'],
        [block(RULES[2]), block(RULES[2]) + '  .oe-referral-preview { height: 400px; padding: 1px; }\n'],
        [block(RULES[2]), block(RULES[2]) + '  .oe-referral-preview { font-size: 12px; }\n'],
        [block(RULES[2]), block(RULES[2]) + '  .oe-referral-preview table { color: red; }\n'],
        ['\n\n  ' + RULES[1][0], '\n    ' + RULES[1][0]],
        ['    border-color:', '  border-color:'],
    ].map(([from, to]) => mutate(FUTURE_CSS, from, to));
    cssEdits.push(FUTURE_CSS + ' ');
    reject(FUTURE_CSS, cssEdits, verifyCss);
});

test('report caller and shared popup source retain their existing discovery anchors', () => {
    const caller = read('interface/reports/referrals_report.php');
    expect(caller).toContain("dlgopen('../patient_file/transaction/print_referral.php?transid=' + encodeURIComponent(transid),\n                '_blank', 550, 400,true);");
    const popup = read('interface/clinical-workspace/popup.js');
    expect(popup).toContain("const CONTEXT_CLASS = 'oe-workbench-context';");
});

// Hosted RED: exactly these four actual production assertions fail until implementation.
test('actual referral route matches the declared two additions', () => {
    expect(() => verifyRoute(read(ROUTE))).not.toThrow();
});
test('actual default template matches the declared head and body edits', () => {
    expect(() => verifyTemplate(read(TEMPLATE))).not.toThrow();
});
test('actual asset helper matches the two sorted entries', () => {
    expect(() => verifyHelper(read(HELPER))).not.toThrow();
});
test('actual referral stylesheet has exactly three scoped screen rules', () => {
    expect(() => verifyCss(readOptional(CSS))).not.toThrow();
});
