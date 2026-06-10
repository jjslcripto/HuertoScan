/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { Camera, Upload, AlertCircle, Sparkles, RefreshCw, Undo, Eye, Check } from "lucide-react";
import { Crop } from "../types";

interface PlantScannerProps {
  onScanComplete: (crop: Crop) => void;
  geminiConfigured: boolean;
}

// Sin Catálogo Local - Identificación Real con IA

// Datos simulados de respaldo si no hay API Key o para pruebas rápidas
const SIMULATED_PRODUCTS: Record<string, Partial<Crop>> = {
  "Pimiento Morrón": {
    name: "Pimiento Morrón Rojo",
    scientificName: "Capsicum annuum",
    origin: "Originaria del centro y norte de América del Sur. Domesticada hace miles de años.",
    description: "Arbusto pequeño de clima cálido que produce frutos globosos carnosos de sabor dulce.",
    uses: "Asados, ensaladas, sofritos. Alta concentración de Vitamina C y antioxidantes.",
    careLevel: "Moderado",
    sunlight: "Pleno sol directo (mínimo 6 horas)",
    waterRequirements: "Moderado, suelo bien nutrido y drenado. No mojar hojas.",
    harvestTime: "100 días",
    recommendedPriceSol: 0.045,
    recommendedPriceUsdc: 4.5,
    recommendedPriceUsdt: 4.5,
    priceSol: 0.04,
    priceUsdc: 4.0,
    priceUsdt: 4.0,
    stock: 6,
    isForSale: true,
    notes: "Pimientos grandes sin pesticidas químicos."
  }
};

