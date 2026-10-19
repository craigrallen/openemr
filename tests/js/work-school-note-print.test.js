/**
 * Jest wrapper for the portable OPEMR-59 work/school note print source contracts.
 * History checks need the full fork base and run only through node directly; see
 * docs/clinical-ui/WORK-SCHOOL-NOTE-PRINT.md.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

const { portableCases } = require('../source-contracts/work-school-note-print.test.cjs');

describe('work/school note print source contract (portable)', () => {
    for (const { name, run } of portableCases) {
        test(name, run);
    }
});
