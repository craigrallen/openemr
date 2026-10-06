<?php

/** Regression coverage for the real portal send entry and both mailbox inserts. */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\Portal;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Process\Process;

final class PortalMessageRecipientTest extends TestCase
{
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
