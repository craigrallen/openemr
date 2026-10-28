'use strict';

// Portable: node --test-reporter=tap tests/clinical-ui/clinic-note-editor-contract.cjs
// History guard: node --test-reporter=tap tests/clinical-ui/clinic-note-editor-contract.cjs --history
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
        source: 'interface/forms/clinic_note/new.php',
        fixture: 'tests/clinical-ui/fixtures/clinic-note-new-original.php.txt',
        hash: '9a664234f0c0659e1f172306e0f067cbda161a5025cf8236c6700e63e7613acf',
        header: '    <?php Header::setupHeader(); ?>',
        form: '<form method="post" action="<?php echo $rootdir ?>/forms/clinic_note/new.php?id=<?php echo attr_url($formid) ?>"\n onsubmit="return top.restoreSession()">'
    },
    view: {
        source: 'interface/forms/clinic_note/view.php',
        fixture: 'tests/clinical-ui/fixtures/clinic-note-view-original.php.txt',
        hash: '9d1ad92cd2e4ef5e451571907468902c55d13af5d0ac52d19e8b7d7cf8b417fb',
        header: '    <?php Header::setupHeader(); ?>',
        form: '<form method="post" action="<?php echo $rootdir ?>/forms/clinic_note/new.php?id=<?php echo attr_url($formid); ?>"\n onsubmit="return top.restoreSession()">'
    }
};

// Exact proposed screen-only addition. Its complete removal must recover the fixture.
const CSS = `<style>
@media screen {
  html.oe-workbench-context body.oe-clinic-note-editor {
    margin: 0;
    background-color: #edf2f3;
    color: #182c36;
  }

  html.oe-workbench-context body.oe-clinic-note-editor .oe-clinic-note-form {
    box-sizing: border-box;
    width: min(100%, 860px);
    min-width: 0;
    margin-block: 1.5rem;
    margin-inline: auto;
    padding-block: 1.75rem;
    padding-inline: clamp(1rem, 4vw, 2.25rem);
    border: 1px solid #cbd6da;
    border-radius: 7px;
    background-color: #fff;
  }

  html.oe-workbench-context body.oe-clinic-note-editor .oe-clinic-note-form > center {
    display: block;
    text-align: start;
  }

  html.oe-workbench-context body.oe-clinic-note-editor .oe-clinic-note-sheet {
    display: block;
    box-sizing: border-box;
    width: 100%;
    border: 0;
    border-collapse: separate;
  }

  html.oe-workbench-context body.oe-clinic-note-editor .oe-clinic-note-sheet > tbody,
  html.oe-workbench-context body.oe-clinic-note-editor .oe-clinic-note-sheet > tbody > tr,
  html.oe-workbench-context body.oe-clinic-note-editor .oe-clinic-note-sheet > tbody > tr > td {
    display: block;
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    border: 0;
    white-space: normal;
  }

  html.oe-workbench-context body.oe-clinic-note-editor .oe-clinic-note-sheet > tbody > tr {
    margin-block-end: 1.5rem;
  }

  html.oe-workbench-context body.oe-clinic-note-editor .oe-clinic-note-sheet > tbody > tr:first-child > td {
    padding-block: 0 0.75rem;
    border-block-end: 1px solid #cbd6da;
    background-color: transparent;
    color: #182c36;
    font-size: 1.5rem;
    line-height: 1.3;
    text-align: start;
  }

  html.oe-workbench-context body.oe-clinic-note-editor .oe-clinic-note-sheet > tbody > tr:first-child {
    background-color: transparent;
  }

  html.oe-workbench-context body.oe-clinic-note-editor .oe-clinic-note-sheet > tbody > tr > td:last-child {
    padding: 0;
  }

  html.oe-workbench-context body.oe-clinic-note-editor .oe-clinic-note-sheet > tbody > tr:last-child table td {
    box-sizing: border-box;
    min-width: 0;
    padding-block: 0.35rem;
    border: 0;
    white-space: normal;
    vertical-align: middle;
  }

  html.oe-workbench-context body.oe-clinic-note-editor .oe-clinic-note-sheet > tbody > tr:not(:first-child) > td:first-child {
    padding-block: 0 0.45rem;
    color: #182c36;
    font-size: 1rem;
    font-weight: 700;
    line-height: 1.4;
  }

  html.oe-workbench-context body.oe-clinic-note-editor .oe-clinic-note-sheet textarea {
    display: block;
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    min-height: 7rem;
    padding-block: 0.65rem;
    padding-inline: 0.75rem;
    border: 1px solid #a9bbc3;
    border-radius: 4px;
    background-color: #fff;
    color: #182c36;
    font: inherit;
    line-height: 1.7;
    overflow-wrap: break-word;
    resize: vertical;
  }

  html.oe-workbench-context body.oe-clinic-note-editor .oe-clinic-note-sheet > tbody > tr:last-child table,
  html.oe-workbench-context body.oe-clinic-note-editor .oe-clinic-note-sheet > tbody > tr:last-child tbody,
  html.oe-workbench-context body.oe-clinic-note-editor .oe-clinic-note-sheet > tbody > tr:last-child tr {
    display: block;
    width: 100%;
  }

  html.oe-workbench-context body.oe-clinic-note-editor .oe-clinic-note-sheet > tbody > tr:last-child table tr:first-child {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 0.75rem;
  }

  html.oe-workbench-context body.oe-clinic-note-editor .oe-clinic-note-sheet > tbody > tr:last-child table tr:first-child td {
    width: auto;
    max-width: 100%;
  }

  html.oe-workbench-context body.oe-clinic-note-editor .oe-clinic-note-sheet input[name='fu_timing'] {
    box-sizing: border-box;
    width: min(100%, 12rem) !important;
    min-height: 2.5rem;
    padding-inline: 0.65rem;
    border: 1px solid #a9bbc3;
    border-radius: 4px;
    font: inherit;
  }

  html.oe-workbench-context body.oe-clinic-note-editor .oe-clinic-note-form > center > p:last-of-type {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
    margin-block: 1.5rem 0;
    padding-block-start: 1rem;
    border-block-start: 1px solid #cbd6da;
  }

  html.oe-workbench-context body.oe-clinic-note-editor .oe-clinic-note-form input[name='bn_save'],
  html.oe-workbench-context body.oe-clinic-note-editor .oe-clinic-note-form input[type='button'] {
    min-height: 2.5rem;
    padding-block: 0.5rem;
    padding-inline: 1rem;
    font: inherit;
  }
}
</style>`;

