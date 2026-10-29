'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const test = require('node:test');

const root = path.resolve(__dirname, '../..');
const BASE = '09b29da7771aea334ed5745e058751157af980d7';
const source = 'interface/forms/phq9/common.php';
const fixture = 'tests/clinical-ui/fixtures/phq9-common-original.php.txt';
const sha = 'd8e6463c72707527c03dd043a1d59b7fd54bd2487690985957d59d5f747d02f4';
const allowed = new Set([
  source, fixture, 'tests/clinical-ui/phq9-editor-contract.cjs',
  'tests/js/phq9-editor.test.js', 'docs/clinical-ui/PHQ9-EDITOR.md'
]);
const support = [
  'interface/forms/phq9/phq9_javasrc.js', 'interface/forms/phq9/phq9.inc.php',
  'interface/forms/phq9/new.php', 'interface/forms/phq9/view.php',
  'interface/forms/phq9/save.php', 'interface/forms/phq9/report.php',
  'library/forms.inc.php', 'library/api.inc.php',
  'interface/clinical-workspace/popup.css', 'interface/themes/theme-defaults.scss'
];
const prefix = 'html.oe-workbench-context body.phq9-document-editor';
const form = `${prefix} form[name='my_form']`;
const button = `${form} button[type='submit']`;
const cancel = `${form} button[type='button']`;

// Future production edit: insert this literal immediately before </head>.
// The four-space outer indent is part of the PHP source; remove it for stylelint.
const CSS = `    <style>
    @media screen {
      ${prefix} {
        box-sizing: border-box;
        margin: 0;
        padding: clamp(0.5rem, 2vw, 1.5rem);
        background-color: #e8eff0 !important;
        color: #182c36 !important;
      }

      ${prefix} > .col-12 {
        box-sizing: border-box;
        max-width: 860px;
        margin-inline: auto;
        padding: 0;
      }

      ${prefix} h3 {
        margin-block: 0 0.75rem;
        color: #183b49;
        font-size: clamp(1.25rem, 3vw, 1.75rem);
        line-height: 1.3;
      }

      ${form} {
        box-sizing: border-box;
        width: 100%;
        max-width: 860px;
        min-width: 0;
        margin-inline: auto;
        padding: clamp(0.75rem, 2.5vw, 1.75rem);
        border: 1px solid #c7d5d9;
        background-color: #fff;
        color: #182c36;
        font-size: 1rem;
        line-height: 1.7;
        overflow-wrap: anywhere;
      }

      ${form} > .title {
        color: #183b49;
        font-size: 1rem;
        font-weight: 600;
        line-height: 1.5;
      }

      ${form} table {
        box-sizing: border-box;
        width: 100%;
        max-width: 100%;
        border-collapse: collapse;
      }

      ${form} td {
        box-sizing: border-box;
        width: 100%;
        min-width: 0;
        padding-block: 0.5rem;
        vertical-align: top;
        overflow-wrap: anywhere;
      }

      ${form} td > .label,
      ${form} td > i {
        display: block;
        color: #182c36;
        font-size: 1rem;
        line-height: 1.5;
        overflow-wrap: anywhere;
      }

      ${form} td > select {
        box-sizing: border-box;
        display: block;
        width: 100%;
        max-width: 100%;
        min-height: 2.75rem;
        margin-block: 0.5rem 0;
        padding: 0.5rem 0.75rem;
        border: 1px solid #91a8b1;
        border-radius: 4px;
        background-color: #fff !important;
        color: #182c36 !important;
        font: inherit;
        transition-duration: 0s;
      }

      ${form} #q10_place,
      ${form} #show_phq9_score {
        display: block;
        color: #183b49;
        font-weight: 600;
        line-height: 1.5;
        overflow-wrap: anywhere;
      }

      ${form} #q10_place {
        margin-block: 0.25rem;
      }

      ${button},
      ${cancel} {
        box-sizing: border-box;
        display: block;
        width: min(100%, 20rem);
        max-width: 100%;
        min-height: 2.75rem;
        margin-block: 0.5rem;
        padding: 0.55rem 0.85rem;
        border: 1px solid #145968;
        border-radius: 4px;
        font: inherit;
        white-space: normal;
        overflow-wrap: anywhere;
        transition-duration: 0s;
      }

      ${button} {
        background-color: #145968 !important;
        color: #fff !important;
      }

      ${cancel} {
        border-color: #91a8b1;
        background-color: #fff !important;
        color: #182c36 !important;
      }

      ${button}:hover,
      ${button}:focus,
      ${button}:active {
        border-color: #104e5b;
        background-color: #104e5b !important;
        color: #fff !important;
      }

      ${cancel}:hover,
      ${cancel}:focus,
      ${cancel}:active {
        border-color: #145968;
        background-color: #e4f0f1 !important;
        color: #182c36 !important;
      }

      ${button}:focus-visible,
      ${cancel}:focus-visible,
      ${form} select:focus-visible {
        outline: 3px solid #a84c22;
        outline-offset: 2px;
      }
    }
    </style>`;

