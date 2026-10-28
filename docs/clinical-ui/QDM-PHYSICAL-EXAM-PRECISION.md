# QDM physical exam result precision (OPEMR-139)

## Change

`PhysicalExamService::makeResult()` preserves supported finite numeric physical exam results within the native integer range. It uses PHP numeric arithmetic (`+ 0`) so decimal and exponent inputs retain fractional values at PHP float precision, while native integers and integer strings retain exact integer values, including integers above float precision. The upper float bound is exclusive because `PHP_INT_MAX` rounds up when converted to a float on 64-bit PHP. The float lower bound is also strict: an out-of-range input just below `PHP_INT_MIN` can round to `(float) PHP_INT_MIN`. A float equal to that bound follows the original integer-cast fallback; the separate `is_int` branch still accepts the native minimum integer and its integer string exactly. The regression also covers a float just inside the lower bound.

For nonnumeric, nonfinite, and out-of-range inputs, the service retains its previous integer cast and diagnostics. It reads `ob_value` once, preserving the single warning for a missing key. The result unit and the existing date, code, model, caller, and SQL behavior are unchanged. This change does not add a laboratory sentinel or alter a shared helper.

## Tests-first evidence

The retained regression test was committed first in `510444882986cb800b27179679e5b0fddcb479ba` (`PhysicalExamPrecisionTest.php`). The controller reported a native RED run of 44 tests and 700 assertions with 13 failures: nine fractional result values, three zero result types, and one fractional result propagated through the parent model. It reported no loading errors. The test covers numeric result value and type, unit, serialized quantity, original record data, unsupported-input casts and warnings, and parent model IDs, dates, codes, and negation.

The first implementation followed in `fcc321256712f24f32b0ec32f05cc82442736d63`; the controller reported a native GREEN run for that revision. A second regression test was committed before this correction in `e1fc4b5088fe3ad3331289e56add21b932ee85ff`. The controller reported a native RED run of 53 tests and 992 assertions, with 4 failures and 0 errors, for negative adjacent integer, decimal, and exponent strings and a native float at the lower bound. The final native GREEN run for this correction remains pending with the controller. Independent P2 review also remains pending. These runs address native QDM conversion only; no authenticated clinical, measure, or export verification or clinical acceptance is claimed.
