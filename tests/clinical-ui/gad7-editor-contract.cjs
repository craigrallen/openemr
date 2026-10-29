'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const BASE = '09b29da7771aea334ed5745e058751157af980d7';
const files = [
  { source: 'interface/forms/gad7/new.php', fixture: 'tests/clinical-ui/fixtures/gad7-new-original.php.txt', sha: '01ea8e157e59139907327ac268807c5204306b100b0c8e4a764f898be65d3baa' },
  { source: 'interface/forms/gad7/view.php', fixture: 'tests/clinical-ui/fixtures/gad7-view-original.php.txt', sha: 'ba128d01657255c40704069d64fc8daee40b044f254b9eb3ebb5cf1b3b7260f2' }
];
const support = [
  'interface/forms/gad7/gad7.inc.php',
  'interface/forms/gad7/gad7_javasrc.js',
  'interface/forms/gad7/save.php',
  'interface/forms/gad7/report.php',
  'library/api.inc.php',
  'library/forms.inc.php',
  'interface/themes/theme-defaults.scss',
  'interface/themes/color_base.scss',
  'interface/clinical-workspace/popup.css',
  '.stylelintrc.json'
];
const allowed = new Set([
  ...files.flatMap(({ source, fixture }) => [source, fixture]),
  'tests/clinical-ui/gad7-editor-contract.cjs',
  'tests/js/gad7-editor.test.js',
  'docs/clinical-ui/GAD7-EDITOR.md'
]);
const prefix = 'html.oe-workbench-context body.oe-gad7-editor';
const form = `${prefix} form[name='my_form']`;
// Production handoff: insert this literal once immediately before the route's </head>.
const CSS = `<style>
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
    max-width: 860px;
    min-width: 0;
    margin-inline: auto;
    padding: clamp(0.75rem, 2.5vw, 1.75rem);
    border: 1px solid #c7d5d9;
    background-color: #fff;
    color: #182c36;
    font-size: 1rem;
    line-height: 1.7;
    overflow-wrap: anywhere;
  }

  ${form} h2 {
    margin-block: 0 1rem;
    color: #183b49;
    font-size: clamp(1.25rem, 3vw, 1.75rem);
    line-height: 1.3;
  }

  ${form} table {
    box-sizing: border-box;
    width: 100%;
    max-width: 100%;
    border-collapse: collapse;
  }

  ${form} td {
    box-sizing: border-box;
    min-width: 0;
    padding-block: 0.4rem;
    overflow-wrap: anywhere;
  }

  ${form} td > .text,
  ${form} td > small {
    display: block;
    color: #182c36;
    font-size: 1rem;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }

  ${form} td > select {
    box-sizing: border-box;
    display: block;
    width: 100%;
    max-width: 100%;
    min-height: 2.5rem;
    margin-block: 0.35rem 0;
    padding: 0.4rem 0.6rem;
    border: 1px solid #91a8b1;
    border-radius: 4px;
    background-color: #fff;
    color: #182c36;
    font: inherit;
  }

  ${form} #q8_place,
  ${form} #show_gad7_score {
    display: block;
    color: #183b49;
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  ${form} input[type='submit'],
  ${form} input[type='button'] {
    box-sizing: border-box;
    display: block;
    width: min(100%, 20rem);
    max-width: 100%;
    min-height: 2.5rem;
    margin-block: 0.35rem;
    padding: 0.45rem 0.75rem;
    border: 1px solid #145968;
    border-radius: 4px;
    background-color: #145968 !important;
    color: #fff !important;
    font: inherit;
    white-space: normal;
    overflow-wrap: anywhere;
  }

  ${form} input[type='submit']:hover,
  ${form} input[type='submit']:focus,
  ${form} input[type='submit']:active,
  ${form} input[type='button']:hover,
  ${form} input[type='button']:focus,
  ${form} input[type='button']:active {
    border-color: #104e5b;
    background-color: #104e5b !important;
    color: #fff !important;
  }

  ${form} input[type='submit']:focus-visible,
  ${form} input[type='button']:focus-visible,
  ${form} select:focus-visible {
    outline: 3px solid #a84c22;
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
  assert.notEqual(at, -1, `missing seam: ${before.slice(0, 45)}`);
  assert.equal(at, value.lastIndexOf(needle), `duplicate seam: ${before.slice(0, 45)}`);
  return Buffer.concat([value.subarray(0, at), Buffer.from(after), value.subarray(at + needle.length)]);
}

function original(file) {
  const bytes = read(file.fixture);
  assert.equal(hash(bytes), file.sha, file.fixture);
  return bytes;
}

function proposed(bytes) {
  let value = replaceOnce(bytes, '</head>', `${CSS}\n</head>`);
  value = replaceOnce(value, '<body class="body_top">', '<body class="body_top oe-gad7-editor">');
  return value;
}

function verifySource(source, baseline) {
  let value = replaceOnce(source, '<body class="body_top oe-gad7-editor">', '<body class="body_top">');
  value = replaceOnce(value, `${CSS}\n</head>`, '</head>');
  assert.deepEqual(value, baseline, 'all original bytes survive the exact inverse');
  assert.deepEqual(source, proposed(baseline), 'only the two exact additions are present');
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
  assert.doesNotMatch(css, /\b(?:overflow|overflow-x|overflow-y)\s*:\s*(?:hidden|clip|auto)\b|position\s*:\s*(?:fixed|absolute)|white-space\s*:\s*nowrap/);
  for (const rule of rules(css)) for (const selector of rule.selectors) {
    assert.ok(selector === prefix || selector.startsWith(`${prefix} `), `unscoped: ${selector}`);
  }
  expectValue(css, prefix, 'background-color', '#e8eff0 !important');
  expectValue(css, prefix, 'color', '#182c36 !important');
  expectValue(css, form, 'max-width', '860px');
  expectValue(css, form, 'margin-inline', 'auto');
  expectValue(css, form, 'line-height', '1.7');
  expectValue(css, `${form} table`, 'width', '100%');
  expectValue(css, `${form} td > select`, 'width', '100%');
  expectValue(css, `${form} td > select`, 'background-color', '#fff');
  expectValue(css, `${form} td > select`, 'color', '#182c36');
  expectValue(css, `${form} td > small`, 'display', 'block');
  expectValue(css, `${form} #show_gad7_score`, 'overflow-wrap', 'anywhere');
  for (const type of ['submit', 'button']) {
    const selector = `${form} input[type='${type}']`;
    expectValue(css, selector, 'display', 'block');
    expectValue(css, selector, 'max-width', '100%');
    expectValue(css, selector, 'white-space', 'normal');
    for (const state of ['', ':hover', ':focus', ':active']) {
      const at = `${selector}${state}`;
      const fill = state ? '#104e5b' : '#145968';
      expectValue(css, at, 'background-color', `${fill} !important`);
      expectValue(css, at, 'color', '#fff !important');
      if (state) expectValue(css, at, 'border-color', fill);
    }
    expectValue(css, `${selector}:focus-visible`, 'outline', '3px solid #a84c22');
  }
  expectValue(css, `${form} select:focus-visible`, 'outline', '3px solid #a84c22');
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
  for (const name of paths) assert.ok(allowed.has(name), `out-of-scope path: ${name}`);
}

