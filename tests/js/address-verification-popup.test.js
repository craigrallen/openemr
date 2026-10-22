/** @jest-environment node */

// OPEMR-20: Address Verification popup (interface/practice/address_verify.php).
//
// Source-only contract. These tests read files as text; they never execute PHP,
// globals.php, Header::setupHeader() or USPSAddressVerifyV3, never send a request to
// the route (a GET can contact USPS) and never read credentials. The caller and USPS
// service anchors are read-only source pins, not an authorization or security audit,
// and the canvas/paper/ink rules are source rules, not effective-cascade or contrast
// acceptance: the text-danger and text-success semantic colours keep their own paint
// and their contrast on the changed backdrop stays open. The route has no controls,
// so no focus rule is allowed. The original route's quirks (the never closed <p>,
// the single closing </div>) stay byte identical.

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

const ROUTE = 'interface/practice/address_verify.php';
const CALLER = 'interface/patient_file/summary/demographics_full.php';
const SERVICE = 'src/USPS/USPSAddressVerifyV3.php';
const STYLESHEET = 'interface/clinical-workspace/address-verification-popup.css';
const HELPER = 'src/Common/Assets/ClinicalWorkspaceAssets.php';
const FIXTURE = 'tests/clinical-ui/fixtures/address-verification-popup-original.txt';
const BASENAME = 'address-verification-popup.css';
const SCREEN_HOOK = 'oe-address-verification-screen';
const DOCUMENT_HOOK = 'oe-address-verification-document';
const CONTEXT = 'html.oe-workbench-context';

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

const ASSETS_IMPORT = 'use OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;';
const HEADER_IMPORT = 'use OpenEMR\\Core\\Header;';
const GLOBALS_IMPORT = 'use OpenEMR\\Core\\OEGlobalsBag;';
const USPS_IMPORT = 'use OpenEMR\\USPS\\USPSAddressVerifyV3;';
const IMPORTS = [ASSETS_IMPORT, HEADER_IMPORT, GLOBALS_IMPORT, USPS_IMPORT];
const HEADER_LINE = '$output .= Header::setupHeader([], false);\n';
const LINK_LINE = `$output .= '<link rel="stylesheet" href="' . attr(OEGlobalsBag::getInstance()->getWebRoot()) . '/interface/clinical-workspace/${BASENAME}?v=' . attr_url((new ClinicalWorkspaceAssets())->version('${BASENAME}')) . '" media="screen">';\n`;
const BODY = "<body class='text-left'>";
const HOOKED_BODY = `<body class='text-left ${SCREEN_HOOK}'>`;
const CONTAINER = "<div class='container'>";
const HOOKED_CONTAINER = `<div class='container ${DOCUMENT_HOOK}'>`;
const TRAILING = '$output .= "</div></body></html>";\n\necho $output;\n';

