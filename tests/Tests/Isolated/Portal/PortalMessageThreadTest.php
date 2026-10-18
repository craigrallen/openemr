<?php

/** Actual handle_note.php regression cases for patient mailbox thread authority. */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\Portal;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/PortalMessageRecipientTest.php';

final class PortalMessageThreadTest extends TestCase
{
    /**
     * @param array<string, mixed> $scenario
     * @return array{output: string, writes: list<array{string, array<mixed>}>, lookups: list<array{string, array<mixed>}>, csrf: array{int, string, bool}|null}
     */
    private function send(array $scenario): array
    {
        return PortalMessageRecipientTest::dispatch($scenario);
    }

    /**
     * The selected patient mailbox chain is 100; the incoming staff peer chain is 80.
     * @param array<string, mixed> $changes
     * @return array<string, mixed>
     */
    private static function incomingRow(array $changes = []): array
    {
        return array_replace([
            'id' => 137, 'mail_chain' => 100, 'reply_mail_chain' => 80,
            'owner' => 'patient-42', 'sender_id' => 'eligible', 'recipient_id' => 'patient-42', 'deleted' => 0,
        ], $changes);
    }

    public function testIncomingThreadIsAuthorizedAfterCanonicalRecipientBeforeEitherCopy(): void
    {
        $result = $this->send(['post' => ['task' => 'reply', 'noteid' => 100, 'replyid' => 900]]);
        self::assertSame('ok', $result['output']);
        self::assertSame([INPUT_POST, 'messages-portal', true], $result['csrf']);
        self::assertCount(2, $result['writes']);
        self::assertGreaterThanOrEqual(2, count($result['lookups']));
        self::assertSame(['eligible'], $result['lookups'][0][1]);
        [$sql, $params] = $result['lookups'][1];
        self::assertStringContainsString('onsite_mail', $sql);
        self::assertMatchesRegularExpression('/`?mail_chain`?\s*=\s*\?/i', $sql);
        self::assertMatchesRegularExpression('/`?owner`?\s*=\s*\?/i', $sql);
        self::assertMatchesRegularExpression('/`?sender_id`?\s*=\s*\?/i', $sql);
        self::assertMatchesRegularExpression('/`?recipient_id`?\s*=\s*\?/i', $sql);
        self::assertMatchesRegularExpression('/`?deleted`?\s*(?:!=|<>|=)\s*(?:1|0|\?)/i', $sql);
        self::assertContains(100, $params);
        self::assertContains('patient-42', $params);
        self::assertContains('eligible', $params);
        self::assertNotContains(900, $params, 'Posted replyid must not select the peer chain');
        self::assertSame('patient-42', $result['writes'][0][1][2]);
        self::assertSame(100, $result['writes'][0][1][10]);
        self::assertSame('eligible', $result['writes'][1][1][2]);
        self::assertSame(80, $result['writes'][1][1][10]);
        self::assertSame(100, $result['writes'][1][1][15]);
    }

    public function testCanonicalPeerFromLookupControlsThreadAuthorization(): void
    {
        $result = $this->send([
            'post' => ['task' => 'reply', 'recipient_id' => 'eligible', 'recipient_name' => 'Forged', 'noteid' => 100],
            'row' => ['username' => 'Eligible', 'fname' => 'Canonical', 'lname' => 'Staff'],
            'threads' => [self::incomingRow(['sender_id' => 'Eligible'])],
        ]);
        self::assertCount(2, $result['writes']);
        self::assertSame('Eligible', $result['writes'][1][1][2]);
        self::assertSame('Canonical Staff', $result['writes'][0][1][14]);
        self::assertContains('Eligible', $result['lookups'][1][1]);
    }

    public function testZeroChainUsesSelectedRowIdAsPatientChain(): void
    {
        $result = $this->send([
            'post' => ['task' => 'reply', 'noteid' => 137, 'replyid' => 999],
            'threads' => [self::incomingRow(['mail_chain' => 0])],
        ]);
        self::assertCount(2, $result['writes']);
        self::assertGreaterThanOrEqual(2, count($result['lookups']));
        self::assertMatchesRegularExpression('/`?mail_chain`?\s*=\s*(?:0|\?)/i', $result['lookups'][1][0]);
        self::assertMatchesRegularExpression('/`?id`?\s*=\s*\?/i', $result['lookups'][1][0]);
        self::assertContains(137, $result['lookups'][1][1]);
        self::assertSame(137, $result['writes'][0][1][10]);
        self::assertSame(80, $result['writes'][1][1][10]);
    }

