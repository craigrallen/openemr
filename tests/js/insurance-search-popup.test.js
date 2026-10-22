const fs = require('fs');
const path = require('path');
const postcss = require('postcss');

const root = path.join(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
// A missing production stylesheet reads as empty so the contract fails on content, not on I/O.
const readOptional = file => (fs.existsSync(path.join(root, file)) ? read(file) : '');
const source = () => read('interface/practice/ins_search.php');
const helper = () => read('src/Common/Assets/ClinicalWorkspaceAssets.php');
const css = () => readOptional('interface/clinical-workspace/insurance-search-popup.css');

// Exact 410-line ins_search.php before the entry-sheet presentation edits.
const ORIGINAL = read('tests/clinical-ui/fixtures/insurance-search-popup-original.txt');

// Exact ClinicalWorkspaceAssets.php before the sorted insurance-search-popup.css entry.
const HELPER_ORIGINAL = String.raw`<?php

/**
 * Per-file cache versions for the clinical workspace screen assets.
 *
 * Views that link interface/clinical-workspace assets directly append
 * ?v=<version> so a browser refetches a file as soon as it changes. Keeping
 * the filesystem lookup here keeps the view's URL expression free of
 * filesystem roots, and confines which files may be stat()ed to a fixed list.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Common\Assets;

final readonly class ClinicalWorkspaceAssets
{
    /**
     * Supported asset basenames. The directory defaults to the clinical
     * workspace; a legacy tooltip caller supplies library/js explicitly.
     */
    private const SUPPORTED = [
        'ajtooltip.js',
        'appointment.css',
        'calendar-sidebar.js',
        'calendar-workday.css',
        'calendar-workday.js',
        'encounter-document.css',
        'finder.css',
        'global-messages.css',
        'history-document.css',
        'history-editor.css',
        'issue-popup.css',
        'lbf-document.css',
        'mode.js',
        'patient-messages.css',
        'patient-picker-popup.css',
        'patient-results-popup.css',
        'patient-search.css',
        'soap-document.css',
        'soap-document.js',
        'soap-reference.css',
        'soap-reference.js',
        'visit-history.css',
        'visit-history.js',
        'workspace.css',
    ];

    private string $directory;

    /**
     * @param ?string $directory Directory holding the assets; defaults to the
     *                           shipped interface/clinical-workspace.
     */
    public function __construct(?string $directory = null)
    {
        $this->directory = $directory ?? dirname(__DIR__, 3) . '/interface/clinical-workspace';
    }

    /**
     * Modification time of a supported asset as a decimal string, or '0'
     * when the file is absent.
     *
     * @throws \InvalidArgumentException when $asset is not a supported name
     */
    public function version(string $asset): string
    {
        if (!in_array($asset, self::SUPPORTED, true)) {
            throw new \InvalidArgumentException('Unsupported clinical workspace asset');
        }

        $path = $this->directory . '/' . $asset;
        clearstatcache(true, $path);
        if (!is_file($path)) {
            return '0';
        }
        $mtime = filemtime($path);

        return $mtime === false ? '0' : sprintf('%d', $mtime);
    }
}
`;

// Every permitted edit is [original, presented]; nothing else may differ.
const IMPORT = 'use OpenEMR\\Common\\Csrf\\CsrfUtils;\n';
const HEADER = "    <?php Header::setupHeader(['opener', 'topdialog']); ?>\n";
const LINK = '    <link rel="stylesheet" href="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>'
    + '/interface/clinical-workspace/insurance-search-popup.css?v='
    + "<?php echo attr_url((new ClinicalWorkspaceAssets())->version('insurance-search-popup.css')); ?>\" media=\"screen\">\n";
const ENTRY = '    <div id="form_entry">\n';
const ENTRY_CLASSED = '    <div id="form_entry" class="oe-insurance-search-document">\n';
const ROUTE_EDITS = [
    [IMPORT, 'use OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;\n' + IMPORT],
    [HEADER, HEADER + LINK],
    [ENTRY, ENTRY_CLASSED],
];
const HELPER_EDITS = [
    ["        'issue-popup.css',\n", "        'insurance-search-popup.css',\n        'issue-popup.css',\n"],
];

const count = (text, part) => text.split(part).length - 1;
const apply = (text, edits) => edits.reduce((out, [from, to]) => {
    if (count(out, from) !== 1) throw new Error(`edit anchor is missing or ambiguous: ${JSON.stringify(from)}`);
    return out.replace(from, () => to);
}, text);
const invert = edits => edits.map(([before, after]) => [after, before]);

// Forward and reverse equality against the exact originals, so no byte outside the edits can move.
const verifyExact = (text, original, edits, label) => {
    if (text !== apply(original, edits)) throw new Error(`${label} differs from the exact permitted additions`);
    if (apply(text, invert(edits)) !== original) throw new Error(`${label} does not restore the exact original`);
};
const verifyRoute = text => verifyExact(text, ORIGINAL, ROUTE_EDITS, 'ins_search.php');
const verifyHelper = text => verifyExact(text, HELPER_ORIGINAL, HELPER_EDITS, 'ClinicalWorkspaceAssets.php');

const SCOPE = 'html.oe-workbench-context #form_entry.oe-insurance-search-document';
const FOCUS = [
    { prop: 'outline', value: '2px solid var(--oe-wb-petrol, #1d5961)', important: false },
    { prop: 'outline-offset', value: '2px', important: false },
];
const PAPER = [
    { prop: 'background-color', value: 'var(--oe-wb-paper, #fff)', important: false },
    { prop: 'color', value: 'var(--oe-wb-ink, #17343b)', important: false },
];
const RULES = [
    [`${SCOPE} input.btn:focus`, FOCUS],
    [`${SCOPE} input.btn:focus-visible`, FOCUS],
    [SCOPE, PAPER],
];

// Exactly three single-selector rules with exactly their declarations; no at-rules or !important.
const verifyCss = text => {
    const rules = [];
    postcss.parse(text).each(node => {
        if (node.type === 'comment') return;
        if (node.type !== 'rule') throw new Error(`unexpected ${node.type} at stylesheet root`);
        rules.push(node);
    });
    if (rules.length !== RULES.length) throw new Error(`expected ${RULES.length} rules, found ${rules.length}`);
    rules.forEach((rule, index) => {
        const [selector, declarations] = RULES[index];
        if (rule.selectors.length !== 1 || rule.selector !== selector) {
            throw new Error(`rule ${index} selector is ${JSON.stringify(rule.selector)}`);
        }
        const found = rule.nodes.map(node => {
            if (node.type !== 'decl') throw new Error(`unexpected ${node.type} inside rule ${index}`);
            if (node.important) throw new Error(`!important inside rule ${index}`);
            return { prop: node.prop, value: node.value, important: Boolean(node.important) };
        });
        if (JSON.stringify(found) !== JSON.stringify(declarations)) {
            throw new Error(`rule ${index} declarations are ${JSON.stringify(found)}`);
        }
    });
};

const FUTURE_ROUTE = apply(ORIGINAL, ROUTE_EDITS);
const FUTURE_HELPER = apply(HELPER_ORIGINAL, HELPER_EDITS);
const block = ([selector, declarations]) => `${selector} {\n`
    + declarations.map(d => `    ${d.prop}: ${d.value};\n`).join('') + '}\n';
const FUTURE_CSS = RULES.map(block).join('\n');

// Mutants are built outside expect().toThrow(); each anchor must be unique and the bytes must change.
const mutate = (text, from, to) => {
    expect(count(text, from)).toBe(1);
    const out = text.replace(from, () => to);
    expect(out).not.toBe(text);
    return out;
};
const flip = (text, index) => {
    const out = text.slice(0, index) + (text[index] === 'X' ? 'Y' : 'X') + text.slice(index + 1);
    expect(out).not.toBe(text);
    expect(out).toHaveLength(text.length);
    return out;
};
const byteMutants = text => [0, Math.floor(text.length / 3), Math.floor(text.length / 2), text.length - 1]
    .map(index => flip(text, index))
    .concat([`${text} `, text.slice(0, -1)]);

describe('frozen originals', () => {
    test('fixture is the full 410-line route and each anchor is unique', () => {
        const lines = ORIGINAL.split('\n');
        expect(lines).toHaveLength(411);
        expect(lines[409]).toBe('</html>');
        expect(lines[410]).toBe('');
        for (const [before] of ROUTE_EDITS) expect(count(ORIGINAL, before)).toBe(1);
        for (const [before] of HELPER_EDITS) expect(count(HELPER_ORIGINAL, before)).toBe(1);
    });

    test('current files are either the frozen originals or exactly their presented forms', () => {
        expect([ORIGINAL, FUTURE_ROUTE]).toContain(source());
        expect([HELPER_ORIGINAL, FUTURE_HELPER]).toContain(helper());
    });

    test('the original route and helper are rejected as presented forms', () => {
        expect(() => verifyRoute(ORIGINAL)).toThrow();
        expect(() => verifyHelper(HELPER_ORIGINAL)).toThrow();
    });
});

describe('production contract', () => {
    test('ins_search.php carries exactly the import, screen stylesheet link and entry class', () => {
        expect(() => verifyRoute(source())).not.toThrow();
    });

    test('ClinicalWorkspaceAssets lists insurance-search-popup.css once, sorted before issue-popup.css', () => {
        expect(() => verifyHelper(helper())).not.toThrow();
    });

    test('insurance-search-popup.css has exactly the three entry-sheet rules', () => {
        expect(() => verifyCss(css())).not.toThrow();
    });

    test('the existing saveFromForm call and its CSRF guard stay in place', () => {
        const php = source();
        expect(count(php, '$saved = $insuranceCompany->saveFromForm($post);')).toBe(1);
        expect(php).toContain("        CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: true);\n\n");
    });
});

describe('synthetic presented forms', () => {
    test('route, helper and stylesheet built from the declared additions pass', () => {
        expect(() => verifyRoute(FUTURE_ROUTE)).not.toThrow();
        expect(() => verifyHelper(FUTURE_HELPER)).not.toThrow();
        expect(() => verifyCss(FUTURE_CSS)).not.toThrow();
        expect(() => verifyCss(`/* Insurance search entry sheet. */\n${FUTURE_CSS}`)).not.toThrow();
    });

    test('the presented route and helper restore the exact originals', () => {
        expect(apply(FUTURE_ROUTE, invert(ROUTE_EDITS))).toBe(ORIGINAL);
        expect(apply(FUTURE_HELPER, invert(HELPER_EDITS))).toBe(HELPER_ORIGINAL);
        expect(FUTURE_ROUTE.split('\n')).toHaveLength(ORIGINAL.split('\n').length + 2);
    });

    test('the presented link is screen-only, escaped and versioned by the helper', () => {
        expect(count(FUTURE_ROUTE, LINK)).toBe(1);
        expect(FUTURE_ROUTE).toContain(HEADER + LINK + '\n    <style>\n');
        expect(FUTURE_ROUTE).toContain('<body class="body_top">\n');
        expect(FUTURE_ROUTE).toContain('    <div id="form_list">\n    </div>\n');
        expect(count(FUTURE_ROUTE, 'use OpenEMR\\Core\\OEGlobalsBag;\n')).toBe(1);
    });

    test('the presented helper list stays sorted with one new entry', () => {
        const entries = [...FUTURE_HELPER.matchAll(/^ {8}'([^']+)',$/gm)].map(match => match[1]);
        expect(entries).toEqual([...entries].sort());
        expect(entries.filter(entry => entry === 'insurance-search-popup.css')).toHaveLength(1);
        expect(entries[entries.indexOf('issue-popup.css') - 1]).toBe('insurance-search-popup.css');
        expect(entries).toHaveLength(25);
    });
});

describe('negative controls', () => {
    test('arbitrary byte changes to the presented route are rejected', () => {
        const mutants = byteMutants(FUTURE_ROUTE);
        for (const mutant of mutants) expect(() => verifyRoute(mutant)).toThrow();
    });

    test('behaviour, security and native paint mutations to the route are rejected', () => {
        const mutants = [
            ['"SELECT id, name FROM x12_partners ORDER BY name"', '"SELECT id, name FROM x12_partners ORDER BY id"'],
            ['$insuranceCompany->saveFromForm($post)', '$insuranceCompany->saveFromForm($_POST)'],
            ['CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: true);', 'CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: false);'],
            ["                csrf_token_form: <?php echo js_escape(CsrfUtils::collectCsrfToken(session: $session)); ?>,\n", ''],
            ['name="csrf_token_form" value="<?php echo CsrfUtils::collectCsrfToken(session: $session); ?>"', 'name="csrf_token_form" value=""'],
            ["'form_cqm_sop' => FILTER_UNSAFE_RAW,", "'form_cqm_sop' => FILTER_DEFAULT,"],
            ["        'form_partner' => FILTER_UNSAFE_RAW,\n", ''],
            ["attr($ins_co['cms_id'] ?? '')", "attr($ins_co['name'] ?? '')"],
            [" . ($ins_co_address?->plusFour ?? '')", ''],
            ["$ins_co_address?->country ?? 'USA'", "$ins_co_address?->country ?? ''"],
            ['form_city: f.form_city.value,', 'form_city: f.form_state.value,'],
            ["filter_input(INPUT_GET, 'ins', FILTER_VALIDATE_INT) ?: null", "filter_input(INPUT_GET, 'ins') ?: null"],
            ["            if (!f.form_zip.value.length) msg += 'Zip is missing.';\n", ''],
            ['if (!(save_clicked || update_clicked)) return dosearch();', 'if (!save_clicked) return dosearch();'],
            ['$session = SessionWrapperFactory::getInstance()->getActiveSession();', '$session = null;'],
            ['            top.restoreSession();\n            return true;', '            return true;'],
            ['opener.set_insurance(ins_id, ins_name);', 'opener.set_insurance(ins_name, ins_id);'],
            ['echo " set_insurance(" . js_escape($ins_id)', 'echo " set_insurance(" . json_encode($ins_id)'],
            ['opener.postMessage(postMessage, window.location.origin);', "opener.postMessage(postMessage, '*');"],
            ["readonly='readonly' value=", 'value='],
            ["onclick='window.close();'", "onclick='dlgclose();'"],
            ["name='form_save' onmousedown='save_clicked=true'", "name='form_save' onclick='save_clicked=true'"],
            ["onsubmit='return validate(this)'", "onsubmit='return true'"],
            ["class='btn btn-primary' onclick='dosearch()'", "class='btn btn-secondary' onclick='dosearch()'"],
            ["Header::setupHeader(['opener', 'topdialog']);", "Header::setupHeader(['opener']);"],
            ['            font-size: 0.8125rem;', '            font-size: 1rem;'],
            ['        #form_list {\n            display: none;', '        #form_list {\n            display: block;'],
            ['$("#form_list").load(search_list).show();', '$("#form_list").html("").show();'],
            ['<div id="form_list">', '<div id="form_list" class="oe-insurance-search-results">'],
            ['<body class="body_top">', '<body class="body_top oe-insurance-search">'],
            ['            <center>\n', '            <div class="oe-insurance-search-sheet"><center>\n'],
            ['<table class="w-100 border-0">', '<table class="w-75 border-0">'],
        ].map(([from, to]) => mutate(FUTURE_ROUTE, from, to));
        for (const mutant of mutants) expect(() => verifyRoute(mutant)).toThrow();
    });

    test('asset escaping, version, path, media, duplicate and scope mutations are rejected', () => {
        const mutants = [
            ['attr(OEGlobalsBag::getInstance()->getWebRoot())', 'OEGlobalsBag::getInstance()->getWebRoot()'],
            ["attr_url((new ClinicalWorkspaceAssets())", "attr((new ClinicalWorkspaceAssets())"],
            ["->version('insurance-search-popup.css')", "->version('issue-popup.css')"],
            ['/interface/clinical-workspace/insurance-search-popup.css?v=', '/interface/clinical-workspace/issue-popup.css?v='],
            ['insurance-search-popup.css?v=<?php', 'insurance-search-popup.css<?php'],
            [' media="screen">', ' media="all">'],
            [' media="screen">', '>'],
            [LINK, LINK + LINK],
            [LINK, ''],
            ['use OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;\n', ''],
            ['use OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;\n', 'use OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;\nuse OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;\n'],
            ['use OpenEMR\\Core\\OEGlobalsBag;\n', ''],
            [ENTRY_CLASSED, ENTRY],
            [ENTRY_CLASSED, '    <div id="form_entry" class="oe-insurance-search-document oe-insurance-search-document">\n'],
            [ENTRY_CLASSED, '    <div id="form_entry" class="oe-insurance-search">\n'],
        ].map(([from, to]) => mutate(FUTURE_ROUTE, from, to));
        for (const mutant of mutants) expect(() => verifyRoute(mutant)).toThrow();
    });

    test('arbitrary helper changes and additions are rejected', () => {
        const mutants = byteMutants(FUTURE_HELPER).concat([
            ["        'insurance-search-popup.css',\n", ''],
            ["        'insurance-search-popup.css',\n", "        'insurance-search-popup.css',\n        'insurance-search-popup.css',\n"],
            ["        'insurance-search-popup.css',\n        'issue-popup.css',\n", "        'issue-popup.css',\n        'insurance-search-popup.css',\n"],
            ["        'issue-popup.css',\n", "        'issue-popup.css',\n        'insurance-list-popup.css',\n"],
            ["        'workspace.css',\n", "        'workspace.css',\n        'zz-extra.css',\n"],
            ["throw new \\InvalidArgumentException('Unsupported clinical workspace asset');", "return '0';"],
            ["'/interface/clinical-workspace';", "'/interface/clinical-workspace/insurance';"],
        ].map(([from, to]) => mutate(FUTURE_HELPER, from, to)));
        for (const mutant of mutants) expect(() => verifyHelper(mutant)).toThrow();
    });

    test('stylesheet scope, rule, at-rule, property, token, importance and combined-list mutations are rejected', () => {
        const paperRule = `${SCOPE} {\n`;
        const focusRule = `${SCOPE} input.btn:focus {\n`;
        const visibleRule = `${SCOPE} input.btn:focus-visible {\n`;
        const mutants = [
            [paperRule, '#form_entry.oe-insurance-search-document {\n'],
            [focusRule, 'html.oe-workbench-context #form_entry input.btn:focus {\n'],
            [visibleRule, 'html.oe-workbench-context input.btn:focus-visible {\n'],
            [paperRule, 'html.oe-workbench-context body {\n'],
            [focusRule, `${SCOPE} input:focus {\n`],
            [focusRule, `${SCOPE} input.btn:focus,\n${visibleRule}`],
            [`${visibleRule}    outline: 2px solid var(--oe-wb-petrol, #1d5961);\n    outline-offset: 2px;\n}\n\n`, ''],
            ['    color: var(--oe-wb-ink, #17343b);\n}\n', '    color: var(--oe-wb-ink, #17343b);\n}\n\nhtml.oe-workbench-context #form_list {\n    color: var(--oe-wb-ink, #17343b);\n}\n'],
            ['    color: var(--oe-wb-ink, #17343b);\n}\n', '    color: var(--oe-wb-ink, #17343b);\n}\n\n@media print {\n    #form_entry {\n        color: #000;\n    }\n}\n'],
            [block(RULES[0]), `@supports (color: red) {\n${block(RULES[0])}}\n`],
            [focusRule, `@import "workspace.css";\n${focusRule}`],
            ['    color: var(--oe-wb-ink, #17343b);\n', '    color: var(--oe-wb-ink, #17343b);\n    font-size: 1rem;\n'],
            ['    color: var(--oe-wb-ink, #17343b);\n', '    color: var(--oe-wb-ink, #17343b);\n    padding: 0;\n'],
            ['    color: var(--oe-wb-ink, #17343b);\n}\n', '    color: var(--oe-wb-ink, #17343b);\n}\n\n'
                + `${SCOPE} input.btn {\n    background-color: var(--oe-wb-petrol, #1d5961);\n}\n`],
            ['    color: var(--oe-wb-ink, #17343b);\n}\n', '    color: var(--oe-wb-ink, #17343b);\n}\n\n'
                + `${SCOPE} .form-control {\n    color: var(--oe-wb-ink, #17343b);\n}\n`],
            [`${focusRule}    outline: 2px solid var(--oe-wb-petrol, #1d5961);`, `${focusRule}    outline: 2px solid var(--oe-wb-teal, #1d5961);`],
            [`${visibleRule}    outline: 2px solid var(--oe-wb-petrol, #1d5961);`, `${visibleRule}    outline: 3px solid var(--oe-wb-petrol, #1d5961);`],
            ['var(--oe-wb-paper, #fff)', 'var(--oe-wb-paper, #ffffff)'],
            ['var(--oe-wb-ink, #17343b)', 'var(--oe-wb-text, #17343b)'],
            ['    color: var(--oe-wb-ink, #17343b);\n', '    color: var(--oe-wb-ink, #17343b) !important;\n'],
            [`${focusRule}    outline: 2px solid var(--oe-wb-petrol, #1d5961);\n    outline-offset: 2px;`, `${focusRule}    outline: 2px solid var(--oe-wb-petrol, #1d5961);\n    outline-offset: 2px !important;`],
            ['    background-color: var(--oe-wb-paper, #fff);\n    color: var(--oe-wb-ink, #17343b);\n', '    color: var(--oe-wb-ink, #17343b);\n    background-color: var(--oe-wb-paper, #fff);\n'],
        ].map(([from, to]) => mutate(FUTURE_CSS, from, to));
        const combined = mutate(
            FUTURE_CSS,
            `${block(RULES[0])}\n${block(RULES[1])}`,
            block([`${SCOPE} input.btn:focus,\n${SCOPE} input.btn:focus-visible`, FOCUS]),
        );
        const combinedRules = postcss.parse(combined).nodes;
        expect(combinedRules).toHaveLength(2);
        expect(combinedRules[0].selectors).toHaveLength(2);
        for (const mutant of mutants.concat([combined])) expect(() => verifyCss(mutant)).toThrow();
    });
});

// Read-only source evidence about the callers; this is not a security clearance.
describe('caller source evidence', () => {
    test('new_comprehensive.php opens the route as a fixed 650x460 iframe dialog', () => {
        const php = read('interface/new/new_comprehensive.php');
        expect(php).toContain("<a class='btn btn-primary text-white medium_modal' href='../practice/ins_search.php' onclick='ins_search(");
        expect(php).toMatch(/\$\("\.medium_modal"\)\.on\('click', function\(e\) \{\s*e\.preventDefault\(\);e\.stopPropagation\(\);\s*dlgopen\('', '', 650, 460, '', '', \{\s*buttons: \[\s*\{text: <\?php echo xlj\('Close'\); \?>, close: true, style: 'default btn-sm'\}\s*\],\s*\/\/onClosed: 'refreshme',\s*allowResize: false,\s*allowDrag: true,\s*dialogId: '',\s*type: 'iframe',\s*url: \$\(this\)\.attr\('href'\)\s*\}\);/);
    });

    test('ins_list.php checks a GET CSRF token, builds its SELECT and is injected into #form_list', () => {
        const php = read('interface/practice/ins_list.php');
        expect(count(php, 'CsrfUtils::checkCsrfInput(INPUT_GET, dieOnFail: true);')).toBe(1);
        expect(php).toContain("$where = addwhere($where, 'i.name', $_GET['form_name']);");
        expect(php).toContain('"FROM insurance_companies i " .');
        expect(php).toContain('$res = sqlStatement($query);');
        expect(php).toContain('<body class="body_top">');
        expect(ORIGINAL).toContain("var search_list = 'ins_list.php?' + params;");
        expect(ORIGINAL).toContain('$("#form_list").load(search_list).show();');
    });
});
