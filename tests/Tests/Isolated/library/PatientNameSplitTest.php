<?php

/**
 * Native patient-name search splitting, without a database or clinical bootstrap.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\library;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../../../library/patient.inc.php';

final class PatientNameSplitTest extends TestCase
{
    /** @param array<string, string> $expected */
    #[DataProvider('existingBehaviorProvider')]
    public function testPreservesExistingSearchTerms(string $term, array $expected): void
    {
        self::assertSame($expected, getPatientNameSplit($term));
    }

    /**
     * These inputs already have defined outputs. In particular, empty() treats
     * the single token "0" as a wildcard, and comma syntax retains an empty
     * first-name key rather than falling back to the no-comma wildcard.
     *
     * @return iterable<string, array{string, array<string, string>}>
     */
    public static function existingBehaviorProvider(): iterable
    {
        yield 'empty input' => ['', ['last' => '%']];
        yield 'ASCII spaces only' => ['   ', ['last' => '%']];
        yield 'single zero becomes wildcard' => ['0', ['last' => '%']];
        yield 'single literal percent' => ['%', ['last' => '%']];
        yield 'single literal underscore' => ['_', ['last' => '_']];
        yield 'one token keeps case and accent' => ['Élodie', ['last' => 'Élodie']];
        yield 'two tokens' => ['Ada Lovelace', ['first' => 'Ada', 'last' => 'Lovelace']];
        yield 'three tokens' => ['Ada Byron Lovelace', ['first' => 'Ada', 'middle' => 'Byron', 'last' => 'Lovelace']];
        yield 'four tokens ignore interior names' => ['Ada Augusta Byron Lovelace', ['first' => 'Ada', 'last' => 'Lovelace']];
        yield 'outer whitespace is trimmed' => [" \tAda Lovelace\n", ['first' => 'Ada', 'last' => 'Lovelace']];
        yield 'hyphen apostrophe and wildcard characters stay literal' => ["Anne-Marie D'Arcy_%", ['first' => 'Anne-Marie', 'last' => "D'Arcy_%"]];
        yield 'comma only' => [',', ['last' => '', 'first' => '']];
        yield 'empty comma suffix' => ['Smith,', ['last' => 'Smith', 'first' => '']];
        yield 'empty surname' => [',Ada', ['last' => '', 'first' => 'Ada']];
        yield 'comma first only' => ['Smith,Ada', ['last' => 'Smith', 'first' => 'Ada']];
        yield 'comma first and middle' => ['Smith,Ada Byron', ['last' => 'Smith', 'first' => 'Ada', 'middle' => 'Byron']];
        yield 'comma ignores later given tokens' => ['Smith,Ada Byron Augusta', ['last' => 'Smith', 'first' => 'Ada', 'middle' => 'Byron']];
        yield 'extra comma is ignored' => ['Smith,Ada,Byron', ['last' => 'Smith', 'first' => 'Ada']];
        yield 'empty second comma field stays empty' => ['Smith,,Ada', ['last' => 'Smith', 'first' => '']];
        yield 'surname side keeps internal ASCII spacing' => ['  Van  Dyke  , Ada ', ['last' => 'Van  Dyke', 'first' => 'Ada']];
        yield 'comma suffix edge spaces are trimmed' => ['Smith,  Ada  ', ['last' => 'Smith', 'first' => 'Ada']];
        yield 'comma wildcards stay literal' => ['Sm_th%,A_a%', ['last' => 'Sm_th%', 'first' => 'A_a%']];
        yield 'tab does not separate names' => ["Ada\tLovelace", ['last' => "Ada\tLovelace"]];
        yield 'newline does not separate names' => ["Ada\nLovelace", ['last' => "Ada\nLovelace"]];
        yield 'nonbreaking space does not separate names' => ["Ada\u{00A0}Lovelace", ['last' => "Ada\u{00A0}Lovelace"]];
        yield 'em space does not separate names' => ["Ada\u{2003}Lovelace", ['last' => "Ada\u{2003}Lovelace"]];
        yield 'comma suffix tab stays within first token' => ["Smith,Ada\tByron", ['last' => 'Smith', 'first' => "Ada\tByron"]];
        yield 'comma suffix newline stays within first token' => ["Smith,Ada\nByron", ['last' => 'Smith', 'first' => "Ada\nByron"]];
        yield 'comma suffix nonbreaking space stays within first token' => ["Smith,Ada\u{00A0}Byron", ['last' => 'Smith', 'first' => "Ada\u{00A0}Byron"]];
    }

    /** @param array<string, string> $expected */
    #[DataProvider('repeatedAsciiSpaceProvider')]
    public function testRepeatedAsciiSpacesSeparateGivenNameTokens(string $term, array $expected): void
    {
        self::assertSame($expected, getPatientNameSplit($term));
    }

    /**
     * Consecutive U+0020 spaces in the given-name sequence act as one
     * separator. Comma surnames, additional given tokens, and all other
     * whitespace retain their existing treatment.
     *
     * @return iterable<string, array{string, array<string, string>}>
     */
    public static function repeatedAsciiSpaceProvider(): iterable
    {
        yield 'two non-comma tokens' => ['Ada  Lovelace', ['first' => 'Ada', 'last' => 'Lovelace']];
        yield 'three non-comma tokens with first gap repeated' => ['Ada  Byron Lovelace', ['first' => 'Ada', 'middle' => 'Byron', 'last' => 'Lovelace']];
        yield 'three non-comma tokens with second gap repeated' => ['Ada Byron   Lovelace', ['first' => 'Ada', 'middle' => 'Byron', 'last' => 'Lovelace']];
        yield 'three non-comma tokens with both gaps repeated' => ['Ada  Byron   Lovelace', ['first' => 'Ada', 'middle' => 'Byron', 'last' => 'Lovelace']];
        yield 'four non-comma tokens still ignore interior names' => ['Ada  Augusta Byron   Lovelace', ['first' => 'Ada', 'last' => 'Lovelace']];
        yield 'comma first and middle with repeated gap' => ['Smith,Ada  Byron', ['last' => 'Smith', 'first' => 'Ada', 'middle' => 'Byron']];
        yield 'comma first and middle with padding' => ['Smith,  Ada   Byron  ', ['last' => 'Smith', 'first' => 'Ada', 'middle' => 'Byron']];
        yield 'comma ignores later given tokens after repeated gaps' => ['Smith,Ada  Byron   Augusta', ['last' => 'Smith', 'first' => 'Ada', 'middle' => 'Byron']];
        yield 'comma ignores extra comma after repeated gap' => ['Smith,Ada  Byron,Augusta', ['last' => 'Smith', 'first' => 'Ada', 'middle' => 'Byron']];
        yield 'comma surname spacing is not compressed' => ['Van  Dyke,Ada  Byron', ['last' => 'Van  Dyke', 'first' => 'Ada', 'middle' => 'Byron']];
        yield 'comma given names preserve accents and punctuation' => ["O'Neil,Élodie  Anne-Marie", ['last' => "O'Neil", 'first' => 'Élodie', 'middle' => 'Anne-Marie']];
        yield 'comma given wildcards remain literal' => ['Sm_th%,A_a%  B_%', ['last' => 'Sm_th%', 'first' => 'A_a%', 'middle' => 'B_%']];
    }
}
