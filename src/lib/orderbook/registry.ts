import registryJson from "@/data/orderbook-deposit-addresses.json";
import type { DepositAddress, DepositAddressRegistry, TokenSymbol } from "@/lib/orderbook/types";

type RegistryFile = DepositAddressRegistry | {
  version: 1;
  chainId: 1;
  chainName: "Ethereum Mainnet";
  generatedAt: string | null;
  note: string;
  addresses: DepositAddress[];
};

const registry = registryJson as RegistryFile;

export function getDepositAddressRegistry(): RegistryFile {
  return registry;
}

export function getDepositAddress(symbol: TokenSymbol): DepositAddress | null {
  return registry.addresses.find((row) => row.symbol === symbol) ?? null;
}

export function hasDerivedAddresses(): boolean {
  return registry.addresses.some((row) => Boolean(row.address));
}
