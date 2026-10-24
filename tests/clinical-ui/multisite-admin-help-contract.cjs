'use strict';

// Source-only contract. Never execute PHP, the browser, requests, or admin/setup.
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '../..');
const base = '09b29da7771aea334ed5745e058751157af980d7';
const route = 'Documentation/help_files/openemr_multisite_admin_help.php';
const fixture = 'tests/clinical-ui/fixtures/multisite-admin-help-original.php.txt';
const contract = 'tests/clinical-ui/multisite-admin-help-contract.cjs';
const adapter = 'tests/js/multisite-admin-help.test.js';
const docs = 'docs/clinical-ui/MULTISITE-ADMIN-HELP.md';
const caller = 'admin.php';
const palette = 'interface/clinical-workspace/popup.css';
const read = file => readFileSync(path.join(root, file));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const original = read(fixture);
const plain = original.toString('utf8');
const protectedHashes = {
    [caller]: '677007e3ae598ef736ffa3e8357bc87b2487b4eeded04df2546c2313d128faaa',
    [palette]: 'ea56e9f26990e843219a68f315c188f7e2b0581c20321bac4517dc4ba34e79a9'
};

// Fixed defaults from popup.css. This help document has no workbench token activation.
const style = `    <style>
@media screen {
  body.oe-multisite-admin-help-screen {
    background-color: #f3f7f5;
    color: #17343b;
  }

  body.oe-multisite-admin-help-screen .oe-help-container {
    background-color: #fff;
    color: #17343b;
  }

  body.oe-multisite-admin-help-screen h2 {
    background-color: #fff;
    color: #17343b;
  }

  body.oe-multisite-admin-help-screen a:link,
  body.oe-multisite-admin-help-screen a:visited {
    background-color: #fff;
    color: #086878;
  }

  body.oe-multisite-admin-help-screen a:hover {
    background-color: #f3f7f5;
    color: #17343b;
  }

  body.oe-multisite-admin-help-screen a:focus-visible {
    outline-color: #086878;
  }
}
    </style>
`;
const headEnd = '    </head>';
const oldBody = '   <body>';
const newBody = '   <body class="oe-multisite-admin-help-screen">';
const count = (source, needle) => source.split(needle).length - 1;
function replaceAnchor(source, anchor, replacement) {
    assert.equal(count(source, anchor), 1, 'unique mutation anchor: ' + anchor);
    assert.notEqual(anchor, replacement);
    const changed = source.replace(anchor, replacement);
    assert.notEqual(changed, source);
    return changed;
}
const candidate = replaceAnchor(replaceAnchor(plain, headEnd, style + headEnd), oldBody, newBody);

function checkCandidate(source) {
    assert.equal(count(source, style), 1, 'one exact added screen style');
    assert.equal(count(source, '<style>'), 2, 'original responsive style plus one added style');
    assert.equal(count(source, '</style>'), 2);
    assert.equal(count(source, '@media screen {'), 1);
    assert.equal(count(source, newBody), 1);
    assert.equal(source, candidate, 'only the exact two additions are allowed');
    assert.deepEqual(Buffer.from(source.replace(style, '').replace(newBody, oldBody), 'utf8'), original,
        'full original source must be restored byte for byte');
}

function checkProtected(callerBytes, paletteBytes) {
    assert.equal(sha(callerBytes), protectedHashes[caller], caller);
    assert.equal(sha(paletteBytes), protectedHashes[palette], palette);
    const admin = callerBytes.toString('utf8');
    const css = paletteBytes.toString('utf8');
    for (const token of [
        'id="help-href" name="help-href"',
        'data-target="#myModal" data-toggle="modal"',
        'id="myModal"',
        'id="targetiframe"',
        'document.getElementById(\'targetiframe\').src = "Documentation/help_files/openemr_multisite_admin_help.php";',
        '$("#targetiframe").get(0).contentWindow.print();'
    ]) assert.ok(admin.includes(token), 'modal-frame caller token: ' + token);
    for (const token of [
        '--oe-wb-ink: #17343b;', '--oe-wb-paper: #fff;',
        '--oe-wb-canvas: #f3f7f5;', '--oe-wb-petrol: #086878;'
    ]) assert.ok(css.includes(token), 'palette default: ' + token);
}

