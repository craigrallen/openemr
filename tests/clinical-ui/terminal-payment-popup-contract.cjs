// Portable, dependency-free presentation contract for OPEMR-216.
// Run directly with node --test; the controller owns execution and Git checks.
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { test } = require('node:test');

const ROOT = path.resolve(__dirname, '../..');
const ROUTE = 'interface/patient_file/front_payment_terminal.php';
const FIXTURE = 'tests/clinical-ui/fixtures/terminal-payment-original.php.txt';
const PINNED_SHA256 = '70fe16ff2528c5409afee22a8d43587b6d9e1b9ed19aed0912812acf23724e9e';
const PINNED_HEAD = '09b29da7771aea334ed5745e058751157af980d7';
const ALLOWED_PATHS = new Set([
  ROUTE,
  FIXTURE,
  'tests/clinical-ui/terminal-payment-popup-contract.cjs',
  'tests/js/terminal-payment-popup.test.js',
  'docs/clinical-ui/TERMINAL-PAYMENT-POPUP.md',
]);
const BODY_MARKER = '<body class="oe-terminal-payment-popup">';
const ORIGINAL_BODY = '<body>';
const STYLE = `<style>
  @media screen {
    html.oe-workbench-context body.oe-terminal-payment-popup {
      --oe-wb-ink: #17343b;
      --oe-wb-paper: #fff;
      --oe-wb-line: #d9e4e2;
      --oe-wb-canvas: #f3f7f5;
      --oe-wb-petrol: #086878;
      color: var(--oe-wb-ink);
      background-color: var(--oe-wb-canvas);
      padding: 8px;
    }

    html.oe-workbench-context body.oe-terminal-payment-popup > .container-fluid {
      width: 100%;
      max-width: 720px;
      min-width: 0;
      margin: 0 auto;
      padding: 16px;
      color: var(--oe-wb-ink);
      background-color: var(--oe-wb-paper);
      border: 1px solid var(--oe-wb-line);
      border-radius: 8px;
    }

    html.oe-workbench-context body.oe-terminal-payment-popup .col-sm-6.offset-sm-3 {
      flex: 0 0 100%;
      width: 100%;
      max-width: 100%;
      margin-left: 0;
    }

    html.oe-workbench-context body.oe-terminal-payment-popup h4 {
      color: var(--oe-wb-ink);
      overflow-wrap: anywhere;
    }

    html.oe-workbench-context body.oe-terminal-payment-popup .btn:focus {
      outline: 3px solid var(--oe-wb-petrol);
      outline-offset: 2px;
      scroll-margin: 6px;
    }

    html.oe-workbench-context body.oe-terminal-payment-popup .btn:focus-visible {
      outline: 3px solid var(--oe-wb-petrol);
      outline-offset: 2px;
      scroll-margin: 6px;
    }

    html.oe-workbench-context body.oe-terminal-payment-popup .row.m-1 {
      flex-wrap: wrap;
    }

    html.oe-workbench-context body.oe-terminal-payment-popup .row.m-1 .btn {
      max-width: calc(100% - 0.5rem);
      white-space: normal;
      overflow-wrap: anywhere;
    }

    html.oe-workbench-context body.oe-terminal-payment-popup hr {
      border-color: var(--oe-wb-line);
    }

    html.oe-workbench-context body.oe-terminal-payment-popup h5 {
      color: var(--oe-wb-ink);
    }

    /* Bootstrap's bg-secondary utility is important; this one override pairs the log surface with readable ink. */
    html.oe-workbench-context body.oe-terminal-payment-popup #logs.bg-secondary {
      min-width: 0;
      color: var(--oe-wb-ink);
      background-color: var(--oe-wb-canvas) !important;
      border: 1px solid var(--oe-wb-line);
      border-radius: 6px;
      overflow-wrap: anywhere;
    }

    html.oe-workbench-context body.oe-terminal-payment-popup #logs pre,
    html.oe-workbench-context body.oe-terminal-payment-popup #logs code {
      min-width: 0;
      width: 100%;
      max-width: 100%;
      color: var(--oe-wb-ink);
      background-color: var(--oe-wb-canvas);
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
  }
</style>
`;
const ADDED_STYLE = STYLE;

