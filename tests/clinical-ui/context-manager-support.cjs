'use strict';

// Shared, dependency-free support for the Nation Notes context manager popup tests.
//
// Intended production edits (the only ones allowed; see CHANGES and ASSET_LINE):
//   library/custom_template/add_context.php
//     - import OpenEMR\Common\Assets\ClinicalWorkspaceAssets after AclMain
//       (OEGlobalsBag is already imported and supplies the web root);
//     - directly after Header::setupHeader('opener'), one screen-only versioned
//       <link> to interface/clinical-workspace/context-manager-popup.css;
//     - identifying classes on existing nodes only: body, form, outer table,
//       inner list table, both field cells and both action cells.
//     The inline <style>/<script>, ACL, SQL, $_POST handling, escaping, handlers,
//     hidden inputs, .text/.class1/.class2 rows and the malformed nested
//     Save/Cancel and Update/Cancel anchors stay byte-identical.
//   src/Common/Assets/ClinicalWorkspaceAssets.php
//     - one allowlist entry, 'context-manager-popup.css', in sorted position.
//   interface/clinical-workspace/context-manager-popup.css (new)
//     - one @media screen block; every selector under SCOPE; popup.css tokens
//       only; exactly one !important (the body canvas, overriding the theme's
//       .body_top !important); paired ink/paper on every painted rule; stripes
//       .class1 ink+paper and .class2 ink+canvas inside the list table; field
//       paint guarded by one :not(:disabled, .is-invalid, .is-valid, [readonly]);
//       :focus and :focus-visible in separate rules; actions may wrap (a
//       provision for narrow dialogs, not proof that 500x500 fits).
//   The caller (personalize.php, dlgopen 500x500 onClosed refreshme), shared
//   popup.css/popup.js, Header.php, themes and workspace.css are not touched.

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '../..');
const ROUTE = 'library/custom_template/add_context.php';
const CALLER = 'library/custom_template/personalize.php';
const SHEET = 'interface/clinical-workspace/context-manager-popup.css';
const ASSETS = 'src/Common/Assets/ClinicalWorkspaceAssets.php';
const POPUP_CSS = 'interface/clinical-workspace/popup.css';
const THEME = 'interface/themes/color_base.scss';
const SCOPE = 'html.oe-workbench-context.oe-workbench-popup body.oe-context-manager';
const ASSET_LINE = "        'context-manager-popup.css',\n";

// Reads a file as UTF-8, refusing anything that would not round-trip byte for byte.
function read(file) {
  const raw = fs.readFileSync(path.join(ROOT, file));
  const text = raw.toString('utf8');
  if (!Buffer.from(text, 'utf8').equals(raw)) throw new Error(`${file} is not lossless UTF-8`);
  return text;
}

const HEADER_LINE = "        <?php Header::setupHeader('opener'); ?>\n";
const HEAD_ADDITION = "        <?php $clinicalAssets = new ClinicalWorkspaceAssets(); ?>\n"
  + '        <link rel="stylesheet" media="screen" href="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>/interface/clinical-workspace/context-manager-popup.css?v=<?php echo attr_url($clinicalAssets->version(\'context-manager-popup.css\')); ?>">\n';

// Every allowed presentation edit as [original, presented]. Nothing else may differ.
const CHANGES = [
  ['use OpenEMR\\Common\\Acl\\AclMain;', 'use OpenEMR\\Common\\Acl\\AclMain;\nuse OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;'],
  [HEADER_LINE, HEADER_LINE + HEAD_ADDITION],
  ['<body class="body_top">', '<body class="body_top oe-context-manager">'],
  ['<form name="designation_managment" action="" method="post">', '<form name="designation_managment" action="" method="post" class="oe-context-manager-form">'],
  ['<table cellpadding=\'2\' cellspacing=\'0\' border="0" align="center">', '<table cellpadding=\'2\' cellspacing=\'0\' border="0" align="center" class="oe-context-manager-sheet">'],
  ['<table>', '<table class="oe-context-manager-list">'],
  ['<td colspan="3"><input type="text" name="contextname"', '<td colspan="3" class="oe-context-manager-field"><input type="text" name="contextname"'],
  ['<td colspan="1"><a href="#" onclick="checkSubmit()"', '<td colspan="1" class="oe-context-manager-actions"><a href="#" onclick="checkSubmit()"'],
  ['<td colspan="3"><input type="text" name="updatecontextname"', '<td colspan="3" class="oe-context-manager-field"><input type="text" name="updatecontextname"'],
  ['<td colspan="1"><a href="#" onclick="checkUpdate()"', '<td colspan="1" class="oe-context-manager-actions"><a href="#" onclick="checkUpdate()"'],
];

