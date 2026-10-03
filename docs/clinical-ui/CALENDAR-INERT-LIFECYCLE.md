# Calendar sidebar inert lifecycle (workbench mode)

Bounded follow-up to [CALENDAR-SIDEBAR.md](CALENDAR-SIDEBAR.md). The behaviour lives in `interface/clinical-workspace/calendar-sidebar.js`. The only other change is how that script's URL is versioned (see Cache below). There are no iframe, route, ACL, form or data changes.

## Behaviour

- **Scope.** Inert is applied only while the calendar body has `oe-clinical-workspace`, the class `mode.js` sets for workbench navigation. A `MutationObserver` on the body class re-syncs when the mode changes. In legacy navigation the helper never sets inert.
- **When.** The sidebar (`aria-controls` of `#menu-toggle`, normally `#bottomLeft`) is inert whenever it is collapsed, as computed from `#wrapper.toggled` and the 768px breakpoint. Desktop: collapsed when toggled. Narrow: collapsed unless toggled.
- **Focus first.** If `document.activeElement` is inside the sidebar when the helper is about to set inert, focus is moved to `#menu-toggle` before the attribute is written. A browser blurs a newly inert subtree to `<body>`, so without this a keyboard user would lose their place. Focus is left alone when:
  - it is outside the sidebar, or on `<body>`;
  - the toggle is inside the sidebar, or has a `[hidden]` or `[inert]` ancestor (including itself);
  - the sidebar already had an inert value, so the helper is not the one applying it.
