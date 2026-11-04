const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { expectedCases } = require('../clinical-ui/portal-category-eligibility-contract.cjs');

test('native portal save prefix rejects ineligible appointment categories', () => {
    const runner = path.resolve(__dirname, '../clinical-ui/portal-category-eligibility-contract.cjs');
    const result = spawnSync(process.execPath, [runner], { encoding: 'utf8', timeout: 30000 });
    expect(result.error).toBeUndefined();
    const report = JSON.parse(result.stdout);
    expect({ exitCode: result.status, counts: report.counts, failures: report.cases.filter((item) => !item.pass) })
        .toEqual({ exitCode: 0, counts: { total: expectedCases, passed: expectedCases, failed: 0 }, failures: [] });
});
