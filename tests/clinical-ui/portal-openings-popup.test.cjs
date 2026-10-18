// Source contracts only: no PHP, portal route, database, or browser execution.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { execFileSync } = require('node:child_process');

const root = join(__dirname, '../..');
const routePath = 'portal/find_appt_popup_user.php';
const fixturePath = 'tests/clinical-ui/fixtures/portal-openings-original.php.txt';
const callerPath = 'portal/add_edit_event_user.php';
const read = (path) => readFileSync(join(root, path), 'utf8');
const original = read(fixturePath);

function replaceOnce(source, before, after) {
    assert.equal(source.split(before).length, 2, 'unique edit anchor: ' + before);
    return source.replace(before, after);
}

const bodyBefore = '<body class="body_top">';
const bodyAfter = '<body class="body_top oe-portal-openings">';
const styleAddition = [
    '    <style>',
    '      @media screen {',
    '        body.oe-portal-openings #searchCriteria {',
    '          background-color: #fff;',
    '          color: #17343b;',
    '          box-shadow: inset 0 -1px 0 #c9d7da;',
    '        }',
    '',
    '        body.oe-portal-openings #searchResults a:focus {',
    '          outline: 2px solid #175f66;',
    '          outline-offset: -2px;',
    '        }',
    '',
    '        body.oe-portal-openings #searchResults a:focus-visible {',
    '          outline: 2px solid #175f66;',
    '          outline-offset: -2px;',
    '        }',
    '      }',
    '    </style>',
    '',
].join('\n');
const headBefore = '</head>';
const headAfter = styleAddition + headBefore;

function proposedRoute() {
    const withBody = replaceOnce(original, bodyBefore, bodyAfter);
    return replaceOnce(withBody, headBefore, headAfter);
}

function inverseRoute(source) {
    const withoutStyle = replaceOnce(source, headAfter, headBefore);
    return replaceOnce(withoutStyle, bodyAfter, bodyBefore);
}

const proposed = proposedRoute();
const audit = (source) => source === proposed ? [] : ['route'];

// Replacement anchors are checked before rejection. A missing mutant anchor fails
// this test instead of turning an unchanged candidate into a passing negative case.
function mutant(before, after) {
    const changed = replaceOnce(proposed, before, after);
    assert.notEqual(changed, proposed, 'mutant must change the candidate');
    return changed;
}

test('448-line portal fixture and complete additive inverse', () => {
    assert.equal(original.split('\n').length - 1, 448);
    assert.ok(original.startsWith('<?php\n'));
    assert.ok(original.endsWith('</html>\n'));
    assert.equal(inverseRoute(proposed), original);
    assert.deepEqual(audit(proposed), []);
});

