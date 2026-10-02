/* Keyboard activation for Visit History encounter and document rows. Routing stays with the page. */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.oeVisitHistory = api;
}(typeof window === 'undefined' ? null : window, function () {
    const bound = new WeakMap();

    // Enter or Space on a focused row opens it exactly as a click does. Keys
    // pressed inside a nested control (link, button, input) belong to that
    // control, so only events whose target is the row itself are handled.
    function bindRowKeyboard(container, { openEncounter, openDocument }) {
        const existing = bound.get(container);
        if (existing) return existing;

        const onKeydown = (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            const row = event.target;
            if (!row.classList) return;
            const isEncounter = row.classList.contains('encrow');
            if (!isEncounter && !row.classList.contains('docrow')) return;
            event.preventDefault();
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

    return { bindRowKeyboard };
}));
