const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..', '..');
const templatePath = path.join(root, 'interface/modules/custom_modules/oe-module-comlink-telehealth/templates/comlink/conference-room.twig');
const fixturePath = path.join(__dirname, 'fixtures/telehealth-session-modals-original.twig.txt');
const jsRoot = path.join(root, 'interface/modules/custom_modules/oe-module-comlink-telehealth/public/assets/js/src');
const originalHash = 'c5138e143268c38fea282e976ab86017a16fbecc8c290a28f743df42859a46e0';
const changes = [
    {
        old: '<div class="modal fade" id="telehealth-container-hangup-confirm" tabindex="-1" aria-hidden="true">',
        next: '<div class="modal fade" id="telehealth-container-hangup-confirm" tabindex="-1" aria-hidden="true" aria-label="{{ "Confirm Session Close" | xla }}">'
    },
    {
        old: '<div class="modal fade" id="telehealth-container-configure-session" tabindex="-1" aria-hidden="true">',
        next: '<div class="modal fade" id="telehealth-container-configure-session" tabindex="-1" aria-hidden="true" aria-label="{{ "Configure Session" | xla }}">'
    }
];
const count = (text, fragment) => text.split(fragment).length - 1;
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const fixture = fs.readFileSync(fixturePath, 'utf8');
const actual = fs.readFileSync(templatePath, 'utf8');
const corrected = changes.reduce((text, change) => text.replace(change.old, change.next), fixture);
const fixtureValid = text => hash(text) === originalHash && changes.every(change => count(text, change.old) === 1 && count(text, change.next) === 0);
const rootsValid = text => changes.every(change => count(text, change.next) === 1 && count(text, change.old) === 0 && count(text, 'aria-label="{{ "' + (change === changes[0] ? 'Confirm Session Close' : 'Configure Session') + '" | xla }}"') === 1);
const scopeValid = (text, baseline) => fixtureValid(baseline) && rootsValid(text) && hash(changes.reduce((value, change) => value.replace(change.next, change.old), text)) === originalHash;
const valid = (text, baseline = fixture) => scopeValid(text, baseline);
const cases = [];
function check(name, assertion) {
    let passed = false;
    try { passed = Boolean(assertion()); } catch (_) { passed = false; }
    cases.push({name, passed});
}

check('fixture checksum and original roots', () => fixtureValid(fixture));
check('actual source has exactly two approved root labels', () => rootsValid(actual));
check('actual source reverses to original fixture bytes', () => scopeValid(actual, fixture));
check('close caller selects existing root and constructs Bootstrap.Modal', () => {
    const source = fs.readFileSync(path.join(jsRoot, 'confirm-session-close-dialog.js'), 'utf8');
    return count(source, "let id = 'telehealth-container-hangup-confirm';") === 1 &&
        count(source, 'container = document.getElementById(id);') === 1 &&
        count(source, "modal = new bootstrap.Modal(container, {keyboard: false, focus: true, backdrop: 'static'});") === 1;
});
check('configure caller selects existing root and constructs Bootstrap.Modal', () => {
    const source = fs.readFileSync(path.join(jsRoot, 'configure-session-call-dialog.js'), 'utf8');
    return count(source, "let id = 'telehealth-container-configure-session';") === 1 &&
        count(source, 'this.container = document.getElementById(id);') === 1 &&
        count(source, "this.modal = new bootstrap.Modal(this.container, {keyboard: false, focus: true, backdrop: 'static'});") === 1;
});
check('mutation rejects missing close label', () => !valid(corrected.replace(changes[0].next, changes[0].old)));
check('mutation rejects missing configure label', () => !valid(corrected.replace(changes[1].next, changes[1].old)));
check('mutation rejects duplicate root', () => !valid(corrected + '\n' + changes[0].next));
check('mutation rejects child-only label', () => !valid(corrected.replace(changes[0].next, changes[0].old).replace('<div class="modal-dialog mw-50 ml-auto mr-auto">', '<div class="modal-dialog mw-50 ml-auto mr-auto" aria-label="{{ "Confirm Session Close" | xla }}">')));
check('mutation rejects swapped labels', () => !valid(corrected.replace(changes[0].next, '__CLOSE_ROOT__').replace(changes[1].next, changes[1].next.replace('Configure Session', 'Confirm Session Close')).replace('__CLOSE_ROOT__', changes[0].next.replace('Confirm Session Close', 'Configure Session'))));
check('mutation rejects wrong escaping filter', () => !valid(corrected.replace('aria-label="{{ "Configure Session" | xla }}"', 'aria-label="{{ "Configure Session" | xlt }}"')));
check('mutation rejects appointment status drift', () => !valid(corrected.replace('data-status="CloseWithoutUpdating"', 'data-status="Changed"')));
check('mutation rejects checkbox behavior drift', () => !valid(corrected.replace('name="enable-participant-invite"', 'name="enable-participant-invite-changed"')));
check('mutation rejects fixture tamper', () => !valid(corrected, fixture + '\n'));

const passed = cases.filter(item => item.passed).length;
const failed = cases.length - passed;
process.stdout.write(JSON.stringify({cases, passed, failed, exitStatus: failed ? 1 : 0}) + '\n');
process.exitCode = failed ? 1 : 0;
