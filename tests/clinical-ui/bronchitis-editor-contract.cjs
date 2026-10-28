'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const test = require('node:test');

const root = path.resolve(__dirname, '../..');
const BASE = '09b29da7771aea334ed5745e058751157af980d7';
const files = [
  { source: 'interface/forms/bronchitis/new.php', fixture: 'tests/clinical-ui/fixtures/bronchitis-new-original.php.txt', bytes: 19291, sha: '6d6cd9b858b21ba6f5765c0cfce2eac4c94b573fd000d8b5ea248242a4263466' },
  { source: 'interface/forms/bronchitis/view.php', fixture: 'tests/clinical-ui/fixtures/bronchitis-view-original.php.txt', bytes: 26579, sha: 'd350d7016410e6ea633beb08848f8264475d2c7c9ded736190743259593555dc' }
];
const prefix = 'html.oe-workbench-context body.oe-bronchitis-editor';
const CSS = `<style>
@media screen {
  html.oe-workbench-context body.oe-bronchitis-editor {
    margin: 0;
    padding: clamp(0.75rem, 3vw, 1.5rem);
    background-color: #e8eff0 !important;
    color: #182c36 !important;
  }

  html.oe-workbench-context body.oe-bronchitis-editor form[name='my_form'] {
    box-sizing: border-box;
    width: 100%;
    max-width: 860px;
    margin: 0 auto;
    padding: clamp(1rem, 3vw, 2rem);
    border: 1px solid #c7d5d9;
    background-color: #fff;
    color: #182c36;
    font-size: 1.25rem;
    line-height: 1.5;
  }

  html.oe-workbench-context body.oe-bronchitis-editor form[name='my_form'] .title {
    display: block;
    margin: 0 0 1rem;
    color: #183b49;
    font-size: 1.6rem;
    font-weight: 700;
    line-height: 1.25;
  }

  html.oe-workbench-context body.oe-bronchitis-editor form[name='my_form'] .text {
    color: #183b49;
    font-size: 1rem;
    font-weight: 600;
  }

  html.oe-workbench-context body.oe-bronchitis-editor form[name='my_form'] table {
    width: 100%;
    max-width: 100%;
    margin: 0.5rem 0;
    border-collapse: collapse;
    font-size: 1rem;
  }

  html.oe-workbench-context body.oe-bronchitis-editor form[name='my_form'] tr {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem 0.35rem;
    padding: 0.3rem 0;
    border-bottom: 1px solid #e5ecee;
  }

  html.oe-workbench-context body.oe-bronchitis-editor form[name='my_form'] th {
    display: block;
    padding: 0.5rem 0;
    color: #183b49;
    text-align: left;
  }

  html.oe-workbench-context body.oe-bronchitis-editor form[name='my_form'] td {
    box-sizing: border-box;
    width: auto;
    max-width: 100%;
    padding: 0.2rem 0;
    text-align: left;
    white-space: normal;
    overflow-wrap: anywhere;
  }

  html.oe-workbench-context body.oe-bronchitis-editor form[name='my_form'] td[align='right'] {
    text-align: left;
  }

  html.oe-workbench-context body.oe-bronchitis-editor form[name='my_form'] input[type='text'],
  html.oe-workbench-context body.oe-bronchitis-editor form[name='my_form'] select,
  html.oe-workbench-context body.oe-bronchitis-editor form[name='my_form'] textarea {
    box-sizing: border-box;
    max-width: 100%;
    border: 1px solid #91a8b1;
    border-radius: 3px;
    background-color: #fff;
    color: #182c36;
    font: inherit;
  }

  html.oe-workbench-context body.oe-bronchitis-editor form[name='my_form'] input[type='text'],
  html.oe-workbench-context body.oe-bronchitis-editor form[name='my_form'] select {
    min-height: 2.4rem;
    padding: 0.35rem 0.5rem;
  }

  html.oe-workbench-context body.oe-bronchitis-editor form[name='my_form'] input[type='checkbox'] {
    width: 1.1rem;
    height: 1.1rem;
    margin: 0 0.3rem 0 0;
    accent-color: #145968;
    vertical-align: middle;
  }

  html.oe-workbench-context body.oe-bronchitis-editor form[name='my_form'] textarea {
    display: block;
    width: 100%;
    min-height: 12rem;
    padding: 0.75rem;
    line-height: 1.7;
    resize: vertical;
  }

  html.oe-workbench-context body.oe-bronchitis-editor form[name='my_form'] a.link_submit {
    display: inline-block;
    margin: 0.3rem 0;
    padding: 0.5rem 0.85rem;
    border: 1px solid #145968;
    border-radius: 3px;
    background-color: #145968;
    color: #fff;
    font-size: 1rem;
    font-weight: 600;
    text-decoration: none;
  }

  html.oe-workbench-context body.oe-bronchitis-editor form[name='my_form'] a.link {
    display: inline-block;
    margin: 0.3rem 0;
    padding: 0.5rem 0.85rem;
    border: 1px solid #91a8b1;
    border-radius: 3px;
    background-color: #eef3f4 !important;
    color: #183b49 !important;
    text-decoration: none;
  }

  html.oe-workbench-context body.oe-bronchitis-editor form[name='my_form'] input[type='button'] {
    min-height: 2.4rem;
    padding: 0.5rem 0.85rem;
    border: 1px solid #91a8b1;
    border-radius: 3px;
    background-color: #eef3f4;
    color: #183b49;
    font: inherit;
    cursor: pointer;
  }

  html.oe-workbench-context body.oe-bronchitis-editor form[name='my_form'] a:focus,
  html.oe-workbench-context body.oe-bronchitis-editor form[name='my_form'] input:focus,
  html.oe-workbench-context body.oe-bronchitis-editor form[name='my_form'] select:focus,
  html.oe-workbench-context body.oe-bronchitis-editor form[name='my_form'] textarea:focus {
    outline: 3px solid #a84c22;
    outline-offset: 2px;
  }

  html.oe-workbench-context body.oe-bronchitis-editor form[name='my_form'] a:focus-visible,
  html.oe-workbench-context body.oe-bronchitis-editor form[name='my_form'] input:focus-visible,
  html.oe-workbench-context body.oe-bronchitis-editor form[name='my_form'] select:focus-visible,
  html.oe-workbench-context body.oe-bronchitis-editor form[name='my_form'] textarea:focus-visible {
    outline: 3px solid #a84c22;
    outline-offset: 2px;
  }
}

</style>`;
const additions = [
  ['</head>', `${CSS}\n</head>`],
  ['<body class="body_top">', '<body class="body_top oe-bronchitis-editor">']
];
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const read = (p) => fs.readFileSync(path.join(root, p));
const git = (...args) => execFileSync('git', args, { cwd: root });

