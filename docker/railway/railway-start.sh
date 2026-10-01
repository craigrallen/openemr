#!/usr/bin/env bash
# ============================================================================
# Railway test-server entrypoint for OpenEMR
# ============================================================================
# Runs before the upstream docker/release/openemr.sh and:
#   - redacts every credential value from all output, including upstream
#     installer error paths that print failed SQL;
#   - refuses to start with missing, upstream-default or unsafe-charset
#     credentials, so the container never comes up with a public installer,
#     admin/pass, or a password upstream would split or truncate;
#   - refuses to start unless sites/ is a mounted (persistent) volume, and
#     seeds that volume from the image copy when it is empty;
#   - hands the mail/SMS/payment safety globals to railway-serve.sh, which
#     applies and reads them back before Apache may start;
#   - optionally adds HTTP basic auth on top of (never instead of) the
#     Apache Files/Directory denials, leaving only readiness anonymous.
#
# TEST USE ONLY - not approved for clinical use.
#
# @package   OpenEMR
# @link      https://www.open-emr.org
# @author    Craig Allen <craig@interconnected.au>
# @copyright Copyright (c) 2026 Craig Allen
# @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
# ============================================================================
set -euo pipefail

OE_ROOT="${OE_ROOT:-/var/www/localhost/htdocs/openemr}"
SITES_TEMPLATE_DIR="${SITES_TEMPLATE_DIR:-/swarm-pieces/sites}"
APACHE_CONF_DIR="${APACHE_CONF_DIR:-/etc/apache2/conf.d}"
SITES_OWNER="${SITES_OWNER:-apache:apache}"  # "none" skips chown (tests)
MOUNTINFO_FILE="${MOUNTINFO_FILE:-/proc/self/mountinfo}"
READYZ_PATH=/meta/railway/readyz.php
MIN_SECRET_LENGTH=16
SECRET_NAMES="MYSQL_ROOT_PASS MYSQL_PASS OE_PASS OE_HTTP_BOUNDARY_PASS"

# Replace each secret value (read from the environment, never from argv)
# with [REDACTED], literally rather than as a regex, line by line.
redact_secrets() {
    awk -v names="${SECRET_NAMES}" '
        BEGIN { n = split(names, k, " "); for (i = 1; i <= n; i++) if (ENVIRON[k[i]] != "") s[++m] = ENVIRON[k[i]] }
        {
            line = $0
            for (i = 1; i <= m; i++) {
                out = ""
                while ((p = index(line, s[i])) > 0) {
                    out = out substr(line, 1, p - 1) "[REDACTED]"
                    line = substr(line, p + length(s[i]))
                }
                line = out line
            }
            print line
            fflush()
        }'
}
# shellcheck disable=SC2312  # the redactor's status is collected by finish()
exec > >(redact_secrets) 2>&1
redact_pid=$!

finish() {
    exec 1>&- 2>&-
    wait "${redact_pid}" 2>/dev/null || true
}

refuse() {
    echo "REFUSING to start: $1"
    finish
    exit 64
}

require_secret() {
    local name="$1" default="$2" value="${!1:-}"
    [[ -n "${value}" ]] || refuse "${name} is not set"
    [[ "${value}" != "${default}" ]] || refuse "${name} is the upstream default"
    [[ "${#value}" -ge "${MIN_SECRET_LENGTH}" ]] || refuse "${name} is shorter than ${MIN_SECRET_LENGTH} characters"
    # Upstream splits install arguments on whitespace and key=value on '=',
    # and interpolates into SQL/PHP: allow only characters it passes intact.
    [[ "${value}" =~ ^[A-Za-z0-9_-]+$ ]] || refuse "${name} may only contain A-Z a-z 0-9 _ -"
}

require_name() {
    local name="$1" pattern="$2" value="${!1:-}"
    [[ "${value}" =~ ${pattern} ]] || refuse "${name} is missing or contains unsupported characters"
}

