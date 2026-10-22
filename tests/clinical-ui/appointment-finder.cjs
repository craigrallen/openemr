'use strict';

// Portable source-contract suite for the Appointment Finder popup. No git history
// and no subprocesses: runs in a shallow clone under `node --test`, and is spawned
// by tests/js/appointment-finder-popup.test.js for hosted Jest. Exact baseline-byte
// comparisons live in appointment-finder-history.cjs (explicit, local history only).
// Not proven here: native control fit, rendered contrast, clinical acceptance.

const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
    ROUTE, ASSETS, CSS, SHEET, UNCHANGED, CALLER_ANCHORS, ROUTE_ADDITIONS, ROUTE_MUTATIONS, ASSET_ADDITIONS,
    PRESENTATION_MARKERS, LINK, TITLE, CSS_RULES, CSS_MUTATIONS,
    read, count, reverse, routeContractErrors, sheetRules, serializeCss, cssContractErrors,
} = require('./appointment-finder-support.cjs');

test('CSS contract checker accepts the canonical sheet and rejects reordering and print leaks', () => {
    assert.deepEqual(cssContractErrors(serializeCss()), []);
    const swapped = [...CSS_RULES];
    [swapped[6], swapped[7]] = [swapped[7], swapped[6]];
    assert.notDeepEqual(cssContractErrors(serializeCss(swapped)), []);
    assert.notDeepEqual(cssContractErrors(serializeCss().replace('@media screen', '@media all')), []);
});

test('route declared inverse is possible and strips every presentation marker', () => {
    const restored = reverse(read(ROUTE), ROUTE_ADDITIONS);
    for (const marker of PRESENTATION_MARKERS) assert.ok(!restored.includes(marker), marker);
    for (const [before] of ROUTE_ADDITIONS) assert.ok(restored.includes(before), before);
});

test('route satisfies the presentation, placement and business-anchor contract', () => {
    assert.deepEqual(routeContractErrors(read(ROUTE)), []);
});

for (const [label, anchor, replacement] of ROUTE_MUTATIONS) {
    test(`route mutation is rejected: ${label}`, () => {
        const php = read(ROUTE);
        assert.equal(count(php, anchor), 1, `anchor must occur exactly once: ${anchor}`);
        const mutated = php.replace(anchor, () => replacement);
        assert.notEqual(mutated, php, 'mutation must change the route');
        assert.notDeepEqual(routeContractErrors(mutated), []);
    });
}

test('route mutation is rejected: stylesheet moved before the cktime early exit', () => {
    const php = read(ROUTE);
    assert.equal(count(php, `${LINK}\n`), 1);
    assert.equal(count(php, TITLE), 1);
    const mutated = php.replace(`${LINK}\n`, () => '').replace(TITLE, () => `${TITLE}${LINK}\n`);
    assert.notEqual(mutated, php);
    assert.notDeepEqual(routeContractErrors(mutated), []);
});

test('asset allowlist gains exactly the new sheet and its inverse removes it', () => {
    const source = read(ASSETS);
    assert.equal(count(source, `'${SHEET}'`), 1);
    const restored = reverse(source, ASSET_ADDITIONS);
    assert.equal(count(restored, SHEET), 0);
    assert.equal(count(restored, ASSET_ADDITIONS[0][0]), 1);
});

test('stylesheet matches the exact screen-only scoped contract', () => {
    assert.deepEqual(cssContractErrors(read(CSS)), []);
});

for (const [label, mutate] of CSS_MUTATIONS) {
    test(`stylesheet mutation is rejected: ${label}`, () => {
        const rules = sheetRules(read(CSS));
        const original = serializeCss(rules);
        const mutated = serializeCss(mutate(structuredClone(rules)));
        assert.notEqual(mutated, original, 'mutation must change the sheet');
        assert.notDeepEqual(cssContractErrors(mutated), []);
    });
}

test('stylesheet text mutation is rejected: print leak', () => {
    const css = read(CSS);
    assert.equal(count(css, '@media screen'), 1);
    assert.notDeepEqual(cssContractErrors(css.replace('@media screen', '@media all')), []);
});

test('caller, popup frame tokens, dark theme and engine sources keep their anchors', () => {
    for (const file of UNCHANGED) assert.ok(read(file).length > 0, file);
    for (const [file, anchor, expected] of CALLER_ANCHORS) {
        assert.equal(count(read(file), anchor), expected, `${file}: ${anchor}`);
    }
});
