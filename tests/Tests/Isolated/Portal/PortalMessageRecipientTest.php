<?php

/** Regression coverage for the real portal send entry and both mailbox inserts. */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\Portal;

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Database\SqlQueryException;
use OpenEMR\Services\PortalMessagingSender;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\PreserveGlobalState;
use PHPUnit\Framework\Attributes\RunInSeparateProcess;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Process\Process;

/** Records the real resolver's lookup without opening a database connection. */
final class RecipientLookupDouble
{
    /** @var list<array{string, array<mixed>}> */
    public static array $calls = [];
    public static mixed $row = false;
    public static bool $fail = false;

    /** @param array<mixed> $params */
    public static function querySingleRow(string $sql, array $params): mixed
    {
        self::$calls[] = [$sql, $params];
        if (self::$fail) {
            throw new SqlQueryException($sql, 'Synthetic lookup failure');
        }

        if (is_array(self::$row) &&
            ((str_contains($sql, 'active = 1') && (self::$row['active'] ?? 1) !== 1) ||
             (str_contains($sql, 'portal_user = 1') && (self::$row['portal_user'] ?? 1) !== 1))
        ) {
            return false;
        }

        return self::$row;
    }
}

final class PortalMessageRecipientTest extends TestCase
{
    private function directResolver(): PortalMessagingSender
    {
        self::assertFalse(class_exists(QueryUtils::class, false), 'QueryUtils must remain unloaded in this isolated PHPUnit process');
        self::assertTrue(class_alias(RecipientLookupDouble::class, QueryUtils::class));
        RecipientLookupDouble::$calls = [];
        RecipientLookupDouble::$row = false;
        RecipientLookupDouble::$fail = false;
        return new PortalMessagingSender();
    }

    #[RunInSeparateProcess]
    #[PreserveGlobalState(false)]
    public function testDirectRecipientLookupRequiresEligibleStaffAndBindsTheRequestedId(): void
    {
        $sender = $this->directResolver();
        RecipientLookupDouble::$row = [
            'username' => 'Canonical.Staff', 'fname' => 'Canonical', 'lname' => 'Staff',
            'active' => 1, 'portal_user' => 1,
        ];
        self::assertSame(['Canonical.Staff', 'Canonical Staff'], $sender->resolvePatientRecipient('requested.staff'));
        $eligibilitySql = 'SELECT username, fname, lname FROM users WHERE username = ? AND active = 1 AND portal_user = 1';
        self::assertSame([[$eligibilitySql, ['requested.staff']]], RecipientLookupDouble::$calls);

        foreach (['active' => 0, 'portal_user' => 0] as $column => $value) {
            RecipientLookupDouble::$row[$column] = $value;
            self::assertNull($sender->resolvePatientRecipient('requested.staff'));
            RecipientLookupDouble::$row[$column] = 1;
        }
    }

    #[RunInSeparateProcess]
    #[PreserveGlobalState(false)]
    public function testDirectRecipientLookupBindsHostileIdAsOneParameter(): void
    {
        $sender = $this->directResolver();
        RecipientLookupDouble::$row = ['username' => 'staff', 'fname' => 'Trusted', 'lname' => 'Name'];
        $forgedId = "staff' OR 1=1 --";
        self::assertSame(['staff', 'Trusted Name'], $sender->resolvePatientRecipient($forgedId));
        self::assertSame([[
            'SELECT username, fname, lname FROM users WHERE username = ? AND active = 1 AND portal_user = 1',
            [$forgedId],
        ]], RecipientLookupDouble::$calls);
    }

    #[RunInSeparateProcess]
    #[PreserveGlobalState(false)]
    public function testDirectRecipientLookupRejectsInvalidIdsBeforeQuery(): void
    {
        $sender = $this->directResolver();
        foreach ([null, false, 7, 7.5, [], ['staff'], '', " \t\n"] as $id) {
            self::assertNull($sender->resolvePatientRecipient($id));
        }
        self::assertSame([], RecipientLookupDouble::$calls);
    }

