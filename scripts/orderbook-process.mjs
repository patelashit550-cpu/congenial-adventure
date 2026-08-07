/**
 * Offline order-book processor demo.
 * Loads a ledger JSON, runs price-time matching, writes fills + open book.
 *
 * Ledger shape:
 * {
 *   "market": "WETH/USDC",
 *   "orders": [
 *     { "side":"buy","price":"3000","size":"1","trader":"0x..." },
 *     ...
 *   ]
 * }
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

function parseDecimal(value) {
  const trimmed = String(value).trim();
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) throw new Error(`Invalid decimal: ${value}`);
  const neg = trimmed.startsWith("-");
  const raw = neg ? trimmed.slice(1) : trimmed;
  const [whole, frac = ""] = raw.split(".");
  return { neg, digits: BigInt(whole + frac), scale: frac.length };
}

function toScaled(value, scale = 18) {
  const { neg, digits, scale: s } = parseDecimal(value);
  if (s > scale) throw new Error(`Decimal exceeds scale ${scale}: ${value}`);
  const scaled = digits * 10n ** BigInt(scale - s);
  return neg ? -scaled : scaled;
}

function fromScaled(value, scale = 18) {
  const neg = value < 0n;
  const abs = neg ? -value : value;
  const base = 10n ** BigInt(scale);
  const whole = abs / base;
  const frac = (abs % base).toString().padStart(scale, "0").replace(/0+$/, "");
  const body = frac.length ? `${whole}.${frac}` : `${whole}`;
  return neg ? `-${body}` : body;
}

function cmp(a, b) {
  const left = toScaled(a);
  const right = toScaled(b);
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function isPos(v) {
  return toScaled(v) > 0n;
}

function min(a, b) {
  return cmp(a, b) <= 0 ? a : b;
}

function sub(a, b) {
  return fromScaled(toScaled(a) - toScaled(b));
}

function newId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function processLedger(ledger) {
  const market = ledger.market || "WETH/USDC";
  const bids = [];
  const asks = [];
  const fills = [];

  function enqueue(order) {
    const side = order.side === "buy" ? bids : asks;
    side.push(order);
    side.sort((a, b) => {
      const priceCmp = order.side === "buy" ? cmp(b.price, a.price) : cmp(a.price, b.price);
      if (priceCmp !== 0) return priceCmp;
      return a.createdAt - b.createdAt;
    });
  }

  for (const raw of ledger.orders ?? []) {
    if (!/^0x[a-fA-F0-9]{40}$/.test(raw.trader || "")) {
      throw new Error(`Bad trader address: ${raw.trader}`);
    }
    const order = {
      id: raw.id || newId("ord"),
      market,
      side: raw.side,
      price: String(raw.price),
      size: String(raw.size),
      trader: String(raw.trader).toLowerCase(),
      status: "open",
      createdAt: raw.createdAt || Date.now(),
    };
    if (!isPos(order.price) || !isPos(order.size)) {
      throw new Error(`Non-positive order: ${JSON.stringify(raw)}`);
    }

    const resting = order.side === "buy" ? asks : bids;
    while (isPos(order.size) && resting.length > 0) {
      const best = resting[0];
      const crosses =
        order.side === "buy" ? cmp(order.price, best.price) >= 0 : cmp(order.price, best.price) <= 0;
      if (!crosses) break;
      const fillSize = min(order.size, best.size);
      fills.push({
        id: newId("fill"),
        market,
        price: best.price,
        size: fillSize,
        buyOrderId: order.side === "buy" ? order.id : best.id,
        sellOrderId: order.side === "sell" ? order.id : best.id,
        buyer: order.side === "buy" ? order.trader : best.trader,
        seller: order.side === "sell" ? order.trader : best.trader,
        createdAt: Date.now(),
      });
      order.size = sub(order.size, fillSize);
      best.size = sub(best.size, fillSize);
      order.status = isPos(order.size) ? "partial" : "filled";
      best.status = isPos(best.size) ? "partial" : "filled";
      if (!isPos(best.size)) resting.shift();
    }
    if (isPos(order.size)) enqueue(order);
  }

  return {
    market,
    chainId: 1,
    fills,
    book: {
      bids: bids.map((o) => ({ price: o.price, size: o.size, orderId: o.id, trader: o.trader })),
      asks: asks.map((o) => ({ price: o.price, size: o.size, orderId: o.id, trader: o.trader })),
    },
  };
}

const inputPath = process.argv[2] || path.join(ROOT, "scripts", "data", "orderbook-ledger.example.json");
const outputPath =
  process.argv[3] || path.join(ROOT, "scripts", "data", "orderbook-processed.json");

if (!fs.existsSync(inputPath)) {
  console.error(`orderbook-process: ledger not found: ${inputPath}`);
  process.exit(1);
}

const ledger = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const result = processLedger(ledger);
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");

console.log(
  `orderbook-process: market=${result.market} fills=${result.fills.length} bids=${result.book.bids.length} asks=${result.book.asks.length}`,
);
console.log(`orderbook-process: wrote ${path.relative(ROOT, outputPath)}`);