const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const read = relative => fs.readFileSync(path.join(ROOT, relative));
const count = (source, literal) => source.split(literal).length - 1;
const fixture = () => read(FIXTURE);

function replaceOnce(source, from, to) {
  assert.equal(count(source, from), 1, `expected one anchor: ${from}`);
  assert.notEqual(from, to, 'mutation must change bytes');
  return source.replace(from, () => to);
}

function makeCandidate(original = fixture()) {
  let candidate = original.toString('utf8');
  candidate = replaceOnce(candidate, '</head>\n<body>', `${STYLE}</head>\n<body>`);
  return replaceOnce(candidate, ORIGINAL_BODY, BODY_MARKER);
}

function restorePresentation(candidate) {
  let source = Buffer.isBuffer(candidate) ? candidate.toString('utf8') : candidate;
  assert.equal(typeof source, 'string');
  assert.equal(count(source, STYLE), 1, 'exact inline style must occur once');
  assert.equal(count(source, BODY_MARKER), 1, 'exact body marker must occur once');
  assert.equal(count(source, `${STYLE}</head>\n${BODY_MARKER}`), 1, 'style must sit immediately before </head>');
  source = replaceOnce(source, `${STYLE}</head>\n${BODY_MARKER}`, `</head>\n${ORIGINAL_BODY}`);
  const restored = Buffer.from(source, 'utf8');
  assert.deepEqual(restored, fixture(), 'restored route must equal every byte of the frozen original');
  return restored;
}

function validateCandidate(candidate) {
  return restorePresentation(candidate);
}

function git(...args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'buffer' });
}

function historyPaths() {
  const committed = git('diff', '--name-only', '-z', PINNED_HEAD, 'HEAD').toString('utf8').split('\0').filter(Boolean);
  const status = git('status', '--porcelain=v1', '-z', '--untracked-files=all').toString('utf8').split('\0');
  const dirty = [];
  for (let i = 0; i < status.length && status[i]; i += 1) {
    const entry = status[i];
    dirty.push(entry.slice(3));
    if (/^[RC]/.test(entry.slice(0, 2)) || /[RC]$/.test(entry.slice(0, 2))) dirty.push(status[++i]);
  }
  return [...committed, ...dirty];
}

test('frozen original has the locally pinned full-file SHA256', () => {
  assert.equal(sha256(fixture()), PINNED_SHA256);
});

test('a synthetic candidate passes by restoring every original route byte', () => {
  const original = fixture();
  assert.deepEqual(validateCandidate(makeCandidate(original)), original);
});

test('missing presentation fails semantically on the untouched original', () => {
  assert.throws(() => validateCandidate(fixture()), /exact inline style must occur once/);
});

