// tests/clinical-ui/billing-confirm-cancel-contract.cjs
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const fixturePath = path.join(__dirname, 'fixtures/billing-confirm-cancel-original.php.txt');
const routePath = path.join(root, 'interface/billing/billing_report.php');
const hash = '638c728deeccbdbd22ca624aa396cf71cc0141d5ad621ca6b91e2f7d306bcbfe';
const oldLine = "$('#confirmDialog .btn-danger').click(function() {";
const newLine = "$('#confirmDialog .btn-cancel').click(function() {";
const failures = [];
let passed = 0;
function check(name, fn) {
    try { fn(); passed++; }
    catch (error) { failures.push(name + ': ' + error.message); }
}
function requireTrue(value, message) { if (!value) throw new Error(message); }
function read(file) { return fs.readFileSync(file); }
function count(source, fragment) { return source.split(fragment).length - 1; }
function replaceOnce(source, before, after) {
    requireTrue(count(source, before) === 1, 'mutation seam is not unique');
    return source.replace(before, after);
}
function original() { return read(fixturePath).toString('utf8'); }
function route() { return read(routePath).toString('utf8'); }
function corrected() { return replaceOnce(original(), oldLine, newLine); }
function preserved(source) { return source === original() || source === corrected(); }
function section(source, start, end) {
    requireTrue(count(source, start) === 1, 'function start is not unique');
    const from = source.indexOf(start);
    const to = source.indexOf(end, from + start.length);
    requireTrue(to > from, 'function end is missing');
    return source.slice(from, to);
}
function doConfirm(source) { return section(source, 'function doConfirm(Message) {', 'async function confirmActions(e, mType) {'); }
function confirmActions(source) { return section(source, 'async function confirmActions(e, mType) {', 'function placeModal(Message) {'); }
function placeModal(source) { return section(source, 'function placeModal(Message) {', 'function onNewPayer(oEvent) {'); }
function compact(source) { return source.split(/\s+/).join(' '); }
const semantics = [
    ['Cancel selector', source => count(doConfirm(source), newLine) === 1 && count(doConfirm(source), oldLine) === 0],
    ['Cancel rejection', source => compact(doConfirm(source)).includes('$(this).off(); reject("btn-cancel");')],
    ['success handlers', source => ['continue', 'clear', 'validate'].every(action => compact(doConfirm(source)).includes("$('#confirmDialog .btn-" + action + "').click(function() { $(this).off(); resolve(\"btn-" + action + '\"); }')) && count(doConfirm(source), '$(this).off();') === 4],
    ['modal lifecycle', source => compact(placeModal(source)).includes("$('#confirmDialog').on('hidden.bs.modal', function(e) { // remove modal $(this).remove(); console.log(\"Confirm Modal Removed\"); // remove this event for next time. $(this).off(e); });")],
    ['native Cancel button', source => count(placeModal(source), "<button type='button' class='btn btn-secondary btn-cancel' data-dismiss='modal'>") === 1],
    ['caller flow', source => { const body = confirmActions(source); return ['e.preventDefault();', 'await doConfirm(Message).then(action => {', "name: sName,", 'name: action,', 'doSubmit(action).then(function() {', '.catch(function(why) {', 'console.warn("Task was canceled", why);'].every(fragment => body.includes(fragment)) && count(body, '.then(action => {') === 2; }]
];
check('original fixture SHA256', () => requireTrue(crypto.createHash('sha256').update(read(fixturePath)).digest('hex') === hash, 'fixture hash differs'));
check('full source preservation', () => requireTrue(preserved(route()), 'route differs from original and exact correction'));
check('original seam unique', () => requireTrue(count(original(), oldLine) === 1 && count(original(), newLine) === 0, 'original seam differs'));
check('doConfirm range', () => requireTrue(doConfirm(route()).length > 0, 'empty range'));
check('confirmActions range', () => requireTrue(confirmActions(route()).length > 0, 'empty range'));
check('placeModal range', () => requireTrue(placeModal(route()).length > 0, 'empty range'));
for (const [name, predicate] of semantics) check(name, () => requireTrue(predicate(route()), 'source assertion failed'));
function mutant(name, mutate) {
    check('reject mutant: ' + name, () => {
        const baseline = corrected();
        requireTrue(semantics.every(([, predicate]) => predicate(baseline)), 'corrected baseline failed setup');
        const changed = mutate(baseline);
        requireTrue(changed !== baseline, 'mutation did not change source');
        const preservationResult = preserved(changed);
        const semanticResults = semantics.map(([, predicate]) => predicate(changed));
        requireTrue(!preservationResult || semanticResults.some(result => !result), 'mutant accepted');
    });
}
mutant('old wrong selector', source => replaceOnce(source, newLine, oldLine));
mutant('missing selector', source => replaceOnce(source, newLine, ''));
mutant('duplicate selector', source => replaceOnce(source, newLine, newLine + '\n' + newLine));
mutant('changed reject token', source => replaceOnce(source, 'reject("btn-cancel");', 'resolve("btn-cancel");'));
mutant('Cancel submit type', source => replaceOnce(source, "<button type='button' class='btn btn-secondary btn-cancel'", "<button type='submit' class='btn btn-secondary btn-cancel'"));
mutant('altered success handler', source => replaceOnce(source, 'resolve("btn-continue");', 'reject("btn-continue");'));
mutant('deleted catch', source => replaceOnce(source, '.catch(function(why) {', '.then(function(why) {'));
mutant('unrelated source byte', source => replaceOnce(source, 'Billing Report Program', 'Billing Report Programme'));
const result = { tests: 20, passed, failed: failures.length, failures };
process.stdout.write(JSON.stringify(result) + '\n');
process.exitCode = failures.length ? 1 : 0;
