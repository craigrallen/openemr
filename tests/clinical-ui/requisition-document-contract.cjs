'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const BASE = '09b29da7771aea334ed5745e058751157af980d7';
const sourcePath = 'interface/forms/requisition/new.php';
const fixturePath = 'tests/clinical-ui/fixtures/requisition-new-original.php.txt';
const contractPath = 'tests/clinical-ui/requisition-document-contract.cjs';
const adapterPath = 'tests/js/requisition-document.test.js';
const documentationPath = 'docs/clinical-ui/REQUISITION-DOCUMENT.md';
const finalPaths = new Set([sourcePath, documentationPath, fixturePath, contractPath, adapterPath]);
const prefix = 'html.oe-workbench-context body.requisition-document';
const sheet = `${prefix} > .container`;
const requisition = `${sheet} .req`;
const header = `${sheet} .reqHeader`;
const footer = `${prefix} > #non-printable`;

// Exact screen-only proposal: insert before </head>, then replace the opening body tag.
const CSS = `<style>
@media screen {
  ${prefix} {
    box-sizing: border-box;
    margin: 0;
    padding: clamp(0.75rem, 2vw, 1.5rem);
    color: var(--oe-wb-ink, #17343b);
    background-color: var(--oe-wb-canvas, #f3f7f5);
  }

  ${sheet} {
    box-sizing: border-box;
    width: 100%;
    max-width: 1000px;
    min-width: 0;
    margin-inline: auto;
    padding: clamp(1rem, 3vw, 2.25rem);
    border: 1px solid var(--oe-wb-line, #d9e4e2);
    border-radius: 6px;
    color: var(--oe-wb-ink, #17343b);
    background-color: var(--oe-wb-paper, #fff);
    line-height: 1.5;
  }

  ${sheet} > .text-center {
    margin-bottom: 1.25rem;
  }

  ${header} {
    box-sizing: border-box;
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem 2rem;
    width: 100%;
    min-width: 0;
    margin: 0 0 1.25rem;
    padding: 0 0 1rem;
    border-bottom: 1px solid var(--oe-wb-line, #d9e4e2);
  }

  ${header} > p {
    flex-basis: 100%;
    margin: 0;
  }

  ${header} .cinfo {
    float: none;
    min-width: 0;
  }

  ${header} .pdata {
    position: static;
    right: auto;
    z-index: auto;
    min-width: 0;
  }

  ${header} .pdata p {
    margin: 0;
  }

  ${requisition} {
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    margin: 0;
    padding: 0;
    overflow-x: auto;
  }

  ${requisition} table {
    color: var(--oe-wb-ink, #17343b);
    background-color: var(--oe-wb-paper, #fff);
  }

  ${footer} {
    box-sizing: border-box;
    width: 100%;
    max-width: 1000px;
    margin: 0.75rem auto 0;
    padding: 0.75rem 0 0;
    text-align: right;
  }

  ${footer} input[type='button'] {
    min-height: 2.5rem;
    padding: 0.5rem 1.25rem;
    border: 1px solid var(--oe-wb-petrol, #086878);
    border-radius: 4px;
    color: var(--oe-wb-on-petrol, #fff);
    background-color: var(--oe-wb-petrol, #086878);
    cursor: pointer;
  }

  ${footer} input[type='button']:focus-visible {
    outline: 3px solid var(--oe-wb-petrol, #086878);
    outline-offset: 3px;
  }
}
</style>`;

const read = (name) => fs.readFileSync(path.join(root, name));
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

function fixture() {
  return read(fixturePath);
}

function proposed(baseline = fixture()) {
  const styled = replaceOnce(baseline, '\n</head>\n', `\n${CSS}\n</head>\n`);
  return replaceOnce(styled, '<body>', '<body class="requisition-document">');
}

function verifySource(candidate, baseline = fixture()) {
  let restored = replaceOnce(candidate, '<body class="requisition-document">', '<body>');
  restored = replaceOnce(restored, `\n${CSS}\n</head>\n`, '\n</head>\n');
  assert.deepEqual(restored, baseline, 'inverse restores every original source byte');
  assert.deepEqual(Buffer.from(candidate), proposed(baseline), 'only exact presentation additions');
}

