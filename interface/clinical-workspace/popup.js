/*
 * Workbench popup context. Loaded on every Header page but inert unless a same-origin
 * parent or opener chain reaches an active workbench shell, or the page is that shell. It only toggles its own
 * classes on <html>; it never touches body attributes, forms, opener callbacks,
 * returnValue or dlgclose.
 */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root && root.document && root.document.documentElement && !root.OpenEMRWorkbenchPopup) {
        root.OpenEMRWorkbenchPopup = api;
        // Runs synchronously from <head>: <html> exists before first paint, <body> may not.
        let current = api.createPopupController({ win: root });
        root.addEventListener('pageshow', (event) => {
            if (!event.persisted) return;
            current.dispose();
            current = api.createPopupController({ win: root });
        });
    }
}(typeof window === 'undefined' ? null : window, function () {
    const MAX_WINDOWS = 16;
    const CONTEXT_CLASS = 'oe-workbench-context';
    const POPUP_CLASS = 'oe-workbench-popup';
    // The mode control main.php renders inside its shell root, in both navigation modes.
    const SHELL_ROOT = '#mainBox [data-workbench-mode]';

    function attempt(read) {
        try {
            return read();
        } catch {
            return null;
        }
    }

    function isWorkbenchRoot(doc) {
        return !!attempt(() => doc.querySelector(SHELL_ROOT));
    }

    function isDialogFrame(frame) {
        return !!(frame && typeof frame.closest === 'function' && frame.closest('.dialogModal'));
    }

    // Walks same-origin parents, and from each top-level window its opener, so nested
    // popups resolve to the original shell rather than an intermediate legacy window.
    // Returns the nearest body carrying workbench-active, else the last reachable body
    // (observed so a later mode toggle still applies). Stops at the first cross-origin,
    // closed, bodiless or access-denied window.
    function findWorkbenchHost({ self, parentWindow, openerWindow, origin }) {
        const seen = new Set([self]);
        let popup = isDialogFrame(attempt(() => self.frameElement));
        let current = parentWindow && parentWindow !== self ? parentWindow : null;
        if (!current && openerWindow) {
            current = openerWindow;
            popup = true;
        }
        let fallback = null;
        for (let count = 0; count < MAX_WINDOWS && current && !seen.has(current); count++) {
            seen.add(current);
            const win = current;
            const body = attempt(() => (!win.closed && win.location.origin === origin ? win.document.body : null));
            if (!body) break;
            if (body.classList.contains('workbench-active')) return { body, popup };
            fallback = body;
            const parent = attempt(() => win.parent);
            if (parent && parent !== win) {
                popup = popup || isDialogFrame(attempt(() => win.frameElement));
                current = parent;
            } else {
                current = attempt(() => win.opener);
                popup = popup || !!current;
            }
        }
        return fallback ? { body: fallback, popup } : null;
    }

    function observeClass(target, callback) {
        const observer = new target.ownerDocument.defaultView.MutationObserver(callback);
        observer.observe(target, { attributes: true, attributeFilter: ['class'] });
        return observer;
    }

    // A top-level window without an opener is only ever the shell itself: it gets the
    // context class for its own local modals and overlays, never popup styling.
    function resolveHost(win) {
        const parentWindow = attempt(() => win.parent);
        const openerWindow = attempt(() => win.opener);
        if ((!parentWindow || parentWindow === win) && !openerWindow) {
            const body = attempt(() => win.document.body);
            return body && isWorkbenchRoot(win.document) ? { body, popup: false } : null;
        }
        const host = findWorkbenchHost({ self: win, parentWindow, openerWindow, origin: attempt(() => win.location.origin) });
        if (!host) return null;
        // A legacy-mode fallback is only observed when it is the shell root itself.
        const shell = attempt(() => host.body.classList.contains('workbench-active')) || isWorkbenchRoot(host.body.ownerDocument);
        return shell ? host : null;
    }

    function isTopLevel(win) {
        const parentWindow = attempt(() => win.parent);
        return (!parentWindow || parentWindow === win) && !attempt(() => win.opener);
    }

    function createPopupController({ win, observe = observeClass }) {
        const doc = win.document;
        const html = doc.documentElement;
        const owned = new Set();
        let host = null;
        let observer = null;
        let waiting = false;
        let active = false;
        let disposed = false;

        // Only remove what this controller added; server- or page-set classes stay.
        const set = (name, enabled) => {
            if (enabled && !html.classList.contains(name)) {
                html.classList.add(name);
                owned.add(name);
            } else if (!enabled && owned.delete(name)) {
                html.classList.remove(name);
            }
        };

        const sync = () => {
            if (disposed) return;
            active = !!attempt(() => host.body.classList.contains('workbench-active'));
            set(CONTEXT_CLASS, active);
            set(POPUP_CLASS, active && host.popup);
        };
        const start = () => {
            waiting = false;
            if (disposed) return;
            host = resolveHost(win);
            if (!host) return;
            sync();
            observer = attempt(() => observe(host.body, sync));
        };
        const dispose = () => {
            if (disposed) return;
            if (waiting) doc.removeEventListener('DOMContentLoaded', start);
            if (observer) observer.disconnect();
            set(CONTEXT_CLASS, false);
            set(POPUP_CLASS, false);
            disposed = true;
            active = false;
        };

        start();
        // From <head> the shell's own body and root are not parsed yet: retry once.
        if (!host && doc.readyState === 'loading' && isTopLevel(win)) {
            waiting = true;
            doc.addEventListener('DOMContentLoaded', start, { once: true });
        }
        if (host || waiting) win.addEventListener('pagehide', dispose, { once: true });

        return {
            get active() { return active; },
            dispose
        };
    }

    return { findWorkbenchHost, isWorkbenchRoot, createPopupController, CONTEXT_CLASS, POPUP_CLASS };
}));
