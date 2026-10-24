# OPEMR-127: eRx account status presentation

The patient demographics source renders `patient/partials/erx.html.twig` when eRx is enabled. Its Ensora Account Status link targets `interface/soap_functions/soap_accountStatusDetails.php`, carries `iframe1`, and calls `top.restoreSession()`. The existing `.iframe1` handlers in demographics and `erx_patient_portal_js.php` specify a 350 × 300 `dlgopen` iframe with a Close button. This is a source chain, not proof of the behavior of an authenticated modal.

The route now has one body marker and one style block immediately after `Header::setupHeader()`. Its six color declarations apply only under `@media screen` when the HTML element has `oe-workbench-context`; the body background alone uses `!important` to counter the existing `body_top` background. Header loads the popup context assets in source, but whether a particular live iframe receives that class remains unverified. The palette uses the existing workbench tokens with fallbacks. This is a minimal color treatment, not the researched layout or completion of the original 22 features.

Removing those two additions restores all 3,221 original route bytes. Bootstrap, session and patient selection, the live SOAP call, translated labels, four count expressions, font, spacing, and table geometry remain as before; print-related source bytes remain unchanged, and native print behavior was not exercised. Header, the Twig link, both popup handlers, and all parent/shared sources remain unchanged. The route must not be executed for source verification because loading it calls `getAccountStatus()`.

## Evidence and remaining gates

The controller committed the tests-only head `de338a627aeed432f3c09230a5f2aa9f7b9796a9` before this production edit. Before the production edit, the controller ran these corrected RED commands: portable mode had 4/5 passing, and explicit history mode had 5/6 passing, each failing for the missing marker. An earlier duplicate caller anchor was a separate test setup failure, then corrected; it was not the genuine RED.

```sh
node --test --test-reporter=tap tests/clinical-ui/erx-account-status-contract.cjs
node tests/clinical-ui/erx-account-status-contract.cjs --history
```

The controller then ran both commands after the production edit: portable GREEN passed 5/5, and history GREEN passed 6/6, including the actual base blob and allowed committed, working, and untracked paths. The history check uses the direct launcher so `--history` reaches the test script. The Jest adapter passed 1/1 using an existing sibling Jest executable with the target config and no cache. CSS extracted from the actual production screen style passed a nonignored stylelint check with zero warnings and errors, using the target config and sibling config base directory. These were source checks; no PHP or project code was executed. Broader local suites were not run.

GREEN commands actually run by the controller:

```sh
node --test --test-reporter=tap tests/clinical-ui/erx-account-status-contract.cjs
node tests/clinical-ui/erx-account-status-contract.cjs --history
```

Native authenticated eRx modal QA and real contrast, narrow and short viewport, RTL, keyboard/focus, OS print, role, clinical/security, and vendor checks remain open or blocked pending authorization. Do not use live eRx to verify this source change without that authorization. This work makes no clinical safety claim. Ordinary approval, full exact-head CI, and independent coverage remain open; there is no merge or deployment. The existing all-22, researched UI, exhaustive popup, demo-data, Swedish, and denied-action boundaries remain in force.
