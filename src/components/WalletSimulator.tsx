/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Wallet, ShieldCheck, Ticket, Copy, Check, Info, Ghost, Sun, Edit2, X } from "lucide-react";
import { WalletState } from "../types";

interface WalletSimulatorProps {
  wallet: WalletState;
  onChange: (newWallet: WalletState) => void;
}

export default function WalletSimulator({ wallet, onChange }: WalletSimulatorProps) {
  const [copied, setCopied] = useState(false);
  const [selectedWalletName, setSelectedWalletName] = useState<string>("");
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [editedAddress, setEditedAddress] = useState("");

  const handleStartEdit = () => {
    setEditedAddress(wallet.publicKey || "");
    setIsEditingAddress(true);
  };

  const handleSaveEdit = () => {
    if (editedAddress.trim()) {
      onChange({
        ...wallet,
        publicKey: editedAddress.trim(),
      });
    }
    setIsEditingAddress(false);
  };

  const handleCancelEdit = () => {
    setIsEditingAddress(false);
  };

  const handleConnect = (walletName: string) => {
    setSelectedWalletName(walletName);
    // Generar llave pública simulada de Solana
    const randomPubkey = "Hwt8X" + Math.random().toString(36).substring(2, 10).toUpperCase() + "vS7pYvNuBrd9XW";
    const currentNetwork = wallet.network || "devnet";
    onChange({
      connected: true,
      publicKey: randomPubkey,
      balanceSol: currentNetwork === "mainnet" ? 1.45 : 2.50, // balances para distinguir Mainnet y Devnet
      balanceUsdc: currentNetwork === "mainnet" ? 82.50 : 15.00,
      balanceUsdt: currentNetwork === "mainnet" ? 54.10 : 10.00,
      hasVibePassNft: false, // Inicia sin pase de descuento para que puedan reclamarlo
      network: currentNetwork,
    });
  };

  const handleDisconnect = () => {
    setSelectedWalletName("");
    onChange({
      connected: false,
      publicKey: "",
      balanceSol: 0,
      balanceUsdc: 0,
      balanceUsdt: 0,
      hasVibePassNft: false,
      network: wallet.network || "devnet",
    });
  };

  const handleCopyBase = (text: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.log("[WalletSimulator] Error al copiar al portapapeles:", err);
    }
  };

  const toggleNftPass = () => {
    onChange({
      ...wallet,
      hasVibePassNft: !wallet.hasVibePassNft,
    });
  };

  const addFunds = () => {
    onChange({
      ...wallet,
      balanceSol: +(wallet.balanceSol + 1).toFixed(2),
      balanceUsdc: +(wallet.balanceUsdc + 20).toFixed(2),
    });
  };

  return (
    <div id="wallet-simulator" className="bg-emerald-950 rounded-[32px] p-6 text-white shadow-xl border-t-8 border-emerald-400 border-l border-r border-b border-emerald-900/85 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-white text-2xl font-black">
            W
          </div>
          <div>
            <h3 className="font-sans font-black text-lg text-white flex items-center gap-2 leading-none">
              Solana Wallet Hub
              <span className="text-[10px] tracking-widest uppercase bg-yellow-400 text-emerald-950 px-2.5 py-0.5 rounded-full font-sans font-black">
                SIMULADOR
              </span>
            </h3>
            <p className="text-xs text-emerald-300 font-medium">
              Prueba transacciones rápidas sin costo real en Devnet.
            </p>
          </div>
        </div>

        {wallet.connected && (
          <button
            id="disconnect-wallet-btn"
            onClick={handleDisconnect}
            className="bg-red-500 text-white font-bold p-2.5 rounded-xl border-2 border-emerald-950 shadow-[2px_2px_0px_0px_#064e3b] text-xs hover:translate-y-0.5 transition-all cursor-pointer uppercase font-black"
          >
            Desconectar
          </button>
        )}
      </div>

      {!wallet.connected ? (
        <div id="wallet-disconnected-view" className="space-y-4 pt-2">
          <div className="bg-emerald-900/50 p-4 rounded-2xl text-emerald-100 text-xs border border-emerald-800 flex gap-3 items-start">
            <Info className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-black text-emerald-300">¿Eres nuevo en Solana?</span>
              <p className="text-xs text-emerald-200 leading-relaxed font-semibold">
                Las transacciones en Solana tardan menos de <b>1 segundo</b> y cuestan apenas <b>$0.00025</b>. Conecta una cartera simulada para ver la magia de Solana Pay en acción.
              </p>
            </div>
          </div>

          <p className="text-xs text-yellow-400 font-black text-center uppercase tracking-widest">
            Selecciona tu cartera simulada:
          </p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { name: "Phantom", color: "hover:border-purple-500 hover:bg-purple-950/20 text-purple-300 border-purple-900" },
              { name: "Solflare", color: "hover:border-amber-500 hover:bg-amber-950/20 text-amber-300 border-amber-950" },
              { name: "Backpack", color: "hover:border-red-500 hover:bg-red-950/20 text-red-500 border-red-900" },
            ].map((w) => (
              <button
                key={w.name}
                id={`connect-${w.name.toLowerCase()}-btn`}
                onClick={() => handleConnect(w.name)}
                className={`py-3.5 px-2 rounded-2xl text-xs font-black border-2 bg-emerald-950 flex flex-col items-center gap-2 transition-all hover:scale-105 hover:shadow-[4px_4px_0px_0px_#064e3b] cursor-pointer ${w.color}`}
              >
                <div className="w-9 h-9 rounded-xl bg-white text-emerald-950 flex items-center justify-center font-mono text-base font-extrabold shadow-[2px_2px_0px_0px_#064e50]">
                  {w.name === "Phantom" ? (
                    <Ghost className="w-5.5 h-5.5 text-purple-600 fill-purple-100 animate-pulse" />
                  ) : w.name === "Solflare" ? (
                    <Sun className="w-5.5 h-5.5 text-amber-500 fill-amber-300 animate-spin hover:scale-110 transition-transform duration-300" style={{ animationDuration: '6s' }} />
                  ) : w.name === "Backpack" ? (
                    <svg className="w-5.5 h-5.5 hover:rotate-12 transition-transform duration-300 rounded-[10px] shrink-0 pointer-events-none animate-pulse" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect width="100" height="100" rx="22" fill="#E33E3F" />
                      {/* Backpack handle */}
                      <path d="M38 32 C38 20, 62 20, 62 32" stroke="white" strokeWidth="6.5" strokeLinecap="round" fill="none" />
                      {/* Backpack main body */}
                      <rect x="24" y="32" width="52" height="46" rx="14" fill="white" />
                      {/* Zipper divider line */}
                      <path d="M24 48 H76" stroke="#E33E3F" strokeWidth="4" />
                      {/* Distinctive double vertical straps of Backpack wallet logo */}
                      <rect x="34" y="42" width="6.5" height="24" rx="3.25" fill="#E33E3F" />
                      <rect x="59" y="42" width="6.5" height="24" rx="3.25" fill="#E33E3F" />
                      {/* Cute strap buckles/studs */}
                      <circle cx="37.25" cy="54" r="2.2" fill="white" />
                      <circle cx="62.25" cy="54" r="2.2" fill="white" />
                    </svg>
                  ) : (
                    w.name[0]
                  )}
                </div>
                <span className="font-extrabold">{w.name}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div id="wallet-connected-view" className="space-y-4">
          {/* Public Key Display */}
          <div className="bg-emerald-900/40 p-3.5 rounded-2xl border-2 border-emerald-950 space-y-1.5 animate-fade-in">
            <div className="flex items-center justify-between text-[11px] text-emerald-300 font-bold tracking-wider">
              <span>DIRECCIÓN DE TU WALLET ({selectedWalletName})</span>
              <div className="flex items-center gap-3">
                {!isEditingAddress ? (
                  <>
                    <button
                      type="button"
                      id="edit-address-btn"
                      onClick={handleStartEdit}
                      className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 transition-colors font-bold uppercase text-[9px] cursor-pointer"
                      title="Modificar llave pública"
                    >
                      <Edit2 className="w-3" />
                      <span>Modificar</span>
                    </button>
                    <button
                      id="copy-address-btn"
                      onClick={() => handleCopyBase(wallet.publicKey)}
                      className="flex items-center gap-1 text-yellow-400 hover:text-yellow-300 transition-colors font-bold uppercase text-[9px] cursor-pointer"
                      title="Copiar llave pública"
                    >
                      {copied ? <Check className="w-3" /> : <Copy className="w-3" />}
                      <span>{copied ? "¡Copiado!" : "Copiar"}</span>
                    </button>
                  </>
                ) : (
                  <div className="flex items-center gap-3.5">
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="flex items-center gap-1 text-red-400 hover:text-red-300 transition-colors font-bold uppercase text-[9px] cursor-pointer"
                    >
                      <X className="w-3" />
                      <span>Cancelar</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveEdit}
                      className="flex items-center gap-1 text-yellow-400 hover:text-yellow-300 transition-colors font-bold uppercase text-[9px] cursor-pointer"
                    >
                      <Check className="w-3" />
                      <span>Guardar</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
            
            {!isEditingAddress ? (
              <div className="font-mono text-xs text-yellow-105 break-all select-all pr-2 font-bold leading-tight">
                {wallet.publicKey}
              </div>
            ) : (
              <div className="flex items-center gap-2 w-full mt-1">
                <input
                  type="text"
                  value={editedAddress}
                  onChange={(e) => setEditedAddress(e.target.value)}
                  className="w-full bg-emerald-950 border-2 border-emerald-800 rounded-xl px-2.5 py-1.5 font-mono text-xs text-yellow-105 font-bold outline-none focus:border-yellow-400 transition-all"
                  placeholder="Introduce tu dirección de Solana"
                  autoFocus
                />
              </div>
            )}
          </div>

          {/* Selector interactivo de Red Solana (Devnet vs Mainnet) */}
          <div id="solana-network-selector" className="bg-emerald-900/35 p-3.5 rounded-2xl border-2 border-emerald-900 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 animate-fade-in">
            <div className="flex items-center gap-2.5">
              <span className="flex h-3 w-3 relative">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${wallet.network === "mainnet" ? "bg-purple-400" : "bg-emerald-400"}`}></span>
                <span className={`relative inline-flex rounded-full h-3 w-3 ${wallet.network === "mainnet" ? "bg-purple-500" : "bg-emerald-500"}`}></span>
              </span>
              <div>
                <span className="text-[9px] text-emerald-400 font-black block leading-none uppercase tracking-widest">PROPUESTA DE RED</span>
                <span className="font-black text-xs text-white tracking-wide">
                  {wallet.network === "mainnet" ? "🔴 SOLANA MAINNET BETA" : "🟢 SOLANA DEVNET"}
                </span>
              </div>
            </div>

            <button
              type="button"
              id="toggle-network-btn"
              onClick={() => {
                const newNetwork = wallet.network === "mainnet" ? "devnet" : "mainnet";
                onChange({
                  ...wallet,
                  network: newNetwork,
                  balanceSol: newNetwork === "mainnet" ? 1.45 : 2.50,
                  balanceUsdc: newNetwork === "mainnet" ? 82.50 : 15.00,
                  balanceUsdt: newNetwork === "mainnet" ? 54.10 : 10.00
                });
              }}
              className={`text-[10px] px-3 py-1.5 rounded-xl font-black transition-all cursor-pointer uppercase ${
                wallet.network === "mainnet"
                  ? "bg-amber-400 hover:bg-amber-350 text-emerald-950 border border-amber-500 shadow-[2px_2px_0px_0px_rgba(217,119,6,1)]"
                  : "bg-purple-600 hover:bg-purple-500 text-white border border-purple-700 shadow-[2px_2px_0px_0px_rgba(88,28,135,1)]"
              }`}
            >
              Cambiar a {wallet.network === "mainnet" ? "Devnet" : "Mainnet"}
            </button>
          </div>

          {/* Balances Display */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-yellow-400/10 border-2 border-yellow-400/40 p-3.5 rounded-2xl flex flex-col justify-between shadow-[0_0_15px_rgba(234,179,8,0.1)] relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-8 h-8 bg-yellow-400/10 rounded-bl-xl flex items-center justify-center font-bold text-[10px] text-yellow-400">
                SOL
              </div>
              <span className="text-[9px] text-yellow-350 font-black uppercase tracking-wider">SALDO PRINCIPAL SOL</span>
              <span className="text-xl font-black text-yellow-400 font-mono mt-1.5 leading-none">
                {wallet.balanceSol} <span className="text-xs">SOL</span>
              </span>
              <span className="text-[9px] text-emerald-300 font-bold mt-1.5 font-mono">(~${(wallet.balanceSol * 180).toFixed(1)} USD)</span>
            </div>

            <div className="bg-white/10 border border-white/10 p-3.5 rounded-2xl flex flex-col justify-between">
              <span className="text-[9px] text-emerald-300 font-bold uppercase tracking-wider">SALDO USDC</span>
              <span className="text-lg font-black text-emerald-400 font-mono mt-1.5 leading-none">
                {wallet.balanceUsdc} <span className="text-xs">USDC</span>
              </span>
              <span className="text-[9px] text-emerald-400 font-bold mt-1.5">Dólar Estable</span>
            </div>

            <div className="bg-white/10 border border-white/10 p-3.5 rounded-2xl flex flex-col justify-between">
              <span className="text-[9px] text-emerald-300 font-bold uppercase tracking-wider">SALDO USDT</span>
              <span className="text-lg font-black text-teal-400 font-mono mt-1.5 leading-none">
                {wallet.balanceUsdt} <span className="text-xs font-sans">USDT</span>
              </span>
              <span className="text-[9px] text-emerald-400 font-bold mt-1.5">Tether SPL</span>
            </div>
          </div>

          {/* Solana Bootcamp VIP Discount Pass NFT Simulator */}
          <div className="border-2 border-emerald-800 bg-emerald-900/30 p-4 rounded-3xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex gap-2.5 items-start">
                <div className="w-10 h-10 bg-yellow-400 rounded-xl flex items-center justify-center text-emerald-950 text-xl font-bold mt-0.5 shrink-0">
                  🎫
                </div>
                <div>
                  <h4 className="text-sm font-black text-yellow-400 font-sans leading-snug">
                    Pase de Descuento SOLANA BOOTCAMP
                  </h4>
                  <p className="text-xs text-emerald-100 mt-1 leading-relaxed font-semibold">
                    Un NFT de comunidad en tu wallet que otorga un <b className="text-yellow-350">15% de descuento directo</b> en la pasarela de pago del huerto.
                  </p>
                </div>
              </div>

              <button
                id="toggle-vibe-pass-btn"
                onClick={toggleNftPass}
                className={`text-xs px-3 py-1.5 rounded-xl border-2 font-black transition-all shrink-0 cursor-pointer uppercase ${
                  wallet.hasVibePassNft
                    ? "bg-yellow-400 text-emerald-950 border-emerald-900 shadow-[2px_2px_0px_0px_rgba(6,78,59,1)]"
                    : "bg-emerald-900 text-emerald-300 border-emerald-700 hover:bg-emerald-800"
                }`}
              >
                {wallet.hasVibePassNft ? "✅ Poseído" : "Obtener Pase"}
              </button>
            </div>

            {wallet.hasVibePassNft && (
              <div className="mt-3 flex items-center gap-1.5 text-[11px] text-yellow-300 font-bold bg-emerald-900/50 px-2.5 py-1.5 rounded-lg border border-emerald-800">
                <ShieldCheck className="w-4 h-4 shrink-0 text-yellow-400 animate-pulse" />
                <span>¡La pasarela aplicará un -15% de descuento sobre el total SPL!</span>
              </div>
            )}
          </div>

          {/* Faucet */}
          <div className="flex justify-between items-center bg-emerald-950/50 p-2.5 rounded-lg border border-emerald-900/80">
            <span className="text-xs text-emerald-300 font-bold">¿Te quedaste sin saldo ficticio?</span>
            <button
              id="faucet-add-funds-btn"
              onClick={addFunds}
              className="bg-emerald-500 text-white font-black py-2 px-4 rounded-xl text-xs border-b-4 border-emerald-700 shadow-md hover:translate-y-0.5 transition-all text-center uppercase cursor-pointer"
            >
              🚀 Faucet (+1 SOL, +20 USDC)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
