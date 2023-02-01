#!/usr/bin/env bash

# save container environment variables to use it
# in cron scripts
declare -p | grep -Ev '^declare -[[:alpha:]]*r' > /container.env

# go!
node /app/service.js & /certs.sh && node /app/health_check.js && supervisord -c /etc/supervisord.conf -n
# running health check script
