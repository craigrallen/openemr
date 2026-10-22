# syntax=docker/dockerfile:1
#
# Copyright (C) 2018-2019 Brady Miller <brady.g.miller@gmail.com>
#
# This program is free software; you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation; either version 3 of the License, or
# (at your option) any later version.
#
# php-fpm Dockerfile build for openemr development docker environment
# This docker is hosted here: https://hub.docker.com/r/openemr/dev-php-fpm/ <tag is 7.2>
#
FROM php:8.2.35-fpm@sha256:a58479410c94b3f0f7dfacc27fba8befc122290743fd0eb8c88a99ff2a0b1ba1

# TECH-83: reject stale, prerelease, or unexpected engines before dependency work.
# PHP variables must reach the PHP interpreter literally, without shell expansion.
# hadolint ignore=SC2016
RUN php -n -r '$v=PHP_VERSION; $b=$argv[1]; $f=["8.2"=>35,"8.3"=>36,"8.4"=>27,"8.5"=>12]; if (!preg_match("/\A(8\.[2345])\.([0-9]+)\z/D",$v,$m) || $m[1]!==$b || !isset($f[$b]) || (int)$m[2]<$f[$b]) {fwrite(STDERR,"TECH-83: rejected PHP ".$v." for ".$b."\n"); exit(1);}' -- 8.2

# Add mariadb-client package that is needed in the OpenEMR Backup gui, which does direct command mysql commands
# Add imagemagick that is needed for some image processing in OpenEMR
# Note this basically add 160MB of space to the docker, so would be nice for OpenEMR to not require this stuff
#  and instead rely on php scripts, if possible.
RUN apt-get update \
 && apt-get install -y curl \
                       imagemagick \
                       mariadb-client

# Install correct version nodejs
RUN curl -sL https://deb.nodesource.com/setup_24.x \
  | bash - \
 && apt-get update \
 && apt-get install -y nodejs

# Add the php extensions (note using a very cool script by mlocati to do this)
ADD https://github.com/mlocati/docker-php-extension-installer/releases/latest/download/install-php-extensions /usr/local/bin/
RUN chmod uga+x /usr/local/bin/install-php-extensions \
 && sync \
 && install-php-extensions bcmath \
                           calendar \
                           dom \
                           gd \
                           gettext \
                           imagick \
                           intl \
                           ldap \
                           mysqli \
                           pcov \
                           pdo_mysql \
                           redis \
                           soap \
                           sockets \
                           tokenizer \
                           xmlreader \
                           xsl \
                           zip

# Needed to ensure permissions work across shared volumes with openemr, nginx, and php-fpm dockers
RUN usermod -u 1000 www-data

# Copy over the php.ini conf (default: plain; insane bind-mounts php-ini/redis/php.ini
# for the redis-flavored fpm sidecars to flip session storage to redis)
COPY php-ini/php.ini /usr/local/etc/php/php.ini

# Copy xdebug installation script for CI coverage support
# Script is placed at /usr/share/nginx/html/xdebug.sh so CI can call ../xdebug.sh
# from the OpenEMR directory at /usr/share/nginx/html/openemr
COPY xdebug.sh /usr/share/nginx/html/xdebug.sh
RUN chmod +x /usr/share/nginx/html/xdebug.sh
