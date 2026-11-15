'use strict';

const assert = require('assert');
const path = require('path');
const { spawnSync } = require('child_process');

const contract = path.resolve(__dirname, '../clinical-ui/provider-dashboard-modal-name-contract.cjs');
const expectedNames = [
    'original fixture SHA authentic',
    'active native Tell me more target retained',
    'native translated h4 retained',
    'translated xla root label unique with role tabindex hidden retained',
    'exact single-fragment inverse to ORIGINAL SHA retains all bytes',
    'synthetic minimal candidate passes semantic and preservation predicates',
    'missing label mutant rejected',
    'wrong label mutant rejected',
    'duplicate label mutant rejected',
    'unrelated byte mutant rejected by preservation'
];

describe('provider dashboard modal name source contract', () => {
    test('portable contract reports every exact named case passing', () => {
        assert(path.isAbsolute(contract));
        const result = spawnSync(process.execPath, [contract], {
            encoding: 'utf8',
            timeout: 15000
        });
        assert.strictEqual(result.error, undefined);
        assert.strictEqual(result.signal, null);
        assert.strictEqual(result.status, 0);
        assert.strictEqual(result.stderr, '');
        assert.strictEqual(typeof result.stdout, 'string');
        assert.match(result.stdout, /^[^\r\n]+\n(?![\s\S])/);

        const report = JSON.parse(result.stdout.slice(0, -1));
        assert.strictEqual(result.stdout, JSON.stringify(report) + '\n');
        assert.deepStrictEqual(Object.keys(report).sort(), ['cases', 'failed', 'passed']);
        assert(Array.isArray(report.cases));
        assert.strictEqual(report.cases.length, expectedNames.length);
        assert.deepStrictEqual(report.cases.map((item) => item.name), expectedNames);
        assert.strictEqual(new Set(report.cases.map((item) => item.name)).size, expectedNames.length);
        for (const item of report.cases) {
            assert.deepStrictEqual(Object.keys(item).sort(), ['name', 'ok']);
            assert.strictEqual(item.ok, true);
        }
        assert.strictEqual(report.failed, 0);
        assert.strictEqual(report.passed, expectedNames.length);
    });
});
