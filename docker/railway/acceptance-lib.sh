#!/usr/bin/env bash
# Helpers sourced by acceptance-test.sh (and its isolated test).
#
# @package   OpenEMR
# @link      https://www.open-emr.org
# @author    Craig Allen <craig@interconnected.au>
# @copyright Copyright (c) 2026 Craig Allen
# @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3

# Succeeds only if the container's logs were retrieved in full and contain
# none of the generated secrets. Logs go to a file first, so the scan never
# races a producer (no SIGPIPE under pipefail) and retrieval errors fail.
logs_free_of_secrets() {
    local container="$1" log="$2" rc=0
    if ! docker logs "${container}" > "${log}" 2>&1; then
        echo "could not retrieve logs for ${container}"
        return 1
    fi
    grep -qF -e "${MYSQL_ROOT_PASS:?}" -e "${MYSQL_PASS:?}" -e "${OE_PASS:?}" \
        -e "${OE_HTTP_BOUNDARY_PASS:?}" "${log}" || rc=$?
    case "${rc}" in
        1) return 0 ;;
        0) echo "a generated secret appears in the logs of ${container}" ;;
        *) echo "log scan failed for ${container}" ;;
    esac
    return 1
}
