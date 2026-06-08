/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SolanaTransaction } from "./types";

// Recibos iniciales del Registro de Pagos (Solana Ledger). Se usan como estado
// por defecto cuando todavía no hay transacciones guardadas en localStorage,
// de modo que la demo muestre un historial de Solana Pay desde el primer acceso.
export const PRESET_TRANSACTIONS: SolanaTransaction[] = [
  {
    id: "tx-preset-1",
    signature:
      "62P9426t2L2U62s7FPP62kQmXv8rT4hWnYbE3sJ9aL7cFgH1mP5qR2tV6wXyZ3bC7dNfG2hJ4kL6mQ8rSuT9vB",
    timestamp: "2026-06-04T05:18:39Z",
    buyerAddress: "8xKf3mNqP2rT5vW9yZ4bC7dGhJ6kLmN1pQrStUvWxYz",
    sellerAddress: "HuRtoScaNW1Lkt9bC7dGhJ6kLmN1pQrStUvWxYz2aB",
    cropId: "preset-7",
    cropName: "Café",
    quantity: 2,
    tokenUsed: "USDC",
    totalAmountPaid: 10.8,
    discountApplied: false,
    status: "success"
  },
  {
    id: "tx-preset-2",
    signature:
      "62PN9866650La7FPP3SJk8mWq4rT7hNbV3sD9aL2cF6gH1jK5mP8qR4tV6wX2yZ7bC3dN9fG5hJ8kL4mQ6rSdW",
    timestamp: "2026-06-04T18:17:55Z",
    buyerAddress: "5bN8qR3tV6wX2yZ7cD4fG1hJ9kL6mP8rStUvWxYzAbC",
    sellerAddress: "HuRtoScaNW1Lkt9bC7dGhJ6kLmN1pQrStUvWxYz2aB",
    cropId: "preset-7",
    cropName: "Café",
    quantity: 1,
    tokenUsed: "USDC",
    totalAmountPaid: 4.59,
    discountApplied: true,
    status: "success"
  }
];
