/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import {
  Sprout,
  Coins,
  History,
  TrendingUp,
  Edit2,
  Check,
  ShoppingCart,
  Tags,
  BookOpen,
  Info,
  Calendar,
  Layers,
  Heart,
  Droplet,
  Sun,
  AlertCircle,
  Camera
} from "lucide-react";
import { Crop, WalletState, SolanaTransaction } from "./types";
import { PRESET_CROPS } from "./presetCrops";
import { PRESET_TRANSACTIONS } from "./presetTransactions";
import WalletSimulator from "./components/WalletSimulator";
import PlantScanner from "./components/PlantScanner";
import CheckoutGateway from "./components/CheckoutGateway";

// Imagen de respaldo (SVG en línea) que se muestra cuando una URL de imagen
// externa falla o ya no existe (404). Evita el ícono de "imagen rota".
const FALLBACK_IMAGE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" fill="#ecfdf5"/><g fill="none" stroke="#10b981" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"><path d="M80 116c0-28 16-48 44-52-4 28-20 44-44 52z"/><path d="M80 116c0-22-12-38-34-42 3 22 15 36 34 42z"/><path d="M80 122V92"/></g></svg>`
  );

// Reemplaza la imagen rota por el respaldo una sola vez (evita bucles de error).
const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
  const img = e.currentTarget;
  if (img.src !== FALLBACK_IMAGE) {
    img.src = FALLBACK_IMAGE;
  }
};

