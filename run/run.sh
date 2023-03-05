docker run --name lb -d -e APP_NAME=nostr -e APP_PORT=35860 -e DOMAIN=nostr.hssl -e STAGING=false -e STICKY=false -e CERT=self -p 80:80 -p 443:443 <your-image>