function rules(css) {
  assert.match(css, /^<style>\n@media screen \{\n/);
  assert.match(css, /\n\}\n<\/style>$/);
  assert.equal((css.match(/@media/g) || []).length, 1);
  const inner = css.slice('<style>\n@media screen {\n'.length, -'\n}\n</style>'.length);
  const found = [...inner.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
  assert.equal(inner.replace(/([^{}]+)\{([^{}]*)\}/g, '').trim(), '', 'flat rules only');
  return found.map((match) => ({ selector: match[1].trim(), declarations: match[2] }));
}

function values(css, selector, property) {
  return rules(css).filter((rule) => rule.selector === selector).flatMap((rule) =>
    [...rule.declarations.matchAll(new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+);`, 'g'))].map((match) => match[1].trim()));
}

function verifyCss(css) {
  assert.doesNotMatch(css, /@media print|@import|<script|!important|overflow\s*:\s*hidden|display\s*:\s*none|table-layout\s*:\s*fixed/i);
  for (const { selector } of rules(css)) {
    assert.ok(selector === prefix || selector.startsWith(`${prefix} `), `unscoped selector: ${selector}`);
    assert.doesNotMatch(selector, /\[type=['"]?hidden|:not\(|:has\(/);
  }
  for (const [selector, property, expected] of [
    [prefix, 'box-sizing', 'border-box'],
    [prefix, 'background-color', 'var(--oe-wb-canvas, #f3f7f5)'],
    [prefix, 'color', 'var(--oe-wb-ink, #17343b)'],
    [sheet, 'max-width', '1000px'],
    [sheet, 'margin-inline', 'auto'],
    [sheet, 'padding', 'clamp(1rem, 3vw, 2.25rem)'],
    [sheet, 'background-color', 'var(--oe-wb-paper, #fff)'],
    [sheet, 'color', 'var(--oe-wb-ink, #17343b)'],
    [sheet, 'line-height', '1.5'],
    [header, 'display', 'flex'],
    [header, 'flex-wrap', 'wrap'],
    [header, 'width', '100%'],
    [`${header} > p`, 'flex-basis', '100%'],
    [`${header} .cinfo`, 'float', 'none'],
    [`${header} .pdata`, 'position', 'static'],
    [`${header} .pdata`, 'z-index', 'auto'],
    [requisition, 'width', '100%'],
    [requisition, 'min-width', '0'],
    [requisition, 'overflow-x', 'auto'],
    [`${requisition} table`, 'color', 'var(--oe-wb-ink, #17343b)'],
    [`${requisition} table`, 'background-color', 'var(--oe-wb-paper, #fff)'],
    [footer, 'max-width', '1000px'],
    [`${footer} input[type='button']`, 'background-color', 'var(--oe-wb-petrol, #086878)'],
    [`${footer} input[type='button']`, 'color', 'var(--oe-wb-on-petrol, #fff)'],
    [`${footer} input[type='button']:focus-visible`, 'outline', '3px solid var(--oe-wb-petrol, #086878)']
  ]) assert.deepEqual(values(css, selector, property), [expected], `${selector}: ${property}`);
}

function changedPathGroups() {
  const parse = (args) => new Set(git(...args).toString().split('\0').filter(Boolean));
  return {
    committed: parse(['diff', '--name-only', '-z', BASE, 'HEAD']),
    working: parse(['diff', '--name-only', '-z']),
    staged: parse(['diff', '--cached', '--name-only', '-z']),
    untracked: parse(['ls-files', '--others', '--exclude-standard', '-z'])
  };
}

function verifyFinalScope(groups) {
  const combined = new Set();
  for (const [kind, paths] of Object.entries(groups)) {
    for (const name of paths) {
      assert.ok(finalPaths.has(name), `${kind} changed forbidden path: ${name}`);
      combined.add(name);
    }
  }
  assert.deepEqual(combined, finalPaths, 'final exact five-file scope');
}

module.exports = { CSS, fixture, proposed, verifySource, verifyCss, changedPathGroups, verifyFinalScope };

if (require.main === module) {
  const test = require('node:test');
  const args = process.argv.slice(2);
  assert.ok(args.length <= 1 && args.every((arg) => arg === '--history'), 'only --history is supported');

  test('whole original fixture retains native data, barcode, tables, controls, print and escaping', () => {
    const original = fixture().toString();
    for (const token of [
      'EncounterFormAccess::assertFormBelongsToSessionPatient', 'formFetch("form_requisition", $formid)',
      'getPatientData($pid)', 'getFacility()', 'getAllinsurances($pid)', 'getProceduresInfo($oid, $encounter)',
      'getBarId($lab_id, $pid)', 'saveBarCode($bar, $pid, $order[0])', 'barcode.php?text=',
      'attr_url($bar)', 'text($bar)', 'id="printableArea"', 'class="reqHeader"', 'class="req"',
      'class="table"', 'question_text', 'text($order[8])', 'text($order[30])',
      'id="non-printable"', 'onclick="printDiv(\'printableArea\')"', 'window.print();',
      'document.body.innerHTML = originalContents;', '@media print', '#printable { display: block; }'
    ]) assert.ok(original.includes(token), `missing native source: ${token}`);
  });

  test('proposal CSS is screen scoped, bounded, paired and preserves table scrolling', () => verifyCss(CSS));
  test('positive constructed proposal restores every original byte', () => verifySource(proposed(), fixture()));
  test('unchanged fixture lacks presentation', () => {
    const original = fixture();
    assert.throws(() => verifySource(original, original), /missing seam: <body class/);
  });
  test('actual requisition route has the exact presentation proposal', () => verifySource(read(sourcePath), fixture()));

  test('constructed source mutations reject native handler and arbitrary byte changes', () => {
    const baseline = fixture();
    const candidate = proposed(baseline);
    for (const [before, after] of [
      ['window.print();', 'window.close();'],
      ["onclick=\"printDiv('printableArea')\"", 'onclick="window.print()"'],
      ['saveBarCode($bar, $pid, $order[0])', 'saveBarCode($bar, $pid, 0)'],
      ['attr_url($bar)', 'text($bar)'],
      ['Lab Requisition Form', 'Lab Requisition Memo']
    ]) {
      const mutant = replaceOnce(candidate, before, after);
      assert.throws(() => verifySource(mutant, baseline), `source mutant: ${before}`);
    }
  });

  test('constructed CSS mutations reject media, context, class, print and layout regressions', () => {
    for (const [before, after] of [
      ['@media screen {', '@media print {'],
      [`${prefix} {`, 'body {'],
      ['body.requisition-document', 'body.other-document'],
      ['max-width: 1000px;', 'max-width: 1400px;'],
      ['padding: clamp(1rem, 3vw, 2.25rem);', 'padding: 0;'],
      ['overflow-x: auto;', 'overflow-x: hidden;'],
      ['float: none;', 'float: left;'],
      ['position: static;', 'position: relative;'],
      ['outline: 3px solid var(--oe-wb-petrol, #086878);', 'outline: none;']
    ]) {
      const mutant = replaceFirst(Buffer.from(CSS), before, after).toString();
      assert.throws(() => verifyCss(mutant), `CSS mutant: ${before}`);
    }
  });

  test('paired paper and action colors reject either half changing', () => {
    for (const [before, after] of [
      ['background-color: var(--oe-wb-paper, #fff);', 'background-color: #000;'],
      ['color: var(--oe-wb-on-petrol, #fff);', 'color: #086878;'],
      ['background-color: var(--oe-wb-petrol, #086878);', 'background-color: #fff;']
    ]) {
      const mutant = replaceFirst(Buffer.from(CSS), before, after).toString();
      assert.throws(() => verifyCss(mutant), `paired-color mutant: ${before}`);
    }
  });

  test('final-path allowlist is exact', () => {
    const all = { committed: new Set([sourcePath, documentationPath]), working: new Set(), staged: new Set(), untracked: new Set([fixturePath, contractPath, adapterPath]) };
    verifyFinalScope(all);
    assert.throws(() => verifyFinalScope({ ...all, untracked: new Set([fixturePath, contractPath]) }));
    assert.throws(() => verifyFinalScope({ ...all, working: new Set(['interface/forms/requisition/save.php']) }));
  });

  if (args.includes('--history')) {
    test('fixture is the exact verified base blob', () => {
      assert.equal(git('rev-parse', '--verify', `${BASE}^{commit}`).toString().trim(), BASE);
      assert.deepEqual(fixture(), git('show', `${BASE}:${sourcePath}`));
    });
    test('committed, staged, working and untracked changes have the exact final scope', () => {
      verifyFinalScope(changedPathGroups());
    });
  }
}
