# Insurance search results in the workbench

`ins_search.php` loads `ins_list.php` into `#form_list` with jQuery `.load()`. This change addresses that AJAX results surface, not a standalone popup window. The controller's earlier no-network jQuery 3.7.1 preflight found that `.load()` strips the response's `<body>` while retaining its table and inline style; it also observed native `setins()` execution and the parent HTML context. A fresh synthetic check exercised actual jQuery `.load()` without network access and confirmed the retained table, style, script, and parent context. The marker therefore belongs on the table. The CSS applies only when the retained table has a `html.oe-workbench-context` ancestor and the media is `screen`.

## Exact scope and inverse

The route adds `oe-insurance-results` to its existing table class list and one `@media screen` block to its existing `<style>`. That block uses the existing workbench ink, paper, line, and petrol tokens, with fallback colors, for table text/background, cell borders, links, and visible link focus. It changes no other route bytes. To undo it, remove that exact media block and remove the trailing ` oe-insurance-results` from the table class. The restored route must equal the 6,170 byte `tests/clinical-ui/fixtures/insurance-list-original.php.txt` byte for byte; the contract's `restore()` and `violations()` express this complete inverse.

The selector is inactive outside native workbench context. Legacy mode and print retain their prior presentation. The change leaves SQL, PHP, CSRF, sessions, escaping, selection, opener messaging/callbacks, layout, font size, and the parent search route untouched. Shared popup assets and their tokens are unchanged.

## Verification and remaining gates

The historical tests-only commit `36fdad80` was run RED before the production edit: the portable contract had 2 passes and 1 missing-table-marker failure; its local `--history` variant had 3 passes and the same failure, with history passing. Initial synthetic positive and mutant checks passed. These RED results describe that earlier commit. After the production edit, the controller ran the portable contract (3/3 passing), the direct `--history` variant (4/4 passing, exit 0), and the exact 6,170 byte inverse against the original route fixture. The controller also reported CSS Stylelint exit 0 with zero nonignored warnings. The contract commands were:

```sh
node --test --test-reporter=tap tests/clinical-ui/insurance-list-contract.cjs
node --test-reporter=tap tests/clinical-ui/insurance-list-contract.cjs --history
```

The Jest adapter has three tests covering actual jQuery `.load()` through stubbed AJAX and native `setins()` callback, message-only, closed-opener, and missing-opener source-script paths. Jest remains **NOT RUN locally** and **PENDING hosted**; no Jest green result is claimed. An independent Astra complete five-file static review of `12f4ee8a` was clear for production, with P2 lint and P3 documentation findings; it was a static review of that head, not frozen clearance for a future head. The reported ESLint 9.39.5 `no-regex-spaces` finding in the adapter is addressed by the literal-space quantifier in this correction, pending controller verification. Synthetic checks, contracts, and static review do not establish authenticated UI or server rendering, roles/session/ACL/CSRF execution, clinical acceptance, or browser accessibility acceptance. All 22 requested features and research-fidelity gates remain open. Delivery still needs ordinary approval, exact-head CI, coverage, remaining static checks, baselines, and applicable independent review. This document grants no merge or deployment authorization; other parked scopes and denial boundaries remain unchanged.
