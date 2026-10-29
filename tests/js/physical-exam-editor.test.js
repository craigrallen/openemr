/* global __dirname, expect, test */
'use strict';

const path = require('node:path');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const { JSDOM } = require('jsdom');

test('physical exam portable source contract passes completely', () => {
    const root = path.resolve(__dirname, '../..');
    const child = spawnSync(process.execPath,
        ['--test-reporter=tap', path.join(root, 'tests/clinical-ui/physical-exam-editor-contract.cjs')],
        { cwd: root, encoding: 'utf8', timeout: 30000 });
    const output = `${child.stdout || ''}\n${child.stderr || ''}`;
    const expected = 10;
    const plans = [...output.matchAll(/^1\.\.(\d+)$/gm)];
    const counts = [...output.matchAll(/^# tests (\d+)$/gm)];
    const passed = [...output.matchAll(/^# pass (\d+)$/gm)];
    const failed = [...output.matchAll(/^# fail (\d+)$/gm)];
    const skipped = [...output.matchAll(/^# skipped (\d+)$/gm)];
    const todo = [...output.matchAll(/^# todo (\d+)$/gm)];
    const enumerated = [...output.matchAll(/^(not ok|ok) (\d+) - .+$/gm)];
    const valid = !child.error && child.status === 0 && /^TAP version 13$/m.test(output)
        && plans.length === 1 && Number(plans[0][1]) === expected
        && counts.length === 1 && Number(counts[0][1]) === expected
        && passed.length === 1 && Number(passed[0][1]) === expected
        && failed.length === 1 && Number(failed[0][1]) === 0
        && skipped.every((match) => Number(match[1]) === 0)
        && todo.every((match) => Number(match[1]) === 0)
        && enumerated.length === expected
        && enumerated.every((match, index) => match[1] === 'ok' && Number(match[2]) === index + 1);
    if (!valid) throw new Error(`Physical exam source contract failed (exit ${child.status}):\n${output}`);
});

test('source-derived native DOM is reached by every table, column, control and focus selector', () => {
    const root = path.resolve(__dirname, '../..');
    const source = fs.readFileSync(path.join(root, 'interface/forms/physical_exam/new.php'), 'utf8');
    const original = fs.readFileSync(path.join(root, 'tests/clinical-ui/fixtures/physical-exam-new-original.php.txt'), 'utf8');
    const phpEnd = source.indexOf('?>');
    expect(phpEnd).toBeGreaterThan(-1);
    let markup = source.slice(phpEnd + 2);
    expect(markup.trimStart().startsWith('<html>')).toBe(true);
    expect(markup).not.toMatch(/<!doctype/i);

    // These are the original PHP heredoc rows, interpolated with inert sample values.
    const rowFrom = (name) => {
        const match = original.match(new RegExp(`\\$${name} = function[\\s\\S]*?return <<<HTML\\n([\\s\\S]*?)\\n        HTML;`));
        expect(match).not.toBeNull();
        const values = {
            id: name === 'showExamLine' ? 'exam' : 'treatment', idJs: '1',
            wnlChecked: '', abnChecked: '', systemCell: 'System',
            descriptionCell: 'Description', commentsValue: '',
            options: "<option value=''></option><option value='*'>-- Edit --</option>"
        };
        const row = match[1].replace(/\{\$(\w+)\}/g, (token, key) => {
            expect(values).toHaveProperty(key);
            return values[key];
        });
        expect(row).not.toMatch(/\{\$\w+\}/);
        return row;
    };
    const heading = original.match(/<tr><td colspan='6'>&nbsp;<br \/><b>\{\$treatmentHeading\}<\/b><\/td><\/tr>/);
    expect(heading).not.toBeNull();
    const dynamicRows = [rowFrom('showExamLine'), heading[0].replace('{$treatmentHeading}', 'Treatment:'), rowFrom('showTreatmentLine')].join('\n');
    const loop = /<\?php\s*foreach \(physical_exam_lines\(\) as \$system\) \{[\s\S]*?\n\?>/;
    expect(markup.match(loop)).not.toBeNull();
    markup = markup.replace(loop, dynamicRows).replace(/<\?php[\s\S]*?\?>/g, '');
    expect(markup).not.toMatch(/<\?php|\{\$\w+\}/);

    // The workbench supplies this html class around the route; no PHP or script runs here.
    const dom = new JSDOM(markup);
    const { document } = dom.window;
    document.documentElement.classList.add('oe-workbench-context');
    expect(document.compatMode).toBe('BackCompat');
    const table = document.querySelector('center table');
    expect(table).not.toBeNull();
    expect(table.parentElement.tagName).toBe('P');
    expect(document.querySelectorAll('center > table')).toHaveLength(0);
    expect(document.querySelectorAll('center table')).toHaveLength(1);

    const media = [...document.styleSheets[0].cssRules].find((rule) => rule.media?.mediaText === 'screen');
    expect(media).toBeDefined();
    // Split CSS selector lists without splitting the comma in Cancel's onclick attribute.
    const splitSelectors = (list) => {
        const result = [];
        let start = 0;
        let quote = null;
        let brackets = 0;
        for (let i = 0; i < list.length; i++) {
            const char = list[i];
            if (quote) {
                if (char === '\\') i++;
                else if (char === quote) quote = null;
            } else if (char === "'" || char === '"') quote = char;
            else if (char === '[') brackets++;
            else if (char === ']') brackets--;
            else if (char === ',' && brackets === 0) {
                result.push(list.slice(start, i).trim());
                start = i + 1;
            }
        }
        result.push(list.slice(start).trim());
        return result;
    };
    const selectors = [...media.cssRules].flatMap((rule) => splitSelectors(rule.selectorText));
    const relevant = selectors.filter((selector) => selector.includes(' table')
        || selector.includes("[name='bn_save']") || selector.includes('parent.closeTab('));
    expect(relevant.length).toBeGreaterThan(20);
    const save = document.querySelector("input[name='bn_save']");
    const cancel = document.querySelector("input[onclick='parent.closeTab(window.name, false)']");
    const diagnosis = table.querySelector("select[name$='[diagnosis]']");
    const comments = table.querySelector("input[name='form_obs[exam][comments]']");
    const treatmentComments = table.querySelector("input[name='form_obs[treatment][comments]']");
    const checkbox = table.querySelector("input[type='checkbox']");
    for (const element of [save, cancel, diagnosis, comments, treatmentComments, checkbox]) expect(element).not.toBeNull();
    const reached = new Set();
    for (const selector of relevant) {
        if (selector.endsWith(':hover')) continue;
        const focus = /:focus(?:-visible)?$/.test(selector);
        const base = focus ? selector.replace(/:focus(?:-visible)?$/, '') : selector;
        const targets = [...document.querySelectorAll(base)];
        expect(targets.length).toBeGreaterThan(0);
        for (const target of targets) {
            reached.add(target);
            if (selector.includes(' table')) expect(target === table || table.contains(target)).toBe(true);
            else expect([save, cancel]).toContain(target);
        }
        if (focus) {
            targets[0].focus();
            expect(targets[0].matches(selector)).toBe(true);
        } else {
            expect(document.querySelectorAll(selector).length).toBe(targets.length);
        }
    }
    for (const element of [table, ...table.querySelectorAll('tr:first-child td'), diagnosis, comments,
        treatmentComments, checkbox, save, cancel]) expect(reached.has(element)).toBe(true);
});
