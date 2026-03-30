import { useState, useRef } from "react";
import * as XLSX from "xlsx";

/* ═══════════════════════════════════════════════════
   EXCEL IMPORT — AI-Powered
   Reads ANY Excel format → Claude analyzes → structured data
   ═══════════════════════════════════════════════════ */

const T = {
  bg2: "#18181b", bg3: "#1e1e24",
  card: "#111113", border: "rgba(255,255,255,0.06)",
  txt: "#fafafa", txt2: "#a1a1aa", txt3: "#71717a",
  green: "#22c55e", greenDim: "rgba(34,197,94,0.1)",
  red: "#ef4444", redDim: "rgba(239,68,68,0.08)",
  blue: "#3b82f6", purple: "#a78bfa",
};

const MODULES = {
  inversiones: {
    label: "Inversiones / Activos", icon: "📈", key: "inv",
    prompt: `Extrae cada inversión o activo. Para CADA fila de datos devuelve un JSON con:
- "n": nombre del activo (string, OBLIGATORIO)
- "ub": ubicación (string, "" si no hay)
- "tp": tipo - "Real Estate", "Investment", "Trading", "Income", "Cash" o "Crypto"
- "va": valor actual (número)
- "vc": valor de compra (número, 0 si no hay)
- "ig": array de ingresos mensuales, ej: [{"c":"Arriendo","m":4200,"t":"f"}] (vacío [] si no hay)
- "gs": array de gastos mensuales, ej: [{"c":"Admin","m":500,"t":"f"}] (vacío [] si no hay)`,
  },
  ingresos: {
    label: "Ingresos", icon: "💰", key: "ingresos",
    prompt: `Extrae cada fuente de ingreso. Para CADA fila devuelve un JSON con:
- "nombre": nombre/descripción (string, OBLIGATORIO)
- "categoria": "Salario", "Freelance", "Arriendo", "Inversión", "Negocio", "Dividendos", "Pensión" u "Otro"
- "mensual": monto mensual (número)
- "tipo": "fijo" o "variable"
- "fuente": origen (string, "" si no hay)`,
  },
  gastos: {
    label: "Gastos", icon: "💳", key: "gastos", isGastos: true,
    prompt: `Extrae cada gasto. Para CADA fila devuelve un JSON con:
- "cat": categoría ("Vivienda", "Educación", "Salud", "Transporte", "Alimentación", "Entretenimiento" u "Otro")
- "c": concepto/descripción (string, OBLIGATORIO)
- "m": monto mensual (número, si es anual divide entre 12)
- "t": "f" para fijo o "v" para variable`,
  },
  deudas: {
    label: "Deudas", icon: "📋", key: "deudas",
    prompt: `Extrae cada deuda. Para CADA fila devuelve un JSON con:
- "n": nombre de la deuda (string, OBLIGATORIO)
- "tp": "mortgage", "loan", "personal" o "credit_card"
- "mt": saldo total (número)
- "pg": cuota mensual (número)
- "ts": tasa de interés anual en % (número)
- "la": null`,
  },
  trading: {
    label: "Trading / Acciones", icon: "💹", key: "ibk",
    prompt: `Extrae cada posición bursátil. Para CADA fila devuelve un JSON con:
- "tk": ticker/símbolo (string, OBLIGATORIO)
- "n": nombre completo (string)
- "sh": cantidad de acciones (número)
- "cb": precio de compra promedio (número)
- "pr": precio actual (número)
- "tg": precio objetivo (número, 0 si no hay)`,
  },
};

// Convert Excel workbook to readable text for AI
function excelToText(workbook) {
  const parts = [];
  for (const name of workbook.SheetNames) {
    const ws = workbook.Sheets[name];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: true });
    let text = `HOJA: ${name}\n`;
    for (let r = 0; r < Math.min(rows.length, 60); r++) {
      const row = rows[r] || [];
      const cells = row.map((v, c) => {
        if (v === null || v === undefined || v === "") return null;
        return `[${String.fromCharCode(65 + c)}]=${v}`;
      }).filter(Boolean);
      if (cells.length > 0) text += `Fila${r + 1}: ${cells.join(" | ")}\n`;
    }
    parts.push(text);
  }
  return parts.join("\n");
}

// Call our API route which calls Claude
async function analyzeWithAI(excelText, modulePrompt) {
  // Trim excel text if too long (API limit)
  const trimmedText = excelText.length > 15000 ? excelText.slice(0, 15000) + "\n...datos truncados..." : excelText;
  
  let res;
  try {
    res = await fetch("/api/analyze-excel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ excelText: trimmedText, modulePrompt }),
    });
  } catch (fetchErr) {
    throw new Error("No se pudo conectar con el servidor. Verifica tu conexión.");
  }
  
  if (!res.ok) {
    throw new Error("Error del servidor: " + res.status + ". Verifica que ANTHROPIC_API_KEY esté configurada en Netlify.");
  }
  
  let data;
  try {
    const text = await res.text();
    data = JSON.parse(text);
  } catch {
    throw new Error("Respuesta inválida del servidor. Verifica la configuración de la API.");
  }
  
  if (data.error) throw new Error(data.error);
  if (data.fallback) throw new Error("Para importar con IA necesitas configurar ANTHROPIC_API_KEY en Netlify → Site configuration → Environment variables.");
  return data.items || [];
}

