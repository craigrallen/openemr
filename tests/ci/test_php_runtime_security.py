"""TECH-83 offline source contract; no registry, application, or dependency reads.

Run: python3 -m unittest discover -s tests/ci -p test_php_runtime_security.py -v
"""
from pathlib import Path
import re
import shutil
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[2]
FLOORS = {'8.2': 35, '8.3': 36, '8.4': 27, '8.5': 12}
DIGESTS = {
    '8.2': 'a58479410c94b3f0f7dfacc27fba8befc122290743fd0eb8c88a99ff2a0b1ba1',
    '8.3': 'd0dea3f5d95314eac94a732469f4cf0ee658a22c2ce3f2612272b9d5b42d1a72',
    '8.4': 'e2d8e787dc775bdbd9d7e0c5e8f2f9ddb41ce5977c8bbaf99a2ba2e7d90fd8ae',
    '8.5': 'f665ad19c093eee54db3a03c89102d6828b1bbf4f327689e5947a8686c6585a1',
}
RAILWAY = 'docker/railway/Dockerfile'
PINS = {RAILWAY: 'openemr/openemr:latest@sha256:def5407b07d56acf74e733a8dad5f2c086b06f98454c606ef07c9f785fb8da9b'}
PINS.update({f'docker/library/dockers/dev-php-fpm-{b.replace(".", "-")}/Dockerfile':
             f'php:{b}.{FLOORS[b]}-fpm@sha256:{d}' for b, d in DIGESTS.items()})
PACKAGES = [f'docker/{kind}/Dockerfile' for kind in ('release', 'flex', 'binary')]
EXPERIMENTAL = [f'docker/library/dockers/{name}/Dockerfile' for name in
                ('dev-php-fpm-8-6', 'dev-php-fpm-8-7', 'dev-php-fpm')]
# The same pure PHP expression is shipped inline so each existing build context works.
ENGINE = ('$v=PHP_VERSION; $b=$argv[1]; $f=["8.2"=>35,"8.3"=>36,"8.4"=>27,"8.5"=>12]; '
          'if (!preg_match("/\\A(8\\.[2345])\\.([0-9]+)\\z/D",$v,$m) || '
          '$m[1]!==$b || !isset($f[$b]) || (int)$m[2]<$f[$b]) '
          '{fwrite(STDERR,"TECH-83: rejected PHP ".$v." for ".$b."\\n"); exit(1);}')
FPM_ENGINE = ('$banner=$argv[2]; if (!preg_match("/\\APHP ([^ ]+) \\(fpm-fcgi\\)/",$banner,$match)) '
              '{exit(1);} $v=$match[1];' + ENGINE[len('$v=PHP_VERSION;'):])


def guard(binary, branch, code=ENGINE, extra=''):
    return f"RUN {binary} -n -r '{code}' -- {branch}{extra}"


def instructions(source):
    return [line for line in source.splitlines() if line and not line.startswith('#')]


def check_source(path, source):
    lines = instructions(source)
    if path in PINS:
        expected = 'FROM ' + PINS[path] + (' AS runtime' if path == RAILWAY else '')
        assert lines[0] == expected, f'{path}: exact verified runtime pin required'
        branch = '8.5' if path == RAILWAY else re.search(r'php:(8\.[2345])', PINS[path])[1]
        assert lines[1] == guard('php', branch), f'{path}: immediate floor required'
    else:
        marker = ('    && ln -sf /usr/local/bin/php /usr/local/bin/php-cli' if '/binary/' in path
                  else '    php${PHP_VERSION_ABBR}-zlib')
        index = lines.index(marker)
        binary = 'php' if '/binary/' in path else '/usr/bin/php${PHP_VERSION_ABBR}'
        assert lines[index + 1] == guard(binary, '"${PHP_VERSION}"'), f'{path}: postinstall floor required'
        if '/binary/' in path:
            assert lines[index + 2] == guard('php', '"${PHP_VERSION}"', FPM_ENGINE,
                                           ' "$(php-fpm -n -v)"'), 'independent FPM floor required'


PHP_ASSET_HASHES = {
    'amd64': ('a1285f604dfdde3dbbb789bcb992b68408d5c48bde3d77e866396c4e506f9f13',
              '8117575be791f5adb5c0674044dbf353de905c9cf9e57d6117c067b355459805'),
    'arm64': ('467e11b0d2a9b4345c99a3e213edcd9194b565e83faebd30f965c41815ef31f0',
              'd554149b5a82ec50979f6062b38be41e9149e3d90ed6c5beefba5d9065566487'),
}


