'use strict';

/**
 * OPEMR-59 work/school note print: source contract for the screen-only workbench seam.
 *
 * Portable mode (the default, and what the Jest wrapper runs) restores
 * interface/forms/note/print.php by undoing only the two exact additions and
 * compares the result with the frozen original fixture byte for byte.
 *
 * History mode (`--history` when run directly with node, or
 * OE_SOURCE_CONTRACT_HISTORY=1 under `node --test`) additionally compares the
 * fixture with the route at the fork base, checks that the caller and the shared
 * Header/config/popup assets are unchanged, and enforces the changed-path
 * allowlist. Requested history never skips: a shallow or missing base fails.
 *
 * Nothing here executes the PHP route, bootstraps OpenEMR or makes a request.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const BASE_COMMIT = '18647270e0c799189d2dc10f801e8de2bff1a360';
const ROUTE_PATH = 'interface/forms/note/print.php';
const FIXTURE_PATH = 'tests/fixtures/work-school-note-print.original.txt';
const FIXTURE_SHA256 = '9ec620366f8aea787705a241aff57e23277d446342a79bfd952de90663189e66';

const NEW_FILES = [
    FIXTURE_PATH,
    'tests/source-contracts/work-school-note-print.test.cjs',
    'tests/js/work-school-note-print.test.js',
    'docs/clinical-ui/WORK-SCHOOL-NOTE-PRINT.md',
];
const CHANGED_PATH_ALLOWLIST = new Set([ROUTE_PATH, ...NEW_FILES]);
const UNCHANGED_PATHS = [
    'interface/forms/note/view.php',
    'src/Core/Header.php',
    'config/config.yaml',
    'interface/clinical-workspace/popup.js',
    'interface/clinical-workspace/popup.css',
];

const MARKER = 'oe-work-school-note-print';
const SCOPE = `html.oe-workbench-context body.${MARKER}`;
const HEADER_LINE = '<?php Header::setupHeader(); ?>';

// The only CSS the route may gain. Paint-only; the message div keeps its inline
// black border, padding and margins and the form paper sits behind it.
// Indentation follows the repo stylelint (@stylistic/indentation): selectors
// inside @media at 2 spaces, declarations at 4.
const STYLE_BLOCK = [
    '<style>',
    '@media screen {',
    `  ${SCOPE} {`,
    '    color: var(--oe-wb-ink);',
    '    background-color: var(--oe-wb-canvas);',
    '  }',
    '',
    `  ${SCOPE} > form {`,
    '    color: var(--oe-wb-ink);',
    '    background-color: var(--oe-wb-paper);',
    '    box-shadow: inset 0 0 0 1px var(--oe-wb-line);',
    '  }',
    '',
    `  ${SCOPE} > form .title,`,
    `  ${SCOPE} > form .text {`,
    '    color: var(--oe-wb-ink);',
    '    background-color: var(--oe-wb-paper);',
    '  }',
    '}',
    '</style>',
].join('\n');

// The superseded 4/8-space layout, which fails stylelint. Kept only so a mutant
// proves the verifier rejects it.
const PREVIOUS_INDENT_STYLE_BLOCK = [
    '<style>',
    '@media screen {',
    `    ${SCOPE} {`,
    '        color: var(--oe-wb-ink);',
    '        background-color: var(--oe-wb-canvas);',
    '    }',
    '',
    `    ${SCOPE} > form {`,
    '        color: var(--oe-wb-ink);',
    '        background-color: var(--oe-wb-paper);',
    '        box-shadow: inset 0 0 0 1px var(--oe-wb-line);',
    '    }',
    '',
    `    ${SCOPE} > form .title,`,
    `    ${SCOPE} > form .text {`,
    '        color: var(--oe-wb-ink);',
    '        background-color: var(--oe-wb-paper);',
    '    }',
    '}',
    '</style>',
].join('\n');

const ORIGINAL_SEAM = `${HEADER_LINE}\n\n</head>\n<body class="body_top">\n`;
const PRODUCTION_SEAM = `${HEADER_LINE}\n\n${STYLE_BLOCK}\n\n</head>\n<body class="body_top ${MARKER}">\n`;

const EXPECTED_RULES = [
    {
        selectors: [SCOPE],
        declarations: [['color', 'var(--oe-wb-ink)'], ['background-color', 'var(--oe-wb-canvas)']],
    },
    {
        selectors: [`${SCOPE} > form`],
        declarations: [
            ['color', 'var(--oe-wb-ink)'],
            ['background-color', 'var(--oe-wb-paper)'],
            ['box-shadow', 'inset 0 0 0 1px var(--oe-wb-line)'],
        ],
    },
    {
        selectors: [`${SCOPE} > form .title`, `${SCOPE} > form .text`],
        declarations: [['color', 'var(--oe-wb-ink)'], ['background-color', 'var(--oe-wb-paper)']],
    },
];
const COLOUR_VALUE = /^var\(--oe-wb-(ink|paper|canvas)\)$/;
const SHADOW_VALUE = 'inset 0 0 0 1px var(--oe-wb-line)';

function fail(area, message) {
    throw new Error(`work/school note print ${area} contract: ${message}`);
}

function count(haystack, needle) {
    let total = 0;
    for (let at = haystack.indexOf(needle); at !== -1; at = haystack.indexOf(needle, at + needle.length)) {
        total++;
    }
    return total;
}

function firstDifference(a, b) {
    const limit = Math.min(a.length, b.length);
    for (let i = 0; i < limit; i++) {
        if (a[i] !== b[i]) return i;
    }
    return limit;
}

// latin1 maps each byte to one code unit, so string comparison is byte comparison.
function readText(relative) {
    return fs.readFileSync(path.join(REPO_ROOT, relative)).toString('latin1');
}

function checkStyleBlock(block) {
    const head = '<style>\n@media screen {\n';
    const tail = '\n}\n</style>';
    if (!block.startsWith(head) || !block.endsWith(tail)) {
        fail('style', 'the inline block must be one <style> wholly inside @media screen');
    }
    if (count(block, '@media') !== 1) fail('style', 'exactly one @media screen query; no print or other media rules');
    if (block.includes('!important')) fail('style', '!important is not allowed');

    const inner = block.slice(head.length, block.length - tail.length);
    if (inner.includes('@')) fail('style', 'nested at-rules are not allowed');

    const rules = [];
    const rest = inner.replace(/([^{}]+)\{([^{}]*)\}/g, (whole, selectorText, body) => {
        const lines = selectorText.trim().split('\n').map((line) => line.trim());
        const selectors = lines.map((line, index) => {
            const last = index === lines.length - 1;
            if (!last && !line.endsWith(',')) fail('style', `grouped selectors must each sit on their own line: ${line}`);
            const selector = last ? line : line.slice(0, -1);
            if (selector.includes(',')) fail('style', `grouped selectors must each sit on their own line: ${line}`);
            if (!selector.startsWith(SCOPE)) fail('style', `unscoped selector: ${selector}`);
            return selector;
        });
        const declarations = body.split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
            const match = /^([a-z-]+): (.+)$/.exec(part);
            if (!match) fail('style', `unparseable declaration: ${part}`);
            const [, property, value] = match;
            if (property === 'box-shadow') {
                if (value !== SHADOW_VALUE) fail('style', `box-shadow must be ${SHADOW_VALUE}`);
            } else if (property === 'color' || property === 'background-color') {
                if (!COLOUR_VALUE.test(value)) fail('style', `${property} must use a workbench ink/paper/canvas token: ${value}`);
            } else {
                fail('style', `property not allowed (no geometry, font, border, outline or layout): ${property}`);
            }
            return [property, value];
        });
        rules.push({ selectors, declarations });
        return '';
    });
    if (rest.trim() !== '') fail('style', 'CSS outside the three rules');
    try {
        assert.deepStrictEqual(rules, EXPECTED_RULES);
    } catch {
        fail('style', 'rules must be exactly the body canvas, form paper and title/text ink-paper pairs');
    }
    if (block !== STYLE_BLOCK) fail('style', `exact text differs at offset ${firstDifference(block, STYLE_BLOCK)}`);
}

/**
 * Undo only the two exact additions. Throws when the seam is not present exactly once.
 */
