<?php

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\RestControllers;

use OpenEMR\BC\ServiceContainer;
use OpenEMR\RestControllers\TransactionRestController;
use OpenEMR\Services\PatientTransactionService;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;
use Psr\Log\NullLogger;
use ReflectionProperty;

class TransactionValidationWriteBoundaryTest extends TestCase
{
    private int|false $previousHttpStatus;
    /** @var array<array-key, mixed> */
    private array $previousServiceOverrides;
    /** @var array<array-key, mixed> */
    private array $previousServiceCache;

    protected function setUp(): void
    {
        // Loading BaseService otherwise loads code_types from the database.
        if (!defined('OPENEMR_STATIC_ANALYSIS')) {
            define('OPENEMR_STATIC_ANALYSIS', true);
        }

        $this->previousHttpStatus = http_response_code();
        $overrides = new ReflectionProperty(ServiceContainer::class, 'overrides');
        $cache = new ReflectionProperty(ServiceContainer::class, 'cache');
        $previousServiceOverrides = $overrides->getValue();
        $previousServiceCache = $cache->getValue();
        self::assertIsArray($previousServiceOverrides);
        self::assertIsArray($previousServiceCache);
        $this->previousServiceOverrides = $previousServiceOverrides;
        $this->previousServiceCache = $previousServiceCache;
        ServiceContainer::override(LoggerInterface::class, new NullLogger());
    }

    protected function tearDown(): void
    {
        (new ReflectionProperty(ServiceContainer::class, 'overrides'))
            ->setValue(null, $this->previousServiceOverrides);
        (new ReflectionProperty(ServiceContainer::class, 'cache'))
            ->setValue(null, $this->previousServiceCache);
        if ($this->previousHttpStatus !== false) {
            http_response_code($this->previousHttpStatus);
        }
    }

    /** @return array<string, array{array<string, mixed>, array<string, string>}> */
    public static function invalidReferralProvider(): array
    {
        return [
            'missing referral date' => [['referralDate' => null], ['referralDate' => 'Required::NON_EXISTENT_KEY']],
            'invalid referral date' => [['referralDate' => 'not-a-date'], ['referralDate' => 'DateTime::INVALID_VALUE']],
            'missing body' => [['body' => null], ['body' => 'Required::NON_EXISTENT_KEY']],
            'body below two bytes' => [['body' => 'x'], ['body' => 'LengthBetween::TOO_SHORT']],
            'body above 150 bytes' => [['body' => str_repeat('x', 151)], ['body' => 'LengthBetween::TOO_LONG']],
            'body above 150 UTF-8 bytes' => [['body' => str_repeat('é', 75) . 'x'], ['body' => 'LengthBetween::TOO_LONG']],
            'missing group name' => [['groupname' => null], ['groupname' => 'Required::NON_EXISTENT_KEY']],
            'empty group name' => [['groupname' => ''], ['groupname' => 'NotEmpty::EMPTY_VALUE']],
            'non-string group name' => [['groupname' => 123], ['groupname' => 'IsString::NOT_A_STRING']],
            'missing referring NPI' => [['referByNpi' => null], ['referByNpi' => 'Required::NON_EXISTENT_KEY']],
            'empty referring NPI' => [['referByNpi' => ''], ['referByNpi' => 'NotEmpty::EMPTY_VALUE']],
            'non-string referring NPI' => [['referByNpi' => 123], ['referByNpi' => 'IsString::NOT_A_STRING']],
            'several missing fields' => [
                ['referralDate' => null, 'body' => null, 'groupname' => null, 'referByNpi' => null],
                [
                    'referralDate' => 'Required::NON_EXISTENT_KEY',
                    'body' => 'Required::NON_EXISTENT_KEY',
                    'groupname' => 'Required::NON_EXISTENT_KEY',
                    'referByNpi' => 'Required::NON_EXISTENT_KEY',
                ],
            ],
        ];
    }

    /**
     * @param array<string, mixed> $changes
     * @param array<string, string> $expectedRules
     */
    #[DataProvider('invalidReferralProvider')]
    public function testInvalidReferralDoesNotInsertAndReturnsValidationEnvelope(
        array $changes,
        array $expectedRules
    ): void {
        $data = self::validReferral();
        foreach ($changes as $field => $value) {
            if ($value === null) {
                unset($data[$field]);
            } else {
                $data[$field] = $value;
            }
        }

        $service = $this->serviceExpectingNoInsert();
        $response = $this->controllerWithService($service)->CreateTransaction('patient-123', $data);

        self::assertSame(400, http_response_code());
        self::assertSame(['validationErrors', 'internalErrors', 'data', 'links'], array_keys($response));
        self::assertSame([], $response['internalErrors']);
        self::assertSame([], $response['data']);
        self::assertSame([], $response['links']);
        $validationErrors = $response['validationErrors'];
        self::assertIsArray($validationErrors);
        self::assertSame(array_keys($expectedRules), array_keys($validationErrors));
        foreach ($expectedRules as $field => $rule) {
            self::assertArrayHasKey($field, $validationErrors);
            $fieldErrors = $validationErrors[$field];
            self::assertIsArray($fieldErrors);
            self::assertArrayHasKey($rule, $fieldErrors);
        }
    }

