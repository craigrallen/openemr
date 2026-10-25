'use strict';

// Portable, source-only contract. Run directly with Node; --history adds local Git checks.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const fixturePath = 'tests/clinical-ui/fixtures/edit-payment-original.php.txt';
const routePath = 'interface/billing/edit_payment.php';
const original = read(fixturePath);
const originalBytes = fs.readFileSync(path.join(root, fixturePath));
const bodyBefore = '<body class="body_top" onload="OnloadAction()">';
const bodyAfter = '<body class="body_top oe-edit-payment" onload="OnloadAction()">';
const headBefore = "    <?php Header::setupHeader(['datetime-picker', 'common']); ?>\n</head>";
const style = `    <style id="oe-edit-payment-palette">
@media screen {
  html.oe-workbench-context body.oe-edit-payment {
    color: var(--oe-wb-ink, #17343b);
    background-color: var(--oe-wb-paper, #fff) !important;
  }

  html.oe-workbench-context body.oe-edit-payment fieldset {
    color: var(--oe-wb-ink, #17343b) !important;
    background-color: var(--oe-wb-paper, #fff) !important;
    border-color: var(--oe-wb-line, #d9e4e2) !important;
  }

  html.oe-workbench-context body.oe-edit-payment legend {
    color: var(--oe-wb-ink, #17343b) !important;
    background-color: var(--oe-wb-canvas, #f3f7f5) !important;
    border-bottom-color: var(--oe-wb-line, #d9e4e2);
  }
}
    </style>\n`;
const headAfter = headBefore.replace('</head>', style + '</head>');

function count(haystack, needle) {
    return haystack.split(needle).length - 1;
}

function replaceOnce(source, before, after) {
    assert.equal(count(source, before), 1, `expected one original anchor: ${before.slice(0, 70)}`);
    return source.replace(before, after);
}

function propose(source = original) {
    return replaceOnce(replaceOnce(source, bodyBefore, bodyAfter), headBefore, headAfter);
}

function restore(candidate) {
    assert.equal(count(candidate, bodyAfter), 1, 'body class must occur once');
    assert.equal(count(candidate, headAfter), 1, 'palette must immediately follow the second Header setup');
    return replaceOnce(replaceOnce(candidate, headAfter, headBefore), bodyAfter, bodyBefore);
}

function violations(candidate) {
    const errors = [];
    if (count(candidate, bodyAfter) !== 1) errors.push('body class and OnloadAction anchor');
    if (count(candidate, '<style id="oe-edit-payment-palette">') !== 1) errors.push('exactly one palette style');
    if (count(candidate, headAfter) !== 1) errors.push('style content or placement after Header');
    try {
        if (!Buffer.from(restore(candidate)).equals(originalBytes)) errors.push('original route bytes changed');
    } catch (error) {
        errors.push(`inverse failed: ${error.message}`);
    }
    return errors;
}

function mutation(label, before, after, source = propose()) {
    assert.equal(count(source, before), 1, `${label}: anchor must be unique in actual source`);
    const changed = source.replace(before, after);
    assert.notDeepEqual(violations(changed), [], `${label}: mutation escaped the contract`);
}

test('frozen fixture is the complete 68,836 byte original route', () => {
    assert.equal(originalBytes.length, 68836);
    assert.ok(original.startsWith('<?php\n'));
    assert.ok(original.includes('new Recorder()'));
    assert.ok(original.includes('</html>'));
    assert.equal(count(original, bodyBefore), 1);
    assert.equal(count(original, headBefore), 1);
    assert.equal(count(original, "Header::setupHeader(['datetime-picker', 'common'])"), 2);
});

test('synthetic candidate has exactly the allowed additions and a byte-exact inverse', () => {
    const candidate = propose();
    assert.deepEqual(violations(candidate), []);
    assert.ok(Buffer.from(restore(candidate)).equals(originalBytes));
    assert.equal(count(candidate, 'oe-edit-payment-palette'), 1);
});

