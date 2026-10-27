'use strict';

// Source contract for the two original Dictation routes. Run with Node alone:
// node tests/clinical-ui/dictation-editor-contract.cjs [--history]
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
        source: 'interface/forms/dictation/new.php',
        fixture: 'tests/clinical-ui/fixtures/dictation-new-original.php.txt',
        hash: '4cc0f5edf92a343011a75811800f1ea49c23b8967b97e2cd62b8a2de36d0e9d9',
        body: '<body>',
        container: '<div class="container mt-3">',
        form: '<form name="my_form" method=post action="<?php echo $rootdir;?>/forms/dictation/save.php?mode=new" onsubmit="return top.restoreSession()">'
    },
    view: {
        source: 'interface/forms/dictation/view.php',
        fixture: 'tests/clinical-ui/fixtures/dictation-view-original.php.txt',
        hash: '1b6ea1e5c11687af794cb85a1621b4c309a5eb244f4d98b50abcc743a6cac023',
        body: '<body class="body_top">',
        container: '<div class="container">',
        form: '<form method=post action="<?php echo $rootdir?>/forms/dictation/save.php?mode=update&id=<?php echo attr_url($_GET["id"]);?>" name="my_form">'
    }
};

// This complete block is the only approved CSS addition. Keeping it literal makes the
// inverse exact: arbitrary extra CSS cannot hide between a marker and </style>.
const CSS = `<style>
/* Dictation writing sheet: active workbench only; print keeps the original form. */
@media screen {
  html.oe-workbench-context body.oe-dictation-editor {
    background-color: #f3f7f5 !important;
    color: #17343b;
  }

  html.oe-workbench-context body.oe-dictation-editor .oe-dictation-sheet {
    box-sizing: border-box;
    width: 100%;
    max-width: 860px;
    min-width: 0;
    margin-block: 1.5rem;
    margin-top: 1.5rem !important;
    margin-inline: auto;
    padding-block: 1.75rem;
    padding-inline: clamp(1rem, 4vw, 2.25rem);
    border: 1px solid #d9e4e2;
    border-radius: 7px;
    background-color: #fff;
    box-shadow: 0 1px 3px rgb(25 53 56 / 6%);
  }

  html.oe-workbench-context body.oe-dictation-editor .oe-dictation-sheet h2 {
    margin-block: 0 1.5rem;
    padding-block-end: 0.75rem;
    border-block-end: 1px solid #d9e4e2;
    color: #17343b;
    font-size: 1.7rem;
    line-height: 1.2;
  }

  html.oe-workbench-context body.oe-dictation-editor .oe-dictation-form fieldset {
    min-width: 0;
    margin-block: 0 1.5rem;
    padding: 0;
    border: 0;
    background-color: transparent !important;
  }

  html.oe-workbench-context body.oe-dictation-editor .oe-dictation-form legend {
    width: 100%;
    margin-block-end: 0.5rem;
    padding: 0;
    border: 0;
    color: #17343b !important;
    background-color: transparent !important;
    font-size: 1rem;
    font-weight: 700;
    line-height: 1.4;
  }

  html.oe-workbench-context body.oe-dictation-editor .oe-dictation-form fieldset .container,
  html.oe-workbench-context body.oe-dictation-editor .oe-dictation-form fieldset .col-sm-10 {
    width: 100%;
    max-width: none;
    min-width: 0;
    margin-left: 0;
    margin-right: 0;
    margin-inline: 0;
    padding-left: 0;
    padding-right: 0;
    padding-inline: 0;
  }

  html.oe-workbench-context body.oe-dictation-editor .oe-dictation-form fieldset .form-group {
    margin-block-end: 0;
  }

  html.oe-workbench-context body.oe-dictation-editor .oe-dictation-form textarea.form-control {
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    min-height: 5rem;
    padding-block: 0.65rem;
    padding-inline: 0;
    border: 0;
    border-block-end: 1px solid #6f878d;
    border-radius: 0;
    color: #17343b;
    background-color: #fff;
    font-size: 1rem;
    line-height: 1.7;
    overflow-wrap: break-word;
    resize: vertical;
  }

  html.oe-workbench-context body.oe-dictation-editor .oe-dictation-form textarea.form-control:focus {
    border-block-end-color: #086878;
    color: #17343b;
    background-color: #fbfdfe;
  }

  html.oe-workbench-context body.oe-dictation-editor .oe-dictation-form > .form-group:last-child {
    margin-block: 1.5rem 0;
    padding-block-start: 1rem;
    border-block-start: 1px solid #d9e4e2;
  }

  html.oe-workbench-context body.oe-dictation-editor .oe-dictation-form > .form-group:last-child .col-sm-12 {
    width: 100%;
    max-width: none;
    min-width: 0;
    margin-left: 0;
    margin-right: 0;
    margin-inline: 0;
    padding-left: 0;
    padding-right: 0;
    padding-inline: 0;
    text-align: left !important;
  }

  html.oe-workbench-context body.oe-dictation-editor .oe-dictation-form .btn-group {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  html.oe-workbench-context body.oe-dictation-editor .oe-dictation-form .btn-save {
    color: #fff;
    background-color: #086878;
    border-color: #086878;
  }

  html.oe-workbench-context body.oe-dictation-editor .oe-dictation-form .btn-cancel {
    color: #17343b !important;
    background-color: #fff !important;
    border-color: #6f878d !important;
  }
}
</style>`;

