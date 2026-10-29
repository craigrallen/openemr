'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const BASE = '09b29da7771aea334ed5745e058751157af980d7';
const source = 'interface/forms/misc_billing_options/new.php';
const fixture = 'tests/clinical-ui/fixtures/misc-billing-options-new-original.php.txt';
const SHA = 'a5855f5d78028500f5bb6d456ae1a7023b6cfc169ff4da01c04bdb872d99c1d9';
const testsOnly = new Set([fixture, 'tests/clinical-ui/misc-billing-options-editor-contract.cjs', 'tests/js/misc-billing-options-editor.test.js']);
const finalPaths = new Set([...testsOnly, source, 'docs/clinical-ui/MISC-BILLING-OPTIONS-EDITOR.md']);
const support = new Map([
  ['interface/forms/misc_billing_options/view.php', '5d6f5426221c8753e51fcd5e8def50135f671f74e9a825776ac5c19ea59a1492'],
  ['interface/forms/misc_billing_options/save.php', 'b1acfc240615ac3c1ed5476763c9828bc2e8f7912cae653fc181abc7c60bed6b'],
  ['src/Billing/MiscBillingOptions.php', '3e8c06ab6bc23e4c6896e5da1b87ca4fc8d2a6a50965f743a82a38bb5625b8ab'],
  ['library/js/xl/jquery-datetimepicker-2-5-4.js.php', 'd673694e159a8744012736246f9143ad0babf718c50bc93674ee2af9da07edb7'],
  ['src/OeUI/OemrUI.php', '478dd52733a2a50078d0610fc0e8e74bf8ad2c6c68d44abc612c8097eb99dc44'],
  ['config/config.yaml', '5f99c981f570a2f94917d68a4abcedf086eb75a102364bf71f1cb44ccfe461b7'],
  ['interface/clinical-workspace/popup.css', 'ea56e9f26990e843219a68f315c188f7e2b0581c20321bac4517dc4ba34e79a9'],
  ['interface/themes/theme-defaults.scss', '0d01ace0600aada5fd2f82fc35bf76ef9083710f5cc5649e341a20cd97eaa773'],
  ['interface/themes/color_base.scss', 'f13d802ca97933d243c67a4474c994db7471e08913a3b8da694d8d953d8325d7']
]);
const prefix = 'html.oe-workbench-context body.misc-billing-options-document-editor';
const sheet = `${prefix} #container_div`;
const form = `${sheet} form[name='my_form']`;
const fieldset = `${form} fieldset`;
const notes = `${form} #comments`;

