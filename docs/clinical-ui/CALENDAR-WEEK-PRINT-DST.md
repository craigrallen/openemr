# Native week print: four calendar days across DST

The native week print render-data builder pairs each left date with the date four days later. Its previous calculation added `4 * 86400` seconds to local midnight. When daylight saving time ends, those elapsed seconds can land at 23:00 on the preceding civil date. The right heading and event lookup then use the wrong day. The supplied controller RED run recorded 10 cases: 8 passed and the Europe/Stockholm and America/New_York fall-back cases failed at the first right heading.

The builder now applies `+4 days` in the active PHP timezone. The existing `strtotime` failure path still produces an empty date and a null right pair for invalid input. The same date key drives the right heading and provider-filtered events. The four-row cap, left headings, event identity, and missing-right-date behavior are unchanged.

The standalone `tests/clinical-ui/calendar-week-print-dst.php.fixture` exercises the native `CalendarRenderDataBuilder` with synthetic events. It provides only the escaping functions needed by the event decorator. Its 10 cases cover fall-back and spring-forward weeks in Stockholm and New York, UTC, leap day, month and year rollover, the four-row cap, a missing right date, and invalid-date fallback. The supplied RED run preceded the product change; a passing run after the change is the GREEN check.

This harness does not exercise an actual PHP route, authentication, HTML print output, a browser, persistence, security controls, or clinical acceptance. Ordinary approval and the full CI suite remain required before merge or deployment. The standalone result does not establish completion of the original 22 features, UI behavior, or Swedish clinical acceptance.
