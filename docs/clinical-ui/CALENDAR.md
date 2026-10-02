# Calendar workbench restyle

## Route

The Calendar menu entry opens `interface/main/main_info.php`, which redirects to `interface/main/calendar/index.php?module=PostCalendar&func=view` with the session view type and selected providers. `pnuserapi.php` renders the legacy PostCalendar screens through Twig: `templates/calendar/default/views/{day,week,month}/ajax_template.html.twig`. Each of those includes `views/header.html.twig`, and so does the appointment search page (`user/ajax_search.html.twig`). FullCalendar is not used on this route. Theme styling comes from `interface/themes/ajax_calendar_sass.scss` (part of the main theme) and an inline `<style>` in `_calendar_screen_js.html.twig`.

## What changed

`header.html.twig` now loads:

- the shared `interface/clinical-workspace/mode.js` (unchanged), and
- the new `interface/clinical-workspace/calendar.css`.

Both load from `webroot`, so they are same-origin. The body also gets the route class `oe-clinical-calendar`. `mode.js` adds `oe-clinical-workspace` only while a same-origin ancestor body has `workbench-active`, and removes it when the legacy navigation is selected. Every rule in `calendar.css` is scoped to `body.oe-clinical-workspace.oe-clinical-calendar`, so it does nothing on these pages:

- a calendar opened directly,
- a calendar inside the legacy tabs, and
- the print views (`*_print/outlook_ajax_template.html.twig`), which do not include the header.

Inside the workbench, the stylesheet restyles these areas in the light/petrol palette:

- the toolbar: new/search/today buttons, sidebar toggle, date navigation and chevrons, print/refresh buttons, and the Day/Week/Month picker with `.currentview` kept as a 2px border,
- the mini calendar,
- the provider and facility selects,
- the provider column headers, time labels, today's week header, and the booking surface background.

## What did not change

The stylesheet does not set colour, background or a `!important` rule on:

- events (`.event`, `.event_*`, `.month_event`, `.in_start`, `.apptMarker`),
- facility colour bars (`#facilityColor`),
- holiday cells or labels,
- coloured text inside events.

The only `!important` rules are the provider header text and its close control (`.providerheader`, `.providerheader .providerXbtn`). Dark and solar themes force those dark with `!important` in `ajax_calendar_sass.scss`, which would leave them unreadable (about 2.4:1) on the petrol header, so they are forced white instead. The outer unselect-all `.providerXbtn` in the time column is not on petrol and keeps its theme colour.

So category colours (inline `background-color`), the other-facility grey, no-show strikethrough, status text and facility colours all render exactly as before.

It also does not change any height, padding, margin, border width, font size, position or display on:

- slot rows (`.timeslot`, `#times`),
- `td.schedule` and `.calendar_day`,
- events,
- the day-view provider header,
- the toolbar, which the fixed `#bottomLeft` sidebar's `top` offset is aligned to.

Event `top`/`height` (20px per slot) and the click-to-book marker math in `library/js/calendarDirectSelect.js` therefore stay aligned. No controls are hidden.

There are no changes to PHP, JavaScript behaviour, ACLs, queries, providers/facilities filtering, recurrence, status, the add/edit event popup, or any link. This route has no drag-to-reschedule code; rescheduling still goes through the existing event editor.

## Tests

- `node_modules/.bin/jest tests/js/clinical-calendar.test.js --runInBand` checks:
  - the header loader and route class, and that the rendered day/week/month fixtures contain them,
  - print fixtures stay free of them,
  - the mode switch on the real day/week fixture markup, including the direct-page fallback,
  - parsed `calendar.css` rules: scoping, no clinical-colour painting, no slot/event/toolbar/provider-header geometry, and nothing hidden.
- `composer update-twig-fixtures` regenerated the three screen fixtures. `TwigTemplateRenderTest` covers them.

Visual review still needs a running instance with real providers, categories, recurring and no-show appointments, multiple facilities, and both navigation modes.
