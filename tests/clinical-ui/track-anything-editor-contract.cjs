'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const test = require('node:test');

const root = path.resolve(__dirname, '../..');
const BASE = '09b29da7771aea334ed5745e058751157af980d7';
const source = 'interface/forms/track_anything/new.php';
const fixture = 'tests/clinical-ui/fixtures/track-anything-new-original.php.txt';
const SHA = '0ed7945d1e65fbc716b77453c667c7e1b5d490ed1ca8aa942efac3ff9c5067e8';
const testsOnly = new Set([
  fixture, 'tests/clinical-ui/track-anything-editor-contract.cjs',
  'tests/js/track-anything-editor.test.js'
]);
const finalPaths = new Set([...testsOnly, source, 'docs/clinical-ui/TRACK-ANYTHING-EDITOR.md']);
const support = new Map([
  ['interface/forms/track_anything/view.php', '429c69006e5e1e9db02b41c18f4360374dc2862a29aeb8a7b9227bd6e2fa710f'],
  ['interface/forms/track_anything/create.php', 'a86290f5c1ae95908393b47f1b0bda5512f2bf972a0338684372a48af44858f9'],
  ['interface/forms/track_anything/history.php', 'bccc15ea42fa476ea37bb1875483b3b9690cb05c61b17bf8c4b9de0126909d2b'],
  ['interface/forms/track_anything/style.css', '1ad97e51d3111d8c0e1dd0688c33ecdab454a8c3b1e80dfbd4ff4247f4c7ac49'],
  ['config/config.yaml', '5f99c981f570a2f94917d68a4abcedf086eb75a102364bf71f1cb44ccfe461b7'],
  ['interface/clinical-workspace/popup.css', 'ea56e9f26990e843219a68f315c188f7e2b0581c20321bac4517dc4ba34e79a9'],
  ['interface/themes/theme-defaults.scss', '0d01ace0600aada5fd2f82fc35bf76ef9083710f5cc5649e341a20cd97eaa773'],
  ['interface/themes/color_base.scss', 'f13d802ca97933d243c67a4474c994db7471e08913a3b8da694d8d953d8325d7'],
  ['docs/clinical-ui/PLAN.md', 'af7ffa3640ecd6646ae1d28b3b8551e3393d163de4648fb45aa3d32ad74f3e3c'],
  ['docs/clinical-ui/ACCEPTANCE.md', '4da96cca6eaeb633c87a97bea87e8b0180ce6e6b128bf26ebc38716d84af33f8']
]);
const prefix = 'html.oe-workbench-context body.track-anything-document-editor';
const sheet = `${prefix} #track_anything`;
const table = `${sheet} table`;
const selectionTable = `${sheet} > table`;
const field = `${sheet} input[type='text']`;
const select = `${sheet} select[name='procedure2track']`;

