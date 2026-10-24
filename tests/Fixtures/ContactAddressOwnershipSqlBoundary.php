<?php

declare(strict_types=1);

namespace OpenEMR\Common\ORDataObject;

/**
 * Synthetic SQL value boundary for ContactAddressOwnershipTest only.
 * This models quoted values in a recorder; it is not mysqli escaping or a
 * security acceptance test.
 */
function add_escape_custom($s): string
{
    return addslashes((string) $s);
}
