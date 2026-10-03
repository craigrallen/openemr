<?php

/**
 * Renders interface/main/tabs/templates/patient_data_template.php without a
 * database or session so Jest can bind the real Knockout template.
 *
 * The real xlt()/xla() helpers are loaded; the globals stub reports
 * disable_translation=true so xl() only runs xlCleanup() and never touches
 * the session or the database.
 *
 * Usage: php patient-data-template-harness.php <btn|text-large|default>
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen <craig@interconnected.au>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Js\Fixtures {
    final class PatientDataTemplateKernelStub
    {
        public function getImagesRelative(): string
        {
            return '/images';
        }
    }

    final class PatientDataTemplateGlobalsStub
    {
        private static ?self $instance = null;

        public function __construct(private readonly string $nameDisplay)
        {
        }

        public static function configure(string $nameDisplay): void
        {
            self::$instance = new self($nameDisplay);
        }

        public static function getInstance(): self
        {
            return self::$instance ?? throw new \LogicException('Harness not configured');
        }

        public function get(string $key): ?string
        {
            return $key === 'patient_name_display' ? $this->nameDisplay : null;
        }

        public function getBoolean(string $key): bool
        {
            return $key === 'disable_translation';
        }

        public function getKernel(): PatientDataTemplateKernelStub
        {
            return new PatientDataTemplateKernelStub();
        }
    }
}

namespace {
    use OpenEMR\Tests\Js\Fixtures\PatientDataTemplateGlobalsStub;

    // Only alias and render when run as the standalone CLI harness; requiring
    // this file (e.g. from PHPUnit) just defines the namespaced stub classes.
    $harnessScript = $_SERVER['SCRIPT_FILENAME'] ?? '';
    if (is_string($harnessScript) && realpath($harnessScript) === __FILE__) {
        $variant = $argv[1] ?? 'default';
        if (!in_array($variant, ['btn', 'text-large', 'default'], true)) {
            throw new \InvalidArgumentException('Variant must be one of btn, text-large, default');
        }
        PatientDataTemplateGlobalsStub::configure($variant);
        class_alias(PatientDataTemplateGlobalsStub::class, \OpenEMR\Core\OEGlobalsBag::class);
        require __DIR__ . '/../../../library/htmlspecialchars.inc.php';
        require __DIR__ . '/../../../library/translation.inc.php';
        require __DIR__ . '/../../../interface/main/tabs/templates/patient_data_template.php';
    }
}
