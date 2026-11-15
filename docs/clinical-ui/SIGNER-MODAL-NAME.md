# Signer modal accessible name contract

OPEMR-239 covers the accessible name on the actual `#openSignModal` dialog root. The approved source change is one insertion immediately before that root opening tag's closing `>`: ` aria-label="{{ 'Signature'|xla }}"`. The contract requires the root to retain `role='dialog'` and `tabindex='-1'`. It requires removal of precisely that inserted attribute to recover the complete, byte-identical original fixture, whose SHA256 is pinned in the contract. Other `aria-label` attributes are outside this removal.

The portable contract runs with `node tests/clinical-ui/signer-modal-name-contract.cjs`. It reports one JSON line and fails before the product change. Its synthetic named candidate must pass the semantic and whole-source inverse checks before any production edit. `--history` adds a separate `git show origin/master:<template route>` comparison against the fixture; ordinary portable execution makes no Git call. The hosted Jest adapter invokes the same contract through Node and accepts only its exact successful report.

The bounded caller evidence is that `portal/sign/assets/signer_modal.php` renders `portal/partial/_signer_modal.html.twig`, which includes the inner template. `portal/sign/assets/signer_api.js` assigns signer identity and current type, then shows `#openSignModal`. These observations define the source boundary; they make no claim about running behavior or clinical validity.

The controller's schedule allows run 1 and at most run 2 consecutive scheduled runs, including implementation and QA. Test retries do not reset that limit. The controller owns Git, test execution, and publication.

This source contract does not prove runtime accessibility or clinical behavior. Native screenreader checks, modal keyboard behavior, role behavior, security, persistence, and ordinary approval remain open. There is no authorized route, bootstrap, SQL, signature capture, or save change, and no visual palette change.
