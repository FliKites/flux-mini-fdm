#!/usr/bin/env bash

if [ -n "$DOMAIN" ]; then
    if [ "$STAGING" = true ]; then
        if [ -n "$ACME" ]; then
            certbot certonly --no-self-upgrade -n --text --standalone \
            --preferred-challenges http-01 \
            --staging \
            -d "$DOMAIN" --server "$ACME" --keep --expand --agree-tos --email "$EMAIL"
        else
            certbot certonly --no-self-upgrade -n --text --standalone \
            --preferred-challenges http-01 \
            --staging \
            -d "$DOMAIN" --keep --expand --agree-tos --email "$EMAIL"
        fi
    else
        if [ -n "$ACME" ]; then
            certbot certonly --no-self-upgrade -n --text --standalone \
            --preferred-challenges http-01 \
            -d "$DOMAIN" --server "$ACME" --keep --expand --agree-tos --email "$EMAIL"
        else
            certbot certonly --no-self-upgrade -n --text --standalone \
            --preferred-challenges http-01 \
            -d "$DOMAIN" --keep --expand --agree-tos --email "$EMAIL"
        fi
    fi

    mkdir -p /etc/haproxy/certs
    for site in `ls -1 /etc/letsencrypt/live | grep -v ^README$`; do
        cat /etc/letsencrypt/live/$site/privkey.pem \
          /etc/letsencrypt/live/$site/fullchain.pem \
          | tee /etc/haproxy/certs/haproxy-"$site".pem >/dev/null
    done
fi

exit 0