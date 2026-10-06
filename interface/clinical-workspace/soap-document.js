/* Grows the four SOAP note fields to fit their text inside the workbench. Only ever writes style.height. */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root && root.document) {
        const start = () => api.attach(root);
        if (root.document.readyState === 'loading') {
            root.document.addEventListener('DOMContentLoaded', start, { once: true });
        } else {
            start();
        }
    }
}(typeof window === 'undefined' ? null : window, function () {
    const FIELD_NAMES = ['subjective', 'objective', 'assessment', 'plan'];
    // Added by mode.js only while an ancestor workbench is active; legacy layout keeps native rows.
    const ACTIVE_CLASS = 'oe-clinical-workspace';

    const px = (value) => {
        const number = parseFloat(value);
        return Number.isFinite(number) ? number : 0;
    };

    function createAutoHeight({ body, fields, observe }) {
        const original = new Map(fields.map((field) => [field, field.style.height]));
        const widths = new Map();
        const view = body.ownerDocument.defaultView;
        let disposed = false;
        let resizeObserver = null;
        // Inline heights would outlive the screen-only CSS on paper, so printing uses the
        // native size. Either signal (print events or the print media query) suspends fitting.
        let printEvent = false;
        const printQuery = view && typeof view.matchMedia === 'function' ? view.matchMedia('print') : null;
        const printing = () => printEvent || Boolean(printQuery && printQuery.matches);

        const active = () => !disposed && !printing() && body.classList.contains(ACTIVE_CLASS);
        const restore = (field) => { field.style.height = original.get(field); };

        function fit(field) {
            if (!active() || !field.isConnected) return;
            const doc = field.ownerDocument;
            const fieldView = doc.defaultView;
            if (!fieldView) return;
            // Measure from a collapsed box: height:auto keeps the native rows="6" floor, so a
            // short note could never fit its text. The CSS min-height still bounds the result.
            // Collapsing can clamp the page scroll; put it back.
            const scroller = doc.scrollingElement;
            const scrollTop = scroller ? scroller.scrollTop : 0;
            field.style.height = '0px';
            const style = fieldView.getComputedStyle(field);
            const content = field.scrollHeight;
            if (content > 0) {
                const extra = style.boxSizing === 'border-box'
                    ? px(style.borderTopWidth) + px(style.borderBottomWidth)
                    : -(px(style.paddingTop) + px(style.paddingBottom));
                field.style.height = `${Math.ceil(content + extra)}px`;
            } else {
                // Nothing to measure (e.g. a hidden frame): keep the native size.
                restore(field);
            }
            if (scroller && scroller.scrollTop !== scrollTop) scroller.scrollTop = scrollTop;
        }

        const refresh = () => fields.forEach(fit);
        const sync = () => {
            if (active()) refresh();
            else fields.forEach(restore);
        };
        const onInput = (event) => fit(event.currentTarget);
        const onBeforePrint = () => { printEvent = true; sync(); };
        const onAfterPrint = () => { printEvent = false; sync(); };

        fields.forEach((field) => field.addEventListener('input', onInput));
        const modeObserver = observe(body, sync);
        // soap-reference.js widens or narrows the sheet by class; refit even without ResizeObserver.
        const container = fields.length > 0 ? fields[0].closest('.oe-soap-document') : null;
        const layoutObserver = container ? observe(container, sync) : null;

        if (view && view.ResizeObserver) {
            // Refit only on width change; a manual drag of the resize handle changes height only.
            resizeObserver = new view.ResizeObserver((entries) => entries.forEach((entry) => {
                const width = entry.contentRect.width;
                if (widths.get(entry.target) === width) return;
                widths.set(entry.target, width);
                fit(entry.target);
            }));
            fields.forEach((field) => resizeObserver.observe(field));
        } else if (view) {
            view.addEventListener('resize', refresh);
        }
        if (view) {
            view.addEventListener('pageshow', refresh);
            view.addEventListener('beforeprint', onBeforePrint);
            view.addEventListener('afterprint', onAfterPrint);
        }
        if (printQuery) {
            if (printQuery.addEventListener) printQuery.addEventListener('change', sync);
            else if (printQuery.addListener) printQuery.addListener(sync);
        }
        const fonts = body.ownerDocument.fonts;
        if (fonts && fonts.ready) fonts.ready.then(refresh);

        sync();

        return {
            refresh,
            dispose() {
                if (disposed) return;
                disposed = true;
                fields.forEach((field) => field.removeEventListener('input', onInput));
                if (modeObserver) modeObserver.disconnect();
                if (layoutObserver) layoutObserver.disconnect();
                if (resizeObserver) resizeObserver.disconnect();
                if (view) {
                    view.removeEventListener('resize', refresh);
                    view.removeEventListener('pageshow', refresh);
                    view.removeEventListener('beforeprint', onBeforePrint);
                    view.removeEventListener('afterprint', onAfterPrint);
                }
                if (printQuery) {
                    if (printQuery.removeEventListener) printQuery.removeEventListener('change', sync);
                    else if (printQuery.removeListener) printQuery.removeListener(sync);
                }
                fields.forEach(restore);
            }
        };
    }

    function attach(root) {
        const form = root.document.querySelector('form[name="soap"]');
        if (!form) return null;
        const fields = FIELD_NAMES
            .map((name) => form.querySelector(`textarea[name="${name}"]`))
            .filter(Boolean);
        if (fields.length === 0) return null;
        const controller = createAutoHeight({
            body: root.document.body,
            fields,
            observe: (target, callback) => {
                const observer = new root.MutationObserver(callback);
                observer.observe(target, { attributes: true, attributeFilter: ['class'] });
                return observer;
            }
        });
        const onPageHide = (event) => {
            // A page kept in the back-forward cache comes back with its listeners intact.
            if (event.persisted) return;
            root.removeEventListener('pagehide', onPageHide);
            controller.dispose();
        };
        root.addEventListener('pagehide', onPageHide);
        return controller;
    }

    return { FIELD_NAMES, createAutoHeight, attach };
}));
