// OPEMR-180 static contract. Never execute or request setup.php: it reads credentials.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const root = path.resolve(__dirname, '../..');
const SOURCE = 'interface/modules/custom_modules/oe-module-faxsms/setup.php';
const FIXTURE = 'tests/clinical-ui/fixtures/faxsms-setup-original.php.txt';
const CALLER = 'interface/modules/custom_modules/oe-module-faxsms/public/js/messageUI.js';
const POPUP_CSS = 'interface/clinical-workspace/popup.css';
const BASE = '09b29da7771aea334ed5745e058751157af980d7';
const ALLOWED = Object.freeze([
  SOURCE,
  'tests/clinical-ui/faxsms-setup-popup-contract.cjs',
  'tests/js/faxsms-setup-popup.test.js',
  FIXTURE,
  'docs/clinical-ui/FAXSMS-SETUP-POPUP.md',
]);
const SCOPE = 'html.oe-workbench-context body.oe-faxsms-setup-document';
const BODY_BEFORE = '<body>';
const BODY_AFTER = '<body class="oe-faxsms-setup-document">';
const HEAD_END = '</head>';
const MARKER = '/* OPEMR-180 fax/SMS setup popup presentation */';

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

      ${SCOPE} > .container-fluid > h4 {
        white-space: normal;
        overflow-wrap: anywhere;
      }

      ${SCOPE} #setup-form,
      ${SCOPE} #setup-form > .row,
      ${SCOPE} #setup-form > .row > .col {
        min-width: 0;
      }

      ${SCOPE} #setup-form > .row {
        margin-left: 0;
        margin-right: 0;
      }

      ${SCOPE} #setup-form label,
      ${SCOPE} #setup-form small,
      ${SCOPE} #setup-form .form-group > span,
      ${SCOPE} #setup-form .text-muted {
        overflow-wrap: anywhere;
      }

      ${SCOPE} #setup-form .form-control {
        max-width: 100%;
        min-width: 0;
        box-sizing: border-box;
      }

      ${SCOPE} #setup-form .form-group {
        margin-bottom: 12px;
      }

      ${SCOPE} #setup-form textarea {
        margin-top: 4px;
        margin-bottom: 8px;
        line-height: 1.5;
      }

      ${SCOPE} #setup-form > .row > .col > div:last-child {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        clear: both;
      }

      ${SCOPE} #setup-form > .row > .col > div:last-child > .btn {
        max-width: 100%;
        white-space: normal;
        overflow-wrap: anywhere;
        float: none !important;
      }

      ${SCOPE} #setup-form :focus-visible {
        outline: 3px solid var(--oe-wb-petrol, #086878);
        outline-offset: 2px;
      }
    }
    </style>
