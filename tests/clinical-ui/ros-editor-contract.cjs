'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const test = require('node:test');

const root = path.resolve(__dirname, '../..');
const BASE = '09b29da7771aea334ed5745e058751157af980d7';
const source = 'interface/forms/ros/templates/ros/general_new.html';
const fixture = 'tests/clinical-ui/fixtures/ros-general-original.html.txt';
const SHA = '1a4155bbf598671e9bdc8f9525731fed7d7fee2a2fba5de4f3048159af5f5d5f';
const allowed = new Set([
  source, fixture, 'tests/clinical-ui/ros-editor-contract.cjs',
  'tests/js/ros-editor.test.js', 'docs/clinical-ui/ROS-EDITOR.md'
]);
const support = [
  'interface/forms/ros/C_FormROS.class.php', 'interface/forms/ros/FormROS.class.php',
  'interface/forms/ros/new.php', 'interface/forms/ros/view.php',
  'interface/forms/ros/save.php', 'interface/clinical-workspace/popup.css',
  'interface/themes/theme-defaults.scss'
];
const prefix = 'html.oe-workbench-context body.ros-document-editor';
const form = `${prefix} form[name='ros']`;
const save = `${form} .btn-save`;
const cancel = `${form} .btn-cancel`;

// Future production addition: this exact block before </head>, plus the body class.
const CSS = `    <style>
    @media screen {
      ${prefix} {
        box-sizing: border-box;
        margin: 0;
        padding: clamp(0.5rem, 2vw, 1.5rem);
        background-color: #e8eff0 !important;
        color: #182c36 !important;
      }

      ${prefix} > .container {
        box-sizing: border-box;
        width: 100%;
        max-width: 860px;
        margin-inline: auto;
        padding: 0;
      }

      ${prefix} > .container > .row {
        margin-inline: 0;
      }

      ${prefix} > .container > .row > .col-12 {
        padding-inline: 0;
      }

      ${prefix} h2 {
        margin-block: 0 1rem;
        color: #183b49;
        font-size: clamp(1.35rem, 3vw, 1.8rem);
        line-height: 1.3;
      }

      ${form} {
        box-sizing: border-box;
        width: 100%;
        min-width: 0;
        max-width: 860px;
        margin-inline: auto;
        padding: clamp(0.75rem, 2.5vw, 2rem);
        border: 1px solid #c7d5d9;
        background-color: #fff;
        color: #182c36;
        font-size: 1rem;
        line-height: 1.6;
        overflow-wrap: anywhere;
      }

      ${form} fieldset {
        box-sizing: border-box;
        min-width: 0;
        margin-block: 0 1.5rem;
        padding: 0.5rem 0 0;
        border: 0;
        border-top: 1px solid #cbd6da;
        background-color: #fff !important;
        color: #182c36 !important;
      }

      ${form} legend {
        width: auto;
        max-width: 100%;
        margin-block: 0 0.5rem;
        padding-inline: 0 0.75rem;
        background-color: #fff !important;
        color: #183b49 !important;
        font-size: 1.1rem;
        font-weight: 600;
        line-height: 1.4;
        overflow-wrap: anywhere;
      }

      ${form} fieldset > .col-sm-12 {
        padding-inline: 0;
      }

      ${form} .form-group {
        min-width: 0;
        margin-block: 0 0.75rem;
      }

      ${form} .form-group > .col-form-label {
        display: block;
        width: 100%;
        margin-block: 0 0.25rem;
        padding: 0 !important;
        color: #182c36;
        font-weight: 600;
        line-height: 1.5;
      }

      ${form} .form-group > label:not(.col-form-label) {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        max-width: 100%;
        min-height: 2.5rem;
        margin: 0.2rem 0.75rem 0.2rem 0;
        padding: 0.35rem 0.55rem !important;
        border: 1px solid #cbd6da;
        border-radius: 4px;
        background-color: #fff;
        color: #182c36;
        line-height: 1.4;
        white-space: normal;
        cursor: pointer;
      }

      ${form} .form-group input[type='radio'] {
        flex: 0 0 auto;
        margin: 0 0.25rem 0 0;
        accent-color: #145968;
        transition-duration: 0s;
      }

      ${form} .form-group > label:not(.col-form-label):focus-within,
      ${form} .btn:focus-visible {
        outline: 3px solid #a84c22;
        outline-offset: 2px;
      }

      ${form} .btn-group {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        max-width: 100%;
      }

      ${save},
      ${cancel} {
        box-sizing: border-box;
        min-width: 8rem;
        max-width: 100%;
        min-height: 2.75rem;
        padding: 0.55rem 0.85rem;
        border-radius: 4px;
        font: inherit;
        white-space: normal;
        transition-duration: 0s;
      }

      ${save} {
        border-color: #145968;
        background-color: #145968 !important;
        color: #fff !important;
      }

      ${save}:hover,
      ${save}:focus,
      ${save}:active {
        border-color: #104e5b;
        background-color: #104e5b !important;
        color: #fff !important;
      }

      ${cancel} {
        border-color: #91a8b1;
        background-color: #fff !important;
        color: #182c36 !important;
      }

      ${cancel}:hover,
      ${cancel}:focus,
      ${cancel}:active {
        border-color: #145968;
        background-color: #e4f0f1 !important;
        color: #182c36 !important;
      }
    }
    </style>`;

