'use strict';

// Source-only contract: no PHP, browser, requests, or clinical action is run here.
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '../..');
const base = '09b29da7771aea334ed5745e058751157af980d7';
const route = 'interface/forms/CAMOS/help.html';
const fixture = 'tests/clinical-ui/fixtures/camos-help-original.html.txt';
const caller = 'interface/forms/CAMOS/new.php';
const sharedCss = 'interface/forms/CAMOS/CAMOS.css';
const contract = 'tests/clinical-ui/camos-help-contract.cjs';
const adapter = 'tests/js/camos-help.test.js';
const docs = 'docs/clinical-ui/CAMOS-HELP.md';
const read = file => readFileSync(path.join(root, file));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const original = read(fixture);
const plain = original.toString('utf8');
const protectedHashes = {
    [caller]: 'fd0d13f5b8926dc1e7dac37e0bc9c1993099a4be670675c0f38594187538eb9d',
    [sharedCss]: '298673736f331374d21a69a19c922ef97f4abe037a58727e14ccc19069bb46ab'
};

// These fixed values come from the default tokens in clinical-workspace/popup.css.
// Static CAMOS help has no bootstrap that supplies those variables.
const scope = 'body.oe-camos-help-screen';
const rules = [
    [scope, [['background-color', '#f3f7f5'], ['color', '#17343b']]],
    [scope + ' #myheader', [['background-color', '#fff'], ['color', '#17343b']]],
    [scope + ' #mymenu', [['background-color', '#fff'], ['color', '#17343b']]],
    [scope + ' h1,\n  ' + scope + ' h3', [['background-color', '#fff'], ['color', '#17343b']]],
    [scope + ' .box', [['background-color', '#fff'], ['color', '#17343b'], ['border-color', '#d9e4e2']]],
    [scope + ' a:link,\n  ' + scope + ' a:visited', [['background-color', '#fff'], ['color', '#086878']]],
    [scope + ' a:hover', [['background-color', '#f3f7f5'], ['color', '#17343b']]],
    [scope + ' a:focus-visible', [['outline-color', '#086878']]]
];
const ruleText = ([selector, declarations]) => '  ' + selector + ' {\n' +
    declarations.map(([property, value]) => '    ' + property + ': ' + value + ';').join('\n') + '\n  }';
const style = '<style>\n@media screen {\n' + rules.map(ruleText).join('\n\n') + '\n}\n</style>\n';
const headEnd = '</head>';
const oldBody = '<body>';
const newBody = "<body class='oe-camos-help-screen'>";
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
    assert.equal(count(source, style), 1, 'exact single style block');
    assert.equal(count(source, '<style>'), 1);
    assert.equal(count(source, '</style>'), 1);
    assert.equal(count(source, '@media screen {'), 1);
    assert.equal(count(source, newBody), 1, 'exact single body marker');
    assert.equal(source, candidate, 'all original bytes and only the two additions must match');
    const restored = source.replace(style, '').replace(newBody, oldBody);
    assert.deepEqual(Buffer.from(restored, 'utf8'), original, 'full original source restored');
}

test('fixture freezes complete original help and exact addition seams', () => {
    assert.equal(original.length, 13004);
    assert.equal(sha(original), '2cb4c54fd566cf22456d2f4c6c252210adac6641355848271abc8dbf7df26b69');
    assert.equal(count(plain, headEnd), 1);
    assert.equal(count(plain, oldBody), 1);
    assert.equal(count(plain, '<style>'), 0);
    assert.equal(count(plain, '<script'), 0);
    assert.equal(count(plain, '<form'), 0);
});

