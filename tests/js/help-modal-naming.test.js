// The same source-only contract runs under plain Node and hosted Jest.
const { EXPECTED_COUNT, runContract } = require('../clinical-ui/help-modal-naming-contract.cjs');

test('help modal naming contract executes every portable case', () => {
    const results = runContract();
    expect(EXPECTED_COUNT).toBe(16);
    expect(results).toHaveLength(EXPECTED_COUNT);
    expect(results.filter((result) => ['skipped', 'todo', 'cancelled'].includes(result.status))).toEqual([]);
    expect(results.every((result) => result.status === 'passed' || result.status === 'failed')).toBe(true);
    expect(results.filter((result) => result.status === 'failed')).toEqual([]);
});