const read = (name) => fs.readFileSync(path.join(root, name));
const git = (...args) => execFileSync('git', args, { cwd: root });
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

function replaceOnce(bytes, before, after) {
  const value = Buffer.from(bytes);
  const needle = Buffer.from(before);
  const at = value.indexOf(needle);
  assert.notEqual(at, -1, `missing seam: ${before.slice(0, 50)}`);
  assert.equal(at, value.lastIndexOf(needle), `duplicate seam: ${before.slice(0, 50)}`);
  return Buffer.concat([value.subarray(0, at), Buffer.from(after), value.subarray(at + needle.length)]);
}

function original() {
  const bytes = read(fixture);
  assert.equal(hash(bytes), SHA, fixture);
  return bytes;
}

function proposed(baseline) {
  let value = replaceOnce(baseline, '</head>', `${CSS}\n</head>`);
  value = replaceOnce(value, '<body>', '<body class="ros-document-editor">');
  return value;
}

function verifySource(candidate, baseline) {
  let inverse = replaceOnce(candidate, '<body class="ros-document-editor">', '<body>');
  inverse = replaceOnce(inverse, `${CSS}\n</head>`, '</head>');
  assert.deepEqual(inverse, baseline, 'full inverse restores every original byte');
  assert.deepEqual(candidate, proposed(baseline), 'only the exact presentation additions are present');
}

function rules(css) {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    selectors: match[1].split(',').map((part) => part.trim()),
    declarations: match[2]
  }));
}

