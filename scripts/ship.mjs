#!/usr/bin/env node
/**
 * Minimal deploy — run locally without Cursor.
 *
 *   npm run ship
 *   npm run ship -- --push
 *   npm run ship -- --push -m "Publish Praxis."
 *   npm run ship -- --ipfs          (Pinata upload after build; needs PINATA_JWT in .env.local)
 *   npm run ship -- --push --ipfs
 *
 * GitHub Actions on push to main builds and deploys Pages → ashitmilne.xyz.
 */
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const push = args.includes("--push");
const ipfs = args.includes("--ipfs");
const messageIdx = args.indexOf("-m");
const message =
  messageIdx >= 0 && args[messageIdx + 1]
    ? args[messageIdx + 1]
    : `ship ${new Date().toISOString().slice(0, 10)}`;

function run(label, command, cmdArgs = [], opts = {}) {
  const result = spawnSync(command, cmdArgs, {
    stdio: opts.inherit === false ? "pipe" : "inherit",
    shell: process.platform === "win32",
    cwd: process.cwd(),
    encoding: "utf8",
  });
  if (result.status !== 0) {
    console.error(`ship: failed at ${label}`);
    process.exit(result.status ?? 1);
  }
  return result;
}

run("content:attest", "npm", ["run", "content:attest"]);
run("build:global", "npm", ["run", "build:global"]);

if (ipfs) {
  run("ipfs-relative-export", "node", ["scripts/ipfs-relative-export.mjs"]);
  run("pinata:upload", "npm", ["run", "pinata:upload"]);
  console.log("ship: IPFS pin complete — update NEXT_PUBLIC_IPFS_CID if CID changed, then ship again.");
}

if (push) {
  const paths = [
    "ontology",
    "public/attestation.json",
    "public/.well-known",
    "public/sitemap.xml",
    "public/robots.txt",
    "public/openapi.json",
    "public/assets",
    "public/visuals",
    "assets",
    "src",
    "package.json",
    "package-lock.json",
    "scripts/ship.mjs",
  ];
  run("git add", "git", ["-A", "--", ...paths], { inherit: false });
  const status = run("git status", "git", ["--porcelain"], { inherit: false });
  if (!status.stdout?.trim()) {
    console.log("ship: nothing to commit");
    process.exit(0);
  }
  run("git commit", "git", ["-m", message], { inherit: false });
  run("git push", "git", ["origin", "main"]);
  console.log("ship: pushed — GitHub Pages deploy in ~2–3 min");
} else {
  console.log("ship: build ok — commit and push when ready (npm run ship -- --push -m \"…\")");
}
