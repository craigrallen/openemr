# Patient workspace restyle

The Patient Finder, Medical Record Dashboard, and existing SOAP form load `interface/clinical-workspace/workspace.css` and `mode.js` from their own pages. No shell or global header asset is required.

`mode.js` adds `oe-clinical-workspace` to the route body only while a same-origin parent body has `workbench-active`. It observes parent class changes so the legacy switch takes effect immediately, and disconnects on unload. A direct page or cross-origin frame keeps its original theme. The controller also accepts an explicit `mode: 'workbench'` argument for a host that intentionally renders an isolated route.

The CSS is scoped by both `oe-clinical-workspace` and the route class. It presents the existing patient list with compact rows and horizontal scrolling on narrow screens, the dashboard's existing cards and actions with quieter spacing, and the existing SOAP fields as a readable document. It does not change patient data, hide dashboard sections, add clinical calculations, or replace save and cancel behavior.

Run `node_modules/.bin/jest tests/js/clinical-workspace.test.js --runInBand` for mode switching and draft preservation checks. The route markup and CSS should be reviewed in a running OpenEMR instance with real permissions and records, including an active alert, expanded dashboard cards, Finder search, and a partially written SOAP note before switching modes.
