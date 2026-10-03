# Workbench rail focus restoration

The workbench rail rebuilds its DOM whenever the live menu or the global
search query changes. Keyboard focus inside the rail is carried across that
rebuild by **original menu-node identity**, never by label text, so duplicate
or quoted labels cannot be confused.

## Behaviour

Before the rebuild, the renderer records the focused node and its ancestor
branches, walking up from `document.activeElement` within the tree. A branch
`<summary>` carries no node of its own, so walking up resolves it to its
enclosing `<details>` branch. Before this change only actions were restored;
a focused summary dropped focus to `<body>`.

After the rebuild, focus goes to the first match in this order:

1. The same node (its action button, or its branch summary).
2. The nearest surviving ancestor branch summary.
3. The rail search field.

Every step accepts only elements a keyboard user can reach. An element is
unreachable if it is disconnected, sits inside a `hidden` area section, is
inert, or sits inside a collapsed `<details>`. This includes an element that
was already unreachable before the rebuild (for example, a branch collapsed
synchronously while a descendant held focus): browsers cannot focus such an
element, so restoring it would leave focus on the body. It falls back to its
nearest reachable ancestor summary or the search field instead.

Focus is only restored when it was inside the rail tree, so nothing moves focus
out of an iframe, the search field or the top bar. Restoration runs
synchronously inside the existing renderer computed, with no timers. The
selected area, open branches, search text and original `dispatch(node, event)`
stay as they were. No content, iframe or iframe-ancestor node is touched.
`destroy()` disposes the renderer, so later menu changes neither rerender nor
move focus.

## Tests

`tests/js/workbench-focus-restoration.test.js` drives the production renderer
with synthetic menu data and covers:

- summary restoration for a surviving branch, during a runtime menu change and
  during an active search
- fallback when a branch is removed, moved into a hidden area, moved under a
  collapsed branch, or filtered out of a search
- fallback when a focused summary or action is collapsed away synchronously
  before the rerender (it is not refocused while unreachable)
- identity and original dispatch for a duplicate-labelled action
- no iframe or ancestor mutations
- listener cleanup on teardown, and a detached root that does not throw

```bash
npx jest tests/js/workbench-focus-restoration.test.js --runInBand --coverage=false
```

Real-browser verification of focus visibility (for example `:focus-visible`
rings and screen-reader announcements) is still owned by the controller.
