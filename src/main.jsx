import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./tema.css";

// 28-oct-2026 — "Algo salió mal" al cambiar de sección. Cada publicación
// cambia el nombre de los archivos de cada sección; una pestaña abierta desde
// antes pide los viejos, que ya no existen (404), y la sección se cae.
// Solución: si falla la carga de un archivo de sección, se recarga la página
// UNA vez (para traer la versión nueva). El guardado evita un ciclo infinito
// si el problema fuera otro.
const esCargaFallida = (e) =>
  /dynamically imported module|Importing a module script failed|error loading dynamically|ChunkLoadError|Failed to fetch dynamically|Unable to preload/i
    .test(String(e?.message || e || ""));
function recargarUnaVez() {
  try {
    const k = "fp3_recarga_version";
    const ultima = Number(sessionStorage.getItem(k) || 0);
    if (Date.now() - ultima < 30000) return false;
    sessionStorage.setItem(k, String(Date.now()));
  } catch { /* sin sessionStorage: igual se recarga */ }
  window.location.reload();
  return true;
}
window.addEventListener("vite:preloadError", (ev) => { if (recargarUnaVez()) ev.preventDefault(); });
window.addEventListener("unhandledrejection", (ev) => { if (esCargaFallida(ev.reason)) recargarUnaVez(); });

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error, actualizando: esCargaFallida(error) }; }
  componentDidCatch(error, info) {
    console.error("FINPATHIA Error:", error, info);
    if (esCargaFallida(error) && !recargarUnaVez()) this.setState({ actualizando: false });
  }
  render() {
    if (this.state.hasError && this.state.actualizando) {
      return React.createElement("div", {style:{background:"var(--fp-bg)",color:"var(--fp-txt2)",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"system-ui",fontSize:14}},
        "Actualizando FINPATHIA a la versión nueva…");
    }
    if (this.state.hasError) {
      return React.createElement("div", {style:{background:"var(--fp-bg)",color:"var(--fp-txt)",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"system-ui"}},
        React.createElement("div", {style:{textAlign:"center",maxWidth:400,padding:32}},
          React.createElement("div", {style:{fontSize:48,marginBottom:16}}, "😵"),
          React.createElement("h1", {style:{fontSize:22,fontWeight:700,marginBottom:8}}, "Algo salió mal"),
          React.createElement("p", {style:{color:"var(--fp-txt3)",fontSize:14,marginBottom:24}}, "Puedes recargar o borrar datos locales."),
          React.createElement("div", {style:{display:"flex",gap:10,justifyContent:"center"}},
            React.createElement("button", {onClick:()=>window.location.reload(),style:{padding:"10px 20px",borderRadius:10,border:"none",background:"#00c805",color:"#000",fontWeight:700,cursor:"pointer"}}, "Recargar"),
            React.createElement("button", {onClick:()=>{localStorage.removeItem("fp3");window.location.reload()},style:{padding:"10px 20px",borderRadius:10,border:"1px solid rgba(var(--fp-ink),0.1)",background:"transparent",color:"var(--fp-txt2)",cursor:"pointer"}}, "Borrar datos")
          ),
          React.createElement("p", {style:{color:"var(--fp-line)",fontSize:12,marginTop:20}}, this.state.error?.message || "")
        )
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  React.createElement(ErrorBoundary, null, React.createElement(App))
);

// 29-oct-2026 — Aviso de versión nueva. Con despliegues seguidos, una pestaña abierta
// desde antes sigue mostrando la versión vieja (Santiago veía pantallas que ya no
// existían). Cada 3 minutos se compara el script principal publicado con el cargado;
// si cambió, aparece una barra discreta con «Actualizar».
(function avisoVersionNueva() {
  if (typeof window === "undefined" || import.meta.env?.DEV) return;
  const actual = [...document.querySelectorAll('script[type="module"][src]')].map((s) => s.getAttribute("src")).find((s) => /\/assets\//.test(s || ""));
  if (!actual) return;
  let mostrado = false;
  const revisar = async () => {
    if (mostrado || document.hidden) return;
    try {
      const html = await (await fetch("/index.html?v=" + Date.now(), { cache: "no-store" })).text();
      const m = html.match(/<script[^>]+type="module"[^>]+src="([^"]*\/assets\/[^"]+)"/);
      if (!m || m[1] === actual) return;
      mostrado = true;
      const b = document.createElement("div");
      b.setAttribute("role", "status");
      b.style.cssText = "position:fixed;left:50%;transform:translateX(-50%);bottom:18px;z-index:9999;background:var(--fp-card);color:var(--fp-txt);border:1px solid rgba(59,130,246,0.4);border-radius:12px;padding:10px 14px;display:flex;gap:12px;align-items:center;font:600 13px system-ui;box-shadow:0 8px 24px rgba(0,0,0,0.4)";
      b.innerHTML = '<span>Hay una versión nueva de FINPATHIA</span>';
      const btn = document.createElement("button");
      btn.textContent = "Actualizar";
      btn.style.cssText = "background:#3b82f6;color:var(--fp-txt);border:none;border-radius:8px;padding:7px 12px;font:700 13px system-ui;cursor:pointer";
      btn.onclick = () => window.location.reload();
      b.appendChild(btn);
      document.body.appendChild(b);
    } catch { /* sin red: se intenta en la próxima vuelta */ }
  };
  setInterval(revisar, 180000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) revisar(); });
})();
