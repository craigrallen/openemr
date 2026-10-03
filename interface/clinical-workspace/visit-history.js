/* Click and keyboard activation for Visit History encounter and document rows. Routing stays with the page. */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.oeVisitHistory = api;
}(typeof window === 'undefined' ? null : window, function () {
    const bound = new WeakMap();
    const boundClicks = new WeakMap();

    // Enter or Space on a focused row opens it exactly as a click does. Keys
    // pressed inside a nested control (link, button, input) belong to that
    // control, so only events whose target is the row itself are handled.
    // Modified keys belong to the browser/AT, keys another listener already
    // claimed are left alone, and auto-repeat is swallowed so holding a key
    // navigates once.
    function bindRowKeyboard(container, { openEncounter, openDocument }) {
        const existing = bound.get(container);
        if (existing) return existing;

        const onKeydown = (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            if (event.defaultPrevented) return;
            if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
            const row = event.target;
            if (!row.classList) return;
            const isEncounter = row.classList.contains('encrow');
            if (!isEncounter && !row.classList.contains('docrow')) return;
            event.preventDefault();
            if (event.repeat) return;
            if (isEncounter) openEncounter(row.id);
            else openDocument(row.id);
        };

        container.addEventListener('keydown', onKeydown);
        const binding = {
            dispose() {
                container.removeEventListener('keydown', onKeydown);
                bound.delete(container);
            }
        };
        bound.set(container, binding);
        return binding;
    }

    // Native controls a row may contain. Their clicks (mouse, or the synthetic
    // click a browser fires for Enter on a focused link/button) are theirs alone.
    const NESTED_CONTROL = 'a[href], button, input, select, textarea, label, summary, [contenteditable=""], [contenteditable="true"], [role="button"], [role="link"]';

    // One delegated click router replaces per-row handlers, which let a click on
    // a document link inside div.docrow inside tr.encrow fire the link's href,
    // then todocument, then toencounter. A click now opens only the closest row,
    // and only when it did not land on a nested control. Propagation is never
    // stopped, so the link's own href and inline onclick run unchanged.
    function bindRowClicks(container, { openEncounter, openDocument }) {
        const existing = boundClicks.get(container);
        if (existing) return existing;

        const onClick = (event) => {
            if (event.defaultPrevented || event.button !== 0) return;
            const target = event.target;
            if (!target || typeof target.closest !== 'function') return;
            const row = target.closest('.encrow, .docrow');
            if (!row || row === container || !container.contains(row)) return;
            const control = target.closest(NESTED_CONTROL);
            if (control && row.contains(control)) return;
            if (row.classList.contains('encrow')) openEncounter(row.id);
            else openDocument(row.id);
        };

        container.addEventListener('click', onClick);
        const binding = {
            dispose() {
                container.removeEventListener('click', onClick);
                boundClicks.delete(container);
            }
        };
        boundClicks.set(container, binding);
        return binding;
    }

    return { bindRowKeyboard, bindRowClicks };
}));
