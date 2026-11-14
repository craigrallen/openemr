/* tests/clinical-ui/portal-payment-modal-name-contract.cjs */
'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const fixturePath = path.join(__dirname, 'fixtures/portal-payment-modal-name-original.php.txt');
const sourcePath = path.join(root, 'portal/portal_payment.php');
const originalHash = 'a7eac9aaa2a1c5d553a15b67d2fedc0966a1933ce031075764617440ac7fe3ff';
const oldRoot = `<div id="openPayModal" class="modal fade" role="dialog">`;
const newRoot = `<div id="openPayModal" class="modal fade" role="dialog" aria-label="<?php echo xla('Submit Payment for Authorization'); ?>">`;
const count = (source, fragment) => source.split(fragment).length - 1;
const checks = [];
function check(name, fn) {
    try { fn(); checks.push({ name, ok: true }); }
    catch (error) { checks.push({ name, ok: false, error: error.message }); }
}
let fixture;
let source;
check('authenticated original fixture', () => {
    const bytes = fs.readFileSync(fixturePath);
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), originalHash);
    fixture = bytes.toString('utf8');
});
check('unique original source seam', () => {
    assert.equal(count(fixture, oldRoot), 1);
    assert.equal(count(fixture, newRoot), 0);
});
check('actual launcher, title, callback, form, CSRF and gateway sources', () => {
    for (const fragment of [
        `data-target="#openPayModal"`,
        `xlt("Pay Invoice")`,
        `<h4><?php echo xlt('Submit Payment for Authorization'); ?></h4>`,
        `$('#openPayModal').on('show.bs.modal'`,
        `id="invoiceForm"`,
        `id='paymentForm'`,
        `id="payment-form"`,
        `CsrfUtils::collectCsrfToken($session, 'portal-payment')`,
        `portal_payment.authorizenet.js`,
        `portal_payment.stripe.js`,
        `portal_payment.js`,
        `rainforest.js`,
        `renderSphereJs()`
    ]) assert.ok(fixture.includes(fragment), `missing original fragment: ${fragment}`);
});
function validate(candidate) {
    assert.equal(count(candidate, newRoot), 1, 'unique translated attribute name on modal root');
    assert.equal(candidate.replace(newRoot, oldRoot), fixture, 'all other production bytes unchanged');
}
check('named production root and exact inverse preservation', () => {
    source = fs.readFileSync(sourcePath, 'utf8');
    validate(source);
});
function rejectMutation(name, change) {
    check(name, () => {
        assert.equal(count(fixture, oldRoot), 1, 'mutation setup: unique original seam');
        const canonical = fixture.replace(oldRoot, newRoot);
        assert.equal(count(canonical, newRoot), 1, 'mutation setup: unique canonical seam');
        const mutated = change(canonical);
        assert.notEqual(mutated, canonical, 'mutation setup: mutation must change source');
        assert.throws(() => validate(mutated), { name: 'AssertionError' });
    });
}
rejectMutation('missing name', s => s.replace(newRoot, oldRoot));
rejectMutation('untranslated name', s => s.replace(newRoot, newRoot.replace(`<?php echo xla('Submit Payment for Authorization'); ?>`, 'Submit Payment for Authorization')));
rejectMutation('xlt in attribute', s => s.replace(newRoot, newRoot.replace('xla(', 'xlt(')));
rejectMutation('name on wrong element', s => s.replace(newRoot, oldRoot).replace('<div class="modal-dialog">', `<div class="modal-dialog" aria-label="<?php echo xla('Submit Payment for Authorization'); ?>">`));
rejectMutation('duplicate naming', s => s.replace(newRoot, newRoot.slice(0, -1) + ' aria-labelledby="paymentTitle">'));
rejectMutation('unrelated payment mutation', s => s.replace('portal/lib/paylib.php', 'portal/lib/changed-paylib.php'));
rejectMutation('unrelated script mutation', s => s.replace('portal_payment.js', 'changed-portal_payment.js'));
const failures = checks.filter(c => !c.ok).map(c => `${c.name}: ${c.error}`);
process.stdout.write(JSON.stringify({ tests: checks.length, passed: checks.length - failures.length, failed: failures.length, failures }) + '\n');
process.exitCode = failures.length ? 1 : 0;
