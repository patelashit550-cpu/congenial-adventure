import {
  cmpDecimal,
  isPositiveDecimal,
  minDecimal,
  subDecimal,
} from "@/lib/orderbook/decimal";
import type { Fill, MarketId, Order, OrderBookSnapshot, OrderSide } from "@/lib/orderbook/types";

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * In-memory price-time priority spot matching engine (Ethereum mainnet markets).
 * Persistence / deposit crediting is layered on by the processor.
 */
export class MatchingEngine {
  private readonly books = new Map<MarketId, { bids: Order[]; asks: Order[] }>();
  private readonly orders = new Map<string, Order>();
  private readonly fills: Fill[] = [];

  constructor(markets: MarketId[]) {
    for (const market of markets) {
      this.books.set(market, { bids: [], asks: [] });
    }
  }

  getOrder(orderId: string): Order | undefined {
    return this.orders.get(orderId);
  }

  listFills(market?: MarketId): Fill[] {
    return market ? this.fills.filter((f) => f.market === market) : [...this.fills];
  }

  snapshot(market: MarketId): OrderBookSnapshot {
    const book = this.requireBook(market);
    return {
      market,
      bids: book.bids.map((o) => ({ price: o.price, size: o.size, orderId: o.id })),
      asks: book.asks.map((o) => ({ price: o.price, size: o.size, orderId: o.id })),
      updatedAt: Date.now(),
    };
  }

  placeLimitOrder(input: {
    market: MarketId;
    side: OrderSide;
    price: string;
    size: string;
    trader: `0x${string}`;
  }): { order: Order; fills: Fill[] } {
    if (!isPositiveDecimal(input.price) || !isPositiveDecimal(input.size)) {
      throw new Error("price and size must be positive");
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(input.trader)) {
      throw new Error("trader must be a 0x address");
    }

    const now = Date.now();
    const order: Order = {
      id: newId("ord"),
      market: input.market,
      side: input.side,
      price: input.price,
      size: input.size,
      originalSize: input.size,
      trader: input.trader.toLowerCase() as `0x${string}`,
      status: "open",
      createdAt: now,
      updatedAt: now,
    };

    this.orders.set(order.id, order);
    const fills = this.match(order);
    if (isPositiveDecimal(order.size)) {
      this.enqueue(order);
    }
    return { order, fills };
  }

  cancel(orderId: string, trader: `0x${string}`): Order {
    const order = this.orders.get(orderId);
    if (!order) throw new Error(`Unknown order: ${orderId}`);
    if (order.trader !== trader.toLowerCase()) throw new Error("Not order owner");
    if (order.status === "filled" || order.status === "cancelled") {
      throw new Error(`Order not cancellable: ${order.status}`);
    }
    this.removeFromBook(order);
    order.status = "cancelled";
    order.updatedAt = Date.now();
    return order;
  }

  private requireBook(market: MarketId) {
    const book = this.books.get(market);
    if (!book) throw new Error(`Unsupported market: ${market}`);
    return book;
  }

  private enqueue(order: Order) {
    const book = this.requireBook(order.market);
    const side = order.side === "buy" ? book.bids : book.asks;
    side.push(order);
    side.sort((a, b) => {
      const priceCmp =
        order.side === "buy" ? cmpDecimal(b.price, a.price) : cmpDecimal(a.price, b.price);
      if (priceCmp !== 0) return priceCmp;
      return a.createdAt - b.createdAt;
    });
  }

  private removeFromBook(order: Order) {
    const book = this.requireBook(order.market);
    const side = order.side === "buy" ? book.bids : book.asks;
    const idx = side.findIndex((o) => o.id === order.id);
    if (idx >= 0) side.splice(idx, 1);
  }

  private match(incoming: Order): Fill[] {
    const book = this.requireBook(incoming.market);
    const restingSide = incoming.side === "buy" ? book.asks : book.bids;
    const created: Fill[] = [];

    while (isPositiveDecimal(incoming.size) && restingSide.length > 0) {
      const best = restingSide[0]!;
      const crosses =
        incoming.side === "buy"
          ? cmpDecimal(incoming.price, best.price) >= 0
          : cmpDecimal(incoming.price, best.price) <= 0;
      if (!crosses) break;

      const fillSize = minDecimal(incoming.size, best.size);
      const fillPrice = best.price;
      const now = Date.now();
      const buy = incoming.side === "buy" ? incoming : best;
      const sell = incoming.side === "sell" ? incoming : best;

      const fill: Fill = {
        id: newId("fill"),
        market: incoming.market,
        price: fillPrice,
        size: fillSize,
        buyOrderId: buy.id,
        sellOrderId: sell.id,
        buyer: buy.trader,
        seller: sell.trader,
        createdAt: now,
      };
      created.push(fill);
      this.fills.push(fill);

      incoming.size = subDecimal(incoming.size, fillSize);
      best.size = subDecimal(best.size, fillSize);
      incoming.updatedAt = now;
      best.updatedAt = now;

      incoming.status = isPositiveDecimal(incoming.size) ? "partial" : "filled";
      best.status = isPositiveDecimal(best.size) ? "partial" : "filled";

      if (!isPositiveDecimal(best.size)) {
        restingSide.shift();
      }
    }

    return created;
  }

  /** Restore engine state from a ledger (processor bootstrap). */
  importOpenOrders(orders: Order[]) {
    for (const order of orders) {
      if (order.status === "cancelled" || order.status === "filled") continue;
      if (!isPositiveDecimal(order.size)) continue;
      this.orders.set(order.id, { ...order });
      this.enqueue(this.orders.get(order.id)!);
    }
  }

  exportOpenOrders(): Order[] {
    return [...this.orders.values()].filter(
      (o) => o.status === "open" || o.status === "partial",
    );
  }
}
