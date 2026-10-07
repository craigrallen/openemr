<?php

/**
 * Regression coverage for the public contracts of the inherited Ccr and
 * Carecoordination zend module tables whose return types were tightened
 * upstream: Ccr\Model\CcrTable (CCR XML parsing, audit staging, document and
 * patient-scoped reads, approval status statements) and the identical
 * Carecoordination\Model\SetupTable / MapperTable (CCDA configuration lists
 * and mapping persistence).
 *
 * The real, unchanged module classes are loaded through the Laminas
 * StandardAutoloader namespace mapping their Module::getAutoloaderConfig()
 * declares. Every test runs in its own child process so that
 * ClinicalModuleQueryDouble can be aliased over QueryUtils before the real
 * class loads; the double records each exact query and bind list and returns
 * synthetic unit-test rows. These are unit tests of query construction and
 * result mapping only: they do not exercise MariaDB persistence, and none of
 * the values are clinical data or constitute clinical acceptance.
 *
 * Not covered here: CcrTable::insertApprovedData() and insert_patient() call
 * the global library functions escape_sql_column_name() / updatePatientData(),
 * which need the database-backed library bootstrap and belong in the
 * services suite.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen <craig@interconnected.au>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\Modules;

use Carecoordination\Model\MapperTable;
use Carecoordination\Model\SetupTable;
use Ccr\Model\CcrTable;
use Laminas\Loader\StandardAutoloader;
use LogicException;
use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Database\SqlQueryException;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\PreserveGlobalState;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;
use PHPUnit\Framework\TestCase;

#[Group('isolated')]
#[Group('modules')]
#[RunTestsInSeparateProcesses]
#[PreserveGlobalState(false)]
final class ClinicalModuleQueryContractsTest extends TestCase
{
    private const AUDIT_MASTER_INSERT = 'INSERT INTO audit_master SET pid = ?,approval_status = ?,ip_address = ?,type = ?';
    private const AUDIT_DETAILS_PREFIX = 'INSERT INTO `audit_details` (`table_name`, `field_name`, `field_value`, `audit_master_id`, `entry_identification`) VALUES ';
    private const AUDIT_SINGLE_TABLE = 'SELECT * FROM audit_master am LEFT JOIN audit_details ad ON ad.audit_master_id = am.id AND ad.table_name = ? WHERE am.id = ? AND am.type = 11 AND am.approval_status = 1 ORDER BY ad.entry_identification,ad.field_name';
    private const FORMS_SQL = 'select name, directory, nickname from registry where state=? ORDER BY name';
    private const LBF_SQL = 'select option_id, title from list_options where list_id = ? ORDER BY seq,title';
    private const LBF_FIELDS_SQL = 'SELECT field_id,title FROM layout_options WHERE form_id=? ORDER BY title';
    private const MAX_ID_SQL = 'select max(id) as id from ccda_table_mapping';
    private const MAPPING_MASTER_SQL = 'insert into ccda_table_mapping (ccda_component, ccda_component_section, form_dir, form_type, form_table, user_id) values (?, ?, ?, ?, ?, ?)';
    private const MAPPING_CHILD_SQL = 'insert into ccda_field_mapping (table_id, ccda_field) values (?, ?)';
    private const MAPPING_RETIRE_SQL = 'update ccda_table_mapping set deleted = 1 where id <= ? and user_id = ?';
    private const DELETE_AUDIT_DETAILS = 'DELETE from audit_details WHERE audit_master_id=?';
    private const DELETE_AUDIT_MASTER = 'DELETE from audit_master WHERE id=?';
    private const REJECT_AUDIT = "UPDATE audit_master SET approval_status = '3' WHERE id=?";
    private const RELEASE_DOCUMENTS = 'UPDATE documents SET audit_master_approval_status=2 WHERE audit_master_id=?';

    protected function setUp(): void
    {
        // Must precede any QueryUtils autoload in this child process.
        self::assertFalse(class_exists(QueryUtils::class, false), 'QueryUtils must remain unloaded in this isolated child process');
        self::assertTrue(class_alias(ClinicalModuleQueryDouble::class, QueryUtils::class));
        ClinicalModuleQueryDouble::reset();

        $moduleRoot = dirname(__DIR__, 4) . '/interface/modules/zend_modules/module';
        $loader = new StandardAutoloader(['namespaces' => [
            'Ccr' => $moduleRoot . '/Ccr/src/Ccr',
            'Carecoordination' => $moduleRoot . '/Carecoordination/src/Carecoordination',
        ]]);
        $loader->register();
    }

    public function testCategoryLookupBindsTitleVerbatimAndUnknownCategoryIsEmpty(): void
    {
        $sql = 'select * from categories where name = ?';
        ClinicalModuleQueryDouble::on($sql, ["Unit O'Category ✓"], [['id' => 31, 'name' => "Unit O'Category ✓"]]);
        ClinicalModuleQueryDouble::on($sql, ['Unit missing'], []);
        $table = new CcrTable();

        self::assertSame([['id' => 31, 'name' => "Unit O'Category ✓"]], $table->fetch_cat_id("Unit O'Category ✓"));
        self::assertSame([], $table->fetch_cat_id('Unit missing'));
        self::assertSame([
            ['fetchRecords', $sql, ["Unit O'Category ✓"]],
            ['fetchRecords', $sql, ['Unit missing']],
        ], ClinicalModuleQueryDouble::calls());
    }

    public function testUploadedDocumentsBindOwnerThenWindowStartThenEnd(): void
    {
        $sql = 'SELECT * FROM categories_to_documents AS cat_doc JOIN documents AS doc ON doc.id = cat_doc.document_id AND doc.owner = ? AND doc.date BETWEEN ? AND ?';
        $window = ['user' => 7, 'time_start' => '2001-02-03 04:05:06', 'time_end' => '2001-02-03 23:59:59'];
        ClinicalModuleQueryDouble::on($sql, [7, '2001-02-03 04:05:06', '2001-02-03 23:59:59'], [['document_id' => 90, 'owner' => 7]]);

        self::assertSame([['document_id' => 90, 'owner' => 7]], (new CcrTable())->fetch_uploaded_documents($window));
        self::assertSame([['fetchRecords', $sql, [7, '2001-02-03 04:05:06', '2001-02-03 23:59:59']]], ClinicalModuleQueryDouble::calls());
    }

    public function testPendingCcrDocumentListIsUnboundAndPassesRowsThrough(): void
    {
        $sql = "SELECT am.id as amid, cat.name, u.fname, u.lname, d.imported, d.size, d.date, d.couch_docid, d.couch_revid, d.url AS file_url, d.id AS document_id, ad.field_value, ad1.field_value, ad2.field_value, pd.pid, CONCAT(ad.field_value,' ',ad1.field_value) as pat_name, DATE(ad2.field_value) as dob, CONCAT_WS(' ',pd.lname, pd.fname) as matched_patient
                FROM documents AS d
                JOIN categories AS cat ON cat.name = 'CCR'
                JOIN categories_to_documents AS cd ON cd.document_id = d.id AND cd.category_id = cat.id
                LEFT JOIN audit_master AS am ON am.type = '11' AND am.approval_status = '1' AND d.audit_master_id = am.id
                LEFT JOIN audit_details ad ON ad.audit_master_id = am.id AND ad.table_name = 'patient_data' AND ad.field_name = 'lname'
                LEFT JOIN audit_details ad1 ON ad1.audit_master_id = am.id AND ad1.table_name = 'patient_data' AND ad1.field_name = 'fname'
                LEFT JOIN audit_details ad2 ON ad2.audit_master_id = am.id AND ad2.table_name = 'patient_data' AND ad2.field_name = 'DOB'
                LEFT JOIN patient_data pd ON pd.lname = ad.field_value AND pd.fname = ad1.field_value AND pd.DOB = DATE(ad2.field_value)
                LEFT JOIN users AS u ON u.id = d.owner
                WHERE d.audit_master_approval_status = 1
                ORDER BY date DESC";
        ClinicalModuleQueryDouble::on($sql, [], []);
        $table = new CcrTable();
        self::assertSame([], $table->document_fetch(['cat_title' => 'Unit other category']));

        $row = ['amid' => 501, 'document_id' => 90, 'pat_name' => "O'Fixture Unit-Zoë", 'dob' => '2001-02-03', 'pid' => null];
        ClinicalModuleQueryDouble::on($sql, [], [$row]);
        self::assertSame([$row], $table->document_fetch(['cat_title' => 'Unit other category']), 'the CCR category is fixed in SQL, not taken from the argument; an unmatched import keeps a null pid');
        self::assertSame([['fetchRecords', ClinicalModuleQueryDouble::normalize($sql), []], ['fetchRecords', ClinicalModuleQueryDouble::normalize($sql), []]], ClinicalModuleQueryDouble::calls());
    }

    public function testDocumentAuditLinkBindsAuditIdBeforeDocumentIdAndPropagatesDatabaseError(): void
    {
        $sql = 'UPDATE documents SET audit_master_id = ? WHERE id = ?';
        ClinicalModuleQueryDouble::onStatement($sql, [501, 90]);
        $table = new CcrTable();

        $table->update_document(90, 501);
        self::assertSame([['sqlStatementThrowException', $sql, [501, 90]]], ClinicalModuleQueryDouble::calls());

        ClinicalModuleQueryDouble::failOn('sqlStatementThrowException', $sql, [502, 91]);
        ClinicalModuleQueryDouble::onStatement($sql, [502, 91]);
        try {
            $table->update_document(91, 502);
            self::fail('a failed document audit link must propagate');
        } catch (SqlQueryException) {
        }
        self::assertSame([
            ['sqlStatementThrowException', $sql, [501, 90]],
            ['sqlStatementThrowException', $sql, [502, 91]],
        ], ClinicalModuleQueryDouble::calls(), 'nothing else is written after the failure');
    }

    public function testAuditStagingInsertsMasterThenTrimmedDetailRowsAndReturnsMasterId(): void
    {
        $detailSql = self::AUDIT_DETAILS_PREFIX . '(? ,? ,? ,? ,?),(? ,? ,? ,? ,?),(? ,? ,? ,? ,?);';
        $detailBinds = [
            'patient_data', 'fname', 'Unit-Zoë', 501, '1',
            'patient_data', 'lname', "O'Fixture", 501, '1',
            'lists1', 'title', 'Unit problem ✓', 501, '2',
        ];
        ClinicalModuleQueryDouble::onInsert(self::AUDIT_MASTER_INSERT, [0, '1', '192.0.2.10', '11'], 501);
        ClinicalModuleQueryDouble::onStatement($detailSql, $detailBinds);

        $id = (new CcrTable())->insert_ccr_into_audit_data([
            'audit_master_id_to_delete' => '',
            'approval_status' => '1',
            'type' => '11',
            'ip_address' => '192.0.2.10',
            'field_name_value_array' => [
                'patient_data' => [1 => [' fname ' => '  Unit-Zoë ', 'lname' => "O'Fixture"]],
                'lists1' => [2 => ['title' => "Unit problem ✓\n"]],
            ],
            'entry_identification_array' => [
                'patient_data' => [1 => ' 1 '],
                'lists1' => [2 => '2'],
            ],
        ]);

        self::assertSame(501, $id);
        self::assertSame([
            ['sqlInsert', self::AUDIT_MASTER_INSERT, [0, '1', '192.0.2.10', '11']],
            ['sqlStatementThrowException', $detailSql, $detailBinds],
        ], ClinicalModuleQueryDouble::calls());
    }

    public function testAuditStagingReplacesPreviousImportDetailsBeforeMaster(): void
    {
        $this->allowAuditReplacement();

        self::assertSame(502, (new CcrTable())->insert_ccr_into_audit_data(self::auditReplacementInput()));
        self::assertSame(self::auditReplacementCalls(), ClinicalModuleQueryDouble::calls());
    }

    #[DataProvider('auditReplacementStageProvider')]
    public function testAuditReplacementFailureAtEachStagePropagatesWithoutLaterWrites(int $failingStage): void
    {
        $this->allowAuditReplacement();
        $expected = array_slice(self::auditReplacementCalls(), 0, $failingStage + 1);
        [$method, $sql, $binds] = $expected[$failingStage];
        ClinicalModuleQueryDouble::failOn($method, $sql, $binds);

        try {
            (new CcrTable())->insert_ccr_into_audit_data(self::auditReplacementInput());
            self::fail('a failed audit replacement stage must propagate');
        } catch (SqlQueryException) {
        }
        self::assertSame($expected, ClinicalModuleQueryDouble::calls(), 'no operation follows the failed stage');
    }

    /**
     * @return array<string, array{int}>
     *
     * @codeCoverageIgnore Data providers run before coverage instrumentation starts.
     */
    public static function auditReplacementStageProvider(): array
    {
        return [
            'previous details deletion' => [0],
            'previous master deletion' => [1],
            'new master insert' => [2],
            'new detail insert' => [3],
        ];
    }

    public function testAuditStagingStopsBeforeDetailsWhenMasterInsertFails(): void
    {
        ClinicalModuleQueryDouble::failOn('sqlInsert', self::AUDIT_MASTER_INSERT, [0, '1', '192.0.2.10', '11']);
        try {
            (new CcrTable())->insert_ccr_into_audit_data([
                'audit_master_id_to_delete' => '',
                'approval_status' => '1',
                'type' => '11',
                'ip_address' => '192.0.2.10',
                'field_name_value_array' => ['patient_data' => [1 => ['sex' => 'Unit']]],
                'entry_identification_array' => ['patient_data' => [1 => '1']],
            ]);
            self::fail('a failed audit_master insert must propagate');
        } catch (SqlQueryException) {
        }
        self::assertSame([['sqlInsert', self::AUDIT_MASTER_INSERT, [0, '1', '192.0.2.10', '11']]], ClinicalModuleQueryDouble::calls());
    }

    public function testCcrXmlParsingGroupsMappedFieldsBySectionAndOneBasedElementIndex(): void
    {
        $xml = <<<'XML'
            <?xml version="1.0" encoding="UTF-8"?>
            <ContinuityOfCareRecord xmlns="urn:astm-org:CCR">
              <Body>
                <Problems>
                  <Problem><Description><Text></Text><Code><Value></Value></Code></Description></Problem>
                  <Problem><Description><Text>Unit problem &amp; ✓</Text><Code><Value>UNIT.1</Value></Code></Description></Problem>
                </Problems>
              </Body>
              <Actors>
                <Actor><Person><Name><CurrentName><Given>Unit-Zoë</Given><Family>O'Fixture</Family></CurrentName></Name><DateOfBirth><ExactDateTime>2001-02-03T00:00:00Z</ExactDateTime></DateOfBirth></Person></Actor>
                <Actor><Person><Name><CurrentName><Given></Given><Family>Unit-Second</Family></CurrentName></Name><DateOfBirth><ExactDateTime>1999-12-31</ExactDateTime></DateOfBirth></Person></Actor>
              </Actors>
            </ContinuityOfCareRecord>
            XML;
        $mapping = [
            '//Actors/Actor' => [
                'patient_data:fname' => 'Person/Name/CurrentName/Given',
                'patient_data:lname' => 'Person/Name/CurrentName/Family',
                'patient_data:DOB' => 'Person/DateOfBirth/ExactDateTime',
            ],
            '//Body/Problems/Problem' => [
                'lists1:title' => 'Description/Text',
                'lists1:diagnosis' => 'Description/Code/Value',
            ],
            '//Body/Immunizations/Immunization' => [
                'immunizations:note' => 'Description/Text',
            ],
        ];

        self::assertSame([
            'patient_data' => [
                1 => ['fname' => 'Unit-Zoë', 'lname' => "O'Fixture", 'DOB' => '2001-02-03T00:00:00Z'],
                2 => ['lname' => 'Unit-Second', 'DOB' => '1999-12-31'],
            ],
            // The empty first problem is omitted but keeps its position, so
            // entry identification still points at the second element.
            'lists1' => [
                2 => ['title' => 'Unit problem & ✓', 'diagnosis' => 'UNIT.1'],
            ],
        ], (new CcrTable())->parseXmlStream($xml, $mapping), 'empty fields and absent sections contribute nothing');
        self::assertSame([], ClinicalModuleQueryDouble::calls(), 'parsing never touches the database');
    }

    public function testCcrXmlParsingWithNoMatchingSectionsIsEmpty(): void
    {
        $xml = '<?xml version="1.0"?><ContinuityOfCareRecord xmlns="urn:astm-org:CCR"><Body/></ContinuityOfCareRecord>';

        self::assertSame([], (new CcrTable())->parseXmlStream($xml, ['//Actors/Actor' => ['patient_data:fname' => 'Person/Name/CurrentName/Given']]));
    }

    public function testSingleTableAuditArrayGroupsByEntryAndMissingAuditIsEmpty(): void
    {
        ClinicalModuleQueryDouble::on(self::AUDIT_SINGLE_TABLE, ['lists2', 404], []);
        ClinicalModuleQueryDouble::on(self::AUDIT_SINGLE_TABLE, ['lists2', 501], [
            ['entry_identification' => '1', 'field_name' => 'title', 'field_value' => 'Unit allergen ✓'],
            ['entry_identification' => '1', 'field_name' => 'reaction', 'field_value' => "Unit O'Reaction"],
            ['entry_identification' => '2', 'field_name' => 'title', 'field_value' => 'Unit second'],
        ]);
        $table = new CcrTable();

        self::assertSame([], $table->createAuditArray(404, 'lists2'));
        self::assertSame(['lists2' => [
            '1' => ['title' => 'Unit allergen ✓', 'reaction' => "Unit O'Reaction"],
            '2' => ['title' => 'Unit second'],
        ]], $table->createAuditArray(501, 'lists2'));
        self::assertSame([
            ['fetchRecords', self::AUDIT_SINGLE_TABLE, ['lists2', 404]],
            ['fetchRecords', self::AUDIT_SINGLE_TABLE, ['lists2', 501]],
        ], ClinicalModuleQueryDouble::calls());
    }

    public function testMultiTableAuditArrayBindsEachTableThenAuditIdUnderTheCombinedKey(): void
    {
        $sql = 'SELECT * FROM audit_master am LEFT JOIN audit_details ad ON ad.audit_master_id = am.id AND ad.table_name IN (?,?) WHERE am.id = ? AND am.type = 11 AND am.approval_status = 1 ORDER BY ad.entry_identification,ad.field_name';
        // Tables are prepended, so the IN list binds in reverse input order.
        ClinicalModuleQueryDouble::on($sql, ['procedure_type', 'procedure_result', 501], [
            ['entry_identification' => '1', 'field_name' => 'name', 'field_value' => 'Unit panel'],
            ['entry_identification' => '1', 'field_name' => 'result', 'field_value' => '42'],
        ]);

        self::assertSame(
            ['procedure_result,procedure_type' => ['1' => ['name' => 'Unit panel', 'result' => '42']]],
            (new CcrTable())->createAuditArray(501, 'procedure_result,procedure_type'),
        );
        self::assertSame([['fetchRecords', $sql, ['procedure_type', 'procedure_result', 501]]], ClinicalModuleQueryDouble::calls());
    }

    #[DataProvider('patientScopedReaderProvider')]
    public function testPatientScopedReadersBindOnlyTheRequestedScope(string $reader, string $sql, int $firstBind, int $secondBind): void
    {
        // Patient and audit identifiers are deliberately distinct, so binding
        // the wrong key matches no registered fixture and fails closed.
        ClinicalModuleQueryDouble::on($sql, [$firstBind], [['unit_row' => 'first']]);
        ClinicalModuleQueryDouble::on($sql, [$secondBind], []);
        $table = new CcrTable();

        self::assertSame([['unit_row' => 'first']], $this->readPatient($table, $reader, ['pid' => 12, 'audit_master_id' => 501]));
        self::assertSame([], $this->readPatient($table, $reader, ['pid' => 13, 'audit_master_id' => 502]));
        self::assertSame([['fetchRecords', $sql, [$firstBind]], ['fetchRecords', $sql, [$secondBind]]], ClinicalModuleQueryDouble::calls());
    }

    /**
     * @return array<string, array{string, string, int, int}>
     *
     * @codeCoverageIgnore Data providers run before coverage instrumentation starts.
     */
    public static function patientScopedReaderProvider(): array
    {
        return [
            'staged demographics bind the audit id' => ['getDemographics', "SELECT ad.id as adid, table_name, field_name, field_value FROM audit_master am JOIN audit_details ad ON ad.audit_master_id = am.id WHERE am.id = ? AND ad.table_name = 'patient_data' ORDER BY ad.id", 501, 502],
            'current demographics bind the pid' => ['getDemographicsOld', 'SELECT * FROM patient_data WHERE pid = ?', 12, 13],
            'problems bind the pid' => ['getProblems', "SELECT * FROM lists WHERE pid = ? AND TYPE = 'medical_problem'", 12, 13],
            'allergies bind the pid' => ['getAllergies', "SELECT * FROM lists WHERE pid = ? AND TYPE = 'allergy'", 12, 13],
            'medications bind the pid' => ['getMedications', 'SELECT * FROM prescriptions WHERE patient_id = ?', 12, 13],
            'immunizations bind the pid' => ['getImmunizations', 'SELECT * FROM immunizations WHERE patient_id = ?', 12, 13],
            'lab results bind the pid' => ['getLabResults', 'SELECT * FROM procedure_order AS po LEFT JOIN procedure_order_code AS poc ON poc.procedure_order_id = po.procedure_order_id LEFT JOIN procedure_report AS pr ON pr.procedure_order_id = po.procedure_order_id LEFT JOIN procedure_result AS prs ON prs.procedure_report_id = pr.procedure_report_id WHERE patient_id = ?', 12, 13],
        ];
    }

    public function testPatientReadPropagatesDatabaseError(): void
    {
        $sql = 'SELECT * FROM prescriptions WHERE patient_id = ?';
        ClinicalModuleQueryDouble::failOn('fetchRecords', $sql, [12]);

        try {
            (new CcrTable())->getMedications(['pid' => 12]);
            self::fail('a failed patient read must propagate');
        } catch (SqlQueryException) {
        }
        self::assertSame([['fetchRecords', $sql, [12]]], ClinicalModuleQueryDouble::calls());
    }

    public function testDiscardMarksAuditRejectedThenReleasesItsDocuments(): void
    {
        ClinicalModuleQueryDouble::onStatement(self::REJECT_AUDIT, [501]);
        ClinicalModuleQueryDouble::onStatement(self::RELEASE_DOCUMENTS, [501]);
        (new CcrTable())->discardCCRData(['audit_master_id' => 501]);

        self::assertSame([
            ['sqlStatementThrowException', self::REJECT_AUDIT, [501]],
            ['sqlStatementThrowException', self::RELEASE_DOCUMENTS, [501]],
        ], ClinicalModuleQueryDouble::calls());
    }

    public function testDiscardDoesNotReleaseDocumentsWhenRejectionFails(): void
    {
        ClinicalModuleQueryDouble::onStatement(self::REJECT_AUDIT, [501]);
        ClinicalModuleQueryDouble::onStatement(self::RELEASE_DOCUMENTS, [501]);
        ClinicalModuleQueryDouble::failOn('sqlStatementThrowException', self::REJECT_AUDIT, [501]);
        try {
            (new CcrTable())->discardCCRData(['audit_master_id' => 501]);
            self::fail('a failed rejection must propagate');
        } catch (SqlQueryException) {
        }
        self::assertSame([
            ['sqlStatementThrowException', self::REJECT_AUDIT, [501]],
        ], ClinicalModuleQueryDouble::calls(), 'the documents release never runs');
    }

    public function testMarkImportedBindsOnlyTheDocumentId(): void
    {
        ClinicalModuleQueryDouble::onStatement('UPDATE documents SET imported = 1 WHERE id = ?', [90]);
        (new CcrTable())->update_imported(90);

        self::assertSame([['sqlStatementThrowException', 'UPDATE documents SET imported = 1 WHERE id = ?', [90]]], ClinicalModuleQueryDouble::calls());
    }

    #[DataProvider('ccdaTableProvider')]
    public function testCcdaSectionsAreUnboundPassThrough(string $class): void
    {
        $sql = 'select com.ccda_components_field, com.ccda_components_name, ccda_sections_field, ccda_sections_name, ccda_sections_req_mapping from ccda_components as com left join ccda_sections as sec on sec.ccda_components_id = com.ccda_components_id where 1=1 ORDER BY sec.ccda_components_id, sec.ccda_sections_id';
        $row = ['ccda_components_field' => 'unit_component', 'ccda_components_name' => 'Unit Component', 'ccda_sections_field' => null, 'ccda_sections_name' => null, 'ccda_sections_req_mapping' => null];
        ClinicalModuleQueryDouble::on($sql, [], [$row]);

        self::assertSame([$row], $this->ccdaTable($class)->getSections(), 'a component without sections keeps null section columns');
        self::assertSame([['fetchRecords', $sql, []]], ClinicalModuleQueryDouble::calls());
    }

    #[DataProvider('ccdaTableProvider')]
    public function testFormsListPrefersNicknameAndPrefixesDirectoryWithFormType(string $class): void
    {
        $table = $this->ccdaTable($class);
        ClinicalModuleQueryDouble::on(self::FORMS_SQL, [1], []);
        self::assertSame([], $table->getFormsList());

        ClinicalModuleQueryDouble::on(self::FORMS_SQL, [1], [
            ['name' => 'Unit Form', 'directory' => 'unit_form', 'nickname' => "Unit O'Nick ✓"],
            ['name' => 'Unit Plain', 'directory' => 'unit_plain', 'nickname' => ''],
        ]);
        self::assertSame([
            ["Unit O'Nick ✓", '1|unit_form'],
            ['Unit Plain', '1|unit_plain'],
        ], $table->getFormsList());
        self::assertSame([['fetchRecords', self::FORMS_SQL, [1]], ['fetchRecords', self::FORMS_SQL, [1]]], ClinicalModuleQueryDouble::calls());
    }

    #[DataProvider('ccdaTableProvider')]
    public function testFormsListPropagatesDatabaseError(string $class): void
    {
        ClinicalModuleQueryDouble::failOn('fetchRecords', self::FORMS_SQL, [1]);

        try {
            $this->ccdaTable($class)->getFormsList();
            self::fail('a failed forms list read must propagate');
        } catch (SqlQueryException) {
        }
        self::assertSame([['fetchRecords', self::FORMS_SQL, [1]]], ClinicalModuleQueryDouble::calls());
    }

    #[DataProvider('ccdaTableProvider')]
    public function testLbfListNestsFieldsPerFormAndFallsBackToFieldId(string $class): void
    {
        ClinicalModuleQueryDouble::on(self::LBF_SQL, ['lbfnames'], [
            ['option_id' => 'LBFunit', 'title' => 'Unit LBF'],
            ['option_id' => 'LBFempty', 'title' => 'Unit Empty'],
        ]);
        ClinicalModuleQueryDouble::on(self::LBF_FIELDS_SQL, ['LBFunit'], [
            ['field_id' => 'unit_a', 'title' => 'Unit A ✓'],
            ['field_id' => 'unit_b', 'title' => ''],
        ]);
        ClinicalModuleQueryDouble::on(self::LBF_FIELDS_SQL, ['LBFempty'], []);

        self::assertSame([
            ['Unit LBF', '2|LBFunit', [['Unit A ✓', '2|LBFunit|unit_a'], ['unit_b', '2|LBFunit|unit_b']]],
            ['Unit Empty', '2|LBFempty'],
        ], $this->ccdaTable($class)->getLbfList());
        self::assertSame([
            ['fetchRecords', self::LBF_SQL, ['lbfnames']],
            ['fetchRecords', self::LBF_FIELDS_SQL, ['LBFunit']],
            ['fetchRecords', self::LBF_FIELDS_SQL, ['LBFempty']],
        ], ClinicalModuleQueryDouble::calls());
    }

    #[DataProvider('ccdaTableProvider')]
    public function testTableListDescribesEachFormTable(string $class): void
    {
        $table = $this->ccdaTable($class);
        ClinicalModuleQueryDouble::on("SHOW TABLES LIKE 'form_%'", [], []);
        self::assertSame([], $table->getTableList());

        ClinicalModuleQueryDouble::on("SHOW TABLES LIKE 'form_%'", [], [['Tables_in_unit (form_%)' => 'form_unit_fixture']]);
        ClinicalModuleQueryDouble::on('DESCRIBE form_unit_fixture', [], [
            ['Field' => 'id', 'Type' => 'bigint'],
            ['Field' => 'unit_note', 'Type' => 'text'],
        ]);
        self::assertSame([
            ['form_unit_fixture', '3|form_unit_fixture', [['id', '3|form_unit_fixture|id'], ['unit_note', '3|form_unit_fixture|unit_note']]],
        ], $table->getTableList());
        self::assertSame([
            ['fetchRecords', "SHOW TABLES LIKE 'form_%'", []],
            ['fetchRecords', "SHOW TABLES LIKE 'form_%'", []],
            ['fetchRecords', 'DESCRIBE form_unit_fixture', []],
        ], ClinicalModuleQueryDouble::calls());
    }

    #[DataProvider('ccdaTableProvider')]
    public function testDocumentCategoriesExcludeRootCategoryAndPrefixId(string $class): void
    {
        $sql = 'SELECT * FROM categories WHERE id != ? ORDER BY NAME ASC';
        ClinicalModuleQueryDouble::on($sql, [1], [['id' => 13, 'name' => "Unit O'Category ✓"]]);

        self::assertSame([["Unit O'Category ✓", '4|13']], $this->ccdaTable($class)->getDocuments());
        self::assertSame([['fetchRecords', $sql, [1]]], ClinicalModuleQueryDouble::calls());
    }

    #[DataProvider('ccdaTableProvider')]
    public function testMappedFieldsResolveDisplayNameAndClassPerFormType(string $class): void
    {
        $sql = 'SELECT *, reg.name AS form_name, lo.title as title, cat.name, cat.id FROM ccda_table_mapping AS tab1 LEFT JOIN ccda_field_mapping AS tab2 ON tab1.id = tab2.table_id LEFT JOIN registry AS reg ON reg.directory = tab1.form_dir LEFT JOIN list_options AS lo ON lo.list_id = ? AND tab1.form_dir=lo.option_id LEFT JOIN categories AS cat ON cat.id = tab1.form_dir WHERE tab1.deleted = ?';
        $table = $this->ccdaTable($class);
        ClinicalModuleQueryDouble::on($sql, ['lbfnames', 0], []);
        self::assertSame([], $table->getMappedFields(0));

        ClinicalModuleQueryDouble::on($sql, ['lbfnames', 0], [
            self::mappingRow('unit_a', '1', 'unit_form', 'form_unit', 'unit_field'),
            self::mappingRow('unit_a', '1', 'unit_form', 'form_unit', null),
            self::mappingRow('unit_a', '1', 'unit_form', '', null, ['form_name' => 'Unit Form']),
            self::mappingRow('unit_b', '2', 'LBFunit', '', 'unit_lbf_field'),
            self::mappingRow('unit_b', '2', 'LBFunit', '', null, ['title' => "Unit O'LBF"]),
            self::mappingRow('unit_b', '3', '13', '', null, ['name' => 'Unit Category', 'id' => 13]),
        ]);
        $base = static fn (string $type, string $dir, string $formTable, ?string $field, mixed $name, string $cls): array => [
            'form_dir' => $dir, 'form_type' => $type, 'form_table' => $formTable, 'ccda_field' => $field, 'name' => $name, 'class' => $cls,
        ];
        self::assertSame(['unit_component' => [
            'unit_a' => [
                0 => $base('1', 'unit_form', 'form_unit', 'unit_field', 'unit_field', '3|unit_form|unit_field'),
                1 => $base('1', 'unit_form', 'form_unit', null, 'form_unit', '1|form_unit'),
                2 => $base('1', 'unit_form', '', null, 'Unit Form', '1|unit_form'),
            ],
            'unit_b' => [
                3 => $base('2', 'LBFunit', '', 'unit_lbf_field', 'unit_lbf_field', '2|LBFunit|unit_lbf_field'),
                4 => $base('2', 'LBFunit', '', null, "Unit O'LBF", '2|LBFunit'),
                5 => $base('3', '13', '', null, 'Unit Category', '4|13'),
            ],
        ]], $table->getMappedFields(0));
        self::assertSame([['fetchRecords', $sql, ['lbfnames', 0]], ['fetchRecords', $sql, ['lbfnames', 0]]], ClinicalModuleQueryDouble::calls());
    }

    #[DataProvider('ccdaTableProvider')]
    public function testMaxTemplateIdIsScopedToDefaultUserAndNullWithoutRows(string $class): void
    {
        $sql = 'select max(id) as id from ccda_table_mapping where user_id=?';
        $table = $this->ccdaTable($class);
        ClinicalModuleQueryDouble::on($sql, [1], []);
        self::assertNull($table->getMaxIdCcda());

        ClinicalModuleQueryDouble::on($sql, [1], [['id' => 77]]);
        self::assertSame(77, $table->getMaxIdCcda());
        self::assertSame([['fetchRecords', $sql, [1]], ['fetchRecords', $sql, [1]]], ClinicalModuleQueryDouble::calls());
    }

    #[DataProvider('ccdaTableProvider')]
    public function testMappingWritesBindCallerValuesVerbatimAndMasterReturnsNewestId(string $class): void
    {
        $master = ['unit_component', 'unit_section', "unit_o'dir", 1, 'form_unit ✓', 1];
        ClinicalModuleQueryDouble::onStatement(self::MAPPING_MASTER_SQL, $master);
        ClinicalModuleQueryDouble::on(self::MAX_ID_SQL, [], [['id' => 78]]);
        ClinicalModuleQueryDouble::onStatement(self::MAPPING_CHILD_SQL, [78, "unit_o'field ✓"]);
        ClinicalModuleQueryDouble::onStatement(self::MAPPING_RETIRE_SQL, [77, 1]);
        $table = $this->ccdaTable($class);

        self::assertSame(78, $table->insertMaster($master));
        $table->insertChild([78, "unit_o'field ✓"]);
        $table->updateExistingMappedFields([77, 1]);

        self::assertSame([
            ['sqlStatementThrowException', self::MAPPING_MASTER_SQL, $master],
            ['fetchRecords', self::MAX_ID_SQL, []],
            ['sqlStatementThrowException', self::MAPPING_CHILD_SQL, [78, "unit_o'field ✓"]],
            ['sqlStatementThrowException', self::MAPPING_RETIRE_SQL, [77, 1]],
        ], ClinicalModuleQueryDouble::calls());
    }

    /**
     * @param list<mixed> $binds
     */
    #[DataProvider('mappingWriteFailureProvider')]
    public function testMappingWriteFailurePropagatesWithoutFurtherQueries(string $class, string $write, string $sql, array $binds): void
    {
        ClinicalModuleQueryDouble::onStatement($sql, $binds);
        ClinicalModuleQueryDouble::on(self::MAX_ID_SQL, [], [['id' => 78]]);
        ClinicalModuleQueryDouble::failOn('sqlStatementThrowException', $sql, $binds);
        $table = $this->ccdaTable($class);

        try {
            match ($write) {
                'insertMaster' => $table->insertMaster($binds),
                'insertChild' => $table->insertChild($binds),
                'updateExistingMappedFields' => $table->updateExistingMappedFields($binds),
                default => throw new LogicException('Unknown mapping write ' . $write),
            };
            self::fail('a failed mapping write must propagate');
        } catch (SqlQueryException) {
        }
        self::assertSame([['sqlStatementThrowException', $sql, $binds]], ClinicalModuleQueryDouble::calls(), 'a failed master insert never reads MAX(id)');
    }

    /**
     * @return array<string, array{string, string, string, list<mixed>}>
     *
     * @codeCoverageIgnore Data providers run before coverage instrumentation starts.
     */
    public static function mappingWriteFailureProvider(): array
    {
        $cases = [];
        foreach (['SetupTable' => SetupTable::class, 'MapperTable' => MapperTable::class] as $label => $class) {
            $cases[$label . ' master insert'] = [$class, 'insertMaster', self::MAPPING_MASTER_SQL, ['unit_component', 'unit_section', 'unit_dir', 1, 'form_unit', 1]];
            $cases[$label . ' child insert'] = [$class, 'insertChild', self::MAPPING_CHILD_SQL, [78, 'unit_field']];
            $cases[$label . ' retire existing'] = [$class, 'updateExistingMappedFields', self::MAPPING_RETIRE_SQL, [77, 1]];
        }
        return $cases;
    }

    /**
     * @return array<string, array{string}>
     *
     * @codeCoverageIgnore Data providers run before coverage instrumentation starts.
     */
    public static function ccdaTableProvider(): array
    {
        return [
            'SetupTable' => [SetupTable::class],
            'MapperTable' => [MapperTable::class],
        ];
    }

    private function allowAuditReplacement(): void
    {
        foreach (self::auditReplacementCalls() as [$method, $sql, $binds]) {
            if ($method === 'sqlInsert') {
                ClinicalModuleQueryDouble::onInsert($sql, $binds, 502);
            } else {
                ClinicalModuleQueryDouble::onStatement($sql, $binds);
            }
        }
    }

    /**
     * @return array<string, mixed>
     */
    private static function auditReplacementInput(): array
    {
        return [
            'audit_master_id_to_delete' => 501,
            'approval_status' => '1',
            'type' => '11',
            'ip_address' => '192.0.2.10',
            'field_name_value_array' => ['patient_data' => [1 => ['sex' => 'Unit']]],
            'entry_identification_array' => ['patient_data' => [1 => '1']],
        ];
    }

    /**
     * The complete ordered replacement of staged import 501 by new master 502.
     *
     * @return list<array{string, string, list<mixed>}>
     */
    private static function auditReplacementCalls(): array
    {
        return [
            ['sqlStatementThrowException', self::DELETE_AUDIT_DETAILS, [501]],
            ['sqlStatementThrowException', self::DELETE_AUDIT_MASTER, [501]],
            ['sqlInsert', self::AUDIT_MASTER_INSERT, [0, '1', '192.0.2.10', '11']],
            ['sqlStatementThrowException', self::AUDIT_DETAILS_PREFIX . '(? ,? ,? ,? ,?);', ['patient_data', 'sex', 'Unit', 502, '1']],
        ];
    }

    /**
     * Synthetic ccda_table_mapping join row; unlisted join columns are null.
     *
     * @param array<string, string|int> $joined
     * @return array<string, mixed>
     */
    private static function mappingRow(string $section, string $type, string $dir, string $formTable, ?string $field, array $joined = []): array
    {
        return array_replace([
            'ccda_component' => 'unit_component',
            'ccda_component_section' => $section,
            'form_dir' => $dir,
            'form_type' => $type,
            'form_table' => $formTable,
            'ccda_field' => $field,
            'form_name' => null,
            'title' => null,
            'name' => null,
            'id' => null,
        ], $joined);
    }

    private function ccdaTable(string $class): SetupTable|MapperTable
    {
        return match ($class) {
            SetupTable::class => new SetupTable(),
            MapperTable::class => new MapperTable(),
            default => throw new LogicException('Unknown CCDA table class ' . $class),
        };
    }

    /**
     * @param array{pid: int, audit_master_id: int} $data
     * @return array<mixed>
     */
    private function readPatient(CcrTable $table, string $reader, array $data): array
    {
        $rows = match ($reader) {
            'getDemographics' => $table->getDemographics($data),
            'getDemographicsOld' => $table->getDemographicsOld($data),
            'getProblems' => $table->getProblems($data),
            'getAllergies' => $table->getAllergies($data),
            'getMedications' => $table->getMedications($data),
            'getImmunizations' => $table->getImmunizations($data),
            'getLabResults' => $table->getLabResults($data),
            default => throw new LogicException('Unknown patient reader ' . $reader),
        };
        self::assertIsArray($rows);
        return $rows;
    }
}
