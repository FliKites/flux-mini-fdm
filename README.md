# ***Dockerized Mini Flux Domain Manager With Handshake Domain Support***

Use this to deploy your own front-end infrastructure for your Flux applications. 

It supports Handshake & ICANN Domains via 
1. [Varo DNS Managed Service Provider](https://varo.domains) 

2. [Self Hosted Version of Varo](https://github.com/Nathanwoodburn/HNS-server/tree/main/varo)

This tutorial will be specifically for using this application in a docker environment.

You can self host this software/repo with a static IP address from your Internet Service Provider or use any other server provider you'd like.

(Akash, OVH, Lumen, Digital Ocean, etc.)



### **Key Features:**

- Easily deploy Handshake Domains with Self Signed Certificates `CERT=self`
  Or use a custom ACME Server. `ACME=https://acme.htools.work/directory` 
  You may also supply your own certificates by mounting them to `/etc/nginx/certs`
 
- Configure time intervals for both frontend and backend health checks.

- Remove dead load balancer servers in your cluster from DNS, automatically. 

  Servers are automatically added back once they become healthy again.

- Check Flux backend servers for connectivity before placing them into load balancer. 
  This will ensure that you aren't serving a dead node in the Load Balancer. 
  (exludes blockchain apps - which require their own sync checks to be built in)

-  Auto-create the A record in DNS with your server IP address 
   (On Akash, this process will grab the host machine IP, you must change it)

- Auto-create zone in DNS server for Handshake Domain on Varo (if non-existent)

- Auto-generate self-signed certificate for Handshake Domain (if non-existent)

- Auto-create TLSA record in DNS server for Handshake Domain (if non-existent)

- Easily set the Flux nodes you want to use for the API calls that get Flux backend IPs in `utils/ips.txt`

- Stores the TLSA record as a file in `/etc/letsencrypt/live` and in log output, for reference.

- Own a reserved handshake domain? Edit `tlds.txt` in the root directory and remove your TLD from the ICANN list.
  Then specify your domain `DOMAIN=reserved.handshake`to deploy the Handshake version.


*Example Deployments:* 

#### Self-Signed Cert For Use With Handshake Domain

```
docker run --name flux-fdm-hns -d \
    -e APP_NAME=my-flux-app-name \
    -e APP_PORT=my-flux-app-port \
    -e DOMAIN=my.domain \
    -e CERT=self \
    -e DNS_SERVER_ADDRESS=https://varo.domains/api \
    -e DNS_SERVER_API_KEY=<varo-api-key> \
    -e FRONTEND_HEALTH_INTERVAL=1 \
    -e BACKEND_HEALTH_INTERVAL=60 \
    -p 80:80 -p 443:443 \
    wirewrex/flux-mini-fdm:latest
```

Using an ENV file:

`docker run -d --name flux-mini-fdm --env-file=.env wirewrex/flux-mini-fdm:latest`

Example ENV File: 
```
   APP_NAME=nostr
   APP_PORT=35860
   DOMAIN=my.domain
   CERT=self
   DNS_SERVER_ADDRESS=https://varo.domains/api 
   DNS_SERVER_API_KEY=<varo-api-key>
   FRONTEND_HEALTH_INTERVAL=1
   BACKEND_HEALTH_INTERVAL=60
```

#### How To Use Flux Backends With Handshake DNS & DANE Authenticated SSL 

First and foremost you will need to get these tasks out of the way if you aren't already using Handshake and/or Flux:

1. Get some HNS coins to get your own Handshake Domain & some FLUX coins to host an application

  Handshake - https://coinmarketcap.com/currencies/handshake/markets

  Flux - https://coinmarketcap.com/currencies/zel/markets



2. Get a Handshake Domain: https://www.youtube.com/watch?v=SFF_kStTTLY

 - You can also use https://namebase.io to get a Handshake Top Level Domain


3. Handshake DNS Resolver: https://impervious.com/fingertip

 - Watch the video to learn how to manually install - or use the "Auto Configure" option from the system tray icon for Fingertip (right click - then choose auto-configure, then select yes at the prompt)


4. Create an account on https://varo and notate your API key from the "settings" page

 - You can also access varo from https://varo.domains which is capable of pointing traditional domains to their servers: `ns1.varo.domains` `ns2.varo.domains`


 - Want to self host your own DNS instances and API? [Click here to get the automated scripts.](https://github.com/Nathanwoodburn/HNS-server/tree/main/varo) 
   Please note that wherever you host these servers it will require port 53 to be publicly open.



5. An application running on the Flux blockchain. You can deploy using the links below:
https://home.runonflux.io/apps/registerapp or https://jetpack2.app.runonflux.io/#/launch

 - You will need to whitelist your docker hub username on Flux before you can deploy your own images. 

 - You can do so by submitting a pull request with this file updated to include your username: 
   https://github.com/RunOnFlux/flux/blob/master/helpers/repositories.json

 - Otherwise you can deploy images from any of the whitelisted docker repos or users found in `respositories.json`


6. You need to set the DS record on the Handshake chain for your Domain. You will get the DS record from the Varo dashboard from the "Manage" section of your domain. 

You can have the software auto create the zone for your Handshake domain, or you can manually create. Once the zone is created, 
you can obtain the DS record and follow these directions to place it on chain. [Watch Video](https://youtu.be/1G94kPPQtEI)


# HOW IT WORKS


 ## Adding Your Handshake Domain Name To Varo For Management

   Step 4 above gave you links to signup for a varo account and get your API key. It also provided a self hosted option.

   This application will automatically create the zone for your specified domain and add the A record for your server into Varo using their API at deployment time.

   You can also manually create the zone and then add the DS record onto the Handshake chain before you ever deploy this software.

   You must ensure that you have these environment variables set when deploying, in order to create the zone and set the record on Varo:
   
   
   ```
   DOMAIN=<your-handshake-domain>
   DNS_SERVER_ADDRESS=https://varo.domains/api
   DNS_SERVER_API_KEY=<varo-api-key>
  ```

   If your frontend servers can resolve Handshake domains you can use `https://varo/api` for the endpoint.

   You will need to set the DS record on the Handshake Blockchain for your domain so that SSL will work properly.
  
   The DS record can be found in the Varo dashboard for your particular external domain after you have deployed this application once the zone is created.
   
   Visit https://varo.domains/sites then select manage next to your domain. The DS record is towards the bottom of the page.

   [Click here to learn how to set the DS record on the Handshake Blockchain](https://youtu.be/1G94kPPQtEI)



## GENERATING CERTIFICATES

This docker image deploys a container that provides an nginx instance with self signed certificates generated
at startup for your specified Handshake or ICANN Domain. It also automates the process of adding DNS records to your personal [Varo](https://varo.domains) account using the Varo API.

### Manual Certificates

Upload your own certs by mounting the directory on the host machine that contains the certificate.

#### DOCKER
You can do so by adding the ```-v /path/to/certs:/etc/nginx/certs``` to your docker run command. 

#### DOCKER COMPOSE

If you are using docker composer it will look something like this:

``` 
volumes:
    - /path/to/cert:/etc/nginx/certs
```

### SELF SIGNED CERTIFICATES

To generate a self signed certificate for your deployment you MUST set the environment variable `CERT=self`

This image also supports generating Lets Encrypt certificates for traditional domains if you specify the `EMAIL=your.email.com` ENV variable.

You also have the ability to specify your own ACME server using the`ACME=your-acme-endpoint`ENV variable.

Finally, you have full control over how the to generate certs and where you want them stored.



### ACME Certificates

You can generate staging certs from the ACME server by setting the ENV variable `STAGING=true` or production certs with `STAGING=false`

You can specify an ACME server to use or just use Lets Encrypt out of the box for traditional domains.


To use a custom ACME server set the ENV variable with the value that equals your endpoint. `ACME=https://acme.htools.work/directory`

You also need to set the ENV variable `EMAIL=youremail@gmail.com` if your ACME requires an email address.

If you don't set a custom ACME endpoint, it will use the Lets Encrypt non-staging endpoint by default.

If you choose to use the Handshake ACME server in the example ACME endpoint above, you can specify your email, 
and it will email you the TLSA record that corresponds to the generated certificate. 

If you don't want to receive emails then just add +noemail to the username portion of the email address: foobar+noemail@gmail.com

Certs that are generated using ACME will run a cron job that checks for expiring certificates with certbot agent and reloads nginx if a certificate is renewed. No container restart needed.


### Auto Retry Cert Generation If Cert Creation Fails

This is primarily to be used when deploying this software in conjunction with an ACME server and you have this software add the A record to DNS for you.

You can manage how the software will re-attempt to generate the certificates, when it initially fails to do so.


The below ENV variable will allow you to set which file or directory that should exist in order for the cert re-generation script to NOT run.

`CERT_PATH=/etc/letsencrypt/live/my.domain.crt`

By default it is set to: `/etc/letsencrypt/live/`

If it doesn't exist then it will attempt to regenerate the certificate 5 times every x amount of seconds using the default cert generation script, 
or a script file that you can specify using the ENV variable below.

`CERT_SCRIPT_PATH=/certs.sh`

You can control how often the delay in between each of the checks is by using the ENV variable below. In this example, it's set to 60 seconds. (x number of seconds) 

`CERT_RETRY_DELAY=60`



## Frontend Health Checks

You can create a level of redundancy for your frontends, by having them health check one another. Dead frontend nodes are automatically removed from DNS.

If the root directory contains a file named `iplist.txt` it will perform the automated health check and DNS actions.

You can specify 1 IP per line in the `iplist.txt`

Each IP that is specified will be health checked at the interval rate that is specified using `FRONTEND_HEALTH_INTERVAL=`

The default interval time is 1200 and is counted in seconds (1200 Seconds = 20 Mins)


If any of the endpoints can not be reached, they will be removed from DNS automatically. If they become healthy again, they will be added back to DNS.

In order for SSL to work properly using multiple frontends, all of your instances should be using the same manually uploaded cert. 

You can deploy this software for the first time to generate a new cert, and then copy and paste those files into all of the instances in `/etc/nginx/certs`


This software will also add the IP address of your front end instance(s) as an A record (if it doesn't already exist) and the TLSA record that corresponds to your generated certificate pair. (if a TLSA record doesn't already exist for the specified domain)


## Backend Health Checks

The application also performs a backend health check which calls the Flux API and uses logic that will get the most common set of IPs on your Flux deployment 15 minutes (Interval time can be configured down to the second).

It then updates and reloads the nginx backend server list gracefully with the IPs that were obtained for the provided Flux `APP_NAME` and `APP_PORT`. 

This application will automatically find active nodes from your `ips.txt` file and call the Flux API to get an updated list of IP addresses associated with your Flux application.

You can set the Flux nodes you want to use to call the API in `utils/ips.txt`. A preset list already exists, but you can add or remove as you see fit.

You can see the nodes available on the network here: https://home.runonflux.io/dashboard/list

You can set the environment variable of `BACKEND_HEALTH_INTERVAL=60` at deployment time and it will change to one minute (60 seconds) intervals instead of every hour.



## Customizing Nginx Configuration

    You can specify the path and file of your Nginx configuration using the `NGINX_CONFIG=/path/to/nginx.conf`

    docker run [...] -e NGINX_CONFIG=/etc/nginx/nginx.conf wirewrex/flux-mini-fdm:latest

IMPORTANT: Use the provided nginx config file in `conf` folder as the template.



### Pull from Github Packages:

```
docker pull wirewrex/flux-mini-fdm:latest
```


### Build from Dockerfile:

You will need Buildx installed on the machine you are initiating the build on. 

https://docs.docker.com/build/install-buildx/

Once installed navigate to the directory that contains the `Dockerfile` and then execute the command below. Or just add buildx to the top of your Dockerfile.

```
docker build -t flux-mini-fdm:latest .
```



### Run container:

Example of run commands (replace APP_NAME, APP_PORT, DOMAIN, EMAIL values and volume paths with yours).

The below command can be used to generate a self signed certificate for your Handshake Domain

```
docker run --name handshake-self-signed -d \
    -e APP_NAME=my-flux-app-name \
    -e APP_PORT=my-flux-app-port \
    -e DOMAIN=my.domain \
    -e CERT=self \
    -e DNS_SERVER_ADDRESS=https://varo.domains/api \
    -e DNS_SERVER_API_KEY=<varo-api-key>
    -e FRONTEND_HEALTH_INTERVAL=1 \
    -e BACKEND_HEALTH_INTERVAL=60 \
    -p 80:80 -p 443:443 \
    wirewrex/flux-mini-fdm:latest
```



The below run command is for use with a custom ACME server in production mode `STAGING=false`

```
docker run --name run--handshake-acme -d \
    -e APP_NAME=my-flux-app-name \
    -e APP_PORT=my-flux-app-port \
    -e DOMAIN=myhandshake.domain \
    -e EMAIL=foobar+noemail@gmail.com \
    -e STAGING=false \
    -e ACME=https://acme.htools.work/directory \
    -e DNS_SERVER_ADDRESS=https://varo.domains/api \
    -e DNS_SERVER_API_KEY=<varo-api-key> \
    -e FRONTEND_HEALTH_INTERVAL=1 \
    -e BACKEND_HEALTH_INTERVAL=60 \
    -p 80:80 -p 443:443 \
    wirewrex/flux-mini-fdm:latest
```

The below run command is for us with the default LetsEncrypt ACME server in production mode `STAGING=false`

If you want to create test certificates change `STAGING` to `true` ex. `STAGING=true`

```
docker run --name lb-letsencrypt -d \
    -e APP_NAME=my-flux-app-name \
    -e APP_PORT=my-flux-app-port \
    -e DOMAIN=myICANN.domain \
    -e EMAIL=foobar@gmail.com \
    -e STAGING=false \
    -e DNS_SERVER_ADDRESS=https://varo.domains/api \
    -e DNS_SERVER_API_KEY=<varo-api-key> \
    -e FRONTEND_HEALTH_INTERVAL=1 \
    -e BACKEND_HEALTH_INTERVAL=60 \
    -p 80:80 -p 443:443 \
    wirewrex/flux-mini-fdm:latest
```

## Run The Container On Akash

Their are a few things you need to do in order to run this on Akash. 

1. You need to ensure that the `endpoints:` directive is unique, and that all of the `ip:` directives match that name.
2. You need to update 3 ENV varaibles.
   `APP_NAME=` This should be the name of your app on Flux.
   `APP_PORT=` This should be the port of the Flux component.
   `DNS_SERVER_API_KEY=` This should be your varo DNS API key. 

   (Get the API key from settings page at https://varo.domains or https://varo on handshake - you must signup first)

3. You need to update Varo DNS server to use the actual leased IP of you Akash Instance. It will add the hosts IP, and you must change it in order for it to work. You can obtain the leased IP from the Lease Details page after deployment. 



Take the contents of the SDL file below with the proper changes and paste it into one of the below consoles: 

https://console.akash.network/new-deployment 

https://deploy.cloudmos.io/new-deployment?step=edit-deployment

PS: You will need to install the Keplr Wallet Extension in order to deploy. You must also have your wallet loaded with at least 5 Akash. 

```
version: '2.0'
endpoints:
 fdmep1:
   kind: ip
services:
  fdm:
    image: 'wirewrex/flux-mini-fdm:latest'
    expose:
      - port: 80
        as: 80
        to:
          - global: true
            ip: fdmep1
      - port: 443
        as: 443
        to:
          - global: true
            ip: fdmep1
    env:
     - CERT=self
     - APP_NAME=<your-flux-app-name>
     - APP_PORT=<your-flux-app-port>
     - DOMAIN=handshake.domain
     - DNS_SERVER_ADDRESS=https://varo.domains/api
     - DNS_SERVER_API_KEY=<your-api-key>
     - FRONTEND_HEALTH_INTERVAL=10
     - BACKEND_HEALTH_INTERVAL=60
    params:
      storage:
        data:
          mount: /etc/letsencrypt/live
          readOnly: false
profiles:
  compute:
    fdm:
      resources:
        cpu:
          units: 1
        memory:
          size: 1GB
        storage:
          - size: 1Gi
          - name: data
            size: 1Gi
            attributes:
              persistent: true
              class: beta3
  placement:
    dcloud:
      attributes:
      ip-lease: true
      pricing:
        fdm:
          denom: uakt
          amount: 4000
deployment:
  fdm:
    dcloud:
      profile: fdm
      count: 1
