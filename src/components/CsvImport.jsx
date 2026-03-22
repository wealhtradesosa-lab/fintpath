import { useState, useRef } from "react";

const T = {
  bg: "#09090b", bg2: "#18181b", bg3: "#27272a",
  card: "#111113", cardBorder: "rgba(255,255,255,0.06)",
  txt: "#fafafa", txt2: "#a1a1aa", txt3: "#71717a",
  green: "#22c55e", greenDim: "rgba(34,197,94,0.1)",
  red: "#ef4444", redDim: "rgba(239,68,68,0.08)",
  blue: "#3b82f6", gold: "#eab308",
};

const TEMPLATES = {
  inversiones: {
    label: "Inversiones",
    headers: ["nombre", "ubicacion", "tipo", "valor_actual", "valor_compra"],
    example: "Beach House,Miami FL,Real Estate,599000,460000\nIndex Fund,Online,Investment,210000,105000",
    parse: (row) => ({ nombre: row[0], ubi: row[1], tipo: row[2], va: Number(row[3]) || 0, vc: Number(row[4]) || 0, ingresos: [], gastos: [] }),
    key: "inv",
  },
  gastos: {
    label: "Gastos",
    headers: ["categoria", "concepto", "monto_mensual", "tipo"],
    example: "Vivienda,Arriendo,2800,fijo\nVivienda,Luz,211,variable\nEducación,Colegio,763,fijo",
    parse: (row) => ({ cat: row[0] || "Otro", c: row[1], m: Number(row[2]) || 0, t: row[3] || "fijo" }),
    key: "gastos",
    isGastos: true,
  },
  deudas: {
    label: "Deudas",
    headers: ["nombre", "tipo", "saldo", "cuota_mensual", "tasa_interes"],
    example: "Hipoteca,mortgage,354000,3486,6.5\nTarjeta,credit_card,12000,120,15",
    parse: (row) => ({ nombre: row[0], tipo: row[1] || "loan", monto: Number(row[2]) || 0, pago: Number(row[3]) || 0, tasa: Number(row[4]) || 0, link: null }),
    key: "deudas",
  },
  trading: {
    label: "Trading",
    headers: ["ticker", "nombre", "cantidad", "costo_promedio", "precio_actual", "precio_objetivo", "sector"],
    example: "AAPL,Apple,25,155,198.5,220,Tech\nMSFT,Microsoft,15,310,430,500,Tech",
    parse: (row) => ({ ticker: row[0], nombre: row[1], shares: Number(row[2]) || 0, cost: Number(row[3]) || 0, precio: Number(row[4]) || 0, target: Number(row[5]) || 0, sector: row[6] || "" }),
    key: "ibkr",
  },
};

