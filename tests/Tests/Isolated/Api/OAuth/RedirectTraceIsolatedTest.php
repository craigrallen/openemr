<?php

/**
 * Isolated tests for the OAuth API-test redirect diagnostics.
 *
 * The trace is attached to failing OAuth API-test assertions, so these
 * tests pin both what it reports (methods, statuses, allowlisted route
 * classes) and what it must never report (query strings, fragments,
 * userinfo, hosts, headers, cookies, response bodies).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen <craig@interconnected.au>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\Api\OAuth;

use GuzzleHttp\Client;
use GuzzleHttp\Cookie\CookieJar;
use GuzzleHttp\Handler\MockHandler;
use GuzzleHttp\HandlerStack;
use GuzzleHttp\Psr7\Request;
use GuzzleHttp\Psr7\Response;
use GuzzleHttp\Psr7\Uri;
use OpenEMR\Tests\Api\OAuth\OAuthRoute;
use OpenEMR\Tests\Api\OAuth\RedirectTrace;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

class RedirectTraceIsolatedTest extends TestCase
{
    private const BASE_URL = 'https://localhost:9300';

    /**
     * @return array<string, array{string, string, OAuthRoute}>
     *
     * @codeCoverageIgnore Data providers run before coverage instrumentation starts.
     */
    public static function routeProvider(): array
    {
        return [
            'authorize' => ['', '/oauth2/default/authorize', OAuthRoute::Authorize],
            'provider login' => ['', '/oauth2/default/provider/login', OAuthRoute::ProviderLogin],
            'non-default site' => ['', '/oauth2/site_2/provider/login', OAuthRoute::ProviderLogin],
            'scope confirm' => ['', '/oauth2/default/scope-authorize-confirm', OAuthRoute::ScopeAuthorizeConfirm],
            'registration' => ['', '/oauth2/default/registration', OAuthRoute::Registration],
            'token' => ['', '/oauth2/default/token', OAuthRoute::Token],
            'device code' => ['', '/oauth2/default/device/code', OAuthRoute::DeviceCode],
            'logout' => ['', '/oauth2/default/logout', OAuthRoute::Logout],
            'core login' => ['', '/interface/login/login.php', OAuthRoute::CoreLogin],
            'root' => ['', '/', OAuthRoute::Root],
            'empty path' => ['', '', OAuthRoute::Root],
            'webroot prefix stripped' => ['/openemr', '/openemr/oauth2/default/authorize', OAuthRoute::Authorize],
            'webroot required when configured' => ['/openemr', '/oauth2/default/authorize', OAuthRoute::Unknown],
            'trailing slash is not the route' => ['', '/oauth2/default/authorize/', OAuthRoute::Unknown],
            'extra segment' => ['', '/oauth2/default/authorize/extra', OAuthRoute::Unknown],
            'secret-looking path' => ['', '/oauth2/default/s3cr3t-t0ken-value', OAuthRoute::Unknown],
            'invalid site characters' => ['', '/oauth2/de.fault/authorize', OAuthRoute::Unknown],
            'encoded traversal' => ['', '/oauth2/default/%2e%2e/authorize', OAuthRoute::Unknown],
            'client callback' => ['', '/cb', OAuthRoute::Unknown],
        ];
    }

    #[Test]
    #[DataProvider('routeProvider')]
    public function classifiesOnlyAllowlistedPaths(string $basePath, string $path, OAuthRoute $expected): void
    {
        $this->assertSame($expected, OAuthRoute::classify($basePath, $path));
    }

    #[Test]
    public function summarizesRedirectChainThroughGuzzleWithoutLeakingSecrets(): void
    {
        $mock = new MockHandler([
            new Response(307, [
                'Location' => 'https://user:hunter2@localhost:9300/oauth2/default/provider/login?code=SECRETCODE#frag-secret',
                'Set-Cookie' => 'OpenEMR=SESSIONSECRET; path=/',
            ]),
            new Response(403, ['Set-Cookie' => 'OpenEMR=SESSIONSECRET2; path=/'], '<html><body>Forbidden BODYSECRET</body></html>'),
        ]);
        $http = new Client([
            'handler' => HandlerStack::create($mock),
            'http_errors' => false,
            'cookies' => new CookieJar(),
            'allow_redirects' => ['max' => 10, 'strict' => true, 'referer' => true, 'protocols' => ['http', 'https']],
        ]);
        $trace = new RedirectTrace(new Uri(self::BASE_URL));

        $response = $http->get(
            self::BASE_URL . '/oauth2/default/authorize?client_id=CLIENTSECRET&state=STATESECRET',
            ['on_stats' => $trace->onStats(...)]
        );

        $this->assertSame(403, $response->getStatusCode());
        $summary = $trace->summary();
        $this->assertSame(
            'redirect trace (2 transfers): '
                . '[1] GET https same-origin oauth2/authorize -> 307; '
                . '[2] GET https same-origin oauth2/provider/login -> 403; '
                . 'final oauth2/provider/login -> 403',
            $summary
        );
        foreach (['SECRET', 'hunter2', 'user', 'frag', 'localhost', '9300', 'Cookie', 'OpenEMR', '<', 'Forbidden', '?', '#'] as $forbidden) {
            $this->assertStringNotContainsString($forbidden, $summary);
        }
    }

    #[Test]
    public function classifiesCrossOriginAndSchemeChanges(): void
    {
        $trace = new RedirectTrace(new Uri(self::BASE_URL));
        $trace->record(new Request('POST', 'https://localhost:9300/oauth2/default/scope-authorize-confirm'), new Response(302));
        $trace->record(new Request('GET', 'https://client.example/cb?code=SECRETCODE&state=x'), new Response(404));
        $trace->record(new Request('GET', 'http://localhost:9300/oauth2/default/provider/login'), null);

        $this->assertSame(
            'redirect trace (3 transfers): '
                . '[1] POST https same-origin oauth2/scope-authorize-confirm -> 302; '
                . '[2] GET https cross-origin unknown -> 404; '
                . '[3] GET http cross-origin oauth2/provider/login -> no-response; '
                . 'final oauth2/provider/login -> no-response',
            $trace->summary()
        );
    }

    #[Test]
    public function defaultPortsMatchImplicitBaseOrigin(): void
    {
        $trace = new RedirectTrace(new Uri('https://LocalHost'));
        $trace->record(new Request('GET', 'https://localhost:443/oauth2/default/authorize'), new Response(200));

        $this->assertSame(
            'redirect trace (1 transfer): [1] GET https same-origin oauth2/authorize -> 200; final oauth2/authorize -> 200',
            $trace->summary()
        );
    }

    #[Test]
    public function sanitizesUnexpectedMethodsAndSchemes(): void
    {
        $trace = new RedirectTrace(new Uri(self::BASE_URL));
        $trace->record(new Request('X-SECRET-VERB', 'ftp://localhost:9300/oauth2/default/token'), new Response(200));

        $this->assertSame(
            'redirect trace (1 transfer): [1] OTHER other cross-origin oauth2/token -> 200; final oauth2/token -> 200',
            $trace->summary()
        );
    }

    #[Test]
    public function boundsRecordedHopsButKeepsFinalTransfer(): void
    {
        $trace = new RedirectTrace(new Uri(self::BASE_URL));
        for ($i = 0; $i < RedirectTrace::MAX_HOPS + 3; $i++) {
            $trace->record(new Request('GET', self::BASE_URL . '/oauth2/default/authorize'), new Response(307));
        }
        $trace->record(new Request('GET', self::BASE_URL . '/oauth2/default/provider/login'), new Response(403));

        $summary = $trace->summary();
        $this->assertStringStartsWith('redirect trace (' . (RedirectTrace::MAX_HOPS + 4) . ' transfers): ', $summary);
        $this->assertSame(RedirectTrace::MAX_HOPS, substr_count($summary, ' -> 307;'));
        $this->assertStringContainsString('(+4 transfers omitted); final oauth2/provider/login -> 403', $summary);
    }

    #[Test]
    public function reportsWhenNothingWasRecorded(): void
    {
        $trace = new RedirectTrace(new Uri(self::BASE_URL));

        $this->assertSame('redirect trace: no transfers recorded', $trace->summary());
    }
}
