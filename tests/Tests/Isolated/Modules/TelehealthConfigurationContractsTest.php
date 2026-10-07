<?php

/**
 * Regression coverage for the public policy/configuration contracts of the
 * unchanged Comlink telehealth module TelehealthGlobalConfig class:
 * third-party invitation opt-in, FHIR webroot path, debug/auto-provision
 * flags, portal address normalisation, core/third-party configuration
 * readiness, the settings schema, the one-time-password timeout cap and the
 * encrypted API password hand-off to the crypto service.
 *
 * Each test runs in its own child process. Crypto and logging are supplied
 * through the existing ServiceContainer override seam (no key files are
 * read), translation is disabled so xl() never reaches the database, and
 * only synthetic unit-fixture globals are set. The footer renderer (MyMailer
 * and database bound) is not invoked.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen <craig@interconnected.au>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\Modules;

use Closure;
use Comlink\OpenEMR\Modules\TeleHealthModule\TelehealthGlobalConfig;
use OpenEMR\BC\ServiceContainer;
use OpenEMR\Common\Crypto\CryptoInterface;
use OpenEMR\Core\OEGlobalsBag;
use OpenEMR\Services\Globals\GlobalSetting;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\PreserveGlobalState;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;
use Psr\Log\NullLogger;
use Twig\Environment;
use Twig\Loader\ArrayLoader;

#[Group('isolated')]
#[Group('modules')]
#[RunTestsInSeparateProcesses]
#[PreserveGlobalState(false)]
final class TelehealthConfigurationContractsTest extends TestCase
{
    // Literal keys: class constants of the not-yet-loaded module class cannot
    // appear in a constant expression evaluated when PHPUnit builds the suite.
    private const REQUIRED_KEYS = [
        'comlink_telehealth_registration_uri',
        'comlink_telehealth_video_uri',
        'comlink_telehealth_user_id',
        'comlink_telehealth_user_password',
        'comlink_telehealth_cms_id',
    ];

    private CryptoInterface&MockObject $crypto;

    /** @var list<string> */
    private array $setKeys = [];

    protected function setUp(): void
    {
        require_once dirname(__DIR__, 4) . '/interface/modules/custom_modules/oe-module-comlink-telehealth/src/TelehealthGlobalConfig.php';
        ServiceContainer::reset();
        $this->crypto = $this->createMock(CryptoInterface::class);
        ServiceContainer::override(CryptoInterface::class, $this->crypto);
        ServiceContainer::override(LoggerInterface::class, new NullLogger());
        $this->setGlobal('disable_translation', true);
    }

    protected function tearDown(): void
    {
        $globals = OEGlobalsBag::getInstance();
        foreach ($this->setKeys as $key) {
            $globals->remove($key);
        }
        ServiceContainer::reset();
    }

    private function setGlobal(string $key, mixed $value): void
    {
        OEGlobalsBag::getInstance()->set($key, $value);
        $this->setKeys[] = $key;
    }

    private function config(): TelehealthGlobalConfig
    {
        return new TelehealthGlobalConfig('/openemr/interface/modules/custom_modules/oe-module-comlink-telehealth/public/', new Environment(new ArrayLoader()));
    }

    private function configureCoreSettings(): void
    {
        foreach (self::REQUIRED_KEYS as $key) {
            $this->setGlobal($key, 'unit-fixture-' . $key);
        }
    }

    public function testThirdPartyInvitationsAreOptInOnlyForTruthyOne(): void
    {
        $config = $this->config();
        self::assertFalse($config->isThirdPartyInvitationsEnabled(), 'missing setting is disabled');
        foreach (['1' => true, '' => false, '0' => false] as $value => $expected) {
            $this->setGlobal(TelehealthGlobalConfig::COMLINK_ENABLE_THIRDPARTY_INVITATIONS, (string) $value);
            self::assertSame($expected, $config->isThirdPartyInvitationsEnabled(), "stored value '{$value}'");
        }
    }

    public function testFhirPathIsInternalWebrootPrefixedAndPublicPathIsPreserved(): void
    {
        $config = $this->config();
        self::assertSame('/apis/fhir/', $config->getFHIRPath(), 'empty webroot yields a root-relative path');
        $this->setGlobal('webroot', '/openemr');
        self::assertSame('/openemr/apis/fhir/', $config->getFHIRPath());
        self::assertSame('/openemr/interface/modules/custom_modules/oe-module-comlink-telehealth/public/', $config->getPublicWebPath());
    }

    public function testDebugAndAutoProvisionFlagsAreOffWhenUnsetAndOnWhenEnabled(): void
    {
        $config = $this->config();
        self::assertFalse($config->isDebugModeEnabled());
        self::assertFalse($config->shouldAutoProvisionProviders());
        $this->setGlobal(TelehealthGlobalConfig::DEBUG_MODE_FLAG, '1');
        $this->setGlobal(TelehealthGlobalConfig::COMLINK_AUTO_PROVISION_PROVIDER, '1');
        self::assertTrue($config->isDebugModeEnabled());
        self::assertTrue($config->shouldAutoProvisionProviders());
    }

    public function testOneTimePasswordTimeoutDefaultsNonPositiveAndCapsAtMaximum(): void
    {
        $config = $this->config();
        self::assertSame('PT15M', $config->getOneTimePasswordTimeoutSetting(), 'unset uses the 15 minute default');
        $cases = ['0' => 'PT15M', '-5' => 'PT15M', 'abc' => 'PT15M', '1' => 'PT1M', '10' => 'PT10M', '30' => 'PT30M', '31' => 'PT30M', '600' => 'PT30M'];
        foreach ($cases as $stored => $expected) {
            $this->setGlobal(TelehealthGlobalConfig::COMLINK_ONETIME_PASSWORD_LOGIN_TIME_LIMIT, (string) $stored);
            self::assertSame($expected, $config->getOneTimePasswordTimeoutSetting(), "stored '{$stored}'");
        }
    }

    public function testCoreSettingsRequireEveryNonOptionalKey(): void
    {
        $config = $this->config();
        self::assertFalse($config->isTelehealthCoreSettingsConfigured());
        $this->configureCoreSettings();
        self::assertTrue($config->isTelehealthCoreSettingsConfigured(), 'optional keys (debug, OTP, subscription, ...) are not required');
        self::assertTrue($config->isTelehealthConfigured(), 'third party disabled needs no portal');

        $logger = $this->createMock(LoggerInterface::class);
        $logger->expects(self::once())->method('debug')->with(
            'Telehealth is missing configuration key',
            ['key' => TelehealthGlobalConfig::COMLINK_VIDEO_TELEHEALTH_CMS_ID]
        );
        ServiceContainer::override(LoggerInterface::class, $logger);
        $this->setGlobal(TelehealthGlobalConfig::COMLINK_VIDEO_TELEHEALTH_CMS_ID, '');
        self::assertFalse($config->isTelehealthCoreSettingsConfigured());
    }

    public function testThirdPartyInvitationsRequireConfiguredPortalAndSiteAddress(): void
    {
        $config = $this->config();
        $this->configureCoreSettings();
        $this->setGlobal(TelehealthGlobalConfig::COMLINK_ENABLE_THIRDPARTY_INVITATIONS, '1');
        self::assertFalse($config->isTelehealthConfigured(), 'portal disabled');

        $this->setGlobal('portal_onsite_two_enable', '1');
        $this->setGlobal('portal_onsite_two_address', 'https://your_web_site.com/openemr/portal');
        $this->setGlobal('qualified_site_addr', 'https://emr.example.test/openemr');
        self::assertFalse($config->isTelehealthConfigured(), 'shipped placeholder portal address is rejected');

        $this->setGlobal('portal_onsite_two_address', 'https://emr.example.test/openemr/portal');
        self::assertTrue($config->isTelehealthConfigured());

        $this->setGlobal('qualified_site_addr', '');
        self::assertFalse($config->isTelehealthConfigured(), 'email links need the qualified site address');
    }

    public function testPortalOnsiteAddressUsesBasePathOrNormalisesConfiguredPortalUrl(): void
    {
        $config = $this->config();
        $this->setGlobal('qualified_site_addr', 'https://emr.example.test/openemr');
        $this->setGlobal('portal_onsite_two_basepath', '1');
        self::assertSame('https://emr.example.test/openemr/portal/patient', $config->getPortalOnsiteAddress());

        $this->setGlobal('portal_onsite_two_basepath', '0');
        $this->setGlobal('portal_onsite_two_address', 'https://portal.example.test/openemr/portal/index.php?site=default');
        self::assertSame('https://portal.example.test/openemr/portal', $config->getPortalOnsiteAddress());
        $this->setGlobal('portal_onsite_two_address', 'https://portal.example.test/openemr/portal/');
        self::assertSame('https://portal.example.test/openemr/portal', $config->getPortalOnsiteAddress());
    }

    public function testMinimizedPositionFallsBackToBottomLeft(): void
    {
        $config = $this->config();
        self::assertSame('bottom-left', $config->getMinimizedSessionDefaultPosition());
        $this->setGlobal(TelehealthGlobalConfig::COMLINK_MINIMIZED_SESSION_POSITION_DEFAULT, 'top-right');
        self::assertSame('top-right', $config->getMinimizedSessionDefaultPosition());
    }

    /**
     * @param array<mixed> $schema
     */
    private static function schemaAttribute(array $schema, string $key, string $attribute): mixed
    {
        $entry = $schema[$key] ?? null;
        self::assertIsArray($entry, $key);
        self::assertArrayHasKey($attribute, $entry, $key);
        return $entry[$attribute];
    }

    public function testSettingsSchemaDeclaresTypesDefaultsAndFooterCallback(): void
    {
        $schema = $this->config()->getGlobalSettingSectionConfiguration();

        self::assertSame(GlobalSetting::DATA_TYPE_ENCRYPTED, self::schemaAttribute($schema, TelehealthGlobalConfig::COMLINK_VIDEO_API_USER_PASSWORD, 'type'));
        self::assertSame('15', self::schemaAttribute($schema, TelehealthGlobalConfig::COMLINK_ONETIME_PASSWORD_LOGIN_TIME_LIMIT, 'default'));
        self::assertSame('1', self::schemaAttribute($schema, TelehealthGlobalConfig::COMLINK_AUTO_PROVISION_PROVIDER, 'default'));
        foreach ([TelehealthGlobalConfig::COMLINK_ENABLE_THIRDPARTY_INVITATIONS, TelehealthGlobalConfig::DEBUG_MODE_FLAG, TelehealthGlobalConfig::COMLINK_ONETIME_PASSWORD_LOGIN] as $optIn) {
            self::assertSame(GlobalSetting::DATA_TYPE_BOOL, self::schemaAttribute($schema, $optIn, 'type'), $optIn);
            self::assertSame('', self::schemaAttribute($schema, $optIn, 'default'), "{$optIn} is off by default");
        }
        $positions = self::schemaAttribute($schema, TelehealthGlobalConfig::COMLINK_MINIMIZED_SESSION_POSITION_DEFAULT, 'type');
        self::assertIsArray($positions);
        self::assertSame(['bottom-left', 'top-left', 'bottom-right', 'top-right'], array_keys($positions));
        self::assertSame(GlobalSetting::DATA_TYPE_HTML_DISPLAY_SECTION, self::schemaAttribute($schema, TelehealthGlobalConfig::COMLINK_SECTION_FOOTER_BOX, 'type'));
        $footerOptions = self::schemaAttribute($schema, TelehealthGlobalConfig::COMLINK_SECTION_FOOTER_BOX, 'options');
        self::assertIsArray($footerOptions);
        self::assertInstanceOf(Closure::class, $footerOptions[GlobalSetting::DATA_TYPE_OPTION_RENDER_CALLBACK] ?? null);
        self::assertArrayNotHasKey(TelehealthGlobalConfig::VERIFY_SETTINGS_BUTTON, $schema);
    }

    public function testRegistrationPasswordIsDecryptedThroughInjectedCryptoAndNonStringsBecomeNull(): void
    {
        $config = $this->config();
        $this->crypto->expects(self::exactly(2))->method('decryptFromDatabase')
            ->willReturnCallback(static fn(?string $value): string => $value === null ? 'null-input' : 'plain:' . $value);

        $this->setGlobal(TelehealthGlobalConfig::COMLINK_VIDEO_API_USER_PASSWORD, 'unit-ciphertext');
        self::assertSame('plain:unit-ciphertext', $config->getRegistrationAPIPassword());
        $this->setGlobal(TelehealthGlobalConfig::COMLINK_VIDEO_API_USER_PASSWORD, 42);
        self::assertSame('null-input', $config->getRegistrationAPIPassword());
    }
}
