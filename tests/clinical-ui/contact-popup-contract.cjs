// OPEMR-179 static contract. No PHP, browser, or OpenEMR bootstrap is executed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const root = path.resolve(__dirname, '../..');
const SOURCE = 'interface/modules/custom_modules/oe-module-faxsms/contact.php';
const FIXTURE = 'tests/clinical-ui/fixtures/contact-popup-original.php.txt';
const CALLER = 'interface/modules/custom_modules/oe-module-faxsms/public/js/messageUI.js';
const POPUP_CSS = 'interface/clinical-workspace/popup.css';
const BASE = '09b29da7771aea334ed5745e058751157af980d7';
const ALLOWED = Object.freeze([
  SOURCE,
  'tests/clinical-ui/contact-popup-contract.cjs',
  'tests/js/contact-popup.test.js',
  FIXTURE,
  'docs/clinical-ui/CONTACT-POPUP.md',
]);
const SCOPE = 'html.oe-workbench-context body.oe-contact-document';
const BODY_BEFORE = '<body>';
const BODY_AFTER = '<body class="oe-contact-document">';
const HEAD_END = '</head>';
const MARKER = '/* OPEMR-179 contact popup presentation */';

// The entire addition is frozen. The implementation may insert this block once before </head>.
const ADDITIVE_CSS = `    <style>
    ${MARKER}
    @media screen {
      ${SCOPE} > .container-fluid {
        width: calc(100% - 24px);
        max-width: 860px;
        margin: 12px auto;
        padding: clamp(12px, 2vw, 24px);
        box-sizing: border-box;
        border: 1px solid var(--oe-wb-line, #d9e4e2);
        border-radius: 8px;
        background-color: var(--oe-wb-paper, #fff);
        color: var(--oe-wb-ink, #17343b);
      }

      ${SCOPE} #contact-form,
      ${SCOPE} #contact-form .row,
      ${SCOPE} #contact-form [class*='col-'] {
        min-width: 0;
      }

      ${SCOPE} #contact-form .row {
        margin-left: 0;
        margin-right: 0;
      }

      ${SCOPE} #contact-form .form-control {
        max-width: 100%;
        min-width: 0;
      }

      ${SCOPE} #contact-form textarea {
        margin-top: 4px;
        margin-bottom: 8px;
        line-height: 1.5;
      }

      ${SCOPE} #contact-form label,
      ${SCOPE} #contact-form .forwardExclude.smsExclude {
        overflow-wrap: anywhere;
      }

      ${SCOPE} #contact-form > .row:last-child > .col-md-12 > .mt-2 {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }

      ${SCOPE} #contact-form > .row:last-child > .col-md-12 > .mt-2 > .btn {
        max-width: 100%;
        white-space: normal;
        overflow-wrap: anywhere;
        float: none !important;
      }

      ${SCOPE} #contact-form :focus-visible {
        outline: 3px solid var(--oe-wb-petrol, #086878);
        outline-offset: 2px;
      }
    }
    </style>
`;

const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const count = (text, needle) => text.split(needle).length - 1;
function once(text, needle, label) {
  assert.equal(count(text, needle), 1, `${label} must occur exactly once`);
}

function applyPresentation(original) {
  once(original, HEAD_END, 'head close');
  once(original, BODY_BEFORE, 'original body');
  assert.equal(count(original, MARKER), 0, 'original already has the style marker');
  assert.equal(count(original, BODY_AFTER), 0, 'original already has the body class');
  return original.replace(HEAD_END, `${ADDITIVE_CSS}${HEAD_END}`)
    .replace(BODY_BEFORE, BODY_AFTER);
}

function restoreSource(candidate) {
  assert.equal(typeof candidate, 'string');
  once(candidate, MARKER, 'style marker');
  once(candidate, ADDITIVE_CSS, 'frozen style block');
  once(candidate, BODY_AFTER, 'document body class');
  assert.equal(count(candidate, BODY_BEFORE), 0, 'unclassed body remains');
  once(candidate, HEAD_END, 'head close');
  assert.ok(candidate.indexOf(ADDITIVE_CSS) < candidate.indexOf(HEAD_END), 'style must precede head close');
  assert.ok(candidate.indexOf(HEAD_END) < candidate.indexOf(BODY_AFTER), 'body must follow head');
  return candidate.replace(ADDITIVE_CSS, '').replace(BODY_AFTER, BODY_BEFORE);
}

