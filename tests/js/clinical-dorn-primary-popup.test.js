/**
 * OPEMR-50 Jest wrapper for the portable DORN primary config edit popup source contract.
 *
 * Runs tests/fixtures/clinical-workspace/dorn-primary-popup.contract.cjs
 * check by check. History checks (exact base SHA, restored-route and
 * unchanged-file comparisons, change scope) run only when
 * OPEMR50_DORN_HISTORY=1; once opted in they fail rather than skip if Git or
 * the base commit is missing.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen <craig@interconnected.au>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

const path = require('node:path');

const contract = require(path.join(__dirname, '..', 'fixtures', 'clinical-workspace', 'dorn-primary-popup.contract.cjs'));

describe('OPEMR-50 DORN primary config edit popup source contract (portable)', () => {
    test.each(contract.portableChecks())('%s', (label, check) => {
        expect(check).not.toThrow();
    });
});

const historyEnabled = contract.historyRequested([], process.env);

(historyEnabled ? describe : describe.skip)('OPEMR-50 DORN primary config edit popup source contract (history)', () => {
    test.each(contract.historyChecks())('%s', (label, check) => {
        expect(check).not.toThrow();
    });
});