function replaceOnce(bytes, before, after) {
  const source = Buffer.from(bytes);
  const needle = Buffer.from(before);
  const at = source.indexOf(needle);
  assert.notEqual(at, -1, `missing seam: ${before.slice(0, 50)}`);
  assert.equal(at, source.lastIndexOf(needle), `duplicate seam: ${before.slice(0, 50)}`);
  return Buffer.concat([source.subarray(0, at), Buffer.from(after), source.subarray(at + needle.length)]);
}

function original(file) {
  const bytes = read(file.fixture);
  assert.equal(bytes.length, file.bytes, `${file.fixture} byte count`);
  assert.equal(hash(bytes), file.sha, `${file.fixture} SHA256`);
  return bytes;
}

function proposed(bytes) {
  return additions.reduce((value, [before, after]) => replaceOnce(value, before, after), Buffer.from(bytes));
}

function verifySource(source, baseline) {
  let value = Buffer.from(source);
  for (const [before, after] of [...additions].reverse()) value = replaceOnce(value, after, before);
  assert.deepEqual(value, baseline, 'all original bytes survive exact additions');
}

function rules(css) {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    selectors: match[1].split(',').map((part) => part.trim()),
    declarations: match[2]
  }));
}

function rule(css, selector, declarations) {
  const target = selector ? `${prefix} ${selector}` : prefix;
  const matches = rules(css).filter((item) => item.selectors.includes(target));
  assert.ok(matches.length, `missing selector ${selector}`);
  for (const declaration of declarations) assert.ok(matches.some((item) => item.declarations.includes(declaration)), `${selector}: ${declaration}`);
}

