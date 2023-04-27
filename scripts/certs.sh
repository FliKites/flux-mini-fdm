#!/usr/bin/env bash

if [ -n "$DOMAIN" ]; then
    if [ "$CERT" = "manual" ]; then
       mkdir -p /etc/letsencrypt/live && mkdir -p /etc/haproxy/certs && cat /etc/letsencrypt/live/"$DOMAIN".key \
              /etc/letsencrypt/live/"$DOMAIN".crt \
              | tee /etc/haproxy/certs/haproxy-"$DOMAIN".pem >/dev/null
              echo "Self-signed certificate manually loaded and stored in /etc/haproxy/certs/"
   elif [ "$CERT" = "dual" ] && [ -z "$(ls -A /etc/haproxy/certs)" ]; then
     mkdir -p /etc/letsencrypt/live && mkdir -p /etc/haproxy/certs &&
openssl req -x509 -newkey rsa:4096 -sha256 -days 365 -nodes \
  -keyout /etc/letsencrypt/live/"$HNS_DOMAIN".key -out /etc/letsencrypt/live/"$HNS_DOMAIN".crt -extensions ext  -config \
  <(echo "[req]";
    echo distinguished_name=req;
    echo "[ext]";
    echo "keyUsage=critical,digitalSignature,keyEncipherment";
    echo "extendedKeyUsage=serverAuth";
    echo "basicConstraints=critical,CA:FALSE";
    echo "subjectAltName=DNS:$HNS_DOMAIN";
    ) -subj "/CN=$HNS_DOMAIN" && cat /etc/letsencrypt/live/"$HNS_DOMAIN".key \
              /etc/letsencrypt/live/"$HNS_DOMAIN".crt \
              | tee /etc/haproxy/certs/haproxy-"$HNS_DOMAIN".pem >/dev/null
    echo "Self-signed certificate generated and stored in /etc/haproxy/certs/" &&

 certbot certonly --no-self-upgrade -n --text --standalone \
            --preferred-challenges http-01 \
            -d "$DOMAIN" --keep --expand --agree-tos --email "$EMAIL" &&  mkdir -p /etc/haproxy/certs && cat /etc/letsencrypt/live/"$DOMAIN"/privkey.pem \
              /etc/letsencrypt/live/"$DOMAIN"/fullchain.pem \
              | tee /etc/haproxy/certs/haproxy-"$DOMAIN".pem >/dev/null && echo "Letsencrypt certificate generated and stored in /etc/haproxy/certs/"

    elif [ "$CERT" = "self" ] && [ -z "$(ls -A /etc/haproxy/certs)" ]; then
     mkdir -p /etc/letsencrypt/live && mkdir -p /etc/haproxy/certs &&
openssl req -x509 -newkey rsa:4096 -sha256 -days 365 -nodes \
  -keyout /etc/letsencrypt/live/"$DOMAIN".key -out /etc/letsencrypt/live/"$DOMAIN".crt -extensions ext  -config \
  <(echo "[req]";
    echo distinguished_name=req;
    echo "[ext]";
    echo "keyUsage=critical,digitalSignature,keyEncipherment";
    echo "extendedKeyUsage=serverAuth";
    echo "basicConstraints=critical,CA:FALSE";
    echo "subjectAltName=DNS:$DOMAIN";
    ) -subj "/CN=$DOMAIN" && cat /etc/letsencrypt/live/"$DOMAIN".key \
              /etc/letsencrypt/live/"$DOMAIN".crt \
              | tee /etc/haproxy/certs/haproxy-"$DOMAIN".pem >/dev/null
    echo "Self-signed certificate generated and stored in /etc/haproxy/certs/"

    elif [ "$STAGING" = true ]; then
        if [ -n "$ACME" ]; then
            certbot certonly --no-self-upgrade -n --text --standalone \
            --preferred-challenges http-01 \
            --staging \
            -d "$DOMAIN" --server "$ACME" --keep --expand --agree-tos --email "$EMAIL" &&  mkdir -p /etc/haproxy/certs && cat /etc/letsencrypt/live/"$DOMAIN"/privkey.pem \
              /etc/letsencrypt/live/"$DOMAIN"/fullchain.pem \
              | tee /etc/haproxy/certs/haproxy-"$DOMAIN".pem >/dev/null
        else
            certbot certonly --no-self-upgrade -n --text --standalone \
            --preferred-challenges http-01 \
            --staging \
            -d "$DOMAIN" --keep --expand --agree-tos --email "$EMAIL" &&  mkdir -p /etc/haproxy/certs && cat /etc/letsencrypt/live/"$DOMAIN"/privkey.pem \
              /etc/letsencrypt/live/"$DOMAIN"/fullchain.pem \
              | tee /etc/haproxy/certs/haproxy-"$DOMAIN".pem >/dev/null
        fi
    else
        if [ -n "$ACME" ]; then
            certbot certonly --no-self-upgrade -n --text --standalone \
            --preferred-challenges http-01 \
            -d "$DOMAIN" --server "$ACME" --keep --expand --agree-tos --email "$EMAIL" &&  mkdir -p /etc/haproxy/certs && cat /etc/letsencrypt/live/"$DOMAIN"/privkey.pem \
              /etc/letsencrypt/live/"$DOMAIN"/fullchain.pem \
              | tee /etc/haproxy/certs/haproxy-"$DOMAIN".pem >/dev/null

        else
            certbot certonly --no-self-upgrade -n --text --standalone \
            --preferred-challenges http-01 \
            -d "$DOMAIN" --keep --expand --agree-tos --email "$EMAIL" &&  mkdir -p /etc/haproxy/certs && cat /etc/letsencrypt/live/"$DOMAIN"/privkey.pem \
              /etc/letsencrypt/live/"$DOMAIN"/fullchain.pem \
              | tee /etc/haproxy/certs/haproxy-"$DOMAIN".pem >/dev/null && echo "Letsencrypt certificate generated and stored in /etc/haproxy/certs/"
        fi
    fi
             TLSA=$(openssl x509 -noout -pubkey -in /etc/haproxy/certs/haproxy-"$DOMAIN".pem | openssl rsa -pubin -outform DER 2>/dev/null | sha256sum | sed '' | awk '{print "3 1 1",$1}')
             echo $TLSA > /etc/letsencrypt/live/"$DOMAIN"_TLSA.txt
             echo "Generated below is the TLSA DNS record associated with your certificate | Add This Record Name To DNS: _443._tcp.$DOMAIN"
             echo $TLSA
         if [ -n "$HNS_DOMAIN" ]; then
TLSA=$(openssl x509 -noout -pubkey -in /etc/haproxy/certs/haproxy-"$HNS_DOMAIN".pem | openssl rsa -pubin -outform DER 2>/dev/null | sha256sum | sed '' | awk '{print "3 1 1",$1}')
             echo $TLSA > /etc/letsencrypt/live/"$HNS_DOMAIN"_TLSA.txt
             echo "Generated below is the TLSA DNS record associated with your Handshake Domain | Add This Record Name To DNS: _443._tcp.$HNS_DOMAIN"
             echo $TLSA
fi
fi

exit 0
