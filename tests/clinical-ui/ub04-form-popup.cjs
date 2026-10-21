'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const route = 'interface/billing/ub04_form.php';
const fixturePath = 'tests/clinical-ui/fixtures/ub04-form-popup-original.txt';
const original = read(fixturePath);
const actual = read(route);
const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');
const originalDigest = '6035c514577d51e82967eb0601a91f3151db627f4b5d9ea43ba3146605ef9e73';
const protectedSources = {
    'interface/billing/billing_report.php': '638c728deeccbdbd22ca624aa396cf71cc0141d5ad621ca6b91e2f7d306bcbfe',
    'interface/billing/ub04_dispose.php': '2f40c191f6803535435f987cde03525b70bb73b577826ee23fa3bb324d3119a3',
};

// These two exact insertions are the complete production allowance. The PHP guard
// suppresses both the style and the body class in the authorized claim renderer.
const style = `<?php if ($isAuthorized !== 1) { ?>
<style>
@media screen {
  html.oe-workbench-context body.ub04-workbench-route {
    color: var(--oe-wb-ink, #17343b);
    background-color: var(--oe-wb-canvas, #f3f7f5);
  }

  html.oe-workbench-context body.ub04-workbench-route #menu,
  html.oe-workbench-context body.ub04-workbench-route #formhelp {
    color: var(--oe-wb-ink, #17343b);
    background-color: var(--oe-wb-paper, #fff);
  }
}
</style>
<?php } ?>
`;
const bodyBefore = '<body onload="adjustForm();">';
const bodyAfter = `<body<?php echo $isAuthorized !== 1 ? ' class="ub04-workbench-route"' : ''; ?> onload="adjustForm();">`;
const styleAnchor = '</script>\n\n<style>\n.container {';

