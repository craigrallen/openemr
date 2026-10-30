// Portable static contract. This file never executes the procedure-order route.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const root = path.resolve(__dirname, '../..');
const SOURCE = 'interface/forms/procedure_order/common.php';
const FIXTURE = 'tests/clinical-ui/fixtures/procedure-order-original.php.txt';
const HISTORY_REF = '09b29da7771aea334ed5745e058751157af980d7';
const SCOPE = 'html.oe-workbench-context body.oe-procedure-order-document';
const BODY_BEFORE = '<body class="body_top" onsubmit="doWait(event)">';
const BODY_AFTER = '<body class="body_top oe-procedure-order-document" onsubmit="doWait(event)">';
const STYLE_END = '    </style>\n</head>';
const ADDED_STYLE = `
      @media screen {
        ${SCOPE} {
          margin: 16px;
          color: #243c43;
        }

        ${SCOPE} > .container-fluid {
          max-width: 1100px;
          margin: 0 auto;
          padding: clamp(12px, 2vw, 28px);
          color: #243c43;
          background-color: #fff;
          border: 1px solid #d6e1e4;
          border-radius: 8px;
        }

        ${SCOPE} .page-header {
          margin-bottom: 16px;
        }

        ${SCOPE} .form.form-horizontal {
          margin-top: 16px;
        }
      }
`;

const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const count = (source, needle) => source.split(needle).length - 1;

function requireOnce(source, needle, label) {
    assert.equal(count(source, needle), 1, `${label} must occur exactly once`);
}

function insertPresentation(original) {
    requireOnce(original, BODY_BEFORE, 'original body');
    requireOnce(original, STYLE_END, 'original inline style end');
    return original.replace(BODY_BEFORE, BODY_AFTER)
        .replace(STYLE_END, ADDED_STYLE + STYLE_END);
}

function verifyPresentation(source, original) {
    requireOnce(source, BODY_AFTER, 'document body class');
    requireOnce(source, ADDED_STYLE, 'screen document presentation');
    const restored = source.replace(BODY_AFTER, BODY_BEFORE)
        .replace(ADDED_STYLE, '');
    assert.equal(restored, original, 'all original route bytes must remain unchanged');
    assert.equal(source, insertPresentation(original), 'only the two declared insertions are permitted');
}

function git(args) {
    const run = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    assert.ifError(run.error);
    assert.equal(run.status, 0, `git ${args[0]} failed: ${run.stderr}`);
    return run.stdout;
}

function verifyHistory(original) {
    assert.equal(git(['show', `${HISTORY_REF}:${SOURCE}`]), original,
        'frozen fixture must equal the entire pinned source');
    const allowed = new Set([
        SOURCE,
        'tests/clinical-ui/procedure-order-document-contract.cjs',
        FIXTURE,
        'tests/js/procedure-order-document.test.js',
        'docs/clinical-ui/PROCEDURE-ORDER-DOCUMENT.md',
    ]);
    const lists = [
        git(['diff', '--name-only', HISTORY_REF, 'HEAD']),
        git(['diff', '--name-only', 'HEAD']),
        git(['ls-files', '--others', '--exclude-standard']),
    ];
    for (const file of new Set(lists.flatMap((list) => list.split('\n').filter(Boolean)))) {
        assert.ok(allowed.has(file), `changed path outside the five-path allowlist: ${file}`);
    }
}

const original = read(FIXTURE);
const source = read(SOURCE);

test('the native route has exactly the declared screen presentation and body class', () => {
    verifyPresentation(source, original);
});

