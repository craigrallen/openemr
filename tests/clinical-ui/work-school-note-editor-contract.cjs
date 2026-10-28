'use strict';

// Portable: node --test-reporter=tap tests/clinical-ui/work-school-note-editor-contract.cjs
// History:  node --test-reporter=tap tests/clinical-ui/work-school-note-editor-contract.cjs --history
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { test } = require('node:test');

const root = path.resolve(__dirname, '../..');
const BASE = '09b29da7771aea334ed5745e058751157af980d7';
const routes = {
    new: {
        source: 'interface/forms/note/new.php',
        fixture: 'tests/clinical-ui/fixtures/work-school-note-new-original.php.txt',
        hash: 'a4349012cf7f7538584f8b90d9a483aec0b73bbe5ac66c11a949faa31b892579',
        header: "    <?php Header::setupHeader('datetime-picker'); ?>",
        body: '<body>',
        form: '<form class="form" method=post action='
    },
    view: {
        source: 'interface/forms/note/view.php',
        fixture: 'tests/clinical-ui/fixtures/work-school-note-view-original.php.txt',
        hash: '27e3074478a8c7f0d73d5b2489a7b5574d2ac69ea3c67c3e62dbed669578bb44',
        header: "<?php Header::setupHeader('datetime-picker'); ?>",
        body: '<body class="body_top">',
        form: '<form method=post action='
    }
};

// Literal insertion after Header::setupHeader on both routes. No print rule is added.
const CSS = `<style>
@media screen {
  html.oe-workbench-context body.oe-work-school-note-editor {
    margin: 0;
    background-color: #edf2f3 !important;
    color: #182c36;
  }

  html.oe-workbench-context body.oe-work-school-note-editor .container,
  html.oe-workbench-context body.oe-work-school-note-editor .oe-work-school-note-form {
    box-sizing: border-box;
    width: 100%;
    max-width: 860px;
    margin-inline: auto;
    background-color: #fff;
    color: #182c36;
  }

  html.oe-workbench-context body.oe-work-school-note-editor .container {
    margin-block: 1.5rem;
    padding-block: 1.5rem;
    padding-inline: clamp(1rem, 4vw, 2.25rem);
    border: 1px solid #cbd6da;
    border-radius: 7px;
  }

  html.oe-workbench-context body.oe-work-school-note-editor .container .row {
    box-sizing: border-box;
    width: 100%;
    margin-inline: 0;
  }

  html.oe-workbench-context body.oe-work-school-note-editor .container .col-sm-12 {
    min-width: 0;
    padding-inline: 0;
  }

  html.oe-workbench-context body.oe-work-school-note-editor .container .mt-5 {
    margin-block-start: 0 !important;
  }

  html.oe-workbench-context body.oe-work-school-note-editor .oe-work-school-note-form {
    margin-block: 1.5rem;
    padding-block: 1.5rem;
    padding-inline: clamp(1rem, 4vw, 2.25rem);
    border: 1px solid #cbd6da;
    border-radius: 7px;
  }

  html.oe-workbench-context body.oe-work-school-note-editor .container .oe-work-school-note-form {
    margin-block: 1rem 0;
    padding: 0;
    border: 0;
  }

  html.oe-workbench-context body.oe-work-school-note-editor h1,
  html.oe-workbench-context body.oe-work-school-note-editor .oe-work-school-note-form > .title {
    display: block;
    margin-block: 0 0.75rem;
    color: #182c36;
    font-size: 1.5rem;
    font-weight: 700;
    line-height: 1.3;
  }

  html.oe-workbench-context body.oe-work-school-note-editor .oe-work-school-note-form > div[style] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 0.75rem;
    padding-block: 0.75rem;
    border-block-start: 1px solid #cbd6da;
  }

  html.oe-workbench-context body.oe-work-school-note-editor .oe-work-school-note-form > select,
  html.oe-workbench-context body.oe-work-school-note-editor .oe-work-school-note-form > textarea {
    display: block;
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    padding-block: 0.65rem;
    padding-inline: 0.75rem;
    border: 1px solid #a9bbc3;
    border-radius: 4px;
    background-color: #fff;
    color: #182c36;
    font: inherit;
  }

  html.oe-workbench-context body.oe-work-school-note-editor .oe-work-school-note-form > textarea {
    min-height: 12rem;
    line-height: 1.7;
    overflow-wrap: break-word;
    resize: vertical;
  }

  html.oe-workbench-context body.oe-work-school-note-editor .oe-work-school-note-form > b {
    color: #182c36;
    line-height: 1.5;
  }

  html.oe-workbench-context body.oe-work-school-note-editor .oe-work-school-note-form > table {
    display: block;
    box-sizing: border-box;
    width: 100%;
    border-collapse: separate;
    background-color: #fff;
    color: #182c36;
  }

  html.oe-workbench-context body.oe-work-school-note-editor .oe-work-school-note-form > table > tbody {
    display: block;
    width: 100%;
  }

  html.oe-workbench-context body.oe-work-school-note-editor .oe-work-school-note-form > table > tbody > tr {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem 1.5rem;
    width: 100%;
  }

  html.oe-workbench-context body.oe-work-school-note-editor .oe-work-school-note-form > table > tbody > tr > td {
    display: block;
    box-sizing: border-box;
    flex: 1 1 16rem;
    min-width: 0;
    padding: 0;
    border: 0;
    background-color: #fff;
    color: #182c36;
    white-space: normal;
  }

  html.oe-workbench-context body.oe-work-school-note-editor .oe-work-school-note-form > table input {
    display: block;
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    min-height: 2.5rem;
    padding-inline: 0.65rem;
    border: 1px solid #a9bbc3;
    border-radius: 4px;
    background-color: #fff;
    color: #182c36;
    font: inherit;
  }

  html.oe-workbench-context body.oe-work-school-note-editor .oe-work-school-note-form select:focus,
  html.oe-workbench-context body.oe-work-school-note-editor .oe-work-school-note-form textarea:focus,
  html.oe-workbench-context body.oe-work-school-note-editor .oe-work-school-note-form input[type='text']:focus {
    outline: 2px solid #216a91;
    outline-offset: 2px;
  }

  html.oe-workbench-context body.oe-work-school-note-editor .oe-work-school-note-form input[type='button'] {
    min-height: 2.5rem;
    padding-block: 0.5rem;
    padding-inline: 1rem;
  }
}
</style>`;

