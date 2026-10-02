<?php

/**
 * Isolated test: the release-mechanism smoketest makes its --rel-branch
 * resolvable before invoking openemr:release-prep.
 *
 * `.github/workflows/release-mechanism-smoketest.yml` runs on master pushes
 * and passes a hardcoded `--rel-branch` to the release-prep command, whose
 * CompatibilityMutator requires `<relBranch>` or `origin/<relBranch>` to
 * resolve via `git rev-parse`. Forks typically carry master but not the rel
 * branches, so on a fork the checkout has neither ref and the job fails.
 * The workflow compensates with a step that fetches the branch read-only
 * from the canonical upstream into a durable local ref when it is missing.
 *
 * The bootstrap script is executed here against disposable local repos
 * standing in for the fork and the upstream, so no network is needed.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\Ci;

use PHPUnit\Framework\TestCase;
use Symfony\Component\Process\Process;
use Symfony\Component\Yaml\Yaml;

class ReleaseSmoketestRelBranchIsolatedTest extends TestCase
{
    private const REPO_ROOT = __DIR__ . '/../../../..';
    private const WORKFLOW_FILE = self::REPO_ROOT . '/.github/workflows/release-mechanism-smoketest.yml';
    private const BOOTSTRAP_STEP_ID = 'rel-branch-ref';
    private const CANONICAL_UPSTREAM = 'https://github.com/openemr/openemr.git';

    private string $tmpDir = '';

    protected function tearDown(): void
    {
        if ($this->tmpDir !== '') {
            (new Process(['rm', '-rf', $this->tmpDir]))->run();
        }
    }

    public function testBootstrapStepTargetsTheMutatorRelBranchFromCanonicalUpstream(): void
    {
        $steps = $this->steps();
        $bootstrapIndex = $this->bootstrapStepIndex($steps);
        $bootstrap = $steps[$bootstrapIndex];
        $env = $bootstrap['env'] ?? null;
        $this->assertIsArray($env, 'Bootstrap step must declare REL_BRANCH / UPSTREAM_URL env.');

        $mutatorIndex = null;
        $relBranch = null;
        foreach ($steps as $index => $step) {
            $run = $step['run'] ?? '';
            if (is_string($run) && preg_match('/--rel-branch=(\S+)/', $run, $m) === 1) {
                $mutatorIndex = $index;
                $relBranch = $m[1];
            }
        }
        $this->assertNotNull($mutatorIndex, 'No step passes --rel-branch to openemr:release-prep.');
        $this->assertLessThan($mutatorIndex, $bootstrapIndex, 'Bootstrap must run before release-prep.');
        $this->assertSame($relBranch, $env['REL_BRANCH'] ?? null, 'Bootstrap REL_BRANCH must match --rel-branch.');
        $this->assertSame(self::CANONICAL_UPSTREAM, $env['UPSTREAM_URL'] ?? null);
    }

    public function testBootstrapMakesRelBranchResolvableOnAForkWithoutIt(): void
    {
        [$fork, $upstream, $upstreamSha] = $this->makeForkAndUpstream(forkHasRelBranch: false);
        $this->assertNotSame($upstream, $this->git($fork, 'remote', 'get-url', 'origin'));

        $this->assertBootstrapSucceeds($this->runBootstrap($this->bootstrapScript(), $fork, $upstream));

        $this->assertSame($upstreamSha, $this->resolveLikeCompatibilityMutator($fork, 'rel-820'));
    }

    public function testFixtureRejectsABootstrapThatFetchesFromOriginInsteadOfUpstream(): void
    {
        [$fork, $upstream] = $this->makeForkAndUpstream(forkHasRelBranch: false);
        $mutated = str_replace('"$UPSTREAM_URL" "+refs/', 'origin "+refs/', $this->bootstrapScript(), $count);
        $this->assertSame(1, $count, 'Bootstrap fetch line changed; update the mutation.');

        $this->assertFalse($this->runBootstrap($mutated, $fork, $upstream)->isSuccessful());
    }

    public function testBootstrapLeavesAnExistingOriginRelBranchUntouched(): void
    {
        [$fork, , $upstreamSha, $forkRelSha] = $this->makeForkAndUpstream(forkHasRelBranch: true);
        $this->git($fork, 'fetch', '--quiet', 'origin', '+refs/heads/rel-820:refs/remotes/origin/rel-820');
        $this->assertNotSame($upstreamSha, $forkRelSha);

        // An unreachable upstream proves no fetch is attempted on this path.
        $process = $this->runBootstrap($this->bootstrapScript(), $fork, $this->tmpDir . '/does-not-exist.git');
        $this->assertBootstrapSucceeds($process);

        $this->assertSame($forkRelSha, $this->resolveLikeCompatibilityMutator($fork, 'rel-820'));
        $this->assertSame('', $this->git($fork, 'branch', '--list', 'rel-820'));
    }

    public function testBootstrapLeavesAnExistingLocalRelBranchUntouched(): void
    {
        [$fork, , , $forkRelSha] = $this->makeForkAndUpstream(forkHasRelBranch: true);
        $this->git($fork, 'fetch', '--quiet', 'origin', '+refs/heads/rel-820:refs/heads/rel-820');

        $process = $this->runBootstrap($this->bootstrapScript(), $fork, $this->tmpDir . '/does-not-exist.git');
        $this->assertBootstrapSucceeds($process);

        $this->assertSame($forkRelSha, $this->git($fork, 'rev-parse', 'refs/heads/rel-820'));
    }

    /**
     * @return list<array<mixed>>
     */
    private function steps(): array
    {
        $workflow = Yaml::parseFile(self::WORKFLOW_FILE);
        $this->assertIsArray($workflow);
        $jobs = $workflow['jobs'] ?? null;
        $this->assertIsArray($jobs);
        $smoketest = $jobs['smoketest'] ?? null;
        $this->assertIsArray($smoketest);
        $steps = $smoketest['steps'] ?? null;
        $this->assertIsArray($steps);
        return array_values(array_filter($steps, is_array(...)));
    }

    /**
     * @param list<array<mixed>> $steps
     */
    private function bootstrapStepIndex(array $steps): int
    {
        foreach ($steps as $index => $step) {
            if (($step['id'] ?? null) === self::BOOTSTRAP_STEP_ID) {
                return $index;
            }
        }
        $this->fail(sprintf('No step with id `%s` in release-mechanism-smoketest.yml.', self::BOOTSTRAP_STEP_ID));
    }

    private function bootstrapScript(): string
    {
        $steps = $this->steps();
        $script = $steps[$this->bootstrapStepIndex($steps)]['run'] ?? null;
        $this->assertIsString($script);
        return $script;
    }

    private function runBootstrap(string $script, string $fork, string $upstreamUrl): Process
    {
        $process = new Process(['bash', '-e', '-c', $script], $fork, [
            'REL_BRANCH' => 'rel-820',
            'UPSTREAM_URL' => $upstreamUrl,
            'GIT_CONFIG_GLOBAL' => '/dev/null',
        ]);
        $process->run();
        return $process;
    }

    private function assertBootstrapSucceeds(Process $process): void
    {
        $this->assertTrue($process->isSuccessful(), $process->getErrorOutput() . $process->getOutput());
    }

    /**
     * Builds two distinct bare remotes: an upstream carrying rel-820 and a
     * fork carrying master (plus its own, divergent rel-820 when asked), then
     * clones the fork so `origin` is the fork rather than the upstream.
     *
     * @return array{string, string, string, string} fork clone, upstream path, upstream rel-820 sha, fork rel-820 sha
     */
    private function makeForkAndUpstream(bool $forkHasRelBranch): array
    {
        $this->tmpDir = sys_get_temp_dir() . '/rel-smoke-' . bin2hex(random_bytes(6));
        $upstream = $this->tmpDir . '/upstream.git';
        $forkRemote = $this->tmpDir . '/fork.git';
        $seed = $this->tmpDir . '/seed';
        $fork = $this->tmpDir . '/fork';
        mkdir($seed, 0700, true);

        $this->git($this->tmpDir, 'init', '--bare', '--initial-branch=master', $upstream);
        $this->git($this->tmpDir, 'init', '--bare', '--initial-branch=master', $forkRemote);
        $this->git($seed, 'init', '--initial-branch=master');
        $this->git($seed, 'commit', '--allow-empty', '-m', 'base');
        $this->git($seed, 'switch', '-c', 'rel-820');
        $this->git($seed, 'commit', '--allow-empty', '-m', 'upstream rel');
        $upstreamSha = $this->git($seed, 'rev-parse', 'HEAD');
        $this->git($seed, 'switch', '-c', 'fork-rel-820', 'master');
        $this->git($seed, 'commit', '--allow-empty', '-m', 'fork rel');
        $forkRelSha = $this->git($seed, 'rev-parse', 'HEAD');

        $this->git($seed, 'push', '--quiet', $upstream, 'master', 'rel-820');
        $this->git($seed, 'push', '--quiet', $forkRemote, 'master');
        if ($forkHasRelBranch) {
            $this->git($seed, 'push', '--quiet', $forkRemote, 'fork-rel-820:rel-820');
        }

        $this->git($this->tmpDir, 'clone', '--quiet', '--branch', 'master', '--single-branch', $forkRemote, $fork);
        return [$fork, $upstream, $upstreamSha, $forkRelSha];
    }

    /**
     * Mirrors CompatibilityMutator::resolveRelBranchRef's candidate order.
     */
    private function resolveLikeCompatibilityMutator(string $repo, string $relBranch): string
    {
        foreach ([$relBranch, 'origin/' . $relBranch] as $candidate) {
            $probe = new Process(['git', 'rev-parse', '--verify', '--quiet', $candidate . '^{commit}'], $repo);
            $probe->run();
            if ($probe->isSuccessful()) {
                return trim($probe->getOutput());
            }
        }
        $this->fail("Neither {$relBranch} nor origin/{$relBranch} resolves.");
    }

    private function git(string $cwd, string ...$args): string
    {
        $process = new Process(['git', ...$args], $cwd, [
            'GIT_AUTHOR_NAME' => 'test',
            'GIT_AUTHOR_EMAIL' => 'test@example.invalid',
            'GIT_COMMITTER_NAME' => 'test',
            'GIT_COMMITTER_EMAIL' => 'test@example.invalid',
            'GIT_CONFIG_GLOBAL' => '/dev/null',
        ]);
        $process->mustRun();
        return trim($process->getOutput());
    }
}
