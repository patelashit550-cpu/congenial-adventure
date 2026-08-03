import type { Metadata } from "next";

import { OrderBookDesk } from "@/components/orderbook/OrderBookDesk";

export const metadata: Metadata = {
  title: "Order book · Ethereum mainnet",
  description: "Mainnet spot order book desk with MetaMask trader identity.",
  robots: { index: false, follow: false },
};

export default function OrderbookPage() {
  return <OrderBookDesk />;
}
