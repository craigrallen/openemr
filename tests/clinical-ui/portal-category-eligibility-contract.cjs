'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repo = path.resolve(__dirname, '../..');
const route = path.join(repo, 'portal/add_edit_event_user.php');
const fixture = path.join(__dirname, 'fixtures/portal-category-eligibility.php.fixture');
const BASELINE_SOURCE_SHA256 = 'e7bd75d93297a2afa82b85a259be9d9834c45ceebafc18dbacc9172e13c6ecad';

const eligible = { pc_catid: 5, pc_active: 1, pc_cattype: 0, pc_constant_id: null };
const cases = [
    { name: 'eligible integer flags', action: 'save', post: { form_category: '5' }, rows: [eligible], outcome: 'boundary', queries: 1 },
    { name: 'eligible SQL string flags', action: 'save', post: { form_category: '5' }, rows: [{ ...eligible, pc_active: '1', pc_cattype: '0' }], outcome: 'boundary', queries: 1 },
    { name: 'inactive category', action: 'save', post: { form_category: '5' }, rows: [{ ...eligible, pc_active: 0 }], outcome: 'rejected', queries: 1 },
    { name: 'administrative category', action: 'save', post: { form_category: '5' }, rows: [{ ...eligible, pc_cattype: 1 }], outcome: 'rejected', queries: 1 },
    { name: 'office category', action: 'save', post: { form_category: '5' }, rows: [{ ...eligible, pc_cattype: 2 }], outcome: 'rejected', queries: 1 },
    { name: 'NO_SHOW category', action: 'save', post: { form_category: '5' }, rows: [{ ...eligible, pc_constant_id: 'no_show' }], outcome: 'rejected', queries: 1 },
    { name: 'missing category row', action: 'save', post: { form_category: '5' }, rows: [], outcome: 'rejected', queries: 1 },
    { name: 'null active field', action: 'save', post: { form_category: '5' }, rows: [{ ...eligible, pc_active: null }], outcome: 'rejected', queries: 1 },
    { name: 'missing active field', action: 'save', post: { form_category: '5' }, rows: [{ pc_catid: 5, pc_cattype: 0, pc_constant_id: null }], outcome: 'rejected', queries: 1 },
    { name: 'null type field', action: 'save', post: { form_category: '5' }, rows: [{ ...eligible, pc_cattype: null }], outcome: 'rejected', queries: 1 },
    { name: 'missing type field', action: 'save', post: { form_category: '5' }, rows: [{ pc_catid: 5, pc_active: 1, pc_constant_id: null }], outcome: 'rejected', queries: 1 },
    { name: 'missing constant field', action: 'save', post: { form_category: '5' }, rows: [{ pc_catid: 5, pc_active: 1, pc_cattype: 0 }], outcome: 'rejected', queries: 1 },
    { name: 'empty patient ID does not bypass', action: 'save', post: { form_category: '5', form_pid: '' }, rows: [{ ...eligible, pc_active: 0 }], outcome: 'rejected', queries: 1 },
    { name: 'missing patient ID does not bypass', action: 'save', post: { form_category: '5' }, rows: [{ ...eligible, pc_active: 0 }], outcome: 'rejected', queries: 1 },
    { name: 'missing posted category', action: 'save', post: {}, rows: [], outcome: 'rejected', queries: 1 },
    { name: 'non-save empty action', action: '', post: { form_category: '5' }, rows: [{ ...eligible, pc_active: 0 }], outcome: 'none', queries: 0 },
    { name: 'non-save delete action', action: 'delete', post: { form_category: '5' }, rows: [{ ...eligible, pc_active: 0 }], outcome: 'none', queries: 0 },
];