class BinaryAssetTest(unittest.TestCase):
    def source(self):
        return (ROOT / 'docker/binary/Dockerfile').read_text()

    def test_separate_php_release(self):
        source = self.source()
        self.assertIn('ARG PHP_BINARY_RELEASE_DATE=10212026', source)
        self.assertIn('ARG BINARY_RELEASE_DATE=10032026', source)
        self.assertIn('ARG OPENEMR_VERSION=8_4_1', source)
        urls = re.findall(r'https://[^" ]+/releases/download/[^" ]+', source)
        self.assertEqual(len(urls), 3)
        for url in urls:
            date = '${BINARY_RELEASE_DATE}' if url.endswith('/openemr.phar') else '${PHP_BINARY_RELEASE_DATE}'
            self.assertIn('-' + date + '/', url)

    def test_fail_closed_hash_selection(self):
        source = self.source()
        self.assertIn('RUN case ', source)
        selector = source.split('RUN case ', 1)[1].split('    && cd /tmp', 1)[0]
        selector = 'case ' + selector.replace('\\\n', '').rstrip()
        for arch, branch, version, date in [
                ('amd64', '8.5', '8_4_1', '10212026'),
                ('arm64', '8.5', '8_4_1', '10212026'),
                ('386', '8.5', '8_4_1', '10212026'),
                ('', '8.5', '8_4_1', '10212026'),
                ('amd64', '8.4', '8_4_1', '10212026'),
                ('amd64', '8.6', '8_4_1', '10212026'),
                ('amd64', '8.5', '8_3_0', '10212026'),
                ('amd64', '8.5', '8_4_1', '10032026')]:
            with self.subTest(arch=arch, branch=branch, version=version, date=date):
                result = subprocess.run(['/bin/sh', '-c', selector +
                    '; printf "%s %s" "$PHP_CLI_SHA256" "$PHP_FPM_SHA256"'],
                    env={'TARGETARCH': arch, 'PHP_VERSION': branch,
                         'PHP_VERSION_ABBR': branch.replace('.', ''),
                         'OPENEMR_VERSION': version, 'PHP_BINARY_RELEASE_DATE': date},
                    capture_output=True, text=True)
                accepted = arch in PHP_ASSET_HASHES and (branch, version, date) == ('8.5', '8_4_1', '10212026')
                self.assertEqual(result.returncode == 0, accepted, result.stderr)
                if accepted:
                    self.assertEqual(result.stdout, ' '.join(PHP_ASSET_HASHES[arch]))

    def test_checksums_before_permissions_or_execution(self):
        source = self.source()
        block = source.split('RUN ', 1)[1] if 'RUN case ' not in source else source.split('RUN case ', 1)[1].split('\n\n', 1)[0]
        self.assertIn('sha256sum -c -', block)
        self.assertIn('"${PHP_CLI_SHA256}  php-cli"', block)
        self.assertIn('"${PHP_FPM_SHA256}  php-fpm"', block)
        self.assertLess(block.index('-o php-cli'), block.index('sha256sum -c -'))
        self.assertLess(block.index('-o php-fpm'), block.index('sha256sum -c -'))
        self.assertLess(block.index('sha256sum -c -'), block.index('chmod +x'))
        self.assertNotIn('||', block, 'download/checksum failure must not recover')
        self.assertIn('&& chmod +x php-fpm php-cli', block)


    def test_download_and_checksum_failures_stop_install(self):
        # Run the shipped shell chain with inert command doubles: no downloads,
        # filesystem writes, permission changes, or PHP/application execution.
        source = self.source()
        self.assertIn('RUN case ', source)
        block = 'case ' + source.split('RUN case ', 1)[1].split('\n\n', 1)[0]
        block = block.replace('\\\n', '')
        stubs = """
cd() { :; }
curl() { echo download; return "$DOWNLOAD_STATUS"; }
sha256sum() { cat >/dev/null; echo checksum; return "$CHECKSUM_STATUS"; }
chmod() { echo chmod; }
mv() { echo mv; }
ln() { echo ln; }
"""
        for download, checksum in [('0', '0'), ('1', '0'), ('0', '1')]:
            with self.subTest(download=download, checksum=checksum):
                result = subprocess.run(['/bin/sh', '-c', stubs + block],
                    env={'PATH': '/usr/bin:/bin', 'TARGETARCH': 'amd64',
                         'PHP_VERSION': '8.5', 'PHP_VERSION_ABBR': '85',
                         'OPENEMR_VERSION': '8_4_1', 'PHP_BINARY_RELEASE_DATE': '10212026',
                         'DOWNLOAD_STATUS': download, 'CHECKSUM_STATUS': checksum},
                    capture_output=True, text=True)
                accepted = download == checksum == '0'
                self.assertEqual(result.returncode == 0, accepted, result.stderr)
                self.assertEqual('chmod' in result.stdout, accepted)
                self.assertEqual('mv' in result.stdout, accepted)
                self.assertEqual('ln' in result.stdout, accepted)
                if download != '0':
                    self.assertNotIn('checksum', result.stdout)