export default function App() {
  // Estado de los cultivos (inicializado desde localStorage o presetCrops)
  const [crops, setCrops] = useState<Crop[]>(() => {
    try {
      const saved = localStorage.getItem("solana_huerto_crops");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (err) {
      console.log("Error al cargar cultivos guardados:", err);
    }
    return PRESET_CROPS;
  });

  // Sincronizar cultivos con localStorage
  useEffect(() => {
    try {
      localStorage.setItem("solana_huerto_crops", JSON.stringify(crops));
    } catch (err) {}
  }, [crops]);

  // Estado de la Wallet de Solana
  const [wallet, setWallet] = useState<WalletState>({
    connected: false,
    publicKey: "",
    balanceSol: 0,
    balanceUsdc: 0,
    balanceUsdt: 0,
    hasVibePassNft: false,
    network: "devnet"
  });

  // Estado del listado de transacciones
  const [transactions, setTransactions] = useState<SolanaTransaction[]>(() => {
    try {
      const saved = localStorage.getItem("solana_huerto_txs");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (err) {
      console.log("Error cargando transacciones:", err);
    }
    return PRESET_TRANSACTIONS;
  });

  // Sincronizar transacciones con localStorage
  useEffect(() => {
    try {
      localStorage.setItem("solana_huerto_txs", JSON.stringify(transactions));
    } catch (err) {}
  }, [transactions]);

  // Chequeo de conexión del API de Gemini en el backend
  const [geminiConfigured, setGeminiConfigured] = useState(false);
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch("/api/health");
        const data = await res.json();
        setGeminiConfigured(!!data.geminiConfigured);
      } catch (err) {
        setGeminiConfigured(false);
      }
    };
    checkHealth();
  }, []);

  // UI States
  const [activeTab, setActiveTab] = useState<"inventario" | "mercado">("inventario");
  const [selectedCropForCheckout, setSelectedCropForCheckout] = useState<Crop | null>(null);
  const [detailCrop, setDetailCrop] = useState<Crop | null>(null);

  // Estados de edición de cultivos individuales
  const [editingCropId, setEditingCropId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPriceSol, setEditPriceSol] = useState(0);
  const [editStock, setEditStock] = useState(0);
  const [editImageUrl, setEditImageUrl] = useState("");

  // Estados para modificar la Ficha Técnica directamente
  const [isEditingDetail, setIsEditingDetail] = useState(false);
  const [editDetailName, setEditDetailName] = useState("");
  const [editDetailSci, setEditDetailSci] = useState("");
  const [editDetailOrigin, setEditDetailOrigin] = useState("");
  const [editDetailDesc, setEditDetailDesc] = useState("");
  const [editDetailUses, setEditDetailUses] = useState("");
  const [editDetailSunlight, setEditDetailSunlight] = useState("");
  const [editDetailWater, setEditDetailWater] = useState("");
  const [editDetailHarvest, setEditDetailHarvest] = useState("");
  const [editDetailCare, setEditDetailCare] = useState("");
  const [editDetailNotes, setEditDetailNotes] = useState("");

  const startEditingDetail = (crop: Crop) => {
    setIsEditingDetail(true);
    setEditDetailName(crop.name || "");
    setEditDetailSci(crop.scientificName || "");
    setEditDetailOrigin(crop.origin || "");
    setEditDetailDesc(crop.description || "");
    setEditDetailUses(crop.uses || "");
    setEditDetailSunlight(crop.sunlight || "");
    setEditDetailWater(crop.waterRequirements || "");
    setEditDetailHarvest(crop.harvestTime || "");
    setEditDetailCare(crop.careLevel || "Fácil");
    setEditDetailNotes(crop.notes || "");
  };

  const saveDetailChanges = () => {
    if (!detailCrop) return;

    const newName = editDetailName.trim() || detailCrop.name;

    const updatedCrops = crops.map((c) => {
      if (c.id === detailCrop.id) {
        return {
          ...c,
          name: newName,
          scientificName: editDetailSci.trim(),
          origin: editDetailOrigin.trim(),
          description: editDetailDesc.trim(),
          uses: editDetailUses.trim(),
          sunlight: editDetailSunlight.trim(),
          waterRequirements: editDetailWater.trim(),
          harvestTime: editDetailHarvest.trim(),
          careLevel: editDetailCare,
          notes: editDetailNotes.trim(),
        };
      }
      return c;
    });

    setCrops(updatedCrops);
    try {
      localStorage.setItem("bootcamp_crops", JSON.stringify(updatedCrops));
    } catch (err) {}

    setDetailCrop({
      ...detailCrop,
      name: newName,
      scientificName: editDetailSci.trim(),
      origin: editDetailOrigin.trim(),
      description: editDetailDesc.trim(),
      uses: editDetailUses.trim(),
      sunlight: editDetailSunlight.trim(),
      waterRequirements: editDetailWater.trim(),
      harvestTime: editDetailHarvest.trim(),
      careLevel: editDetailCare,
      notes: editDetailNotes.trim(),
    });

    setIsEditingDetail(false);
    showToast("¡Ficha técnica guardada con éxito!", "success");
  };



  // Custom Confirm Dialog State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
    isDanger?: boolean;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  const triggerConfirm = (
    title: string,
    message: string,
    onConfirm: () => void,
    isDanger: boolean = false,
    confirmText: string = "Confirmar",
    cancelText: string = "Cancelar"
  ) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      },
      confirmText,
      cancelText,
      isDanger
    });
  };

  // Custom Toast State
  const [toast, setToast] = useState<{
    id: string;
    message: string;
    type: "success" | "info" | "error";
  } | null>(null);

  const showToast = (message: string, type: "success" | "info" | "error" = "success") => {
    const id = Math.random().toString();
    setToast({ id, message, type });
    setTimeout(() => {
      setToast((current) => {
        if (current?.id === id) {
          return null;
        }
        return current;
      });
    }, 4000);
  };

  const resetAllCrops = () => {
    triggerConfirm(
      "Restablecer Biblioteca",
      "¿Estás seguro de que deseas restablecer tu biblioteca a los cultivos sugeridos inicialmente? Esto eliminará tus cultivos personalizados.",
      () => {
        setCrops(PRESET_CROPS);
        showToast("🔄 Biblioteca restablecida con éxito.", "info");
      },
      true,
      "Restablecer"
    );
  };

  const clearTransactions = () => {
    triggerConfirm(
      "Vaciar Historial",
      "¿Deseas vaciar el historial de recibos de Solana Pay de forma definitiva?",
      () => {
        setTransactions([]);
        showToast("🧹 Historial de transacciones vaciado.", "info");
      },
      true,
      "Vaciar Historial"
    );
  };

  // Agregar planta escaneada exitosamente por Gemini / Simulador
  const handleScanComplete = (newCrop: Crop) => {
    // Al escanear una planta, se agrega de primera en la lista de cultivos
    setCrops((prev) => [newCrop, ...prev]);
    setDetailCrop(newCrop);
    showToast(`🌿 ¡Cultivo "${newCrop.name}" identificado y agregado a tu biblioteca!`, "success");
  };



  // Modificar stock, precio o nombre de un cultivo en tu inventario
  const startEditing = (crop: Crop) => {
    setEditingCropId(crop.id);
    setEditName(crop.name || "");
    setEditPriceSol(crop.priceSol || 0);
    setEditStock(crop.stock || 0);
    setEditImageUrl(crop.imageUrl || "");
  };

  const saveEditing = (cropId: string) => {
    let affectedCropName = "";
    setCrops((prev) =>
      prev.map((c) => {
        if (c.id === cropId) {
          affectedCropName = editName.trim() || c.name;
          const usdEquivalent = editPriceSol * 180;
          return {
            ...c,
            name: editName.trim() || c.name,
            priceSol: +editPriceSol.toFixed(4),
            priceUsdc: +usdEquivalent.toFixed(2) || 1.0,
            priceUsdt: +usdEquivalent.toFixed(2) || 1.0,
            stock: editStock,
            imageUrl: editImageUrl.trim() || c.imageUrl
          };
        }
        return c;
      })
    );
    setEditingCropId(null);
    setDetailCrop((prev) => {
      if (prev && prev.id === cropId) {
        return {
          ...prev,
          name: editName.trim() || prev.name,
          priceSol: +editPriceSol.toFixed(4),
          priceUsdc: +(editPriceSol * 180).toFixed(2) || 1.0,
          priceUsdt: +(editPriceSol * 180).toFixed(2) || 1.0,
          stock: editStock,
          imageUrl: editImageUrl.trim() || prev.imageUrl
        };
      }
      return prev;
    });
    showToast(`💾 Valores actualizados para "${affectedCropName}".`, "success");
  };

  // Alternar el estado de poner en venta o quitar un cultivo del mercado
  const toggleSaleState = (cropId: string) => {
    setCrops((prev) =>
      prev.map((c) => {
        if (c.id === cropId) {
          return { ...c, isForSale: !c.isForSale };
        }
        return c;
      })
    );
  };

  const deleteCrop = (cropId: string) => {
    const cropToDelete = crops.find((c) => c.id === cropId);
    triggerConfirm(
      "Eliminar Cultivo",
      `¿Estás seguro de que deseas eliminar el cultivo "${cropToDelete?.name || ""}" de tu biblioteca?`,
      () => {
        setCrops((prev) => prev.filter((c) => c.id !== cropId));
        if (detailCrop?.id === cropId) {
          setDetailCrop(null);
        }
        showToast(`🗑️ El cultivo "${cropToDelete?.name || ""}" ha sido eliminado de tu inventario.`, "info");
      },
      true,
      "Eliminar"
    );
  };

  // El comprador completó con éxito el pago en Solana Pay
  const handlePaymentSuccess = (tx: SolanaTransaction) => {
    // 1. Agregar transacción al ledger histórico
    setTransactions((prev) => [tx, ...prev]);

    // 2. Descontar stock del cultivo correspondiente
    setCrops((prev) =>
      prev.map((c) => {
        if (c.id === tx.cropId) {
          const updatedStock = Math.max(0, c.stock - tx.quantity);
          return { ...c, stock: updatedStock };
        }
        return c;
      })
    );

    // 3. Debitar el saldo correspondiente de la wallet conectada del comprador
    setWallet((prev) => {
      let updatedSol = prev.balanceSol;
      let updatedUsdc = prev.balanceUsdc;
      let updatedUsdt = prev.balanceUsdt;

      if (tx.tokenUsed === "SOL") {
        updatedSol = +(prev.balanceSol - tx.totalAmountPaid).toFixed(4);
      } else if (tx.tokenUsed === "USDC") {
        updatedUsdc = +(prev.balanceUsdc - tx.totalAmountPaid).toFixed(2);
      } else if (tx.tokenUsed === "USDT") {
        updatedUsdt = +(prev.balanceUsdt - tx.totalAmountPaid).toFixed(2);
      }

      return {
        ...prev,
        balanceSol: updatedSol,
        balanceUsdc: updatedUsdc,
        balanceUsdt: updatedUsdt
      };
    });

    // 4. Si el detalle actual de la planta es este, refrescar stock
    if (detailCrop && detailCrop.id === tx.cropId) {
      setDetailCrop((prev) => {
        if (!prev) return null;
        return { ...prev, stock: Math.max(0, prev.stock - tx.quantity) };
      });
    }

    // Mostrar un toast exitoso de compra real en el huerto
    showToast(`💸 ¡Transacción confirmada! Compraste ${tx.quantity} ración(es) de ${tx.cropName}.`, "success");
  };

  // Calcular el total vendido en dólares (SOL * $180) para el contador
  const totalVolumeUsd = transactions.reduce((sum, t) => {
    if (t.tokenUsed === "SOL") {
      return sum + t.totalAmountPaid * 180;
    }
    return sum + t.totalAmountPaid;
  }, 0);

  return (
    <div id="full-app-container" className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans pb-16 antialiased">
      
      {/* Barra de Navegación Simple y Elegante */}
      <nav id="app-nav" className="bg-white border-b border-slate-200/80 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-600/10 text-emerald-700 p-2 rounded-xl">
              <Sprout className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h1 className="text-base font-extrabold text-slate-900 tracking-tight font-sans">
                Huerto Scan &amp; Solana Pay
              </h1>
              <p className="text-[10px] text-slate-500 font-medium tracking-wide flex items-center gap-1 uppercase font-mono">
                Solana Vibe Bootcamp
                <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded text-[8px] font-bold">
                  BETA BUILD
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex text-right flex-col">
              <span className="text-xs text-slate-500 font-mono">ESTADO CLUSTER</span>
              <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1 justify-end">
                <Check className="w-3" /> Solana Devnet Online
              </span>
            </div>
          </div>
        </div>
      </nav>

      {/* Grid del Contenedor Principal */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        


        {/* Fila de Tarjetas con Métricas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white border border-slate-200/60 p-4 rounded-2xl shadow-2xs flex items-center gap-4">
            <div className="bg-emerald-500/10 text-emerald-600 p-3 rounded-xl">
              <Sprout className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-slate-400 block font-mono font-bold tracking-wider">CULTIVOS IDENTIFICADOS</span>
              <span className="text-xl font-black text-slate-800 font-mono">
                {crops.length} especies
              </span>
            </div>
          </div>

          <div className="bg-white border border-slate-200/60 p-4 rounded-2xl shadow-2xs flex items-center gap-4">
            <div className="bg-indigo-500/10 text-indigo-600 p-3 rounded-xl">
              <Coins className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-slate-400 block font-mono font-bold tracking-wider">WALLET DE SOLANA</span>
              <span className="text-xs font-semibold text-slate-700 font-sans">
                {wallet.connected ? (
                  <span className="text-emerald-600 font-mono font-bold break-all">
                    {wallet.publicKey.substring(0, 6)}...{wallet.publicKey.slice(-6)}
                  </span>
                ) : (
                  <span className="text-slate-400">Desconectada</span>
                )}
              </span>
            </div>
          </div>

          <div className="bg-white border border-slate-200/60 p-4 rounded-2xl shadow-2xs flex items-center gap-4">
            <div className="bg-teal-500/10 text-teal-600 p-3 rounded-xl">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-slate-400 block font-mono font-bold tracking-wider">VOLUMEN VENTAS SOLANA</span>
              <span className="text-xl font-black text-slate-800 font-mono text-teal-600">
                ${totalVolumeUsd.toFixed(2)} <span className="text-xs text-slate-400">USD</span>
              </span>
            </div>
          </div>
        </div>

        {/* Dashboard Dividido en Columnas */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Columna Izquierda (Herramientas y Acciones): 5 de 12 columnas */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Simulador de Wallet Criptográfica */}
            <WalletSimulator wallet={wallet} onChange={setWallet} />

            {/* Escáner de Plantas con Inteligencia Artificial */}
            <PlantScanner onScanComplete={handleScanComplete} geminiConfigured={geminiConfigured} />

            {/* Historial de Transacciones de Solana (Ledger) */}
            <div className="bg-white border border-slate-200/60 rounded-2xl p-5 shadow-2xs space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <h3 className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                  <History className="w-4 h-4 text-slate-500" />
                  Registro de Pagos (Solana Ledger)
                </h3>
                {transactions.length > 0 && (
                  <button
                    id="clear-txs-btn"
                    onClick={clearTransactions}
                    className="text-[10px] text-rose-500 hover:text-rose-600 font-bold"
                  >
                    Borrar Registros
                  </button>
                )}
              </div>

              {transactions.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">
                  Aún no se han ejecutado transacciones SPL sobre este huerto.
                </p>
              ) : (
                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                  {transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="bg-slate-50 p-3 rounded-xl border border-slate-200/60 font-mono text-xs space-y-1"
                    >
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-slate-500">{new Date(tx.timestamp).toLocaleTimeString()}</span>
                        <span className="text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-100 uppercase">
                          Exitoso
                        </span>
                      </div>
                      <div className="font-sans font-bold text-slate-800">
                        {tx.cropName} (x{tx.quantity})
                      </div>
                      <div className="flex justify-between text-[11px] font-bold text-slate-600 pt-1">
                        <span>Pago:</span>
                        <span className="text-indigo-600 font-mono">
                          {tx.totalAmountPaid} {tx.tokenUsed}
                        </span>
                      </div>
                      <div className="text-[9px] text-slate-400 break-all select-all font-mono leading-tight bg-white p-1 rounded border border-slate-100">
                        TX: {tx.signature.substring(0, 20)}...
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Columna Derecha: Biblioteca de cultivos y vitrina para el comprador: 7 de 12 columnas */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Cabecera y Tabs */}
            <div className="bg-white border border-slate-200/60 rounded-2xl p-4 shadow-2xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex gap-2">
                  <button
                    id="tab-inventory"
                    onClick={() => setActiveTab("inventario")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      activeTab === "inventario"
                        ? "bg-slate-900 text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <BookOpen className="w-4 h-4" />
                    Mi Inventario de Cultivos
                  </button>
                  <button
                    id="tab-market"
                    onClick={() => setActiveTab("mercado")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      activeTab === "mercado"
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <ShoppingCart className="w-4 h-4" />
                    Mercado para la Comunidad
                  </button>
                </div>

              </div>

              {/* Contenido según la pestaña */}
              <div className="mt-4">
                
                {activeTab === "inventario" ? (
                  /* VISTA INVENTARIO DEL SELLERS (HUERTANO) */
                  <div className="space-y-4">
                    <div className="flex justify-between items-center text-xs text-slate-500 pb-1">
                      <span>Organiza e inicializa los precios en SOL de tus cosechas cultivadas.</span>
                      <span>Total: {crops.length}</span>
                    </div>

                    {crops.length === 0 ? (
                      <div className="text-center py-10 bg-slate-50/50 rounded-xl border border-slate-100">
                        <p className="text-xs text-slate-500">
                          Tu inventario está vacío. Usa el escáner de arriba para identificar una planta.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {crops.map((crop) => (
                          <div
                            key={crop.id}
                            id={`crop-row-${crop.id}`}
                            className="bg-slate-50/50 border border-slate-200/60 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-start items-stretch md:items-center justify-between hover:bg-slate-50 transition-colors"
                          >
                            <div className="flex gap-3 items-center min-w-0 flex-1">
                              {editingCropId === crop.id ? (
                                <div className="relative group shrink-0 w-16 h-16 rounded-xl overflow-hidden bg-slate-100 border border-slate-300 shadow-inner flex items-center justify-center">
                                  <img
                                    src={editImageUrl || "https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?auto=format&fit=crop&q=80&w=400"}
                                    alt={editName || crop.name}
                                    referrerPolicy="no-referrer"
                                    onError={handleImageError}
                                    className="w-full h-full object-cover"
                                  />
                                  <label className="absolute inset-0 bg-slate-900/60 flex flex-col items-center justify-center cursor-pointer opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity text-white" title="Subir foto">
                                    <Camera className="w-4 h-4 mb-0.5" />
                                    <span className="text-[7px] font-black uppercase tracking-wider text-center px-1">Subir</span>
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                          const reader = new FileReader();
                                          reader.onload = (event) => {
                                            const img = new Image();
                                            img.onload = () => {
                                              const maxDimension = 300;
                                              let width = img.width;
                                              let height = img.height;
                                              if (width > maxDimension || height > maxDimension) {
                                                if (width > height) {
                                                  height = Math.round((height * maxDimension) / width);
                                                  width = maxDimension;
                                                } else {
                                                  width = Math.round((width * maxDimension) / height);
                                                  height = maxDimension;
                                                }
                                              }
                                              const canvas = document.createElement("canvas");
                                              canvas.width = width;
                                              canvas.height = height;
                                              const ctx = canvas.getContext("2d");
                                              if (ctx) {
                                                ctx.drawImage(img, 0, 0, width, height);
                                                const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
                                                setEditImageUrl(dataUrl);
                                              } else {
                                                setEditImageUrl(event.target?.result as string);
                                              }
                                            };
                                            img.src = event.target?.result as string;
                                          };
                                          reader.readAsDataURL(file);
                                        }
                                      }}
                                    />
                                  </label>
                                </div>
                              ) : (
                                crop.imageUrl && (
                                  <img
                                    src={crop.imageUrl}
                                    alt={crop.name}
                                    referrerPolicy="no-referrer"
                                    onError={handleImageError}
                                    className="w-16 h-16 rounded-xl object-cover shrink-0"
                                  />
                                )
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {editingCropId === crop.id ? (
                                    <div className="flex flex-col sm:flex-row gap-2">
                                      <div className="flex flex-col gap-0.5">
                                        <label className="text-[8px] text-slate-400 font-mono uppercase font-bold">Modificar Nombre</label>
                                        <input
                                          type="text"
                                          value={editName}
                                          onChange={(e) => setEditName(e.target.value)}
                                          className="text-xs font-bold border border-slate-300 rounded px-2 py-1 bg-white text-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden min-w-[150px]"
                                          placeholder="Nombre del cultivo"
                                        />
                                      </div>
                                      <div className="flex flex-col gap-0.5">
                                        <label className="text-[8px] text-slate-400 font-mono uppercase font-bold">Enlace o URL de Imagen</label>
                                        <input
                                          type="text"
                                          value={editImageUrl}
                                          onChange={(e) => setEditImageUrl(e.target.value)}
                                          className="text-xs border border-slate-300 rounded px-2 py-1 bg-white text-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden min-w-[180px] font-mono text-[10px]"
                                          placeholder="Pegar URL de la imagen o subir de la izquierda"
                                        />
                                      </div>
                                    </div>
                                  ) : (
                                    <h4 className="font-bold text-xs text-slate-800 truncate">{crop.name}</h4>
                                  )}
                                  <span className="text-[9px] font-sans italic text-slate-400 font-mono truncate mt-auto">
                                    {crop.scientificName}
                                  </span>
                                  <span
                                    className={`px-1.5 py-0.2 rounded text-[8px] font-bold mt-auto ${
                                      crop.careLevel === "Fácil"
                                        ? "bg-green-50 text-green-700"
                                        : crop.careLevel === "Moderado"
                                        ? "bg-orange-50 text-orange-700"
                                        : "bg-red-50 text-red-700"
                                    }`}
                                  >
                                    {crop.careLevel}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                                  {crop.description}
                                </p>
                                <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-400 font-mono">
                                  <span>Precio: {crop.priceSol} SOL</span>
                                  <span>•</span>
                                  <span>Stock: {crop.stock} raciones</span>
                                </div>
                              </div>
                            </div>

                            {/* Controles de Configuración del Cultivo */}
                            <div className="flex items-center gap-2 shrink-0 justify-end flex-wrap border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
                              {editingCropId === crop.id ? (
                                <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
                                  <div className="w-18">
                                    <label className="block text-[8px] text-slate-400 font-mono">SOL</label>
                                    <input
                                      type="number"
                                      step="0.001"
                                      value={editPriceSol}
                                      onChange={(e) => setEditPriceSol(Math.max(0, parseFloat(e.target.value) || 0))}
                                      className="w-full text-xs font-mono font-bold text-slate-700 focus:outline-hidden"
                                    />
                                  </div>
                                  <div className="w-12">
                                    <label className="block text-[8px] text-slate-400 font-mono">STOCK</label>
                                    <input
                                      type="number"
                                      value={editStock}
                                      onChange={(e) => setEditStock(Math.max(0, parseInt(e.target.value) || 0))}
                                      className="w-full text-xs font-mono font-bold text-slate-700 focus:outline-hidden"
                                    />
                                  </div>
                                  <button
                                    id={`save-editing-${crop.id}`}
                                    onClick={() => saveEditing(crop.id)}
                                    className="p-1 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 shadow-sm cursor-pointer"
                                  >
                                    <Check className="w-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <button
                                    id={`edit-crop-${crop.id}`}
                                    onClick={() => startEditing(crop)}
                                    className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                    title="Modificar precio & stock"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>

                                  <button
                                    id={`toggle-sale-crop-${crop.id}`}
                                    onClick={() => toggleSaleState(crop.id)}
                                    className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                      crop.isForSale
                                        ? "bg-slate-900 hover:bg-slate-800 text-white"
                                        : "bg-slate-200/70 hover:bg-slate-200 text-slate-600"
                                    }`}
                                  >
                                    {crop.isForSale ? "Puesto En Venta" : "Borrador"}
                                  </button>
                                </>
                              )}

                              <button
                                id={`detail-crop-${crop.id}`}
                                onClick={() => setDetailCrop(crop)}
                                className="px-2.5 py-1.5 rounded-lg text-[11px] border border-slate-200 hover:bg-slate-100 text-slate-600 font-medium transition-all cursor-pointer"
                              >
                                Ficha Técnica
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  /* VISTA VITRINA PARA EL COMPRADOR DE LA COMUNIDAD */
                  <div className="space-y-4">
                    <p className="text-xs text-slate-500 pb-1">
                      Vitrina de hortalisas orgánicas disponibles de la granja comunitaria. Puedes comprar de forma instantánea abonando tokens SPL en la blockchain Solana Devnet.
                    </p>

                    {crops.filter((c) => c.isForSale && c.stock > 0).length === 0 ? (
                      <div className="text-center py-10 bg-slate-50/50 rounded-xl border border-slate-100">
                        <p className="text-xs text-slate-500">
                          No hay cultivos para la venta en este momento, o bien no tienen stock asignado.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {crops
                          .filter((c) => c.isForSale && c.stock > 0)
                          .map((crop) => (
                            <div
                              key={crop.id}
                              id={`market-card-${crop.id}`}
                              className="bg-white border border-slate-200/60 rounded-2xl overflow-hidden hover:shadow-xs transition-shadow flex flex-col justify-between"
                            >
                              {crop.imageUrl && (
                                <div className="h-40 w-full relative">
                                  <img
                                    src={crop.imageUrl}
                                    alt={crop.name}
                                    referrerPolicy="no-referrer"
                                    onError={handleImageError}
                                    className="w-full h-full object-cover"
                                  />
                                  <span className="absolute top-2 right-2 bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase shadow-xs">
                                    En Stock ({crop.stock})
                                  </span>
                                </div>
                              )}

                              <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                                <div className="space-y-1">
                                  <div className="flex items-start justify-between gap-2">
                                    <h4 className="font-bold text-sm text-slate-800 leading-tight">
                                      {crop.name}
                                    </h4>
                                    <span className="text-[10px] text-slate-400 font-mono italic whitespace-nowrap">
                                      {crop.scientificName}
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-500 line-clamp-2">
                                    {crop.description}
                                  </p>
                                </div>

                                <div className="border-t border-slate-100 pt-2.5 mt-2 space-y-3">
                                  {/* Mostrar opciones de precio equivalente SPL */}
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-slate-400 font-medium">Precios Solana Pay:</span>
                                    <div className="flex flex-col text-right font-mono text-[11px] font-bold text-slate-700">
                                      <span className="text-indigo-600">{crop.priceSol} SOL</span>
                                      <span className="text-emerald-600">${crop.priceUsdc} USDC</span>
                                    </div>
                                  </div>

                                  <div className="flex gap-2">
                                    <button
                                      id={`buy-solana-btn-${crop.id}`}
                                      onClick={() => setSelectedCropForCheckout(crop)}
                                      className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 shadow-sm"
                                    >
                                      <ShoppingCart className="w-3.5 h-3.5" />
                                      Comprar ahora
                                    </button>
                                    <button
                                      id={`quick-info-${crop.id}`}
                                      onClick={() => setDetailCrop(crop)}
                                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium py-2 px-3 rounded-xl transition-colors cursor-pointer"
                                    >
                                      Detalle
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Ficha Técnica Detallada - Popover o Panel Dinámico al fondo */}
            {detailCrop && (
              <div
                id="technical-crop-card"
                className="bg-white border border-slate-200/60 rounded-2xl p-6 shadow-sm space-y-4 animate-in fade-in slide-in-from-bottom-5 duration-200"
              >
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-3">
                  <div className="flex gap-3 items-center">
                    <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-700">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block">
                        FICHA CIENTÍFICA Y GUÍA DE CULTIVO
                      </span>
                      {isEditingDetail ? (
                        <input
                          type="text"
                          value={editDetailName}
                          onChange={(e) => setEditDetailName(e.target.value)}
                          className="font-bold text-base text-slate-800 bg-slate-50 border border-slate-305 rounded px-2 py-0.5"
                          placeholder="Nombre del Cultivo"
                        />
                      ) : (
                        <h3 className="font-bold text-base text-slate-800">
                          {detailCrop.name}
                        </h3>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto justify-end">
                    {isEditingDetail ? (
                      <>
                        <button
                          onClick={saveDetailChanges}
                          className="text-xs text-white bg-emerald-650 hover:bg-emerald-700 px-3.5 py-1.5 rounded-lg border border-emerald-950 shadow-[2px_2px_0px_0px_rgba(6,78,59,1)] active:translate-y-0.5 transition-all cursor-pointer font-black uppercase"
                        >
                          Guardar Ficha
                        </button>
                        <button
                          onClick={() => setIsEditingDetail(false)}
                          className="text-xs text-slate-500 hover:text-slate-800 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200 cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => startEditingDetail(detailCrop)}
                          className="text-xs text-indigo-600 hover:text-white bg-indigo-50 hover:bg-indigo-600 px-3 py-1.5 rounded-lg border border-indigo-250 cursor-pointer transition-all flex items-center gap-1 font-bold"
                        >
                          Editar Ficha
                        </button>
                        <button
                          id="close-detail-crop-btn"
                          onClick={() => {
                            setDetailCrop(null);
                            setIsEditingDetail(false);
                          }}
                          className="text-xs text-slate-500 hover:text-slate-805 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200 cursor-pointer"
                        >
                          Ocultar Ficha
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {isEditingDetail ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                          Nombre Científico Exacto
                        </label>
                        <input
                          type="text"
                          value={editDetailSci}
                          onChange={(e) => setEditDetailSci(e.target.value)}
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 font-serif"
                          placeholder="p.ej. Solanum lycopersicum"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                          Origen e Historia de Difusión
                        </label>
                        <textarea
                          rows={2}
                          value={editDetailOrigin}
                          onChange={(e) => setEditDetailOrigin(e.target.value)}
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 leading-relaxed"
                          placeholder="p.ej. América del Sur (Andes)..."
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                          Descripción o Características del Cultivo
                        </label>
                        <textarea
                          rows={3}
                          value={editDetailDesc}
                          onChange={(e) => setEditDetailDesc(e.target.value)}
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 leading-relaxed"
                          placeholder="Detalles morfológicos..."
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                          Propiedades Principales (¿Para qué sirve?)
                        </label>
                        <textarea
                          rows={2}
                          value={editDetailUses}
                          onChange={(e) => setEditDetailUses(e.target.value)}
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 leading-relaxed"
                          placeholder="Usos medicinales o culinarios..."
                        />
                      </div>

                      <div className="bg-emerald-50/50 border border-emerald-100 p-3 rounded-xl space-y-2">
                        <span className="block text-[10px] font-black text-emerald-800 uppercase tracking-wide">
                          Guía de Cuidado Doméstico
                        </span>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-[10px] text-slate-500 block mb-0.5">Luz Solar:</span>
                            <input
                              type="text"
                              value={editDetailSunlight}
                              onChange={(e) => setEditDetailSunlight(e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded p-1 text-[11px]"
                            />
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 block mb-0.5">Riego:</span>
                            <input
                              type="text"
                              value={editDetailWater}
                              onChange={(e) => setEditDetailWater(e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded p-1 text-[11px]"
                            />
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 block mb-0.5">Tiempo Cosecha:</span>
                            <input
                              type="text"
                              value={editDetailHarvest}
                              onChange={(e) => setEditDetailHarvest(e.target.value)}
                              className="w-full bg-white border border-slate-250 rounded p-1 text-[11px]"
                            />
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 block mb-0.5">Dificultad:</span>
                            <select
                              value={editDetailCare}
                              onChange={(e) => setEditDetailCare(e.target.value)}
                              className="w-full bg-white border border-slate-250 rounded p-1 text-[11px] block"
                            >
                              <option value="Fácil">Fácil</option>
                              <option value="Moderado">Moderado</option>
                              <option value="Difícil">Difícil</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                          Nota Adicional de tu Hortaliza
                        </label>
                        <input
                          type="text"
                          value={editDetailNotes}
                          onChange={(e) => setEditDetailNotes(e.target.value)}
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 italic"
                          placeholder="p.ej. Cultivada sin fertilizantes químicos."
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                      <div className="space-y-4">
                        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                            Nombre Científico Exacto
                          </span>
                          <span className="block text-xs font-serif font-semibold italic text-slate-700 mt-1">
                            {detailCrop.scientificName}
                          </span>
                        </div>

                        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 space-y-1">
                          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                            Origen e Historia de Difusión
                          </span>
                          <p className="text-xs text-slate-600 leading-relaxed font-sans">
                            {detailCrop.origin}
                          </p>
                        </div>

                        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 space-y-1">
                          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                            Descripción Genética / Silueta
                          </span>
                          <p className="text-xs text-slate-600 leading-relaxed font-sans">
                            {detailCrop.description || "Sin descripción registrada."}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 space-y-1">
                          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                            Propiedades Principales (¿Para qué sirve?)
                          </span>
                          <p className="text-xs text-slate-600 leading-relaxed font-sans">
                            {detailCrop.uses}
                          </p>
                        </div>

                        {/* Tarjeta de Guía de Cultivo */}
                        <div className="bg-emerald-50/50 border border-emerald-200/50 p-4 rounded-xl space-y-3">
                          <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wider font-sans">
                            Guía de Cuidado Doméstico
                          </h4>
                          
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="space-y-0.5">
                              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                <Sun className="w-3" /> Luz Solar:
                              </span>
                              <span className="font-semibold text-slate-700 block">{detailCrop.sunlight}</span>
                            </div>
                            <div className="space-y-0.5">
                              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                <Droplet className="w-3" /> Frecuencia Riego:
                              </span>
                              <span className="font-semibold text-slate-700 block">{detailCrop.waterRequirements}</span>
                            </div>
                            <div className="space-y-0.5 mt-2">
                              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                <Calendar className="w-3" /> Tiempo Cosecha:
                              </span>
                              <span className="font-semibold text-slate-700 block">{detailCrop.harvestTime}</span>
                            </div>
                            <div className="space-y-0.5 mt-2">
                              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                <Layers className="w-3" /> Dificultad:
                              </span>
                              <span className="font-semibold text-slate-700 block">{detailCrop.careLevel}</span>
                            </div>
                          </div>
                        </div>

                        {/* Precios de Referencia del Mercado */}
                        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 space-y-1">
                          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                            Precios Sugeridos por IA (Libre de Químicos)
                          </span>
                          <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
                            <div className="bg-white p-2 rounded-lg border border-slate-100">
                              <span className="text-[9px] text-slate-400 block pb-0.5">Ref. SOL</span>
                              <span className="font-bold text-indigo-600 block">{detailCrop.recommendedPriceSol} SOL</span>
                            </div>
                            <div className="bg-white p-2 rounded-lg border border-slate-100">
                              <span className="text-[9px] text-slate-400 block pb-0.5">Ref. USDC</span>
                              <span className="font-bold text-emerald-600 block">${detailCrop.recommendedPriceUsdc}</span>
                            </div>
                            <div className="bg-white p-2 rounded-lg border border-slate-100">
                              <span className="text-[9px] text-slate-400 block pb-0.5">Ref. USDT</span>
                              <span className="font-bold text-teal-600 block">${detailCrop.recommendedPriceUsdt}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {detailCrop.notes && (
                      <div className="text-xs text-slate-500 bg-slate-50/50 p-3 rounded-lg flex items-start gap-2 italic">
                        <Heart className="w-4 h-4 shrink-0 mt-0.5 text-rose-500 fill-rose-500/10" />
                        <span>Nota del cultivador: "{detailCrop.notes}"</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Cajón de Pago de Solana Pay */}
      {selectedCropForCheckout && (
        <CheckoutGateway
          crop={selectedCropForCheckout}
          wallet={wallet}
          onClose={() => setSelectedCropForCheckout(null)}
          onPaymentSuccess={handlePaymentSuccess}
        />
      )}

      {/* Custom Confirmation Modal */}
      {confirmModal.isOpen && (
        <div id="custom-confirm-overlay" className="fixed inset-0 bg-emerald-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div id="custom-confirm-dialog" className="bg-white border-4 border-emerald-500 rounded-[32px] w-full max-w-sm p-6 shadow-2xl relative text-emerald-950 animate-in zoom-in-95 duration-150">
            <h3 className="font-sans font-black text-lg text-emerald-900 mb-2 uppercase tracking-tight">
              {confirmModal.title}
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed font-bold mb-6">
              {confirmModal.message}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                id="confirm-modal-cancel-btn"
                onClick={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
                className="text-xs text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 px-4 py-2.5 rounded-xl border border-slate-200 font-bold transition-all cursor-pointer"
              >
                {confirmModal.cancelText || "Cancelar"}
              </button>
              <button
                id="confirm-modal-ok-btn"
                onClick={confirmModal.onConfirm}
                className={`text-xs text-white font-black uppercase px-5 py-2.5 rounded-xl border-2 transition-all cursor-pointer ${
                  confirmModal.isDanger
                    ? "bg-red-500 hover:bg-red-650 border-emerald-950 shadow-[3px_3px_0px_0px_rgba(6,78,59,1)] active:translate-y-0.5"
                    : "bg-emerald-500 hover:bg-emerald-600 border-emerald-950 shadow-[3px_3px_0px_0px_rgba(6,78,59,1)] active:translate-y-0.5"
                }`}
              >
                {confirmModal.confirmText || "Aceptar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Toast Alert */}
      {toast && (
        <div
          id="custom-toast"
          className="fixed bottom-6 right-6 z-50 max-w-xs sm:max-w-md bg-emerald-950 border-4 border-emerald-500 text-white rounded-2xl p-4 shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5 duration-200"
        >
          <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center font-bold text-white shrink-0 text-sm">
            {toast.type === "success" ? "✓" : "i"}
          </div>
          <p className="text-xs font-semibold leading-relaxed">
            {toast.message}
          </p>
        </div>
      )}
    </div>
  );
}
