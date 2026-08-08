/**
 * Key/address helpers for the browser wallet bridge.
 *
 * The DApp Connector returns keys/addresses in Bech32m form. The midnight-js
 * providers and ledger want plain hex key strings. This module converts
 * between the two using the tiny, dependency-light `wallet-sdk-address-format`
 * package.
 */
import {
  MidnightBech32m,
  ShieldedCoinPublicKey,
  ShieldedEncryptionPublicKey,
} from '@midnight-ntwrk/wallet-sdk-address-format';

/** Extract the 32-byte hex-encoded Coin (shielded) public key from a Bech32m value. */
export function coinPublicKeyFromBech32(bech32: string): string {
  const parsed = MidnightBech32m.parse(bech32);
  const pk = ShieldedCoinPublicKey.codec.decode(parsed.network, parsed);
  return pk.toHexString();
}

/** Extract the 32-byte hex-encoded encryption public key from a Bech32m value. */
export function encryptionPublicKeyFromBech32(bech32: string): string {
  const parsed = MidnightBech32m.parse(bech32);
  const pk = ShieldedEncryptionPublicKey.codec.decode(parsed.network, parsed);
  return pk.toHexString();
}