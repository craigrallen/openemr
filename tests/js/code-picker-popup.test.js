// Jest wrapper for the portable Code Finder popup source contracts (shallow-clone safe).
const cases = require('../clinical-ui/code-picker.test.cjs');

for (const [name, fn] of cases) test(name, fn);
