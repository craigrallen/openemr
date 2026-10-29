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
  { source: 'interface/forms/reviewofs/new.php', fixture: 'tests/clinical-ui/fixtures/review-of-systems-new-original.php.txt', bytes: 54244, sha: '457b46411f7327d95631ccf94d23bf9bf27c4e44b3ae3fe729a8cd54a22253bd', body: '<body>', bodyAfter: '<body class="oe-review-of-systems-editor">' },
  { source: 'interface/forms/reviewofs/view.php', fixture: 'tests/clinical-ui/fixtures/review-of-systems-view-original.php.txt', bytes: 53581, sha: '723a296516deab0eaa5ae9c70390a61cb0723edad2b991e28f2474ac76734168', body: '<body class="body_top">', bodyAfter: '<body class="body_top oe-review-of-systems-editor">' }
];
const supporting = [
  ['interface/forms/reviewofs/save.php', 'e04b666e2fb574f31064d688a178f56b66ff9ee2acbfff6bcd6f3605be7de42e'],
  ['interface/forms/reviewofs/report.php', '0f8069920201c8f899e6a1dda483cd06e968c4ee3edc14448d6aa8ae5a06ae66'],
  ['library/api.inc.php', '428d50d4169f22523a845ab3a321e55906b9cdb4982aca9afc0f8da9e7bceb21'],
  ['library/forms.inc.php', '02d5214b54df6f9998af724e8459dc5cfd96d99a20b3fa0549520d565457eb32'],
  ['interface/themes/theme-defaults.scss', '0d01ace0600aada5fd2f82fc35bf76ef9083710f5cc5649e341a20cd97eaa773'],
  ['interface/themes/color_base.scss', 'f13d802ca97933d243c67a4474c994db7471e08913a3b8da694d8d953d8325d7'],
  ['interface/clinical-workspace/popup.css', 'ea56e9f26990e843219a68f315c188f7e2b0581c20321bac4517dc4ba34e79a9']
];
const reference = '/Users/craig/artifacts/OpenEMR-Research/researched/index.html';
const referenceSha = '9fdbaf600377cbe9e13a546640a8b4d59b354f43a8cddf04548d0bc94fa62684';
const prefix = 'html.oe-workbench-context body.oe-review-of-systems-editor';
const form = `${prefix} form[name='my_form']`;
// This literal is the production handoff. Insert it unchanged before </head> in both forms.
const CSS = `<style>
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
    margin: 0 auto;
    padding: clamp(0.75rem, 2.5vw, 1.75rem);
    border: 1px solid #c7d5d9;
    background-color: #fff;
    color: #182c36;
  }

  ${prefix} .row {
    margin-right: 0;
    margin-left: 0;
  }

  ${prefix} .col-12,
  ${prefix} .col-sm-12 {
    min-width: 0;
    padding-right: 0;
    padding-left: 0;
  }

  ${prefix} h2 {
    margin: 0 0 1.25rem;
    color: #183b49;
    font-size: clamp(1.4rem, 3vw, 1.9rem);
    line-height: 1.2;
  }

  ${form} {
    box-sizing: border-box;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    color: #182c36;
    font-size: 1rem;
    line-height: 1.45;
  }

  ${form} fieldset {
    box-sizing: border-box;
    min-width: 0;
    width: 100%;
    margin: 0 0 1rem;
    padding: 0.75rem clamp(0.75rem, 2vw, 1.25rem) 1rem;
    border: 1px solid #c7d5d9;
    background-color: #fff !important;
    color: #182c36 !important;
  }

  ${form} legend {
    width: auto;
    max-width: 100%;
    margin: 0;
    padding: 0 0.4rem;
    background-color: #fff !important;
    color: #183b49 !important;
    font-size: 1.05rem;
    font-weight: 700;
    line-height: 1.35;
    white-space: normal;
  }

  ${form} fieldset > .container {
    width: 100%;
    max-width: 100%;
    padding: 0;
  }

  ${form} fieldset > .row > .col-12,
  ${form} fieldset > .container > .row > .col-12 {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 15rem), 1fr));
    gap: 0.25rem 1.25rem;
    min-width: 0;
  }

  ${form} fieldset .col-sm-3 {
    box-sizing: border-box;
    width: auto;
    max-width: none;
    min-width: 0;
    padding: 0;
  }

  ${form} fieldset .form-group {
    min-width: 0;
    margin: 0;
  }

  ${form} .form-check,
  ${form} .checkbox {
    box-sizing: border-box;
    min-width: 0;
    margin: 0;
    padding: 0.25rem 0;
  }

  ${form} .form-check,
  ${form} .checkbox label {
    display: flex;
    align-items: flex-start;
    gap: 0.55rem;
    width: 100%;
    min-width: 0;
    line-height: 1.4;
  }

  ${form} .form-check-input,
  ${form} .checkbox input[type='checkbox'] {
    position: static;
    flex: 0 0 1.1rem;
    width: 1.1rem;
    height: 1.1rem;
    margin: 0.12rem 0 0;
    accent-color: #145968;
  }

  ${form} .form-check-label,
  ${form} .checkbox label {
    min-width: 0;
    margin: 0;
    color: #182c36;
    white-space: normal;
    overflow-wrap: anywhere;
  }

  ${form} textarea[name='additional_notes'] {
    box-sizing: border-box;
    display: block;
    width: 100%;
    max-width: 100%;
    min-height: 7rem;
    padding: 0.6rem 0.7rem;
    border: 1px solid #91a8b1;
    background-color: #fff;
    color: #182c36;
    font: inherit;
    line-height: 1.5;
    resize: vertical;
  }

  ${form} .offset-sm-1 {
    margin-left: 0;
  }

  ${form} .btn-group {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    max-width: 100%;
    margin: 0.5rem 0 0;
  }

  ${form} .btn-save,
  ${form} .btn-cancel {
    flex: 0 1 auto;
    min-height: 2.5rem;
    transition-duration: 0s;
    white-space: normal;
  }

  ${form} .btn-save {
    border-color: #145968;
    background-color: #145968;
    color: #fff;
  }

  ${form} .btn-cancel {
    border-color: #91a8b1;
    background-color: #eef3f4 !important;
    color: #183b49 !important;
  }

  ${form} .btn-save:hover,
  ${form} .btn-save:focus,
  ${form} .btn-save:active {
    border-color: #145968;
    background-color: #145968;
    color: #fff;
  }

  ${form} .btn-cancel:hover,
  ${form} .btn-cancel:focus,
  ${form} .btn-cancel:active {
    border-color: #91a8b1;
    background-color: #eef3f4 !important;
    color: #183b49 !important;
  }

  ${form} input:focus-visible,
  ${form} textarea:focus-visible,
  ${form} button:focus-visible {
    outline: 3px solid #a84c22;
    outline-offset: 2px;
  }
}
</style>`;
const additions = (file) => [
  ['</head>', `${CSS}\n</head>`],
  [file.body, file.bodyAfter]
];
const allowed = new Set([
  ...files.flatMap((file) => [file.source, file.fixture]),
  'tests/clinical-ui/review-of-systems-editor-contract.cjs',
  'tests/js/review-of-systems-editor.test.js',
  'docs/clinical-ui/REVIEW-OF-SYSTEMS-EDITOR.md'
]);
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const read = (name) => fs.readFileSync(path.join(root, name));
const git = (...args) => execFileSync('git', args, { cwd: root });

