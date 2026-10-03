# Calendar sidebar toggle (day / week / month screens)

Bounded repair of the existing PostCalendar `#menu-toggle` and the narrow-width sidebar. No new screen, data, route or dependency.

## What changed

- **Toggle markup** (`templates/calendar/default/views/{day,week,month}/ajax_template.html.twig`): the existing anchor keeps `id`, `href="#"` and classes, and gains `role="button"`, `aria-controls="bottomLeft"` and a translated `aria-label`/`title` (`Toggle Calendar Sidebar`, `|xla`). The icon is `aria-hidden`.
- **State helper** (`interface/clinical-workspace/calendar-sidebar.js`, loaded from `_calendar_screen_js.html.twig` after the original handler, screen views only):
  - The original jQuery click handler stays authoritative: it alone toggles `#wrapper.toggled`.
  - `aria-expanded` is derived from the real `#wrapper` class, observed for changes from any code path. The meaning flips at the theme breakpoint (`max-width: 768px`, same as `ajax_calendar_sass.scss`): on desktop the sidebar is shown until toggled; on narrow screens it is hidden until toggled.
  - Space activates the toggle by calling `click()`, which runs the original handler. Enter keeps its native anchor behaviour.
  - The helper measures the sticky toolbar's height and sets it as `--oe-calendar-toolbar-height` on `#wrapper`, using `ResizeObserver` where available and falling back to `resize` events.
- **Workbench narrow layout** (`interface/clinical-workspace/calendar.css`, `@media (max-width: 768px)`, workbench-scoped): `#bottomLeft` gets `top: var(--oe-calendar-toolbar-height, 4.78rem)`, a matching `height` and `overflow-y: auto`, so the opened sidebar no longer covers a wrapped toolbar. Slot, event, toolbar and provider-header geometry are unchanged. The legacy theme offsets (`4.78rem` / `6.9rem`) are unchanged outside workbench mode.
  - The provider multi-select `#pc_username` gets `max-height: calc(100vh - toolbar - 1.5rem)` so that on short frames all of it can be scrolled into view. Every option and native multiple selection are kept, and the list scrolls itself.
- **Workbench desktop** (`@media (min-width: 769px)`, workbench-scoped): `#wrapper.toggled .sidebar-wrapper { display: none }`. The theme hides the sidebar with `margin-left: -30rem`, which leaves the fixed sidebar on screen when direction is rtl, so `aria-expanded` was wrong there. Exactly 768px keeps the narrow behaviour. The original handler still owns the toggled class, and the slide transition is lost in workbench desktop.
- **Geometry guard exceptions**: `clinical-calendar.test.js` lists exactly three (media, selector, property, value) exceptions: narrow `#bottomLeft` `top` and `height`, and desktop `#wrapper.toggled .sidebar-wrapper` `display: none`. `clinical-calendar-sidebar.test.js` pins the complete set of media-scoped declarations.
- **Stylelint**: a single-file override sets `media-feature-range-notation: prefix` for `calendar.css` only, so it can use the theme's breakpoint notation. All other files still require `context` notation.

## Tests

- `tests/js/clinical-calendar-sidebar.test.js` (jsdom): rendered-fixture attributes; aria-expanded on desktop and narrow screens, after viewport changes and after external class changes; Space/Enter; toolbar measurement; browser bootstrap (matchMedia, ResizeObserver, resize fallback, DOMContentLoaded, unload); the scoped CSS rule.
- `tests/js/clinical-calendar-stylelint.test.js` (node): checks the override's shape and runs the real stylelint CLI, both positive and negative cases.
- `TwigTemplateRenderTest::calendarScreenSidebarToggleIsNamedAndWired` (isolated PHP): renders the real templates. The three screen render fixtures were regenerated with `UPDATE_FIXTURES=1`.
- `tests/js/clinical-calendar.test.js`: the geometry guard allows only the three exact exceptions listed above.
- Latest controller runs: full Jest 446 tests in 29 suites passing; native isolated PHP 30 tests, 97 assertions passing. The native PHP run is what covers real Twig rendering. TDD red/green logs from earlier steps are under `tmp/evidence/`.

## Browser QA (local overlay, not a deployment)

- Script: `/Users/craig/.hermes/cache/scratch/calendar-sidebar-qa.py` (external to the repo). Final evidence: `/Users/craig/.hermes/projects/openemr/browser-qa/calendar-sidebar-qa.json`, `stage: complete`, `ok: true`, 23 feature checks, 0 failing, 0 page errors.
- Method: Chrome, authenticated, against the live master deployment at `271e18a` (deployed `calendar.css` matches master HEAD; `calendar-sidebar.js` is 404 there). The feature CSS, JS and toggle attributes were applied in the browser page only. This is not a deployment and not Twig rendering.
- Covered: Day, Week and Month at outer widths 1440, 1024, 820, 768, 390 and 320; Space, Enter and click on the toggle; `aria-expanded` matching visibility; hit-testing that the open sidebar does not cover toolbar controls; scrolling to reach the facility and provider selects; simulated RTL at 1440 and 390; switching to legacy mode, where computed styles were identical to baseline at 1440 and 390, then back, with nav mode and storage restored and no form posts.
- Baseline master, for comparison: no `aria-expanded`, the toggle's accessible name is only the icon glyph, and the open narrow sidebar overlapped the toolbar at 1024 and below in all three views.
- The new browser regression checks pass on the overlay and detect the baseline problems above.

## Limits

- Not verified: full research acceptance, other roles, assistive technology, true RTL locale, theme parity, long translations.
- Existing PR19 desktop defects at 1440 are still there and are not fixed here: the mini calendar scrolls horizontally and the desktop toolbar buttons wrap onto 2 rows. Desktop toolbar and mini-column work is out of scope (separate PR19).
- RTL has only been simulated by setting the direction in the browser, not with a translated RTL locale. Outside workbench mode, the legacy theme's margin-based hiding is unchanged.
- Exactly 768px follows the theme's overlapping `max-width`/`min-width` queries, where the narrow sidebar visibility applies.
- This is not a claim of design fidelity or of feature completeness.
