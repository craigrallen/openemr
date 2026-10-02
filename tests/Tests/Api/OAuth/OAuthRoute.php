<?php

/**
 * Allowlisted route classes for OAuth API-test redirect diagnostics.
 *
 * Classifies a request path into a known OAuth/login route without ever
 * echoing the path itself, so a diagnostic can say "provider/login"
 * without risking a raw path that embeds a token or other secret.
 * Anything not on the allowlist is Unknown.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen <craig@interconnected.au>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Api\OAuth;

enum OAuthRoute
{
    case Authorize;
    case ProviderLogin;
    case ScopeAuthorizeConfirm;
    case Registration;
    case Token;
    case DeviceCode;
    case Logout;
    case CoreLogin;
    case Root;
    case Unknown;

    /**
     * @param string $basePath path component of the configured base URL ('' when served at the web root)
     * @param string $path     request path only; callers must not pass query, fragment, or authority
     */
    public static function classify(string $basePath, string $path): self
    {
        $basePath = rtrim($basePath, '/');
        if ($basePath !== '') {
            if (!str_starts_with($path, $basePath . '/') && $path !== $basePath) {
                return self::Unknown;
            }
            $path = substr($path, strlen($basePath));
        }

        if ($path === '' || $path === '/') {
            return self::Root;
        }
        if ($path === '/interface/login/login.php') {
            return self::CoreLogin;
        }
        if (preg_match('#^/oauth2/[A-Za-z0-9_-]{1,64}(/[a-z/-]{1,64})$#', $path, $matches) !== 1) {
            return self::Unknown;
        }

        return match ($matches[1]) {
            '/authorize' => self::Authorize,
            '/provider/login' => self::ProviderLogin,
            '/scope-authorize-confirm' => self::ScopeAuthorizeConfirm,
            '/registration' => self::Registration,
            '/token' => self::Token,
            '/device/code' => self::DeviceCode,
            '/logout' => self::Logout,
            default => self::Unknown,
        };
    }

    public function label(): string
    {
        return match ($this) {
            self::Authorize => 'oauth2/authorize',
            self::ProviderLogin => 'oauth2/provider/login',
            self::ScopeAuthorizeConfirm => 'oauth2/scope-authorize-confirm',
            self::Registration => 'oauth2/registration',
            self::Token => 'oauth2/token',
            self::DeviceCode => 'oauth2/device/code',
            self::Logout => 'oauth2/logout',
            self::CoreLogin => 'core/login',
            self::Root => 'root',
            self::Unknown => 'unknown',
        };
    }
}
