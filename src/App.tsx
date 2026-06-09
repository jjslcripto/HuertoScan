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
  Camera,
  Trash2,
  Lock,
  User,
  LogOut,
  RefreshCw,
  Sparkles
} from "lucide-react";
import { Crop, WalletState, SolanaTransaction } from "./types";
import { PRESET_CROPS } from "./presetCrops";
import WalletSimulator from "./components/WalletSimulator";
import PlantScanner from "./components/PlantScanner";
import CheckoutGateway from "./components/CheckoutGateway";

// Firebase integrations
import { auth, db } from "./firebase";
import { handleFirestoreError, OperationType } from "./firebaseUtils";
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User as FireUser } from "firebase/auth";
import { collection, doc, query, where, onSnapshot, setDoc, deleteDoc, getDocs, updateDoc } from "firebase/firestore";

export default function App() {
  // Firebase Auth states
  const [user, setUser] = useState<FireUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [firebaseActive, setFirebaseActive] = useState(false);

  // Helper to deduplicate crops when merging local and Firestore items
  const deduplicateCrops = (list: Crop[]) => {
    const seen = new Set();
    return list.filter((c) => {
      if (!c.id) return false;
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });
  };

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

  // Sincronizar cultivos con localStorage (only when offline)
  useEffect(() => {
    if (firebaseActive) return;
    try {
      localStorage.setItem("solana_huerto_crops", JSON.stringify(crops));
    } catch (err) {}
  }, [crops, firebaseActive]);

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

  // Estado del listado de transacciones (inicializado desde localStorage)
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
    return [];
  });

  // Sincronizar transacciones con localStorage (only when offline)
  useEffect(() => {
    if (firebaseActive) return;
    try {
      localStorage.setItem("solana_huerto_txs", JSON.stringify(transactions));
    } catch (err) {}
  }, [transactions, firebaseActive]);

  // Auth synchronization listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
      setFirebaseActive(!!currentUser);
    });
    return () => unsubscribe();
  }, []);

  // Sync crops and transactions from Firestore when Firebase authentication is active
  useEffect(() => {
    if (!firebaseActive || !user) return;

    // Attach listeners strictly for authenticated user context:
    // Query 1: User's owned crops
    const ownCropsQuery = query(collection(db, "crops"), where("userId", "==", user.uid));
    // Query 2: Public community marketplace crops
    const publicCropsQuery = query(collection(db, "crops"), where("isForSale", "==", true));

    const unsubscribeOwn = onSnapshot(
      ownCropsQuery,
      (snapshot) => {
        const fetchedCrops: Crop[] = [];
        snapshot.forEach((docSnap) => {
          fetchedCrops.push({ ...docSnap.data() } as Crop);
        });

        setCrops((prev) => {
          const updated = [...prev];
          fetchedCrops.forEach((newC) => {
            const idx = updated.findIndex((c) => c.id === newC.id);
            if (idx >= 0) {
              updated[idx] = newC;
            } else {
              updated.unshift(newC);
            }
          });
          return deduplicateCrops(updated);
        });
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, "crops_own");
      }
    );

    const unsubscribePublic = onSnapshot(
      publicCropsQuery,
      (snapshot) => {
        const fetchedCrops: Crop[] = [];
        snapshot.forEach((docSnap) => {
          fetchedCrops.push({ ...docSnap.data() } as Crop);
        });

        setCrops((prev) => {
          const updated = [...prev];
          fetchedCrops.forEach((newC) => {
            const idx = updated.findIndex((c) => c.id === newC.id);
            if (idx >= 0) {
              updated[idx] = newC;
            } else {
              updated.unshift(newC);
            }
          });
          return deduplicateCrops(updated);
        });
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, "crops_public");
      }
    );

    // Synchronize transactions where user is the buyer
    const txQuery = query(collection(db, "transactions"), where("userId", "==", user.uid));
    const unsubscribeTx = onSnapshot(
      txQuery,
      (snapshot) => {
        const fetchedTxs: SolanaTransaction[] = [];
        snapshot.forEach((docSnap) => {
          fetchedTxs.push({ ...docSnap.data() } as SolanaTransaction);
        });
        fetchedTxs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setTransactions(fetchedTxs);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, "transactions");
      }
    );

    // Initial check: if there are no crops owned by this user in Firestore, onboard presets/local crops.
    // Also, sync any newly scanned / upload-scanned crops from the local state that are not in Firestore.
    const checkAndOnboard = async () => {
      try {
        const qSnapshot = await getDocs(ownCropsQuery);
        const existingCloudIds = new Set(qSnapshot.docs.map(doc => doc.id));
        
        // Find which local crops are currently completely missing from their Firestore collection
        const localUnsynced = crops.filter(c => !existingCloudIds.has(c.id));
        
        if (localUnsynced.length > 0) {
          console.log(`Onboarding ${localUnsynced.length} unsynced crops to Firestore.`);
          for (const item of localUnsynced) {
            const itemToUpload = { ...item, userId: user.uid };
            await setDoc(doc(db, "crops", item.id), itemToUpload);
          }
          showToast(`☁️ Se han sincronizado ${localUnsynced.length} nuevos cultivos y fichas técnicas a Firebase.`, "success");
        }
      } catch (e) {
        console.error("Migration/Onboarding error:", e);
      }
    };
    checkAndOnboard();

    return () => {
      unsubscribeOwn();
      unsubscribePublic();
      unsubscribeTx();
    };
  }, [firebaseActive, user]);

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

  // Estados para los 10 campos botánicos requeridos
  const [editDetailFrutas, setEditDetailFrutas] = useState("");
  const [editDetailFrutos, setEditDetailFrutos] = useState("");
  const [editDetailHojas, setEditDetailHojas] = useState("");
  const [editDetailClorofila, setEditDetailClorofila] = useState("");
  const [editDetailRaiz, setEditDetailRaiz] = useState("");
  const [editDetailTallo, setEditDetailTallo] = useState("");
  const [editDetailFlor, setEditDetailFlor] = useState("");
  const [editDetailSemilla, setEditDetailSemilla] = useState("");
  const [editDetailSavia, setEditDetailSavia] = useState("");
  const [editDetailEstomas, setEditDetailEstomas] = useState("");

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

    setEditDetailFrutas(crop.frutas || "");
    setEditDetailFrutos(crop.frutos || "");
    setEditDetailHojas(crop.hojas || "");
    setEditDetailClorofila(crop.clorofila || "");
    setEditDetailRaiz(crop.raiz || "");
    setEditDetailTallo(crop.tallo || "");
    setEditDetailFlor(crop.flor || "");
    setEditDetailSemilla(crop.semilla || "");
    setEditDetailSavia(crop.savia || "");
    setEditDetailEstomas(crop.estomas || "");
  };

  const saveDetailChanges = async () => {
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
          frutas: editDetailFrutas.trim(),
          frutos: editDetailFrutos.trim(),
          hojas: editDetailHojas.trim(),
          clorofila: editDetailClorofila.trim(),
          raiz: editDetailRaiz.trim(),
          tallo: editDetailTallo.trim(),
          flor: editDetailFlor.trim(),
          semilla: editDetailSemilla.trim(),
          savia: editDetailSavia.trim(),
          estomas: editDetailEstomas.trim(),
        };
      }
      return c;
    });

    setCrops(updatedCrops);
    if (!firebaseActive) {
      try {
        localStorage.setItem("solana_huerto_crops", JSON.stringify(updatedCrops));
      } catch (err) {}
    }

    const freshDetailCrop = {
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
      frutas: editDetailFrutas.trim(),
      frutos: editDetailFrutos.trim(),
      hojas: editDetailHojas.trim(),
      clorofila: editDetailClorofila.trim(),
      raiz: editDetailRaiz.trim(),
      tallo: editDetailTallo.trim(),
      flor: editDetailFlor.trim(),
      semilla: editDetailSemilla.trim(),
      savia: editDetailSavia.trim(),
      estomas: editDetailEstomas.trim(),
    };

    setDetailCrop(freshDetailCrop);

    if (firebaseActive && user) {
      try {
        await setDoc(doc(db, "crops", detailCrop.id), { ...freshDetailCrop, userId: user.uid });
      } catch (e) {
        handleFirestoreError(e, OperationType.UPDATE, `crops/${detailCrop.id}`);
      }
    }

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

  // Google Login and Logout Handlers
  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      showToast("🔑 Sesión iniciada con éxito con Google.", "success");
    } catch (err: any) {
      console.error("Auth error:", err);
      showToast("❌ Error al iniciar sesión con Google.", "error");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      // Fallback to local storage values
      const saved = localStorage.getItem("solana_huerto_crops");
      if (saved) {
        setCrops(JSON.parse(saved));
      } else {
        setCrops(PRESET_CROPS);
      }
      const savedTxs = localStorage.getItem("solana_huerto_txs");
      if (savedTxs) {
        setTransactions(JSON.parse(savedTxs));
      } else {
        setTransactions([]);
      }
      showToast("🔒 Sesión cerrada.", "info");
    } catch (err) {
      showToast("❌ Error al cerrar sesión.", "error");
    }
  };

  const resetAllCrops = async () => {
    triggerConfirm(
      "Restablecer Biblioteca",
      "¿Estás seguro de que deseas restablecer tu biblioteca a los cultivos sugeridos inicialmente? Esto eliminará tus cultivos personalizados.",
      async () => {
        setCrops(PRESET_CROPS);
        if (firebaseActive && user) {
          try {
            // Write defaults under current UID
            for (const c of PRESET_CROPS) {
              await setDoc(doc(db, "crops", c.id), { ...c, userId: user.uid });
            }
          } catch (e) {
            handleFirestoreError(e, OperationType.UPDATE, "crops_reset");
          }
        }
        showToast("🔄 Biblioteca restablecida con éxito.", "info");
      },
      true,
      "Restablecer"
    );
  };

  const clearTransactions = () => {
    if (firebaseActive) {
      triggerConfirm(
        "Vaciar Historial",
        "¿Deseas vaciar los registros locales de Solana Pay? NOTA: Tu historial oficial en la nube permanecerá inmutable para auditoría criptográfica.",
        () => {
          setTransactions([]);
          showToast("🧹 Historial local vaciado. Registros en la nube se mantienen inmutables.", "info");
        },
        true,
        "Vaciar Historial"
      );
    } else {
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
    }
  };

  // Agregar planta escaneada exitosamente por Gemini / Simulador
  const handleScanComplete = async (newCrop: Crop) => {
    let cropToSave = { ...newCrop };
    
    // Al escanear una planta, se agrega de primera en la lista de cultivos
    setCrops((prev) => [cropToSave, ...prev]);
    setDetailCrop(cropToSave);

    if (firebaseActive && user) {
      cropToSave.userId = user.uid;
      try {
        await setDoc(doc(db, "crops", cropToSave.id), cropToSave);
      } catch (e) {
        handleFirestoreError(e, OperationType.CREATE, `crops/${cropToSave.id}`);
      }
    }
    
    showToast(`🌿 ¡Cultivo "${cropToSave.name}" identificado y agregado a tu biblioteca!`, "success");
  };



  // Modificar stock, precio o nombre de un cultivo en tu inventario
  const startEditing = (crop: Crop) => {
    setEditingCropId(crop.id);
    setEditName(crop.name || "");
    setEditPriceSol(crop.priceSol || 0);
    setEditStock(crop.stock || 0);
    setEditImageUrl(crop.imageUrl || "");
  };

  const saveEditing = async (cropId: string) => {
    let affectedCropName = "";
    let updatedTargetCrop: Crop | null = null;

    const updatedCrops = crops.map((c) => {
      if (c.id === cropId) {
        affectedCropName = editName.trim() || c.name;
        const usdEquivalent = editPriceSol * 180;
        const updated = {
          ...c,
          name: editName.trim() || c.name,
          priceSol: +editPriceSol.toFixed(4),
          priceUsdc: +usdEquivalent.toFixed(2) || 1.0,
          priceUsdt: +usdEquivalent.toFixed(2) || 1.0,
          stock: editStock,
          imageUrl: editImageUrl.trim() || c.imageUrl
        };
        updatedTargetCrop = updated;
        return updated;
      }
      return c;
    });

    setCrops(updatedCrops);
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

    if (firebaseActive && user && updatedTargetCrop) {
      try {
        await setDoc(doc(db, "crops", cropId), { ...updatedTargetCrop, userId: user.uid });
      } catch (e) {
        handleFirestoreError(e, OperationType.UPDATE, `crops/${cropId}`);
      }
    }

    showToast(`💾 Valores actualizados para "${affectedCropName}".`, "success");
  };

  // Alternar el estado de poner en venta o quitar un cultivo del mercado
  const toggleSaleState = async (cropId: string) => {
    let updatedTargetCrop: Crop | null = null;
    
    const updatedCrops = crops.map((c) => {
      if (c.id === cropId) {
        const updated = { ...c, isForSale: !c.isForSale };
        updatedTargetCrop = updated;
        return updated;
      }
      return c;
    });
    
    setCrops(updatedCrops);

    if (firebaseActive && user && updatedTargetCrop) {
      try {
        await setDoc(doc(db, "crops", cropId), { ...updatedTargetCrop, userId: user.uid });
      } catch (e) {
        handleFirestoreError(e, OperationType.UPDATE, `crops/${cropId}`);
      }
    }

    if (updatedTargetCrop) {
      showToast(
        updatedTargetCrop.isForSale
          ? "🏪 Publicado en la vitrina del mercado"
          : "📦 Retirado del mercado a modo borrador",
        "info"
      );
    }
  };

  const deleteCrop = (cropId: string) => {
    const cropToDelete = crops.find((c) => c.id === cropId);
    triggerConfirm(
      "Eliminar Cultivo",
      `¿Estás seguro de que deseas eliminar el cultivo "${cropToDelete?.name || ""}" de tu biblioteca?`,
      async () => {
        setCrops((prev) => prev.filter((c) => c.id !== cropId));
        if (detailCrop?.id === cropId) {
          setDetailCrop(null);
        }

        if (firebaseActive && user) {
          try {
            await deleteDoc(doc(db, "crops", cropId));
          } catch (e) {
            handleFirestoreError(e, OperationType.DELETE, `crops/${cropId}`);
          }
        }

        showToast(`🗑️ El cultivo "${cropToDelete?.name || ""}" ha sido eliminado de tu inventario.`, "info");
      },
      true,
      "Eliminar"
    );
  };

  // El comprador completó con éxito el pago en Solana Pay
  const handlePaymentSuccess = async (tx: SolanaTransaction) => {
    // 1. Agregar transacción al ledger histórico
    setTransactions((prev) => [tx, ...prev]);

    // 2. Descontar stock del cultivo correspondiente
    const targetCrop = crops.find(c => c.id === tx.cropId);
    const updatedStock = targetCrop ? Math.max(0, targetCrop.stock - tx.quantity) : 0;

    setCrops((prev) =>
      prev.map((c) => {
        if (c.id === tx.cropId) {
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
        return { ...prev, stock: updatedStock };
      });
    }

    // 5. Sync to Firebase Cloud Ledger & update stock securely
    if (firebaseActive && user) {
      try {
        const txWithUser = { ...tx, userId: user.uid };
        await setDoc(doc(db, "transactions", tx.id), txWithUser);
        
        await updateDoc(doc(db, "crops", tx.cropId), { stock: updatedStock });
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, `checkout_success`);
      }
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
            {/* Firebase Google Auth Panel */}
            {authReady ? (
              user ? (
                <div id="firebase-user-panel" className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-1.5 rounded-xl">
                  {user.photoURL && (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || "User"}
                      className="w-6 h-6 rounded-full border border-slate-300 animate-fade-in"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <div className="hidden md:flex flex-col text-left">
                    <span className="text-[10px] font-bold text-slate-700 truncate max-w-[120px] leading-tight">
                      {user.displayName || "Cultivador"}
                    </span>
                    <span className="text-[9px] text-slate-400 leading-none truncate max-w-[120px]">
                      {user.email}
                    </span>
                  </div>
                  <button
                    id="firebase-logout-btn"
                    onClick={handleLogout}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                    title="Cerrar Sesión"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  id="firebase-login-btn"
                  onClick={handleGoogleLogin}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm uppercase tracking-wide font-mono border border-emerald-800"
                >
                  <User className="w-3.5 h-3.5 block shrink-0" />
                  Ingresar con Google
                </button>
              )
            ) : (
              <span className="text-[10px] text-slate-400 font-mono animate-pulse">Cargando la nube...</span>
            )}

            <div className="hidden sm:flex text-right flex-col">
              <span className="text-xs text-slate-400 font-mono">ESTADO CLUSTER</span>
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

            {/* Panel de Sincronización en la Base de Datos Firebase */}
            <div id="firebase-sync-status-card" className="bg-white border border-slate-200/60 rounded-2xl p-4 shadow-2xs flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                  Base de Datos Firebase
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold font-mono ${
                  user ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"
                }`}>
                  {user ? "Firebase Conectado" : "Almacenamiento Local"}
                </span>
              </div>
              
              {user ? (
                <div className="flex items-start gap-2.5 text-xs text-left">
                  <div className="bg-emerald-500/10 text-emerald-600 p-1.5 rounded-lg shrink-0 mt-0.5">
                    <Check className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 leading-tight">Sincronización en la Nube Activa</p>
                    <p className="text-slate-500 text-[11px] mt-0.5 leading-normal">
                      Las imágenes de tus escaneos, fotografías subidas y toda la información de la ficha botánica se guardan automáticamente en tu colección personal de Firebase Firestore.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3 text-left">
                  <div className="flex items-start gap-2.5 text-xs">
                    <div className="bg-amber-500/10 text-amber-600 p-1.5 rounded-lg shrink-0 mt-0.5">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 leading-tight">Guardado en la Nube Desactivado</p>
                      <p className="text-slate-500 text-[11px] mt-0.5 leading-normal">
                        Tus escaneos actuales se guardan de forma temporal en la caché del navegador. Inicia sesión con su cuenta para guardarlos permanentemente de manera segura en Firebase Firestore.
                      </p>
                    </div>
                  </div>
                  <button
                    id="firebase-login-banner-btn"
                    onClick={handleGoogleLogin}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm border border-slate-950 font-sans uppercase tracking-wide"
                  >
                    <User className="w-3.5 h-3.5" />
                    Ingresar con Google para activar Firebase
                  </button>
                </div>
              )}
            </div>

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

                                  <button
                                    id={`delete-crop-${crop.id}`}
                                    onClick={() => deleteCrop(crop.id)}
                                    className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                    title="Eliminar cultivo"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
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

                    {/* Campos de Edición de Estructuras Botánicas (Base de Datos Local) */}
                    <div className="sm:col-span-2 border-t border-slate-100 pt-4 mt-2">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wrap mb-3">
                        Edición de Atributos Botánicos Completo (Base de Datos Local)
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="block text-[10px] text-slate-500 mb-0.5">Frutas:</label>
                          <input
                            type="text"
                            value={editDetailFrutas}
                            onChange={(e) => setEditDetailFrutas(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 focus:bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 mb-0.5">Frutos:</label>
                          <input
                            type="text"
                            value={editDetailFrutos}
                            onChange={(e) => setEditDetailFrutos(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 focus:bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 mb-0.5">Hojas:</label>
                          <input
                            type="text"
                            value={editDetailHojas}
                            onChange={(e) => setEditDetailHojas(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 focus:bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-550 mb-0.5">Clorofila y Fotosíntesis:</label>
                          <input
                            type="text"
                            value={editDetailClorofila}
                            onChange={(e) => setEditDetailClorofila(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 focus:bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 mb-0.5">Raíz:</label>
                          <input
                            type="text"
                            value={editDetailRaiz}
                            onChange={(e) => setEditDetailRaiz(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 focus:bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 mb-0.5">Tallo:</label>
                          <input
                            type="text"
                            value={editDetailTallo}
                            onChange={(e) => setEditDetailTallo(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 focus:bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 mb-0.5">Flor:</label>
                          <input
                            type="text"
                            value={editDetailFlor}
                            onChange={(e) => setEditDetailFlor(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 focus:bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 mb-0.5">Semilla:</label>
                          <input
                            type="text"
                            value={editDetailSemilla}
                            onChange={(e) => setEditDetailSemilla(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 focus:bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 mb-0.5">Savia:</label>
                          <input
                            type="text"
                            value={editDetailSavia}
                            onChange={(e) => setEditDetailSavia(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 focus:bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 mb-0.5">Estomas:</label>
                          <input
                            type="text"
                            value={editDetailEstomas}
                            onChange={(e) => setEditDetailEstomas(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 focus:bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-2">
                      {/* Columna Izquierda: Imagen del espécimen y bitácora */}
                      <div className="lg:col-span-4 space-y-4">
                        <div className="bg-slate-100 p-1.5 rounded-2xl border-4 border-emerald-500 overflow-hidden shadow-inner relative flex items-center justify-center aspect-video sm:aspect-square">
                          {detailCrop.imageUrl ? (
                            <img
                              src={detailCrop.imageUrl}
                              alt={detailCrop.name}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover rounded-xl"
                            />
                          ) : (
                            <div className="text-center text-slate-400 p-8">
                              No hay imagen disponible
                            </div>
                          )}
                          <div className="absolute bottom-3 right-3 bg-emerald-900/90 text-[10px] font-mono text-white px-2.5 py-1 rounded-md border border-emerald-700 shadow-sm font-bold uppercase tracking-wider">
                            Imagen del Espécimen
                          </div>
                        </div>
                        
                        {detailCrop.notes && (
                          <div className="bg-emerald-50 border border-emerald-100 p-3.5 rounded-xl">
                            <span className="block text-[9px] font-black text-emerald-850 uppercase tracking-wider">
                              Bitácora del Cultivo
                            </span>
                            <span className="text-[11px] text-slate-600 block mt-1 italic">
                              "{detailCrop.notes}"
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Columna Central: Taxonomía y Distribución */}
                      <div className="lg:col-span-4 space-y-4">
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

                      {/* Columna Derecha: Usos, Cuidados y Precios */}
                      <div className="lg:col-span-4 space-y-4">
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

                    {/* Estructura Científica y Anatomía */}
                    <div className="border-t border-slate-100 pt-5 mt-4">
                      <h4 className="text-xs font-black text-emerald-800 uppercase tracking-wider mb-3 flex items-center gap-1.5 font-sans">
                        <Layers className="w-4 h-4" />
                        Análisis Morfológico y Botánico Completo (Almacenamiento Local Seguro)
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1">
                          <div className="text-slate-700 text-xs font-bold flex items-center gap-1.5 font-sans">
                            <span className="text-base">🌿</span> <span>Hojas y Foliolo:</span>
                          </div>
                          <p className="text-[11px] text-slate-550 leading-relaxed font-sans">{detailCrop.hojas || "No especificado / General"}</p>
                        </div>

                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1">
                          <div className="text-slate-700 text-xs font-bold flex items-center gap-1.5 font-sans">
                            <span className="text-base">🔬</span> <span>Clorofila y Mecanismo Fotosintético:</span>
                          </div>
                          <p className="text-[11px] text-slate-550 leading-relaxed font-sans">{detailCrop.clorofila || "No especificado / General"}</p>
                        </div>

                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1">
                          <div className="text-slate-700 text-xs font-bold flex items-center gap-1.5 font-sans">
                            <span className="text-base">🪓</span> <span>Tallo y Haces Vasculares:</span>
                          </div>
                          <p className="text-[11px] text-slate-550 leading-relaxed font-sans">{detailCrop.tallo || "No especificado / General"}</p>
                        </div>

                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1">
                          <div className="text-slate-700 text-xs font-bold flex items-center gap-1.5 font-sans">
                            <span className="text-base">🥕</span> <span>Sistema Radicular (Raíz):</span>
                          </div>
                          <p className="text-[11px] text-slate-550 leading-relaxed font-sans">{detailCrop.raiz || "No especificado / General"}</p>
                        </div>

                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1">
                          <div className="text-slate-700 text-xs font-bold flex items-center gap-1.5 font-sans">
                            <span className="text-base">🌸</span> <span>Flores e Inflorescencia:</span>
                          </div>
                          <p className="text-[11px] text-slate-550 leading-relaxed font-sans">{detailCrop.flor || "No especificado / General"}</p>
                        </div>

                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1">
                          <div className="text-slate-700 text-xs font-bold flex items-center gap-1.5 font-sans">
                            <span className="text-base">🍊</span> <span>Características del Fruto:</span>
                          </div>
                          <p className="text-[11px] text-slate-550 leading-relaxed font-sans">{detailCrop.frutos || "No especificado / General"}</p>
                        </div>

                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1">
                          <div className="text-slate-700 text-xs font-bold flex items-center gap-1.5 font-sans">
                            <span className="text-base">🍓</span> <span>Frutas asociadas:</span>
                          </div>
                          <p className="text-[11px] text-slate-550 leading-relaxed font-sans">{detailCrop.frutas || "No especificado / General"}</p>
                        </div>

                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1">
                          <div className="text-slate-700 text-xs font-bold flex items-center gap-1.5 font-sans">
                            <span className="text-base">🌰</span> <span>Semillas y Propagación:</span>
                          </div>
                          <p className="text-[11px] text-slate-550 leading-relaxed font-sans">{detailCrop.semilla || "No especificado / General"}</p>
                        </div>

                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1">
                          <div className="text-slate-700 text-xs font-bold flex items-center gap-1.5 font-sans">
                            <span className="text-base">🧪</span> <span>Savia y Biofluidos:</span>
                          </div>
                          <p className="text-[11px] text-slate-550 leading-relaxed font-sans">{detailCrop.savia || "No especificado / General"}</p>
                        </div>

                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1">
                          <div className="text-slate-700 text-xs font-bold flex items-center gap-1.5 font-sans">
                            <span className="text-base">🌬️</span> <span>Distribución de Estomas:</span>
                          </div>
                          <p className="text-[11px] text-slate-550 leading-relaxed font-sans">{detailCrop.estomas || "No especificado / General"}</p>
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
