/* Read-only previous-SOAP reference beside the SOAP editor. Builds nodes with textContent only.
 * The only write to the note is an explicit clinician copy, offered only when the server marks the
 * panel data-copy-eligibility="allowed" (current note known to be unlocked); anything else denies. */
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
    const SECTION_NAMES = ['subjective', 'objective', 'assessment', 'plan'];
    const STATUSES = ['available', 'none', 'denied', 'unavailable'];
    const MAX_NOTES = 5;
    const RENDERED = 'data-soap-reference-rendered';

    function parsePayload(panel) {
        try {
            const data = JSON.parse(panel.getAttribute('data-soap-reference') || '');
            if (!data || typeof data !== 'object' || !STATUSES.includes(data.status) || !Array.isArray(data.notes)) {
                return null;
            }
            return data;
        } catch {
            return null;
        }
    }

    function validNote(note) {
        return Boolean(note)
            && Number.isInteger(note.encounter)
            && typeof note.date === 'string'
            && note.sections !== null
            && typeof note.sections === 'object'
            && SECTION_NAMES.every((name) => typeof note.sections[name] === 'string');
    }

    function element(doc, tag, className, text) {
        const node = doc.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    // Default deny: only the exact server-rendered value enables copy. The JSON payload cannot.
    function copyAllowed(panel) {
        return panel.getAttribute('data-copy-eligibility') === 'allowed';
    }

    function draftField(doc, name) {
        return doc.querySelector(`form[name="soap"] textarea[name="${name}"]`);
    }

    function copyToDraft(doc, name, source, live, labels) {
        const field = draftField(doc, name);
        // Extra guard only; the lock decision is the server's copy eligibility.
        if (!field || field.disabled || field.readOnly) {
            live.textContent = labels.locked;
            return;
        }
        const text = source.textContent;
        field.value = field.value === '' ? text : `${field.value}\n\n${text}`;
        const view = doc.defaultView;
        // Run the field's own dirty tracking: listeners on input, and the inline onkeyup handler.
        field.dispatchEvent(new view.Event('input', { bubbles: true }));
        field.dispatchEvent(new view.KeyboardEvent('keyup', { bubbles: true }));
        live.textContent = labels.copied;
        // Hand the clinician the appended draft to review: focus it, caret after the copied text.
        // focus() is a no-op if a handler above detached the field; textareas always support selection.
        field.focus();
        field.setSelectionRange(field.value.length, field.value.length);
    }

    function setStatus(status, key, withheld) {
        const message = status.getAttribute(`data-status-${key}`) || '';
        const extra = withheld ? status.getAttribute('data-status-withheld') : '';
        status.textContent = extra ? `${message} ${extra}` : message;
    }

    function render(panel) {
        const doc = panel.ownerDocument;
        const status = panel.querySelector('.oe-soap-reference__status');
        const list = panel.querySelector('.oe-soap-reference__list');
        const live = panel.querySelector('.oe-soap-reference__live');
        if (!status || !list || !live) return;
        list.replaceChildren();

        const data = parsePayload(panel);
        if (!data) {
            setStatus(status, 'unavailable', false);
            return;
        }
        if (data.status !== 'available') {
            setStatus(status, data.status, data.status !== 'unavailable' && data.withheld === true);
            return;
        }
        const notes = data.notes.slice(0, MAX_NOTES);
        if (!notes.every(validNote)) {
            setStatus(status, 'unavailable', false);
            return;
        }
        setStatus(status, 'available', data.withheld === true);

        const labels = {
            copy: panel.getAttribute('data-label-copy') || 'Copy to current draft',
            encounter: panel.getAttribute('data-label-encounter') || 'Encounter',
            copied: panel.getAttribute('data-label-copied') || 'Copied into the current draft.',
            locked: panel.getAttribute('data-label-locked') || 'This field cannot be edited; nothing was copied.',
        };
        const canCopy = copyAllowed(panel);
        notes.forEach((note) => {
            const item = element(doc, 'li', 'oe-soap-reference__note');
            item.setAttribute('data-encounter', String(note.encounter));
            item.appendChild(element(doc, 'p', 'oe-soap-reference__provenance', `${note.date} · ${labels.encounter} ${note.encounter}`));
            SECTION_NAMES.forEach((name) => {
                if (note.sections[name] === '') return;
                const section = element(doc, 'section', 'oe-soap-reference__section');
                section.setAttribute('data-section', name);
                const heading = element(doc, 'h4', 'oe-soap-reference__heading',
                    panel.getAttribute(`data-label-${name}`) || name);
                const source = element(doc, 'div', 'oe-soap-reference__text', note.sections[name]);
                section.append(heading, source);
                if (canCopy) {
                    const copy = element(doc, 'button', 'btn btn-link btn-sm oe-soap-reference__copy', labels.copy);
                    copy.type = 'button';
                    copy.setAttribute('aria-label', `${labels.copy}: ${heading.textContent} (${note.date})`);
                    copy.addEventListener('click', () => copyToDraft(doc, name, source, live, labels));
                    section.appendChild(copy);
                }
                item.appendChild(section);
            });
            list.appendChild(item);
        });
    }

    function attach(win) {
        const panel = win.document.querySelector('.oe-soap-reference');
        if (!panel) return null;
        if (panel.hasAttribute(RENDERED)) return panel;
        panel.setAttribute(RENDERED, '');
        render(panel);

        const toggle = panel.querySelector('.oe-soap-reference__toggle');
        const body = toggle && win.document.getElementById(toggle.getAttribute('aria-controls'));
        if (toggle && body) {
            // Only the reference body is shown or hidden; the editor is never moved or replaced.
            toggle.addEventListener('click', () => {
                const open = toggle.getAttribute('aria-expanded') !== 'true';
                toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
                body.hidden = !open;
            });
        }
        return panel;
    }

    return { attach, render, SECTION_NAMES, MAX_NOTES };
}));