const read = (name) => fs.readFileSync(path.join(root, name));
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const git = (...args) => execFileSync('git', args, { cwd: root });

function replaceOnce(bytes, before, after) {
  const value = Buffer.from(bytes);
  const needle = Buffer.from(before);
  const at = value.indexOf(needle);
  assert.notEqual(at, -1, `missing seam: ${before.slice(0, 45)}`);
  assert.equal(at, value.lastIndexOf(needle), `duplicate seam: ${before.slice(0, 45)}`);
  return Buffer.concat([value.subarray(0, at), Buffer.from(after), value.subarray(at + needle.length)]);
}

function original() {
  const bytes = read(fixture);
  assert.equal(hash(bytes), sha, fixture);
  return bytes;
}

function proposed(baseline) {
  let value = replaceOnce(baseline, '</head>', `${CSS}\n</head>`);
  value = replaceOnce(value, '<body class="body_top">', '<body class="body_top phq9-document-editor">');
  return value;
}

function verifySource(candidate, baseline) {
  let inverse = replaceOnce(candidate, '<body class="body_top phq9-document-editor">', '<body class="body_top">');
  inverse = replaceOnce(inverse, `${CSS}\n</head>`, '</head>');
  assert.deepEqual(inverse, baseline, 'full inverse restores the original fixture');
  assert.deepEqual(candidate, proposed(baseline), 'only the exact presentation additions are present');
}

function rules(css) {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    selectors: match[1].split(',').map((part) => part.trim()), declarations: match[2]
  }));
}

function values(css, selector, property) {
  return rules(css).filter((rule) => rule.selectors.includes(selector)).flatMap((rule) =>
    [...rule.declarations.matchAll(new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+);`, 'g'))].map((match) => match[1].trim()));
}

function expectValue(css, selector, property, expected) {
  assert.deepEqual(values(css, selector, property), [expected], `${selector}: ${property}`);
}

function verifyCss(css) {
  assert.match(css, /^    <style>\n    @media screen \{/);
  assert.match(css, /    \}\n    <\/style>$/);
  assert.equal((css.match(/@media/g) || []).length, 1);
  assert.doesNotMatch(css, /@media print|\bdisplay\s*:\s*none\b|\bvisibility\s*:\s*hidden\b|\bopacity\s*:\s*0\s*;/);
  assert.doesNotMatch(css, /\b(?:overflow|overflow-x|overflow-y)\s*:\s*(?:hidden|clip|auto)\b|position\s*:\s*(?:fixed|absolute)|white-space\s*:\s*nowrap/);
  for (const rule of rules(css)) for (const selector of rule.selectors) {
    assert.ok(selector === prefix || selector.startsWith(`${prefix} `), `unscoped: ${selector}`);
  }
  for (const [selector, property, expected] of [
    [prefix, 'background-color', '#e8eff0 !important'],
    [`${prefix} > .col-12`, 'max-width', '860px'],
    [form, 'width', '100%'], [form, 'max-width', '860px'],
    [form, 'margin-inline', 'auto'], [form, 'line-height', '1.7'],
    [`${form} table`, 'width', '100%'],
    [`${form} td > .label`, 'display', 'block'],
    [`${form} td > i`, 'display', 'block'],
    [`${form} td > select`, 'width', '100%'],
    [`${form} td > select`, 'min-height', '2.75rem'],
    [`${form} td > select`, 'transition-duration', '0s'],
    [`${form} #q10_place`, 'display', 'block'],
    [`${form} #show_phq9_score`, 'overflow-wrap', 'anywhere']
  ]) expectValue(css, selector, property, expected);
  for (const [selector, fill, foreground, hoverFill, hoverForeground] of [
    [button, '#145968', '#fff', '#104e5b', '#fff'],
    [cancel, '#fff', '#182c36', '#e4f0f1', '#182c36']
  ]) {
    expectValue(css, selector, 'width', 'min(100%, 20rem)');
    expectValue(css, selector, 'max-width', '100%');
    expectValue(css, selector, 'white-space', 'normal');
    expectValue(css, selector, 'min-height', '2.75rem');
    expectValue(css, selector, 'transition-duration', '0s');
    expectValue(css, selector, 'background-color', `${fill} !important`);
    expectValue(css, selector, 'color', `${foreground} !important`);
    for (const state of [':hover', ':focus', ':active']) {
      expectValue(css, `${selector}${state}`, 'background-color', `${hoverFill} !important`);
      expectValue(css, `${selector}${state}`, 'color', `${hoverForeground} !important`);
    }
    expectValue(css, `${selector}:focus-visible`, 'outline', '3px solid #a84c22');
  }
  expectValue(css, `${form} select:focus-visible`, 'outline', '3px solid #a84c22');
}

