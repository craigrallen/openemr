<?php

declare(strict_types=1);

namespace OpenEMR\Tests\E2e\Base;

use InvalidArgumentException;

/** XPath paths through the workbench's rendered menu tree. */
final class MainMenuSelectors
{
    /** @param list<string> $labels */
    public static function workbenchBranch(array $labels): string
    {
        if ($labels === []) {
            throw new InvalidArgumentException('A workbench branch needs a label');
        }

        $path = '//div[@data-workbench-tree]/section';
        foreach ($labels as $index => $label) {
            $path .= '/details[contains(concat(" ", normalize-space(@class), " "), " workbench-branch ")'
                . ' and summary[normalize-space(.)=' . self::literal($label) . ']]';
            if ($index < count($labels) - 1) {
                $path .= '/div[contains(concat(" ", normalize-space(@class), " "), " workbench-children ")]';
            }
        }
        return $path;
    }

    /** @param list<string> $labels */
    public static function workbenchAction(array $labels): string
    {
        if ($labels === []) {
            throw new InvalidArgumentException('A workbench action needs a label');
        }

        $action = array_pop($labels);
        $path = $labels === []
            ? '//div[@data-workbench-tree]/section'
            : self::workbenchBranch($labels)
                . '/div[contains(concat(" ", normalize-space(@class), " "), " workbench-children ")]';

        return $path . '/button[@data-workbench-action and normalize-space(.)=' . self::literal($action) . ']';
    }

    private static function literal(string $value): string
    {
        if (!str_contains($value, "'")) {
            return "'" . $value . "'";
        }
        if (!str_contains($value, '"')) {
            return '"' . $value . '"';
        }
        return 'concat(' . implode(', "\'", ', array_map(
            static fn(string $part): string => "'" . $part . "'",
            explode("'", $value),
        )) . ')';
    }
}
