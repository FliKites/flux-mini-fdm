/* eslint-disable no-constant-condition */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
const axios = require('axios');
const readline = require('readline');
const fs = require('fs');
const nodecmd = require('node-cmd');
const util = require('util');
const timer = require('timers/promises');

const configFile = '/etc/haproxy/haproxy.cfg';
const appName = process.env.APP_NAME || 'explorer';
const appPort = process.env.APP_PORT || 39185;
const stickySession = process.env.STICKY || false;
const cmdAsync = util.promisify(nodecmd.run);

async function getApplicationIP(_appName) {
  try {
    const fluxnodeList = await axios.get(`https://api.runonflux.io/apps/location/${_appName}`, { timeout: 13456 });
    if (fluxnodeList.data.status === 'success') {
      return fluxnodeList.data.data || [];
    }
    return [];
  } catch (e) {
    return [];
  }
}

function convertIP(ip) {
  // eslint-disable-next-line no-param-reassign, prefer-destructuring
  if (ip.includes(':')) ip = ip.split(':')[0];
  return ip;
}

async function getHAConfig() {
  let HAconfig = '';
  const fileStream = fs.createReadStream(configFile);

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    HAconfig += `${line}\n`;
    if (line.includes('[SERVERS]')) break;
  }
  return HAconfig;
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
      if (stickySession) config += '    cookie FLUXSERVERID insert indirect nocache maxlife 8h\n';
      for (let i = 0; i < ipList.length; i += 1) {
        const serverIP = convertIP(ipList[i].ip);
        const serverID = `ip_${serverIP.replace('.', '_')}`;
        let stikyCoockie = '';
        if (stickySession) stikyCoockie = ` cookie ${serverID}`;
        config += `    server ${serverID} ${serverIP}:${appPort} check${stikyCoockie}\n`;
      }
      console.log(config);
      fs.writeFileSync(configFile, config);
      await cmdAsync('supervisorctl signal USR1 haproxy');
    } catch (err) {
      console.log(err);
    }
    await timer.setTimeout(1000 * 60 * 20);
  }
}

updateList();
