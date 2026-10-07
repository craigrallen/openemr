/* Route-local presentation switch. It never changes form state or parent UI. */
(function (root, factory) {
    const discovery = typeof module === 'object' && module.exports
        ? require('./popup.js')
        : root && root.OpenEMRWorkbenchPopup;
    const api = factory(discovery);
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root && root.document) {
        const start = () => {
            const controller = api.createModeController({
                body: root.document.body,
                parentWindow: root.parent,
                openerWindow: root.opener,
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
}(typeof window === 'undefined' ? null : window, function (discovery) {
    const MAX_ANCESTORS = 8;

    // Routes such as SOAP sit in load_form.php inside encounter_top.php inside main.php,
    // so the workbench body may be several frames up. Walk same-origin ancestors and
    // return the nearest body carrying workbench-active, else the topmost reachable one.
    function findWorkbenchHost(self, start, origin) {
        const seen = new Set([self]);
        let host = null;
        let current = start;
        for (let depth = 0; depth < MAX_ANCESTORS && current && !seen.has(current); depth++) {
            seen.add(current);
            let next;
            try {
                // A cross-origin ancestor cannot authorize this presentation mode.
                if (current.location.origin !== origin || !current.document.body) break;
                host = current.document.body;
                if (host.classList.contains('workbench-active')) break;
                next = current.parent;
            } catch {
                break;
            }
            current = next;
        }
        return host;
    }

    // The shared popup walk also follows window.opener, so standalone route windows opened
    // from the workbench inherit it. Pages without the Header bundle keep the parent walk.
    function resolveHost(self, parentWindow, openerWindow, origin) {
        if (!discovery) return findWorkbenchHost(self, parentWindow, origin);
        const found = discovery.findWorkbenchHost({ self, parentWindow, openerWindow, origin });
        return found ? found.body : null;
    }

    function createModeController({ body, parentWindow, openerWindow, origin, observe, mode }) {
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
        } else {
            const hostBody = resolveHost(body.ownerDocument.defaultView, parentWindow, openerWindow, origin);
            if (hostBody) {
                const sync = () => update(hostBody.classList.contains('workbench-active'));
                sync();
                observer = observe(hostBody, sync);
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