export default function PlantScanner({ onScanComplete, geminiConfigured }: PlantScannerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"upload" | "camera">("upload");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [scanSpeedQuotes, setScanSpeedQuotes] = useState("Iniciando análisis óptico...");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Procesa, valida y comprime la imagen a JPEG con dimensiones razonables (máx 1024px)
  // Esto reduce drásticamente el peso del payload evitando "Payload Too Large" o lentitud de red
  const processAndResizeImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith("image/")) {
        reject(new Error("Formato de archivo no válido. Sube un archivo de imagen (JPG, JPEG, PNG o WEBP)."));
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const maxDimension = 1024;
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
            // Comprimir a JPEG con calidad recomendada
            const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
            resolve(dataUrl);
          } else {
            resolve(event.target?.result as string);
          }
        };
        img.onerror = () => {
          reject(new Error("No pudimos decodificar el archivo de imagen. Intenta con otra fotografía."));
        };
        img.src = event.target?.result as string;
      };
      reader.onerror = () => {
        reject(new Error("Fallo al leer el archivo desde el sistema de archivos local."));
      };
      reader.readAsDataURL(file);
    });
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      try {
        setError("");
        const compressedBase64 = await processAndResizeImage(file);
        setImagePreview(compressedBase64);
        handlePerformScan(compressedBase64);
      } catch (err: any) {
        setError(err.message || "Error al procesar la foto soltada.");
      }
    }
  };

  // Citas informativas mientras ruge la IA de Gemini
  useEffect(() => {
    if (!loading) return;

    const quotes = [
      "Iniciando análisis óptico...",
      "Extrayendo patrones de clorofila y silueta de hoja...",
      "Consultando base de datos botánica de Gemini 3.5-flash...",
      "Identificando nombre científico y orígenes históricos...",
      "Calculando precios sugeridos en SOL, USDC y USDT...",
      "Preparando ficha técnica para la comunidad del Bootcamp...",
      "Listo! Guardando en tu biblioteca orgánica..."
    ];

    let index = 0;
    const interval = setInterval(() => {
      index = (index + 1) % quotes.length;
      setScanSpeedQuotes(quotes[index]);
    }, 2000);

    return () => clearInterval(interval);
  }, [loading]);

  // Manejar el corte/inicio de cámara
  useEffect(() => {
    let isMounted = true;
    if (activeTab === "camera" && cameraActive) {
      startCamera().catch((err) => {
        console.log("[Escaner Info] Error capturado al iniciar cámara:", err);
      });
    } else {
      stopCamera();
    }
    return () => {
      isMounted = false;
      stopCamera();
    };
  }, [activeTab, cameraActive]);

  const startCamera = async () => {
    try {
      setError("");
      
      if (!navigator || !navigator.mediaDevices || typeof navigator.mediaDevices.enumerateDevices !== "function" || typeof navigator.mediaDevices.getUserMedia !== "function") {
        setError("La API de cámara (navigator.mediaDevices.getUserMedia) no está disponible en este navegador o entorno iFrame seguro. Por favor, sube una fotografía desde tus archivos.");
        setActiveTab("upload");
        setCameraActive(false);
        return;
      }

      let stream: MediaStream;
      
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === "videoinput");
        
        const hasLabels = videoDevices.some(d => d.label);
        if (hasLabels && videoDevices.length > 0) {
          const rgbWebcams = videoDevices.filter(d => {
            const label = d.label.toLowerCase();
            return !label.includes("ir ") && 
                   !label.includes("infra") && 
                   !label.includes("depth") && 
                   !label.includes("hello") && 
                   !label.includes("virtual");
          });
          
          const chosenDevice = rgbWebcams.length > 0 ? rgbWebcams[0] : videoDevices[0];
          console.log("Cámara seleccionada para HP EliteBook:", chosenDevice.label || "Por defecto");
          
          stream = await navigator.mediaDevices.getUserMedia({
            video: { 
              deviceId: { exact: chosenDevice.deviceId },
              width: { ideal: 1280 },
              height: { ideal: 720 }
            }
          });
        } else {
          throw new Error("Labels not initialized yet");
        }
      } catch (err) {
        console.warn("Fallo en la selección por dispositivo específico o permiso de etiquetas. Intentando con facingMode: user...", err);
        
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }
          });
          console.log("Cámara integrada iniciada con éxito.");
        } catch (errUser) {
          console.warn("Fallo con facingMode: user. Intentando con back camera...", errUser);
          
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: "environment" }
            });
            console.log("Cámara de respaldo iniciada.");
          } catch (errEnv) {
            console.warn("Fallo con facingMode: environment. Intentando configuración libre...", errEnv);
            
            stream = await navigator.mediaDevices.getUserMedia({
              video: true
            });
            console.log("Cámara genérica básica iniciada.");
          }
        }
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        try {
          await videoRef.current.play();
        } catch (playErr) {
          console.log("[Escaner Info] Fallo al reproducir el flujo de video:", playErr);
        }
      }
    } catch (err: any) {
      console.log("[Escaner Info] Error al iniciar dispositivo de captura de video:", err);
      setError("No pudimos acceder a tu cámara. Asegúrate de otorgar los permisos de cámara en tu navegador HP EliteBook o sube una fotografía desde tus archivos.");
      setActiveTab("upload");
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      if (stream && typeof stream.getTracks === "function") {
        stream.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch (e) {
            console.log("[Escaner Info] Error al apagar el track de video:", e);
          }
        });
      }
      videoRef.current.srcObject = null;
    }

    if (streamRef.current) {
      try {
        if (typeof streamRef.current.getTracks === "function") {
          streamRef.current.getTracks().forEach((track) => {
            try {
              track.stop();
            } catch (te) {
              console.log("[Escaner Info] Error al apagar track de streamRef:", te);
            }
          });
        }
      } catch (e) {
        console.log("[Escaner Info] Error general al apagar streamRef:", e);
      }
      streamRef.current = null;
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");

      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg");
        setImagePreview(dataUrl);
        
        // Apagar la cámara de inmediato al capturar la imagen
        setCameraActive(false);
        setActiveTab("upload"); // Cambiar la pestaña a "upload" para desmontar la cámara
        stopCamera();

        // Lanzar escaneo real / simulado inmediato con IA
        handlePerformScan(dataUrl);
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        setError("");
        const compressedBase64 = await processAndResizeImage(file);
        setImagePreview(compressedBase64);
        handlePerformScan(compressedBase64);
      } catch (err: any) {
        setError(err.message || "Error al procesar la foto cargada.");
      } finally {
        if (e.target) {
          e.target.value = "";
        }
      }
    }
  };

  // Catalogación por selección directa eliminada

  // Escaneo local simulado rápido
  const handleSimulateScan = (plantName: string, imageSrc: string) => {
    setLoading(true);
    setTimeout(() => {
      const template = SIMULATED_PRODUCTS[plantName] || SIMULATED_PRODUCTS["Pimiento Morrón"];
      const newCrop: Crop = {
        id: "crop-" + Math.random().toString(36).substring(2, 9),
        name: template.name!,
        scientificName: template.scientificName!,
        origin: template.origin!,
        description: template.description!,
        uses: template.uses!,
        careLevel: template.careLevel!,
        sunlight: template.sunlight!,
        waterRequirements: template.waterRequirements!,
        harvestTime: template.harvestTime!,
        recommendedPriceSol: template.recommendedPriceSol!,
        recommendedPriceUsdc: template.recommendedPriceUsdc!,
        recommendedPriceUsdt: template.recommendedPriceUsdt!,
        priceSol: template.priceSol!,
        priceUsdc: template.priceUsdc!,
        priceUsdt: template.priceUsdt!,
        stock: template.stock!,
        imageUrl: imageSrc,
        scannedAt: new Date().toISOString(),
        isForSale: true,
        notes: "Identificación rápida por catálogo de referencia simulada."
      };
      setLoading(false);
      setImagePreview(null);
      onScanComplete(newCrop);
    }, 2500);
  };

  // Escaneo real llamando a la API del servidor (para identificar el cultivo con IA o catálogo local enriquecido)
  const handlePerformScan = async (base64Image: string) => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ image: base64Image })
      });

      const resText = await response.text();
      let resData;
      try {
        resData = JSON.parse(resText);
      } catch (parseError) {
        console.error("Respuesta inesperada del servidor:", resText);
        let errorMsg = "El servidor devolvió un error inesperado al escanear la imagen. ";
        if (resText.includes("413") || resText.toLowerCase().includes("large")) {
           errorMsg += "La imagen es demasiado grande. Intenta subir una foto más ligera o recortada (Max 3MB).";
        } else if (resText.includes("page")) {
           errorMsg += "Endpoint inalcanzable. (Error de red).";
        } else {
           errorMsg += "Por favor, intenta subir otra fotografía u oprime Restablecer.";
        }
        throw new Error(errorMsg);
      }

      if (!response.ok || !resData.success) {
        throw new Error(resData.error || "Error al escanear la planta");
      }

      const parsedData = resData.data;
      const isFallback = resData.fallback === true;
      const newCrop: Crop = {
        id: "crop-" + Math.random().toString(36).substring(2, 9),
        name: parsedData.name,
        scientificName: parsedData.scientificName,
        origin: parsedData.origin,
        description: parsedData.description,
        uses: parsedData.uses,
        careLevel: parsedData.careLevel || "Fácil",
        sunlight: parsedData.sunlight,
        waterRequirements: parsedData.waterRequirements,
        harvestTime: parsedData.harvestTime,
        recommendedPriceSol: parsedData.recommendedPriceSol || 0.01,
        recommendedPriceUsdc: parsedData.recommendedPriceUsdc || 1.0,
        recommendedPriceUsdt: parsedData.recommendedPriceUsdt || 1.0,
        priceSol: parsedData.recommendedPriceSol || 0.01,
        priceUsdc: parsedData.recommendedPriceUsdc || 1.0,
        priceUsdt: parsedData.recommendedPriceUsdt || 1.0,
        stock: 5,
        imageUrl: base64Image,
        scannedAt: new Date().toISOString(),
        isForSale: true,
        notes: isFallback 
          ? `Servicio de cortesía: ${resData.fallbackReason || "Servicio Gratuito de Gemini alcanzado"}`
          : "Verificado y tasado por IA en la red de Solana Devnet."
      };

      setLoading(false);
      setImagePreview(null);
      onScanComplete(newCrop);
    } catch (err: any) {
      console.log("[Escaner Info] No se pudo completar el análisis del cultivo:", err);
      setError(err.message || "La IA no pudo procesar la imagen en este momento. Puedes volver a intentarlo o registrar tus cultivos de manera manual.");
      setLoading(false);
      setImagePreview(null);
    }
  };

  return (
    <div id="plant-scanner" className="bg-white rounded-[32px] border-4 border-emerald-500 p-6 shadow-xl flex flex-col gap-4">
      {/* Encabezado */}
      <div className="flex items-center justify-between bg-emerald-50 p-4 rounded-xl border-2 border-emerald-100">
        <h3 className="font-sans font-black text-sm text-emerald-900 flex items-center gap-2 leading-none">
          <Sparkles className="w-4 h-4 text-emerald-600 animate-pulse" />
          Escáner de Plantas y Huerta Orgánica
        </h3>
        <span
          className={`text-[9px] px-2.5 py-1 rounded-full font-black uppercase tracking-wider flex items-center gap-1 ${
            geminiConfigured
              ? "bg-emerald-500 text-white"
              : "bg-yellow-400 text-black"
          }`}
        >
          {geminiConfigured ? "IA Online" : "Modo Local"}
        </span>
      </div>

      {loading ? (
        /* Pantalla de Carga con efecto de escaneo fluorescente */
        <div id="scanner-loading-screen" className="flex flex-col items-center justify-center py-12 px-4 space-y-5 bg-emerald-950 rounded-[24px] border-4 border-emerald-900 overflow-hidden h-72 relative">
          {imagePreview && (
            <img
              src={imagePreview}
              alt="Planta escaneada"
              className="absolute inset-0 w-full h-full object-cover opacity-20 filter blur-xs"
            />
          )}

          {/* Línea láser animada */}
          <div className="absolute left-0 right-0 h-1 bg-yellow-400 shadow-[0_0_20px_#facc15] animate-bounce w-full z-10" style={{ animationDuration: "1.8s" }} />

          <RefreshCw className="w-10 h-10 text-yellow-400 animate-spin z-20" />
          <div className="text-center space-y-2 z-20">
            <h4 className="text-xs font-black text-yellow-400 font-mono uppercase tracking-widest leading-none">
              Procesando Imagen...
            </h4>
            <p className="text-[11px] text-emerald-200 px-6 font-semibold italic">
              {scanSpeedQuotes}
            </p>
          </div>
        </div>
      ) : (
        /* Panel del Buscador / Capturador */
        <div className="space-y-4">
          <div className="flex bg-emerald-50 p-1.5 rounded-xl border-2 border-emerald-100">
            <button
              id="tab-upload"
              onClick={() => {
                setActiveTab("upload");
                setCameraActive(false);
              }}
              className={`flex-1 py-2 text-xs font-black uppercase rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === "upload" 
                  ? "bg-emerald-500 text-white shadow-[2px_2px_0px_0px_rgba(6,78,59,1)]" 
                  : "text-emerald-800 hover:text-emerald-950"
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              Subir Imagen
            </button>
            <button
              id="tab-camera"
              onClick={() => {
                setActiveTab("camera");
                setCameraActive(true);
              }}
              className={`flex-1 py-2 text-xs font-black uppercase rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === "camera" 
                  ? "bg-emerald-500 text-white shadow-[2px_2px_0px_0px_rgba(6,78,59,1)]" 
                  : "text-emerald-800 hover:text-emerald-950"
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              Cámara en Vivo
            </button>
          </div>

          {error && (
            <div id="scanner-error" className="bg-yellow-100 border-2 border-emerald-950 text-emerald-950 p-4 rounded-xl text-xs flex gap-2 items-center font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(6,78,59,1)]">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {activeTab === "upload" ? (
            /* Subida de Archivos con Drag & Drop Interactivo y Escalado automático */
            <div
              id="upload-area"
              onClick={() => fileInputRef.current?.click()}
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`border-4 border-dashed p-8 rounded-[24px] text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-3 group shadow-inner ${
                dragActive 
                  ? "border-yellow-400 bg-yellow-50/30 scale-98 shadow-lg" 
                  : "border-emerald-200 hover:border-emerald-500 bg-emerald-50/20 hover:bg-emerald-50/50"
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept="image/*"
                className="hidden"
              />
              <div className={`p-3 rounded-xl border-2 shadow-sm transition-all ${
                dragActive
                  ? "bg-yellow-400 border-yellow-500 text-emerald-950 scale-110"
                  : "bg-emerald-500 text-white border-emerald-600 group-hover:scale-110"
              }`}>
                <Upload className={`w-5 h-5 ${dragActive ? "animate-bounce" : ""}`} />
              </div>
              <div>
                <p className="text-xs font-black text-emerald-900 uppercase tracking-tight">
                  {dragActive ? "¡Suelta la imagen ahora!" : "Selecciona tu imagen"}
                </p>
                <p className="text-[9px] text-emerald-600 font-bold uppercase tracking-wider mt-0.5">
                  {dragActive ? "Iniciando captura inteligente..." : "Archivos JPG, JPEG, PNG o WEBP • Arrastra aquí"}
                </p>
              </div>
            </div>
          ) : (
            /* Cámara de Video en Vivo */
            <div className="space-y-3">
              <div id="camera-stream-area" className="relative bg-emerald-950 rounded-[24px] overflow-hidden h-64 border-4 border-emerald-500 flex items-center justify-center shadow-lg">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />

                {/* Guía en el centro */}
                <div className="absolute inset-0 border-4 border-dashed border-emerald-400/40 m-6 pointer-events-none rounded-xl flex items-center justify-center">
                  <div className="w-8 h-8 border-t-4 border-l-4 border-emerald-400 absolute top-0 left-0" />
                  <div className="w-8 h-8 border-t-4 border-r-4 border-emerald-400 absolute top-0 right-0" />
                  <div className="w-8 h-8 border-b-4 border-l-4 border-emerald-400 absolute bottom-0 left-0" />
                  <div className="w-8 h-8 border-b-4 border-r-4 border-emerald-400 absolute bottom-0 right-0" />
                </div>

                <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center bg-emerald-950/90 backdrop-blur-xs p-3.5 rounded-xl border-2 border-emerald-800">
                  <span className="text-[9px] text-emerald-300 font-black tracking-wider uppercase">Luz natural para mayor precisión</span>
                  <button
                    id="capture-photo-btn"
                    onClick={capturePhoto}
                    className="bg-yellow-400 hover:bg-yellow-300 text-emerald-950 font-black text-xs uppercase px-4 py-2 rounded-xl border-2 border-emerald-950 shadow-[3px_3px_0px_0px_rgba(6,78,59,1)] transition-all cursor-pointer flex items-center gap-1"
                  >
                    <Camera className="w-3.5 h-3.5 text-emerald-950" />
                    Capturar
                  </button>
                </div>
              </div>
              
              {/* Nota de ayuda específica para HP EliteBook */}
              <div className="bg-emerald-50 border-2 border-emerald-100 p-3.5 rounded-xl text-[9px] text-emerald-800 font-bold uppercase tracking-wide flex items-start gap-2 shadow-inner">
                <span className="text-xs leading-none shrink-0">💡</span>
                <div>
                  <span className="font-extrabold text-emerald-950 block mb-0.5">Tip para HP EliteBook y Laptops:</span>
                  Si la pantalla se ve completamente negra o gris, recuerda deslizar la <span className="text-emerald-950 font-black underline">pestana fisica de privacidad (Privacy Shutter)</span> ubicada arriba del lente físico de tu cámara, y permite el acceso en el candado del navegador.
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Canvas invisible para transferir frames */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