function restoreOriginal(source) {
    if (count(source, PRODUCTION_SEAM) !== 1) {
        fail('seam', 'the style block must sit directly after Header::setupHeader() and before </head>, with the marker appended to the existing body class');
    }
    return source.replace(PRODUCTION_SEAM, () => ORIGINAL_SEAM);
}

/**
 * Accept the production route only if it is the original plus the exact seam.
 * Returns the restored original text.
 */
function verifyProduction(source, original) {
    if (typeof source !== 'string' || typeof original !== 'string') throw new TypeError('source and original must be strings');
    if (count(source, '<style') !== 1 || count(source, '</style>') !== 1) {
        fail('style', 'expected exactly one inline <style> element');
    }
    const start = source.indexOf('<style');
    const end = source.indexOf('</style>') + '</style>'.length;
    if (end <= start) fail('style', 'malformed <style> element');
    checkStyleBlock(source.slice(start, end));

    const bodyTag = `<body class="body_top ${MARKER}">`;
    if (count(source, bodyTag) !== 1 || count(source, MARKER) !== count(STYLE_BLOCK, MARKER) + 1) {
        fail('marker', `the marker must be appended once to the existing body class (${bodyTag}) and appear nowhere else`);
    }

    const restored = restoreOriginal(source);
    if (restored !== original) {
        fail('original', `restored source differs from the frozen original at byte ${firstDifference(restored, original)}`);
    }
    return restored;
}

