# Patient rule data screen (OPEMR-71)

Route: `interface/patient_file/rules/patient_data.php`
Contract: `tests/isolated/patient-rule-data-contract.cjs`
Fixture (unchanged original): `tests/fixtures/patient-rule-data-original.php.txt`
Pinned base: `18647270e0c799189d2dc10f801e8de2bff1a360`

## What this slice is

A **partial backdrop** for the clinical-rule patient-data popup when it is
opened inside an active clinical workbench: a canvas-coloured body behind a
paper-coloured form, each with its paired ink colour. That is all.

It is **not** research-design fidelity, **not** an accepted UI, and **not** a
native contrast or accessibility acceptance. It makes no clinical or national
readiness claim (including Swedish deployment).

## The change

Exactly two additions to the route; every other byte is preserved.

1. One inline `<style>` block, embedded with the four-space head prefix on the
   tags only, placed directly after the page `</script>` and before `</head>`.
   The CSS body starts at column zero and is pinned literally by the contract:

   ```css
   @media screen {
     html.oe-workbench-context body.oe-rule-patient-data {
       color: var(--oe-wb-ink, #17343b);
       background-color: var(--oe-wb-canvas, #f3f7f5) !important;
     }

     html.oe-workbench-context body.oe-rule-patient-data > form {
       color: var(--oe-wb-ink, #17343b);
       background-color: var(--oe-wb-paper, #fff);
     }
   }
   ```

2. The body marker class: `<body class="body_top">` becomes
   `<body class="body_top oe-rule-patient-data">`.

Minimal palette only: canvas background with paired ink on the body, paper
background with paired ink on the direct child form. Fallbacks equal the shared
`--oe-wb-*` tokens declared in `interface/clinical-workspace/popup.css`.

### Why exactly one `!important`

The existing `.body_top` theme rule already sets its background as important,
so the canvas background cannot win without it. That is the single justified
`!important` declaration. Ink and paper do not need it and do not carry it.

### Screen only

The CSS rules are restricted to `@media screen`. The new `<style>` element and
the `oe-rule-patient-data` body class are DOM additions that apply in all media,
so print equivalence with the legacy route is unverified. Print output has not
been checked natively, and legacy print rendering is not asserted as proved.

## Real caller chain (source assertions only)

- `library/clinical_rules.php`: the `custom_flag` reminder branch links to
  `../rules/patient_data.php?category=…&item=…` with class `medium_modal`.
- `interface/patient_file/summary/demographics.php`: inside the CDR gate
  (`enable_cdr` and `enable_cdr_crw`), `.medium_modal` clicks call
  `dlgopen('', '', 800, 200, …)` with `type: 'iframe'`,
  `dialogId: 'demreminder'`, `allowResize: false`, `allowDrag: true` and
  `onClosed: 'refreshme'`, with no `sizeHeight` override.
- `library/dialog.js`: iframe dialogs open in `top` inside `.dialogModal`;
  with the default `sizeHeight: 'auto'` an iframe height `<= 300` becomes
  `300` before auto-height sizing (`SizeModaliFrame`), and the modal is capped
  at `max-height: 94vh`.

## Activation

The route adds no asset, link or script. `Header::setupHeader` already
autoloads the shared `workbench-popup` engine (`popup.js` / `popup.css`) via
`config/config.yaml`. The contract runs the real `popup.js` unmodified in
`node:vm` against hand-built window objects and checks: activation on an active
shell, re-activation after an edit-link reload, inert on a legacy shell then
following activation and legacy removal, `pagehide` disposal, a cross-origin
parent never trusted, no match without the marker class, and body classes,
`refreshme` and `dlgclose` left untouched.

These are **synthetic, not native**: no browser, layout, cascade or paint.

## Explicitly not cleared

- Descendant `.required`, `.text`, `.title`, `.showborder` / `showborder_head`
  rows, the `LightGrey` selected-row highlight, and theme-focused controls keep
  their existing theme styling and are not targeted. Their contrast against the
  new canvas/paper is not cleared.
