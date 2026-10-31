// The source-only contract also runs under plain Node without Jest.
const { EXPECTED_COUNT, runContract } = require('../clinical-ui/message-due-label-contract.cjs');

test('message Due date label contract executes every portable case', () => {
    const results = runContract();
    expect(EXPECTED_COUNT).toBe(17);
    expect(results).toHaveLength(EXPECTED_COUNT);
    expect(new Set(results.map((result) => result.name)).size).toBe(EXPECTED_COUNT);
    expect(results.filter((result) => ['failed', 'skipped', 'todo', 'cancelled'].includes(result.status))).toEqual([]);
    expect(results.every((result) => result.status === 'passed')).toBe(true);
});
