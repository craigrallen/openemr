#!/usr/bin/env bash
# Assertions compare command output inline and judge it via check(); a failed
# probe must count as a test failure rather than abort the run (SC2312, SC2310).
# The bash -c snippets take their values as positional arguments (SC2016).
# shellcheck disable=SC2312,SC2310,SC2016
# ============================================================================
# Container acceptance test for the Railway test-server image
# ============================================================================
# Builds the image from a git archive of the working tree (the same
# export-ignore-filtered source Railway fetches from GitHub), then runs it
# against a throwaway MariaDB with a named volume on sites/ and checks, in the
# real Apache/PHP runtime:
#   - the archive contains the Railway build inputs;
#   - readiness is non-2xx until install and safety verification pass, and
#     again when a safety global drifts;
#   - the HTTP boundary is additive: sensitive paths stay 403 with valid
#     boundary credentials;
#   - web PHP cannot open outbound connections or spawn processes;
#   - no generated secret appears in container logs;
#   - admin login works, and survives container replacement with a schema
#     migration (run by upstream as apache) on the same volume;
#   - startup refuses a missing sites mount and unsafe credentials.
# Needs Docker and openssl. Never prints the generated secrets.
#
# Usage: docker/railway/acceptance-test.sh [--skip-build]
#
# @package   OpenEMR
# @link      https://www.open-emr.org
# @author    Craig Allen <craig@interconnected.au>
# @copyright Copyright (c) 2026 Craig Allen
# @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
# ============================================================================
set -euo pipefail

repo=$(git rev-parse --show-toplevel)
image="${RAILWAY_ACCEPTANCE_IMAGE:-openemr-railway-acceptance:local}"
run="oerwy${RANDOM}$$"
net="${run}-net" db="${run}-db" app="${run}-app" sites="${run}-sites"
oe_root=/var/www/localhost/htdocs/openemr
readyz=/meta/railway/readyz.php
failures=0

MYSQL_ROOT_PASS=$(openssl rand -hex 16)
MYSQL_PASS=$(openssl rand -hex 16)
OE_PASS=$(openssl rand -hex 16)
OE_HTTP_BOUNDARY_PASS=$(openssl rand -hex 16)
MARIADB_ROOT_PASSWORD="${MYSQL_ROOT_PASS}"
MYSQL_PWD="${MYSQL_ROOT_PASS}"
OE_USER=oe-accept-admin
OE_HTTP_BOUNDARY_USER=tester
export MYSQL_ROOT_PASS MYSQL_PASS OE_PASS OE_HTTP_BOUNDARY_PASS MARIADB_ROOT_PASSWORD MYSQL_PWD OE_USER OE_HTTP_BOUNDARY_USER

pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1"; failures=$((failures + 1)); }
check() { local name="$1"; shift; if "$@"; then pass "${name}"; else fail "${name}"; fi; }

cleanup() {
    docker rm -f "${app}" "${db}" >/dev/null 2>&1 || true
    docker volume rm "${sites}" >/dev/null 2>&1 || true
    docker network rm "${net}" >/dev/null 2>&1 || true
    rm -rf "${tmp:-}"
}
trap cleanup EXIT
tmp=$(mktemp -d)

# --- build from the archive Railway would see ------------------------------
cp "$(git -C "${repo}" rev-parse --path-format=absolute --git-path index)" "${tmp}/index"
GIT_INDEX_FILE="${tmp}/index" git -C "${repo}" add -A
tree=$(GIT_INDEX_FILE="${tmp}/index" git -C "${repo}" write-tree)
git -C "${repo}" archive --format=tar "${tree}" > "${tmp}/source.tar"
check "source archive contains docker/railway/Dockerfile" grep -qx docker/railway/Dockerfile <(tar tf "${tmp}/source.tar")
check "source archive contains docker/release/openemr.sh" grep -qx docker/release/openemr.sh <(tar tf "${tmp}/source.tar")
if [[ "${1:-}" != "--skip-build" ]]; then
    docker build --quiet -f docker/railway/Dockerfile -t "${image}" - < "${tmp}/source.tar" >/dev/null
