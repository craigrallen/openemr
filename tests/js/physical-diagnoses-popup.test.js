/** @jest-environment node */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const postcss = require('postcss');
const { JSDOM } = require('jsdom');

const root = path.join(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const ROUTE = 'interface/forms/physical_exam/edit_diagnoses.php';
const LAUNCHER = 'interface/forms/physical_exam/new.php';
const SHEET = 'interface/clinical-workspace/physical-diagnoses-popup.css';
const css = () => read(SHEET);
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const count = (text, part) => text.split(part).length - 1;

// sha256 of each file at origin/master 18647270, before the workbench presentation edits.
const baseline = {
    [ROUTE]: '48442d95d04d295a1e7c752198962b00b321873aba306423bd7cb6a4e27da6ac',
    [LAUNCHER]: 'fbfe165981c443276aa99483f6ea4d72c8f11fabf669a4fe78d9a4ef1adc9fc6',
};

const link = "<?php $clinicalAssets = new ClinicalWorkspaceAssets(); ?>\n"
    + '<link rel="stylesheet" media="screen" href="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>'
    + "/interface/clinical-workspace/physical-diagnoses-popup.css?v=<?php echo attr_url($clinicalAssets->version('physical-diagnoses-popup.css')); ?>\">\n";

// Every edit is [original, presented]: two use lines, one versioned link and classes on existing elements.
const changes = [
    ['use OpenEMR\\Common\\Acl\\AclMain;\nuse OpenEMR\\Common\\Csrf\\CsrfUtils;',
        'use OpenEMR\\Common\\Acl\\AclMain;\nuse OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;\nuse OpenEMR\\Common\\Csrf\\CsrfUtils;'],
    ['use OpenEMR\\Core\\Header;\nuse OpenEMR\\Forms\\PhysicalExam\\DiagnosisHelper;',
        'use OpenEMR\\Core\\Header;\nuse OpenEMR\\Core\\OEGlobalsBag;\nuse OpenEMR\\Forms\\PhysicalExam\\DiagnosisHelper;'],
    ["<?php Header::setupHeader('opener'); ?>\n", `<?php Header::setupHeader('opener'); ?>\n${link}`],
    ['<body class="body_top">', '<body class="body_top oe-physical-diagnoses">'],
    ["<form method='post' name='theform' action=", "<form method='post' name='theform' class='oe-physical-diagnoses-form' action="],
    ["<center>\n\n<table border='0' width='100%'>\n\n <tr>\n  <td width='5%'>",
        "<center class='oe-physical-diagnoses-sheet'>\n\n<table border='0' width='100%' class='oe-physical-diagnoses-table'>\n\n <tr class='oe-physical-diagnoses-head'>\n  <td width='5%'>"],
    ["<p>\n<input type='submit' name='form_save'", "<p class='oe-physical-diagnoses-actions'>\n<input type='submit' name='form_save'"],
];

// Undo the presentation edits; returns null when any edit is missing or ambiguous.
const restore = text => {
    let restored = text;
    for (const [before, after] of changes) {
        if (count(restored, after) !== 1) return null;
        restored = restored.replace(after, () => before);
    }
    return restored;
};

describe('route source: every untouched business byte is the origin/master route', () => {
    test('only the declared asset and class edits restore the exact 135-line original', () => {
        const php = read(ROUTE);
        for (const [, after] of changes) expect(count(php, after)).toBe(1);
        const restored = restore(php);
        expect(restored.split('\n').length - 1).toBe(135);
        expect(sha(restored)).toBe(baseline[ROUTE]);
    });

    test('the launcher keeps its exact dlgopen 500x400 call and is otherwise untouched', () => {
        const launcher = read(LAUNCHER);
        expect(sha(launcher)).toBe(baseline[LAUNCHER]);
        expect(count(launcher, "dlgopen('../../forms/physical_exam/edit_diagnoses.php?lineid=' + encodeURIComponent(line_id), '_blank', 500, 400);")).toBe(1);
    });

    test('negative controls: POST, session, CSRF, ACL, line id, save, SQL, rows, inputs and callbacks cannot change unnoticed', () => {
        const php = read(ROUTE);
        const mutations = [
            ["if ($_POST['form_save']) {", "if (!empty($_POST['form_save'])) {"],
            ['CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: true);', ''],
            ['CsrfUtils::collectCsrfToken(session: $session)', 'CsrfUtils::collectCsrfToken()'],
            ['$session = SessionWrapperFactory::getInstance()->getActiveSession();', '$session = null;'],
            ["onsubmit='return top.restoreSession()'", "onsubmit='return true'"],
            ["AclMain::aclCheckCore('patients', 'med', '', 'write')", "AclMain::aclCheckCore('patients', 'med')"],
            ["DiagnosisHelper::normalizeLineId($_REQUEST['lineid'] ?? null)", "DiagnosisHelper::normalizeLineId($_GET['lineid'] ?? null)"],
            ['http_response_code(400);', ''],
            ['is_array($form_orderings) ? $form_orderings : []', '[]'],
            ['ORDER BY ordering, diagnosis', 'ORDER BY diagnosis, ordering'],
            ['count($existingDiagnosisRows) + 5', 'count($existingDiagnosisRows) + 4'],
            ["['ordering' => null, 'diagnosis' => '']", "['ordering' => 0, 'diagnosis' => '']"],
            ["maxlength='5'", "maxlength='6'"],
            ["maxlength='250'", "maxlength='255'"],
            ["name='form_ordering[<?php echo $i; ?>]'", "name='form_order[<?php echo $i; ?>]'"],
            ["name='form_diagnosis[<?php echo $i; ?>]'", "name='form_diagnosis[]'"],
            ["value='<?php echo attr($diagnosis); ?>'", "value='<?php echo text($diagnosis); ?>'"],
            ["value='<?php echo attr($ordering); ?>'", "value='<?php echo $ordering; ?>'"],
            ["style='width:100%'", "style='width:90%'"],
            ["type='submit' name='form_save'", "type='button' name='form_save'"],
            ["value='<?php echo xla('Save'); ?>'", "value='<?php echo xla('Save Diagnoses'); ?>'"],
            ["onclick='window.close()'", "onclick='dlgclose()'"],
            ['echo " window.close();\\n";', ''],
            ['echo " if (opener.refreshme) opener.refreshme();\\n";', 'echo " opener.location.reload();\\n";'],
            ['action=\'edit_diagnoses.php?lineid=<?php echo attr_url($line_id); ?>\'', 'action=\'edit_diagnoses.php?lineid=<?php echo attr($line_id); ?>\''],
            ["<?php Header::setupHeader('opener'); ?>", '<?php Header::setupHeader(); ?>'],
            ["<td><input type='text' size='3'", "<td class='oe-extra'><input type='text' size='3'"],
            ['&nbsp;\n', ''],
        ];
        for (const [from, to] of mutations) {
            expect([from, count(php, from)]).toEqual([from, 1]);
            const restored = restore(php.replace(from, () => to));
            expect([from, restored === null ? null : sha(restored)]).not.toEqual([from, baseline[ROUTE]]);
        }
    });

    test('the sheet is linked once, screen only, after the Header assets and versioned by the helper', () => {
        const php = read(ROUTE);
        expect(count(php, 'physical-diagnoses-popup.css')).toBe(2);
        expect(count(php, link)).toBe(1);
        expect(php).not.toMatch(/physical-diagnoses-popup\.css\?v=(?!<\?php echo attr_url\(\$clinicalAssets)/);
        // The shared workspace sheet changes inherited typography and print; Header already supplies popup.css.
        expect(php).not.toMatch(/clinical-workspace\/(workspace|popup)\.(css|js)/);
        expect(php.indexOf('physical-diagnoses-popup.css')).toBeGreaterThan(php.indexOf("Header::setupHeader('opener')"));
        expect(php.indexOf('physical-diagnoses-popup.css')).toBeLessThan(php.indexOf('</head>'));
        expect(php.match(/<body[ >]/g)).toHaveLength(1);
    });

    test('document shell, form, table, head row and actions carry their classes on the original elements', () => {
        const php = read(ROUTE);
        for (const part of [
            '<body class="body_top oe-physical-diagnoses">',
            "class='oe-physical-diagnoses-form'",
            "<center class='oe-physical-diagnoses-sheet'>",
            "class='oe-physical-diagnoses-table'",
            "<tr class='oe-physical-diagnoses-head'>",
            "<p class='oe-physical-diagnoses-actions'>",
        ]) expect([part, count(php, part)]).toEqual([part, 1]);
    });
});

test('the asset helper allowlists exactly the new fixed basename in sorted position', () => {
    const helper = read('src/Common/Assets/ClinicalWorkspaceAssets.php');
    expect(helper).toMatch(/\n {8}'patient-search\.css',\n {8}'physical-diagnoses-popup\.css',\n {8}'soap-document\.css',\n/);
    expect(count(helper, 'physical-diagnoses')).toBe(1);
});

const scope = 'html.oe-workbench-popup body.oe-physical-diagnoses';
const rules = () => {
    const out = [];
    postcss.parse(css()).walkRules(rule => {
        const decls = {};
        rule.walkDecls(d => { decls[d.prop] = `${d.value}${d.important ? ' !important' : ''}`; });
        out.push({ selectors: rule.selectors, decls });
    });
    return out;
};
// Every rule listing the selector, merged in source order (later declarations win, as in the cascade).
const declsFor = selector => {
    const matching = rules().filter(r => r.selectors.includes(selector));
    expect([selector, matching.length > 0]).toEqual([selector, true]);
    return Object.assign({}, ...matching.map(r => r.decls));
};
const at = part => `${scope} ${part}`;

describe('route sheet', () => {
    test('is one screen block, positively scoped to the shared popup marker and the route body', () => {
        const tree = postcss.parse(css());
        const top = tree.nodes.filter(node => node.type !== 'comment');
        expect(top).toHaveLength(1);
        expect(top[0].type === 'atrule' && top[0].name === 'media' && top[0].params).toBe('screen');
        const media = [];
        tree.walkAtRules(rule => media.push(`${rule.name} ${rule.params}`));
        expect(media).toEqual(['media screen']);
        const all = rules();
        expect(all.length).toBeGreaterThan(10);
        for (const { selectors } of all) {
            for (const selector of selectors) {
                expect([selector, selector === scope || selector.startsWith(`${scope} `)]).toEqual([selector, true]);
            }
        }
        expect(css()).not.toMatch(/@import|@font-face|oe-workbench-context|workbench-active/);
    });

    test('keeps full font sizes: no font, zoom or transform declarations', () => {
        for (const { selectors, decls } of rules()) {
            for (const prop of ['font', 'font-size', 'line-height', 'zoom', 'transform', 'scale', 'letter-spacing', 'text-transform']) {
                expect([selectors.join(), prop, decls[prop]]).toEqual([selectors.join(), prop, undefined]);
            }
        }
    });

    test('never hides, clips, reorders, disables or forces route content', () => {
        for (const { selectors, decls } of rules()) {
            const label = selectors.join();
            expect([label, decls.display ?? '']).not.toEqual([label, expect.stringMatching(/none|contents/)]);
            for (const prop of ['visibility', 'order', 'position', 'text-overflow', 'height', 'max-height', 'overflow', 'overflow-x', 'overflow-y', 'pointer-events', 'clip-path', 'opacity']) {
                expect([label, prop, decls[prop]]).toEqual([label, prop, undefined]);
            }
            expect(decls['white-space'] ?? '').not.toMatch(/nowrap|pre/);
            expect(decls['flex-direction'] ?? '').not.toMatch(/reverse/);
            for (const value of Object.values(decls)) expect(value).not.toMatch(/!important/);
        }
        expect(css()).not.toMatch(/content:|user-select|outline:\s*(0|none)/);
    });

    test('RTL: spacing, borders and alignment are logical, never physical', () => {
        for (const { decls } of rules()) {
            for (const prop of Object.keys(decls)) {
                expect(prop).not.toMatch(/(^|-)(left|right|top|bottom)($|-)/);
                expect(prop).not.toBe('float');
            }
            expect(decls['text-align'] ?? 'start').toMatch(/^(start|end)$/);
        }
    });

    test('document shape: canvas body, paper sheet, ruled head row, field rows and actions', () => {
        expect(declsFor(scope)).toMatchObject({ color: 'var(--oe-wb-ink)', background: 'var(--oe-wb-canvas)' });
        expect(declsFor(at('.oe-physical-diagnoses-form'))).toMatchObject({ margin: '0' });
        // The original <center> becomes the sheet; its centring is undone for the document text.
        expect(declsFor(at('.oe-physical-diagnoses-sheet'))).toMatchObject({
            color: 'var(--oe-wb-ink)',
            background: 'var(--oe-wb-paper)',
            border: '1px solid var(--oe-wb-line)',
            'border-radius': expect.stringMatching(/px$/),
            'margin-inline': 'auto',
            'max-width': expect.stringMatching(/rem$/),
            'text-align': 'start',
        });
        expect(declsFor(at('.oe-physical-diagnoses-table'))).toMatchObject({ width: '100%', 'border-collapse': 'collapse' });
        expect(declsFor(at('.oe-physical-diagnoses-head > td'))).toMatchObject({
            color: 'var(--oe-wb-muted)',
            'border-block-end': '1px solid var(--oe-wb-line)',
            'font-weight': '600',
            'text-align': 'start',
        });
        expect(declsFor(at('.oe-physical-diagnoses-table td'))).toMatchObject({ 'border-block-end': '1px solid var(--oe-wb-line)' });
        expect(declsFor(at('.oe-physical-diagnoses-actions'))).toMatchObject({ display: 'flex', 'flex-wrap': 'wrap' });
    });

    test('dark theme: every text-bearing surface pairs explicit ink with an explicit surface', () => {
        const paired = [
            ['', 'var(--oe-wb-ink)', 'var(--oe-wb-canvas)'],
            ['.oe-physical-diagnoses-sheet', 'var(--oe-wb-ink)', 'var(--oe-wb-paper)'],
            ['.oe-physical-diagnoses-table', 'var(--oe-wb-ink)', 'var(--oe-wb-paper)'],
            ['.oe-physical-diagnoses-table td', 'var(--oe-wb-ink)', 'var(--oe-wb-paper)'],
            ['.oe-physical-diagnoses-head > td', 'var(--oe-wb-muted)', 'var(--oe-wb-paper)'],
            [".oe-physical-diagnoses-table input[type='text']", 'var(--oe-wb-ink)', 'var(--oe-wb-paper)'],
            [".oe-physical-diagnoses-actions input[type='submit']", 'var(--oe-wb-on-petrol)', 'var(--oe-wb-petrol)'],
            [".oe-physical-diagnoses-actions input[type='button']", 'var(--oe-wb-ink)', 'var(--oe-wb-paper)'],
            [".oe-physical-diagnoses-actions input[type='button']:hover", 'var(--oe-wb-ink)', 'var(--oe-wb-canvas)'],
        ];
        for (const [part, ink, surface] of paired) {
            const selector = part ? at(part) : scope;
            const decls = declsFor(selector);
            expect([selector, decls.color, decls.background]).toEqual([selector, ink, surface]);
        }
        // Control edges meet non-text contrast against paper: the muted token, never the hairline.
        expect(declsFor(at(".oe-physical-diagnoses-table input[type='text']")).border).toBe('1px solid var(--oe-wb-muted)');
        expect(declsFor(at(".oe-physical-diagnoses-actions input[type='button']")).border).toBe('1px solid var(--oe-wb-muted)');
        // Colours come only from the shared popup tokens.
        expect(css().replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(/#[0-9a-f]{3,8}\b|(?<![-\w])(white|black)(?![-\w])/i);
    });

    test('keyboard focus is drawn on every input and button, with a :focus fallback for :focus-visible', () => {
        for (const part of [".oe-physical-diagnoses-table input[type='text']", ".oe-physical-diagnoses-actions input[type='submit']", ".oe-physical-diagnoses-actions input[type='button']"]) {
            for (const state of [':focus', ':focus-visible']) {
                const selector = at(`${part}${state}`);
                expect([selector, declsFor(selector).outline]).toEqual([selector, '2px solid var(--oe-wb-petrol)']);
                expect(declsFor(selector)['outline-offset']).toMatch(/^\dpx$/);
            }
        }
    });

    test('the :focus fallback never shares a selector list with :focus-visible (older engines drop the whole list)', () => {
        const all = rules();
        for (const { selectors } of all) {
            if (selectors.some(s => s.includes(':focus-visible'))) {
                expect([selectors.join(), selectors.every(s => s.includes(':focus-visible'))]).toEqual([selectors.join(), true]);
            }
        }
        // Each field and action has a :focus fallback in a rule with no :focus-visible selector at all.
        for (const part of [".oe-physical-diagnoses-table input[type='text']", ".oe-physical-diagnoses-actions input[type='submit']", ".oe-physical-diagnoses-actions input[type='button']"]) {
            const fallback = all.filter(({ selectors }) => selectors.includes(at(`${part}:focus`)));
            expect([part, fallback.length]).toEqual([part, 1]);
            expect(fallback[0].selectors.some(s => s.includes(':focus-visible'))).toBe(false);
            expect(fallback[0].decls.outline).toBe('2px solid var(--oe-wb-petrol)');
        }
    });

    test('negative control: the separation contract rejects a grouped :focus, :focus-visible list', () => {
        const grouped = postcss.parse('a:focus, a:focus-visible { outline: 2px solid red; }').first.selectors;
        expect(grouped.some(s => s.includes(':focus-visible')) && !grouped.every(s => s.includes(':focus-visible'))).toBe(true);
    });

    test('the original inputs keep their own names and inline widths: the sheet selects by name prefix only', () => {
        const all = rules().flatMap(r => r.selectors);
        expect(all.some(s => s.includes("input[name^='form_ordering']"))).toBe(true);
        // The diagnosis input keeps its inline width:100% and is never sized by the sheet.
        for (const { selectors, decls } of rules()) {
            if (selectors.some(s => s.includes('form_diagnosis'))) {
                expect([decls.width, decls['min-width'], decls['max-width']]).toEqual([undefined, undefined, undefined]);
            }
        }
        expect(css()).not.toMatch(/name=['"]?(form_save|csrf_token_form)|type=['"]?hidden/);
    });
});

describe('dialog resized after open (dialog.js keeps the open-time percentage)', () => {
    // Generic hypothetical inner-frame budgets, not predictions for the new.php launcher (see the nested describe).
    const frameWidths = [146, 180];
    const rootFont = 16;
    const px = (value, frame) => {
        const clamp = /^clamp\(\s*([\d.]+)px\s*,\s*([\d.]+)vw\s*,\s*([\d.]+)px\s*\)$/.exec(value);
        if (clamp) return Math.min(Math.max(Number(clamp[1]), (Number(clamp[2]) * frame) / 100), Number(clamp[3]));
        const plain = /^([\d.]+)(px|em)$/.exec(value);
        expect([value, plain !== null]).toEqual([value, true]);
        return plain[2] === 'em' ? Number(plain[1]) * rootFont : Number(plain[1]);
    };
    const inline = shorthand => {
        const parts = shorthand.match(/clamp\([^)]*\)|\S+/g);
        return parts.length > 1 ? parts[1] : parts[0];
    };
    const chrome = frame => {
        const body = declsFor(scope);
        const sheet = declsFor(at('.oe-physical-diagnoses-sheet'));
        const border = Number(/^(\d+)px/.exec(sheet.border)[1]);
        return 2 * px(inline(body.padding), frame) + 2 * px(inline(sheet.padding), frame) + 2 * border;
    };

    test('the sheet chrome leaves room for a whole original action button at 146px and 180px', () => {
        for (const frame of frameWidths) {
            // Estimate, not measured geometry: ~100px fits a single-line "Cancel" at 16px/600 plus padding and border.
            expect([frame, frame - chrome(frame) >= 100]).toEqual([frame, true]);
        }
    });

    test('order and diagnosis inputs both stay reachable on one row at 146px and 180px', () => {
        const cell = declsFor(at('.oe-physical-diagnoses-table td'));
        const cellInline = 2 * px(cell['padding-inline'], 0);
        const order = declsFor(at(".oe-physical-diagnoses-table input[name^='form_ordering']"));
        expect(order['max-width']).toBe('100%');
        for (const frame of frameWidths) {
            const diagnosisCell = frame - chrome(frame) - (px(order.width, frame) + cellInline) - cellInline;
            // Estimate, assuming a 16px font: the diagnosis input (inline width:100%) keeps a >= 32px target.
            expect([frame, diagnosisCell >= 32]).toEqual([frame, true]);
        }
    });

    test('Save and Cancel wrap as whole controls inside the sheet instead of overflowing it', () => {
        const group = declsFor(at('.oe-physical-diagnoses-actions'));
        expect(group).toMatchObject({ display: 'flex', 'flex-wrap': 'wrap' });
        for (const type of ['submit', 'button']) {
            const button = declsFor(at(`.oe-physical-diagnoses-actions input[type='${type}']`));
            expect(button.flex).not.toMatch(/^\d+ 0 /);
            expect(button).toMatchObject({ 'min-width': '0', 'max-width': '100%', 'white-space': 'normal' });
        }
        expect(css()).not.toMatch(/@media[^{]*(max|min)-width/);
    });

    describe('the real new.php launcher (500px opened at 1440px) resized to 320px and 390px', () => {
        const dialog = read('library/dialog.js');
        const openedAt = 1440;
        const launcherWidth = () => Number(/dlgopen\('\.\.\/\.\.\/forms\/physical_exam\/edit_diagnoses\.php\?lineid=' \+ encodeURIComponent\(line_id\), '_blank', (\d+), \d+\);/.exec(read(LAUNCHER))[1]);
        // dialog.js: above 1080px the requested width becomes a fixed max-width percentage, toFixed(1), never recomputed.
        const percent = () => {
            expect(dialog).toContain('if (where.innerWidth <= 1080) {');
            expect(dialog).toContain("mWidth = (width / where.innerWidth * 100).toFixed(1) + '%';");
            expect(dialog).toContain("{max-width:' + mWidth + ' !important;}");
            return Number((launcherWidth() / openedAt * 100).toFixed(1));
        };
        const dialogCap = viewport => (viewport * percent()) / 100;
        // The iframe sits in .modal-body px-1 (0.25rem each side at a 16px root). The modal-content border
        // and any other Bootstrap chrome make the real frame smaller still: these are upper bounds, not measured.
        const frameUpperBound = viewport => {
            expect(dialog).toContain('<div class="modal-body px-1 h-100">');
            return dialogCap(viewport) - 2 * 0.25 * rootFont;
        };

        test('dialog.js keeps 34.7% of the viewport, capping the dialog at 111.04px and 135.33px', () => {
            expect(launcherWidth()).toBe(500);
            expect(percent()).toBe(34.7);
            expect(dialogCap(320)).toBeCloseTo(111.04, 2);
            expect(dialogCap(390)).toBeCloseTo(135.33, 2);
        });

        test('the generic 146px and 180px budgets above are not what this launcher leaves at 320px and 390px', () => {
            expect(frameUpperBound(320)).toBeCloseTo(103.04, 2);
            expect(frameUpperBound(390)).toBeCloseTo(127.33, 2);
            expect(frameUpperBound(320)).toBeLessThan(frameWidths[0]);
            expect(frameUpperBound(390)).toBeLessThan(frameWidths[1]);
        });

        test('KNOWN GAP, not expected usable: the estimated action and diagnosis budgets fail at these upper bounds', () => {
            // Unresolved native acceptance gap, recorded rather than fixed: no product CSS is changed for estimates.
            const cellInline = 2 * px(declsFor(at('.oe-physical-diagnoses-table td'))['padding-inline'], 0);
            const order = declsFor(at(".oe-physical-diagnoses-table input[name^='form_ordering']"));
            const budgets = frame => {
                const action = frame - chrome(frame);
                return { action, diagnosis: action - (px(order.width, frame) + cellInline) - cellInline };
            };
            const narrow = budgets(frameUpperBound(320));
            const wider = budgets(frameUpperBound(390));
            expect(narrow.action).toBeCloseTo(73.04, 2);
            expect(narrow.diagnosis).toBeCloseTo(-6.96, 2);
            expect(wider.action).toBeCloseTo(97.33, 2);
            expect(wider.diagnosis).toBeCloseTo(17.33, 2);
            for (const { action, diagnosis } of [narrow, wider]) {
                expect(action).toBeLessThan(100);
                expect(diagnosis).toBeLessThan(32);
            }
        });
    });
});

test('jsdom: rules match only under the popup marker plus the route body', () => {
    const selectors = rules().flatMap(r => r.selectors).filter(s => s.endsWith(' .oe-physical-diagnoses-sheet'));
    const { document } = new JSDOM('').window;
    const matches = (htmlClass, bodyClass) => {
        document.documentElement.className = htmlClass;
        document.body.className = bodyClass;
        document.body.innerHTML = "<form class='oe-physical-diagnoses-form'><center class='oe-physical-diagnoses-sheet'></center></form>";
        const sheet = document.querySelector('.oe-physical-diagnoses-sheet');
        return selectors.some(s => sheet.matches(s));
    };
    expect(matches('oe-workbench-context oe-workbench-popup', 'body_top oe-physical-diagnoses')).toBe(true);
    expect(matches('oe-workbench-context', 'body_top oe-physical-diagnoses')).toBe(false); // tab frame, not a popup
    expect(matches('', 'body_top oe-physical-diagnoses')).toBe(false); // standalone, legacy or print-only host
    expect(matches('oe-workbench-context oe-workbench-popup', 'body_top')).toBe(false); // any other popup route
});

// Real popup.js controllers in real JSDOM windows wired as the browser exposes them
// (see workbench-popup.test.js): the route sheet engages exactly when popup.js marks a popup.
describe('route sheet follows the real popup.js marker in every entry path', () => {
    const ORIGIN = 'https://emr.test';
    const makeWindow = (markup, { url = `${ORIGIN}/interface/forms/physical_exam/edit_diagnoses.php?lineid=OE12030A`, parent, opener, frameElement } = {}) => {
        const { window } = new JSDOM(markup, { url, runScripts: 'outside-only' });
        if (parent) Object.defineProperty(window, 'parent', { configurable: true, get: () => parent });
        if (frameElement) Object.defineProperty(window, 'frameElement', { configurable: true, get: () => frameElement });
        if (opener) window.opener = opener;
        return window;
    };
    const makeShell = () => makeWindow(
        '<body class="workbench-active"><div id="mainBox"><button type="button" data-workbench-mode></button></div>'
        + '<div class="modal fade dialogModal"><div class="modal-dialog"><div class="modal-content">'
        + '<iframe class="modalIframe" name="_blank"></iframe></div></div></div><iframe name="enc"></iframe></body>',
        { url: `${ORIGIN}/interface/main/tabs/main.php` },
    );
    const route = '<body class="body_top oe-physical-diagnoses"><form class="oe-physical-diagnoses-form">'
        + '<center class="oe-physical-diagnoses-sheet"><table class="oe-physical-diagnoses-table"><tr><td>'
        + "<input type='text' name='form_ordering[1]' value='1'></td></tr></table></center></form></body>";
    const controller = win => {
        jest.resetModules();
        return require('../../interface/clinical-workspace/popup.js').createPopupController({ win });
    };
    const sheetSelectors = () => rules().flatMap(r => r.selectors).filter(s => s.endsWith(' .oe-physical-diagnoses-sheet'));
    const engaged = win => {
        const sheet = win.document.querySelector('.oe-physical-diagnoses-sheet');
        return sheetSelectors().some(selector => sheet.matches(selector));
    };
    const flush = () => new Promise(resolve => setTimeout(resolve, 0));

    test('the new.php dlgopen dialog frame on the workbench shell engages without touching form values', () => {
        const shell = makeShell();
        const dialog = makeWindow(route, { parent: shell, frameElement: shell.document.querySelector('iframe.modalIframe') });
        expect(controller(dialog).active).toBe(true);
        expect([...dialog.document.documentElement.classList]).toEqual(expect.arrayContaining(['oe-workbench-context', 'oe-workbench-popup']));
        expect(engaged(dialog)).toBe(true);
        expect(dialog.document.body.className).toBe('body_top oe-physical-diagnoses');
        expect(dialog.document.querySelector("input[name='form_ordering[1]']").value).toBe('1');
    });

    test('a window opened from a workbench frame (opener chain) engages', () => {
        const shell = makeShell();
        const encounter = makeWindow('<body class="body_top"></body>', { url: `${ORIGIN}/interface/forms/physical_exam/new.php`, parent: shell, frameElement: shell.document.querySelector('iframe[name="enc"]') });
        const opened = makeWindow(route, { opener: encounter });
        controller(opened);
        expect(engaged(opened)).toBe(true);
    });

    test('legacy mode and reactivation toggle the sheet with the shell', async () => {
        const shell = makeShell();
        const dialog = makeWindow(route, { parent: shell, frameElement: shell.document.querySelector('iframe.modalIframe') });
        controller(dialog);
        expect(engaged(dialog)).toBe(true);
        shell.document.body.classList.remove('workbench-active');
        await flush();
        expect([...dialog.document.documentElement.classList]).toEqual([]);
        expect(engaged(dialog)).toBe(false);
        shell.document.body.classList.add('workbench-active');
        await flush();
        expect(engaged(dialog)).toBe(true);
    });

    test('a workbench tab frame, an inactive shell, a standalone window and a non-workbench opener stay legacy', () => {
        const shell = makeShell();
        const tab = makeWindow(route, { parent: shell, frameElement: shell.document.querySelector('iframe[name="enc"]') });
        controller(tab);
        expect([...tab.document.documentElement.classList]).toEqual(['oe-workbench-context']);
        expect(engaged(tab)).toBe(false);

        const inactive = makeShell();
        inactive.document.body.classList.remove('workbench-active');
        const dialog = makeWindow(route, { parent: inactive, frameElement: inactive.document.querySelector('iframe.modalIframe') });
        expect(controller(dialog).active).toBe(false);
        expect(engaged(dialog)).toBe(false);

        const standalone = makeWindow(route);
        controller(standalone);
        expect(engaged(standalone)).toBe(false);

        const opened = makeWindow(route, { opener: makeWindow('<body class="body_top"></body>') });
        controller(opened);
        expect(engaged(opened)).toBe(false);
    });
});
