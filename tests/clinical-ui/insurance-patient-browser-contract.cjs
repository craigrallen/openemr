'use strict';

// Source-only contract. It does not execute PHP or claim rendered/clinical behavior.
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '../..');
const base = '09b29da7771aea334ed5745e058751157af980d7';
const route = 'interface/patient_file/summary/browse.php';
const fixture = 'tests/clinical-ui/fixtures/insurance-patient-browser-original.php.txt';
const read = file => readFileSync(path.join(root, file));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const original = read(fixture);
const plain = original.toString('utf8');
const protectedHashes = {
    'interface/new/new_comprehensive.php': '8e349a5a7936d31ba63bc5c793dd1c62a1b4282c98bdbdb5a4e2e73e13664fe7',
    'library/dialog.js': 'f9f06fdb1297296cab38cda00f898d12a6a11330c26471e922b02cf624b6a17c',
    'interface/clinical-workspace/popup.js': 'af967e78fef59e75d2a5a5c4e08916bbea90a7f108c67f3def027b3061dc330f',
    'interface/clinical-workspace/popup.css': 'ea56e9f26990e843219a68f315c188f7e2b0581c20321bac4517dc4ba34e79a9',
    'src/Core/Header.php': 'dee3fd5f35bfd900ed119ae45981142ed737dac48059e54cacb4af843d6d264d',
    'config/config.yaml': '5f99c981f570a2f94917d68a4abcedf086eb75a102364bf71f1cb44ccfe461b7',
    'interface/themes/color_base.scss': 'f13d802ca97933d243c67a4474c994db7471e08913a3b8da694d8d953d8325d7'
};
const scope = 'html.oe-workbench-context body.oe-insurance-patient-browser';
const ink = 'var(--oe-wb-ink, #17343b)';
const paper = 'var(--oe-wb-paper, #fff)';
const canvas = 'var(--oe-wb-canvas, #f3f7f5)';
const line = 'var(--oe-wb-line, #d9e4e2)';
const petrol = 'var(--oe-wb-petrol, #086878)';
const rules = [
    [scope, [['background-color', canvas + ' !important'], ['color', ink]]],
    [scope + ' .title', [['color', ink]]],
    [scope + ' .bold', [['color', ink]]],
    [scope + ' span.text', [['color', ink]]],
    [scope + ' > table.table', [['background-color', paper], ['color', ink], ['border-color', line]]],
    [scope + ' > table.table th,\n  ' + scope + ' > table.table td',
        [['background-color', paper], ['color', ink], ['border-color', line]]],
    [scope + ' > table.table a.text,\n  ' + scope + ' > table.table a.text:visited',
        [['background-color', paper], ['color', petrol]]],
    [scope + ' :focus-visible', [['outline-color', petrol]]]
];
const renderRule = ([selector, declarations]) => '  ' + selector + ' {\n' +
    declarations.map(([property, value]) => '    ' + property + ': ' + value + ';').join('\n') + '\n  }';
const style = '    <style>\n@media screen {\n' + rules.map(renderRule).join('\n\n') + '\n}\n    </style>\n';
const headEnd = '</head>';
const oldBody = '<body class="body_top">';
const newBody = '<body class="body_top oe-insurance-patient-browser">';
const count = (source, needle) => source.split(needle).length - 1;
function replaceAnchor(source, anchor, replacement, occurrences = 1) {
    assert.equal(count(source, anchor), occurrences, 'unique mutation anchor: ' + anchor);
    assert.notEqual(anchor, replacement);
    const changed = source.split(anchor).join(replacement);
    assert.notEqual(changed, source);
    return changed;
}
const candidate = replaceAnchor(replaceAnchor(plain, headEnd, style + headEnd), oldBody, newBody);