`;

const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const count = (source, needle) => source.split(needle).length - 1;
function once(source, needle, label) {
  assert.equal(count(source, needle), 1, `${label} must occur exactly once`);
}

function applyPresentation(original) {
  once(original, HEAD_END, 'head close');
  once(original, BODY_BEFORE, 'original body');
  assert.equal(count(original, MARKER), 0, 'original already has the marker');
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
  assert.equal(restoreSource(candidate), original, 'every original byte must survive');
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

test('the five permitted final paths are explicit and unique', () => {
  assert.deepEqual(ALLOWED, [SOURCE, 'tests/clinical-ui/faxsms-setup-popup-contract.cjs',
    'tests/js/faxsms-setup-popup.test.js', FIXTURE, 'docs/clinical-ui/FAXSMS-SETUP-POPUP.md']);
  assert.equal(new Set(ALLOWED).size, 5);
  assert.ok(Object.isFrozen(ALLOWED));
});

test('synthetic presentation restores the full fixture; production stays RED until added', () => {
  const original = read(FIXTURE);
  assert.equal(verifySource(applyPresentation(original)), true);
  assert.throws(() => verifySource(original), /style marker/);
  verifySource(read(SOURCE));
});

test('original controller, form, and caller seams remain pinned', () => {
  const original = read(FIXTURE);
  for (const anchor of [
    '$clientApp = AppDispatch::getApiService($serviceType);',
    'if (!$clientApp instanceof AppDispatch)', '$clientApp->verifyAcl()',
    '$clientApp->getCredentials()', "SessionWrapperFactory::getInstance()->getActiveSession()",
    "CsrfUtils::collectCsrfToken($session, 'contact-form')",
    "$('#setup-form').on('submit'", "'saveSetup?type=' + encodeURIComponent(",
    'type: "POST",', 'data: $(this).serialize(),',
    'js_escape($service)', 'js_escape($serviceType)', 'attr($c[', 'text($c[',
    'hide.forEach(s => $(s).hide());', 'show.forEach(s => $(s).show());',
    'setTimeout(function () {', 'dlgclose();', 'location.reload();',
    'id="setup-form"', 'id="form_space_url"', 'name="api_token"',
    'required="required"', 'xlt("These fields are required.")',
  ]) assert.ok(original.includes(anchor), `missing native seam: ${anchor}`);
  assert.match(read(CALLER), /const doSetup[\s\S]*?currentService === ServiceType\.RINGCENTRAL \? 'setup_rc\.php' : 'setup\.php'[\s\S]*?dlgopen\('', 'setup', 'modal-md', 700/);
  assert.match(read(POPUP_CSS), /@media screen \{[\s\S]*?html\.oe-workbench-context[\s\S]*?--oe-wb-paper: #fff;[\s\S]*?--oe-wb-petrol: #086878;/);
  assert.match(original, /Header::setupHeader\(\)/);
});

test('security, submission, visibility, timing, and field mutations are rejected', () => {
  const valid = applyPresentation(read(FIXTURE));
  for (const [label, before, after] of [
    ['ACL', '$clientApp->verifyAcl()', '$clientApp->verifyAclUnsafe()'],
    ['null guard', 'if (!$clientApp instanceof AppDispatch)', 'if ($clientApp instanceof AppDispatch)'],
    ['credentials', '$clientApp->getCredentials()', '$clientApp->getCredentialsUnsafe()'],
    ['session', "SessionWrapperFactory::getInstance()->getActiveSession()", "SessionWrapperFactory::getInstance()->getSession()"],
    ['CSRF', "CsrfUtils::collectCsrfToken($session, 'contact-form')", "CsrfUtils::collectCsrfToken($session, 'other-form')"],
    ['escaping', 'js_escape($serviceType)', '($serviceType)'],
    ['attribute escaping', "attr($c['space_url'] ?? '')", "($c['space_url'] ?? '')"],
    ['POST', 'type: "POST",', 'type: "GET",'],
    ['save route', "'saveSetup?type='", "'otherRoute?type='"],
    ['serialize', 'data: $(this).serialize(),', 'data: {},'],
    ['hide', 'hide.forEach(s => $(s).hide());', 'hide.forEach(s => $(s).show());'],
    ['show', 'show.forEach(s => $(s).show());', 'show.forEach(s => $(s).hide());'],
    ['timeout', '}, 2000);', '}, 100);'],
    ['close', 'dlgclose();', 'dlgcloseUnsafe();'],
    ['reload', 'location.reload();', 'location.assign("/");'],
    ['field ID', 'id="form_space_url"', 'id="space_url"'],
    ['required', 'required="required" value=\'<?php echo attr($c[\'space_url\'] ?? \'\') ?>\'', 'value=\'<?php echo attr($c[\'space_url\'] ?? \'\') ?>\''],
    ['name', 'name="api_token"', 'name="token"'],
    ['label', 'xlt("Space URL")', 'xlt("Server URL")'],
  ]) rejectMutation(valid, label, before, after);
});

test('every frozen declaration and media, scope, and body seams are required', () => {
  const valid = applyPresentation(read(FIXTURE));
  const declarations = [...ADDITIVE_CSS.matchAll(/^        ([\w-]+: [^\n]+;)\n/gm)];
  assert.ok(declarations.length >= 25, 'expected a substantial layout contract');
  const styleStart = valid.indexOf(ADDITIVE_CSS);
  assert.ok(styleStart >= 0);
  for (const declaration of declarations) {
    const offset = styleStart + declaration.index;
    assert.equal(valid.slice(offset, offset + declaration[0].length), declaration[0],
      `${declaration[1]} must be at its frozen offset`);
    const mutant = valid.slice(0, offset) + valid.slice(offset + declaration[0].length);
    assert.notEqual(mutant, valid, `${declaration[1]} removal must change source`);
    assert.throws(() => verifySource(mutant), undefined, `${declaration[1]} removal must be rejected`);
  }
  for (const [label, before, after] of [
    ['media', '@media screen {', '@media all {'],
    ['scope', `${SCOPE} > .container-fluid {`, 'html.oe-workbench-popup body.oe-faxsms-setup-document > .container-fluid {'],
    ['body', BODY_AFTER, '<body class="other-document">'],
    ['marker', MARKER, '/* altered marker */'],
  ]) rejectMutation(valid, label, before, after);
  const selectors = [...ADDITIVE_CSS.matchAll(/^      (html[^\n{]+)(?: \{|,)$/gm)];
  assert.ok(selectors.length > 0);
  assert.ok(selectors.every((match) => match[1].startsWith(SCOPE)));
  assert.doesNotMatch(ADDITIVE_CSS, /\b(?:display:\s*none|visibility:\s*hidden|overflow:\s*hidden|@media print)\b/);
  assert.doesNotMatch(ADDITIVE_CSS, /(?:background(?:-color)?|color|border-color):[^;]*(?:danger|success|disabled|invalid|valid)/i);
});

test('compact setup form group spacing is scoped and rejects the inherited gap', () => {
  const rule = `      ${SCOPE} #setup-form .form-group {\n        margin-bottom: 12px;\n      }`;
  assert.ok(ADDITIVE_CSS.includes(rule), 'frozen style must include the scoped 12px group gap');
  const valid = applyPresentation(read(FIXTURE));
  rejectMutation(valid, 'form group spacing', rule, rule.replace('12px', '16px'));
});

if (process.argv.includes('--history')) {
  test('pinned fixture and committed, working, and untracked paths stay in scope', () => {
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
