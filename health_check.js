const fs = require("fs").promises;
const axios = require("axios");
const cron = require("node-cron");
const dotenv = require("dotenv");
dotenv.config();
const { checkConnection } = require("./utils/utils");

const api = axios.create({
  baseURL: process.env.DNS_SERVER_ADDRESS,
  headers: {
    Authorization: `Bearer ${process.env.DNS_SERVER_API_KEY}`,
    "Content-Type": "application/json",
  },
});

let DNS_ZONE = "";
const DNS_HEALTH_INTERVAL = process.env.DNS_HEALTH_INTERVAL
  ? process.env.DNS_HEALTH_INTERVAL
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
    const record = records.find(
      (record) => record.content === ip && record.name === process.env.DOMAIN
    );
    const response = await checkConnection(ip, 80);
    if (response && !record) {
      try {
        await api.post(`/zones/${DNS_ZONE}/dns_records`, {
          type: "A",
          name: process.env.DOMAIN,
          content: ip,
          ttl: 3600,
        });
        console.log("record added for ip: ", ip);
      } catch (error) {
        console.log(error?.message ?? "unable to create record: ", ip);
      }
    } else if (!response && record) {
      try {
        await api.delete(`/zones/${DNS_ZONE}/dns_records/${record.id}`);
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
      await api.delete(`/zones/${DNS_ZONE}/dns_records/${record.id}`);
      console.log("record deleted for ip: ", ip);
    }
    console.log("health check failed for ip: ", ip);
  }
}

async function getAvailableIpRecords() {
  try {
    let domain_name = process.env.DOMAIN;
    if (domain_name.includes(".")) {
      const split = domain_name.split(".");
      domain_name = `${split[split.length - 2]}.${split[split.length - 1]}`;
    }

    const { data: zoneData } = await api.get(
      `/zones?account.id=${process.env.DNS_SERVER_ACCOUNT_ID}&name=${domain_name}`
    );
    if (!zoneData?.result?.length) {
      const input = {
        account: { id: process.env.DNS_SERVER_ACCOUNT_ID },
        name: domain_name,
        type: "full",
      };
      const { data: newZoneData } = await api.post("/zones", input);
      DNS_ZONE = newZoneData.result.id;
    } else {
      DNS_ZONE = zoneData?.result[0].id;
    }

    const { data } = await api.get(`/zones/${DNS_ZONE}/dns_records`);
    return data?.result ?? [];
  } catch (error) {
    console.log("unable to get dns records");
    console.log(error?.message);
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
        type: "A",
        name: process.env.DOMAIN,
        content: data.ip,
        ttl: 3600,
      };
      console.log(`CREATING NEW A RECORD WITH PAYLOAD`);
      console.log(aRecordPayload);
      await api.post(`/zones/${DNS_ZONE}/dns_records`, aRecordPayload);
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
        type: "TLSA",
        name: recordName,
        content: tlsa,
        ttl: 3600,
      };

      console.log(`TLSA RECORD PAYLOAD`);
      console.log(tlsaRecord);

      await api.post(`/zones/${DNS_ZONE}/dns_records`, tlsaRecord);
      console.log("TLSA RECORD SUCCESS WITH TLSA: ", tlsa);
    } else {
      console.log(
        "A TLSA record already existed in the DNS server with name ",
        recordName
      );
    }
  } catch (error) {
    console.log(error?.message ?? "unable to update dns records");
  }
}

async function main() {
  console.log("health check script running->>>>");
  await createSelfDNSRecord();
  await scheduleUpdate();
}

if (require.main === module) {
  main();
  cron.schedule(`*/${DNS_HEALTH_INTERVAL} * * * *`, () => {
    scheduleUpdate();
  });
}