test('fixture freezes the complete 6044-byte original and exact insertion seams', () => {
    assert.equal(original.length, 6044);
    assert.equal(sha(original), '3db102e54410df445b09dae1f5a1c77b2db206f834650b1de4943ba479108978');
    assert.equal(count(plain, headEnd), 1);
    assert.equal(count(plain, oldBody), 1);
    assert.equal(count(plain, '<style>'), 1);
    assert.equal(count(plain, '<script'), 5);
    assert.ok(plain.includes("<h2 class=\"text-center\"><a name='entire_doc'>"));
    assert.ok(plain.includes('href="../../public/themes/style_light.css"'));
});

test('admin modal-frame caller and palette source are byte-pinned', () => {
    checkProtected(read(caller), read(palette));
});

test('synthetic candidate satisfies the exact screen palette and restoration contract', () => {
    checkCandidate(candidate);
    assert.equal(count(style, 'body.oe-multisite-admin-help-screen'), 7);
    assert.equal(count(style, 'background-color:'), 5);
    assert.equal(count(style, '    color:'), 5);
    assert.equal(count(style, 'outline-color:'), 1);
    assert.equal(count(style, '!important'), 0);
    assert.equal(count(style, '@media'), 1);
    assert.doesNotMatch(style, /\b(?:font|margin|padding|width|height|display|visibility|border-width|outline-width|outline-style)\s*:/);
});

