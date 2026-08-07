"use client";

import { useMemo, useState } from "react";

import { MetaMaskConnect } from "@/components/orderbook/MetaMaskConnect";
import { MatchingEngine } from "@/lib/orderbook/matching-engine";
import {
  getDepositAddressRegistry,
  hasDerivedAddresses,
} from "@/lib/orderbook/registry";
import { MAINNET_MARKETS } from "@/lib/orderbook/tokens";
import type { Fill, MarketId, OrderBookSnapshot, OrderSide } from "@/lib/orderbook/types";

export function OrderBookDesk() {
  const [trader, setTrader] = useState<`0x${string}` | null>(null);
  const [market, setMarket] = useState<MarketId>(MAINNET_MARKETS[0]!);
  const [side, setSide] = useState<OrderSide>("buy");
  const [price, setPrice] = useState("3000");
  const [size, setSize] = useState("0.1");
  const [error, setError] = useState<string | null>(null);
  const [fills, setFills] = useState<Fill[]>([]);
  const engine = useMemo(() => new MatchingEngine(MAINNET_MARKETS), []);
  const [snapshot, setSnapshot] = useState<OrderBookSnapshot>(() =>
    engine.snapshot(MAINNET_MARKETS[0]!),
  );

  const registry = getDepositAddressRegistry();

  function refreshBook(nextMarket: MarketId = market) {
    setSnapshot(engine.snapshot(nextMarket));
  }

  function place() {
    setError(null);
    if (!trader) {
      setError("Connect MetaMask first");
      return;
    }
    try {
      const result = engine.placeLimitOrder({
        market,
        side,
        price,
        size,
        trader,
      });
      setFills((prev) => [...result.fills, ...prev].slice(0, 20));
      refreshBook(market);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Order rejected");
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10 text-zinc-100">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Ethereum order book</h1>
        <p className="text-sm text-zinc-400">
          Mainnet only. MetaMask identifies the trader; deposit addresses are HD-derived
          offline from your mnemonic (public addresses only in this app).
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium uppercase tracking-[0.12em] text-zinc-500">Wallet</h2>
        <MetaMaskConnect onAddress={setTrader} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium uppercase tracking-[0.12em] text-zinc-500">
          Deposit addresses
        </h2>
        {!hasDerivedAddresses() ? (
          <p className="text-sm text-amber-200/90">
            No addresses yet. Set <code className="text-amber-100">ORDERBOOK_HD_MNEMONIC</code> in
            {" "}
            <code className="text-amber-100">.env.local</code>, then run{" "}
            <code className="text-amber-100">npm run orderbook:derive</code>. Commit only the
            generated public JSON — never the mnemonic.
          </p>
        ) : (
          <ul className="space-y-2 font-mono text-xs text-zinc-300">
            {registry.addresses.map((row) => (
              <li key={row.symbol} className="flex flex-col gap-0.5 border-b border-zinc-800 pb-2">
                <span className="text-zinc-500">
                  {row.symbol} · {row.derivationPath}
                </span>
                <span>{row.address}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium uppercase tracking-[0.12em] text-zinc-500">
          Place limit order
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="flex flex-col gap-1 text-xs text-zinc-500">
            Market
            <select
              value={market}
              onChange={(e) => {
                const next = e.target.value as MarketId;
                setMarket(next);
                refreshBook(next);
              }}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
            >
              {MAINNET_MARKETS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-500">
            Side
            <select
              value={side}
              onChange={(e) => setSide(e.target.value as OrderSide)}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
            >
              <option value="buy">buy</option>
              <option value="sell">sell</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-500">
            Price
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-500">
            Size
            <input
              value={size}
              onChange={(e) => setSize(e.target.value)}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={place}
          className="w-fit rounded border border-zinc-500 bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-white"
        >
          Submit to book
        </button>
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
      </section>

      <section className="grid gap-6 sm:grid-cols-2">
        <div>
          <h3 className="mb-2 text-xs uppercase tracking-[0.12em] text-zinc-500">Bids</h3>
          <BookSide rows={snapshot.bids} empty="No bids" />
        </div>
        <div>
          <h3 className="mb-2 text-xs uppercase tracking-[0.12em] text-zinc-500">Asks</h3>
          <BookSide rows={snapshot.asks} empty="No asks" />
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs uppercase tracking-[0.12em] text-zinc-500">Recent fills</h3>
        {fills.length === 0 ? (
          <p className="text-sm text-zinc-500">No fills yet — place crossing orders.</p>
        ) : (
          <ul className="space-y-1 font-mono text-xs text-zinc-300">
            {fills.map((f) => (
              <li key={f.id}>
                {f.market} {f.size} @ {f.price}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function BookSide({
  rows,
  empty,
}: {
  rows: Array<{ price: string; size: string; orderId: string }>;
  empty: string;
}) {
  if (rows.length === 0) return <p className="text-sm text-zinc-500">{empty}</p>;
  return (
    <ul className="space-y-1 font-mono text-xs text-zinc-300">
      {rows.map((row) => (
        <li key={row.orderId} className="flex justify-between gap-4 border-b border-zinc-900 py-1">
          <span>{row.price}</span>
          <span>{row.size}</span>
        </li>
      ))}
    </ul>
  );
}
