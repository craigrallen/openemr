/**
 * @jest-environment node
 */

// Runs stylelint itself, which needs Node's URL handling rather than jsdom's.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const process = require('node:process');

const repo = path.join(__dirname, '../..');
const vitalsCss = 'interface/forms/vitals/vitals.css';

describe('stylelint allows the old-browser prefix breakpoint only in vitals.css', () => {
    const rc = () => JSON.parse(fs.readFileSync(path.join(repo, '.stylelintrc.json'), 'utf8'));

    test('override is an exact-file prefix notation, not a disabled rule', () => {
        const overrides = rc().overrides.filter((o) => o.files.includes(vitalsCss));
        expect(overrides).toEqual([{ files: [vitalsCss], rules: { 'media-feature-range-notation': 'prefix' } }]);
        expect(rc().rules['media-feature-range-notation']).toBeUndefined();
    });

    test('appended workbench CSS lints clean as vitals.css while other files still require context notation', () => {
        // Same CLI harness as clinical-calendar-stylelint.test.js: Jest's VM cannot host stylelint's
        // dynamic plugin imports, and overrides resolve against absolute paths. vitals.css is matched by
        // the inherited .stylelintignore, which also silences stdin under that filename, so the run points
        // --ignore-path at an empty test-local file. Only the appended workbench block is piped through
        // stdin under the real path; the legacy CSS above it stays out of scope.
        const source = fs.readFileSync(path.join(repo, vitalsCss), 'utf8');
        const marker = source.indexOf('/* Workbench document presentation');
        expect(marker).toBeGreaterThan(-1);
        const appendedCss = source.slice(marker);
        expect(appendedCss).toContain('@media screen and (min-width: 1200px)');
        const config = rc();
        config.overrides = config.overrides.map((o) => ({ ...o, files: o.files.map((f) => path.join(repo, f)) }));
        fs.mkdirSync(path.join(repo, 'tmp'), { recursive: true });
        const dir = fs.mkdtempSync(path.join(repo, 'tmp', 'stylelint-'));
        const configFile = path.join(dir, 'stylelintrc.json');
        fs.writeFileSync(configFile, JSON.stringify(config));
        const ignoreFile = path.join(dir, 'stylelintignore');
        fs.writeFileSync(ignoreFile, '');
        const bin = path.join(path.dirname(require.resolve('stylelint/package.json')), 'bin/stylelint.mjs');
        const configBasedir = path.resolve(path.dirname(require.resolve('stylelint-config-standard/package.json')), '../..');
        const lint = (args, input) => {
            const run = spawnSync(process.execPath, [bin, '--config', configFile, '--ignore-path', ignoreFile, '--config-basedir', configBasedir, '--formatter', 'json', ...args], { input, encoding: 'utf8' });
            expect(run.error).toBeUndefined();
            const report = JSON.parse(run.stderr);
            expect(report.flatMap((r) => [...r.parseErrors, ...r.invalidOptionWarnings])).toEqual([]);
            return { status: run.status, rules: report.flatMap((r) => r.warnings.map((w) => w.rule)) };
        };
        const stdinAs = (file) => ['--stdin', '--stdin-filename', path.join(repo, file)];
        const prefix = '@media screen and (min-width: 1200px) {\n  a {\n    color: #fff;\n  }\n}\n';
        const context = '@media screen and (width >= 1200px) {\n  a {\n    color: #fff;\n  }\n}\n';
        try {
            expect(lint(stdinAs(vitalsCss), appendedCss)).toEqual({ status: 0, rules: [] });
            expect(lint(stdinAs(vitalsCss), prefix)).toEqual({ status: 0, rules: [] });
            expect(lint(stdinAs(vitalsCss), context)).toEqual({ status: 2, rules: ['media-feature-range-notation'] });
            expect(lint(stdinAs('interface/forms/vitals/other.css'), prefix)).toEqual({ status: 2, rules: ['media-feature-range-notation'] });
            expect(lint(stdinAs('interface/forms/vitals/other.css'), context)).toEqual({ status: 0, rules: [] });
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});