test('verifier rejects style, scope, palette, original content and caller mutants', () => {
    const mutants = {
        missingStyle: s => replaceAnchor(s, style, ''),
        duplicateStyle: s => replaceAnchor(s, style, style + style),
        movedStyle: s => replaceAnchor(replaceAnchor(s, style + headEnd, headEnd), newBody, style + newBody),
        missingMarker: s => replaceAnchor(s, newBody, oldBody),
        duplicateMarker: s => replaceAnchor(s, newBody, newBody + newBody),
        wrongSeam: s => replaceAnchor(s, style + headEnd, headEnd + style),
        printMedia: s => replaceAnchor(s, '@media screen {', '@media print {'),
        allMedia: s => replaceAnchor(s, '@media screen {', '@media all {'),
        unscopedBody: s => replaceAnchor(s, 'body.oe-multisite-admin-help-screen {', 'body {'),
        unscopedContainer: s => replaceAnchor(s, 'body.oe-multisite-admin-help-screen .oe-help-container', '.oe-help-container'),
        unscopedHeading: s => replaceAnchor(s, 'body.oe-multisite-admin-help-screen h2', 'h2'),
        unscopedVisited: s => replaceAnchor(s, 'body.oe-multisite-admin-help-screen a:visited', 'a:visited'),
        unscopedFocus: s => replaceAnchor(s, 'body.oe-multisite-admin-help-screen a:focus-visible', 'a:focus-visible'),
        unpairedBody: s => replaceAnchor(s, 'body.oe-multisite-admin-help-screen {\n    background-color: #f3f7f5;\n    color: #17343b;\n  }', 'body.oe-multisite-admin-help-screen {\n    background-color: #f3f7f5;\n  }'),
        unpairedLink: s => replaceAnchor(s, '    background-color: #fff;\n    color: #086878;', '    color: #086878;'),
        wrongInk: s => replaceAnchor(s, 'body.oe-multisite-admin-help-screen {\n    background-color: #f3f7f5;\n    color: #17343b;\n  }', 'body.oe-multisite-admin-help-screen {\n    background-color: #f3f7f5;\n    color: #000;\n  }'),
        wrongPaper: s => replaceAnchor(s, 'body.oe-multisite-admin-help-screen h2 {\n    background-color: #fff;', 'body.oe-multisite-admin-help-screen h2 {\n    background-color: #eee;'),
        wrongPetrol: s => replaceAnchor(s, '    outline-color: #086878;', '    outline-color: #6a5acd;'),
        font: s => replaceAnchor(s, '    outline-color: #086878;', '    font-family: Arial;\n    outline-color: #086878;'),
        geometry: s => replaceAnchor(s, '    outline-color: #086878;', '    margin: 1rem;\n    outline-color: #086878;'),
        visibility: s => replaceAnchor(s, '    outline-color: #086878;', '    display: none;\n    outline-color: #086878;'),
        borderWidth: s => replaceAnchor(s, '    outline-color: #086878;', '    border-width: 2px;\n    outline-color: #086878;'),
        important: s => replaceAnchor(s, '    outline-color: #086878;', '    outline-color: #086878 !important;'),
        script: s => replaceAnchor(s, '// better script for tackling nested divs', '// changed script for tackling nested divs'),
        newScript: s => replaceAnchor(s, style + headEnd, style + '<script>fetch("/")</script>\n' + headEnd),
        prose: s => replaceAnchor(s, 'This is the central location to manage multisite installations', 'This is the new location to manage multisite installations'),
        historicalProse: s => replaceAnchor(s, 'Whether on not the the site\'s installed database', 'Whether or not the site\'s installed database'),
        translation: s => replaceAnchor(s, '<?php echo ("Multi Site Administration Help");?>', '<?php echo xlt("Multi Site Administration Help");?>'),
        namedAnchor: s => replaceAnchor(s, "<a name='entire_doc'>", "<a href='#entire_doc'>"),
        asset: s => replaceAnchor(s, '../../public/themes/style_light.css', '../../public/themes/style_dark.css'),
        responsiveness: s => replaceAnchor(s, 'max-width: 768px', 'max-width: 800px'),
        php: s => replaceAnchor(s, style + headEnd, style + '<?php echo 1; ?>\n' + headEnd)
    };
    for (const [name, mutate] of Object.entries(mutants)) {
        const changed = mutate(candidate); // Anchor uniqueness and changed bytes checked outside assert.throws.
        assert.notEqual(changed, candidate, name);
        assert.throws(() => checkCandidate(changed), assert.AssertionError, name);
    }
    for (const index of [0, 1, 34, 129, Math.floor(plain.length / 2), plain.length - 2]) {
        const altered = plain.slice(0, index) + (plain[index] === 'X' ? 'Y' : 'X') + plain.slice(index + 1);
        assert.notEqual(altered, plain);
        const changed = replaceAnchor(replaceAnchor(altered, headEnd, style + headEnd), oldBody, newBody);
        assert.throws(() => checkCandidate(changed), assert.AssertionError, 'original byte ' + index);
    }
    const admin = read(caller).toString('utf8');
    const changedCaller = replaceAnchor(admin, '$("#targetiframe").get(0).contentWindow.print();', 'window.print();');
    assert.notEqual(changedCaller, admin);
    assert.throws(() => checkProtected(Buffer.from(changedCaller), read(palette)), assert.AssertionError, 'print caller');
});

test('live multisite admin help has the exact two-addition candidate', () => {
    checkCandidate(read(route).toString('utf8')); // Deliberately RED until the separate production phase.
});

if (process.argv.includes('--history')) {
    test('local Git history authenticates fixture and all five final scope paths', () => {
        const git = args => execFileSync('git', args, { cwd: root });
        assert.equal(path.resolve(git(['rev-parse', '--show-toplevel']).toString().trim()), root);
        assert.equal(git(['rev-parse', base]).toString().trim(), base);
        assert.deepEqual(original, git(['show', base + ':' + route]));
        for (const file of Object.keys(protectedHashes)) assert.deepEqual(read(file), git(['show', base + ':' + file]), file);
        const names = args => git(args).toString('utf8').split('\0').filter(Boolean);
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
