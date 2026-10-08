const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const repo = path.join(__dirname, '../..');
const phpPath = path.join(repo, 'interface/main/finder/dynamic_finder.php');
const twigPath = path.join(repo, 'templates/patient_finder/finder.html.twig');
const cssPath = path.join(repo, 'interface/clinical-workspace/patient-search.css');
const php = fs.readFileSync(phpPath, 'utf8');
const twig = fs.readFileSync(twigPath, 'utf8');
const css = fs.readFileSync(cssPath, 'utf8');

function extract(src, start, end) {
    const i = src.indexOf(start);
    if (i === -1) throw new Error('start anchor not found: ' + start);
    const j = src.indexOf(end, i + start.length);
    if (j === -1) throw new Error('end anchor not found: ' + end);
    return src.slice(i, j + end.length);
}

function sha256(text) {
    return crypto.createHash('sha256').update(text).digest('hex');
}

// Baseline hashes captured from the current, reviewed source. A change to any of these
// exact regions (DataTables callbacks, row/PID click handling, CSRF-bearing AJAX, the
// recent-patient SQL builder, or the ACL-gated menu listener) must change the hash below,
// proving this test actually pins behavior rather than passing vacuously.
const BASELINE = {
    fnServerParams: 'b001975012d0f1a59cce10a93b388128cc3cba438157da6fbca00be98de97274',
    rowClick: '265ac32ddf20a643a9989885540ad74a4672bf192470b1adc9560d5a8a9c78b0',
    wrapInLink: '6cb57cd5374ad4818d052a12ac11fedf6af40cb3635939eb49e5b63baf98adab',
    persistCriteria: 'f039e1b03f384de8f61f55145f22fa883e4693e4f285e18e12f1afac1629633a',
    rpFn: 'ab3f4e74e9a12d57d2a6c0d1902bb1cb566d4c166286898352194b8e7958dbf7',
    menuListener: '88c9db7e142da79ec4b4317417c89264f9d830192fa569aed1ca00421f988ba1',
};
const TWIG_BASELINE = {
    fnewForm: '30f35de02ac9bc2c2c3d04c2e7eb8d0a48499938ffc69f05987637bdb1a0dae4',
    ptLinkClickBlock: 'f43215042000db8d6c5f7eee7c5e5c1cf695bc53c4b9fb8a1c45bef32de64f37',
    recentLoop: '47986798a323dd9828d39a5430b8d9cfd3ebe4a0fb35c7a60bab9cbbfd4abecc',
};

const regions = {
    fnServerParams: extract(php, '"fnServerParams": function (aoData) {', '},'),
    rowClick: extract(php, "$('#pt_table').on('click', 'tbody tr', function () {", '});'),
    wrapInLink: extract(php, 'function wrapInLink(data, type, full) {', '\n    }'),
    persistCriteria: extract(php, 'function persistCriteria(el, e) {', '\n    }'),
    rpFn: extract(php, 'function rp(): array\n{', '\n}\n'),
    menuListener: extract(php, '$eventDispatcher->addListener(PageHeadingRenderEvent::EVENT_PAGE_HEADING_RENDER, function ($event): void {', '});'),
};
const twigRegions = {
    fnewForm: extract(twig, "<form name='fnew'", '</form>'),
    ptLinkClickBlock: extract(twig, 'function ptLinkClick(e)', '\n    }'),
    recentLoop: extract(twig, '{% for p in rp %}', '{% endfor %}\n                                </tbody>'),
};

