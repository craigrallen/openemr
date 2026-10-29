'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const BASE = '09b29da7771aea334ed5745e058751157af980d7';
const source = 'interface/forms/prior_auth/templates/prior_auth/general_new.html';
const fixture = 'tests/clinical-ui/fixtures/prior-auth-general-new-original.html.txt';
const SHA = '82b588a4b14b69aa50c65cf404024699c1e63c02c16e69b2207c5e3939c69556';
const testsOnly = new Set([fixture, 'tests/clinical-ui/prior-auth-editor-contract.cjs', 'tests/js/prior-auth-editor.test.js']);
const finalPaths = new Set([...testsOnly, source, 'docs/clinical-ui/PRIOR-AUTH-EDITOR.md']);
const support = new Map([
  ['interface/forms/prior_auth/new.php', '1f0cb23b2b67b429172682fad5433cb477ab0c7b1f5e40ae5677d28a9607c15c'],
  ['interface/forms/prior_auth/view.php', 'e6c86abc1b7a27ffdaf492acfb23ed653c918cebe8134c594fc369305350d608'],
  ['interface/forms/prior_auth/save.php', '8de313e4badf46f16aa5219d59748367109e0a59a74ec30894ac38d420888eae'],
  ['interface/forms/prior_auth/FormPriorAuth.class.php', '70a935e87983a5b5db87048b35e323d3c2f097d65b4ad72a0ea7032bb9cb5541'],
  ['interface/forms/prior_auth/C_FormPriorAuth.class.php', 'ceb62a8142a30341888a7ec5469c8404f008deb5f42bb9397115ddc9927cafc7'],
  ['config/config.yaml', '5f99c981f570a2f94917d68a4abcedf086eb75a102364bf71f1cb44ccfe461b7'],
  ['interface/clinical-workspace/popup.css', 'ea56e9f26990e843219a68f315c188f7e2b0581c20321bac4517dc4ba34e79a9'],
  ['interface/themes/theme-defaults.scss', '0d01ace0600aada5fd2f82fc35bf76ef9083710f5cc5649e341a20cd97eaa773'],
  ['interface/themes/color_base.scss', 'f13d802ca97933d243c67a4474c994db7471e08913a3b8da694d8d953d8325d7']
]);
const prefix = 'html.oe-workbench-context body.prior-auth-document-editor';
const sheet = `${prefix} > .container`;
const form = `${sheet} form[name='prior_auth']`;
const fieldset = `${form} fieldset`;
const comments = `${form} textarea[name='comments']`;

