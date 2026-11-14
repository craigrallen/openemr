'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const originalPath = path.join(__dirname, 'fixtures/new-list-modal-name-original.php.txt');
const sourcePath = path.join(root, 'interface/super/edit_list.php');
const expectedHash = 'c1ac5e6afe01d1d9628c68b09749ee12cf0d6dca723ff8217a9a4ceeaafaa092';
const oldRoot = `<div class="modal fade" id="modal-new-list" tabindex="-1" role="dialog">`;
const newRoot = `<div class="modal fade" id="modal-new-list" tabindex="-1" role="dialog" aria-label="<?php echo xla('New List'); ?>">`;
function read(file) { try { return fs.readFileSync(file, 'utf8'); } catch { return ''; } }
function count(source, fragment) { return source.split(fragment).length - 1; }
const original = read(originalPath);
const source = read(sourcePath);
const approved = original.replace(oldRoot, newRoot);
function accepts(candidate) {
    return count(candidate, newRoot) === 1 && candidate.replace(newRoot, oldRoot) === original;
}
const failures = [];
let tests = 0;
function check(name, condition) { tests++; if (!condition) failures.push(name); }
check('fixture SHA256', crypto.createHash('sha256').update(original).digest('hex') === expectedHash);
check('original dialog root occurs once', count(original, oldRoot) === 1);
check('launcher identity', original.includes('<a class="nav-link" href="#" data-toggle="modal" data-target="#modal-new-list"><i class="fa fa-plus"></i>&nbsp;<?php echo xlt(\'New List\'); ?></a>'));
check('translated visible title', original.includes('<h4 class="modal-title"><?php echo xlt(\'New List\'); ?></h4>'));
check('original CSRF control', original.includes('<input type="hidden" name="csrf_token_form" value="<?php echo CsrfUtils::collectCsrfToken(session: $session); ?>" />'));
check('original ACL control', original.includes("AclMain::aclCheckCore('admin', 'super')"));
check('original name and maxlength', original.includes('<input type="text" size="20" class="form-control" maxlength="100" name="newlistname" id="newlistname" />'));
check('original modal form action', original.includes('<form action="edit_list.php" method="post" class="form">'));
check('original save and cancel', original.includes('<button type="submit" class="btn btn-secondary btn-save"><?php echo xlt(\'Save\'); ?></button>') && original.includes('<button type="button" class="btn btn-link btn-cancel" data-dismiss="modal"><?php echo xlt(\'Cancel\'); ?></button>'));
check('original dialog has no name', !original.includes(newRoot));
check('New List dialog has one translated attribute name', count(source, newRoot) === 1);
check('candidate preserves every other original byte', source === original || accepts(source));
check('negative: original source rejected', !accepts(original));
check('negative: xl attribute rejected', !accepts(approved.replace(newRoot, newRoot.replace("xla('New List')", "xl('New List')"))));
check('negative: raw attribute rejected', !accepts(approved.replace(newRoot, oldRoot.replace('role="dialog"', 'role="dialog" aria-label="New List"'))));
check('negative: wrong dialog placement rejected', !accepts(approved.replace(newRoot, oldRoot).replace('<div class="modal-dialog" role="document">', `<div class="modal-dialog" role="document" aria-label="<?php echo xla('New List'); ?>">`)));
check('negative: duplicate addition rejected', !accepts(approved.replace(newRoot, newRoot + '\n    ' + newRoot)));
check('negative: unrelated byte rejected', !accepts(approved + ' '));
check('negative: CSRF mutation rejected', !accepts(approved.replace('CsrfUtils::collectCsrfToken(session: $session)', 'CsrfUtils::collectCsrfToken(session: null)')));
check('negative: form action mutation rejected', !accepts(approved.replace('<form action="edit_list.php" method="post" class="form">', '<form action="other.php" method="post" class="form">')));
check('negative: input maxlength mutation rejected', !accepts(approved.replace('maxlength="100" name="newlistname"', 'maxlength="99" name="newlistname"')));
check('negative: launcher mutation rejected', !accepts(approved.replace('data-target="#modal-new-list"', 'data-target="#other-modal"')));
const report = { tests, passed: tests - failures.length, failed: failures.length, failures };
process.stdout.write(JSON.stringify(report) + '\n');
process.exitCode = failures.length ? 1 : 0;
