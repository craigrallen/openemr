'use strict';

// Shared, dependency-free support for the template question popup tests.

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '../..');
const ROUTE = 'library/custom_template/quest_popup.php';
const SHEET = 'interface/clinical-workspace/template-question-popup.css';
const ASSETS = 'src/Common/Assets/ClinicalWorkspaceAssets.php';
const POPUP_CSS = 'interface/clinical-workspace/popup.css';
const THEME = 'interface/themes/color_base.scss';
const SCOPE = 'html.oe-workbench-context.oe-workbench-popup body.oe-template-question';
const ASSET_LINE = "        'template-question-popup.css',\n";

// Reads a file as UTF-8, refusing anything that would not round-trip byte for byte.
function read(file) {
  const raw = fs.readFileSync(path.join(ROOT, file));
  const text = raw.toString('utf8');
  if (!Buffer.from(text, 'utf8').equals(raw)) throw new Error(`${file} is not lossless UTF-8`);
  return text;
}

const HEAD_ADDITION = "        <?php $clinicalAssets = new ClinicalWorkspaceAssets(); ?>\n"
  + '        <link rel="stylesheet" media="screen" href="<?php echo attr($webroot); ?>/interface/clinical-workspace/template-question-popup.css?v=<?php echo attr_url($clinicalAssets->version(\'template-question-popup.css\')); ?>">\n';

// Every allowed presentation edit as [original, presented]. Nothing else may differ.
const CHANGES = [
  ['use OpenEMR\\Core\\Header;', 'use OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;\nuse OpenEMR\\Core\\Header;'],
  ["        <?php Header::setupHeader('opener'); ?>\n", "        <?php Header::setupHeader('opener'); ?>\n" + HEAD_ADDITION],
  ['<body class="body_top" onload=', '<body class="body_top oe-template-question" onload='],
  ['<table>', '<table class="oe-template-question-sheet">'],
  ['<td>', '<td class="oe-template-question-options">'],
  ['<td>', '<td class="oe-template-question-field">'],
  ['<td colspan="2" align="center">', '<td colspan="2" align="center" class="oe-template-question-actions">'],
];

const count = (text, part) => text.split(part).length - 1;

// Inverts the presentation edits; null when any edit is missing or ambiguous.
function restore(text) {
  let restored = text;
  for (const [before, after] of CHANGES) {
    if (count(restored, after) !== 1) return null;
    restored = restored.replace(after, () => before);
  }
  return restored;
}

// Splits on top-level commas so :not(a, b) stays one selector.
function splitSelectors(prelude) {
  const out = [];
  let depth = 0;
  let buf = '';
  for (const ch of prelude) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      out.push(buf.trim());
      buf = '';
    } else {
      buf += ch;
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

function parseDecls(body) {
  return body.split(';').map(part => part.trim()).filter(Boolean).map(part => {
    const colon = part.indexOf(':');
    if (colon < 1) throw new Error(`Malformed declaration: ${part}`);
    let value = part.slice(colon + 1).trim();
    const important = /\s*!important$/.test(value);
    value = value.replace(/\s*!important$/, '');
    return { prop: part.slice(0, colon).trim(), value, important };
  });
}

// Minimal plain-CSS parser: at-rules with blocks, and rules holding declarations.
function parseCss(text) {
  const src = text.replace(/\/\*[\s\S]*?\*\//g, '');
  let i = 0;
  function block(media) {
    const nodes = [];
    let buf = '';
    while (i < src.length) {
      const ch = src[i++];
      if (ch === '{') {
        const prelude = buf.trim();
        buf = '';
        if (prelude.startsWith('@')) {
          const [, name, params] = prelude.match(/^@([\w-]+)\s*(.*)$/s);
          nodes.push({ type: 'atrule', name, params: params.trim(), nodes: block([...media, params.trim()]) });
        } else {
          const end = src.indexOf('}', i);
          if (end < 0) throw new Error('Unclosed rule');
          nodes.push({ type: 'rule', selectors: splitSelectors(prelude), decls: parseDecls(src.slice(i, end)), media });
          i = end + 1;
        }
      } else if (ch === '}') {
        if (buf.trim()) throw new Error(`Stray text: ${buf.trim()}`);
        return nodes;
      } else {
        buf += ch;
      }
    }
    if (buf.trim()) throw new Error(`Stray text: ${buf.trim()}`);
    return nodes;
  }
  return block([]);
}

function rules(nodes) {
  return nodes.flatMap(node => (node.type === 'rule' ? [node] : rules(node.nodes)));
}

module.exports = {
  ROOT, ROUTE, SHEET, ASSETS, POPUP_CSS, THEME, SCOPE, ASSET_LINE, HEAD_ADDITION, CHANGES,
  read, count, restore, parseCss, rules, splitSelectors,
};