const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });

function one(text, needle, label) {
    assert.equal(text.split(needle).length, 2, `${label} must occur exactly once`);
}

function edits(route) {
    return [
        ['    <?php Header::setupHeader();?>', '    <?php Header::setupHeader();?>\n    ' + CSS],
        [route.body, route.body.replace('<body', '<body class="oe-dictation-editor"')
            .replace('class="oe-dictation-editor" class="body_top"', 'class="body_top oe-dictation-editor"')],
        [route.container, route.container.replace('class="container', 'class="container oe-dictation-sheet')],
        [route.form, route.form.replace('name="my_form"', 'name="my_form" class="oe-dictation-form"')]
    ];
}

function proposed(original, route) {
    return edits(route).reduce((source, [before, after]) => {
        one(source, before, 'original seam');
        return source.replace(before, after);
    }, original);
}

function inspect(source, original, route) {
    let restored = source;
    for (const [before, after] of edits(route)) {
        one(restored, after, 'approved addition');
        restored = restored.replace(after, before);
    }
    assert.equal(restored, original, 'complete original source must survive exact inverse');
    assert.equal((source.match(/<textarea\b/g) || []).length, 2);
    assert.equal((source.match(/<fieldset\b/g) || []).length, 2);
    assert.equal((source.match(/<button\b/g) || []).length, 2);
}

function physicalFallbacks(source, selector, inheritedMarginLeft) {
    const start = source.indexOf(`${selector} {`);
    assert.ok(start >= 0, `missing ${selector}`);
    const block = source.slice(start, source.indexOf('}', start));
    const declarations = [...block.matchAll(/^\s*([\w-]+):\s*([^;]+);/gm)]
        .map((match) => [match[1], match[2]]);
    const physical = declarations.filter(([property]) => !property.includes('inline'));
    const effective = { 'margin-left': inheritedMarginLeft, 'margin-right': '0.5rem',
        'padding-left': '15px', 'padding-right': '15px' };
    for (const [property, value] of physical) {
        if (Object.hasOwn(effective, property)) effective[property] = value;
    }
    assert.deepEqual(effective, { 'margin-left': '0', 'margin-right': '0',
        'padding-left': '0', 'padding-right': '0' },
    `${selector} must clear inherited physical offsets when logical declarations are dropped`);
    for (const [physicalProperty, logicalProperty] of [
        ['margin-left', 'margin-inline'], ['margin-right', 'margin-inline'],
        ['padding-left', 'padding-inline'], ['padding-right', 'padding-inline']
    ]) {
        assert.ok(declarations.findIndex(([property]) => property === physicalProperty)
            < declarations.findIndex(([property]) => property === logicalProperty),
        `${physicalProperty} must precede ${logicalProperty}`);
    }
}

function authenticOriginal(route, history) {
    const original = read(route.fixture);
    assert.equal(hash(original), route.hash, 'frozen fixture hash');
    if (history) assert.equal(original, git('show', `${BASE}:${route.source}`), 'fixture must match pinned base');
    return original;
}