const ADDED_CLASSES = [
  'oe-context-manager', 'oe-context-manager-form', 'oe-context-manager-sheet',
  'oe-context-manager-list', 'oe-context-manager-field', 'oe-context-manager-actions',
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

const declsOf = rule => Object.fromEntries(rule.decls.map(d => [d.prop, `${d.value}${d.important ? ' !important' : ''}`]));

// Field paint must leave disabled, readonly and validation states to the theme.
const STATE_GUARD = [':disabled', '.is-invalid', '.is-valid', '[readonly]'].sort();
const FIELD_TARGET = /#(update)?contextname\b|\binput\b/;
const guardsOf = selector => [...selector.matchAll(/:not\(([^()]*)\)/g)]
  .map(match => match[1].split(',').map(part => part.trim()).sort());

const BANNED = /^(font|font-[\w-]+|line-height|letter-spacing|text-transform|text-indent|visibility|position|overflow|overflow-x|overflow-y|clip|clip-path|height|max-height|pointer-events|user-select|opacity|content|zoom|transform)$/;
const THEME_IMPORTANT = /\.body_top,\n\.bgcolor2,\n\.body_nav \{\n {2}background-color: \$paler !important;/;

// Every invariant the sheet must hold; returns human-readable problems ([] when clean).
function sheetProblems(css, popupCss, theme) {
  const problems = [];
  let top;
  try {
    top = parseCss(css);
  } catch (error) {
    return [`unparsable:${error.message}`];
  }
  if (top.length !== 1 || top[0].type !== 'atrule' || `${top[0].name} ${top[0].params}` !== 'media screen') {
    problems.push('sheet must be exactly one @media screen block');
  } else if (!top[0].nodes.every(node => node.type === 'rule')) {
    problems.push('no nested at-rules');
  }
  const all = rules(top);
  const defined = new Set([...popupCss.matchAll(/^\s*(--oe-wb-[\w-]+):/gm)].map(match => match[1]));
  if (!THEME_IMPORTANT.test(theme)) problems.push('theme no longer forces .body_top; revisit the canvas override');
  const important = [];
  for (const rule of all) {
    const label = rule.selectors.join(', ');
    for (const selector of rule.selectors) {
      if (selector !== SCOPE && !selector.startsWith(`${SCOPE} `)) problems.push(`unscoped: ${selector}`);
      if (FIELD_TARGET.test(selector)) {
        const guards = guardsOf(selector);
        if (guards.length !== 1 || JSON.stringify(guards[0]) !== JSON.stringify(STATE_GUARD)) {
          problems.push(`field selector must carry one state guard: ${selector}`);
        }
      }
    }
    const kinds = new Set(rule.selectors.map(s => s.includes(':focus-visible')));
    if (kinds.size !== 1) problems.push(`:focus-visible grouped with other selectors: ${label}`);
    const d = declsOf(rule);
    if (('color' in d) !== ('background-color' in d)) problems.push(`unpaired ink/paper: ${label}`);
    for (const decl of rule.decls) {
      if (BANNED.test(decl.prop)) problems.push(`banned property ${decl.prop}: ${label}`);
      if (decl.prop === 'display' && /none/.test(decl.value)) problems.push(`display none: ${label}`);
      if (/#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(/i.test(decl.value)) problems.push(`raw colour ${decl.value}: ${label}`);
      for (const [, name] of decl.value.matchAll(/var\((--[\w-]+)\)/g)) {
        if (!defined.has(name)) problems.push(`undefined token ${name}`);
      }
      if (decl.important) important.push({ rule, decl });
    }
  }
  if (important.length !== 1) problems.push(`expected exactly one !important, found ${important.length}`);
  for (const { rule, decl } of important) {
    if (rule.selectors.length !== 1 || rule.selectors[0] !== SCOPE
      || `${decl.prop}: ${decl.value}` !== 'background-color: var(--oe-wb-canvas)') {
      problems.push(`unauthorized !important: ${rule.selectors.join(', ')} ${decl.prop}`);
    }
  }
  if (/\):not\(/.test(css)) problems.push('chained :not(); use one complex :not()');
  if (/\t/.test(css)) problems.push('tab indentation');
  for (const line of css.split('\n')) {
    if (line.trim() && !/^\s*\*/.test(line) && !/^( {2})*\S/.test(line)) problems.push(`indentation: ${line}`);
  }
  if (!css.endsWith('}\n')) problems.push('sheet must end with "}\\n"');
  return problems;
}

module.exports = {
  ROOT, ROUTE, CALLER, SHEET, ASSETS, POPUP_CSS, THEME, SCOPE, ASSET_LINE, HEADER_LINE, HEAD_ADDITION,
  CHANGES, ADDED_CLASSES, STATE_GUARD,
  read, count, restore, parseCss, rules, splitSelectors, declsOf, guardsOf, sheetProblems,
};
