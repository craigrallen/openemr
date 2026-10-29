'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const test = require('node:test');

const root = path.resolve(__dirname, '../..');
const BASE = '09b29da7771aea334ed5745e058751157af980d7';
const source = 'interface/forms/group_attendance/new.php';
const fixture = 'tests/clinical-ui/fixtures/group-attendance-new-original.php.txt';
const SHA = '29f2609d5058977a689bc418f58793b7e4e6e63d03e96a43c892d7d3a7948eb6';
const allowed = new Set([
  source, fixture, 'tests/clinical-ui/group-attendance-editor-contract.cjs',
  'tests/js/group-attendance-editor.test.js', 'docs/clinical-ui/GROUP-ATTENDANCE-EDITOR.md'
]);
const support = [
  'interface/forms/group_attendance/view.php', 'interface/forms/group_attendance/save.php',
  'interface/forms/group_attendance/functions.php', 'library/group.inc.php',
  'interface/clinical-workspace/popup.css', 'interface/themes/theme-defaults.scss',
  'docs/clinical-ui/PLAN.md'
];
const clinicalSupportHashes = new Map([
  ['interface/forms/group_attendance/save.php', '0a7d1ba9edaf675ff194c22e5be9dc34636efdac9aae8a2f4939098fd423f9fe'],
  ['interface/forms/group_attendance/functions.php', 'ada9866186df48cfc0f0f3b4e4004841dbde4c23d08b57f80eb01623ac4b129e'],
  ['library/group.inc.php', 'd7bcaabc3d6d5b1dbaf636b9e2d6b61df0ad9824c41501a88a592fbd048672a4']
]);
const prefix = 'html.oe-workbench-context body.group-attendance-document-editor';
const form = `${prefix} #group_attendance_form`;
const wrapper = `${form} #group_attendance_form_table_wrapper`;
const table = `${form} #group_attendance_form_table`;
const button = `${form} .btn`;

