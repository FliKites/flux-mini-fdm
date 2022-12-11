docker run --name lb -d \
    -e APP_NAME=my-flux-app-name \
    -e APP_PORT=my-flux-app-port \
    -e DOMAIN=my.domain \
    -e EMAIL=my.email@my.domain \
    -e STAGING=false \
    -v /srv/letsencrypt:/etc/letsencrypt \
    -v /srv/haproxycfg/haproxy.cfg:/etc/haproxy/haproxy.cfg \
    --network my_network \
    -p 80:80 -p 443:443 -p 8080:8080 \
    runonflux//flux-lb:latest