const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
function one(source, anchor, label) {
    assert.ok(anchor, `${label}: nonempty anchor`);
    assert.equal(source.split(anchor).length, 2, `${label}: unique anchor`);
}
function additions(route) {
    return [
        [route.header, `${route.header}\n${CSS}`],
        [route.body, route.body.replace('<body', '<body class="oe-work-school-note-editor"')
            .replace('class="oe-work-school-note-editor" class="body_top"', 'class="body_top oe-work-school-note-editor"')],
        [route.form, route.form.replace('<form ', '<form class="oe-work-school-note-form" ')
            .replace('class="oe-work-school-note-form" class="form"', 'class="form oe-work-school-note-form"')]
    ];
}
function proposed(original, route) {
    return additions(route).reduce((source, [before, after]) => {
        one(source, before, 'original seam');
        assert.notEqual(before, after);
        return source.replace(before, after);
    }, original);
}
function verifySource(source, original, route) {
    let inverse = source;
    for (const [before, after] of additions(route)) {
        one(inverse, after, 'complete exact addition');
        inverse = inverse.replace(after, before);
    }
    assert.equal(inverse, original, 'all original semantic and formatting bytes preserved');
}
function originalFor(route, history = false) {
    const original = read(route.fixture);
    assert.equal(hash(original), route.hash, 'frozen complete original SHA256');
    if (history) assert.equal(original, git('show', `${BASE}:${route.source}`), 'exact Git base blob');
    return original;
}
const history = process.argv.includes('--history');
assert.deepEqual(process.argv.slice(2).filter((arg) => arg !== '--history'), [], 'unknown option');
const allowed = new Set([
    ...Object.values(routes).flatMap((route) => [route.source, route.fixture]),
    'tests/clinical-ui/work-school-note-editor-contract.cjs',
    'tests/js/work-school-note-editor.test.js',
    'docs/clinical-ui/WORK-SCHOOL-NOTE-EDITOR.md'
]);
function checkScope(files) {
    for (const file of files) assert.ok(allowed.has(file), `out-of-scope changed path: ${file}`);
}

