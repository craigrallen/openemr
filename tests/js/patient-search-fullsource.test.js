const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const repo = path.join(__dirname, '../..');
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

function reverseAll(src, pairs) {
    let out = src;
    for (const [oldStr, newStr] of pairs) {
        if (!out.includes(newStr)) throw new Error('reversible pair not found in current source: ' + newStr.slice(0, 80));
        out = out.replace(newStr, oldStr);
    }
    return out;
}

// Baseline: the full, unmodified file content at commit 0ac49dcd (the merge base this
// patient-search redesign branched from, per `git log` at session start). Captured once via
// `git show 0ac49dcd:<path>` and hashed; this test never shells out to git at run time.
const BASELINE_SHA256 = {
    popup: 'e7c9f36d6f44cc0584dbcd5e99571a378c9e8dcdd7c77d6e759d94cc0d11bf8d',
    finder: 'd2e31250226294559f9c31a0d83d939f0603ed7a3fd7b4e5b1b6d9bc161dbe4d',
    twig: '1e3f64fb5844392fc190a6d394cd111529331123dd60853d75abdb9fa5628f90',
};

// Every presentation change this redesign makes to each file, as exact {old, new} string
// pairs. Reversing all of them (new -> old) must reconstruct the 0ac49dcd original byte for
// byte: this is a whole-file invariant, not a snippet sample, so any unlisted drift anywhere
// in the file (a changed query, a renamed callback, a different escaping call, an extra
// blank line) breaks the reconstruction and fails this test.
const POPUP_PAIRS = [
    [
        "use OpenEMR\\Common\\Acl\\AclMain;\nuse OpenEMR\\Core\\Header;",
        "use OpenEMR\\Common\\Acl\\AclMain;\nuse OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;\nuse OpenEMR\\Core\\Header;",
    ],
    [
        "<title><?php echo xlt('Patient Finder'); ?></title>\n\n    <style>",
        "<title><?php echo xlt('Patient Finder'); ?></title>\n\n    <?php $clinicalAssets = new ClinicalWorkspaceAssets(); ?>\n    <link rel=\"stylesheet\" media=\"screen\" href=\"<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>/interface/clinical-workspace/patient-search.css?v=<?php echo attr_url($clinicalAssets->version('patient-search.css')); ?>\">\n\n    <style>",
    ],
    ['<body class="body_top">', '<body class="body_top oe-patient-search">'],
    ['<div id="searchCriteria" class="bg-light p-2 pt-3">', '<div id="searchCriteria" class="bg-light p-2 pt-3 oe-search-criteria">'],
    ['<div class="form-row">', '<div class="form-row oe-search-controls">'],
    [
        '<?php if (isset($result)) : ?>\n            <table class="table table-sm">',
        '<?php if (isset($result)) : ?>\n            <div class="oe-search-results-scroll">\n            <table class="table table-sm">',
    ],
    [
        '</tbody>\n            </table>\n\n        <?php endif; ?>',
        '</tbody>\n            </table>\n            </div>\n\n        <?php endif; ?>',
    ],
];
const FINDER_PAIRS = [
    [
        '<link rel="stylesheet" href="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>/interface/clinical-workspace/finder.css?v=<?php echo attr_url($clinicalAssets->version(\'finder.css\')); ?>">\n    <script',
        '<link rel="stylesheet" href="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>/interface/clinical-workspace/finder.css?v=<?php echo attr_url($clinicalAssets->version(\'finder.css\')); ?>">\n    <link rel="stylesheet" media="screen" href="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>/interface/clinical-workspace/patient-search.css?v=<?php echo attr_url($clinicalAssets->version(\'patient-search.css\')); ?>">\n    <script',
    ],
    [
        '// oe-finder-results only groups the processing indicator and table for workspace styling\n            "dom": \'Rlf<"oe-finder-results"rt><"mytopdiv">ip\',',
        '// oe-search-toolbar groups length+filter, oe-finder-results groups the processing\n            // indicator and table, and oe-search-footer groups the existing mytopdiv alongside\n            // info+pagination, all for workspace styling only\n            "dom": \'R<"oe-search-toolbar"lf><"oe-finder-results"rt><"oe-search-footer"<"mytopdiv">ip>\',',
    ],
];
const TWIG_PAIRS = [
    ['<div id="container_div" class="{{ oeContainer|attr }} mt-3">', '<div id="container_div" class="{{ oeContainer|attr }} mt-3 oe-finder-page">'],
    ['<ul class="nav nav-tabs mt-3" id="finderTabsNav" role="tablist">', '<ul class="nav nav-tabs mt-3 oe-finder-tabs" id="finderTabsNav" role="tablist">'],
    ['<div class="tab-content" id="finderTabs">', '<div class="tab-content oe-finder-tabcontent" id="finderTabs">'],
];

const FILES = {
    popup: { path: path.join(repo, 'interface/main/calendar/find_patient_popup.php'), pairs: POPUP_PAIRS },
    finder: { path: path.join(repo, 'interface/main/finder/dynamic_finder.php'), pairs: FINDER_PAIRS },
    twig: { path: path.join(repo, 'templates/patient_finder/finder.html.twig'), pairs: TWIG_PAIRS },
};

describe('whole-source preservation: reversing the enumerated presentation changes reconstructs the exact 0ac49dcd baseline', () => {
    test.each(Object.keys(FILES))('%s reconstructs byte-for-byte to its pinned baseline hash', (name) => {
        const current = fs.readFileSync(FILES[name].path, 'utf8');
        const reconstructed = reverseAll(current, FILES[name].pairs);
        expect(sha256(reconstructed)).toBe(BASELINE_SHA256[name]);
    });

    test('negative mutation: an unlisted change anywhere in the file breaks reconstruction', () => {
        // Proves the whole-file check is live, not vacuous: perturbing one byte outside the
        // enumerated pairs (a query, a callback, an escaping call, a CSRF/ACL literal, ...)
        // must desync the reconstruction from the pinned baseline hash.
        for (const name of Object.keys(FILES)) {
            const current = fs.readFileSync(FILES[name].path, 'utf8');
            // Flip one character a safe distance from every enumerated pair's own text, so the
            // mutation lands in untouched "baseline" territory rather than inside a pair match.
            const mutated = current.replace(/sqlStatement/, 'sqlXtatement').replace(/pid/, 'pix');
            expect(mutated).not.toBe(current);
            const reconstructedMutated = reverseAll(mutated, FILES[name].pairs);
            expect(sha256(reconstructedMutated)).not.toBe(BASELINE_SHA256[name]);
        }
    });

    test('negative mutation: silently dropping one enumerated presentation change also breaks reconstruction', () => {
        // Equally proves the check would catch a regression in the OTHER direction: if a
        // reviewed addition were accidentally reverted, the file would no longer contain the
        // "new" side of that pair, and reconstruction must fail loudly (not pass vacuously).
        const current = fs.readFileSync(FILES.popup.path, 'utf8');
        const withoutOneChange = current.replace('oe-patient-search', 'oe-patient-search-x');
        expect(() => reverseAll(withoutOneChange, FILES.popup.pairs)).toThrow();
    });
});