const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });

function one(source, anchor, label) {
    assert.ok(anchor.length > 0, `${label}: nonempty anchor`);
    assert.equal(source.split(anchor).length, 2, `${label}: unique anchor`);
}

function additions(route) {
    return [
        [route.header, `${route.header}\n    ${CSS}`],
        ['<body bgcolor="#dddddd"', '<body class="oe-clinic-note-editor" bgcolor="#dddddd"'],
        [route.form, route.form.replace('<form ', '<form class="oe-clinic-note-form" ')],
        ["<table border='1' width='95%'>", "<table class='oe-clinic-note-sheet' border='1' width='95%'>"]
    ];
}

function proposed(original, route) {
    return additions(route).reduce((source, [before, after]) => {
        one(source, before, 'original insertion seam');
        assert.notEqual(before, after, 'addition changes source');
        return source.replace(before, after);
    }, original);
}

function verifySource(source, original, route) {
    let inverse = source;
    for (const [before, after] of additions(route)) {
        one(inverse, after, 'complete proposed addition');
        inverse = inverse.replace(after, before);
    }
    assert.equal(inverse, original, 'full original route bytes survive exact inverse');
}

function originalFor(route, history = false) {
    const original = read(route.fixture);
    assert.equal(hash(original), route.hash, 'frozen complete original SHA256');
    if (history) assert.equal(original, git('show', `${BASE}:${route.source}`), 'exact base blob');
    return original;
}

const history = process.argv.includes('--history');
assert.deepEqual(process.argv.slice(2).filter((arg) => arg !== '--history'), [], 'unknown option');
const allowed = new Set([
    ...Object.values(routes).flatMap((route) => [route.source, route.fixture]),
    'tests/clinical-ui/clinic-note-editor-contract.cjs',
    'tests/js/clinic-note-editor.test.js',
    'docs/clinical-ui/CLINIC-NOTE-EDITOR.md'
]);

