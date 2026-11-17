'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');

const repo = path.resolve(__dirname, '..', '..');
const oldScript = `    <script>
        $(function () {
            $("#req_button").click(function() {
                // hide the button, show the message, and send the ajax call
                $('#req_button').hide();
                $('#openreq').show();
                top.restoreSession();
                $.post( "../../../library/ajax/amc_misc_data.php",
                {
                    amc_id: "provide_rec_pat_amc",
                    complete: false,
                    mode: "add_force",
                    patient_id: <?php echo js_escape($pid); ?>,
                    csrf_token_form: <?php echo js_escape(CsrfUtils::collectCsrfToken(session: $session)); ?>
                });
            });
        });
    </script>`;
const candidateScript = `    <script>
        $(function () {
            let requestPending = false;
            $("#req_button").click(function() {
                if (requestPending) {
                    return;
                }
                requestPending = true;
                $('#req_button').hide();
                $('#openreq').hide();
                top.restoreSession();
                $.post( "../../../library/ajax/amc_misc_data.php",
                {
                    amc_id: "provide_rec_pat_amc",
                    complete: false,
                    mode: "add_force",
                    patient_id: <?php echo js_escape($pid); ?>,
                    csrf_token_form: <?php echo js_escape(CsrfUtils::collectCsrfToken(session: $session)); ?>
                }).done(function() {
                    top.restoreSession();
                    window.location.reload();
                }).fail(function() {
                    $('#req_error').show();
                });
            });
            $('#req_check').click(function() {
                top.restoreSession();
                window.location.reload();
            });
        });
    </script>`;
const errorMarkup = `                <div id="req_error" role="alert" style="display:none">
                    <?php echo xlt('Unable to confirm the request. Check its status before trying again.'); ?>
                    <button type="button" id="req_check" class="btn btn-secondary"><?php echo xlt('Check request status'); ?></button>
                </div>
`;
const endifTail = '                <?php } ?>\n            </div>';
const candidateTail = '                <?php } ?>\n' + errorMarkup + '            </div>';
const expectedHash = '453d6e9bd38462f4371e31568303da367acbd7e173f2fd2b54cdee5daa354532';
const patientExpression = '<?php echo js_escape($pid); ?>';
const csrfExpression = '<?php echo js_escape(CsrfUtils::collectCsrfToken(session: $session)); ?>';
const patient = 'synthetic-patient-opaque';
const csrf = 'synthetic-csrf-opaque';

function invalid(message) {
    process.stderr.write('Invalid source binding or synthetic fixture: ' + message + '\n');
    process.exit(2);
}
function findSource() {
    const file = path.join(repo, 'interface', 'patient_file', 'transaction', 'record_request.php');
    return { file, content: fs.readFileSync(file, 'utf8') };
}
let source;
try {
    source = findSource().content;
} catch (error) {
    invalid(error.message);
}
const original = source.includes(oldScript);
const anticipated = source.includes(candidateScript);
if (original === anticipated) invalid('inline script matches neither or both exact allowed fragments');
if (anticipated && (!source.includes(candidateTail) || source.split(candidateTail).length !== 2)) invalid('candidate error container is absent or duplicated');
if (original && source.includes('id="req_error"')) invalid('original source unexpectedly contains the error container');
const inverse = anticipated ? source.replace(candidateScript, oldScript).replace(candidateTail, endifTail) : source;
if (crypto.createHash('sha256').update(inverse).digest('hex') !== expectedHash) invalid('exact inverse does not match supplied original SHA-256');
const scripts = [...source.matchAll(/<script>([\s\S]*?)<\/script>/g)];
if (scripts.length !== 1) invalid('expected exactly one complete inline script');
let script = scripts[0][1];
for (const expression of [patientExpression, csrfExpression]) {
    if (script.split(expression).length !== 2) invalid('PHP expression is absent or duplicated: ' + expression);
}
script = script.replace(patientExpression, JSON.stringify(patient)).replace(csrfExpression, JSON.stringify(csrf));
if (script.includes('<?php')) invalid('unreplaced PHP in synthetic script');

