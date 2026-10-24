# OPEMR-123: multisite admin help presentation slice

## Ownership and scope

Hermes owns this bounded implementation (run 1, maximum 2). The change is limited to two additions in `Documentation/help_files/openemr_multisite_admin_help.php`: the exact `@media screen` style before the existing closing head, and `oe-multisite-admin-help-screen` on the existing body. The reason for a local, unconditional marker is that this help document is an iframe loaded by the admin modal, with no evidenced activation of the shared workbench popup context. This is a fixed light treatment for the document, not shared dynamic popup discovery.

The four literal colors come from the default values in `interface/clinical-workspace/popup.css`: canvas `#f3f7f5`, ink `#17343b`, paper `#fff`, and petrol `#086878`. They are copied as fixed values, not inherited tokens. The screen rule pairs foreground and background for body, container, heading, and link states, and sets the focus outline color. It adds no font, geometry, layout, visibility, print, or `!important` rule.

The original 6044-byte help document is frozen in `tests/clinical-ui/fixtures/multisite-admin-help-original.php.txt`. The contract requires removing the two additions to restore every original byte. Existing prose, PHP, scripts, controls, named anchor, assets including `style_light.css`, responsive style, fonts and geometry are preserved in source. In particular, historical setup instructions and wording remain as written; preserving that prose does not endorse its current accuracy or safety. Parent `admin.php`, setup, and deployment are unchanged and were not executed for this slice.

## Source chain and test evidence

In `admin.php`, the `#help-href` link at line 81 targets `#myModal`; the modal contains `#targetiframe` at line 230. Its click handler at line 243 assigns `Documentation/help_files/openemr_multisite_admin_help.php` to that iframe. The `#print-help-href` handler at line 248 calls `$("#targetiframe").get(0).contentWindow.print()`. These are source observations, not a claim of runtime modal or print acceptance. The contract pins the caller and palette bytes and checks those source tokens.

The controller ran genuine native RED before this production edit. Evidence is in `/Users/craig/.hermes/projects/openemr/verification/multisite-admin-help-20261024/RED.log` and `RED-history.log`; tests-only commit `2d1676bb3fce9803d06ffcd993e0f671d6670bdc` records the chronology. The single failure in each run was the live document lacking the exact added style (`0 !== 1`). The immutable 6044-byte fixture, caller/palette pins, synthetic candidate, and negative mutants passed. After the edit, the controller ran the portable and direct-history contracts; `GREEN.log` and `GREEN-history.log` in the same evidence directory record their results. No CI result or PR number is asserted here.

| Check | Genuine pre-edit RED | Post-edit status |
| --- | --- | --- |
| Portable source contract | 5 tests: 4 pass, 1 expected failure; 0 skips/errors | Controller: 5/5 pass; 0 failures/skips |
| History source contract | 6 tests: 5 pass, same expected failure; 0 skips/errors | Controller, direct invocation: 6/6 pass; 0 failures/skips |
| Rendered and workflow QA | No evidence from these source tests | Awaiting QA |

From the repository root, the reproducible controller commands are:

```sh
node --test --test-reporter=tap tests/clinical-ui/multisite-admin-help-contract.cjs
node tests/clinical-ui/multisite-admin-help-contract.cjs --history
```

`--history` adds local Git history authentication of the fixture and final scope paths. Direct invocation forwards this flag to the contract on Node 26. This docs-only review did not rerun either command or execute PHP, project, admin, or runtime code.

## Acceptance boundary

The exact source restoration contract supports a source-only preservation claim. It does not establish rendered default, dark, narrow, short, zoom, RTL, keyboard, contrast, native modal, OS print, authenticated role, clinical, or security acceptance. The accepted researched UI remains the larger reference; this palette-only slice does not fulfill the full reference design, all 22 acceptance rows, demo work, or Swedish completion.

Prior 55 parked and 47 settled context and all recorded denial boundaries remain preserved without rechecking old heads. This branch is unmerged and undeployed, awaiting QA and ordinary approval. There is no standing bypass.
