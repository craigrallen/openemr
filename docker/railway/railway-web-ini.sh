#!/usr/bin/env bash
# ============================================================================
# Railway test server: build the web-only PHP scan directory (image build)
# ============================================================================
# Copies every conf.d ini except those loading SOAP or Redis, whose classes
# open outbound connections and cannot be disabled by name in PHP 8.5. The CLI
# (install/upgrade) keeps the full conf.d. railway-serve.sh and readyz.php
# still refuse if SoapClient or Redis is loaded by any other route.
#
# Usage: railway-web-ini.sh <conf.d> <web scan dir>
#
# @package   OpenEMR
# @link      https://www.open-emr.org
# @author    Craig Allen <craig@interconnected.au>
# @copyright Copyright (c) 2026 Craig Allen
# @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
# ============================================================================
set -euo pipefail

src="$1" dest="$2"
mkdir -p "${dest}"
for ini in "${src}"/*.ini; do
    if grep -qiE '^[[:space:]]*extension[[:space:]]*=[[:space:]]*"?(soap|redis)(\.so)?"?[[:space:]]*$' "${ini}"; then
        echo "web PHP: excluding ${ini##*/}"
        continue
    fi
    cp "${ini}" "${dest}/"
done