fi

# --- helpers ---------------------------------------------------------------
sql() { docker exec -e MYSQL_PWD "${db}" mariadb -uroot -N -B openemr -e "$1"; }
app_port() { docker port "${app}" 80/tcp | head -1; }
http_code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
authed() { curl -s -u "${OE_HTTP_BOUNDARY_USER}:${OE_HTTP_BOUNDARY_PASS}" "$@"; }

start_app() {
    docker run -d --name "${app}" --network "${net}" -p 127.0.0.1::80 \
        -v "${sites}:${oe_root}/sites" \
        -e MYSQL_HOST="${db}" -e MYSQL_ROOT_PASS -e MYSQL_PASS -e OE_USER -e OE_PASS \
        -e OE_HTTP_BOUNDARY_USER -e OE_HTTP_BOUNDARY_PASS "${image}" >/dev/null
}

# Last log lines with every generated secret masked (should already be redacted).
show_logs() {
    docker logs "${app}" 2>&1 | tail -n "${1:-60}" | awk '
        BEGIN { split("MYSQL_ROOT_PASS MYSQL_PASS OE_PASS OE_HTTP_BOUNDARY_PASS", k, " "); for (i in k) s[i] = ENVIRON[k[i]] }
        { for (i in s) while ((p = index($0, s[i])) > 0) $0 = substr($0, 1, p - 1) "[MASKED]" substr($0, p + length(s[i])); print "    log: " $0 }'
}

wait_ready() {
    local deadline=$((SECONDS + 1200)) code
    while ((SECONDS < deadline)); do
        if [[ "$(docker inspect -f '{{.State.Running}}' "${app}")" != "true" ]]; then
            echo "app container exited"
            show_logs
            return 1
        fi
        code=$(http_code "http://$(app_port)${readyz}" || true)
        [[ "${code}" = "200" ]] && return 0
        sleep 5
    done
    show_logs
    return 1
}

login_works() {
    local base jar
    base="http://$(app_port)"
    jar="${tmp}/cookies"
    rm -f "${jar}"
    authed -c "${jar}" -o /dev/null "${base}/interface/login/login.php?site=default"
    authed -b "${jar}" -c "${jar}" -o "${tmp}/login.html" -D "${tmp}/login.headers" \
        --data-urlencode "authUser=${OE_USER}" --data-urlencode "clearPass=${OE_PASS}" \
        --data "new_login_session_management=1&languageChoice=1" \
        "${base}/interface/main/main_screen.php?auth=login&site=default"
    grep -qi 'tabs/main\.php' "${tmp}/login.headers" "${tmp}/login.html"
}

no_secrets_in_logs() {
    ! docker logs "${app}" 2>&1 | grep -qF \
        -e "${MYSQL_ROOT_PASS}" -e "${MYSQL_PASS}" -e "${OE_PASS}" -e "${OE_HTTP_BOUNDARY_PASS}"
}

# --- refusals (no database needed) -------------------------------------------
docker network create "${net}" >/dev/null
out=$(docker run --rm --network "${net}" -e MYSQL_HOST="${db}" -e MYSQL_ROOT_PASS -e MYSQL_PASS \
    -e OE_USER -e OE_PASS "${image}" 2>&1 || true)
check "refuses to start without a sites volume" grep -q 'not a mounted volume' <<<"${out}"
out=$(docker run --rm --network "${net}" -v "${sites}:${oe_root}/sites" -e MYSQL_HOST="${db}" \
    -e MYSQL_ROOT_PASS -e MYSQL_PASS -e OE_USER -e OE_PASS="${OE_PASS}=x" "${image}" 2>&1 || true)
check "refuses a credential containing '='" grep -q 'REFUSING.*OE_PASS' <<<"${out}"
check "refusal output does not echo the credential" bash -c '! grep -qF "$1" <<<"$2"' _ "${OE_PASS}" "${out}"

