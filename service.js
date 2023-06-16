/* eslint-disable no-constant-condition */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
const axios = require("axios");
const readline = require("readline");
const gamedig = require("gamedig");
const fs = require("fs");
const nodecmd = require("node-cmd");
const util = require("util");
const timer = require("timers/promises");
const { exec } = require("child_process");

const {
  getFluxNodes,
  findMostCommonResponse,
  checkConnection,
} = require("./utils/utils");

const configFile = process.env.NGINX_CONFIG || "/etc/nginx/nginx.conf";
const appName = process.env.APP_NAME || "explorer";
const appPort = process.env.APP_PORT || 39185;
const appDomain = process.env.DOMAIN || "";
const cmdAsync = util.promisify(nodecmd.run);
const executeScript = util.promisify(exec);

async function getWorkingNodes() {
  const fluxNodes = await getFluxNodes();
  const activeIps = [];
  for (const ip of fluxNodes) {
    try {
      await checkConnection(ip, 16127);
      activeIps.push(ip);
      if (activeIps.length >= 5) {
        return activeIps;
      }
    } catch (error) {
      console.log(`avoiding bad flux node ${ip} err: ${error?.message}`);
    }
  }
  return activeIps;
}

async function getApplicationIP(app_name) {
  try {
    // Select 5 random URLs
    // const fluxNodes = await getFluxNodes();

    // const randomFluxNodes = fluxNodes
    //   .sort(() => 0.5 - Math.random())
    //   .slice(0, 5);
    const randomFluxNodes = await getWorkingNodes();

    const randomUrls = randomFluxNodes.map(
      (ip) => `http://${ip}:16127/apps/location/${app_name}`
    );

    const requests = randomUrls.map((url) =>
      axios.get(url).catch((error) => {
        console.log(`Error while making request to ${url}: ${error}`);
      })
    );

    const responses = await axios.all(requests).catch((error) => {
      console.log(`Error while making concurrent requests: ${error}`);
    });

    let responseData = [];
    for (let i = 0; i < responses.length; i++) {
      if (responses[i] && responses[i].data) {
        const data = responses[i].data.data;
        responseData.push(data.map((item) => item.ip));
      }
    }

    // Find the most common IP
    const commonIps = findMostCommonResponse(responseData).map((ip) => {
      if (ip.includes(":")) {
        return ip.split(":")[0];
      }
      return ip;
    });
    const liveIPs = [];
    for (const ip of commonIps) {
      const isActive = await checkMinecraftActivity(ip, appPort);
      if (isActive) {
        liveIPs.push(ip);
      } else {
        console.log(`Minecraft server ip ${ip} is not active`);
      }
    }
    return liveIPs;
  } catch (error) {
    console.error(error?.message ?? error);
    return [];
  }
}

async function checkMinecraftActivity(ip, app_port) {
  try {
    const response = await gamedig.query({
      type: "minecraft",
      host: ip,
      port: app_port,
    });

    return response?.ping; // Check if Minecraft server is online
  } catch (error) {
    console.log(
      `Error while checking Minecraft activity for server ${ip}: ${error}`
    );
    return false;
  }
}

function convertIP(ip) {
  // eslint-disable-next-line no-param-reassign, prefer-destructuring
  if (ip.includes(":")) ip = ip.split(":")[0];
  return ip;
}

async function updateList() {
  while (true) {
    try {
      const ipList = await getApplicationIP(appName);
      console.log(ipList);
      while (!fs.existsSync(configFile)) {
        console.log(`${configFile} not found. trying again...`);
        await timer.setTimeout(500);
      }
      replaceServersAndCertInNginxConf(
        ipList.map(convertIP).map((ip) => `${ip}:${appPort}`),
        appDomain,
        "nginx-" + appDomain
      );
      console.log("working before reload");
      await cmdAsync("service nginx start && nginx -s reload");
    } catch (err) {
      console.log(err);
    }
    await timer.setTimeout(
      1000 *
        (process.env?.BACKEND_HEALTH_INTERVAL
          ? +process.env?.BACKEND_HEALTH_INTERVAL
          : 1200)
    );
  }
}

function replaceServersAndCertInNginxConf(servers, serverName, certName) {
  // const confPath = "/etc/nginx/nginx.conf";
  const conf = fs.readFileSync(configFile, "utf8");

  // Replace all occurrences of server_name and ssl_certificate values
  const newConf = conf
    .replace(/server_name\s+.*?;/g, `server_name ${serverName};`)
    .replace(
      /ssl_certificate\s+.*?;/g,
      `ssl_certificate /etc/nginx/certs/${certName}.crt;`
    )
    .replace(
      /ssl_certificate_key\s+.*?;/g,
      `ssl_certificate_key /etc/nginx/certs/${certName}.key;`
    );
  console.log("servers ", servers);
  // Replace #[SERVERS] placeholder
  const finalConf = newConf.replace(
    /upstream backend {[\s\S]*?}/,
    `upstream backend { server ${servers.join(";\nserver ")}; }`
  );

  fs.writeFileSync(configFile, finalConf);
}

async function startUP() {
  const filePath = process.env.CERT_PATH || "/etc/letsencrypt/live";
  const certScript = process.env.CERT_SCRIPT_PATH || "/certs.sh";
  try {
    if (!fs.existsSync(filePath)) {
      let count = 0;
      while (!fs.existsSync(filePath) && count < 5) {
        count++;
        await executeScript(certScript);
        console.log("retrying certs " + count);
        if (fs.existsSync(filePath)) {
          updateList();
          break;
        }
        await timer.setTimeout(
          1000 *
            (process.env?.CERT_RETRY_DELAY
              ? +process.env?.CERT_RETRY_DELAY
              : 60)
        );
      }
    } else {
      updateList();
    }
  } catch (error) {
    console.log("error something went wrong ", error?.message);
  }
}
startUP();
