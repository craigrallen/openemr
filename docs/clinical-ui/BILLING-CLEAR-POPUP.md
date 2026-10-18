# OPEMR-45 billing clear popup: tests checkpoint

The requested scope is a small source-level presentation for the existing billing-log result. This checkout currently has **tests only**. The controller observed a genuine local RED: five synthetic tests passed and the production missing-additions case failed. The corrected specification awaits controller execution. GREEN, runtime QA, CI, and independent review are pending.

The existing `clear_log.php` is a **mutating GET** route. Its PHP/bootstrap CSRF check, `acct/eob` or `acct/bill` write ACL, `file_exists`, dated destination, unchecked `rename` result, and both translated output branches remain authoritative. A successful `rename()` call is not proven by the existing success message, so this work does not accept cleared-log data integrity. The caller uses `dlgopen(..., '_blank', 500, 400)` after confirmation and session restoration. No live endpoint, billing log, database, or file-log QA is authorized here.

The portable test uses complete frozen originals for the route and `ClinicalWorkspaceAssets`. It builds one synthetic candidate with exactly declared additions, removes only those additions, and requires byte-for-byte restoration. It checks guard and output ordering, both original messages, asset escaping and versions, and a sheet and content wrapper after the guards. The added head has a viewport meta tag and translated Billing Log title. The stylesheet contract is one scoped `@media screen` block with exactly three rules: paired canvas/ink, paired paper/ink with quiet sheet spacing and border, and content wrapping. Its fallback tokens are `--oe-wb-canvas: #edf3f4`, `--oe-wb-ink: #17343b`, `--oe-wb-paper: #fff`, and `--oe-wb-border: #c9d7da`. Negative mutations cover altered guards, date/rename, messages, escape calls, ordering, CSS leakage, extra declarations, and changed original bytes. These are source guards, not proof of rendered PHP output or runtime behavior.

The production handoff is limited to `interface/billing/clear_log.php`, `src/Common/Assets/ClinicalWorkspaceAssets.php`, and `interface/clinical-workspace/billing-clear-popup.css`. The intended document loads the escaped, versioned screen stylesheet and unchanged context-only `popup.js`. The helper adds `billing-clear-popup.css` and `popup.js` to its supported list; `popup.js` follows `patient-search.css` and precedes `soap-document.css`. The original caller and popup assets stay unchanged.

Controller commands, from the checkout root:

```text
node --test tests/clinical-ui/billing-clear-popup.test.cjs
BILLING_CLEAR_HISTORY=1 node --test tests/clinical-ui/billing-clear-popup.test.cjs
```

The Jest wrapper is `tests/js/billing-clear-popup.test.js`; it invokes the portable suite with `process.execPath`. Local history mode reads the exact verified base `18647270e0c799189d2dc10f801e8de2bff1a360` with `git show`, checks the unchanged caller, popup assets, dark and solar themes, and `theme-defaults.scss`, and checks the eight-file OPEMR-45 allowlist.

Keyboard behavior, narrow and RTL display, native legacy and print display, role behavior, compiled themes and context, and full researched design acceptance remain **OPEN**. The viewport and title changes require native QA. Original22, demo, exhaustive popup, Swedish checkout, and denial gates are preserved outside this change.