let fixtureCache = null;
function readFixture() {
    fixtureCache ??= readText(FIXTURE_PATH);
    return fixtureCache;
}

function replaceOnce(source, anchor, replacement) {
    assert.equal(count(source, anchor), 1, `anchor must be unique: ${JSON.stringify(anchor)}`);
    return source.replace(anchor, () => replacement);
}

// Written independently of STYLE_BLOCK so a drift between the two shows up here.
function buildPositiveSynthetic(original) {
    const style = `<style>
@media screen {
  html.oe-workbench-context body.oe-work-school-note-print {
    color: var(--oe-wb-ink);
    background-color: var(--oe-wb-canvas);
  }

  html.oe-workbench-context body.oe-work-school-note-print > form {
    color: var(--oe-wb-ink);
    background-color: var(--oe-wb-paper);
    box-shadow: inset 0 0 0 1px var(--oe-wb-line);
  }

  html.oe-workbench-context body.oe-work-school-note-print > form .title,
  html.oe-workbench-context body.oe-work-school-note-print > form .text {
    color: var(--oe-wb-ink);
    background-color: var(--oe-wb-paper);
  }
}
</style>`;
    let out = replaceOnce(original, '<?php Header::setupHeader(); ?>\n\n</head>\n', `<?php Header::setupHeader(); ?>\n\n${style}\n\n</head>\n`);
    out = replaceOnce(out, '<body class="body_top">', '<body class="body_top oe-work-school-note-print">');
    return out;
}

