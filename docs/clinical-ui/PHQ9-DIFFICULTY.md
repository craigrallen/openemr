# OPEMR-201: PHQ-9 difficulty change handler

`new.php` and `view.php` both load `common.php`, which includes `phq9_javasrc.js`. When a nonzero PHQ-9 score creates the optional difficulty select, its native `change` event now calls `record_score_q10(this.value)` once. The value belongs to that select, including after a menu has been removed and recreated. Difficulty remains outside the nine-question total.

The product change is exactly one line in `interface/forms/phq9/phq9_javasrc.js`:

```diff
-        menu.onchange = "record_score_q10(my_form.difficulty.value);";
+        menu.onchange = function () { record_score_q10(this.value); };
```

The exact inverse restores the original line above. The original full file SHA-256 is `2f8be6a2784b9dfc61ad4e57219f1dba323956c20c411d08fdd70b90b53821c1`; the portable contract checks the complete source against that hash after applying the inverse. The starting HEAD was tests-only commit `73f655a330e9a66b766a1d92d65d48605d626da2`.

## Evidence and limits

- Controller RED: `/Users/craig/.hermes/projects/openemr/verification/phq9-difficulty-20261101/controller-red.log` recorded 12 portable cases with 8 semantic failures before the change.
- Worker GREEN, run 1: `node tests/clinical-ui/phq9-difficulty-contract.cjs` returned `{"count":12,"failures":[]}`. `node --check` passed for the native script and portable contract. No second implementation or run was attempted; any next implementation must be established independently.
- The portable contract uses a small synthetic DOM. It covers native handler dispatch, values `0` through `3` and `undef`, initial and edited selections, removal and recreation, and the nine scored questions. It does not establish authenticated save/reload, security, persistence, full accessibility, or clinical QA. The local Jest suite was not run.
- `common.php` has no dirty flag. Cancel unconditionally calls `confirm`; this change does not alter that behavior. `save.php` still uses raw `$_POST` for form submission and its update parameters, including `difficulty`. This change does not claim a data-loss repair.
- Ordinary approval and the exact-head hosted gate remain open. The controller handles commits and external evidence.
