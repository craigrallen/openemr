'use strict';

// Static source contract: PHP, the application, and the browser are never run here.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const original = fs.readFileSync(path.join(__dirname, 'fixtures/message-due-label-original.php.txt'));
const actual = fs.readFileSync(path.join(root, 'interface/main/messages/messages.php'));
const generator = fs.readFileSync(path.join(root, 'library/options.inc.php'), 'utf8');
const oldLabel = '<label for="form_note_type"><?php echo xlt(\'Due date\'); ?>:</label>';
const newLabel = '<label for="form_datetime"><?php echo xlt(\'Due date\'); ?>:</label>';
const dueSpec = "['data_type' => 4, 'field_id' => 'datetime', 'edit_options' => 'F']";
const emitted = "size='20' class='datetimepicker$datetimepickerclass form-control$smallform' name='form_$field_id_esc' id='form_$field_id_esc'";

function replaceOne(source, before, after, purpose) {
    assert.equal(source.split(before).length - 1, 1, `${purpose}: expected one occurrence`);
    return source.replace(before, after);
}

function correctedOriginal() {
    return replaceOne(original.toString('utf8'), oldLabel, newLabel, 'synthetic correction');
}

function assertExactInverse(source) {
    const restored = replaceOne(source, newLabel, oldLabel, 'approved label inverse');
    assert.deepEqual(Buffer.from(restored, 'utf8'), original,
        'reversing only the Due date label target must reproduce every fixture byte');
}

function assertDueAssociation(source) {
    const labels = [...source.matchAll(/<label\b[^>]*>[\s\S]*?<\/label>/g)]
        .filter((match) => match[0].includes("xlt('Due date')"));
    assert.equal(labels.length, 1, 'expected exactly one translated Due date label');
    assert.equal(labels[0][0], newLabel, 'Due date label must target form_datetime');
    const afterLabel = source.slice(labels[0].index + labels[0][0].length);
    const call = afterLabel.match(/^\s*<\?php\s+generate_form_field\((\[[^\]]+\]),/);
    assert.ok(call, 'Due date label must immediately precede its generator call');
    assert.equal(call[1], dueSpec, 'adjacent generator must use date/time field datetime with option F');
}

function assertGenerator(source) {
    const start = source.indexOf('function generate_form_field($frow, $currvalue): void');
    assert.ok(start >= 0, 'generate_form_field definition missing');
    assert.equal(source.indexOf('function generate_form_field($frow, $currvalue): void', start + 1), -1,
        'generate_form_field definition must be unique');
    const dateStart = source.indexOf('    } elseif ($data_type == 4) { // date', start);
    const dateEnd = source.indexOf('    } elseif ($data_type == 10)', dateStart);
    assert.ok(dateStart > start && dateEnd > dateStart, 'generator date branch missing');
    const prelude = source.slice(start, dateStart);
    const dateBranch = source.slice(dateStart, dateEnd);
    assert.ok(prelude.includes("$data_type   = $frow['data_type'];"), 'generator must read data_type');
    assert.ok(prelude.includes("$field_id    = $frow['field_id'];"), 'generator must read field_id');
    assert.ok(prelude.includes("$edit_options = $frow['edit_options'] ?? null;"), 'generator must read edit_options');
    assert.ok(prelude.includes('$field_id_esc = htmlspecialchars((string) $field_id, ENT_QUOTES);'),
        'generator must escape the field id');
    assert.ok(dateBranch.includes("$modtmp = isOption($edit_options, 'F') === false ? 0 : 1;"),
        'option F must select the date/time branch');
    const timeStart = dateBranch.indexOf("} else {\n                $dateValue  = DateFormatterUtils::oeFormatDateTime");
    const timeEnd = dateBranch.indexOf('\n            }\n        }', timeStart);
    assert.ok(timeStart >= 0 && timeEnd > timeStart, 'date/time emission branch missing');
    const timeBranch = dateBranch.slice(timeStart, timeEnd);
    assert.ok(timeBranch.includes('echo "<input type=\'text\' ' + emitted),
        'date/time branch must emit a native input with id and name form_$field_id_esc');
    assert.equal(timeBranch.split("name='form_$field_id_esc'").length - 1, 1,
        'date/time branch must emit exactly one matching name');
    assert.equal(timeBranch.split("id='form_$field_id_esc'").length - 1, 1,
        'date/time branch must emit exactly one matching id');
}

function rejectMutation(name, change, guard) {
    const baseline = { route: correctedOriginal(), generator };
    const candidate = change(baseline);
    assert.ok(candidate.route !== baseline.route || candidate.generator !== baseline.generator,
        `${name}: mutation did not change its candidate`);
    assert.throws(() => guard(candidate), undefined, `${name}: guard accepted the changed candidate`);
}