function replaceOnce(bytes, before, after) {
  const value = Buffer.from(bytes);
  const needle = Buffer.from(before);
  const at = value.indexOf(needle);
  assert.notEqual(at, -1, `missing seam: ${before.slice(0, 50)}`);
  assert.equal(at, value.lastIndexOf(needle), `duplicate seam: ${before.slice(0, 50)}`);
  return Buffer.concat([value.subarray(0, at), Buffer.from(after), value.subarray(at + needle.length)]);
}

function original(file) {
  const bytes = read(file.fixture);
  assert.equal(bytes.length, file.bytes, `${file.fixture} length`);
  assert.equal(hash(bytes), file.sha, `${file.fixture} SHA256`);
  return bytes;
}

function proposed(bytes, file) {
  return additions(file).reduce((value, [before, after]) => replaceOnce(value, before, after), Buffer.from(bytes));
}

function verifySource(source, baseline, file) {
  let value = Buffer.from(source);
  for (const [before, after] of additions(file).reverse()) value = replaceOnce(value, after, before);
  assert.deepEqual(value, baseline, 'all original bytes survive the exact additions');
}

function rules(css) {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    selectors: match[1].split(',').map((part) => part.trim()),
    declarations: match[2]
  }));
}

function values(css, selector, property) {
  return rules(css).filter((rule) => rule.selectors.includes(selector)).flatMap((rule) =>
    [...rule.declarations.matchAll(new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+);`, 'g'))].map((match) => match[1].trim()));
}

function expectValue(css, selector, property, expected) {
  assert.deepEqual(values(css, selector, property), [expected], `${selector}: ${property}`);
}

function verifyCss(css) {
  assert.match(css, /^<style>\n@media screen \{/);
  assert.match(css, /\}\n<\/style>$/);
  assert.equal((css.match(/@media/g) || []).length, 1);
  assert.doesNotMatch(css, /@media print|\bdisplay\s*:\s*none\b|\bvisibility\s*:\s*hidden\b|\bopacity\s*:\s*0\s*;/);
  assert.doesNotMatch(css, /\b(?:overflow|overflow-x|overflow-y)\s*:\s*(?:hidden|clip)\b/);
  for (const rule of rules(css)) for (const selector of rule.selectors) {
    assert.ok(selector === prefix || selector.startsWith(`${prefix} `), `unscoped: ${selector}`);
    assert.doesNotMatch(selector, /^(html|body|form|fieldset|input|label|button)$/);
  }
  expectValue(css, `${prefix} > .container`, 'max-width', '860px');
  expectValue(css, form, 'max-width', '100%');
  for (const selector of [`${form} fieldset > .container > .row > .col-12`, `${form} fieldset > .row > .col-12`]) {
    expectValue(css, selector, 'display', 'grid');
    expectValue(css, selector, 'grid-template-columns', 'repeat(auto-fit, minmax(min(100%, 15rem), 1fr))');
  }
  expectValue(css, `${form} fieldset .col-sm-3`, 'max-width', 'none');
  expectValue(css, `${form} .form-check`, 'display', 'flex');
  expectValue(css, `${form} .checkbox label`, 'display', 'flex');
  for (const selector of [`${form} .form-check-input`, `${form} .checkbox input[type='checkbox']`]) {
    expectValue(css, selector, 'position', 'static');
    expectValue(css, selector, 'flex', '0 0 1.1rem');
  }
  expectValue(css, `${form} .form-check-label`, 'overflow-wrap', 'anywhere');
  expectValue(css, `${form} textarea[name='additional_notes']`, 'min-height', '7rem');
  expectValue(css, `${form} textarea[name='additional_notes']`, 'max-width', '100%');
  expectValue(css, `${form} .offset-sm-1`, 'margin-left', '0');
  assert.deepEqual(values(css, `${form} fieldset .offset-sm-1`, 'margin-left'), []);
  expectValue(css, `${form} .btn-group`, 'flex-wrap', 'wrap');
  for (const action of ['save', 'cancel']) {
    const base = `${form} .btn-${action}`;
    expectValue(css, base, 'min-height', '2.5rem');
    expectValue(css, base, 'transition-duration', '0s');
    const pair = action === 'save'
      ? { 'border-color': '#145968', 'background-color': '#145968', color: '#fff' }
      : { 'border-color': '#91a8b1', 'background-color': '#eef3f4 !important', color: '#183b49 !important' };
    for (const state of ['', ':hover', ':focus', ':active']) {
      for (const [property, value] of Object.entries(pair)) expectValue(css, `${base}${state}`, property, value);
    }
  }
  expectValue(css, `${form} fieldset`, 'background-color', '#fff !important');
  expectValue(css, `${form} legend`, 'background-color', '#fff !important');
  for (const selector of [`${form} input:focus-visible`, `${form} textarea:focus-visible`, `${form} button:focus-visible`]) expectValue(css, selector, 'outline', '3px solid #a84c22');
  assert.doesNotMatch(css, /(?:position\s*:\s*(?:absolute|fixed)|white-space\s*:\s*nowrap|overflow-x\s*:\s*auto)/);
}

function checkScope(paths) {
  for (const name of paths) assert.ok(allowed.has(name), `out-of-scope path: ${name}`);
}

const args = process.argv.slice(2);
assert.ok(args.every((arg) => ['--history', '--export-css'].includes(arg)) && new Set(args).size === args.length && !(args.includes('--history') && args.includes('--export-css')), 'invalid option');
if (args.includes('--export-css')) {
  process.stdout.write(CSS);
} else {
  test('complete originals authenticate clinical structure and distinct new/edit controls', () => {
    for (const file of files) {
      const source = original(file).toString();
      for (const token of ['name="my_form"', 'name="csrf_token_form"', 'name="additional_notes"', "xlt('General')", "xlt('Endocrine')", "xlt('Additional Notes')", 'top.restoreSession()', 'parent.closeTab(window.name, false)']) assert.ok(source.includes(token), `${file.source}: ${token}`);
      assert.equal((source.match(/<fieldset>/g) || []).length, 10);
      assert.equal((source.match(/type="checkbox"/g) || []).length, 107);
      assert.equal((source.match(/class="btn-group"/g) || []).length, 1);
      assert.match(source, /<button type="submit"[^>]+class="btn [^"]+ btn-save"/);
      assert.match(source, /<button type="button"[^>]+class="btn [^"]+ btn-cancel"/);
    }
    const fresh = original(files[0]).toString();
    const edit = original(files[1]).toString();
    assert.match(fresh, /save\.php\?mode=new/);
    assert.match(fresh, /class="form-check-input" id="fever" name='fever'/);
    assert.match(fresh, /<label class="form-check-label" for="fever">/);
    assert.match(edit, /formFetch\("form_reviewofs", \$_GET\["id"\]\)/);
    assert.match(edit, /save\.php\?mode=update&id=<\?php echo attr_url\(\$_GET\["id"\]\)/);
    assert.match(edit, /<label>\s*<input type="checkbox" name="fever" <\?php echo \(\$obj\["fever"\] == "on"\) \? "checked" : ""; \?>/);
    assert.match(edit, /text\(\$obj\["additional_notes"\]\)/);
  });

  test('supporting form, API, theme and popup evidence is fixed', () => {
    for (const [name, sha] of supporting) assert.equal(hash(read(name)), sha, name);
    assert.match(read('interface/forms/reviewofs/save.php').toString(), /CsrfUtils::checkCsrfInput\(INPUT_POST, dieOnFail: true\)/);
    assert.match(read('interface/forms/reviewofs/report.php').toString(), /formFetch\("form_reviewofs", \$id\)/);
    assert.match(read('library/api.inc.php').toString(), /where id=\? and pid = \? and activity like \?/);
    assert.match(read('interface/themes/theme-defaults.scss').toString(), /fieldset \{\s*background-color: \$light !important/);
    assert.match(read('interface/clinical-workspace/popup.css').toString(), /html\.oe-workbench-context/);
  });

  test('proposed CSS keeps a responsive document and both checkbox structures coherent', () => verifyCss(CSS));

  test('button state pairs and zero-duration transitions reject partial palette fixes', () => {
    for (const [before, after] of [
      ['transition-duration: 0s;', 'transition-duration: 0.15s;'],
      ['background-color: #eef3f4 !important;', 'background-color: #eef3f4;'],
      ['background-color: #eef3f4 !important;\n    color: #183b49 !important;', 'background-color: #eef3f4 !important;\n    color: #fff !important;'],
      ['background-color: #145968;', 'background-color: #468ac2;'],
      ['    color: #fff;', '    color: #183b49;'],
      [`${form} .btn-cancel:hover,`, `${form} .btn-cancel:disabled,`],
      [`${form} .btn-cancel:focus,`, `${form} .btn-cancel:disabled,`],
      [`${form} .btn-cancel:active {`, `${form} .btn-cancel:disabled {`],
      [`${form} .btn-save:hover,`, `${form} .btn-save:disabled,`],
      [`${form} .btn-save:focus,`, `${form} .btn-save:disabled,`],
      [`${form} .btn-save:active {`, `${form} .btn-save:disabled {`]
    ]) {
      const mutant = CSS.replace(before, after);
      assert.notEqual(mutant, CSS);
      assert.throws(() => verifyCss(mutant), `palette mutant rejected: ${before}`);
    }
  });

  test('Cancel foreground needs importance beside its pale background', () => {
    const paired = 'background-color: #eef3f4 !important;\n    color: #183b49 !important;';
    const ordinaryInk = 'background-color: #eef3f4 !important;\n    color: #183b49;';
    const mutant = CSS.replaceAll(paired, ordinaryInk);
    assert.notEqual(mutant, CSS);
    assert.throws(() => verifyCss(mutant), 'Cancel foreground importance removed');
  });

  test('edit action offset outside fieldset requires the form-wide reset', () => {
    assert.match(original(files[1]).toString(), /<\/fieldset>\s*<div class="form-group clearfix">\s*<div class="col-sm-12 offset-sm-1 position-override">/);
    assert.doesNotThrow(() => verifyCss(CSS));
    const narrow = CSS.replace(`${form} .offset-sm-1 {`, `${form} fieldset .offset-sm-1 {`);
    assert.notEqual(narrow, CSS);
    assert.throws(() => verifyCss(narrow), /offset-sm-1: margin-left/);
  });

  test('exact proposals invert to every original byte in both variants', () => {
    for (const file of files) {
      const baseline = original(file);
      const candidate = proposed(baseline, file);
      verifySource(candidate, baseline, file);
      assert.equal((candidate.toString().match(/<style>/g) || []).length, 1);
      assert.equal((candidate.toString().match(/oe-review-of-systems-editor/g) || []).length > 1, true);
    }
  });

  test('semantic, action, checked-state, wrapper and arbitrary original mutations fail inverse', () => {
    for (const file of files) {
      const baseline = original(file);
      const candidate = proposed(baseline, file);
      const generalFieldset = `<fieldset>\n${file === files[0] ? '                        ' : '                    '}<legend><?php echo xlt('General')?></legend>`;
      const common = [
        ['name="csrf_token_form"', 'name="other_token"'],
        ['CsrfUtils::collectCsrfToken(session: $session)', 'CsrfUtils::collectCsrfToken(session: $other)'],
        ['name="additional_notes"', 'name="other_notes"'],
        ['onsubmit="return top.restoreSession()"', 'onsubmit="return true"'],
        ['parent.closeTab(window.name, false)', 'parent.closeTab(window.name, true)'],
        [generalFieldset, generalFieldset.replace('<fieldset>', '<div><fieldset>')],
        ['</form>', '</form><div></div>'],
        ["xlt('General')", "xlt('Other')"]
      ];
      const variant = file === files[0] ? [
        ['save.php?mode=new', 'save.php?mode=update'],
        ["name='fever'", "name='other'"],
        ['for="fever"', 'for="other"']
      ] : [
        ['formFetch("form_reviewofs", $_GET["id"])', 'formFetch("other", $_GET["id"])'],
        ['attr_url($_GET["id"])', '$_GET["id"]'],
        ['($obj["fever"] == "on") ? "checked" : ""', '($obj["fever"] == "on") ? "" : "checked"']
      ];
      for (const [before, after] of [...common, ...variant]) {
        const mutant = replaceOnce(candidate, before, after);
        assert.ok(!mutant.equals(candidate));
        assert.throws(() => verifySource(mutant, baseline, file), `rejected: ${before}`);
      }
    }
  });

  test('style, class, print, hiding and broken group mutants fail', () => {
    const file = files[1];
    const baseline = original(file);
    const candidate = proposed(baseline, file);
    for (const [before, after] of [
      ['@media screen {', '@media print {'],
      [`${prefix} {\n    box-sizing: border-box;`, 'html.other-context body.oe-review-of-systems-editor {\n    box-sizing: border-box;'],
      ['max-width: 860px;', 'max-width: 1200px;'],
      ['body_top oe-review-of-systems-editor', 'body_top other-editor'],
      ['</style>', `${form} input { display: none; }</style>`]
    ]) {
      const mutant = replaceOnce(candidate, before, after);
      assert.ok(!mutant.equals(candidate));
      assert.throws(() => verifySource(mutant, baseline, file));
    }
    for (const [before, after] of [
      ['@media screen {', '@media print {'],
      ['max-width: 860px;', 'max-width: 1200px;'],
      ['grid-template-columns: repeat(auto-fit, minmax(min(100%, 15rem), 1fr));', 'grid-template-columns: repeat(4, 15rem);'],
      ['flex: 0 0 1.1rem;', 'flex: 0 0 0;'],
      ['flex-wrap: wrap;', 'flex-wrap: nowrap;'],
      ['background-color: #fff !important;', 'background-color: #fff;']
    ]) {
      const mutant = CSS.replaceAll(before, after);
      assert.notEqual(mutant, CSS);
      assert.throws(() => verifyCss(mutant), `CSS rejected: ${before}`);
    }
    for (const extra of [`${form} input { display: none; }`, `${form} fieldset { overflow: clip; }`, 'body { color: red; }']) assert.throws(() => verifyCss(CSS.replace('</style>', `${extra}</style>`)));
  });

  test('seams must be unique and untouched or extra-byte sources fail', () => {
    for (const file of files) {
      for (const [before, after] of additions(file)) {
        assert.throws(() => replaceOnce(Buffer.from(`${before}${before}`), before, after));
        assert.throws(() => replaceOnce(Buffer.from('absent'), before, after));
      }
      const baseline = original(file);
      const candidate = proposed(baseline, file);
      assert.throws(() => verifySource(baseline, baseline, file));
      assert.throws(() => verifySource(Buffer.concat([candidate, Buffer.from('x')]), baseline, file));
    }
  });

  test('seven-file final scope includes the planned documentation and rejects other paths', () => {
    assert.equal(allowed.size, 7);
    checkScope([...allowed]);
    assert.throws(() => checkScope(['interface/forms/reviewofs/save.php']), /out-of-scope/);
    assert.throws(() => checkScope(['docs/clinical-ui/OTHER.md']), /out-of-scope/);
  });

  test('live new and edit sources contain exactly the proposed additions', () => {
    for (const file of files) {
      const baseline = original(file);
      const live = read(file.source);
      assert.ok(!live.equals(baseline), `${file.source}: presentation addition missing`);
      verifySource(live, baseline, file);
    }
  });

  if (args.includes('--history')) test('Git base authenticates fixtures and committed plus local scope', () => {
    git('merge-base', '--is-ancestor', BASE, 'HEAD');
    for (const file of files) assert.deepEqual(original(file), git('show', `${BASE}:${file.source}`));
    for (const [name, sha] of supporting) {
      assert.equal(hash(git('show', `${BASE}:${name}`)), sha, `${name} base`);
      assert.equal(hash(read(name)), sha, `${name} live`);
    }
    assert.equal(hash(fs.readFileSync(reference)), referenceSha);
    assert.match(fs.readFileSync(reference, 'utf8'), /Document-style draft/);
    const split = (bytes) => bytes.toString().split('\0').filter(Boolean);
    const changed = [
      ...split(git('diff', '--name-only', '-z', '--no-renames', BASE, 'HEAD', '--')),
      ...split(git('diff', '--name-only', '-z', '--no-renames', 'HEAD', '--')),
      ...split(git('diff', '--cached', '--name-only', '-z', '--no-renames', '--')),
      ...split(git('ls-files', '--others', '--exclude-standard', '-z'))
    ];
    checkScope(changed);
    for (const name of changed) if (fs.existsSync(path.join(root, name))) assert.ok(!fs.lstatSync(path.join(root, name)).isSymbolicLink(), `symlink: ${name}`);
  });
}

module.exports = { CSS, additions, files, original, proposed, verifySource, verifyCss };
