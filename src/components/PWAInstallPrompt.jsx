// ════════════════════════════════════════════════════════════════════════════
// FINPATHIA · PWAInstallPrompt.jsx — Sesión 5-may-2026 (rediseño v3)
//
// Santiago reportó que el banner anterior tenía "varios botones, uno no sabe
// cuál" y al presionarlos no pasaba nada. Era confuso porque mostraba 3 pasos
// con bullets numerados que parecían botones, más SVG del icono Compartir.
//
// REDISEÑO RADICAL:
//   - UN SOLO banner discreto abajo del todo
//   - UN SOLO botón principal de acción
//   - En Android/Chrome: botón "Instalar" → instala (nativo via prompt)
//   - En iOS: botón "Ver cómo" → abre modal con instrucciones claras
//   - Botón "✕" sutil para cerrar
//
// Toda la lógica de skipWaiting + auto-update se mantiene (funciona bien).
// El banner es la pieza que se rediseña.
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

function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

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
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [isOnIOS] = useState(() => isIOS());

  // ─── Registrar el Service Worker + auto-update ──────────────────────────
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    let reloadGuard = false;

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        console.log("[PWA] Service Worker registrado");

        if (reg.waiting && navigator.serviceWorker.controller) {
          reg.waiting.postMessage({ type: "SKIP_WAITING" });
        }

        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              newWorker.postMessage({ type: "SKIP_WAITING" });
            }
          });
        });

        setInterval(() => { reg.update().catch(() => {}); }, 60000);
      } catch (err) {
        console.warn("[PWA] Falló registro de SW:", err);
      }
    };

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloadGuard) return;
      reloadGuard = true;
      window.location.reload();
    });

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register);
  }, []);

  // ─── Mostrar el banner cuando aplica ────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone()) return; // ya instalada

    // Verificar si fue dismissed recientemente
    const dismissedUntil = localStorage.getItem(STORAGE_KEY);
    if (dismissedUntil && Date.now() < parseInt(dismissedUntil, 10)) return;

    // Contar visitas
    const visitCount = parseInt(localStorage.getItem(VISIT_COUNT_KEY) || "0", 10) + 1;
    localStorage.setItem(VISIT_COUNT_KEY, String(visitCount));

    // Android/Chrome: capturar evento beforeinstallprompt
    const onBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (visitCount >= 2) {
        setTimeout(() => setShowBanner(true), 3000);
      }
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);

    const onAppInstalled = () => {
      track("pwa_installed");
      setShowBanner(false);
      setDeferredPrompt(null);
    };
    window.addEventListener("appinstalled", onAppInstalled);

    // iOS: mostrar banner directamente (no hay beforeinstallprompt)
    if (isOnIOS && visitCount >= 2) {
      setTimeout(() => setShowBanner(true), 4000);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, [isOnIOS]);

  const handleMainAction = async () => {
    if (isOnIOS) {
      // En iOS abrimos el modal con instrucciones
      track("pwa_ios_modal_opened");
      setShowIOSModal(true);
    } else if (deferredPrompt) {
      // En Android/Chrome instalamos nativo
      track("pwa_install_clicked");
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      track("pwa_install_outcome", { outcome });
      setDeferredPrompt(null);
      setShowBanner(false);
    }
  };

  const handleDismiss = () => {
    track("pwa_install_dismissed");
    const until = Date.now() + 30 * 24 * 60 * 60 * 1000;
    localStorage.setItem(STORAGE_KEY, String(until));
    setShowBanner(false);
    setShowIOSModal(false);
  };

  // ─── Banner principal (uno solo, simple, claro) ─────────────────────────
  if (showBanner && (deferredPrompt || isOnIOS)) {
    return (
      <>
        <div
          style={{
            position: "fixed",
            bottom: 16,
            left: 16,
            right: 16,
            maxWidth: 440,
            margin: "0 auto",
            background: T.bg,
            border: `1px solid ${T.border}`,
            borderRadius: 14,
            padding: 14,
            boxShadow: "0 12px 40px rgba(0,0,0,0.6)",
            zIndex: 9999,
            fontFamily: FONT,
            display: "flex",
            alignItems: "center",
            gap: 12,
            animation: "fpSlideUp 0.3s ease-out",
          }}
        >
          <style>{`@keyframes fpSlideUp{from{transform:translateY(120%);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>

          {/* Ícono */}
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

          {/* Texto + acción */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.txt, marginBottom: 2 }}>
              Instalar FINPATHIA
            </div>
            <div style={{ fontSize: 11, color: T.txt2, lineHeight: 1.3 }}>
              {isOnIOS ? "Tenela como app en tu iPhone" : "Acceso directo desde tu pantalla de inicio"}
            </div>
          </div>

          {/* UN SOLO botón claro */}
          <button
            onClick={handleMainAction}
            style={{
              background: T.green,
              color: "#000",
              border: "none",
              padding: "10px 16px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: FONT,
              flexShrink: 0,
              whiteSpace: "nowrap",
            }}
          >
            {isOnIOS ? "Ver cómo" : "Instalar"}
          </button>

          {/* Cerrar pequeñito y discreto */}
          <button
            onClick={handleDismiss}
            aria-label="Cerrar"
            style={{
              background: "transparent",
              border: "none",
              color: T.txt3,
              fontSize: 18,
              cursor: "pointer",
              padding: 4,
              flexShrink: 0,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Modal iOS con instrucciones detalladas (solo se abre cuando user toca "Ver cómo") */}
        {showIOSModal && (
          <div
            onClick={() => setShowIOSModal(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.7)",
              backdropFilter: "blur(8px)",
              zIndex: 10000,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 20,
              fontFamily: FONT,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: T.bg,
                borderRadius: 16,
                padding: 24,
                maxWidth: 380,
                width: "100%",
                border: `1px solid ${T.border}`,
                position: "relative",
              }}
            >
              <button
                onClick={() => setShowIOSModal(false)}
                style={{
                  position: "absolute",
                  top: 12,
                  right: 12,
                  background: "transparent",
                  border: "none",
                  color: T.txt3,
                  fontSize: 22,
                  cursor: "pointer",
                  padding: 4,
                  lineHeight: 1,
                }}
                aria-label="Cerrar"
              >
                ✕
              </button>

              <div style={{ fontSize: 16, fontWeight: 800, color: T.txt, marginBottom: 4 }}>
                📱 Instalar en iPhone
              </div>
              <div style={{ fontSize: 12, color: T.txt2, marginBottom: 20, lineHeight: 1.5 }}>
                Hace falta hacer 3 pasos manuales en Safari (Apple no lo permite automático).
              </div>

              {/* Paso 1 — con SVG del icono real grande */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.txt, marginBottom: 8 }}>
                  Paso 1
                </div>
                <div style={{ fontSize: 13, color: T.txt2, lineHeight: 1.5, marginBottom: 10 }}>
                  Tocá el ícono <strong style={{ color: T.txt }}>Compartir</strong> en la barra inferior de Safari. Se ve así:
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "rgba(0,122,255,0.10)",
                    border: "1px dashed rgba(0,122,255,0.4)",
                    borderRadius: 10,
                    padding: "16px 8px",
                    gap: 12,
                  }}
                >
                  <svg width="32" height="40" viewBox="0 0 16 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8 1L8 13M8 1L4 5M8 1L12 5" stroke="#3b82f6" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M2 9V17C2 18.1 2.9 19 4 19H12C13.1 19 14 18.1 14 17V9" stroke="#3b82f6" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                  <div style={{ fontSize: 11, color: T.txt3, textAlign: "left", lineHeight: 1.4 }}>
                    Cuadrado con flecha<br/>hacia arriba
                  </div>
                </div>
              </div>

              {/* Paso 2 */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.txt, marginBottom: 6 }}>
                  Paso 2
                </div>
                <div style={{ fontSize: 13, color: T.txt2, lineHeight: 1.5 }}>
                  Bajá en la lista que aparece y tocá <strong style={{ color: T.txt }}>"Agregar a inicio"</strong>
                </div>
              </div>

              {/* Paso 3 */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.txt, marginBottom: 6 }}>
                  Paso 3
                </div>
                <div style={{ fontSize: 13, color: T.txt2, lineHeight: 1.5 }}>
                  Tocá <strong style={{ color: T.txt }}>"Agregar"</strong> arriba a la derecha. Listo.
                </div>
              </div>

              <div
                style={{
                  fontSize: 11,
                  color: T.txt3,
                  background: "rgba(255,255,255,0.04)",
                  padding: 12,
                  borderRadius: 8,
                  lineHeight: 1.5,
                  marginBottom: 16,
                }}
              >
                💡 ¿No ves la barra inferior de Safari? Deslizá un poco hacia abajo en la página y aparece.
              </div>

              <button
                onClick={() => setShowIOSModal(false)}
                style={{
                  width: "100%",
                  background: T.green,
                  color: "#000",
                  border: "none",
                  padding: "12px",
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: FONT,
                }}
              >
                Entendido
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
}
