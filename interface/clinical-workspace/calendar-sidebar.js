/*
 * Calendar sidebar toggle state for the day/week/month screens.
 *
 * The original #menu-toggle click handler in _calendar_screen_js.html.twig still
 * owns the behaviour (it toggles `toggled` on #wrapper). This helper only:
 *  - reports that state as aria-expanded, read from the real #wrapper class;
 *  - lets Space activate the anchor-as-button through that same click handler;
 *  - publishes the measured toolbar height as --oe-calendar-toolbar-height so the
 *    workbench narrow layout can place the fixed sidebar below a wrapped toolbar.
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

    function createSidebarToggle({ document, media, observeClass, observeResize }) {
        const toggle = document.getElementById('menu-toggle');
        const wrapper = document.getElementById('wrapper');
        if (!toggle || !wrapper) {
            return { dispose() {} };
        }
        const toolbar = toggle.closest('.sticky-top');

        const sync = () => {
            const toggled = wrapper.classList.contains('toggled');
            const narrow = Boolean(media && media.matches);
            toggle.setAttribute('aria-expanded', String(narrow ? toggled : !toggled));
        };

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
        if (media) media.addEventListener('change', sync);
        const classObserver = observeClass(wrapper, sync);
        const resizeObserver = toolbar ? observeResize(toolbar, measure) : null;
        sync();
        measure();

        return {
            dispose() {
                toggle.removeEventListener('keydown', onKeydown);
                if (media) media.removeEventListener('change', sync);
                classObserver.disconnect();
                if (resizeObserver) resizeObserver.disconnect();
                wrapper.style.removeProperty(OFFSET_PROPERTY);
            }
        };
    }

    return { createSidebarToggle, NARROW_QUERY };
}));
