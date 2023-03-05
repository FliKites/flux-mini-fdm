FROM node:16-buster-slim AS node

WORKDIR /app
COPY service.js /app
COPY utils /app/utils
COPY health_check.js /app
COPY package.json /app
COPY iplist.txt /app
RUN npm install

# start from debian 10 slim version
FROM debian:buster-slim

COPY --from=node /usr/lib /usr/lib
COPY --from=node /usr/local/share /usr/local/share
COPY --from=node /usr/local/lib /usr/local/lib
COPY --from=node /usr/local/include /usr/local/include
COPY --from=node /usr/local/bin /usr/local/bin
COPY --from=node /app /app

# install nginx-extras, certbot, supervisor and utilities
RUN apt-get update && apt-get install --no-install-recommends -yqq \
    gnupg \
    apt-transport-https \
    cron \
    wget \
    ca-certificates \
    curl \
    procps \
    && wget -qO - https://nginx.org/keys/nginx_signing.key | apt-key add - \
    && echo "deb https://nginx.org/packages/mainline/debian/ buster nginx" > /etc/apt/sources.list.d/nginx.list \
    && echo "deb-src https://nginx.org/packages/mainline/debian/ buster nginx" >> /etc/apt/sources.list.d/nginx.list \
    && apt-get update \
    && apt-get install --no-install-recommends -yqq nginx-extras libnginx-mod-http-lua \
    && apt-get install --no-install-recommends -yqq certbot \
    && apt-get install --no-install-recommends -yqq supervisor \
    && apt-get clean autoclean && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*
RUN apt-get update && apt-get install -y libreadline-dev libncurses5-dev libpcre3-dev libssl-dev perl make build-essential curl zlib1g-dev
# RUN apt-get update && apt-get install build-essential -y && apt-get install -y make && apt-get install -y libpcre3-dev && apt-get install -y libssl-dev
# RUN apt-get install -y zlib1g-dev
RUN wget https://openresty.org/download/openresty-1.21.4.1.tar.gz
RUN tar -xzvf openresty-1.21.4.1.tar.gz
RUN cd openresty-1.21.4.1 && ./configure && make && make install

# RUN ls /usr/local/openresty

# RUN /usr/local/openresty/luajit/bin/opm install pintsized/lua-resty-http
# RUN /usr/local/openresty/luajit/bin/opm install bungle/lua-resty-session
# RUN /usr/local/openresty/luajit/bin/opm install zmartzone/lua-resty-openidc

# copy nginx configuration files
COPY conf/nginx.conf /etc/nginx/nginx.conf
COPY haproxy-acme-validation-plugin/acme-http01-nginx-webroot.lua /etc/nginx
# COPY conf/default.conf /etc/nginx/conf.d/default.conf
# COPY conf/acme-challenge.conf /etc/nginx/conf.d/acme-challenge.conf
# COPY acme-challenge /var/www/html/.well-known/acme-challenge

# supervisord configuration
COPY conf/supervisord.conf /etc/supervisord.conf
# renewal script
COPY --chmod=777 scripts/cert-renewal-nginx.sh /
# renewal cron job
# COPY conf/crontab.txt /var/crontab.txt
# install cron job and remove useless ones
# RUN crontab /var/crontab.txt && chmod 600 /etc/crontab \
#     && rm -f /etc/cron.d/certbot \
#     && rm -f /etc/cron.hourly/* \
#     && rm -f /etc/cron.daily/* \
#     && rm -f /etc/cron.weekly/* \
#     && rm -f /etc/cron.monthly/*

# cert creation script & bootstrap
COPY --chmod=777 scripts/certs.sh /
COPY --chmod=777 scripts/bootstrap.sh /

RUN mkdir /jail

EXPOSE 80 443 8080

VOLUME /etc/letsencrypt

ENV STAGING=false

ENTRYPOINT ["/bootstrap.sh"]