// The permitted route additions as [original, presented].
const ROUTE_EDITS = [
    [`${HEADER_IMPORT}\n`, `${ASSETS_IMPORT}\n${HEADER_IMPORT}\n${GLOBALS_IMPORT}\n`],
    [HEADER_LINE, `${HEADER_LINE}${LINK_LINE}`],
    [BODY, HOOKED_BODY],
    [CONTAINER, HOOKED_CONTAINER],
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

// Verbatim original source, each exactly once: gate, mappings, defaults, comparison,
// semantic classes, escaping, error path and output assembly.
const PRESERVED = [
    'require_once("../globals.php");\n',
    `${USPS_IMPORT}\n`,
    '$verify = new USPSAddressVerifyV3();\n',
    "$output = '<!DOCTYPE html><html>';\n",
    HEADER_LINE,
    '       <p>";\n',
    `if (!$verify->isConfigured()) {\n    $output .= "<div class='text-danger'>";\n    $output .= text("USPS API v3 credentials not configured. Please set Client ID and Client Secret in Administration > Globals > Connectors.");\n    $output .= "</div>";\n} else {\n`,
    `    $success = $verify->verify(\n        $_GET['address1'] ?? '',      // streetAddress (primary)\n        $_GET['address2'] ?? '',      // secondaryAddress (apt/suite)\n        $_GET['city'] ?? '',\n        $_GET['state'] ?? '',\n        $_GET['zip5'] ?? '',\n        $_GET['zip4'] ?? ''\n    );\n`,
    `    if ($success) {\n        $address = $verify->getAddress();\n\n        if ($address) {\n`,
    `            $inputMap = [\n                'streetAddress' => $_GET['address1'] ?? '',\n                'secondaryAddress' => $_GET['address2'] ?? '',\n                'city' => $_GET['city'] ?? '',\n                'state' => $_GET['state'] ?? '',\n                'ZIPCode' => $_GET['zip5'] ?? '',\n                'ZIPPlus4' => $_GET['zip4'] ?? ''\n            ];\n`,
    `            foreach ($address as $key => $value) {\n                $inputValue = $inputMap[$key] ?? '';\n                if (strcasecmp((string) $inputValue, (string) $value) !== 0) {\n                    $output .= "<div class='text-danger'>";\n                } else {\n                    $output .= "<div class='text-success'>";\n                }\n                $output .= text($key) . ": " . text($value) . "</div>";\n            }\n`,
    `    } else {\n        $output .= "<div class='text-danger'>";\n        $output .= 'Error: ' . text($verify->getErrorMessage()) . "</div>";\n    }\n}\n`,
    TRAILING,
];

const routeViolations = php => {
    const violations = [];
    // Complete source preservation: undoing the permitted additions must give back the
    // frozen original byte for byte, which also catches wrappers and any other change.
    if (restoreRoute(php) !== original()) violations.push('only the permitted additions may differ from the original route byte for byte');
    if (count(php, LINK_LINE) !== 1) violations.push('escaped versioned screen link must appear exactly once');
    if (count(php, `${HEADER_LINE}${LINK_LINE}$output .= "${HOOKED_BODY}\n`) !== 1) {
        violations.push('link must directly follow Header::setupHeader() and precede the body');
    }
    if (count(php, BASENAME) !== 2) violations.push('basename must appear only in the link href and version()');
    if (count(php, '<link') !== 1) violations.push('exactly one <link> may be added');
    const uses = php.match(/^use [^;\n]+;$/gm) || [];
    if (JSON.stringify(uses) !== JSON.stringify(IMPORTS)) violations.push('imports must be the original set plus ClinicalWorkspaceAssets and OEGlobalsBag');
    if (JSON.stringify(uses) !== JSON.stringify([...uses].sort())) violations.push('imports must be sorted');
    if (count(php, HOOKED_BODY) !== 1 || count(php, SCREEN_HOOK) !== 1 || count(php, '<body') !== 1) {
        violations.push('screen hook must be appended once to the original text-left body');
    }
    if (count(php, HOOKED_CONTAINER) !== 1 || count(php, DOCUMENT_HOOK) !== 1 || count(php, "<div class='container") !== 1) {
        violations.push('document hook must be appended once to the single container');
    }
    for (const anchor of PRESERVED) {
        if (count(php, anchor) !== 1) violations.push(`original source must stay unchanged once: ${anchor.trim().split('\n')[0]}`);
    }
    if (count(php, '<p>') !== 1 || count(php, '</p>') !== 0) violations.push('the original unclosed <p> must stay unclosed');
    if (count(php, '<style') !== 0 || count(php, '<script') !== 0 || count(php, ' style=') !== 0) violations.push('no style, script or inline style may be added');
    if (!php.endsWith(TRAILING) || php.includes('\r')) violations.push('closing output and LF line endings must stay byte identical');
    return violations;
};

test('fixture is the original 75-line Address Verification route', () => {
    const fixture = original();
    expect(fixture.replace(/\n+$/, '').split('\n')).toHaveLength(75);
    expect(fixture.startsWith('<?php\n')).toBe(true);
    expect(fixture.endsWith(TRAILING)).toBe(true);
    expect(fixture.endsWith('\n\n')).toBe(false);
    expect(fixture).not.toContain('\r');
    expect(fixture).not.toContain('\t');
    for (const [before] of ROUTE_EDITS) expect(count(fixture, before)).toBe(1);
    for (const anchor of PRESERVED) expect(count(fixture, anchor)).toBe(1);
    expect(fixture.match(/^use [^;\n]+;$/gm)).toEqual([HEADER_IMPORT, USPS_IMPORT]);
    expect(count(fixture, "$_GET['")).toBe(12);
    expect(count(fixture, 'text(')).toBe(4);
    expect(count(fixture, "class='text-danger'")).toBe(3);
    expect(count(fixture, "class='text-success'")).toBe(1);
    expect(count(fixture, '$output .= ')).toBe(11);
    expect(count(fixture, '<p>')).toBe(1);
    expect(count(fixture, '</p>')).toBe(0);
    for (const marker of [BASENAME, SCREEN_HOOK, DOCUMENT_HOOK, 'ClinicalWorkspaceAssets', 'OEGlobalsBag', '<link', '<style', '<script']) {
        expect(fixture).not.toContain(marker);
    }
});

const routeCandidate = applyRouteEdits(original());

test('positive candidate: permitted additions restore exactly and satisfy the route contract', () => {
    expect(routeCandidate).not.toBe(original());
    expect(restoreRoute(routeCandidate)).toBe(original());
    expect(routeViolations(routeCandidate)).toEqual([]);
    expect(routeCandidate.match(/^use [^;\n]+;$/gm)).toEqual(IMPORTS);
    expect(routeViolations(original())).not.toEqual([]);
    expect(restoreRoute(original())).toBeNull();
});

test('route negative controls: mappings, defaults, comparison, gate, semantic classes, escaping, output, control flow, bytes', () => {
    const mutants = [
        mutate(routeCandidate, "$_GET['address1'] ?? '',      //", "$_GET['address2'] ?? '',      //"),
        mutate(routeCandidate, "'ZIPCode' => $_GET['zip5']", "'ZIPCode' => $_GET['zip4']"),
        mutate(routeCandidate, "'ZIPPlus4' => $_GET['zip4']", "'ZIPPlus4' => $_GET['zip5']"),
        mutate(routeCandidate, "'streetAddress' => ", "'street' => "),
        mutate(routeCandidate, "        $_GET['city'] ?? '',\n", "        $_REQUEST['city'] ?? '',\n"),
        mutate(routeCandidate, "$inputMap[$key] ?? ''", '$inputMap[$key] ?? null'),
        mutate(routeCandidate, 'strcasecmp(', 'strcmp('),
        mutate(routeCandidate, '(string) $value) !== 0', '(string) $value) === 0'),
        mutate(routeCandidate, 'strcasecmp((string) $inputValue,', 'strcasecmp($inputValue,'),
        mutate(routeCandidate, 'if (!$verify->isConfigured()) {', 'if ($verify->isConfigured()) {'),
        mutate(routeCandidate, `$output .= "<div class='text-danger'>";\n    $output .= text("USPS`, `$output .= "<div class='text-warning'>";\n    $output .= text("USPS`),
        mutate(routeCandidate, `!== 0) {\n                    $output .= "<div class='text-danger'>";`, `!== 0) {\n                    $output .= "<div class='text-warning'>";`),
        mutate(routeCandidate, "\"<div class='text-success'>\"", "\"<div class='text-info'>\""),
        mutate(routeCandidate, `$output .= "<div class='text-danger'>";\n        $output .= 'Error: '`, `$output .= "<div class='text-muted'>";\n        $output .= 'Error: '`),
        mutate(routeCandidate, '$output .= text("USPS', '$output .= ("USPS'),
        mutate(routeCandidate, 'text($key) . ": "', '$key . ": "'),
        mutate(routeCandidate, '": " . text($value) . "</div>"', '": " . $value . "</div>"'),
        mutate(routeCandidate, 'text($verify->getErrorMessage())', '$verify->getErrorMessage()'),
        mutate(routeCandidate, 'echo $output;', 'print $output;'),
        mutate(routeCandidate, "$output = '<!DOCTYPE html><html>';", "$output = '<html>';"),
        mutate(routeCandidate, '$output .= "</div></body></html>";', '$output .= "</p></div></body></html>";'),
        mutate(routeCandidate, 'Header::setupHeader([], false)', "Header::setupHeader(['common'], false)"),
        mutate(routeCandidate, 'if ($success) {', 'if ($success === true) {'),
        mutate(routeCandidate, 'if ($address) {', 'if (!empty($address)) {'),
        mutate(routeCandidate, '$verify->getAddress()', '$verify->getRawResponse()'),
        mutate(routeCandidate, 'require_once("../globals.php");', 'require_once(__DIR__ . "/../globals.php");'),
        mutate(routeCandidate, '// Map input to v3 response field names for comparison', '// Map input to v3 field names'),
        mutate(routeCandidate, '@author    Vincent Gabriel\n', '@author    V. Gabriel\n'),
        mutate(routeCandidate, '       <p>";', '      <p>";'),
        mutate(routeCandidate, 'echo $output;\n', 'echo $output;\r\n'),
        `${routeCandidate}\n`,
    ];
    expectDistinctMutants(mutants, routeCandidate);
    for (const mutant of mutants) {
        expect(restoreRoute(mutant)).not.toBe(original());
        expect(routeViolations(mutant)).not.toEqual([]);
    }
});

test('route negative controls: imports, link attributes, media, path, version, hooks, wrappers and inline additions', () => {
    const mutants = [
        mutate(routeCandidate, `${ASSETS_IMPORT}\n`, ''),
        mutate(routeCandidate, `${GLOBALS_IMPORT}\n`, ''),
        mutate(routeCandidate, `${ASSETS_IMPORT}\n${HEADER_IMPORT}\n`, `${HEADER_IMPORT}\n${ASSETS_IMPORT}\n`),
        mutate(routeCandidate, `${GLOBALS_IMPORT}\n`, `${GLOBALS_IMPORT}\nuse OpenEMR\\Core\\Kernel;\n`),
        mutate(routeCandidate, 'attr(OEGlobalsBag::getInstance()->getWebRoot())', 'OEGlobalsBag::getInstance()->getWebRoot()'),
        mutate(routeCandidate, 'attr_url((new', 'attr((new'),
        mutate(routeCandidate, `attr_url((new ClinicalWorkspaceAssets())->version('${BASENAME}'))`, "attr_url('1')"),
        mutate(routeCandidate, 'rel="stylesheet"', 'rel="preload"'),
        mutate(routeCandidate, 'media="screen"', 'media="all"'),
        mutate(routeCandidate, ' media="screen"', ''),
        mutate(routeCandidate, '" media="screen">\';', '" media="screen" />\';'),
        mutate(routeCandidate, `'/interface/clinical-workspace/${BASENAME}?v='`, `'/public/assets/${BASENAME}?v='`),
        mutate(routeCandidate, `${BASENAME}?v=`, `${BASENAME}?`),
        mutate(routeCandidate, `version('${BASENAME}')`, "version('workspace.css')"),
        mutate(routeCandidate, `${HEADER_LINE}${LINK_LINE}`, `${LINK_LINE}${HEADER_LINE}`),
        mutate(routeCandidate, LINK_LINE, `${LINK_LINE}${LINK_LINE}`),
        mutate(routeCandidate, LINK_LINE, `${LINK_LINE}$output .= '<link rel="stylesheet" href="https://fonts.example/inter.css">';\n`),
        mutate(routeCandidate, LINK_LINE, `${LINK_LINE}$output .= '<style>.${DOCUMENT_HOOK} { padding: 0; }</style>';\n`),
        mutate(routeCandidate, LINK_LINE, `${LINK_LINE}$output .= '<script>document.title = "x";</script>';\n`),
        mutate(routeCandidate, HOOKED_BODY, BODY),
        mutate(routeCandidate, HOOKED_BODY, `<body class='${SCREEN_HOOK} text-left'>`),
        mutate(routeCandidate, HOOKED_BODY, `<body class='${SCREEN_HOOK}'>`),
        mutate(routeCandidate, HOOKED_BODY, `<body class='text-left ${SCREEN_HOOK} ${DOCUMENT_HOOK}'>`),
        mutate(routeCandidate, HOOKED_BODY, `<body class='text-left ${SCREEN_HOOK}' id='verify'>`),
        mutate(routeCandidate, HOOKED_BODY, `${HOOKED_BODY}<main>`),
        mutate(routeCandidate, HOOKED_CONTAINER, CONTAINER),
        mutate(routeCandidate, HOOKED_CONTAINER, `<div class='${DOCUMENT_HOOK} container'>`),
        mutate(routeCandidate, HOOKED_CONTAINER, `<div class='container ${DOCUMENT_HOOK}' style='max-width:none'>`),
        mutate(routeCandidate, HOOKED_CONTAINER, `<div class='oe-address-verification-frame'>${HOOKED_CONTAINER}`),
        mutate(routeCandidate, "\"<div class='text-success'>\"", `"<div class='text-success ${DOCUMENT_HOOK}'>"`),
    ];
    expectDistinctMutants(mutants, routeCandidate);
    for (const mutant of mutants) {
        expect(restoreRoute(mutant)).not.toBe(original());
        expect(routeViolations(mutant)).not.toEqual([]);
    }
});

test('actual route: only the permitted additions restore the original route byte for byte', () => {
    expect(restoreRoute(read(ROUTE))).toBe(original());
});

test('actual route: escaped versioned screen link, sorted imports, hooks and preserved original source', () => {
    expect(routeViolations(read(ROUTE))).toEqual([]);
});

// ---------------------------------------------------------------- asset helper

// Full ClinicalWorkspaceAssets.php as found in this worktree before OPEMR-20.
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

// 'address-…' sorts before 'ajtooltip.js' ('d' < 'j'), so the new basename opens the list.
const NEXT = 'ajtooltip.js';
const HELPER_LINE = `        '${BASENAME}',\n`;
const supported = text => {
    const block = text.match(/private const SUPPORTED = \[\n([\s\S]*?)\n {4}\];/);
    if (!block) return null;
    return block[1].split('\n').map(line => (line.match(/^ {8}'([^']+)',$/) || [null, `<malformed:${line}>`])[1]);
};
const helperViolations = text => {
    const violations = [];
    // Full inverse: removing the one permitted line must give back the baseline exactly.
    const without = count(text, HELPER_LINE) === 1 ? text.replace(HELPER_LINE, '') : null;
    if (without !== HELPER_BASELINE) violations.push('helper must equal the baseline plus exactly one supported line');
    const list = supported(text);
    if (!list) return [...violations, 'SUPPORTED list not found'];
    if (JSON.stringify(list) !== JSON.stringify([...list].sort())) violations.push('SUPPORTED must stay sorted');
    if (new Set(list).size !== list.length) violations.push('SUPPORTED must not repeat a basename');
    if (list.filter(name => name === BASENAME).length !== 1) violations.push(`SUPPORTED must list ${BASENAME} once`);
    if (list[0] !== BASENAME || list[1] !== NEXT) violations.push(`${BASENAME} must open the list directly before ${NEXT}`);
    return violations;
};

test('helper baseline is self-consistent and fixes the sorted slot for the new basename', () => {
    const list = supported(HELPER_BASELINE);
    expect(list).toHaveLength(24);
    expect(list).toEqual([...list].sort());
    expect(new Set(list).size).toBe(list.length);
    expect(list[0]).toBe(NEXT);
    expect(HELPER_BASELINE).not.toContain(BASENAME);
    expect(HELPER_BASELINE).not.toContain('add-user');
    expect([...list, BASENAME].sort().indexOf(BASENAME)).toBe(0);
});

const helperCandidate = mutate(HELPER_BASELINE, `        '${NEXT}',\n`, `${HELPER_LINE}        '${NEXT}',\n`);

test('positive candidate: one sorted supported entry is the only helper change', () => {
    expect(helperViolations(helperCandidate)).toEqual([]);
    expect(supported(helperCandidate)).toHaveLength(25);
    expect(helperCandidate.replace(HELPER_LINE, '')).toBe(HELPER_BASELINE);
});

test('helper negative controls: missing, unsorted, duplicate, misspelt, extra entry and behaviour edits', () => {
    const mutants = [
        HELPER_BASELINE,
        mutate(HELPER_BASELINE, `        '${NEXT}',\n`, `        '${NEXT}',\n${HELPER_LINE}`),
        mutate(HELPER_BASELINE, "        'workspace.css',\n", `        'workspace.css',\n${HELPER_LINE}`),
        mutate(helperCandidate, HELPER_LINE, `${HELPER_LINE}${HELPER_LINE}`),
        mutate(helperCandidate, HELPER_LINE, "        'address-verify-popup.css',\n"),
        mutate(helperCandidate, HELPER_LINE, `    '${BASENAME}',\n`),
        mutate(helperCandidate, HELPER_LINE, `        "${BASENAME}",\n`),
        mutate(helperCandidate, HELPER_LINE, `        'add-user-popup.css',\n${HELPER_LINE}`),
        mutate(helperCandidate, "        'workspace.css',\n", "        'workspace.css',\n        'zz-extra.css',\n"),
        mutate(helperCandidate, "        'mode.js',\n", ''),
        mutate(helperCandidate, "$mtime === false ? '0'", "$mtime === false ? '1'"),
        mutate(helperCandidate, 'clearstatcache(true, $path);\n', ''),
        mutate(helperCandidate, 'in_array($asset, self::SUPPORTED, true)', 'in_array($asset, self::SUPPORTED)'),
        mutate(helperCandidate, "dirname(__DIR__, 3) . '/interface/clinical-workspace'", "dirname(__DIR__, 3) . '/public'"),
        mutate(helperCandidate, 'final readonly class', 'final class'),
        mutate(helperCandidate, ' * Supported asset basenames.', ' * Supported basenames.'),
    ];
    expectDistinctMutants(mutants, helperCandidate);
    for (const mutant of mutants) expect(helperViolations(mutant)).not.toEqual([]);
});

test('actual helper: baseline preserved plus exactly one sorted supported basename', () => {
    expect(helperViolations(read(HELPER))).toEqual([]);
});

// ---------------------------------------------------------------- stylesheet

const CANVAS = 'var(--oe-wb-canvas, #f3f7f5)';
const PAPER = 'var(--oe-wb-paper, #fff)';
const INK = 'var(--oe-wb-ink, #17343b)';
const SCREEN = `${CONTEXT} body.${SCREEN_HOOK}`;
const DOC = `${CONTEXT} .${DOCUMENT_HOOK}`;
// Ordered allowlist: selector -> { property: value }. No declaration may be important.
const EXPECTED_RULES = {
    [SCREEN]: { 'background-color': CANVAS, color: INK },
    [DOC]: { 'background-color': PAPER, color: INK },
};

test('canvas, paper and ink fallbacks match the popup.css workbench context tokens (source anchor)', () => {
    const tokens = {};
    postcss.parse(read('interface/clinical-workspace/popup.css')).walkRules(rule => {
        if (!rule.selectors.includes(CONTEXT)) return;
        rule.walkDecls(/^--oe-wb-/, decl => { tokens[decl.prop] = decl.value; });
    });
    expect(CANVAS).toBe(`var(--oe-wb-canvas, ${tokens['--oe-wb-canvas']})`);
    expect(PAPER).toBe(`var(--oe-wb-paper, ${tokens['--oe-wb-paper']})`);
    expect(INK).toBe(`var(--oe-wb-ink, ${tokens['--oe-wb-ink']})`);
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
    const order = [];
    if (/!\s*important/i.test(text)) violations.push('no !important anywhere');
    if (/text-(danger|success)/.test(text)) violations.push('semantic danger/success classes must keep their own paint');
    for (const node of tree.nodes) {
        if (!['rule', 'comment'].includes(node.type)) violations.push(`unexpected top-level ${node.type}`);
    }
    if (tree.nodes.filter(node => node.type === 'rule').length !== 2) violations.push('exactly two top-level rules');
    tree.walkAtRules(at => violations.push(`unexpected at-rule @${at.name} ${at.params}`));
    tree.walkComments(comment => {
        if (/@|stylelint|eslint|prettier|sourceMappingURL/i.test(comment.text)) violations.push(`comment carries a directive: ${comment.text}`);
    });
    tree.walkRules(rule => {
        const selector = norm(rule.selector);
        if (rule.parent !== tree) violations.push(`nested rule ${selector}`);
        if (rule.selectors.length !== 1) {
            violations.push(`grouped selector ${selector}`);
            return;
        }
        if (!has(EXPECTED_RULES, selector)) {
            violations.push(`unexpected selector ${selector}`);
            return;
        }
        if (order.includes(selector)) {
            violations.push(`duplicate rule ${selector}`);
            return;
        }
        order.push(selector);
        const expected = EXPECTED_RULES[selector];
        const found = {};
        for (const node of rule.nodes) {
            if (node.type === 'comment') continue;
            if (node.type !== 'decl') {
                violations.push(`unexpected ${node.type} inside ${selector}`);
                continue;
            }
            if (!has(expected, node.prop)) {
                violations.push(`unexpected declaration ${selector} { ${node.prop} }`);
                continue;
            }
            if (has(found, node.prop)) {
                violations.push(`duplicate declaration ${selector} { ${node.prop} }`);
                continue;
            }
            found[node.prop] = true;
            if (norm(node.value) !== expected[node.prop]) violations.push(`${selector} { ${node.prop}: ${norm(node.value)} } expected ${expected[node.prop]}`);
            if (Boolean(node.important) !== false) violations.push(`${selector} { ${node.prop} } must not be important`);
        }
        for (const prop of Object.keys(expected)) {
            if (!has(found, prop)) violations.push(`missing declaration ${selector} { ${prop} }`);
        }
    });
    for (const selector of Object.keys(EXPECTED_RULES)) {
        if (!order.includes(selector)) violations.push(`missing rule ${selector}`);
    }
    const expectedOrder = Object.keys(EXPECTED_RULES).filter(selector => order.includes(selector));
    if (JSON.stringify(order) !== JSON.stringify(expectedOrder)) violations.push('rules must keep the stated order');
    return violations;
};

const SCREEN_BLOCK = `${SCREEN} {\n  background-color: ${CANVAS};\n  color: ${INK};\n}\n`;
const DOC_BLOCK = `${DOC} {\n  background-color: ${PAPER};\n  color: ${INK};\n}\n`;
const cssCandidate = ['/* Address Verification popup: canvas, paper and ink only. */\n', SCREEN_BLOCK, DOC_BLOCK].join('\n');

test('positive candidate: exactly two ordered single-selector scoped rules satisfy the AST allowlist', () => {
    expect(cssViolations(cssCandidate)).toEqual([]);
    const tree = postcss.parse(cssCandidate);
    const rules = tree.nodes.filter(node => node.type === 'rule');
    expect(rules.map(rule => rule.selector)).toEqual(Object.keys(EXPECTED_RULES));
    let importantCount = 0;
    let declCount = 0;
    tree.walkDecls(decl => {
        declCount += 1;
        if (decl.important) importantCount += 1;
    });
    expect(declCount).toBe(4);
    expect(importantCount).toBe(0);
    expect(cssViolations('')).toEqual(['stylesheet missing or empty']);
});

test('stylesheet negative controls: scope, hooks, tokens, important, properties, order, leakage, semantics, at-rules, comments', () => {
    const inkRule = (block, to) => mutate(cssCandidate, block, block.replace(`  color: ${INK};`, to));
    const mutants = [
        mutateAll(cssCandidate, `${CONTEXT} `, ''),
        mutateAll(cssCandidate, `${CONTEXT} `, 'body.oe-workbench-context '),
        mutate(cssCandidate, `body.${SCREEN_HOOK} {`, 'body {'),
        mutate(cssCandidate, `body.${SCREEN_HOOK} {`, `.${SCREEN_HOOK} {`),
        mutate(cssCandidate, `body.${SCREEN_HOOK} {`, `body.${DOCUMENT_HOOK} {`),
        mutate(cssCandidate, `.${DOCUMENT_HOOK} {`, '.container {'),
        mutate(cssCandidate, `background-color: ${CANVAS};`, `background-color: ${CANVAS} !important;`),
        mutate(cssCandidate, `background-color: ${CANVAS};`, `background-color: ${CANVAS} ! important;`),
        mutate(cssCandidate, `background-color: ${PAPER};`, `background-color: ${PAPER} !important;`),
        inkRule(SCREEN_BLOCK, `  color: ${INK} !important;`),
        inkRule(DOC_BLOCK, `  color: ${INK} !important;`),
        mutate(cssCandidate, `background-color: ${CANVAS};`, `background-color: ${PAPER};`),
        mutate(cssCandidate, `background-color: ${PAPER};`, `background-color: ${CANVAS};`),
        mutate(cssCandidate, `background-color: ${CANVAS};`, `background: ${CANVAS};`),
        mutate(cssCandidate, `background-color: ${PAPER};`, `background: ${PAPER};`),
        mutate(cssCandidate, `background-color: ${CANVAS};`, 'background-color: var(--oe-wb-canvas, #f4f8f6);'),
        mutate(cssCandidate, `background-color: ${CANVAS};`, 'background-color: #f3f7f5;'),
        inkRule(SCREEN_BLOCK, '  color: var(--oe-wb-muted, #526a70);'),
        inkRule(DOC_BLOCK, '  color: var(--oe-wb-petrol, #086878);'),
        inkRule(DOC_BLOCK, '  color: #17343b;'),
        inkRule(DOC_BLOCK, ''),
        inkRule(SCREEN_BLOCK, `  color: ${INK};\n  color: ${INK};`),
        inkRule(SCREEN_BLOCK, `  Color: ${INK};`),
        inkRule(SCREEN_BLOCK, `  color: ${INK};\n  font-family: Inter, sans-serif;`),
        inkRule(DOC_BLOCK, `  color: ${INK};\n  padding: 1rem;`),
        inkRule(DOC_BLOCK, `  color: ${INK};\n  max-width: 40rem;`),
        inkRule(DOC_BLOCK, `  color: ${INK};\n  border: 1px solid var(--oe-wb-line, #d9e4e2);`),
        inkRule(DOC_BLOCK, `  color: ${INK};\n  --oe-wb-ink: #000;`),
        inkRule(DOC_BLOCK, `  color: ${INK};\n  &:hover {\n    color: #000;\n  }`),
        mutate(cssCandidate, `\n${DOC_BLOCK}`, ''),
        `${cssCandidate}\n${DOC_BLOCK}`,
        mutate(cssCandidate, `${SCREEN_BLOCK}\n${DOC_BLOCK}`, `${DOC_BLOCK}\n${SCREEN_BLOCK}`),
        mutate(cssCandidate, `${DOC} {`, `${DOC},\n${DOC} p {`),
        `${cssCandidate}\n${DOC} .text-danger {\n  color: ${INK};\n}\n`,
        `${cssCandidate}\n${DOC} .text-success {\n  color: ${INK};\n}\n`,
        `${cssCandidate}\n${CONTEXT} .text-danger {\n  color: inherit;\n}\n`,
        `${cssCandidate}\n${DOC} p {\n  color: ${INK};\n}\n`,
        `${cssCandidate}\n${DOC} * {\n  color: ${INK};\n}\n`,
        `${cssCandidate}\n${DOC} a:focus {\n  outline: 2px solid var(--oe-wb-petrol, #086878);\n}\n`,
        `${cssCandidate}\n${CONTEXT} body {\n  background-color: ${CANVAS};\n}\n`,
        `${cssCandidate}\n.${DOCUMENT_HOOK} {\n  color: ${INK};\n}\n`,
        `${cssCandidate}\n:root {\n  --oe-wb-ink: #000;\n}\n`,
        `@media screen {\n${cssCandidate}}\n`,
        `@supports (color: red) {\n${cssCandidate}}\n`,
        `@import url("popup.css");\n${cssCandidate}`,
        `@font-face {\n  font-family: Inter;\n  src: url("inter.woff2");\n}\n${cssCandidate}`,
        `/* stylelint-disable */\n${cssCandidate}`,
        `/* @import url("x.css") */\n${cssCandidate}`,
        `${cssCandidate}\n${DOC} {\n`,
    ];
    expectDistinctMutants(mutants, cssCandidate);
    for (const mutant of mutants) expect(cssViolations(mutant)).not.toEqual([]);
});

test('actual stylesheet: exactly the two allowlisted rules and declarations', () => {
    expect(cssViolations(readOptional(STYLESHEET))).toEqual([]);
});

// ---------------------------------------------------------------- unchanged caller and service (source anchors)

test('source anchor: demographics_full.php address_verify() restores session and opens a 400x150 dlgopen with six params', () => {
    const caller = read(CALLER);
    for (const anchor of [
        '        function address_verify() {\n            top.restoreSession();\n',
        "            const postal = val('postal').replace(/\\D/g, '');\n",
        "            const params = new URLSearchParams({\n                address1: val('address1'),\n                address2: val('address2'),\n                city: val('city'),\n                state: val('state'),\n                zip4: postal.substring(5, 9),\n                zip5: postal.substring(0, 5)\n            });\n",
        "            dlgopen('../../practice/address_verify.php?' + params,\n                '_blank', 400, 150, '', xl('Address Verify'));\n            return false;\n        }\n",
    ]) {
        expect(count(caller, anchor)).toBe(1);
    }
    for (const marker of [BASENAME, SCREEN_HOOK, DOCUMENT_HOOK, 'ClinicalWorkspaceAssets']) {
        expect(caller).not.toContain(marker);
    }
});

test('source anchor: USPSAddressVerifyV3 configured guard, credential decrypt, token post and remote address request exist', () => {
    const service = read(SERVICE);
    for (const anchor of [
        "private const BASE_URI = 'https://apis.usps.com/';",
        "private const TOKEN_ENDPOINT = 'oauth2/v3/token';",
        "private const ADDRESS_ENDPOINT = 'addresses/v3/address';",
        '? $cryptoGen->decryptFromDatabase($encryptedClientId)',
        '? $cryptoGen->decryptFromDatabase($encryptedClientSecret)',
        'return !empty($this->clientId) && !empty($this->clientSecret);',
        "if (!$this->isConfigured()) {\n            $this->error = 'USPS API v3 credentials not configured';\n            return false;\n        }",
        '$response = $this->client->post(self::TOKEN_ENDPOINT, [',
        '$response = $this->client->get(self::ADDRESS_ENDPOINT, [',
        "'Authorization' => 'Bearer ' . $this->getToken()",
        'public function getAddress(): ?array',
        "'ZIPPlus4' => $addr['ZIPPlus4'] ?? ''",
    ]) {
        expect(count(service, anchor)).toBe(1);
    }
});

test('shared workbench engine carries no Address Verification specific rules', () => {
    for (const shared of ['interface/clinical-workspace/popup.css', 'library/dialog.js']) {
        const text = read(shared);
        expect(text).not.toContain('oe-address-verification');
        expect(text).not.toContain(BASENAME);
    }
});