// Production proposal: exactly this style before </head>, and one body class.
const CSS = `    <style>
    @media screen {
      ${prefix} {
        box-sizing: border-box;
        margin: 0;
        padding: clamp(0.5rem, 2vw, 1.5rem);
        background-color: #e8eff0 !important;
        color: #182c36 !important;
      }

      ${prefix} > .container-fluid {
        box-sizing: border-box;
        width: 100%;
        max-width: 1000px;
        margin-inline: auto;
        padding: 0;
      }

      ${form} {
        box-sizing: border-box;
        min-width: 0;
        width: 100%;
        padding: clamp(0.75rem, 2.5vw, 2rem);
        border: 1px solid #c7d5d9;
        background-color: #fff !important;
        color: #182c36 !important;
        line-height: 1.5;
      }

      ${form} .button_wrap {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        margin-block-end: 1.25rem;
      }

      ${form} .title {
        color: #183b49 !important;
        font-size: clamp(1.35rem, 3vw, 1.8rem);
        font-weight: 600;
        line-height: 1.3;
        overflow-wrap: anywhere;
      }

      ${form} #add_participant_element {
        box-sizing: border-box;
        max-width: 100%;
        margin-block: 0 1.25rem;
        padding: clamp(0.75rem, 2vw, 1.25rem);
        border: 1px solid #c7d5d9;
        background-color: #f3f7f5 !important;
        color: #182c36 !important;
      }

      ${form} .patient_wrap,
      ${form} .comment_wrap {
        box-sizing: border-box;
        min-width: 0;
        width: 100%;
        margin-block-end: 0.75rem;
      }

      ${form} .input_label {
        display: block;
        margin-block-end: 0.25rem;
        color: #182c36 !important;
        font-weight: 600;
      }

      ${form} .new_patient,
      ${form} .new_comment {
        box-sizing: border-box;
        width: 100%;
        min-height: 2.75rem;
        color: #182c36 !important;
        background-color: #fff !important;
      }

      ${form} .btn-group {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        max-width: 100%;
      }

      ${wrapper} {
        box-sizing: border-box;
        width: 100%;
        max-width: 100%;
        overflow: auto visible;
        margin-block: 0 1.25rem;
      }

      ${wrapper} .dataTables_length,
      ${wrapper} .dataTables_info,
      ${wrapper} .dataTables_paginate {
        max-width: 100%;
        float: none;
        margin-block: 0.5rem;
        white-space: normal;
      }

      ${wrapper} .dataTables_paginate .paginate_button {
        display: inline-block;
        min-width: 2.5rem;
        min-height: 2.5rem;
        margin: 0.125rem;
      }

      ${table} {
        width: 100% !important;
        min-width: 760px;
        border-collapse: collapse;
        color: #182c36 !important;
        background-color: #fff !important;
      }

      ${table} th,
      ${table} td {
        box-sizing: border-box;
        padding: 0.6rem;
        color: #182c36 !important;
        background-color: #fff !important;
        vertical-align: middle;
      }

      ${table} th {
        background-color: #e8eff0 !important;
        font-weight: 600;
        white-space: normal;
      }

      ${table} .status_select {
        min-width: 11rem;
        min-height: 2.75rem;
        color: #182c36 !important;
        background-color: #fff !important;
      }

      ${table} .comment {
        min-width: 12rem;
        min-height: 2.75rem;
        color: #182c36 !important;
        background-color: #fff !important;
      }

      ${form} .action_buttons {
        margin-block: 0.5rem 0;
      }

      ${button} {
        box-sizing: border-box;
        min-width: 7rem;
        max-width: 100%;
        min-height: 2.75rem;
        padding: 0.55rem 0.85rem;
        white-space: normal;
        transition-duration: 0s;
      }

      ${button}:focus-visible,
      ${form} .form-control:focus-visible,
      ${wrapper} .paginate_button:focus-visible {
        outline: 3px solid #a84c22;
        outline-offset: 2px;
      }

      ${form} .btn-primary {
        border-color: #145968 !important;
        background-color: #145968 !important;
        color: #fff !important;
      }

      ${form} .btn-primary:hover,
      ${form} .btn-primary:focus,
      ${form} .btn-primary:active {
        border-color: #104e5b !important;
        background-color: #104e5b !important;
        color: #fff !important;
      }

      ${form} .btn-secondary {
        border-color: #91a8b1 !important;
        background-color: #fff !important;
        color: #182c36 !important;
      }

      ${form} .btn-secondary:hover,
      ${form} .btn-secondary:focus,
      ${form} .btn-secondary:active {
        border-color: #145968 !important;
        background-color: #e4f0f1 !important;
        color: #182c36 !important;
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
  assert.notEqual(at, -1, `missing seam: ${before.slice(0, 50)}`);
  assert.equal(at, value.lastIndexOf(needle), `duplicate seam: ${before.slice(0, 50)}`);
  return Buffer.concat([value.subarray(0, at), Buffer.from(after), value.subarray(at + needle.length)]);
}

function original() {
  const bytes = read(fixture);
  assert.equal(hash(bytes), SHA, fixture);
  return bytes;
}

function verifyClinicalSupport(name, bytes) {
  assert.equal(hash(bytes), clinicalSupportHashes.get(name), name);
}

function proposed(baseline) {
  let value = replaceOnce(baseline, '</head>', `${CSS}\n</head>`);
  value = replaceOnce(value, '<body class="body_top">', '<body class="body_top group-attendance-document-editor">');
  return value;
}

function verifySource(candidate, baseline) {
  let inverse = replaceOnce(candidate, '<body class="body_top group-attendance-document-editor">', '<body class="body_top">');
  inverse = replaceOnce(inverse, `${CSS}\n</head>`, '</head>');
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

function values(css, selector, property) {
  return rules(css).filter((rule) => rule.selectors.includes(selector)).flatMap((rule) =>
    [...rule.declarations.matchAll(new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+);`, 'g'))]
      .map((match) => match[1].trim()));
}

function expectValue(css, selector, property, expected) {
  assert.deepEqual(values(css, selector, property), [expected], `${selector}: ${property}`);
}

