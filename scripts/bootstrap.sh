#!/usr/bin/env bash

# save container environment variables to use it
# in cron scripts
declare -p | grep -Ev '^declare -[[:alpha:]]*r' > /container.env

# go!
# /certs.sh && supervisord -c /etc/supervisord.conf -n && node /app/service.js && node /app/health_check.js
# running health check script
#!/bin/bash

/certs.sh
echo "i am here0";
supervisord -c /etc/supervisord.conf -n &
echo "i am here1";
node /app/health_check.js &
echo "i am here2";
node /app/service.js