describe('dynamic_finder.php + finder.html.twig: source invariants (RED/GREEN baseline hashes)', () => {
    test.each(Object.keys(BASELINE))('PHP region "%s" matches its exact baseline hash', (name) => {
        expect(sha256(regions[name])).toBe(BASELINE[name]);
    });

    test.each(Object.keys(TWIG_BASELINE))('Twig region "%s" matches its exact baseline hash', (name) => {
        expect(sha256(twigRegions[name])).toBe(TWIG_BASELINE[name]);
    });

    test('negative mutation: flipping one character inside a pinned region changes its hash', () => {
        // Proves the hash check is sensitive, not vacuously true for any content.
        for (const [name, text] of Object.entries(regions)) {
            const mutated = text.replace(/[A-Za-z]/, (c) => (c === 'x' ? 'y' : 'x'));
            expect(mutated).not.toBe(text);
            expect(sha256(mutated)).not.toBe(BASELINE[name]);
        }
        for (const [name, text] of Object.entries(twigRegions)) {
            const mutated = text.replace(/[A-Za-z]/, (c) => (c === 'x' ? 'y' : 'x'));
            expect(mutated).not.toBe(text);
            expect(sha256(mutated)).not.toBe(TWIG_BASELINE[name]);
        }
    });

    test('CSRF token call and ACL guard literals inside the pinned regions are untouched', () => {
        expect(regions.persistCriteria).toContain('CsrfUtils::collectCsrfToken(session: $session)');
        expect(regions.menuListener).toContain("'acl' => ['patients', 'demo', ['write', 'addonly']]");
        expect(twigRegions.fnewForm).toContain("{{ csrfToken('', 'csrf_token_form') }}");
    });

    test('escaping calls around user/dynamic output are unchanged', () => {
        for (const needle of [
            '$header .= text($title);',
            "addcslashes((string) $colname, \"\\t\\r\\n\\\"\\\\\")",
            'echo js_url($searchAny);',
            "echo attr($patient_finder_exact_search);",
        ]) {
            expect(php).toContain(needle);
        }
        expect(twig).toContain('{{ h.title|xlListLabel }}');
        expect(twig).toContain('{{ value|text }}');
        expect(twig).toContain('{{ p.pid|attr }}');
        expect(twig).toContain('{{ colcount|attr }}');
    });

    test('links patient-search.css on the main page through the same per-file mtime helper as finder.css', () => {
        expect(php).toMatch(/\$clinicalAssets = new ClinicalWorkspaceAssets\(\);/);
        expect(php).toContain(
            '<link rel="stylesheet" href="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>/interface/clinical-workspace/finder.css?v=<?php echo attr_url($clinicalAssets->version(\'finder.css\')); ?>">'
        );
        expect(php).toContain(
            '<link rel="stylesheet" media="screen" href="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>/interface/clinical-workspace/patient-search.css?v=<?php echo attr_url($clinicalAssets->version(\'patient-search.css\')); ?>">'
        );
        // No hardcoded cache-busting token: every v= on these two lines comes from a helper call.
        expect(php).not.toMatch(/(finder|patient-search)\.css\?v=(?!<\?php echo attr_url\(\$clinicalAssets)/);
    });

    test('DataTables dom string composes a toolbar and footer wrapper but keeps every R,l,f,r,t,i,p token', () => {
        const domMatch = php.match(/"dom":\s*'([^']+)'/);
        expect(domMatch).not.toBeNull();
        const dom = domMatch[1];
        expect(dom).toBe('R<"oe-search-toolbar"lf><"oe-finder-results"rt><"oe-search-footer"<"mytopdiv">ip>');
        // Strip the quoted wrapper class names first, so letters inside them (e.g. the "t" and
        // "r" in "toolbar") can't masquerade as DataTables tokens; what remains must be exactly
        // the original control tokens, in their original relative order.
        const withoutClassNames = dom.replace(/"[^"]*"/g, '');
        expect(withoutClassNames.replace(/[^Rlfrtip]/g, '')).toBe('Rlfrtip');
    });

    test('twig wraps the container and tabs, but keeps pageHeading a direct child as original', () => {
        expect(twig).toContain('<div id="container_div" class="{{ oeContainer|attr }} mt-3 oe-finder-page">');
        // No wrapper around pageHeading: finder.css's `#container_div > .navbar` direct-child
        // selector (and its 1.75rem/28px heading rule) depends on the rendered nav being an
        // immediate child of container_div, exactly as before this redesign.
        expect(twig).toContain('<div id="container_div" class="{{ oeContainer|attr }} mt-3 oe-finder-page">\n        {{ pageHeading }}');
        expect(twig).not.toMatch(/<div[^>]*class="[^"]*heading[^"]*"[^>]*>\s*\{\{\s*pageHeading\s*\}\}/);
        expect((twig.match(/\{\{\s*pageHeading\s*\}\}/g) || []).length).toBe(1);
        expect(twig).toContain('<ul class="nav nav-tabs mt-3 oe-finder-tabs" id="finderTabsNav" role="tablist">');
        expect(twig).toContain('<div class="tab-content oe-finder-tabcontent" id="finderTabs">');
        // The pre-existing malformed duplicate-attribute table tag is left exactly as-is.
        expect(twig).toContain('<table class="table" class="border-0 display" id="pt_table">');
        // Still exactly one literal <body> in the twig fragment (the pre-existing nested-body quirk is untouched).
        expect((twig.match(/<body>/g) || []).length).toBe(1);
    });

    test('finder.css direct-child heading selector still matches: no wrapper sits between #container_div and its .navbar', () => {
        const finderCss = fs.readFileSync(path.join(repo, 'interface/clinical-workspace/finder.css'), 'utf8');
        // The exact pre-existing selector this redesign must not break, and its 1.75rem (28px) rule.
        const anchor = 'body.oe-clinical-workspace.oe-clinical-finder #container_div > .navbar .navbar-brand {';
        expect(finderCss).toContain(anchor);
        const brandRule = finderCss.slice(finderCss.indexOf(anchor), finderCss.indexOf('}', finderCss.indexOf(anchor)));
        expect(brandRule).toContain('font-size: 1.75rem;');
        // That selector requires .navbar to be an IMMEDIATE child of #container_div. Twig's own
        // markup is the only thing that can satisfy or break that at render time, so re-confirm
        // here (alongside the direct string check above) that nothing wraps pageHeading.
        expect(twig).toMatch(/oe-finder-page">\s*\{\{\s*pageHeading\s*\}\}\s*<div class="w-100">/);
    });

    test('patient-search.css gives the main route its own screen-only, marker-scoped rules for the new wrapper classes', () => {
        for (const selector of [
            'body.oe-clinical-workspace.oe-clinical-finder .oe-finder-tabs .nav-link',
            'body.oe-clinical-workspace.oe-clinical-finder .oe-search-toolbar',
            'body.oe-clinical-workspace.oe-clinical-finder .oe-search-toolbar #pt_table_filter input',
            'body.oe-clinical-workspace.oe-clinical-finder .oe-search-footer',
        ]) {
            expect(css).toContain(selector);
        }
        // No rule targets a now-nonexistent heading wrapper.
        expect(css).not.toMatch(/oe-finder-heading/);
    });
});