function checkScope(files) {
    for (const file of files) assert.ok(allowed.has(file), `out-of-scope changed path: ${file}`);
}

test('seven-path scope rejects outsiders', () => {
    const outsider = 'interface/clinical-workspace/popup.css';
    assert.ok(!allowed.has(outsider));
    assert.throws(() => checkScope([routes.new.source, outsider]), /out-of-scope/);
});

test('Header autoload supplies native workbench context', () => {
    assert.match(read('src/Core/Header.php'), /setupAssets\(is_array\(\$assets\) \? \$assets : \[\$assets\], true\)/);
    assert.match(read('config/config.yaml'), /workbench-popup:\s*\n\s*basePath:.*clinical-workspace.*\n\s*script: popup\.js\s*\n\s*link: popup\.css\s*\n\s*autoload: true/);
    const popup = read('interface/clinical-workspace/popup.js');
    assert.match(popup, /const CONTEXT_CLASS = 'oe-workbench-context'/);
    assert.match(popup, /set\(CONTEXT_CLASS, active\)/);
    assert.match(popup, /classList\.contains\('workbench-active'\)/);
});

for (const [name, route] of Object.entries(routes)) {
    test(`${name}: synthetic original accepts precisely the proposed additions`, () => {
        const original = originalFor(route);
        const candidate = proposed(original, route);
        assert.notEqual(candidate, original);
        verifySource(candidate, original, route);
    });

    test(`${name}: inverse rejects source, action, visibility, CSS and geometry changes`, () => {
        const original = originalFor(route);
        const candidate = proposed(original, route);
        const mutations = [
            ['require_once("../../globals.php");', 'require_once("../../elsewhere.php");'],
            ['SessionWrapperFactory::getInstance()->getActiveSession()', 'SessionWrapperFactory::getInstance()->getInactiveSession()'],
            ['CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: true);', 'CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: false);'],
            ['EncounterSessionUtil::getEncounter()', 'EncounterSessionUtil::getOtherEncounter()'],
            ['sqlStatement($query, [', 'sqlStatement($otherQuery, ['],
            ["name='form_history'", "name='form_changed'"],
            ["<textarea name='form_history'", "<textarea hidden name='form_history'"],
            ["name='fu_timing' size='10'", "name='fu_timing' size='20'"],
            ['action="<?php echo $rootdir ?>/forms/clinic_note/new.php?id=', 'action="<?php echo $rootdir ?>/forms/clinic_note/other.php?id='],
            ["name='bn_save' value=", "name='bn_other' value="],
            ['onclick="parent.closeTab(window.name, false)"', 'onclick="parent.closeTab(window.name, true)"'],
            ['@media screen {', '@media print {'],
            ['@media screen {\n  html.oe-workbench-context body.oe-clinic-note-editor', '@media screen {\n  html body.oe-clinic-note-editor'],
            ['width: min(100%, 860px);', 'width: 1200px;'],
            ['flex-wrap: wrap;\n    align-items: center;\n    gap: 0.5rem 0.75rem;', 'flex-wrap: nowrap;\n    align-items: center;\n    gap: 0.5rem 0.75rem;'],
            ['</style>', 'body { display: none; }\n</style>'],
            ['</head>', '<style>body { display: none; }</style>\n</head>'],
            ['</body>', '<div>unexpected</div>\n</body>']
        ];
        if (name === 'view') {
            mutations.push(
                ["EncounterFormAccess::assertFormBelongsToSessionPatient($formId, 'clinic_note');", '// access removed'],
                ["text($row['history'])", "text($row['plan'])"]
            );
        } else {
            mutations.push(["text($row['history'] ?? '')", "text($row['plan'] ?? '')"]);
        }
        for (const [before, after] of mutations) {
            one(candidate, before, 'negative mutation anchor');
            const mutant = candidate.replace(before, after);
            assert.notEqual(mutant, candidate, 'negative mutation changes candidate');
            assert.throws(() => verifySource(mutant, original, route));
        }
    });

}

for (const [name, route] of Object.entries(routes)) {
    test(`${name}: current source is RED until exact additions land`, () => {
        verifySource(read(route.source), originalFor(route), route);
    });
}

if (history) test('base blobs and all committed, tracked and untracked paths stay scoped', () => {
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
