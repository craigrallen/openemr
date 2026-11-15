'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const crypto = require('crypto');

const root = path.resolve(__dirname, '../..');
const fixturePath = path.join(__dirname, 'fixtures/provider-dashboard-modal-original.php.txt');
const sourcePath = path.join(root, 'portal/patient/templates/ProviderHome.tpl.php');
const ORIGINAL_SHA256 = '4af74dc4f49e49e831a9b3920666ca3a210f681f19d0d16fa91fb0598f4ed119';
const BEFORE = '<div class="modal fade" id="formdialog" tabindex="-1" role="dialog" aria-hidden="true">';
const LABEL = 'aria-label="<?php echo xla(\'About Portal Dashboard\'); ?>"';
const AFTER = '<div class="modal fade" id="formdialog" tabindex="-1" role="dialog" ' + LABEL + ' aria-hidden="true">';
const TARGET = '<button class="btn btn-sm btn-secondary" data-toggle="modal" data-target="#formdialog"><?php echo xlt(\'Tell me more\') ?></button>';
const HEADING = '<h4 class="modal-title"><?php echo xlt(\'About Portal Dashboard\') ?></h4>';

function sha256(bytes) {
    return crypto.createHash('sha256').update(bytes).digest('hex');
}

function count(haystack, needle) {
    return haystack.split(needle).length - 1;
}

function authenticOriginal(bytes) {
    return Buffer.isBuffer(bytes) && sha256(bytes) === ORIGINAL_SHA256;
}

function readOriginal() {
    return fs.readFileSync(fixturePath);
}

function readSource() {
    return fs.readFileSync(sourcePath);
}

function assertSingleAnchor(original) {
    assert(authenticOriginal(original), 'original fixture SHA-256 differs');
    const text = original.toString('utf8');
    assert.strictEqual(count(text, BEFORE), 1, 'original modal opening anchor must occur once');
    assert.strictEqual(count(text, TARGET), 1, 'original native target must occur once');
    assert.strictEqual(count(text, HEADING), 1, 'original translated heading must occur once');
    return text;
}

function syntheticCandidate(original) {
    const text = assertSingleAnchor(original);
    return Buffer.from(text.replace(BEFORE, AFTER), 'utf8');
}

function hasNativeTarget(source) {
    return count(source.toString('utf8'), TARGET) === 1;
}

function hasTranslatedHeading(source) {
    return count(source.toString('utf8'), HEADING) === 1;
}

function hasNamedModal(source) {
    const text = source.toString('utf8');
    return count(text, AFTER) === 1 && count(text, LABEL) === 1 && count(text, 'id="formdialog"') === 1;
}

function sourceSemantics(source) {
    return hasNativeTarget(source) && hasTranslatedHeading(source) && hasNamedModal(source);
}

function inverseToOriginalSha(candidate) {
    const text = candidate.toString('utf8');
    if (count(text, AFTER) !== 1 || count(text, LABEL) !== 1) {
        return false;
    }
    return sha256(Buffer.from(text.replace(AFTER, BEFORE), 'utf8')) === ORIGINAL_SHA256;
}

function preservesOriginal(candidate, original) {
    if (!authenticOriginal(original)) {
        return false;
    }
    const expected = syntheticCandidate(original);
    return Buffer.isBuffer(candidate) && candidate.equals(expected) && inverseToOriginalSha(candidate);
}

function run() {
    const cases = [];
    function check(name, fn) {
        try {
            fn();
            cases.push({ name, ok: true });
        } catch (_) {
            cases.push({ name, ok: false });
        }
    }

    check('original fixture SHA authentic', () => {
        assertSingleAnchor(readOriginal());
    });
    check('active native Tell me more target retained', () => {
        assert(hasNativeTarget(readSource()));
    });
    check('native translated h4 retained', () => {
        assert(hasTranslatedHeading(readSource()));
    });
    check('translated xla root label unique with role tabindex hidden retained', () => {
        assert(hasNamedModal(readSource()));
        assert(sourceSemantics(readSource()));
    });
    check('exact single-fragment inverse to ORIGINAL SHA retains all bytes', () => {
        const original = readOriginal();
        const candidate = readSource();
        assert(inverseToOriginalSha(candidate));
        assert(preservesOriginal(candidate, original));
    });
    check('synthetic minimal candidate passes semantic and preservation predicates', () => {
        const original = readOriginal();
        const candidate = syntheticCandidate(original);
        assert(sourceSemantics(candidate));
        assert(preservesOriginal(candidate, original));
    });
    check('missing label mutant rejected', () => {
        const original = readOriginal();
        const mutant = Buffer.from(syntheticCandidate(original).toString('utf8').replace(AFTER, BEFORE), 'utf8');
        assert.strictEqual(sourceSemantics(mutant), false);
        assert.strictEqual(preservesOriginal(mutant, original), false);
    });
    check('wrong label mutant rejected', () => {
        const original = readOriginal();
        const mutant = Buffer.from(syntheticCandidate(original).toString('utf8').replace(LABEL, 'aria-label="Wrong"'), 'utf8');
        assert.strictEqual(sourceSemantics(mutant), false);
        assert.strictEqual(preservesOriginal(mutant, original), false);
    });
    check('duplicate label mutant rejected', () => {
        const original = readOriginal();
        const mutant = Buffer.from(syntheticCandidate(original).toString('utf8').replace(HEADING, HEADING + LABEL), 'utf8');
        assert.strictEqual(sourceSemantics(mutant), false);
        assert.strictEqual(preservesOriginal(mutant, original), false);
    });
    check('unrelated byte mutant rejected by preservation', () => {
        const original = readOriginal();
        const candidate = syntheticCandidate(original).toString('utf8');
        assert.strictEqual(count(candidate, 'Visit Forum'), 1);
        const mutant = Buffer.from(candidate.replace('Visit Forum', 'Visit Forums'), 'utf8');
        assert(sourceSemantics(mutant));
        assert.strictEqual(preservesOriginal(mutant, original), false);
    });

    return {
        passed: cases.filter((item) => item.ok).length,
        failed: cases.filter((item) => !item.ok).length,
        cases
    };
}

module.exports = {
    run,
    sourceSemantics,
    preservesOriginal,
    authenticOriginal,
    hasNativeTarget,
    hasTranslatedHeading,
    hasNamedModal,
    inverseToOriginalSha,
    syntheticCandidate
};

if (require.main === module) {
    const result = run();
    process.stdout.write(JSON.stringify(result) + '\n');
    if (result.failed !== 0) {
        process.exitCode = 1;
    }
}
