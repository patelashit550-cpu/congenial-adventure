/** Ethereum mainnet order book domain types (spot). */

export type OrderSide = "buy" | "sell";
export type OrderStatus = "open" | "partial" | "filled" | "cancelled";

export type TokenSymbol = "ETH" | "WETH" | "USDC" | "USDT" | "DAI";

export type MarketId = `${TokenSymbol}/${TokenSymbol}`;

export type Order = {
  id: string;
  market: MarketId;
  side: OrderSide;
  /** Limit price in quote per base (string decimal). */
  price: string;
  /** Remaining size in base token units (string decimal). */
  size: string;
  /** Original size in base token units. */
  originalSize: string;
  trader: `0x${string}`;
  status: OrderStatus;
  createdAt: number;
  updatedAt: number;
};

export type Fill = {
  id: string;
  market: MarketId;
  price: string;
  size: string;
  buyOrderId: string;
  sellOrderId: string;
  buyer: `0x${string}`;
  seller: `0x${string}`;
  createdAt: number;
};

export type DepositAddress = {
  symbol: TokenSymbol;
  tokenAddress: `0x${string}` | "native";
  derivationIndex: number;
  derivationPath: string;
  address: `0x${string}`;
  chainId: 1;
};

export type OrderBookSnapshot = {
  market: MarketId;
  bids: Array<{ price: string; size: string; orderId: string }>;
  asks: Array<{ price: string; size: string; orderId: string }>;
  updatedAt: number;
};

/** Public registry shape — safe to commit (addresses only, never keys). */
export type DepositAddressRegistry = {
  version: 1;
  chainId: 1;
  chainName: "Ethereum Mainnet";
  generatedAt: string | null;
  note: string;
  addresses: DepositAddress[];
};
