'use strict';

// Static contract only. Never load the PHP route as code.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { test } = require('node:test');

const ROOT = path.resolve(__dirname, '../..');
const ROUTE = 'interface/modules/custom_modules/oe-module-faxsms/library/utility.php';
const FIXTURE = 'tests/clinical-ui/fixtures/fax-patient-original.php.txt';
const CONTRACT = 'tests/clinical-ui/fax-patient-popup-contract.cjs';
const ADAPTER = 'tests/js/fax-patient-popup.test.js';
const DOC = 'docs/clinical-ui/FAX-PATIENT-POPUP.md';
const PR_PATHS = [ROUTE, CONTRACT, FIXTURE, ADAPTER, DOC];
const SUPPORT = [
  'interface/clinical-workspace/popup.css',
  'interface/clinical-workspace/popup.js',
  'interface/modules/custom_modules/oe-module-faxsms/public/js/messageUI.js',
  'src/Core/Header.php',
  'config/config.yaml',
];
const MARKER = '<body class="body_top oe-fax-patient-popup" onload="javascript:document.new_patient.fname.focus();">';
const ORIGINAL_BODY = '<body class="body_top" onload="javascript:document.new_patient.fname.focus();">';
const SCOPE = 'html.oe-workbench-context body.body_top.oe-fax-patient-popup';

const PROPOSED_STYLE = `    <style>
    @media screen {
      ${SCOPE} {
        color: var(--oe-wb-ink, #17343b);
        background-color: var(--oe-wb-canvas, #f3f7f5);
      }

      ${SCOPE} > .container-fluid {
        box-sizing: border-box;
        width: 100%;
        max-width: 860px;
        margin: 16px auto 24px;
        padding: 20px 24px 24px;
        padding-inline: 24px;
        color: var(--oe-wb-ink, #17343b);
        background-color: var(--oe-wb-paper, #fff);
        border: 1px solid var(--oe-wb-line, #d9e4e2);
        border-radius: 8px;
      }

      ${SCOPE} > .container-fluid > .title {
        margin: 0 0 20px;
        padding: 0 0 14px;
        border-bottom: 1px solid var(--oe-wb-line, #d9e4e2);
      }

      ${SCOPE} > .container-fluid > form.form {
        min-width: 0;
      }

      ${SCOPE} > .container-fluid > form.form > .form-group.col {
        box-sizing: border-box;
        min-width: 0;
        padding-right: 0;
        padding-left: 0;
        padding-inline: 0;
      }

      ${SCOPE} > .container-fluid > form.form .form-control {
        box-sizing: border-box;
        width: 100%;
        max-width: 100%;
        min-width: 0;
      }

      ${SCOPE} > .container-fluid > form.form .form-control:focus,
      ${SCOPE} > .container-fluid > form.form .form-control:focus-visible,
      ${SCOPE} > .container-fluid > form.form .form-check-input:focus,
      ${SCOPE} > .container-fluid > form.form .form-check-input:focus-visible,
      ${SCOPE} > .container-fluid > form.form > .float-right > .btn:focus,
      ${SCOPE} > .container-fluid > form.form > .float-right > .btn:focus-visible {
        outline: 3px solid var(--oe-wb-petrol, #086878);
        outline-offset: 2px;
      }

      ${SCOPE} > .container-fluid > form.form > .float-right {
        float: none !important;
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 8px;
        clear: both;
      }

      @media (width <= 600px) {
        ${SCOPE} > .container-fluid {
          margin: 8px auto 16px;
          padding: 16px;
          padding-inline: 16px;
        }
      }
    }
    </style>`;
const STYLE_INSERTION = PROPOSED_STYLE + '\n';
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const count = (s, part) => s.split(part).length - 1;
const original = () => read(FIXTURE);
const proposed = () => {
  const base = original();
  assert.equal(count(base, ORIGINAL_BODY), 1);
  assert.equal(count(base, '</head>'), 1);
  return base.replace('</head>', STYLE_INSERTION + '</head>').replace(ORIGINAL_BODY, MARKER);
};

function inverse(source) {
  assert.equal(count(source, MARKER), 1, 'exactly one body marker');
  assert.equal(count(source, STYLE_INSERTION), 1, 'exactly one inline style');
  assert.equal(count(source, '<style>'), 1, 'no second inline style');
  const restored = source.replace(STYLE_INSERTION, '').replace(MARKER, ORIGINAL_BODY);
  assert.equal(restored, original(), 'every original route byte is preserved');
  return restored;
}

