/**
 * menu_launcher.js
 *
 * Searchable "All menus" launcher for the main tabs shell. It indexes the
 * live Knockout menu tree built by menu_json.html.twig (already filtered on
 * the server by ACL, globals and module menu events) and activates entries
 * through the existing menuActionClick, passing the original menu_entry so
 * all navigation, encounter-lock, popup and telemetry behaviour is reused.
 *
 * menuActionClick opens 'pop' targets before checking enabled(), and the
 * dropdown never checks a header's requirement, so the launcher checks the
 * entry and all of its ancestors itself, at activation time.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen <craig@interconnected.au>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

(function (window) {
    'use strict';

    var PATH_SEPARATOR = ' › ';

    function unwrap(value) {
        return typeof value === 'function' ? value() : value;
    }

    function normalize(text) {
        return String(text)
            .normalize('NFD')
            .replace(/[̀-ͯ]/g, '')
            .toLowerCase();
    }

    /**
     * Flatten the menu tree into actionable entries, depth first, in menu order.
     * Reads the label and children observables, so calling this inside a
     * Knockout computed tracks runtime changes to the tree.
     */
    function collectEntries(nodes, ancestors, out) {
        ancestors = ancestors || [];
        out = out || [];
        (nodes || []).forEach(function (node) {
            if (node.header) {
                collectEntries(unwrap(node.children), ancestors.concat([node]), out);
                return;
            }
            var label = String(unwrap(node.label));
            var path = ancestors.map(function (a) {
                return String(unwrap(a.label));
            });
            out.push({
                item: node,
                ancestors: ancestors,
                label: label,
                path: path,
                labelKey: normalize(label),
                pathKey: normalize(path.join(' ')),
            });
        });
        return out;
    }

    /**
     * Return the first node (outermost ancestor first, then the item) whose
     * requirement is not currently met, or null when the entry may be opened.
     * Headers without a requirement do not block; an action item without an
     * enabled() function fails closed.
     */
    function findBlockingNode(entry) {
        var nodes = entry.ancestors.concat([entry.item]);
        for (var i = 0; i < nodes.length; i++) {
            var node = nodes[i];
            var isItem = node === entry.item;
            if (typeof node.enabled !== 'function') {
                if (isItem) {
                    return node;
                }
                continue;
            }
            if (!node.enabled()) {
                return node;
            }
        }
        return null;
    }

    function filterEntries(entries, query) {
        var tokens = normalize(query).split(/\s+/).filter(Boolean);
        if (tokens.length === 0) {
            return entries.slice();
        }
        var scored = [];
        entries.forEach(function (entry, index) {
            var haystack = entry.labelKey + ' ' + entry.pathKey;
            var all = tokens.every(function (t) {
                return haystack.indexOf(t) !== -1;
            });
            if (!all) {
                return;
            }
            var inLabel = tokens.every(function (t) {
                return entry.labelKey.indexOf(t) !== -1;
            });
            var rank = !inLabel ? 2 : (entry.labelKey.indexOf(tokens[0]) === 0 ? 0 : 1);
            scored.push({ entry: entry, rank: rank, index: index });
        });
        scored.sort(function (a, b) {
            return (a.rank - b.rank) || (a.index - b.index);
        });
        return scored.map(function (s) {
            return s.entry;
        });
    }

    function requirementMessage(node, strings, groupTherapyEnabled) {
        switch (node && node.requirement) {
            case 1:
                return groupTherapyEnabled ? strings.patientOrGroup : strings.patient;
            case 2:
            case 3:
                return strings.encounter;
            case 4:
                return strings.group;
            case 5:
                return strings.groupEncounter;
            default:
                return strings.unavailable;
        }
    }

    function readStrings(root) {
        var d = root.dataset;
        return {
            patient: d.msgPatient || '',
            patientOrGroup: d.msgPatientOrGroup || '',
            encounter: d.msgEncounter || '',
            group: d.msgGroup || '',
            groupEncounter: d.msgGroupEncounter || '',
            unavailable: d.msgUnavailable || '',
            count: d.msgCount || '',
        };
    }

    /**
     * Wire the launcher markup (menu_launcher.html.twig) to a live menu.
     *
     * @param {Object} options
     * @param {HTMLElement} options.root  element with data-oe-menu-launcher="root"
     * @param {Function} options.menu     ko.observableArray of menu_entry objects
     * @param {Object} [options.ko]       Knockout, defaults to window.ko
     * @param {Function} [options.dispatch] defaults to window.menuActionClick
     * @param {boolean} [options.groupTherapyEnabled]
     */
    function create(options) {
        var ko = options.ko || window.ko;
        var root = options.root;
        var doc = root.ownerDocument;
        var part = function (name) {
            return root.querySelector('[data-oe-menu-launcher="' + name + '"]');
        };
        var trigger = part('trigger');
        var overlay = part('overlay');
        var dialog = overlay.querySelector('[role="dialog"]');
        var search = part('search');
        var closeButton = part('close');
        var statusEl = part('status');
        var results = part('results');
        var empty = part('empty');
        var strings = readStrings(root);
        var dispatch = options.dispatch || function (item, evt) {
            return window.menuActionClick(item, evt);
        };

        var isOpen = ko.observable(false);
        var query = ko.observable('');
        var notice = ko.observable('');
        var visible = [];
        var activeItem = null;
        // Not every engine sets isComposing on the keydowns inside a
        // composition, so the composition events are tracked as well.
        var composing = false;

        function setActive(index) {
            var nodes = results.children;
            activeItem = null;
            for (var i = 0; i < nodes.length; i++) {
                var on = i === index;
                nodes[i].setAttribute('aria-selected', on ? 'true' : 'false');
                if (on) {
                    activeItem = visible[i].item;
                    search.setAttribute('aria-activedescendant', nodes[i].id);
                    if (typeof nodes[i].scrollIntoView === 'function') {
                        nodes[i].scrollIntoView({ block: 'nearest' });
                    }
                }
            }
            if (activeItem === null) {
                search.removeAttribute('aria-activedescendant');
            }
        }

        function activeIndex() {
            for (var i = 0; i < visible.length; i++) {
                if (visible[i].item === activeItem) {
                    return i;
                }
            }
            return -1;
        }

        function renderOption(entry, index) {
            var li = doc.createElement('li');
            li.className = 'oe-menu-launcher__option';
            li.id = 'oeMenuLauncherOption' + index;
            li.setAttribute('role', 'option');
            li.setAttribute('data-index', String(index));

            var label = doc.createElement('span');
            label.className = 'oe-menu-launcher__label';
            label.setAttribute('data-oe-menu-launcher', 'label');
            label.textContent = entry.label;
            li.appendChild(label);

            if (entry.path.length) {
                var crumb = doc.createElement('span');
                crumb.className = 'oe-menu-launcher__path';
                crumb.setAttribute('data-oe-menu-launcher', 'path');
                crumb.textContent = entry.path.join(PATH_SEPARATOR);
                li.appendChild(crumb);
            }

            var blocking = findBlockingNode(entry);
            if (blocking) {
                li.setAttribute('aria-disabled', 'true');
                var req = doc.createElement('span');
                req.className = 'oe-menu-launcher__requirement';
                req.textContent = requirementMessage(blocking, strings, options.groupTherapyEnabled);
                li.appendChild(req);
            }
            return li;
        }

        // Re-renders whenever the query, the menu tree, labels or any
        // requirement observable (patient, encounter, group) changes.
        var renderer = ko.computed(function () {
            if (!isOpen()) {
                visible = [];
                activeItem = null;
                results.textContent = '';
                return;
            }
            var previous = activeItem;
            visible = filterEntries(collectEntries(options.menu()), query());
            results.textContent = '';
            visible.forEach(function (entry, i) {
                results.appendChild(renderOption(entry, i));
            });
            empty.hidden = visible.length !== 0;
            var message = notice();
            statusEl.textContent = message || (strings.count + ': ' + visible.length);
            activeItem = previous;
            var index = activeIndex();
            setActive(index === -1 ? 0 : index);
        });

        function open() {
            if (isOpen()) {
                return;
            }
            search.value = '';
            query('');
            notice('');
            activeItem = null;
            composing = false;
            overlay.hidden = false;
            trigger.setAttribute('aria-expanded', 'true');
            isOpen(true);
            search.focus();
        }

        function close() {
            if (!isOpen()) {
                return;
            }
            overlay.hidden = true;
            trigger.setAttribute('aria-expanded', 'false');
            search.value = '';
            query('');
            notice('');
            isOpen(false);
            statusEl.textContent = '';
            trigger.focus();
        }

        function activate(index, domEvent) {
            var entry = visible[index];
            if (!entry) {
                return;
            }
            var blocking = findBlockingNode(entry);
            if (blocking) {
                notice(requirementMessage(blocking, strings, options.groupTherapyEnabled));
                setActive(index);
                // The dialog stays open, so keep its keyboard controls reachable.
                search.focus();
                return;
            }
            // menuActionClick reads the popup title from currentTarget's text,
            // so hand it an element holding only the label.
            var labelEl = doc.createElement('span');
            labelEl.textContent = entry.label;
            close();
            dispatch(entry.item, {
                type: 'click',
                currentTarget: labelEl,
                target: labelEl,
                originalEvent: domEvent,
            });
        }

        function onTriggerClick() {
            open();
        }

        function onInput() {
            notice('');
            activeItem = null;
            query(search.value);
        }

        function onCompositionStart() {
            composing = true;
        }

        function onCompositionEnd() {
            composing = false;
        }

        function onDialogKeydown(evt) {
            // Keys pressed while an IME composes (including the Enter that
            // commits it, which Safari reports after compositionend with
            // keyCode 229) belong to the IME, not to the launcher.
            if (evt.isComposing || composing || evt.keyCode === 229) {
                return;
            }
            if (evt.key === 'Escape') {
                evt.preventDefault();
                evt.stopPropagation();
                close();
                return;
            }
            if (evt.key === 'Tab') {
                // Only two tab stops: the search field and the close button.
                evt.preventDefault();
                (doc.activeElement === search ? closeButton : search).focus();
                return;
            }
            if (evt.target !== search) {
                return;
            }
            var count = visible.length;
            var current = activeIndex();
            if (evt.key === 'ArrowDown' && count) {
                evt.preventDefault();
                setActive((current + 1) % count);
            } else if (evt.key === 'ArrowUp' && count) {
                evt.preventDefault();
                setActive(current <= 0 ? count - 1 : current - 1);
            } else if (evt.key === 'Enter') {
                evt.preventDefault();
                activate(current, evt);
            }
        }

        function onResultsClick(evt) {
            var option = evt.target.closest('[role="option"]');
            if (option && results.contains(option)) {
                activate(Number(option.getAttribute('data-index')), evt);
            }
        }

        // Options are not focusable, so a pointer press on one would otherwise
        // move focus to the body and strand the keyboard handlers.
        function onResultsMousedown(evt) {
            if (evt.target.closest('[role="option"]')) {
                evt.preventDefault();
            }
        }

        function onOverlayMousedown(evt) {
            if (evt.target === overlay) {
                // Stop the default focus change from undoing the restore to the trigger.
                evt.preventDefault();
                close();
            }
        }

        trigger.addEventListener('click', onTriggerClick);
        search.addEventListener('input', onInput);
        search.addEventListener('compositionstart', onCompositionStart);
        search.addEventListener('compositionend', onCompositionEnd);
        dialog.addEventListener('keydown', onDialogKeydown);
        results.addEventListener('mousedown', onResultsMousedown);
        results.addEventListener('click', onResultsClick);
        closeButton.addEventListener('click', close);
        overlay.addEventListener('mousedown', onOverlayMousedown);

        return {
            open: open,
            close: close,
            isOpen: function () {
                return isOpen();
            },
            destroy: function () {
                close();
                renderer.dispose();
                trigger.removeEventListener('click', onTriggerClick);
                search.removeEventListener('input', onInput);
                search.removeEventListener('compositionstart', onCompositionStart);
                search.removeEventListener('compositionend', onCompositionEnd);
                dialog.removeEventListener('keydown', onDialogKeydown);
                results.removeEventListener('mousedown', onResultsMousedown);
                results.removeEventListener('click', onResultsClick);
                closeButton.removeEventListener('click', close);
                overlay.removeEventListener('mousedown', onOverlayMousedown);
            },
        };
    }

    window.OpenEMRMenuLauncher = {
        collectEntries: function (nodes) {
            return collectEntries(nodes);
        },
        findBlockingNode: findBlockingNode,
        filterEntries: filterEntries,
        create: create,
    };
}(window));