test('the proposed screen style keeps a readable, bounded payment sheet', () => {
  assert.equal(count(STYLE, '@media screen {'), 1);
  assert.equal(count(STYLE, '!important'), 1);
  assert.match(STYLE, /#logs\.bg-secondary \{[\s\S]*?background-color: var\(--oe-wb-canvas\) !important;/);
  assert.match(STYLE, /\.col-sm-6\.offset-sm-3 \{[\s\S]*?margin-left: 0;/);
  assert.match(STYLE, /max-width: calc\(100% - 0\.5rem\)/);
  assert.match(STYLE, /#logs pre,\n    html\.oe-workbench-context body\.oe-terminal-payment-popup #logs code \{/);
  assert.match(STYLE, /white-space: pre-wrap;\n      overflow-wrap: anywhere;/);
  assert.match(STYLE, /\.btn:focus \{[\s\S]*?outline: 3px solid var\(--oe-wb-petrol\);[\s\S]*?outline-offset: 2px;[\s\S]*?scroll-margin: 6px;/);
  assert.match(STYLE, /\.btn:focus-visible \{/);
  assert.doesNotMatch(STYLE, /\.d-none|display\s*:|visibility\s*:|overflow\s*:\s*hidden|font-(?:size|family)\s*:/);
  assert.doesNotMatch(STYLE, /<script|@media print/i);
});

test('negative controls reject unique changes outside the two allowed insertions', () => {
  const candidate = makeCandidate();
  const mutations = [
    ['amount', "let amount = <?php echo js_escape(str_replace('.', '', $total)); ?>;", "let amount = <?php echo js_escape($total); ?>;"],
    ['fetch URL', "./front_payment_cc.php?mode=terminal_create", "./front_payment_cc.php?mode=terminal_other"],
    ['reader simulation', 'const config = {simulated: false};', 'const config = {simulated: true};'],
    ['opener save', 'opener.$("[name=\'form_save\']").click();', 'opener.$("[name=\'form_save\']").hide();'],
    ['opener cancel', "const cancelButton = parent.document.getElementById('closeBtn');", "const cancelButton = parent.document.getElementById('otherBtn');"],
    ['hidden action', '<button id="collect-button" class="btn btn-primary btn-transmit m-1 d-none">', '<button id="collect-button" class="btn btn-primary btn-transmit m-1">'],
    ['visibility transition', 'document.getElementById("capture-button").classList.remove("d-none");', 'document.getElementById("capture-button").classList.add("d-none");'],
  ];
  for (const [name, before, after] of mutations) {
    const changed = replaceOnce(candidate, before, after);
    assert.notEqual(changed, candidate, name);
    assert.throws(() => validateCandidate(changed), name);
  }
});

test('negative controls reject duplicated, relocated, and unsafe style bytes', () => {
  const candidate = makeCandidate();
  const styleMutants = [
    ['duplicate style', replaceOnce(candidate, STYLE, STYLE + STYLE)],
    ['relocated style', replaceOnce(candidate, `${STYLE}</head>\n${BODY_MARKER}`, `</head>\n${BODY_MARKER}\n${STYLE}`)],
    ['unscoped selector', replaceOnce(candidate, 'html.oe-workbench-context body.oe-terminal-payment-popup #logs.bg-secondary', 'body #logs.bg-secondary')],
    ['print media', replaceOnce(candidate, '@media screen {', '@media print {')],
    ['revealed hidden controls', replaceOnce(candidate, '  @media screen {', '  @media screen {\n    .d-none { display: block !important; }')],
    ['blanket important', replaceOnce(candidate, '      color: var(--oe-wb-ink);\n      background-color: var(--oe-wb-canvas);\n      padding: 8px;', '      color: var(--oe-wb-ink) !important;\n      background-color: var(--oe-wb-canvas);\n      padding: 8px;')],
    ['changed body marker', replaceOnce(candidate, BODY_MARKER, '<body class="oe-terminal-payment-popup other">')],
  ];
  for (const [name, changed] of styleMutants) {
    assert.notEqual(changed, candidate, name);
    assert.throws(() => validateCandidate(changed), name);
  }
});

test('live route has precisely the approved presentation insertions', () => {
  validateCandidate(read(ROUTE));
});

if (process.argv.includes('--history')) {
  test('pinned Git blob authenticates fixture and five-path history scope', () => {
    assert.equal(path.resolve(git('rev-parse', '--show-toplevel').toString('utf8').trim()), ROOT);
    assert.deepEqual(git('show', `${PINNED_HEAD}:${ROUTE}`), fixture());
    const paths = historyPaths();
    for (const file of paths) assert.ok(ALLOWED_PATHS.has(file), `out-of-scope path: ${file}`);
  });
}

module.exports = { STYLE, ADDED_STYLE, BODY_MARKER, makeCandidate, restorePresentation, validateCandidate };
