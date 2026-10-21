<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Brady Miller <brady.g.miller@gmail.com>
 * @copyright Copyright (c) 2026 Brady Miller <brady.g.miller@gmail.com>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\PostCalendar;

use DOMDocument;
use DOMElement;
use DOMXPath;
use OpenEMR\PostCalendar\CalendarRenderer;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\TestCase;
use Twig\Environment;
use Twig\Loader\FilesystemLoader;
use Twig\TwigFilter;
use Twig\TwigFunction;

#[Group('isolated')]
#[Group('postcalendar')]
final class CategoryColourTemplateTest extends TestCase
{
    private const TEMPLATE = 'calendar/default/admin/submit_category.html.twig';

    /**
     * Render the complete shipped template through CalendarRenderer. These local
     * filters model only the escaping sinks used by this fixture; loading the
     * application Twig extension would require application globals/services.
     *
     * @param list<array<string, mixed>> $categories
     */
    private function renderCategories(array $categories): DOMXPath
    {
        $twig = new Environment(new FilesystemLoader(dirname(__DIR__, 4) . '/templates'), ['autoescape' => false]);
        $escape = static function (mixed $value): string {
            if ($value === null) {
                $value = '';
            } elseif (is_int($value)) {
                $value = (string) $value;
            } elseif (!is_string($value)) {
                throw new \UnexpectedValueException('Unsupported category fixture value for Twig escaping');
            }
            return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        };
        foreach (['text', 'attr', 'attr_url', 'safe_href'] as $name) {
            $twig->addFilter(new TwigFilter($name, $escape, ['is_safe' => ['html']]));
        }
        $twig->addFunction(new TwigFunction('setupHeader', static fn (): string => '', ['is_safe' => ['html']]));

        $renderer = new CalendarRenderer($twig);
        $renderer->assign([
            'pcDir' => 'PostCalendar',
            'assetVersion' => '1',
            'action' => '/calendar/categories?mode=save&scope=all',
            '_PC_CAT_COLOR' => 'Colour & shade',
            '_PC_COLOR_PICK_TITLE' => 'Pick a colour',
            'all_categories' => $categories,
            'cat_type' => [],
            'repeat_freq_type' => [],
            'repeat_on_num' => [],
            'repeat_on_day' => [],
            'ACO_List' => [],
            'globals' => ['translate_appt_categories' => false],
            'session' => ['language_choice' => 1],
            'FormSubmit' => '<button type="submit">Save</button>',
        ]);
        $html = $renderer->render(self::TEMPLATE);

        $document = new DOMDocument();
        $previous = libxml_use_internal_errors(true);
        try {
            self::assertTrue($document->loadHTML($html));
        } finally {
            libxml_clear_errors();
            libxml_use_internal_errors($previous);
        }
        return new DOMXPath($document);
    }

    private function one(DOMXPath $xpath, string $expression): DOMElement
    {
        $nodes = $xpath->query($expression);
        self::assertNotFalse($nodes);
        self::assertCount(1, $nodes, $expression);
        self::assertInstanceOf(DOMElement::class, $nodes->item(0));
        return $nodes->item(0);
    }

    private function queryCount(DOMXPath $xpath, string $expression): int
    {
        $nodes = $xpath->query($expression);
        self::assertNotFalse($nodes);
        return $nodes->length;
    }

    /** @return array<string, mixed> */
    private function category(int $id, string $color): array
    {
        return [
            'id' => $id,
            'color' => $color,
            'name' => 'Clinic "<script>alert(1)</script>" & care',
            'constantid' => 'constant" onfocus="alert(1)',
            'desc' => 'Description <b>synthetic</b> & more',
        ];
    }

    public function testNewColourHasLiteralWhiteDefaultAndVisibleTranslatedLabelWithNoExistingCategories(): void
    {
        $xpath = $this->renderCategories([]);
        $input = $this->one($xpath, '//input[@id="newcolor"]');
        self::assertSame('color', $input->getAttribute('type'));
        self::assertSame('newcolor', $input->getAttribute('name'));
        self::assertSame('#ffffff', $input->getAttribute('value'));
        $label = $this->one($xpath, '//label[@for="newcolor"]');
        self::assertSame('Colour & shade:', trim($label->textContent));
        self::assertSame(0, $this->queryCount($xpath, '//input[@name="color[]"]'));
    }

    public function testSparseExistingColoursAndCategoryFieldsKeepTheirValuesAndLabels(): void
    {
        $colors = [5 => '#12abEF', 42 => '#ffffff', 107 => '#000000'];
        $xpath = $this->renderCategories(array_map(
            fn (int $id, string $color): array => $this->category($id, $color),
            array_keys($colors),
            array_values($colors)
        ));

        foreach ($colors as $id => $color) {
            $input = $this->one($xpath, '//input[@id="color[' . $id . ']"]');
            self::assertSame('color', $input->getAttribute('type'));
            self::assertSame('color[]', $input->getAttribute('name'));
            self::assertSame($color, $input->getAttribute('value'));
            $label = $this->one($xpath, '//label[@for="color[' . $id . ']"]');
            self::assertSame('Colour & shade:', trim($label->textContent));
        }

        $name = $this->one($xpath, '(//input[@name="name[]"])[1]');
        self::assertSame('Clinic "<script>alert(1)</script>" & care', $name->getAttribute('value'));
        self::assertFalse($name->hasAttribute('onfocus'));
        $constant = $this->one($xpath, '(//input[@name="constantid[]"])[1]');
        self::assertSame('constant" onfocus="alert(1)', $constant->getAttribute('value'));
        self::assertFalse($constant->hasAttribute('onfocus'));
        self::assertSame(0, $this->queryCount($xpath, '//script[contains(text(), "alert(1)")]'));
    }

    public function testFormSubmissionAndPickerTargetsRemainCompatible(): void
    {
        $xpath = $this->renderCategories([$this->category(5, '#12abEF'), $this->category(42, '#000000')]);
        $form = $this->one($xpath, '//form[@name="cats"]');
        self::assertSame('post', $form->getAttribute('method'));
        self::assertSame('/calendar/categories?mode=save&scope=all', $form->getAttribute('action'));
        self::assertSame('application/x-www-form-urlencoded', $form->getAttribute('enctype'));
        foreach (['newid', 'newname', 'newconstantid', 'newcolor', 'newdesc', 'id[]', 'name[]', 'constantid[]', 'color[]', 'pc_html_or_text'] as $name) {
            self::assertGreaterThan(0, $this->queryCount($xpath, '//*[@name="' . $name . '"]'), $name);
        }
        foreach (['newcolor', 'color[5]', 'color[42]'] as $target) {
            $link = $this->one($xpath, '//a[@onclick="pick(\'pick\',\'' . $target . '\');return false;"]');
            self::assertSame('pick', $link->getAttribute('id'));
        }
    }
}
