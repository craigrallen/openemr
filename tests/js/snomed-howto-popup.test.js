/** @jest-environment node */

// OPEMR-16: SNOMED installation details fragment (interface/code_systems/snomed_howto.php).
//
// Source-only contract. These tests read files as text; they never execute PHP, the
// dataloads endpoint, Header::setupHeader() or dialog.js, and they do not establish
// effective contrast, dialog fit, keyboard behaviour or authorization. The two
// h5.text-danger warnings keep the same inherited semantic CSS they have today; once the
// container paints paper behind them their backdrop changes when the workbench context
// is active, and their native computed contrast is NOT proven here. Caller and dialog
// assertions below are source anchors, not native proof.

const fs = require('fs');
const path = require('path');
const postcss = require('postcss');

const root = path.join(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
// An absent production file reads as empty so contract assertions fail, not the harness.
const readOptional = file => {
    try {
        return read(file);
    } catch (error) {
        if (error.code === 'ENOENT') return '';
        throw error;
    }
};

const ROUTE = 'interface/code_systems/snomed_howto.php';
const STYLESHEET = 'interface/clinical-workspace/snomed-howto-popup.css';
const HELPER = 'src/Common/Assets/ClinicalWorkspaceAssets.php';
const FIXTURE = 'tests/clinical-ui/fixtures/snomed-howto-popup-original.txt';
const BASENAME = 'snomed-howto-popup.css';
const HOOK = 'oe-snomed-howto-document';
const SCOPE = `html.oe-workbench-context .${HOOK}`;

const original = () => read(FIXTURE);
const count = (text, part) => text.split(part).length - 1;

// Builds a mutant; a missing or ambiguous anchor, or a no-op, is a construction error.
const mutate = (text, from, to) => {
    if (from === to) throw new Error(`mutation does not change its anchor: ${from}`);
    if (count(text, from) !== 1) throw new Error(`mutation anchor must occur exactly once: ${from}`);
    const out = text.replace(from, () => to);
    if (out === text) throw new Error(`mutation left input unchanged: ${from}`);
    return out;
};
const mutateAll = (text, from, to) => {
    if (from === to || count(text, from) < 1) throw new Error(`mutation anchor missing: ${from}`);
    const out = text.split(from).join(to);
    if (out === text) throw new Error(`mutation left input unchanged: ${from}`);
    return out;
};
// Every mutant set must be built before assertions, differ from its base and be unique.
const expectDistinctMutants = (mutants, base) => {
    expect(mutants.length).toBeGreaterThan(0);
    for (const mutant of mutants) expect(mutant).not.toBe(base);
    expect(new Set(mutants).size).toBe(mutants.length);
};

// ---------------------------------------------------------------- route

const LINK = `<link rel="stylesheet" media="screen" href="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>/interface/clinical-workspace/${BASENAME}?v=<?php echo attr_url((new ClinicalWorkspaceAssets())->version('${BASENAME}')); ?>">`;
const IMPORTS = [
    'use OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;',
    'use OpenEMR\\Core\\Header;',
    'use OpenEMR\\Core\\OEGlobalsBag;',
];

// The three permitted route additions as [original, presented].
const ROUTE_EDITS = [
    ['use OpenEMR\\Core\\Header;\n', `${IMPORTS.join('\n')}\n`],
    ['<?php Header::setupHeader(); ?>\n', `<?php Header::setupHeader(); ?>\n${LINK}\n`],
    ['<div class="container">\n', `<div class="container ${HOOK}">\n`],
];

const applyRouteEdits = text => ROUTE_EDITS.reduce((out, [before, after]) => mutate(out, before, after), text);
// Undo the permitted additions; null when any addition is missing or ambiguous.
const restoreRoute = text => {
    let restored = text;
    for (const [before, after] of ROUTE_EDITS) {
        if (count(restored, after) !== 1) return null;
        restored = restored.replace(after, () => before);
    }
    return restored;
};

const routeViolations = php => {
    const violations = [];
    if (count(php, LINK) !== 1) violations.push('escaped versioned screen link must appear exactly once');
    if (count(php, BASENAME) !== 2) violations.push('basename must appear only in the link href and version()');
    if (!php.includes(`<?php Header::setupHeader(); ?>\n${LINK}\n\n<div class="container ${HOOK}">\n`)) {
        violations.push('link must follow Header::setupHeader() directly, before the hooked container');
    }
    const uses = php.match(/^use [^;\n]+;$/gm) || [];
    if (JSON.stringify(uses) !== JSON.stringify(IMPORTS)) violations.push(`imports must be exactly ${IMPORTS.join(' ')}`);
    if (JSON.stringify(uses) !== JSON.stringify([...uses].sort())) violations.push('imports must be sorted');
    if (count(php, `class="container ${HOOK}"`) !== 1) violations.push('container hook must appear once');
    if (count(php, HOOK) !== 1) violations.push('hook class must appear only on the container');
    for (const tag of ['<html', '<head', '<body', '<script', '<style']) {
        if (php.includes(tag)) violations.push(`fragment must not emit ${tag}`);
    }
    if (php.includes('$')) violations.push('fragment must not introduce PHP variables (include scope)');
    return violations;
};

// Warnings, the PHP-concatenated official SNOMED link step and the contrib path, as in the original.
const WARNINGS = [
    '        <h5 class="text-danger"><?php echo xlt("NOTE: Only the Biannual International Snomed Releases and the US Snomed Releases are currently supported"); ?></h5>\n',
    '        <h5 class="text-danger"><?php echo xlt("The following International Snomed Release languages are supported"); ?>: <?php echo xlt("English"); ?>, <?php echo xlt("Spanish"); ?></h5>\n',
];
const SNOMED_URL = 'https://www.snomed.org/snomed-ct/get-snomed';
const SNOMED_LINK = `<a href='${SNOMED_URL}' target='_blank' rel='noopener'>${SNOMED_URL}</a>`;
// Step one concatenates the translated sentence with an untranslated link literal in PHP.
const LINK_STEP = `            <li><?php echo xlt("The first step is to download the SNOMED CT release. Access to SNOMED CT is provided by IHTSDO and their member countries. For more information see") .
            " ${SNOMED_LINK}."; ?>
            </li>
`;
const CONTRIB = '<?php echo xlt("Place the downloaded Snomed database zip file into the following directory"); ?>: contrib/snomed\n';

const contentViolations = php => {
    const violations = [];
    const fixture = original();
    // Every translated line of the original (steps, warnings, languages) survives verbatim.
    for (const line of fixture.split('\n').filter(text => text.includes('xlt('))) {
        if (count(php, `${line}\n`) !== 1) violations.push(`translated line must stay unchanged: ${line.trim()}`);
    }
    for (const warning of WARNINGS) {
        if (count(php, warning) !== 1) violations.push(`warning must stay unchanged: ${warning.trim()}`);
    }
    if (php.indexOf(WARNINGS[0]) > php.indexOf(WARNINGS[1])) violations.push('warnings must keep their order');
    if (count(php, '<h5 class="text-danger">') !== 2 || count(php, 'text-danger') !== 2) {
        violations.push('exactly the two original h5.text-danger warnings must remain');
    }
    if (count(php, LINK_STEP) !== 1) violations.push('PHP-concatenated SNOMED link step must stay unchanged');
    if (count(php, SNOMED_LINK) !== 1) violations.push(`official SNOMED link must stay unchanged: ${SNOMED_LINK}`);
    if (count(php, SNOMED_URL) !== 2) violations.push('SNOMED URL must appear only as the link href and text');
    if (count(php, "target='_blank' rel='noopener'") !== 1) violations.push('SNOMED link must keep _blank and noopener');
    if (count(php, CONTRIB) !== 1) violations.push('contrib/snomed step must stay unchanged');
    if (count(php, 'xlt(') !== count(fixture, 'xlt(')) violations.push('every translated string must stay xlt()');
    for (const call of ['xla(', 'xl(', 'xlj(', 'text(']) {
        if (count(php, call) !== count(fixture, call)) violations.push(`no ${call} calls may be added or removed`);
    }
    return violations;
};

test('fixture is the original 47-line instruction fragment', () => {
    const fixture = original();
    expect(fixture.split('\n').length - 1).toBe(47);
    expect(fixture.startsWith('<?php\n')).toBe(true);
    expect(fixture.endsWith('</div>\n')).toBe(true);
    expect(fixture).not.toContain('\r');
    for (const [before] of ROUTE_EDITS) expect(count(fixture, before)).toBe(1);
    expect(fixture).not.toContain(BASENAME);
    expect(fixture).not.toContain(HOOK);
    expect(fixture).not.toContain('$');
    expect(count(fixture, 'xlt(')).toBe(8);
    expect(count(fixture, 'xlt("English")')).toBe(1);
    expect(count(fixture, 'xlt("Spanish")')).toBe(1);
    expect(contentViolations(fixture)).toEqual([]);
});

const routeCandidate = applyRouteEdits(original());

test('positive candidate: permitted additions restore exactly and satisfy the route contract', () => {
    expect(routeCandidate).not.toBe(original());
    expect(restoreRoute(routeCandidate)).toBe(original());
    expect(routeViolations(routeCandidate)).toEqual([]);
    expect(contentViolations(routeCandidate)).toEqual([]);
    expect(routeViolations(original())).not.toEqual([]);
    expect(restoreRoute(original())).toBeNull();
});

test('route negative controls: content, translations, languages, warnings and the SNOMED link', () => {
    const mutants = [
        mutate(routeCandidate, 'xlt("Steps to install the Snomed database")', 'xlt("Steps to install Snomed")'),
        mutate(routeCandidate, 'xlt("English")', '"English"'),
        mutate(routeCandidate, 'xlt("Spanish")', 'xla("Spanish")'),
        mutate(routeCandidate, 'xlt("Return to this page', 'xl("Return to this page'),
        mutate(routeCandidate, ', <?php echo xlt("Spanish"); ?>', ''),
        mutate(routeCandidate, 'xlt("English"); ?>, <?php echo xlt("Spanish")', 'xlt("Spanish"); ?>, <?php echo xlt("English")'),
        mutate(routeCandidate, ': contrib/snomed\n', ': contrib/rxnorm\n'),
        mutate(routeCandidate, ': contrib/snomed\n', ': <code>contrib/snomed</code>\n'),
        mutate(routeCandidate, `href='${SNOMED_URL}'`, "href='https://www.snomed.org/'"),
        mutate(routeCandidate, `>${SNOMED_URL}</a>`, '>SNOMED</a>'),
        mutate(routeCandidate, "target='_blank' rel='noopener'", "target='_blank'"),
        mutate(routeCandidate, "target='_blank'", "target='_self'"),
        mutate(routeCandidate, 'For more information see") .\n', 'For more information see"),\n'),
        mutate(routeCandidate, '<h5 class="text-danger"><?php echo xlt("NOTE: Only', '<h5 class="text-warning"><?php echo xlt("NOTE: Only'),
        mutate(routeCandidate, '<h5 class="text-danger"><?php echo xlt("The following', '<h5 class="text-danger font-weight-normal"><?php echo xlt("The following'),
        mutate(routeCandidate, 'are currently supported', 'are supported'),
        mutate(routeCandidate, WARNINGS[1], ''),
        mutate(routeCandidate, `${WARNINGS[0]}${WARNINGS[1]}`, `${WARNINGS[1]}${WARNINGS[0]}`),
        mutate(routeCandidate, WARNINGS[1], WARNINGS[1].replace('<h5 class="text-danger">', '<h6 class="text-danger">').replace('</h5>', '</h6>')),
    ];
    expectDistinctMutants(mutants, routeCandidate);
    for (const mutant of mutants) {
        expect(restoreRoute(mutant)).not.toBe(original());
        expect(contentViolations(mutant)).not.toEqual([]);
    }
});

test('route negative controls: imports, escaping, cache, media, hook, variables and wrappers', () => {
    const mutants = [
        mutate(routeCandidate, '<?php Header::setupHeader(); ?>', "<?php Header::setupHeader('opener'); ?>"),
        mutate(routeCandidate, 'attr(OEGlobalsBag::', '(OEGlobalsBag::'),
        mutate(routeCandidate, 'attr(OEGlobalsBag::getInstance()->getWebRoot())', "attr($GLOBALS['webroot'])"),
        mutate(routeCandidate, 'attr_url((new ClinicalWorkspaceAssets())', 'attr((new ClinicalWorkspaceAssets())'),
        mutate(routeCandidate, 'media="screen"', 'media="all"'),
        mutate(routeCandidate, ' media="screen"', ''),
        mutate(routeCandidate, `version('${BASENAME}')`, "version('workspace.css')"),
        mutate(routeCandidate, '.css?v=', '.css?ver='),
        mutate(routeCandidate, `/interface/clinical-workspace/${BASENAME}?v=`, `/interface/clinical-workspace/${BASENAME}?`),
        mutate(routeCandidate, `${IMPORTS[0]}\n${IMPORTS[1]}\n`, `${IMPORTS[1]}\n${IMPORTS[0]}\n`),
        mutate(routeCandidate, `${IMPORTS[2]}\n`, ''),
        mutate(routeCandidate, `${IMPORTS[2]}\n`, `${IMPORTS[2]}\nuse OpenEMR\\Core\\Kernel;\n`),
        mutate(routeCandidate, `class="container ${HOOK}"`, 'class="container"'),
        mutate(routeCandidate, `class="container ${HOOK}"`, `class="${HOOK} container"`),
        mutate(routeCandidate, '    <p>\n', `    <p class="${HOOK}">\n`),
        mutate(routeCandidate, '\n\n?>\n', '\n\n$clinicalAssets = new ClinicalWorkspaceAssets();\n?>\n'),
        mutate(routeCandidate, '        </ol>\n', '        </ol>\n<script>document.title = "x";</script>\n'),
        mutate(routeCandidate, `<div class="container ${HOOK}">\n`, `<body>\n<div class="container ${HOOK}">\n`),
        mutate(routeCandidate, `${LINK}\n`, `${LINK}\n<style>.${HOOK} { color: red; }</style>\n`),
        mutate(routeCandidate, `${LINK}\n`, `${LINK}\n${LINK}\n`),
        mutate(routeCandidate, `<?php Header::setupHeader(); ?>\n${LINK}\n`, `${LINK}\n<?php Header::setupHeader(); ?>\n`),
        mutate(routeCandidate, `${LINK}\n\n<div`, `${LINK}\n<div`),
        mutate(routeCandidate, ' * Instructions for loading SNOMED Database\n', ' * Instructions for loading the SNOMED Database\n'),
    ];
    expectDistinctMutants(mutants, routeCandidate);
    for (const mutant of mutants) {
        expect(restoreRoute(mutant)).not.toBe(original());
    }
    // The explicit contract rejects every structural mutant on its own (all but the header comment).
    for (const mutant of mutants.slice(0, -1)) expect(routeViolations(mutant)).not.toEqual([]);
});

test('actual route: only the three permitted additions restore the original fragment byte for byte', () => {
    expect(restoreRoute(read(ROUTE))).toBe(original());
});

test('actual route: escaped versioned screen link, sorted imports and container hook', () => {
    expect(routeViolations(read(ROUTE))).toEqual([]);
});

test('actual route: hooked fragment keeps warnings, translations, SNOMED link and contrib/snomed path', () => {
    const php = read(ROUTE);
    expect(count(php, `<div class="container ${HOOK}">\n`)).toBe(1);
    expect(contentViolations(php)).toEqual([]);
});

// ---------------------------------------------------------------- asset helper

// Full ClinicalWorkspaceAssets.php as found in this worktree before OPEMR-16.
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

// 'snomed-…' sorts before 'soap-…' ('n' < 'o'), so the entry belongs between
// patient-search.css and soap-document.css, not after soap-document.css.
const PREVIOUS = 'patient-search.css';
const NEXT = 'soap-document.css';
const HELPER_LINE = `        '${BASENAME}',\n`;
const supported = text => {
    const block = text.match(/private const SUPPORTED = \[\n([\s\S]*?)\n {4}\];/);
    if (!block) return null;
    return block[1].split('\n').map(line => (line.match(/^ {8}'([^']+)',$/) || [null, `<malformed:${line}>`])[1]);
};
const helperViolations = text => {
    const violations = [];
    const without = count(text, HELPER_LINE) === 1 ? text.replace(HELPER_LINE, '') : null;
    if (without !== HELPER_BASELINE) violations.push('helper must equal the baseline plus exactly one supported line');
    const list = supported(text);
    if (!list) return [...violations, 'SUPPORTED list not found'];
    if (JSON.stringify(list) !== JSON.stringify([...list].sort())) violations.push('SUPPORTED must stay sorted');
    if (new Set(list).size !== list.length) violations.push('SUPPORTED must not repeat a basename');
    if (list.filter(name => name === BASENAME).length !== 1) violations.push(`SUPPORTED must list ${BASENAME} once`);
    const at = list.indexOf(BASENAME);
    if (list[at - 1] !== PREVIOUS || list[at + 1] !== NEXT) {
        violations.push(`${BASENAME} must sit between ${PREVIOUS} and ${NEXT}`);
    }
    return violations;
};

test('helper baseline is self-consistent and fixes the sorted slot for the new basename', () => {
    const list = supported(HELPER_BASELINE);
    expect(list).toHaveLength(24);
    expect(list).toEqual([...list].sort());
    expect(new Set(list).size).toBe(list.length);
    expect(HELPER_BASELINE).not.toContain(BASENAME);
    expect(list.indexOf(NEXT) - list.indexOf(PREVIOUS)).toBe(1);
    expect(PREVIOUS < BASENAME).toBe(true);
    expect(BASENAME < NEXT).toBe(true);
    expect([...list, BASENAME].sort().indexOf(BASENAME)).toBe(list.indexOf(NEXT));
});

const helperCandidate = mutate(HELPER_BASELINE, `        '${PREVIOUS}',\n`, `        '${PREVIOUS}',\n${HELPER_LINE}`);

test('positive candidate: one sorted supported entry is the only helper change', () => {
    expect(helperCandidate).not.toBe(HELPER_BASELINE);
    expect(helperViolations(helperCandidate)).toEqual([]);
    expect(supported(helperCandidate)).toHaveLength(25);
});

test('helper negative controls: unsorted, duplicate, misspelt, extra entry and behaviour edits', () => {
    const mutants = [
        // After soap-document.css: unsorted, even though it is next to the soap entries.
        mutate(HELPER_BASELINE, `        '${NEXT}',\n`, `        '${NEXT}',\n${HELPER_LINE}`),
        mutate(HELPER_BASELINE, "        'soap-reference.js',\n", `        'soap-reference.js',\n${HELPER_LINE}`),
        mutate(HELPER_BASELINE, "        'patient-results-popup.css',\n", `        'patient-results-popup.css',\n${HELPER_LINE}`),
        mutate(helperCandidate, HELPER_LINE, `${HELPER_LINE}${HELPER_LINE}`),
        mutate(helperCandidate, HELPER_LINE, "        'snomed-howto.css',\n"),
        mutate(helperCandidate, HELPER_LINE, `    '${BASENAME}',\n`),
        mutate(helperCandidate, "        'workspace.css',\n", "        'workspace.css',\n        'zz-extra.css',\n"),
        mutate(helperCandidate, "        'mode.js',\n", ''),
        mutate(helperCandidate, "$mtime === false ? '0'", "$mtime === false ? '1'"),
        mutate(helperCandidate, 'clearstatcache(true, $path);\n', ''),
        mutate(helperCandidate, 'in_array($asset, self::SUPPORTED, true)', 'in_array($asset, self::SUPPORTED)'),
        mutate(helperCandidate, "'/interface/clinical-workspace'", "'/interface/clinical-workspace/'"),
        mutate(helperCandidate, 'final readonly class', 'final class'),
        HELPER_BASELINE,
    ];
    expectDistinctMutants(mutants, helperCandidate);
    for (const mutant of mutants) expect(helperViolations(mutant)).not.toEqual([]);
});

test('actual helper: baseline preserved plus exactly one sorted supported basename', () => {
    expect(helperViolations(read(HELPER))).toEqual([]);
});

// ---------------------------------------------------------------- stylesheet

// Fallbacks restate the tokens popup.css establishes on html.oe-workbench-context.
const PAPER = 'var(--oe-wb-paper, #fff)';
const INK = 'var(--oe-wb-ink, #17343b)';
const PETROL = 'var(--oe-wb-petrol, #086878)';
const FOCUS = { outline: `2px solid ${PETROL}`, 'outline-offset': '2px' };
const EXPECTED_RULES = {
    [SCOPE]: { 'background-color': PAPER, color: INK },
    [`${SCOPE} a`]: { 'background-color': 'transparent', color: PETROL },
    [`${SCOPE} a:focus`]: FOCUS,
    [`${SCOPE} a:focus-visible`]: FOCUS,
};
// Selectors that would explicitly reach the semantic warnings (h5.text-danger).
const WARNING_TARGET = /\bh5\b|\bh[1-6]\b|text-danger|\.text-|\[class|:not\(|\*/;

test('fallbacks match the established popup.css workbench context tokens (source anchor)', () => {
    const tokens = {};
    postcss.parse(read('interface/clinical-workspace/popup.css')).walkRules(rule => {
        if (!rule.selectors.includes('html.oe-workbench-context')) return;
        rule.walkDecls(/^--oe-wb-/, decl => { tokens[decl.prop] = decl.value; });
    });
    expect(PAPER).toBe(`var(--oe-wb-paper, ${tokens['--oe-wb-paper']})`);
    expect(INK).toBe(`var(--oe-wb-ink, ${tokens['--oe-wb-ink']})`);
    expect(PETROL).toBe(`var(--oe-wb-petrol, ${tokens['--oe-wb-petrol']})`);
});

const norm = value => value.replace(/\s+/g, ' ').trim();
const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

const cssViolations = text => {
    if (!text.trim()) return ['stylesheet missing or empty'];
    let tree;
    try {
        tree = postcss.parse(text);
    } catch (error) {
        return [`stylesheet does not parse: ${error.message}`];
    }
    const violations = [];
    const seen = new Set();
    for (const node of tree.nodes) {
        if (!['rule', 'comment'].includes(node.type)) violations.push(`unexpected top-level ${node.type}`);
    }
    tree.walkAtRules(at => violations.push(`unexpected at-rule @${at.name} ${at.params}`));
    tree.walkRules(rule => {
        const selector = norm(rule.selector);
        if (rule.parent !== tree) violations.push(`nested rule ${selector}`);
        for (const part of rule.selectors) {
            if (WARNING_TARGET.test(part)) violations.push(`selector may target the semantic warnings: ${norm(part)}`);
        }
        if (rule.selectors.length !== 1) {
            violations.push(`grouped selector ${selector}`);
            return;
        }
        if (!has(EXPECTED_RULES, selector)) {
            violations.push(`unexpected selector ${selector}`);
            return;
        }
        if (seen.has(selector)) {
            violations.push(`duplicate rule ${selector}`);
            return;
        }
        seen.add(selector);
        const expected = EXPECTED_RULES[selector];
        const found = {};
        for (const node of rule.nodes) {
            if (node.type === 'comment') continue;
            if (node.type !== 'decl') {
                violations.push(`unexpected ${node.type} inside ${selector}`);
                continue;
            }
            if (node.important) violations.push(`!important on ${selector} ${node.prop}`);
            if (!has(expected, node.prop)) {
                violations.push(`unexpected declaration ${selector} { ${node.prop} }`);
                continue;
            }
            if (has(found, node.prop)) {
                violations.push(`duplicate declaration ${selector} { ${node.prop} }`);
                continue;
            }
            found[node.prop] = norm(node.value);
            if (found[node.prop] !== expected[node.prop]) {
                violations.push(`${selector} { ${node.prop}: ${found[node.prop]} } expected ${expected[node.prop]}`);
            }
        }
        for (const prop of Object.keys(expected)) {
            if (!has(found, prop)) violations.push(`missing declaration ${selector} { ${prop} }`);
        }
    });
    for (const selector of Object.keys(EXPECTED_RULES)) {
        if (!seen.has(selector)) violations.push(`missing rule ${selector}`);
    }
    return violations;
};

const BASE_BLOCK = `${SCOPE} {\n  background-color: ${PAPER};\n  color: ${INK};\n}\n`;
const LINK_BLOCK = `${SCOPE} a {\n  background-color: transparent;\n  color: ${PETROL};\n}\n`;
const FOCUS_BLOCK = `${SCOPE} a:focus {\n  outline: 2px solid ${PETROL};\n  outline-offset: 2px;\n}\n`;
const FOCUS_VISIBLE_BLOCK = `${SCOPE} a:focus-visible {\n  outline: 2px solid ${PETROL};\n  outline-offset: 2px;\n}\n`;
const cssCandidate = `/* SNOMED installation details fragment: paper, ink and link palette only. */\n${BASE_BLOCK}\n${LINK_BLOCK}\n${FOCUS_BLOCK}\n${FOCUS_VISIBLE_BLOCK}`;

test('positive candidate: exactly four single-selector scoped rules satisfy the AST allowlist', () => {
    expect(cssViolations(cssCandidate)).toEqual([]);
    const tree = postcss.parse(cssCandidate);
    const rules = tree.nodes.filter(node => node.type === 'rule');
    expect(rules.map(rule => rule.selector)).toEqual(Object.keys(EXPECTED_RULES));
    for (const rule of rules) {
        expect(rule.parent).toBe(tree);
        expect(rule.selectors).toHaveLength(1);
        expect(WARNING_TARGET.test(rule.selector)).toBe(false);
    }
    expect(cssViolations('')).toEqual(['stylesheet missing or empty']);
});

test('stylesheet negative controls: scope, paint, focus grouping, important, geometry, fonts, duplicates, at-rules', () => {
    const grouped = `${SCOPE} a:focus,\n${SCOPE} a:focus-visible {\n  outline: 2px solid ${PETROL};\n  outline-offset: 2px;\n}\n`;
    const mutants = [
        mutateAll(cssCandidate, 'html.oe-workbench-context ', 'body.oe-workbench-context '),
        mutateAll(cssCandidate, 'html.oe-workbench-context ', 'html.oe-workbench-popup '),
        mutateAll(cssCandidate, 'html.oe-workbench-context ', ''),
        mutateAll(cssCandidate, `.${HOOK}`, '.oe-rxnorm-howto-document'),
        mutate(cssCandidate, `background-color: ${PAPER};`, 'background-color: var(--oe-wb-canvas, #f3f7f5);'),
        mutate(cssCandidate, `background-color: ${PAPER};`, `background: ${PAPER};`),
        mutate(cssCandidate, `color: ${INK};`, 'color: var(--oe-wb-ink, #1d2b34);'),
        mutate(cssCandidate, 'background-color: transparent;', `background-color: ${PAPER};`),
        mutate(cssCandidate, '  background-color: transparent;\n', ''),
        mutate(cssCandidate, `  color: ${PETROL};\n`, '  color: var(--oe-wb-danger, #b00020);\n'),
        mutate(cssCandidate, `${FOCUS_BLOCK}\n${FOCUS_VISIBLE_BLOCK}`, grouped),
        mutate(cssCandidate, `\n${FOCUS_VISIBLE_BLOCK}`, ''),
        mutate(cssCandidate, `\n${FOCUS_BLOCK}`, ''),
        mutate(cssCandidate, `color: ${INK};`, `color: ${INK} !important;`),
        mutate(cssCandidate, FOCUS_VISIBLE_BLOCK, FOCUS_VISIBLE_BLOCK.replace('outline-offset: 2px;', 'outline-offset: 2px !important;')),
        mutate(cssCandidate, `color: ${INK};`, `color: ${INK};\n  padding: 1rem;`),
        mutate(cssCandidate, `color: ${INK};`, `color: ${INK};\n  max-width: 60ch;`),
        mutate(cssCandidate, `color: ${INK};`, `color: ${INK};\n  font-size: 1rem;`),
        mutate(cssCandidate, `color: ${INK};`, `color: ${INK};\n  font-family: Arial, sans-serif;`),
        mutate(cssCandidate, `color: ${INK};`, `color: ${INK};\n  color: ${INK};`),
        mutate(cssCandidate, FOCUS_VISIBLE_BLOCK, FOCUS_VISIBLE_BLOCK.replace('outline-offset: 2px;', 'outline-offset: 1px;')),
        mutate(cssCandidate, FOCUS_VISIBLE_BLOCK, FOCUS_VISIBLE_BLOCK.replace('  outline-offset: 2px;\n', '')),
        mutate(cssCandidate, FOCUS_BLOCK, FOCUS_BLOCK.replace(`2px solid ${PETROL}`, `1px dotted ${PETROL}`)),
        mutate(cssCandidate, LINK_BLOCK, LINK_BLOCK.replace('}\n', '  &:hover {\n    color: #000;\n  }\n}\n')),
        `${cssCandidate}\n${BASE_BLOCK}`,
        `${cssCandidate}\n${SCOPE} p {\n  color: ${INK};\n}\n`,
        `${cssCandidate}\n${SCOPE} ol {\n  margin: 0;\n}\n`,
        `${cssCandidate}\nhtml.oe-workbench-context body {\n  background-color: ${PAPER};\n}\n`,
        `@media screen {\n${cssCandidate}}\n`,
        `@import url("popup.css");\n${cssCandidate}`,
        `${cssCandidate}\n@supports (display: grid) {\n${SCOPE} {\n  color: ${INK};\n}\n}\n`,
        `${cssCandidate}\n${SCOPE} {\n`,
    ];
    expectDistinctMutants(mutants, cssCandidate);
    for (const mutant of mutants) expect(cssViolations(mutant)).not.toEqual([]);
});

test('stylesheet negative controls: new CSS cannot target or repaint the semantic warnings', () => {
    const mutants = [
        `${cssCandidate}\n${SCOPE} h5.text-danger {\n  color: ${INK};\n}\n`,
        `${cssCandidate}\n${SCOPE} .text-danger {\n  color: ${INK};\n}\n`,
        `${cssCandidate}\n${SCOPE} h5 {\n  color: ${INK};\n}\n`,
        `${cssCandidate}\n${SCOPE} [class~='text-danger'] {\n  color: ${INK};\n}\n`,
        `${cssCandidate}\n${SCOPE} * {\n  color: ${INK};\n}\n`,
        `${cssCandidate}\n${SCOPE} :not(a) {\n  color: ${INK};\n}\n`,
        mutate(cssCandidate, `${SCOPE} {\n`, `${SCOPE},\n${SCOPE} h5.text-danger {\n`),
        mutate(cssCandidate, `color: ${INK};`, `color: ${INK} !important;`),
    ];
    expectDistinctMutants(mutants, cssCandidate);
    for (const mutant of mutants) expect(cssViolations(mutant)).not.toEqual([]);
    for (const mutant of mutants.slice(0, 7)) {
        expect(cssViolations(mutant).some(v => v.startsWith('selector may target the semantic warnings'))).toBe(true);
    }
});

test('actual stylesheet: exactly the four allowlisted rules and declarations', () => {
    expect(cssViolations(readOptional(STYLESHEET))).toEqual([]);
});

// ---------------------------------------------------------------- unchanged callers (source anchors)

test('source anchor: dataloads caller stays admin/super and opens the fragment as a generic iframe dlgopen', () => {
    const caller = read('interface/code_systems/dataloads_ajax.php');
    expect(count(caller, "if (!AclMain::aclCheckCore('admin', 'super')) {")).toBe(1);
    expect(caller).toContain('$db_list = ["ICD10", "RXNORM", "SNOMED","CQM_VALUESET"];');
    expect(caller).toContain("const dbList = ['ICD9', 'ICD10', 'RXNORM', 'SNOMED', 'CQM_VALUESET'];");
    const open = "dlgopen(`${dbName.toLowerCase()}_howto.php`, '', 800, 250, false, `${dbName} <?php echo xla(\"Installation Details\"); ?>`, {";
    expect(count(caller, open)).toBe(1);
    const start = caller.indexOf(open);
    const call = caller.slice(start, caller.indexOf('});', start) + 3);
    expect(call).toContain('close: true');
    expect(call).toContain('allowDrag: false,');
    expect(call).not.toMatch(/\btype\s*:/);
    expect(call).not.toMatch(/sizeHeight/);
    for (const marker of [BASENAME, HOOK, 'ClinicalWorkspaceAssets']) {
        expect(caller).not.toContain(marker);
    }
});

test('source anchor: dlgopen defaults to an auto-sized iframe with a 300px initial clamp and 94vh cap', () => {
    const dialog = read('library/dialog.js');
    const begin = dialog.indexOf('var opts_defaults = {');
    expect(begin).toBeGreaterThan(-1);
    const defaults = dialog.slice(begin, dialog.indexOf('};', begin));
    expect(defaults).toContain("type: 'iframe', // POST, GET (ajax) or iframe");
    expect(defaults).toContain("sizeHeight: 'auto', // 'full' will use as much height as allowed");
    for (const anchor of [
        "where = (opts.type === 'iframe') ? top : window;",
        "if (height <= 300 && opts.type === 'iframe') {\n        height = 300;\n    }",
        "var contentStyles = ('style=\"height:%initHeight%; max-height: 94vh\"')",
        "if (opts.sizeHeight === 'auto' && opts.type === 'iframe') {\n                            SizeModaliFrame(e, height);",
        'frameContentHt = frameContentHt >= viewPortHt ? viewPortHt : frameContentHt;',
    ]) {
        expect(dialog).toContain(anchor);
    }
});

test('shared workbench engine carries no fragment-specific rules', () => {
    for (const shared of [
        'interface/clinical-workspace/workspace.css',
        'interface/clinical-workspace/popup.css',
        'interface/clinical-workspace/popup.js',
        'library/dialog.js',
    ]) {
        const text = read(shared);
        expect(text).not.toContain('oe-snomed-howto');
        expect(text).not.toContain(BASENAME);
    }
});