// The controller can paste this single style block before </head> and add the body class.
const CSS = `<style>
@media screen {
  ${prefix} {
    box-sizing: border-box;
    margin: 0;
    padding: clamp(0.75rem, 2.5vw, 1.5rem);
    background-color: var(--oe-wb-canvas, #edf2f3) !important;
    color: var(--oe-wb-ink, #182c36) !important;
  }

  ${sheet} {
    box-sizing: border-box;
    width: min(100%, 1000px);
    max-width: 1000px;
    margin-inline: auto;
    padding: clamp(1rem, 3vw, 2rem);
    border: 1px solid var(--oe-wb-line, #cbd6da);
    border-radius: 7px;
    background-color: var(--oe-wb-paper, #fff) !important;
    color: var(--oe-wb-ink, #182c36) !important;
    line-height: 1.5;
  }

  ${sheet} > .row {
    margin-inline: 0;
  }

  ${sheet} > .row > .col-sm-12,
  ${form} > .form-group > .col-sm-12 {
    min-width: 0;
    padding-inline: 0;
  }

  ${fieldset} {
    min-width: 0;
    margin: 0 0 1.5rem;
    padding: 1rem clamp(0.75rem, 2vw, 1.5rem) 1.25rem;
    border: 1px solid var(--oe-wb-line, #cbd6da);
    border-radius: 6px;
    background-color: var(--oe-wb-paper, #fff) !important;
    color: var(--oe-wb-ink, #182c36) !important;
  }

  ${fieldset} legend {
    width: auto;
    margin: 0;
    padding: 0 0.35rem;
    color: var(--oe-wb-petrol, #145968) !important;
    background-color: var(--oe-wb-paper, #fff) !important;
    font-size: 0.95rem;
    font-weight: 700;
    line-height: 1.4;
  }

  ${fieldset} > .container {
    width: 100%;
    max-width: none;
    padding-inline: 0;
  }

  ${fieldset} .form-row {
    margin-inline: 0;
    row-gap: 0.9rem;
  }

  ${fieldset} .form-row > [class^='col-'] {
    min-width: 0;
  }

  ${form} label:not(.btn) {
    margin-bottom: 0.35rem;
    color: var(--oe-wb-ink, #182c36) !important;
    font-weight: 600;
    line-height: 1.45;
  }

  ${form} .form-control {
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    min-height: 2.55rem;
    border: 1px solid #91a8b1;
    border-radius: 4px;
    background-color: var(--oe-wb-paper, #fff) !important;
    color: var(--oe-wb-ink, #182c36) !important;
    font: inherit;
  }

  ${form} .form-control::placeholder {
    color: var(--oe-wb-muted, #536773) !important;
    opacity: 1;
  }

  ${notes} {
    width: 100%;
    min-height: 5.5rem;
    max-height: 8rem;
    line-height: 1.7;
    resize: vertical;
    overflow-y: auto;
  }

  ${form} .btn-group {
    display: flex;
    flex-wrap: wrap;
    gap: 0.65rem;
  }

  ${form} .btn-group > .btn {
    min-width: 7rem;
    min-height: 2.7rem;
    height: auto;
    white-space: normal;
    overflow-wrap: anywhere;
    border-radius: 4px;
    font-weight: 600;
  }

  ${form} .btn-save {
    border-color: var(--oe-wb-petrol, #145968);
    background-color: var(--oe-wb-petrol, #145968) !important;
    color: var(--oe-wb-on-petrol, #fff) !important;
  }

  ${form} .btn-cancel {
    border-color: #91a8b1;
    background-color: var(--oe-wb-paper, #fff) !important;
    color: var(--oe-wb-ink, #182c36) !important;
  }

  ${form} .form-control:focus,
  ${form} .btn:focus,
  ${form} input[type='checkbox']:focus,
  ${form} input[type='radio']:focus {
    outline: 2px solid var(--oe-wb-petrol, #145968);
    outline-offset: 2px;
  }

  ${form} .form-control:focus-visible,
  ${form} .btn:focus-visible,
  ${form} input[type='checkbox']:focus-visible,
  ${form} input[type='radio']:focus-visible {
    outline: 3px solid #b65020;
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

function original() {
  const bytes = read(fixture);
  assert.equal(bytes.length, 23722, 'whole original length');
  assert.equal(hash(bytes), SHA, 'whole original SHA-256');
  return bytes;
}

function proposed(baseline) {
  let value = replaceOnce(baseline, '\n</head>\n<body>', `\n${CSS}\n</head>\n<body>`);
  value = replaceOnce(value, '<body>', '<body class="misc-billing-options-document-editor">');
  return value;
}

function verifySource(candidate, baseline) {
  let inverse = replaceOnce(candidate, '<body class="misc-billing-options-document-editor">', '<body>');
  inverse = replaceOnce(inverse, `\n${CSS}\n</head>`, '\n</head>');
  assert.deepEqual(inverse, baseline, 'inverse restores every original byte');
  assert.deepEqual(candidate, proposed(baseline), 'only the two literal presentation additions');
}

function rules(css) {
  assert.match(css, /^<style>\n@media screen \{\n/);
  assert.match(css, /\n\}\n<\/style>$/);
  assert.equal((css.match(/@media/g) || []).length, 1);
  const inner = css.slice('<style>\n@media screen {\n'.length, -'\n}\n</style>'.length);
  const found = [...inner.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
  assert.equal(inner.replace(/([^{}]+)\{([^{}]*)\}/g, '').trim(), '', 'flat CSS rules only');
  return found.map((match) => ({ selectors: match[1].split(',').map((part) => part.trim()), declarations: match[2] }));
}

function values(css, selector, property) {
  return rules(css).filter((rule) => rule.selectors.includes(selector)).flatMap((rule) =>
    [...rule.declarations.matchAll(new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+);`, 'g'))].map((match) => match[1].trim()));
}

