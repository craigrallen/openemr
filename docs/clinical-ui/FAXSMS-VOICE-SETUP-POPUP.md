# OPEMR-183: FaxSMS voice setup popup

## Implemented scope

The voice setup document now has a `oe-faxsms-voice-setup` body class and a screen-only, workbench-scoped style block immediately before `</head>`. In `html.oe-workbench-context`, the document paper is bounded to 860px with 12px outer gutters, internal padding, and inherited workbench color tokens with fallbacks. The form retains its native field and action order. Its rows and controls can shrink, labels and buttons can wrap, and the form establishes flow around its existing floated actions. Both `:focus` and `:focus-visible` have separate 3px outline rules. The webhook and Create JWT buttons each have a foreground, background, and border paint pair.

This is a partial accepted researched direction for the bounded screen context, document paper, safe gutters, form flow, narrow wrapped actions, focus treatment, and paired button paint. It is not full reference fidelity, all 22 researched features, or clinical acceptance. The static source contract checks exact CSS and preservation of the original PHP, HTML, and JavaScript bytes; it does not establish browser geometry, effective contrast, or native acceptance.

## Native boundaries and entry points

`library/setup_services.php` opens `set-voice` in a `modal-lg` dialog with `sizeHeight: 'full'` and also embeds the same setup document in an ordinary iframe. The CSS is scoped to the voice body inside `html.oe-workbench-context`; rendering in either frame still needs native observation. The original Save Settings form posts serialized configuration to `saveSetup?type=voice`. Register / Refresh Webhook Subscription is a separate action posting to `install?type=voice`. Create JWT opens the vendor console from the entered client ID. These actions were inspected in source and were not exercised.

No changes were made to globals, `AppDispatch`, credential retrieval, saving, installation, webhook registration, JWT opening, or the vendor console. Native modal behavior, roles and ACL, CSRF, session persistence, full contrast and focus accessibility, real RTL and font coverage, old engines, and OS print behavior remain open.

## Verification and handoff

The tests-only starting checkout was `3bdfee5e`. Before the product edit, the genuine history contract reported 8 tests: 7 passed and 1 failed because the live source lacked the style marker. After the edit, the portable contract reported 7/7 passed and the history contract 8/8 passed. `php -l` found no syntax errors, and `git diff --check` passed. These are static checks; no live PHP, database, native browser action, network request, or deployment was run.

The scheduled work limit is two consecutive runs including implementation and QA; internal phases do not add allocations. The default next candidate is a different independent untouched popup or original feature, subject to fresh Jira, ownership, lease, and native safety checks. This work is not fully ready for merge or deployment without the open native acceptance work and approval.
