'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const sourcePath = path.resolve(__dirname, '../../interface/main/onotes/office_comments_full.php');
const fixturePath = path.resolve(__dirname, 'fixtures/office-note-delete-original.php.txt');
const originalHash = '08c6b7461381256a910686c48571bf92c6ba248a7e5686a50546ba93127d6f85';
const oldSeam = `                                <div class="modal-body">
                                    <input type="hidden" name="csrf_token_form" value="<?php echo CsrfUtils::collectCsrfToken(session: $session); ?>" />
                                    <input type="hidden" name="mode" value="edit">
                                    <input type="hidden" name="offset" value="<?php echo attr($offset); ?>">
                                    <input type="hidden" name="active" value="<?php echo attr($active); ?>">
                                    <input type="hidden" name="note_id" value="<?php echo attr($note['id']); ?>">
                                    <p><?php echo xlt("Are you sure you want to delete this note?"); ?></p>
                                </div>`;
const newSeam = oldSeam.replace('name="mode" value="edit"', 'name="mode" value="delete"');
const deleteMarker = '<!-- Delete Note Confirmation Modal -->';
const editMarker = '<!-- Edit Note Modal -->';

function count(haystack, needle) {
    return haystack.split(needle).length - 1;
}

function replaceOne(haystack, before, after) {
    assert.notEqual(before, after);
    assert.equal(count(haystack, before), 1, 'mutation seam must occur exactly once');
    return haystack.replace(before, after);
}

function formAfter(source, marker) {
    assert.equal(count(source, marker), 1, 'form marker must occur exactly once');
    const start = source.indexOf('<form', source.indexOf(marker));
    assert.notEqual(start, -1, 'opening form missing');
    const end = source.indexOf('</form>', start);
    assert.notEqual(end, -1, 'closing form missing');
    return source.slice(start, end + '</form>'.length);
}

function attribute(tag, name) {
    const match = tag.match(new RegExp('(?:^|\\s)' + name + '="([^"]*)"'));
    return match ? match[1] : undefined;
}

function hidden(form, name) {
    const tags = form.match(/<input\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/g) || [];
    return tags.filter((tag) => attribute(tag, 'type') === 'hidden' && attribute(tag, 'name') === name).map((tag) => attribute(tag, 'value'));
}

function oneHidden(form, name, value) {
    assert.deepEqual(hidden(form, name), [value], name);
}

function modes(source) {
    oneHidden(formAfter(source, deleteMarker), 'mode', 'delete');
    oneHidden(formAfter(source, editMarker), 'mode', 'edit');
    oneHidden(formAfter(source, '<!-- Add New Note Form -->'), 'mode', 'new');
    oneHidden(formAfter(source, '<form id="toggleForm'), 'mode', 'update');
}

function fields(source) {
    const form = formAfter(source, deleteMarker);
    oneHidden(form, 'csrf_token_form', '<?php echo CsrfUtils::collectCsrfToken(session: $session); ?>');
    oneHidden(form, 'offset', '<?php echo attr($offset); ?>');
    oneHidden(form, 'active', '<?php echo attr($active); ?>');
    oneHidden(form, 'note_id', "<?php echo attr($note['id']); ?>");
    assert.equal(form.includes('name="note"'), false);
    assert.equal(form.includes('<textarea'), false);
}

function dispatcher(source) {
    assert.equal(count(source, `} elseif ($_POST['mode'] == "edit") {
        $oNoteService->updateNoteById($_POST['note_id'], $_POST['note']);`), 1);
    assert.equal(count(source, `} elseif ($_POST['mode'] == "delete") {
        $oNoteService->deleteNoteById($_POST['note_id']);`), 1);
}

function launcher(source) {
    assert.equal(count(source, `type="button" class="btn btn-sm btn-outline-danger" data-toggle="modal" data-target="#deleteNoteModal<?php echo attr($note['id']); ?>"`), 1);
    assert.equal(count(source, `id="deleteNoteModal<?php echo attr($note['id']); ?>"`), 1);
}

function captions(source) {
    const form = formAfter(source, deleteMarker);
    for (const text of ['xlt("Delete Note")', 'xlt("Are you sure you want to delete this note?")', 'type="submit" class="btn btn-danger"><?php echo xlt("Delete"); ?>', 'type="button" class="btn btn-secondary" data-dismiss="modal"><?php echo xlt("Cancel"); ?>']) {
        assert.equal(form.includes(text), true, text);
    }
}