// Proposal only. No production source is changed in this phase.
const CSS = `    <style>
    @media screen {
      ${prefix} {
        box-sizing: border-box;
        margin: 0;
        padding: clamp(0.75rem, 2vw, 1.5rem);
        background-color: #e8eff0 !important;
        color: #182c36 !important;
      }

      ${sheet} {
        box-sizing: border-box;
        width: 100%;
        max-width: 1000px;
        margin-inline: auto;
        padding: clamp(1rem, 2.5vw, 2rem);
        overflow-x: auto;
        border: 1px solid #c7d5d9;
        background-color: #fff;
        color: #182c36;
        line-height: 1.5;
      }

      ${table} {
        width: 100%;
        min-width: 36rem;
        border-collapse: collapse;
        background-color: #fff;
        color: #182c36;
      }

      ${table}[border='1'] {
        min-width: 48rem;
      }

      ${selectionTable} {
        min-width: 0;
        table-layout: fixed;
      }

      ${selectionTable} th,
      ${selectionTable} td {
        min-width: 0;
        white-space: normal;
      }

      ${sheet} > form {
        width: max-content;
        min-width: 100%;
      }

      ${table} th,
      ${table} td {
        padding: 0.65rem 0.8rem;
        border-bottom: 1px solid #d9e4e2;
        vertical-align: middle;
        text-align: left;
        white-space: nowrap;
      }

      ${table} th {
        background-color: #f3f7f5;
        color: #183b49;
        font-weight: 600;
      }

      ${table} th.time,
      ${table} td:first-child {
        min-width: 12rem;
      }

      ${table} th.value,
      ${table} td:not(:first-child) {
        min-width: 12rem;
      }

      ${field},
      ${select} {
        box-sizing: border-box;
        min-width: 11rem;
        min-height: 2.65rem;
        padding: 0.45rem 0.6rem;
        border: 1px solid #91a8b1;
        border-radius: 3px;
        background-color: #fff !important;
        color: #182c36 !important;
      }

      ${sheet} input.datetimepicker {
        min-width: 13rem;
      }

      ${select} {
        width: min(100%, 20rem) !important;
      }

      ${sheet} > table select {
        min-width: 0;
        max-width: 100%;
      }

      ${field}::placeholder {
        color: #526a70;
        opacity: 1;
      }

      ${sheet} input[type='submit'],
      ${sheet} input[type='button'] {
        box-sizing: border-box;
        min-width: 7rem;
        min-height: 2.75rem;
        margin: 0.35rem 0.4rem 0.35rem 0;
        padding: 0.55rem 0.85rem;
        border: 1px solid #91a8b1;
        border-radius: 3px;
        background-color: #fff !important;
        color: #182c36 !important;
        font-weight: 600;
        cursor: pointer;
      }

      ${sheet} input[type='submit']:hover,
      ${sheet} input[type='button']:hover {
        border-color: #145968;
        background-color: #e4f0f1 !important;
        color: #182c36 !important;
      }

      ${sheet} input[type='submit']:focus,
      ${sheet} input[type='button']:focus {
        border-color: #145968;
        background-color: #e4f0f1 !important;
        color: #182c36 !important;
      }

      ${field}:focus,
      ${select}:focus,
      ${sheet} input[type='submit']:focus,
      ${sheet} input[type='button']:focus {
        outline: 2px solid #a84c22;
        outline-offset: 2px;
      }

      ${field}:focus-visible,
      ${select}:focus-visible,
      ${sheet} input[type='submit']:focus-visible,
      ${sheet} input[type='button']:focus-visible {
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
  assert.equal(bytes.length, 11637, 'original length');
  assert.equal(hash(bytes), SHA, 'original SHA-256');
  return bytes;
}

const header = "<?php Header::setupHeader(['datetime-picker', 'track-anything']); ?>\n\n<script>";
const body = 'echo "</head><body class=\'body_top\'>";';

function proposed(baseline) {
  let value = replaceOnce(baseline, header, header.replace('\n\n<script>', `\n\n${CSS}\n<script>`));
  value = replaceOnce(value, body, 'echo "</head><body class=\'body_top track-anything-document-editor\'>";');
  return value;
}

function verifySource(candidate, baseline) {
  let inverse = replaceOnce(candidate, 'echo "</head><body class=\'body_top track-anything-document-editor\'>";', body);
  inverse = replaceOnce(inverse, `${CSS}\n<script>`, '<script>');
  assert.deepEqual(inverse, baseline, 'full inverse restores every original byte');
  assert.deepEqual(candidate, proposed(baseline), 'only the exact presentation additions are present');
}

function rules(css) {
  const inner = css.replace(/^    <style>\n    @media screen \{\n/, '').replace(/\n    \}\n    <\/style>$/, '');
  return [...inner.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    selectors: match[1].split(',').map((part) => part.trim()),
    declarations: match[2]
  }));
}

function value(css, selector, property) {
  return rules(css).filter((rule) => rule.selectors.includes(selector)).flatMap((rule) =>
    [...rule.declarations.matchAll(new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+);`, 'g'))]
      .map((match) => match[1].trim()));
}

function expectValue(css, selector, property, expected) {
  assert.deepEqual(value(css, selector, property), [expected], `${selector}: ${property}`);
}

