# Order Summary (order manifest) as a workbench document

`interface/orders/order_manifest.php` renders the Order Summary for a procedure
order before it is processed: an information table, the procedure list with
per-row "omit" checkboxes, and three submit actions (save omission selections,
show all procedures, show only procedures not omitted).

This change is a screen-only presentation adaptation of that one route. It is a
source slice with static tests. It is not native, translated, role or deployed
acceptance, and it makes no clinical-validity claim.

## Callers and how the window opens

Two callers open the route, and neither is changed:

- `interface/orders/list_reports.php`
- `interface/orders/single_order_results.inc.php`

Both use a plain `target=_blank` link (`target='_blank'` with
`onclick='top.restoreSession()'`). There is no `rel` attribute, no `dlgopen` and
no `window.open`.

Current browsers treat a `target=_blank` link without `rel` as `noopener`. The
new tab therefore has no `window.opener`. The shared `popup.js` controller finds
the workbench only through the parent/opener chain, so on its own it never marks
this tab. Without a route-local step the presentation would never apply.

## Activation

Two paths can mark `<html>` with the shared `oe-workbench-context` class. The
stylesheet applies only under `html.oe-workbench-context body.oe-order-manifest`.

1. **Opener retained** (a browser or caller that keeps `opener`, or a framed
   load). The shared `popup.js` controller decides as it does for every popup. It
   sets `oe-workbench-context` and `oe-workbench-popup` only when the opener's
   shell is in workbench mode. The route bootstrap does nothing in this case: it
   returns before reading storage or adding listeners.
2. **Implicit `noopener` tab** (the expected case for both callers). A small
   inline `<script data-order-manifest-mode>` in the route `<head>` reads the
   existing same-origin `localStorage` key `openemr.navigation.mode`. The shell
   uses the same rule in `interface/main/tabs/main.php`: only the exact value
   `legacy` is legacy, and a missing or other value means workbench.
   - Workbench: it adds `oe-workbench-context` only. It never adds
     `oe-workbench-popup`, so the shared popup body font and the popup `.table`
     and `.btn-primary` repaints do not reach a standalone tab. The route keeps
     its own font.
   - Legacy: it adds nothing.
   - **Storage denial fails closed.** If reading `localStorage` throws (for
     example, a blocked storage getter or `getItem`), the tab stays legacy. This
     is deliberately stricter than the shell, which falls back to workbench.
   - It listens for `storage` events for that key, and for a clear (`key` is
     `null`), so a mode change in the shell tab updates this tab. Other keys are
     ignored without reading storage.
   - On `pagehide` it removes its storage listener and any class it added. A
     back/forward-cache restore (`pageshow` with `persisted`) re-reads the mode
     once.
   - It never removes a context class it did not add. It never writes storage,
     sets `opener`, navigates, fetches, or touches forms, inputs or callers.

The bootstrap adapts presentation to a saved preference. It is not an
authorization or security control, and it does not change who can open the
route or what the route does.

## Presentation

`interface/clinical-workspace/order-manifest-popup.css` is linked once, with
`media="screen"`, directly after `Header::setupHeader()`. It is versioned by
`ClinicalWorkspaceAssets::version('order-manifest-popup.css')`. Every rule sits
inside one `@media screen` block under the scope above.

- The body becomes an ink/canvas pair, and the original `<form>` becomes an
  ink/paper sheet with a line-token border, radius and padding.
- `.ordsum` table, cell and header borders use the shared line token.
- Only two table elements are repainted, each as an ink/canvas pair: the
  `.table-active` information table itself (`.ordsum > table.table-active`) and
  the plain header row (`tr.head`). Canvas rather than paper keeps the
  information table visibly distinct from the sheet it sits on.
- No cell, checkbox or button is repainted, and the procedure table and its
  inline pink/blue row stripes keep their original theme and inline paint.

### Resolved: introduced information-table ink