    /** @return iterable<string, array{mixed}> */
    public static function invalidThreadIds(): iterable
    {
        foreach ([null, '', '0', 0, -1, '-1', '01', '+100', '100.0', '1e2', '100abc', ' 100', '100 ', "100\n", true, false, 100.0, [], [100], '9223372036854775808'] as $id) {
            yield json_encode($id, JSON_THROW_ON_ERROR) => [$id];
        }
    }

    #[DataProvider('invalidThreadIds')]
    public function testInvalidThreadIdsFailBeforeMailboxWrites(mixed $id): void
    {
        $result = $this->send(['post' => ['task' => 'reply', 'noteid' => $id]]);
        self::assertSame([], $result['writes']);
    }

    /** @return iterable<string, array{array<string, mixed>}> */
    public static function unauthorizedThreads(): iterable
    {
        yield 'missing' => [['threads' => []]];
        yield 'deleted' => [['threads' => [self::incomingRow(['deleted' => 1])]]];
        yield 'other owner' => [['threads' => [self::incomingRow(['owner' => 'patient-99'])]]];
        yield 'other staff peer' => [['threads' => [self::incomingRow(['sender_id' => 'other.staff'])]]];
        yield 'other patient peer' => [['threads' => [self::incomingRow(['recipient_id' => 'patient-99'])]]];
        yield 'other chain' => [['threads' => [self::incomingRow(['mail_chain' => 900, 'reply_mail_chain' => 901])]]];
        yield 'lookup exception' => [['threadLookup' => 'exception']];
        yield 'missing chain' => [['threads' => [self::incomingRow(['mail_chain' => null])]]];
        yield 'zero chain wrong row id' => [['threads' => [self::incomingRow(['id' => 138, 'mail_chain' => 0])]]];
        yield 'malformed peer chain' => [['threads' => [self::incomingRow(['reply_mail_chain' => '900abc'])]]];
        yield 'missing peer chain' => [['threads' => [self::incomingRow(['reply_mail_chain' => null])]]];
        yield 'malformed owner' => [['threads' => [self::incomingRow(['owner' => ['patient-42']])]]];
    }

    /** @param array<string, mixed> $scenario */
    #[DataProvider('unauthorizedThreads')]
    public function testUnauthorizedOrMalformedThreadNeverWritesEitherCopy(array $scenario): void
    {
        $scenario['post'] = ['task' => 'reply', 'noteid' => 100];
        $result = $this->send($scenario);
        self::assertSame([], $result['writes']);
    }

    public function testRowIdCannotReplaceItsNonzeroMailChain(): void
    {
        $result = $this->send([
            'post' => ['task' => 'reply', 'noteid' => 137],
            'threads' => [self::incomingRow()],
        ]);
        self::assertSame([], $result['writes']);
    }

    public function testPostedReplyIdCannotRedirectEitherChain(): void
    {
        foreach (['900', 901, ['forged'], -9] as $replyId) {
            $result = $this->send(['post' => ['task' => 'reply', 'noteid' => 100, 'replyid' => $replyId]]);
            self::assertCount(2, $result['writes']);
            self::assertSame(100, $result['writes'][0][1][10]);
            self::assertSame(80, $result['writes'][1][1][10]);
            self::assertSame(100, $result['writes'][1][1][15]);
        }
    }

    public function testNewPatientMessageIgnoresSuppliedThreadLinkage(): void
    {
        $result = $this->send(['post' => ['task' => 'add', 'noteid' => 100, 'replyid' => 80]]);
        self::assertSame('ok', $result['output']);
        self::assertCount(2, $result['writes']);
        self::assertCount(1, $result['lookups']);
        self::assertSame(200, $result['writes'][0][1][10]);
        self::assertSame(200, $result['writes'][0][1][15]);
        self::assertSame(201, $result['writes'][1][1][10]);
        self::assertSame(200, $result['writes'][1][1][15]);
    }
}
