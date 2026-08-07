/**
 * Derive public Ethereum mainnet deposit addresses (one per token) from
 * ORDERBOOK_HD_MNEMONIC. Writes src/data/orderbook-deposit-addresses.json.
 *
 * Never prints or writes private keys.
 */
import fs from "node:fs";
import path from "node:path";

import { mnemonicToAccount } from "viem/accounts";

import { loadEnvFiles } from "./lib/load-env.mjs";

loadEnvFiles();
// Optional dedicated secrets file (gitignored).
{
  const extra = path.join(process.cwd(), ".env.orderbook");
  if (fs.existsSync(extra)) {
    const text = fs.readFileSync(extra, "utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  }
}

const ROOT = process.cwd();
const OUT = path.join(ROOT, "src", "data", "orderbook-deposit-addresses.json");

const TOKENS = [
  { symbol: "ETH", address: "native", derivationIndex: 0 },
  {
    symbol: "WETH",
    address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    derivationIndex: 1,
  },
  {
    symbol: "USDC",
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    derivationIndex: 2,
  },
  {
    symbol: "USDT",
    address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    derivationIndex: 3,
  },
  {
    symbol: "DAI",
    address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    derivationIndex: 4,
  },
];

const mnemonic = process.env.ORDERBOOK_HD_MNEMONIC?.trim();
if (!mnemonic) {
  console.error(
    "orderbook-derive: set ORDERBOOK_HD_MNEMONIC in .env.local (12 or 24 words). Never commit it.",
  );
  process.exit(1);
}

const words = mnemonic.split(/\s+/);
if (words.length !== 12 && words.length !== 24) {
  console.error("orderbook-derive: mnemonic must be 12 or 24 words");
  process.exit(1);
}

const seed = words.join(" ");

// Refuse well-known development seeds — their private keys are public.
const DENY = new Set([
  "test test test test test test test test test test test junk",
  "test test test test test test test test test test test test",
]);
if (DENY.has(seed) && !process.argv.includes("--allow-dev-mnemonic")) {
  console.error(
    "orderbook-derive: refused well-known development mnemonic (public private keys). " +
      "Use a fresh offline mainnet seed. Pass --allow-dev-mnemonic only for local experiments.",
  );
  process.exit(1);
}
const addresses = TOKENS.map((token) => {
  const account = mnemonicToAccount(seed, {
    accountIndex: 0,
    changeIndex: 0,
    addressIndex: token.derivationIndex,
  });
  return {
    symbol: token.symbol,
    tokenAddress: token.address,
    derivationIndex: token.derivationIndex,
    derivationPath: `m/44'/60'/0'/0/${token.derivationIndex}`,
    address: account.address,
    chainId: 1,
  };
});

const registry = {
  version: 1,
  chainId: 1,
  chainName: "Ethereum Mainnet",
  generatedAt: new Date().toISOString(),
  note: "Public deposit addresses only. Private keys never leave ORDERBOOK_HD_MNEMONIC.",
  addresses,
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify(registry, null, 2)}\n`, "utf8");

console.log(`orderbook-derive: wrote ${addresses.length} mainnet addresses → ${path.relative(ROOT, OUT)}`);
for (const row of addresses) {
  console.log(`  ${row.symbol.padEnd(4)} ${row.derivationPath} → ${row.address}`);
}
console.log("orderbook-derive: mnemonic was not written anywhere");
