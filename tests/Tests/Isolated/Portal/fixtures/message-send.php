<?php

/** Isolated entry harness: only infrastructure is doubled; messaging code is loaded unchanged. */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\Portal\Fixtures;

if (PHP_SAPI !== 'cli') {
    exit(1);
}

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
    public static int $lastInsertedId = 199;
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
    /**
     * Find the bind belonging to a column predicate, regardless of clause order.
     * @param array<mixed> $params
     * @return list<mixed>
     */
    private static function boundColumns(string $sql, array $params, string $column): array
    {
        $pattern = '/(?:`?[a-z_]+`?\.)?`?' . preg_quote($column, '/') . '`?\s*=\s*\?/i';
        preg_match_all($pattern, $sql, $matches, PREG_OFFSET_CAPTURE);
        $values = [];
        foreach ($matches[0] as $match) {
            $index = substr_count(substr($sql, 0, $match[1]), '?');
            $values[] = $params[$index] ?? null;
        }
        return $values;
    }

    private static function sameSqlScalar(mixed $actual, mixed $expected): bool
    {
        if ((!is_int($actual) && !is_string($actual)) || (!is_int($expected) && !is_string($expected))) {
            return false;
        }
        return (string) $actual === (string) $expected;
    }

    /**
     * Simulate onsite_mail predicate scoping; omitted predicates intentionally match wider rows.
     * @param array<mixed> $params
     * @return array<mixed>|false
     */
    private static function threadRow(string $sql, array $params): array|false
    {
        $rows = MessageScenario::$input['threads'] ?? [[
            'id' => 137, 'mail_chain' => 100, 'reply_mail_chain' => 80,
            'owner' => 'patient-42', 'sender_id' => 'eligible', 'recipient_id' => 'patient-42', 'deleted' => 0,
        ]];
        if (!is_array($rows)) {
            throw new \RuntimeException('Invalid synthetic threads');
        }
        $owner = self::boundColumns($sql, $params, 'owner')[0] ?? null;
        $senders = self::boundColumns($sql, $params, 'sender_id');
        $recipients = self::boundColumns($sql, $params, 'recipient_id');
        $chains = self::boundColumns($sql, $params, 'mail_chain');
        $chain = $chains[0] ?? null;
        $id = self::boundColumns($sql, $params, 'id')[0] ?? null;
        foreach ($rows as $row) {
            if (!is_array($row)) {
                throw new \RuntimeException('Invalid synthetic thread row');
            }
            if ($owner !== null && ($row['owner'] ?? null) !== $owner) {
                continue;
            }
            if ($senders || $recipients) {
                $peerMatches = false;
                foreach ($senders ?: [null] as $index => $sender) {
                    $recipient = $recipients[$index] ?? ($recipients[0] ?? null);
                    if (($sender === null || ($row['sender_id'] ?? null) === $sender) &&
                        ($recipient === null || ($row['recipient_id'] ?? null) === $recipient)) {
                        $peerMatches = true;
                    }
                }
                if (!$peerMatches) {
                    continue;
                }
            }
            $rowChain = $row['mail_chain'] ?? null;
            $chainMatches = $chain !== null && self::sameSqlScalar($rowChain, $chain) &&
                !self::sameSqlScalar($rowChain, 0);
            $idMatches = $id !== null && self::sameSqlScalar($row['id'] ?? null, $id);
            $zeroGuard = preg_match('/`?mail_chain`?\s*=\s*0\b/i', $sql) === 1 ||
                (count($chains) > 1 && self::sameSqlScalar($chains[1], 0));
            $fallbackMatches = $idMatches && (!$zeroGuard || self::sameSqlScalar($rowChain, 0));
            if (($chain !== null || $id !== null) && !$chainMatches && !$fallbackMatches) {
                continue;
            }
            $deletedBind = self::boundColumns($sql, $params, 'deleted')[0] ?? null;
            $deletedIsScoped = preg_match('/`?deleted`?\s*(?:!=|<>)\s*1\b|`?deleted`?\s*=\s*0\b/i', $sql) ||
                self::sameSqlScalar($deletedBind, 0);
            if ($deletedIsScoped && ($row['deleted'] ?? null) !== 0) {
                continue;
            }
            return $row;
        }
        return false;
    }

    /** @param array<mixed> $params */
    public static function fetchSingleValue(string $sql, string $column, array $params): string
    {
        return 'Staff Sender';
    }

    /**
     * @param array<mixed> $params
     * @return array<mixed>|false
     */
    public static function querySingleRow(string $sql, array $params, bool $log = true): array|false
    {
        if (preg_match('/SELECT\s+MAX\(id\)\s+as\s+newid\s+from\s+onsite_mail/i', $sql)) {
            return ['newid' => MessageScenario::$lastInsertedId];
        }
        if (str_contains($sql, 'patient_data')) {
            return ['fname' => 'Patient', 'lname' => 'Name'];
        }
        MessageScenario::$lookups[] = [$sql, $params];
        $isThread = str_contains(strtolower($sql), 'onsite_mail');
        if ((MessageScenario::$input[$isThread ? 'threadLookup' : 'lookup'] ?? '') === 'exception') {
            throw new SqlQueryException($sql, 'Synthetic lookup failure');
        }
        if ($isThread) {
            return self::threadRow($sql, $params);
        }
        $rows = array_key_exists('row', MessageScenario::$input) ? [MessageScenario::$input['row']] : [
            'eligible' => ['username' => 'eligible', 'fname' => 'Canonical', 'lname' => 'Staff', 'active' => 1, 'portal_user' => 1],
            'inactive' => ['username' => 'inactive', 'fname' => 'Inactive', 'lname' => 'Staff', 'active' => 0, 'portal_user' => 1],
            'nonportal' => ['username' => 'nonportal', 'fname' => 'Nonportal', 'lname' => 'Staff', 'active' => 1, 'portal_user' => 0],
        ];
        $requested = self::boundColumns($sql, $params, 'username')[0] ?? null;
        foreach ($rows as $row) {
            if ($row === false) {
                continue;
            }
            if (!is_array($row)) {
                throw new \RuntimeException('Invalid synthetic row');
            }
            if ($requested !== null && (!is_string($requested) || !is_string($row['username'] ?? null) ||
                strcasecmp($row['username'], $requested) !== 0)) {
                continue;
            }
            if (str_contains($sql, 'active = 1') && ($row['active'] ?? 1) !== 1) {
                continue;
            }
            if (str_contains($sql, 'portal_user = 1') && ($row['portal_user'] ?? 1) !== 1) {
                continue;
            }
            return $row;
        }
        return false;
    }

    /** @param array<mixed> $params */
    public static function sqlInsert(string $sql, array $params): int
    {
        MessageScenario::$writes[] = [$sql, $params];
        return ++MessageScenario::$lastInsertedId;
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
