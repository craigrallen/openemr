const { runContract } = require('../clinical-ui/registration-modal-names-contract.cjs');

const cases = runContract();

if (!Array.isArray(cases) || cases.length === 0) {
    throw new Error('Contract returned no cases');
}
const names = new Set();
for (const item of cases) {
    if (!item || typeof item.name !== 'string' || !item.name || typeof item.passed !== 'boolean' || typeof item.details !== 'string') {
        throw new Error('Contract returned an invalid case');
    }
    if (names.has(item.name)) throw new Error('Contract returned a duplicate case name: ' + item.name);
    names.add(item.name);
}

test.each(cases)('$name', ({ passed, details }) => {
    expect(passed).toBe(true);
    if (!passed) throw new Error(details);
});