const STYLE_MUTANTS = [
    ['media switched to print', [['@media screen {', '@media print {']]],
    ['media widened to all', [['@media screen {', '@media all {']]],
    ['print rule appended', [['  }\n}\n</style>', '  }\n}\n@media print {\n  body {\n    color: #000;\n  }\n}\n</style>']]],
    ['body selector unscoped', [[`  ${SCOPE} {\n`, `  body.${MARKER} {\n`]]],
    ['form rule moved to popup context', [[`${SCOPE} > form {`, `html.oe-workbench-popup body.${MARKER} > form {`]]],
    ['form paper swapped for canvas', [['background-color: var(--oe-wb-paper);\n    box-shadow', 'background-color: var(--oe-wb-canvas);\n    box-shadow']]],
    ['body canvas swapped for paper', [['background-color: var(--oe-wb-canvas);', 'background-color: var(--oe-wb-paper);']]],
    ['text ink replaced by a literal colour', [['> form .text {\n    color: var(--oe-wb-ink);', '> form .text {\n    color: #000;']]],
    ['!important added', [[`box-shadow: ${SHADOW_VALUE};`, `box-shadow: ${SHADOW_VALUE} !important;`]]],
    ['padding added', [[`box-shadow: ${SHADOW_VALUE};`, `box-shadow: ${SHADOW_VALUE};\n    padding: 12px;`]]],
    ['margin added', [[`box-shadow: ${SHADOW_VALUE};`, `box-shadow: ${SHADOW_VALUE};\n    margin: 0 auto;`]]],
    ['border replaces the inset shadow', [[`box-shadow: ${SHADOW_VALUE};`, 'border: 1px solid var(--oe-wb-line);']]],
    ['radius added', [[`box-shadow: ${SHADOW_VALUE};`, `box-shadow: ${SHADOW_VALUE};\n    border-radius: 8px;`]]],
    ['outline added', [[`box-shadow: ${SHADOW_VALUE};`, `box-shadow: ${SHADOW_VALUE};\n    outline: 1px solid var(--oe-wb-line);`]]],
    ['font added to title/text', [['> form .text {\n    color: var(--oe-wb-ink);', '> form .text {\n    font-size: 1rem;\n    color: var(--oe-wb-ink);']]],
    ['controls restyled', [[`  ${SCOPE} > form .title,\n`, `  ${SCOPE} > form select,\n  ${SCOPE} > form .title,\n`]]],
    ['grouped selectors collapsed onto one line', [[`> form .title,\n  ${SCOPE} > form .text {`, `> form .title, ${SCOPE} > form .text {`]]],
    ['style block duplicated', [['</head>\n', `${STYLE_BLOCK}\n</head>\n`]]],
    // Semantically identical to STYLE_BLOCK; only the exact-text oracle can reject it.
    ['previous 4/8-space style indentation', [[STYLE_BLOCK, PREVIOUS_INDENT_STYLE_BLOCK]]],
];

const MARKER_MUTANTS = [
    ['marker moved before the existing body class', [[`<body class="body_top ${MARKER}">`, `<body class="${MARKER} body_top">`]]],
    ['marker dropped from body', [[`<body class="body_top ${MARKER}">`, '<body class="body_top">']]],
    ['marker added to html', [['<html><head>', `<html class="${MARKER}"><head>`]]],
];

const SEAM_MUTANTS = [
    ['style block moved before Header setup', [
        [`${HEADER_LINE}\n\n${STYLE_BLOCK}\n\n</head>`, `${HEADER_LINE}\n\n</head>`],
        [HEADER_LINE, `${STYLE_BLOCK}\n${HEADER_LINE}`],
    ]],
    ['Header asset list changed', [['Header::setupHeader();', "Header::setupHeader('datetime-picker');"]]],
];

