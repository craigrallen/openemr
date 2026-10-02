<?php

/**
 * Storage conventions of the registry encounter forms the seeder writes,
 * taken from each form's save.php / service in this codebase.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Demo\Seed;

final class FormCatalog
{
    public const TRANSACTION_LAYOUTS = ['LBTref', 'LBTptreq', 'LBTphreq', 'LBTlegal', 'LBTbill'];

    /**
     * formdir => [table, forms.form_name, grouping, base-column style]
     * grouping: single (forms.form_id = row id), form_id (rows share a form_id column),
     *           id (rows share the non-unique id column).
     * style: std (date,pid,user,groupname,authorized,activity), ros, instr, notes (adds encounter),
     *
     * @var array<string, array{string, string, string, string}>
     */
    private const FORMS = [
        'vitals' => ['form_vitals', 'Vitals', 'single', 'std'],
        'soap' => ['form_soap', 'SOAP', 'single', 'std'],
        'ros' => ['form_ros', 'Review Of Systems', 'single', 'ros'],
        'reviewofs' => ['form_reviewofs', 'Review of Systems Checks', 'single', 'std'],
        'dictation' => ['form_dictation', 'Speech Dictation', 'single', 'std'],
        'misc_billing_options' => ['form_misc_billing_options', 'Misc Billing Options', 'single', 'std+enc'],
        'clinical_instructions' => ['form_clinical_instructions', 'Clinical Instructions', 'single', 'instr'],
        'clinical_notes' => ['form_clinical_notes', 'Clinical Notes Form', 'form_id', 'notes'],
        'observation' => ['form_observation', 'Observation Form', 'form_id', 'notes'],
        'care_plan' => ['form_care_plan', 'Care Plan Form', 'id', 'notes'],
        'functional_cognitive_status' => ['form_functional_cognitive_status', 'Functional and Cognitive Status Form', 'id', 'notes'],
    ];

    /** Tables whose rows carry a registered binary uuid. */
    public const UUID_TABLES = ['form_vitals', 'form_clinical_notes', 'form_observation'];

    public static function isSeedable(string $formdir): bool
    {
        return isset(self::FORMS[$formdir]);
    }

    /** @return array{string, string, string, string} */
    public static function get(string $formdir): array
    {
        return self::FORMS[$formdir] ?? throw new InvalidFixtureException("Form '{$formdir}' is not seedable.");
    }

    /** @return list<string> */
    public static function formdirs(): array
    {
        return array_keys(self::FORMS);
    }

    /** Column that forms.form_id refers to in the form table. */
    public static function linkColumn(string $formdir): string
    {
        return match (self::get($formdir)[2]) {
            'form_id' => 'form_id',
            default => 'id',
        };
    }
}
