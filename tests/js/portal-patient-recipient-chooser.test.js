/**
 * Hosted Jest adapter for the standalone native PHP recipient contract.
 * The fixture runs each branch in a separate PHP process because IS_DASHBOARD
 * is a constant. It extracts the function from the route without bootstrapping it.
 */

const path = require('path');
const { spawnSync } = require('child_process');

const fixture = path.resolve(__dirname, '../clinical-ui/portal-patient-recipient-chooser-contract.php.fixture');

function runContract(mode, expectedAssertions) {
    const run = spawnSync('php', [fixture, mode], { encoding: 'utf8', timeout: 10000 });
    if (run.error) {
        throw run.error;
    }

    let report;
    try {
        report = JSON.parse(run.stdout);
    } catch (error) {
        throw new Error(`${mode} contract emitted malformed JSON: ${run.stdout}\n${run.stderr}`, { cause: error });
    }

    if (report === null || Array.isArray(report) || typeof report !== 'object'
        || report.mode !== mode || !Number.isInteger(report.passed)
        || !Number.isInteger(report.failed) || !Array.isArray(report.failures)
        || !report.failures.every(failure => typeof failure === 'string')
        || report.failed !== report.failures.length
        || report.passed + report.failed !== expectedAssertions) {
        throw new Error(`${mode} contract emitted an invalid report: ${run.stdout}\n${run.stderr}`);
    }

    if (run.status !== 0 || report.failed !== 0) {
        throw new Error(`${mode} contract failed (exit ${run.status}): ${report.failures.join('; ')}\n${run.stderr}`);
    }

    return report;
}

describe('getAuthPortalUsers native route contract', () => {
    test('patient chooser contains only eligible staff and has no user 1 fallback', () => {
        expect(runContract('patient', 9).passed).toBe(9);
    });

    test('dashboard preserves eligible staff, patient rows, and its fallback', () => {
        expect(runContract('dashboard', 8).passed).toBe(8);
    });
});