- **Focus the browser blurred before the viewport callback.** In real Chrome, resizing Week/Month from 1440 to 480 px applies the narrow CSS and blurs a focused sidebar control to `<body>` *before* the `MediaQueryList` change callback runs, so the check above sees `<body>` and does nothing. The helper therefore remembers the sidebar element that last received focus (the *focus owner*) and, on a collapse delivered by the media callback only, moves focus to the toggle when all of these hold:
  - `document.activeElement` is `<body>` (or null);
  - `document.hasFocus()` is true, so this frame still has focus (the top document's active element is still the iframe);
  - the focus owner is set and still inside the sidebar (a removed element is not);
  - the frame's viewport (`innerWidth`x`innerHeight`) now differs from its size when the owner was focused, and equals its size when the owner blurred to `<body>`. If no blur was seen, the current size stands in for the blur size.

  The viewport sizes tie the recovery to this transition. In Chrome the frame's viewport changes before the narrow CSS blurs the control and before the media callback runs. A blur at the same size the owner was focused at therefore cannot be the resize's blur, and a collapse at a size different from the blur's belongs to a later transition.

  The focus owner is set by a `focusin` on an element inside the sidebar while the body has `oe-clinical-workspace`. It is cleared, with no timer, by:
  - `focusin` on any element outside the sidebar (Tab, click or script moving focus to another control, including the toggle after a rescue);
  - `pointerdown`, `mousedown` or `touchstart` anywhere in the document, inside the sidebar or not (a press on a non-focusable area blurs to `<body>` on purpose);
  - a `focusout` while a `keydown` is still being dispatched (for example an Escape handler that calls `blur()`), detected from that keydown's `eventPhase`;
  - a `focusout` of the owner to `<body>` (no `relatedTarget`) while the viewport is the size it was when the owner was focused (for example a script calling `blur()` with no resize);
  - the frame's window `blur` (focus went to the parent shell, another frame, another window or the browser chrome; element blur events reaching the capturing window listener are ignored);
  - leaving workbench mode, any rescue, and `dispose()`.

  Collapses from the wrapper class or body class (the toggle button, mode changes) do not use the focus owner; they keep the synchronous check above. All seven listeners are capturing and passive, and `dispose()` removes them.
- **Re-check after the focus move.** `toggle.focus()` can synchronously run another component's focus/blur handler before the watcher exists. If inert is present once `rescueFocus()` returns, the value belongs to that component: the helper installs no watcher, writes nothing, and does not re-apply inert until the sidebar has expanded and collapsed again.
- **Restoration.** The helper only writes inert when the attribute is absent. It removes it again when the sidebar expands, when workbench mode is left, and on `dispose()` (also run on `unload`). A pre-existing `inert` value (empty or named) is never removed or rewritten. `dispose()` also restores the toggle's original `aria-expanded`, which is removed if it was absent, and disconnects the media, wrapper-class and body-class observers.
- **Ownership.** While the helper holds inert, a `MutationObserver` on the sidebar's `inert` attribute (injected as `observeInert`) watches for other writers. It exists only for that window: it is created when the helper writes inert and disconnected on expansion, mode exit or dispose. Internal writes are accounted for synchronously. Before each of its own writes the helper calls `takeRecords()` and treats any queued record as external. Straight after the write it calls `takeRecords()` again and discards its own record. Any other mutation, including a same-value `setAttribute('inert', '')`, a named value or a removal, hands the attribute over. The helper then leaves it exactly as that writer left it, and does not re-apply inert until the sidebar has expanded and collapsed again. Because queued records are drained before every write, an external write followed by a synchronous expansion or `dispose()` (before observer delivery) is still detected.
- **No watcher, no inert.** If `observeInert` is not provided, ownership cannot be tracked, so the helper never applies inert. The browser bootstrap always provides it using `window.MutationObserver`.

## Cache

The script tag in `_calendar_screen_js.html.twig` uses `?v={{ calendarSidebarVersion }}` instead of the global `assetVersion` (`v_js_includes`, a static `82` in production). `CalendarRenderDataBuilder` fills `calendarSidebarVersion` for the Day, Week and Month screen views from `ClinicalWorkspaceAssets::version('calendar-sidebar.js')`, which is the file's mtime. `calendar-sidebar.js` is added to that helper's allowed basenames. Print views do not load the script. Other calendar assets, and the global `v_js_includes`, are unchanged. The script URL path is unchanged.

## Tests

`tests/js/clinical-calendar-sidebar-lifecycle.test.js` (jsdom, real rendered calendar fixtures, original toggle handler mirrored, real jsdom `MutationObserver` as the inert watcher):

- External owner while the helper holds inert. Was RED before the fix: 5 failed, 15 passed. GREEN after (20 passed).
  - A same-value write delivered before expansion is kept, through expansion and dispose.
  - A named write followed immediately by a synchronous (media-listener) expansion, before observer delivery, is kept.
  - A same-value write followed immediately by `dispose()` is kept.
  - An external removal is not undone, and inert is not re-applied in that collapse.
  - The helper's own back-to-back writes with no delivery in between are not mistaken for an external owner, so its inert is still removed.
  - The watcher exists only while inert is held. Without a watcher, inert is never applied.

- Inert lifecycle: workbench/legacy round trips, desktop/narrow round trips, pre-existing empty/named inert kept, dispose/unload restoration.
- Focus. Was RED before the fix: 2 failed, 11 passed. GREEN after.
  - Focus on a sidebar control, then a viewport collapse. A wrapper around the sidebar's `setAttribute` records the active element synchronously at the instant inert is written, and it must already be the toggle. (A `MutationObserver` callback would only show focus at delivery time.)
  - Focus rescue when collapse comes from the wrapper class, or from entering workbench while already collapsed.
  - Unrelated focus outside the sidebar is not moved.
  - Pre-existing inert: the value and focus are both untouched.
  - A `hidden` toggle is not used as the target.
- Inert written during the focus rescue. A sidebar control is focused, and the toggle's `focus` handler writes `inert="owner"`. After collapse, then expansion and dispose (or dispose alone), the value must still be `owner`. Was RED before the re-check: 2 failed, 20 passed (the collapse overwrote it with `""`). GREEN after (22 passed).

- Stale focus after an intentional blur. A sidebar control is focused, then a script calls `blur()` with no input, no window blur and no viewport change. A later resize narrows the viewport and the media callback collapses the sidebar. A second case resizes to 900 px (still above the breakpoint) before the script blur, then narrows later. In both, focus must stay on `<body>`. Was RED before the viewport check: 2 failed, 34 passed (focus went to the toggle). GREEN after (36 passed). The native-like tests now set the frame's `innerWidth` to the narrow size *before* the emulated CSS blur and before the media fake fires, and back to wide before expansion. The keyboard case resizes before its Escape blur, so only the keyboard rule separates it from the resize's own blur. Each of these rules was removed from the helper in turn, and the matching test then failed: pointer press, keyboard, window `blur`, `hasFocus()`, same-size blur and blur-size match. The full JS suite passed: 34 suites, 601 tests.

- Focus blurred to `<body>` before the viewport callback. The browser's blur is emulated with `element.blur()` (blur/focusout with no `relatedTarget`) before the media fake fires, and `document.hasFocus()` is stubbed to report the frame's focus, because jsdom returns false whenever no element is focused. Was RED before the fix: 3 failed, 31 passed (the single collapse, repeated Week/Month collapses, and listener disposal). GREEN after (34 passed). Negative cases, each confirmed to fail when its clearing rule is removed from the helper: pointer press outside the sidebar; pointer press inside it; focus moved to another control (also when that control is later blurred); Escape handler blurring during keydown; frame not focused, and window `blur` then refocus; collapse from the wrapper class rather than the viewport; leaving workbench; and every added listener removed by `dispose()`. A removed control and post-dispose collapse are also covered.

PHP (`tests/Tests/Isolated`): `ClinicalWorkspaceAssetsTest` checks the real temp-file and shipped-file mtime for `calendar-sidebar.js`. `CalendarRenderDataBuilderTest` checks that the Day, Week and Month builders return the temp file's mtime and follow a change. `TwigTemplateRenderTest` and the three screen fixtures check that the rendered tag carries the per-file version, not `assetVersion`.

## Limits (not verified / not fixed)

- **Controller PHP verification completed.** Correctly rooted real dependencies allowed full isolated PHPUnit to pass: 5,878 tests, 14,958 assertions, with 4 warnings, 23 skips and 14 incomplete tests disclosed. PHPStan reported no errors; Rector dry-run and targeted PHPCS passed. Real metadata and Twig render tests ran without exclusions. These gates preceded the final JS-only resize-focus fix.
- **Ownership is attribute-level only.** Another writer is recognised only by mutating `inert` while the helper holds it. A component that wants the sidebar inert but did not write the attribute during that window (for example, it relies on the helper's value) is not seen, and the helper will remove inert on expansion. After a handover the helper does not reclaim inert in that collapse, so if the other writer later removes it, the collapsed sidebar stays reachable until the next collapse.
- **Controller Chrome verification completed.** The unmodified candidate script was fulfilled only in an isolated authenticated browser context against the real rendered Day/Week/Month calendar. All three views passed viewport-collapse focus rescue, same-value external ownership and synchronous focus-handler ownership preservation, real view/geometry checks, legacy/workbench activation and zero page errors. No server source or bookings were changed. This is candidate acceptance, not evidence of a deployed candidate.
- **Blur-before-callback recovery:** the controller reran the original failing Chrome predicate against the unmodified candidate; it passed in Day/Week/Month. Remaining native cases not exhaustively verified:
  - whether Chrome dispatches `blur`/`focusout` for the CSS-hidden control (the recovery does not depend on it; the keyboard rule does);
  - `document.hasFocus()` staying true in the iframe across the resize, as the harness's top-level `activeElement` suggests;
  - window `blur` firing in the iframe for every move to the shell, another frame or browser chrome (`hasFocus()` is the second guard);
  - Safari/Firefox ordering of focus fixup against the media callback, and touch/pen input.

  - the viewport-size evidence in Chrome: that the frame's `innerWidth`/`innerHeight` already show the new size when the CSS blur's `focusout` fires and when the media callback runs. The controller's strict Day/Week/Month predicate is to be rerun against this change; until then this is unverified in a real browser.

  Known gaps and ordering limits:
  - A script `blur()` that runs during an actual resize transition (after the viewport has changed but before the media callback) cannot be told apart from the browser's blur, so focus goes to the toggle.
  - A browser that drops focus from hidden content without firing `focusout` uses the current size in place of the blur size. A script blur fires `focusout`, so this does not bring back the stale-focus case.
  - If the viewport changes again between the CSS blur and the media callback, or the callback arrives at a different size than the blur (for example a resize coalesced over several sizes), no recovery happens and focus stays on `<body>`. This is the behaviour without the helper.
  - Zoom changes `innerWidth` in CSS pixels and counts as a viewport change.
  - Keyboard input that does not move focus (typing in a sidebar input) does not clear the focus owner, by design.

- **Legacy navigation is unchanged.** Outside workbench mode the collapsed legacy sidebar is moved off-screen by the theme (`margin-left: -30rem`). It is not made inert, so its controls can still be reached by keyboard while off-screen. This slice does not fix that.
- **jsdom does not implement `inert`** and does not blur focus out of inert subtrees. The tests prove the ordering (focus moves before the attribute is set) and the target. They do not prove screen-reader behaviour. Controller Chrome acceptance above separately verifies the native resize and ownership cases.
- **Visibility check is structural only.** The toggle counts as unavailable only if it has a `[hidden]` or `[inert]` ancestor. A toggle hidden purely by CSS (`display: none`, off-screen) is not detected. In that case `focus()` may fail and the browser falls back to `<body>`.
- Older browsers without `inert` support ignore the attribute. The focus move still runs.
- There is no clinical workflow, ACL, ESign or data-path change, and none was tested.