export default function CsvImport({ onImport, onClose }) {
  const [step, setStep] = useState(1);
  const [module, setModule] = useState(null);
  const [parsed, setParsed] = useState([]);
  const [errors, setErrors] = useState([]);
  const fileRef = useRef();

  const downloadTemplate = (mod) => {
    const tpl = TEMPLATES[mod];
    const csv = tpl.headers.join(",") + "\n" + tpl.example;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `finpath_${mod}_template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file || !module) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const lines = ev.target.result.trim().split("\n");
      const tpl = TEMPLATES[module];
      const rows = [];
      const errs = [];
      const startIdx = lines[0].toLowerCase().includes(tpl.headers[0]) ? 1 : 0;
      for (let i = startIdx; i < lines.length; i++) {
        const vals = lines[i].split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
        if (vals.length < 2) { errs.push(`Fila ${i + 1}: muy pocos campos`); continue; }
        try {
          const item = tpl.parse(vals);
          item.id = tpl.key[0] + Date.now() + "_" + i;
          rows.push(item);
        } catch (e) {
          errs.push(`Fila ${i + 1}: error de formato`);
        }
      }
      setParsed(rows);
      setErrors(errs);
      setStep(3);
    };
    reader.readAsText(file);
  };

  const handleConfirm = () => {
    if (!module || !parsed.length) return;
    const tpl = TEMPLATES[module];
    onImport(tpl.key, parsed, tpl.isGastos);
    onClose();
  };

  const fmt = (n) => "$" + Math.round(n).toLocaleString();

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: T.bg2, border: `1px solid ${T.cardBorder}`, borderRadius: 24, width: "100%", maxWidth: 700, maxHeight: "85vh", overflow: "auto", padding: 32 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h3 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: T.txt }}>📤 Importar desde CSV</h3>
          <button onClick={onClose} style={{ background: T.bg3, border: "none", color: T.txt3, cursor: "pointer", width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>

        {/* Step 1: Select module */}
        {step === 1 && (
          <div>
            <p style={{ color: T.txt2, fontSize: 14, marginBottom: 20 }}>¿Qué datos quieres importar?</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {Object.entries(TEMPLATES).map(([key, tpl]) => (
                <button key={key} onClick={() => { setModule(key); setStep(2); }} style={{
                  padding: 20, borderRadius: 14, border: `1px solid ${T.cardBorder}`,
                  background: T.card, cursor: "pointer", textAlign: "left", transition: "all 0.2s",
                }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>
                    {key === "inversiones" ? "📈" : key === "gastos" ? "💳" : key === "deudas" ? "📋" : "💹"}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.txt }}>{tpl.label}</div>
                  <div style={{ fontSize: 11, color: T.txt3, marginTop: 4 }}>{tpl.headers.join(", ")}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Upload file */}
        {step === 2 && module && (
          <div>
            <p style={{ color: T.txt2, fontSize: 14, marginBottom: 16 }}>Sube un archivo CSV con tus datos de <strong style={{ color: T.green }}>{TEMPLATES[module].label}</strong></p>
            <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
              <button onClick={() => downloadTemplate(module)} style={{ background: T.bg3, border: `1px solid ${T.cardBorder}`, color: T.txt2, padding: "10px 18px", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                📥 Descargar Plantilla
              </button>
              <button onClick={() => setStep(1)} style={{ background: "transparent", border: `1px solid ${T.cardBorder}`, color: T.txt3, padding: "10px 18px", borderRadius: 10, cursor: "pointer", fontSize: 13 }}>
                ← Cambiar módulo
              </button>
            </div>
            <div style={{ background: T.card, borderRadius: 14, padding: 12, marginBottom: 16, border: `1px solid ${T.cardBorder}` }}>
              <div style={{ fontSize: 12, color: T.txt3, marginBottom: 6 }}>Columnas esperadas:</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {TEMPLATES[module].headers.map((h) => (
                  <span key={h} style={{ background: `${T.green}15`, color: T.green, fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 6 }}>{h}</span>
                ))}
              </div>
            </div>
            <div onClick={() => fileRef.current?.click()} style={{ border: `2px dashed ${T.cardBorder}`, borderRadius: 16, padding: 48, textAlign: "center", cursor: "pointer", transition: "border-color 0.2s" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
              <p style={{ color: T.txt2, margin: "0 0 4px", fontSize: 14 }}>Click para subir archivo</p>
              <p style={{ color: T.txt3, fontSize: 12 }}>CSV separado por comas</p>
              <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile} style={{ display: "none" }} />
            </div>
          </div>
        )}

        {/* Step 3: Preview & confirm */}
        {step === 3 && (
          <div>
            <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
              <span style={{ background: T.greenDim, color: T.green, fontSize: 12, fontWeight: 600, padding: "4px 12px", borderRadius: 8 }}>
                ✓ {parsed.length} registros encontrados
              </span>
              {errors.length > 0 && (
                <span style={{ background: T.redDim, color: T.red, fontSize: 12, fontWeight: 600, padding: "4px 12px", borderRadius: 8 }}>
                  ⚠ {errors.length} errores
                </span>
              )}
            </div>
            {errors.length > 0 && (
              <div style={{ background: T.redDim, borderRadius: 10, padding: 12, marginBottom: 12 }}>
                {errors.slice(0, 5).map((e, i) => <p key={i} style={{ color: T.red, fontSize: 12, margin: "3px 0" }}>{e}</p>)}
              </div>
            )}
            {parsed.length > 0 && (
              <div style={{ overflowX: "auto", maxHeight: 250, borderRadius: 10, border: `1px solid ${T.cardBorder}`, marginBottom: 16 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr>
                      {Object.keys(parsed[0]).filter((k) => k !== "id" && k !== "ingresos" && k !== "gastos" && k !== "link").map((k) => (
                        <th key={k} style={{ padding: "8px 12px", color: T.txt3, borderBottom: `1px solid ${T.cardBorder}`, textAlign: "left", fontSize: 10, textTransform: "uppercase" }}>{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.slice(0, 8).map((r, i) => (
                      <tr key={i}>
                        {Object.entries(r).filter(([k]) => k !== "id" && k !== "ingresos" && k !== "gastos" && k !== "link").map(([k, v]) => (
                          <td key={k} style={{ padding: "8px 12px", color: T.txt, borderBottom: `1px solid ${T.cardBorder}` }}>
                            {typeof v === "number" ? (v > 100 ? fmt(v) : v) : String(v)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsed.length > 8 && <p style={{ padding: 12, color: T.txt3, fontSize: 12, textAlign: "center" }}>...y {parsed.length - 8} más</p>}
              </div>
            )}
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button onClick={() => { setStep(2); setParsed([]); setErrors([]); }} style={{ background: "transparent", border: `1px solid ${T.cardBorder}`, color: T.txt2, padding: "10px 20px", borderRadius: 10, cursor: "pointer", fontWeight: 600 }}>← Atrás</button>
              <button onClick={handleConfirm} style={{ background: T.green, color: "#000", padding: "10px 24px", borderRadius: 10, cursor: "pointer", fontWeight: 700, border: "none" }}>
                ✓ Importar {parsed.length} registros
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
