# OPEMR-49: prior-authorization delete popup presentation

Status: **hosted RED complete; production seam added, unverified.** GREEN,
review and native acceptance are pending until the controller runs them.
Ordinary review and approval are required. Nothing here authorizes a merge or
a deploy.

## Scope

Route: `interface/modules/custom_modules/oe-module-prior-authorizations/public/deleter.php`
Base: `18647270e0c799189d2dc10f801e8de2bff1a360`

The route is a **mutating GET**. It checks the admin/practice ACL, opens the
session, validates CSRF from `INPUT_GET` (die on fail), and runs
`delete from module_prior_authorizations where id = ?`. All of that happens
before any HTML is sent. No test or tool in this slice runs the route. There is
no live GET, no database access, no patient data, and no print.

Real caller: `public/index.php` `removeEntry(id)` opens
`deleter.php?id=…&csrf_token_form=…` with `dlgopen(url, '_blank', 290, 290, …)`.
It has an external `Done` button (`style: 'danger btn-sm'`, `close: true`) and
`onClosed: 'refreshme'`, which calls `top.restoreSession()` and
`location.reload()`. The caller is outside this slice and must stay
byte-identical.

The existing `Header::setupAssets(['workbench-popup'])` opt-in on line 37 comes
from earlier popup work. That opt-in does not count as a body migration.

This is a partial source adaptation. It is not a full researched design. It
provides no native acceptance and no security acceptance.

## Exact original (master 18647270, lines 29–42)

The full 42-line route is frozen in
`tests/fixtures/clinical-workspace/prior-auth-deleter.master-18647270.txt`.
The HTML tail is:

```html
<!doctype html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport"
          content="width=device-width, user-scalable=no, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="ie=edge">
    <title><?php echo xlt('Delete Record') ?></title>
    <?php echo Header::setupAssets(['workbench-popup']); ?>
</head>
<body>
    <p><?php echo "<br> <br>" .  xlt("If you are seeing this message the record was deleted. Click done, pls"); ?></p>
</body>
</html>
```

## Planned delta (the only approved change)

```diff
     <?php echo Header::setupAssets(['workbench-popup']); ?>
+    <style media="screen">
+        html.oe-workbench-context body.oe-prior-auth-delete-popup {
+          background-color: var(--oe-wb-canvas, #f3f7f5);
+        }
+
+        html.oe-workbench-context body.oe-prior-auth-delete-popup > p {
+          color: var(--oe-wb-ink, #17343b);
+          background-color: var(--oe-wb-paper, #fff);
+          box-shadow: inset 0 0 0 1px var(--oe-wb-line, #d9e4e2);
+        }
+    </style>
 </head>
-<body>
+<body class="oe-prior-auth-delete-popup">
```

Indentation rules: selectors and closing braces sit at 8 spaces in the HTML,
and declarations sit at 10. Strip the common 8-space embedding prefix and the
result is CSS with two-space declaration nesting. A single blank line separates
the two rules.

The delta adds no padding, margins, geometry, fonts, control styling, wrappers,
JS, shared assets, or Header/helper changes. Everything else stays byte-identical:
the `<p>`, the translated text, `<br> <br>`, the title, the viewport, and all of
the security and backend code.

The rules apply only under `@media screen` with `html.oe-workbench-context`. In
legacy, non-workbench, and print contexts, the CSS does not apply. The markup
still changes in those contexts, though: the body class is present everywhere,
so the markup is **not** unchanged.

## Files

| File | Role |
|------|------|
| `tests/fixtures/clinical-workspace/prior-auth-deleter.master-18647270.txt` | Frozen full original route |
| `tests/fixtures/clinical-workspace/prior-auth-delete-popup.contract.cjs` | Dependency-free Node source contract (portable + `--history`) |
| `tests/js/clinical-prior-auth-delete-popup.test.js` | Jest wrapper running the portable checks (history when opted in) |
| `tests/Tests/Isolated/Common/ClinicalWorkspace/WorkbenchPopupHeaderfreeTest.php` | Shared pin test with a route-specific strict inverse |
| `docs/clinical-ui/PRIOR-AUTH-DELETE-POPUP.md` | This document |

