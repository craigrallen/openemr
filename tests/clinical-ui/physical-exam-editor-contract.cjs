'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const test = require('node:test');

const root = path.resolve(__dirname, '../..');
const BASE = '09b29da7771aea334ed5745e058751157af980d7';
const source = 'interface/forms/physical_exam/new.php';
const fixture = 'tests/clinical-ui/fixtures/physical-exam-new-original.php.txt';
const SHA = 'fbfe165981c443276aa99483f6ea4d72c8f11fabf669a4fe78d9a4ef1adc9fc6';
const testsOnly = new Set([
  fixture, 'tests/clinical-ui/physical-exam-editor-contract.cjs',
  'tests/js/physical-exam-editor.test.js'
]);
const finalPaths = new Set([...testsOnly, source, 'docs/clinical-ui/PHYSICAL-EXAM-EDITOR.md']);
const support = new Map([
  ['interface/forms/physical_exam/lines.php', '6c641b73ea21dc84b2874ae6c511bd12fe73f3bb1bf3f0e856043e0220b29463'],
  ['interface/forms/physical_exam/view.php', '4f3e23d78fe30bc889510d74d2c28227177c67afe3a4ac81c4743af61223efd3'],
  ['interface/forms/physical_exam/edit_diagnoses.php', '48442d95d04d295a1e7c752198962b00b321873aba306423bd7cb6a4e27da6ac'],
  ['interface/clinical-workspace/popup.css', 'ea56e9f26990e843219a68f315c188f7e2b0581c20321bac4517dc4ba34e79a9'],
  ['interface/themes/theme-defaults.scss', '0d01ace0600aada5fd2f82fc35bf76ef9083710f5cc5649e341a20cd97eaa773'],
  ['docs/clinical-ui/PLAN.md', 'af7ffa3640ecd6646ae1d28b3b8551e3393d163de4648fb45aa3d32ad74f3e3c'],
  ['docs/clinical-ui/ACCEPTANCE.md', '4da96cca6eaeb633c87a97bea87e8b0180ce6e6b128bf26ebc38716d84af33f8']
]);
const prefix = 'html.oe-workbench-context body.physical-exam-document-editor';
const form = `${prefix} > form`;
const center = `${form} > center`;
const table = `${center} > table`;
const save = `${center} > p > input[type='submit'][name='bn_save']`;
const cancel = `${center} > p > input[type='button'][onclick='parent.closeTab(window.name, false)']`;
const diagnosis = `${table} select[name^='form_obs['][name$='[diagnosis]']`;
const comments = `${table} input[type='text'][name^='form_obs['][name$='[comments]']`;