function verifyCss(css) {
  assert.doesNotMatch(css, /@media print|@import|<script|spellcheck|autocorrect|overflow\s*:\s*hidden/);
  for (const rule of rules(css)) for (const selector of rule.selectors) {
    assert.ok(selector === prefix || selector.startsWith(`${prefix} `), `unscoped selector: ${selector}`);
    assert.ok(!selector.includes('input[type="hidden"]'), `hidden control: ${selector}`);
  }
  for (const [selector, property, expected] of [
    [prefix, 'background-color', 'var(--oe-wb-canvas, #edf2f3) !important'],
    [prefix, 'color', 'var(--oe-wb-ink, #182c36) !important'],
    [sheet, 'width', 'min(100%, 1000px)'], [sheet, 'max-width', '1000px'],
    [sheet, 'padding', 'clamp(1rem, 3vw, 2rem)'],
    [sheet, 'background-color', 'var(--oe-wb-paper, #fff) !important'],
    [`${sheet} > .row`, 'margin-inline', '0'],
    [`${sheet} > .row > .col-sm-12`, 'padding-inline', '0'],
    [`${form} > .form-group > .col-sm-12`, 'padding-inline', '0'],
    [fieldset, 'background-color', 'var(--oe-wb-paper, #fff) !important'],
    [fieldset, 'color', 'var(--oe-wb-ink, #182c36) !important'],
    [`${fieldset} legend`, 'background-color', 'var(--oe-wb-paper, #fff) !important'],
    [`${fieldset} legend`, 'color', 'var(--oe-wb-petrol, #145968) !important'],
    [`${fieldset} > .container`, 'padding-inline', '0'],
    [`${fieldset} .form-row`, 'row-gap', '0.9rem'],
    [`${form} label:not(.btn)`, 'color', 'var(--oe-wb-ink, #182c36) !important'],
    [`${form} .form-control`, 'width', '100%'],
    [`${form} .form-control`, 'background-color', 'var(--oe-wb-paper, #fff) !important'],
    [`${form} .form-control`, 'color', 'var(--oe-wb-ink, #182c36) !important'],
    [`${form} .form-control::placeholder`, 'color', 'var(--oe-wb-muted, #536773) !important'],
    [notes, 'width', '100%'], [notes, 'max-height', '8rem'],
    [notes, 'line-height', '1.7'], [notes, 'overflow-y', 'auto'],
    [`${form} .btn-group`, 'flex-wrap', 'wrap'],
    [`${form} .btn-group > .btn`, 'white-space', 'normal'],
    [`${form} .btn-group > .btn`, 'overflow-wrap', 'anywhere'],
    [`${form} .btn-save`, 'background-color', 'var(--oe-wb-petrol, #145968) !important'],
    [`${form} .btn-save`, 'color', 'var(--oe-wb-on-petrol, #fff) !important'],
    [`${form} .btn-cancel`, 'background-color', 'var(--oe-wb-paper, #fff) !important'],
    [`${form} .btn-cancel`, 'color', 'var(--oe-wb-ink, #182c36) !important'],
    [`${form} .form-control:focus`, 'outline', '2px solid var(--oe-wb-petrol, #145968)'],
    [`${form} .form-control:focus-visible`, 'outline', '3px solid #b65020'],
    [`${form} .btn:focus`, 'outline', '2px solid var(--oe-wb-petrol, #145968)'],
    [`${form} .btn:focus-visible`, 'outline', '3px solid #b65020'],
    [`${form} input[type='radio']:focus`, 'outline', '2px solid var(--oe-wb-petrol, #145968)'],
    [`${form} input[type='radio']:focus-visible`, 'outline', '3px solid #b65020']
  ]) assert.deepEqual(values(css, selector, property), [expected], `${selector}: ${property}`);
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

module.exports = { CSS, original, proposed, verifySource, verifyCss, verifyScope, verifyFinalScope, changedPaths };

if (require.main === module) {
  const test = require('node:test');
  const args = process.argv.slice(2);
  assert.ok(args.length <= 1 && args.every((arg) => arg === '--history'), 'only --history is supported');

  test('whole fixture preserves authorization, billing fields, native values, widgets and actions', () => {
    const text = original().toString();
    for (const token of [
      "require_once(__DIR__ . \"/../../globals.php\")", 'PatientSessionUtil::getPid()',
      'EncounterSessionUtil::getEncounter()', "isset($_REQUEST['isBilling'])",
      'SessionUtil::setSession(\'billpid\', $pid)', 'SessionUtil::setSession(\'billencounter\', $encounter)',
      'sqlquery("SELECT `id` FROM `form_misc_billing_options`', 'formFetch("form_misc_billing_options", $formid)',
      "Header::setupHeader(['datetime-picker', 'opener'])", "'show_help_icon' => true",
      "'help_file_name' => \"cms_1500_help.php\"", '$oemr_ui->pageHeading()',
      "name='my_form'", 'misc_billing_options/save.php?id=', 'name="csrf_token_form"',
      'CsrfUtils::collectCsrfToken(session: $session)',
      'name="employment_related"', 'name="auto_accident"', 'name="accident_state"',
      'name="other_accident"', 'name="medicaid_referral_code"', 'name="epsdt_flag"',
      "name='onset_date'", "name='date_initial_treatment'", "name='off_work_from'",
      "name='off_work_to'", "name='hospitalization_date_from'", "name='hospitalization_date_to'",
      'name="outside_lab"', 'name="lab_amount"', 'name="resubmission_code"',
      'name="original_reference_number"', 'name="prior_auth_number"',
      'name="replacement_claim"', 'id="replacement_claim"', 'id="void_claim"',
      'id="new_claim"', 'value="0"', 'echo "checked"',
      'name="icn_resubmission_number"', 'name="comments" id="comments"',
      'text($obj["comments"] ?? \'\')', 'generateDateQualifierSelect("box_14_date_qual"',
      'generateDateQualifierSelect("box_15_date_qual"', 'genReferringProviderSelect(\'provider_id\'',
      "generate_select_list('provider_qualifier_code'", 'class="btn btn-primary btn-save save"',
      'class="dontsave btn btn-secondary btn-cancel"', 'dlgclose();',
      'parent.closeTab(window.name, false)', "$('.datepicker').datetimepicker({",
      "'/js/xl/jquery-datetimepicker-2-5-4.js.php'", '$oemr_ui->oeBelowContainerDiv()'
    ]) assert.ok(text.includes(token), token);
  });

  test('screen CSS has exact scoped responsive, theme, control and focus rules', () => verifyCss(CSS));
  test('positive proposal and inverse preserve every original byte', () => verifySource(proposed(original()), original()));
  test('unchanged source fails only the expected presentation-presence check', () => {
    const baseline = original();
    assert.throws(() => verifySource(baseline, baseline), /missing seam: <body class/);
  });
  test('actual route has the exact presentation proposal', () => verifySource(read(source), original()));

  test('constructed native semantics mutations are rejected', () => {
    const baseline = original();
    const candidate = proposed(baseline);
    for (const [before, after] of [
      ['CsrfUtils::collectCsrfToken(session: $session)', 'CsrfUtils::collectCsrfToken()'],
      ["isset($_REQUEST['isBilling'])", 'false'],
      ['misc_billing_options/save.php?id=', 'other/save.php?id='],
      ['name="employment_related"', 'name="other_field"'],
      ['attr($obj["accident_state"] ?? \'\')', 'text($obj["accident_state"] ?? \'\')'],
      ["name='onset_date'", "name='other_date'"],
      ['generateDateQualifierSelect("box_14_date_qual"', 'generateDateQualifierSelect("other_qual"'],
      ['name="replacement_claim"', 'name="other_claim"'],
      ['id="void_claim"', 'id="other_claim"'],
      ['echo "checked"', 'echo "selected"'],
      ['name="comments" id="comments"', 'name="notes" id="comments"'],
      ['text($obj["comments"] ?? \'\')', 'attr($obj["comments"] ?? \'\')'],
      ['type="submit" class="btn btn-primary btn-save save"', 'type="button" class="btn btn-primary btn-save save"'],
      ['dlgclose();', 'parent.closeTab(window.name, false);'],
      ["$('.datepicker').datetimepicker({", "$('.datepicker').hide({"],
      ['$oemr_ui->pageHeading()', "xlt('Heading')"],
      ['$oemr_ui->oeBelowContainerDiv()', '']
    ]) {
      const mutant = replaceFirst(candidate, before, after);
      assert.throws(() => verifySource(mutant, baseline), `rejected: ${before}`);
    }
  });

  test('constructed CSS mutations reject media, reach, layout, palette and keyboard regressions', () => {
    for (const [before, after] of [
      ['@media screen {', '@media print {'],
      [`${prefix} {`, 'body {'],
      ['max-width: 1000px;', 'max-width: 1400px;'],
      ['row-gap: 0.9rem;', 'row-gap: 0;'],
      ['background-color: var(--oe-wb-paper, #fff) !important;', 'background-color: #222 !important;'],
      ['color: var(--oe-wb-on-petrol, #fff) !important;', 'color: #145968 !important;'],
      ['max-height: 8rem;', 'max-height: none;'],
      ['overflow-y: auto;', 'overflow-y: hidden;'],
      ['white-space: normal;', 'white-space: nowrap;'],
      ['outline: 3px solid #b65020;', 'outline: none;']
    ]) {
      const cssMutant = replaceFirst(Buffer.from(CSS), before, after).toString();
      const sourceMutant = replaceFirst(proposed(original()), before, after);
      assert.throws(() => verifyCss(cssMutant), `rejected CSS: ${before}`);
      assert.throws(() => verifySource(sourceMutant, original()), `rejected source: ${before}`);
    }
  });

  test('fieldset and legend must retain the paired effective theme surface', () => {
    const before = `  ${fieldset} legend {\n    width: auto;\n    margin: 0;\n    padding: 0 0.35rem;\n    color: var(--oe-wb-petrol, #145968) !important;\n    background-color: var(--oe-wb-paper, #fff) !important;`;
    for (const replacement of ['', 'background-color: #d1d5db !important;']) {
      const after = before.replace('background-color: var(--oe-wb-paper, #fff) !important;', replacement);
      const mutant = replaceOnce(Buffer.from(CSS), before, after).toString();
      assert.throws(() => verifyCss(mutant));
    }
  });

  test('tests-only and final scopes are distinct and exact', () => {
    verifyScope(testsOnly);
    verifyFinalScope(finalPaths);
    assert.throws(() => verifyScope(finalPaths));
    assert.throws(() => verifyFinalScope(testsOnly));
    assert.throws(() => verifyFinalScope([...finalPaths, 'interface/forms/misc_billing_options/save.php']));
  });

  if (args.includes('--history')) {
    test('base blob authenticates the complete fixture and unchanged support bytes', () => {
      assert.deepEqual(original(), git('show', `${BASE}:${source}`));
      for (const [name, expected] of support) {
        const base = git('show', `${BASE}:${name}`);
        assert.equal(hash(base), expected, name);
        assert.deepEqual(git('show', `HEAD:${name}`), base, `HEAD ${name}`);
        assert.deepEqual(read(name), base, `working ${name}`);
      }
    });
    test('combined committed, staged, dirty and untracked scope is exact', () => {
      const paths = changedPaths();
      if (paths.has(source) || paths.has('docs/clinical-ui/MISC-BILLING-OPTIONS-EDITOR.md')) verifyFinalScope(paths);
      else verifyScope(paths);
    });
  }
}
