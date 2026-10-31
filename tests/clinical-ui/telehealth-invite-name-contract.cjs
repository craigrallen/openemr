'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const repo = path.resolve(__dirname, '../..');
const moduleRoot = 'interface/modules/custom_modules/oe-module-comlink-telehealth';
const files = {
    template: `${moduleRoot}/templates/comlink/conference-room/modal-invite-patient.html.twig`,
    fixture: 'tests/clinical-ui/fixtures/telehealth-invite-original.twig.txt',
    conferenceRoomTwig: `${moduleRoot}/templates/comlink/conference-room.twig`,
    dialogJs: `${moduleRoot}/public/assets/js/src/add-patient-dialog.js`,
    conferenceRoomJs: `${moduleRoot}/public/assets/js/src/conference-room.js`,
};
const originalSha256 = 'dabf4d584f6fa8fc9a457f052b52fd30c0d62a86ab3b81c84be5e4e23aa1f3a1';
const title = 'Invite Third Party Related Person';
const label = `aria-label="{{ "${title}" | xla }}"`;
const caseNames = Object.freeze([
    'original_fixture_sha256',
    'one_approved_root_opening_tag',
    'visible_translated_title',
    'root_attribute_uses_xla',
    'inverse_preserves_original_bytes',
    'root_modal_semantics',
    'native_template_include',
    'native_clone_and_id_reassignment',
    'native_bootstrap_container',
    'native_dialog_invocation',
]);

function read(relative) {
    return fs.readFileSync(path.join(repo, relative));
}

function text(value) {
    return Buffer.isBuffer(value) ? value.toString('utf8') : value;
}

function inspect(source, overrides = {}) {
    const fixture = overrides.fixture ?? read(files.fixture);
    const original = text(fixture);
    const actual = text(source);
    const rootStart = actual.indexOf('<div ');
    const rootEnd = rootStart < 0 ? -1 : actual.indexOf('>', rootStart);
    const originalStart = original.indexOf('<div ');
    const originalEnd = originalStart < 0 ? -1 : original.indexOf('>', originalStart);
    const root = rootEnd < 0 ? '' : actual.slice(rootStart, rootEnd + 1);
    const originalRoot = originalEnd < 0 ? '' : original.slice(originalStart, originalEnd + 1);
    const approvedRoot = originalRoot.endsWith('>')
        ? `${originalRoot.slice(0, -1)} ${label}>`
        : '';
    const oneRoot = rootStart >= 0 && actual.indexOf('<div ', rootEnd + 1) >= 0;
    const approved = oneRoot && root === approvedRoot;
    const restored = root ? Buffer.from(actual.slice(0, rootStart) + originalRoot + actual.slice(rootEnd + 1), 'utf8') : Buffer.alloc(0);
    const fixtureBytes = Buffer.isBuffer(fixture) ? fixture : Buffer.from(fixture, 'utf8');
    const conferenceRoomTwig = text(overrides.conferenceRoomTwig ?? read(files.conferenceRoomTwig));
    const dialogJs = text(overrides.dialogJs ?? read(files.dialogJs));
    const conferenceRoomJs = text(overrides.conferenceRoomJs ?? read(files.conferenceRoomJs));

    const checks = {
        original_fixture_sha256: crypto.createHash('sha256').update(fixtureBytes).digest('hex') === originalSha256,
        one_approved_root_opening_tag: approved && actual.split(label).length === 2,
        visible_translated_title: actual.includes(`<h5 class="modal-title">{{ "${title}" | xlt }}</h5>`),
        root_attribute_uses_xla: root.includes(label) && !/aria-labelledby\s*=/.test(root),
        inverse_preserves_original_bytes: approved && restored.equals(fixtureBytes),
        root_modal_semantics: root.replace(` ${label}`, '') === '<div class="modal fade" id="telehealth-container-invite-patient" tabindex="-1" aria-hidden="true">'
            && !/\srole\s*=/.test(root)
            && !/\saria-labelledby\s*=/.test(root),
        native_template_include: conferenceRoomTwig.includes('{% include "comlink/conference-room/modal-invite-patient.html.twig" with {thirdPartyPatient: thirdPartyPatient, participants: participantList} %}'),
        native_clone_and_id_reassignment: /let id = 'telehealth-container-invite-patient';/.test(dialogJs)
            && /let node = document\.getElementById\(id\);/.test(dialogJs)
            && /let clonedNode = node\.cloneNode\(true\);/.test(dialogJs)
            && /clonedNode\.id = id \+ "-" \+ this\.__idx\+\+;/.test(dialogJs)
            && /node\.parentNode\.appendChild\(clonedNode\);/.test(dialogJs)
            && /this\.container = clonedNode;/.test(dialogJs),
        native_bootstrap_container: /this\.modal = new bootstrap\.Modal\(this\.container, \{keyboard: false, focus: true, backdrop: 'static'\}\);/.test(dialogJs),
        native_dialog_invocation: /import \{AddPatientDialog\} from "\.\/add-patient-dialog";/.test(conferenceRoomJs)
            && /this\.handleInviteCallback = function\(\) \{[\s\S]*?let dialog = new AddPatientDialog\([\s\S]*?dialog\.show\(\);/.test(conferenceRoomJs),
    };
    return Object.fromEntries(caseNames.map((name) => [name, Boolean(checks[name])]));
}

function mutationCases(fixture) {
    const original = text(fixture);
    const rootEnd = original.indexOf('>', original.indexOf('<div '));
    const approved = original.slice(0, rootEnd) + ` ${label}` + original.slice(rootEnd);
    const baseline = inspect(approved, { fixture });
    const detects = (mutant, caseName, overrides = {}) =>
        baseline[caseName] && inspect(mutant, { fixture, ...overrides })[caseName] === false;
    const cases = {
        rejects_duplicate_root_label: detects(approved.replace(label, `${label} ${label}`), 'one_approved_root_opening_tag'),
        rejects_label_on_child_instead_of_root: detects(
            approved.replace(` ${label}>`, '>').replace('<div class="modal-dialog', `<div ${label} class="modal-dialog`),
            'one_approved_root_opening_tag'),
        rejects_wrong_root_attribute: detects(approved.replace(label, `aria-labelledby="invite-title"`), 'root_attribute_uses_xla'),
        rejects_wrong_attribute_escaping: detects(approved.replace('| xla', '| xlt'), 'root_attribute_uses_xla'),
        rejects_hidden_behavioral_drift: detects(
            approved.replace('{% if not participants %}', '{% if participants %}'),
            'inverse_preserves_original_bytes'),
        rejects_original_fixture_tamper: detects(approved, 'original_fixture_sha256', {
            fixture: Buffer.from(original.replace('Modal for the invite patient', 'Modal for an invite patient'), 'utf8'),
        }),
    };
    return cases;
}

function run() {
    const fixture = read(files.fixture);
    const source = read(files.template);
    const results = { ...inspect(source, { fixture }), ...mutationCases(fixture) };
    const cases = Object.entries(results).map(([name, passed]) => ({ name, passed }));
    const passed = cases.filter((item) => item.passed).length;
    const failed = cases.length - passed;
    const exitStatus = failed === 0 ? 0 : 1;
    process.stdout.write(`${JSON.stringify({ cases, passed, failed, exitStatus })}\n`);
    process.exitCode = exitStatus;
}

module.exports = { inspect, caseNames };

if (require.main === module) {
    run();
}
