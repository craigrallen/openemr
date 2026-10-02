/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 *
 * Regression: the obsolete "All menus" launcher button/popup is not emitted by
 * the main tabs shell, while its script stays loaded for the shared menu-tree
 * helpers that workbench_shell.js consumes.
 */
const fs = require('fs');
const path = require('path');

const mainPhp = fs.readFileSync(path.join(__dirname, '../../interface/main/tabs/main.php'), 'utf8');

test('main shell does not render the All menus launcher template', () => {
    expect(mainPhp).not.toContain('menu_launcher.html.twig');
    expect(mainPhp).not.toContain('data-oe-menu-launcher');
});

test('main shell does not mount the All menus launcher', () => {
    expect(mainPhp).not.toContain('OpenEMRMenuLauncher.create(');
    expect(mainPhp).not.toContain('menuLauncherRoot');
});

test('main shell still loads the shared menu helper script before the workbench shell', () => {
    const tabs = mainPhp.indexOf('js/tabs_view_model.js');
    const helpers = mainPhp.indexOf('js/menu_launcher.js');
    const workbench = mainPhp.indexOf('js/workbench_shell.js');
    expect(tabs).toBeGreaterThan(-1);
    expect(helpers).toBeGreaterThan(tabs);
    expect(workbench).toBeGreaterThan(helpers);
});

test('main shell keeps the legacy dropdown and mounts the workbench over the live menu', () => {
    expect(mainPhp).toContain("template: {name: 'menu-template', data: application_data}");
    const bind = mainPhp.indexOf('ko.applyBindings(app_view_model);');
    const create = mainPhp.indexOf('OpenEMRWorkbenchShell.create(');
    expect(bind).toBeGreaterThan(-1);
    expect(create).toBeGreaterThan(bind);
    expect(mainPhp.slice(create, create + 300)).toContain('menu: app_view_model.application_data.menu');
});