    #[RunInSeparateProcess]
    #[PreserveGlobalState(false)]
    public function testDirectRecipientLookupRejectsMissingAndMalformedRows(): void
    {
        $sender = $this->directResolver();
        foreach ([false, null, [], ['username' => 'staff'],
            ['username' => '', 'fname' => 'First', 'lname' => 'Last'],
            ['username' => '  ', 'fname' => 'First', 'lname' => 'Last'],
            ['username' => ['staff'], 'fname' => 'First', 'lname' => 'Last'],
            ['username' => 'staff', 'fname' => null, 'lname' => 'Last'],
            ['username' => 'staff', 'fname' => 'First', 'lname' => 9],
        ] as $row) {
            RecipientLookupDouble::$row = $row;
            self::assertNull($sender->resolvePatientRecipient('staff'));
        }
    }

    #[RunInSeparateProcess]
    #[PreserveGlobalState(false)]
    public function testDirectRecipientLookupFailsClosedOnSqlException(): void
    {
        $sender = $this->directResolver();
        RecipientLookupDouble::$fail = true;
        self::assertNull($sender->resolvePatientRecipient('staff'));
        self::assertCount(1, RecipientLookupDouble::$calls);
    }

    /**
     * @param array<string, mixed> $scenario
     * @return array{output: mixed, writes: list<array{string, array<mixed>}>, lookups: mixed, csrf: mixed}
     */
    private function dispatch(array $scenario): array
    {
        $process = new Process([PHP_BINARY, __DIR__ . '/fixtures/message-send.php', json_encode($scenario, JSON_THROW_ON_ERROR)]);
        $process->run();
        self::assertSame(0, $process->getExitCode(), $process->getErrorOutput());
        self::assertSame('', $process->getErrorOutput());
        $result = json_decode($process->getOutput(), true, flags: JSON_THROW_ON_ERROR);
        self::assertIsArray($result);
        self::assertIsArray($result['writes']);
        $writes = [];
        foreach ($result['writes'] as $write) {
            self::assertIsArray($write);
            self::assertIsString($write[0]);
            self::assertIsArray($write[1]);
            $writes[] = [$write[0], $write[1]];
        }
        return ['output' => $result['output'], 'writes' => $writes, 'lookups' => $result['lookups'], 'csrf' => $result['csrf']];
    }

    /** @return iterable<string, array{array<string, mixed>}> */
    public static function deniedRecipients(): iterable
    {
        foreach (['add', 'reply'] as $task) {
            foreach (['inactive', 'nonportal', 'missing', 'patient-99', '', null, ['eligible']] as $id) {
                yield $task . ':' . json_encode($id) => [['post' => ['task' => $task, 'recipient_id' => $id]]];
            }
            yield $task . ':lookup exception' => [['post' => ['task' => $task], 'lookup' => 'exception']];
        }
    }

    /** @param array<string, mixed> $scenario */
    #[DataProvider('deniedRecipients')]
    public function testPatientDenialPrecedesBothMailboxWrites(array $scenario): void
    {
        $result = $this->dispatch($scenario);
        self::assertSame([], $result['writes']);
        self::assertNotSame('ok', $result['output']);
    }

    /** @return iterable<array{string, string}> */
    public static function sendTasks(): iterable
    {
        yield ['add', 'New'];
        yield ['reply', 'Reply'];
    }

    #[DataProvider('sendTasks')]
    public function testEligibleRecipientGetsOriginalTwoCopiesWithCanonicalName(string $task, string $status): void
    {
        $result = $this->dispatch(['post' => ['task' => $task]]);
        self::assertSame('ok', $result['output']);
        self::assertSame([INPUT_POST, 'messages-portal', true], $result['csrf']);
        self::assertCount(2, $result['writes']);
        self::assertSame([[
            'SELECT username, fname, lname FROM users WHERE username = ? AND active = 1 AND portal_user = 1',
            ['eligible'],
        ]], $result['lookups']);
        foreach ($result['writes'] as $index => [$sql, $params]) {
            self::assertStringStartsWith('INSERT INTO onsite_mail', $sql);
            self::assertSame([
                'Synthetic body', $index === 0 ? 'patient-42' : 'eligible', 'patient-42', 'Default',
                '1', '1', 'Synthetic title', '', $index === 0 ? $status : 'New',
                $index === 0 ? 100 : 80, 'patient-42', 'Patient Name', 'eligible', 'Canonical Staff', 100,
            ], array_slice($params, 1));
        }
    }

