<?php

/**
 * Sanitized redirect trace for OAuth API-test assertion messages.
 *
 * Attach via Guzzle's per-request `on_stats` option; Guzzle invokes it
 * once per underlying transfer, including every followed redirect hop,
 * without altering redirect, cookie, or timeout behavior.
 *
 * Each hop records only: an allowlisted method, the scheme (http/https/
 * other), whether the origin matches the base URL, the OAuthRoute class
 * of the path, and the status code. Hosts, ports, raw paths, query
 * strings, fragments, userinfo, headers, cookies, and bodies are never
 * stored or emitted.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen <craig@interconnected.au>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Api\OAuth;

use GuzzleHttp\TransferStats;
use Psr\Http\Message\RequestInterface;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\UriInterface;

final class RedirectTrace
{
    /** Initial request + allow_redirects max (10) + slack. */
    public const MAX_HOPS = 12;

    private const SAFE_METHODS = ['GET', 'POST', 'HEAD', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];

    /** @var list<string> */
    private array $hops = [];
    private int $transferCount = 0;
    private string $finalRoute = '';
    private string $finalStatus = '';

    public function __construct(private readonly UriInterface $baseUri)
    {
    }

    public function onStats(TransferStats $stats): void
    {
        $this->record($stats->getRequest(), $stats->getResponse());
    }

    public function record(RequestInterface $request, ?ResponseInterface $response): void
    {
        $uri = $request->getUri();
        $method = strtoupper($request->getMethod());
        $scheme = strtolower($uri->getScheme());
        $route = OAuthRoute::classify($this->baseUri->getPath(), $uri->getPath())->label();
        $status = $response === null ? 'no-response' : (string) $response->getStatusCode();

        $this->transferCount++;
        $this->finalRoute = $route;
        $this->finalStatus = $status;
        if (count($this->hops) >= self::MAX_HOPS) {
            return;
        }
        $this->hops[] = sprintf(
            '[%d] %s %s %s %s -> %s',
            $this->transferCount,
            in_array($method, self::SAFE_METHODS, true) ? $method : 'OTHER',
            in_array($scheme, ['http', 'https'], true) ? $scheme : 'other',
            $this->isSameOrigin($uri) ? 'same-origin' : 'cross-origin',
            $route,
            $status
        );
    }

    public function summary(): string
    {
        if ($this->transferCount === 0) {
            return 'redirect trace: no transfers recorded';
        }
        $omitted = $this->transferCount - count($this->hops);
        return sprintf(
            'redirect trace (%d %s): %s%s; final %s -> %s',
            $this->transferCount,
            $this->transferCount === 1 ? 'transfer' : 'transfers',
            implode('; ', $this->hops),
            $omitted > 0 ? sprintf('; (+%d transfers omitted)', $omitted) : '',
            $this->finalRoute,
            $this->finalStatus
        );
    }

    private function isSameOrigin(UriInterface $uri): bool
    {
        return strtolower($uri->getScheme()) === strtolower($this->baseUri->getScheme())
            && strtolower($uri->getHost()) === strtolower($this->baseUri->getHost())
            && self::effectivePort($uri) === self::effectivePort($this->baseUri);
    }

    private static function effectivePort(UriInterface $uri): ?int
    {
        return $uri->getPort() ?? match (strtolower($uri->getScheme())) {
            'http' => 80,
            'https' => 443,
            default => null,
        };
    }
}
