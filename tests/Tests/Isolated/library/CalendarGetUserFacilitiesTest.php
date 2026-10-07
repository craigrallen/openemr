<?php

/**
 * getUserFacilities() must only ever emit allowlisted ORDER BY clauses while
 * keeping its ACL, count, inventory-restriction and uid binding semantics.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\library;

use OpenEMR\Core\OEGlobalsBag;
use OpenEMR\Services\CalendarFacilityQuery;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\PreserveGlobalState;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;
use PHPUnit\Framework\TestCase;

#[RunTestsInSeparateProcesses]
#[PreserveGlobalState(false)]
final class CalendarGetUserFacilitiesTest extends TestCase
{
    private const UNRESTRICTED_SELECT = 'SELECT f.id, f.name, f.color, f.inactive FROM facility AS f ORDER BY ';

    protected function setUp(): void
    {
        require_once __DIR__ . '/../../../../library/calendar.inc.php';
        CalendarSqlRecorder::reset();
        CalendarFacilityQuery::setLegacyInstance(CalendarSqlRecorder::createQuery());
        $globals = OEGlobalsBag::getInstance();
        $globals->set('restrict_user_facility', false);
        $globals->set('gbl_fac_warehouse_restrictions', false);
    }

    protected function tearDown(): void
    {
        CalendarFacilityQuery::setLegacyInstance(null);
    }

    public function testDefaultOrdersNumericallyById(): void
    {
        getUserFacilities(5);

        $this->assertSame([], CalendarSqlRecorder::$queries, 'unrestricted mode must not count users_facility rows');
        $this->assertCount(1, CalendarSqlRecorder::$statements);
        $this->assertSame(self::UNRESTRICTED_SELECT . 'f.id ASC', $this->normalize(CalendarSqlRecorder::$statements[0]['sql']));
        $this->assertSame([], CalendarSqlRecorder::$statements[0]['binds']);
    }

    #[DataProvider('validOrderProvider')]
    public function testValidSortsMapToStaticClause(string $orderby, string $expectedClause): void
    {
        getUserFacilities(5, $orderby);

        $this->assertSame(self::UNRESTRICTED_SELECT . $expectedClause, $this->normalize(CalendarSqlRecorder::$statements[0]['sql']));
    }

    /**
     * @return array<string, array{string, string}>
     *
     * @codeCoverageIgnore Data providers run before coverage instrumentation starts.
     */
    public static function validOrderProvider(): array
    {
        return [
            'id' => ['id', 'f.id ASC'],
            'name' => ['name', 'f.name ASC'],
            'color' => ['color', 'f.color ASC'],
            'inactive' => ['inactive', 'f.inactive ASC'],
            'name desc' => ['name DESC', 'f.name DESC'],
            'id asc mixed case, padded' => ['  ID   asc ', 'f.id ASC'],
            'inactive desc lower' => ['inactive desc', 'f.inactive DESC'],
        ];
    }

    #[DataProvider('maliciousOrderProvider')]
    public function testMaliciousOrderByNeverReachesSql(string $orderby): void
    {
        try {
            getUserFacilities(5, $orderby);
            $this->fail('Expected rejection of ORDER BY input: ' . $orderby);
        } catch (\InvalidArgumentException) {
            // expected
        }

        $this->assertSame([], CalendarSqlRecorder::$statements, 'no SQL may be issued for a rejected sort');
        $this->assertSame([], CalendarSqlRecorder::$queries);
    }

    #[DataProvider('maliciousOrderProvider')]
    public function testMaliciousOrderByRejectedInRestrictedMode(string $orderby): void
    {
        OEGlobalsBag::getInstance()->set('restrict_user_facility', true);
        CalendarSqlRecorder::$countRow = ['count' => 2];

        try {
            getUserFacilities(5, $orderby);
            $this->fail('Expected rejection of ORDER BY input: ' . $orderby);
        } catch (\InvalidArgumentException) {
            // expected
        }

        $this->assertSame([], CalendarSqlRecorder::$statements, 'restricted facility query must not run with injected sort');
        $this->assertSame([], CalendarSqlRecorder::$queries, 'invalid sort must be rejected before the ACL count query');
    }

    /**
     * @return array<string, array{string}>
     *
     * @codeCoverageIgnore Data providers run before coverage instrumentation starts.
     */
    public static function maliciousOrderProvider(): array
    {
        return [
            'stacked query' => ['id; DROP TABLE facility'],
            'union exfil' => ['id UNION SELECT username, password, 1, 1 FROM users_secure'],
            'boolean subquery' => ['(SELECT IF(1=1, id, name))'],
            'comment' => ['id -- '],
            'unknown column' => ['billing_location'],
            'qualified column' => ['f.id'],
            'backtick escape' => ['`id`'],
            'positional' => ['1'],
            'empty' => [''],
            'three tokens' => ['id ASC name'],
            'bad direction' => ['id SIDEWAYS'],
        ];
    }

    public function testNonStringSortIsRejectedBeforeAnySql(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        try {
            getUserFacilities(5, 123);
        } finally {
            $this->assertSame([], CalendarSqlRecorder::$queries);
            $this->assertSame([], CalendarSqlRecorder::$statements);
        }
    }

    public function testRestrictedUserGetsAclJoinWithBoundUidOnly(): void
    {
        OEGlobalsBag::getInstance()->set('restrict_user_facility', true);
        CalendarSqlRecorder::$countRow = ['count' => 1];
        CalendarSqlRecorder::$rows = [
            ['id' => 3, 'name' => 'Allowed', 'color' => '#fff', 'inactive' => 0],
        ];

        $result = getUserFacilities('42', 'name DESC');

        $this->assertSame(
            [['id' => 3, 'name' => 'Allowed', 'color' => '#fff', 'inactive' => 0]],
            $result
        );
        $this->assertCount(1, CalendarSqlRecorder::$queries);
        $this->assertSame(['42'], CalendarSqlRecorder::$queries[0]['binds']);
        $this->assertStringContainsString('users_facility', CalendarSqlRecorder::$queries[0]['sql']);

        $this->assertCount(1, CalendarSqlRecorder::$statements);
        $sql = $this->normalize(CalendarSqlRecorder::$statements[0]['sql']);
        $this->assertSame(['42'], CalendarSqlRecorder::$statements[0]['binds'], 'uid must be bound exactly, never interpolated');
        $this->assertStringContainsString('JOIN users AS u ON u.id = ?', $sql);
        $this->assertStringContainsString('WHERE f.id = u.facility_id OR f.id IN', $sql);
        $this->assertStringContainsString("uf.tablename = 'users' AND uf.table_id = u.id", $sql);
        $this->assertStringContainsString('SELECT f.id, f.name, f.color, f.inactive', $sql);
        $this->assertStringEndsWith('ORDER BY f.name DESC', $sql);
        $this->assertStringNotContainsString('42', $sql);
    }

    public function testRestrictionFlagWithNoAssignmentsFallsBackToAllFacilities(): void
    {
        OEGlobalsBag::getInstance()->set('restrict_user_facility', true);
        CalendarSqlRecorder::$countRow = ['count' => 0];

        getUserFacilities(9);

        $this->assertCount(1, CalendarSqlRecorder::$queries);
        $this->assertSame([9], CalendarSqlRecorder::$queries[0]['binds']);
        $this->assertSame(self::UNRESTRICTED_SELECT . 'f.id ASC', $this->normalize(CalendarSqlRecorder::$statements[0]['sql']));
    }

    public function testInventoryModeUsesWarehouseRestrictionFlag(): void
    {
        $globals = OEGlobalsBag::getInstance();
        $globals->set('restrict_user_facility', false);
        $globals->set('gbl_fac_warehouse_restrictions', true);
        CalendarSqlRecorder::$countRow = ['count' => 3];

        getUserFacilities(7, 'id', true);

        $this->assertCount(1, CalendarSqlRecorder::$queries);
        $this->assertSame([7], CalendarSqlRecorder::$statements[0]['binds']);
        $this->assertStringEndsWith('ORDER BY f.id ASC', $this->normalize(CalendarSqlRecorder::$statements[0]['sql']));
    }

    public function testInventoryModeIgnoresCalendarRestrictionFlag(): void
    {
        $globals = OEGlobalsBag::getInstance();
        $globals->set('restrict_user_facility', true);
        $globals->set('gbl_fac_warehouse_restrictions', false);
        CalendarSqlRecorder::$countRow = ['count' => 3];

        getUserFacilities(7, 'id', true);

        $this->assertSame([], CalendarSqlRecorder::$queries);
        $this->assertSame([], CalendarSqlRecorder::$statements[0]['binds']);
    }

    private function normalize(string $sql): string
    {
        return trim((string) preg_replace('/\s+/', ' ', $sql));
    }
}
