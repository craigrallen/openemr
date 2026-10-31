# Calendar patient picker keyboard selection

The calendar appointment editor opens `find_patient_popup.php` as its patient picker. Each result remains a seven-column table row. The Name cell now contains a native button so keyboard users can focus and choose a patient. The button uses the existing escaped display name; the billing note remains in the Name cell below it.

Mouse and assistive-technology clicks on the button bubble to the existing row click handler. Enter and Space on the button use the containing result row and the same `SelectPatient` path. The keydown handler prevents native duplicate activation and Space scrolling. Repeated or modified Enter/Space does not select; other keys keep their normal behavior. The row ID and its existing tilde-delimited `selpid` payload remain unchanged.

Run `node --test tests/clinical-ui/calendar-patient-picker-keyboard-contract.cjs` and `php -l interface/main/calendar/find_patient_popup.php` for local verification. The portable Node contract executes the popup's complete inline script in `node:vm` with synthetic jQuery, DOM, and opener doubles. It substitutes only PHP-generated translation and date-picker snippets, then exercises registered ready handlers, selection, suppression, and empty results. The Jest adapter runs that portable contract when the repository's Jest suite is available.

These checks do not exercise an actual browser, PHP rendering or bootstrap, authenticated lookup, a database, assistive technology, or clinical acceptance. Existing null-opener behavior and tilde-delimited payload limitations remain. No UI screenshot or visual-fidelity claim is made.
