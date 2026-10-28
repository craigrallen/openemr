<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Ken Chapple <ken@mi-squared.com>
 * @copyright Copyright (c) 2021 Ken Chapple <ken@mi-squared.com>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU GeneralPublic License 3
 */

namespace OpenEMR\Services\Qdm\Services;

use OpenEMR\Cqm\Qdm\BaseTypes\Quantity;
use OpenEMR\Cqm\Qdm\PhysicalExamPerformed;
use OpenEMR\Services\Qdm\Interfaces\QdmServiceInterface;

class PhysicalExamService extends AbstractObservationService implements QdmServiceInterface
{
    public function getObservationType(): string
    {
        return parent::OB_TYPE_PHYSICAL_EXAM;
    }

    public function getModelClass(): string
    {
        return PhysicalExamPerformed::class;
    }

    public function makeResult($record): Quantity
    {
        $value = $record['ob_value'];
        $number = is_numeric($value) ? $value + 0 : null;
        if (is_int($number) || (
            is_float($number)
            && is_finite($number)
            && $number >= (float)PHP_INT_MIN
            && $number < PHP_INT_MAX + 1.0
        )) {
            $result = $number;
        } else {
            $result = (int)$value;
        }

        return new Quantity([
            'value' => $result,
            'unit' => $record['ob_unit']
        ]);
    }
}