function verifyCss(css) {
  assert.match(css, /^    <style>\n    @media screen \{/);
  assert.match(css, /    \}\n    <\/style>$/);
  assert.equal((css.match(/@media/g) || []).length, 1);
  assert.doesNotMatch(css, /@media print|\bdisplay\s*:\s*(?:none|grid|table)\s*;|\bvisibility\s*:\s*hidden\b|\bopacity\s*:\s*0\s*;/);
  assert.doesNotMatch(css, /\boverflow\s*:\s*(?:[^;]*\b(?:hidden|clip)\b|auto\s*;)|\boverflow-y\s*:\s*(?:hidden|clip|auto)\b|position\s*:\s*(?:fixed|absolute)|table-layout\s*:\s*fixed/);
  assert.doesNotMatch(css, /\boverflow-[xy]\s*:/);
  assert.doesNotMatch(css, /(?:thead|tbody|\btr\b|\btd\b)\s*\{[^}]*\bdisplay\s*:/);
  for (const rule of rules(css)) for (const selector of rule.selectors) {
    assert.ok(selector === prefix || selector.startsWith(`${prefix} `), `unscoped: ${selector}`);
  }
  for (const [selector, property, expected] of [
    [prefix, 'background-color', '#e8eff0 !important'],
    [prefix, 'color', '#182c36 !important'],
    [`${prefix} > .container-fluid`, 'max-width', '1000px'],
    [form, 'width', '100%'], [form, 'min-width', '0'],
    [form, 'background-color', '#fff !important'],
    [`${form} .button_wrap`, 'flex-wrap', 'wrap'],
    [`${form} .title`, 'font-size', 'clamp(1.35rem, 3vw, 1.8rem)'],
    [`${form} #add_participant_element`, 'background-color', '#f3f7f5 !important'],
    [`${form} .new_patient`, 'width', '100%'],
    [`${form} .new_comment`, 'width', '100%'],
    [`${form} .btn-group`, 'flex-wrap', 'wrap'],
    [wrapper, 'overflow', 'auto visible'], [wrapper, 'width', '100%'],
    [`${wrapper} .dataTables_paginate`, 'white-space', 'normal'],
    [table, 'min-width', '760px'], [table, 'width', '100% !important'],
    [`${table} .status_select`, 'min-width', '11rem'],
    [`${table} .comment`, 'min-width', '12rem'],
    [button, 'min-height', '2.75rem'], [button, 'transition-duration', '0s'],
    [`${button}:focus-visible`, 'outline', '3px solid #a84c22'],
    [`${form} .form-control:focus-visible`, 'outline', '3px solid #a84c22'],
    [`${wrapper} .paginate_button:focus-visible`, 'outline', '3px solid #a84c22']
  ]) expectValue(css, selector, property, expected);
  for (const [selector, fill, ink, activeFill, activeInk] of [
    [`${form} .btn-primary`, '#145968', '#fff', '#104e5b', '#fff'],
    [`${form} .btn-secondary`, '#fff', '#182c36', '#e4f0f1', '#182c36']
  ]) {
    expectValue(css, selector, 'background-color', `${fill} !important`);
    expectValue(css, selector, 'color', `${ink} !important`);
    for (const state of [':hover', ':focus', ':active']) {
      expectValue(css, `${selector}${state}`, 'background-color', `${activeFill} !important`);
      expectValue(css, `${selector}${state}`, 'color', `${activeInk} !important`);
    }
  }
}

function rejectMutation(candidate, before, after, baseline) {
  const at = candidate.indexOf(Buffer.from(before));
  assert.notEqual(at, -1, `missing mutation seam: ${before}`);
  const mutant = Buffer.concat([
    candidate.subarray(0, at), Buffer.from(after), candidate.subarray(at + Buffer.byteLength(before))
  ]);
  assert.ok(!mutant.equals(candidate));
  assert.throws(() => verifySource(mutant, baseline), `rejected: ${before}`);
}

