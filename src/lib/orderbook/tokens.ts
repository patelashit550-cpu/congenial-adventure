import type { MarketId, TokenSymbol } from "@/lib/orderbook/types";

/** Supported mainnet assets for deposit addressing + spot markets. */
export const MAINNET_TOKENS: Record<
  TokenSymbol,
  {
    symbol: TokenSymbol;
    name: string;
    decimals: number;
    /** ERC-20 contract, or `native` for ETH. */
    address: `0x${string}` | "native";
    /** Stable derivation index → one deposit address per token. */
    derivationIndex: number;
  }
> = {
  ETH: {
    symbol: "ETH",
    name: "Ether",
    decimals: 18,
    address: "native",
    derivationIndex: 0,
  },
  WETH: {
    symbol: "WETH",
    name: "Wrapped Ether",
    decimals: 18,
    address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    derivationIndex: 1,
  },
  USDC: {
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    derivationIndex: 2,
  },
  USDT: {
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
    address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    derivationIndex: 3,
  },
  DAI: {
    symbol: "DAI",
    name: "Dai Stablecoin",
    decimals: 18,
    address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    derivationIndex: 4,
  },
};

/** Spot markets (base/quote). */
export const MAINNET_MARKETS: MarketId[] = [
  "WETH/USDC",
  "WETH/USDT",
  "ETH/USDC",
  "DAI/USDC",
];

export function parseMarket(market: MarketId): { base: TokenSymbol; quote: TokenSymbol } {
  const [base, quote] = market.split("/") as [TokenSymbol, TokenSymbol];
  if (!(base in MAINNET_TOKENS) || !(quote in MAINNET_TOKENS)) {
    throw new Error(`Unsupported market: ${market}`);
  }
  return { base, quote };
}

export function listTokenSymbols(): TokenSymbol[] {
  return Object.keys(MAINNET_TOKENS) as TokenSymbol[];
}
