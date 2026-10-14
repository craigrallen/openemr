/** @jest-environment jsdom */

// Group Finder popup presentation. The PHP route is read as source text: the
// inline scripts are run in jsdom with their single PHP echo substituted, so
// this exercises the original JavaScript, not the PHP runtime or real layout.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const postcss = require('postcss');

const root = path.join(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const routeFile = 'interface/main/calendar/find_group_popup.php';
const cssFile = 'interface/clinical-workspace/group-finder-popup.css';
const source = () => read(routeFile);
const css = () => read(cssFile);
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const count = (text, part) => text.split(part).length - 1;

const baselineHash = '44c56f579236caa8302c1ffee1fff26880930c64721526c395f3104dd17f5a1f';
const callerHashes = {
    'interface/forms/newpatient/newpatient.js': '5b309a41ecf5aaf52973da5747f6b915eb06152c48f8bf6122ad40154bfd3be3',
    'interface/main/calendar/add_edit_event.js': '16efbb25ac305fc51a82262222ada20dde8d900982d47dc26389ed2f4e038ba2',
};
const scope = 'html.oe-workbench-popup body.oe-group-finder-popup';
const link = '    <?php $clinicalAssets = new ClinicalWorkspaceAssets(); ?>\n'
    + '    <link rel="stylesheet" media="screen" href="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>'
    + '/interface/clinical-workspace/group-finder-popup.css?v=<?php echo attr_url($clinicalAssets->version(\'group-finder-popup.css\')); ?>">';

// Reversible presentation map: [original bytes, presented bytes].
const changes = [
    ['use OpenEMR\\Common\\Csrf\\CsrfUtils;', 'use OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;\nuse OpenEMR\\Common\\Csrf\\CsrfUtils;'],
    ["    <?php Header::setupHeader('opener'); ?>\n", "    <?php Header::setupHeader('opener'); ?>\n" + link + '\n'],
    ['<body class="body_top">', '<body class="body_top oe-group-finder-popup">'],
];

const restore = text => {
    let restored = text;
    for (const [before, after] of changes) {
        if (count(restored, after) !== 1) return null;
        restored = restored.replace(after, before);
    }
    return restored;
};
const restoresOriginal = text => {
    const restored = restore(text);
    return restored !== null && sha(restored) === baselineHash;
};

describe('route bytes', () => {
    test('only the explicit presentation map separates the route from the original', () => {
        const restored = restore(source());
        expect(restored).not.toBeNull();
        expect(sha(restored)).toBe(baselineHash);
    });

    test('original callers are byte-identical', () => {
        for (const [file, hash] of Object.entries(callerHashes)) expect(sha(read(file))).toBe(hash);
    });

    test.each([
        ['CSRF check', 'CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: true);', 'CsrfUtils::checkCsrfInput(INPUT_GET, dieOnFail: true);'],
        ['CSRF token field', 'name="csrf_token_form"', 'name="csrf_token"'],
        ['name search dispatch', "getGroupData(\"$searchparm\", \"*\", 'group_name')", "getGroupData(\"$searchparm\", \"*\", 'group_id')"],
        ['ID search dispatch', "} elseif ($searchby == \"ID\") {", "} elseif ($searchby == \"Id\") {"],
        ['too-many threshold', 'count($result) >= 100', 'count($result) >= 50'],
        ['opener callback', 'opener.setgroup(gid, name, end_date);', 'opener.setgroup(gid, name);'],
        ['closed-opener guard', 'if (opener.closed || !opener.setgroup)', 'if (!opener || opener.closed || !opener.setgroup)'],
        ['selection field order', 'return selgid(parts[0], parts[1], parts[4]);', 'return selgid(parts[0], parts[1], parts[3]);'],
        ['row ID order', 'attr($itergid . "~" . $itername . "~" . $itertype', 'attr($itername . "~" . $itergid . "~" . $itertype'],
        ['ineffective disabled setter', '$("#submitbtn").css("disabled", "true");', '$("#submitbtn").prop("disabled", true);'],
        ['unmatched closing center', '</center>\n</body>', '</body>'],
        ['original inline CSS', 'background-color: #ddddff;', 'background-color: var(--oe-wb-canvas);'],
        ['escaped output', "text($itername)", '$itername'],
    ])('a %s mutation breaks the inverse digest', (_name, original, mutated) => {
        const php = source();
        expect(count(php, original)).toBe(1);
        expect(restoresOriginal(php)).toBe(true);
        expect(restoresOriginal(php.replace(original, mutated))).toBe(false);
    });

    test('a presentation edit outside the map breaks the inverse digest', () => {
        const php = source();
        expect(restoresOriginal(php.replace('<div id="searchCriteria">', '<div id="searchCriteria" class="extra">'))).toBe(false);
        expect(restoresOriginal(php.replace("media=\"screen\" href", 'href'))).toBe(false);
    });

    test('stylesheet is versioned through the fixed asset list and linked screen-only', () => {
        expect(read('src/Common/Assets/ClinicalWorkspaceAssets.php')).toMatch(/^ {8}'global-messages\.css',\n {8}'group-finder-popup\.css',\n {8}'history-document\.css',$/m);
        const php = source();
        expect(count(php, 'group-finder-popup.css')).toBe(2);
        expect(php).not.toContain('workspace.css');
        expect(php).not.toContain('@import');
    });
});

describe('original scripts in jsdom', () => {
    const scripts = () => {
        const found = [...source().matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);
        expect(found).toHaveLength(2);
        const message = 'The destination form was closed; I cannot act on your selection.';
        expect(count(found[0], `<?php echo xlj('${message}'); ?>`)).toBe(1);
        return [found[0].replace(`<?php echo xlj('${message}'); ?>`, JSON.stringify(message)), found[1]];
    };

    const boot = async opener => {
        document.body.className = 'body_top oe-group-finder-popup';
        document.body.innerHTML = `
            <div id="searchCriteria"><form method="post" name="theform" id="theform" action="find_group_popup.php">
                <select name="searchby"><option value="Name">Name</option><option value="ID">ID</option></select>
                <input type="text" id="searchparm" name="searchparm"><input type="submit" id="submitbtn" value="Search">
                <div id="searchspinner"><img alt=""></div>
            </form></div>
            <div id="searchResults"><table id="results_table">
                <tr class="oneresult" id="7~Grief circle~Closed~2026-01-05~2026-12-31"><td class="srName">Grief circle</td></tr>
                <tr class="oneresult" id="9~Open group~Open~2026-02-01~"><td class="srName">Open group</td></tr>
            </table></div>`;
        document.getElementById('searchspinner').style.visibility = 'hidden';
        window.$ = window.jQuery = require('jquery');
        window.opener = opener;
        window.alert = jest.fn();
        window.dlgclose = jest.fn();
        for (const code of scripts()) (0, eval)(code);
        await new Promise(resolve => window.$(resolve));
        await new Promise(resolve => setTimeout(resolve, 0));
    };

    afterEach(() => {
        delete window.opener;
        delete window.SelectGroup;
        delete window.SubmitForm;
    });

    test('ready handler focuses the search field', async () => {
        await boot({ closed: false, setgroup: jest.fn() });
        expect(document.activeElement.id).toBe('searchparm');
    });

    test('row click passes ID, name and end date to the opener then closes', async () => {
        const opener = { closed: false, setgroup: jest.fn() };
        await boot(opener);
        window.$('.oneresult').first().trigger('click');
        expect(opener.setgroup).toHaveBeenCalledWith('7', 'Grief circle', '2026-12-31');
        expect(window.alert).not.toHaveBeenCalled();
        expect(window.dlgclose).toHaveBeenCalledTimes(1);
        window.$('.oneresult').last().trigger('click');
        expect(opener.setgroup).toHaveBeenLastCalledWith('9', 'Open group', '');
    });

    test('a closed opener alerts and still closes', async () => {
        const opener = { closed: true, setgroup: jest.fn() };
        await boot(opener);
        window.SelectGroup(document.querySelector('.oneresult'));
        expect(window.alert).toHaveBeenCalledWith('The destination form was closed; I cannot act on your selection.');
        expect(opener.setgroup).not.toHaveBeenCalled();
        expect(window.dlgclose).toHaveBeenCalledTimes(1);
    });

    test('an opener without setgroup alerts', async () => {
        await boot({ closed: false });
        window.SelectGroup(document.querySelector('.oneresult'));
        expect(window.alert).toHaveBeenCalledTimes(1);
    });

    test('a null opener still throws, as in the original', async () => {
        await boot(null);
        expect(() => window.SelectGroup(document.querySelector('.oneresult'))).toThrow(TypeError);
        expect(window.dlgclose).not.toHaveBeenCalled();
    });

    test('mouse over and out toggle the separate highlight class', async () => {
        await boot({ closed: false, setgroup: jest.fn() });
        const row = window.$('.oneresult').first();
        row.trigger('mouseover');
        expect(row.hasClass('highlight')).toBe(true);
        row.trigger('mouseout');
        expect(row.hasClass('highlight')).toBe(false);
    });

    test('submit shows the spinner; the disabled setter stays ineffective; no request is sent', async () => {
        await boot({ closed: false, setgroup: jest.fn() });
        const submitted = jest.fn(event => event.preventDefault());
        document.getElementById('theform').addEventListener('submit', submitted);
        window.$('#theform').triggerHandler('submit');
        expect(document.getElementById('searchspinner').style.visibility).toBe('visible');
        expect(document.getElementById('submitbtn').disabled).toBe(false);
        expect(document.getElementById('submitbtn').hasAttribute('disabled')).toBe(false);
        expect(submitted).not.toHaveBeenCalled();
        expect(window.SubmitForm(document.getElementById('theform'))).toBe(true);
    });
});

describe('route stylesheet', () => {
    const rulesOf = tree => {
        const list = [];
        tree.walkRules(rule => {
            const decls = {};
            rule.walkDecls(decl => { decls[decl.prop] = decl.value; });
            list.push({ selectors: rule.selectors, decls });
        });
        return list;
    };
    const rules = () => rulesOf(postcss.parse(css()));
    const find = selector => rules().find(rule => rule.selectors.includes(`${scope} ${selector}`))?.decls;

    // A control capped at max-width: 100% must fit its container's content box:
    // border-box sizing keeps padding and border inside the cap, and any
    // horizontal margin would sit outside it.
    const zero = value => /^0(px|em|rem|%)?$/.test(value);
    const boxBudgetViolations = list => {
        const found = [];
        for (const rule of list.filter(item => item.decls['max-width'] === '100%')) {
            const name = rule.selectors.join(',');
            if (rule.decls['box-sizing'] !== 'border-box') found.push(`${name}: box-sizing`);
            const sides = (rule.decls.margin ?? '0').trim().split(/\s+/);
            const right = sides[1] ?? sides[0];
            const horizontal = [right, sides[3] ?? right];
            for (const prop of ['margin-left', 'margin-right', 'margin-inline', 'margin-inline-start', 'margin-inline-end']) {
                if (prop in rule.decls) horizontal.push(rule.decls[prop]);
            }
            if (!horizontal.every(zero)) found.push(`${name}: horizontal margin`);
        }
        return found;
    };

    // Each ring rule must be homogeneous: all selectors end in :focus (the
    // fallback) or all end in :focus-visible. A mixed list would be dropped
    // whole by browsers that cannot parse :focus-visible.
    const focusRings = list => {
        const kind = selector => (selector.endsWith(':focus-visible') ? 'visible' : selector.endsWith(':focus') ? 'fallback' : 'other');
        const ringed = list.filter(rule => 'outline' in rule.decls && rule.selectors.some(selector => kind(selector) !== 'other'));
        const kinds = rule => [...new Set(rule.selectors.map(kind))];
        const mixed = ringed.filter(rule => kinds(rule).length !== 1 || kinds(rule)[0] === 'other');
        return {
            mixed,
            fallback: ringed.filter(rule => !mixed.includes(rule) && kinds(rule)[0] === 'fallback'),
            visible: ringed.filter(rule => !mixed.includes(rule) && kinds(rule)[0] === 'visible'),
        };
    };

    test('every rule is scoped to the active popup and there are no at-rules', () => {
        const tree = postcss.parse(css());
        const atRules = [];
        tree.walkAtRules(rule => atRules.push(rule.name));
        expect(atRules).toEqual([]);
        const all = rules();
        expect(all.length).toBeGreaterThan(10);
        for (const rule of all) for (const selector of rule.selectors) {
            expect(selector === scope || selector.startsWith(`${scope} `)).toBe(true);
        }
    });

    test('no rule declares a font size, so inherited and configured text sizes stay intact', () => {
        const sized = rules().filter(rule => 'font-size' in rule.decls).map(rule => rule.selectors.join(','));
        expect(sized).toEqual([]);
    });

    test('fonts, visibility, scrolling and column widths are left to the original', () => {
        const forbidden = ['font-family', 'font', 'font-size', 'visibility', 'display', 'overflow', 'height', 'max-height', 'width', 'table-layout'];
        for (const rule of rules()) for (const prop of Object.keys(rule.decls)) expect(forbidden).not.toContain(prop);
    });

    test('paper and ink are always declared as a pair', () => {
        for (const rule of rules()) {
            const hasPaper = 'background' in rule.decls || 'background-color' in rule.decls;
            expect([rule.selectors.join(','), hasPaper]).toEqual([rule.selectors.join(','), 'color' in rule.decls]);
        }
    });

    test('search sheet, controls, header and result cells use the workbench palette', () => {
        expect(find('#searchCriteria')).toMatchObject({ color: 'var(--oe-wb-ink)', background: 'var(--oe-wb-canvas)' });
        expect(find('#searchCriteria select')).toMatchObject({ color: 'var(--oe-wb-ink)', background: 'var(--oe-wb-paper)' });
        expect(find('#searchparm')).toMatchObject({ color: 'var(--oe-wb-ink)', background: 'var(--oe-wb-paper)' });
        expect(find('#submitbtn')).toMatchObject({ color: 'var(--oe-wb-on-petrol)', background: 'var(--oe-wb-petrol)' });
        expect(find('#searchResultsHeader')).toMatchObject({ color: 'var(--oe-wb-ink)', background: 'var(--oe-wb-canvas)' });
        expect(find('#searchResults td')).toMatchObject({ color: 'var(--oe-wb-ink)', background: 'var(--oe-wb-paper)' });
        expect(find('#searchResults tr.highlight td')).toMatchObject({ color: 'var(--oe-wb-on-petrol)', background: 'var(--oe-wb-petrol)' });
    });

    test('status states keep separate, distinguishable palettes', () => {
        const states = ['#searchstatus.noResults', '#searchstatus.tooManyResults', '#searchstatus.howManyResults'].map(find);
        for (const state of states) expect(state).toBeDefined();
        expect(states[1]).toMatchObject({ color: 'var(--oe-wb-warning-ink)', background: 'var(--oe-wb-warning-paper)' });
        expect(new Set(states.map(state => `${state.background}|${state['border-left-color'] ?? ''}`)).size).toBe(3);
    });

    test(':focus fallback and :focus-visible are separate, homogeneous rules', () => {
        const { mixed, fallback, visible } = focusRings(rules());
        expect(mixed).toEqual([]);
        expect(fallback).toHaveLength(1);
        expect(visible).toHaveLength(1);
        expect(fallback[0].selectors.every(selector => selector.endsWith(':focus'))).toBe(true);
        expect(visible[0].selectors.every(selector => selector.endsWith(':focus-visible'))).toBe(true);
        for (const rule of [...fallback, ...visible]) {
            expect(rule.decls.outline).toMatch(/solid var\(--oe-wb-petrol\)$/);
            expect(rule.decls['outline-offset']).toBe('2px');
        }
        for (const id of ['#searchparm', '#submitbtn', 'select']) {
            expect(fallback[0].selectors.some(selector => selector.includes(id))).toBe(true);
            expect(visible[0].selectors.some(selector => selector.includes(id))).toBe(true);
        }
        for (const field of ['#searchparm:focus', '#searchCriteria select:focus']) {
            expect(find(field)).toMatchObject({ color: 'var(--oe-wb-ink)', background: 'var(--oe-wb-paper)', 'border-color': 'var(--oe-wb-petrol)' });
        }
        expect(find('#submitbtn:focus')).toMatchObject({ color: 'var(--oe-wb-on-petrol)', background: 'var(--oe-wb-petrol)' });
    });

    test('a combined :focus/:focus-visible rule in the production sheet is rejected', () => {
        const tree = postcss.parse(css());
        const ringRules = [];
        tree.walkRules(rule => { if (rule.some(node => node.prop === 'outline')) ringRules.push(rule); });
        expect(ringRules).toHaveLength(2);
        const [fallbackRule, visibleRule] = ringRules;
        fallbackRule.selectors = [...fallbackRule.selectors, ...visibleRule.selectors];
        visibleRule.remove();
        const { mixed, fallback, visible } = focusRings(rulesOf(tree));
        expect(mixed).toHaveLength(1);
        expect(fallback).toEqual([]);
        expect(visible).toEqual([]);
    });

    test('narrow frames wrap the criteria instead of shrinking or clipping', () => {
        expect(find('#searchCriteria')).toMatchObject({ 'white-space': 'normal', 'overflow-wrap': 'anywhere' });
        for (const control of ['#searchparm', '#searchCriteria select', '#submitbtn']) {
            expect(find(control)).toMatchObject({ 'max-width': '100%' });
            expect(find(control).padding).toBeDefined();
        }
    });

    test('capped controls keep their outer box within the container', () => {
        expect(boxBudgetViolations(rules())).toEqual([]);
        for (const control of ['#searchparm', '#searchCriteria select', '#submitbtn']) {
            expect(find(control)).toMatchObject({ 'box-sizing': 'border-box' });
        }
    });

    test.each([
        ['shorthand horizontal margin', rule => rule.append({ prop: 'margin', value: '0 4px' })],
        ['four-value left margin', rule => rule.append({ prop: 'margin', value: '0 0 0 4px' })],
        ['margin-inline longhand', rule => rule.append({ prop: 'margin-inline', value: '4px' })],
        ['content-box sizing', rule => rule.walkDecls('box-sizing', decl => { decl.value = 'content-box'; })],
    ])('the box budget rejects a %s on the production controls', (_name, mutate) => {
        const tree = postcss.parse(css());
        tree.walkRules(rule => { if (rule.selectors.includes(`${scope} #searchparm`)) mutate(rule); });
        expect(boxBudgetViolations(rulesOf(tree)).length).toBeGreaterThan(0);
    });
});
