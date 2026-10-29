# Track Anything editor presentation

Route: `interface/forms/track_anything/new.php`.

This slice gives the existing Track Anything route a document sheet in the clinical
workbench context. Its reference is the clinical workspace's document spacing and
paper surface. It does not reproduce the full design reference or complete any of
the original 22 feature requirements. Requirement 2 (document-style note editor)
remains **PARTIAL** under `ACCEPTANCE.md`; this Track Anything presentation does
not establish note-editor or clinical acceptance.

## Source scope

The frozen `proposed()` transformation in
`tests/clinical-ui/track-anything-editor-contract.cjs` makes exactly two additions:

1. A screen-only inline CSS block immediately after `Header::setupHeader(...)`.
   Every selector is gated by
   `html.oe-workbench-context body.track-anything-document-editor`.
   It gives `#track_anything` a centered paper surface, keeps the native tables,
   provides horizontal scrolling for wide history, and styles native inputs,
   selection list and action buttons with visible focus outlines.
2. `track-anything-document-editor` on the existing `body_top` body class.

The original route still renders the native track selection list, Select, Back and
Configure tracks actions; the new-data date/time and value inputs, Save and Stop;
and the editable history table with its date/time and value fields, Save and Stop.
The CSS changes presentation only. The SQL branches, access check, patient and
encounter session use, form actions, field names and values, JavaScript handlers,
and every other original source byte are unchanged. The contract's inverse
transformation restores the complete pinned original fixture byte for byte.
This is source preservation evidence, not evidence that saving or persistence
works in a running application.

## Evidence and verification

The controller captured genuine RED on the tests-only commit `f37367cb` before
the production edit: portable **8 tests, 7 pass, 1 fail**; history **10 tests,
9 pass, 1 fail**. Both failures were the expected missing presentation seam.
The original fixture hash, unchanged support-file hashes and scope checks passed.
The source has mutating SQL branches before and between rendering; do not execute
the whole route as a verification shortcut.

Direct controller commands for the frozen source contract:

```sh
node tests/clinical-ui/track-anything-editor-contract.cjs
node tests/clinical-ui/track-anything-editor-contract.cjs --history
```

The Jest wrapper is `tests/js/track-anything-editor.test.js`. No tests or
application runtime were run during this implementation edit. Controller
verification of the candidate is pending. There is no claim of native runtime,
contrast, keyboard, Save or persistence acceptance.

The final change scope is exactly these five paths: the original fixture,
portable contract, Jest wrapper, route source and this document. No test or
frozen proposal was changed to make production pass.

## Delivery states

| State | Meaning |
|---|---|
| `ready` | Exact source transformation and documentation prepared for controller review. |
| `awaitingQA` | **Current:** implementation is ready; controller verification has not been reported. |
| `needsapproval` | A controller result requires a decision or authorization outside this fixed presentation scope. |
| `blocked` | The scheduled delivery limit is exhausted without acceptance or required external input prevents a decision. |

The schedule permits **at most two consecutive delivery runs including QA**;
it is not a budget of two test retries. This is run 1. If the limit is reached
without acceptance, the next attempt needs a **different implementation** in a
new authorized delivery cycle, not changes to the frozen tests or an assertion
that this candidate passed. The controller owns the next QA result and state
transition.