test('only the exact portal-scoped, screen-only standalone rules are proposed', () => {
    assert.equal((proposed.match(/<style>/g) || []).length, 2);
    assert.equal((proposed.match(/@media screen/g) || []).length, 1);
    assert.equal((styleAddition.match(/body\.oe-portal-openings/g) || []).length, 3);
    assert.equal((styleAddition.match(/outline: 2px solid #175f66;/g) || []).length, 2);
    assert.equal((styleAddition.match(/outline-offset: -2px;/g) || []).length, 2);
    assert.equal((styleAddition.match(/#searchResults a:focus \{/g) || []).length, 1);
    assert.equal((styleAddition.match(/#searchResults a:focus-visible \{/g) || []).length, 1);
    assert.ok(proposed.includes('    </style>\n\n' + styleAddition + '</head>'));
    assert.doesNotMatch(styleAddition, /!important|@media print|font-|(?:margin|padding|width|height|display|position):|<link|<script/);
});

test('original portal header, auth, source gate, query, opener, escaping and states survive whole-file inverse', () => {
    const anchors = [
        "require_once(__DIR__ . \"/../vendor/autoload.php\");",
        "$session = SessionWrapperFactory::getInstance()->getActiveSession();",
        "if (!empty($session->get('pid')) && !empty($session->get('patient_portal_onsite_two'))) {",
        "SessionWrapperFactory::getInstance()->destroyPortalSession();",
        "$ignoreAuth_onsite_portal = true;",
        "$query = \"SELECT pc_eventDate, pc_endDate, pc_startTime, pc_duration, \" .",
        "fetchEvents($sdate, $edate, null, null, false, 0, $sqlBindArray, $query)",
        "function portal_doOneDay($catid, $udate, $starttime, $duration, $prefcatid): void",
        "Header::setupHeader(['no_main-theme',  'portal-theme', 'datetime-picker', 'opener']);",
        "opener.setappt(year, mon, mday, hours, minutes);",
        "attr_url($providerid)",
        "attr_url($input_catid)",
        "attr(DateFormatterUtils::oeFormatShortDate($sdate))",
        "attr_js($adate['mon'])",
        "attr($atitle)",
        "if (!empty($slots)) :",
        "No openings were found for this period.",
        "$('.datepicker').datetimepicker({",
    ];
    for (const anchor of anchors) assert.ok(original.includes(anchor), 'fixture anchor: ' + anchor);
    assert.equal(inverseRoute(proposed), original);
    assert.equal((proposed.match(/Header::setupHeader/g) || []).length, 1);
    assert.doesNotMatch(styleAddition, /oe-workbench|html\.|@import/);
});

test('portal appointment caller retains popup parameters and iframe opener', () => {
    const caller = read(callerPath);
    const excerpt = caller.split('\n').slice(801, 829).join('\n');
    assert.ok(excerpt.includes("function find_available() {"));
    assert.ok(excerpt.includes("const url = 'find_appt_popup_user.php?' + urlParams;"));
    assert.ok(excerpt.includes("catid: catId,"));
    assert.ok(excerpt.includes("providerid: s,"));
    assert.ok(excerpt.includes("startdate: formDate.value"));
    assert.ok(excerpt.includes("type: 'iframe'"));
    assert.ok(excerpt.includes("dlgopen(url, 'apptFind', 'modal-md', 300, '', 'Find Date', dialogParams);"));
});

test('anchored mutants reject changes to protected source and proposed paint', () => {
    const cases = [
        ["$session->get('patient_portal_onsite_two')", "$session->get('other_gate')"],
        ["destroyPortalSession();", "destroySession();"],
        ["$ignoreAuth_onsite_portal = true;", "$ignoreAuth_onsite_portal = false;"],
        ["WHERE pc_aid = ? AND ", "WHERE pc_aid = 1 AND "],
        ["pc_recurrtype, pc_recurrspec, pc_alldayevent", "pc_recurrtype, pc_alldayevent"],
        ["$row['pc_prefcatid']", "$row['pc_catid']"],
        ["if (!$inoffice) {\n            $slots[$i] |= 4;", "if (!$inoffice) {\n            $slots[$i] |= 2;"],
        ["opener.setappt(year, mon, mday, hours, minutes);", "setappt(year, mon, mday, hours, minutes);"],
        ["attr_js($adate['mon'])", "$adate['mon']"],
        ["#BBCCDD", "#000000"],
        ["color: var(--danger);", "color: #000;"],
        ["$('.datepicker').datetimepicker({", "$('.datepicker').datepicker({"],
        ["No openings were found for this period.", "No appointments."],
        ["if (!empty($slots)) :", "if (empty($slots)) :"],
        ["'portal-theme', 'datetime-picker', 'opener'", "'portal-theme', 'opener'"],
        [bodyAfter, '<body class="body_top oe-workbench-context oe-portal-openings">'],
        [bodyAfter, bodyBefore],
        ['      @media screen {', '      @media print {'],
        ['body.oe-portal-openings #searchCriteria', '#searchCriteria'],
        ['background-color: #fff;', 'background-color: #000;'],
        ['color: #17343b;', 'color: #000;'],
        ['box-shadow: inset 0 -1px 0 #c9d7da;', 'box-shadow: inset 0 -1px 0 #000;'],
        ['#searchResults a:focus {', '#searchResults a:hover {'],
        ['#searchResults a:focus-visible {', '#searchResults a:focus {'],
        ['        body.oe-portal-openings #searchResults a:focus-visible {\n          outline: 2px solid #175f66;\n          outline-offset: -2px;\n        }\n', ''],
        ['        body.oe-portal-openings #searchResults a:focus {\n', '        body.oe-portal-openings #searchResults a:focus, body.oe-portal-openings #searchResults a:focus-visible {\n'],
        ['#searchResults a:focus {\n          outline: 2px solid #175f66;', '#searchResults a:focus {\n          outline: 3px solid #175f66;'],
        ['#searchResults a:focus-visible {\n          outline: 2px solid #175f66;\n          outline-offset: -2px;', '#searchResults a:focus-visible {\n          outline: 2px solid #175f66;\n          outline-offset: 0;'],
        ['          background-color: #fff;', '          background-color: #fff;\n          font-size: 14px;'],
        ['          color: #17343b;', '          color: #17343b;\n          padding: 1rem;'],
        ['          box-shadow: inset 0 -1px 0 #c9d7da;', '          box-shadow: inset 0 -1px 0 #c9d7da;\n          width: 100%;'],
        ['      @media screen {', '      @media screen {\n        body.oe-portal-openings input { background-color: #fff; }'],
        ['    </style>\n\n' + styleAddition, '    </style>\n\n    <link rel="stylesheet" href="extra.css">\n' + styleAddition],
    ];
    for (const [before, after] of cases) {
        assert.deepEqual(audit(mutant(before, after)), ['route'], 'reject: ' + before);
    }
    assert.deepEqual(audit(proposed + '\n<style>body { color: red; }</style>'), ['route']);
});

test('checked-in portal route is the proposed minimal addition', () => {
    const actual = read(routePath);
    assert.deepEqual(audit(actual), []);
    assert.equal(inverseRoute(actual), original);
});

if (process.argv.includes('--history')) {
    test('complete fixture equals the exact baseline revision', () => {
        const historical = execFileSync('git', [
            'show',
            '18647270e0c799189d2dc10f801e8de2bff1a360:' + routePath,
        ], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
        assert.equal(original, historical);
        assert.equal(inverseRoute(proposed), historical);
    });
}
