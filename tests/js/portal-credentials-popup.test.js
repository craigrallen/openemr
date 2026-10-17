/** @jest-environment node */

const fs = require('fs');
const path = require('path');
const postcss = require('postcss');

const root = path.join(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const readOptional = file => fs.existsSync(path.join(root, file)) ? read(file) : '';
const template = () => read('templates/patient/portal_login/print.html.twig');
const helper = () => read('src/Common/Assets/ClinicalWorkspaceAssets.php');
const css = () => readOptional('interface/clinical-workspace/portal-credentials-popup.css');

// The complete 131-line template before either proposed edit, including both branches.
const ORIGINAL = read('tests/clinical-ui/fixtures/portal-credentials-popup-original.txt');
// The complete helper before its single proposed allowlist addition.
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

const HEADER = "        {{ setupHeader(['opener']) }}\n";
const LINK = '        <link rel="stylesheet" media="screen" href="{{ webroot|attr }}'
    + '/interface/clinical-workspace/portal-credentials-popup.css?v='
    + '{{ clinicalWorkspaceAssetVersion(\'portal-credentials-popup.css\')|attr_url }}">\n';
const FORM = '<form name="portallogin" action="" method="post">';
const MARKED_FORM = '<form name="portallogin" action="" method="post" class="oe-portal-credentials-entry">';
const TEMPLATE_EDITS = [[HEADER, HEADER + LINK], [FORM, MARKED_FORM]];
const ENTRY = "        'portal-credentials-popup.css',\n";
const HELPER_EDITS = [["        'patient-search.css',\n        'soap-document.css',\n",
    "        'patient-search.css',\n" + ENTRY + "        'soap-document.css',\n"]];

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
const verifyTemplate = candidate => verifyExact(candidate, ORIGINAL, TEMPLATE_EDITS, 'print.html.twig');
const verifyHelper = candidate => verifyExact(candidate, HELPER_ORIGINAL, HELPER_EDITS, 'ClinicalWorkspaceAssets.php');

const SCOPE = 'html.oe-workbench-context form.oe-portal-credentials-entry';
const INK = 'var(--oe-wb-ink, #17343b)';
const PAPER = 'var(--oe-wb-paper, #fff)';
const PETROL = 'var(--oe-wb-petrol, #086878)';
const decl = (prop, value) => ({ prop, value, important: false });
const FOCUS = [decl('outline', '2px solid ' + PETROL), decl('outline-offset', '2px')];
const RULES = [
    [SCOPE, [decl('color', INK), decl('background', PAPER)]],
    [SCOPE + ' a.btn:focus', FOCUS],
    [SCOPE + ' a.btn:focus-visible', FOCUS],
];
const block = ([selector, declarations]) => selector + ' {\n'
    + declarations.map(d => '    ' + d.prop + ': ' + d.value + ';\n').join('') + '}\n';
const FUTURE_CSS = '@media screen {\n' + RULES.map(block).join('\n') + '}\n';

// Every AST node is accounted for: one screen block, three separate rules, ordered
// selectors and declarations, no comments, extra paint, importance or other at-rules.
const verifyCss = value => {
    const ast = postcss.parse(value);
    if (ast.nodes.length !== 1) throw new Error('expected one screen media block');
    const media = ast.nodes[0];
    if (media.type !== 'atrule' || media.name !== 'media' || media.params !== 'screen') {
        throw new Error('unexpected stylesheet context');
    }
    if (!media.nodes || media.nodes.length !== RULES.length) throw new Error('unexpected CSS rule count');
    media.nodes.forEach((rule, index) => {
        const [selector, declarations] = RULES[index];
        if (rule.type !== 'rule' || rule.selector !== selector) {
            throw new Error('unexpected CSS selector at ' + index);
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

const FUTURE_TEMPLATE = apply(ORIGINAL, TEMPLATE_EDITS);
const FUTURE_HELPER = apply(HELPER_ORIGINAL, HELPER_EDITS);
const mutate = (value, from, to) => {
    expect(count(value, from)).toBe(1);
    const changed = value.replace(from, () => to);
    expect(changed).not.toBe(value);
    return changed;
};

test('synthetic forward and full inverse accept only the planned template, helper and CSS', () => {
    expect(ORIGINAL.split('\n')).toHaveLength(132);
    expect(ORIGINAL.endsWith('</html>\n')).toBe(true);
    expect(HELPER_ORIGINAL.split('\n')).toHaveLength(88);
    expect(() => verifyTemplate(FUTURE_TEMPLATE)).not.toThrow();
    expect(() => verifyHelper(FUTURE_HELPER)).not.toThrow();
    expect(() => verifyCss(FUTURE_CSS)).not.toThrow();
    expect(apply(FUTURE_TEMPLATE, inverse(TEMPLATE_EDITS))).toBe(ORIGINAL);
    expect(apply(FUTURE_HELPER, inverse(HELPER_EDITS))).toBe(HELPER_ORIGINAL);
    expect(() => verifyTemplate(ORIGINAL)).toThrow();
    expect(() => verifyHelper(HELPER_ORIGINAL)).toThrow();
    expect(() => verifyCss('')).toThrow();
});

test('synthetic additions retain the credential branches, controls and sorted allowlist', () => {
    expect(count(FUTURE_TEMPLATE, HEADER + LINK)).toBe(1);
    expect(count(FUTURE_TEMPLATE, MARKED_FORM)).toBe(1);
    expect(FUTURE_TEMPLATE.indexOf(LINK)).toBeLessThan(FUTURE_TEMPLATE.indexOf('    {% endblock %}'));
    expect(FUTURE_TEMPLATE).toContain('    {% if (credPlainMessage is not empty) %}\n    <div class="alert alert-success"');
    expect(FUTURE_TEMPLATE.indexOf('    {% if (credPlainMessage is not empty) %}\n    <div class="alert alert-success"')).toBeLessThan(FUTURE_TEMPLATE.indexOf(MARKED_FORM));
    for (const anchor of [
        '<body class="body_top">', '<div class="container-fluid">',
        '{{ credEmailAddress|text }}', '{{ credPlainMessage|text|nl2br }}',
        'value="{{ csrfToken|attr }}"', 'value="{{ uname|attr }}"',
        'value="{{ login_uname|attr }}"', 'value="{{ pwd|attr }}"',
        '{% if enforce_signin_email %}', '{% if (forced_reset_option == \'2\') %}',
        'persistCriteria(this, event)', 'csrf_token_form: csrf',
        'top.printLogPrint(window);', 'document.forms[0].submit();',
        "{% include 'patient/partials/' ~ file ~ '.js.twig' with data %}",
        "{% include 'patient/partials/' ~ file ~ '.html.twig' with data %}",
        'onclick="return transmit()"', 'onclick="top.restoreSession(); dlgclose();"',
    ]) expect(FUTURE_TEMPLATE).toContain(anchor);
    const entries = [...FUTURE_HELPER.matchAll(/^ {8}'([^']+)',$/gm)].map(match => match[1]);
    expect(entries).toEqual([...entries].sort());
    expect(entries.filter(entry => entry === 'portal-credentials-popup.css')).toHaveLength(1);
    expect(entries).toHaveLength(25);
});

test('template inverse rejects original-byte edits and misplaced or weakened additions', () => {
    const mutants = [
        [LINK, ''], [LINK, LINK + LINK], [MARKED_FORM, FORM],
        [MARKED_FORM, MARKED_FORM + MARKED_FORM],
        ['media="screen"', 'media="print"'],
        ['{{ webroot|attr }}', '{{ webroot }}'],
        ["clinicalWorkspaceAssetVersion('portal-credentials-popup.css')|attr_url", "clinicalWorkspaceAssetVersion('portal-credentials-popup.css')|attr"],
        ["{{ setupHeader(['opener']) }}", "{{ setupHeader([]) }}"],
        ['<body class="body_top">', '<body class="body_top oe-portal-credentials-entry">'],
        ['<div class="container-fluid">', '<div class="container-fluid oe-portal-credentials-entry">'],
        ['<div class="alert alert-success" role="alert">', '<div class="alert alert-success oe-portal-credentials-entry" role="alert">'],
        ['{{ credPlainMessage|text|nl2br }}', '{{ credPlainMessage|raw }}'],
        ['{{ "Email was sent to following address"|xlt }}: {{ credEmailAddress|text }}',
            '{{ "Email was sent to following address"|xlt }}: {{ credEmailAddress|raw }}'],
        ['value="{{ csrfToken|attr }}"', 'value="{{ csrfToken }}"'],
        ['value="{{ pwd|attr }}"', 'value="{{ pwd }}"'],
        ["{% if (credPlainMessage is not empty) %}\n    <div class=\"alert alert-success\"",
            '{% if false %}\n    <div class="alert alert-success"'],
        ["{% if enforce_signin_email %}", '{% if false %}'],
        ["{% if (forced_reset_option == '2') %}", '{% if false %}'],
        ["{% if extensionsJavascript is not empty %}", '{% if false %}'],
        ["{% if extensionsFormFields is not empty %}", '{% if false %}'],
        ['top.printLogPrint(window);', 'window.print();'],
        ["document.getElementById('form_save').value='submit';", "document.getElementById('form_save').value='';"],
        ['document.forms[0].submit();', 'return false;'],
        ['csrf_token_form: csrf', 'csrf_token_form: null'],
        ['persistCriteria(this, event)', 'void(0)'],
        ["{% include 'patient/partials/' ~ file ~ '.js.twig' with data %}", ''],
        ["{% include 'patient/partials/' ~ file ~ '.html.twig' with data %}", ''],
        ['onclick="return transmit()"', 'onclick="return false"'],
        ['onclick="top.restoreSession(); dlgclose();"', 'onclick="dlgclose();"'],
        ['<input type="hidden" name="form_cancel" id="form_cancel" />', ''],
        ['<style>\n        @media print', '<style>\n        @media screen'],
    ].map(([from, to]) => mutate(FUTURE_TEMPLATE, from, to));
    mutants.push(FUTURE_TEMPLATE + ' ', FUTURE_TEMPLATE.slice(0, -1), ' ' + FUTURE_TEMPLATE);
    mutants.forEach(candidate => {
        expect(candidate).not.toBe(FUTURE_TEMPLATE);
        expect(() => verifyTemplate(candidate)).toThrow();
    });

    const helperMutants = [
        [ENTRY, ''], [ENTRY, ENTRY + ENTRY],
        ["        'patient-search.css',\n" + ENTRY, ENTRY + "        'patient-search.css',\n"],
        ["throw new \\InvalidArgumentException('Unsupported clinical workspace asset');", "return '0';"],
    ].map(([from, to]) => mutate(FUTURE_HELPER, from, to));
    helperMutants.push(FUTURE_HELPER + ' ');
    helperMutants.forEach(candidate => {
        expect(candidate).not.toBe(FUTURE_HELPER);
        expect(() => verifyHelper(candidate)).toThrow();
    });
});

test('strict CSS AST rejects leaks, semantic paint, merged focus, importance and geometry', () => {
    const mutants = [
        [SCOPE + ' {', 'form.oe-portal-credentials-entry {'],
        [SCOPE + ' {', 'html.oe-workbench-popup form.oe-portal-credentials-entry {'],
        [SCOPE + ' a.btn:focus {', SCOPE + ' :focus {'],
        [SCOPE + ' a.btn:focus-visible {', SCOPE + ' a.btn:focus, ' + SCOPE + ' a.btn:focus-visible {'],
        ['color: ' + INK + ';', 'color: red;'],
        ['background: ' + PAPER + ';', 'background: ' + PAPER + ' !important;'],
        [block(RULES[1]), block(RULES[1]).replace('outline: 2px solid ' + PETROL + ';', 'outline: none;')],
        [block(RULES[2]), block(RULES[2]).replace('outline-offset: 2px;', 'outline-offset: 0;')],
        ['@media screen {', '@media print {'],
        ['@media screen {', '@media screen and (min-width: 600px) {'],
        ['@media screen {', '@import "workspace.css";\n@media screen {'],
        [block(RULES[2]), block(RULES[2]) + '\n' + SCOPE + ' .alert { color: red; }\n'],
        [block(RULES[2]), block(RULES[2]) + '\n' + SCOPE + ' .alert-warning { color: red; }\n'],
        [block(RULES[2]), block(RULES[2]) + '\n' + SCOPE + ' .alert-success { color: red; }\n'],
        [block(RULES[2]), block(RULES[2]) + '\n' + SCOPE + ' input { background: red; }\n'],
        [block(RULES[2]), block(RULES[2]) + '\n' + SCOPE + ' .text-danger { color: red; }\n'],
        [block(RULES[2]), block(RULES[2]) + '\n' + SCOPE + ' .form-control { border: 1px solid red; }\n'],
        [block(RULES[2]), block(RULES[2]) + '\n' + SCOPE + ' { font-size: 2rem; }\n'],
        [block(RULES[2]), block(RULES[2]) + '\n' + SCOPE + ' { font-family: Arial; }\n'],
        [block(RULES[2]), block(RULES[2]) + '\n' + SCOPE + ' { display: flex; }\n'],
        [block(RULES[2]), block(RULES[2]) + '\n' + SCOPE + ' { padding: 1rem; }\n'],
        [block(RULES[2]), block(RULES[2]) + '\n' + SCOPE + ' { margin: 1rem; }\n'],
        [block(RULES[2]), block(RULES[2]) + '\n' + SCOPE + ' { width: 550px; }\n'],
        [block(RULES[2]), ''],
        [block(RULES[0]) + '\n' + block(RULES[1]), block(RULES[1]) + '\n' + block(RULES[0])],
        [block(RULES[1]) + '\n' + block(RULES[2]),
            SCOPE + ' a.btn:focus, ' + SCOPE + ' a.btn:focus-visible {\n    outline: 2px solid ' + PETROL + ';\n    outline-offset: 2px;\n}\n'],
    ].map(([from, to]) => mutate(FUTURE_CSS, from, to));
    mutants.forEach(candidate => {
        expect(candidate).not.toBe(FUTURE_CSS);
        expect(() => verifyCss(candidate)).toThrow();
    });
});

// Controller owns hosted genuine RED before any production edit.
test('actual template has exactly the declared link and form marker', () => {
    expect(() => verifyTemplate(template())).not.toThrow();
});

test('actual helper has exactly the sorted portal stylesheet entry', () => {
    expect(() => verifyHelper(helper())).not.toThrow();
});

test('actual CSS has exactly three scoped screen rules', () => {
    expect(() => verifyCss(css())).not.toThrow();
});

test('actual Twig bindings, renderer, service, caller and context retain their source contracts', () => {
    const twig = read('src/Common/Twig/TwigExtension.php');
    expect(twig).toContain("'webroot' => $kernel->getWebRoot(),");
    expect(twig).toContain("'webroot' => $this->globals->get('webroot'),");
    expect(twig).toContain("'clinicalWorkspaceAssetVersion',");
    expect(twig).toContain('$this->clinicalWorkspaceAssets->version(...)');

    const renderer = read('interface/patient_file/summary/create_portallogin.php');
    for (const anchor of [
        "$pid = $session->get('pid', 0);",
        '$credentials = $patientAccessOnSiteService->getOnsiteCredentialsForPid($pid);',
        "if ($option == '2') {", "} elseif ($option == '0') {",
        "if (isset($_POST['form_save']) && $_POST['form_save'] === 'submit') {",
        'CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: true);',
        '$result = $patientAccessOnSiteService->saveCredentials($pid, $postPwd, $postUname, $postLoginUname, $forced_reset_disable);',
        '$emailResult = $patientAccessOnSiteService->sendCredentialsEmail($pid, $result[\'pwd\'], $result[\'uname\'], $result[\'login_uname\'], $result[\'email_direct\']);',
        "'patient/portal_login/print.html.twig'", "'csrfToken' => CsrfUtils::collectCsrfToken(session: $session)",
        "'pwd' => $patientAccessOnSiteService->getRandomPortalPassword()",
        "'extensionsFormFields' => []", "'extensionsJavascript' => []",
    ]) expect(renderer).toContain(anchor);

    const service = read('src/Services/PatientAccessOnsiteService.php');
    for (const anchor of [
        'public function saveCredentials(', 'new PortalCredentialsUpdatedEvent($pid)',
        '(new AuthHash())->passwordHash($clear_pass)', 'sqlStatementNoLog("UPDATE patient_access_onsite',
        'sqlStatementNoLog("INSERT INTO patient_access_onsite', 'public function sendCredentialsEmail(',
        'return $this->twig->render($templateName, $paramData);',
        'public function getOnsiteCredentialsForPid($pid)', 'public function getRandomPortalPassword(): string',
    ]) expect(service).toContain(anchor);

    const card = read('src/Patient/Cards/PortalCard.php');
    expect(card).toContain('"/interface/patient_file/summary/create_portallogin.php"');
    const portal = read('templates/patient/partials/portal.html.twig');
    expect(portal).toContain('href="{{ portalLoginHref|attr }}?patient={{ pid|attr_url }}" class="btn btn-link btn-sm w-50 small_modal"');
    const demographics = read('interface/patient_file/summary/demographics.php');
    expect(demographics).toContain('$(".small_modal").on(\'click\', function (e) {');
    expect(demographics).toContain("dlgopen('', '', 550, 550, '', '', {");
    const legacy = read('interface/patient_file/erx_patient_portal_js.php');
    expect(legacy).toContain("dlgopen('', '', 380, 200, '', '', {");
    const popup = read('interface/clinical-workspace/popup.js');
    expect(popup).toContain("const CONTEXT_CLASS = 'oe-workbench-context';");
    expect(popup).toContain("const SHELL_ROOT = '#mainBox [data-workbench-mode]';");
    expect(popup).toContain("body.classList.contains('workbench-active')");
    const popupCss = read('interface/clinical-workspace/popup.css');
    expect(popupCss).toContain('--oe-wb-ink: #17343b;');
    expect(popupCss).toContain('--oe-wb-paper: #fff;');
    expect(popupCss).toContain('--oe-wb-petrol: #086878;');
});
