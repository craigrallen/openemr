<?php

/**
 * Explicit, honest coverage manifest of user-visible entry types.
 *
 * Built from a read-only inventory of the Railway testing runtime (OpenEMR
 * 8.5.0, schema 546, 2026-10-02): `registry` (18 enabled encounter forms),
 * `layout_group_properties` (8 active layouts, no LBF visit forms),
 * `openemr_postcalendar_categories` (15), `list_options` apptstat (18),
 * `issue_types`, `categories` (34 document categories) and `modules`.
 * `inventory` mode re-reads those tables and reports anything unclassified.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Demo\Seed;

final class CoverageManifest
{
    /** @return list<CoverageEntry> */
    public static function entries(): array
    {
        $s = CoverageStatus::Seeded;
        $g = CoverageStatus::Gap;
        $n = CoverageStatus::NotApplicable;
        return [
            // Administration / reference entities
            new CoverageEntry('facility', 'Facility', 'Admin > Clinic > Facilities', 'facility', $s),
            new CoverageEntry('user:provider', 'Providers and staff (no login)', 'Admin > Users', 'users', $s),
            new CoverageEntry('user:login', 'Login credentials for synthetic staff', 'Admin > Users', 'users_secure', $g, 'Requires random secret-only credentials issued by the controller; the seeder never creates passwords.'),
            new CoverageEntry('insurance_company', 'Insurance companies', 'Admin > Practice > Insurance Companies', 'insurance_companies', $s),
            new CoverageEntry('procedure_provider', 'Lab (procedure provider, no transport)', 'Procedures > Providers', 'procedure_providers', $s),
            new CoverageEntry('procedure_type', 'Lab order catalogue', 'Procedures > Configuration', 'procedure_type', $s),
            // Patient chart: layouts
            new CoverageEntry('lbf:DEM', 'Demographics', 'Patient > Dashboard', 'patient_data', $s),
            new CoverageEntry('lbf:HIS', 'History', 'Patient > History', 'history_data', $s),
            new CoverageEntry('lbf:LBTref', 'Transaction: Referral', 'Patient > Transactions', 'transactions,lbt_data', $s),
            new CoverageEntry('lbf:LBTptreq', 'Transaction: Patient Request', 'Patient > Transactions', 'transactions,lbt_data', $s),
            new CoverageEntry('lbf:LBTphreq', 'Transaction: Physician Request', 'Patient > Transactions', 'transactions,lbt_data', $s),
            new CoverageEntry('lbf:LBTlegal', 'Transaction: Legal', 'Patient > Transactions', 'transactions,lbt_data', $s),
            new CoverageEntry('lbf:LBTbill', 'Transaction: Billing', 'Patient > Transactions', 'transactions,lbt_data', $s),
            new CoverageEntry('lbf:FACUSR', 'Facility Specific User Information', 'Admin > Users', 'facility_user_ids', $g, 'Per-user facility attributes (admin configuration, no clinical content); not seeded.'),
            new CoverageEntry('insurance_data', 'Patient insurance (primary/secondary)', 'Patient > Dashboard > Insurance', 'insurance_data', $s),
            // Issues
            new CoverageEntry('issue:medical_problem', 'Problems', 'Patient > Issues', 'lists', $s),
            new CoverageEntry('issue:allergy', 'Allergies', 'Patient > Issues', 'lists', $s),
            new CoverageEntry('issue:medication', 'Medications (list)', 'Patient > Issues', 'lists', $s),
            new CoverageEntry('issue:surgery', 'Surgeries', 'Patient > Issues', 'lists', $s),
            new CoverageEntry('issue:dental', 'Dental issues', 'Patient > Issues', 'lists', $s),
            new CoverageEntry('issue:medical_device', 'Devices', 'Patient > Issues', 'lists', $s),
            new CoverageEntry('issue:health_concern', 'Health concerns', 'Patient > Issues', 'lists', $s),
            new CoverageEntry('issue_encounter', 'Issue linked to encounter', 'Encounter > Issues', 'issue_encounter', $s),
            new CoverageEntry('prescription', 'Prescriptions (not transmitted)', 'Patient > Prescriptions', 'prescriptions', $s),
            new CoverageEntry('immunization', 'Immunizations', 'Patient > Immunizations', 'immunizations', $s),
            new CoverageEntry('document', 'Documents (synthetic text files)', 'Patient > Documents', 'documents,categories_to_documents', $s),
            new CoverageEntry('message:internal', 'Internal patient messages', 'Messages', 'pnotes', $s),
            new CoverageEntry('message:office_note', 'Office notes', 'Miscellaneous > Office Notes', 'onotes', $s),
            new CoverageEntry('message:dated_reminder', 'Dated reminders', 'Messages > Reminders', 'dated_reminders', $g, 'Not seeded in this pass.'),
            // Encounter forms (registry, enabled)
            new CoverageEntry('form:newpatient', 'Encounter (New Encounter Form)', 'Encounter', 'form_encounter,forms', $s),
            new CoverageEntry('form:vitals', 'Vitals', 'Encounter > Clinical', 'form_vitals', $s),
            new CoverageEntry('form:soap', 'SOAP', 'Encounter > Clinical', 'form_soap', $s),
            new CoverageEntry('form:ros', 'Review Of Systems', 'Encounter > Clinical', 'form_ros', $s),
            new CoverageEntry('form:reviewofs', 'Review of Systems Checks', 'Encounter > Clinical', 'form_reviewofs', $s),
            new CoverageEntry('form:clinical_notes', 'Clinical Notes', 'Encounter > Clinical', 'form_clinical_notes', $s),
            new CoverageEntry('form:care_plan', 'Care Plan', 'Encounter > Clinical', 'form_care_plan', $s),
            new CoverageEntry('form:observation', 'Observation', 'Encounter > Clinical', 'form_observation', $s),
            new CoverageEntry('form:functional_cognitive_status', 'Functional and Cognitive Status', 'Encounter > Clinical', 'form_functional_cognitive_status', $s),
            new CoverageEntry('form:clinical_instructions', 'Clinical Instructions', 'Encounter > Clinical', 'form_clinical_instructions', $s),
            new CoverageEntry('form:dictation', 'Speech Dictation', 'Encounter > Clinical', 'form_dictation', $s),
            new CoverageEntry('form:misc_billing_options', 'Misc Billing Options HCFA', 'Encounter > Administrative', 'form_misc_billing_options', $s),
            new CoverageEntry('form:fee_sheet', 'Fee Sheet (charges)', 'Encounter > Administrative', 'billing', $s),
            new CoverageEntry('form:procedure_order', 'Procedure Order + report + results', 'Encounter > Orders', 'procedure_order,procedure_order_code,procedure_report,procedure_result', $s),
            new CoverageEntry('form:eye_mag', 'Eye Exam', 'Encounter > Clinical', 'form_eye_*', $g, 'Spans 15+ form_eye_* tables with interdependent state; no verified minimal record yet.'),
            new CoverageEntry('form:questionnaire_assessments', 'New Questionnaire', 'Encounter > Questionnaires', 'form_questionnaire_assessments', $g, 'Requires a registered questionnaire resource; none exists in questionnaire_repository.'),
            new CoverageEntry('form:group_attendance', 'Group Attendance Form', 'Group encounter', 'form_group_attendance', $n, 'Group therapy disabled (enable_group_therapy=0).'),
            new CoverageEntry('form:newGroupEncounter', 'New Group Encounter Form', 'Group encounter', 'form_groups_encounter', $n, 'Group therapy disabled (enable_group_therapy=0).'),
            // Calendar
            new CoverageEntry('appointment:new_patient', 'Appointment: New Patient', 'Calendar', 'openemr_postcalendar_events', $s),
            new CoverageEntry('appointment:established_patient', 'Appointment: Established Patient', 'Calendar', 'openemr_postcalendar_events', $s),
            new CoverageEntry('appointment:office_visit', 'Appointment: Office Visit', 'Calendar', 'openemr_postcalendar_events', $s),
            new CoverageEntry('appointment:preventive_care_services', 'Appointment: Preventive Care', 'Calendar', 'openemr_postcalendar_events', $s),
            new CoverageEntry('appointment:health_and_behavioral_assessment', 'Appointment: Health and Behavioral Assessment', 'Calendar', 'openemr_postcalendar_events', $s),
            new CoverageEntry('appointment:ophthalmological_services', 'Appointment: Ophthalmological Services', 'Calendar', 'openemr_postcalendar_events', $s),
            new CoverageEntry('appointment:statuses', 'Statuses: none/arrived/in-room/checked-out/cancelled/cancelled<24h/no-show/pending', 'Calendar / Flow Board', 'openemr_postcalendar_events', $s),
            new CoverageEntry('appointment:double_booking', 'Overlapping appointment (conflict)', 'Calendar', 'openemr_postcalendar_events', $s),
            new CoverageEntry('calendar:provider_blocks', 'Provider blocks: In Office/Lunch (recurring), Out Of Office, Vacation, Reserved', 'Calendar', 'openemr_postcalendar_events', $s),
            new CoverageEntry('calendar:clinic_closed', 'Clinic Closed / Holiday', 'Calendar', 'openemr_postcalendar_events', $s),
            new CoverageEntry('appointment:no_show_category', 'No Show category', 'Calendar', 'openemr_postcalendar_events', $s),
            new CoverageEntry('appointment:video', 'Video visit', 'Calendar', 'openemr_postcalendar_events', $g, 'No telehealth category or module is installed; not invented.'),
            new CoverageEntry('appointment:group_therapy', 'Group Therapy appointment', 'Calendar', 'openemr_postcalendar_events', $n, 'Group therapy disabled.'),
            // Financial
            new CoverageEntry('payment:patient', 'Patient payment (posted)', 'Fees > Payment', 'ar_session,ar_activity', $s),
            new CoverageEntry('payment:insurance', 'Insurance payment + adjustment (manual EOB)', 'Fees > Payment', 'ar_session,ar_activity', $s),
            new CoverageEntry('payment:front_desk_copay', 'Front-desk copay receipt', 'Fees > Front Payment', 'payments', $s),
            new CoverageEntry('claim:x12', 'Claim batches / X12 submission', 'Fees > Billing Manager', 'x12_partners,claims', $g, 'Charges are unbilled; no X12 partner exists and nothing is generated or sent.'),
            // Deliberately excluded
            new CoverageEntry('erx', 'Electronic prescribing', 'Patient > Prescriptions', '-', $n, 'eRx disabled (erx_enable=0); nothing is transmitted.'),
            new CoverageEntry('portal', 'Patient portal content', 'Portal', '-', $n, 'Portal disabled (portal_onsite_two_enable=0).'),
            new CoverageEntry('dispensing', 'Drug inventory / dispensing', 'Inventory', 'drugs,drug_sales', $n, 'In-house pharmacy disabled (inhouse_pharmacy=0).'),
            new CoverageEntry('ccda', 'CCDA/CCR documents', 'Patient > Documents', 'documents', $g, 'Generated documents are not fabricated.'),
            new CoverageEntry('patient_contacts', 'Employer, contacts and care team', 'Patient > Dashboard', 'employer_data,contact,care_teams', $g, 'Not seeded in this pass.'),
        ];
    }

    /**
     * Registry directories and LBF ids from a live inventory that the manifest does not classify.
     *
     * @param list<string> $registryDirectories enabled `registry.directory` values
     * @param list<string> $lbfFormIds active `layout_group_properties.grp_form_id` values
     * @return list<string>
     */
    public static function unclassified(array $registryDirectories, array $lbfFormIds): array
    {
        $known = array_flip(array_map(static fn(CoverageEntry $e): string => $e->key, self::entries()));
        $missing = [];
        foreach ($registryDirectories as $dir) {
            if (!isset($known["form:{$dir}"])) {
                $missing[] = "form:{$dir}";
            }
        }
        foreach ($lbfFormIds as $id) {
            if (!isset($known["lbf:{$id}"])) {
                $missing[] = "lbf:{$id}";
            }
        }
        return $missing;
    }
}
