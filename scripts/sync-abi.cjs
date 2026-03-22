const fs = require("fs");
const path = require("path");

const artifactPath = path.join(__dirname, "../artifacts/contracts/UniversalClaimLinks.sol/UniversalClaimLinks.json");
const outPath = path.join(__dirname, "../frontend/src/lib/contracts/universalClaimLinksAbi.json");

const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(artifact.abi, null, 2));
console.log("Wrote", outPath);
