'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');

const expectedNames = [
  'baseline_equal_except_note',
  'double_zero_unchanged',
  'empty_comment_omitted',
  'missing_comment_omitted',
  'nonzero_comment_unchanged',
  'null_comment_omitted',
  'numeric_zero_still_omitted',
  'source_preservation',
  'unicode_comment',
  'whitespace_comment_unchanged',
  'zero_json_note',
  'zero_native_note',
  'zero_with_multiple_specimens',
];

function sortedKeys(value) {
  return Object.keys(value).sort();
}

test('native laboratory comment fixture reports every required case', () => {
  const fixture = path.resolve(__dirname, '..', 'clinical-ui', 'laboratory-comment-zero.php.fixture');
  const child = spawnSync('php', [fixture], {
    cwd: path.resolve(__dirname, '..', '..'),
    encoding: 'utf8',
    timeout: 30000,
    maxBuffer: 1024 * 1024,
  });

  expect(child.error).toBeUndefined();
  expect(child.signal).toBeNull();
  expect(child.stderr).toBe('');
  expect(child.stdout).toMatch(/^\{[^\r\n]*\}\n(?![\s\S])/);

  const report = JSON.parse(child.stdout);
  expect(report).not.toBeNull();
  expect(Array.isArray(report)).toBe(false);
  expect(typeof report).toBe('object');
  expect(sortedKeys(report)).toEqual(['cases', 'failed', 'passed', 'total']);
  expect(Array.isArray(report.cases)).toBe(true);
  expect(report.total).toBe(expectedNames.length);
  expect(report.passed).toBe(report.total);
  expect(report.failed).toBe(0);
  expect(report.cases).toHaveLength(report.total);

  const names = report.cases.map((entry) => {
    expect(entry).not.toBeNull();
    expect(Array.isArray(entry)).toBe(false);
    expect(typeof entry).toBe('object');
    expect(sortedKeys(entry)).toEqual(['message', 'name', 'passed']);
    expect(typeof entry.name).toBe('string');
    expect(typeof entry.passed).toBe('boolean');
    expect(typeof entry.message).toBe('string');
    expect(entry.passed).toBe(true);
    expect(entry.message).toBe('');
    return entry.name;
  });
  expect(new Set(names).size).toBe(expectedNames.length);
  expect(names.sort()).toEqual(expectedNames);
  expect(child.status).toBe(0);
});
