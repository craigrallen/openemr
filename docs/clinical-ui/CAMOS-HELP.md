# CAMOS help screen palette

## Source and scope

The complete `interface/forms/CAMOS/new.php` caller was inspected as source only. Its actual Help link at line 1251 points to `/interface/forms/CAMOS/help.html` inside `if (!$out_of_encounter)` and uses `target='new'`. That target names a secondary browsing context; it proves neither a particular popup class nor whether a browser opens a window or tab. The caller also contains session and encounter checks, CAMOS administration ACL checks, CSRF handling, and database reads and writes. Inspection did not execute or validate any of those paths. `CAMOS.css` and `new.php` are unchanged.

The static help page does not bootstrap workbench theme variables. Its single `@media screen` block therefore uses the fixed default canvas, paper, ink, line, and petrol colors from `interface/clinical-workspace/popup.css`, following the visual direction in `OpenEMR-Research/researched/index.html`. It does not follow dynamic themes. The body changes to canvas `#f3f7f5` and ink `#17343b`; the header, menu, and h1/h3 use paper `#fff` and that ink; boxes add line `#d9e4e2`; links use petrol `#086878` on paper, hover uses canvas/ink, and visible focus uses a petrol outline color. Typography, geometry, display, behavior, and print styling remain as before.

The original help text remains historical material, including clinical instructions, signature-image advice, import/export and administration links, data-deletion advice, and its warning about demonstration data. This change does not endorse or execute those instructions. The source also has a malformed anchor around the Basic Use and prescription sections; it is retained to preserve the original bytes.

## Evidence and remaining checks

At tests-only head `213f393f31412dc802b1dbf23c5de402effded27`, the controller recorded genuine corrected RED before this production edit: portable 5 tests, 4 pass, 1 fail; direct history 6 tests, 5 pass, the same sole failure for the missing live style. The initial mutant setup bug was fixed separately, with provenance retained. Logs: `/Users/craig/.hermes/projects/openemr/verification/camos-help-20261023/RED-corrected.log` and `RED-history-corrected.log` in the same directory. The controller owns GREEN verification with:

```sh
node --test tests/clinical-ui/camos-help-contract.cjs
node tests/clinical-ui/camos-help-contract.cjs --history
```

No native visual, authenticated, or clinical acceptance is claimed. Remaining QA covers admin and restricted roles; opened-window versus browser-tab behavior; mobile, short viewport, zoom, and RTL; keyboard, focus, and contrast; and OS print. All 22 clinical acceptance rows, wider UI parity, demo-data review, and Swedish workflow requirements remain open. Prior parked hosted CI, review, draft PR, and deployment gates remain with the controller. This slice authorizes no permission bypass, merge, deployment, database change, national or vendor action, or cron action. Allocation is run 1 of at most 2, counting QA; by run 2 rotate to a different, untouched surface or item.