function inspectSource() {
    const source = fs.readFileSync(route, 'utf8');
    const sha256 = crypto.createHash('sha256').update(source).digest('hex');
    const saveMarker = 'if ($form_action === "save") {';
    const saveAt = source.indexOf(saveMarker);
    assert.notEqual(saveAt, -1, 'native save branch must exist');
    assert.equal(source.indexOf(saveMarker, saveAt + 1), -1, 'native save branch must be unique');
    const csrfMarker = "if ($form_action !== '') {\n    CsrfUtils::checkCsrfInput(INPUT_POST, subject: 'portal-appointment', dieOnFail: true);\n}";
    const csrfAt = source.indexOf(csrfMarker);
    assert.notEqual(csrfAt, -1, 'native CSRF check must be present');
    assert.equal(source.slice(csrfAt + csrfMarker.length, saveAt).trim(), '', 'save guard must follow CSRF check');
    const formDateAt = source.indexOf('    $formDate =', saveAt);
    assert.notEqual(formDateAt, -1, 'native $formDate boundary must exist');
    const deleteAt = source.indexOf('} elseif ($form_action === "delete")', formDateAt);
    assert.ok(deleteAt > formDateAt, 'save branch must precede delete branch');
    const prefix = source.slice(saveAt, formDateAt);
    assert.ok(prefix.startsWith(saveMarker), 'fixture must execute the complete native save prefix');
    assert.equal(prefix.slice(saveMarker.length).includes('$formDate'), false, 'boundary must be first $formDate');
    const baselineSource = source.slice(0, saveAt) + `${saveMarker}\n` + source.slice(formDateAt);
    const baselineSha256 = crypto.createHash('sha256').update(baselineSource).digest('hex');
    assert.equal(baselineSha256, BASELINE_SOURCE_SHA256, 'all native bytes outside the save prefix must match the pinned baseline');
    assert.equal(/\b(?:INSERT|UPDATE)\s+openemr_postcalendar_events\b/i.test(prefix), false, 'guard must precede save writes');
    assert.match(source.slice(formDateAt, deleteAt), /(?:INSERT|UPDATE)\s+openemr_postcalendar_events/i, 'native save writes must remain after boundary');
    if (sha256 === BASELINE_SOURCE_SHA256) {
        assert.equal(prefix, `${saveMarker}\n`, 'pinned baseline must have an empty save prefix');
    } else {
        assert.match(prefix, /getOneCalendarCategory\s*\(/, 'changed source must query the native category service in save prefix');
        assert.match(prefix, /\$_POST\['form_category'\]/, 'changed source must use posted category');
        for (const field of ['pc_active', 'pc_cattype', 'pc_constant_id']) {
            assert.ok(prefix.includes(field), `changed source must inspect ${field}`);
        }
    }
    return { sha256, prefixBytes: Buffer.byteLength(prefix), baseline: sha256 === BASELINE_SOURCE_SHA256 };
}

function runCase(testCase) {
    const payload = Buffer.from(JSON.stringify(testCase), 'utf8').toString('base64');
    const child = spawnSync('php', [fixture, route, payload], { cwd: repo, encoding: 'utf8', timeout: 10000 });
    assert.ifError(child.error);
    assert.equal(child.status, 0, `PHP fixture failed: ${child.stderr || child.stdout}`);
    const actual = JSON.parse(child.stdout);
    assert.equal(actual.outcome, testCase.outcome, `${testCase.name}: outcome`);
    assert.equal(actual.queries.length, testCase.queries, `${testCase.name}: query count`);
    if (testCase.queries) {
        assert.deepEqual(actual.queries, [testCase.post.form_category ?? null], `${testCase.name}: requested category`);
    }
    assert.deepEqual(actual.post, testCase.post, `${testCase.name}: POST unchanged`);
    assert.equal(actual.output.startsWith('Error:'), testCase.outcome === 'rejected', `${testCase.name}: rejection message`);
    return actual;
}

function runContract() {
    const summary = { baselineSha256: BASELINE_SOURCE_SHA256, source: null, counts: { total: cases.length, passed: 0, failed: 0 }, cases: [] };
    try {
        summary.source = inspectSource();
    } catch (error) {
        summary.counts.failed = cases.length;
        summary.cases.push({ name: 'source structure', pass: false, error: error.message });
        return summary;
    }
    for (const testCase of cases) {
        try {
            runCase(testCase);
            summary.counts.passed++;
            summary.cases.push({ name: testCase.name, pass: true });
        } catch (error) {
            summary.counts.failed++;
            summary.cases.push({ name: testCase.name, pass: false, error: error.message });
        }
    }
    return summary;
}

module.exports = { runContract, BASELINE_SOURCE_SHA256, expectedCases: cases.length };

if (require.main === module) {
    const summary = runContract();
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    process.exitCode = summary.counts.failed === 0 && summary.counts.passed === cases.length ? 0 : 1;
}
