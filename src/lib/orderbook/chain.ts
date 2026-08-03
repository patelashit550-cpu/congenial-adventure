/** Ethereum mainnet only — no L2 settlement in this module. */
export const ORDERBOOK_CHAIN = {
  id: 1,
  name: "Ethereum Mainnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcEnv: "ORDERBOOK_ETH_RPC_URL",
  explorer: "https://etherscan.io",
} as const;

export type OrderbookChainId = typeof ORDERBOOK_CHAIN.id;

export function assertMainnetChainId(chainId: number): asserts chainId is 1 {
  if (chainId !== 1) {
    throw new Error(`Order book is mainnet-only (chainId 1); got ${chainId}`);
  }
}