function verifyCss(css) {
  assert.match(css, /^    <style>\n    @media screen \{/);
  assert.match(css, /    \}\n    <\/style>$/);
  assert.equal((css.match(/@media/g) || []).length, 1);
  assert.doesNotMatch(css, /@media print|\bdisplay\s*:|\bposition\s*:\s*sticky|overflow-wrap\s*:\s*anywhere/);
  assert.doesNotMatch(css, /\boverflow-y\s*:|\boverflow-x\s*:\s*(?:hidden|clip)|(?:^|;)\s*(?:height|max-height)\s*:/m);
  for (const rule of rules(css)) for (const selector of rule.selectors) {
    assert.ok(selector === prefix || selector.startsWith(`${prefix} `), `unscoped: ${selector}`);
    assert.ok(!selector.includes(' input:not('), `overbroad control: ${selector}`);
  }
  const layouts = rules(css).flatMap((rule) =>
    [...rule.declarations.matchAll(/(?:^|;)\s*table-layout\s*:\s*([^;]+);/g)]
      .map((match) => ({ selectors: rule.selectors, value: match[1].trim() })));
  assert.deepEqual(layouts, [{ selectors: [selectionTable], value: 'fixed' }],
    'fixed layout belongs only to the exact selection table');
  for (const [selector, property, expected] of [
    [prefix, 'background-color', '#e8eff0 !important'],
    [prefix, 'color', '#182c36 !important'],
    [sheet, 'max-width', '1000px'], [sheet, 'overflow-x', 'auto'],
    [sheet, 'padding', 'clamp(1rem, 2.5vw, 2rem)'],
    [table, 'min-width', '36rem'], [`${table}[border='1']`, 'min-width', '48rem'],
    [selectionTable, 'min-width', '0'],
    [`${selectionTable} th`, 'min-width', '0'], [`${selectionTable} td`, 'min-width', '0'],
    [`${selectionTable} th`, 'white-space', 'normal'], [`${selectionTable} td`, 'white-space', 'normal'],
    [`${sheet} > table select`, 'min-width', '0'], [`${sheet} > table select`, 'max-width', '100%'],
    [`${sheet} > form`, 'width', 'max-content'], [`${sheet} > form`, 'min-width', '100%'],
    [`${table} th`, 'white-space', 'nowrap'], [`${table} td`, 'white-space', 'nowrap'],
    [`${table} th.time`, 'min-width', '12rem'], [`${table} td:first-child`, 'min-width', '12rem'],
    [`${table} th.value`, 'min-width', '12rem'], [`${table} td:not(:first-child)`, 'min-width', '12rem'],
    [field, 'min-width', '11rem'], [select, 'min-width', '11rem'],
    [`${sheet} input.datetimepicker`, 'min-width', '13rem'],
    [select, 'width', 'min(100%, 20rem) !important'],
    [field, 'background-color', '#fff !important'], [field, 'color', '#182c36 !important'],
    [select, 'background-color', '#fff !important'], [select, 'color', '#182c36 !important'],
    [`${field}::placeholder`, 'color', '#526a70'],
    [`${field}::placeholder`, 'opacity', '1'],
    [`${sheet} input[type='submit']`, 'background-color', '#fff !important'],
    [`${sheet} input[type='button']`, 'color', '#182c36 !important'],
    [`${field}:focus`, 'outline', '2px solid #a84c22'],
    [`${select}:focus`, 'outline', '2px solid #a84c22'],
    [`${sheet} input[type='submit']:focus-visible`, 'outline', '3px solid #a84c22'],
    [`${sheet} input[type='button']:focus-visible`, 'outline', '3px solid #a84c22']
  ]) expectValue(css, selector, property, expected);
  for (const type of ['submit', 'button']) for (const state of [':hover', ':focus']) {
    expectValue(css, `${sheet} input[type='${type}']${state}`, 'background-color', '#e4f0f1 !important');
    expectValue(css, `${sheet} input[type='${type}']${state}`, 'color', '#182c36 !important');
  }
  assert.doesNotMatch(css, /input\[type=['"](?:hidden|checkbox)['"]\]|\.btn|@import|<script/);
}

function rejectMutation(candidate, before, after, baseline) {
  const mutant = replaceFirst(candidate, before, after);
  assert.ok(!mutant.equals(candidate), `mutation constructed: ${before}`);
  assert.throws(() => verifySource(mutant, baseline), `rejected: ${before}`);
}

function rejectCssMutation(before, after) {
  const mutant = replaceFirst(Buffer.from(CSS), before, after);
  assert.ok(!mutant.equals(Buffer.from(CSS)), `mutation constructed: ${before}`);
  assert.throws(() => verifyCss(mutant.toString()), `rejected CSS: ${before}`);
}

function replaceFirst(bytes, before, after) {
  const value = Buffer.from(bytes);
  const at = value.indexOf(Buffer.from(before));
  assert.notEqual(at, -1, `missing mutation seam: ${before.slice(0, 60)}`);
  return Buffer.concat([value.subarray(0, at), Buffer.from(after), value.subarray(at + Buffer.byteLength(before))]);
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

const args = process.argv.slice(2);
assert.ok(args.every((arg) => arg === '--history') && args.length <= 1, 'invalid option');

test('fixture preserves the whole route and native clinical actions', () => {
  const text = original().toString();
  for (const token of [
    'EncounterFormAccess::assertFormBelongsToSessionPatient',
    'PatientSessionUtil::getPid()', 'EncounterSessionUtil::getEncounter()',
    'INSERT INTO form_track_anything (procedure_type_id) VALUES (?)',
    'INSERT INTO form_track_anything_results (track_anything_id, track_timestamp, itemid, result) VALUES (?, ?, ?, ?)',
    'UPDATE form_track_anything_results ',
    "name='procedure2track'", "name='bn_select'", "name='create_track'",
    "name='datetime'", "name='liste[]'", "name='formid'", "name='bn_save'",
    "name='old_time[", "name='old_id[", "name='old_value[",
    "xla('Back')", "xla('Select')", "xla('Configure tracks')", "xla('Save')", "xla('Stop')",
    'top.restoreSession()', "class='datetimepicker'", "<table border='1'>"
  ]) assert.ok(text.includes(token), token);
  assert.equal((text.match(/\$\('\.datetimepicker'\)\.datetimepicker/g) || []).length, 1);
});

test('screen-only scoped proposal preserves native table and controls', () => verifyCss(CSS));

test('keyboard layout contract checks the live source CSS and synthetic proposal', () => {
  verifyCss(CSS);
  const styles = read(source).toString().match(/    <style>\n    @media screen \{[\s\S]*?\n    \}\n    <\/style>/g) || [];
  assert.equal(styles.length, 1, 'one live screen stylesheet');
  verifyCss(styles[0]);
});

test('proposal builds and inverse restores every original byte', () => {
  const baseline = original();
  verifySource(proposed(baseline), baseline);
});

test('original fails only the missing presentation seam', () => {
  const baseline = original();
  assert.throws(() => verifySource(baseline, baseline), /missing seam: echo/);
});

test('actual source matches exact presentation proposal', () => verifySource(read(source), original()));

test('semantic PHP, SQL, session, field, value, JavaScript and action mutants reject', () => {
  const baseline = original();
  const candidate = proposed(baseline);
  for (const [before, after] of [
    ['EncounterFormAccess::assertFormBelongsToSessionPatient', 'EncounterFormAccess::skip'],
    ['PatientSessionUtil::getPid()', 'PatientSessionUtil::getOtherPid()'],
    ['EncounterSessionUtil::getEncounter()', 'EncounterSessionUtil::getOtherEncounter()'],
    ['INSERT INTO form_track_anything (procedure_type_id) VALUES (?)', 'INSERT INTO other (procedure_type_id) VALUES (?)'],
    ['INSERT INTO form_track_anything_results (track_anything_id, track_timestamp, itemid, result)', 'INSERT INTO other_results (track_anything_id, track_timestamp, itemid, result)'],
    ['UPDATE form_track_anything_results ', 'UPDATE other_results '],
    ["name='procedure2track'", "name='other'"],
    ["name='datetime'", "name='other'"],
    ["name='liste[]'", "name='other[]'"],
    ["name='old_time[", "name='other_time["],
    ["name='old_id[", "name='other_id["],
    ["name='old_value[", "name='other_value["],
    ["name='formid'", "name='other'"],
    ["name='bn_select'", "name='other'"],
    ["name='create_track'", "name='other'"],
    ["name='bn_save'", "name='other'"],
    ["value='\" . attr($myrow['track_anything_type_id'])", "value='changed\" . attr($myrow['track_anything_type_id'])"],
    ['top.restoreSession()', 'void 0'],
    ["$('.datetimepicker').datetimepicker({", "$('.datetimepicker').remove();"],
    ["class='datetimepicker'", "class='other'"],
    ["xla('Stop')", "xla('Delete')"],
    ["<table border='1'>", "<table border='0'>"]
  ]) rejectMutation(candidate, before, after, baseline);
});

test('media, scope, table, scroll, width, palette, focus and placeholder mutants reject', () => {
  const baseline = original();
  const candidate = proposed(baseline);
  for (const [before, after] of [
    ['@media screen {', '@media print {'],
    [`${prefix} {`, 'body {'],
    ['max-width: 1000px;', 'max-width: 1400px;'],
    ['overflow-x: auto;', 'overflow-x: hidden;'],
    ['min-width: 48rem;', 'min-width: 10rem;'],
    ['white-space: nowrap;', 'white-space: normal;'],
    ['background-color: #fff !important;', 'background-color: #222 !important;'],
    ['color: #182c36 !important;', 'color: #fff !important;'],
    ['outline: 3px solid #a84c22;', 'outline: none;'],
    ['opacity: 1;', 'opacity: 0;']
  ]) {
    rejectMutation(candidate, before, after, baseline);
    rejectCssMutation(before, after);
  }
  rejectCssMutation(`${table} th,`, `${table} th { display: block; },`);
  rejectCssMutation(`${sheet} input[type='button'] {`, `${sheet} input[type='hidden'] {`);
  for (const [before, after] of [
    [`${selectionTable} {`, `${table} {`],
    ['table-layout: fixed;', 'table-layout: auto;'],
    [`${selectionTable} th,`, `${table} th,`],
    ['white-space: normal;', 'white-space: nowrap;'],
    [`${sheet} > table select {`, `${sheet} select {`],
    ['max-width: 100%;', 'max-width: none;'],
    [`${sheet} > form {`, `${sheet} form {`],
    ['width: max-content;', 'width: 100%;'],
    ['min-width: 100%;', 'min-width: 0;']
  ]) {
    rejectMutation(candidate, before, after, baseline);
    rejectCssMutation(before, after);
  }
  for (const block of [
    `      ${selectionTable} {\n        min-width: 0;\n        table-layout: fixed;\n      }\n\n`,
    `      ${selectionTable} th,\n      ${selectionTable} td {\n        min-width: 0;\n        white-space: normal;\n      }\n\n`,
    `      ${sheet} > table select {\n        min-width: 0;\n        max-width: 100%;\n      }\n\n`,
    `      ${sheet} > form {\n        width: max-content;\n        min-width: 100%;\n      }\n\n`
  ]) {
    rejectMutation(candidate, block, '', baseline);
    rejectCssMutation(block, '');
  }
});

test('tests-only and final path oracles are distinct', () => {
  verifyScope(testsOnly);
  verifyFinalScope(finalPaths);
  assert.throws(() => verifyScope(finalPaths));
  assert.throws(() => verifyFinalScope(testsOnly));
  assert.throws(() => verifyFinalScope([...finalPaths, 'interface/forms/track_anything/create.php']));
});

if (args.includes('--history')) {
  test('pinned Git base authenticates original and unchanged support bytes', () => {
    assert.deepEqual(original(), git('show', `${BASE}:${source}`));
    for (const [name, expected] of support) {
      const base = git('show', `${BASE}:${name}`);
      assert.equal(hash(base), expected, name);
      assert.deepEqual(git('show', `HEAD:${name}`), base, `HEAD ${name}`);
      assert.deepEqual(read(name), base, `working ${name}`);
    }
  });

  test('combined committed, dirty, staged and untracked scope is exact', () => {
    const paths = changedPaths();
    if (paths.has(source) || paths.has('docs/clinical-ui/TRACK-ANYTHING-EDITOR.md')) verifyFinalScope(paths);
    else verifyScope(paths);
  });
}

module.exports = { CSS, proposed, verifySource, verifyCss, verifyScope, verifyFinalScope };
