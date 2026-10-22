#!/usr/bin/env python3
"""Offline pin rejection and real-baseline byte-preservation tests."""
import hashlib
import unittest

from check_php_admin_images import SCOPE, check, read_sources


def approved_sources():
    sources = read_sources()
    for path, spec in SCOPE.items():
        lines = sources[path].splitlines(keepends=True)
        for number, old, new in spec["images"]:
            lines[number] = new.encode()
        sources[path] = b"".join(lines)
    return sources


class AdminImageTests(unittest.TestCase):
    def test_worktree_is_pinned(self):
        self.assertEqual(check(read_sources()), [])

    def test_positive_declared_pins(self):
        self.assertEqual(check(approved_sources()), [])

    def test_missing_file(self):
        for path in SCOPE:
            with self.subTest(path=path):
                sources = approved_sources()
                del sources[path]
                self.assertTrue(check(sources))

    def test_reject_each_bad_declaration(self):
        for path, spec in SCOPE.items():
            for number, old, new in spec["images"]:
                ref = new.split()[-1]
                mutations = {
                    "missing": b"\n",
                    "old": old.encode(),
                    "unpinned": new.replace(ref, ref.split("@")[0]).encode(),
                    "wrong_family": new.replace(ref, "wrong/vendor:latest@" + ref.split("@")[1]).encode(),
                    "wrong_digest": new.replace(ref, ref.split("@")[0] + "@sha256:" + "0" * 64).encode(),
                }
                for kind, replacement in mutations.items():
                    with self.subTest(path=path, line=number + 1, kind=kind):
                        sources = approved_sources()
                        lines = sources[path].splitlines(keepends=True)
                        lines[number] = replacement
                        sources[path] = b"".join(lines)
                        self.assertTrue(check(sources))

    def test_duplicate_declaration(self):
        for path, spec in SCOPE.items():
            with self.subTest(path=path):
                sources = approved_sources()
                sources[path] += b"\n" + spec["images"][0][2].encode()
                self.assertTrue(check(sources))

    def test_inverse_matches_real_baseline_bytes(self):
        for path, spec in SCOPE.items():
            with self.subTest(path=path):
                lines = read_sources()[path].splitlines(keepends=True)
                for number, old, new in spec["images"]:
                    self.assertEqual(lines[number], new.encode())
                    lines[number] = old.encode()
                restored = b"".join(lines)
                self.assertEqual(hashlib.sha256(restored).hexdigest(), spec["sha256"])
                baseline_sources = approved_sources()
                baseline_sources[path] = restored
                self.assertTrue(check(baseline_sources))


if __name__ == "__main__":
    unittest.main(verbosity=2)
