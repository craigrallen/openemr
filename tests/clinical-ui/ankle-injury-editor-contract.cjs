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
  { source: 'interface/forms/ankleinjury/new.php', fixture: 'tests/clinical-ui/fixtures/ankle-injury-new-original.php.txt', bytes: 12867, sha: '928f22662c7e256ec87ab65653c9d2c9673d0e2567104cbe72beb97059babb64' },
  { source: 'interface/forms/ankleinjury/view.php', fixture: 'tests/clinical-ui/fixtures/ankle-injury-view-original.php.txt', bytes: 9344, sha: 'ec5a07e5c0b1bbfdad602fbecb9a081d63c49c21618dce550b99d559424ee2a2' }
];
const supporting = [
  ['interface/forms/ankleinjury/save.php', 'c38d8424ed52bc64fc371954555224c88a66ed46102e9f59a9a868d8e34f1a8d'],
  ['interface/forms/ankleinjury/report.php', '9e80dcc37db5b7b39561615a95ea9f8c622219152fb95a58906519ec7a6cd97f'],
  ['library/api.inc.php', '428d50d4169f22523a845ab3a321e55906b9cdb4982aca9afc0f8da9e7bceb21'],
  ['interface/clinical-workspace/popup.css', 'ea56e9f26990e843219a68f315c188f7e2b0581c20321bac4517dc4ba34e79a9']
];
const documentPath = '/Users/craig/artifacts/OpenEMR-Research/researched/index.html';
const documentSha = '9fdbaf600377cbe9e13a546640a8b4d59b354f43a8cddf04548d0bc94fa62684';
const prefix = 'html.oe-workbench-context body.oe-ankle-injury-editor';
const form = `${prefix} form[name='my_form']`;
const CSS = `<style>
@media screen {
  ${prefix} {
    box-sizing: border-box;
    margin: 0;
    padding: clamp(0.75rem, 3vw, 1.5rem);
    background-color: #e8eff0 !important;
    color: #182c36 !important;
  }

  ${form} {
    box-sizing: border-box;
    width: 100%;
    max-width: 860px;
    margin: 0 auto;
    padding: clamp(1rem, 3vw, 2rem);
    border: 1px solid #c7d5d9;
    background-color: #fff;
    color: #182c36;
    font-size: 1rem;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }

  ${form} .title {
    display: block;
    margin: 0 0 1rem;
    color: #183b49;
    font-size: 1.6rem;
    font-weight: 700;
    line-height: 1.25;
  }

  ${form} .text,
  ${form} th {
    color: #183b49;
    font-weight: 600;
  }

  ${form} table {
    display: block;
    box-sizing: border-box;
    width: 100%;
    max-width: 100%;
    margin: 0.75rem 0;
    overflow-x: auto;
    border-collapse: collapse;
  }

  ${form} th,
  ${form} td {
    padding: 0.35rem 0.5rem;
    white-space: nowrap;
    overflow-wrap: normal;
    word-break: normal;
  }

  ${form} table.oe-ankle-plan {
    display: table;
    table-layout: fixed;
    width: 100%;
  }

  ${form} table.oe-ankle-plan td {
    width: 100%;
  }

  ${form} input[type='text'],
  ${form} select,
  ${form} textarea {
    box-sizing: border-box;
    max-width: 100%;
    border: 1px solid #91a8b1;
    border-radius: 3px;
    background-color: #fff;
    color: #182c36;
    font: inherit;
  }

  ${form} input[type='text'],
  ${form} select {
    min-height: 2.4rem;
    padding: 0.35rem 0.5rem;
  }

  ${form} input[type='radio'],
  ${form} input[type='checkbox'] {
    width: 1.1rem;
    height: 1.1rem;
    margin: 0 0.35rem;
    accent-color: #145968;
    vertical-align: middle;
  }

  ${form} textarea[name='ankle_how_did_injury_occur'],
  ${form} textarea[name='ankle_plan'] {
    display: block;
    width: 100%;
    min-height: 12rem;
    padding: 0.75rem;
    line-height: 1.7;
    resize: vertical;
    white-space: pre-wrap;
  }

  ${form} textarea[name='ankle_additional_x_ray_notes'],
  ${form} textarea[name='ankle_additional_diagnisis'] {
    display: block;
    width: 15rem;
    min-height: 4.5rem;
    padding: 0.5rem;
    line-height: 1.45;
    resize: vertical;
  }

  ${form} a.link_submit,
  ${form} a.link {
    display: inline-block;
    box-sizing: border-box;
    max-width: 100%;
    min-height: 2.4rem;
    margin: 0.35rem 0;
    padding: 0.5rem 0.85rem;
    border-radius: 3px;
    font-weight: 600;
    text-decoration: none;
    vertical-align: middle;
    white-space: normal;
  }

  ${form} a.link_submit {
    border: 1px solid #145968;
    background-color: #145968;
    color: #fff;
  }

  ${form} a.link {
    border: 1px solid #91a8b1;
    background-color: #eef3f4 !important;
    color: #183b49 !important;
  }

  ${form} a:focus,
  ${form} input:focus,
  ${form} select:focus,
  ${form} textarea:focus {
    outline: 3px solid #a84c22;
    outline-offset: 2px;
  }
}
</style>`;
const additions = [
  ['</head>', `${CSS}\n</head>`],
  ['<body class="body_top">', '<body class="body_top oe-ankle-injury-editor">'],
  ['<table><tr><th><?php echo xlt(\'Plan:\'); ?></th><tr>', '<table class="oe-ankle-plan"><tr><th><?php echo xlt(\'Plan:\'); ?></th><tr>']
];
const allowed = new Set([
  ...files.flatMap((file) => [file.source, file.fixture]),
  'tests/clinical-ui/ankle-injury-editor-contract.cjs',
  'tests/js/ankle-injury-editor.test.js',
  'docs/clinical-ui/ANKLE-INJURY-EDITOR.md'
]);
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const read = (p) => fs.readFileSync(path.join(root, p));
const git = (...args) => execFileSync('git', args, { cwd: root });

