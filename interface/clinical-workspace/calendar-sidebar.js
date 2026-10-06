/*
 * Calendar sidebar toggle state for the day/week/month screens.
 *
 * The original #menu-toggle click handler in _calendar_screen_js.html.twig still
 * owns the behaviour (it toggles `toggled` on #wrapper). This helper only:
 *  - reports that state as aria-expanded, read from the real #wrapper class;
 *  - lets Space activate the anchor-as-button through that same click handler;
 *  - publishes the measured toolbar height as --oe-calendar-toolbar-height so the
 *    workbench narrow layout can place the fixed sidebar below a wrapped toolbar;
 *  - in workbench mode only, makes the collapsed sidebar inert, removing it again when it
 *    expands, when the page leaves workbench mode and on dispose. Focus inside the sidebar is
 *    moved to the toggle before inert is set so it does not fall to <body>. While inert is held,
 *    a watcher on the attribute hands it over to any other writer: after an external write
 *    (including a same-value one) the helper leaves the attribute as that writer left it.
 *    On a viewport collapse it also returns focus to the toggle when the browser has already
 *    blurred a sidebar control to <body> after the frame's viewport changed, at the size the
 *    collapse arrives at, and nothing since shows the user moved focus elsewhere.
 */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root && root.document) {
        const start = () => {
            const controller = api.createSidebarToggle({
                document: root.document,
                media: root.matchMedia ? root.matchMedia(api.NARROW_QUERY) : null,
                observeClass: (target, callback) => {
                    const observer = new root.MutationObserver(callback);
                    observer.observe(target, { attributes: true, attributeFilter: ['class'] });
                    return observer;
                },
                observeResize: (target, callback) => {
                    if (root.ResizeObserver) {
                        const observer = new root.ResizeObserver(callback);
                        observer.observe(target);
                        return observer;
                    }
                    root.addEventListener('resize', callback);
                    return { disconnect: () => root.removeEventListener('resize', callback) };
                },
                observeInert: (target, callback) => {
                    const observer = new root.MutationObserver(callback);
                    observer.observe(target, { attributes: true, attributeFilter: ['inert'] });
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
    // Same breakpoint as ajax_calendar_sass.scss `max-width: map-get($grid-breakpoints, "md")`,
    // below which the sidebar starts hidden and `toggled` shows it (the reverse of desktop).
    const NARROW_QUERY = '(max-width: 768px)';
    const OFFSET_PROPERTY = '--oe-calendar-toolbar-height';
    // Set on the calendar body by mode.js while the workbench navigation is active.
    const WORKBENCH_CLASS = 'oe-clinical-workspace';

    // MediaQueryList gained addEventListener in Safari 14; older engines only have addListener.
    // With neither, the state is read once at setup. Returns the matching unsubscribe.
    function watchMedia(media, callback) {
        if (media && typeof media.addEventListener === 'function') {
            media.addEventListener('change', callback);
            return () => media.removeEventListener('change', callback);
        }
        if (media && typeof media.addListener === 'function') {
            media.addListener(callback);
            return () => media.removeListener(callback);
        }
        return () => {};
    }

    // Sets or removes an attribute so that `null` means absent, as getAttribute reports it.
    function restoreAttribute(element, name, value) {
        if (value === null) {
            element.removeAttribute(name);
        } else {
            element.setAttribute(name, value);
        }
    }

    function createSidebarToggle({ document, media, observeClass, observeResize, observeInert }) {
        const toggle = document.getElementById('menu-toggle');
        const wrapper = document.getElementById('wrapper');
        if (!toggle || !wrapper) {
            return { dispose() {} };
        }
        const toolbar = toggle.closest('.sticky-top');
        const sidebar = document.getElementById(toggle.getAttribute('aria-controls') || '');
        const body = document.body;
        const originalExpanded = toggle.getAttribute('aria-expanded');
        // Whether this helper set the sidebar's inert attribute and still owns it.
        let owned = false;
        // While owned, watches inert for writes by anyone else; null otherwise.
        let watcher = null;
        // Whether the current collapse has been handled, so inert another writer removed is not
        // re-applied by this helper until the sidebar expands.
        let handled = false;

        // The sidebar element that last received focus in workbench mode, kept only until focus or
        // the user's input goes anywhere else. In Chrome a viewport resize can hide the sidebar and
        // blur that element to <body> before the media callback runs; this lets the callback tell
        // that loss apart from a deliberate move. See CALENDAR-INERT-LIFECYCLE.md for the rules.
        let focusOwner = null;
        // The frame's viewport size when the focus owner was focused, and when it blurred to
        // <body> at a different size (null until then). Only a blur after the viewport changed
        // can be the resize's own, and only a collapse at that same size is the same transition.
        let focusViewport = null;
        let blurViewport = null;
        // The keydown being dispatched, if any: a blur during it is the user's own action.
        let keyEvent = null;
        const view = document.defaultView;
        const viewport = () => (view ? `${view.innerWidth}x${view.innerHeight}` : null);
        const forgetFocus = () => {
            focusOwner = null;
            focusViewport = null;
            blurViewport = null;
        };
        const onFocusin = (event) => {
            const inside = sidebar && sidebar.contains(event.target);
            if (!inside || !body.classList.contains(WORKBENCH_CLASS)) {
                forgetFocus();
                return;
            }
            focusOwner = event.target;
            focusViewport = viewport();
            blurViewport = null;
        };
        // A focus move to another element is seen by onFocusin; a blur to <body> while a keydown
        // is still being dispatched (eventPhase is NONE only once dispatch ends) is a key action,
        // and a blur at the size the owner was focused at is not caused by a viewport change.
        const onFocusout = (event) => {
            if (focusOwner === null || event.target !== focusOwner) return;
            if (keyEvent && keyEvent.eventPhase !== 0) {
                forgetFocus();
                return;
            }
            if (event.relatedTarget) return;
            const size = viewport();
            if (size === focusViewport) {
                forgetFocus();
            } else {
                blurViewport = size;
            }
        };
        const onKeyCapture = (event) => {
            keyEvent = event;
        };
        // A capturing window listener also sees each element's blur; only the window's own counts.
        const onWindowBlur = (event) => {
            if (event.target === view) forgetFocus();
        };
        const listenerOptions = { capture: true, passive: true };
        const focusListeners = [
            [document, 'focusin', onFocusin],
            [document, 'focusout', onFocusout],
            [document, 'keydown', onKeyCapture],
            [document, 'pointerdown', forgetFocus],
            [document, 'mousedown', forgetFocus],
            [document, 'touchstart', forgetFocus],
            [view, 'blur', onWindowBlur]
        ].filter(([target]) => target);
        focusListeners.forEach(([target, type, listener]) => target.addEventListener(type, listener, listenerOptions));

        // Focus the browser already dropped from the sidebar: <body> is active in a document that
        // still has focus, the remembered element is still in the sidebar, and the viewport now
        // differs from its size at focus and matches its size at the blur. With no focusout seen
        // (a browser that drops focus from hidden content silently) the current size stands in.
        const blurredFromSidebar = (active) => {
            if ((active && active !== body) || focusOwner === null || !sidebar.contains(focusOwner)) return false;
            if (typeof document.hasFocus !== 'function' || !document.hasFocus()) return false;
            const size = viewport();
            return size !== focusViewport && size === (blurViewport ?? size);
        };

        // A browser drops focus from a newly inert subtree to <body>, so focus inside the sidebar
        // goes to the toggle first. On a viewport collapse, focus the browser already blurred from
        // the sidebar is recovered the same way. Focus elsewhere is left alone, as is a toggle
        // that is hidden, inert or itself inside the sidebar.
        const rescueFocus = (fromViewport) => {
            const active = document.activeElement;
            const inside = active && active !== body && sidebar.contains(active);
            if (!inside && !(fromViewport && blurredFromSidebar(active))) return;
            forgetFocus();
            if (sidebar.contains(toggle) || toggle.closest('[hidden], [inert]')) return;
            toggle.focus();
        };

        // Any inert mutation not made by this helper (records are taken synchronously around its
        // own writes, so only other writers' records reach here) hands ownership to that writer.
        const release = () => {
            if (watcher) watcher.disconnect();
            watcher = null;
            owned = false;
        };
        const onExternalInert = (records) => {
            if (owned && records.length > 0) release();
        };
        // Writes inert as this helper: other writers' undelivered records are processed first,
        // then the record for this write is discarded so it is never counted as external.
        const writeInert = (write) => {
            onExternalInert(watcher.takeRecords());
            if (!owned) return;
            write();
            watcher.takeRecords();
        };

        // Only the workbench presentation (mode.js) makes the collapsed sidebar inert; legacy
        // navigation keeps the theme's behaviour. A pre-existing inert value is never touched, and
        // nothing is applied without a watcher, since ownership could not then be tracked.
        const setInert = (collapsed, fromViewport) => {
            if (!sidebar) return;
            const workbench = body.classList.contains(WORKBENCH_CLASS);
            if (!workbench) forgetFocus();
            const apply = collapsed && workbench;
            if (!apply) {
                if (owned) writeInert(() => sidebar.removeAttribute('inert'));
                release();
                handled = false;
                return;
            }
            if (handled) return;
            handled = true;
            if (typeof observeInert !== 'function' || sidebar.hasAttribute('inert')) return;
            rescueFocus(fromViewport);
            // Moving focus can run another component's focus/blur handler synchronously, before
            // the watcher exists; inert it wrote there belongs to that component.
            if (sidebar.hasAttribute('inert')) return;
            watcher = observeInert(sidebar, onExternalInert);
            owned = true;
            writeInert(() => sidebar.setAttribute('inert', ''));
        };

        const sync = (fromViewport = false) => {
            const toggled = wrapper.classList.contains('toggled');
            const narrow = Boolean(media && media.matches);
            const expanded = narrow ? toggled : !toggled;
            toggle.setAttribute('aria-expanded', String(expanded));
            setInert(!expanded, fromViewport);
        };
        const syncFromViewport = () => sync(true);
        const syncFromClass = () => sync(false);

        const measure = () => {
            if (!toolbar) return;
            const height = Math.ceil(toolbar.getBoundingClientRect().height);
            if (height > 0) wrapper.style.setProperty(OFFSET_PROPERTY, `${height}px`);
        };

        const onKeydown = (event) => {
            if (event.key !== ' ' && event.key !== 'Spacebar') return;
            event.preventDefault();
            toggle.click();
        };

        toggle.addEventListener('keydown', onKeydown);
        const unwatchMedia = watchMedia(media, syncFromViewport);
        const classObserver = observeClass(wrapper, syncFromClass);
        const modeObserver = sidebar ? observeClass(body, syncFromClass) : null;
        const resizeObserver = toolbar ? observeResize(toolbar, measure) : null;
        sync();
        measure();

        return {
            dispose() {
                toggle.removeEventListener('keydown', onKeydown);
                unwatchMedia();
                classObserver.disconnect();
                if (modeObserver) modeObserver.disconnect();
                if (resizeObserver) resizeObserver.disconnect();
                focusListeners.forEach(([target, type, listener]) => target.removeEventListener(type, listener, listenerOptions));
                forgetFocus();
                keyEvent = null;
                wrapper.style.removeProperty(OFFSET_PROPERTY);
                setInert(false);
                restoreAttribute(toggle, 'aria-expanded', originalExpanded);
            }
        };
    }

    return { createSidebarToggle, NARROW_QUERY };
}));