class RuntimeSourceTest(unittest.TestCase):
    def test_supported_sources(self):
        for path in [*PINS, *PACKAGES]:
            with self.subTest(path=path):
                check_source(path, (ROOT / path).read_text())

    def test_pin_mutations_rejected(self):
        for path, pin in PINS.items():
            good = (ROOT / path).read_text()
            for bad in ('', pin.split('@')[0], pin.replace('sha256:', 'sha256:0'),
                        pin.replace('-fpm', '-cli') if '-fpm' in pin else 'php:8.5-fpm',
                        pin.replace('8.', '7.'), pin.replace('-fpm', 'RC1-fpm')):
                if bad == pin:
                    continue
                with self.subTest(path=path, bad=bad), self.assertRaises(AssertionError):
                    check_source(path, good.replace(pin, bad))

    def test_missing_or_late_floor_rejected(self):
        for path in [*PINS, *PACKAGES]:
            good = (ROOT / path).read_text()
            guards = [line for line in good.splitlines() if line.startswith('RUN ') and 'TECH-83:' in line]
            self.assertTrue(guards, path)
            for line in guards:
                for bad in (good.replace(line, ''), good.replace(line, '') + '\n' + line + '\n'):
                    with self.subTest(path=path), self.assertRaises(AssertionError):
                        check_source(path, bad)

    def test_experimental_disposition(self):
        for path in EXPERIMENTAL:
            with self.subTest(path=path):
                self.assertTrue('TECH-83: EXPERIMENTAL / NONPRODUCTION BLOCKER' in (ROOT / path).read_text(), path)
        self.assertIn('FROM php:8.6-rc-fpm', (ROOT / EXPERIMENTAL[0]).read_text())
        self.assertIn('FROM openemr/dev-php-fpm:pre-build-dev-87', (ROOT / EXPERIMENTAL[1]).read_text())
        self.assertIn('git clone https://github.com/php/php-src php;', (ROOT / EXPERIMENTAL[2]).read_text())


@unittest.skipUnless(shutil.which('php'), 'native PHP CLI unavailable; source checks still run')
class NativeGuardTest(unittest.TestCase):
    def shipped(self):
        source = (ROOT / RAILWAY).read_text()
        self.assertTrue(guard('php', '8.5') in source, 'missing shipped Railway guard')
        return re.search(r"^RUN php -n -r '([^']+)' -- 8\.5$", source, re.M)[1]

    def run_guard(self, code, branch, extra=None):
        return subprocess.run([shutil.which('php'), '-n', '-r', code, '--', branch]
                              + ([] if extra is None else [extra]), capture_output=True, text=True)

    def test_native_engine(self):
        version = subprocess.check_output([shutil.which('php'), '-n', '-r', 'echo PHP_VERSION;'], text=True)
        branch = '.'.join(version.split('.')[:2])
        match = re.fullmatch(r'(8\.[2345])\.([0-9]+)', version)
        expected = bool(match and int(match[2]) >= FLOORS[match[1]])
        result = self.run_guard(self.shipped(), branch)
        self.assertEqual(result.returncode == 0, expected, (version, result.stderr))

    def test_synthetic_versions_using_shipped_code(self):
        code = self.shipped()
        cases = []
        for branch, floor in FLOORS.items():
            cases += [(branch, f'{branch}.{floor - 1}', False), (branch, f'{branch}.{floor}', True),
                      (branch, f'{branch}.{floor + 1}', True), (branch, f'{branch}.{floor}RC1', False),
                      (branch, f'{branch}.{floor}-dev', False), (branch, '8.6.99', False),
                      (branch, '8.5.99' if branch != '8.5' else '8.4.99', False)]
        cases += [('8.6', '8.6.0RC1', False), ('8.7', '8.7.0-dev', False),
                  ('8.1', '8.1.99', False), ('9.0', '9.0.0', False), ('8.5', '8.5.12\n', False)]
        for branch, version, accepted in cases:
            with self.subTest(branch=branch, version=version):
                synthetic = code.replace('PHP_VERSION', '"' + version.replace('\n', '\\n') + '"', 1)
                self.assertEqual(self.run_guard(synthetic, branch).returncode == 0, accepted)

    def test_independent_fpm_engine(self):
        source = (ROOT / 'docker/binary/Dockerfile').read_text()
        self.assertTrue(guard('php', '"${PHP_VERSION}"', FPM_ENGINE, ' "$(php-fpm -n -v)"') in source, 'missing shipped FPM guard')
        code = re.findall(r"^RUN php -n -r '([^']+)'", source, re.M)[1]
        for version, accepted in [('8.5.12', True), ('8.5.11', False), ('8.5.12RC1', False),
                                  ('8.6.0', False), ('8.4.27', False)]:
            with self.subTest(version=version):
                result = self.run_guard(code, '8.5', f'PHP {version} (fpm-fcgi) (built: synthetic)\nCopyright')
                self.assertEqual(result.returncode == 0, accepted)
        self.assertNotEqual(self.run_guard(code, '8.5', 'PHP 8.5.12 (cli)').returncode, 0)


if __name__ == '__main__':
    unittest.main()