function rejectMutation(candidate, before, after, baseline) {
  const mutant = replaceOnce(candidate, before, after);
  assert.ok(!mutant.equals(candidate), `mutant changed: ${before}`);
  assert.throws(() => verifySource(mutant, baseline), `rejected: ${before}`);
}

const args = process.argv.slice(2);
assert.ok(args.every((arg) => ['--history', '--export-css'].includes(arg)) && new Set(args).size === args.length && !(args.includes('--history') && args.includes('--export-css')), 'invalid option');
if (args.includes('--export-css')) {
  process.stdout.write(CSS);
} else {
  test('complete original routes retain the clinical questions and distinct save flows', () => {
    for (const file of files) {
      const source = original(file).toString();
      for (const token of ['name="my_form"', 'name="csrf_token_form"', 'name="nervous_score"', 'name="control_worry_score"', 'name="worry_score"', 'name="relax_score"', 'name="restless_score"', 'name="irritable_score"', 'name="fear_score"', 'id="q8_place"', 'id="show_gad7_score"', 'top.restoreSession()', '&nbsp &nbsp']) assert.ok(source.includes(token), `${file.source}: ${token}`);
      assert.equal((source.match(/<select name=/g) || []).length, 7);
      assert.equal((source.match(/type="Submit"/g) || []).length, 2);
      assert.equal((source.match(/type="button"/g) || []).length, 2);
      assert.match(source, /<table[\s>]/);
      assert.match(source, /<tr[\s>]/);
      assert.match(source, /<td[\s>]/);
    }
    assert.match(original(files[0]).toString(), /save\.php\?mode=new/);
    assert.match(original(files[0]).toString(), /onSubmit="return\(check_all\(true\)\);"/);
    assert.match(original(files[1]).toString(), /formFetch\("form_gad7", \$_GET\["id"\]\)/);
    assert.match(original(files[1]).toString(), /save\.php\?mode=update&id=<\?php echo attr_url\(\$_GET\["id"\]\)/);
    assert.match(original(files[1]).toString(), /<html><head>\s*<head>/);
  });

  test('screen-only CSS gives the questionnaire, dynamic question and actions a bounded layout', () => verifyCss(CSS));

  test('exact addition and inverse preserve every original byte on both routes', () => {
    for (const file of files) verifySource(proposed(original(file)), original(file));
  });

  test('both actual routes match the exact additive proposal', () => {
    for (const file of files) {
      const baseline = original(file);
      verifySource(read(file.source), baseline);
    }
  });

  test('the seven-path scope accepts the complete proposal and rejects another path', () => {
    assert.equal(allowed.size, 7);
    assert.doesNotThrow(() => verifyScope([...allowed]));
    const outsider = 'interface/forms/gad7/save.php';
    assert.ok(!allowed.has(outsider));
    assert.throws(() => verifyScope([...allowed, outsider]));
  });

  test('semantic, script, token, field, value, action and arbitrary byte mutants fail', () => {
    for (const file of files) {
      const baseline = original(file);
      const candidate = proposed(baseline);
      for (const [before, after] of [
        ['name="csrf_token_form"', 'name="other_token"'],
        ['CsrfUtils::collectCsrfToken(session: $session)', 'CsrfUtils::collectCsrfToken(session: $other)'],
        ['gad7_javasrc.js', 'other.js'],
        ['name="nervous_score"', 'name="other_score"'],
        ['menu.options[4] = new Option ( <?php echo js_escape($str_extremely);?>, "3");', 'menu.options[4] = new Option ( <?php echo js_escape($str_extremely);?>, "4");'],
        ['onchange="update_score(0, my_form.nervous_score.value)', 'onchange="update_score(1, my_form.nervous_score.value)'],
        ['id="q8_place"', 'id="elsewhere"'],
        ['</form>', '</form><div></div>'],
        ['<table  frame = above>', '<div frame = above>'],
        ['<?php echo text($str_form_title); ?>', '<?php echo text($other_title); ?>']
      ]) rejectMutation(candidate, before, after, baseline);
      const mode = file === files[0] ? 'mode=new' : 'mode=update';
      rejectMutation(candidate, mode, 'mode=other', baseline);
      if (file === files[1]) rejectMutation(candidate, 'formFetch("form_gad7"', 'formFetch("other"', baseline);
    }
  });

  test('scope, palette, layout, question coupling and action wrap mutants fail', () => {
    verifyCss(CSS);
    const baseline = original(files[0]);
    const candidate = proposed(baseline);
    for (const [before, after] of [
      ['@media screen {', '@media print {'],
      [`${prefix} {`, 'body {'],
      ['max-width: 860px;', 'max-width: 1200px;'],
      [`${form} td > select`, `${form} td + select`],
      [`${form} td > small`, `${form} small`],
      [`${form} td > small {\n    display: block;`, `${form} td > small {\n    display: none;`],
      ['background-color: #145968 !important;', 'background-color: #145968;'],
      ['background-color: #145968 !important;\n    color: #fff !important;', 'background-color: #145968 !important;\n    color: #fff;'],
      ['white-space: normal;', 'white-space: nowrap;'],
      ['<body class="body_top oe-gad7-editor">', '<body class="body_top other-editor">']
    ]) rejectMutation(candidate, before, after, baseline);
    for (const [before, after] of [
      ['@media screen {', '@media print {'],
      [`${prefix} {`, 'body {'],
      ['max-width: 860px;', 'max-width: 1200px;'],
      [`${form} td > select`, `${form} td + select`],
      [`${form} td > small`, `${form} small`],
      ['background-color: #145968 !important;', 'background-color: #145968;'],
      ['background-color: #145968 !important;\n    color: #fff !important;', 'background-color: #145968 !important;\n    color: #fff;'],
      ['white-space: normal;', 'white-space: nowrap;']
    ]) {
      const mutant = replaceOnce(Buffer.from(CSS), before, after).toString();
      assert.notEqual(mutant, CSS, `CSS mutant changed: ${before}`);
      assert.throws(() => verifyCss(mutant), `CSS mutant rejected: ${before}`);
    }
  });

  test('narrow DOM doubles characterize inherited shared score and optional difficulty behavior', () => {
    const nodes = [];
    function node(tag) {
      const item = { tag, children: [], options: [], parentNode: null, appendChild(child) {
        child.parentNode = this;
        this.children.push(child);
        if (child.name === 'difficulty') context.document.my_form.difficulty = child;
        return child;
      }, remove() {
        const parent = this.parentNode;
        if (parent) parent.children.splice(parent.children.indexOf(this), 1);
        if (this.name === 'difficulty') delete context.document.my_form.difficulty;
      } };
      nodes.push(item);
      return item;
    }
    const q8cell = node('td');
    const scorecell = node('td');
    const q8 = node('span');
    const score = node('span');
    q8cell.appendChild(q8);
    scorecell.appendChild(score);
    const context = vm.createContext({
      xl: (s) => s,
      document: { my_form: {}, createElement: node, createTextNode: (s) => ({ text: s }), getElementById: (id) => id === 'q8_place' ? q8 : score },
      create_q8: (_question, menu) => { menu.options = Array.from({ length: 5 }, (_, i) => ({ value: i ? String(i - 1) : 'undef' })); }
    });
    vm.runInContext(read('interface/forms/gad7/gad7_javasrc.js').toString(), context);
    const get = (expression) => vm.runInContext(expression, context);
    vm.runInContext('var gad7_score = 0', context);
    for (const [scoreValue, total, label] of [['4', 4, 'No anxiety disorder'], ['5', 5, 'Mild anxiety disorder'], ['14', 14, 'Mild anxiety disorder'], ['15', 15, 'Severe anxiety disorder'], ['21', 21, 'Severe anxiety disorder']]) {
      vm.runInContext(`update_score('undef', ${scoreValue})`, context);
      assert.equal(get('gad7_score'), total);
      assert.ok(String(get('total_digits.innerText || total_digits.children[0].text')).includes(label));
    }
    assert.equal(get('q8_gone'), false);
    assert.equal(q8cell.children.filter((n) => n.tag === 'small').length, 1);
    assert.equal(q8cell.children.filter((n) => n.tag === 'select').length, 1);
    assert.equal(get('document.my_form.difficulty.options[0].defaultSelected'), true);
    vm.runInContext('record_score_q8("2")', context);
    assert.equal(get('all_scores[7]'), 2);
    assert.equal(get('gad7_score'), 21);
    vm.runInContext('update_score("undef", 0)', context);
    assert.equal(get('q8_gone'), true);
    assert.equal(q8cell.children.filter((n) => n.tag === 'select').length, 0);
    vm.runInContext('manage_question_8("2")', context);
    assert.equal(get('q8_gone'), true);
    vm.runInContext('update_score(0, "3")', context);
    assert.equal(get('gad7_score'), 3);
    assert.equal(get('document.my_form.difficulty.options[0].defaultSelected'), true);
    vm.runInContext('update_score(0, "undef")', context);
    assert.equal(get('all_answered[0]'), false);
    assert.equal(get('gad7_score'), 0); // resetting undef removes the previous numeric contribution
    vm.runInContext('update_score(0, "0")', context);
    assert.equal(get('gad7_score'), 0);
    assert.equal(get('q8_gone'), true);
    vm.runInContext('update_score(1, "1"); record_score_q8("3")', context);
    assert.equal(get('gad7_score'), 1);
    assert.equal(get('all_scores[7]'), 3);
    vm.runInContext('manage_question_8("2")', context);
    assert.equal(get('document.my_form.difficulty.options[3].defaultSelected'), undefined); // already present: no overwrite
    vm.runInContext('update_score("undef", 0); gad7_score = 1; manage_question_8("2")', context);
    assert.equal(get('document.my_form.difficulty.options[3].defaultSelected'), true);
    assert.equal(nodes.some((n) => n.tag === 'b'), true);
  });

  if (args.includes('--history')) {
    test('fixtures equal full base Git route blobs and support paths remain unchanged', () => {
      for (const file of files) assert.deepEqual(original(file), git('show', `${BASE}:${file.source}`));
      for (const name of support) {
        const base = git('show', `${BASE}:${name}`);
        assert.deepEqual(read(name), base, name);
        assert.deepEqual(git('show', `HEAD:${name}`), base, `HEAD ${name}`);
      }
      assert.equal(hash(fs.readFileSync('/Users/craig/artifacts/OpenEMR-Research/researched/index.html')), '9fdbaf600377cbe9e13a546640a8b4d59b354f43a8cddf04548d0bc94fa62684');
    });

    test('committed, staged, working and untracked changes stay within the exact seven-path scope', () => {
      const changed = changedPaths();
      verifyScope(changed);
      assert.equal(allowed.size, 7);
    });

    test('history full scope accepts the proposed pair plus fixtures and tests', () => {
      const candidate = new Set([...files.flatMap(({ source, fixture }) => [source, fixture]), 'tests/clinical-ui/gad7-editor-contract.cjs', 'tests/js/gad7-editor.test.js']);
      for (const name of candidate) assert.ok(allowed.has(name));
      assert.equal(candidate.size, 6);
      for (const file of files) verifySource(proposed(original(file)), original(file));
    });
  }
}