const ORIGINAL_MUTANTS = [
    ['ACL gate removed', [['EncounterFormAccess::assertFormBelongsToSessionPatient($formId, $form_name);\n', '']]],
    ['formId parsing loosened', [['$formId = is_int($formIdInput) && $formIdInput >= 0 ? $formIdInput : 0;', "$formId = (int) $_GET['id'];"]]],
    ['formId input source changed', [["filter_input(INPUT_GET, 'id', FILTER_VALIDATE_INT)", "filter_input(INPUT_POST, 'id', FILTER_VALIDATE_INT)"]]],
    ['provider query interpolated', [['sqlQuery("select fname, lname from users where username=?", [$session->get(\'authUser\')])', 'sqlQuery("select fname, lname from users where username=\'" . $session->get(\'authUser\') . "\'")']]],
    ['session source changed', [['$session = SessionWrapperFactory::getInstance()->getActiveSession();', '$session = $_SESSION;']]],
    ['record fetch changed', [['$obj = formFetch("form_" . $form_name, $formId);', '$obj = formFetch("form_" . $form_name, $formId, "", "id");']]],
    ['message escaping removed', [['<?php echo text($obj["message"]);?>', '<?php echo $obj["message"];?>']]],
    ['doctor escaping removed', [['attr($obj["doctor"])', '$obj["doctor"]']]],
    ['date escaping removed', [["attr(oeFormatShortDate($obj['date_of_signature']))", "oeFormatShortDate($obj['date_of_signature'])"]]],
    ['document title changed', [['<title><?php echo "Form: note"?></title>', '<title><?php echo xlt("Work/School Note"); ?></title>']]],
    ['heading translation removed', [["<?php echo xlt('Work/School Note'); ?>", 'Work/School Note']]],
    ['message label translation changed', [["xlt('MESSAGE:')", "xla('MESSAGE:')"]]],
    ['message border restyled', [['border: 1px solid black; padding: 5px; margin: 5px;', 'border: 1px solid var(--oe-wb-line); padding: 5px; margin: 5px;']]],
    ['note type select disabled', [['<select name="note_type">', '<select name="note_type" disabled>']]],
    ['work note selection changed', [['<option value="WORK NOTE" <?php if ($obj[\'note_type\'] == "WORK NOTE") {', '<option value="WORK NOTE" <?php if ($obj[\'note_type\'] === "WORK NOTE") {']]],
    ['doctor field made readonly', [['<input type=text name="doctor"', '<input type=text readonly name="doctor"']]],
    ['date field given the datepicker', [["name='date_of_signature' id='date_of_signature'", "class='datepicker' name='date_of_signature' id='date_of_signature'"]]],
    ['printLogPrint call removed', [['    win.printLogPrint(window);\n', '']]],
    ['printLogPrint target changed', [['var win = top.printLogPrint ? top : opener.top;', 'var win = top;']]],
    ['wrapper added around the form', [['<form method=post action="">', '<div class="oe-wb-sheet"><form method=post action="">']]],
    ['trailing whitespace drift', [["$returnurl = 'encounter_top.php';", "$returnurl = 'encounter_top.php'; "]]],
    ['extra newline at end of file', [['</html>\n', '</html>\n\n']]],
    ['byte order mark prepended', [['<?php\n\n/*', 'ï»¿<?php\n\n/*']]],
    ['header comment edited', [[' * Work/School Note Form print.php', ' * Work/School Note Form print.php (workbench)']]],
];

function mutantCases(group, expect, mutants) {
    return mutants.map(([label, steps]) => ({
        name: `rejects ${group} mutant: ${label}`,
        run() {
            const original = readFixture();
            const positive = buildPositiveSynthetic(original);
            let mutated = positive;
            for (const [anchor, replacement] of steps) mutated = replaceOnce(mutated, anchor, replacement);
            assert.notEqual(mutated, positive, 'mutant must change the synthetic production source');
            assert.throws(() => verifyProduction(mutated, original), expect);
        },
    }));
}