    public function testStaffReplyToPatientPreservesLegacySemantics(): void
    {
        $result = $this->dispatch(['actor' => 'staff', 'post' => ['task' => 'reply', 'recipient_id' => 'patient-99', 'recipient_name' => 'Legacy Patient']]);
        self::assertSame('ok', $result['output']);
        self::assertCount(2, $result['writes']);
        self::assertSame([], $result['lookups']);
        foreach ($result['writes'] as $index => [$sql, $params]) {
            self::assertSame($index === 0 ? 'staff-sender' : 'patient-99', $params[2]);
            self::assertSame(['staff-sender', 'Staff Sender', 'patient-99', 'Legacy Patient'], array_slice($params, 11, 4));
        }
    }

    public function testMalformedPostedRecipientNameIsIgnoredForPatients(): void
    {
        $result = $this->dispatch(['post' => ['recipient_name' => ['forged']]]);
        self::assertCount(2, $result['writes']);
        self::assertSame('Canonical Staff', $result['writes'][0][1][14]);
        self::assertSame('Canonical Staff', $result['writes'][1][1][14]);
    }

    public function testForgedPostedDisplayNameDoesNotEnterRecipientLookup(): void
    {
        $result = $this->dispatch(['post' => ['recipient_name' => "Forged' OR 1=1 --"]]);
        self::assertSame([[
            'SELECT username, fname, lname FROM users WHERE username = ? AND active = 1 AND portal_user = 1',
            ['eligible'],
        ]], $result['lookups']);
        self::assertSame('Canonical Staff', $result['writes'][0][1][14]);
    }

    public function testPostedActorFlagsCannotAuthorizePatientToPatientSend(): void
    {
        $result = $this->dispatch(['post' => [
            'recipient_id' => 'patient-99', 'isPatientSender' => false,
            'authUserID' => 7, 'authUser' => 'staff-sender', 'IS_DASHBOARD' => true,
        ]]);
        self::assertSame([], $result['writes']);
    }

    public function testLookupMustReturnVerifiedCanonicalIdentity(): void
    {
        foreach ([false, [], ['username' => ''], ['username' => ['eligible']], ['username' => 'eligible', 'fname' => null, 'lname' => 'Staff']] as $row) {
            self::assertSame([], $this->dispatch(['row' => $row])['writes']);
        }
    }

    public function testCanonicalUsernameComesFromLookup(): void
    {
        $result = $this->dispatch(['row' => ['username' => 'Eligible', 'fname' => 'Canonical', 'lname' => 'Staff']]);
        self::assertCount(2, $result['writes']);
        self::assertSame('Eligible', $result['writes'][1][1][2]);
        self::assertSame('Eligible', $result['writes'][0][1][13]);
    }

    public function testMissingSenderAndInvalidPatientContextFailClosed(): void
    {
        foreach ([
            ['post' => ['sender_id' => '', 'sender_name' => '']],
            ['session' => ['patient_portal_onsite_two' => false]],
            ['session' => ['pid' => null], 'post' => ['pid' => '']],
            ['session' => ['pid' => '42.5'], 'post' => ['pid' => '']],
            ['session' => ['pid' => '4e2'], 'post' => ['pid' => '']],
        ] as $scenario) {
            self::assertSame([], $this->dispatch($scenario)['writes']);
        }
    }

    public function testOriginalPatientBindingAndCsrfStillPrecedeWrites(): void
    {
        foreach ([['post' => ['pid' => '99']], ['post' => ['sender_id' => 'staff-sender']], ['csrf' => false]] as $scenario) {
            self::assertSame([], $this->dispatch($scenario)['writes']);
        }
    }
}
