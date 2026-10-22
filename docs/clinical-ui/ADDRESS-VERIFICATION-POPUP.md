# Address Verification popup (OPEMR-20)

Route: `interface/practice/address_verify.php`. Contract:
`tests/js/address-verification-popup.test.js`, frozen original route fixture
`tests/clinical-ui/fixtures/address-verification-popup-original.txt`.

## Scope

Source-only partial palette. This is **not** full researched fidelity, native
fit, or a security clearance.

Production change, and nothing else:

- Route: two sorted imports (`ClinicalWorkspaceAssets`, `OEGlobalsBag`); one
  escaped, versioned `media="screen"` link to
  `interface/clinical-workspace/address-verification-popup.css` directly after
  `Header::setupHeader([], false)`; `oe-address-verification-screen` appended
  to the existing `text-left` body (no `body_top`) and
  `oe-address-verification-document` appended to the single container.
- Stylesheet: exactly two `html.oe-workbench-context`-scoped rules, canvas plus
  ink on the body hook and paper plus ink on the document hook, using the
  `popup.css` token fallbacks. No `!important`, no geometry, fonts, wrappers,
  focus rules, JS, backend or provider change.
- `ClinicalWorkspaceAssets::SUPPORTED`: one sorted entry,
  `address-verification-popup.css`, at the head of the list.

Preserved byte for byte: `verify()` call, the `isConfigured()` guard, all six
`$_GET` mappings and `?? ''` defaults, `strcasecmp` with `(string)` casts,
error and success handling, `text()` escaping, the `text-danger` /
`text-success` semantic classes (their own paint is untouched), the never
closed `<p>`, and the original closing output. Undoing the four permitted
additions restores the original route exactly.

## Caller (unchanged)

`interface/patient_file/summary/demographics_full.php` lines 289–308:
`address_verify()` calls `top.restoreSession()`, builds six `URLSearchParams`
(address1, address2, city, state, zip4, zip5) and opens a 400x150 `dlgopen`.

## Safety boundary

A GET to this route can contact USPS, and the `USPSAddressVerifyV3`
constructor decrypts stored credentials. No live application GET or POST,
credential read, provider contact or configuration change was made or is
authorised by this work.

## Status

- RED (actual): hosted tests-only run at
  `fcdfa6434c799fd450d824145f0bdeb547de72f4`, job 38995239688 — 4 intended
  missing-production failures (route restore, route contract, helper,
  stylesheet); 1272 passed across 62 suites. All positive, synthetic negative
  and source-anchor tests passed.
- GREEN: pending. Not run locally; awaits the hosted run on the production
  commit.

## Awaiting QA (not claimed)

Actual PHP render; workbench context activation; compiled default, dark and
solar themes; `text-danger` / `text-success` contrast on the new backdrop;
keyboard and dialog-frame close; initial, resized and narrow frames; RTL,
print and roles; real provider behaviour.

Ordinary approval is still required. Original 22-item, demo, full-popup and
Swedish reviews remain open.
