<?php

/**
 * Railway test server: shared safety checks for railway-verify.php (CLI,
 * before Apache starts) and readyz.php (Railway's readiness gate).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

const RAILWAY_READY_MARKER_DEFAULT = '/run/openemr-railway/ready.json';
const RAILWAY_SQLCONF_DEFAULT = '/var/www/localhost/htdocs/openemr/sites/default/sqlconf.php';

/**
 * Web egress guard, checked identically before Apache starts and on every
 * readiness probe. php-railway-egress.ini must disable every function here.
 */
const RAILWAY_WEB_DISABLED_FUNCTIONS = [
    'curl_exec', 'curl_multi_exec',
    'fsockopen', 'pfsockopen', 'stream_socket_client', 'stream_socket_server',
    'socket_create', 'socket_connect', 'socket_sendto', 'socket_sendmsg',
    'ftp_connect', 'ftp_ssl_connect', 'ldap_connect',
    'mail', 'mb_send_mail', 'imap_open', 'imap_mail',
    'exec', 'shell_exec', 'system', 'passthru', 'popen', 'proc_open', 'pcntl_exec', 'pcntl_fork',
];

/**
 * Classes that open outbound connections. PHP 8.5 cannot disable classes, so
 * railway-web-ini.sh leaves their extensions out of the web configuration.
 */
const RAILWAY_WEB_ABSENT_CLASSES = ['SoapClient', 'Redis'];

function railway_env(string $name, string $default): string
{
    $value = getenv($name);
    return is_string($value) && $value !== '' ? $value : $default;
}

function railway_marker_path(): string
{
    return railway_env('RAILWAY_READY_MARKER', RAILWAY_READY_MARKER_DEFAULT);
}

/**
 * @return array<string, string>|null expected safety settings, or null before verification
 */
function railway_read_marker(): ?array
{
    $json = @file_get_contents(railway_marker_path());
    if (!is_string($json)) {
        return null;
    }
    $marker = json_decode($json, true);
    if (!is_array($marker) || !is_array($marker['settings'] ?? null) || $marker['settings'] === []) {
        return null;
    }
    $settings = [];
    foreach ($marker['settings'] as $name => $value) {
        if (!is_string($name) || !is_string($value)) {
            return null;
        }
        $settings[$name] = $value;
    }
    return $settings;
}

/**
 * Connects with the installed site's own credentials.
 *
 * @throws RuntimeException when the site is not configured
 */
function railway_connect(): mysqli
{
    $sqlconf = railway_env('RAILWAY_SQLCONF', RAILWAY_SQLCONF_DEFAULT);
    if (!is_file($sqlconf)) {
        throw new RuntimeException('site is not configured');
    }
    $conf = (static function (string $file): array {
        require $file;
        return [
            'config' => $config ?? 0,
            'host' => $host ?? '',
            'port' => $port ?? '3306',
            'login' => $login ?? '',
            'pass' => $pass ?? '',
            'dbase' => $dbase ?? '',
        ];
    })($sqlconf);
    if ((int) $conf['config'] !== 1) {
        throw new RuntimeException('site is not configured');
    }
    mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
    return new mysqli(
        (string) $conf['host'],
        (string) $conf['login'],
        (string) $conf['pass'],
        (string) $conf['dbase'],
        (int) $conf['port']
    );
}

/**
 * @param array<string, string> $expected
 */
function railway_apply_settings(mysqli $db, array $expected): void
{
    $db->begin_transaction();
    $delete = $db->prepare('DELETE FROM globals WHERE gl_name = ?');
    $insert = $db->prepare('INSERT INTO globals (gl_name, gl_index, gl_value) VALUES (?, 0, ?)');
    foreach ($expected as $name => $value) {
        $delete->bind_param('s', $name);
        $delete->execute();
        $insert->bind_param('ss', $name, $value);
        $insert->execute();
    }
    $db->commit();
}

/**
 * @param array<string, string> $expected
 * @return list<string> names whose stored value differs from the expected one
 */
function railway_mismatched_settings(mysqli $db, array $expected): array
{
    $select = $db->prepare('SELECT gl_value FROM globals WHERE gl_name = ? AND gl_index = 0');
    $mismatched = [];
    foreach ($expected as $name => $value) {
        $select->bind_param('s', $name);
        $select->execute();
        $row = $select->get_result()->fetch_row();
        if (!is_array($row) || (string) $row[0] !== $value) {
            $mismatched[] = $name;
        }
    }
    $count = $db->query('SELECT COUNT(*) FROM globals WHERE gl_name IN (' . implode(',', array_map(
        static fn(string $name): string => "'" . $db->real_escape_string($name) . "'",
        array_keys($expected)
    )) . ')')->fetch_row();
    if (!is_array($count) || (int) $count[0] !== count($expected)) {
        $mismatched[] = 'duplicate-index';
    }
    return $mismatched;
}

/**
 * @return list<string> every restriction that is not in effect; empty when guarded
 */
function railway_web_guard_violations(): array
{
    $violations = [];
    foreach (['allow_url_fopen', 'allow_url_include'] as $setting) {
        if (filter_var(ini_get($setting), FILTER_VALIDATE_BOOLEAN)) {
            $violations[] = 'ini ' . $setting;
        }
    }
    foreach (RAILWAY_WEB_DISABLED_FUNCTIONS as $function) {
        if (function_exists($function)) {
            $violations[] = 'function ' . $function;
        }
    }
    foreach (RAILWAY_WEB_ABSENT_CLASSES as $class) {
        if (class_exists($class, false)) {
            $violations[] = 'class ' . $class;
        }
    }
    return $violations;
}

function railway_web_guard_active(): bool
{
    return railway_web_guard_violations() === [];
}
