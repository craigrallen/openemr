const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const repo = path.resolve(__dirname, '../..');
const templatePath = path.join(repo, 'interface/modules/custom_modules/oe-module-ehi-exporter/templates/oe-module-ehi-exporter/ehi-exporter.html.twig');
const fixturePath = path.join(__dirname, 'fixtures/ehi-export-start-modal-name-original.html.twig.txt');
const originalHash = 'f7cd75ac502b38ed37d7fbcaa8f6584e32d38ea8151838545eaf4dd42b62c5b2';
const oldRoot = `<div class="modal fade" id="ehi-export-start-dialog" tabindex="-1" aria-hidden="true">`;
const newRoot = `<div class="modal fade" id="ehi-export-start-dialog" tabindex="-1" aria-hidden="true" aria-label="{{ "Starting Electronic Health Information Export" | xla }}">`;
const nameAttribute = `aria-label="{{ "Starting Electronic Health Information Export" | xla }}"`;
const read = file => { try { return fs.readFileSync(file, 'utf8'); } catch { return null; } };
const original = read(fixturePath);
const production = read(templatePath);
const count = (source, fragment) => typeof source === 'string' ? source.split(fragment).length - 1 : 0;
const hasNamedRoot = source => count(source, '<div class="modal fade" id="ehi-export-start-dialog"') === 1 && count(source, newRoot) === 1;
const preservesOriginal = source => typeof original === 'string' && (source === original || (hasNamedRoot(source) && source.replace(newRoot, oldRoot) === original));
const valid = source => hasNamedRoot(source) && preservesOriginal(source);
const canonical = typeof original === 'string' ? original.replace(oldRoot, newRoot) : null;
const checks = [
  ['fixture_sha256', () => typeof original === 'string' && crypto.createHash('sha256').update(original).digest('hex') === originalHash],
  ['fixture_original_root_once', () => count(original, oldRoot) === 1],
  ['fixture_semantic_red', () => !hasNamedRoot(original)],
  ['production_named_root', () => hasNamedRoot(production)],
  ['production_exact_inverse', () => preservesOriginal(production)],
  ['original_actual_caller', () => original.includes(`oeExporter.displayExportStartDialog("ehi-export-start-dialog");`)],
  ['original_visible_heading', () => original.includes(`<h5 class="modal-title">{{ "Starting Electronic Health Information Export" | xlt }}</h5>`)],
  ['original_close_label', () => original.includes(`<button type="button" class="close btn-telehealth-confirm-cancel" aria-label="{{ "Close" | xla }}">`)],
  ['original_csrf', () => original.includes('{{ csrfToken() }}')],
  ['original_create_export', () => original.includes(`<input type="hidden" name="action" value="createExport" />`)],
  ['canonical_acceptance', () => valid(canonical)],
  ['reject_missing_name', () => !valid(canonical.replace(newRoot, oldRoot))],
  ['reject_raw_xlt', () => !valid(canonical.replace(newRoot, newRoot.replace(' | xla', ' | xlt')))],
  ['reject_untranslated_name', () => !valid(canonical.replace(newRoot, newRoot.replace(nameAttribute, `aria-label="Starting Electronic Health Information Export"`)))],
  ['reject_wrong_placement', () => !valid(canonical.replace(newRoot, oldRoot).replace('<div class="modal-dialog', `<div ${nameAttribute} class="modal-dialog`))],
  ['reject_duplicate_naming', () => !valid(canonical.replace(newRoot, newRoot.replace('>', ' aria-label="duplicate">')))],
  ['reject_form_mutation', () => !valid(canonical.replace('value="createExport"', 'value="changedExport"'))],
  ['reject_unrelated_source_mutation', () => !valid(canonical.replace('class="modal-title"', 'class="changed-title"'))]
];
const failures = [];
for (const [name, check] of checks) {
  try { if (check() !== true) failures.push(name); } catch { failures.push(name); }
}
const report = { tests: checks.length, passed: checks.length - failures.length, failed: failures.length, failures };
process.stdout.write(JSON.stringify(report) + '\n');
process.exitCode = report.failed ? 1 : 0;
module.exports = { hasNamedRoot, preservesOriginal, valid };
