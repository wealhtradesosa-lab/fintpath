// ════════════════════════════════════════════════════════════════════════════
// FINPATHIA · PWAInstallPrompt.jsx — Sesión 4-may-2026
//
// Componente invisible que hace 2 cosas:
//   1. Registra el Service Worker al cargar la app (capacidades PWA)
//   2. Captura el evento `beforeinstallprompt` de Chrome/Android y muestra
//      un banner sutil que invita a "Instalar FINPATHIA en tu celular".
//
// COMPORTAMIENTO:
//   - El banner aparece a partir de la 2da visita (no en la primera, para no
//     espantar al user antes de que entienda qué es FINPATHIA).
//   - Si el user lo cierra, no vuelve a aparecer en 30 días.
//   - Si el user instala, dispara evento GA4 'pwa_installed'.
//
// PLATAFORMAS:
//   - Chrome / Edge / Opera (Android, Windows, Mac): banner nativo + custom
//   - Safari iOS: NO soporta beforeinstallprompt — para iOS mostramos
//     instrucciones manuales ("Compartir → Agregar a pantalla de inicio").
//   - Firefox: no soporta install prompt (Firefox no apoya PWAs full)
//
// Diseño minimalista — el banner es un toast-like sutil abajo, no un modal.
// ════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import { track } from "../lib/analytics";

const STORAGE_KEY = "fp3_pwa_dismissed_until";
const VISIT_COUNT_KEY = "fp3_visit_count";

const T = {
  bg: "#141418",
  border: "rgba(255,255,255,0.14)",
  txt: "#fafafa",
  txt2: "#a1a1aa",
  txt3: "#71717a",
  green: "#22c55e",
};

const FONT = "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif";

// ─── Detectar si estamos en iOS Safari ───────────────────────────────────
function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

