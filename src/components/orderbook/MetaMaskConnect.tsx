"use client";

import { useEffect, useState } from "react";

import { ORDERBOOK_CHAIN } from "@/lib/orderbook/chain";

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
};

function getEthereum(): EthereumProvider | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as Window & { ethereum?: EthereumProvider }).ethereum;
}

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function MetaMaskConnect({
  onAddress,
}: {
  onAddress?: (address: `0x${string}` | null) => void;
}) {
  const [address, setAddress] = useState<`0x${string}` | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    onAddress?.(address);
  }, [address, onAddress]);

  useEffect(() => {
    const eth = getEthereum();
    if (!eth?.on) return;

    const accountsHandler = (...args: unknown[]) => {
      const accounts = args[0];
      if (!Array.isArray(accounts) || accounts.length === 0) {
        setAddress(null);
        return;
      }
      setAddress(String(accounts[0]).toLowerCase() as `0x${string}`);
    };
    const chainHandler = (...args: unknown[]) => {
      const id = args[0];
      if (typeof id === "string") setChainId(Number.parseInt(id, 16));
    };

    eth.on("accountsChanged", accountsHandler);
    eth.on("chainChanged", chainHandler);
    return () => {
      eth.removeListener?.("accountsChanged", accountsHandler);
      eth.removeListener?.("chainChanged", chainHandler);
    };
  }, []);

  async function connect() {
    setBusy(true);
    setError(null);
    try {
      const eth = getEthereum();
      if (!eth) {
        throw new Error("MetaMask not found. Install the extension, then reload.");
      }
      const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
      if (!accounts[0]) throw new Error("No account returned from MetaMask");
      setAddress(accounts[0].toLowerCase() as `0x${string}`);

      const rawChain = (await eth.request({ method: "eth_chainId" })) as string;
      const id = Number.parseInt(rawChain, 16);
      setChainId(id);
      if (id !== ORDERBOOK_CHAIN.id) {
        await eth.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x1" }],
        });
        setChainId(1);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect MetaMask");
    } finally {
      setBusy(false);
    }
  }

  const wrongNetwork = chainId != null && chainId !== ORDERBOOK_CHAIN.id;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void connect()}
          disabled={busy}
          className="rounded border border-zinc-600 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 hover:border-zinc-400 disabled:opacity-50"
        >
          {address ? `Connected ${shortAddress(address)}` : busy ? "Connecting…" : "Connect MetaMask"}
        </button>
        <span className="text-xs text-zinc-500">
          {ORDERBOOK_CHAIN.name}
          {chainId != null ? ` · chainId ${chainId}` : ""}
        </span>
      </div>
      {wrongNetwork ? (
        <p className="text-sm text-amber-300">Switch MetaMask to Ethereum mainnet (chainId 1).</p>
      ) : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
    </div>
  );
}
