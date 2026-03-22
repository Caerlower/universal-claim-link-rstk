/**
 * After `npm run deploy:rstest`, writes VITE_UNIVERSAL_CLAIM_LINKS_ADDRESS into frontend/.env
 * from deployments/deployment-31.json (creates the line if missing).
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const depPath = path.join(root, "deployments", "deployment-31.json");
const envPath = path.join(root, "frontend", ".env");

if (!fs.existsSync(depPath)) {
  console.error("Missing deployments/deployment-31.json — run from repo root:\n  npm run compile && npm run deploy:rstest");
  process.exit(1);
}

const { universalClaimLinks } = JSON.parse(fs.readFileSync(depPath, "utf8"));
if (!universalClaimLinks) {
  console.error("deployment-31.json has no universalClaimLinks field.");
  process.exit(1);
}

let env = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
const line = `VITE_UNIVERSAL_CLAIM_LINKS_ADDRESS=${universalClaimLinks}`;

if (/^VITE_UNIVERSAL_CLAIM_LINKS_ADDRESS=/m.test(env)) {
  env = env.replace(/^VITE_UNIVERSAL_CLAIM_LINKS_ADDRESS=.*$/m, line);
} else {
  if (env.length && !env.endsWith("\n")) env += "\n";
  env += `${line}\n`;
}

fs.writeFileSync(envPath, env);
console.log("Updated frontend/.env:", line);
console.log("Restart the Vite dev server.");