function verifyScope(paths) {
  assert.equal(allowed.size, 5);
  assert.deepEqual(new Set(paths), allowed, 'all and only the five intended paths change');
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

const args = process.argv.slice(2);
assert.ok(args.every((arg) => arg === '--history') && args.length <= 1, 'invalid option');

test('complete original fixture retains ACL, fields, actions, DataTables and native Add Patient seams', () => {
  const value = original().toString();
  for (const token of [
    'AclMain::aclCheckCore("groups", "gadd", false, \'view\')',
    'AclMain::aclCheckCore("groups", "gadd", false, \'write\')',
    'if (!$can_view && !$can_edit)', 'if ($form_id)',
    'getGroupAttendance($form_id)', 'getParticipants($therapy_group, true)',
    'action="<?php echo $rootdir;?>/forms/group_attendance/save.php?mode=update&id=',
    'action="<?php echo $rootdir;?>/forms/group_attendance/save.php?mode=new"',
    'id="add_participant_element"  style="display: none;"',
    'name="new_id"', 'name="new_patient"', 'name="new_comment"',
    'id="group_attendance_form_table"', '<thead>', '<tbody>',
    'patientData[', '][status]', '][comment]',
    'class="form-control status_select"', 'class="form-control comment"',
    'class="btn btn-primary add_patient_button"', 'class="btn btn-secondary cancel_button"',
    'class="btn btn-primary" type="submit"',
    "$('#group_attendance_form_table').DataTable({",
    "$('#group_attendance_form_table').dataTable().fnAddData([",
    "$('#add_participant_element').show()", "$('#add_participant_element').hide()",
    'function setpatient(pid, lname, fname, dob)', 'parent.closeTab(window.name, false)'
  ]) assert.ok(value.includes(token), token);
  assert.equal((value.match(/<th>/g) || []).length, 4);
  assert.equal((value.match(/<td >/g) || []).length, 4);
});

test('screen-only scoped proposal covers document, four-column table, controls and paired palettes', () => verifyCss(CSS));

test('proposal builds and full inverse restores untouched original', () => {
  const baseline = original();
  const candidate = proposed(baseline);
  verifySource(candidate, baseline);
});

test('untouched original fails solely for the missing presentation addition', () => {
  const baseline = original();
  assert.throws(() => verifySource(baseline, baseline), /missing seam: <body class=/);
});

test('actual group attendance source matches exact presentation proposal', () => {
  verifySource(read(source), original());
});

test('save SQL, participant persistence and group helpers remain byte-identical', () => {
  for (const [name] of clinicalSupportHashes) verifyClinicalSupport(name, read(name));
  for (const [name, before, after] of [
    ['interface/forms/group_attendance/save.php', 'INSERT INTO form_group_attendance', 'INSERT INTO another_table'],
    ['interface/forms/group_attendance/save.php', 'DELETE FROM therapy_groups_participant_attendance', 'DELETE FROM another_table'],
    ['interface/forms/group_attendance/functions.php', 'INSERT INTO therapy_groups_participant_attendance', 'INSERT INTO another_table'],
    ['interface/forms/group_attendance/save.php', "if (!$can_edit)", 'if (true)']
  ]) {
    const originalBytes = read(name);
    const at = originalBytes.indexOf(before);
    assert.notEqual(at, -1, before);
    const mutant = Buffer.concat([
      originalBytes.subarray(0, at), Buffer.from(after), originalBytes.subarray(at + Buffer.byteLength(before))
    ]);
    assert.throws(() => verifyClinicalSupport(name, mutant), name);
  }
});

test('clinical, ACL, SQL, binding, action, DataTables and native panel mutants fail', () => {
  const baseline = original();
  const candidate = proposed(baseline);
  for (const [before, after] of [
    ['\'view\')', '\'write\')'],
    ['if (!$can_view && !$can_edit)', 'if (!$can_view)'],
    ['if (!$can_edit)', 'if (false)'],
    ['getGroupAttendance($form_id)', 'getParticipants($therapy_group, true)'],
    ['getParticipants($therapy_group, true)', 'getParticipants($therapy_group, false)'],
    ['save.php?mode=update&id=', 'save.php?mode=new&id='],
    ['save.php?mode=new"', 'save.php?mode=update"'],
    ['name="new_id"', 'name="other_id"'],
    ['name="new_comment"', 'name="other_comment"'],
    ['patientData[', 'otherData['],
    ['][status]', '][other]'], ['][comment]', '][other]'],
    ['value="<?php echo attr($participant[\'meeting_patient_comment\']) ;?>"', 'value=""'],
    ['<?php if (!$can_edit) {', '<?php if (false) {'],
    ['<th><?php echo xlt(\'Comment\'); ?></th>', '<th>Other</th>'],
    ['<tbody>', '<div><tbody>'],
    ["$('#group_attendance_form_table').DataTable({", "$('#other_table').DataTable({"],
    ["$('#group_attendance_form_table').dataTable().fnAddData([", "$('#other_table').dataTable().fnAddData(["],
    ["$('#add_participant_element').show()", "$('#add_participant_element').hide()"],
    ['id="add_participant_element"  style="display: none;"', 'id="add_participant_element"'],
    ['function setpatient(pid, lname, fname, dob)', 'function setpatient(pid)'],
    ['parent.closeTab(window.name, false)', 'window.close()']
  ]) rejectMutation(candidate, before, after, baseline);
});

test('presentation, scope, print, mobile, scroll, focus and palette mutants fail', () => {
  const baseline = original();
  const candidate = proposed(baseline);
  for (const [before, after] of [
    ['<body class="body_top group-attendance-document-editor">', '<body class="body_top other-editor">'],
    ['@media screen {', '@media print {'],
    [`${prefix} {`, 'body {'],
    ['max-width: 1000px;', 'max-width: 1400px;'],
    ['flex-wrap: wrap;', 'flex-wrap: nowrap;'],
    ['overflow: auto visible;', 'overflow: hidden visible;'],
    ['min-width: 760px;', 'min-width: 1000px;'],
    ['min-width: 11rem;', 'min-width: 2rem;'],
    ['min-width: 12rem;', 'min-width: 2rem;'],
    ['outline: 3px solid #a84c22;', 'outline: none;'],
    ['transition-duration: 0s;', 'transition-duration: 1s;'],
    ['background-color: #145968 !important;', 'background-color: #145968;'],
    ['color: #fff !important;', 'color: #182c36 !important;'],
    ['overflow: auto visible;', 'overflow: auto hidden;'],
    ['overflow: auto visible;', 'overflow-x: auto;\n        overflow-y: visible;'],
    [`${form} #add_participant_element {`, `${form} #add_participant_element {\n        display: grid;`]
  ]) rejectMutation(candidate, before, after, baseline);
  for (const [before, after] of [
    ['@media screen {', '@media print {'],
    [`${prefix} {`, 'body {'],
    ['max-width: 1000px;', 'max-width: 1400px;'],
    ['overflow: auto visible;', 'overflow: hidden visible;'],
    ['overflow: auto visible;', 'overflow: auto hidden;'],
    ['overflow: auto visible;', 'overflow-x: auto;\n        overflow-y: visible;'],
    ['min-width: 760px;', 'min-width: 1000px;'],
    ['outline: 3px solid #a84c22;', 'outline: none;'],
    ['background-color: #145968 !important;', 'background-color: #145968;'],
    [`${form} #add_participant_element {`, `${form} #add_participant_element {\n        display: grid;`]
  ]) assert.throws(() => verifyCss(replaceOnce(Buffer.from(CSS), before, after).toString()));
});

test('five-path scope requires every intended delivery path', () => {
  verifyScope(allowed);
  assert.throws(() => verifyScope([...allowed].slice(0, 4)));
  assert.throws(() => verifyScope([...allowed, 'interface/forms/group_attendance/save.php']));
});

if (args.includes('--history')) {
  test('authenticated origin/master supplies fixture and unchanged support bytes', () => {
    assert.equal(git('rev-parse', 'origin/master').toString().trim(), BASE);
    assert.deepEqual(original(), git('show', `${BASE}:${source}`));
    for (const name of support) {
      const base = git('show', `${BASE}:${name}`);
      assert.deepEqual(read(name), base, name);
      assert.deepEqual(git('show', `HEAD:${name}`), base, `HEAD ${name}`);
    }
  });

  test('committed, working, staged and untracked paths are the final five', () => {
    verifyScope(changedPaths());
  });
}

module.exports = { CSS, proposed, verifySource, verifyCss };
