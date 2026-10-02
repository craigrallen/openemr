<?php

/**
 * Typed accessors for decoded fixture arrays (narrowing instead of casting).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Demo\Seed;

final class Val
{
    /** @param array<mixed> $a */
    public static function str(array $a, string $key, ?string $default = null): string
    {
        $v = $a[$key] ?? $default;
        if (is_int($v) || is_float($v)) {
            return (string) $v;
        }
        if (!is_string($v)) {
            throw new InvalidFixtureException("Fixture field '{$key}' must be a string.");
        }
        return $v;
    }

    /** @param array<mixed> $a */
    public static function int(array $a, string $key, ?int $default = null): int
    {
        $v = $a[$key] ?? $default;
        if (!is_int($v)) {
            throw new InvalidFixtureException("Fixture field '{$key}' must be an integer.");
        }
        return $v;
    }

    /** @param array<mixed> $a */
    public static function bool(array $a, string $key): bool
    {
        return ($a[$key] ?? false) === true;
    }

    /**
     * @param array<mixed> $a
     * @return array<string, mixed>
     */
    public static function map(array $a, string $key): array
    {
        $v = $a[$key] ?? [];
        if (!is_array($v) || ($v !== [] && array_is_list($v))) {
            throw new InvalidFixtureException("Fixture field '{$key}' must be an object.");
        }
        $out = [];
        foreach ($v as $k => $item) {
            $out[(string) $k] = $item;
        }
        return $out;
    }

    /**
     * @param array<mixed> $a
     * @return list<array<string, mixed>>
     */
    public static function list(array $a, string $key): array
    {
        $v = $a[$key] ?? [];
        if (!is_array($v) || !array_is_list($v)) {
            throw new InvalidFixtureException("Fixture field '{$key}' must be a list.");
        }
        $out = [];
        foreach ($v as $item) {
            if (!is_array($item)) {
                if (is_string($item)) {
                    $out[] = ['value' => $item];
                    continue;
                }
                throw new InvalidFixtureException("Fixture field '{$key}' must contain objects.");
            }
            $row = [];
            foreach ($item as $k => $value) {
                $row[(string) $k] = $value;
            }
            $out[] = $row;
        }
        return $out;
    }

    /**
     * Scalar column map for a form/table payload.
     *
     * @param array<string, mixed> $a
     * @return array<string, string>
     */
    public static function columns(array $a): array
    {
        $out = [];
        foreach ($a as $k => $v) {
            if (!is_scalar($v)) {
                throw new InvalidFixtureException("Column '{$k}' must be scalar.");
            }
            $out[$k] = is_bool($v) ? ($v ? '1' : '0') : (string) $v;
        }
        return $out;
    }
}
