<?php

/**
 * Isolated test: the production Docker test routes the Railway test-server
 * image to its own verification lane instead of the generic compose pipeline.
 *
 * `.github/workflows/docker-test-core.yml` discovers every docker/<dir>/Dockerfile
 * and runs each through `.github/actions/test-actions-core`, which builds with
 * `docker/<dir>` as the context and installs with upstream default credentials
 * through the public InstallerAuto path. docker/railway/Dockerfile builds this
 * checkout from the repository root and refuses default credentials, a missing
 * sites volume and manual setup by design, so that pipeline can never test it.
 * These tests pin the routing: Railway leaves the generic matrix, every other
 * Dockerfile stays in it, and a dedicated job runs the real-image acceptance
 * harness (docker/railway/acceptance-test.sh) built from the exact checkout.
 *
 * The discovery step's shell is executed against disposable directory trees,
 * so no Docker or network is needed.
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

class DockerTestCoreRailwayLaneIsolatedTest extends TestCase
{
    private const REPO_ROOT = __DIR__ . '/../../../..';
    private const WORKFLOW_FILE = self::REPO_ROOT . '/.github/workflows/docker-test-core.yml';
    private const RELEASE_WORKFLOW_FILE = self::REPO_ROOT . '/.github/workflows/docker-test-release.yml';
    private const ACCEPTANCE_SCRIPT = self::REPO_ROOT . '/docker/railway/acceptance-test.sh';
    private const DISCOVERY_STEP_ID = 'docker-dirs';
    private const RAILWAY_JOB_ID = 'railway-test';
    private const RAILWAY_JOB_NAME = 'Production Docker (railway)';

    private string $tmpDir = '';

    protected function tearDown(): void
    {
        if ($this->tmpDir !== '') {
            (new Process(['rm', '-rf', $this->tmpDir]))->run();
        }
    }

    public function testDiscoveryLeavesRailwayOutOfTheGenericMatrixOfThisCheckout(): void
    {
        self::assertSame(['binary', 'flex', 'release'], $this->discover(self::REPO_ROOT));
    }

    public function testProductionCallerRunsForRailwayOnlyChangesOnPushAndPullRequest(): void
    {
        $workflow = Yaml::parseFile(self::RELEASE_WORKFLOW_FILE);
        self::assertIsArray($workflow);
        // Symfony YAML preserves the Actions `on` key as a string.
        $triggers = $workflow['on'] ?? null;
        self::assertIsArray($triggers);
        foreach (['push', 'pull_request'] as $event) {
            $trigger = $triggers[$event] ?? null;
            self::assertIsArray($trigger, "{$event} must trigger the production caller");
            $paths = $trigger['paths'] ?? null;
            self::assertIsArray($paths, "{$event} must have path filters");
            self::assertContains('docker/railway/**', $paths, "Railway-only {$event} changes must run the production caller");
        }
    }

    public function testDiscoveryStillIncludesEveryOtherDockerfileAndSkipsSymlinks(): void
    {
        $root = $this->makeTree(['binary', 'flex', 'railway', 'release', 'newvariant']);
        symlink($root . '/docker/flex', $root . '/docker/flex-alias');

        self::assertSame(['binary', 'flex', 'newvariant', 'release'], $this->discover($root));
    }

    public function testDiscoveryFailsWhenOnlyDedicatedLanesRemain(): void
    {
        $root = $this->makeTree(['railway']);

        [$code, $output] = $this->runDiscovery($root);

        self::assertNotSame(0, $code, $output);
    }

    public function testEveryDedicatedLaneHasItsOwnRequiredJob(): void
    {
        $lanes = $this->dedicatedLanes();
        self::assertSame(['railway'], $lanes, 'only the Railway image may leave the generic matrix');

        $jobs = $this->jobs();
        foreach ($lanes as $lane) {
            $this->assertFileExists(self::REPO_ROOT . '/docker/' . $lane . '/acceptance-test.sh');
            $matching = array_filter(
                $jobs,
                static fn(array $job): bool => str_contains(self::runScripts($job), 'docker/' . $lane . '/acceptance-test.sh')
            );
            self::assertNotSame([], $matching, "dedicated lane '{$lane}' has no job running its acceptance test");
        }
    }

    public function testRailwayJobRunsTheRealImageAcceptanceFromTheExactCheckout(): void
    {
        $job = $this->railwayJob();

        self::assertSame(self::RAILWAY_JOB_NAME, $job['name'] ?? null, 'keeps the existing check name');
        self::assertSame('${{ inputs.is_production_docker }}', $job['if'] ?? null);
        self::assertSame(['collect-production-targets'], $job['needs'] ?? null);
        self::assertArrayNotHasKey('continue-on-error', $job);
        self::assertArrayNotHasKey('strategy', $job);

        $steps = $this->stepsOf($job);
        foreach ($steps as $step) {
            self::assertArrayNotHasKey('continue-on-error', $step);
            self::assertStringNotContainsString('test-actions-core', self::optionalString($step, 'uses'), 'no generic installer pipeline');
        }

        $checkout = $steps[0];
        self::assertStringStartsWith('actions/checkout@', self::optionalString($checkout, 'uses'));
        $with = $checkout['with'] ?? [];
        self::assertIsArray($with);
        self::assertArrayNotHasKey('repository', $with, 'must test this repository, not upstream');
        self::assertArrayNotHasKey('ref', $with, 'must test the triggering commit');
        self::assertFalse($with['persist-credentials'] ?? null);

        $acceptance = $this->stepRunning($steps, 'docker/railway/acceptance-test.sh');
        self::assertArrayNotHasKey('working-directory', $acceptance, 'build context is the repository root');
        $run = self::requiredString($acceptance, 'run');
        self::assertDoesNotMatchRegularExpression('/acceptance-test\.sh\s+--/', $run, 'always builds the image');
        $env = self::stringKeyedArray($acceptance['env'] ?? null, 'acceptance environment');
        self::assertSame('${{ github.sha }}', self::requiredString($env, 'EXPECTED_SHA'));
        self::assertStringContainsString('git rev-parse HEAD', $run);
        self::assertStringContainsString('"${EXPECTED_SHA}"', $run);
    }

    public function testAcceptanceHarnessRefusesDefaultAndMissingCredentialsInTheRealImage(): void
    {
        $script = $this->read(self::ACCEPTANCE_SCRIPT);

        foreach (
            [
                'MYSQL_ROOT_PASS is not set',
                'OE_PASS is the upstream default',
                'MYSQL_ROOT_PASS is the upstream default',
                'MYSQL_PASS is the upstream default',
                'OE_USER must be set to a non-default name',
                'MANUAL_SETUP=yes would expose the web installer',
                'OE_PASS is shorter than 16 characters',
            ] as $reason
        ) {
            self::assertStringContainsString("'{$reason}'", $script, "real-image refusal not exercised: {$reason}");
        }
        self::assertStringContainsString('refusal_exit', $script, 'refusals must check the container exit status');
    }

    public function testAcceptanceHarnessPinsAndReadsBackTheSourceRevision(): void
    {
        $script = $this->read(self::ACCEPTANCE_SCRIPT);

        self::assertStringContainsString('--build-arg "RAILWAY_GIT_COMMIT_SHA=${source_rev}"', $script);
        self::assertStringContainsString('/root/source-commit', $script);
        self::assertStringContainsString('org.opencontainers.image.revision', $script);
    }

    public function testAcceptanceHarnessMasksGeneratedSecretsOnGitHubActions(): void
    {
        $script = $this->read(self::ACCEPTANCE_SCRIPT);

        self::assertMatchesRegularExpression('/GITHUB_ACTIONS.*\n(?:.*\n){0,3}.*::add-mask::/', $script);
    }

    /**
     * @return list<string>
     */
    private function discover(string $root): array
    {
        [$code, $output, $githubOutput] = $this->runDiscovery($root);
        self::assertSame(0, $code, $output);
        self::assertSame(1, preg_match('/^docker_dirs=(.*)$/m', $githubOutput, $match));
        $dirs = json_decode($match[1], true, 512, JSON_THROW_ON_ERROR);
        self::assertIsArray($dirs);
        $names = array_values(array_filter($dirs, is_string(...)));
        sort($names);
        return $names;
    }

    /**
     * @return array{int, string, string}
     */
    private function runDiscovery(string $root): array
    {
        $step = $this->discoveryStep();
        $outFile = $this->tmp() . '/github_output';
        touch($outFile);
        $env = ['GITHUB_OUTPUT' => $outFile, 'PATH' => getenv('PATH') ?: '/usr/bin:/bin'];
        foreach (self::stringKeyedArray($step['env'] ?? null, 'discovery environment') as $name => $value) {
            self::assertIsString($value, "discovery environment {$name} must be a string");
            $env[$name] = $value;
        }
        $process = new Process(['bash', '--noprofile', '--norc', '-e', '-o', 'pipefail', '-c', self::requiredString($step, 'run')], $root, $env);
        $process->run();
        return [$process->getExitCode() ?? -1, $process->getOutput() . $process->getErrorOutput(), (string) file_get_contents($outFile)];
    }

    /**
     * @return list<string>
     */
    private function dedicatedLanes(): array
    {
        $step = $this->discoveryStep();
        $env = self::stringKeyedArray($step['env'] ?? null, 'discovery environment');
        $lanes = $env['DEDICATED_LANES'] ?? null;
        self::assertIsString($lanes, 'discovery step must declare DEDICATED_LANES');
        return array_values(array_filter(explode(' ', $lanes), static fn(string $lane): bool => $lane !== ''));
    }

    /**
     * @return array<string, mixed>
     */
    private function discoveryStep(): array
    {
        $job = $this->jobs()['collect-production-targets'] ?? null;
        self::assertIsArray($job);
        foreach ($this->stepsOf($job) as $step) {
            if (($step['id'] ?? null) === self::DISCOVERY_STEP_ID) {
                self::assertIsString($step['run'] ?? null);
                return $step;
            }
        }
        self::fail('discovery step not found');
    }

    /**
     * @return array<string, mixed>
     */
    private function railwayJob(): array
    {
        $job = $this->jobs()[self::RAILWAY_JOB_ID] ?? null;
        self::assertIsArray($job, 'docker-test-core.yml must define the ' . self::RAILWAY_JOB_ID . ' job');
        return $job;
    }

    /**
     * @return array<string, array<string, mixed>>
     */
    private function jobs(): array
    {
        $workflow = Yaml::parseFile(self::WORKFLOW_FILE);
        self::assertIsArray($workflow);
        $jobs = $workflow['jobs'] ?? null;
        self::assertIsArray($jobs);
        $validated = [];
        foreach ($jobs as $name => $job) {
            self::assertIsString($name, 'job IDs must be strings');
            $validated[$name] = self::stringKeyedArray($job, "job {$name}");
        }
        return $validated;
    }

    /**
     * @param array<string, mixed> $job
     * @return list<array<string, mixed>>
     */
    private static function stepsOf(array $job): array
    {
        $steps = $job['steps'] ?? null;
        self::assertIsArray($steps);
        $validated = [];
        foreach ($steps as $step) {
            $validated[] = self::stringKeyedArray($step, 'job step');
        }
        return $validated;
    }

    /**
     * @param list<array<string, mixed>> $steps
     * @return array<string, mixed>
     */
    private function stepRunning(array $steps, string $needle): array
    {
        foreach ($steps as $step) {
            if (str_contains(self::optionalString($step, 'run'), $needle)) {
                return $step;
            }
        }
        self::fail("no step runs {$needle}");
    }

    /**
     * @param array<string, mixed> $job
     */
    private static function runScripts(array $job): string
    {
        $runs = [];
        foreach (self::stepsOf($job) as $step) {
            $runs[] = self::optionalString($step, 'run');
        }
        return implode("\n", $runs);
    }

    /**
     * @return array<string, mixed>
     */
    private static function stringKeyedArray(mixed $value, string $description): array
    {
        if (!is_array($value)) {
            self::fail("{$description} must be a mapping");
        }
        $mapping = [];
        foreach ($value as $key => $item) {
            if (!is_string($key)) {
                self::fail("{$description} must have string keys");
            }
            $mapping[$key] = $item;
        }
        return $mapping;
    }

    /**
     * @param array<string, mixed> $mapping
     */
    private static function requiredString(array $mapping, string $key): string
    {
        $value = $mapping[$key] ?? null;
        if (!is_string($value)) {
            self::fail("{$key} must be a string");
        }
        return $value;
    }

    /**
     * @param array<string, mixed> $mapping
     */
    private static function optionalString(array $mapping, string $key): string
    {
        if (!array_key_exists($key, $mapping)) {
            return '';
        }
        return self::requiredString($mapping, $key);
    }

    /**
     * @param list<string> $dirs
     */
    private function makeTree(array $dirs): string
    {
        $root = $this->tmp() . '/repo';
        foreach ($dirs as $dir) {
            mkdir($root . '/docker/' . $dir, 0777, true);
            touch($root . '/docker/' . $dir . '/Dockerfile');
        }
        return $root;
    }

    private function tmp(): string
    {
        if ($this->tmpDir === '') {
            $dir = sys_get_temp_dir() . '/oe-docker-core-' . bin2hex(random_bytes(6));
            mkdir($dir, 0700, true);
            $this->tmpDir = $dir;
        }
        return $this->tmpDir;
    }

    private function read(string $path): string
    {
        $contents = file_get_contents($path);
        self::assertIsString($contents);
        return $contents;
    }
}