// Literal production proposal: insert before </head>, then add one body class.
const CSS = `<style>
@media screen {
  ${prefix} {
    box-sizing: border-box;
    margin: 0;
    padding: clamp(0.75rem, 2.5vw, 1.5rem);
    background-color: var(--oe-wb-canvas, #edf2f3) !important;
    color: var(--oe-wb-ink, #182c36) !important;
  }

  ${sheet} {
    box-sizing: border-box;
    width: min(100%, 860px);
    max-width: 860px;
    margin-inline: auto;
    padding: clamp(1.25rem, 3vw, 2.25rem);
    border: 1px solid var(--oe-wb-line, #cbd6da);
    border-radius: 7px;
    background-color: var(--oe-wb-paper, #fff) !important;
    color: var(--oe-wb-ink, #182c36) !important;
    line-height: 1.5;
  }

  ${sheet} > .row,
  ${sheet} > .row > .col-12,
  ${form} > .form-group > .col-sm-12 {
    margin-inline: 0;
    padding-inline: 0;
    min-width: 0;
  }

  ${sheet} h2 {
    margin: 0 0 1.5rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid var(--oe-wb-line, #cbd6da);
    color: var(--oe-wb-ink, #182c36) !important;
    font-size: clamp(1.4rem, 2vw, 1.65rem);
    font-weight: 650;
    line-height: 1.25;
  }

  ${fieldset} {
    min-width: 0;
    margin: 0 0 1.5rem;
    padding: 1rem 1.25rem 1.25rem;
    border: 1px solid var(--oe-wb-line, #cbd6da);
    border-radius: 6px;
    background-color: var(--oe-wb-paper, #fff) !important;
    color: var(--oe-wb-ink, #182c36) !important;
  }

  ${fieldset} legend {
    width: auto;
    margin: 0;
    padding: 0 0.35rem;
    color: var(--oe-wb-petrol, #145968) !important;
    background-color: var(--oe-wb-paper, #fff) !important;
    font-size: 0.95rem;
    font-weight: 700;
    line-height: 1.4;
  }

  ${fieldset} .form-group {
    margin-top: 0.5rem !important;
    margin-bottom: 0;
  }

  ${fieldset} .row {
    margin-inline: 0;
    row-gap: 1rem;
  }

  ${fieldset} .row > [class^='col-'] {
    min-width: 0;
  }

  ${form} label {
    display: block;
    margin-bottom: 0.35rem;
    color: var(--oe-wb-ink, #182c36) !important;
    font-size: 0.85rem;
    font-weight: 600;
    line-height: 1.45;
  }

  ${form} input.form-control,
  ${comments} {
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    padding: 0.55rem 0.7rem;
    border: 1px solid #91a8b1;
    border-radius: 4px;
    background-color: var(--oe-wb-paper, #fff) !important;
    color: var(--oe-wb-ink, #182c36) !important;
    font: inherit;
  }

  ${form} input.form-control {
    min-height: 2.65rem;
  }

  ${comments} {
    min-height: 12rem;
    line-height: 1.7;
    resize: vertical;
  }

  ${form} .btn-group {
    display: flex;
    flex-wrap: wrap;
    gap: 0.65rem;
    margin-top: 0.25rem;
  }

  ${form} .btn-save,
  ${form} .btn-cancel {
    min-width: 7rem;
    min-height: 2.7rem;
    border-radius: 4px;
    font-weight: 600;
  }

  ${form} .btn-save {
    border-color: var(--oe-wb-petrol, #145968);
    background-color: var(--oe-wb-petrol, #145968) !important;
    color: var(--oe-wb-on-petrol, #fff) !important;
  }

  ${form} .btn-cancel {
    border-color: #91a8b1;
    background-color: var(--oe-wb-paper, #fff) !important;
    color: var(--oe-wb-ink, #182c36) !important;
  }

  ${form} input.form-control:focus-visible,
  ${comments}:focus-visible,
  ${form} .btn-save:focus-visible,
  ${form} .btn-cancel:focus-visible {
    outline: 3px solid #b65020;
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
  assert.notEqual(at, -1, `missing seam: ${before.slice(0, 60)}`);
  assert.equal(at, value.lastIndexOf(needle), `duplicate seam: ${before.slice(0, 60)}`);
  return Buffer.concat([value.subarray(0, at), Buffer.from(after), value.subarray(at + needle.length)]);
}

function replaceFirst(bytes, before, after) {
  const value = Buffer.from(bytes);
  const needle = Buffer.from(before);
  const at = value.indexOf(needle);
  assert.notEqual(at, -1, `missing mutation seam: ${before.slice(0, 60)}`);
  return Buffer.concat([value.subarray(0, at), Buffer.from(after), value.subarray(at + needle.length)]);
}

function original() {
  const bytes = read(fixture);
  assert.equal(bytes.length, 3255, 'whole original length');
  assert.equal(hash(bytes), SHA, 'whole original SHA-256');
  return bytes;
}

function proposed(baseline) {
  let value = replaceOnce(baseline, '\n</head>\n<body>', `\n${CSS}\n</head>\n<body>`);
  value = replaceOnce(value, '<body>', '<body class="prior-auth-document-editor">');
  return value;
}

function verifySource(candidate, baseline) {
  let inverse = replaceOnce(candidate, '<body class="prior-auth-document-editor">', '<body>');
  inverse = replaceOnce(inverse, `\n${CSS}\n</head>`, '\n</head>');
  assert.deepEqual(inverse, baseline, 'inverse restores every original byte');
  assert.deepEqual(candidate, proposed(baseline), 'only the two literal presentation additions');
}

function rules(css) {
  assert.match(css, /^<style>\n@media screen \{\n/);
  assert.match(css, /\n\}\n<\/style>$/);
  assert.equal((css.match(/@media/g) || []).length, 1);
  const inner = css.slice('<style>\n@media screen {\n'.length, -'\n}\n</style>'.length);
  const found = [...inner.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
  assert.equal(inner.replace(/([^{}]+)\{([^{}]*)\}/g, '').trim(), '', 'flat CSS rules only');
  return found.map((match) => ({ selectors: match[1].split(',').map((part) => part.trim()), declarations: match[2] }));
}

function values(css, selector, property) {
  return rules(css).filter((rule) => rule.selectors.includes(selector)).flatMap((rule) =>
    [...rule.declarations.matchAll(new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+);`, 'g'))].map((match) => match[1].trim()));
}

