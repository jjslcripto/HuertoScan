/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Crop {
  id: string;
  name: string;
  scientificName: string;
  origin: string;
  description: string;
  uses: string;
  careLevel: string; // Fácil, Moderado, Difícil
  sunlight: string;
  waterRequirements: string;
  harvestTime: string;
  recommendedPriceSol: number;
  recommendedPriceUsdc: number;
  recommendedPriceUsdt: number;
  priceSol: number; // Precio fijado por el usuario
  priceUsdc: number; // Precio fijado por el usuario
  priceUsdt: number; // Precio fijado por el usuario
  stock: number;
  imageUrl?: string;
  scannedAt: string;
  isForSale: boolean;
  notes?: string;
}

export interface SolanaTransaction {
  id: string;
  signature: string;
  timestamp: string;
  buyerAddress: string;
  sellerAddress: string;
  cropId: string;
  cropName: string;
  quantity: number;
  tokenUsed: "SOL" | "USDC" | "USDT";
  totalAmountPaid: number;
  discountApplied: boolean;
  status: "pending" | "processing" | "confirming" | "success" | "failed";
}

export interface WalletState {
  connected: boolean;
  publicKey: string;
  balanceSol: number;
  balanceUsdc: number;
  balanceUsdt: number;
  hasVibePassNft: boolean; // El NFT del bootcamp para habilitar el 15% de descuento
  network?: "devnet" | "mainnet";
}
