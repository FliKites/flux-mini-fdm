const fs = require("fs").promises;
const axios = require("axios");
const cron = require("node-cron");
const dotenv = require("dotenv");
const https = require("https");
const {
  checkConnection,
  findMostCommonResponse,
  getFluxNodes,
} = require("./utils/utils");

dotenv.config();

const api = axios.create({
  baseURL: process.env.DNS_SERVER_ADDRESS ?? "https://varo.domains/api",
  headers: {
    Authorization: `Bearer ${process.env.DNS_SERVER_API_KEY}`,
  },
});

const agent = new https.Agent({
  rejectUnauthorized: false,
});

const axiosInstance = axios.create({
  httpsAgent: agent,
});

let DNS_ZONE = "";
const DNS_HEALTH_INTERVAL = process.env.FRONTEND_HEALTH_INTERVAL
  ? process.env.FRONTEND_HEALTH_INTERVAL
  : 20;

async function scheduleUpdate() {
  try {
    const rData = await getAvailableIpRecords();
    const records = rData.filter((record) => record.type === "A");
    const data = await fs.readFile(`${__dirname}/iplist.txt`, "utf-8");
    const iplist = data
      ?.split("\n")
      .map((ip) => ip.trim())
      .filter((ip) => ip.trim().length);
    const worker = iplist.map((ip) => createOrDeleteRecord(ip, records));
    if (worker.length) {
      await Promise.all(worker);
    } else {
      console.log("no iplist found to check health so script will exiting.");
    }
  } catch (error) {
    console.log("unable to run script because of following error");
    console.log(error);
  }
}

async function createOrDeleteRecord(ip, records) {
  try {
    if (!DNS_ZONE) {
      console.log(
        "[createOrDeleteRecord] unable retrive DNS_ZONE, please check the the API KEY"
      );
      return;
    }
    const record = records.find(
      (r) => r.content === ip && r.name === process.env.DOMAIN
    );
    const response = await checkConnection(ip, 80);
    if (response === true && !record) {
      try {
        await api.post("", {
          action: "addRecord",
          zone: DNS_ZONE,
          type: "A",
          name: process.env.DOMAIN,
          content: ip,
        });
        console.log("record added for ip: ", ip);
      } catch (error) {
        console.log(error?.message ?? "unable to create record: ", ip);
      }
    } else if (response !== false && record) {
      try {
        await api.post("", {
          action: "deleteRecord",
          zone: DNS_ZONE,
          record: record.uuid,
        });
        console.log("record deleted for ip: ", ip);
      } catch (error) {
        console.log(
          error?.message ?? "unable to delete the record for ip: ",
          ip
        );
      }
    }
  } catch (error) {
    const record = records.find(
      (r) => r.content === ip && r.name === process.env.DOMAIN
    );
    if (record) {
      await api.post("", {
        action: "deleteRecord",
        zone: DNS_ZONE,
        record: record.uuid,
      });
      console.log("record deleted for ip: ", ip);
    }
    console.log("health check failed for ip: ", ip);
  }
}

async function getAvailableIpRecords() {
  try {
    const { data } = await api.post("", {
      action: "getZones",
    });
    const domain = await getDomain(process.env.DOMAIN);
    console.log("data ", data);
    const z = data.data.find((z) => z.name === domain);
    if (!z) {
      const { data } = await api.post("", {
        action: "createZone",
        domain,
      });

      DNS_ZONE = data.data.zone;
      console.log(`zone created ${DNS_ZONE} NAME: ${domain}`);
    } else {
      console.log(`zone exist ${z.name}:${z.id}`);
      DNS_ZONE = z.id;
    }

    const { data: recordsData } = await api.post("", {
      action: "getRecords",
      zone: DNS_ZONE,
    });

    return recordsData.data || [];
  } catch (error) {
    console.log(
      "Unable to get or create zone or get DNS records: ",
      error?.message
    );
    return [];
  }
}
async function createSelfDNSRecord() {
  try {
    const { DNS_SERVER_ADDRESS, DNS_SERVER_API_KEY, APP_NAME, APP_PORT } =
      process.env;
    console.log("DNS_SERVER_API_KEY ", DNS_SERVER_API_KEY);
    console.log("DNS_SERVER_ADDRESS ", DNS_SERVER_ADDRESS);

    let masterIP = await getMasterIP(APP_NAME, APP_PORT);
    console.log("masterIP ", masterIP);
    if (!masterIP) {
      masterIP = await fallbackToNodeIPs(APP_NAME, APP_PORT);
    }

    if (!masterIP) {
      console.log(
        `unable to find master ip for APP_NAME:${APP_NAME}, APP_PORT: ${APP_PORT}`
      );
      return;
    }

    const records = await getAvailableIpRecords();
    console.log("DNS_ZONE ", DNS_ZONE);
    if (!DNS_ZONE) {
      console.log(
        "[createSelfDNSRecord] unable retrive DNS_ZONE, please check the the API KEY"
      );
      return;
    }
    // a record is already not existed then create new record
    if (
      !records?.find(
        (r) =>
          r.content === masterIP &&
          r.name === process.env.DOMAIN &&
          r.type === "A"
      )
    ) {
      const aRecordPayload = {
        action: "addRecord",
        zone: DNS_ZONE,
        type: "A",
        name: process.env.DOMAIN,
        content: masterIP,
      };
      console.log("CREATING NEW A RECORD WITH PAYLOAD");
      console.log(aRecordPayload);
      await api.post("", aRecordPayload);
      console.log("A RECORD SUCCESSFULLY CREATED WITH IP: ", masterIP);
    }

    // reading tlsa from file if it's exist and not created a record same name then it will create new record
    const f = await fs.readFile(
      `/etc/letsencrypt/${process.env.DOMAIN}_TLSA.txt`,
      "utf-8"
    );
    const tlsa = f.split(/\r?\n/)[0];
    const recordName = `_443._tcp.${process.env.DOMAIN}`;
    if (
      !records.find(
        (record) => record.name === recordName && record.type === "TLSA"
      ) &&
      tlsa?.trim()
    ) {
      const tlsaRecord = {
        action: "addRecord",
        zone: DNS_ZONE,
        type: "TLSA",
        name: recordName,
        content: tlsa,
      };

      console.log("TLSA RECORD PAYLOAD");
      console.log(tlsaRecord);

      await api.post("", tlsaRecord);
      console.log("TLSA RECORD SUCCESS WITH TLSA: ", tlsa);
    } else {
      console.log(
        "A TLSA record already existed in the DNS server with the specified domain name ",
        recordName
      );
    }
  } catch (error) {
    console.log(error?.message ?? "Unable To Update TLSA DNS Record");
  }
}