test('the declared presentation has only scoped screen selectors and paper spacing', () => {
    const rules = [...ADDED_STYLE.matchAll(/([^{}]+)\{([^{}]+)\}/g)];
    assert.equal(rules.length, 4);
    for (const [, selector, declarations] of rules) {
        assert.ok(selector.trim().startsWith(SCOPE), `unscoped selector: ${selector}`);
        assert.doesNotMatch(declarations, /(?:display|visibility|font(?:-family|-size)?|pointer-events|opacity)\s*:/i);
    }
    assert.match(ADDED_STYLE, /^\n      @media screen \{/);
    assert.doesNotMatch(ADDED_STYLE, /@media\s+print|!important|\b(table|thead|tbody|tr|td|th)\b/i);
    assert.match(ADDED_STYLE, /max-width: 1100px;/);
    assert.match(ADDED_STYLE, /padding: clamp\(12px, 2vw, 28px\);/);
    assert.match(ADDED_STYLE, /background-color: #fff;/);
    assert.match(ADDED_STYLE, /color: #243c43;/);
    assert.match(ADDED_STYLE, /border: 1px solid #d6e1e4;/);
    assert.match(ADDED_STYLE, /border-radius: 8px;/);
});

test('both route modes share common.php and Header already supplies workbench context', () => {
    assert.match(read('interface/forms/procedure_order/new.php'), /require\("common\.php"\);/);
    assert.match(read('interface/forms/procedure_order/view.php'), /require\("common\.php"\);/);
    assert.match(original, /Header::setupHeader\(\['datetime-picker', 'reason-code-widget'\]\)/);
    assert.match(read('config/config.yaml'), /workbench-popup:\s*\n\s*basePath:[^\n]*\n\s*script: popup\.js\s*\n\s*link: popup\.css\s*\n\s*autoload: true/);
    assert.match(read('src/Core/Header.php'), /setupAssets\(is_array\(\$assets\) \? \$assets : \[\$assets\], true\)/);
    assert.match(read('interface/clinical-workspace/popup.js'), /CONTEXT_CLASS = 'oe-workbench-context'/);
});

test('original SQL, CSRF, validation and transmission mutations are rejected', () => {
    const valid = insertPresentation(original);
    const mutations = [
        ['SQL', 'sqlStatement("DELETE FROM procedure_answers WHERE procedure_order_id = ?", [$formid]);',
            'sqlStatement("DELETE FROM procedure_answers WHERE procedure_order_id = ?", []);'],
        ['CSRF', 'name="csrf_token_form" value="<?php echo CsrfUtils::collectCsrfToken(session: $session); ?>"',
            'name="csrf_token_form" value=""'],
        ['validation', 'onsubmit="return validate(this,event)"', 'onsubmit="return true"'],
        ['transmission', "onclick='top.restoreSession();transmitting = true;'",
            "onclick='top.restoreSession();transmitting = false;'"],
    ];
    for (const [label, before, after] of mutations) {
        requireOnce(valid, before, `${label} mutation target`);
        const mutant = valid.replace(before, after);
        assert.notEqual(mutant, valid, `${label} mutant must change source`);
        assert.throws(() => verifyPresentation(mutant, original), undefined, `${label} mutant must fail`);
    }
});

test('unscoped, print, hiding and font mutations of the added style are rejected', () => {
    const valid = insertPresentation(original);
    const mutations = [
        ['scope', `${SCOPE} > .container-fluid {`, 'body > .container-fluid {'],
        ['print', '@media screen {', '@media print {'],
        ['hiding', 'margin-bottom: 16px;', 'margin-bottom: 16px;\n          display: none;'],
        ['font', 'margin-top: 16px;', 'margin-top: 16px;\n          font-family: Arial;'],
    ];
    for (const [label, before, after] of mutations) {
        requireOnce(valid, before, `${label} mutation target`);
        const mutant = valid.replace(before, after);
        assert.notEqual(mutant, valid, `${label} mutant must change source`);
        assert.throws(() => verifyPresentation(mutant, original), undefined, `${label} mutant must fail`);
    }
});

if (process.argv.includes('--history')) {
    test('pinned history matches the complete fixture and every changed path is allowed', () => {
        verifyHistory(original);
    });
}

module.exports = { ADDED_STYLE, BODY_AFTER, BODY_BEFORE, SCOPE, insertPresentation, verifyPresentation };
