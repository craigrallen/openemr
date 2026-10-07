/**
 * @jest-environment jsdom
 */

// Cascade checks for the workbench content column against the real shell
// stylesheet and the theme's generic sidebar `main` rule. These resolve which
// declaration wins by specificity and order; they make no geometry claims.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const process = require('node:process');
const postcss = require('postcss');

const root = path.join(__dirname, '../..');
const shellCss = fs.readFileSync(path.join(root, 'interface/main/tabs/css/workbench_shell.css'), 'utf8');
const sidebarScss = fs.readFileSync(path.join(root, 'interface/themes/oe-common/oe-sidebar.scss'), 'utf8');
const mainPhp = fs.readFileSync(path.join(root, 'interface/main/tabs/main.php'), 'utf8');

// The compiled theme's first (desktop) `main, .main-added` block, taken verbatim from source.
const themeMainBlock = sidebarScss.match(/^\s*main,\s*\n\s*\.main-added\s*\{[^}]*\}/m)[0];
const mainMarkup = mainPhp.match(/<main class="workbench-main" id="workbenchContent">[\s\S]*?<\/main>/)[0]
    .replace(/<\?php[\s\S]*?\?>/g, '');

function topLevelRules(css) {
    const rules = [];
    postcss.parse(css).each((node) => {
        if (node.type === 'rule') {
            rules.push(node);
        }
    });
    return rules;
}

// @csstools/selector-specificity 6 ships ESM only, which Jest's module registry cannot load (its
// createRequire is intercepted too). Score every selector the cascade can meet in one native ESM
// Node process that imports the installed package and its postcss-selector-parser peer.
const ORACLE_SELECTORS = ['main', '#mainBox:not(.workbench-legacy) main', ':where(#mainBox) .workbench-main'];
const specificities = (() => {
    const selectors = [...new Set([
        ...ORACLE_SELECTORS,
        ...[...topLevelRules(themeMainBlock), ...topLevelRules(shellCss)].flatMap((rule) => rule.selectors)
    ])];
    const script = `
        import parser from 'postcss-selector-parser';
        import { selectorSpecificity } from '@csstools/selector-specificity';
        const out = {};
        for (const selector of JSON.parse(process.argv[1])) {
            const s = selectorSpecificity(parser().astSync(selector).first);
            out[selector] = [s.a, s.b, s.c];
        }
        process.stdout.write(JSON.stringify(out));
    `;
    const run = spawnSync(process.execPath, ['--input-type=module', '-e', script, JSON.stringify(selectors)], { cwd: root, encoding: 'utf8' });
    if (run.error || run.status !== 0) {
        throw new Error(`specificity oracle failed (status ${run.status}): ${run.error ?? run.stderr}`);
    }
    return new Map(Object.entries(JSON.parse(run.stdout)));
})();

function specificityOf(selector) {
    if (!specificities.has(selector)) {
        throw new Error(`no specificity computed for ${selector}`);
    }
    return specificities.get(selector);
}

function compare(a, b) {
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
            return a[i] - b[i];
        }
    }
    return 0;
}

const longhandFromMargin = (value) => {
    const parts = value.replace(/!important/, '').trim().split(/\s+/);
    return parts[[0, 0, 1, 1, 3][parts.length]];
};

// Resolve one property for an element (margin-left in LTR, via its shorthands),
// cascading the theme block followed by the top-level rules of the shell sheet.
function cascade(element, property) {
    const rules = [...topLevelRules(themeMainBlock), ...topLevelRules(shellCss)];
    let winner = null;
    rules.forEach((rule, order) => {
        const matching = rule.selectors.filter((sel) => {
            try {
                return element.matches(sel);
            } catch {
                return false;
            }
        });
        if (matching.length === 0) {
            return;
        }
        const spec = matching.map(specificityOf).sort(compare).pop();
        rule.walkDecls((decl) => {
            let value = null;
            if (decl.prop === property || (property === 'margin-left' && decl.prop === 'margin-inline-start')) {
                value = decl.value;
            } else if (property === 'margin-left' && decl.prop === 'margin') {
                value = longhandFromMargin(decl.value);
            }
            if (value === null) {
                return;
            }
            const rank = [decl.important ? 1 : 0, ...spec, order];
            if (winner === null || compare(rank, winner.rank) >= 0) {
                winner = { rank, value: value.trim(), selector: rule.selector };
            }
        });
    });
    return winner;
}

function mount(mainBoxClass) {
    document.body.innerHTML = `<div id="mainBox" class="${mainBoxClass}"><div class="workbench-layout">`
        + `<aside class="workbench-rail"></aside>${mainMarkup}</div></div>`;
    return document.getElementById('workbenchContent');
}

describe('specificity oracle', () => {
    test('the natively loaded scorer ranks ids, classes and types as the cascade needs', () => {
        expect(specificityOf('main')).toEqual([0, 0, 1]);
        expect(specificityOf('#mainBox:not(.workbench-legacy) main')).toEqual([1, 1, 1]);
        expect(specificityOf(':where(#mainBox) .workbench-main')).toEqual([0, 1, 0]);
    });
});

describe('workbench content column offset', () => {
    test('counterexample: theme main rule alone pushes the real <main> 250px right', () => {
        const main = mount('');
        expect(main.matches('main')).toBe(true);
        const rules = topLevelRules(themeMainBlock);
        expect(rules[0].selectors).toContain('main');
        let marginLeft = null;
        rules[0].walkDecls('margin-left', (d) => {
            marginLeft = d.value;
        });
        expect(marginLeft).toBe('15.625rem');
    });

    test('workbench mode resets the inherited margin and width on the real main', () => {
        const main = mount('');
        expect(cascade(main, 'margin-left').value).toBe('0');
        expect(cascade(main, 'width').value).toBe('auto');
    });

    test('legacy mode keeps the theme geometry on main', () => {
        const main = mount('workbench-legacy');
        expect(cascade(main, 'margin-left').value).toBe('15.625rem');
        expect(cascade(main, 'width').value).toBe('calc(100% - 15.625rem)');
    });

    test('static-legacy fallback keeps display: contents and the theme margin', () => {
        const main = mount('workbench-legacy workbench-static-legacy');
        expect(cascade(main, 'display').value).toBe('contents');
        expect(cascade(main, 'margin-left').value).toBe('15.625rem');
    });
});

describe('workbench top chrome spacing', () => {
    const padding = (id) => cascade(document.querySelector(id), 'padding');

    test('identity bar and work-area title are compacted in workbench mode only', () => {
        mount('');
        expect(padding('#attendantData').value).toBe('6px 20px');
        expect(padding('.workbench-content-head').value).toBe('8px 22px 4px');
    });

    test('tab strip and frame padding are unchanged', () => {
        mount('');
        expect(padding('#tabs_div').value).toBe('0 22px');
        expect(padding('#mainFrames_div').value).toBe('10px 18px 0');
    });

    test('identity, title, tabs and frames all remain in the real markup', () => {
        const main = mount('');
        ['#attendantData', '[data-workbench-title]', '#tabs_div', '#mainFrames_div', '#framesDisplay']
            .forEach((sel) => expect(main.querySelector(sel)).not.toBeNull());
    });

    test('legacy modes do not pick up the compact padding', () => {
        mount('workbench-legacy');
        expect(padding('#attendantData')).toBeNull();
        expect(padding('.workbench-content-head')).toBeNull();
    });
});
