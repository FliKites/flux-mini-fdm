#!/usr/bin/env bash

if [ -n "$DOMAIN" ]; then
    if [ "$CERT" = "none" ]; then
        mkdir -p /etc/nginx/certs
    elif [ "$CERT" = self ] && [ -z "$(ls -A /etc/nginx/certs)" ]; then
     mkdir -p /etc/letsencrypt/live/"$DOMAIN"  && mkdir -p /etc/nginx/certs &&
    openssl req -x509 -newkey rsa:4096 -sha256 -days 365 -nodes \
  -keyout /etc/letsencrypt/live/"$DOMAIN"/nginx-"$DOMAIN".key -out /etc/letsencrypt/live/"$DOMAIN"/nginx-"$DOMAIN".crt -extensions ext  -config \
  <(echo "[req]";
    echo distinguished_name=req;
    echo "[ext]";
    echo "keyUsage=critical,digitalSignature,keyEncipherment";
    echo "extendedKeyUsage=serverAuth";
    echo "basicConstraints=critical,CA:FALSE";
    echo "subjectAltName=DNS:$DOMAIN";
    ) -subj "/CN=$DOMAIN" && cp /etc/letsencrypt/live/"$DOMAIN"/* /etc/nginx/certs/ 
    echo "Self-signed certificate generated and stored in /etc/nginx/certs/"
    echo "Generated below is the TLSA DNS record - Use With Handshake Domains or DNSSEC | Record Name: _443._tcp.$DOMAIN"
    TLSA=$(openssl x509 -noout -pubkey -in /etc/letsencrypt/live/"$DOMAIN"/nginx-"$DOMAIN".crt | openssl rsa -pubin -outform DER 2>/dev/null | sha256sum | sed '' | awk '{print "3 1 1",$1}')
    echo $TLSA > /etc/letsencrypt/"$DOMAIN"_TLSA.txt
    echo $TLSA

    elif [ "$STAGING" = true ]; then
        if [ -n "$ACME" ]; then
            certbot certonly --no-self-upgrade -n --text --standalone \
            --preferred-challenges http-01 \
            --staging \
            -d "$DOMAIN" --server "$ACME" --keep --expand --agree-tos --email "$EMAIL" &&  mkdir -p /etc/nginx/certs && cp /etc/letsencrypt/live/"$DOMAIN"/fullchain.pem /etc/nginx/certs/nginx-"$DOMAIN".crt
             cp /etc/letsencrypt/live/"$DOMAIN"/privkey.pem /etc/nginx/certs/nginx-"$DOMAIN".key
        else
            certbot certonly --no-self-upgrade -n --text --standalone \
            --preferred-challenges http-01 \
            --staging \
            -d "$DOMAIN" --keep --expand --agree-tos --email "$EMAIL" &&  mkdir -p /etc/nginx/certs && cp /etc/letsencrypt/live/"$DOMAIN"/fullchain.pem /etc/nginx/certs/nginx-"$DOMAIN".crt
             cp /etc/letsencrypt/live/"$DOMAIN"/privkey.pem /etc/nginx/certs/nginx-"$DOMAIN".key
        fi
    else
        if [ -n "$ACME" ]; then
            certbot certonly --no-self-upgrade -n --text --standalone \
            --preferred-challenges http-01 \
            -d "$DOMAIN" --server "$ACME" --keep --expand --agree-tos --email "$EMAIL" &&  mkdir -p /etc/nginx/certs && cp /etc/letsencrypt/live/"$DOMAIN"/fullchain.pem /etc/nginx/certs/nginx-"$DOMAIN".crt
             cp /etc/letsencrypt/live/"$DOMAIN"/privkey.pem /etc/nginx/certs/nginx-"$DOMAIN".key && echo "Generated below is the TLSA DNS record - Use With Handshake Domains or DNSSEC | Record Name: _443._tcp.$DOMAIN"
           TLSA=$(openssl x509 -noout -pubkey -in /etc/letsencrypt/live/"$DOMAIN"/nginx-"$DOMAIN".crt | openssl rsa -pubin -outform DER 2>/dev/null | sha256sum | sed '' | awk '{print "3 1 1",$1}')
           echo $TLSA > /etc/letsencrypt/"$DOMAIN"_TLSA.txt
           echo $TLSA
        else
            certbot certonly --no-self-upgrade -n --text --standalone \
            --preferred-challenges http-01 \
            -d "$DOMAIN" --keep --expand --agree-tos --email "$EMAIL" &&  mkdir -p /etc/nginx/certs && cp /etc/letsencrypt/live/"$DOMAIN"/fullchain.pem /etc/nginx/certs/nginx-"$DOMAIN".crt
             cp /etc/letsencrypt/live/"$DOMAIN"/privkey.pem /etc/nginx/certs/nginx-"$DOMAIN".key
        fi
    fi
fi
exit 0
