"""Offline check for the full-version Codecov names retired by ci/codecov_flags.sh.

Run with: python3 -m unittest discover -s tests/ci -p 'test_codecov_retired_flags.py'
"""

import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[2]


class RetiredCodecovFlagsTest(unittest.TestCase):
    def test_old_upload_names_retire_and_current_names_carry_forward(self):
        config_path = Path(os.environ.get("CODECOV_CONFIG", ROOT / "codecov.yml"))
        config = json.loads(subprocess.check_output(
            ["yq", "-o=json", ".", str(config_path)], text=True,
        ))
        rules = config["flag_management"]
        self.assertTrue(rules["default_rules"]["carryforward"])
        individual = rules["individual_flags"]
        by_name = {flag["name"]: flag["carryforward"] for flag in individual}
        self.assertEqual(len(by_name), len(individual), "duplicate flag rule")

        # test.yml uploads these suites, with separate test-file reports for
        # api/e2e and the shortened redis-failover upload prefix.
        suites = ("api", "api-tests", "services", "email", "webui", "e2e", "e2e-tests")
        historical = json.loads((ROOT / "tests/ci/fixtures/retired-full-version-flags.json").read_text())
        old_names = set(historical["flags"])
        current_names = set()
        current_by_dir = {}
        config_count = 0
        for compose in sorted((ROOT / "ci").glob("*/docker-compose.yml")):
            docker_dir = compose.parent.name
            if docker_dir.startswith("compose-shared-"):
                continue
            config_count += 1
            image = re.search(r"(?ms)^  mysql:\n.*?^    image: ([^\s]+)", compose.read_text())
            self.assertIsNotNone(image, docker_dir)
            database, version = image.group(1).split("@")[0].split(":")
            webserver, php, *_ = docker_dir.split("_")
            php = f"{php[0]}.{php[1:]}"

            # f690154f test.yml's coverage-flag step used the complete DB tag.
            old = f"php{php}-{webserver}-{database}-{version}"
            current = f"php{php}-{webserver}-{database}-{'.'.join(version.split('.')[:2])}"
            for suffix, abbreviation in (
                ("_upgrade", "upg"),
                ("_redis_sentinel_mtls", "rsm"),
                ("_redis_sentinel_tls", "rst"),
                ("_redis_sentinel", "rs"),
            ):
                if docker_dir.endswith(suffix):
                    old += f"-{abbreviation}"
                    current += f"-{abbreviation}"
                    break
            prefixes = suites + (("redis",) if "redis_sentinel" in docker_dir else ())
            current_by_dir[docker_dir] = current
            for prefix in prefixes:
                current_names.add(f"{prefix}-{current}")

        self.assertGreater(config_count, 0)
        self.assertEqual(len(old_names), 137, "frozen pre-renaming retirement manifest")
        self.assertTrue(old_names.isdisjoint(current_names))
        bash = next(
            (candidate for candidate in (shutil.which("bash"), "/opt/homebrew/bin/bash")
             if candidate and Path(candidate).exists()
             and int(subprocess.check_output([candidate, "-c", "echo ${BASH_VERSINFO[0]}"], text=True)) >= 4),
            None,
        )
        self.assertIsNotNone(bash, "ci/parse_docker_dir.sh needs Bash 4 or newer")
        parsed = subprocess.run(
            [bash, str(ROOT / "ci/parse_docker_dir.sh"), *current_by_dir],
            cwd=ROOT, text=True, capture_output=True, check=True,
        )
        flags = subprocess.run(
            [bash, str(ROOT / "ci/codecov_flags.sh")],
            cwd=ROOT, text=True, input=parsed.stdout, capture_output=True, check=True,
        )
        self.assertEqual(
            dict(line.split(" ", 1) for line in flags.stdout.splitlines()),
            current_by_dir,
            "the current generator must produce the active major.minor names",
        )
        self.assertEqual([], sorted(name for name in old_names if by_name.get(name) is not False),
                         "retired full-version upload names must disable carryforward")
        self.assertEqual([], sorted(name for name in current_names if name in by_name),
                         "active upload names must inherit carryforward: true")


if __name__ == "__main__":
    unittest.main()