// The production proposal: precisely this inline style before </head> and one body class.
const CSS = `    <style>
    @media screen {
      ${prefix} {
        box-sizing: border-box;
        margin: 0;
        padding: clamp(0.5rem, 2vw, 1.5rem);
        background-color: #e8eff0 !important;
        color: #182c36 !important;
      }

      ${form} {
        box-sizing: border-box;
        width: 100%;
        max-width: 1100px;
        margin-inline: auto;
        padding: clamp(0.75rem, 2.5vw, 2rem);
        border: 1px solid #c7d5d9;
        background-color: #fff;
        color: #182c36;
        line-height: 1.5;
      }

      ${center} {
        box-sizing: border-box;
        width: 100%;
        max-width: 100%;
        overflow-x: auto;
        padding: 0 0.25rem 0.5rem;
        text-align: left;
      }

      ${center} > p:first-of-type {
        margin: 0;
      }

      ${table} {
        width: 100%;
        min-width: 1020px;
        border-collapse: collapse;
        color: #182c36;
        background-color: #fff;
      }

      ${table} td {
        padding: 0.55rem 0.6rem;
        border-bottom: 1px solid #d9e4e2;
        vertical-align: middle;
        line-height: 1.45;
      }

      ${table} td:nth-child(1),
      ${table} td:nth-child(2) {
        min-width: 4rem;
        text-align: center;
      }

      ${table} td:nth-child(3) {
        min-width: 5rem;
      }

      ${table} td:nth-child(4) {
        min-width: 19rem;
      }

      ${table} td:nth-child(5) {
        min-width: 13rem;
      }

      ${table} td:nth-child(6) {
        min-width: 16rem;
      }

      ${table} td[colspan='6'] {
        padding-block: 1.1rem 0.6rem;
        color: #183b49;
        background-color: #f3f7f5;
      }

      ${table} td[colspan='2'] {
        padding-block: 0.7rem;
      }

      ${diagnosis},
      ${comments} {
        box-sizing: border-box;
        min-width: 12rem;
        min-height: 2.65rem;
        padding: 0.45rem 0.6rem;
        border: 1px solid #91a8b1;
        border-radius: 3px;
        background-color: #fff;
        color: #182c36;
      }

      ${table} td[colspan='2'] ${comments.slice(table.length + 1)} {
        min-width: 16rem;
      }

      ${table} tr:first-child td {
        padding-block: 0.75rem;
        background-color: #e8eff0;
        color: #183b49;
        font-weight: 600;
      }

      ${center} > p:last-of-type {
        position: sticky;
        left: 0;
        width: max-content;
        max-width: 100%;
        margin-block: 1.25rem 0;
        padding-block: 0.75rem 0;
        background-color: #fff;
      }

      ${save},
      ${cancel} {
        box-sizing: border-box;
        min-width: 7rem;
        min-height: 2.75rem;
        padding: 0.55rem 0.85rem;
        border-radius: 3px;
        font-weight: 600;
        cursor: pointer;
      }

      ${save} {
        border: 1px solid #145968;
        background-color: #145968 !important;
        color: #fff !important;
      }

      ${save}:hover,
      ${save}:focus {
        border-color: #104e5b;
        background-color: #104e5b !important;
        color: #fff !important;
      }

      ${cancel} {
        border: 1px solid #91a8b1;
        background-color: #fff !important;
        color: #182c36 !important;
      }

      ${cancel}:hover,
      ${cancel}:focus {
        border-color: #145968;
        background-color: #e4f0f1 !important;
        color: #182c36 !important;
      }

      ${diagnosis}:focus,
      ${comments}:focus,
      ${table} input[type='checkbox']:focus,
      ${save}:focus,
      ${cancel}:focus {
        outline: 2px solid #a84c22;
        outline-offset: 2px;
      }

      ${diagnosis}:focus-visible,
      ${comments}:focus-visible,
      ${table} input[type='checkbox']:focus-visible,
      ${save}:focus-visible,
      ${cancel}:focus-visible {
        outline: 3px solid #a84c22;
        outline-offset: 2px;
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
  assert.notEqual(at, -1, `missing seam: ${before.slice(0, 60)}`);
  assert.equal(at, value.lastIndexOf(needle), `duplicate seam: ${before.slice(0, 60)}`);
  return Buffer.concat([value.subarray(0, at), Buffer.from(after), value.subarray(at + needle.length)]);
}

function original() {
  const bytes = read(fixture);
  assert.equal(hash(bytes), SHA, 'original fixture SHA-256');
  return bytes;
}

function proposed(baseline) {
  let value = replaceOnce(baseline, '</head>', `${CSS}\n</head>`);
  value = replaceOnce(value, '<body class="body_top">', '<body class="body_top physical-exam-document-editor">');
  return value;
}

function verifySource(candidate, baseline) {
  let inverse = replaceOnce(candidate, '<body class="body_top physical-exam-document-editor">', '<body class="body_top">');
  inverse = replaceOnce(inverse, `${CSS}\n</head>`, '</head>');
  assert.deepEqual(inverse, baseline, 'full inverse restores every original byte');
  assert.deepEqual(candidate, proposed(baseline), 'only the exact presentation additions are present');
}

function splitSelectors(selectorList) {
  const selectors = [];
  let start = 0;
  let quote = null;
  let brackets = 0;
  let parentheses = 0;
  for (let i = 0; i < selectorList.length; i++) {
    const char = selectorList[i];
    if (quote) {
      if (char === '\\') i++;
      else if (char === quote) quote = null;
    } else if (char === "'" || char === '"') quote = char;
    else if (char === '[') brackets++;
    else if (char === ']') brackets--;
    else if (char === '(') parentheses++;
    else if (char === ')') parentheses--;
    else if (char === ',' && brackets === 0 && parentheses === 0) {
      selectors.push(selectorList.slice(start, i).trim());
      start = i + 1;
    }
  }
  selectors.push(selectorList.slice(start).trim());
  return selectors;
}

function rules(css) {
  const inner = css.replace(/^    <style>\n    @media screen \{\n/, '').replace(/\n    \}\n    <\/style>$/, '');
  return [...inner.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    selectors: splitSelectors(match[1]),
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
  assert.doesNotMatch(css, /@media print|\bdisplay\s*:\s*(?:none|grid|flex|block|table)|\bvisibility\s*:\s*hidden|\bopacity\s*:\s*0|overflow-wrap\s*:\s*anywhere|table-layout\s*:\s*fixed/);
  assert.doesNotMatch(css, /\boverflow-y\s*:\s*(?:auto|hidden|clip)|\boverflow-x\s*:\s*(?:hidden|clip)/);
  const cssRules = rules(css);
  const firstRow = `${table} tr:first-child td`;
  const firstRowIndex = cssRules.findIndex((rule) => rule.selectors.includes(firstRow));
  assert.notEqual(firstRowIndex, -1, 'first-row rule exists');
  for (const selector of [
    `${table} td`,
    ...[1, 2, 3, 4, 5, 6].map((column) => `${table} td:nth-child(${column})`),
    `${table} td[colspan='6']`,
    `${table} td[colspan='2']`,
    `${table} td[colspan='2'] ${comments.slice(table.length + 1)}`
  ]) {
    const columnIndex = cssRules.findIndex((rule) => rule.selectors.includes(selector));
    assert.ok(columnIndex >= 0 && columnIndex < firstRowIndex, `${selector} precedes first-row rule`);
  }
  for (const [property, expected] of [
    ['padding-block', '0.75rem'],
    ['background-color', '#e8eff0'],
    ['color', '#183b49'],
    ['font-weight', '600']
  ]) expectValue(css, firstRow, property, expected);
  for (const rule of cssRules) for (const selector of rule.selectors) {
    assert.ok(selector === prefix || selector.startsWith(`${prefix} `), `unscoped: ${selector}`);
    assert.ok(!/\b(?:table|tr|td)\b.*\bdisplay\s*:/.test(`${selector} {${rule.declarations}`));
    for (const declaration of rule.declarations.match(/[^;]+;/g) || []) {
      if (!declaration.includes('!important')) continue;
      assert.match(declaration, /(?:background-color|color)\s*:/);
      assert.ok([prefix, save, cancel, `${save}:hover`, `${save}:focus`, `${cancel}:hover`, `${cancel}:focus`].includes(selector), selector);
    }
  }
  for (const [selector, property, expected] of [
    [prefix, 'background-color', '#e8eff0 !important'], [prefix, 'color', '#182c36 !important'],
    [form, 'max-width', '1100px'], [form, 'width', '100%'],
    [center, 'overflow-x', 'auto'], [center, 'max-width', '100%'],
    [table, 'min-width', '1020px'], [table, 'width', '100%'],
    [`${table} td:nth-child(1)`, 'min-width', '4rem'],
    [`${table} td:nth-child(2)`, 'min-width', '4rem'],
    [`${table} td:nth-child(3)`, 'min-width', '5rem'],
    [`${table} td:nth-child(4)`, 'min-width', '19rem'],
    [`${table} td:nth-child(5)`, 'min-width', '13rem'],
    [`${table} td:nth-child(6)`, 'min-width', '16rem'],
    [diagnosis, 'min-width', '12rem'], [comments, 'min-width', '12rem'],
    [diagnosis, 'background-color', '#fff'], [diagnosis, 'color', '#182c36'],
    [comments, 'background-color', '#fff'], [comments, 'color', '#182c36'],
    [`${center} > p:last-of-type`, 'position', 'sticky'],
    [save, 'background-color', '#145968 !important'], [save, 'color', '#fff !important'],
    [cancel, 'background-color', '#fff !important'], [cancel, 'color', '#182c36 !important'],
    [`${diagnosis}:focus`, 'outline', '2px solid #a84c22'],
    [`${diagnosis}:focus-visible`, 'outline', '3px solid #a84c22'],
    [`${comments}:focus-visible`, 'outline', '3px solid #a84c22'],
    [`${table} input[type='checkbox']:focus-visible`, 'outline', '3px solid #a84c22'],
    [`${save}:focus-visible`, 'outline', '3px solid #a84c22'],
    [`${cancel}:focus-visible`, 'outline', '3px solid #a84c22']
  ]) expectValue(css, selector, property, expected);
  for (const [button, fill, ink] of [[save, '#104e5b', '#fff'], [cancel, '#e4f0f1', '#182c36']]) {
    for (const state of [':hover', ':focus']) {
      expectValue(css, `${button}${state}`, 'background-color', `${fill} !important`);
      expectValue(css, `${button}${state}`, 'color', `${ink} !important`);
    }
  }
  assert.doesNotMatch(css, /input\[type=['"]checkbox['"]\][^{]*\{[^}]*\b(?:width|height|font-size|padding)\s*:/);
}

function rejectMutation(candidate, before, after, baseline) {
  const mutant = replaceOnce(candidate, before, after);
  assert.ok(!mutant.equals(candidate), `mutation constructed: ${before}`);
  assert.throws(() => verifySource(mutant, baseline), `rejected: ${before}`);
}

function rejectCssMutation(before, after) {
  const mutant = replaceOnce(Buffer.from(CSS), before, after);
  assert.ok(!mutant.equals(Buffer.from(CSS)), `CSS mutation constructed: ${before}`);
  assert.throws(() => verifyCss(mutant.toString()), `rejected CSS: ${before}`);
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
  const actual = new Set(paths);
  assert.deepEqual(actual, testsOnly, 'tests-only phase has exactly three files');
}

function verifyFinalScope(paths) {
  assert.deepEqual(new Set(paths), finalPaths, 'final phase has exactly five files');
}

const args = process.argv.slice(2);
assert.ok(args.every((arg) => arg === '--history') && args.length <= 1, 'invalid option');

test('original fixture is complete and retains clinical, CSRF, save and native action seams', () => {
  const value = original().toString();
  for (const token of [
    'EncounterFormAccess::assertFormBelongsToSessionPatient',
    'CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: true)',
    'QueryUtils::inTransaction(function',
    'DELETE FROM form_physical_exam WHERE forms_id = ?',
    'INSERT INTO form_physical_exam (forms_id, line_id, wnl, abn, diagnosis, comments)',
    'SELECT * FROM form_physical_exam WHERE forms_id = ?',
    'form_obs[{$id}][wnl]', 'form_obs[{$id}][abn]',
    'form_obs[{$id}][diagnosis]', 'form_obs[{$id}][comments]',
    "<option value='*'>-- Edit --</option>",
    'dlgopen(\'../../forms/physical_exam/edit_diagnoses.php?lineid=\'',
    "f.form_refresh.value = '1'", 'f.submit()',
    'name="csrf_token_form"', "name='bn_save'", "type='button'",
    'parent.closeTab(window.name, false)', "colspan='6'", "colspan='2'",
    'echo $showExamLine(', 'echo $showTreatmentLine('
  ]) assert.ok(value.includes(token), token);
  assert.equal((value.match(/<td align='center'><input type='checkbox'/g) || []).length, 3);
  assert.equal((value.match(/<td align='left'/g) || []).length, 4);
});

test('screen-only scoped proposal keeps a document workspace and native table rows', () => verifyCss(CSS));

test('first-row declarations follow every table column rule', () => {
  const firstRowRule = `      ${table} tr:first-child td {\n        padding-block: 0.75rem;\n        background-color: #e8eff0;\n        color: #183b49;\n        font-weight: 600;\n      }\n\n`;
  const withoutFirstRow = replaceOnce(Buffer.from(CSS), firstRowRule, '');
  const firstColumn = `      ${table} td:nth-child(1),`;
  const mutant = replaceOnce(withoutFirstRow, firstColumn, `${firstRowRule}${firstColumn}`);
  assert.throws(() => verifyCss(mutant.toString()), /precedes first-row rule/);
});