async function getMasterIP(app_name, app_port) {
  try {
    // Try primary endpoint
    const primaryUrl = `https://${app_name}_${app_port}.app.runonflux.io/status`;
    try {
      const response = await axiosInstance.get(primaryUrl);
      if (response.data && response.data.masterIP) {
        console.log(`Primary endpoint success: ${primaryUrl}`);
        return response.data.masterIP;
      }
    } catch (error) {
      console.log(`Primary endpoint failed: ${error.message}`);
      console.log(`primary url ${primaryUrl}`);
    }

    // Try backup endpoint
    const backupUrl = `https://${app_name}_${app_port}.app2.runonflux.io/status`;
    try {
      const response = await axiosInstance.get(backupUrl);
      if (response.data && response.data.masterIP) {
        console.log(`Backup endpoint success: ${primaryUrl}`);
        return response.data.masterIP;
      }
    } catch (error) {
      console.log(`Backup endpoint failed: ${error.message}`);
      console.log(`backup url ${backupUrl}`);
    }

    return null;
  } catch (error) {
    console.log(`Failed to get master IP: ${error.message}`);
    return null;
  }
}

async function fallbackToNodeIPs(app_name, app_port) {
  console.log("using fallback fallbackToNodeIPs");
  // Select working nodes
  const randomFluxNodes = await getFluxNodes();
  const randomUrls = randomFluxNodes.map(
    (ip) => `https://${ip}:16128/apps/location/${app_name}`
  );

  const requests = randomUrls.map((url) =>
    axiosInstance.get(url).catch((error) => {
      console.log(`Error while making request to ${url}: ${error}`);
    })
  );

  const responses = await Promise.all(requests);

  let responseData = [];
  for (let i = 0; i < responses.length; i++) {
    if (responses[i] && responses[i].data) {
      const data = responses[i].data.data;
      responseData.push(data.map((item) => item.ip));
    }
  }

  // Find the most common IPs
  const commonIps = findMostCommonResponse(responseData).map((ip) => {
    if (ip.includes(":")) {
      return ip.split(":")[0];
    }
    return ip;
  });

  // Try to get master IP from each common IP
  for (const ip of commonIps) {
    try {
      const response = await axios.get(`http://${ip}:${app_port}/status`);
      if (response.data && response.data.masterIP) {
        console.log(`fallback master ip found ${response.data.masterIP}`);
        return response.data.masterIP;
      }
    } catch (error) {
      console.log(
        `Failed to get status from IP http://${ip}:${app_port}/status: ${error.message}`
      );
    }
  }
  console.log(
    `not found any master ip from fallbacknodes as well app: ${app_name}, port: ${app_port}`
  );
}

async function getDomain(domain) {
  const data = await fs.readFile(`${__dirname}/tlds.txt`, "utf8");
  const lines = data.split("\n");

  const commonTlds = lines
    .filter((ip) => ip.trim().length)
    .map((ip) => `.${ip.trim().toLowerCase()}`);
  const parts = domain.split(".");
  let tld = parts.pop();
  const tld_d = tld;
  tld = `.${tld}`;
  if (commonTlds.includes(tld.toLowerCase())) {
    const secondLvlDomain = parts.pop();
    return secondLvlDomain ? secondLvlDomain + tld : domain;
  }
  return tld_d;
}

async function main() {
  console.log("Frontend Health Check Script Is Active & Running");
  await createSelfDNSRecord();
  await scheduleUpdate();
}

if (require.main === module) {
  main();
  cron.schedule(`*/${DNS_HEALTH_INTERVAL} * * * *`, () => {
    scheduleUpdate();
  });
  // getDomain(process.env.DOMAIN).then(console.log);
}
