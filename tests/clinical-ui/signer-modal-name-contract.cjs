'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const repo = path.resolve(__dirname, '../..');
const fixturePath = path.join(__dirname, 'fixtures/signer-modal-original.twig.txt');
const expectedSha = 'b3b9132a68bde90aea8f1d6d841fbe63bc98810d6ac320d6f491cb1a70d0dd0d';
const insertion = ' aria-label="{{ \'Signature\'|xla }}"';
const originalOpening = "<div id='openSignModal' class='modal fade' role='dialog' tabindex='-1'>";
const namedOpening = originalOpening.slice(0, -1) + insertion + '>';
const portableCount = 12;
const failures = [];
let total = 0;

function check(name, predicate) {
    total += 1;
    try {
        if (!predicate()) failures.push(name);
    } catch (error) {
        failures.push(name + ': ' + error.message);
    }
}

function occurrences(source, needle) {
    return source.split(needle).length - 1;
}

function attributes(tag) {
    const found = new Map();
    const pattern = /([^\s=/>]+)\s*=\s*(?:'([^']*)'|"([^"]*)")/g;
    for (const match of tag.matchAll(pattern)) {
        const values = found.get(match[1]) || [];
        values.push(match[2] === undefined ? match[3] : match[2]);
        found.set(match[1], values);
    }
    return found;
}

function semantic(source) {
    const roots = [...source.matchAll(/<div\b[^>]*>/g)].filter(match =>
        (attributes(match[0]).get('id') || []).includes('openSignModal'));
    if (roots.length !== 1) return false;
    const attrs = attributes(roots[0][0]);
    return ['id', 'role', 'tabindex', 'aria-label'].every(key =>
        (attrs.get(key) || []).length === 1) &&
        attrs.get('id')[0] === 'openSignModal' &&
        attrs.get('role')[0] === 'dialog' &&
        attrs.get('tabindex')[0] === '-1' &&
        attrs.get('aria-label')[0] === "{{ 'Signature'|xla }}";
}

function inverse(candidate, original) {
    return occurrences(original, originalOpening) === 1 &&
        occurrences(candidate, namedOpening) === 1 &&
        occurrences(candidate, insertion) === 1 &&
        candidate.replace(namedOpening, originalOpening) === original;
}

function changedAndRejected(candidate, baseline, predicate) {
    return candidate !== baseline && !predicate(candidate);
}

function findSource() {
    return path.join(repo, 'templates/portal/partial/_signer_modal_inner_content.html.twig');
}

let original = '';
try {
    original = fs.readFileSync(fixturePath, 'utf8');
} catch (error) {
    failures.push('fixture read: ' + error.message);
}

check('pinned original fixture SHA256', () =>
    crypto.createHash('sha256').update(Buffer.from(original, 'utf8')).digest('hex') === expectedSha);

const named = original.replace(originalOpening, namedOpening);
check('synthetic named candidate passes semantic and exact inverse', () =>
    occurrences(original, originalOpening) === 1 && named !== original && semantic(named) && inverse(named, original));
check('original without name fails semantic predicate', () => !semantic(original));
check('name on child fails semantic predicate', () => {
    const mutant = original.replace("<div class='modal-dialog modal-xl'>", "<div class='modal-dialog modal-xl'" + insertion + '>');
    return changedAndRejected(mutant, original, semantic);
});
check('unescaped translation fails semantic predicate', () =>
    changedAndRejected(named.replace(insertion, ' aria-label="{{ \'Signature\'|xlt }}"'), named, semantic));
check('empty name fails semantic predicate', () =>
    changedAndRejected(named.replace(insertion, ' aria-label=""'), named, semantic));
check('wrong label fails semantic predicate', () =>
    changedAndRejected(named.replace(insertion, ' aria-label="Other"'), named, semantic));
check('duplicate name attributes fail semantic predicate', () =>
    changedAndRejected(named.replace(insertion, insertion + insertion), named, semantic));
check('unrelated source edit fails inverse', () =>
    changedAndRejected(named.replace('Sign Above', 'Sign Here'), named, candidate => inverse(candidate, original)));
check('duplicated insertion fails inverse', () =>
    changedAndRejected(named.replace(insertion, insertion + insertion), named, candidate => inverse(candidate, original)));
check('moved insertion fails inverse', () => {
    const mutant = original.replace("<div class='modal-dialog modal-xl'>", "<div class='modal-dialog modal-xl'" + insertion + '>');
    return changedAndRejected(mutant, original, candidate => inverse(candidate, original));
});
check('production source has approved name and exact original inverse', () => {
    const source = fs.readFileSync(findSource(), 'utf8');
    return semantic(source) && inverse(source, original);
});

if (process.argv.includes('--history')) {
    check('origin/master template matches pinned original fixture', () => {
        const route = path.relative(repo, findSource()).split(path.sep).join('/');
        const baseline = execFileSync('git', ['show', 'origin/master:' + route], { cwd: repo });
        return baseline.equals(Buffer.from(original, 'utf8'));
    });
}

if (total !== portableCount + (process.argv.includes('--history') ? 1 : 0)) {
    failures.push('unexpected test count');
}
const result = { total, passed: total - failures.length, failed: failures.length, failures };
process.stdout.write(JSON.stringify(result) + '\n');
if (result.failed) process.exitCode = 1;