test('proposal builds and full inverse restores original bytes', () => {
  const baseline = original();
  verifySource(proposed(baseline), baseline);
});

test('untouched original fails solely for missing presentation', () => {
  const baseline = original();
  assert.throws(() => verifySource(baseline, baseline), /missing seam: <body class=/);
});

test('actual physical exam source matches exact presentation proposal', () => {
  verifySource(read(source), original());
});

test('clinical, PHP, SQL, CSRF, field, value, JS and native action mutants fail', () => {
  const baseline = original();
  const candidate = proposed(baseline);
  for (const [before, after] of [
    ['EncounterFormAccess::assertFormBelongsToSessionPatient', 'EncounterFormAccess::skip'],
    ['CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: true)', 'true'],
    ['QueryUtils::inTransaction(function', 'QueryUtils::withoutTransaction(function'],
    ['DELETE FROM form_physical_exam WHERE forms_id = ?', 'DELETE FROM forms WHERE id = ?'],
    ['INSERT INTO form_physical_exam (forms_id, line_id, wnl, abn, diagnosis, comments)', 'INSERT INTO other_table (forms_id, line_id, wnl, abn, diagnosis, comments)'],
    ['form_obs[{$id}][abn]', 'form_obs[{$id}][other]'],
    ['form_obs[{$id}][diagnosis]', 'form_obs[{$id}][other]'],
    ["<td><input type='text' name='form_obs[{$id}][comments]'", "<td><input type='text' name='form_obs[{$id}][other]'"],
    ["value='1'{$abnChecked}", "value='0'{$abnChecked}"],
    ["<option value='*'>-- Edit --</option>", "<option value=''>-- Edit --</option>"],
    ["f.form_refresh.value = '1'", "f.form_refresh.value = ''"],
    ['f.submit()', 'void 0'],
    ["<input type='submit' name='bn_save' value='<?php echo xla('Save'); ?>' />", "<input type='submit' name='other' value='<?php echo xla('Save'); ?>' />"],
    ["<input type='button' value='<?php echo xla('Cancel'); ?>'", "<input type='submit' value='<?php echo xla('Cancel'); ?>'"],
    ['onclick="parent.closeTab(window.name, false)"', 'onclick="window.close()"'],
    ["<tr><td colspan='6'>&nbsp;", "<tr><td colspan='5'>&nbsp;"],
    ['echo $showTreatmentLine(', 'echo $showExamLine(']
  ]) rejectMutation(candidate, before, after, baseline);
});

