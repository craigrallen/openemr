# Patient notes body: bounded reading geometry

Status: production CSS inserted after controller-verified RED. The controller's post-edit portable contract, history contract, syntax, diff, source CSS Stylelint and adapter ESLint checks passed. The bounded offline browser matrix passed; exact-head CI, independent review and native authenticated checks remain pending. This is a partial presentation change to the existing patient staff notes/messages list, not clinical acceptance.

## Scope and reference

The only route change is the exact `STYLE` exported by `tests/clinical-ui/patient-notes-body-contract.cjs`, inserted immediately before the contract's declared `ANCHOR` in `interface/patient_file/summary/pnotes_full.php`. `ANCHOR` is local to the contract module, not exported. Removing the style block restores the complete original route bytes. The existing `patient-messages.css` palette adaptation, markup, PHP, scripts, controls, data and endpoints remain as they were. The new rules are limited to `@media screen` and `body.oe-clinical-workspace.oe-clinical-messages #pnotes`, so they target the active workbench list.

The researched `messageView` reference in `OpenEMR-Research/researched/index.html`, recorded in [PATIENT-MESSAGES.md](PATIENT-MESSAGES.md), composes `.sheet`, `.sheet-head`, `.pad`, `.message` and `.split`; `.doc` belongs to other views. This slice carries some reading geometry into the existing table: the patient name has its own 18px line below the heading; the nested row can occupy the available width; action labels can wrap; the existing sheet gets responsive padding; and the fifth table cell has `min-width: 38ch`, `max-width: 65ch`, 18px/22px padding and 1.65 line height. The 38ch and 65ch values are table-layout hints, not a hard text-width cap or a guaranteed 38–65ch rendered measure. The table remains a table and its columns, links and actions stay present. The adaptation retains the table rather than the reference conversation and reference pane. It does not add that pane or implement any reference feature.

This supports the original feature 6 (patient-linked internal notes/messages between medical staff) as a visual slice. Feature 6 is not completed, and none of the 22 features in [ACCEPTANCE.md](ACCEPTANCE.md) is accepted by this edit. There is no claim of clinical or runtime parity.

## Test evidence and pending checks

The controller's corrected portable RED, against the tests-only commit `5aa710a0bbc7b1cfd28e0e5dd00b71ca7d9c3fb9`, was **25 tests, 24 passed, 1 failed**: the live route was missing the exact inline style. The direct history RED was **26 tests, 25 passed, 1 failed** for the same reason. Full fixture/base equality passed. This original production RED remains part of the evidence.

After the style insertion, the controller reported **25/25 portable tests passed** and **26/26 direct history tests passed**, plus syntax and diff checks passed. Actual, nonignored source CSS Stylelint completed with **0 warnings**, and adapter ESLint passed. These are controller checks on the candidate, not exact-head hosted CI results.

Controller verification commands for this change:

```sh
node --test --test-reporter=tap tests/clinical-ui/patient-notes-body-contract.cjs
node --test-reporter=tap tests/clinical-ui/patient-notes-body-contract.cjs --history
```

The portable contract has **25 named tests**; direct `--history` adds one, for **26 named tests**. The contract checks the exact style, its location and the inverse that restores the complete route; history mode checks the base fixture and changed-path scope. The following Jest command is illustrative for the **hosted environment only**. Prior local cache/Jest scope was denied, so it is not a local instruction or a reported pass:

```sh
npm run test:js -- --runInBand tests/js/patient-notes-body.test.js
```

The controller's offline candidate matrix completed **40 cases**: five compiled themes at 320, 390, 640 and 1366px in LTR and simulated RTL. It reported `stage=complete`, `ok=true`, zero geometry failures, and zero requests or errors. There were also **120 full-body computed-style and DOM comparisons** against the original across legacy screen and print in both modes, all passed. These were source-derived static HTML pages with **synthetic dynamic rows**; they did not execute PHP or native route scripts. The Solar remote font was omitted, RTL was simulated, and native roles, sessions, persistence, full contrast and OS print gates remain open. Earlier selector-null setup failure, unsettled-transition comparison failures and partial timeout remain in the external evidence; the controller corrected only the external harness, without a product change. The completed matrix is bounded presentation evidence, not full fidelity or clinical acceptance.

An auxiliary reviewer byte-comparison attempt was denied at a `/dev/fd` boundary. No conclusion here relies on retrying that action; the earlier permitted controller contracts and Git blob evidence are separate. Exact-head CI and independent review are still pending. A maximum allocation of **two consecutive SCHEDULED RUNs** limits scheduling; it is not a cap of two test attempts and is not test evidence.

Native authenticated gates remain open: staff send/read across permitted roles, restricted-role denial, CSRF, persistence, native table keyboard behavior, contrast, translated and RTL layout, and OS print. Existing denied Swedish clone/publication work and other denied scopes remain excluded.
