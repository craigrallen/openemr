/** @jest-environment node */

const fs = require('fs');
const path = require('path');
const postcss = require('postcss');

const root = path.join(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const readOptional = file => fs.existsSync(path.join(root, file)) ? read(file) : '';
const route = () => read('interface/fax/fax_dispatch.php');
const helper = () => read('src/Common/Assets/ClinicalWorkspaceAssets.php');
const css = () => readOptional('interface/clinical-workspace/fax-dispatch-popup.css');

// All 996 original route lines, including the GET cache and POST dispatch paths.
const ORIGINAL = read('tests/clinical-ui/fixtures/fax-dispatch-popup-original.txt');
// Full original helper before the one sorted asset entry.
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

const IMPORT = 'use OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;\n';
const CSRF_IMPORT = 'use OpenEMR\\Common\\Csrf\\CsrfUtils;\n';
const HEADER = "    <?php Header::setupHeader(['opener', 'datetime-picker']);?>\n";
const LINK = '    <link rel="stylesheet" media="screen" href="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>'
    + '/interface/clinical-workspace/fax-dispatch-popup.css?v='
    + '<?php echo attr_url((new ClinicalWorkspaceAssets())->version(\'fax-dispatch-popup.css\')); ?>">\n';
const FORM = "<form method='post' name='theform'";
const MARKED_FORM = "<form method='post' name='theform' class='oe-fax-dispatch-sheet'";
const ROUTE_EDITS = [
    [CSRF_IMPORT, IMPORT + CSRF_IMPORT],
    [HEADER, HEADER + LINK],
    [FORM, MARKED_FORM],
];
const ENTRY = "        'fax-dispatch-popup.css',\n";
const HELPER_EDITS = [["        'encounter-document.css',\n        'finder.css',\n",
    "        'encounter-document.css',\n" + ENTRY + "        'finder.css',\n"]];

const count = (value, part) => value.split(part).length - 1;
const apply = (value, edits) => edits.reduce((out, [before, after]) => {
    if (count(out, before) !== 1) throw new Error('missing or ambiguous anchor: ' + JSON.stringify(before));
    return out.replace(before, () => after);
}, value);
const inverse = edits => edits.map(([before, after]) => [after, before]);
const verifyExact = (candidate, original, edits, label) => {
    const expected = apply(original, edits);
    if (candidate !== expected) throw new Error(label + ' differs outside exact additions');
    if (apply(candidate, inverse(edits)) !== original) throw new Error(label + ' does not restore every original byte');
};
const verifyRoute = candidate => verifyExact(candidate, ORIGINAL, ROUTE_EDITS, 'fax_dispatch.php');
const verifyHelper = candidate => verifyExact(candidate, HELPER_ORIGINAL, HELPER_EDITS, 'ClinicalWorkspaceAssets.php');

const SCOPE = 'html.oe-workbench-context form.oe-fax-dispatch-sheet';
const INK = 'var(--oe-wb-ink, #17343b)';
const PAPER = 'var(--oe-wb-paper, #fff)';
const PETROL = 'var(--oe-wb-petrol, #086878)';
const decl = (prop, value, important = false) => ({ prop, value, important });
const OUTLINE = [decl('outline', '2px solid ' + PETROL), decl('outline-offset', '2px')];
const controls = suffix => [
    SCOPE + ' .form-control' + suffix,
    SCOPE + " input[type='checkbox']" + suffix,
    SCOPE + " input[type='radio']" + suffix,
    SCOPE + ' button' + suffix,
];
const RULES = [
    [[SCOPE + ' #div_copy', SCOPE + ' #div_forward'], [decl('color', INK), decl('background', PAPER)]],
    [[SCOPE + ' #div_copy_doc', SCOPE + ' #div_copy_sn', SCOPE + ' #div_note'],
        [decl('color', INK), decl('background', PAPER, true)]],
    [controls(':focus'), OUTLINE],
    [controls(':focus-visible'), OUTLINE],
];
const block = ([selectors, declarations]) => selectors.join(',\n') + ' {\n'
    + declarations.map(d => '    ' + d.prop + ': ' + d.value + (d.important ? ' !important' : '') + ';\n').join('') + '}\n';
const FUTURE_CSS = '@media screen {\n' + RULES.map(block).join('\n') + '}\n';

// PostCSS must find exactly one screen media and four ordered rules. Selectors,
// declarations, values and importance all use exact allowlists.
const verifyCss = value => {
    const ast = postcss.parse(value);
    if (ast.nodes.length !== 1) throw new Error('expected one screen media rule');
    const media = ast.nodes[0];
    if (media.type !== 'atrule' || media.name !== 'media' || media.params !== 'screen') {
        throw new Error('unexpected stylesheet context');
    }
    if (media.nodes.length !== RULES.length) throw new Error('unexpected CSS rule count');
    media.nodes.forEach((rule, index) => {
        const [selectors, declarations] = RULES[index];
        if (rule.type !== 'rule' || JSON.stringify(rule.selectors) !== JSON.stringify(selectors)) {
            throw new Error('unexpected CSS selector or focus grouping at ' + index);
        }
        const found = rule.nodes.map(node => {
            if (node.type !== 'decl') throw new Error('unexpected CSS child at ' + index);
            return { prop: node.prop, value: node.value, important: Boolean(node.important) };
        });
        if (JSON.stringify(found) !== JSON.stringify(declarations)) {
            throw new Error('unexpected CSS declaration at ' + index);
        }
    });
};

const FUTURE_ROUTE = apply(ORIGINAL, ROUTE_EDITS);
const FUTURE_HELPER = apply(HELPER_ORIGINAL, HELPER_EDITS);
const mutate = (value, from, to) => {
    expect(count(value, from)).toBe(1);
    const changed = value.replace(from, () => to);
    expect(changed).not.toBe(value);
    return changed;
};

test('synthetic forward and full inverse contracts accept only declared additions', () => {
    expect(ORIGINAL.split('\n')).toHaveLength(997);
    expect(ORIGINAL.endsWith('</html>\n')).toBe(true);
    expect(HELPER_ORIGINAL.split('\n')).toHaveLength(88);
    expect(() => verifyRoute(FUTURE_ROUTE)).not.toThrow();
    expect(() => verifyHelper(FUTURE_HELPER)).not.toThrow();
    expect(() => verifyCss(FUTURE_CSS)).not.toThrow();
    expect(apply(FUTURE_ROUTE, inverse(ROUTE_EDITS))).toBe(ORIGINAL);
    expect(apply(FUTURE_HELPER, inverse(HELPER_EDITS))).toBe(HELPER_ORIGINAL);
    expect(() => verifyRoute(ORIGINAL)).toThrow();
    expect(() => verifyHelper(HELPER_ORIGINAL)).toThrow();
    expect(() => verifyCss('')).toThrow();
});

test('synthetic route preserves dispatch actions and native controls', () => {
    expect(FUTURE_ROUTE).toContain(HEADER + LINK);
    expect(count(FUTURE_ROUTE, LINK)).toBe(1);
    expect(count(FUTURE_ROUTE, IMPORT)).toBe(1);
    expect(count(FUTURE_ROUTE, MARKED_FORM)).toBe(1);
    for (const anchor of [
        "CsrfUtils::checkCsrfInput(INPUT_GET, dieOnFail: true);",
        "CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: true);",
        "$site_id = $session->get('site_id');",
        "QueryUtils::fetchSingleValue(",
        "QueryUtils::sqlInsert($query, [$request->request->getString('form_copy_sn_comments')]);",
        '$buildFaxcache = static function ()',
        '$process = new Process($command, $cwd);',
        '$document = new Document();',
        '$document->createDocument(',
        '(new FormService())->addForm(',
        'addPnote(',
        "['sendfax', '-A', '-n', $form_finemode, '-d', $form_fax, $tmpfn2, $faxcache . '/temp.tif']",
        '$filesystem->remove($filepath);',
        "onsubmit='return validate()'",
        "onclick='return divclick(this,\"div_copy\");'",
        "onclick='return divclick(this,\"div_forward\");'",
        "onclick='sel_patient()'",
        'function setpatient(pid, lname, fname, dob)',
        'function allCheckboxes(issel)',
        "onclick='window.close()'",
        'attr_url($filename)',
        'js_url(CsrfUtils::collectCsrfToken(session: $session))',
        'attr($jfname)',
        'text((string) $page)',
        "<div id='div_copy_doc' class='bg-secondary border rounded p-2'>",
        "<div id='div_copy_sn' class='bg-secondary border rounded p-2'",
        "<div id='div_note' class='bg-secondary border rounded p-2'",
    ]) expect(FUTURE_ROUTE).toContain(anchor);
    const entries = [...FUTURE_HELPER.matchAll(/^ {8}'([^']+)',$/gm)].map(match => match[1]);
    expect(entries).toEqual([...entries].sort());
    expect(entries.filter(entry => entry === 'fax-dispatch-popup.css')).toHaveLength(1);
    expect(entries).toHaveLength(25);
});

test('exact route and helper contracts reject behavior mutations and arbitrary drift', () => {
    const routeMutants = [
        ["WHERE directory LIKE 'scanned_notes' AND state = 1 AND sql_run = 1", "WHERE directory LIKE 'scanned_notes'"],
        ["if ($fileParam !== '') {\n    CsrfUtils::checkCsrfInput(INPUT_GET, dieOnFail: true);", "if ($fileParam !== '') {"],
        ["} elseif ($scanParam !== '') {\n    CsrfUtils::checkCsrfInput(INPUT_GET, dieOnFail: true);", "} elseif ($scanParam !== '') {"],
        ["CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: true);", ''],
        ["$site_id = $session->get('site_id');", "$site_id = 'default';"],
        ["$userauthorized = $globalsBag->getInt('userauthorized');", "$userauthorized = 0;"],
        ["$process = new Process($command, $cwd);", "$process = new Process(['true']);"],
        ["['convert', '-density', '203x196', '-units', 'PixelsPerInch', '-depth', '8', '-alpha', 'off', $filepath, $faxcache . '/deleteme.tif']", "['convert', $filepath]"],
        ["$filesystem->remove($faxcache . '/temp.tif');", ''],
        ["$document = new Document();", ''],
        ["$document->createDocument(", '$document->storeDocument('],
        ["(new FormService())->addForm(", 'addForm('],
        ["$noteid = addPnote(", '$noteid = 0; // addPnote('],
        ["['sendfax', '-A', '-n', $form_finemode, '-d', $form_fax, $tmpfn2, $faxcache . '/temp.tif']", "['sendfax', '-d', $form_fax]"],
        ["$filesystem->remove($filepath);", ''],
        ["unlink($faxcache . \"/\" . $inbase . \".jpg\");", ''],
        ["attr_url($filename)", 'attr($filename)'],
        ["attr($site_id)", '$site_id'],
        ["attr($jfname)", '$jfname'],
        ["js_url(CsrfUtils::collectCsrfToken(session: $session))", 'CsrfUtils::collectCsrfToken(session: $session)'],
        ["onsubmit='return validate()'", "onsubmit='return true'"],
        ["onclick='return divclick(this,\"div_copy\");'", "onclick='return true'"],
        ['function setpatient(pid, lname, fname, dob)', 'function setpatient(pid)'],
        ['function allCheckboxes(issel)', 'function allCheckboxes()'],
        [MARKED_FORM, '<section>' + MARKED_FORM],
        [LINK, LINK + LINK],
        ['media="screen"', 'media="all"'],
        ["attr_url((new ClinicalWorkspaceAssets())->version", "attr((new ClinicalWorkspaceAssets())->version"],
    ].map(([from, to]) => mutate(FUTURE_ROUTE, from, to));
    routeMutants.push(FUTURE_ROUTE + ' ', FUTURE_ROUTE.slice(0, -1));
    routeMutants.forEach(candidate => expect(() => verifyRoute(candidate)).toThrow());

    const helperMutants = [
        [ENTRY, ''], [ENTRY, ENTRY + ENTRY],
        ["        'encounter-document.css',\n" + ENTRY, ENTRY + "        'encounter-document.css',\n"],
        ["throw new \\InvalidArgumentException('Unsupported clinical workspace asset');", "return '0';"],
    ].map(([from, to]) => mutate(FUTURE_HELPER, from, to));
    helperMutants.push(FUTURE_HELPER + ' ');
    helperMutants.forEach(candidate => expect(() => verifyHelper(candidate)).toThrow());
});

test('strict CSS AST rejects scope, paint, focus, importance and media mutations', () => {
    const mutants = [
        [SCOPE + ' #div_copy,', '#div_copy,'],
        [SCOPE + ' #div_forward', SCOPE + ' #div_forward,\nbody #div_forward'],
        [RULES[2][0].join(',\n'), RULES[2][0].slice(0, 3).concat(controls(':focus-visible').slice(3)).join(',\n')],
        ['background: ' + PAPER + ' !important;', 'background: ' + PAPER + ';'],
        ['background: ' + PAPER + ';', 'background: ' + PAPER + ' !important;'],
        [block(RULES[0]), block(RULES[0]).replace('color: ' + INK + ';', 'color: red;')],
        [block(RULES[3]), block(RULES[3]).replace('outline-offset: 2px;', 'outline-offset: 3px;')],
        [block(RULES[3]), ''],
        ['@media screen {', '@media print {'],
        ['@media screen {', '@import "workspace.css";\n@media screen {'],
        [block(RULES[3]), block(RULES[3]) + '\n' + SCOPE + ' table { padding: 1rem; }\n'],
        [block(RULES[3]), block(RULES[3]) + '\n' + SCOPE + ' .form-control { width: 100%; }\n'],
        [block(RULES[3]), block(RULES[3]) + '\n' + SCOPE + ' .is-invalid { border: 0; }\n'],
        [SCOPE + " input[type='radio']:focus,\n", SCOPE + " input[type='checkbox']:focus,\n"],
    ].map(([from, to]) => mutate(FUTURE_CSS, from, to));
    mutants.forEach(candidate => expect(() => verifyCss(candidate)).toThrow());
});

// These three assertions remain RED until the controller runs hosted tests.
test('actual route has only the declared fax dispatch additions', () => {
    expect(() => verifyRoute(route())).not.toThrow();
});

test('actual helper has only the sorted stylesheet entry', () => {
    expect(() => verifyHelper(helper())).not.toThrow();
});

test('actual CSS has exactly four screen-only fax dispatch rules', () => {
    expect(() => verifyCss(css())).not.toThrow();
});

test('existing fax list launches both dispatch modes at 850 by 550 with CSRF', () => {
    const caller = read('interface/fax/faxq.php');
    expect(caller).toContain("dlgopen('fax_dispatch.php?file=' + encodeURIComponent(ffname) + '&csrf_token_form=' + <?php echo js_url(CsrfUtils::collectCsrfToken(session: $session)); ?>, '_blank', 850, 550, '', 'Fax Dispatch');");
    expect(caller).toContain("dlgopen('fax_dispatch.php?scan=' + encodeURIComponent(sfname) + '&csrf_token_form=' + <?php echo js_url(CsrfUtils::collectCsrfToken(session: $session)); ?>, '_blank', 850, 550, '', 'Scanned Dispatch');");
});

test('existing popup context supplies scoped tokens only in active workbench', () => {
    const popupJs = read('interface/clinical-workspace/popup.js');
    const popupCss = read('interface/clinical-workspace/popup.css');
    expect(popupJs).toContain("const CONTEXT_CLASS = 'oe-workbench-context';");
    expect(popupJs).toContain("active = !!attempt(() => host.body.classList.contains('workbench-active'));");
    expect(popupJs).toContain('set(CONTEXT_CLASS, active);');
    expect(popupCss).toContain('html.oe-workbench-context,');
    expect(popupCss).toContain('--oe-wb-ink: #17343b;');
    expect(popupCss).toContain('--oe-wb-paper: #fff;');
    expect(popupCss).toContain('--oe-wb-petrol: #086878;');
});