function harness(existing = false) {
    const elements = new Map();
    for (const [id, visible] of [['#req_button', !existing], ['#openreq', existing], ['#req_error', false], ['#req_check', false]]) {
        elements.set(id, { visible, handler: null });
    }
    const posts = [];
    let restorations = 0;
    let reloads = 0;
    function $(selector) {
        if (typeof selector === 'function') {
            selector();
            return;
        }
        const element = elements.get(selector);
        if (!element) throw new Error('Unexpected selector: ' + selector);
        return {
            click(callback) { element.handler = callback; return this; },
            hide() { element.visible = false; return this; },
            show() { element.visible = true; return this; },
            html() { throw new Error('Response text must not enter the DOM'); },
            text() { throw new Error('Response text must not enter the DOM'); }
        };
    }
    $.post = (url, data) => {
        const request = { url, data, doneCallback: null, failCallback: null };
        request.done = callback => { request.doneCallback = callback; return request; };
        request.fail = callback => { request.failCallback = callback; return request; };
        request.resolve = body => { if (request.doneCallback) request.doneCallback(body); };
        request.reject = error => { if (request.failCallback) request.failCallback(error); };
        posts.push(request);
        return request;
    };
    vm.runInNewContext(script, { $, top: { restoreSession() { restorations++; } }, window: { location: { reload() { reloads++; } } } }, { timeout: 1000 });
    return {
        posts,
        visible: id => elements.get(id).visible,
        fire(id) { const handler = elements.get(id).handler; if (handler) handler(); },
        restorations: () => restorations,
        reloads: () => reloads
    };
}
try { harness(); } catch (error) { invalid('native script boot failed: ' + error.message); }

const cases = [
    ['source inverse preserves original PHP, SQL, ACL, and CSRF', () => {
        assert.equal(crypto.createHash('sha256').update(inverse).digest('hex'), expectedHash);
    }],
    ['existing request load makes no submission or reload', () => {
        const h = harness(true);
        assert.equal(h.posts.length, 0);
        assert.equal(h.reloads(), 0);
        assert.equal(h.visible('#openreq'), true);
    }],
    ['pending submission hides request and recorded message', () => {
        const h = harness();
        h.fire('#req_button');
        assert.equal(h.posts.length, 1);
        assert.equal(h.visible('#req_button'), false);
        assert.equal(h.visible('#openreq'), false);
        assert.equal(h.visible('#req_error'), false);
        assert.equal(h.restorations(), 1);
        assert.equal(h.reloads(), 0);
    }],
    ['duplicate click submits only once', () => {
        const h = harness();
        h.fire('#req_button');
        h.fire('#req_button');
        assert.equal(h.posts.length, 1);
    }],
    ['POST endpoint and metadata remain exact', () => {
        const h = harness();
        h.fire('#req_button');
        assert.equal(h.posts.length, 1);
        const { url, data } = h.posts[0];
        assert.equal(url, '../../../library/ajax/amc_misc_data.php');
        assert.equal(data.amc_id, 'provide_rec_pat_amc');
        assert.equal(data.complete, false);
        assert.equal(data.mode, 'add_force');
        assert.equal(data.patient_id, patient);
        assert.equal(data.csrf_token_form, csrf);
        assert.deepEqual(Object.keys(data).sort(), ['amc_id', 'complete', 'mode', 'patient_id', 'csrf_token_form'].sort());
    }],
    ['every HTTP 200 body restores session and reloads without showing recorded', () => {
        for (const body of ['', 'ok', 'diagnostic', '<html>diagnostic</html>', { status: 'diagnostic' }]) {
            const h = harness();
            h.fire('#req_button');
            h.posts[0].resolve(body);
            assert.equal(h.restorations(), 2);
            assert.equal(h.reloads(), 1);
            assert.equal(h.visible('#openreq'), false);
            assert.equal(h.visible('#req_error'), false);
        }
    }],
    ['failed POST shows uncertainty without reload or automatic retry', () => {
        const h = harness();
        h.fire('#req_button');
        h.posts[0].reject({ responseText: 'PRIVATE SERVER DETAIL' });
        assert.equal(h.visible('#req_error'), true);
        assert.equal(h.visible('#openreq'), false);
        assert.equal(h.visible('#req_button'), false);
        assert.equal(h.reloads(), 0);
        assert.equal(h.posts.length, 1);
        h.fire('#req_button');
        assert.equal(h.posts.length, 1);
    }],
    ['status check restores session and reloads without POST', () => {
        const h = harness();
        h.fire('#req_button');
        h.posts[0].reject({ responseText: 'PRIVATE SERVER DETAIL' });
        h.fire('#req_check');
        assert.equal(h.posts.length, 1);
        assert.equal(h.restorations(), 2);
        assert.equal(h.reloads(), 1);
    }],
    ['private response detail is never reflected', () => {
        const h = harness();
        h.fire('#req_button');
        h.posts[0].reject({ responseText: 'PRIVATE SERVER DETAIL' });
        assert.equal(h.visible('#req_error'), true);
        assert.equal(h.visible('#openreq'), false);
    }]
];
const results = [];
for (const [name, run] of cases) {
    try { run(); results.push({ name, passed: true }); }
    catch (_) { results.push({ name, passed: false }); }
}
const passed = results.filter(result => result.passed).length;
process.stdout.write(JSON.stringify({ total: results.length, passed, failed: results.length - passed, cases: results }) + '\n');
process.exitCode = passed === results.length ? 0 : 1;