test('caller and CAMOS.css stay byte-identical, and actual route is named encounter help', () => {
    for (const [file, hash] of Object.entries(protectedHashes)) assert.equal(sha(read(file)), hash, file);
    const php = read(caller).toString('utf8');
    const css = read(sharedCss).toString('utf8');
    assert.match(php, /\/interface\/forms\/CAMOS\/help\.html' target='new'/);
    assert.match(php, /if \(!\$out_of_encounter\) \{ \/\/do not do stuff that is encounter specific if not in an encounter/);
    for (const selector of ['body {', '#myheader {', '#mymenu {', '.box {', 'a:link,\na:visited {', 'a:hover {']) {
        assert.ok(css.includes(selector), selector);
    }
    assert.ok(css.includes('border: 1px solid #0f0;'));
    assert.ok(css.includes('h1 {'));
});

test('synthetic candidate has exactly eight screen rules with complete palette pairs', () => {
    checkCandidate(candidate);
    assert.equal(rules.length, 8);
    assert.deepEqual(rules.map(([, declarations]) => declarations.length), [2, 2, 2, 2, 3, 2, 2, 1]);
    assert.equal(count(style, '!important'), 0);
    assert.equal(count(style, '@media'), 1);
    assert.equal(count(style, scope), 10);
    assert.doesNotMatch(style, /\b(?:font|padding|margin|width|height|display|visibility|position|outline-width|outline-style)\s*:/);
});

test('verifier rejects original-byte changes, seams, scope, palette and behavior additions', () => {
    const mutants = {
        missingStyle: s => replaceAnchor(s, style, ''),
        duplicateStyle: s => replaceAnchor(s, style, style + style),
        movedStyle: s => replaceAnchor(replaceAnchor(s, style + headEnd, headEnd), newBody, style + newBody),
        missingMarker: s => replaceAnchor(s, newBody, oldBody),
        duplicateMarker: s => replaceAnchor(s, newBody, newBody + newBody),
        broadMarker: s => replaceAnchor(s, newBody, "<body class='oe-camos-help-screen other'>"),
        allMedia: s => replaceAnchor(s, '@media screen {', '@media all {'),
        printMedia: s => replaceAnchor(s, '@media screen {', '@media print {'),
        escapedSelector: s => replaceAnchor(s, scope + ' .box', '.box'),
        escapedHeading: s => replaceAnchor(s, scope + ' h3 {', 'h3 {'),
        escapedVisited: s => replaceAnchor(s, scope + ' a:visited {', 'a:visited {'),
        unpairedBody: s => replaceAnchor(s, '    color: #17343b;\n  }', '  }', 5),
        wrongInk: s => replaceAnchor(s, 'color: #17343b;', 'color: #000;', 6),
        wrongPetrol: s => replaceAnchor(s, 'color: #086878;', 'color: #6a5acd;', 1),
        font: s => replaceAnchor(s, '    background-color: #f3f7f5;', '    font-family: Arial;\n    background-color: #f3f7f5;', 2),
        geometry: s => replaceAnchor(s, '    border-color: #d9e4e2;', '    border-width: 2px;\n    border-color: #d9e4e2;'),
        display: s => replaceAnchor(s, '    outline-color: #086878;', '    display: block;\n    outline-color: #086878;'),
        important: s => replaceAnchor(s, '    outline-color: #086878;', '    outline-color: #086878 !important;'),
        warning: s => replaceAnchor(s, 'WARNING: The CAMOS form has been tested', 'NOTE: The CAMOS form has been tested'),
        medicalProse: s => replaceAnchor(s, 'The included data may be incorrect', 'The included data is correct'),
        signature: s => replaceAnchor(s, 'name it sig.jpg in the CAMOS directory', 'name it signature.jpg in the CAMOS directory'),
        malformedAnchor: s => replaceAnchor(s, "<a name='rx'>", "<a id='rx'>"),
        adminUrl: s => replaceAnchor(s, 'href="./admin.php" target=_new', 'href="./other.php" target=_new'),
        newPhp: s => replaceAnchor(s, headEnd, '<?php echo 1; ?>\n' + headEnd),
        newScript: s => replaceAnchor(s, headEnd, '<script>fetch("/")</script>\n' + headEnd),
        newForm: s => replaceAnchor(s, headEnd, '<form action="/save"></form>\n' + headEnd),
        newRequest: s => replaceAnchor(s, headEnd, '<link rel="preload" href="/request">\n' + headEnd)
    };
    rules.forEach((rule, index) => {
        const fullRule = ruleText(rule);
        mutants['selector' + index] = s => replaceAnchor(s, fullRule, fullRule.replace(rule[0], rule[0] + ' .other'));
        rule[1].forEach(([property, value], declaration) => {
            mutants['declaration' + index + '_' + declaration] = s => replaceAnchor(s, fullRule,
                fullRule.replace('    ' + property + ': ' + value + ';', '    ' + property + ': changed;'));
        });
    });
    for (const [name, mutate] of Object.entries(mutants)) {
        const changed = mutate(candidate); // Assert anchors and changed bytes before rejection.
        assert.notEqual(changed, candidate, name);
        assert.throws(() => checkCandidate(changed), assert.AssertionError, name);
    }
    for (const index of [0, 1, 34, 129, Math.floor(plain.length / 2), plain.length - 2]) {
        const altered = plain.slice(0, index) + (plain[index] === 'X' ? 'Y' : 'X') + plain.slice(index + 1);
        assert.notEqual(altered, plain);
        const changed = replaceAnchor(replaceAnchor(altered, headEnd, style + headEnd), oldBody, newBody);
        assert.throws(() => checkCandidate(changed), assert.AssertionError, 'original byte ' + index);
    }
});

test('live CAMOS help has the exact two-addition candidate', () => {
    checkCandidate(read(route).toString('utf8')); // Deliberately RED on the untouched help page.
});

if (process.argv.includes('--history')) {
    test('local Git history authenticates fixture, protected sources and five-path scope', () => {
        const git = args => execFileSync('git', args, { cwd: root });
        assert.equal(path.resolve(git(['rev-parse', '--show-toplevel']).toString().trim()), root);
        assert.equal(git(['rev-parse', base]).toString().trim(), base);
        assert.deepEqual(original, git(['show', base + ':' + route]));
        for (const file of Object.keys(protectedHashes)) assert.deepEqual(read(file), git(['show', base + ':' + file]), file);
        const names = args => git(args).toString().split('\0').filter(Boolean);
        const changed = new Set([
            ...names(['diff', '--no-renames', '--name-only', '-z', base, 'HEAD']),
            ...names(['diff', '--no-renames', '--name-only', '-z', 'HEAD']),
            ...names(['diff', '--no-renames', '--cached', '--name-only', '-z']),
            ...names(['ls-files', '--others', '--exclude-standard', '-z'])
        ]);
        const allowed = new Set([route, fixture, contract, adapter, docs]);
        assert.deepEqual([...changed].filter(file => !allowed.has(file)), [], 'only five scoped paths may change');
    });
}
