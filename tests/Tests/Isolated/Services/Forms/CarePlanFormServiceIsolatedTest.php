<?php

/**
 * Isolated tests for the pure helpers on CarePlanFormService.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Stephen Nielson <snielson@discoverandchange.com>
 * @copyright Copyright (C) 2025 Open Plan IT Ltd. <support@openplanit.com>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\Services\Forms;

use OpenEMR\Services\Forms\CarePlanFormService;
use OpenEMR\Services\FormService;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

#[Group('isolated')]
class CarePlanFormServiceIsolatedTest extends TestCase
{
    private CarePlanFormService $service;

    protected function setUp(): void
    {
        $this->service = new CarePlanFormService($this->createMock(FormService::class));
    }

    #[Test]
    #[DataProvider('parseNoteProvider')]
    public function parseNoteExtractsIssueReferences(string $note, string $expected): void
    {
        self::assertSame($expected, $this->service->parseNote($note));
    }

    #[Test]
    public function parseNoteUsesTheCarePlanFormServiceImplementation(): void
    {
        $method = new ReflectionMethod($this->service, 'parseNote');

        self::assertSame(
            realpath(dirname(__DIR__, 5) . '/src/Services/Forms/CarePlanFormService.php'),
            $method->getFileName()
        );
    }

    /**
     * @return array<string, array{string, string}>
     *
     * @codeCoverageIgnore Data providers run before coverage instrumentation starts.
     */
    public static function parseNoteProvider(): array
    {
        return [
            'no markers' => ['just a plain description', '[]'],
            'empty string' => ['', '[]'],
            'single marker' => ['see {|Diabetes|} today', '["Diabetes"]'],
            'empty marker' => ['{||}', '[""]'],
            'separated markers' => [
                '{|Asthma|} and {|COPD|}',
                '["Asthma","COPD"]',
            ],
            'adjacent markers' => ['{|Asthma|}{|COPD|}', '["Asthma","COPD"]'],
            'duplicate markers retain order' => ['{|A|} {|B|} {|A|}', '["A","B","A"]'],
            'multiple empty markers' => ['{||} and {||}', '["",""]'],
            'Unicode markers' => ['{|Hjärta|} {|糖尿病|}', '["Hj\\u00e4rta","\\u7cd6\\u5c3f\\u75c5"]'],
            'multiline description' => ["{|First|}\nnext line {|Second|}", '["First","Second"]'],
            'newline within marker' => ["{|First\nSecond|}", '["First\\nSecond"]'],
            'pipe within marker' => ['{|A|B|} {|C|}', '["A|B","C"]'],
            'stray closing delimiters' => ['|} {|A|} |}', '["A"]'],
            'malformed closing delimiter' => ['{|broken} and {|Good|}', '["broken} and {|Good"]'],
            'unclosed marker' => ['{|unfinished', '[]'],
            'complete then unclosed marker' => ['{|A|} {|unfinished', '["A"]'],
            'closing bracket remains a barrier' => ['{|A]B|}', '[]'],
            'valid marker after rejected bracket marker' => ['{|bad]marker|} text {|Good|}', '["Good"]'],
            'invalid UTF-8 falls back to empty JSON array' => ["{|\xB1|}", '[]'],
        ];
    }

    #[Test]
    #[DataProvider('normalizeNullableStringProvider')]
    public function normalizeNullableStringTrimsAndNullsBlanks(string $value, ?string $expected): void
    {
        self::assertSame($expected, $this->service->normalizeNullableString($value));
    }

    /**
     * @return array<string, array{string, string|null}>
     *
     * @codeCoverageIgnore Data providers run before coverage instrumentation starts.
     */
    public static function normalizeNullableStringProvider(): array
    {
        return [
            'empty string' => ['', null],
            'whitespace only' => ['   ', null],
            'padded value' => ['  2026-01-05 09:00  ', '2026-01-05 09:00'],
            'plain value' => ['2026-01-05 09:00', '2026-01-05 09:00'],
        ];
    }
}