function verifySource(candidate) {
  const original = read(FIXTURE);
  assert.equal(restoreSource(candidate), original, 'all original controller bytes must survive');
  assert.equal(candidate, applyPresentation(original), 'only the two declared additions are allowed');
  return true;
}

function rejectMutation(valid, label, before, after) {
  once(valid, before, `${label} anchor`);
  const mutant = valid.replace(before, after);
  assert.notEqual(mutant, valid, `${label} must change source`);
  assert.throws(() => verifySource(mutant), undefined, `${label} must be rejected`);
}

function git(args) {
  const run = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  assert.ifError(run.error);
  assert.equal(run.status, 0, `git ${args[0]} failed: ${run.stderr}`);
  return run.stdout;
}

test('scope allowlist explicitly includes all five final paths', () => {
  assert.deepEqual(ALLOWED, [SOURCE, 'tests/clinical-ui/contact-popup-contract.cjs',
    'tests/js/contact-popup.test.js', FIXTURE, 'docs/clinical-ui/CONTACT-POPUP.md']);
  assert.equal(new Set(ALLOWED).size, 5);
});

test('synthetic addition restores the full original; production remains RED until implemented', () => {
  const original = read(FIXTURE);
  assert.equal(verifySource(applyPresentation(original)), true);
  assert.throws(() => verifySource(original), /style marker/);
  verifySource(read(SOURCE));
});