function verifyCss(css) {
  assert.doesNotMatch(css, /@media print|@import|<script|spellcheck|autocorrect|\boverflow\s*:\s*hidden/);
  for (const rule of rules(css)) for (const selector of rule.selectors) {
    assert.ok(selector === prefix || selector.startsWith(`${prefix} `), `unscoped selector: ${selector}`);
    assert.ok(!selector.includes('input[type="hidden"]'), `hidden control: ${selector}`);
  }
  for (const [selector, property, expected] of [
    [prefix, 'background-color', 'var(--oe-wb-canvas, #edf2f3) !important'],
    [prefix, 'color', 'var(--oe-wb-ink, #182c36) !important'],
    [sheet, 'width', 'min(100%, 860px)'], [sheet, 'max-width', '860px'],
    [sheet, 'padding', 'clamp(1.25rem, 3vw, 2.25rem)'],
    [sheet, 'background-color', 'var(--oe-wb-paper, #fff) !important'],
    [`${sheet} > .row`, 'margin-inline', '0'],
    [`${sheet} > .row > .col-12`, 'padding-inline', '0'],
    [`${form} > .form-group > .col-sm-12`, 'padding-inline', '0'],
    [`${sheet} h2`, 'margin', '0 0 1.5rem'],
    [fieldset, 'margin', '0 0 1.5rem'],
    [fieldset, 'background-color', 'var(--oe-wb-paper, #fff) !important'],
    [`${fieldset} legend`, 'color', 'var(--oe-wb-petrol, #145968) !important'],
    [`${fieldset} legend`, 'background-color', 'var(--oe-wb-paper, #fff) !important'],
    [`${fieldset} .row`, 'margin-inline', '0'], [`${fieldset} .row`, 'row-gap', '1rem'],
    [`${form} label`, 'color', 'var(--oe-wb-ink, #182c36) !important'],
    [`${form} input.form-control`, 'width', '100%'],
    [comments, 'width', '100%'], [comments, 'min-height', '12rem'], [comments, 'line-height', '1.7'],
    [`${form} input.form-control`, 'background-color', 'var(--oe-wb-paper, #fff) !important'],
    [`${form} input.form-control`, 'color', 'var(--oe-wb-ink, #182c36) !important'],
    [comments, 'background-color', 'var(--oe-wb-paper, #fff) !important'],
    [comments, 'color', 'var(--oe-wb-ink, #182c36) !important'],
    [`${form} .btn-group`, 'gap', '0.65rem'],
    [`${form} .btn-save`, 'background-color', 'var(--oe-wb-petrol, #145968) !important'],
    [`${form} .btn-save`, 'color', 'var(--oe-wb-on-petrol, #fff) !important'],
    [`${form} .btn-cancel`, 'background-color', 'var(--oe-wb-paper, #fff) !important'],
    [`${form} .btn-cancel`, 'color', 'var(--oe-wb-ink, #182c36) !important'],
    [`${form} input.form-control:focus-visible`, 'outline', '3px solid #b65020'],
    [`${comments}:focus-visible`, 'outline', '3px solid #b65020'],
    [`${form} .btn-save:focus-visible`, 'outline', '3px solid #b65020'],
    [`${form} .btn-cancel:focus-visible`, 'outline', '3px solid #b65020']
  ]) assert.deepEqual(values(css, selector, property), [expected], `${selector}: ${property}`);
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

function verifyScope(paths) {
  assert.deepEqual(new Set(paths), testsOnly, 'tests-only phase has exactly three paths');
}

function verifyFinalScope(paths) {
  assert.deepEqual(new Set(paths), finalPaths, 'final phase has exactly five paths');
}

module.exports = { CSS, original, proposed, verifySource, verifyCss, verifyScope, verifyFinalScope, changedPaths };

if (require.main === module) {
  const test = require('node:test');
  const args = process.argv.slice(2);
  assert.ok(args.length <= 1 && args.every((arg) => arg === '--history'), 'only --history is supported');

  test('whole fixture preserves native authorization, fields, values, date picker and actions', () => {
    const text = original().toString();
    for (const token of [
      "{headerTemplate assets='datetime-picker'}", "{datetimepickerSupport input='format'}",
      'action="{$FORM_ACTION}/interface/forms/prior_auth/save.php"', 'onsubmit="return top.restoreSession()"',
      'name="csrf_token_form" value="{$CSRF_TOKEN_FORM|attr}"',
      'name="prior_auth_number" value="{$prior_auth->get_prior_auth_number()|attr}"',
      "name='date_from' id='date_from' value='{$prior_auth->get_date_from()|oeFormatShortDate|attr}'",
      "name='date_to' id='date_to' value='{$prior_auth->get_date_to()|oeFormatShortDate|attr}'",
      'name="comments" value="{$prior_auth->get_comments()|attr}" wrap="virtual" cols="75" rows="8">{$prior_auth->get_comments()|text}',
      'onclick="top.restoreSession();" name="Submit"',
      "onclick=\"top.restoreSession(); location.href='{$DONT_SAVE_LINK}';\"",
      'name="id" value="{$prior_auth->get_id()|attr}"',
      'name="activity" value="{$prior_auth->get_activity()|attr}"',
      'name="pid" value="{$prior_auth->get_pid()|attr}"', 'name="process" value="true"'
    ]) assert.ok(text.includes(token), token);
  });

  test('screen CSS is scoped, readable, paired and keyboard visible', () => verifyCss(CSS));
  test('proposal and inverse preserve every original byte', () => {
    const baseline = original();
    verifySource(proposed(baseline), baseline);
  });
  test('proposal gives the scoped legend a paper background', () => {
    const baseline = original();
    const candidate = proposed(baseline);
    assert.deepEqual(values(CSS, `${fieldset} legend`, 'background-color'), ['var(--oe-wb-paper, #fff) !important']);
    verifySource(candidate, baseline);
  });
  test('original lacks only the presentation additions', () => {
    const baseline = original();
    assert.throws(() => verifySource(baseline, baseline), /missing seam: <body class/);
  });
  test('actual template has the exact scoped presentation proposal', () => verifySource(read(source), original()));

  test('native semantics mutants reject', () => {
    const baseline = original();
    const candidate = proposed(baseline);
    for (const [before, after] of [
      ["{headerTemplate assets='datetime-picker'}", "{headerTemplate assets=''}"],
      ["{datetimepickerSupport input='format'}", "{datetimepickerSupport input='other'}"],
      ['action="{$FORM_ACTION}/interface/forms/prior_auth/save.php"', 'action="/other.php"'],
      ['onsubmit="return top.restoreSession()"', 'onsubmit="return true"'],
      ['name="csrf_token_form"', 'name="other_token"'],
      ['{$CSRF_TOKEN_FORM|attr}', '{$CSRF_TOKEN_FORM}'],
      ['name="prior_auth_number"', 'name="other_number"'],
      ['get_prior_auth_number()|attr', 'get_other_number()|attr'],
      ["name='date_from'", "name='other_from'"],
      ["id='date_from'", "id='other_from'"],
      ["get_date_from()|oeFormatShortDate|attr", "get_date_from()|attr"],
      ["name='date_to'", "name='other_to'"],
      ["id='date_to'", "id='other_to'"],
      ["get_date_to()|oeFormatShortDate|attr", "get_date_to()|attr"],
      ['name="comments"', 'name="other_comments"'],
      ['get_comments()|attr', 'get_comments()|text'],
      ['get_comments()|text', 'get_comments()|attr'],
      ['wrap="virtual" cols="75" rows="8"', 'rows="4"'],
      ['type="submit" class="btn btn-primary btn-save"', 'type="button" class="btn btn-primary btn-save"'],
      ['name="Submit"', 'name="Other"'],
      ['location.href=\'{$DONT_SAVE_LINK}\'', 'location.href=\'/other\''],
      ['name="id"', 'name="other_id"'], ['name="activity"', 'name="other_activity"'],
      ['name="pid"', 'name="other_pid"'], ['name="process" value="true"', 'name="process" value="false"']
    ]) {
      const mutant = replaceOnce(candidate, before, after);
      assert.throws(() => verifySource(mutant, baseline), `rejected: ${before}`);
    }
  });

  test('media, scope, print, spacing, palette and focus mutants reject independently', () => {
    for (const [before, after] of [
      ['@media screen {', '@media print {'],
      [`${prefix} {`, 'body {'],
      ['max-width: 860px;', 'max-width: 1200px;'],
      ['padding: clamp(1.25rem, 3vw, 2.25rem);', 'padding: 0;'],
      ['row-gap: 1rem;', 'row-gap: 0;'],
      ['min-height: 12rem;', 'min-height: 4rem;'],
      ['line-height: 1.7;', 'line-height: 1;'],
      ['background-color: var(--oe-wb-paper, #fff) !important;', 'background-color: #222 !important;'],
      ['color: var(--oe-wb-ink, #182c36) !important;', 'color: #fff !important;'],
      ['color: var(--oe-wb-on-petrol, #fff) !important;', 'color: #145968 !important;'],
      ['outline: 3px solid #b65020;', 'outline: none;']
    ]) {
      const mutant = replaceFirst(Buffer.from(CSS), before, after).toString();
      assert.throws(() => verifyCss(mutant), `rejected CSS: ${before}`);
      assert.throws(() => verifySource(replaceFirst(proposed(original()), before, after), original()), `rejected source: ${before}`);
    }
  });

  test('legend background mutants reject at the scoped source rule', () => {
    const baseline = original();
    const candidate = proposed(baseline);
    const before = `  ${fieldset} legend {\n    width: auto;\n    margin: 0;\n    padding: 0 0.35rem;\n    color: var(--oe-wb-petrol, #145968) !important;\n    background-color: var(--oe-wb-paper, #fff) !important;\n`;
    for (const replacement of ['', '    background-color: #d1d5db !important;\n']) {
      const after = before.replace('    background-color: var(--oe-wb-paper, #fff) !important;\n', replacement);
      const sourceMutant = replaceOnce(candidate, before, after);
      const cssMutant = replaceOnce(Buffer.from(CSS), before, after).toString();
      assert.throws(() => verifySource(sourceMutant, baseline));
      assert.throws(() => verifyCss(cssMutant));
    }
  });

  test('tests-only and final path sets are distinct and exact', () => {
    verifyScope(testsOnly);
    verifyFinalScope(finalPaths);
    assert.throws(() => verifyScope(finalPaths));
    assert.throws(() => verifyFinalScope(testsOnly));
    assert.throws(() => verifyFinalScope([...finalPaths, 'interface/forms/prior_auth/save.php']));
  });

  if (args.includes('--history')) {
    test('pinned base authenticates fixture and unchanged support bytes', () => {
      assert.deepEqual(original(), git('show', `${BASE}:${source}`));
      for (const [name, expected] of support) {
        const base = git('show', `${BASE}:${name}`);
        assert.equal(hash(base), expected, name);
        assert.deepEqual(git('show', `HEAD:${name}`), base, `HEAD ${name}`);
        assert.deepEqual(read(name), base, `working ${name}`);
      }
    });
    test('combined committed, staged, dirty and untracked scope is exact', () => {
      const paths = changedPaths();
      if (paths.has(source) || paths.has('docs/clinical-ui/PRIOR-AUTH-EDITOR.md')) verifyFinalScope(paths);
      else verifyScope(paths);
    });
  }
}
