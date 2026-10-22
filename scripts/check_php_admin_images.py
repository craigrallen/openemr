#!/usr/bin/env python3
"""TECH-84: exact scoped admin image declarations; Python 3.9+, stdlib only."""
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
# Captured from the clean, real pre-change baseline; no configuration is loaded.
BASELINE_COMMIT = '18647270e0c799189d2dc10f801e8de2bff1a360'
SCOPE = {'docker/development-easy-light/docker-compose.yml': {'sha256': 'a3bf6bf345a5d84d551aba4db44e51eb55b401fca73dcac719b5e420aaea6824',
                                                      'images': [(108,
                                                                  '    image: '
                                                                  'phpmyadmin:5.2.3@sha256:7ebeef41095cbe071a00e3c85c8b44309f110eee546c7b3a6d1fcfe259d58e59\n',
                                                                  '    image: '
                                                                  'phpmyadmin:latest@sha256:62a50b1419fe55b9b4c3cd6f5aed03a18f8f5b4a236f24735d76400bea75a5ff\n')]},
 'docker/development-easy-redis/docker-compose.yml': {'sha256': '62ef81a01ad0316e80228c8d5cc6d2e2542eac2e1cf69c8ad68c3d9173dc8590',
                                                      'images': [(260,
                                                                  '    image: '
                                                                  'phpmyadmin:5.2.3@sha256:7ebeef41095cbe071a00e3c85c8b44309f110eee546c7b3a6d1fcfe259d58e59\n',
                                                                  '    image: '
                                                                  'phpmyadmin:latest@sha256:62a50b1419fe55b9b4c3cd6f5aed03a18f8f5b4a236f24735d76400bea75a5ff\n')]},
 'docker/development-easy/docker-compose.yml': {'sha256': 'bf0aa53e157c8a4718a9a324d36cfcd7679aa76b227080588663b19ef16c3b70',
                                                'images': [(149,
                                                            '    image: '
                                                            'phpmyadmin:5.2.3@sha256:7ebeef41095cbe071a00e3c85c8b44309f110eee546c7b3a6d1fcfe259d58e59\n',
                                                            '    image: '
                                                            'phpmyadmin:latest@sha256:62a50b1419fe55b9b4c3cd6f5aed03a18f8f5b4a236f24735d76400bea75a5ff\n')]},
 'docker/development-insane/docker-compose.yml': {'sha256': '2a62f6b59ce78b3d4d6400822a8f2407272b78afd35fa2bb123596bf1b36a568',
                                                  'images': [(571,
                                                              '    image: '
                                                              'phpmyadmin:5.2.3@sha256:7ebeef41095cbe071a00e3c85c8b44309f110eee546c7b3a6d1fcfe259d58e59\n',
                                                              '    image: '
                                                              'phpmyadmin:latest@sha256:62a50b1419fe55b9b4c3cd6f5aed03a18f8f5b4a236f24735d76400bea75a5ff\n')]}}

DECLARATION = re.compile(
    rb"^[ \t]*(?:#[ \t]*)?(?:image:[ \t]+|FROM[ \t]+)"
    rb"(?:adminer|linuxserver/phpmyadmin|phpmyadmin(?:/phpmyadmin)?)(?=[:@\s])"
)


def check(sources):
    errors = []
    for path, spec in SCOPE.items():
        if path not in sources:
            errors.append(path + ": missing file")
            continue
        lines = sources[path].splitlines(keepends=True)
        expected_slots = {entry[0] for entry in spec["images"]}
        for number, old, new in spec["images"]:
            if number >= len(lines) or lines[number] != new.encode():
                errors.append(f"{path}:{number + 1}: expected exact approved image declaration")
        for number, line in enumerate(lines):
            if DECLARATION.match(line) and number not in expected_slots:
                errors.append(f"{path}:{number + 1}: unexpected admin image declaration")
    return errors


def read_sources():
    return {path: (ROOT / path).read_bytes()
            for path in SCOPE if (ROOT / path).is_file()}


def main():
    errors = check(read_sources())
    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1
    print("PASS: all scoped admin image declarations match approved immutable pins")
    return 0


if __name__ == "__main__":
    sys.exit(main())