const cases = [
    ['fixture is the complete original route', () => {
        const source = original.toString('utf8');
        assert.ok(source.startsWith('<?php\n'));
        assert.ok(source.endsWith('</html>\n'));
        assert.ok(source.includes(oldLabel));
        assert.ok(source.includes("$form_note_type = $_POST['form_note_type'];"));
        assert.ok(source.includes("$datetime = isset($_POST['form_datetime'])"));
        assert.ok(source.includes('CsrfUtils::collectCsrfToken(session: $session)'));
    }],
    ['synthetic correction has an exact full-file inverse', () => assertExactInverse(correctedOriginal())],
    ['synthetic corrected label binds its adjacent date/time generator', () => assertDueAssociation(correctedOriginal())],
    ['generator source emits the configured native id and name', () => assertGenerator(generator)],
    ['native route has an exact full-file inverse', () => assertExactInverse(actual.toString('utf8'))],
    ['native Due date label binds its adjacent date/time generator', () => assertDueAssociation(actual.toString('utf8'))],
    ['wrong Due date target is rejected', () => rejectMutation('wrong target',
        ({ route, generator: source }) => ({ route: replaceOne(route, newLabel, oldLabel, 'wrong target'), generator: source }),
        ({ route }) => assertDueAssociation(route))],
    ['missing generator field_id is rejected', () => rejectMutation('missing field_id',
        ({ route, generator: source }) => ({ route: replaceOne(route, dueSpec,
            "['data_type' => 4, 'edit_options' => 'F']", 'missing field_id'), generator: source }),
        ({ route }) => assertDueAssociation(route))],
    ['changed generator field_id is rejected', () => rejectMutation('changed field_id',
        ({ route, generator: source }) => ({ route: replaceOne(route, dueSpec,
            "['data_type' => 4, 'field_id' => 'changed', 'edit_options' => 'F']", 'changed field_id'), generator: source }),
        ({ route }) => assertDueAssociation(route))],
    ['changed generator data_type is rejected', () => rejectMutation('changed data_type',
        ({ route, generator: source }) => ({ route: replaceOne(route, dueSpec,
            "['data_type' => 2, 'field_id' => 'datetime', 'edit_options' => 'F']", 'changed data_type'), generator: source }),
        ({ route }) => assertDueAssociation(route))],
    ['changed generator edit_options is rejected', () => rejectMutation('changed edit_options',
        ({ route, generator: source }) => ({ route: replaceOne(route, dueSpec,
            "['data_type' => 4, 'field_id' => 'datetime', 'edit_options' => 'A']", 'changed edit_options'), generator: source }),
        ({ route }) => assertDueAssociation(route))],
    ['changed translated label is rejected', () => rejectMutation('translation',
        ({ route, generator: source }) => ({ route: replaceOne(route, "xlt('Due date')", "xlt('Changed date')", 'translation'), generator: source }),
        ({ route }) => assertDueAssociation(route))],
    ['changed emitted native name is rejected', () => rejectMutation('emitted name',
        ({ route, generator: source }) => ({ route, generator: replaceOne(source, emitted,
            emitted.replace("name='form_$field_id_esc'", "name='changed_$field_id_esc'"), 'emitted name') }),
        ({ generator: source }) => assertGenerator(source))],
    ['changed emitted native id is rejected', () => rejectMutation('emitted id',
        ({ route, generator: source }) => ({ route, generator: replaceOne(source, emitted,
            emitted.replace("id='form_$field_id_esc'", "id='changed_$field_id_esc'"), 'emitted id') }),
        ({ generator: source }) => assertGenerator(source))],
    ['JavaScript change is rejected by full inverse', () => rejectMutation('JavaScript',
        ({ route, generator: source }) => ({ route: replaceOne(route, 'var SaveNote = function () {',
            'var ChangedSaveNote = function () {', 'JavaScript'), generator: source }),
        ({ route }) => assertExactInverse(route))],
    ['save logic change is rejected by full inverse', () => rejectMutation('save',
        ({ route, generator: source }) => ({ route: replaceOne(route, "case \"add\":", "case \"changedAdd\":", 'save'), generator: source }),
        ({ route }) => assertExactInverse(route))],
    ['CSRF change is rejected by full inverse', () => rejectMutation('CSRF',
        ({ route, generator: source }) => ({ route: replaceOne(route,
            'request.append("csrf_token_form", <?php echo js_escape(CsrfUtils::collectCsrfToken(session: $session)); ?>);',
            'request.append("csrf_token_form", <?php echo js_escape(CsrfUtils::changedToken(session: $session)); ?>);',
            'CSRF'), generator: source }),
        ({ route }) => assertExactInverse(route))],
];

const EXPECTED_COUNT = 17;

function runContract() {
    return cases.map(([name, check]) => {
        try {
            check();
            return { name, status: 'passed' };
        } catch (error) {
            return { name, status: 'failed', error: error.message };
        }
    });
}

module.exports = { EXPECTED_COUNT, runContract };

if (require.main === module) {
    const results = runContract();
    for (const result of results) {
        process.stdout.write(`${result.status.toUpperCase()} ${result.name}${result.error ? `: ${result.error}` : ''}\n`);
    }
    const failed = results.filter((result) => result.status !== 'passed').length;
    process.stdout.write(`${results.length} cases; ${failed} failed\n`);
    if (results.length !== EXPECTED_COUNT || failed) process.exitCode = 1;
}
