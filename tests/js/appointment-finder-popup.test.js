/** @jest-environment node */

// Jest wrapper: spawns only the portable Appointment Finder popup source contracts
// (shallow-clone safe) under `node --test`. The local-history suite is not run here.
const { spawnSync } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '../..');
const suite = path.join(root, 'tests/clinical-ui/appointment-finder.cjs');

test('portable Appointment Finder popup source contracts pass under node --test', () => {
    const result = spawnSync(process.execPath, ['--test', suite], { cwd: root, encoding: 'utf8' });
    if (result.status !== 0) {
        throw new Error(`node --test exited ${result.status}\n${result.stdout}\n${result.stderr}`);
    }
    expect(result.status).toBe(0);
}, 60000);