const history = process.argv.includes('--history');
assert.deepEqual(process.argv.slice(2).filter((arg) => arg !== '--history'), [], 'unknown option');
const allowed = new Set([
    ...Object.values(routes).flatMap((route) => [route.source, route.fixture]),
    'tests/clinical-ui/dictation-editor-contract.cjs',
    'tests/js/dictation-editor.test.js',
    'docs/clinical-ui/DICTATION-EDITOR.md'
]);

function checkScope(files) {
    for (const file of files) assert.ok(allowed.has(file), `out-of-scope working file: ${file}`);
}

test('seven-file scope guard rejects an unrelated path', () => {
    const outsider = 'interface/clinical-workspace/popup.css';
    assert.ok(!allowed.has(outsider), 'negative scope precondition');
    assert.throws(() => checkScope([routes.new.source, outsider]), /out-of-scope/);
});

test('registered Header popup controller supplies the active context marker', () => {
    const config = read('config/config.yaml');
    assert.match(config, /workbench-popup:\s*\n\s*basePath:.*clinical-workspace.*\n\s*script: popup\.js\s*\n\s*link: popup\.css\s*\n\s*autoload: true/);
    const popup = read('interface/clinical-workspace/popup.js');
    assert.match(popup, /const CONTEXT_CLASS = 'oe-workbench-context'/);
    assert.match(popup, /set\(CONTEXT_CLASS, active\)/);
    assert.match(popup, /classList\.contains\('workbench-active'\)/);
});

if (history) test('base originals and complete checkout diff stay in seven-file scope', () => {
    git('merge-base', '--is-ancestor', BASE, 'HEAD');
    for (const route of Object.values(routes)) authenticOriginal(route, true);
    const changed = [
        ...git('diff', '--name-only', '--no-renames', BASE, '--').trimEnd().split('\n'),
        ...git('ls-files', '--others', '--exclude-standard').trimEnd().split('\n')
    ].filter(Boolean);
    for (const file of changed) {
        checkScope([file]);
        if (fs.existsSync(path.join(root, file))) {
            assert.ok(!fs.lstatSync(path.join(root, file)).isSymbolicLink(), `symlink: ${file}`);
        }
    }
});

for (const [name, route] of Object.entries(routes)) {
    test(`${name}: complete original and exact screen document additions`, () => {
        const original = authenticOriginal(route, history);
        const live = read(route.source);
        inspect(live, original, route);
    });

    test(`${name}: physical resets survive dropped logical properties`, () => {
        const live = read(route.source);
        assert.doesNotMatch(live, /@media screen and \(max-width: 640px\)/);
        physicalFallbacks(live,
            'html.oe-workbench-context body.oe-dictation-editor .oe-dictation-form fieldset .col-sm-10',
            '8.333333%');
        physicalFallbacks(live,
            'html.oe-workbench-context body.oe-dictation-editor .oe-dictation-form > .form-group:last-child .col-sm-12',
            '8.333333%');
    });

    test(`${name}: inverse rejects PHP, form, value, CSS and extra layout mutations`, () => {
        const original = authenticOriginal(route, history);
        const candidate = proposed(original, route);
        inspect(candidate, original, route);
        const approvedForm = edits(route)[3][1];
        const changes = [
            [approvedForm, approvedForm.replace('method=post', 'method=get')],
            ['name="dictation"', 'name="dictation_changed"'],
            ['name="additional_notes"', 'name="additional_notes_changed"'],
            ['<textarea name="dictation"', '<textarea value="changed" name="dictation"'],
            ['<title><?php echo xlt("Dictation"); ?></title>', '<title><?php echo xlt("Altered"); ?></title>'],
            ['border-block-end: 1px solid #6f878d;', 'border-block-end: 0;'],
            ['</head>', '<style>body { display: none; }</style>\n</head>'],
            ['</head>', '<?php $unexpected = true; ?>\n</head>'],
            ['</body>', '<div>extra</div>\n</body>']
        ];
        if (name === 'view') changes.push([
            '<?php echo text($obj["dictation"]);?>',
            '<?php echo text($obj["additional_notes"]);?>'
        ]);
        for (const [before, after] of changes) {
            one(candidate, before, 'negative mutation precondition');
            assert.throws(() => inspect(candidate.replace(before, after), original, route));
        }
    });
}