Production target: `deleter.php`, edited with exactly the approved delta above
after hosted RED.

## Source preservation contract

- **Shared PHP test.** `normalizedPresentation()` applies only to the deleter
  route. It removes the exact approved seam (opt-in line, style block,
  `</head>`, body marker) once, before the existing opt-in removal. The original
  digest `d29e1fb5695eb192dbfae5e210fd2346b49f401650fbf5a3545d9fd4bdfec10b`
  and every existing case, mutant, and pin are kept. Other routes come back
  unchanged, and a style block injected into another route is never stripped.
- **Acceptance.** Both suites require all of the following:
  - the restored route equals the frozen fixture byte for byte;
  - the fixture's opt-in-stripped digest equals the pin;
  - the candidate equals `applyPresentation(fixture)` exactly.

  Loose marker checks are not enough on their own.
- **Mutants.** There are 47 in both suites. They cover:
  - a missing, relocated, duplicated, or malformed block or body marker;
  - changed CSS properties, indentation, or media;
  - added assets, styles, or JS;
  - changed ACL, CSRF, SQL, session, message, title, viewport, or language.

  Each mutant first checks that the baseline is accepted, that its anchor is
  unique, and that it actually changes the source. Those checks run outside the
  expected-failure assertion.
- **Portable mode** (the default) does not need Git history, so it works on
  shallow CI checkouts.
- **History mode** runs with `--history` or `OPEMR49_PRIOR_AUTH_HISTORY=1`.
  It requires the exact base SHA. It compares fixture == base route and checks
  that the live inverse equals the base route. It also checks that the caller,
  `src/Core/Header.php`, `popup.js`, and `popup.css` are unchanged, and that
  every changed file is on the whitelist above. If Git or the base commit is
  missing after you opt in, the run fails. It does not skip.

## How the controller runs it

```bash
node tests/fixtures/clinical-workspace/prior-auth-delete-popup.contract.cjs
node tests/fixtures/clinical-workspace/prior-auth-delete-popup.contract.cjs --history
OPEMR49_PRIOR_AUTH_HISTORY=1 npx jest tests/js/clinical-prior-auth-delete-popup.test.js
openemr-cmd phpunit-isolated   # WorkbenchPopupHeaderfreeTest
```

## Current honest state

- **RED.** Complete on hosted CI at tests-only SHA
  `86129d531721a4dff83466128321e36edd17588e` (JS run 39200088300). Exactly the
  2 expected production-missing assertions failed ("live route equals the
  approved presentation candidate" and "live route restores byte-for-byte");
  the other 54 portable checks and all 61 prior suites passed (1313 passing
  tests, 5 history skips). Local history mode: 58/61, with 3
  production-missing failures. No production code existed before RED.
- **Production.** The approved style block and body marker were then added to
  `deleter.php`; no other bytes changed. The route was not executed.
- **GREEN.** Pending. The controller must run the suites against this edit.
- **Review and native acceptance.** Pending.
- **Shared test reconciliation.** Parked PR121 and PR122 also change
  `WorkbenchPopupHeaderfreeTest.php`. Their changes were deliberately left out
  here. Reconcile all three when the branches are combined into one release
  train.

## Native acceptance gates (all open)

Keeping the source unchanged does not prove the route is secure or correct.
The gates below remain open, and nobody has claimed them:

- **PHP runtime.** Bootstrap from `globals.php`, the session, and the ACL deny
  path (`Unauthorized` + die). CSRF failure from `INPUT_GET` must die. A
  successful delete must show the message. Also cover the error path, an
  affected-row count of zero or a missing id, record ownership and scoping,
  and module enabled/disabled state.
- **Native UI.** Open the 290×290 dlgopen from `removeEntry` in workbench
  context and in default, dark, and solar themes. Resize it narrow and short.
  Check RTL, keyboard focus and the external `Done` footer role, then
  `refreshme` on close. Check legacy (non-workbench) rendering and print.
- **Out of scope and still open.** The original 22 popups, demo-data passes,
  Swedish locale review, and exhaustive popup coverage.

No live GET request, DB access, or deletion was made for this document.