function checkCandidate(source) {
    assert.equal(count(source, style), 1, 'one exact inline style');
    assert.equal(count(source, style + headEnd), 1, 'style immediately before head end');
    assert.equal(count(source, '<style>'), count(plain, '<style>') + 1);
    assert.equal(count(source, '</style>'), count(plain, '</style>') + 1);
    assert.equal(count(source, '@media screen {'), count(plain, '@media screen {') + 1);
    assert.equal(count(source, newBody), 1, 'one exact body marker');
    assert.equal(count(source, oldBody), 0);
    assert.equal(count(source, '!important'), count(plain, '!important') + 1);
    // This inverse check is part of the verifier itself: any altered original byte fails.
    const inverse = source.replace(style, '').replace(newBody, oldBody);
    assert.deepEqual(Buffer.from(inverse, 'utf8'), original, 'all original bytes must survive');
    assert.equal(source, candidate, 'only the two exact additions are allowed');
}

test('full authentic fixture and exact seams', () => {
    assert.equal(original.length, 20386);
    assert.equal(sha(original), '0e9364e5b5a4f83cd1fa725c5a93c00e5de656b6572520dfa090deadf7bc36a2');
    assert.equal(count(plain, headEnd), 1);
    assert.equal(count(plain, oldBody), 1);
    assert.equal(count(plain, '<style>'), 0);
    assert.equal(count(plain, '@media screen {'), 0);
    checkCandidate(candidate);
});

test('synthetic candidate has only paired screen palette rules and one necessary override', () => {
    checkCandidate(candidate);
    assert.equal(rules.length, 8);
    assert.equal(rules.flatMap(([, declarations]) => declarations).length, 14);
    assert.equal(rules.flatMap(([, declarations]) => declarations).filter(([, value]) => value.endsWith('!important')).length, 1);
    for (const [selector, declarations] of rules) {
        for (const part of selector.split(',\n  ')) assert.ok(part.startsWith(scope), part);
        for (const [property] of declarations) assert.ok(['background-color', 'color', 'border-color', 'outline-color'].includes(property));
    }
    assert.equal(count(style, '@media screen {'), 1);
    assert.doesNotMatch(style, /font-|padding|margin|width|height|display|visibility|opacity|background:|outline:/);
});

