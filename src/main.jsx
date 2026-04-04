import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { console.error("FINPATH Error:", error, info); }
  render() {
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
