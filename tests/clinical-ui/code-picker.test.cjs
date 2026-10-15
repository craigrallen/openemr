'use strict';

// Portable source-contract suite for the Code Finder popup. No git history and no
// subprocesses: runs in a shallow clone under `node --test` or via the Jest wrapper.
// Exact baseline-byte comparisons live in code-picker-baseline.test.cjs.
// Not proven here: native tiny-control geometry and effective rendered contrast.

const assert = require('node:assert/strict');
const support = require('./code-picker-support.cjs');

const {
    ROUTE, ASSETS, CSS, UNCHANGED, CALLER_ANCHORS, ROUTE_ADDITIONS, ROUTE_MUTATIONS, ASSET_ADDITIONS,
    PRESENTATION_MARKERS, CSS_RULES, CSS_MUTATIONS,
    read, count, reverse, routeContractErrors, sheetRules, serializeCss, cssContractErrors,
} = support;

const cases = [];
const test = (name, fn) => cases.push([name, fn]);

test('CSS contract checker accepts the canonical sheet and rejects reordering', () => {
    assert.deepEqual(cssContractErrors(serializeCss()), []);
    const swapped = [...CSS_RULES];
    [swapped[3], swapped[swapped.length - 1]] = [swapped[swapped.length - 1], swapped[3]];
    assert.notDeepEqual(cssContractErrors(serializeCss(swapped)), []);
    assert.notDeepEqual(cssContractErrors(serializeCss().replace('@media screen', '@media all')), []);
});

test('route declared presentation inverse is possible and strips every presentation marker', () => {
    const restored = reverse(read(ROUTE), ROUTE_ADDITIONS);
    for (const marker of PRESENTATION_MARKERS) assert.ok(!restored.includes(marker), marker);
    // Each original snippet is restored; an original may be a substring of its
    // planned replacement, so only the inverse (not the working tree) is counted.
    for (const [before] of ROUTE_ADDITIONS) assert.ok(restored.includes(before), before);
});

test('route satisfies the portable presentation and business-anchor contract', () => {
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

test('asset allowlist gains exactly the new sheet and its inverse removes it', () => {
    const source = read(ASSETS);
    assert.equal(count(source, 'code-picker-popup.css'), 1);
    const restored = reverse(source, ASSET_ADDITIONS);
    assert.equal(count(restored, 'code-picker-popup.css'), 0);
    assert.equal(count(restored, "        'calendar-workday.js',\n"), 1);
});

test('stylesheet matches the exact screen-only scoped contract', () => {
    assert.deepEqual(cssContractErrors(read(CSS)), []);
});

// Per-rule targeted mutations applied to the real sheet's parsed rules.
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

test('representative callers, popup frame and theme defaults keep their anchors', () => {
    for (const file of UNCHANGED) assert.ok(read(file).length > 0, file);
    for (const [file, anchor, expected] of CALLER_ANCHORS) {
        assert.equal(count(read(file), anchor), expected, `${file}: ${anchor}`);
    }
});

module.exports = cases;

if (require.main === module) {
    const { test: nodeTest } = require('node:test');
    for (const [name, fn] of cases) nodeTest(name, fn);
}
