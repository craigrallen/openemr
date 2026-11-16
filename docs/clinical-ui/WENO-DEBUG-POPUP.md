# Weno debug popup layout contract

Status: tests-only TDD handoff pending controller materialization and hosted execution. No result count or CI outcome is claimed here.

The controller supplies the frozen original at `tests/clinical-ui/fixtures/weno-debug-popup-original.php.txt`. Its SHA-256 is `4210b1ff293577a7a63d72ad62fa41ffcd603a382e9ddbf40157fa8977c3ae86`. The source contract derives a positive candidate by inserting the supplied style immediately before the unique `</head>` in `interface/modules/custom_modules/oe-module-weno/templates/indexrx.php`. The live source is expected to fail the new layout checks until that production insertion is authorized and made.

The contract has separate checks for the exact screen and modal scoped CSS, and for removal of the exact style restoring every original byte and the frozen SHA-256. Named mutations exercise omissions and additions in the CSS, duplicate or moved style, and edits to PHP, JavaScript, iframe, download, and translation source. Native modal markup and both existing callers are anchored in the frozen original. These are source checks, not native runtime acceptance or security clearance. The inverse deliberately retains all original debug fields, including any unsafe unchanged fields.

The observed overflow baseline used long synthetic heading, download, and footer labels across 15 scripts-disabled cells: five historical compiled themes at three widths. Fonts-disabled and RTL simulation are source-derived stress checks. They do not establish native behavior. Preserve the original 22-cell/demo and Swedish native QA evidence and the applicable approval gates.

Delivery remains within one, or at most two consecutive, **scheduled** runs including implementation and QA. Internal phases do not add scheduled allocation. After the tests-only handoff, the controller may materialize the fixture, run syntax checks, and later run the hosted test and native QA gates. The future product change is only the exact supplied style insertion. There is no authorization here for merge or deploy, route or bootstrap changes, SQL, HTTP, eRx or provider activity, debug generation, logging, download, or support execution.
