# QDM physical exam result precision (OPEMR-139)

## Change

`PhysicalExamService::makeResult()` preserves supported finite numeric physical exam results within the native integer range. It uses PHP numeric arithmetic (`+ 0`) so decimal and exponent inputs retain fractional values at PHP float precision, while native integers and integer strings retain exact integer values, including integers above float precision. The upper float bound is exclusive because `PHP_INT_MAX` rounds up when converted to a float on 64-bit PHP.

For nonnumeric, nonfinite, and out-of-range inputs, the service retains its previous integer cast and diagnostics. It reads `ob_value` once, preserving the single warning for a missing key. The result unit and the existing date, code, model, caller, and SQL behavior are unchanged. This change does not add a laboratory sentinel or alter a shared helper.

## Tests-first evidence

The retained regression test was committed first in `510444882986cb800b27179679e5b0fddcb479ba` (`PhysicalExamPrecisionTest.php`). The controller reported a native RED run of 44 tests and 700 assertions with 13 failures: nine fractional result values, three zero result types, and one fractional result propagated through the parent model. It reported no loading errors. The test covers numeric result value and type, unit, serialized quantity, original record data, unsupported-input casts and warnings, and parent model IDs, dates, codes, and negation.

This implementation has not been run locally because the controller owns the native test run. Native GREEN and independent review remain pending. The regression test establishes limited native QDM conversion support; authenticated export verification and clinical acceptance remain **OPEN**.