function once(source, needle, label) {
    assert.equal(source.split(needle).length, 2, `${label} must occur exactly once`);
}
function candidate(base = original) {
    once(base, styleAnchor, 'style anchor');
    once(base, bodyBefore, 'body anchor');
    return base.replace(styleAnchor, `</script>\n\n${style}<style>\n.container {`).replace(bodyBefore, bodyAfter);
}
function verify(source) {
    assert.equal(digest(original), originalDigest, 'immutable original fixture changed');
    once(source, style, 'guarded screen presentation');
    once(source, bodyAfter, 'guarded body marker');
    const restored = source.replace(style, '').replace(bodyAfter, bodyBefore);
    assert.equal(restored, original, 'changes beyond the two declared insertions');
    const css = style.slice(style.indexOf('<style>') + 7, style.indexOf('</style>'));
    assert.match(css, /^\s*@media screen \{/);
    assert.doesNotMatch(css, /!important|#p1|pageArea|\b(input|textarea|button|form)\b|@media print/i);
    assert.equal((css.match(/\{/g) || []).length, 3, 'one media block and two selector rules');
    assert.equal((css.match(/\}/g) || []).length, 3);
    assert.match(source, /<div id="p1" class="pageArea" style="overflow: hidden; position: relative; width: 934px; height: 1210px;">/);
}

test('fixture is the complete unchanged base', () => {
    assert.equal(digest(original), originalDigest);
    assert.equal(original.length, 106840);
    assert.match(original, /^<\?php\n/);
    assert.match(original, /<\/html>\n$/);
});

test('synthetic screen-only UI candidate passes and restores every original byte', () => {
    verify(candidate());
    assert.equal(candidate().replace(style, '').replace(bodyAfter, bodyBefore), original);
});

test('independent unique-anchor mutants reject protected route behavior', () => {
    const protectedAnchors = [
        ["AclMain::aclCheckCore('acct', 'bill')", "AclMain::aclCheckCore('acct', 'admin')"],
        ['ub04_dispose();', 'ub04_dispose(false);'],
        ["$query->getInt('pid')", "$query->getInt('patient')"],
        ["$query->getInt('enc')", "$query->getInt('encounter')"],
        ['CsrfUtils::collectCsrfToken(session:', 'CsrfUtils::collectCsrfToken(other:'],
        ['function adjustForm()', 'function adjustClaimForm()'],
        ["el.style.top = (el.offsetTop+3)+'px';", "el.style.top = (el.offsetTop+4)+'px';"],
        ["handler: 'edit_save'", "handler: 'batch_save'"],
        ["onclick=\"postClaim('batch_save')\"", "onclick=\"postClaim('payer_save')\""],
        ["onclick=\"myZoom()\"", "onclick=\"myZoom(2)\""],
        ["font:normal 10pt 'Times New Roman', Times, serif;\n}\n\ninput:focus", "font:normal 11pt 'Times New Roman', Times, serif;\n}\n\ninput:focus"],
        ['id="ub04id1"', 'id="ub04id999"'],
        ['class="pageArea"', 'class="claimArea"'],
    ];
    const good = candidate();
    for (const [before, after] of protectedAnchors) {
        once(good, before, `mutant anchor ${before}`);
        const mutant = good.replace(before, after);
        assert.notEqual(mutant, good, `mutant must change the candidate: ${before}`);
        assert.throws(() => verify(mutant), /changes beyond/, before);
    }
});

test('independent presentation mutants reject scope, guard, media, and selector drift', () => {
    const good = candidate();
    const mutants = [
        good.replace(style, style.replace('@media screen', '@media print')),
        good.replace(style, style.replace('html.oe-workbench-context body.ub04-workbench-route #menu', 'body #menu')),
        good.replace(style, style.replace('background-color: var(--oe-wb-canvas, #f3f7f5);', 'background-color: var(--oe-wb-canvas, #f3f7f5) !important;')),
        good.replace(style, style.replace('<?php if ($isAuthorized !== 1) { ?>\n', '')),
        good.replace(bodyAfter, `<body<?php echo ''; ?> onload="adjustForm();">`),
        good.replace(style, style.replace('body.ub04-workbench-route #formhelp', 'body.ub04-workbench-route #p1')),
        good.replace(bodyAfter, bodyBefore),
    ];
    for (const mutant of mutants) {
        assert.notEqual(mutant, good, 'presentation mutant must change the candidate');
        assert.throws(() => verify(mutant));
    }
});

test('caller and disposal behavior remain byte-identical', () => {
    for (const [name, expected] of Object.entries(protectedSources)) {
        const source = read(name);
        assert.equal(digest(source), expected, name);
        const anchor = name.endsWith('billing_report.php') ? 'function popUB04(pid, enc)' : 'function ub04_dispose(): void';
        once(source, anchor, name);
        assert.notEqual(digest(source.replace(anchor, `${anchor} /* mutant */`)), expected, name);
    }
});

test('Header autoload and popup context make the guarded selector reachable', () => {
    const config = read('config/config.yaml');
    assert.match(config, /workbench-popup:\s*\n\s*basePath: '%webroot%\/interface\/clinical-workspace\/'\s*\n\s*script: popup\.js\s*\n\s*link: popup\.css\s*\n\s*autoload: true/);
    const header = read('src/Core/Header.php');
    assert.match(header, /\$autoload === true/);
    assert.match(header, /in_array\("no_" \. \$k, \$selectedAssets\)/);
    assert.match(original, /Header::setupHeader\(\['no_main-theme', 'opener', 'common', 'datetime-picker', 'jquery-ui'\]\)/);
    const popupCss = read('interface/clinical-workspace/popup.css');
    for (const token of ['--oe-wb-ink: #17343b;', '--oe-wb-canvas: #f3f7f5;', '--oe-wb-paper: #fff;']) assert.ok(popupCss.includes(token));
});

test('actual popup.js discovers same-origin host, cleans up, and excludes inert routes', () => {
    const api = require(path.join(root, 'interface/clinical-workspace/popup.js'));
    function classes(initial = []) {
        const names = new Set(initial);
        return { contains: (name) => names.has(name), add: (name) => names.add(name), remove: (name) => names.delete(name) };
    }
    const shellBody = { classList: classes(['workbench-active']), ownerDocument: { querySelector: () => true } };
    const shell = { closed: false, location: { origin: 'https://emr.test' }, document: { body: shellBody } };
    shell.parent = shell;
    const html = { classList: classes() };
    const child = { closed: false, location: { origin: 'https://emr.test' }, document: { documentElement: html, readyState: 'complete' }, parent: shell, opener: null, frameElement: { closest: () => true }, addEventListener() {} };
    let sync;
    let disconnected = false;
    const control = api.createPopupController({ win: child, observe: (_body, callback) => { sync = callback; return { disconnect: () => { disconnected = true; } }; } });
    assert.equal(control.active, true);
    assert.equal(html.classList.contains('oe-workbench-context'), true);
    shellBody.classList.remove('workbench-active');
    sync();
    assert.equal(html.classList.contains('oe-workbench-context'), false);
    shellBody.classList.add('workbench-active');
    sync();
    control.dispose();
    assert.equal(disconnected, true);
    assert.equal(html.classList.contains('oe-workbench-context'), false);
    const inertHtml = { classList: classes() };
    const inert = { location: { origin: 'https://emr.test' }, document: { documentElement: inertHtml, readyState: 'complete' }, opener: null, addEventListener() {} };
    inert.parent = inert;
    assert.equal(api.createPopupController({ win: inert, observe: () => { throw Error('inert observer'); } }).active, false);
    assert.equal(inertHtml.classList.contains('oe-workbench-context'), false);
});

test('actual route is RED until the declared presentation is added', () => {
    verify(actual);
});

if (process.argv.includes('--history')) {
    test('history gate compares exact base blob and enforces the five-path scope', () => {
        const base = '18647270e0c799189d2dc10f801e8de2bff1a360';
        const blob = execFileSync('git', ['show', `${base}:${route}`], { cwd: root, encoding: 'utf8' });
        assert.equal(blob, original, 'fixture differs from actual base Git blob');
        const allowed = new Set([route, fixturePath, 'tests/clinical-ui/ub04-form-popup.cjs', 'tests/js/ub04-form-popup.test.js', 'docs/clinical-ui/UB04-FORM-POPUP.md']);
        const committed = execFileSync('git', ['diff', '--name-only', base, 'HEAD'], { cwd: root, encoding: 'utf8' });
        for (const name of committed.trimEnd().split('\n').filter(Boolean)) {
            assert.ok(allowed.has(name), `out-of-scope committed file: ${name}`);
        }
        const status = execFileSync('git', ['status', '--porcelain=v1', '--untracked-files=all'], { cwd: root, encoding: 'utf8' });
        for (const line of status.trimEnd().split('\n').filter(Boolean)) {
            const name = line.slice(3);
            assert.ok(allowed.has(name), `out-of-scope file: ${name}`);
        }
    });
}