require_name MYSQL_HOST '^[A-Za-z0-9.-]+$'
[[ "${MANUAL_SETUP:-no}" != "yes" ]] || refuse "MANUAL_SETUP=yes would expose the web installer"
OE_USER="${OE_USER:-}"
require_name OE_USER '^[A-Za-z0-9_-]{3,32}$'
[[ "${OE_USER}" != "admin" ]] || refuse "OE_USER must be set to a non-default name"
[[ -z "${MYSQL_USER:-}" ]] || require_name MYSQL_USER '^[A-Za-z0-9_]{1,32}$'
[[ -z "${MYSQL_DATABASE:-}" ]] || require_name MYSQL_DATABASE '^[A-Za-z0-9_]{1,64}$'
require_secret MYSQL_ROOT_PASS root
require_secret MYSQL_PASS openemr
require_secret OE_PASS pass

# Site configuration, documents and keys must outlive the container: refuse
# to fall back to the image's own (ephemeral) sites directory.
awk -v p="${OE_ROOT}/sites" '$5 == p { found = 1 } END { exit !found }' "${MOUNTINFO_FILE}" \
    || refuse "${OE_ROOT}/sites is not a mounted volume"

# Railway volumes start empty; give openemr.sh the default site to configure.
if [[ ! -f "${OE_ROOT}/sites/default/sqlconf.php" ]]; then
    echo "Seeding empty sites volume from image template"
    mkdir -p "${OE_ROOT}/sites"
    cp -a "${SITES_TEMPLATE_DIR}/." "${OE_ROOT}/sites/"
fi
if [[ "${SITES_OWNER}" != "none" ]]; then
    chown -R "${SITES_OWNER}" "${OE_ROOT}/sites"
fi

# Outbound mail, reminders, Direct messaging, portal and live payments off.
# SMTP points at the local discard port. railway-serve.sh writes these to the
# globals table and reads them back; any mismatch keeps Apache down.
SAFETY_SETTINGS=(
    EMAIL_METHOD=SMTP
    SMTP_HOST=127.0.0.1
    SMTP_PORT=9
    payment_gateway=InHouse
    gateway_mode_production=0
    medex_enable=0
    phimail_enable=0
    portal_onsite_two_enable=0
)
for setting in "${SAFETY_SETTINGS[@]}"; do
    echo "safety: ${setting}"
done
export RAILWAY_SAFETY_SETTINGS="${SAFETY_SETTINGS[*]}"

boundary_conf="${APACHE_CONF_DIR}/zz-railway-boundary.conf"
boundary_file="${APACHE_CONF_DIR}/railway-boundary.htpasswd"
if [[ -n "${OE_HTTP_BOUNDARY_PASS:-}" ]]; then
    require_secret OE_HTTP_BOUNDARY_PASS ""
    OE_HTTP_BOUNDARY_USER="${OE_HTTP_BOUNDARY_USER:-tester}"
    require_name OE_HTTP_BOUNDARY_USER '^[A-Za-z0-9_-]{3,32}$'
    boundary_hash=$(printf '%s' "${OE_HTTP_BOUNDARY_PASS}" | openssl passwd -apr1 -stdin)
    # Restrictive umask only for the password file: upstream later creates
    # files as root that apache must read (TEMPsql_upgrade.php).
    (umask 027 && printf '%s:%s\n' "${OE_HTTP_BOUNDARY_USER}" "${boundary_hash}" > "${boundary_file}")
    # AuthMerging And: Location sections merge after Files/Directory, and
    # without it this Require would replace their denials.
    cat > "${boundary_conf}" <<EOF
# Generated by railway-start.sh: HTTP boundary for the test server.
<Location "/">
    AuthType Basic
    AuthName "OpenEMR test server"
    AuthUserFile "${boundary_file}"
    AuthMerging And
    <RequireAny>
        Require expr "%{REQUEST_URI} == '${READYZ_PATH}'"
        Require valid-user
    </RequireAny>
</Location>
EOF
    [[ "${SITES_OWNER}" = "none" ]] || chown "root:${SITES_OWNER#*:}" "${boundary_file}"
    echo "HTTP boundary enabled"
else
    rm -f "${boundary_conf}" "${boundary_file}"
fi

if [[ "${RAILWAY_START_CHECK_ONLY:-0}" = "1" ]]; then
    echo "check only: not starting OpenEMR"
    finish
    exit 0
fi

cd "${OE_ROOT}"
exec ./openemr.sh
