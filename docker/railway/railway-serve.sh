#!/usr/bin/env bash
# ============================================================================
# Railway test server: last step of openemr.sh, in place of starting Apache
# ============================================================================
# The Dockerfile rewrites openemr.sh's final "exec httpd" to this script, so
# it runs after install/upgrade and after upstream's (failure-tolerant)
# setGlobalSettings. Apache only starts if:
#   - railway-verify.php applied the safety globals and read them back, and
#     wrote the readiness marker;
#   - the web-only PHP egress guard (no outbound sockets, URL streams or
#     process spawning) is in effect for the configuration Apache will load.
#
# @package   OpenEMR
# @link      https://www.open-emr.org
# @author    Craig Allen <craig@interconnected.au>
# @copyright Copyright (c) 2026 Craig Allen
# @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
# ============================================================================
set -euo pipefail

marker="${RAILWAY_READY_MARKER:-/run/openemr-railway/ready.json}"
web_ini_dir="/etc/php${PHP_VERSION_ABBR:?set by the runtime image}/railway-web.d"

refuse() {
    rm -f "${marker}"
    echo "REFUSING to serve: $1" >&2
    exit 70
}

rm -f "${marker}"
php /usr/local/lib/openemr-railway/railway-verify.php || refuse "safety verification failed"

# Web requests only: the CLI install/upgrade above runs without the guard.
export PHP_INI_SCAN_DIR=":${web_ini_dir}"
php -r 'exit(ini_get("allow_url_fopen") || function_exists("curl_exec") || function_exists("proc_open") ? 1 : 0);' \
    || refuse "web egress guard is not in effect"

echo "Starting Apache (safety settings verified, web egress guard active)"
exec /usr/sbin/httpd -D FOREGROUND