function rejectMutation(candidate, before, after, baseline) {
  const mutant = replaceOnce(candidate, before, after);
  assert.ok(!mutant.equals(candidate), `mutant changed: ${before}`);
  assert.throws(() => verifySource(mutant, baseline), `rejected: ${before}`);
}

function verifyScope(paths) {
  assert.equal(allowed.size, 5);
  for (const name of paths) assert.ok(allowed.has(name), `out-of-scope path: ${name}`);
}

function changedPaths() {
  const paths = new Set();
  for (const args of [
    ['diff', '--name-only', '-z', BASE, 'HEAD'],
    ['diff', '--name-only', '-z'],
    ['diff', '--cached', '--name-only', '-z'],
    ['ls-files', '--others', '--exclude-standard', '-z']
  ]) for (const name of git(...args).toString().split('\0').filter(Boolean)) paths.add(name);
  return paths;
}

const args = process.argv.slice(2);
assert.ok(args.every((arg) => ['--history', '--export-css'].includes(arg)) && new Set(args).size === args.length && !(args.includes('--history') && args.includes('--export-css')), 'invalid option');
if (args.includes('--export-css')) {
  process.stdout.write(CSS.replace(/^ {4}/gm, ''));
} else {
  test('complete original shared form retains clinical and save seams', () => {
    const value = original().toString();
    for (const token of [
      'formFetch("form_phq9", $_GET["id"])', 'name="my_form"', 'name="csrf_token_form"',
      'CsrfUtils::collectCsrfToken(session: $session)', 'phq9_javasrc.js',
      'name="interest_score"', 'name="hopeless_score"', 'name="sleep_score"',
      'name="fatigue_score"', 'name="appetite_score"', 'name="failure_score"',
      'name="focus_score"', 'name="psychomotor_score"', 'name="suicide_score"',
      'id="q10_place"', 'id="show_phq9_score"', 'manage_question_10',
      'onSubmit="return(check_all());"', 'top.restoreSession()',
      'onclick="top.restoreSession();return( nosave_exit());"'
    ]) assert.ok(value.includes(token), token);
    assert.equal((value.match(/<select class=/g) || []).length, 9);
    assert.equal((value.match(/<button class=/g) || []).length, 2);
    assert.match(value, /save\.php\?mode=<\?php echo attr_url\(\$viewmode\); \?>&id=/);
    assert.match(value, /Thoughts that you would be better off dead, or of hurting yourself/);
    assert.match(value, /menu\.options\[4\] = new Option\( <\?php echo js_escape\(\$str_default\);  \?>, "undef"\);/);
  });

  test('screen-only document CSS covers questions, dynamic difficulty, score and actions', () => verifyCss(CSS));

  test('exact proposal and full inverse preserve every original byte', () => {
    const baseline = original();
    verifySource(proposed(baseline), baseline);
  });

  test('actual shared source matches the exact additive proposal', () => {
    verifySource(read(source), original());
  });

  test('five-path scope admits the proposal and rejects another file', () => {
    verifyScope([...allowed]);
    assert.throws(() => verifyScope([...allowed, 'interface/forms/phq9/save.php']));
  });

  test('security, question 9, scoring, event, option and action mutants fail', () => {
    const baseline = original();
    const candidate = proposed(baseline);
    for (const [before, after] of [
      ['name="csrf_token_form"', 'name="other_token"'],
      ['CsrfUtils::collectCsrfToken(session: $session)', 'CsrfUtils::collectCsrfToken(session: $other)'],
      ['phq9_javasrc.js', 'other.js'],
      ['name="suicide_score"', 'name="other_score"'],
      ['Thoughts that you would be better off dead, or of hurting yourself', 'Different question'],
      ['onchange="update_score(8, my_form.suicide_score.value);"', 'onchange="update_score(7, my_form.suicide_score.value);"'],
      ['menu.options[3] = new Option( <?php echo js_escape($str_extremely);?>, "3");', 'menu.options[3] = new Option( <?php echo js_escape($str_extremely);?>, "4");'],
      ['menu.options[4] = new Option( <?php echo js_escape($str_default);  ?>, "undef");', 'menu.options[4] = new Option( <?php echo js_escape($str_default);  ?>, "0");'],
      ['manage_question_10 (<?php echo js_escape($obj["difficulty"]); ?>);', 'manage_question_10 (0);'],
      ['onSubmit="return(check_all());"', 'onSubmit="return true;"'],
      ['save.php?mode=<?php echo attr_url($viewmode); ?>', 'save.php?mode=new'],
      ['top.restoreSession();return( nosave_exit());', 'return false;'],
      ['<span id="q10_place" class="label"></span>', '<div id="q10_place" class="label"></div>'],
      ['</form>', '</form><div></div>']
    ]) rejectMutation(candidate, before, after, baseline);
  });

  test('scope, print, context, width, mobile, focus and palette mutants fail', () => {
    const baseline = original();
    const candidate = proposed(baseline);
    for (const [before, after] of [
      ['<body class="body_top phq9-document-editor">', '<body class="body_top other-editor">'],
      ['@media screen {', '@media print {'],
      [`${prefix} {`, 'body {'],
      [`${prefix} > .col-12 {\n        box-sizing: border-box;\n        max-width: 860px;`, `${prefix} > .col-12 {\n        box-sizing: border-box;\n        max-width: 1200px;`],
      [`${form} {\n        box-sizing: border-box;\n        width: 100%;`, `${form} {\n        box-sizing: border-box;\n        width: 900px;`],
      [`${form} td > select`, `${form} td + select`],
      [`${form} td > i`, `${form} td + i`],
      ['outline: 3px solid #a84c22;', 'outline: none;'],
      ['background-color: #145968 !important;', 'background-color: #145968;'],
      ['background-color: #145968 !important;\n        color: #fff !important;', 'background-color: #145968 !important;\n        color: #fff;'],
      [`${form} td > select {\n        box-sizing: border-box;\n        display: block;`, `${form} td > select {\n        box-sizing: border-box;\n        display: none;`]
    ]) rejectMutation(candidate, before, after, baseline);
    for (const [before, after] of [
      ['@media screen {', '@media print {'],
      [`${prefix} {`, 'body {'],
      [`${prefix} > .col-12 {\n        box-sizing: border-box;\n        max-width: 860px;`, `${prefix} > .col-12 {\n        box-sizing: border-box;\n        max-width: 1200px;`],
      [`${form} {\n        box-sizing: border-box;\n        width: 100%;`, `${form} {\n        box-sizing: border-box;\n        width: 900px;`],
      [`${form} td > select`, `${form} td + select`],
      [`${form} td > i`, `${form} td + i`],
      ['outline: 3px solid #a84c22;', 'outline: none;'],
      ['background-color: #145968 !important;', 'background-color: #145968;'],
      ['background-color: #145968 !important;\n        color: #fff !important;', 'background-color: #145968 !important;\n        color: #fff;'],
      [`${form} td > select {\n        box-sizing: border-box;\n        display: block;`, `${form} td > select {\n        box-sizing: border-box;\n        display: none;`]
    ]) {
      const mutant = replaceOnce(Buffer.from(CSS), before, after).toString();
      assert.throws(() => verifyCss(mutant), `CSS mutant rejected: ${before}`);
    }
  });

  if (args.includes('--history')) {
    test('full base identifies the fixture and unchanged supporting files', () => {
      assert.equal(git('rev-parse', 'origin/master').toString().trim(), BASE);
      assert.deepEqual(original(), git('show', `${BASE}:${source}`));
      for (const name of support) {
        const base = git('show', `${BASE}:${name}`);
        assert.deepEqual(read(name), base, name);
        assert.deepEqual(git('show', `HEAD:${name}`), base, `HEAD ${name}`);
      }
    });

    test('committed base-to-HEAD, staged, working and untracked paths stay within all five paths', () => {
      verifyScope(changedPaths());
    });
  }
}
