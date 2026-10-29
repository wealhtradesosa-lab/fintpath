import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

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
      return React.createElement("div", {style:{background:"#09090b",color:"#a1a1aa",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"system-ui",fontSize:14}},
        "Actualizando FINPATHIA a la versión nueva…");
    }
    if (this.state.hasError) {
      return React.createElement("div", {style:{background:"#09090b",color:"#fafafa",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"system-ui"}},
        React.createElement("div", {style:{textAlign:"center",maxWidth:400,padding:32}},
          React.createElement("div", {style:{fontSize:48,marginBottom:16}}, "😵"),
          React.createElement("h1", {style:{fontSize:22,fontWeight:700,marginBottom:8}}, "Algo salió mal"),
          React.createElement("p", {style:{color:"#71717a",fontSize:14,marginBottom:24}}, "Puedes recargar o borrar datos locales."),
          React.createElement("div", {style:{display:"flex",gap:10,justifyContent:"center"}},
            React.createElement("button", {onClick:()=>window.location.reload(),style:{padding:"10px 20px",borderRadius:10,border:"none",background:"#22c55e",color:"#000",fontWeight:700,cursor:"pointer"}}, "Recargar"),
            React.createElement("button", {onClick:()=>{localStorage.removeItem("fp3");window.location.reload()},style:{padding:"10px 20px",borderRadius:10,border:"1px solid rgba(255,255,255,0.1)",background:"transparent",color:"#a1a1aa",cursor:"pointer"}}, "Borrar datos")
          ),
          React.createElement("p", {style:{color:"#3f3f46",fontSize:11,marginTop:20}}, this.state.error?.message || "")
        )
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  React.createElement(ErrorBoundary, null, React.createElement(App))
);