// ─── Detectar si ya está instalada (modo standalone) ─────────────────────
function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true ||
    document.referrer.includes("android-app://")
  );
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showBanner, setShowBanner] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  // ─── Registrar el Service Worker al montar ────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    // Esperamos a que la página termine de cargar para no bloquear el render
    const register = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((reg) => {
          console.log("[PWA] Service Worker registrado:", reg.scope);
        })
        .catch((err) => {
          console.warn("[PWA] Falló registro de SW:", err);
        });
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register);
      return () => window.removeEventListener("load", register);
    }
  }, []);

  // ─── Listener para el prompt de instalación (Chromium) ────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Si ya está instalada, no mostrar nada
    if (isStandalone()) {
      console.log("[PWA] App ya instalada en modo standalone");
      return;
    }

    // Verificar si el user dismissed recientemente
    const dismissedUntil = localStorage.getItem(STORAGE_KEY);
    if (dismissedUntil && Date.now() < parseInt(dismissedUntil, 10)) {
      return;
    }

    // Contar visitas — el banner aparece a partir de la 2da visita
    const visitCount = parseInt(localStorage.getItem(VISIT_COUNT_KEY) || "0", 10) + 1;
    localStorage.setItem(VISIT_COUNT_KEY, String(visitCount));

    // Capturar el evento beforeinstallprompt (Chromium)
    const onBeforeInstallPrompt = (e) => {
      // Prevenir que el browser muestre su prompt automático
      e.preventDefault();
      setDeferredPrompt(e);
      // Solo mostrar nuestro banner si es la 2da+ visita
      if (visitCount >= 2) {
        setTimeout(() => setShowBanner(true), 3000); // delay 3s para no ser invasivo
      }
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);

    // Detectar instalación exitosa
    const onAppInstalled = () => {
      console.log("[PWA] App instalada!");
      track("pwa_installed");
      setShowBanner(false);
      setDeferredPrompt(null);
    };
    window.addEventListener("appinstalled", onAppInstalled);

    // iOS: no hay beforeinstallprompt — mostramos instrucciones manuales
    // si es iOS Safari y es la 3ra+ visita (más conservador para iOS porque
    // requieren pasos manuales)
    if (isIOS() && !isStandalone() && visitCount >= 3) {
      setTimeout(() => setShowIOSInstructions(true), 5000);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    track("pwa_install_clicked");
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    track("pwa_install_outcome", { outcome });

    if (outcome === "accepted") {
      console.log("[PWA] User aceptó instalación");
    }

    setDeferredPrompt(null);
    setShowBanner(false);
  };

  const handleDismiss = (source) => {
    track("pwa_install_dismissed", { source });
    // No volver a mostrar en 30 días
    const until = Date.now() + 30 * 24 * 60 * 60 * 1000;
    localStorage.setItem(STORAGE_KEY, String(until));
    setShowBanner(false);
    setShowIOSInstructions(false);
  };

  // ─── Banner para Chrome/Android ───────────────────────────────────────
  if (showBanner && deferredPrompt) {
    return (
      <div
        style={{
          position: "fixed",
          bottom: 16,
          left: 16,
          right: 16,
          maxWidth: 480,
          margin: "0 auto",
          background: T.bg,
          border: `1px solid ${T.border}`,
          borderRadius: 14,
          padding: 16,
          boxShadow: "0 12px 40px rgba(0,0,0,0.6)",
          zIndex: 9999,
          fontFamily: FONT,
          display: "flex",
          alignItems: "center",
          gap: 14,
          animation: "slideUp 0.3s ease-out",
        }}
      >
        <style>{`@keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>

        {/* Ícono */}
        <div
          style={{
            width: 48,
            height: 48,
            background: "#09090b",
            borderRadius: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            border: `1px solid ${T.border}`,
          }}
        >
          <span style={{ color: T.green, fontSize: 28, fontWeight: 800 }}>F</span>
        </div>

        {/* Texto */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.txt, marginBottom: 2 }}>
            Instalá FINPATHIA
          </div>
          <div style={{ fontSize: 12, color: T.txt2, lineHeight: 1.4 }}>
            Acceso directo desde tu pantalla de inicio
          </div>
        </div>

        {/* Botones */}
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button
            onClick={() => handleDismiss("banner")}
            style={{
              background: "transparent",
              border: "none",
              color: T.txt3,
              fontSize: 13,
              padding: "8px 4px",
              cursor: "pointer",
              fontFamily: FONT,
            }}
          >
            Ahora no
          </button>
          <button
            onClick={handleInstallClick}
            style={{
              background: T.green,
              color: "#000",
              border: "none",
              padding: "10px 18px",
              borderRadius: 99,
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: FONT,
            }}
          >
            Instalar
          </button>
        </div>
      </div>
    );
  }

  // ─── Banner para iOS Safari (instrucciones manuales) ──────────────────
  if (showIOSInstructions) {
    return (
      <div
        style={{
          position: "fixed",
          bottom: 16,
          left: 16,
          right: 16,
          maxWidth: 480,
          margin: "0 auto",
          background: T.bg,
          border: `1px solid ${T.border}`,
          borderRadius: 14,
          padding: 18,
          boxShadow: "0 12px 40px rgba(0,0,0,0.6)",
          zIndex: 9999,
          fontFamily: FONT,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
          <div
            style={{
              width: 44,
              height: 44,
              background: "#09090b",
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              border: `1px solid ${T.border}`,
            }}
          >
            <span style={{ color: T.green, fontSize: 24, fontWeight: 800 }}>F</span>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.txt, marginBottom: 2 }}>
              Instalá FINPATHIA en tu iPhone
            </div>
            <div style={{ fontSize: 12, color: T.txt2, lineHeight: 1.5 }}>
              1. Tocá el botón <strong style={{ color: T.txt }}>Compartir</strong> ⬆️ abajo
              <br />
              2. Bajá y elegí <strong style={{ color: T.txt }}>"Agregar a pantalla de inicio"</strong>
            </div>
          </div>
          <button
            onClick={() => handleDismiss("ios_instructions")}
            style={{
              background: "transparent",
              border: "none",
              color: T.txt3,
              fontSize: 18,
              cursor: "pointer",
              padding: 4,
            }}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  return null;
}