// Format for display
const fmt = (v) => {
  if (v === null || v === undefined || v === "") return "—";
  if (Array.isArray(v)) return v.length > 0 ? v.map((x) => `${x.c}: $${Math.round(x.m).toLocaleString()}`).join(", ") : "—";
  if (typeof v === "number") {
    if (Math.abs(v) >= 1e9) return "$" + (v / 1e9).toFixed(1) + "B";
    if (Math.abs(v) >= 1e6) return "$" + (v / 1e6).toFixed(1) + "M";
    if (Math.abs(v) >= 1e3) return "$" + Math.round(v).toLocaleString();
    return String(v);
  }
  return String(v);
};

export default function CsvImport({ onImport, onClose }) {
  const [step, setStep] = useState(1);        // 1=module, 2=upload, 3=preview
  const [module, setModule] = useState(null);
  const [parsed, setParsed] = useState([]);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef();

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file || !module) return;
    setFileName(file.name);
    setLoading(true);
    setError("");
    setParsed([]);

    try {
      // 1. Read file
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(new Uint8Array(buffer), { type: "array" });
      const excelText = excelToText(wb);

      // 2. Send to AI
      const mod = MODULES[module];
      const items = await analyzeWithAI(excelText, mod.prompt);

      if (!Array.isArray(items) || items.length === 0) {
        setError("La IA no encontró datos válidos. Verifica que el archivo tenga la información correcta.");
      } else {
        // Add IDs
        items.forEach((item, i) => { item.id = mod.key[0] + "_" + Date.now() + "_" + i; });
        setParsed(items);
      }
      setStep(3);
    } catch (err) {
      // AI failed — show error with instructions
      setError(
        err.message === "API key not configured"
          ? "Para importar con IA necesitas configurar ANTHROPIC_API_KEY en Vercel → Settings → Environment Variables. Mientras tanto, ingresa los datos manualmente."
          : "Error: " + err.message
      );
      setStep(3);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (!module || !parsed.length) return;
    const mod = MODULES[module];
    onImport(mod.key, parsed, mod.isGastos);
    onClose();
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 24, width: "100%", maxWidth: 780, maxHeight: "88vh", overflow: "auto", padding: 32 }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
          <div>
            <h3 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: T.txt }}>🧠 Importar Excel con IA</h3>
            <p style={{ fontSize: 13, color: T.txt3, margin: "6px 0 0" }}>
              Sube cualquier Excel — la inteligencia artificial detecta y organiza tus datos automáticamente
            </p>
          </div>
          <button onClick={onClose} style={{ background: T.bg3, border: "none", color: T.txt3, cursor: "pointer", width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>✕</button>
        </div>

        {/* ─── STEP 1: Choose Module ─── */}
        {step === 1 && (
          <div>
            <p style={{ color: T.txt2, fontSize: 14, marginBottom: 20 }}>¿Qué tipo de datos contiene tu archivo?</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {Object.entries(MODULES).map(([key, m]) => (
                <button key={key} onClick={() => { setModule(key); setStep(2); }}
                  style={{ padding: 24, borderRadius: 16, border: `1px solid ${T.border}`, background: T.card, cursor: "pointer", textAlign: "left", transition: "border-color 0.2s" }}>
                  <div style={{ fontSize: 28, marginBottom: 10 }}>{m.icon}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: T.txt, marginBottom: 4 }}>{m.label}</div>
                  <div style={{ fontSize: 12, color: T.txt3, lineHeight: 1.4 }}>
                    La IA detecta las columnas automáticamente sin importar el formato
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ─── STEP 2: Upload File ─── */}
        {step === 2 && module && !loading && (
          <div>
            <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
              <button onClick={() => { setStep(1); setModule(null); }}
                style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.txt3, padding: "8px 16px", borderRadius: 10, cursor: "pointer", fontSize: 13 }}>← Cambiar</button>
              <span style={{ background: T.purple + "15", color: T.purple, fontSize: 13, fontWeight: 600, padding: "8px 16px", borderRadius: 10 }}>
                {MODULES[module].icon} {MODULES[module].label}
              </span>
            </div>

            <div style={{ background: T.card, borderRadius: 16, padding: 20, marginBottom: 20, border: `1px solid ${T.purple}20` }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.purple, marginBottom: 8 }}>🧠 ¿Cómo funciona?</div>
              <div style={{ fontSize: 13, color: T.txt2, lineHeight: 1.7 }}>
                1. Subes tu archivo Excel — cualquier formato, cualquier estructura<br />
                2. La IA de Claude analiza el contenido y entiende qué es cada columna<br />
                3. Te muestra un preview de los datos detectados<br />
                4. Confirmas e importas a FINPATH
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                {["Columnas en cualquier orden", "Headers en cualquier fila", "Fórmulas y cálculos", "Español o inglés", "COP o USD"].map((t) => (
                  <span key={t} style={{ background: T.purple + "10", color: T.purple, fontSize: 10, fontWeight: 600, padding: "4px 10px", borderRadius: 6 }}>{t}</span>
                ))}
              </div>
            </div>

            <div onClick={() => fileRef.current?.click()}
              style={{ border: `2px dashed ${T.purple}40`, borderRadius: 20, padding: 56, textAlign: "center", cursor: "pointer", transition: "border-color 0.2s" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
              <p style={{ color: T.txt, margin: "0 0 6px", fontSize: 16, fontWeight: 600 }}>Click para subir tu archivo</p>
              <p style={{ color: T.txt3, fontSize: 13 }}>.xlsx, .xls, .csv — cualquier formato</p>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.txt" onChange={handleFile} style={{ display: "none" }} />
            </div>
          </div>
        )}

        {/* ─── LOADING ─── */}
        {loading && (
          <div style={{ textAlign: "center", padding: 60 }}>
            <div style={{ width: 64, height: 64, margin: "0 auto 20px", borderRadius: 20, background: T.purple + "15", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ fontSize: 32, animation: "spin 2s ease-in-out infinite" }}>🧠</div>
            </div>
            <p style={{ color: T.purple, fontWeight: 700, fontSize: 16 }}>La IA está analizando tu archivo...</p>
            <p style={{ color: T.txt3, fontSize: 13, marginTop: 6 }}>Detectando columnas, interpretando datos y organizando la información</p>
            <style>{`@keyframes spin{0%{transform:rotate(0deg)}25%{transform:rotate(10deg)}75%{transform:rotate(-10deg)}100%{transform:rotate(0deg)}}`}</style>
          </div>
        )}

        {/* ─── STEP 3: Preview & Confirm ─── */}
        {step === 3 && !loading && (
          <div>
            <p style={{ fontSize: 13, color: T.txt3, marginBottom: 12 }}>📄 {fileName}</p>

            {/* Error */}
            {error && (
              <div style={{ background: T.redDim, borderRadius: 14, padding: 20, marginBottom: 16, border: `1px solid ${T.red}20` }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.red, marginBottom: 6 }}>⚠ {error}</div>
                <button onClick={() => { setStep(2); setError(""); setParsed([]); setFileName(""); }}
                  style={{ background: T.bg3, border: "none", color: T.txt2, padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13, marginTop: 8 }}>
                  Intentar con otro archivo
                </button>
              </div>
            )}

            {/* Success — Preview */}
            {parsed.length > 0 && (
              <>
                <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
                  <span style={{ background: T.greenDim, color: T.green, fontSize: 13, fontWeight: 700, padding: "6px 16px", borderRadius: 10 }}>
                    ✓ {parsed.length} registros detectados
                  </span>
                  <span style={{ background: T.purple + "15", color: T.purple, fontSize: 13, fontWeight: 600, padding: "6px 16px", borderRadius: 10 }}>
                    🧠 Análisis IA completado
                  </span>
                </div>

                <div style={{ overflowX: "auto", maxHeight: 360, borderRadius: 14, border: `1px solid ${T.border}`, marginBottom: 20 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr>
                        {Object.keys(parsed[0]).filter((k) => k !== "id" && k !== "la" && k !== "link").map((k) => (
                          <th key={k} style={{ padding: "10px 14px", color: T.txt3, borderBottom: `1px solid ${T.border}`, textAlign: "left", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", position: "sticky", top: 0, background: T.bg2 }}>{k}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.slice(0, 15).map((row, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${T.border}` }}>
                          {Object.entries(row).filter(([k]) => k !== "id" && k !== "la" && k !== "link").map(([k, v]) => (
                            <td key={k} style={{ padding: "10px 14px", color: T.txt, fontWeight: ["n", "nombre", "tk", "c"].includes(k) ? 700 : 400 }}>
                              {fmt(v)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parsed.length > 15 && (
                    <p style={{ padding: 14, color: T.txt3, fontSize: 12, textAlign: "center" }}>...y {parsed.length - 15} registros más</p>
                  )}
                </div>

                <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                  <button onClick={() => { setStep(2); setParsed([]); setError(""); setFileName(""); }}
                    style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.txt2, padding: "12px 24px", borderRadius: 12, cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
                    ← Otro archivo
                  </button>
                  <button onClick={handleConfirm}
                    style={{ background: T.green, color: "#000", padding: "12px 28px", borderRadius: 12, cursor: "pointer", fontWeight: 800, border: "none", fontSize: 14 }}>
                    ✓ Importar {parsed.length} registros
                  </button>
                </div>
              </>
            )}

            {/* No results and no error */}
            {!error && parsed.length === 0 && (
              <div style={{ textAlign: "center", padding: 40, color: T.txt3 }}>
                <p style={{ fontSize: 14 }}>No se detectaron datos en el archivo.</p>
                <button onClick={() => { setStep(2); setError(""); }}
                  style={{ background: T.bg3, border: "none", color: T.txt2, padding: "10px 20px", borderRadius: 10, cursor: "pointer", marginTop: 12, fontSize: 13 }}>
                  Intentar de nuevo
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