test('palette is screen-only, three scoped rules, exact declarations and six important overrides', () => {
    const css = style.slice(style.indexOf('@media screen'), style.indexOf('</style>')).trimEnd();
    assert.equal(count(css, '@media screen'), 1);
    assert.equal(count(css, 'html.oe-workbench-context body.oe-edit-payment'), 3);
    assert.equal(count(css, '!important'), 6);
    assert.equal(count(css, '\n\n  html.'), 2);
    assert.doesNotMatch(css, /font|padding|margin|width|height|display|position|table|input|button|\.alert|@media print/i);
    assert.equal(count(css, '  html.oe-workbench-context body.oe-edit-payment {'), 1);
    assert.equal(count(css, '  html.oe-workbench-context body.oe-edit-payment fieldset {'), 1);
    assert.equal(count(css, '  html.oe-workbench-context body.oe-edit-payment legend {'), 1);
});

test('changes to existing clinical and financial code fail the full inverse', () => {
    const cases = [
        ['ACL', "AclMain::aclCheckCore('acct', 'bill', '', 'write')", "AclMain::aclCheckCore('acct', 'bill', '', 'read')"],
        ['RawPostParser', 'RawPostParser::fromGlobals()->applyToGlobals();', 'RawPostParser::fromGlobals();'],
        ['error banner', 'id="payment-save-error"', 'id="payment-error"'],
        ['SQL', "'UPDATE ar_session SET',", "'UPDATE ar_session IGNORE SET',"],
        ['Recorder', '$recorder = new Recorder();', '$recorder = null;'],
        ['amount calculation', '$paymenttot += floatval($PaymentDB);', '$paymenttot -= floatval($PaymentDB);'],
        ['OnloadAction', 'onload="OnloadAction()"', 'onload="OtherAction()"'],
        ['form action', 'action="edit_payment.php"', 'action="new_payment.php"'],
        ['escaping', '<?php echo text($NameDB); ?>', '<?php echo $NameDB; ?>'],
        ['hidden input', 'name="csrf_token_form"', 'name="other_token"'],
        ['payer bgcolor', "bgcolor='<?php echo attr($bgcolor); ?>'", "bgcolor='red'"],
        ['geometry', 'max-width: 75px;', 'max-width: 90px;'],
        ['print', '@media only screen and (max-width: 768px)', '@media print'],
        ['legacy fieldset', 'border-color: #68171A !important;', 'border-color: #000 !important;'],
    ];
    for (const [label, before, after] of cases) mutation(label, before, after);
    mutation('CSRF', "if ($_POST[\"mode\"] == \"DeletePaymentDistribution\") {\n        CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: true);",
        "if ($_POST[\"mode\"] == \"DeletePaymentDistribution\") {\n        CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: false);");
    mutation('font', '<a class="nav-link font-weight-bold" href=\'new_payment.php\'>', '<a class="nav-link font-weight-normal" href=\'new_payment.php\'>');
});

test('extra CSS, context or importance, and displaced or duplicate style fail', () => {
    mutation('extra CSS', '    border-bottom-color: var(--oe-wb-line, #d9e4e2);',
        '    border-bottom-color: var(--oe-wb-line, #d9e4e2);\n    font-size: 1rem;');
    mutation('context', 'html.oe-workbench-context body.oe-edit-payment fieldset', 'body.oe-edit-payment fieldset');
    mutation('important body foreground', '  html.oe-workbench-context body.oe-edit-payment {\n    color: var(--oe-wb-ink, #17343b);\n    background-color: var(--oe-wb-paper, #fff) !important;',
        '  html.oe-workbench-context body.oe-edit-payment {\n    color: var(--oe-wb-ink, #17343b) !important;\n    background-color: var(--oe-wb-paper, #fff) !important;');
    mutation('body background importance', '  html.oe-workbench-context body.oe-edit-payment {\n    color: var(--oe-wb-ink, #17343b);\n    background-color: var(--oe-wb-paper, #fff) !important;',
        '  html.oe-workbench-context body.oe-edit-payment {\n    color: var(--oe-wb-ink, #17343b);\n    background-color: var(--oe-wb-paper, #fff);');
    mutation('duplicate style', headAfter, headAfter.replace('</head>', style + '</head>'));
    mutation('moved style', headAfter, headBefore.replace('</head>', '</head>\n' + style));
});

