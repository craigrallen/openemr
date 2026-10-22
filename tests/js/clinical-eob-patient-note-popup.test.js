/**
 * OPEMR-52 Jest wrapper for the portable EOB patient-note popup source contract.
 *
 * Runs tests/fixtures/clinical-workspace/eob-patient-note-popup.contract.cjs
 * under `node --test` in a child process (process.execPath), with the history
 * opt-in variable removed so this wrapper never needs Git history. History mode
 * is run separately: OPEMR52_EOB_NOTE_HISTORY=1 node --test <contract>.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen <craig@interconnected.au>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

const { execFileSync } = require('node:child_process');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const CONTRACT = path.join(ROOT, 'tests', 'fixtures', 'clinical-workspace', 'eob-patient-note-popup.contract.cjs');

describe('OPEMR-52 EOB patient-note popup source contract (portable)', () => {
    test('node --test contract passes', () => {
        const env = { ...process.env };
        delete env.OPEMR52_EOB_NOTE_HISTORY;
        delete env.NODE_TEST_CONTEXT;
        let output = '';
        try {
            output = execFileSync(process.execPath, ['--test', CONTRACT], {
                cwd: ROOT,
                env,
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'pipe'],
            });
        } catch (error) {
            throw new Error('portable contract failed:\n' + (error.stdout || '') + (error.stderr || ''));
        }
        // TAP ("# fail 0") or spec ("ℹ fail 0") summary, depending on Node's default reporter.
        expect(output).toMatch(/\bfail 0\b/);
    }, 120000);
});
