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

function railway_web_guard_active(): bool
{
    if (filter_var(ini_get('allow_url_fopen'), FILTER_VALIDATE_BOOLEAN)) {
        return false;
    }
    foreach (['curl_exec', 'fsockopen', 'stream_socket_client', 'socket_connect', 'proc_open', 'exec', 'mail'] as $function) {
        if (function_exists($function)) {
            return false;
        }
    }
    return true;
}
