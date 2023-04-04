const fs = require("fs").promises;
const axios = require("axios");
const cron = require("node-cron");
const dotenv = require("dotenv");
const { checkConnection } = require("./utils/utils");
dotenv.config();

const api = axios.create({
  baseURL: process.env.DNS_SERVER_ADDRESS ?? "https://varo.domains/api",
  headers: {
    Authorization: `Bearer ${process.env.DNS_SERVER_API_KEY}`,
  },
});

let DNS_ZONE = "";
const DNS_HEALTH_INTERVAL = process.env.FRONTEND_HEALTH_INTERVAL
  ? process.env.FRONTEND_HEALTH_INTERVAL
  : 20;

async function scheduleUpdate() {
  try {
    const rData = await getAvailableIpRecords();
    const records = rData.filter((record) => record.type === "A");
    const data = await fs.readFile(__dirname + "/iplist.txt", "utf-8");
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
      (record) => record.content === ip && record.name === process.env.DOMAIN
    );
    const response = await checkConnection(ip, 80);
    if (response && !record) {
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
    } else if (!response && record) {
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
      (record) => record.content === ip && record.name === process.env.DOMAIN
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
    let domain = await getDomain(process.env.DOMAIN);
    console.log("data ", data);
    const z = data.data.find((z) => z.name === domain);
    if (!z) {
      const { data } = await api.post("", {
        action: "createZone",
        domain: domain,
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
    const DNS_SERVER_ADDRESS = process.env.DNS_SERVER_ADDRESS;
    const DNS_SERVER_API_KEY = process.env.DNS_SERVER_API_KEY;
    console.log("DNS_SERVER_API_KEY ", DNS_SERVER_API_KEY);
    console.log("DNS_SERVER_ADDRESS ", DNS_SERVER_ADDRESS);

    const { data } = await axios.get("https://api.ipify.org/?format=json");
    console.log("server ip ", data?.ip);
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
        (record) =>
          record.content === data?.ip &&
          record.name === process.env.DOMAIN &&
          record.type === "A"
      )
    ) {
      const aRecordPayload = {
        action: "addRecord",
        zone: DNS_ZONE,
        type: "A",
        name: process.env.DOMAIN,
        content: data.ip,
      };
      console.log(`CREATING NEW A RECORD WITH PAYLOAD`);
      console.log(aRecordPayload);
      await api.post("", aRecordPayload);
      console.log("A RECORD SUCCESSFULLY CREATED WITH IP: ", data?.ip);
    }

    //reading tlsa from file if it's exist and not created a record same name then it will create new record
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

      console.log(`TLSA RECORD PAYLOAD`);
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

async function getDomain(domain) {
  const data = await fs.readFile(__dirname + "/tlds.txt", "utf8");
  const lines = data.split("\n");

  const commonTlds = lines
    .filter((ip) => ip.trim().length)
    .map((ip) => "." + ip.trim().toLowerCase());
  let parts = domain.split(".");
  let tld = parts.pop();
  let tld_d = tld;
  tld = "." + tld;
  if (commonTlds.includes(tld.toLowerCase())) {
    let secondLvlDomain = parts.pop();
    return secondLvlDomain ? secondLvlDomain + tld : domain;
  } else {
    return tld_d;
  }
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
