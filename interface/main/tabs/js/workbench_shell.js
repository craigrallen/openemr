/**
 * The workbench navigation presents the ACL-filtered live menu_entry tree.
 * It never reconstructs an action: dispatch always receives the original entry.
 */
(function (window) {
    'use strict';

    var GROUPS = ['Work', 'Patient', 'Practice'];
    var WORK = ['Calendar', 'Finder', 'Flow', 'Recalls', 'Messages', 'File', 'View', 'Report'];
    var PATIENT = ['Patient', 'Groups', 'Ensora eRx', 'Procedures'];

    function value(observable) {
        return typeof observable === 'function' ? observable() : observable;
    }

    function groupFor(node) {
        var label = String(node.sourceLabel || value(node.label));
        if (PATIENT.indexOf(label) !== -1) return 'Patient';
        if (WORK.indexOf(label) !== -1) return 'Work';
        // Unknown module sections remain visible here, without a server menu rewrite.
        return 'Practice';
    }

    function create(options) {
        var root = options.root;
        var ko = options.ko || window.ko;
        var menuTools = window.OpenEMRMenuLauncher;
        var rail = root.querySelector('#workbenchRail');
        var layout = root.querySelector('#workbench');
        var main = root.querySelector('#workbenchContent');
        var backdrop = root.querySelector('[data-workbench-backdrop]');
        var notice = root.querySelector('[data-workbench-notice]');
        var tree = root.querySelector('[data-workbench-tree]');
        var search = root.querySelector('[data-workbench-search]');
        var modeButton = root.querySelector('[data-workbench-mode]');
        var mobileToggle = root.querySelector('[data-workbench-mobile-toggle]');
        var mobileClose = root.querySelector('[data-workbench-mobile-close]');
        var title = root.querySelector('[data-workbench-title]');
        var areas = root.querySelector('[data-workbench-areas]');
        var areaButtons = Array.from(root.querySelectorAll('[data-workbench-area]')).filter(function (button) {
            return GROUPS.indexOf(button.dataset.workbenchArea) !== -1;
        });
        // Untranslated group key; only section visibility follows it, never the DOM tree.
        var area = 'Work';
        var dispatch = options.dispatch || window.menuActionClick;
        var storage = options.storage || window.localStorage;
        var active = null;
        var query = ko.observable('');
        var legacy = false;
        var actionComputeds = [];
        var originalNodes = ['attendantData', 'tabs_div', 'mainFrames_div'].map(function (id) { return root.querySelector('#' + id); });
        var contentHead = root.querySelector('.workbench-content-head');
        var canMovePreservingState = typeof root.moveBefore === 'function' && typeof main.moveBefore === 'function';
        var focusReturn = mobileToggle;
        var strings = {
            patient: rail.dataset.msgPatient || rail.dataset.workbenchUnavailable,
            patientOrGroup: rail.dataset.msgPatientOrGroup || rail.dataset.msgPatient,
            encounter: rail.dataset.msgEncounter || rail.dataset.workbenchUnavailable,
            group: rail.dataset.msgGroup || rail.dataset.workbenchUnavailable,
            groupEncounter: rail.dataset.msgGroupEncounter || rail.dataset.workbenchUnavailable,
            unavailable: rail.dataset.msgUnavailable || rail.dataset.workbenchUnavailable
        };

        try { legacy = storage.getItem('openemr.navigation.mode') === 'legacy'; } catch { legacy = false; }

        function setMode(isLegacy) {
            closeMobile(false);
            legacy = isLegacy;
            // Ordinary DOM reparenting reloads nested browsing contexts, even when
            // the iframe element itself is reused. Leave the tree in place unless
            // the browser provides the state-preserving move primitive.
            if (canMovePreservingState && legacy) {
                originalNodes.forEach(function (node) {
                    if (node && node.parentElement !== root) root.moveBefore(node, layout);
                });
            } else if (canMovePreservingState) {
                if (originalNodes[0] && originalNodes[0].parentElement !== main) {
                    main.moveBefore(originalNodes[0], contentHead || main.firstChild);
                }
                originalNodes.slice(1).forEach(function (node) {
                    if (node && node.parentElement !== main) main.moveBefore(node, null);
                });
            }
            root.classList.toggle('workbench-legacy', legacy);
            root.classList.toggle('workbench-static-legacy', legacy && !canMovePreservingState);
            root.ownerDocument.documentElement.classList.toggle('workbench-active', !legacy);
            root.ownerDocument.body.classList.toggle('workbench-active', !legacy);
            modeButton.textContent = legacy ? modeButton.dataset.workbenchLabel : modeButton.dataset.legacyLabel;
            modeButton.setAttribute('aria-pressed', legacy ? 'true' : 'false');
            if (areas) areas.hidden = legacy;
            try { storage.setItem('openemr.navigation.mode', legacy ? 'legacy' : 'workbench'); } catch { /* private browsing */ }
        }

        function closeMobile(restoreFocus) {
            var wasOpen = root.classList.contains('workbench-mobile-open');
            root.classList.remove('workbench-mobile-open');
            mobileToggle.setAttribute('aria-expanded', 'false');
            if (main) main.inert = false;
            if (root.querySelector('nav')) root.querySelector('nav').inert = false;
            rail.removeAttribute('role');
            rail.removeAttribute('aria-modal');
            if (restoreFocus && wasOpen) focusReturn.focus();
        }

        function element(tag, className, label) {
            var node = root.ownerDocument.createElement(tag);
            node.className = className;
            if (label !== undefined) node.textContent = label;
            return node;
        }

        function appendNode(node, ancestors, host, needle, depth, relevant) {
            if (relevant && !relevant.has(node)) return;
            var label = String(value(node.label));
            if (node.header) {
                var details = element('details', 'workbench-branch');
                details.open = !!needle;
                details.__workbenchNode = node;
                var summary = element('summary', 'workbench-branch-label', label);
                details.appendChild(summary);
                var children = element('div', 'workbench-children');
                value(node.children).forEach(function (child) {
                    appendNode(child, ancestors.concat([node]), children, needle, depth + 1, relevant);
                });
                details.appendChild(children);
                host.appendChild(details);
                return;
            }
            var button = element('button', 'workbench-action', label);
            button.__workbenchNode = node;
            button.type = 'button';
            button.setAttribute('data-workbench-action', '');
            button.style.setProperty('--workbench-depth', String(depth));
            actionComputeds.push(ko.computed(function () {
                var blocked = menuTools.findBlockingNode({ item: node, ancestors: ancestors });
                button.setAttribute('aria-disabled', blocked ? 'true' : 'false');
                if (blocked) {
                    button.setAttribute('aria-describedby', notice.id);
                    button.title = menuTools.requirementMessage(blocked, strings, options.groupTherapyEnabled);
                } else {
                    button.removeAttribute('aria-describedby');
                    button.removeAttribute('title');
                }
            }));
            if (active === node) button.setAttribute('aria-current', 'page');
            button.addEventListener('click', function (event) {
                // In particular, a pop target must be stopped before menuActionClick.
                var blocked = menuTools.findBlockingNode({ item: node, ancestors: ancestors });
                if (blocked) {
                    notice.textContent = menuTools.requirementMessage(blocked, strings, options.groupTherapyEnabled);
                    return;
                }
                notice.textContent = '';
                active = node;
                tree.querySelectorAll('[aria-current="page"]').forEach(function (current) {
                    current.removeAttribute('aria-current');
                });
                button.setAttribute('aria-current', 'page');
                var drawerOpen = root.classList.contains('workbench-mobile-open');
                if (drawerOpen) closeMobile(true);
                dispatch(node, event);
            });
            host.appendChild(button);
        }

        function applyArea() {
            var searching = !!query().trim();
            tree.querySelectorAll('[data-workbench-group]').forEach(function (section) {
                section.hidden = !searching && section.dataset.workbenchGroup !== area;
            });
            areaButtons.forEach(function (button) {
                button.setAttribute('aria-pressed', button.dataset.workbenchArea === area ? 'true' : 'false');
            });
        }

        // Focus may only return to an element a keyboard user can actually reach.
        function reachable(target) {
            for (var current = target; current; current = current.parentElement) {
                if (current.hidden || current.inert || current.hasAttribute('inert')) return false;
                if (current !== target && current.matches('details') && !current.open && target.parentElement !== current) return false;
            }
            return target.isConnected;
        }

        function focusTarget(item) {
            return item.matches('details') ? item.querySelector(':scope > summary') : item;
        }

        var renderer = ko.computed(function () {
            var nodes = options.menu();
            var needle = query().trim();
            // The focused node first, then its ancestors: a summary carries no node
            // itself, so walking up resolves it to its own branch.
            var focusChain = [];
            var focused = root.ownerDocument.activeElement;
            if (focused && tree.contains(focused)) {
                for (var current = focused; current && current !== tree; current = current.parentElement) {
                    if (current.__workbenchNode) focusChain.push(current.__workbenchNode);
                }
            }
            var openNodes = new Set(Array.from(tree.querySelectorAll('.workbench-branch[open]')).map(function (branch) { return branch.__workbenchNode; }));
            var relevant = null;
            if (needle) {
                relevant = new Set();
                menuTools.filterEntries(menuTools.collectEntries(nodes), needle).forEach(function (entry) {
                    relevant.add(entry.item);
                    entry.ancestors.forEach(function (ancestor) { relevant.add(ancestor); });
                });
            }
            var fragment = root.ownerDocument.createDocumentFragment();
            actionComputeds.forEach(function (computed) { computed.dispose(); });
            actionComputeds = [];
            GROUPS.forEach(function (group) {
                var members = nodes.filter(function (node) { return groupFor(node) === group && (!relevant || relevant.has(node)); });
                if (!members.length && relevant) return;
                var section = element('section', 'workbench-group');
                section.setAttribute('data-workbench-group', group);
                var heading = element('h2', 'workbench-group-title', rail.dataset['group' + group] || group);
                section.appendChild(heading);
                members.forEach(function (node) { appendNode(node, [], section, needle, 0, relevant); });
                // An ACL-filtered area stays selectable and says why it is empty.
                if (!members.length) section.appendChild(element('p', 'workbench-empty', rail.dataset.msgAreaEmpty || ''));
                fragment.appendChild(section);
            });
            tree.replaceChildren(fragment);
            applyArea();
            if (!needle) tree.querySelectorAll('.workbench-branch').forEach(function (branch) {
                if (openNodes.has(branch.__workbenchNode)) branch.open = true;
            });
            if (focusChain.length) {
                var candidates = Array.from(tree.querySelectorAll('[data-workbench-action], .workbench-branch')).map(focusTarget);
                var replacement = null;
                focusChain.some(function (node) {
                    // Browsers cannot focus hidden, inert or collapsed elements, so only reachable ones qualify.
                    replacement = candidates.find(function (item) {
                        return (item.__workbenchNode || item.parentElement.__workbenchNode) === node && reachable(item);
                    }) || null;
                    return !!replacement;
                });
                // Never strand focus on the body when the whole branch has gone.
                if (!replacement && reachable(search)) replacement = search;
                if (replacement) replacement.focus();
            }
        });

        var titleRenderer = options.tabs && title ? ko.computed(function () {
            var selected = options.tabs().filter(function (tab) { return value(tab.visible); });
            if (selected.length) title.textContent = String(value(selected[selected.length - 1].title));
        }) : null;

        function onInput() { query(search.value); }
        function onArea(event) {
            area = event.currentTarget.dataset.workbenchArea;
            if (search.value) {
                search.value = '';
                query('');
            }
            applyArea();
        }
        function onMode() { setMode(!legacy); }
        function onMobile() {
            var open = !root.classList.contains('workbench-mobile-open');
            if (!open) { closeMobile(true); return; }
            focusReturn = mobileToggle;
            root.classList.add('workbench-mobile-open');
            mobileToggle.setAttribute('aria-expanded', 'true');
            if (main) main.inert = true;
            rail.setAttribute('role', 'dialog');
            rail.setAttribute('aria-modal', 'true');
            search.focus();
            if (root.querySelector('nav')) root.querySelector('nav').inert = true;
        }
        function onEscape(event) {
            if (event.key === 'Escape' && root.classList.contains('workbench-mobile-open')) {
                closeMobile(true);
                event.preventDefault();
            }
        }
        function onRailKeydown(event) {
            if (event.key !== 'Tab' || !root.classList.contains('workbench-mobile-open')) return;
            var stops = Array.from(rail.querySelectorAll('button, input, summary')).filter(function (item) {
                return item.getClientRects().length || item === search || item === mobileClose;
            });
            if (!stops.length) return;
            var first = stops[0];
            var last = stops[stops.length - 1];
            if (event.shiftKey && root.ownerDocument.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && root.ownerDocument.activeElement === last) { event.preventDefault(); first.focus(); }
        }
        function onBackdrop(event) { event.preventDefault(); closeMobile(true); }
        function onFocusIn(event) {
            if (root.classList.contains('workbench-mobile-open') && !rail.contains(event.target) &&
                !event.target.closest('[role="dialog"], [aria-modal="true"]')) search.focus();
        }
        function onMobileClose() { closeMobile(true); }
        search.addEventListener('input', onInput);
        areaButtons.forEach(function (button) { button.addEventListener('click', onArea); });
        modeButton.addEventListener('click', onMode);
        mobileToggle.addEventListener('click', onMobile);
        mobileClose.addEventListener('click', onMobileClose);
        rail.addEventListener('keydown', onRailKeydown);
        backdrop.addEventListener('pointerdown', onBackdrop);
        backdrop.addEventListener('click', onBackdrop);
        root.ownerDocument.addEventListener('focusin', onFocusIn);
        root.ownerDocument.addEventListener('keydown', onEscape);
        setMode(legacy);

        return { destroy: function () {
            renderer.dispose();
            actionComputeds.forEach(function (computed) { computed.dispose(); });
            closeMobile(false);
            if (titleRenderer) titleRenderer.dispose();
            search.removeEventListener('input', onInput);
            areaButtons.forEach(function (button) { button.removeEventListener('click', onArea); });
            modeButton.removeEventListener('click', onMode);
            mobileToggle.removeEventListener('click', onMobile);
            mobileClose.removeEventListener('click', onMobileClose);
            rail.removeEventListener('keydown', onRailKeydown);
            backdrop.removeEventListener('pointerdown', onBackdrop);
            backdrop.removeEventListener('click', onBackdrop);
            root.ownerDocument.removeEventListener('focusin', onFocusIn);
            root.ownerDocument.removeEventListener('keydown', onEscape);
        } };
    }

    window.OpenEMRWorkbenchShell = { create: create, groupFor: groupFor };
}(window));