function inspectStyle(style) {
  assert.equal(style, PROPOSED_STYLE, 'single reviewed presentation proposal');
  assert.match(style, /^    <style>\n    @media screen \{[\s\S]*\n    \}\n    <\/style>$/);
  const selectors = [...style.matchAll(/(?:^|\n)\s*([^{}\n]+)\s*\{/g)].map(m => m[1].trim());
  assert.deepEqual(selectors.filter(s => !s.startsWith('@')), [
    SCOPE,
    `${SCOPE} > .container-fluid`,
    `${SCOPE} > .container-fluid > .title`,
    `${SCOPE} > .container-fluid > form.form`,
    `${SCOPE} > .container-fluid > form.form > .form-group.col`,
    `${SCOPE} > .container-fluid > form.form .form-control`,
    `${SCOPE} > .container-fluid > form.form > .float-right > .btn:focus-visible`,
    `${SCOPE} > .container-fluid > form.form > .float-right`,
    `${SCOPE} > .container-fluid`,
  ]);
  for (const control of ['.form-control', '.form-check-input', '> .float-right > .btn']) {
    for (const state of [':focus', ':focus-visible']) {
      assert.ok(style.includes(`${SCOPE} > .container-fluid > form.form ${control}${state}`));
    }
  }
  for (const originalControl of ['id="copy_job_id"', 'id="search"', 'id="create"']) {
    assert.ok(original().includes(originalControl));
  }
  assert.match(style, /max-width: 860px/);
  assert.match(style, /var\(--oe-wb-ink, #17343b\)/);
  assert.match(style, /var\(--oe-wb-paper, #fff\)/);
  assert.match(style, /var\(--oe-wb-line, #d9e4e2\)/);
  assert.match(style, /min-width: 0/);
  assert.match(style, /max-width: 100%/);
  assert.match(style, /padding-inline: 0/);
  assert.match(style, /float: none !important;/);
  assert.deepEqual([...style.matchAll(/!important/g)].map(m => style.slice(style.lastIndexOf('\n', m.index) + 1, style.indexOf('\n', m.index)).trim()), ['float: none !important;']);
  assert.match(style, /flex-wrap: wrap/);
  assert.match(style, /clear: both/);
  assert.match(style, /outline: 3px solid/);
  assert.match(style, /:focus-visible/);
  assert.match(style, /@media \(width <= 600px\)/);
  assert.doesNotMatch(style, /overflow:\s*hidden|display:\s*none|visibility:|font-size:|font-family:|pointer-events:|(?:^|\n)\s*(?:\.btn|\.form-check-input)\s*\{[^}]*\b(?:color|background-color):/);
}

function changedPaths(base = '09b29da7771aea334ed5745e058751157af980d7') {
  const git = args => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  const committed = git(['diff', '--name-only', '-z', `${base}...HEAD`]).split('\0').filter(Boolean);
  const working = git(['diff', '--name-only', '-z']).split('\0').filter(Boolean);
  const staged = git(['diff', '--cached', '--name-only', '-z']).split('\0').filter(Boolean);
  const untracked = git(['ls-files', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean);
  return [...new Set([...committed, ...working, ...staged, ...untracked])].sort();
}

function checkScope(paths) {
  for (const p of paths) assert.ok(PR_PATHS.includes(p), `unintended PR path: ${p}`);
  assert.equal(new Set(PR_PATHS).size, 5);
}

function history() {
  const git = args => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  const base = '09b29da7771aea334ed5745e058751157af980d7';
  assert.equal(git(['rev-parse', base]).trim(), base);
  assert.equal(git(['show', `${base}:${ROUTE}`]), original(), 'fixture must be exact Git route baseline');
  for (const p of SUPPORT) {
    assert.equal(read(p), git(['show', `${base}:${p}`]), `support source changed: ${p}`);
  }
  const changed = changedPaths(base);
  checkScope(changed);
  assert.deepEqual(changed, [...PR_PATHS].sort(), 'eventual PR must contain exactly the five intended paths');
}

const PLAN = Object.freeze([
  'synthetic proposal and exact inverse',
  'current route has presentation',
  'screen context and geometry',
  'nonpresentation mutations rejected',
  'declaration removals rejected',
  'all intended paths allowed',
  ...((process.argv.includes('--history') || process.env.FAX_POPUP_HISTORY === '1') ? ['history baseline and scope'] : []),
]);

if (require.main === module) {
  test(PLAN[0], () => { inspectStyle(PROPOSED_STYLE); inverse(proposed()); });
  test(PLAN[1], () => {
    const route = read(ROUTE);
    assert.ok(route.includes(MARKER) && route.includes(STYLE_INSERTION), 'missing fax patient presentation');
    inverse(route);
  });
  test(PLAN[2], () => inspectStyle(PROPOSED_STYLE));
  test(PLAN[3], () => {
    const good = proposed();
    for (const [before, after] of [
      ["CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: true)", "CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: false)"],
      ["$clientApp->chartFaxDocument($pid, $job_id)", "$clientApp->chartFaxDocument(0, $job_id)"],
      ["name='fname'", "name='first_name'"],
      ["id=\"search\"", "id=\"find\""],
      ["checkDupl();", "srcConfirmSave();"],
      ["onsubmit='return validate()'", "onsubmit='return true'"],
    ]) {
      assert.ok(good.includes(before));
      assert.throws(() => inverse(good.replace(before, after)));
    }
  });
  test(PLAN[4], () => {
    const declarations = PROPOSED_STYLE.match(/^\s+[\w-]+:\s*[^;]+;$/gm) || [];
    assert.ok(declarations.length > 20);
    for (const declaration of declarations) {
      assert.throws(() => inspectStyle(PROPOSED_STYLE.replace(declaration, '')));
      assert.throws(() => inverse(proposed().replace(declaration, '')));
    }
    const noFloatOverride = PROPOSED_STYLE.replace('float: none !important;', '');
    assert.notEqual(noFloatOverride, PROPOSED_STYLE);
    assert.throws(() => inspectStyle(noFloatOverride));
    assert.throws(() => inverse(proposed().replace('float: none !important;', '')));
  });
  test(PLAN[5], () => {
    checkScope(PR_PATHS);
    assert.throws(() => checkScope([...PR_PATHS, 'config/config.yaml']));
  });
  if (PLAN[6]) test(PLAN[6], history);
}

module.exports = { PLAN, MARKER, PROPOSED_STYLE, STYLE_INSERTION, proposed, inverse, inspectStyle, checkScope, history, PR_PATHS };
