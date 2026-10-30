// OPEMR-182 static contract. Never execute setup_email.php: it reads and saves credentials.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const root = path.resolve(__dirname, '../..');
const SOURCE = 'interface/modules/custom_modules/oe-module-faxsms/setup_email.php';
const LAUNCHER = 'interface/modules/custom_modules/oe-module-faxsms/library/setup_services.php';
const POPUP_CSS = 'interface/clinical-workspace/popup.css';
const DARK_THEME = 'interface/themes/oe-styles/style_dark.scss';
const FIXTURE = 'tests/clinical-ui/fixtures/faxsms-email-setup-original.php.txt';
const BASE = '09b29da7771aea334ed5745e058751157af980d7';
const ALLOWED = Object.freeze([
  SOURCE,
  'tests/clinical-ui/faxsms-email-setup-popup-contract.cjs',
  FIXTURE,
  'tests/js/faxsms-email-setup-popup.test.js',
  'docs/clinical-ui/FAXSMS-EMAIL-SETUP-POPUP.md',
]);
const SCOPE = 'html.oe-workbench-context body.oe-faxsms-email-setup';
const BODY_BEFORE = '<body>';
const BODY_AFTER = '<body class="oe-faxsms-email-setup">';
const HEAD_END = '</head>';
const MARKER = '/* OPEMR-182 email reminder setup popup presentation */';
const BUTTON_SELECTOR = `${SCOPE} > .container > .d-flex > .dropdown > #dropdownMenuButton`;
const BUTTON_PAINT = Object.freeze({
  color: 'var(--oe-wb-petrol, #086878)',
  'background-color': 'var(--oe-wb-paper, #fff)',
  'border-color': 'var(--oe-wb-petrol, #086878)',
});