test('presentation, media, scope, column, scroll, focus and palette mutants fail', () => {
  const baseline = original();
  const candidate = proposed(baseline);
  for (const [before, after] of [
    ['<body class="body_top physical-exam-document-editor">', '<body class="body_top other-editor">'],
    ['@media screen {', '@media print {'],
    [`${prefix} {`, 'body {'],
    ['max-width: 1100px;', 'max-width: 1400px;'],
    ['overflow-x: auto;', 'overflow-x: hidden;'],
    ['min-width: 1020px;', 'min-width: 400px;'],
    ['min-width: 19rem;', 'min-width: 2rem;'],
    [`${table} td:nth-child(6) {\n        min-width: 16rem;`, `${table} td:nth-child(6) {\n        min-width: 2rem;`],
    ['position: sticky;', 'position: static;'],
    ['outline: 3px solid #a84c22;', 'outline: none;'],
    ['background-color: #145968 !important;', 'background-color: #145968;'],
    [`${save} {\n        border: 1px solid #145968;\n        background-color: #145968 !important;\n        color: #fff !important;`, `${save} {\n        border: 1px solid #145968;\n        background-color: #145968 !important;\n        color: #182c36 !important;`]
  ]) rejectMutation(candidate, before, after, baseline);
  for (const [before, after] of [
    ['@media screen {', '@media print {'],
    [`${prefix} {`, 'body {'],
    ['max-width: 1100px;', 'max-width: 1400px;'],
    ['overflow-x: auto;', 'overflow-x: hidden;'],
    ['min-width: 1020px;', 'min-width: 400px;'],
    ['min-width: 19rem;', 'min-width: 2rem;'],
    ['min-width: 13rem;', 'min-width: 2rem;'],
    ['position: sticky;', 'position: static;'],
    ['outline: 3px solid #a84c22;', 'outline: none;'],
    ['background-color: #145968 !important;', 'background-color: #145968;']
  ]) rejectCssMutation(before, after);
});

