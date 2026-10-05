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

describe('stylelint allows the theme breakpoint notation only in calendar.css, finder.css and encounter-document.css', () => {
    const rcPath = path.join(repo, '.stylelintrc.json');
    const rc = () => JSON.parse(fs.readFileSync(rcPath, 'utf8'));

    test('override is a three-file prefix notation, not a disabled rule', () => {
        expect(rc().overrides).toEqual([{
            files: ['interface/clinical-workspace/calendar.css', 'interface/clinical-workspace/finder.css', 'interface/clinical-workspace/encounter-document.css'],
            rules: { 'media-feature-range-notation': 'prefix' }
        }]);
        expect(rc().rules['media-feature-range-notation']).toBeUndefined();
    });

    test('calendar.css and finder.css lint clean while other files still require context notation', () => {
        // Stylelint loads plugins via dynamic import, which Jest's VM cannot host; run the real CLI.
        // Overrides and extends resolve against --config-basedir, so root both explicitly; this
        // runs the same whether node_modules is local or shared.
        const config = rc();
        config.overrides = config.overrides.map((o) => ({ ...o, files: o.files.map((f) => path.join(repo, f)) }));
        // Repo tmp/ is gitignored; keep scratch config out of the system temp dir.
        fs.mkdirSync(path.join(repo, 'tmp'), { recursive: true });
        const dir = fs.mkdtempSync(path.join(repo, 'tmp', 'stylelint-'));
        const configFile = path.join(dir, 'stylelintrc.json');
        fs.writeFileSync(configFile, JSON.stringify(config));
        const bin = path.join(path.dirname(require.resolve('stylelint/package.json')), 'bin/stylelint.mjs');
        const configBasedir = path.resolve(path.dirname(require.resolve('stylelint-config-standard/package.json')), '../..');
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
            const prefix = '@media (max-width: 768px) {\n  a {\n    color: #fff;\n  }\n}\n';
            const context = '@media (width <= 768px) {\n  a {\n    color: #fff;\n  }\n}\n';
            // The override is not a disable: calendar.css itself rejects context notation...
            expect(lint(stdinAs('calendar.css'), context)).toEqual({ status: 2, rules: ['media-feature-range-notation'] });
            expect(lint(stdinAs('finder.css'), context)).toEqual({ status: 2, rules: ['media-feature-range-notation'] });
            // ...and every other file keeps the repo-wide context notation.
            expect(lint(stdinAs('other.css'), prefix)).toEqual({ status: 2, rules: ['media-feature-range-notation'] });
            expect(lint(stdinAs('other.css'), context)).toEqual({ status: 0, rules: [] });
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});