test('negative mutations all change a unique anchor before the full inverse verifier rejects them', () => {
    const mutations = {
        missingStyle: s => replaceAnchor(s, style, ''),
        duplicateStyle: s => replaceAnchor(s, style, style + style),
        movedStyle: s => replaceAnchor(replaceAnchor(s, style + headEnd, headEnd), newBody, style + newBody),
        missingMarker: s => replaceAnchor(s, newBody, oldBody),
        duplicateMarker: s => replaceAnchor(s, newBody, newBody + newBody),
        changedMarker: s => replaceAnchor(s, newBody, '<body class="oe-insurance-patient-browser body_top">'),
        printMedia: s => replaceAnchor(s, '@media screen {', '@media print {'),
        allMedia: s => replaceAnchor(s, '@media screen {', '@media all {'),
        noContext: s => replaceAnchor(s, 'html.oe-workbench-context', 'html', 10),
        noBodyRoute: s => replaceAnchor(s, 'body.oe-insurance-patient-browser', 'body', 10),
        descendantTable: s => replaceAnchor(s, '> table.table', 'table.table', 5),
        unpairedLink: s => replaceAnchor(s, 'background-color: ' + paper + ';\n    color: ' + petrol + ';', 'color: ' + petrol + ';'),
        buttonStyle: s => replaceAnchor(s, scope + ' :focus-visible', scope + ' .btn'),
        geometry: s => replaceAnchor(s, 'background-color: ' + canvas + ' !important;', 'padding: 1rem;\n    background-color: ' + canvas + ' !important;'),
        typography: s => replaceAnchor(s, 'color: ' + ink + ';', 'font-family: Arial;\n    color: ' + ink + ';', 6),
        visibility: s => replaceAnchor(s, 'outline-color: ' + petrol + ';', 'display: none;\n    outline-color: ' + petrol + ';'),
        extraImportant: s => replaceAnchor(s, '\n    color: ' + petrol + ';\n', '\n    color: ' + petrol + ' !important;\n'),
        missingImportant: s => replaceAnchor(s, canvas + ' !important', canvas),
        changedFallback: s => {
            const full = renderRule(rules[4]);
            return replaceAnchor(s, full, full.replace('    border-color: ' + line + ';',
                '    border-color: var(--oe-wb-line, #d9e4e3);'));
        },
        addedScript: s => replaceAnchor(s, headEnd, '<script>alert(1)</script>\n' + headEnd),
        form: s => replaceAnchor(s, 'name="find_patient"', 'name="find_person"'),
        insuranceForm: s => replaceAnchor(s, 'name="insurance_form"', 'name="other_form"'),
        csrf: s => replaceAnchor(s, 'CsrfUtils::collectCsrfToken(session: $session)', 'CsrfUtils::collectCsrfToken()', 2),
        csrfCheck: s => replaceAnchor(s, 'CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: true);', 'CsrfUtils::checkCsrfInput(INPUT_POST);'),
        search: s => replaceAnchor(s, '$findby = $_POST[\'findBy\'];', '$findby = $_GET[\'findBy\'];'),
        sqlHelper: s => replaceAnchor(s, 'getPatientSSN("$patient", "*")', 'getPatientId("$patient", "*")'),
        selectedPatient: s => replaceAnchor(s, "getPatientData($_GET['set_pid'])", "getPatientData($_POST['set_pid'])"),
        selectedInsurance: s => replaceAnchor(s, "getInsuranceData($_GET['set_pid'], $insurance)", "getInsuranceData($_GET['set_pid'], 'primary')"),
        session: s => replaceAnchor(s, 'SessionWrapperFactory::getInstance()->getActiveSession()', 'SessionWrapperFactory::getInstance()->getSession()'),
        postMessage: s => replaceAnchor(s, 'opener.postMessage(data, window.location.origin);', 'opener.postMessage(data, "*");'),
        copyValue: s => replaceAnchor(s, "subscriber_fname.value=<?php echo js_escape($result3['subscriber_fname']);?>;", "subscriber_fname.value='changed';"),
        browseUrl: s => replaceAnchor(s, 'browse.php?browsenum=', 'other.php?browsenum=', 22),
        close: s => replaceAnchor(s, 'href="javascript:window.close();"', 'href="#"'),
        translation: s => replaceAnchor(s, "xlt('Copy Values')", "xlt('Copy')", 2),
        malformedHtml: s => replaceAnchor(s, '<tr>\n<tr>', '<tr>'),
        ssMismatch: s => replaceAnchor(s, "xlt('SS')", "xlt('SSN')", 2),
        requestWarning: s => replaceAnchor(s, "$_POST['findBy']", "$_POST['findBy'] ?? ''")
    };
    rules.forEach((rule, index) => {
        const full = renderRule(rule);
        mutations['selector' + index] = s => replaceAnchor(s, full, full.replace(rule[0], rule[0] + ' .changed'));
        rule[1].forEach(([property, value], declaration) => {
            mutations['declaration' + index + '_' + declaration] = s => replaceAnchor(s, full,
                full.replace('    ' + property + ': ' + value + ';', '    ' + property + ': changed;'));
        });
    });
    for (const [name, mutate] of Object.entries(mutations)) {
        const mutant = mutate(candidate); // Outside assert.throws: missing/nonunique anchors fail the test.
        assert.notEqual(mutant, candidate, name);
        assert.throws(() => checkCandidate(mutant), assert.AssertionError, name);
    }
});

