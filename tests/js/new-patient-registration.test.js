'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const fixture = path.join(root, 'tests/clinical-ui/fixtures/new-patient-registration-original.php.txt');
const contract = path.join(root, 'tests/clinical-ui/new-patient-registration-contract.cjs');
const sha = '8e349a5a7936d31ba63bc5c793dd1c62a1b4282c98bdbdb5a4e2e73e13664fe7';
const prefix = 'html.oe-workbench-context body.oe-new-patient-registration';
const css = [
  '@media screen {',
  `  ${prefix} .oe-new-patient-registration-sheet {`,
  '    box-sizing: border-box;',
  '    width: 100%;',
  '    max-width: 72rem;',
  '    margin-left: auto;',
  '    margin-right: auto;',
  '    padding: 1rem;',
  '    border: 1px solid var(--gray300);',
  '    border-radius: 0.5rem;',
  '  }',
  '',
  `  ${prefix} .oe-new-patient-registration-sheet > .row {`,
  '    margin-left: 0;',
  '    margin-right: 0;',
  '  }',
  '',
  `  ${prefix} .oe-new-patient-registration-actions {`,
  '    display: flex;',
  '    flex-wrap: wrap;',
  '    gap: 0.5rem;',
  '    max-width: 100%;',
  '  }',
  '',
  `  ${prefix} .oe-new-patient-registration-actions > .btn {`,
  '    flex: 0 1 auto;',
  '    min-width: 0;',
  '    max-width: 100%;',
  '    white-space: normal;',
  '    overflow-wrap: anywhere;',
  '    margin-left: 0;',
  '    margin-right: 0;',
  '  }',
  '',
  `  ${prefix} .oe-new-patient-registration-actions > .btn:focus {`,
  '    outline: 3px solid currentcolor;',
  '    outline-offset: 2px;',
  '  }',
  '',
  `  ${prefix} .oe-new-patient-registration-actions > .btn:focus-visible {`,
  '    outline: 3px solid currentcolor;',
  '    outline-offset: 2px;',
  '  }',
  '}'
].join('\n');
const style = `<style id="new-patient-registration-workbench">\n${css}\n</style>\n`;

function replaceAnchor(source, before, after) {
  assert.equal(source.split(before).length - 1, 1, `mutation setup anchor must occur once: ${before.slice(0, 72)}`);
  return source.replace(before, after);
}

function candidateFromOriginal(original) {
  let source = original;
  source = replaceAnchor(source, '</style>\n\n<?php include_once', `</style>\n${style}\n<?php include_once`);
  source = replaceAnchor(source, '<body class="body_top">', '<body class="body_top oe-new-patient-registration">');
  source = replaceAnchor(source, '    <div class="container-xl">\n        <div class="row">', '    <div class="container-xl oe-new-patient-registration-sheet">\n        <div class="row">');
  source = replaceAnchor(source, '                <div class="btn-group">\n                    <?php if ($WITH_SEARCH) { ?>', '                <div class="btn-group oe-new-patient-registration-actions">\n                    <?php if ($WITH_SEARCH) { ?>');
  return source;
}

function run(source) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'opemr-222-contract-'));
  const candidate = path.join(directory, 'candidate.php');
  try {
    fs.writeFileSync(candidate, source);
    const result = spawnSync(process.execPath, [contract, '--json'], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, OPEMR_222_CANDIDATE: candidate }
    });
    assert.equal(result.signal, null);
    assert.equal(result.stderr, '');
    assert.match(result.stdout, /^\{[^\r\n]*\}\n(?![\s\S])/);
    const report = JSON.parse(result.stdout);
    assert.deepEqual(Object.keys(report).sort(), ['failed', 'passed', 'tests']);
    for (const key of ['tests', 'passed', 'failed']) assert(Number.isInteger(report[key]) && report[key] >= 0);
    assert.equal(report.passed + report.failed, report.tests);
    return { status: result.status, report };
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

const originalBytes = fs.readFileSync(fixture);
assert.equal(crypto.createHash('sha256').update(originalBytes).digest('hex'), sha);
const original = originalBytes.toString('utf8');
const valid = candidateFromOriginal(original);

const mutations = [
  ['missing presentation', (source) => original],
  ['unscoped selector', (source) => replaceAnchor(source, `${prefix} .oe-new-patient-registration-sheet {`, 'body.oe-new-patient-registration .oe-new-patient-registration-sheet {')],
  ['print media', (source) => replaceAnchor(source, '@media screen {', '@media print {')],
  ['missing sheet boundary', (source) => replaceAnchor(source, '    max-width: 72rem;\n', '')],
  ['combined focus rule', (source) => replaceAnchor(source, `${prefix} .oe-new-patient-registration-actions > .btn:focus {`, `${prefix} .oe-new-patient-registration-actions > .btn:focus,\n  ${prefix} .oe-new-patient-registration-actions > .btn:focus-visible {`)],
  ['altered ACL', (source) => replaceAnchor(source, "AclMain::aclCheckCore('patients', 'demo'", "AclMain::aclCheckCore('patients', 'view'")],
  ['altered save destination', (source) => replaceAnchor(source, "action='new_comprehensive_save.php'", "action='other_save.php'")],
  ['duplicated style', (source) => replaceAnchor(source, style, style + style)],
  ['wrong container', (source) => replaceAnchor(source, '    <div class="container-xl oe-new-patient-registration-sheet">', '    <div class="container-xl">')],
  ['missing action class', (source) => replaceAnchor(source, 'class="btn-group oe-new-patient-registration-actions"', 'class="btn-group"')]
];

test('independent candidate passes the exact CLI JSON contract', () => {
  const { status, report } = run(valid);
  expect(status).toBe(0);
  expect(report.tests).toBeGreaterThan(0);
  expect(report.passed).toBe(report.tests);
  expect(report.failed).toBe(0);
});

test.each(mutations)('contract rejects %s', (_name, mutate) => {
  const { status, report } = run(mutate(valid));
  expect(status).toBe(1);
  expect(report.tests).toBeGreaterThan(0);
  expect(report.failed).toBeGreaterThan(0);
});
