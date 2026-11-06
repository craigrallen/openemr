'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const route = path.join(root, 'interface/new/new_comprehensive.php');
const fixture = path.join(__dirname, 'fixtures/new-patient-registration-original.php.txt');
const originalSha = '8e349a5a7936d31ba63bc5c793dd1c62a1b4282c98bdbdb5a4e2e73e13664fe7';
const base = '09b29da7771aea334ed5745e058751157af980d7';
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
const addedStyle = `<style id="new-patient-registration-workbench">\n${css}\n</style>\n`;
const originalBody = '<body class="body_top">';
const changedBody = '<body class="body_top oe-new-patient-registration">';
const originalSheet = '    <div class="container-xl">\n        <div class="row">';
const changedSheet = '    <div class="container-xl oe-new-patient-registration-sheet">\n        <div class="row">';
const originalActions = '                <div class="btn-group">\n                    <?php if ($WITH_SEARCH) { ?>';
const changedActions = '                <div class="btn-group oe-new-patient-registration-actions">\n                    <?php if ($WITH_SEARCH) { ?>';

function occurrences(source, fragment) {
  return source.split(fragment).length - 1;
}

function removeExactlyOnce(source, fragment, replacement) {
  assert.equal(occurrences(source, fragment), 1, `expected one exact addition: ${fragment.slice(0, 64)}`);
  return source.replace(fragment, replacement);
}

function main() {
  const args = process.argv.slice(2);
  assert(args.every((arg) => arg === '--json' || arg === '--history'), 'unsupported argument');
  assert.equal(new Set(args).size, args.length, 'duplicate argument');
  const originalBytes = fs.readFileSync(fixture);
  const original = originalBytes.toString('utf8');
  const candidate = fs.readFileSync(process.env.OPEMR_222_CANDIDATE || route, 'utf8');
  const results = [];
  function check(name, fn) {
    try {
      fn();
      results.push({ name, passed: true });
    } catch (error) {
      results.push({ name, passed: false, detail: error.message });
    }
  }

  check('fixture matches the pinned original SHA-256', () => {
    assert.equal(crypto.createHash('sha256').update(originalBytes).digest('hex'), originalSha);
  });
  check('original insertion seams are unique', () => {
    for (const fragment of ['</style>\n\n<?php include_once', originalBody, originalSheet, originalActions]) {
      assert.equal(occurrences(original, fragment), 1, fragment);
    }
  });
  check('one workbench style follows the original style', () => {
    assert.equal(occurrences(candidate, '<style id="new-patient-registration-workbench">'), 1);
    assert.equal(occurrences(candidate, addedStyle), 1);
    assert(candidate.includes(`</style>\n${addedStyle}\n<?php include_once`));
  });
  check('added CSS is the exact scoped screen geometry contract', () => {
    assert.equal(occurrences(candidate, addedStyle), 1);
    assert(candidate.includes(addedStyle));
  });
  check('body receives its sole approved class addition', () => {
    assert.equal(occurrences(candidate, changedBody), 1);
  });
  check('first outer container receives the sheet class', () => {
    assert.equal(occurrences(candidate, changedSheet), 1);
  });
  check('last button group receives the actions class', () => {
    assert.equal(occurrences(candidate, changedActions), 1);
  });
  check('removing only the four approved additions restores every original byte', () => {
    let restored = candidate;
    restored = removeExactlyOnce(restored, addedStyle, '');
    restored = removeExactlyOnce(restored, changedBody, originalBody);
    restored = removeExactlyOnce(restored, changedSheet, originalSheet);
    restored = removeExactlyOnce(restored, changedActions, originalActions);
    assert.equal(Buffer.compare(Buffer.from(restored, 'utf8'), originalBytes), 0);
  });
  if (args.includes('--history')) {
    check('fixture matches the pinned Git baseline', () => {
      const historical = execFileSync('git', ['show', `${base}:interface/new/new_comprehensive.php`], {
        cwd: root,
        encoding: 'buffer',
        stdio: ['ignore', 'pipe', 'pipe']
      });
      assert.equal(Buffer.compare(historical, originalBytes), 0);
    });
  }

  const passed = results.filter((result) => result.passed).length;
  const report = { tests: results.length, passed, failed: results.length - passed };
  if (args.includes('--json')) {
    process.stdout.write(`${JSON.stringify(report)}\n`);
  } else {
    for (const result of results) {
      process.stdout.write(`${result.passed ? 'PASS' : 'FAIL'} ${result.name}${result.detail ? `: ${result.detail}` : ''}\n`);
    }
    process.stdout.write(`${passed}/${results.length} passed\n`);
  }
  if (report.failed) process.exitCode = 1;
}

try {
  main();
} catch (error) {
  process.stderr.write(`Contract setup error: ${error.message}\n`);
  process.exitCode = 2;
}