function values(css, selector, property) {
  return rules(css).filter((rule) => rule.selectors.includes(selector)).flatMap((rule) =>
    [...rule.declarations.matchAll(new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+);`, 'g'))]
      .map((match) => match[1].trim()));
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
    [`${prefix} > .container`, 'max-width', '860px'],
    [`${prefix} > .container > .row`, 'margin-inline', '0'],
    [`${prefix} > .container > .row > .col-12`, 'padding-inline', '0'],
    [form, 'width', '100%'], [form, 'min-width', '0'],
    [form, 'max-width', '860px'], [form, 'line-height', '1.6'],
    [`${form} fieldset`, 'background-color', '#fff !important'],
    [`${form} fieldset`, 'color', '#182c36 !important'],
    [`${form} legend`, 'background-color', '#fff !important'],
    [`${form} legend`, 'color', '#183b49 !important'],
    [`${form} .form-group > .col-form-label`, 'display', 'block'],
    [`${form} .form-group > label:not(.col-form-label)`, 'display', 'inline-flex'],
    [`${form} .form-group > label:not(.col-form-label)`, 'min-height', '2.5rem'],
    [`${form} .form-group input[type='radio']`, 'accent-color', '#145968'],
    [`${form} .btn-group`, 'flex-wrap', 'wrap'],
    [`${form} .form-group > label:not(.col-form-label):focus-within`, 'outline', '3px solid #a84c22'],
    [`${form} .btn:focus-visible`, 'outline', '3px solid #a84c22']
  ]) expectValue(css, selector, property, expected);
  for (const [selector, fill, ink, activeFill, activeInk] of [
    [save, '#145968', '#fff', '#104e5b', '#fff'],
    [cancel, '#fff', '#182c36', '#e4f0f1', '#182c36']
  ]) {
    expectValue(css, selector, 'min-height', '2.75rem');
    expectValue(css, selector, 'max-width', '100%');
    expectValue(css, selector, 'transition-duration', '0s');
    expectValue(css, selector, 'background-color', `${fill} !important`);
    expectValue(css, selector, 'color', `${ink} !important`);
    for (const state of [':hover', ':focus', ':active']) {
      expectValue(css, `${selector}${state}`, 'background-color', `${activeFill} !important`);
      expectValue(css, `${selector}${state}`, 'color', `${activeInk} !important`);
    }
  }
}

function rejectMutation(candidate, before, after, baseline) {
  const mutant = replaceOnce(candidate, before, after);
  assert.ok(!mutant.equals(candidate));
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
assert.ok(args.every((arg) => ['--history', '--export-css'].includes(arg))
  && new Set(args).size === args.length
  && !(args.includes('--history') && args.includes('--export-css')), 'invalid option');
if (args.includes('--export-css')) {
  process.stdout.write(CSS.replace(/^ {4}/gm, ''));
} else {
  test('complete original template retains clinical and action seams', () => {
    const value = original().toString();
    for (const token of [
      '{headerTemplate}', 'name="ros"', 'action="{$FORM_ACTION}/interface/forms/ros/save.php"',
      'onsubmit="return top.restoreSession()"', 'name="csrf_token_form"',
      'value="{$CSRF_TOKEN_FORM|attr}"', 'options=$form->get_options()',
      'selected=$form->get_weight_change()', 'name="change_in_vision"',
      'selected=$form->get_chills()', 'name="id" value="{$form->get_id()|attr}"',
      'name="pid" value="{$form->get_pid()|attr}"', 'name="process" value="true"',
      'onclick="top.restoreSession();" name="Submit"',
      "onclick=\"top.restoreSession(); location.href='{$DONT_SAVE_LINK}';\""
    ]) assert.ok(value.includes(token), token);
    assert.match(value, /\{html_radios name="heat_or_cold" name="heat_or_cold"/);
    assert.match(value, /\{html_radios name="change_in_vision"[^\n]*selected=\$form->get_weight_change\(\)/);
    assert.equal((value.match(/\{html_radios /g) || []).length > 100, true);
    assert.equal((value.match(/<fieldset>/g) || []).length, (value.match(/<\/fieldset>/g) || []).length);
    assert.doesNotMatch(value, /<textarea\b/);
  });

  test('screen-only scoped CSS covers document, native radios, actions and focus', () => verifyCss(CSS));

  test('screen CSS neutralizes Bootstrap outer gutters at mobile width', () => {
    const baseline = original();
    const candidate = proposed(baseline);
    for (const [before, after] of [
      [`${prefix} > .container > .row {\n        margin-inline: 0;\n      }`, ''],
      ['margin-inline: 0;', 'margin-inline: -15px;'],
      [`${prefix} > .container > .row > .col-12 {\n        padding-inline: 0;\n      }`, ''],
      [`${prefix} > .container > .row > .col-12 {\n        padding-inline: 0;`,
        `${prefix} > .container > .row > .col-12 {\n        padding-inline: 15px;`]
    ]) {
      const mutatedCss = replaceOnce(Buffer.from(CSS), before, after).toString();
      assert.throws(() => verifyCss(mutatedCss), `CSS rejected: ${before}`);
      rejectMutation(candidate, before, after, baseline);
    }
  });

  test('exact proposal has a full inverse to the untouched original fixture', () => {
    const baseline = original();
    verifySource(proposed(baseline), baseline);
  });

  test('actual ROS template matches the exact presentation proposal', () => {
    verifySource(read(source), original());
  });

  test('five-path scope admits proposal and rejects any other file', () => {
    verifyScope([...allowed]);
    assert.throws(() => verifyScope([...allowed, 'interface/forms/ros/save.php']));
  });

  test('security, getter, field, radio option, binding and action mutants fail', () => {
    const baseline = original();
    const candidate = proposed(baseline);
    for (const [before, after] of [
      ['name="csrf_token_form"', 'name="other_token"'],
      ['{$CSRF_TOKEN_FORM|attr}', '{$OTHER_TOKEN|attr}'],
      ['action="{$FORM_ACTION}/interface/forms/ros/save.php"', 'action="elsewhere"'],
      ['onsubmit="return top.restoreSession()"', 'onsubmit="return true"'],
      ['name="weight_change"', 'name="other_field"'],
      ['name="change_in_vision" id="change_in_vision" options=$form->get_options() selected=$form->get_weight_change()',
        'name="change_in_vision" id="change_in_vision" options=$form->get_options() selected=$form->get_fever()'],
      ['name="anorexia" id="anorexia" options=$form->get_options()',
        'name="anorexia" id="anorexia" options=$form->other_options()'],
      ['name="anorexia" id="anorexia" options=$form->get_options() selected=$form->get_anorexia() separator=""',
        'name="anorexia" id="anorexia" options=$form->get_options() selected=$form->get_anorexia() separator=","'],
      ['name="process" value="true"', 'name="process" value="false"'],
      ['{$form->get_pid()|attr}', '{$form->get_id()|attr}'],
      ['onclick="top.restoreSession();" name="Submit"', 'onclick="return false;" name="Submit"'],
      ["location.href='{$DONT_SAVE_LINK}';", "location.href='other';"],
      ['{xlt t="Constitutional"}', '{xlt t="Other"}'],
      ['</form>', '</form><div></div>']
    ]) rejectMutation(candidate, before, after, baseline);
  });

  test('scope, print, width, mobile, focus and palette mutants fail', () => {
    const baseline = original();
    const candidate = proposed(baseline);
    for (const [before, after] of [
      ['<body class="ros-document-editor">', '<body class="other-editor">'],
      ['@media screen {', '@media print {'],
      [`${prefix} {`, 'body {'],
      [`${prefix} > .container {\n        box-sizing: border-box;\n        width: 100%;\n        max-width: 860px;`,
        `${prefix} > .container {\n        box-sizing: border-box;\n        width: 100%;\n        max-width: 1200px;`],
      [`${form} {\n        box-sizing: border-box;\n        width: 100%;`,
        `${form} {\n        box-sizing: border-box;\n        width: 900px;`],
      ['display: inline-flex;', 'display: block;'],
      ['flex-wrap: wrap;', 'flex-wrap: nowrap;'],
      ['outline: 3px solid #a84c22;', 'outline: none;'],
      ['background-color: #145968 !important;', 'background-color: #145968;'],
      [`${save} {\n        border-color: #145968;\n        background-color: #145968 !important;\n        color: #fff !important;`,
        `${save} {\n        border-color: #145968;\n        background-color: #145968 !important;\n        color: #fff;`]
    ]) rejectMutation(candidate, before, after, baseline);
    for (const [before, after] of [
      ['@media screen {', '@media print {'],
      [`${prefix} {`, 'body {'],
      [`${prefix} > .container {\n        box-sizing: border-box;\n        width: 100%;\n        max-width: 860px;`,
        `${prefix} > .container {\n        box-sizing: border-box;\n        width: 100%;\n        max-width: 1200px;`],
      [`${form} {\n        box-sizing: border-box;\n        width: 100%;`,
        `${form} {\n        box-sizing: border-box;\n        width: 900px;`],
      ['display: inline-flex;', 'display: block;'],
      ['flex-wrap: wrap;', 'flex-wrap: nowrap;'],
      ['outline: 3px solid #a84c22;', 'outline: none;'],
      ['background-color: #145968 !important;', 'background-color: #145968;'],
      [`${save} {\n        border-color: #145968;\n        background-color: #145968 !important;\n        color: #fff !important;`,
        `${save} {\n        border-color: #145968;\n        background-color: #145968 !important;\n        color: #fff;`]
    ]) assert.throws(() => verifyCss(replaceOnce(Buffer.from(CSS), before, after).toString()));
  });

  if (args.includes('--history')) {
    test('authenticated base identifies fixture and unchanged support bytes', () => {
      assert.equal(git('rev-parse', 'origin/master').toString().trim(), BASE);
      assert.deepEqual(original(), git('show', `${BASE}:${source}`));
      for (const name of support) {
        const base = git('show', `${BASE}:${name}`);
        assert.deepEqual(read(name), base, name);
        assert.deepEqual(git('show', `HEAD:${name}`), base, `HEAD ${name}`);
      }
    });

    test('base-to-HEAD, working, staged and untracked paths stay within five paths', () => {
      verifyScope(changedPaths());
    });
  }
}

module.exports = { CSS, proposed, verifySource, verifyCss };