function semantics(source) {
    modes(source);
    fields(source);
    dispatcher(source);
    launcher(source);
    captions(source);
}

function rejected(base, before, after, verify = semantics) {
    const mutant = replaceOne(base, before, after);
    assert.throws(() => verify(mutant));
}

function main() {
    let tests = 0;
    let passed = 0;
    const failures = [];
    function check(name, fn) {
        tests++;
        try {
            fn();
            passed++;
        } catch (error) {
            failures.push(name + ': ' + error.message);
        }
    }
    try {
        const fixtureBytes = fs.readFileSync(fixturePath);
        const sourceBytes = fs.readFileSync(sourcePath);
        const original = fixtureBytes.toString('utf8');
        const source = sourceBytes.toString('utf8');
        check('authenticated original fixture', () => {
            assert.equal(crypto.createHash('sha256').update(fixtureBytes).digest('hex'), originalHash);
            assert.equal(Buffer.compare(fixtureBytes, Buffer.from(original, 'utf8')), 0);
            assert.equal(count(original, oldSeam), 1);
            assert.equal(count(oldSeam, 'name="mode" value="edit"'), 1);
        });
        const expected = replaceOne(original, oldSeam, newSeam);
        check('exact single-fragment inverse', () => assert.equal(Buffer.compare(sourceBytes, Buffer.from(expected, 'utf8')), 0));
        check('delete form mode', () => oneHidden(formAfter(source, deleteMarker), 'mode', 'delete'));
        check('other form modes', () => {
            oneHidden(formAfter(source, editMarker), 'mode', 'edit');
            oneHidden(formAfter(source, '<!-- Add New Note Form -->'), 'mode', 'new');
            oneHidden(formAfter(source, '<form id="toggleForm'), 'mode', 'update');
        });
        check('delete form fields', () => fields(source));
        check('native dispatcher branches', () => dispatcher(source));
        check('row modal launcher', () => launcher(source));
        check('confirmation and buttons', () => captions(source));
        check('delete form has no note body', () => {
            const form = formAfter(source, deleteMarker);
            assert.equal(form.includes('name="note"'), false);
            assert.equal(form.includes('<textarea'), false);
        });
        check('reject original wrong mode', () => rejected(expected, newSeam, oldSeam));
        check('reject missing delete mode', () => rejected(expected, newSeam, newSeam.replace('                                    <input type="hidden" name="mode" value="delete">\n', '')));
        check('reject duplicate delete mode', () => rejected(expected, newSeam, newSeam.replace('                                    <input type="hidden" name="mode" value="delete">', '                                    <input type="hidden" name="mode" value="delete">\n                                    <input type="hidden" name="mode" value="delete">')));
        check('reject changed edit mode', () => {
            const editForm = formAfter(expected, editMarker);
            rejected(expected, editForm, replaceOne(editForm, 'name="mode" value="edit"', 'name="mode" value="delete"'));
        });
        check('reject missing note ID', () => rejected(expected, newSeam, newSeam.replace('                                    <input type="hidden" name="note_id" value="<?php echo attr($note[\'id\']); ?>">\n', '')));
        check('reject missing CSRF field', () => rejected(expected, newSeam, newSeam.replace('                                    <input type="hidden" name="csrf_token_form" value="<?php echo CsrfUtils::collectCsrfToken(session: $session); ?>" />\n', '')));
        check('reject wrong delete dispatch', () => rejected(expected, `        $oNoteService->deleteNoteById($_POST['note_id']);`, `        $oNoteService->updateNoteById($_POST['note_id'], $_POST['note']);`));
        check('reject cancel submission', () => rejected(expected, 'type="button" class="btn btn-secondary" data-dismiss="modal"><?php echo xlt("Cancel"); ?>', 'type="submit" class="btn btn-secondary" data-dismiss="modal"><?php echo xlt("Cancel"); ?>'));
        check('reject unrelated script change', () => rejected(expected, 'const checkbox = document.getElementById(`activityCheckbox${noteId}`);', 'const checkbox = document.getElementById(`changedCheckbox${noteId}`);', (mutant) => assert.equal(mutant, expected)));
        check('reject unrelated body change', () => rejected(expected, 'class="container-fluid table-responsive"', 'class="container-fluid changed"', (mutant) => assert.equal(mutant, expected)));
    } catch (error) {
        tests++;
        failures.push('contract setup: ' + error.message);
    }
    process.stdout.write(JSON.stringify({ tests, passed, failed: failures.length, failures }) + '\n');
    process.exitCode = failures.length ? 1 : 0;
}

main();