const ADDITIVE_CSS = `    <style>
    ${MARKER}
    @media screen {
      ${SCOPE} > .container {
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

      ${SCOPE} > .container > .d-flex {
        flex-wrap: wrap;
        gap: 8px 16px;
        margin-bottom: 16px;
      }

      ${SCOPE} > .container > .d-flex > h4 {
        margin: 0;
        min-width: 0;
        overflow-wrap: anywhere;
      }

      ${SCOPE} > .container > .d-flex > .dropdown {
        margin-left: 0;
      }

      ${BUTTON_SELECTOR} {
        max-width: 100%;
        white-space: normal;
        overflow-wrap: anywhere;
        color: var(--oe-wb-petrol, #086878);
        background-color: var(--oe-wb-paper, #fff);
        border-color: var(--oe-wb-petrol, #086878);
      }

      ${SCOPE} > .container > .d-flex > .dropdown > .dropdown-menu {
        max-width: 100%;
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

      ${SCOPE} #setup-form textarea {
        margin-top: 4px;
        margin-bottom: 8px;
        line-height: 1.5;
      }

      ${SCOPE} #setup-form > button[type='submit'] {
        max-width: calc(100% - 16px);
        white-space: normal;
        overflow-wrap: anywhere;
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
  assert.ok(candidate.indexOf(ADDITIVE_CSS) < candidate.indexOf(HEAD_END), 'style must be in head');
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

function verifyButtonPaint(candidate) {
  const opening = `${BUTTON_SELECTOR} {`;
  once(candidate, opening, 'route-specific Reminder Actions selector');
  const start = candidate.indexOf(opening) + opening.length;
  const end = candidate.indexOf('}', start);
  assert.ok(end > start, 'Reminder Actions rule must close');
  const rule = candidate.slice(start, end);
  const declarations = [...rule.matchAll(/^        ([\w-]+): ([^;\n]+);$/gm)];
  for (const [property, value] of Object.entries(BUTTON_PAINT)) {
    const matches = declarations.filter((entry) => entry[1] === property);
    assert.equal(matches.length, 1, `${property} must occur once in the scoped button rule`);
    assert.equal(matches[0][2], value, `${property} must pair petrol ink with white paper`);
  }
  return true;
}

function git(args) {
  const run = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  assert.ifError(run.error);
  assert.equal(run.status, 0, `git ${args[0]} failed: ${run.stderr}`);
  return run.stdout;
}

test('the five final paths are explicit and unique', () => {
  assert.deepEqual(ALLOWED, [SOURCE, 'tests/clinical-ui/faxsms-email-setup-popup-contract.cjs',
    FIXTURE, 'tests/js/faxsms-email-setup-popup.test.js', 'docs/clinical-ui/FAXSMS-EMAIL-SETUP-POPUP.md']);
  assert.equal(new Set(ALLOWED).size, 5);
  assert.ok(Object.isFrozen(ALLOWED));
});

test('synthetic candidate restores the full original; live source requires the marker', () => {
  const original = read(FIXTURE);
  assert.equal(verifySource(applyPresentation(original)), true);
  assert.throws(() => verifySource(original), /style marker/);
  verifySource(read(SOURCE));
});

test('native route, saving, escaping, fields, and reminder links are pinned independently', () => {
  const original = read(FIXTURE);
  for (const anchor of [
    'new EmailClient()',
    "SessionWrapperFactory::getInstance()->getActiveSession()",
    "if ($_SERVER['REQUEST_METHOD'] === 'POST')",
    'CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: true)',
    '$emailSetup->saveEmailSetup($credentials)',
    '$emailSetup->getEmailSetup()',
    'CsrfUtils::collectCsrfToken(session: $session)',
    'Header::setupHeader()',
    "attr_url($site_id)",
    "text($credentials['email_message'])",
    'id="setup-form" method="POST"',
    'id="dropdownMenuButton"',
    "xlt('Test Email Reminders')",
    "xlt('Send Email Reminders')",
    'name="email_message"',
    'type="submit" class="btn btn-success float-right m-2"',
  ]) assert.ok(original.includes(anchor), `missing native seam: ${anchor}`);
  for (const field of ['sender_name', 'sender_email', 'notification_email', 'email_transport',
    'smtp_host', 'smtp_port', 'smtp_user', 'smtp_password', 'smtp_security', 'notification_hours']) {
    assert.ok(original.includes(`'${field}' => $_POST['${field}']`), `missing POST field: ${field}`);
    assert.ok(original.includes(`name="${field}"`), `missing form field: ${field}`);
  }
  const launcher = read(LAUNCHER);
  assert.ok(/if \(id === 'set-email'\) \{[\s\S]*?url: '\.\/\.\.\/setup_email\.php\?type=email&module_config=-1'[\s\S]*?dlgopen\('', '', 'modal-lg'/.test(launcher), 'email dialog launcher');
  assert.ok(launcher.includes('<iframe src="<?php echo attr(\'./../setup_email.php?type=email&module_config=1&mode=flat\'); ?>"'), 'email iframe launcher');
  assert.match(read(POPUP_CSS), /@media screen \{[\s\S]*?html\.oe-workbench-context[\s\S]*?--oe-wb-paper: #fff;[\s\S]*?--oe-wb-petrol: #086878;/);
});

test('Reminder Actions paint stays paired across dark theme button states', () => {
  const darkTheme = read(DARK_THEME);
  assert.match(darkTheme, /^\$black: #fff;$/m, 'dark theme makes $black white');
  assert.match(darkTheme, /\.btn-outline-primary \{\s*color: \$black;\s*\}/,
    'dark theme gives the native outline button white ink');
  const original = read(FIXTURE);
  assert.ok(original.includes('class="btn btn-outline-primary dropdown-toggle" type="button" id="dropdownMenuButton"'));
  assert.equal((BUTTON_SELECTOR.match(/#/g) || []).length, 1,
    'the route-specific ID outranks the theme class selector, including hover, focus, and active');
  assert.doesNotMatch(BUTTON_SELECTOR, /:(?:hover|focus|active)\b/,
    'the same paired paint must apply in every button state');

  const valid = applyPresentation(original);
  assert.equal(verifyButtonPaint(valid), true);
  const opening = `${BUTTON_SELECTOR} {`;
  const rule = valid.slice(valid.indexOf(opening), valid.indexOf('}', valid.indexOf(opening)) + 1);
  once(valid, rule, 'complete Reminder Actions rule');
  for (const [label, before, after] of [
    ['foreground removal', '        color: var(--oe-wb-petrol, #086878);\n', ''],
    ['background removal', '        background-color: var(--oe-wb-paper, #fff);\n', ''],
    ['border removal', '        border-color: var(--oe-wb-petrol, #086878);\n', ''],
    ['white foreground', '        color: var(--oe-wb-petrol, #086878);', '        color: #fff;'],
    ['petrol background', '        background-color: var(--oe-wb-paper, #fff);', '        background-color: var(--oe-wb-petrol, #086878);'],
  ]) {
    once(rule, before, `${label} within button rule`);
    const changedRule = rule.replace(before, after);
    assert.notEqual(changedRule, rule, `${label} must change the button rule`);
    const mutant = valid.replace(rule, changedRule);
    assert.throws(() => verifyButtonPaint(mutant), undefined, `${label} must be rejected`);
  }
  verifyButtonPaint(read(SOURCE));
});

test('behavior and rendering mutations are rejected with unique anchors', () => {
  const valid = applyPresentation(read(FIXTURE));
  for (const [label, before, after] of [
    ['POST gate', "if ($_SERVER['REQUEST_METHOD'] === 'POST') {", "if ($_SERVER['REQUEST_METHOD'] === 'GET') {"],
    ['CSRF check', 'CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: true);', 'CsrfUtils::checkCsrfInput(INPUT_GET, dieOnFail: true);'],
    ['save', '$emailSetup->saveEmailSetup($credentials);', '$emailSetup->saveEmailSetup([]);'],
    ['load', '$credentials = $emailSetup->getEmailSetup();', '$credentials = [];'],
    ['CSRF field', '<input type="hidden" name="csrf_token_form" value="<?php echo CsrfUtils::collectCsrfToken(session: $session); ?>" />', '<input type="hidden" name="csrf_token_form" value="" />'],
    ['default template', '$credentials[\'email_message\'] = "A courtesy reminder for ***NAME***', '$credentials[\'email_message\'] = "Other reminder for ***NAME***'],
    ['escaped site', "?dryrun=1&type=email&site=<?php echo attr_url($site_id) ?>')", "?dryrun=1&type=email&site=<?php echo $site_id ?>')"],
    ['escaped textarea', "<?php echo text($credentials['email_message']) ?></textarea>", "<?php echo $credentials['email_message'] ?></textarea>"],
    ['test link', "./library/rc_sms_notification.php?dryrun=1&type=email&site=", "./library/rc_sms_notification.php?type=email&site="],
    ['send link', "popNotify('live', './library/rc_sms_notification.php?type=email&site=", "popNotify('', './library/rc_sms_notification.php?type=email&site="],
    ['required SMTP field', '<input id="smtp_host" type="text" name="smtp_host" class="form-control" value=\'<?php echo attr($credentials[\'smtp_host\']) ?>\' required>', '<input id="smtp_host" type="text" name="smtp_host" class="form-control" value=\'<?php echo attr($credentials[\'smtp_host\']) ?>\'>'],
    ['Save button', '<button type="submit" class="btn btn-success float-right m-2">', '<button type="button" class="btn btn-success float-right m-2">'],
  ]) rejectMutation(valid, label, before, after);
});

test('frozen screen-only layout has route scope, safe gutters, narrow buttons, and two focus rules', () => {
  assert.ok(ADDITIVE_CSS.includes('@media screen {'));
  assert.ok(ADDITIVE_CSS.includes(`${SCOPE} > .container {`));
  assert.ok(ADDITIVE_CSS.includes('max-width: 860px;'));
  assert.ok(ADDITIVE_CSS.includes('width: calc(100% - 24px);'));
  assert.ok(ADDITIVE_CSS.includes('flex-wrap: wrap;'));
  assert.ok(ADDITIVE_CSS.includes('display: flow-root;'));
  assert.ok(ADDITIVE_CSS.includes(`${SCOPE} #setup-form .form-group {\n        margin-bottom: 12px;`));
  assert.ok(ADDITIVE_CSS.includes(`${SCOPE} :focus {\n        outline: 3px`));
  assert.ok(ADDITIVE_CSS.includes(`${SCOPE} :focus-visible {\n        outline: 3px`));
  assert.ok(ADDITIVE_CSS.includes(`${SCOPE} > .container > .d-flex > .dropdown > #dropdownMenuButton {\n        max-width: 100%;\n        white-space: normal;\n        overflow-wrap: anywhere;`));
  assert.ok(ADDITIVE_CSS.includes(`${SCOPE} > .container > .d-flex > .dropdown > .dropdown-menu {\n        max-width: 100%;`));
  assert.ok(ADDITIVE_CSS.includes(`${SCOPE} #setup-form > button[type='submit'] {\n        max-width: calc(100% - 16px);\n        white-space: normal;\n        overflow-wrap: anywhere;`));
  assert.doesNotMatch(ADDITIVE_CSS, /@media print|display:\s*none|visibility:\s*hidden|overflow:\s*hidden/);
  assert.doesNotMatch(ADDITIVE_CSS, /(?:\.alert|\.btn|\.form-control|select|input)(?:\s|\{|:)/);
  for (const line of ADDITIVE_CSS.split('\n').filter((value) => /^      html\./.test(value))) {
    assert.ok(line.trimStart().startsWith(SCOPE), `unscoped selector: ${line}`);
  }
  const valid = applyPresentation(read(FIXTURE));
  for (const [label, before, after] of [
    ['media', '@media screen {', '@media all {'],
    ['container scope', `${SCOPE} > .container {`, 'body > .container {'],
    ['body marker', BODY_AFTER, '<body class="other-popup">'],
    ['style marker', MARKER, '/* changed marker */'],
    ['flow clear', 'display: flow-root;', 'display: block;'],
    ['focus outside form', `${SCOPE} :focus {`, `${SCOPE} #setup-form :focus {`],
    ['visible focus outside form', `${SCOPE} :focus-visible {`, `${SCOPE} #setup-form :focus-visible {`],
    ['focus grouping', `${SCOPE} :focus {`, `${SCOPE} :focus,\n      ${SCOPE} :focus-visible {`],
    ['dropdown grouping', `${SCOPE} > .container > .d-flex > .dropdown > #dropdownMenuButton {`, `${SCOPE} > .container > .d-flex > .dropdown > #dropdownMenuButton,\n      ${SCOPE} > .container > .d-flex > .dropdown > .dropdown-menu {`],
    ['dropdown button width', `${SCOPE} > .container > .d-flex > .dropdown > #dropdownMenuButton {\n        max-width: 100%;`, `${SCOPE} > .container > .d-flex > .dropdown > #dropdownMenuButton {\n        max-width: none;`],
    ['dropdown menu width', `${SCOPE} > .container > .d-flex > .dropdown > .dropdown-menu {\n        max-width: 100%;`, `${SCOPE} > .container > .d-flex > .dropdown > .dropdown-menu {\n        max-width: none;`],
    ['Save grouping', `${SCOPE} #setup-form > button[type='submit'] {`, `${SCOPE} #setup-form > button[type='submit'],\n      ${SCOPE} #setup-form textarea {`],
    ['Save width', `${SCOPE} #setup-form > button[type='submit'] {\n        max-width: calc(100% - 16px);`, `${SCOPE} #setup-form > button[type='submit'] {\n        max-width: 100%;`],
  ]) rejectMutation(valid, label, before, after);
  const declarations = [...ADDITIVE_CSS.matchAll(/^        ([\w-]+: [^\n]+;)$/gm)];
  assert.ok(declarations.length >= 25, 'layout declarations must be frozen');
  for (const declaration of declarations) {
    const offset = valid.indexOf(ADDITIVE_CSS) + declaration.index;
    assert.equal(valid.slice(offset, offset + declaration[0].length), declaration[0]);
    const mutant = valid.slice(0, offset) + valid.slice(offset + declaration[0].length);
    assert.throws(() => verifySource(mutant), undefined, `${declaration[1]} removal must be rejected`);
  }
});

if (process.argv.includes('--history')) {
  test('fixture matches git base and every changed path is in the exact task allowlist', () => {
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

module.exports = Object.freeze({ ADDITIVE_CSS, applyPresentation, restoreSource, verifySource, ALLOWED });
