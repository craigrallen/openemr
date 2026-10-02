/* Route-local presentation switch. It never changes form state or parent UI. */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root && root.document) {
        const start = () => {
            const controller = api.createModeController({
                body: root.document.body,
                parentWindow: root.parent,
                origin: root.location.origin,
                observe: (target, callback) => {
                    const observer = new root.MutationObserver(callback);
                    observer.observe(target, { attributes: true, attributeFilter: ['class'] });
                    return observer;
                }
            });
            root.addEventListener('unload', () => controller.dispose(), { once: true });
        };
        if (root.document.readyState === 'loading') {
            root.document.addEventListener('DOMContentLoaded', start, { once: true });
        } else {
            start();
        }
    }
}(typeof window === 'undefined' ? null : window, function () {
    function createModeController({ body, parentWindow, origin, observe, mode }) {
        let observer;
        let active = false;
        let disposed = false;
        const update = (enabled) => {
            if (disposed) return;
            active = enabled;
            body.classList.toggle('oe-clinical-workspace', enabled);
        };

        if (mode === 'workbench') {
            update(true);
        } else if (parentWindow && parentWindow !== (body.ownerDocument.defaultView)) {
            try {
                if (parentWindow.location.origin === origin && parentWindow.document.body) {
                    const parentBody = parentWindow.document.body;
                    const sync = () => update(parentBody.classList.contains('workbench-active'));
                    sync();
                    observer = observe(parentBody, sync);
                }
            } catch {
                // A cross-origin parent cannot authorize this presentation mode.
                update(false);
            }
        }

        return {
            get active() { return active; },
            dispose() {
                disposed = true;
                if (observer) observer.disconnect();
                body.classList.remove('oe-clinical-workspace');
                active = false;
            }
        };
    }
    return { createModeController };
}));
