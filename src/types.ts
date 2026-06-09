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
  userId?: string; // Firebase Auth User ID ownership
  bioScanLayout?: string; // Formated bulleted BioScan result string

  // Specialized botanical structure fields
  plantas?: string;     // Grupo botánico, clasificación o tipo de planta
  frutas?: string;      // Frutas / frutos cultivados
  frutos?: string;      // Morfología del fruto
  hojas?: string;       // Morfología o características de las hojas
  clorofila?: string;   // Información de clorofila y fotosíntesis
  clorofilia?: string;  // Campo alternativo para compatibilidad
  raiz?: string;        // Tipo y descripción de raíz
  tallo?: string;       // Tipo y descripción de tallo
  flor?: string;        // Estructura o descripción de flor
  semilla?: string;     // Propagación por semillas
  savia?: string;       // Savia y características internas
  estomas?: string;     // Comportamiento de estomas y respiración
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