An earlier revision of this change made the form a white paper sheet but left
the information table alone. That was an introduced defect, not an inherited
one. Bootstrap gives `.table` its own explicit ink and `.table-active` only a
translucent tint. Under the dark theme (`style_dark.scss` inverts the greys) that
ink is near-white and the tint is a faint white wash. Before this change that
table sat on the theme's black body. With the new paper sheet behind it, it
would show near-white text on white. Ink set on the form cannot fix this,
because the table's own `color` wins over inherited ink.

The fix pairs ink and canvas on the table element only. Cells inherit both, so
no cell rule is needed and the procedure table is untouched. The test suite
checks this with a synthetic cascade fixture (dark-theme-shaped `.table` ink and
`.table-active` tint, then `popup.css` and this sheet). It shows the defect
without the sheet and the route-owned pair with it, and it fails if either the
table foreground or background is removed. That is a cascade regression over
the fixture's declarations only. It is not a compiled-theme, native or contrast
result.
- The original `.btn-group` may wrap whole buttons onto a new line. Labels,
  whitespace and button styling are unchanged.
- Separate `:focus` (fallback) and `:focus-visible` rules give the three actions
  and the omit checkboxes a 2px petrol outline. They are kept apart so a browser
  without `:focus-visible` still applies the fallback.
- The sheet sets no fonts, sizes, margins, hiding, overflow, `white-space` or
  checkbox appearance, and no `!important`.

## What is unchanged

The route is the original file plus three insertions. The test suite reverses
them and checks the whole file against the baseline SHA-256. The insertions are:
the `ClinicalWorkspaceAssets` import, the stylesheet link with the mode bootstrap,
and `class="oe-order-manifest"` on `<body>`.

Unchanged: the patients/med ACL check and denial template, `orderid` parsing,
both omission `UPDATE` statements and their bindings, the sendable filter and
ordering, checkbox names and checked state, every escaping call, the three
action names and translated labels, `d-print-none`, the `table-responsive`
scroller, the route `<style>` with its body margin, font and print block, and the
translated title. Both callers and the shared `popup.js` and `popup.css` are
byte-identical.

## Inherited gap: no explicit route CSRF check

The route checks the patients/med ACL, but it does not verify a CSRF token on
its POST (the save action updates `procedure_order_code.do_not_send`). That gap
is inherited from the original route. This change neither adds nor removes any
request handling and does not address it.

## Source-only limitations and open gates

These were checked only against source and synthetic fixtures (Jest with jsdom
and postcss). None was exercised in a real browser, against a running
application or against live data.

- **Activation:** the `noopener` behaviour and the bootstrap were tested with
  synthetic windows and storage, not in native browsers or browser
  storage-partitioning modes.
- **Contrast:** pairs are checked only against the nominal `popup.css` token
  values. Effective contrast in compiled themes is not assessed. The introduced
  information-table ink is resolved at the cascade level (see above), but its
  compiled and native rendering is still unchecked. The inherited procedure-row
  stripes keep their original inline pale backgrounds with the theme `.table`
  ink, which is near-white under the dark theme. This change neither introduces
  nor fixes that pairing; it was already so on the original route. Both need a
  native compiled-theme check before any contrast statement.
- **Keyboard:** focus outlines are declared, but focus order and visibility were
  not checked natively.
- **Narrow screens:** the original responsive scroller is kept and actions may
  wrap. Narrow-screen scrolling and native label fit are not verified.
- **Translation:** long translated labels and their fit are not verified.
- **RTL:** right-to-left layout is not verified.
- **Print:** the sheet is screen-only and the route print block is unchanged.
  Print output was not checked natively.
- **Legacy:** legacy mode should render as the original route. This was checked
  only by scoping tests.
- **Opener:** retained-opener activation relies on the shared controller and was
  checked only with synthetic windows.
- **Save:** the save flow is unchanged in source. It was not exercised.
- **Role:** real-role ACL behaviour was not exercised.
- **Deployment and approval:** nothing here authorizes merge or deployment. That
  requires independent review, exact-head CI and the usual approval.