test('seven-path scope rejects outsiders', () => {
    assert.throws(() => checkScope([routes.new.source, 'interface/clinical-workspace/popup.css']), /out-of-scope/);
});
test('Header autoload supplies native workbench context', () => {
    assert.match(read('src/Core/Header.php'), /setupAssets\(is_array\(\$assets\) \? \$assets : \[\$assets\], true\)/);
    assert.match(read('config/config.yaml'), /workbench-popup:\s*\n\s*basePath:.*clinical-workspace.*\n\s*script: popup\.js\s*\n\s*link: popup\.css\s*\n\s*autoload: true/);
    const popup = read('interface/clinical-workspace/popup.js');
    assert.match(popup, /const CONTEXT_CLASS = 'oe-workbench-context'/);
    assert.match(popup, /set\(CONTEXT_CLASS, active\)/);
});
test('screen rule requires paper geometry, field width, wrapping and scoped focus', () => {
    assert.match(CSS, /^<style>\n@media screen \{/);
    assert.match(CSS, /html\.oe-workbench-context body\.oe-work-school-note-editor/);
    assert.match(CSS, /max-width: 860px;/);
    assert.match(CSS, /\.container \.row \{\n    box-sizing: border-box;\n    width: 100%;\n    margin-inline: 0;\n  \}/);
    assert.match(CSS, /\.oe-work-school-note-form > textarea \{[\s\S]*?min-height: 12rem;/);
    assert.match(CSS, /\.oe-work-school-note-form > table > tbody > tr \{[\s\S]*?flex-wrap: wrap;/);
    assert.match(CSS, /\.oe-work-school-note-form > div\[style\] \{[\s\S]*?flex-wrap: wrap;/);
    assert.match(CSS, /:focus \{\n    outline:/);
    assert.doesNotMatch(CSS, /@media print/);
});
for (const [name, route] of Object.entries(routes)) {
    test(`${name}: complete original fixture accepts exact proposed additions`, () => {
        const original = originalFor(route);
        verifySource(proposed(original, route), original, route);
    });
    test(`${name}: inverse rejects original and presentation mutations`, () => {
        const original = originalFor(route);
        const candidate = proposed(original, route);
        const mutations = [
            ['CsrfUtils::collectCsrfToken(session: $session)', 'CsrfUtils::otherToken(session: $session)'],
            ['name="note_type"', 'name="different_type"'],
            ['value="SCHOOL NOTE"', 'value="OTHER NOTE"'],
            ['name="message"', 'name="other_message"'],
            ["name='date_of_signature'", "name='other_date'"],
            ['$(".save").click(function()', '$(".other").click(function()'],
            ['$(".dontsave").click(function()', '$(".other").click(function()'],
            ['@media screen {', '@media print {'],
            ['html.oe-workbench-context body.oe-work-school-note-editor', 'html body.oe-work-school-note-editor'],
            ['max-width: 860px;', 'max-width: 1200px;'],
            ['flex-wrap: wrap;', 'flex-wrap: nowrap;'],
            ['</style>', 'body { display: none; }\n</style>'],
            ['</body>', '<div>unexpected</div>\n</body>']
        ];
        if (name === 'new') mutations.push(
            ['class="btn btn-primary save"', 'class="btn btn-primary other"'],
            ['attr($provider_results["fname"])', 'text($provider_results["fname"])']
        );
        if (name === 'view') mutations.push(
            ['EncounterFormAccess::assertFormBelongsToSessionPatient($formId, $form_name);', '// guard removed'],
            ['text($obj["message"])', 'attr($obj["message"])'],
            ['PrintForm();', 'void 0;'],
            ['$(".printform").click(function()', '$(".other").click(function()'],
            ['echo " SELECTED";', 'echo "";']
        );
        for (const [before, after] of mutations) {
            assert.ok(candidate.includes(before), 'negative mutation anchor exists');
            assert.throws(() => verifySource(candidate.replace(before, after), original, route));
        }
        const rowRule = `html.oe-workbench-context body.oe-work-school-note-editor .container .row {
    box-sizing: border-box;
    width: 100%;
    margin-inline: 0;
  }`;
        assert.ok(candidate.includes(rowRule), 'row width negative mutation anchor exists');
        assert.throws(() => verifySource(candidate.replace(rowRule, rowRule.replace('    width: 100%;\n', '')), original, route));
    });
    test(`${name}: current route requires the exact presentation additions`, () => {
        verifySource(read(route.source), originalFor(route), route);
    });
}
if (history) test('Git base and all changed paths stay inside seven-path boundary', () => {
    git('merge-base', '--is-ancestor', BASE, 'HEAD');
    for (const route of Object.values(routes)) originalFor(route, true);
    const changed = [
        ...git('diff', '--name-only', '-z', '--no-renames', BASE, '--').split('\0'),
        ...git('ls-files', '--others', '--exclude-standard', '-z').split('\0')
    ].filter(Boolean);
    checkScope(changed);
    for (const file of changed) {
        const absolute = path.join(root, file);
        if (fs.existsSync(absolute)) assert.ok(!fs.lstatSync(absolute).isSymbolicLink(), `symlink: ${file}`);
    }
});
module.exports = { CSS, additions, proposed, verifySource, routes };
