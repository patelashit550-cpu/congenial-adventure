import "server-only";

import { mnemonicToAccount } from "viem/accounts";

import { ORDERBOOK_CHAIN } from "@/lib/orderbook/chain";
import { MAINNET_TOKENS, listTokenSymbols } from "@/lib/orderbook/tokens";
import type {
  DepositAddress,
  DepositAddressRegistry,
  TokenSymbol,
} from "@/lib/orderbook/types";

const MNEMONIC_ENV = "ORDERBOOK_HD_MNEMONIC";

/**
 * BIP-44 account used for custodial deposit addresses.
 * Path: m/44'/60'/0'/0/{derivationIndex}
 *
 * Same EOA addresses are valid on EVM L2s, but this order book settles
 * mainnet-only — do not reuse these hot wallets on other chains without intent.
 */
export function getOrderbookMnemonic(): string {
  const mnemonic = process.env[MNEMONIC_ENV]?.trim();
  if (!mnemonic) {
    throw new Error(
      `${MNEMONIC_ENV} is required to derive deposit addresses. ` +
        `Set it in .env.local (never commit). Generate offline, e.g. with a hardware wallet seed tool.`,
    );
  }
  const words = mnemonic.split(/\s+/);
  if (words.length !== 12 && words.length !== 24) {
    throw new Error(`${MNEMONIC_ENV} must be 12 or 24 words`);
  }
  return words.join(" ");
}

export function derivationPathForIndex(addressIndex: number): string {
  return `m/44'/60'/0'/0/${addressIndex}`;
}

export function deriveDepositAddress(symbol: TokenSymbol, mnemonic?: string): DepositAddress {
  const token = MAINNET_TOKENS[symbol];
  const seed = mnemonic ?? getOrderbookMnemonic();
  const account = mnemonicToAccount(seed, {
    accountIndex: 0,
    changeIndex: 0,
    addressIndex: token.derivationIndex,
  });

  return {
    symbol,
    tokenAddress: token.address,
    derivationIndex: token.derivationIndex,
    derivationPath: derivationPathForIndex(token.derivationIndex),
    address: account.address,
    chainId: ORDERBOOK_CHAIN.id,
  };
}

export function deriveAllDepositAddresses(mnemonic?: string): DepositAddress[] {
  return listTokenSymbols().map((symbol) => deriveDepositAddress(symbol, mnemonic));
}

export function buildDepositAddressRegistry(mnemonic?: string): DepositAddressRegistry {
  return {
    version: 1,
    chainId: 1,
    chainName: "Ethereum Mainnet",
    generatedAt: new Date().toISOString(),
    note: "Public deposit addresses only. Private keys never leave ORDERBOOK_HD_MNEMONIC.",
    addresses: deriveAllDepositAddresses(mnemonic),
  };
}