- Native dark and solar theme contrasts are not cleared.
- The inline red background that `validate()` sets on `#form_date` for an
  empty or future-dated completed entry is unchanged and not targeted; nothing
  in the block reaches inputs, so it stays effective.

## Known pre-existing security gap (unresolved, source-only)

The `entryID` `SELECT` and the edit `UPDATE` on `rule_patient_data` filter by
`id` only, with no session `pid` predicate. Only the history list query is
`pid` scoped. This is a source-reading finding; no runtime exploit is claimed
or was attempted. This slice deliberately does not fix it, and the contract
pins both queries unchanged so the gap stays visible for a separate security
change.

## Not done in this slice

No clinical rule execution, no database access, no live PHP bootstrap, and no
save, date, calendar or other mutation was performed.

## TDD record

- **RED (actual, controller-run):** 81 tests, 80 pass, one fail — the
  production-route test reporting the missing presentation on the actual
  source; exit 1. Saved at
  `/Users/craig/.hermes/projects/openemr/verification/patient-rule-data-20261020/red-confirmed.tap`.
  The positive synthetic patch passed, and the fixture was independently
  confirmed byte-equal (8387 bytes) to the route at the pinned base.
- **GREEN / local verification (actual, controller-run):** portable contract
  81/81; explicit `--history` 84/84; full actual Git-base inverse reproduces
  the original route byte for byte (8387 bytes); PHP syntax check; `git diff
  --check`; rooted adapter ESLint; stylelint on the actual extracted CSS (not
  ignored) with no warnings; full target Jest 62 suites / 1260 tests PASS. 13
  temporary individual sibling-dependency links used for the run were removed.
  No installs, config, dependency or gate changes.
- **Independent review:** a read-only Codex gpt-6-astra review of the complete
  five-file change found no introduced P1/P2/P3 and independently reproduced
  81, 84, PHP syntax and the inverse. Judged suitable for DRAFT publication
  only.
- **Hosted CI:** pending publication. The final hosted state will be recorded
  after publication in the durable controller artifact
  `verification/patient-rule-data-20261020/DELIVERY.md`. Ordinary approval,
  native verification and security review remain open.

Commands for the controller:

```bash
node tests/isolated/patient-rule-data-contract.cjs            # portable
node tests/isolated/patient-rule-data-contract.cjs --history  # needs git + base; mandatory before merge
```

Rationale: the contract was written and shown failing on the real source before
any production edit, with a synthetic candidate proving the contract itself is
satisfiable. The production change was then made to match that candidate
exactly, so GREEN should mean the route equals the reviewed candidate rather
than "something passes".

### Full inverse expectation

`verify()` undoes each addition exactly once and requires the result to equal
the fixture byte for byte. So removing the style block and reverting the body
class must reproduce the original route exactly; any other change anywhere in
the route (including whitespace, a trailing newline, a moved block, a new
`use`, `<link>` or `<script>`) is rejected by `verify()` itself. The
`--history` run additionally checks the fixture and the restored route against
`git show <base>:<route>`, and that changes since the base are exactly the five
allowlisted files.

### Edge cases covered by the contract

Gate removed or renamed, print/all media, missing `@media`, `media`/`type`
attributes on `<style>`, selector lists, extra rules or properties, input /
semantic-class / descendant-form targeting, extra or missing `!important`,
swapped or hard-coded colours, geometry and font properties, wrappers or
classes on the form, duplicated or relocated style blocks, indentation drift,
marker corruption, and mutations of pid source, ACL, CSRF, escaping, cancel,
save, post-save close, picker settings and the pid-less queries.

## Limitations and pending gates

Native browser verification is pending for: opened dialog, resized and narrow
viewports, short heights against the 300px floor and 94vh cap, keyboard and
focus order, RTL, role/ACL variations, session expiry, security review,
save/cancel round-trip, and print.

Still open beyond this slice: all 22 original features (they are requested
features; popup coverage is a separate matter), demo coverage, exhaustive popup
coverage, the full researched UI, and Swedish localisation and readiness.

Ordinary review approval is required. No merge or deploy is implied by this
document.
