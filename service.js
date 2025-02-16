/* eslint-disable no-constant-condition */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
const axios = require("axios");
const readline = require("readline");
const fs = require("fs");
const nodecmd = require("node-cmd");
const util = require("util");
const timer = require("timers/promises");
const { getFluxNodes, findMostCommonResponse } = require("./utils/utils");
const configFile = "/etc/haproxy/haproxy.cfg";
const appName = process.env.APP_NAME || "explorer";
const appPort = process.env.APP_PORT || 39185;
const stickySession = process.env.STICKY || true;
const statUser = process.env.STAT_USER || null;
const statPass = process.env.STAT_PASS || null;
const checkURL = process.env.CHECK_URL || false;
const checkStatus = process.env.CHECK_STATUS || false;
const cmdAsync = util.promisify(nodecmd.run);

// async function getApplicationIP(_appName) {
//   try {
//     const fluxnodeList = await axios.get(`https://api.runonflux.io/apps/location/${_appName}`, { timeout: 13456 });
//     if (fluxnodeList.data.status === 'success') {
//       return fluxnodeList.data.data || [];
//     }
//     return [];
//   } catch (e) {
//     return [];
//   }
// }

async function getApplicationIP(app_name) {
  try {
    // Array of URLs
    const fluxNodes = await getFluxNodes();
    // Select 5 random URLs
    const randomFluxNodes = fluxNodes
      .sort(() => 0.5 - Math.random())
      .slice(0, 5);

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

    // Find the most common IP from response data
    const commonIps = findMostCommonResponse(responseData).map((ip) => {
      if (ip.includes(":")) {
        return ip.split(":")[0];
      }
      return ip;
    });

    return commonIps;
  } catch (error) {
    console.error(error?.message ?? error);
    return [];
  }
}

function convertIP(ip) {
  // eslint-disable-next-line no-param-reassign, prefer-destructuring
  if (ip.includes(":")) ip = ip.split(":")[0];
  return ip;
}

async function getHAConfig() {
  let HAconfig = "";
  const fileStream = fs.createReadStream(configFile);

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    HAconfig += `${line}\n`;
    if (line.includes("[SERVERS]")) break;
  }
  return HAconfig;
}

function addStats(user, pass) {
  let HAconfig = fs.readFileSync(configFile).toString();
  HAconfig = HAconfig.replace(
    "[STATS]",
    `[STATS]
listen stats
    bind :8080
    mode http
    stats enable
    stats hide-version
    stats realm Haproxy\\ Statistics
    stats uri /
    stats auth ${user}:${pass}
`
  );

  fs.writeFileSync(configFile, HAconfig);
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
      let config = await getHAConfig();
      if (stickySession === true)
        config +=
          "    cookie FLUXSERVERID insert indirect nocache maxlife 8h\n\n";
      if (checkURL)
        config += `    option httpchk\n\n    http-check connect\n    http-check send meth GET uri ${checkURL}\n`;
      if (checkURL && checkStatus)
        config += `    http-check expect status ${checkStatus}\n\n`;
      for (let i = 0; i < ipList.length; i += 1) {
        const serverIP = convertIP(ipList[i]);
        const serverID = `ip_${serverIP.replaceAll(".", "_")}`;
        let stikyCoockie = "";
        if (stickySession === true) stikyCoockie = `cookie ${serverID}`;
        config += `    server ${serverID} ${serverIP}:${appPort} check ${stikyCoockie}\n`;
      }
      console.log(config);
      fs.writeFileSync(configFile, config);
      await cmdAsync("supervisorctl signal USR1 haproxy");
    } catch (err) {
      console.log(err);
    }
    await timer.setTimeout(1000 * 60 * 20);
  }
}

if (statUser && statPass) addStats(statUser, statPass);
updateList();