function replaceOnce(bytes, before, after) {
  const value = Buffer.from(bytes);
  const needle = Buffer.from(before);
  const at = value.indexOf(needle);
  assert.notEqual(at, -1, `missing seam: ${before.slice(0, 55)}`);
  assert.equal(at, value.lastIndexOf(needle), `duplicate seam: ${before.slice(0, 55)}`);
  return Buffer.concat([value.subarray(0, at), Buffer.from(after), value.subarray(at + needle.length)]);
}

function original(file) {
  const bytes = read(file.fixture);
  assert.equal(bytes.length, file.bytes, `${file.fixture} length`);
  assert.equal(hash(bytes), file.sha, `${file.fixture} SHA256`);
  return bytes;
}

function proposed(bytes) {
  return additions.reduce((value, [before, after]) => replaceOnce(value, before, after), Buffer.from(bytes));
}

function verifySource(source, baseline) {
  let value = Buffer.from(source);
  for (const [before, after] of [...additions].reverse()) value = replaceOnce(value, after, before);
  assert.deepEqual(value, baseline, 'all original bytes survive the exact additions');
}

function rules(css) {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    selectors: match[1].split(',').map((part) => part.trim()),
    declarations: match[2]
  }));
}

function values(css, selector, property) {
  return rules(css).filter((item) => item.selectors.includes(selector)).flatMap((item) =>
    [...item.declarations.matchAll(new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+);`, 'g'))].map((match) => match[1].trim()));
}

function expectValue(css, selector, property, value) {
  assert.deepEqual(values(css, selector, property), [value], `${selector}: ${property}`);
}

function verifyCss(css) {
  assert.match(css, /^<style>\n@media screen \{/);
  assert.match(css, /\}\n<\/style>$/);
  assert.equal((css.match(/@media/g) || []).length, 1);
  assert.doesNotMatch(css, /@media print|:has\s*\(|\bdisplay\s*:\s*none\b|\bvisibility\s*:\s*hidden\b|\bopacity\s*:\s*0\s*;/);
  assert.doesNotMatch(css, /\b(?:overflow|overflow-x|overflow-y)\s*:\s*(?:hidden|clip)\b/);
  for (const item of rules(css)) for (const selector of item.selectors) {
    assert.ok(selector === prefix || selector.startsWith(`${prefix} `), `unscoped: ${selector}`);
    assert.doesNotMatch(selector, /^(?:html|body|form|table|tr|td|th)$/, 'bare selector');
  }
  expectValue(css, form, 'max-width', '860px');
  expectValue(css, form, 'overflow-wrap', 'anywhere');
  expectValue(css, `${form} table`, 'overflow-x', 'auto');
  expectValue(css, `${form} table`, 'max-width', '100%');
  expectValue(css, `${form} table.oe-ankle-plan`, 'display', 'table');
  expectValue(css, `${form} table.oe-ankle-plan`, 'table-layout', 'fixed');
  expectValue(css, `${form} th`, 'white-space', 'nowrap');
  expectValue(css, `${form} td`, 'white-space', 'nowrap');
  expectValue(css, `${form} table.oe-ankle-plan td`, 'width', '100%');
  for (const name of ['ankle_how_did_injury_occur', 'ankle_plan']) {
    const selector = `${form} textarea[name='${name}']`;
    expectValue(css, selector, 'width', '100%');
    expectValue(css, selector, 'min-height', '12rem');
    expectValue(css, selector, 'line-height', '1.7');
  }
  for (const name of ['ankle_additional_x_ray_notes', 'ankle_additional_diagnisis']) {
    const selector = `${form} textarea[name='${name}']`;
    expectValue(css, selector, 'width', '15rem');
    expectValue(css, selector, 'min-height', '4.5rem');
  }
  for (const cell of ['tr', 'td', 'th']) {
    for (const item of rules(css).filter((rule) => rule.selectors.some((selector) => selector.endsWith(` ${cell}`)))) {
      assert.doesNotMatch(item.declarations, /\bdisplay\s*:/, `${cell} retains native layout`);
      assert.doesNotMatch(item.declarations, /\b(?:float|position|flex|grid)\s*:/, `${cell} retains source relationships`);
    }
  }
  const overflow = rules(css).flatMap((item) => [...item.declarations.matchAll(/\boverflow-x\s*:\s*([^;]+);/g)].map((match) => [item.selectors, match[1].trim()]));
  assert.deepEqual(overflow, [[ [`${form} table`], 'auto' ]], 'only existing tables scroll horizontally');
  expectValue(css, `${form} a.link_submit`, 'color', '#fff');
  expectValue(css, `${form} a.link`, 'color', '#183b49 !important');
  expectValue(css, `${form} a.link`, 'white-space', 'normal');
  expectValue(css, `${form} a:focus`, 'outline', '3px solid #a84c22');
}

function checkScope(paths) {
  for (const p of paths) assert.ok(allowed.has(p), `out-of-scope path: ${p}`);
}

const args = process.argv.slice(2);
assert.ok(args.every((arg) => ['--history', '--export-css'].includes(arg)) && new Set(args).size === args.length && !(args.includes('--history') && args.includes('--export-css')), 'invalid option');
if (args.includes('--export-css')) {
  process.stdout.write(CSS);
} else {
  test('frozen originals authenticate complete source bytes and clinical controls', () => {
    for (const file of files) {
      const source = original(file).toString();
      for (const token of ['name="my_form"', 'name="csrf_token_form"', 'ankle_date_of_injuary', 'ankle_how_did_injury_occur', 'ankle_additional_x_ray_notes', 'ankle_additional_diagnisis', 'ankle_plan', 'ankle_ottawa_bone_tenderness', 'formFooter();']) assert.ok(source.includes(token), `${file.source}: ${token}`);
      assert.equal((source.match(/class="link_submit"/g) || []).length, 2);
      assert.equal((source.match(/onclick="top.restoreSession\(\)"/g) || []).length, 2);
      assert.match(source, /<td rowspan\s*=\s*["']?\d+/);
      assert.match(source, /<th colspan="5">/);
      assert.equal((source.match(/<table><tr><th><\?php echo xlt\('Plan:'\); \?><\/th><tr>/g) || []).length, 1);
    }
    assert.match(original(files[0]).toString(), /save\.php\?mode=new/);
    assert.match(original(files[0]).toString(), /openemr_net_cptcode/);
    assert.match(original(files[1]).toString(), /formFetch\("form_ankleinjury", \$_GET\["id"\]\)/);
  });

  test('supporting API, save, report, and popup references retain integration evidence', () => {
    for (const [file, sha] of supporting) assert.equal(hash(read(file)), sha, `${file} SHA256`);
    const api = read('library/api.inc.php').toString();
    assert.match(api, /function formHeader\(/);
    assert.match(api, /function formFetch\(/);
    assert.match(api, /where id=\? and pid = \? and activity like \?/);
    const save = read('interface/forms/ankleinjury/save.php').toString();
    assert.match(save, /CsrfUtils::checkCsrfInput\(INPUT_POST, dieOnFail: true\)/);
    assert.match(save, /formSubmit\("form_ankleinjury"/);
    assert.match(save, /ankle_additional_diagnisis = \?/);
    assert.match(read('interface/forms/ankleinjury/report.php').toString(), /formFetch\("form_ankleinjury", \$id\)/);
    assert.match(read('interface/clinical-workspace/popup.css').toString(), /html\.oe-workbench-context/);
  });

  test('proposal is screen scoped, readable, compact where needed, and leaves cells native', () => verifyCss(CSS));

  test('Plan uses full-width native table layout', () => {
    verifyCss(CSS);
    const planRule = `  ${form} table.oe-ankle-plan {\n    display: table;\n    table-layout: fixed;\n    width: 100%;\n  }`;
    for (const alteredRule of [
      `  ${form} table.oe-ankle-plan {\n    display: block;\n    table-layout: fixed;\n    width: 100%;\n  }`,
      `  ${form} table.oe-ankle-plan {\n    display: table;\n    table-layout: auto;\n    width: 100%;\n  }`
    ]) {
      const mutant = replaceOnce(CSS, planRule, alteredRule).toString();
      assert.notEqual(mutant, CSS);
      assert.throws(() => verifyCss(mutant), 'Plan layout mutant rejected');
    }
  });

  test('synthetic new and view proposals invert to entire frozen originals', () => {
    for (const file of files) {
      const baseline = original(file);
      const candidate = proposed(baseline);
      verifySource(candidate, baseline);
      assert.equal((candidate.toString().match(/<style>/g) || []).length, 1);
      assert.equal((candidate.toString().match(/body_top oe-ankle-injury-editor/g) || []).length, 1);
      assert.equal((candidate.toString().match(/table class="oe-ankle-plan"/g) || []).length, 1);
    }
  });

  test('original source and action mutants fail the mandatory inverse', () => {
    const baseline = original(files[0]);
    const candidate = proposed(baseline);
    verifySource(candidate, baseline);
    for (const [before, after] of [
      ['name="csrf_token_form"', 'name="other_token"'],
      ['CsrfUtils::collectCsrfToken(session: $session)', 'CsrfUtils::collectCsrfToken(session: $other)'],
      ['save.php?mode=new', 'save.php?mode=update'],
      ['name="ankle_date_of_injuary"', 'name="ankle_date_of_injury"'],
      ['value="Medial malleolus"', 'value="Lateral malleolus"'],
      ['function doCPT(select)', 'function doCPT(other)'],
      ['<td rowspan="4">', '<td rowspan="1">'],
      ['<tr><th><?php echo xlt(\'X-RAY Interpretation:\'); ?></th>', '<tr><th>Changed</th>'],
      ['</form>', '</form><div></div>']
    ]) {
      const mutant = replaceOnce(candidate, before, after);
      assert.ok(!mutant.equals(candidate));
      assert.throws(() => verifySource(mutant, baseline), `rejected: ${before}`);
    }
    const viewBaseline = original(files[1]);
    const viewCandidate = proposed(viewBaseline);
    verifySource(viewCandidate, viewBaseline);
    for (const [before, after] of [
      ['formFetch("form_ankleinjury", $_GET["id"])', 'formFetch("other_form", $_GET["id"])'],
      ['attr_url($_GET["id"])', '$_GET["id"]'],
      ['name="ankle_plan"', 'name="other_plan"']
    ]) {
      const mutant = replaceOnce(viewCandidate, before, after);
      assert.ok(!mutant.equals(viewCandidate));
      assert.throws(() => verifySource(mutant, viewBaseline), `rejected: ${before}`);
    }
  });

  test('style, context, class, print, and hidden-control mutants fail', () => {
    const baseline = original(files[1]);
    const candidate = proposed(baseline);
    verifySource(candidate, baseline);
    for (const [before, after] of [
      ['@media screen {', '@media print {'],
      [`${prefix} {`, 'html.other-context body.oe-ankle-injury-editor {'],
      ['max-width: 860px;', 'max-width: 1200px;'],
      ["textarea[name='ankle_plan']", "textarea[name='ankle_additional_diagnisis']"],
      ['min-height: 12rem;', 'min-height: 2rem;'],
      ['overflow-x: auto;', 'overflow-x: hidden;'],
      ['body_top oe-ankle-injury-editor', 'body_top other-editor'],
      ['table class="oe-ankle-plan"', 'table class="other-plan"'],
      ['</style>', `${form} input { display: none; }</style>`]
    ]) {
      const mutant = replaceOnce(candidate, before, after);
      assert.ok(!mutant.equals(candidate));
      assert.throws(() => verifySource(mutant, baseline), `rejected: ${before}`);
    }
    for (const [before, after] of [['overflow-x: auto;', 'overflow-x: hidden;'], ['min-height: 12rem;', 'min-height: 2rem;'], ['white-space: nowrap;', 'white-space: normal;']]) {
      const mutant = CSS.replaceAll(before, after);
      assert.notEqual(mutant, CSS);
      assert.throws(() => verifyCss(mutant), `CSS rejected: ${before}`);
    }
    assert.throws(() => verifyCss(CSS.replace('</style>', `${form} td { display: flex; }</style>`)));
    assert.throws(() => verifyCss(CSS.replace('</style>', `${form} input { display: none; }</style>`)));
    assert.throws(() => verifyCss(CSS.replace('</style>', 'body { color: red; }</style>')));
  });

  test('missing and duplicate seams, untouched files, and extra bytes fail', () => {
    for (const [before, after] of additions) {
      assert.throws(() => replaceOnce(Buffer.from(`${before}${before}`), before, after));
      assert.throws(() => replaceOnce(Buffer.from('absent'), before, after));
    }
    const baseline = original(files[0]);
    const candidate = proposed(baseline);
    verifySource(candidate, baseline);
    assert.throws(() => verifySource(baseline, baseline));
    assert.throws(() => verifySource(Buffer.concat([candidate, Buffer.from('x')]), baseline));
    const duplicateStyle = replaceOnce(candidate, '<style>', '<style><style>');
    assert.throws(() => verifySource(duplicateStyle, baseline));
  });

  test('seven-path boundary includes final documentation and rejects unrelated paths', () => {
    assert.equal(allowed.size, 7);
    checkScope([...allowed]);
    assert.throws(() => checkScope(['interface/forms/ankleinjury/save.php']), /out-of-scope/);
    assert.throws(() => checkScope(['docs/clinical-ui/OTHER-EDITOR.md']), /out-of-scope/);
  });

  test('live new and view files contain exactly the planned additions', () => {
    for (const file of files) {
      const baseline = original(file);
      const live = read(file.source);
      assert.ok(!live.equals(baseline), `${file.source}: presentation addition missing`);
      verifySource(live, baseline);
    }
  });

  if (args.includes('--history')) test('Git base authenticates fixtures and all committed and local changes stay in seven paths', () => {
    git('merge-base', '--is-ancestor', BASE, 'HEAD');
    for (const file of files) assert.deepEqual(original(file), git('show', `${BASE}:${file.source}`));
    for (const [file, sha] of supporting) {
      assert.equal(hash(git('show', `${BASE}:${file}`)), sha, `${file} base SHA256`);
      assert.equal(hash(read(file)), sha, `${file} live SHA256`);
    }
    const document = fs.readFileSync(documentPath);
    assert.equal(hash(document), documentSha, 'researched document reference SHA256');
    assert.match(document.toString(), /Document-style draft/);
    assert.match(document.toString(), /class="doc"/);
    const split = (bytes) => bytes.toString().split('\0').filter(Boolean);
    const changed = [
      ...split(git('diff', '--name-only', '-z', '--no-renames', BASE, 'HEAD', '--')),
      ...split(git('diff', '--name-only', '-z', '--no-renames', 'HEAD', '--')),
      ...split(git('diff', '--cached', '--name-only', '-z', '--no-renames', '--')),
      ...split(git('ls-files', '--others', '--exclude-standard', '-z'))
    ];
    checkScope(changed);
    for (const p of changed) if (fs.existsSync(path.join(root, p))) assert.ok(!fs.lstatSync(path.join(root, p)).isSymbolicLink(), `symlink: ${p}`);
  });
}

module.exports = { CSS, additions, files, original, proposed, verifySource, verifyCss };