test('the original contains the native security, transport, visibility, and control seams', () => {
  const original = read(FIXTURE);
  for (const anchor of [
    '$clientApp->verifyAcl()', '$clientApp->authenticate()',
    "CsrfUtils::collectCsrfToken($session, 'contact-form')",
    "$('#contact-form').on('submit'", 'const formData = $(this).serialize();',
    'type: "POST",', 'url: url,', 'data: formData,',
    'sendSMS?type=sms', 'forwardFax?type=fax', 'sendEmail?type=email', 'sendFax?type=fax',
    'attr($the_file', 'text($file_name)', 'js_escape($interface_pid',
    '$(".show-detail").removeClass("d-none")', 'function setpatient(pid)',
    'function contactCallBack(contact)', 'name="notification_method"',
    'id="form_phone"', 'id="form_message"', 'for="form_email"',
    "<?php echo(!$isForward ? 'required' : ''); ?>",
  ]) assert.ok(original.includes(anchor), `missing native seam: ${anchor}`);
  assert.match(read(CALLER), /function messageReply\(phone\)[\s\S]*?contact\.php\?type=sms&isSMS=1&recipient=[\s\S]*?dlgopen\(url, '', 'modal-sm', 700/);
  assert.match(read(CALLER), /const sendFax[\s\S]*?dlgopen\(url, '', 'modal-sm', 600/);
  assert.match(read(CALLER), /const forwardFax[\s\S]*?dlgopen\(url, '', 'modal-md', 800/);
  assert.match(read(POPUP_CSS), /@media screen \{[\s\S]*?html\.oe-workbench-context/);
  assert.match(original, /Header::setupHeader\(\)/);
});

test('security, send paths, callbacks, and field mutations cannot be disguised as presentation', () => {
  const valid = applyPresentation(read(FIXTURE));
  for (const [label, before, after] of [
    ['ACL', '$clientApp->verifyAcl()', '$clientApp->verifyAclUnsafe()'],
    ['authentication', '$clientApp->authenticate()', '$clientApp->authenticateUnsafe()'],
    ['CSRF', "CsrfUtils::collectCsrfToken($session, 'contact-form')", "CsrfUtils::collectCsrfToken($session, 'other-form')"],
    ['send URL', "return 'sendSMS?type=sms';", "return 'sendSMS?type=fax';"],
    ['POST', 'type: "POST",', 'type: "GET",'],
    ['escaping', 'text($file_name)', '($file_name)'],
    ['visibility', 'if (isForward) {\n                $(".forwardExclude").addClass("d-none");\n                $(".show-detail").removeClass("d-none");',
      'if (isForward) {\n                $(".forwardExclude").addClass("d-none");\n                $(".show-detail").addClass("d-none");'],
    ['callback', 'function setpatient(pid)', 'function setpatient(patientId)'],
    ['field ID', 'id="form_phone"', 'id="phone"'],
    ['field class', 'class="form-control" <?php echo($isEmail', 'class="other-control" <?php echo($isEmail'],
    ['required', "<?php echo(!$isForward ? 'required' : ''); ?>", "<?php echo(!$isForward ? '' : 'required'); ?>"],
    ['label', "xlt('Recipient Phone')", "xlt('Phone')"],
  ]) rejectMutation(valid, label, before, after);
  rejectMutation(valid, 'arbitrary original edit', '<title><?php echo xlt(\'Contact\') ?></title>',
    '<title>Other</title>');
});

test('every frozen CSS declaration and the context seams are required', () => {
  const valid = applyPresentation(read(FIXTURE));
  const declarations = [...ADDITIVE_CSS.matchAll(/^        ([\w-]+: [^\n]+;)\n/gm)];
  assert.ok(declarations.length >= 20, 'expected a substantial frozen layout contract');
  const styleStart = valid.indexOf(ADDITIVE_CSS);
  assert.ok(styleStart >= 0);
  for (const declaration of declarations) {
    const offset = styleStart + declaration.index;
    assert.equal(valid.slice(offset, offset + declaration[0].length), declaration[0],
      `${declaration[1]} anchor must be at its frozen offset`);
    const mutant = valid.slice(0, offset) + valid.slice(offset + declaration[0].length);
    assert.notEqual(mutant, valid, `${declaration[1]} removal must change source`);
    assert.throws(() => verifySource(mutant), undefined, `${declaration[1]} removal must be rejected`);
  }
  for (const [label, before, after] of [
    ['media', '@media screen {', '@media all {'],
    ['scope', `${SCOPE} > .container-fluid {`, 'html.oe-workbench-popup body.oe-contact-document > .container-fluid {'],
    ['body class', BODY_AFTER, '<body class="oe-contact-other">'],
    ['style marker', MARKER, '/* altered marker */'],
  ]) rejectMutation(valid, label, before, after);
  assert.doesNotMatch(ADDITIVE_CSS, /\b(?:display:\s*none|visibility:\s*hidden|overflow:\s*hidden|table-cell|table\s*\{|@media print)\b/);
  assert.doesNotMatch(ADDITIVE_CSS, /(?:background(?:-color)?|color|border-color):[^;]*(?:danger|success|disabled|invalid|valid)/i);
  const selectors = [...ADDITIVE_CSS.matchAll(/^      (html[^\n{]+)(?: \{|,)$/gm)];
  assert.ok(selectors.length > 0, 'style must have scoped selectors');
  assert.ok(selectors.every((match) => match[1].startsWith(SCOPE)),
    'every selector must use the context and body class');
});

if (process.argv.includes('--history')) {
  test('pinned full fixture and committed plus working scope stay within five paths', () => {
    assert.equal(read(FIXTURE), git(['show', `${BASE}:${SOURCE}`]));
    const changed = new Set([
      git(['diff', '--name-only', '-z', BASE, 'HEAD']),
      git(['diff', '--name-only', '-z', 'HEAD']),
      git(['ls-files', '--others', '--exclude-standard', '-z']),
    ].flatMap((output) => output.split('\0').filter(Boolean)));
    for (const file of changed) assert.ok(ALLOWED.includes(file), `out-of-scope path: ${file}`);
  });
}

module.exports = Object.freeze({ ADDITIVE_CSS, applyPresentation, restoreSource, verifySource, ALLOWED });