test('the actual launcher, Header asset, popup context and competing cascade are pinned', () => {
    const launcher = read('interface/billing/search_payments.php');
    assert.match(launcher, /\$\("\.medium_modal"\)\.on\('click', function \(e\) \{/);
    assert.match(launcher, /dlgopen\('', '', 'modal-full', 800, '', '', \{/);
    assert.match(launcher, /onClosed: 'refreshSearch',\s*type: 'iframe',\s*url: \$\(this\)\.attr\('href'\)/);
    assert.match(launcher, /class="medium_modal" href="edit_payment\.php\?payment_id=/);
    assert.match(launcher, /function refreshSearch\(\) \{\s*top\.restoreSession\(\);\s*SearchPayment\(\);/);
    const config = read('config/config.yaml');
    assert.match(config, /workbench-popup:\s*basePath: '%webroot%\/interface\/clinical-workspace\/'\s*script: popup\.js\s*link: popup\.css\s*autoload: true/);
    const header = read('src/Core/Header.php');
    assert.match(header, /self::setupAssets\(is_array\(\$assets\) \? \$assets : \[\$assets\], true\)/);
    assert.match(header, /self::\$isHeader === true && \$autoload === true/);
    const controller = read('interface/clinical-workspace/popup.js');
    assert.match(controller, /CONTEXT_CLASS = 'oe-workbench-context'/);
    assert.match(controller, /win\.location\.origin === origin/);
    assert.match(controller, /body\.classList\.contains\('workbench-active'\)/);
    assert.match(controller, /set\(CONTEXT_CLASS, active\)/);
    const popupCss = read('interface/clinical-workspace/popup.css');
    assert.match(popupCss, /@media screen \{/);
    assert.match(popupCss, /html\.oe-workbench-context[\s\S]*--oe-wb-ink: #17343b;/);
    const theme = read('interface/themes/theme-defaults.scss');
    assert.match(theme, /legend \{\s*background-color: \$gray-300 !important;\s*color: \$body-color !important;/);
    assert.match(theme, /fieldset \{\s*background-color: \$light !important;\s*color: \$body-color !important;/);
    const colorBase = read('interface/themes/color_base.scss');
    assert.match(colorBase, /\.body_top,\s*\.bgcolor2,\s*\.body_nav \{\s*background-color: \$paler !important;\s*\}/);
    for (const themeName of ['cobalt_blue', 'forest_green']) {
        assert.match(read(`interface/themes/colors/style_${themeName}.scss`), /@import "\.\.\/color_base";/);
    }
    assert.match(original, /fieldset \{\s*border-color: #68171A !important;/);
});

test('production route contains the scoped palette and preserves every original byte', () => {
    assert.deepEqual(violations(read(routePath)), []);
});

if (process.argv.includes('--history')) {
    const base = '09b29da7771aea334ed5745e058751157af980d7';
    function git(...args) {
        const result = spawnSync('git', args, { cwd: root, encoding: null });
        assert.equal(result.status, 0, `git ${args.join(' ')}: ${result.stderr}`);
        return result.stdout;
    }
    test('history: fixture is the exact base blob and checkout descends from the requested head', () => {
        assert.ok(git('show', `${base}:${routePath}`).equals(originalBytes));
        git('merge-base', '--is-ancestor', base, 'HEAD');
    });
    test('history: only the five scoped paths change; launcher, finance includes and popup assets stay at base', () => {
        const allowed = new Set([
            'docs/clinical-ui/EDIT-PAYMENT.md',
            'interface/billing/edit_payment.php',
            'tests/clinical-ui/edit-payment-contract.cjs',
            fixturePath,
            'tests/js/edit-payment.test.js',
        ]);
        const changed = new Set([
            git('diff', '--name-only', '-z', base, 'HEAD'),
            git('diff', '--name-only', '-z', 'HEAD'),
            git('ls-files', '--others', '--exclude-standard', '-z'),
        ].flatMap((output) => output.toString().split('\0').filter(Boolean)));
        for (const name of changed) assert.ok(allowed.has(name), `out-of-scope change: ${name}`);
        for (const name of [
            'interface/billing/search_payments.php',
            'interface/billing/payment_master.inc.php',
            'interface/billing/payment_pat_sel.inc.php',
            'interface/clinical-workspace/popup.css',
            'interface/clinical-workspace/popup.js',
        ]) {
            assert.ok(fs.readFileSync(path.join(root, name)).equals(git('show', `${base}:${name}`)), name);
        }
    });
}

module.exports = { propose, restore, violations };
