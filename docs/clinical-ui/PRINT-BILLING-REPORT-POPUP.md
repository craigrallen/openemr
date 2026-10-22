# Printable Billing Report — OPEMR-55

Actual route `interface/billing/print_billing_report.php`; caller
`interface/billing/billing_report.php::SubmitTheScreenPrint()` POSTs `the_form` to
named target `new`, without explicit window dimensions. Owner Hermes, rotation
run1/max2 including implementation and QA. Draft PR129; not merged or deployed.
This is partial source presentation, NOT native, full researched UI, security,
financial, clinical or audit acceptance. Ordinary approval is required; no bypass.

## Exact implementation

One 18-line `media="screen"` style after the existing Header line and one class
`oe-print-billing-report-document` on the existing body, retaining every original
body attribute. Three rules beneath `html.oe-workbench-context` and that marker:

- Body: paired `--oe-wb-ink` / `--oe-wb-canvas`.
- Existing direct-child raw tables: paired ink / `--oe-wb-paper`, inset quiet edge
  using `--oe-wb-line` (no physical border or size change).
- Existing direct-child close anchor and its `.title`: paired ink / canvas in one
  grouped rule. Selectors are on separate lines, without focus-state overrides.

Fallbacks are ink `#17343b`, canvas `#f3f7f5`, paper `#fff`, line `#d9e4e2`.
Declared ink/background pairs meet 7:1; this is NOT effective descendant/theme
contrast proof. Existing shared popup typography/cascade remains unchanged.

Style tags sit at column0, selectors at2spaces and declarations at4spaces;
removing only the common2space embedding prefix leaves repository2space CSS
properties. Grouped selectors each occupy a line; rules have blank separators.

Removing only the approved additions restores the COMPLETE original route
byte-for-byte. No original PHP/JS/ACL/query/billing/escaping/translation/data/date/
width/COLS/close-link/caller/helper/shared assets/geometry/fonts/wrapper changes.
Original table/helper output and browser parsing remain native acceptance gates.
The body class is an all-media DOM change, despite screen-only CSS. This target
has no `printLogPrint`; no audit-payload change is inferred. OS print is unverified.

## Actual TDD and local verification

Claude `claude-opus-5-5` implemented tests then production through the telemetry
wrapper, Read/Edit/Write only; no nested coding agents or permission denials.

1. Genuine local mandatory-history RED:11pass1missing-presentation failure BEFORE
   production. Complete171line fixture authenticated against actual Git base
   `18647270e0c799189d2dc10f801e8de2bff1a360`, SHA256
   `41913171ab3d5990e7a537bde32600cb5b5dec5e27373393ab1e889d950b69f5`.
2. Tests-only `f54dde3990580fde3577efdb27aba15285ad9507`; hosted JS39269661384
   completed RED solely missing presentation:61other suites/1259tests passed.
   Hosted completion read after production; local observed RED proves chronology.
3. First production:12/12 mandatory-history and62Jest suites/1260tests passed;
   actual nonignored CSS lint FAILED grouped-selector comma/newline rule.
4. Strengthened format contract FIRST, retaining original inverse/pin/mutants and
   adding format negatives:10pass2intended live-format failures. Then production
   changed ONLY comma-space into comma-newline+same selector indentation.
5. Final mandatory-history12/12 PASS; full target-root Jest62suites/1260tests PASS;
   PHP syntax and `git diff --check` PASS. Actual extracted CSS substantive
   nonignored stylelint result zero warnings/errors. Temporary individual sibling
   dependency links used for config resolution were removed; no install/config or
   dependency changes. Portable suite excludes the one opt-in Git test.
6. Controller-owned independent Codex `gpt-6-astra` inspected all5files plus actual
   caller/Header/config/theme/helper chain: no introduced P1/P2. Independently
   mandatory-history12/12 and diff-check PASS. Nonblocking discovery-vs-lifecycle
   test-label wording corrected; no assertion changes.

Hosted final exact-head PHP/JS/matrix/coverage and metadata gates remain pending
at publication. Authoritative final results, including any later failures, live in
mission `verification/print-billing-report-20261019/DELIVERY.md` and
`ci-current.json`; local/source success is not hosted/native acceptance.

## Preserved risks and separate acceptance

- Caller POST versus route GET criteria mismatch remains unchanged, source-observed
  and not runtime cleared. Duplicate GET parsing and fetches also remain.
- GET `mode=bill` can call `BillingReport::billCodesList`, which UPDATEs billing;
  existing acct/eob OR acct/bill write ACL preserved, not security cleared.
- No application/bootstrap/caller/DB/patient/financial/print/audit request was made.
- Controller discovery unit tests use active/closed/cross-origin/missing opener
  snapshots. They do NOT test closing an already-active opener or lifecycle.
  Real named-target POST opener retention, context activation/reuse/BFCache,
  default/dark/solar compiled themes, descendants, initial+resized narrow/short,
  RTL, keyboard/roles, original window.close link and legacy OS print remain open.
- Source paints only existing body/tables/link; not exhaustive popup or full
  researched-layout fidelity. Original22/demo/Swedish programmes stay unfinished.
- Ordinary approval required. No merge/deploy/policy/cron change; preserve Swedish
  fresh-clone denial, PR112 unpublished work/denied review and other boundaries.

## Contracts

- `tests/fixtures/print-billing-report-original.php.txt`: complete nonexecuting base.
- `tests/clinical/print-billing-report-popup.test.cjs`: dependency-free `node:test`,
  synthetic candidate/full inverse/digest/anchored semantic+format mutation checks,
  caller and discovery models. Live untouched production cannot falsely pass.
- `tests/js/clinical-print-billing-report-popup.test.js`: root Jest wrapper invokes
  portable suite, no Git by default, supported in hosted shallow checkout.

Run `node --test tests/clinical/print-billing-report-popup.test.cjs` for portable
checks. Set `REQUIRE_GIT_BASELINE=1` for mandatory original authentication; missing
history fails, not skips. Optional `PRINT_BILLING_REPORT_TARGET_ROOT` targets a
checkout; fixture still belongs to this test tree. Source-only tests never run PHP.