const portableCases = [
    {
        name: 'fixture is the frozen original route at the recorded SHA-256',
        run() {
            const bytes = fs.readFileSync(path.join(REPO_ROOT, FIXTURE_PATH));
            assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), FIXTURE_SHA256);
        },
    },
    {
        name: 'fixture is the complete pre-seam route',
        run() {
            const original = readFixture();
            assert.ok(original.startsWith('<?php\n\n/*\n * Work/School Note Form print.php\n'));
            assert.ok(original.endsWith('\n</html>\n'));
            assert.equal(count(original, ORIGINAL_SEAM), 1);
            assert.equal(count(original, MARKER), 0);
            assert.equal(count(original, '<style'), 0);
            assert.equal(count(original, '@media'), 0);
            assert.equal(count(original, 'EncounterFormAccess::assertFormBelongsToSessionPatient($formId, $form_name);'), 1);
            assert.equal(count(original, 'win.printLogPrint(window);'), 1);
        },
    },
    {
        name: 'positive synthetic production passes and restores every original byte',
        run() {
            const original = readFixture();
            const positive = buildPositiveSynthetic(original);
            assert.equal(verifyProduction(positive, original), original);
            assert.equal(positive.length - original.length, `${STYLE_BLOCK}\n\n`.length + ` ${MARKER}`.length);
        },
    },
    {
        name: 'restore undoes only the two exact additions',
        run() {
            const original = readFixture();
            const positive = buildPositiveSynthetic(original);
            const restored = restoreOriginal(positive);
            assert.equal(restored, original);
            assert.equal(restored.replace(ORIGINAL_SEAM, () => PRODUCTION_SEAM), positive);
        },
    },
    {
        name: 'the unmodified original is rejected (verifier is not vacuous)',
        run() {
            const original = readFixture();
            assert.throws(() => verifyProduction(original, original), /work\/school note print style contract/);
            assert.throws(() => restoreOriginal(original), /work\/school note print seam contract/);
        },
    },
    {
        name: 'current print.php is the original plus the exact seam',
        run() {
            const original = readFixture();
            assert.equal(verifyProduction(readText(ROUTE_PATH), original), original);
        },
    },
    {
        name: 'rejects arbitrary drift: CRLF line endings',
        run() {
            const original = readFixture();
            const positive = buildPositiveSynthetic(original);
            const mutated = positive.replace(/\n/g, '\r\n');
            assert.notEqual(mutated, positive, 'mutant must change the synthetic production source');
            assert.throws(() => verifyProduction(mutated, original), /work\/school note print style contract/);
        },
    },
    ...mutantCases('style', /work\/school note print style contract/, STYLE_MUTANTS),
    ...mutantCases('marker', /work\/school note print marker contract/, MARKER_MUTANTS),
    ...mutantCases('seam', /work\/school note print seam contract/, SEAM_MUTANTS),
    ...mutantCases('original', /work\/school note print original contract/, ORIGINAL_MUTANTS),
];

function git(args) {
    try {
        return execFileSync('git', args, { cwd: REPO_ROOT, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (error) {
        throw new Error(`history requested but \`git ${args.join(' ')}\` failed; a shallow or incomplete clone cannot satisfy --history`, { cause: error });
    }
}

function nulList(buffer) {
    return buffer.toString('utf8').split('\0').filter(Boolean);
}

const historyCases = [
    {
        name: 'fork base is present and is an ancestor of HEAD',
        run() {
            git(['cat-file', '-e', `${BASE_COMMIT}^{commit}`]);
            git(['merge-base', '--is-ancestor', BASE_COMMIT, 'HEAD']);
        },
    },
    {
        name: 'fixture equals the base route byte for byte',
        run() {
            const base = git(['show', `${BASE_COMMIT}:${ROUTE_PATH}`]);
            const fixture = fs.readFileSync(path.join(REPO_ROOT, FIXTURE_PATH));
            assert.ok(base.equals(fixture), `fixture differs from ${BASE_COMMIT}:${ROUTE_PATH}`);
        },
    },
    {
        name: 'caller, Header, config and popup assets are unchanged from base',
        run() {
            for (const relative of UNCHANGED_PATHS) {
                const base = git(['show', `${BASE_COMMIT}:${relative}`]);
                const current = fs.readFileSync(path.join(REPO_ROOT, relative));
                assert.ok(base.equals(current), `${relative} changed since ${BASE_COMMIT}`);
            }
        },
    },
    {
        name: 'changed paths stay within the allowlist and include all four new files',
        run() {
            const changed = new Set([
                ...nulList(git(['diff', '--name-only', '--no-renames', '-z', BASE_COMMIT, '--'])),
                ...nulList(git(['ls-files', '--others', '--exclude-standard', '-z'])),
            ]);
            assert.deepEqual([...changed].filter((file) => !CHANGED_PATH_ALLOWLIST.has(file)).sort(), []);
            assert.deepEqual(NEW_FILES.filter((file) => !changed.has(file)), []);
        },
    },
];

module.exports = { verifyProduction, restoreOriginal, portableCases };

if (require.main === module) {
    const { test } = require('node:test');
    const history = process.argv.includes('--history') || process.env.OE_SOURCE_CONTRACT_HISTORY === '1';
    for (const { name, run } of portableCases) test(name, run);
    if (history) {
        for (const { name, run } of historyCases) test(`history: ${name}`, run);
    }
}