const allowed = new Set([
  ...files.flatMap((file) => [file.source, file.fixture]),
  'tests/clinical-ui/bronchitis-editor-contract.cjs',
  'tests/js/bronchitis-editor.test.js',
  'docs/clinical-ui/BRONCHITIS-EDITOR.md'
]);
function checkScope(paths) {
  for (const p of paths) assert.ok(allowed.has(p), `out-of-scope path: ${p}`);
}

const args = process.argv.slice(2);
assert.ok(args.every((arg) => arg === '--history' || arg === '--export-css') && new Set(args).size === args.length && !(args.includes('--history') && args.includes('--export-css')), 'invalid option');
if (args.includes('--export-css')) {
  process.stdout.write(CSS);
} else {
  test('both frozen originals have authenticated bytes and native clinical actions', () => {
    for (const file of files) {
      const source = original(file).toString();
      for (const token of ['name="my_form"', 'name="csrf_token_form"', 'bronchitis_date_of_illness', 'bronchitis_hpi', 'bronchitis_diagnostic_tests', 'bronchitis_additional_diagnosis', 'bronchitis_treatment', 'link_submit', "Don\\'t Save", 'formFooter();']) assert.ok(source.includes(token), `${file.source}: ${token}`);
      assert.equal((source.match(/class="link_submit"/g) || []).length, 2);
      assert.equal((source.match(/onclick="top.restoreSession\(\)"/g) || []).length, 2);
    }
    assert.match(original(files[0]).toString(), /onset_check\(my_form\)/);
    assert.match(original(files[1]).toString(), /formFetch\("form_bronchitis"/);
  });

  test('the style is screen-only, scoped, and contains no hidden controls or broad transitions', () => {
    assert.match(CSS, /^<style>\n@media screen \{/);
    assert.doesNotMatch(CSS, /@media print|display:\s*none|overflow-x:\s*(?:hidden|auto)|transition:/);
    for (const item of rules(CSS)) for (const selector of item.selectors) assert.ok(selector === prefix || selector.startsWith(`${prefix} `), `unscoped: ${selector}`);
    assert.equal((CSS.match(/<style>/g) || []).length, 1);
    assert.equal((CSS.match(/<\/style>/g) || []).length, 1);
  });

  test('paper, flexible rows, and narrative writing geometry are substantive', () => {
    rule(CSS, '', ['background-color: #e8eff0 !important;', 'color: #182c36 !important;']);
    rule(CSS, "form[name='my_form']", ['box-sizing: border-box;', 'width: 100%;', 'max-width: 860px;', 'margin: 0 auto;', 'background-color: #fff;', 'color: #182c36;', 'font-size: 1.25rem;']);
    rule(CSS, "form[name='my_form'] tr", ['display: flex;', 'flex-wrap: wrap;']);
    rule(CSS, "form[name='my_form'] td", ['width: auto;', 'max-width: 100%;', 'overflow-wrap: anywhere;']);
    rule(CSS, "form[name='my_form'] textarea", ['width: 100%;', 'min-height: 12rem;', 'line-height: 1.7;', 'resize: vertical;']);
    rule(CSS, "form[name='my_form'] .title", ['display: block;', 'font-size: 1.6rem;']);
  });

  test('fluid padding and row spacing avoid range queries and relational selectors', () => {
    rule(CSS, '', ['padding: clamp(0.75rem, 3vw, 1.5rem);']);
    rule(CSS, "form[name='my_form']", ['padding: clamp(1rem, 3vw, 2rem);']);
    rule(CSS, "form[name='my_form'] tr", ['gap: 0.4rem 0.35rem;']);
    assert.doesNotMatch(CSS, /@media[^{}]*\([^)]*(?:<=|>=|<|>)[^)]*\)/);
    assert.doesNotMatch(CSS, /:has\s*\(/);
    assert.doesNotMatch(CSS, /(?:column-gap|row-gap)\s*:/);
  });

  test('native actions and controls retain paired readable colors and visible focus', () => {
    rule(CSS, "form[name='my_form'] a.link_submit", ['background-color: #145968;', 'color: #fff;']);
    rule(CSS, "form[name='my_form'] a.link", ['background-color: #eef3f4 !important;', 'color: #183b49 !important;']);
    rule(CSS, "form[name='my_form'] input[type='button']", ['background-color: #eef3f4;', 'color: #183b49;']);
    rule(CSS, "form[name='my_form'] input[type='text']", ['background-color: #fff;', 'color: #182c36;']);
    rule(CSS, "form[name='my_form'] a:focus", ['outline: 3px solid #a84c22;']);
    rule(CSS, "form[name='my_form'] a:focus-visible", ['outline: 3px solid #a84c22;']);
  });

  test('synthetic candidates have exactly one style and one body marker', () => {
    for (const file of files) {
      const baseline = original(file);
      const candidate = proposed(baseline);
      verifySource(candidate, baseline);
      assert.equal((candidate.toString().match(/<style>/g) || []).length, 1);
      assert.equal((candidate.toString().match(/oe-bronchitis-editor">/g) || []).length, 1);
    }
  });

  test('semantic and presentation mutations fail byte-exact inverse', () => {
    const baseline = original(files[0]);
    const candidate = proposed(baseline);
    for (const [before, after] of [
      ['name="csrf_token_form"', 'name="other_token"'],
      ['onset_check(my_form)', 'onset_check(other_form)'],
      ['@media screen {', '@media print {'],
      ['html.oe-workbench-context', 'html.other-context'],
      ['max-width: 860px;', 'max-width: 1200px;'],
      ['min-height: 12rem;', 'min-height: 2rem;'],
      ['line-height: 1.7;', 'line-height: 1;'],
      ['background-color: #eef3f4 !important;', 'background-color: #fff !important;'],
      ['outline: 3px solid #a84c22;', 'outline: 0;'],
      ['body_top oe-bronchitis-editor', 'body_top other-editor']
    ]) assert.throws(() => verifySource(replaceOnce(candidate, before, after), baseline), `mutant: ${before}`);
    assert.throws(() => verifySource(baseline, baseline), 'unchanged source is red');
    assert.throws(() => verifySource(replaceOnce(candidate, `${CSS}\n</head>`, '</head>'), baseline), 'missing style');
    assert.throws(() => verifySource(replaceOnce(candidate, '<body class="body_top oe-bronchitis-editor">', '<body class="body_top">'), baseline), 'missing body marker');
    assert.throws(() => verifySource(Buffer.concat([candidate, Buffer.from('x')]), baseline), 'extra source edit');
    assert.throws(() => verifySource(replaceOnce(candidate, '<style>', '<style><style>'), baseline), 'duplicate style');
  });

  test('malformed insertion seams and duplicate markers fail', () => {
    for (const [before, after] of additions) {
      assert.throws(() => replaceOnce(Buffer.from(`${before}${before}`), before, after));
      assert.throws(() => replaceOnce(Buffer.from('absent'), before, after));
    }
    const baseline = original(files[1]);
    assert.throws(() => verifySource(replaceOnce(proposed(baseline), '<body class="body_top oe-bronchitis-editor">', '<body class="body_top oe-bronchitis-editor oe-bronchitis-editor">'), baseline));
  });

  test('seven-path change boundary rejects unrelated paths', () => {
    checkScope([...allowed]);
    assert.throws(() => checkScope(['interface/forms/bronchitis/save.php']), /out-of-scope/);
  });

  test('actual new and edit sources contain exactly the planned additions', () => {
    for (const file of files) {
      const baseline = original(file);
      const live = read(file.source);
      assert.ok(!live.equals(baseline), `${file.source}: presentation addition missing`);
      verifySource(live, baseline);
    }
  });

  if (args.includes('--history')) test('base fixtures and committed plus working changes stay in seven-path scope', () => {
    git('merge-base', '--is-ancestor', BASE, 'HEAD');
    for (const file of files) assert.deepEqual(original(file), git('show', `${BASE}:${file.source}`));
    const split = (bytes) => bytes.toString().split('\0').filter(Boolean);
    const changed = [
      ...split(git('diff', '--name-only', '-z', '--no-renames', BASE, 'HEAD', '--')),
      ...split(git('diff', '--name-only', '-z', '--no-renames', 'HEAD', '--')),
      ...split(git('diff', '--cached', '--name-only', '-z', '--no-renames', '--')),
      ...split(git('ls-files', '--others', '--exclude-standard', '-z'))
    ];
    checkScope(changed);
    for (const file of changed) if (fs.existsSync(path.join(root, file))) assert.ok(!fs.lstatSync(path.join(root, file)).isSymbolicLink(), `symlink: ${file}`);
  });
}

module.exports = { CSS, original, proposed, verifySource, files };
