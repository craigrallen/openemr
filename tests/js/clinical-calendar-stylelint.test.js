/**
 * @jest-environment node
 */

// Runs stylelint itself, which needs Node's URL handling rather than jsdom's.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const process = require('node:process');

const repo = path.join(__dirname, '../..');
const cssPath = path.join(repo, 'interface/clinical-workspace/calendar.css');
const finderCssPath = path.join(repo, 'interface/clinical-workspace/finder.css');
const soapDocumentCssPath = path.join(repo, 'interface/clinical-workspace/soap-document.css');

describe('stylelint enforces the exact-file prefix breakpoint allowlist', () => {
    const rcPath = path.join(repo, '.stylelintrc.json');
    const rc = () => JSON.parse(fs.readFileSync(rcPath, 'utf8'));

    test('override is the complete exact-file prefix allowlist, not a disabled rule', () => {
        // The full override list is an allowlist: the four workspace sheets, vitals.css and three popup sheets.
        expect(rc().overrides).toEqual([{
            files: ['interface/clinical-workspace/calendar.css', 'interface/clinical-workspace/finder.css', 'interface/clinical-workspace/soap-document.css', 'interface/clinical-workspace/encounter-document.css'],
            rules: { 'media-feature-range-notation': 'prefix' }
        }, {
            files: ['interface/forms/vitals/vitals.css'],
            rules: { 'media-feature-range-notation': 'prefix' }
        }, {
            files: ['interface/clinical-workspace/patient-picker-popup.css', 'interface/clinical-workspace/patient-results-popup.css', 'interface/clinical-workspace/issue-popup.css'],
            rules: { 'media-feature-range-notation': 'prefix' }
        }, {
            files: ['interface/clinical-workspace/patient-search.css'],
            rules: { 'media-feature-range-notation': 'prefix' }
        }]);
        expect(rc().rules['media-feature-range-notation']).toBeUndefined();
    });

    test('authorized CSS lints clean and CLI guards reject the wrong notation on either side', () => {
        // Stylelint loads plugins via dynamic import, which Jest's VM cannot host; run the real CLI.
        // Overrides and extends resolve against --config-basedir, so root both explicitly; this
        // runs the same whether node_modules is local or shared.
        const config = rc();
        config.overrides = config.overrides.map((o) => ({ ...o, files: o.files.map((f) => path.join(repo, f)) }));
        // Resolve the CLI before creating scratch files so a resolution failure leaves nothing behind.
        const bin = path.join(path.dirname(require.resolve('stylelint/package.json')), 'bin/stylelint.mjs');
        // stylelint-config-standard 40 is ESM and exports only its entry (no ./package.json), so locate
        // the installed package from that entry and confirm it before rooting --config-basedir there.
        const configStandardDir = path.dirname(require.resolve('stylelint-config-standard'));
        expect(JSON.parse(fs.readFileSync(path.join(configStandardDir, 'package.json'), 'utf8')).name).toBe('stylelint-config-standard');
        const configBasedir = path.resolve(configStandardDir, '../..');
        // Repo tmp/ is gitignored; keep scratch config out of the system temp dir.
        fs.mkdirSync(path.join(repo, 'tmp'), { recursive: true });
        const dir = fs.mkdtempSync(path.join(repo, 'tmp', 'stylelint-'));
        const configFile = path.join(dir, 'stylelintrc.json');
        fs.writeFileSync(configFile, JSON.stringify(config));
        // The CLI writes the json report to stderr and exits 0 when clean, 2 on lint errors.
        const lint = (args, input) => {
            const run = spawnSync(process.execPath, [bin, '--config', configFile, '--config-basedir', configBasedir, '--formatter', 'json', ...args], { input, encoding: 'utf8' });
            expect(run.error).toBeUndefined();
            expect(run.stdout).toBe('');
            const report = JSON.parse(run.stderr);
            expect(report.flatMap((r) => [...r.parseErrors, ...r.invalidOptionWarnings])).toEqual([]);
            return { status: run.status, rules: report.flatMap((r) => r.warnings.map((w) => w.rule)) };
        };
        const stdinAs = (name) => ['--stdin-filename', path.join(repo, 'interface/clinical-workspace', name)];
        try {
            expect(lint([cssPath])).toEqual({ status: 0, rules: [] });
            expect(lint([finderCssPath])).toEqual({ status: 0, rules: [] });
            expect(lint([soapDocumentCssPath])).toEqual({ status: 0, rules: [] });
            for (const name of ['patient-picker-popup.css', 'patient-results-popup.css', 'issue-popup.css']) {
                expect(lint([path.join(repo, 'interface/clinical-workspace', name)])).toEqual({ status: 0, rules: [] });
            }
            const prefix = '@media (max-width: 768px) {\n  a {\n    color: #fff;\n  }\n}\n';
            const context = '@media (width <= 768px) {\n  a {\n    color: #fff;\n  }\n}\n';
            // The override is not a disable: calendar.css itself rejects context notation...
            expect(lint(stdinAs('calendar.css'), context)).toEqual({ status: 2, rules: ['media-feature-range-notation'] });
            expect(lint(stdinAs('finder.css'), context)).toEqual({ status: 2, rules: ['media-feature-range-notation'] });
            expect(lint(stdinAs('soap-document.css'), context)).toEqual({ status: 2, rules: ['media-feature-range-notation'] });
            expect(lint(stdinAs('soap-document.css'), prefix)).toEqual({ status: 0, rules: [] });
            // The sibling reference stylesheet is not covered by the override.
            expect(lint(stdinAs('soap-reference.css'), prefix)).toEqual({ status: 2, rules: ['media-feature-range-notation'] });
            // ...and every other file keeps the repo-wide context notation.
            expect(lint(stdinAs('other.css'), prefix)).toEqual({ status: 2, rules: ['media-feature-range-notation'] });
            expect(lint(stdinAs('other.css'), context)).toEqual({ status: 0, rules: [] });
            for (const name of ['patient-picker-popup.css', 'patient-results-popup.css', 'issue-popup.css']) {
                expect(lint(stdinAs(name), prefix)).toEqual({ status: 0, rules: [] });
                expect(lint(stdinAs(name), context)).toEqual({ status: 2, rules: ['media-feature-range-notation'] });
            }
            // Patient search: the shipped sheet lints clean, its exact name takes prefix only,
            // and neither a near-miss name nor a sibling directory inherits the override.
            expect(lint([path.join(repo, 'interface/clinical-workspace/patient-search.css')])).toEqual({ status: 0, rules: [] });
            expect(lint(stdinAs('patient-search.css'), prefix)).toEqual({ status: 0, rules: [] });
            expect(lint(stdinAs('patient-search.css'), context)).toEqual({ status: 2, rules: ['media-feature-range-notation'] });
            expect(lint(stdinAs('patient-search-copy.css'), prefix)).toEqual({ status: 2, rules: ['media-feature-range-notation'] });
            expect(lint(['--stdin-filename', path.join(repo, 'interface/main/calendar/patient-search.css')], prefix)).toEqual({ status: 2, rules: ['media-feature-range-notation'] });
            expect(lint(stdinAs('patient-picker-popup-copy.css'), prefix)).toEqual({ status: 2, rules: ['media-feature-range-notation'] });
            expect(lint(stdinAs('patient-picker-popup-copy.css'), context)).toEqual({ status: 0, rules: [] });
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});
