import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { getContentBuildTier, getSovereignEnv } from "./lib/content-provenance.mjs";

const root = process.cwd();
const attestationPath = join(root, "public", "attestation.json");
const outPath = join(root, "public", ".well-known", "provenance.json");

const identity = getSovereignEnv();
const tier = getContentBuildTier();

let attestation = null;
try {
  attestation = JSON.parse(readFileSync(attestationPath, "utf8"));
} catch {
  /* generate-attestation may not have run yet */
}

const provenance = {
  version: "1",
  generated: new Date().toISOString(),
  canonical: identity.canonical,
  aliases: [
    identity.sns ? { type: "sns", name: identity.sns } : null,
    identity.solSite ? { type: "sol.site", url: identity.solSite } : null,
    identity.ens ? { type: "ens", name: identity.ens } : null,
  ].filter(Boolean),
  identity: {
    did: identity.did,
    solana: identity.solana,
    validator: process.env.NEXT_PUBLIC_VALIDATOR_NAME?.trim() || null,
    validatorVoteAccount: process.env.NEXT_PUBLIC_VALIDATOR_VOTE_ACCOUNT?.trim() || null,
  },
  documents: {
    attestation: `${identity.canonical}/attestation.json`,
    auth: `${identity.canonical}/auth.md`,
    security: `${identity.canonical}/.well-known/security.txt`,
    apiCatalog: `${identity.canonical}/.well-known/api-catalog`,
    agentSkills: `${identity.canonical}/.well-known/agent-skills/index.json`,
  },
  pool: {
    description:
      "Published ontology corpus attestation for milling, noding, and transaction-pool agents.",
    tier,
    manifest: `${identity.canonical}/attestation.json`,
    manifestDigest: attestation?.manifestDigest ?? null,
    signature: attestation?.signature ?? null,
    entryCount: attestation?.attested?.length ?? null,
  },
  solSite: {
    domain: identity.solSite,
    status: "pending-dns",
    note:
      "Configure CNAME on SNS Sol.site to Cloudflare Pages (transition-insight.com). " +
      "Until DNS is live, treat canonical web URL as source of truth.",
  },
};

writeFileSync(outPath, `${JSON.stringify(provenance, null, 2)}\n`, "utf8");
console.log(`provenance: ${outPath.replace(/\\/g, "/")}`);