test('caller, window.open engine, shared popup and theme sources are pinned', () => {
    for (const [file, hash] of Object.entries(protectedHashes)) assert.equal(sha(read(file)), hash, file);
    const caller = read('interface/new/new_comprehensive.php').toString();
    const dialog = read('library/dialog.js').toString();
    const header = read('src/Core/Header.php').toString();
    const config = read('config/config.yaml').toString();
    const popup = read('interface/clinical-workspace/popup.js').toString();
    const css = read('interface/clinical-workspace/popup.css').toString();
    const theme = read('interface/themes/color_base.scss').toString();
    assert.match(caller, /javascript:popUp\('\.\.\/\.\.\/interface\/patient_file\/summary\/browse\.php\?browsenum=<\?php echo attr_url\(\$i\); \?>'\)/);
    assert.match(dialog, /function popUp\( url, data, name, width, height\)/);
    assert.match(dialog, /window\.open\('', name, options, true\)/);
    assert.match(header, /setupAssets\(is_array\(\$assets\) \? \$assets : \[\$assets\], true\)/);
    assert.match(config, /workbench-popup:[\s\S]*?script: popup\.js[\s\S]*?link: popup\.css[\s\S]*?autoload: true/);
    assert.match(popup, /const CONTEXT_CLASS = 'oe-workbench-context'/);
    assert.match(popup, /const POPUP_CLASS = 'oe-workbench-popup'/);
    for (const [token, value] of [['ink', '#17343b'], ['paper', '#fff'], ['canvas', '#f3f7f5'], ['line', '#d9e4e2'], ['petrol', '#086878']])
        assert.ok(css.includes('--oe-wb-' + token + ': ' + value + ';'), token);
    assert.match(theme, /\.body_top,\s*\.bgcolor2,\s*\.body_nav \{\s*background-color: \$paler !important;/);
});

test('original search, selection and direct copy source remains byte frozen', () => {
    for (const phrase of [
        'Header::setupHeader([\'datetime-picker\', \'opener\'])',
        'CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: true)',
        "$_REQUEST['browsenum']", "$_POST['findBy']", "$_POST['patient']",
        'getPatientLnames(', 'getPatientId(', 'getPatientDOB(', 'getPatientSSN(',
        'opener.postMessage(data, window.location.origin);', 'opener.document.demographics_form',
        "subscriber_fname.value=<?php echo js_escape($result3['subscriber_fname']);?>;",
        'javascript:auto_populate_employer_address();', 'javascript:window.close();',
        "xlt('SSN')", "xlt('SS')", '<tr>\n<tr>'
    ]) assert.ok(plain.includes(phrase), phrase);
    assert.equal(count(plain, 'CsrfUtils::collectCsrfToken(session: $session)'), 2);
    checkCandidate(candidate);
});

test('live browser requires exact palette additions (RED on untouched production)', () => {
    const live = read(route).toString('utf8');
    assert.notEqual(live, plain, 'expected RED until production phase');
    checkCandidate(live);
});

if (process.argv.includes('--history')) {
    test('history authenticates full fixture, protected files and all five allowed paths', () => {
        const git = args => execFileSync('git', args, { cwd: root });
        assert.equal(git(['rev-parse', base]).toString().trim(), base);
        assert.deepEqual(original, git(['show', base + ':' + route]));
        for (const file of Object.keys(protectedHashes)) assert.deepEqual(read(file), git(['show', base + ':' + file]), file);
        const names = args => git(args).toString().split('\0').filter(Boolean);
        const all = new Set([
            ...names(['diff', '--no-renames', '--name-only', '-z', base, 'HEAD']),
            ...names(['diff', '--no-renames', '--name-only', '-z', 'HEAD']),
            ...names(['diff', '--no-renames', '--cached', '--name-only', '-z']),
            ...names(['ls-files', '--others', '--exclude-standard', '-z'])
        ]);
        const allowed = new Set([route, fixture, 'tests/clinical-ui/insurance-patient-browser-contract.cjs',
            'tests/js/insurance-patient-browser.test.js', 'docs/clinical-ui/INSURANCE-PATIENT-BROWSER.md']);
        for (const file of all) assert.ok(allowed.has(file), 'out-of-scope change: ' + file);
    });
}
