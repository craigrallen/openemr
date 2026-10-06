<?php

/** Isolated entry harness: only infrastructure is doubled; messaging code is loaded unchanged. */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\Portal\Fixtures;

use OpenEMR\Common\Csrf\CsrfUtils;
use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Database\SqlQueryException;
use OpenEMR\Common\Session\SessionWrapperFactory;
use Symfony\Component\HttpFoundation\Session\Session;
use Symfony\Component\HttpFoundation\Session\Storage\MockArraySessionStorage;

require dirname(__DIR__, 5) . '/vendor/autoload.php';

final class MessageScenario
{
    /** @var array<array-key, mixed> */
    public static array $input = [];
    /** @var list<array{string, array<mixed>}> */
    public static array $writes = [];
    /** @var list<array{string, array<mixed>}> */
    public static array $lookups = [];
    /** @var array{int, string, bool}|null */
    public static ?array $csrf = null;
}

final class CsrfDouble
{
    public static function checkCsrfInput(int $input, string $subject, bool $dieOnFail): void
    {
        MessageScenario::$csrf = [$input, $subject, $dieOnFail];
        if (!(MessageScenario::$input['csrf'] ?? true)) {
            exit;
        }
    }
}

final class QueryDouble
{
    /** @param array<mixed> $params */
    public static function fetchSingleValue(string $sql, string $column, array $params): string
    {
        return 'Staff Sender';
    }

    /**
     * @param array<mixed> $params
     * @return array<mixed>|false
     */
    public static function querySingleRow(string $sql, array $params): array|false
    {
        if (str_contains($sql, 'patient_data')) {
            return ['fname' => 'Patient', 'lname' => 'Name'];
        }
        MessageScenario::$lookups[] = [$sql, $params];
        if ((MessageScenario::$input['lookup'] ?? '') === 'exception') {
            throw new SqlQueryException($sql, 'Synthetic lookup failure');
        }
        if (array_key_exists('row', MessageScenario::$input)) {
            $row = MessageScenario::$input['row'];
            if (!is_array($row) && $row !== false) {
                throw new \RuntimeException('Invalid synthetic row');
            }
            return $row;
        }
        $rows = [
            'eligible' => ['username' => 'eligible', 'fname' => 'Canonical', 'lname' => 'Staff', 'active' => 1, 'portal_user' => 1],
            'inactive' => ['username' => 'inactive', 'fname' => 'Inactive', 'lname' => 'Staff', 'active' => 0, 'portal_user' => 1],
            'nonportal' => ['username' => 'nonportal', 'fname' => 'Nonportal', 'lname' => 'Staff', 'active' => 1, 'portal_user' => 0],
        ];
        $id = $params[0] ?? null;
        $row = is_string($id) ? ($rows[$id] ?? []) : [];
        if (str_contains($sql, 'active = 1') && ($row['active'] ?? 0) !== 1) {
            return [];
        }
        if (str_contains($sql, 'portal_user = 1') && ($row['portal_user'] ?? 0) !== 1) {
            return [];
        }
        return $row;
    }

    /** @param array<mixed> $params */
    public static function sqlInsert(string $sql, array $params): int
    {
        MessageScenario::$writes[] = [$sql, $params];
        return count(MessageScenario::$writes);
    }
}

// Mark only the bootstrap/config files as included, without reading any config
// or connecting to a database. The real entry's require_once skips these files.
final class EmptyBootstrapStream
{
    public mixed $context;
    private int $position = 0;

    /** @param-out string $openedPath */
    public function stream_open(string $path, string $mode, int $options, ?string &$openedPath): bool
    {
        $openedPath = $path;
        return true;
    }
    public function stream_read(int $count): string
    {
        $result = substr('<?php ', $this->position, $count);
        $this->position += strlen($result);
        return $result;
    }
    public function stream_eof(): bool
    {
        return $this->position >= 6;
    }
    /** @return array{} */
    public function stream_stat(): array
    {
        return [];
    }
    public function stream_set_option(int $option, int $arg1, int $arg2): bool
    {
        return false;
    }
}

$root = dirname(__DIR__, 5);
$senderSource = (new \ReflectionClass(\OpenEMR\Services\PortalMessagingSender::class))->getFileName();
if ($senderSource !== $root . '/src/Services/PortalMessagingSender.php') {
    throw new \RuntimeException('Autoload resolved messaging source outside this worktree');
}
stream_wrapper_unregister('file');
stream_wrapper_register('file', EmptyBootstrapStream::class);
require_once $root . '/interface/globals.php';
require_once $root . '/library/sqlconf.php';
stream_wrapper_restore('file');

class_alias(CsrfDouble::class, CsrfUtils::class);
class_alias(QueryDouble::class, QueryUtils::class);
$scenario = json_decode(($argv ?? [])[1] ?? '{}', true, flags: JSON_THROW_ON_ERROR);
if (!is_array($scenario)) {
    throw new \RuntimeException('Invalid synthetic scenario');
}
MessageScenario::$input = $scenario;
$session = new Session(new MockArraySessionStorage());
$staff = ($scenario['actor'] ?? 'patient') === 'staff';
$session->replace($staff ? ['authUserID' => 7, 'authUser' => 'staff-sender'] : [
    'pid' => 42, 'patient_portal_onsite_two' => true, 'portal_username' => 'patient-42',
]);
$sessionValues = $scenario['session'] ?? [];
if (!is_array($sessionValues)) {
    throw new \RuntimeException('Invalid synthetic session');
}
foreach ($sessionValues as $key => $value) {
    if (!is_string($key)) {
        throw new \RuntimeException('Invalid synthetic session key');
    }
    $session->set($key, $value);
}
SessionWrapperFactory::getInstance()->setActiveSession($session);
$GLOBALS['portal_onsite_two_enable'] = true;
$GLOBALS['disable_translation'] = true;
$post = $scenario['post'] ?? [];
if (!is_array($post)) {
    throw new \RuntimeException('Invalid synthetic POST');
}
$_POST = array_replace([
    'task' => 'add', 'pid' => '42', 'sender_id' => $staff ? 'forged-sender' : 'patient-42',
    'sender_name' => $staff ? 'Forged Sender' : 'Patient Name',
    'recipient_id' => 'eligible', 'recipient_name' => 'Forged Recipient',
    'inputBody' => 'Synthetic body', 'title' => 'Synthetic title', 'noteid' => 100, 'replyid' => 80,
], $post);
// Load the actual legacy SQL wrappers, but skip their connection initialization.
define('OPENEMR_STATIC_ANALYSIS', true);
require $root . '/library/sql.inc.php';
ob_start();
register_shutdown_function(static function (): void {
    $output = ob_get_clean();
    echo json_encode(['output' => $output, 'writes' => MessageScenario::$writes, 'lookups' => MessageScenario::$lookups, 'csrf' => MessageScenario::$csrf], JSON_THROW_ON_ERROR);
});
require $root . '/portal/messaging/handle_note.php';
