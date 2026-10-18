# Referral preview: OPEMR-34

The referral report opens a 550 × 400 popup with a document template that retains fixed print dimensions. This change gives its default template a limited workbench screen treatment: canvas around the document, paper inside the existing borders, and a quieter border. It does not change the clinical form, its layout, or its printing workflow.

## Production changes

- `interface/patient_file/transaction/print_referral.php` imports `ClinicalWorkspaceAssets` and replaces `{referral_preview_assets}` immediately after reading the template. The replacement emits escaped, versioned `referral-preview.css` and `popup.js` URLs. The stylesheet link has `media="screen"`.
- `sites/default/referral_template.html` opts in with the head placeholder and `oe-referral-preview` body class. Its original inline styles, two `.borderdiv` wrappers across the clinic, client, and counter-referral portions, fields, page break, and automatic `win.printLogPrint(window)` call remain intact.
- `src/Common/Assets/ClinicalWorkspaceAssets.php` adds the two asset names to its sorted allowlist.
- `interface/clinical-workspace/referral-preview.css` contains exactly three screen-only rules scoped to `html.oe-workbench-context` and the referral body. The shared `popup.js` is unchanged; it follows an actual same-origin parent or opener to the workbench context, with no new opener or storage fallback.

This is a presentation adaptation, not permission or security clearance. A custom site template without `{referral_preview_assets}` receives no added asset tags or preview markup. A custom template can opt in by supplying the placeholder and the referral body class. The route's existing ACL, data lookup, generated-field semantics, substitutions, and output remain in their original order after the new placeholder replacement. The report caller, dimensions, source print styles, and automatic printing code are unchanged. The automatic print action was not executed here.

## Evidence and remaining acceptance

Before implementation, the controller reported genuine hosted tests-only RED at `cb60f9d3` (JS run `39093519654`): exactly four intended missing route, template, helper, and CSS failures, with 1,266 passes across 62 suites. The three complete frozen fixtures were compared with fetched `origin/master` at `18647270`; synthetic forward, inverse, AST, and mutation checks passed. Earlier syntax `c0fb` and erroneous wrapper `7aad` failures are not product RED. This implementation was edited and inspected locally without running tests; the controller owns actual verification and publication.

Native PHP output for the default and custom templates, workbench context, theme contrast, generated fields, the initial 550 × 400 viewport and narrow resizing, RTL, OS print output, roles, and the original automatic `printLogPrint` path remain open. Excluding this stylesheet from print is source evidence, not OS print acceptance. The screen-only canvas, paper, and border changes are partial; they do not establish full researched design fidelity, clinical acceptance, or completion of all 22 clinical features. Ordinary approval is still required for publication; there is no standing bypass.
