# syntax=docker/dockerfile:1
# ============================================================================
# OpenEMR Railway test-server image (TEST USE ONLY - not for clinical use)
# ============================================================================
# Builds THIS checkout (the Railway build context is the repository root of
# the linked GitHub branch) and runs it on the upstream release runtime:
#   - runtime: the pinned upstream openemr/openemr image (Alpine, Apache,
#     PHP and extensions), with its bundled OpenEMR code removed;
#   - code: this repository, composer install --no-dev + npm run build,
#     exactly as docker/release/Dockerfile does for upstream;
#   - startup: docker/release/openemr.sh and auto_configure.php from this
#     checkout, wrapped by docker/railway/railway-start.sh.
# No credentials are baked in; they come from Railway service variables.
# ============================================================================

FROM openemr/openemr:latest@sha256:a8e4386f6d9a44f17add20c20e6dbc53c7092e855500ae62eac3cd5e47c45daa AS runtime

# ----------------------------------------------------------------------------
# PHP dependencies (uses the runtime's PHP and extensions)
# ----------------------------------------------------------------------------
FROM runtime AS composer
COPY . /openemr
WORKDIR /openemr
RUN rm -rf .git node_modules vendor
ENV COMPOSER_MAX_RETRIES=8
RUN composer install --no-dev --optimize-autoloader --no-interaction --no-progress \
    && composer dump-autoload --optimize --apcu

# ----------------------------------------------------------------------------
# Front-end assets (package.json requires node >= 24)
# ----------------------------------------------------------------------------
FROM node:24-alpine AS assets
RUN apk add --no-cache build-base git python3
COPY --from=composer /openemr /openemr
WORKDIR /openemr
RUN npm install \
    && npm run build \
    && cd ccdaservice \
    && npm install --allow-git=all \
    && cd .. \
    && rm -rf node_modules

# ----------------------------------------------------------------------------
# Permissions as in docker/release/Dockerfile
# ----------------------------------------------------------------------------
FROM assets AS tree
RUN find /openemr -type d -exec chmod 500 {} + \
    && find /openemr -type f -exec chmod 400 {} + \
    && chmod 666 /openemr/sites/default/sqlconf.php \
    && chmod 700 /openemr/sites/default \
    && find /openemr/sites/default/documents -type d -exec chmod 700 {} + \
    && find /openemr/sites/default/documents -type f -exec chmod 600 {} +

# ----------------------------------------------------------------------------
# Final image
# ----------------------------------------------------------------------------
FROM runtime AS final
ARG RAILWAY_GIT_COMMIT_SHA=unknown
ARG RAILWAY_GIT_BRANCH=unknown
ARG RAILWAY_GIT_REPO_OWNER=unknown
ARG RAILWAY_GIT_REPO_NAME=unknown

RUN rm -rf /var/www/localhost/htdocs/openemr /swarm-pieces/sites
COPY --from=tree --chown=apache:apache /openemr /var/www/localhost/htdocs/openemr
WORKDIR /var/www/localhost/htdocs/openemr

# Upstream release startup, from this checkout
COPY docker/release/php.ini /etc/php${PHP_VERSION_ABBR}/php.ini
COPY docker/release/openemr.conf /etc/apache2/conf.d/openemr.conf
COPY docker/release/openemr.sh docker/release/ssl.sh docker/release/xdebug.sh docker/release/auto_configure.php ./
COPY docker/release/utilities/unlock_admin.php docker/release/utilities/unlock_admin.sh docker/release/utilities/devtoolsLibrary.source /root/
COPY docker/release/upgrade/ /root/
RUN chmod 500 openemr.sh ssl.sh xdebug.sh /root/unlock_admin.sh /root/fsupgrade-*.sh \
    && chmod 000 auto_configure.php /root/unlock_admin.php

# Apache may only start through railway-serve.sh (safety read-back + web
# egress guard). Fail the build if upstream's final step ever changes shape.
RUN test "$(grep -c '^    exec /usr/sbin/httpd -D FOREGROUND$' openemr.sh)" = 1 \
    && sed -i 's|^    exec /usr/sbin/httpd -D FOREGROUND$|    exec /usr/local/bin/railway-serve.sh|' openemr.sh \
    && grep -q '^    exec /usr/local/bin/railway-serve.sh$' openemr.sh \
    && ! grep -q '/usr/sbin/httpd' openemr.sh

# Railway hardening
COPY docker/railway/php-railway.ini /etc/php${PHP_VERSION_ABBR}/conf.d/99-railway.ini
COPY docker/railway/openemr-railway.conf /etc/apache2/conf.d/zz-openemr-railway.conf
COPY docker/railway/php-railway-egress.ini /etc/php${PHP_VERSION_ABBR}/railway-web.d/99-railway-egress.ini
COPY docker/railway/railway-start.sh docker/railway/railway-serve.sh /usr/local/bin/
COPY docker/railway/railway-safety.php docker/railway/railway-verify.php /usr/local/lib/openemr-railway/
COPY --chown=apache:apache docker/railway/readyz.php meta/railway/readyz.php
RUN chmod 500 /usr/local/bin/railway-start.sh /usr/local/bin/railway-serve.sh \
    && chmod 644 /usr/local/lib/openemr-railway/railway-safety.php /usr/local/lib/openemr-railway/railway-verify.php \
    && chmod 400 meta/railway/readyz.php

# Empty-volume seed for sites/ and source provenance for read-back
RUN mkdir -p /swarm-pieces \
    && rsync --owner --group --perms --delete --recursive --links \
        /var/www/localhost/htdocs/openemr/sites /swarm-pieces/ \
    && printf '%s %s/%s@%s\n' "${RAILWAY_GIT_COMMIT_SHA}" "${RAILWAY_GIT_REPO_OWNER}" \
        "${RAILWAY_GIT_REPO_NAME}" "${RAILWAY_GIT_BRANCH}" > /root/source-commit

LABEL org.opencontainers.image.title="OpenEMR Railway test server"
LABEL org.opencontainers.image.source="https://github.com/craigrallen/openemr"
LABEL org.opencontainers.image.revision="${RAILWAY_GIT_COMMIT_SHA}"

EXPOSE 80
CMD [ "/usr/local/bin/railway-start.sh" ]
