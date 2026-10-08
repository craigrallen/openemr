const fs = require('fs');
const path = require('path');

const repo = path.join(__dirname, '../..');
const phpPath = path.join(repo, 'interface/main/calendar/find_patient_popup.php');
const cssPath = path.join(repo, 'interface/clinical-workspace/patient-search.css');
const php = fs.readFileSync(phpPath, 'utf8');
const css = fs.readFileSync(cssPath, 'utf8');

describe('find_patient_popup.php wires the patient-search redesign without touching its domain code', () => {
    test('links patient-search.css through the per-file mtime helper, screen-only', () => {
        expect(php).toMatch(/use OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;/);
        expect(php).toMatch(/\$clinicalAssets = new ClinicalWorkspaceAssets\(\);/);
        expect(php).toMatch(
            /<link rel="stylesheet" media="screen" href="<\?php echo attr\(OEGlobalsBag::getInstance\(\)->getWebRoot\(\)\); \?>\/interface\/clinical-workspace\/patient-search\.css\?v=<\?php echo attr_url\(\$clinicalAssets->version\('patient-search\.css'\)\); \?>">/
        );
        // No hardcoded cache-busting token: the version always comes from the helper call above.
        expect(php).not.toMatch(/patient-search\.css\?v=(?!<\?php echo attr_url\(\$clinicalAssets)/);
    });

    test('carries the workbench marker classes the CSS depends on', () => {
        expect(php).toMatch(/<body class="body_top oe-patient-search">/);
        expect(php).toMatch(/id="searchCriteria" class="bg-light p-2 pt-3 oe-search-criteria"/);
        expect(php).toMatch(/<div class="form-row oe-search-controls">/);
        expect(php).toMatch(/<div class="oe-search-results-scroll">\s*<table class="table table-sm">/);
    });

    test('every original form control, id and name survives untouched', () => {
        for (const needle of [
            "<form method='post' name='theform' id=\"theform\" action='find_patient_popup.php?",
            "<select name='searchby' id='searchby' class=\"form-control form-control-sm col\">",
            "<input type='text' class=\"form-control form-control-sm col\" id='searchparm' name='searchparm' size='12'",
            "<input class='btn btn-primary btn-sm' type='submit' id=\"submitbtn\"",
            '<div id="searchspinner">',
            'class="srName"',
            'class="srPhone"',
            'class="srCellPhone"',
            'class="srEmail"',
            'class="srSS"',
            'class="srDOB"',
            'class="srID"',
        ]) {
            expect(php).toContain(needle);
        }
    });

    test('ACL guard, CSRF-free AJAX-free handlers and noresult/pflag behavior are byte-identical', () => {
        expect(php).toContain("if (isset($_GET['pflag']) || (!AclMain::aclCheckCore('patients', 'demo', '', ['write', 'addonly']))) {");
        expect(php).toContain('opener.document.theform.resname.value = "noresult";');
        expect(php).toContain('function selpid(pid, lname, fname, dob) {');
        expect(php).toContain('var SelectPatient = function (eObj) {');
        expect(php).toContain('if ($searchby == "Last") {');
        expect(php).toContain('getPatientLnames("$searchparm", "*")');
        expect(php).toContain('getPatientPhone("$searchparm", "*")');
        expect(php).toContain('getPatientId("$searchparm", "*")');
        expect(php).toContain('getPatientDOB(DateToYYYYMMDD($searchparm), "*")');
        expect(php).toContain('getPatientSSN("$searchparm", "*")');
        // The inline <style> block (including the standalone-page .highlight colour) is
        // untouched; only the linked stylesheet above may recolour it under the marker.
        expect(php).toContain('background-color: #336699;');
        expect(php).toContain('.billing {\n        color: var(--danger);\n        font-weight: bold;\n      }');
    });

    test('patient-search.css only acts on screen, under either the popup or the main-route marker', () => {
        expect(css).not.toMatch(/^\s*body\s*\{/m);
        expect(css.match(/@media screen( and \(max-width: 640px\))? \{/g)?.length).toBeGreaterThan(0);
        expect(css).not.toMatch(/@media(?! screen)/);
        for (const rule of css.match(/^\s*([^{}]+)\{/gm) ?? []) {
            if (rule.includes('@media') || /^\s*\}/.test(rule)) continue;
            expect(rule).toMatch(/html\.oe-workbench-popup|body\.oe-clinical-workspace\.oe-clinical-finder/);
        }
    });

    const mainRouteMarker = '\n * Main Patient Finder (dynamic_finder.php + finder.html.twig)';
    const popupCss = css.slice(0, css.indexOf(mainRouteMarker));
    const mainCss = css.slice(css.indexOf(mainRouteMarker));

    test('every popup-section rule requires the popup marker, and every main-route rule requires the workspace finder marker', () => {
        expect(popupCss.length).toBeGreaterThan(0);
        expect(mainCss.length).toBeGreaterThan(0);
        for (const rule of popupCss.match(/^\s*([^{}]+)\{/gm) ?? []) {
            if (rule.includes('@media') || /^\s*\}/.test(rule)) continue;
            expect(rule).toMatch(/html\.oe-workbench-popup/);
            expect(rule).not.toMatch(/oe-clinical-workspace/);
        }
        for (const rule of mainCss.match(/^\s*([^{}]+)\{/gm) ?? []) {
            if (rule.includes('@media') || /^\s*\}/.test(rule)) continue;
            expect(rule).toMatch(/body\.oe-clinical-workspace\.oe-clinical-finder/);
            expect(rule).not.toMatch(/oe-workbench-popup/);
        }
    });
});
