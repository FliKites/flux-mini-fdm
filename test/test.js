const fs = require("fs");
function replaceServersAndCertInNginxConf(servers, serverName, certName) {
  const confPath = `${__dirname}\\nginx.conf`;
  const conf = fs.readFileSync(confPath, "utf8");

  // Replace all occurrences of server_name and ssl_certificate values
  const newConf = conf
    .replace(/server_name\s+.*?;/g, `server_name ${serverName};`)
    .replace(
      /ssl_certificate\s+.*?;/g,
      `ssl_certificate /etc/nginx/certs/${certName}.pem;`
    );

  // Replace #[SERVERS] placeholder
  const finalConf = newConf.replace(
    /#\[(SERVERS)\]/g,
    `server ${servers.join(";\n    server ")};`
  );

  fs.writeFileSync(confPath, finalConf);
}

replaceServersAndCertInNginxConf(
  ["127.0.0.1:8000", "127.0.0.1:9000", "127.0.0.1:1100"],
  "flux.lootlink.xyz",
  "flux.lootlink.xyz"
);