    /** @return array<string, array{string}> */
    public static function validBodyBoundaryProvider(): array
    {
        return [
            'two bytes' => ['ab'],
            '150 bytes' => [str_repeat('x', 150)],
            '150 UTF-8 bytes' => [str_repeat('é', 75)],
        ];
    }

    #[DataProvider('validBodyBoundaryProvider')]
    public function testValidBodyBoundaryInsertsExactPayload(string $body): void
    {
        $data = self::validReferral();
        $data['body'] = $body;
        $this->assertSuccessfulInsert($data);
    }

    public function testValidReferralForwardsOptionalAndUnknownFieldsUnmodified(): void
    {
        $data = self::validReferral() + [
            'referToNpi' => '8888888888',
            'riskLevel' => 'High',
            'includeVitals' => '1',
            'authorization' => 'Auth_123',
            'visits' => '3',
            'validFrom' => '2026-01-01',
            'validThrough' => '2026-12-31',
            'unknownClientField' => ['retained' => true],
        ];

        $this->assertSuccessfulInsert($data);
    }

    public function testOtherExistingTransactionTypePassesThrough(): void
    {
        $this->assertSuccessfulInsert(['type' => 'Referral', 'message' => 'Please call back']);
    }

    /** @return array<string, string> */
    private static function validReferral(): array
    {
        return [
            'type' => 'LBTref',
            'referralDate' => '2026-10-24',
            'body' => 'Referral reason',
            'groupname' => 'Default',
            'referByNpi' => '9999999999',
        ];
    }

    /** @param array<string, mixed> $data */
    private function assertSuccessfulInsert(array $data): void
    {
        $result = ['id' => 41, 'form_id' => 57];
        $service = $this->getMockBuilder(PatientTransactionService::class)
            ->disableOriginalConstructor()
            ->onlyMethods(['insert'])
            ->getMock();
        $service->expects(self::once())
            ->method('insert')
            ->with('patient-123', $data)
            ->willReturn($result);

        $previousGet = $_GET;
        $hadRedirectUrl = array_key_exists('REDIRECT_URL', $_SERVER);
        $previousRedirectUrl = $_SERVER['REDIRECT_URL'] ?? null;
        $hadSiteAddress = array_key_exists('site_addr_oath', $GLOBALS);
        $previousSiteAddress = $GLOBALS['site_addr_oath'] ?? null;
        $_GET = [];
        $_SERVER['REDIRECT_URL'] = '/api/patient/patient-123/transaction';
        $GLOBALS['site_addr_oath'] = '';

        try {
            $response = $this->controllerWithService($service)->CreateTransaction('patient-123', $data);
        } finally {
            $_GET = $previousGet;
            if ($hadRedirectUrl) {
                $_SERVER['REDIRECT_URL'] = $previousRedirectUrl;
            } else {
                unset($_SERVER['REDIRECT_URL']);
            }
            if ($hadSiteAddress) {
                $GLOBALS['site_addr_oath'] = $previousSiteAddress;
            } else {
                unset($GLOBALS['site_addr_oath']);
            }
        }

        self::assertSame(201, http_response_code());
        self::assertSame(['validationErrors', 'internalErrors', 'data', 'links'], array_keys($response));
        self::assertSame([], $response['validationErrors']);
        self::assertSame([], $response['internalErrors']);
        self::assertSame([$result], $response['data']);
        self::assertSame(
            ['first' => '/api/patient/patient-123/transaction?&_offset=0&_count=0'],
            $response['links']
        );
    }

    private function serviceExpectingNoInsert(): PatientTransactionService&MockObject
    {
        $service = $this->getMockBuilder(PatientTransactionService::class)
            ->disableOriginalConstructor()
            ->onlyMethods(['insert'])
            ->getMock();
        $service->expects(self::never())->method('insert');
        return $service;
    }

    private function controllerWithService(PatientTransactionService $service): TransactionRestController
    {
        $controller = (new \ReflectionClass(TransactionRestController::class))->newInstanceWithoutConstructor();
        (new ReflectionProperty(TransactionRestController::class, 'patientTransactionService'))
            ->setValue($controller, $service);
        return $controller;
    }
}
