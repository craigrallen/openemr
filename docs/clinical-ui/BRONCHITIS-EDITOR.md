# Bronchitis editor presentation

The new and edit pages use the same screen-only style block. Within `html.oe-workbench-context`, the existing form becomes a centered document sheet with a maximum width of 860px. Narrative textareas use the full sheet width, have a minimum height of 12rem, and can grow vertically. Existing clinical tables retain their shared columns, rows, and cells, preserving anatomical headings and adjacent label/control pairing. On small screens, each table region scrolls horizontally within the sheet instead of wrapping cells independently. The form's existing inputs, links, and buttons remain the controls used by the page.

This is a presentation-only change. The original bytes of both PHP pages are preserved outside the style block before `</head>` and the added `oe-bronchitis-editor` body class. Existing choices, IDs, values, PHP, JavaScript, CSRF handling, SQL, and native actions are unchanged. The legacy markup, including malformed HTML, is also retained.

The frozen source contract and fixtures were written first. The controller captured a genuine portable RED result of 9/10 and a history RED result of 10/11 while the production addition was absent; its exported proposal also passed stylelint. After the initial production addition, review identified a P2 defect: flex wrapping detached five clinical labels from their controls in the 320px dark view. The controller then recorded tests-first commit `8034a7f5` and genuine RED results of 10/11 portable and 11/12 history against that initial CSS, before this minimal correction. The revised contract checks native table geometry, bounded table scrolling, exact additions, and preservation of the original bytes. Verification commands for the controller are:

```sh
node tests/clinical-ui/bronchitis-editor-contract.cjs
node tests/clinical-ui/bronchitis-editor-contract.cjs --history
```

These are source-only checks. They do not establish authenticated browser behavior or clinical acceptance. This partially supports original feature 2; it does not deliver the full 22-feature set, the full reference design, speech, AI, certificates, or Swedish readiness. The change remains unmerged and undeployed pending ordinary review and complete hosted CI.