test('tests-only and final five-path scope oracles distinguish delivery phases', () => {
  verifyScope(testsOnly);
  verifyFinalScope(finalPaths);
  assert.throws(() => verifyScope(finalPaths));
  assert.throws(() => verifyFinalScope(testsOnly));
  assert.throws(() => verifyFinalScope([...finalPaths, 'interface/forms/physical_exam/lines.php']));
});

if (args.includes('--history')) {
  test('authenticated origin/master supplies original and unchanged support bytes', () => {
    assert.equal(git('rev-parse', 'origin/master').toString().trim(), BASE);
    assert.deepEqual(original(), git('show', `${BASE}:${source}`));
    for (const [name, expected] of support) {
      const base = git('show', `${BASE}:${name}`);
      assert.equal(hash(base), expected, name);
      assert.deepEqual(git('show', `HEAD:${name}`), base, `HEAD ${name}`);
      assert.deepEqual(read(name), base, `working ${name}`);
    }
  });

  test('committed, working, staged and untracked scope is exact for current phase', () => {
    const paths = changedPaths();
    if (paths.has(source) || paths.has('docs/clinical-ui/PHYSICAL-EXAM-EDITOR.md')) verifyFinalScope(paths);
    else verifyScope(paths);
  });
}

module.exports = { CSS, proposed, verifySource, verifyCss, verifyScope, verifyFinalScope };
