/**
 * Runs the dependency-free OPEMR-47 shot record source contract under Jest so
 * hosted JS CI records its result. The contract itself is plain `node --test`.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen <craig@interconnected.au>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

const path = require('node:path');
const { spawnSync } = require('node:child_process');

const CONTRACT = path.resolve(__dirname, '../../fixtures/clinical-workspace/shot-record-popup.contract.cjs');

describe('shot record popup source contract', () => {
    test('node --test contract passes', () => {
        const env = { ...process.env };
        delete env.NODE_TEST_CONTEXT;
        const result = spawnSync(process.execPath, ['--test', CONTRACT], { encoding: 'utf8', env });
        if (result.status !== 0) {
            throw new Error(`contract exited ${result.status}\n${result.stdout}\n${result.stderr}`);
        }
        expect(result.status).toBe(0);
    });
});
