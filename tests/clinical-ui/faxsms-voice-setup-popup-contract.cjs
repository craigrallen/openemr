// OPEMR-183 static contract. Never execute setup_voice.php: it loads credentials and services.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const root = path.resolve(__dirname, '../..');
const SOURCE = 'interface/modules/custom_modules/oe-module-faxsms/setup_voice.php';
const LAUNCHER = 'interface/modules/custom_modules/oe-module-faxsms/library/setup_services.php';
const POPUP_CSS = 'interface/clinical-workspace/popup.css';
const FIXTURE = 'tests/clinical-ui/fixtures/faxsms-voice-setup-original.php.txt';
const BASE = '09b29da7771aea334ed5745e058751157af980d7';
const TEST_PATHS = Object.freeze([
  'tests/clinical-ui/faxsms-voice-setup-popup-contract.cjs',
  FIXTURE,
  'tests/js/faxsms-voice-setup-popup.test.js',
]);
const ALLOWED = Object.freeze([
  SOURCE,
  'tests/clinical-ui/faxsms-voice-setup-popup-contract.cjs',
  FIXTURE,
  'tests/js/faxsms-voice-setup-popup.test.js',
  'docs/clinical-ui/FAXSMS-VOICE-SETUP-POPUP.md',
]);
const SCOPE = 'html.oe-workbench-context body.oe-faxsms-voice-setup';
const BODY_BEFORE = '<body>';
const BODY_AFTER = '<body class="oe-faxsms-voice-setup">';
const HEAD_END = '</head>';
const MARKER = '/* OPEMR-183 voice setup popup presentation */';
const WEBHOOK = `${SCOPE} #setup-form button[onclick='registerVoiceWebhook()']`;
const JWT = `${SCOPE} #setup-form button[onclick='openJwtWindow()']`;

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
        margin: 0 0 16px;
        overflow-wrap: anywhere;
      }

      ${SCOPE} #setup-form {
        display: flow-root;
        min-width: 0;
      }

      ${SCOPE} #setup-form > .row {
        margin-left: 0;
        margin-right: 0;
      }

      ${SCOPE} #setup-form > .row > [class*='col-'] {
        min-width: 0;
        padding-left: 8px;
        padding-right: 8px;
      }

      ${SCOPE} #setup-form .form-group {
        margin-bottom: 12px;
      }

      ${SCOPE} #setup-form label,
      ${SCOPE} #setup-form .form-group > span {
        overflow-wrap: anywhere;
      }

      ${SCOPE} #setup-form .form-control,
      ${SCOPE} #setup-form .input-group {
        min-width: 0;
        max-width: 100%;
        box-sizing: border-box;
      }

      ${SCOPE} #setup-form textarea {
        margin-top: 4px;
        margin-bottom: 8px;
        line-height: 1.5;
      }

      ${SCOPE} #setup-form button {
        max-width: calc(100% - 16px);
        white-space: normal;
        overflow-wrap: anywhere;
      }

      ${WEBHOOK} {
        color: var(--oe-wb-petrol, #086878);
        background-color: var(--oe-wb-paper, #fff);
        border-color: var(--oe-wb-petrol, #086878);
      }

      ${JWT} {
        color: var(--oe-wb-on-petrol, #fff);
        background-color: var(--oe-wb-petrol, #086878);
        border-color: var(--oe-wb-petrol, #086878);
      }

      ${SCOPE} :focus {
        outline: 3px solid var(--oe-wb-petrol, #086878);
        outline-offset: 2px;
      }

      ${SCOPE} :focus-visible {
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
  assert.equal(count(original, MARKER), 0, 'original already has marker');
  assert.equal(count(original, BODY_AFTER), 0, 'original already has body class');
  return original.replace(HEAD_END, `${ADDITIVE_CSS}${HEAD_END}`)
    .replace(BODY_BEFORE, BODY_AFTER);
}

function restoreSource(candidate) {
  assert.equal(typeof candidate, 'string');
  once(candidate, MARKER, 'style marker');
  once(candidate, ADDITIVE_CSS, 'frozen style block');
  once(candidate, BODY_AFTER, 'body class');
  assert.equal(count(candidate, BODY_BEFORE), 0, 'unclassed body remains');
  once(candidate, HEAD_END, 'head close');
  assert.equal(candidate.indexOf(ADDITIVE_CSS) + ADDITIVE_CSS.length,
    candidate.indexOf(HEAD_END), 'style must be immediately before head close');
  assert.ok(candidate.indexOf(HEAD_END) < candidate.indexOf(BODY_AFTER), 'body must follow head');
  return candidate.replace(ADDITIVE_CSS, '').replace(BODY_AFTER, BODY_BEFORE);
}

function verifySource(candidate) {
  const original = read(FIXTURE);
  assert.equal(restoreSource(candidate), original, 'every original PHP, JS, and HTML byte must survive');
  assert.equal(candidate, applyPresentation(original), 'only the declared style and body marker are allowed');
  return true;
}

function rejectMutation(valid, label, before, after) {
  once(valid, before, `${label} anchor`);
  const mutant = valid.replace(before, after);
  assert.notEqual(mutant, valid, `${label} must change source`);
  assert.throws(() => verifySource(mutant), undefined, `${label} must be rejected`);
}

function rule(candidate, selector) {
  const opening = `${selector} {`;
  once(candidate, opening, `${selector} rule`);
  const start = candidate.indexOf(opening) + opening.length;
  const end = candidate.indexOf('}', start);
  assert.ok(end > start, `${selector} rule must close`);
  return candidate.slice(start, end);
}

function verifyPaint(candidate, selector, expected) {
  const declarations = [...rule(candidate, selector).matchAll(/^        ([\w-]+): ([^;\n]+);$/gm)];
  for (const [property, value] of Object.entries(expected)) {
    const matches = declarations.filter((entry) => entry[1] === property);
    assert.equal(matches.length, 1, `${property} must occur once in ${selector}`);
    assert.equal(matches[0][2], value, `${property} must retain paired paint`);
  }
  return true;
}

function git(args) {
  const run = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  assert.ifError(run.error);
  assert.equal(run.status, 0, `git ${args[0]} failed: ${run.stderr}`);
  return run.stdout;
}

test('the three permitted test paths are exact and unique', () => {
  assert.deepEqual(TEST_PATHS, ['tests/clinical-ui/faxsms-voice-setup-popup-contract.cjs', FIXTURE,
    'tests/js/faxsms-voice-setup-popup.test.js']);
  assert.equal(new Set(TEST_PATHS).size, 3);
  assert.ok(Object.isFrozen(TEST_PATHS));
  assert.deepEqual(ALLOWED, [SOURCE, ...TEST_PATHS, 'docs/clinical-ui/FAXSMS-VOICE-SETUP-POPUP.md']);
  assert.equal(new Set(ALLOWED).size, 5);
  assert.ok(Object.isFrozen(ALLOWED));
});

test('synthetic candidate restores the full original; live source requires presentation', () => {
  const original = read(FIXTURE);
  assert.equal(Buffer.byteLength(original), 11983, 'full native fixture byte count');
  assert.equal(verifySource(applyPresentation(original)), true);
  assert.throws(() => verifySource(original), /style marker/);
  verifySource(read(SOURCE));
});

test('native voice route, credential flow, webhook, JWT, and fields stay in the fixture', () => {
  const original = read(FIXTURE);
  for (const anchor of [
    "AppDispatch::setModuleType($serviceType)",
    'AppDispatch::getApiService($serviceType)',
    'if (!$clientApp->verifyAcl())',
    '$clientApp->getCredentials()',
    "OEGlobalsBag::getInstance()->get('oe_enable_voice')",
    "$_REQUEST['module_config'] ?? 1",
    'Header::setupHeader()',
    "CsrfUtils::collectCsrfToken($session, 'contact-form')",
    "let url = 'saveSetup?type=voice'",
    'data: $(this).serialize()',
    "$.post('install?type=voice', {csrf_token_form: csrfToken}, null, 'json')",
    'function registerVoiceWebhook()',
    'function openJwtWindow()',
    'function togglePasswordVisibility(id)',
    "attr($c['appKey'])",
    "attr($c['appSecret'])",
    "attr($c['jwt'])",
    'id="setup-form" role="form"',
    'id="form_enable_events"',
    'id="rc-webhook-status"',
    'onclick="registerVoiceWebhook()"',
    'onclick="openJwtWindow()"',
    'type="submit" class="btn btn-success float-right m-2"',
  ]) assert.ok(original.includes(anchor), `missing native seam: ${anchor}`);
  for (const field of ['production', 'enable_events', 'extension', 'phone', 'smsnumber', 'key', 'secret', 'jwt']) {
    assert.ok(original.includes(`name="${field}"`), `missing form field: ${field}`);
  }
  const launcher = read(LAUNCHER);
  assert.match(launcher, /if \(id === 'set-voice'\) \{[\s\S]*?sizeHeight: 'full'[\s\S]*?url: '\.\/\.\.\/setup_voice\.php\?type=voice&module_config=-1'[\s\S]*?dlgopen\('', '', 'modal-lg'/);
  assert.ok(launcher.includes('<iframe src="<?php echo attr(\'./../setup_voice.php?type=voice&module_config=1&mode=flat\'); ?>"'), 'ordinary voice frame');
  assert.match(read(POPUP_CSS), /@media screen \{[\s\S]*?html\.oe-workbench-context[\s\S]*?--oe-wb-paper: #fff;[\s\S]*?--oe-wb-petrol: #086878;/);
});

test('webhook and JWT buttons keep complete foreground and background pairs', () => {
  const original = read(FIXTURE);
  assert.ok(original.includes('class="btn btn-outline-primary btn-sm" onclick="registerVoiceWebhook()"'));
  assert.ok(original.includes('class="btn btn-primary btn-download btn-sm mb-1 p-0 px-1 float-right" onclick="openJwtWindow()"'));
  const valid = applyPresentation(original);
  const pairs = [
    [WEBHOOK, { color: 'var(--oe-wb-petrol, #086878)', 'background-color': 'var(--oe-wb-paper, #fff)', 'border-color': 'var(--oe-wb-petrol, #086878)' }],
    [JWT, { color: 'var(--oe-wb-on-petrol, #fff)', 'background-color': 'var(--oe-wb-petrol, #086878)', 'border-color': 'var(--oe-wb-petrol, #086878)' }],
  ];
  for (const [selector, paint] of pairs) {
    assert.equal(verifyPaint(valid, selector, paint), true);
    assert.doesNotMatch(selector, /:(?:hover|focus|active)\b/, 'paired paint applies to every state');
    for (const [property, value] of Object.entries(paint)) {
      const before = `        ${property}: ${value};`;
      const opening = `${selector} {`;
      const originalRule = `${opening}${rule(valid, selector)}}`;
      once(originalRule, before, `${selector} ${property}`);
      for (const after of ['', `        ${property}: #fff;`]) {
        if (after === before) continue;
        const mutant = valid.replace(originalRule, originalRule.replace(before, after));
        assert.throws(() => verifyPaint(mutant, selector, paint));
      }
    }
  }
});

test('native behavior and rendering changes are rejected', () => {
  const valid = applyPresentation(read(FIXTURE));
  for (const [label, before, after] of [
    ['ACL', 'if (!$clientApp->verifyAcl())', 'if (true)'],
    ['credentials', '$clientApp->getCredentials()', '[]'],
    ['voice flag', "get('oe_enable_voice')", "get('oe_enable_sms')"],
    ['configuration default', "$_REQUEST['module_config'] ?? 1", "$_REQUEST['module_config'] ?? 0"],
    ['CSRF field', "CsrfUtils::collectCsrfToken($session, 'contact-form'); ?>\" />", '" />'],
    ['save URL', "saveSetup?type=voice", "saveSetup?type=sms"],
    ['serialized form', 'data: $(this).serialize()', 'data: {}'],
    ['install URL', "install?type=voice", "install?type=sms"],
    ['webhook token', '{csrf_token_form: csrfToken}', '{}'],
    ['webhook handler', 'onclick="registerVoiceWebhook()"', 'onclick="openJwtWindow()"'],
    ['JWT handler', 'onclick="openJwtWindow()"', 'onclick="registerVoiceWebhook()"'],
    ['password control', "togglePasswordVisibility('form_key')", "togglePasswordVisibility('form_jwt')"],
    ['secret escaping', "attr($c['appSecret'])", "$c['appSecret']"],
    ['JWT escaping', "attr($c['jwt'])", "$c['jwt']"],
    ['required JWT', 'name="jwt" class="form-control small" required', 'name="jwt" class="form-control small"'],
    ['submit action', '<button type="submit" class="btn btn-success float-right m-2" value=""><?php echo xlt("Save Settings") ?></button>\n        </form>', '<button type="button" class="btn btn-success float-right m-2" value=""><?php echo xlt("Save Settings") ?></button>\n        </form>'],
  ]) rejectMutation(valid, label, before, after);
});

test('screen layout, scope, flow, narrow controls, and separate focus rules are frozen', () => {
  const original = read(FIXTURE);
  const valid = applyPresentation(original);
  for (const [label, before, after] of [
    ['media', '@media screen {', '@media all {'],
    ['container scope', `${SCOPE} > .container-fluid {`, 'body > .container-fluid {'],
    ['body marker', BODY_AFTER, '<body class="other-popup">'],
    ['style marker', MARKER, '/* changed marker */'],
    ['flow clear', 'display: flow-root;', 'display: block;'],
    ['focus outside form', `${SCOPE} :focus {`, `${SCOPE} #setup-form :focus {`],
    ['visible focus outside form', `${SCOPE} :focus-visible {`, `${SCOPE} #setup-form :focus-visible {`],
    ['focus grouping', `${SCOPE} :focus {`, `${SCOPE} :focus,\n      ${SCOPE} :focus-visible {`],
    ['selector formatting', `${SCOPE} #setup-form label,\n      ${SCOPE} #setup-form .form-group > span {`, `${SCOPE} #setup-form label, ${SCOPE} #setup-form .form-group > span {`],
    ['button width', 'max-width: calc(100% - 16px);', 'max-width: none;'],
    ['fallback ink', 'var(--oe-wb-ink, #17343b)', 'var(--oe-wb-ink)'],
    ['webhook scope', `${WEBHOOK} {`, '#setup-form .btn-outline-primary {'],
    ['JWT scope', `${JWT} {`, '#setup-form .btn-primary {'],
  ]) rejectMutation(valid, label, before, after);
  assert.doesNotMatch(ADDITIVE_CSS, /@media print|display:\s*none|visibility:\s*hidden|overflow:\s*hidden/);
  assert.doesNotMatch(ADDITIVE_CSS, /(?:\.alert|\.messages|\.text-danger|\.text-muted)/);
  for (const line of ADDITIVE_CSS.split('\n').filter((value) => /^      html\./.test(value))) {
    assert.ok(line.trimStart().startsWith(SCOPE), `unscoped selector: ${line}`);
  }
  const declarations = [...ADDITIVE_CSS.matchAll(/^        ([\w-]+: [^\n]+;)$/gm)];
  assert.ok(declarations.length >= 35, 'layout declarations must be frozen');
  for (const declaration of declarations) {
    const offset = valid.indexOf(ADDITIVE_CSS) + declaration.index;
    const mutant = valid.slice(0, offset) + valid.slice(offset + declaration[0].length);
    assert.throws(() => verifySource(mutant), undefined, `${declaration[1]} removal must be rejected`);
  }
});

test('extra edits, moved seams, duplicate blocks, and altered whitespace are rejected', () => {
  const valid = applyPresentation(read(FIXTURE));
  for (const [label, candidate] of [
    ['extra HTML', valid.replace('</body>', '<p>extra</p>\n</body>')],
    ['extra PHP', valid.replace('$serviceType = \'voice\';', '$serviceType = \'voice\';\n$extra = true;')],
    ['duplicate CSS', valid.replace(HEAD_END, `${ADDITIVE_CSS}${HEAD_END}`)],
    ['style moved', valid.replace(`${ADDITIVE_CSS}${HEAD_END}`, HEAD_END).replace(BODY_AFTER, `${ADDITIVE_CSS}${BODY_AFTER}`)],
    ['body whitespace', valid.replace(BODY_AFTER, '<body class ="oe-faxsms-voice-setup">')],
    ['property indentation', valid.replace('        display: flow-root;', '      display: flow-root;')],
  ]) {
    assert.notEqual(candidate, valid, `${label} must change source`);
    assert.throws(() => verifySource(candidate), undefined, `${label} must be rejected`);
  }
});

if (process.argv.includes('--history')) {
  test('fixture matches the base Git blob and only the five delivery paths changed', () => {
    assert.equal(read(FIXTURE), git(['show', `${BASE}:${SOURCE}`]));
    git(['merge-base', '--is-ancestor', BASE, 'HEAD']);
    const changed = new Set([
      git(['diff', '--name-only', '-z', BASE, 'HEAD']),
      git(['diff', '--name-only', '-z', 'HEAD']),
      git(['ls-files', '--others', '--exclude-standard', '-z']),
    ].flatMap((output) => output.split('\0').filter(Boolean)));
    for (const file of changed) assert.ok(ALLOWED.includes(file), `out-of-scope path: ${file}`);
  });
}

module.exports = Object.freeze({ ADDITIVE_CSS, applyPresentation, restoreSource, verifySource, TEST_PATHS, ALLOWED });