# --- fresh install -------------------------------------------------------------
docker run -d --name "${db}" --network "${net}" -e MARIADB_ROOT_PASSWORD mariadb:11.4 >/dev/null
# Railway's database is long-running; here wait until it accepts root logins.
for _ in $(seq 1 60); do
    docker exec -e MYSQL_PWD "${db}" mariadb -uroot -e 'SELECT 1' >/dev/null 2>&1 && break
    sleep 2
done
start_app
check "fresh install becomes ready" wait_ready
base="http://$(app_port)"

check "readiness endpoint needs no boundary credentials" test "$(http_code "${base}${readyz}")" = 200
check "boundary challenges anonymous requests" test "$(http_code "${base}/interface/login/login.php")" = 401
check "boundary admits valid credentials" test "$(authed -o /dev/null -w '%{http_code}' "${base}/interface/login/login.php?site=default")" = 200
for path in setup.php admin.php sql_upgrade.php sql_patch.php acl_upgrade.php ippf_upgrade.php acl_setup.php \
    openemr.sh ssl.sh contrib/util/installScripts/ sites/default/documents/; do
    code=$(authed -o /dev/null -w '%{http_code}' "${base}/${path}")
    if docker exec "${app}" test -e "${oe_root}/${path}"; then
        check "authenticated ${path} is still denied (403)" test "${code}" = 403
    else
        check "authenticated ${path} is absent or denied" bash -c '[[ "$1" = 403 || "$1" = 404 ]]' _ "${code}"
    fi
done

probe="railway_probe_${run}.php"
docker exec -i -u apache "${app}" sh -c "cat > ${oe_root}/${probe}" <<'PHP'
<?php
echo json_encode([
    'url_fopen' => (bool) ini_get('allow_url_fopen'),
    'remote_read' => @file_get_contents('http://1.1.1.1/') !== false,
    'network_functions' => array_values(array_filter(
        ['curl_exec', 'curl_multi_exec', 'fsockopen', 'pfsockopen', 'stream_socket_client', 'socket_connect',
            'mail', 'exec', 'shell_exec', 'system', 'passthru', 'popen', 'proc_open'],
        'function_exists'
    )),
]);
PHP
egress=$(authed "${base}/${probe}")
docker exec "${app}" rm -f "${oe_root}/${probe}"
check "web PHP has no outbound network or process primitives" \
    test "${egress}" = '{"url_fopen":false,"remote_read":false,"network_functions":[]}'

for setting in EMAIL_METHOD:SMTP SMTP_HOST:127.0.0.1 SMTP_PORT:9 payment_gateway:InHouse \
    gateway_mode_production:0 medex_enable:0 phimail_enable:0 portal_onsite_two_enable:0; do
    check "global ${setting%%:*} reads back ${setting#*:}" \
        test "$(sql "SELECT gl_value FROM globals WHERE gl_name='${setting%%:*}' AND gl_index=0")" = "${setting#*:}"
done
sql "UPDATE globals SET gl_value='SENDMAIL' WHERE gl_name='EMAIL_METHOD'"
check "readiness fails (503) when a safety global drifts" test "$(http_code "${base}${readyz}")" = 503
sql "UPDATE globals SET gl_value='SMTP' WHERE gl_name='EMAIL_METHOD'"
check "readiness recovers after the drift is reverted" test "$(http_code "${base}${readyz}")" = 200

check "admin login with the generated password" login_works
check "no secret in logs after fresh install" no_secrets_in_logs

# --- replace the container on the same volume, with a pending migration --------
docker exec -u apache "${app}" sh -c "echo persisted > ${oe_root}/sites/default/documents/${run}.txt"
before=$(sql "SELECT v_database FROM version")
sql "UPDATE version SET v_database = v_database - 1"
docker rm -f "${app}" >/dev/null
start_app
check "replacement container becomes ready" wait_ready
check "schema migration ran and restored v_database" test "$(sql "SELECT v_database FROM version")" = "${before}"
check "document written before replacement persisted" \
    test "$(docker exec "${app}" cat "${oe_root}/sites/default/documents/${run}.txt")" = persisted
check "admin login after replacement" login_works
check "no secret in logs after migration boot" no_secrets_in_logs

echo "acceptance failures: ${failures}"
((failures == 0))
