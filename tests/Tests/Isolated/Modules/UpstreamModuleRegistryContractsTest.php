<?php

/**
 * Regression coverage for the public contracts of the inherited zend module
 * tables whose signatures were tightened upstream: Installer's InstModuleTable
 * (module registry, settings, ACL, hooks, dependency and nickname checks) and
 * Syndromicsurveillance's SyndromicsurveillanceTable (provider selection,
 * reportable-code filter, pagination and date conversion).
 *
 * The real, unchanged module classes are loaded through the same Laminas
 * StandardAutoloader namespace mapping their Module::getAutoloaderConfig()
 * declares. Every test runs in its own child process so that
 * ModuleRegistryQueryDouble can be aliased over QueryUtils before the real
 * class loads; the aliased double records each exact query and bind list and
 * returns synthetic unit-test rows, never clinical or live database data.
 * Dependency checks read the real Carecoordination/Installer
 * module.config.php files from the repository.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen <craig@interconnected.au>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\Modules;

use Installer\Model\InstModule;
use Installer\Model\InstModuleTable;
use Laminas\Loader\StandardAutoloader;
use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Core\OEGlobalsBag;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\PreserveGlobalState;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use Psr\Container\NotFoundExceptionInterface;
use RuntimeException;
use Syndromicsurveillance\Model\SyndromicsurveillanceTable;

#[Group('isolated')]
#[Group('modules')]
#[RunTestsInSeparateProcesses]
#[PreserveGlobalState(false)]
final class UpstreamModuleRegistryContractsTest extends TestCase
{
    private const INSTALLED_SQL = 'select * from modules where mod_active = 1 order by mod_ui_order asc';
    private const MODULE_DIRECTORY_SQL = 'SELECT mod_directory FROM modules WHERE mod_id = ?';
    private const MODULE_STATUS_SQL = 'SELECT mod_active,mod_directory FROM modules WHERE mod_directory = ?';

    protected function setUp(): void
    {
        // Must precede any QueryUtils autoload in this child process.
        self::assertFalse(class_exists(QueryUtils::class, false), 'QueryUtils must remain unloaded in this isolated child process');
        self::assertTrue(class_alias(ModuleRegistryQueryDouble::class, QueryUtils::class));
        ModuleRegistryQueryDouble::reset();

        $moduleRoot = dirname(__DIR__, 4) . '/interface/modules/zend_modules/module';
        $loader = new StandardAutoloader(['namespaces' => [
            'Installer' => $moduleRoot . '/Installer/src/Installer',
            'Syndromicsurveillance' => $moduleRoot . '/Syndromicsurveillance/src/Syndromicsurveillance',
        ]]);
        $loader->register();

        // Mirrors the production globals InstModuleTable derives its zend
        // module path from (srcdir/../interface/modules/zend_modules/module).
        $globals = OEGlobalsBag::getInstance();
        $globals->set('srcdir', dirname(__DIR__, 4) . '/library');
        $globals->set('baseModDir', 'interface/modules/');
        $globals->set('zendModDir', 'zend_modules');
    }

    public function testInstalledModulesMapActiveRegistryRowsInUiOrderAndEmptyRegistryIsEmptyList(): void
    {
        ModuleRegistryQueryDouble::on(self::INSTALLED_SQL, [], []);
        $emptyRegistry = $this->installer();
        self::assertSame([], $emptyRegistry->getInstalledModules(), 'an empty registry has no installed modules');

        ModuleRegistryQueryDouble::on(self::INSTALLED_SQL, [], [
            ['mod_id' => 7, 'mod_directory' => 'Ccr', 'mod_nick_name' => 'ccr', 'mod_ui_order' => 1, 'mod_active' => 1, 'sql_version' => '1.0'],
            ['mod_id' => 42, 'mod_directory' => 'Carecoordination', 'mod_nick_name' => 'cc', 'mod_ui_order' => 2, 'mod_active' => 1, 'type' => 1],
        ]);
        $populatedRegistry = $this->installer();
        $modules = $populatedRegistry->getInstalledModules();

        self::assertCount(2, $modules);
        self::assertContainsOnlyInstancesOf(InstModule::class, $modules);
        self::assertSame([7, 42], array_map(static fn (InstModule $m): mixed => $m->modId, $modules));
        self::assertSame(['Ccr', 'Carecoordination'], array_map(static fn (InstModule $m): mixed => $m->modDirectory, $modules));
        self::assertSame('ccr', $modules[0]->modnickname);
        self::assertSame('1.0', $modules[0]->sql_version);
        self::assertNull($modules[0]->type, 'columns absent from the row stay null');
        self::assertSame(1, $modules[1]->type);
        self::assertSame([
            ['fetchRecords', self::INSTALLED_SQL, []],
            ['fetchRecords', self::INSTALLED_SQL, []],
        ], ModuleRegistryQueryDouble::calls());
    }

    public function testRegistryEntryBindsModuleIdAndMissingModuleYieldsEmptyEntry(): void
    {
        $sql = 'SELECT mod_directory, sql_version, acl_version,type FROM modules WHERE mod_id = ?';
        ModuleRegistryQueryDouble::on($sql, [42], [
            ['mod_directory' => 'Carecoordination', 'sql_version' => '2.1', 'acl_version' => '0.3', 'type' => 1],
        ]);
        ModuleRegistryQueryDouble::on($sql, [99], []);
        $table = $this->installer();

        $entry = $table->getRegistryEntry(42);
        self::assertSame('Carecoordination', $entry->modDirectory);
        self::assertSame('Carecoordination', $entry->mod_directory);
        self::assertSame('2.1', $entry->sql_version);
        self::assertSame('0.3', $entry->acl_version);
        self::assertSame(1, $entry->type);
        self::assertNull($entry->modId, 'the registry entry query does not select mod_id');

        $missing = $table->getRegistryEntry(99);
        self::assertNull($missing->modDirectory);
        self::assertNull($missing->sql_version);
        self::assertSame([['fetchRecords', $sql, [42]], ['fetchRecords', $sql, [99]]], ModuleRegistryQueryDouble::calls());
    }

    public function testUnregisterDeletesOnlyTheBoundModuleAndReportsFailureForMissingIdOrStatementError(): void
    {
        $table = $this->installer();
        $sql = 'DELETE FROM modules WHERE mod_id = ?';

        self::assertSame('success', $table->unRegister(42));
        self::assertSame([['sqlStatementThrowException', $sql, [42]]], ModuleRegistryQueryDouble::calls());

        ModuleRegistryQueryDouble::forgetCalls();
        self::assertSame('failure', $table->unRegister(0));
        self::assertSame([], ModuleRegistryQueryDouble::calls(), 'a zero id never reaches the DELETE');

        ModuleRegistryQueryDouble::$failStatements = true;
        self::assertSame('failure', $table->unRegister(42));
        self::assertSame([['sqlStatementThrowException', $sql, [42]]], ModuleRegistryQueryDouble::calls());
    }

    public function testSettingsMapAclHooksAndOtherTypesToFieldTypeBindsAndReturnInstModules(): void
    {
        $sql = 'SELECT ms.*,mod_directory FROM modules_settings AS ms LEFT OUTER JOIN modules AS m ON ms.mod_id=m.mod_id WHERE m.mod_id=? AND fld_type=?';
        ModuleRegistryQueryDouble::on($sql, [42, 1], [
            ['mod_id' => 42, 'fld_type' => 1, 'obj_name' => 'carecoordination', 'menu_name' => 'Care Coordination', 'mod_directory' => 'Carecoordination'],
        ]);
        ModuleRegistryQueryDouble::on($sql, [42, 3], [
            ['mod_id' => 42, 'fld_type' => 3, 'obj_name' => 'ccd_hook', 'menu_name' => 'CCD', 'mod_directory' => 'Carecoordination'],
            ['mod_id' => 42, 'fld_type' => 3, 'obj_name' => 'ccr_hook', 'menu_name' => 'CCR', 'mod_directory' => 'Carecoordination'],
        ]);
        ModuleRegistryQueryDouble::on($sql, [42, 2], []);
        $table = $this->installer();

        $acl = $table->getSettings('ACL', 42);
        self::assertCount(1, $acl);
        self::assertSame('carecoordination', $acl[0]->obj_name);
        self::assertSame('Carecoordination', $acl[0]->mod_directory);

        $hooks = $table->getSettings('Hooks', 42);
        self::assertSame(['ccd_hook', 'ccr_hook'], array_map(static fn (InstModule $m): mixed => $m->obj_name, $hooks));
        self::assertSame(['CCD', 'CCR'], array_map(static fn (InstModule $m): mixed => $m->menu_name, $hooks));

        self::assertSame([], $table->getSettings('Preferences', 42), 'any other settings type queries fld_type 2');
        self::assertSame([], $table->getSettings('acl', 42), 'type names are case-sensitive and fall back to fld_type 2');
        self::assertSame([[42, 1], [42, 3], [42, 2], [42, 2]], ModuleRegistryQueryDouble::binds());
    }

    public function testUserGroupsAndGroupUserMapAreGroupedByGroupThenUserId(): void
    {
        $groupSql = 'SELECT * FROM gacl_aro_groups AS gag LEFT OUTER JOIN gacl_groups_aro_map AS ggam ON gag.id=ggam.group_id WHERE parent_id<>0 AND group_id IS NOT NULL GROUP BY id';
        $mapSql = "SELECT group_id,u.id AS id,CONCAT_WS(' ',CONCAT_WS(',',u.lname,u.fname),u.mname) AS user,u.username FROM gacl_aro_groups gag LEFT OUTER JOIN gacl_groups_aro_map AS ggam ON gag.id=ggam.group_id LEFT OUTER JOIN gacl_aro AS ga ON ggam.aro_id=ga.id LEFT OUTER JOIN users AS u ON u.username=ga.value WHERE group_id IS NOT NULL ORDER BY gag.id";
        ModuleRegistryQueryDouble::on($groupSql, [], []);
        ModuleRegistryQueryDouble::on($mapSql, [], []);
        $empty = $this->installer();
        self::assertSame([], $empty->getOemrUserGroup());
        self::assertSame([], $empty->getOemrUserGroupAroMap());

        ModuleRegistryQueryDouble::on($groupSql, [], [
            ['id' => 11, 'name' => 'Administrators', 'group_id' => 11],
            ['id' => 13, 'name' => 'Clinicians', 'group_id' => 13],
        ]);
        ModuleRegistryQueryDouble::on($mapSql, [], [
            ['group_id' => 11, 'id' => 1, 'user' => 'Admin,Test ', 'username' => 'admin'],
            ['group_id' => 13, 'id' => 4, 'user' => 'Doe,Jan Q', 'username' => 'jdoe'],
            ['group_id' => 13, 'id' => 5, 'user' => 'Roe,Ric ', 'username' => 'rroe'],
            ['group_id' => 13, 'id' => 4, 'user' => 'Doe,Jan Q.', 'username' => 'jdoe'],
        ]);
        $table = $this->installer();

        $groups = $table->getOemrUserGroup();
        self::assertSame(['Administrators', 'Clinicians'], array_map(static fn (InstModule $m): mixed => $m->name, $groups));
        self::assertSame([11, 13], array_map(static fn (InstModule $m): mixed => $m->group_id, $groups));

        self::assertSame([
            11 => [1 => 'Admin,Test '],
            13 => [4 => 'Doe,Jan Q.', 5 => 'Roe,Ric '],
        ], $table->getOemrUserGroupAroMap(), 'a user mapped twice to one group collapses to its last row');
        self::assertSame([$groupSql, $mapSql, $groupSql, $mapSql], array_column(ModuleRegistryQueryDouble::calls(), 1));
    }

    public function testActiveUsersAreKeyedByUsernameAndTabSettingsCountsAreKeyedByFieldType(): void
    {
        $usersSql = "SELECT id,username,CONCAT_WS(' ',fname,mname,lname) AS USER FROM users WHERE active=1 AND username IS NOT NULL AND username<>''";
        $tabSql = 'SELECT fld_type,COUNT(*) AS cnt FROM modules_settings WHERE mod_id=? GROUP BY fld_type ORDER BY fld_type';
        ModuleRegistryQueryDouble::on($usersSql, [], [
            ['id' => 1, 'username' => 'admin', 'USER' => 'Test  Admin'],
            ['id' => 4, 'username' => 'jdoe', 'USER' => 'Jan Q Doe'],
        ]);
        ModuleRegistryQueryDouble::on($tabSql, [42], [
            ['fld_type' => 1, 'cnt' => 1],
            ['fld_type' => 3, 'cnt' => 2],
        ]);
        ModuleRegistryQueryDouble::on($tabSql, [43], []);
        $table = $this->installer();

        self::assertSame(['admin' => 'Test  Admin', 'jdoe' => 'Jan Q Doe'], $table->getActiveUsers());
        self::assertSame([1 => 1, 3 => 2], $table->getTabSettings(42));
        self::assertSame([], $table->getTabSettings(43), 'a module without settings has no tabs');
        self::assertSame([
            ['fetchRecords', $usersSql, []],
            ['fetchRecords', $tabSql, [42]],
            ['fetchRecords', $tabSql, [43]],
        ], ModuleRegistryQueryDouble::calls());
    }

    public function testActiveAclResolvesModuleAcoSectionAndGroupsActiveUsersPerAcoValue(): void
    {
        $acoSql = 'SELECT * FROM gacl_aco_map WHERE section_value=?';
        $aroSql = "SELECT acl_id,value,CONCAT_WS(' ',fname,mname,lname) AS user FROM gacl_aro_map LEFT OUTER JOIN users ON value=username WHERE active=1 AND acl_id=?";
        ModuleRegistryQueryDouble::on('SELECT mod_directory FROM modules WHERE mod_id=?', [42], [['mod_directory' => 'Carecoordination']]);
        ModuleRegistryQueryDouble::on($acoSql, ['modules_Carecoordination'], [
            ['acl_id' => 501, 'section_value' => 'modules_Carecoordination', 'value' => 'view'],
            ['acl_id' => 502, 'section_value' => 'modules_Carecoordination', 'value' => 'write'],
            ['acl_id' => 503, 'section_value' => 'modules_Carecoordination', 'value' => 'view'],
        ]);
        ModuleRegistryQueryDouble::on($aroSql, [501], [
            ['acl_id' => 501, 'value' => 'admin', 'user' => 'Test Admin'],
            ['acl_id' => 501, 'value' => 'jdoe', 'user' => 'Jan Doe'],
        ]);
        ModuleRegistryQueryDouble::on($aroSql, [503], [
            ['acl_id' => 503, 'value' => 'rroe', 'user' => 'Ric Roe'],
        ]);
        ModuleRegistryQueryDouble::on($aroSql, [502], []);
        ModuleRegistryQueryDouble::on('SELECT mod_directory FROM modules WHERE mod_id=?', [99], []);
        ModuleRegistryQueryDouble::on($acoSql, ['modules_'], []);
        $table = $this->installer();

        self::assertSame([
            // A later ACL with the same ACO value restarts its index and overwrites slot 0.
            'view' => [
                ['acl_id' => 503, 'value' => 'rroe', 'user' => 'Ric Roe'],
                ['acl_id' => 501, 'value' => 'jdoe', 'user' => 'Jan Doe'],
            ],
        ], $table->getActiveACL(42), 'ACLs without active users (502) contribute nothing');
        self::assertSame(
            [[42], ['modules_Carecoordination'], [501], [502], [503]],
            ModuleRegistryQueryDouble::binds(),
        );

        ModuleRegistryQueryDouble::forgetCalls();
        self::assertSame([], $table->getActiveACL(99));
        self::assertSame([[99], ['modules_']], ModuleRegistryQueryDouble::binds(), 'unknown module falls back to the bare modules_ section');
    }

    public function testActiveHooksAreLimitedToActiveModuleHookSettingsForTheBoundModule(): void
    {
        $sql = "SELECT msh.*,ms.menu_name FROM modules_hooks_settings AS msh LEFT OUTER JOIN modules_settings AS ms ON obj_name=enabled_hooks AND ms.mod_id=msh.mod_id LEFT OUTER JOIN modules AS m ON msh.mod_id=m.mod_id WHERE fld_type = '3' AND mod_active = 1 AND msh.mod_id = ?";
        ModuleRegistryQueryDouble::on($sql, [42], [
            ['id' => 9, 'mod_id' => 42, 'enabled_hooks' => 'ccd_hook', 'attached_to' => 'encounter', 'menu_name' => 'CCD'],
            ['id' => 10, 'mod_id' => 42, 'enabled_hooks' => 'ccd_hook', 'attached_to' => 'demographics', 'menu_name' => 'CCD'],
        ]);
        ModuleRegistryQueryDouble::on($sql, [43], []);
        $table = $this->installer();

        $hooks = $table->getActiveHooks(42);
        self::assertContainsOnlyInstancesOf(InstModule::class, $hooks);
        self::assertSame(['encounter', 'demographics'], array_map(static fn (InstModule $m): mixed => $m->attached_to, $hooks));
        self::assertSame([9, 10], array_map(static fn (InstModule $m): mixed => $m->id, $hooks));
        self::assertSame('ccd_hook', $hooks[1]->enabled_hooks);
        self::assertSame([], $table->getActiveHooks(43));
        self::assertSame([['fetchRecords', $sql, [42]], ['fetchRecords', $sql, [43]]], ModuleRegistryQueryDouble::calls());
    }

    public function testHookExistenceAndModuleStatusLookupsReturnSourceStatusStrings(): void
    {
        $hookSql = "SELECT obj_name FROM modules_settings WHERE mod_id = ? AND fld_type = '3' AND obj_name = ?";
        ModuleRegistryQueryDouble::on($hookSql, [42, 'ccd_hook'], [['obj_name' => 'ccd_hook']]);
        ModuleRegistryQueryDouble::on($hookSql, [42, 'blank_hook'], [['obj_name' => '']]);
        ModuleRegistryQueryDouble::on(self::MODULE_STATUS_SQL, ['Ccr'], [['mod_active' => 1, 'mod_directory' => 'Ccr']]);
        ModuleRegistryQueryDouble::on(self::MODULE_STATUS_SQL, ['Immunization'], [['mod_active' => '0', 'mod_directory' => 'Immunization']]);
        ModuleRegistryQueryDouble::on($hookSql, [43, 'ccd_hook'], []);
        ModuleRegistryQueryDouble::on(self::MODULE_STATUS_SQL, ['Syndromicsurveillance'], []);
        $table = $this->installer();

        self::assertSame('1', $table->checkModuleHookExists(42, 'ccd_hook'));
        self::assertSame('0', $table->checkModuleHookExists(42, 'blank_hook'), 'an empty obj_name is not a registered hook');
        self::assertSame('0', $table->checkModuleHookExists(43, 'ccd_hook'), 'hook names are scoped to their module');

        self::assertSame('Enabled', $table->getModuleStatusByDirectoryName("  Ccr\n"));
        self::assertSame('Disabled', $table->getModuleStatusByDirectoryName('Immunization'));
        self::assertSame('Missing', $table->getModuleStatusByDirectoryName('Syndromicsurveillance'));
        self::assertSame(
            [[42, 'ccd_hook'], [42, 'blank_hook'], [43, 'ccd_hook'], ['Ccr'], ['Immunization'], ['Syndromicsurveillance']],
            ModuleRegistryQueryDouble::binds(),
            'module directories are trimmed before binding',
        );
    }

    public function testNicknameValidationCountsExistingHoldersOfTheExactBoundNickname(): void
    {
        $sql = 'SELECT * FROM `modules` WHERE mod_nick_name = ?';
        ModuleRegistryQueryDouble::on($sql, ['cc'], [['mod_id' => 42, 'mod_nick_name' => 'cc']]);
        ModuleRegistryQueryDouble::on($sql, ['dup'], [['mod_id' => 1, 'mod_nick_name' => 'dup'], ['mod_id' => 2, 'mod_nick_name' => 'dup']]);
        $hostile = "cc' OR '1'='1";
        ModuleRegistryQueryDouble::on($sql, ['free'], []);
        ModuleRegistryQueryDouble::on($sql, [$hostile], []);
        $table = $this->installer();

        self::assertSame(0, $table->validateNickName('free'), 'an unused nickname is available');
        self::assertSame(1, $table->validateNickName('cc'));
        self::assertSame(2, $table->validateNickName('dup'));
        self::assertSame(0, $table->validateNickName($hostile));
        self::assertSame([['free'], ['cc'], ['dup'], [$hostile]], ModuleRegistryQueryDouble::binds());
    }

    public function testEnableDependencyCheckReadsRealModuleConfigAndListsEveryDependencyNotEnabled(): void
    {
        ModuleRegistryQueryDouble::on(self::MODULE_DIRECTORY_SQL, [42], [['mod_directory' => 'Carecoordination']]);
        ModuleRegistryQueryDouble::on(self::MODULE_STATUS_SQL, ['Ccr'], [['mod_active' => 1, 'mod_directory' => 'Ccr']]);
        ModuleRegistryQueryDouble::on(self::MODULE_STATUS_SQL, ['Immunization'], [['mod_active' => 0, 'mod_directory' => 'Immunization']]);
        ModuleRegistryQueryDouble::on(self::MODULE_STATUS_SQL, ['Documents'], [['mod_active' => 1, 'mod_directory' => 'Documents']]);
        ModuleRegistryQueryDouble::on(self::MODULE_STATUS_SQL, ['Syndromicsurveillance'], []);
        $table = $this->installer();

        self::assertSame(
            ['status' => 'failure', 'code' => '200', 'value' => ['Immunization', 'Syndromicsurveillance']],
            $table->checkDependencyOnEnable(42),
        );
        self::assertSame([[42], ['Ccr'], ['Immunization'], ['Syndromicsurveillance'], ['Documents']], ModuleRegistryQueryDouble::binds());
        self::assertSame(
            'Ccr(Enabled), Immunization(Disabled), Syndromicsurveillance(Missing), Documents(Enabled)',
            $table->getDependencyModules(42),
        );
        self::assertSame(
            [self::MODULE_DIRECTORY_SQL, self::MODULE_STATUS_SQL],
            array_values(array_unique(array_column(ModuleRegistryQueryDouble::calls(), 1))),
            'dependency status is resolved only through the directory-status lookup, in module.config.php order',
        );
    }

    public function testEnableDependencyCheckSucceedsWhenAllDependenciesEnabledOrNoneDeclared(): void
    {
        ModuleRegistryQueryDouble::on(self::MODULE_DIRECTORY_SQL, [42], [['mod_directory' => 'Carecoordination']]);
        ModuleRegistryQueryDouble::on(self::MODULE_DIRECTORY_SQL, [1], [['mod_directory' => 'Installer']]);
        foreach (['Ccr', 'Immunization', 'Syndromicsurveillance', 'Documents'] as $dependency) {
            ModuleRegistryQueryDouble::on(self::MODULE_STATUS_SQL, [$dependency], [['mod_active' => 1, 'mod_directory' => $dependency]]);
        }
        ModuleRegistryQueryDouble::on(self::MODULE_DIRECTORY_SQL, [99], []);
        $table = $this->installer();

        $success = ['status' => 'success', 'code' => '1', 'value' => ''];
        self::assertSame($success, $table->checkDependencyOnEnable(42));
        self::assertSame($success, $table->checkDependencyOnEnable(1), 'Installer declares no module_dependencies');
        self::assertSame('', $table->getDependencyModules(1));
        self::assertSame('', $table->getDependencyModules(99), 'an unregistered module has no dependency summary');
        self::assertSame([], $table->getDependencyModulesDir(99));
        self::assertSame(
            [[42], ['Ccr'], ['Immunization'], ['Syndromicsurveillance'], ['Documents'], [1], [1], [99], [99]],
            ModuleRegistryQueryDouble::binds(),
        );
    }

    public function testDisableDependencyCheckSucceedsWhenNoInstalledModuleDependsOnTheTarget(): void
    {
        ModuleRegistryQueryDouble::on(self::INSTALLED_SQL, [], [
            ['mod_id' => 42, 'mod_directory' => 'Carecoordination', 'mod_active' => 1],
            ['mod_id' => 7, 'mod_directory' => 'Ccr', 'mod_active' => 1],
            ['mod_id' => '', 'mod_directory' => 'Orphan', 'mod_active' => 1],
        ]);
        ModuleRegistryQueryDouble::on(self::MODULE_DIRECTORY_SQL, [42], [['mod_directory' => 'Carecoordination']]);
        ModuleRegistryQueryDouble::on(self::MODULE_DIRECTORY_SQL, [7], [['mod_directory' => 'Ccr']]);
        ModuleRegistryQueryDouble::on(self::MODULE_DIRECTORY_SQL, [1], [['mod_directory' => 'Installer']]);
        $table = $this->installer();

        self::assertSame(['status' => 'success', 'code' => '1', 'value' => ''], $table->checkDependencyOnDisable(1));
        self::assertSame(['Ccr', 'Immunization', 'Syndromicsurveillance', 'Documents'], $table->getDependencyModulesDir(42));
        self::assertSame(
            [[], [1], [42], [42], [7], [7], [42]],
            ModuleRegistryQueryDouble::binds(),
            'installed rows without a mod_id are skipped before any directory lookup',
        );
    }

    public function testHangersAndSetupObjectSelectionUseOnlyTheContainerRegisteredSetupController(): void
    {
        $setup = new class {
            public function getTitle(): string
            {
                return 'Syndromic Surveillance';
            }
        };
        $table = $this->installer(['Syndromicsurveillance\\Controller\\SetupController' => $setup]);

        self::assertSame(
            ['reports' => 'Reports', 'encounter' => 'Encounter', 'demographics' => 'Demographics', 'modules' => 'Modules'],
            $table->getHangers(),
        );
        self::assertSame(
            ['module_dir' => 'syndromicsurveillance', 'title' => 'Syndromic Surveillance'],
            $table->getSetupObject('Syndromicsurveillance'),
        );
        self::assertSame([], $table->getSetupObject('Ccr'), 'modules without a registered SetupController have no setup entry');
        self::assertSame([], ModuleRegistryQueryDouble::calls());
    }

    public function testSyndromicCountFiltersCastReportableCodeIdsToIntegersAndBindProviderAndDatesInBothUnionHalves(): void
    {
        $sql = self::syndromicSql(true, '3,0,12', false);
        $binds = ['8', '2026-01-01', '2026-01-31', '8', '2026-01-01', '2026-01-31'];
        ModuleRegistryQueryDouble::on($sql, $binds, [
            ['patientid' => 101, 'issueid' => 1],
            ['patientid' => 102, 'issueid' => 2],
        ]);
        $table = new SyndromicsurveillanceTable();

        $count = $table->fetch_result('2026-01-01', '2026-01-31', ['3', "0) OR 1=1 -- ", '12abc'], '8', 0, 10, 1);

        self::assertSame(2, $count, 'count mode returns the number of matching rows');
        self::assertSame([['fetchRecords', $sql, $binds]], ModuleRegistryQueryDouble::calls());
        self::assertStringNotContainsString('OR 1=1', $sql);
    }

    public function testSyndromicPageQueryBindsLimitThenOffsetAndOmitsUnusableFilters(): void
    {
        $sql = self::syndromicSql(false, null, true);
        $dates = ['2026-02-01', '2026-02-28', '2026-02-01', '2026-02-28'];
        $page = [['patientid' => 101, 'issueid' => 1]];
        ModuleRegistryQueryDouble::on($sql, [...$dates, 10, 20], $page);
        ModuleRegistryQueryDouble::on($sql, [...$dates, 0, 0], []);
        $table = new SyndromicsurveillanceTable();

        foreach ([[], 'not-an-array', null] as $codes) {
            self::assertSame($page, $table->fetch_result('2026-02-01', '2026-02-28', $codes, '', 20, 10));
        }
        self::assertSame([], $table->fetch_result('2026-02-01', '2026-02-28', [], 0, 'x', '1;DROP'));
        self::assertSame(
            [[...$dates, 10, 20], [...$dates, 10, 20], [...$dates, 10, 20], [...$dates, 0, 0]],
            ModuleRegistryQueryDouble::binds(),
            'LIMIT takes $end, OFFSET takes $start, and non-numeric bounds fall back to zero',
        );
        self::assertSame([$sql], array_values(array_unique(array_column(ModuleRegistryQueryDouble::calls(), 1))));
    }

    public function testSyndromicProviderListSelectsTheEncounterProviderAfterTheUnassignedOption(): void
    {
        $encounterSql = 'SELECT * FROM form_encounter WHERE encounter = ? AND pid = ?';
        $providersSql = "SELECT id, fname, lname, specialty FROM users WHERE active = 1 AND ( info IS NULL OR info NOT LIKE '%Inactive%' ) AND authorized = 1 ORDER BY lname, fname";
        $GLOBALS['encounter'] = 900;
        $GLOBALS['pid'] = 55;
        ModuleRegistryQueryDouble::on($encounterSql, [900, 55], [['encounter' => 900, 'pid' => 55, 'provider_id' => '8']]);
        ModuleRegistryQueryDouble::on($providersSql, [], [
            ['id' => 5, 'fname' => 'Ada', 'lname' => 'Example', 'specialty' => ''],
            ['id' => 8, 'fname' => 'Ben', 'lname' => 'Sample', 'specialty' => ''],
        ]);
        ModuleRegistryQueryDouble::on($encounterSql, [901, 55], []);
        $table = new SyndromicsurveillanceTable();
        $unassigned = ['value' => '', 'label' => 'Unassigned', 'selected' => true, 'disabled' => false];

        self::assertSame([
            $unassigned,
            ['value' => 5, 'label' => 'Ada Example', 'selected' => false],
            ['value' => 8, 'label' => 'Ben Sample', 'selected' => true],
        ], $table->getProviderList());

        $GLOBALS['encounter'] = 901;
        $noEncounterTable = new SyndromicsurveillanceTable();
        $withoutEncounter = $noEncounterTable->getProviderList();
        self::assertIsArray($withoutEncounter);
        self::assertCount(3, $withoutEncounter);
        self::assertSame([false, false], array_column(array_slice($withoutEncounter, 1), 'selected'), 'no encounter provider selects no provider');
        self::assertSame($unassigned, $withoutEncounter[0]);
        self::assertSame(
            [[900, 55], [], [901, 55], []],
            ModuleRegistryQueryDouble::binds(),
        );
    }

    public function testSyndromicDateConversionReordersUsMonthDayYearToIsoDate(): void
    {
        $table = new SyndromicsurveillanceTable();
        self::assertSame('2026-03-15', $table->convert_to_yyyymmdd('03/15/2026'));
        self::assertSame('1999-12-31', $table->convert_to_yyyymmdd('12-31-1999'));
        self::assertSame('2024-02-29', $table->convert_to_yyyymmdd('02/29-2024'), 'mixed separators normalise to dashes');
        self::assertSame([], ModuleRegistryQueryDouble::calls());
    }

    /**
     * Exact, whitespace-normalized SQL the reportable-diagnosis listing must
     * issue: the optional provider clause and integer code-id list appear in
     * both UNION halves, and only page mode appends LIMIT/OFFSET.
     */
    private static function syndromicSql(bool $withProvider, ?string $codeIds, bool $paged): string
    {
        $provider = $withProvider ? ' AND provider_id = ?' : '';
        $codes = $codeIds === null ? '' : " AND c.id IN ({$codeIds})";
        return 'SELECT c.code_text,l.pid AS patientid,p.language,l.diagnosis,'
            . "CONCAT(p.fname, ' ', p.mname, ' ', p.lname) AS patientname,l.date AS issuedate, l.id AS issueid,"
            . 'l.title AS issuetitle FROM lists l, patient_data p, codes c, form_encounter AS fe WHERE c.reportable = 1'
            . $provider
            . ' AND l.id NOT IN (SELECT lists_id FROM syndromic_surveillance) AND l.date >= ? AND l.date <= ? AND l.pid = p.pid'
            . $codes
            . " AND l.diagnosis LIKE 'ICD9:%' AND ( SUBSTRING(l.diagnosis, 6) = c.code"
            . " || SUBSTRING(l.diagnosis, 6) = CONCAT_WS('', c.code, ';') ) AND fe.pid = l.pid"
            . ' UNION DISTINCT SELECT c.code_text, b.pid AS patientid, p.language, b.code,'
            . " CONCAT(p.fname, ' ', p.mname, ' ', p.lname) AS patientname, b.date AS issuedate, b.id AS issueid,"
            . " '' AS issuetitle FROM billing b, patient_data p, codes c, form_encounter fe WHERE c.reportable = 1"
            . " AND b.code_type = 'ICD9' AND b.activity = '1' AND b.pid = p.pid AND fe.encounter = b.encounter"
            . $codes
            . ' AND c.code = b.code AND fe.date IN (SELECT MAX(fenc.date) FROM form_encounter AS fenc WHERE fenc.pid = fe.pid)'
            . $provider
            . ' AND fe.date >= ? AND fe.date <= ?'
            . ($paged ? ' LIMIT ? OFFSET ?' : '');
    }

    /**
     * @param array<string, object> $services
     */
    private function installer(array $services = []): InstModuleTable
    {
        $container = new class ($services) implements ContainerInterface {
            /** @param array<string, object> $services */
            public function __construct(private readonly array $services)
            {
            }

            public function get(string $id): object
            {
                return $this->services[$id] ?? throw new class ($id) extends RuntimeException implements NotFoundExceptionInterface {
                };
            }

            public function has(string $id): bool
            {
                return isset($this->services[$id]);
            }
        };
        return new InstModuleTable($container);
    }
}
