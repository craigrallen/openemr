/** @jest-environment jsdom */

/*
 * Add-to-list inline popup (library/options_listadd.inc.php) inside an active workbench.
 *
 * The fragment is shared: options.inc.php renders data type 26 selects and their Add buttons
 * for many screens, and the fragment's script sends GET to library/ajax/addlistitem.php. This
 * phase only adapts the palette of the existing #newlistitem box. Its geometry, inline
 * visibility, classes, fonts, IDs, script, CSRF token and option propagation stay byte for
 * byte, which the frozen-original inverse below enforces. These are source-level checks with a
 * simulated cascade; they are not native browser execution or measured contrast.
 */

const fs = require('fs');
const path = require('path');
const postcss = require('postcss');

const root = path.join(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
// Files the implementation adds read as empty text until they exist, so each dependent test
// fails on its own instead of the whole suite crashing.
const readOptional = file => (fs.existsSync(path.join(root, file)) ? read(file) : '');
const count = (text, part) => text.split(part).length - 1;

const FRAGMENT = 'library/options_listadd.inc.php';
const SHEET = 'interface/clinical-workspace/list-add-popup.css';
const HELPER = 'src/Common/Assets/ClinicalWorkspaceAssets.php';
const original = () => read('tests/clinical-ui/fixtures/list-add-popup-original.txt');

// ---------------------------------------------------------------------------------------------
// Fragment: exactly three additions on top of the frozen original.

const LINK = '<link rel="stylesheet" media="screen" href="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>/interface/clinical-workspace/list-add-popup.css?v=<?php echo attr_url((new ClinicalWorkspaceAssets())->version(\'list-add-popup.css\')); ?>">';

// Every addition is [original, presented].
const additions = [
    ['use OpenEMR\\Common\\Csrf\\CsrfUtils;\n', 'use OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;\nuse OpenEMR\\Common\\Csrf\\CsrfUtils;\n'],
    ['?>\n\n\n<!-- hidden DIV used for creating new list items -->\n', `?>\n${LINK}\n\n\n<!-- hidden DIV used for creating new list items -->\n`],
    ['<div id="newlistitem" class="position-absolute bg-light border border-dark" style=', '<div id="newlistitem" class="position-absolute bg-light border border-dark oe-list-add-popup" style='],
];

// Undo the additions; null when any addition is missing or duplicated.
const restore = text => {
    let restored = text;
    for (const [before, after] of additions) {
        if (count(restored, after) !== 1) return null;
        restored = restored.replace(after, () => before);
    }
    return restored;
};

// Apply the additions to the frozen original, as the implementation is expected to.
const present = text => {
    let presented = text;
    for (const [before, after] of additions) {
        if (count(presented, before) !== 1) throw new Error(`addition anchor is not unique: ${before}`);
        presented = presented.replace(before, () => after);
    }
    return presented;
};

// The fragment is included into its caller, so any new PHP assignment could clobber caller scope.
const phpAssignments = text => [...text.matchAll(/<\?php([\s\S]*?)(?:\?>|$)/g)]
    .flatMap(match => [...match[1].matchAll(/\$[A-Za-z_]\w*(?=\s*=(?!=))/g)].map(m => m[0]));

const verifyFragment = text => {
    const restored = restore(text);
    if (restored === null) throw new Error('a declared addition is missing or duplicated');
    if (restored !== original()) throw new Error('fragment differs from the frozen original beyond the declared additions');
    if (phpAssignments(text).join() !== phpAssignments(original()).join()) throw new Error('fragment assigns a new PHP variable in caller scope');
};

test('the frozen original is the complete 229-line shared fragment', () => {
    const fixture = original();
    expect(fixture.split('\n')).toHaveLength(230);
    expect(fixture.startsWith('<?php\n\n/**\n * This include is just a HTML and JS *fragment* it CANNOT stand alone\n')).toBe(true);
    expect(fixture.endsWith('}); // end jQuery .ready\n</script>\n')).toBe(true);
    expect(count(fixture, 'list-add-popup')).toBe(0);
    expect(phpAssignments(fixture)).toEqual(['$session']);
    for (const [before] of additions) expect(count(fixture, before)).toBe(1);
});

test('positive simulation: the three additions restore the frozen original exactly', () => {
    const presented = present(original());
    expect(presented).not.toBe(original());
    expect(() => verifyFragment(presented)).not.toThrow();
    expect(restore(presented)).toBe(original());
    expect(count(presented, LINK)).toBe(1);
    expect(count(presented, 'list-add-popup.css')).toBe(2);
});

test('the shared fragment carries only the declared additions over the frozen original', () => {
    const php = read(FRAGMENT);
    for (const [, after] of additions) expect(count(php, after)).toBe(1);
    expect(() => verifyFragment(php)).not.toThrow();
});

test('the fragment links one versioned, escaped, screen-only sheet without a new caller-scope variable', () => {
    const php = read(FRAGMENT);
    expect(count(php, LINK)).toBe(1);
    expect(count(php, 'list-add-popup.css')).toBe(2);
    expect(count(php, '(new ClinicalWorkspaceAssets())')).toBe(1);
    expect(php).not.toContain('$clinicalAssets');
    expect(phpAssignments(php)).toEqual(['$session']);
    // The link sits directly after the fragment's PHP block, before the original hidden DIV comment.
    expect(php).toContain(`$session = SessionWrapperFactory::getInstance()->getActiveSession();\n?>\n${LINK}\n\n\n<!-- hidden DIV used for creating new list items -->\n<div id="newlistitem" class="position-absolute bg-light border border-dark oe-list-add-popup" style="display: none; padding: 5px; z-index: 5000;">`);
});

// [label, from, to]: each mutation targets text that occurs exactly once in the presented fragment.
const fragmentMutations = [
    ['Enter-key handler', 'SaveNewListItem(this, evt); return false; }});', 'SaveNewListItem(this, evt); }});'],
    ['state custom widget flag', "getBoolean('state_custom_addlist_widget')", "getBoolean('state_custom_widget')"],
    ['CSRF token', 'js_escape(CsrfUtils::collectCsrfToken(session: $session))', "''"],
    ['getJSON endpoint', '/library/ajax/addlistitem.php",', '/library/ajax/addlistitem2.php",'],
    ['same-list option propagation', '$("select.addtolistclass_"+listid).each(', '$("select#"+$(\'#newlistitem_fieldid\').val()).each('],
    ['hidden by default', 'style="display: none; padding: 5px; z-index: 5000;"', 'style="padding: 5px; z-index: 5000;"'],
    ['geometry', 'style="display: none; padding: 5px; z-index: 5000;"', 'style="display: none; padding: 12px; z-index: 5000;"'],
    ['shown inline', "$('#newlistitem').css('display', 'inline');", "$('#newlistitem').css('display', 'block');"],
    ['hidden after save', "            // now hide the DIV\n            $('#newlistitem').hide();\n", '            // now hide the DIV\n'],
    ['state heading font size', "style='font-size:120%;'", "style='font-size:100%;'"],
    ['state heading font class', "class='text-center font-weight-bold'", "class='text-center'"],
    ['generic field ID', "var generic = \"<input type='text' class='form-control' name='newlistitem_value' id='newlistitem_value'", "var generic = \"<input type='text' class='form-control' name='newlistitem_value' id='newlistitem_val'"],
    ['original box classes', 'class="position-absolute bg-light border border-dark oe-list-add-popup"', 'class="position-absolute border border-dark oe-list-add-popup"'],
    ['added wrapper', '<div id="specificForm">\n </div>', '<div class="oe-list-add-body"><div id="specificForm">\n </div></div>'],
    ['exposed option widgets', '    window.oeUI.optionWidgets = optionWidgets;\n', ''],
    ['caller-scope variable', "<?php echo attr_url((new ClinicalWorkspaceAssets())->version('list-add-popup.css')); ?>", "<?php $clinicalAssets = new ClinicalWorkspaceAssets(); echo attr_url($clinicalAssets->version('list-add-popup.css')); ?>"],
    ['unescaped web root', '<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>/interface/clinical-workspace', '<?php echo OEGlobalsBag::getInstance()->getWebRoot(); ?>/interface/clinical-workspace'],
    ['all-media link', '<link rel="stylesheet" media="screen" href=', '<link rel="stylesheet" href='],
    ['import order', 'use OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;\nuse OpenEMR\\Common\\Csrf\\CsrfUtils;\n', 'use OpenEMR\\Common\\Csrf\\CsrfUtils;\nuse OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;\n'],
    ['duplicate link', `${LINK}\n`, `${LINK}\n${LINK}\n`],
];

test.each(fragmentMutations)('negative control: %s change is rejected', (label, from, to) => {
    const presented = present(original());
    expect(count(presented, from)).toBe(1);
    const mutated = presented.replace(from, () => to);
    expect(mutated).not.toBe(presented);
    expect(() => verifyFragment(mutated)).toThrow();
});

// ---------------------------------------------------------------------------------------------
// Asset helper: the baseline plus one sorted allowlist line.

const HELPER_BASELINE = String.raw`<?php

/**
 * Per-file cache versions for the clinical workspace screen assets.
 *
 * Views that link interface/clinical-workspace assets directly append
 * ?v=<version> so a browser refetches a file as soon as it changes. Keeping
 * the filesystem lookup here keeps the view's URL expression free of
 * filesystem roots, and confines which files may be stat()ed to a fixed list.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Common\Assets;

final readonly class ClinicalWorkspaceAssets
{
    /**
     * Supported asset basenames. The directory defaults to the clinical
     * workspace; a legacy tooltip caller supplies library/js explicitly.
     */
    private const SUPPORTED = [
        'ajtooltip.js',
        'appointment.css',
        'calendar-sidebar.js',
        'calendar-workday.css',
        'calendar-workday.js',
        'encounter-document.css',
        'finder.css',
        'global-messages.css',
        'history-document.css',
        'history-editor.css',
        'issue-popup.css',
        'lbf-document.css',
        'mode.js',
        'patient-messages.css',
        'patient-picker-popup.css',
        'patient-results-popup.css',
        'patient-search.css',
        'soap-document.css',
        'soap-document.js',
        'soap-reference.css',
        'soap-reference.js',
        'visit-history.css',
        'visit-history.js',
        'workspace.css',
    ];

    private string $directory;

    /**
     * @param ?string $directory Directory holding the assets; defaults to the
     *                           shipped interface/clinical-workspace.
     */
    public function __construct(?string $directory = null)
    {
        $this->directory = $directory ?? dirname(__DIR__, 3) . '/interface/clinical-workspace';
    }

    /**
     * Modification time of a supported asset as a decimal string, or '0'
     * when the file is absent.
     *
     * @throws \InvalidArgumentException when $asset is not a supported name
     */
    public function version(string $asset): string
    {
        if (!in_array($asset, self::SUPPORTED, true)) {
            throw new \InvalidArgumentException('Unsupported clinical workspace asset');
        }

        $path = $this->directory . '/' . $asset;
        clearstatcache(true, $path);
        if (!is_file($path)) {
            return '0';
        }
        $mtime = filemtime($path);

        return $mtime === false ? '0' : sprintf('%d', $mtime);
    }
}
`;
const HELPER_ANCHOR = "        'lbf-document.css',\n";
const HELPER_ENTRY = "        'list-add-popup.css',\n";

const restoreHelper = text => (count(text, HELPER_ENTRY) === 1 && count(text, HELPER_ANCHOR + HELPER_ENTRY) === 1
    ? text.replace(HELPER_ANCHOR + HELPER_ENTRY, () => HELPER_ANCHOR)
    : null);
const verifyHelper = text => {
    if (restoreHelper(text) !== HELPER_BASELINE) throw new Error('asset helper differs from its baseline beyond the one allowlist line');
};
const supported = text => [...(text.match(/private const SUPPORTED = \[\n([\s\S]*?)\n {4}\];/)?.[1] ?? '').matchAll(/'([^']+)'/g)].map(m => m[1]);

test('positive simulation: one sorted allowlist line after lbf-document.css restores the helper baseline', () => {
    const presented = HELPER_BASELINE.replace(HELPER_ANCHOR, () => HELPER_ANCHOR + HELPER_ENTRY);
    expect(() => verifyHelper(presented)).not.toThrow();
    const names = supported(presented);
    expect(names).toContain('list-add-popup.css');
    expect(names).toEqual([...names].sort());
    expect(names).toHaveLength(supported(HELPER_BASELINE).length + 1);
});

test('the asset helper adds only the list-add-popup.css allowlist line', () => {
    const helper = read(HELPER);
    expect(() => verifyHelper(helper)).not.toThrow();
    expect(supported(helper)).toEqual([...supported(helper)].sort());
});

const helperMutations = [
    ['unsorted entry', HELPER_ANCHOR + HELPER_ENTRY, HELPER_ENTRY + HELPER_ANCHOR],
    ['duplicate entry', HELPER_ENTRY, HELPER_ENTRY + HELPER_ENTRY],
    ['extra entry', HELPER_ENTRY, `${HELPER_ENTRY}        'list-add-popup.js',\n`],
    ['removed sibling entry', "        'mode.js',\n", ''],
    ['changed absent-file fallback', "            return '0';\n", "            return '';\n"],
];

test.each(helperMutations)('negative control: helper %s is rejected', (label, from, to) => {
    const presented = HELPER_BASELINE.replace(HELPER_ANCHOR, () => HELPER_ANCHOR + HELPER_ENTRY);
    expect(count(presented, from)).toBe(1);
    const mutated = presented.replace(from, () => to);
    expect(mutated).not.toBe(presented);
    expect(() => verifyHelper(mutated)).toThrow();
});

// ---------------------------------------------------------------------------------------------
// Sheet: an exact selector/declaration allowlist inside one @media screen block.

const SCOPE = 'html.oe-workbench-context #newlistitem.oe-list-add-popup';
// Text fields the script inserts into #specificForm; validation states keep the theme's rules.
const FIELD = `${SCOPE} .form-control:not(.is-invalid, .is-valid, .was-validated *)`;
const FOCUSABLE = [`${SCOPE} .form-control`, `${SCOPE} input[type='button']`];
const OUTLINE = { outline: '2px solid var(--oe-wb-petrol)', 'outline-offset': '2px' };

const expectedRules = [
    // The only !important: the box keeps .bg-light, whose Bootstrap rule is itself !important.
    { selectors: [SCOPE], decls: { 'background-color': 'var(--oe-wb-paper) !important', color: 'var(--oe-wb-ink)' } },
    // The focus rings come before the field palette so the sheet avoids descending specificity.
    // :focus and :focus-visible stay separate rules so an engine without :focus-visible keeps the :focus ring.
    { selectors: FOCUSABLE.map(selector => `${selector}:focus`), decls: OUTLINE },
    { selectors: FOCUSABLE.map(selector => `${selector}:focus-visible`), decls: OUTLINE },
    { selectors: [FIELD, `${FIELD}:focus`], decls: { 'background-color': 'var(--oe-wb-paper)', color: 'var(--oe-wb-ink)' } },
    // Disabled and readOnly follow the normal/focus rule so they win a focused disabled field.
    { selectors: [`${FIELD}:disabled`, `${FIELD}[readonly]`], decls: { 'background-color': 'var(--oe-wb-disabled-paper)', color: 'var(--oe-wb-disabled-ink)' } },
    { selectors: [`${FIELD}::placeholder`], decls: { color: 'var(--oe-wb-ink)', opacity: '1' } },
];

// Indexes into expectedRules, so the mutations below keep their semantic targets.
const BOX = 0;
const RING_FOCUS = 1;
const RING_VISIBLE = 2;
const FIELD_PAPER = 3;
const FIELD_LOCKED = 4;
const FIELD_PLACEHOLDER = 5;

const renderSheet = rules => `@media screen {\n${rules.map(({ selectors, decls }) => `  ${selectors.join(',\n  ')} {\n${Object.entries(decls).map(([prop, value]) => `    ${prop}: ${value};`).join('\n')}\n  }`).join('\n\n')}\n}\n`;

const sortDecls = decls => Object.fromEntries(Object.entries(decls).sort(([a], [b]) => a.localeCompare(b)));

const parseSheet = text => {
    const tree = postcss.parse(text);
    const top = tree.nodes.filter(node => node.type !== 'comment');
    if (top.length !== 1 || top[0].type !== 'atrule' || top[0].name !== 'media' || top[0].params !== 'screen') {
        throw new Error('the sheet must be exactly one @media screen block');
    }
    return top[0].nodes.filter(node => node.type !== 'comment').map(rule => {
        if (rule.type !== 'rule') throw new Error(`unexpected ${rule.type} inside @media screen`);
        const decls = {};
        for (const node of rule.nodes.filter(child => child.type !== 'comment')) {
            if (node.type !== 'decl' || node.prop in decls) throw new Error(`unexpected or repeated declaration in ${rule.selector}`);
            decls[node.prop] = `${node.value}${node.important ? ' !important' : ''}`;
        }
        return { selectors: rule.selectors, decls: sortDecls(decls) };
    });
};

const verifySheet = text => {
    const actual = JSON.stringify(parseSheet(text));
    const expected = JSON.stringify(expectedRules.map(({ selectors, decls }) => ({ selectors, decls: sortDecls(decls) })));
    if (actual !== expected) throw new Error('sheet differs from the selector/declaration allowlist');
};

test('positive simulation: the allowlisted sheet parses and passes', () => {
    expect(() => verifySheet(renderSheet(expectedRules))).not.toThrow();
});

test('the list-add sheet is exactly the allowlisted screen-only palette', () => {
    const text = readOptional(SHEET);
    expect(text).not.toBe('');
    expect(() => verifySheet(text)).not.toThrow();
});

test('the list-add sheet declares no custom properties and one !important', () => {
    const text = readOptional(SHEET);
    expect(text).not.toBe('');
    const decls = [];
    postcss.parse(text).walkDecls(decl => decls.push(decl));
    expect(decls.filter(decl => decl.prop.startsWith('--'))).toHaveLength(0);
    expect(decls.filter(decl => decl.important).map(decl => `${decl.parent.selector} ${decl.prop}`)).toEqual([`${SCOPE} background-color`]);
});

const clone = rules => rules.map(({ selectors, decls }) => ({ selectors: [...selectors], decls: { ...decls } }));
const withRules = edit => {
    const rules = clone(expectedRules);
    edit(rules);
    return renderSheet(rules);
};
const sheetMutations = [
    ['extra !important', withRules(r => { r[FIELD_PAPER].decls.color = 'var(--oe-wb-ink) !important'; })],
    ['missing !important on the paper', withRules(r => { r[BOX].decls['background-color'] = 'var(--oe-wb-paper)'; })],
    ['padding', withRules(r => { r[BOX].decls.padding = '8px'; })],
    ['width', withRules(r => { r[BOX].decls.width = 'auto'; })],
    ['border', withRules(r => { r[FIELD_PAPER].decls.border = '1px solid var(--oe-wb-line)'; })],
    ['font', withRules(r => { r[BOX].decls['font-family'] = 'inherit'; })],
    ['visibility', withRules(r => { r[BOX].decls.display = 'block'; })],
    ['stacking', withRules(r => { r[BOX].decls['z-index'] = '1050'; })],
    ['button paint', withRules(r => { r.push({ selectors: [`${SCOPE} .btn-primary`], decls: { 'background-color': 'var(--oe-wb-petrol)' } }); })],
    ['custom property on the box', withRules(r => { r[BOX].decls['--oe-wb-paper'] = '#fff'; })],
    ['unscoped selector', withRules(r => { r[FIELD_PAPER].selectors[0] = '#newlistitem .form-control'; })],
    ['popup-only scope', withRules(r => { r[BOX].selectors[0] = 'html.oe-workbench-popup #newlistitem.oe-list-add-popup'; })],
    ['validation descendants restyled', withRules(r => { r[FIELD_PAPER].selectors[0] = `${SCOPE} .form-control:not(.is-invalid, .is-valid)`; })],
    ['unpaired field focus', withRules(r => { r[FIELD_PAPER].selectors = [FIELD]; })],
    ['unpaired readOnly', withRules(r => { r[FIELD_LOCKED].selectors = [`${FIELD}:disabled`]; })],
    ['faded placeholder', withRules(r => { r[FIELD_PLACEHOLDER].decls.opacity = '0.5'; })],
    ['merged focus fallback', withRules(r => { r[RING_FOCUS].selectors.push(...r[RING_VISIBLE].selectors); r.splice(RING_VISIBLE, 1); })],
    ['thicker ring', withRules(r => { r[RING_VISIBLE].decls.outline = '3px solid var(--oe-wb-petrol)'; })],
    ['focus rings after the field palette', withRules(r => { r.push(...r.splice(RING_FOCUS, 2)); })],
    ['locked palette before the normal/focus palette', withRules(r => { r.splice(FIELD_PAPER, 2, r[FIELD_LOCKED], r[FIELD_PAPER]); })],
    ['print media', renderSheet(expectedRules).replace('@media screen {', '@media print {')],
    ['tokens declared on a shared ancestor', `:root { --oe-wb-paper: #fff; }\n${renderSheet(expectedRules)}`],
];

test.each(sheetMutations)('negative control: sheet %s is rejected', (label, mutated) => {
    expect(mutated).not.toBe(renderSheet(expectedRules));
    expect(() => verifySheet(mutated)).toThrow();
});

// ---------------------------------------------------------------------------------------------
// Simulated cascade against representative theme rules. .bg-light comes from Bootstrap 4.6's
// bg-variant mixin (background-color: $color !important) with $light: $gray-100 (#f8f9fa) in
// interface/themes/default-variables.scss. This models selector matching and precedence only.

const THEME = `
.bg-light{background-color:#f8f9fa!important}
.form-control{background-color:#fff;border-color:#ced4da;color:#495057}
.form-control:focus{background-color:#fff;border-color:#80bdff;color:#495057;outline:0}
.form-control:disabled,.form-control[readonly]{background-color:#e9ecef;opacity:1}
.form-control.is-invalid,.was-validated .form-control:invalid{border-color:#dc3545}
.form-control.is-valid,.was-validated .form-control:valid{border-color:#28a745}
.btn:focus{outline:0}
.btn-primary{background-color:#007bff;border-color:#007bff;color:#fff}
.btn-secondary{background-color:#f8f9fa;border-color:#f8f9fa;color:#212529}
`;

const specificity = selector => {
    const bare = selector.replace(/\[[^\]]*\]/g, '.a').replace(/::[\w-]+/g, ' x');
    const ids = (bare.match(/#[\w-]+/g) || []).length;
    const classes = (bare.match(/\.[\w-]+|:[\w-]+/g) || []).length;
    const types = (bare.replace(/[#.:][\w-]+/g, ' ').match(/(^|[\s>+~])[a-z][\w-]*/gi) || []).length;
    return ids * 1e6 + classes * 1e3 + types;
};

const cascade = sheet => {
    const out = [];
    let order = 0;
    const take = (tree, screenOnly) => tree.walkRules(rule => {
        const media = [];
        for (let parent = rule.parent; parent && parent.type === 'atrule'; parent = parent.parent) media.push(parent.params);
        if (media.some(m => m !== 'screen') || (screenOnly && !media.includes('screen'))) return;
        for (const selector of rule.selectors) {
            rule.walkDecls(d => out.push({ selector, prop: d.prop, value: d.value, important: d.important, spec: specificity(selector), order: order++ }));
        }
    });
    take(postcss.parse(THEME), false);
    take(postcss.parse(sheet), true);
    return out;
};

const computed = (element, prop, sheet) => {
    let winner = null;
    for (const d of cascade(sheet)) {
        if (d.prop !== prop) continue;
        let matches = false;
        try { matches = element.matches(d.selector); } catch { continue; }
        if (!matches) continue;
        const rank = [d.important ? 1 : 0, d.spec, d.order];
        if (!winner || rank[0] > winner.rank[0] || (rank[0] === winner.rank[0] && (rank[1] > winner.rank[1] || (rank[1] === winner.rank[1] && rank[2] > winner.rank[2])))) {
            winner = { rank, value: d.value };
        }
    }
    return winner?.value;
};

// The box as the script shows it, with the generic field it inserts.
const mount = ({ context = true, marker = true, cls = '', wasValidated = false, disabled = false, readonly = false, focus = '' } = {}) => {
    document.documentElement.className = context ? 'oe-workbench-context' : '';
    const box = `<div id="newlistitem" class="position-absolute bg-light border border-dark${marker ? ' oe-list-add-popup' : ''}" style="display: inline; padding: 5px; z-index: 5000;">`
        + '<input type="hidden" name="newlistitem_listid" id="newlistitem_listid" value="sex" />'
        + `<div id="specificForm"><input type='text' class='form-control${cls ? ` ${cls}` : ''}' name='newlistitem_value' id='newlistitem_value' size='20' maxlength='50' required${disabled ? ' disabled' : ''}${readonly ? ' readonly' : ''} /></div>`
        + "<div class=\"text-center\"><div style='margin-top: 0.5rem;'>"
        + "<input type='button' class='btn btn-primary' name='newlistitem_submit' id='newlistitem_submit' value='Add' />"
        + "<input type='button' class='btn btn-secondary' name='newlistitem_cancel' id='newlistitem_cancel' value='Cancel' />"
        + '</div></div></div>';
    document.body.innerHTML = wasValidated ? `<form class="was-validated">${box}</form>` : box;
    if (focus) document.getElementById(focus).focus();
    return {
        box: document.getElementById('newlistitem'),
        field: document.getElementById('newlistitem_value'),
        add: document.getElementById('newlistitem_submit'),
        cancel: document.getElementById('newlistitem_cancel'),
    };
};

const cascadeContract = sheet => {
    // Paper replaces the !important .bg-light only in the workbench and only on the marked box.
    const shown = mount();
    expect(computed(shown.box, 'background-color', sheet)).toBe('var(--oe-wb-paper)');
    expect(computed(shown.box, 'color', sheet)).toBe('var(--oe-wb-ink)');
    expect(computed(mount({ context: false }).box, 'background-color', sheet)).toBe('#f8f9fa');
    expect(computed(mount({ marker: false }).box, 'background-color', sheet)).toBe('#f8f9fa');
    expect(computed(mount({ context: false }).field, 'background-color', sheet)).toBe('#fff');

    // Field pairs: normal, focus, disabled, readOnly (focused readOnly stays locked paper).
    for (const [state, background, ink] of [
        [{}, 'var(--oe-wb-paper)', 'var(--oe-wb-ink)'],
        [{ focus: 'newlistitem_value' }, 'var(--oe-wb-paper)', 'var(--oe-wb-ink)'],
        [{ disabled: true }, 'var(--oe-wb-disabled-paper)', 'var(--oe-wb-disabled-ink)'],
        [{ readonly: true }, 'var(--oe-wb-disabled-paper)', 'var(--oe-wb-disabled-ink)'],
        [{ readonly: true, focus: 'newlistitem_value' }, 'var(--oe-wb-disabled-paper)', 'var(--oe-wb-disabled-ink)'],
    ]) {
        const { field } = mount(state);
        expect(computed(field, 'background-color', sheet)).toBe(background);
        expect(computed(field, 'color', sheet)).toBe(ink);
    }

    // A disabled field that matches :focus (jsdom cannot focus a disabled element, so :focus is
    // forced to match) must keep the locked palette: the disabled rule follows the :focus rule.
    const { field: lockedField } = mount({ disabled: true });
    const focusedLocked = { matches: selector => lockedField.matches(selector.replace(/:focus(?![-\w])/g, ':not(.oe-never)')) };
    expect(lockedField.matches(':disabled')).toBe(true);
    expect(focusedLocked.matches(`${FIELD}:focus`)).toBe(true);
    expect(computed(focusedLocked, 'background-color', sheet)).toBe('var(--oe-wb-disabled-paper)');
    expect(computed(focusedLocked, 'color', sheet)).toBe('var(--oe-wb-disabled-ink)');

    // Validation states keep the theme's field paint and semantic borders.
    for (const [state, border] of [[{ cls: 'is-invalid' }, '#dc3545'], [{ cls: 'is-valid' }, '#28a745'], [{ wasValidated: true }, '#dc3545']]) {
        const { field } = mount(state);
        expect(computed(field, 'background-color', sheet)).toBe('#fff');
        expect(computed(field, 'color', sheet)).toBe('#495057');
        expect(computed(field, 'border-color', sheet)).toBe(border);
    }

    // Focus ring on the field and both input buttons; buttons keep their theme paint.
    for (const id of ['newlistitem_value', 'newlistitem_submit', 'newlistitem_cancel']) {
        const focused = mount({ focus: id });
        const element = document.getElementById(id);
        expect(element.matches(':focus')).toBe(true);
        expect(computed(element, 'outline', sheet)).toBe('2px solid var(--oe-wb-petrol)');
        expect(computed(element, 'outline-offset', sheet)).toBe('2px');
        expect(computed(focused.box, 'background-color', sheet)).toBe('var(--oe-wb-paper)');
    }
    const plain = mount();
    expect(computed(plain.add, 'background-color', sheet)).toBe('#007bff');
    expect(computed(plain.cancel, 'background-color', sheet)).toBe('#f8f9fa');
    expect(computed(plain.cancel, 'color', sheet)).toBe('#212529');
    expect(computed(plain.add, 'outline', sheet)).toBeUndefined();
};

test('positive simulation: the allowlisted sheet pairs paper and ink over the theme in the cascade', () => {
    cascadeContract(renderSheet(expectedRules));
});

test('the list-add sheet pairs paper and ink over the theme in the cascade', () => {
    const text = readOptional(SHEET);
    expect(text).not.toBe('');
    cascadeContract(text);
});

test('the bg-light colour the box overrides is still the theme default', () => {
    const variables = read('interface/themes/default-variables.scss');
    expect(variables).toContain('$gray-100: #f8f9fa !default;');
    expect(variables).toContain('$light: $gray-100 !default;');
});

// ---------------------------------------------------------------------------------------------
// Shared caller and backend stay untouched. These pin the inherited request/response contract
// textually; they are not a security review. addlistitem.php checks the CSRF token but no ACL,
// and its duplicate checks and seq assignment are not atomic. That debt is inherited and remains open.

test('the shared caller and backend contract the fragment depends on is unchanged', () => {
    const caller = read('library/options.inc.php');
    expect(caller).toContain("            'addtolistclass_' . $list_id . $smallform,\n");
    expect(caller).toContain(`class='btn btn-secondary $btnSize mb-1 addtolist' id='addtolistid_" . $list_id_esc . "' fieldid='form_" .`);
    expect(caller).toMatch(/if \(AclExtended::acoExist\('lists', \$list_id\)\) \{\n\s+\/\/ a specific aco exist for this list, so ensure access\n\s+if \(AclMain::aclCheckCore\('lists', \$list_id\)\) \{\n\s+echo \$outputAddButton;/);
    expect(caller).toContain("if (AclMain::aclCheckCore('lists', 'default')) {");
    expect(caller).not.toMatch(/list-add-popup/);

    const backend = read('library/ajax/addlistitem.php');
    expect(backend).toContain('if (!CsrfUtils::verifyCsrfToken($_GET["csrf_token_form"], session: $session)) {');
    for (const key of ["$_GET['listid']", "$_GET['newitem']", "$_GET['newitem_abbr']"]) expect(backend).toContain(key);
    expect(backend).toContain('echo \'{ "error":"", "options": [\';');
    expect(backend).not.toMatch(/list-add-popup/);

    const fragment = read(FRAGMENT);
    for (const part of [
        '{csrf_token_form: ', 'listid: listid,', 'newitem: newitem,', 'newitem_abbr: newitem_abbr},', '/library/ajax/addlistitem.php",',
        "jsondata.error == ''", 'jsondata.options', '$("select.addtolistclass_"+listid).each(', '$(".addtolist").on("click"',
        '.replace(/^addtolistid_/g, "")', '.attr("fieldid")', "getBoolean('state_custom_addlist_widget')",
    ]) expect(count(fragment, part)).toBe(1);
});
