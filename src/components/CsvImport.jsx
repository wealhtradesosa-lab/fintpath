import { useState, useRef } from "react";
import * as XLSX from "xlsx";

const T = {
  bg2: "#18181b", bg3: "#1e1e24",
  card: "#111113", border: "rgba(255,255,255,0.06)",
  txt: "#fafafa", txt2: "#a1a1aa", txt3: "#71717a",
  green: "#22c55e", greenDim: "rgba(34,197,94,0.1)",
  red: "#ef4444", redDim: "rgba(239,68,68,0.08)",
  blue: "#3b82f6", orange: "#f97316", purple: "#a78bfa",
};

const MODULES = {
  inversiones: { label: "Inversiones", icon: "📈", key: "inv",
    prompt: `Extrae inversiones/activos de este Excel. Para CADA fila devuelve un objeto JSON con estos campos:
- "n": nombre del activo (string)
- "ub": ubicación o ciudad (string, "" si no hay)
- "tp": tipo - uno de: "Real Estate", "Investment", "Trading", "Income", "Cash", "Crypto" (inferir del contexto)
- "va": valor actual en número (si hay fórmulas, usar el valor calculado)
- "vc": valor de compra/costo en número (0 si no hay)
- "ig": array de ingresos [{c: "concepto", m: monto_mensual, t: "f"}] (vacío si no hay)
- "gs": array de gastos [{c: "concepto", m: monto_mensual, t: "f"}] (vacío si no hay)
Si hay columnas de ingreso mensual y gasto mensual, ponlas en ig y gs respectivamente.
Ignora filas de totales o subtotales. Los montos deben ser números positivos.`
  },
  ingresos: { label: "Ingresos", icon: "💰", key: "ingresos",
    prompt: `Extrae fuentes de ingreso de este Excel. Para CADA fila devuelve un objeto JSON con:
- "nombre": nombre/descripción del ingreso (string)
- "categoria": una de: "Salario", "Freelance", "Arriendo", "Inversión", "Negocio", "Dividendos", "Pensión", "Otro"
- "mensual": monto mensual en número
- "tipo": "fijo" o "variable" (inferir del contexto)
- "fuente": origen/empresa (string, "" si no hay)
Ignora filas de totales.`
  },
  gastos: { label: "Gastos", icon: "💳", key: "gastos", isGastos: true,
    prompt: `Extrae gastos de este Excel. Para CADA fila devuelve un objeto JSON con:
- "cat": categoría del gasto (ej: "Vivienda", "Educación", "Salud", "Transporte", "Alimentación", "Entretenimiento", "Otro")
- "c": concepto/descripción (string)
- "m": monto mensual en número
- "t": "f" para fijo o "v" para variable
Ignora filas de totales. Si el monto es anual, divídelo entre 12.`
  },
  deudas: { label: "Deudas", icon: "📋", key: "deudas",
    prompt: `Extrae deudas/obligaciones de este Excel. Para CADA fila devuelve un objeto JSON con:
- "n": nombre de la deuda (string)
- "tp": tipo - uno de: "mortgage", "loan", "personal", "credit_card"
- "mt": saldo/monto total de la deuda en número
- "pg": pago/cuota mensual en número
- "ts": tasa de interés anual en porcentaje (número, ej: 6.5)
- "la": null (se vincula después)
Ignora filas de totales.`
  },
  trading: { label: "Trading", icon: "💹", key: "ibkr",
    prompt: `Extrae posiciones de trading/inversión bursátil de este Excel. Para CADA fila devuelve un objeto JSON con:
- "tk": ticker/símbolo (string, ej: "AAPL")
- "n": nombre completo (string)
- "sh": cantidad de acciones/unidades (número)
- "cb": precio de compra/costo promedio (número)
- "pr": precio actual (número)
- "tg": precio objetivo/target (número, 0 si no hay)
Ignora filas de totales.`
  },
};

function excelToText(workbook) {
  const sheets = [];
  for (const name of workbook.SheetNames) {
    const ws = workbook.Sheets[name];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: true });
    // Convert to readable text table
    let text = `=== Hoja: ${name} ===\n`;
    for (let r = 0; r < Math.min(data.length, 50); r++) {
      const row = data[r] || [];
      const vals = row.map((v, c) => {
        if (v === null || v === undefined || v === "") return "";
        return `Col${c + 1}=${v}`;
      }).filter(Boolean);
      if (vals.length > 0) text += `Fila ${r + 1}: ${vals.join(" | ")}\n`;
    }
    sheets.push(text);
  }
  return sheets.join("\n");
}

async function analyzeWithAI(excelText, modulePrompt) {
  try {
    // Try AI-powered analysis via our API route
    const response = await fetch("/api/analyze-excel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ excelText, modulePrompt }),
    });
    const data = await response.json();
    if (data.items && data.items.length > 0) return data.items;
    if (data.fallback) throw new Error("fallback");
    if (data.error) throw new Error(data.error);
    return [];
  } catch (err) {
    console.warn("AI not available, using smart parser:", err.message);
    // Fallback: smart column detection without AI
    return smartParse(excelText);
  }
}

function smartParse(excelText) {
  const lines = excelText.split("\n").filter(l => l.startsWith("Fila "));
  if (lines.length === 0) return [];
  
  // Parse all rows into arrays of {col, value}
  const rows = lines.map(line => {
    const pairs = line.replace(/^Fila \d+: /, "").split(" | ");
    return pairs.map(p => {
      const m = p.match(/^Col(\d+)=(.+)$/);
      return m ? { col: parseInt(m[1]), val: m[2] } : null;
    }).filter(Boolean);
  });
  
  // Find header row (first row where most values are text, not numbers)
  let headerIdx = 0;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const textCount = rows[i].filter(c => isNaN(Number(c.val)) && c.val.length > 1).length;
    if (textCount >= 2) { headerIdx = i; break; }
  }
  
  // Get column positions from header
  const headers = {};
  const KEYWORDS = {
    name: ["nombre", "activo", "activos", "name", "concepto", "descripcion", "item", "propiedad"],
    value: ["valor", "value", "precio", "monto", "saldo", "total", "balance"],
    income: ["ingreso", "income", "renta", "revenue", "entrada"],
    expense: ["gasto", "expense", "egreso", "salida", "costo"],
    location: ["ubicacion", "ubicación", "ciudad", "location", "lugar"],
    type: ["tipo", "type", "categoria", "categoría"],
    rate: ["tasa", "rate", "interes", "interés"],
    payment: ["pago", "cuota", "payment"],
  };
  
  rows[headerIdx]?.forEach(c => {
    const v = c.val.toLowerCase().trim();
    for (const [key, words] of Object.entries(KEYWORDS)) {
      if (words.some(w => v.includes(w))) {
        if (!headers[key]) headers[key] = c.col;
      }
    }
  });
  
  // If no headers detected, use position: first text col = name, first number = value
  const dataRows = rows.slice(headerIdx + 1);
  const items = [];
  
  for (const row of dataRows) {
    if (row.length < 1) continue;
    const vals = {};
    row.forEach(c => { vals[c.col] = c.val; });
    
    // Skip total/subtotal rows
    const firstText = row.find(c => isNaN(Number(c.val)));
    if (firstText && /^(total|subtotal|sum)/i.test(firstText.val.trim())) continue;
    
    // Extract fields
    const name = headers.name ? vals[headers.name] : (firstText?.val || "");
    const value = headers.value ? Number(vals[headers.value]) || 0 : 0;
    const income = headers.income ? Number(vals[headers.income]) || 0 : 0;
    const expense = headers.expense ? Number(vals[headers.expense]) || 0 : 0;
    
    if (!name && !value) continue;
    
    items.push({
      n: String(name).trim(),
      ub: headers.location ? String(vals[headers.location] || "").trim() : "",
      tp: "Real Estate",
      va: value,
      vc: 0,
      ig: income > 0 ? [{ c: "Ingreso", m: income, t: "f" }] : [],
      gs: expense > 0 ? [{ c: "Gasto", m: expense, t: "f" }] : [],
    });
  }
  
  return items;
}

export default function CsvImport({ onImport, onClose }) {
  const [step, setStep] = useState(1);
  const [module, setModule] = useState(null);
  const [parsed, setParsed] = useState([]);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rawPreview, setRawPreview] = useState("");
  const fileRef = useRef();

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file || !module) return;
    setFileName(file.name);
    setLoading(true);
    setError("");

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(new Uint8Array(buffer), { type: "array" });
      const excelText = excelToText(wb);
      setRawPreview(excelText.slice(0, 500));

      // Send to AI for analysis
      const mod = MODULES[module];
      const items = await analyzeWithAI(excelText, mod.prompt);

      if (!Array.isArray(items) || items.length === 0) {
        setError("No se encontraron datos válidos en el archivo. Intenta con otro formato.");
        setParsed([]);
      } else {
        // Add IDs
        items.forEach((item, i) => { item.id = mod.key[0] + "_" + Date.now() + "_" + i; });
        setParsed(items);
      }
      setStep(3);
    } catch (err) {
      setError(err.message || "Error procesando archivo");
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

  const downloadTemplate = () => {
    const mod = MODULES[module];
    const headers = { inversiones: ["nombre", "ubicacion", "tipo", "valor_actual", "valor_compra", "ingreso_mensual", "gasto_mensual"], ingresos: ["nombre", "categoria", "monto_mensual", "tipo", "fuente"], gastos: ["categoria", "concepto", "monto_mensual", "tipo"], deudas: ["nombre", "tipo", "saldo", "cuota_mensual", "tasa"], trading: ["ticker", "nombre", "cantidad", "costo", "precio_actual", "target", "sector"] };
    const ws = XLSX.utils.aoa_to_sheet([headers[module] || []]);
    ws["!cols"] = (headers[module] || []).map(() => ({ wch: 18 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, mod.label);
    XLSX.writeFile(wb, `finpath_${module}_plantilla.xlsx`);
  };

  const fmt = (v) => {
    if (v === null || v === undefined) return "—";
    if (Array.isArray(v)) return v.length > 0 ? v.map(x => `${x.c}: $${x.m}`).join(", ") : "—";
    if (typeof v === "number") return v >= 1e6 ? "$" + (v / 1e6).toFixed(1) + "M" : v > 100 ? "$" + Math.round(v).toLocaleString() : String(v);
    return String(v) || "—";
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 24, width: "100%", maxWidth: 780, maxHeight: "85vh", overflow: "auto", padding: 32 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h3 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: T.txt }}>📤 Importar Excel con IA</h3>
            <p style={{ fontSize: 12, color: T.txt3, margin: "4px 0 0" }}>La IA lee tu archivo y detecta automáticamente las columnas</p>
          </div>
          <button onClick={onClose} style={{ background: T.bg3, border: "none", color: T.txt3, cursor: "pointer", width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>

        {/* Step 1: Choose module */}
        {step === 1 && (
          <div>
            <p style={{ color: T.txt2, fontSize: 14, marginBottom: 20 }}>¿Qué datos quieres importar?</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {Object.entries(MODULES).map(([key, m]) => (
                <button key={key} onClick={() => { setModule(key); setStep(2); }} style={{ padding: 20, borderRadius: 14, border: `1px solid ${T.border}`, background: T.card, cursor: "pointer", textAlign: "left" }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>{m.icon}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.txt }}>{m.label}</div>
                  <div style={{ fontSize: 11, color: T.txt3, marginTop: 4 }}>IA detecta las columnas automáticamente</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Upload */}
        {step === 2 && module && (
          <div>
            <p style={{ color: T.txt2, fontSize: 14, marginBottom: 16 }}>
              Sube tu archivo de <strong style={{ color: T.green }}>{MODULES[module].label}</strong> — cualquier formato
            </p>
            <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
              <button onClick={downloadTemplate} style={{ background: T.bg3, border: `1px solid ${T.border}`, color: T.txt2, padding: "10px 18px", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>📥 Plantilla</button>
              <button onClick={() => setStep(1)} style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.txt3, padding: "10px 18px", borderRadius: 10, cursor: "pointer", fontSize: 13 }}>← Cambiar</button>
            </div>

            <div style={{ background: T.card, borderRadius: 14, padding: 16, marginBottom: 16, border: `1px solid ${T.purple}20` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 16 }}>🧠</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: T.purple }}>Importación Inteligente con IA</span>
              </div>
              <div style={{ fontSize: 12, color: T.txt2, lineHeight: 1.6 }}>
                No importa cómo esté organizado tu Excel. La IA analiza el contenido y detecta automáticamente qué es cada columna, sin importar:
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                {["Columnas en cualquier posición", "Headers en cualquier fila", "Fórmulas y cálculos", "Formatos mixtos", "Español o Inglés"].map((t) => (
                  <span key={t} style={{ background: T.purple + "12", color: T.purple, fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 6 }}>{t}</span>
                ))}
              </div>
            </div>

            {loading ? (
              <div style={{ textAlign: "center", padding: 48 }}>
                <div style={{ fontSize: 32, marginBottom: 12, animation: "spin 1s linear infinite" }}>🧠</div>
                <p style={{ color: T.purple, fontWeight: 600 }}>Analizando tu archivo con IA...</p>
                <p style={{ color: T.txt3, fontSize: 13 }}>Detectando columnas y extrayendo datos</p>
                <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
              </div>
            ) : (
              <div onClick={() => fileRef.current?.click()} style={{ border: `2px dashed ${T.purple}40`, borderRadius: 16, padding: 48, textAlign: "center", cursor: "pointer" }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
                <p style={{ color: T.txt2, margin: "0 0 4px", fontSize: 14 }}>Click para subir tu archivo</p>
                <p style={{ color: T.txt3, fontSize: 12 }}>.xlsx, .xls, .csv — cualquier formato de columnas</p>
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.txt" onChange={handleFile} style={{ display: "none" }} />
              </div>
            )}
          </div>
        )}

        {/* Step 3: Preview */}
        {step === 3 && (
          <div>
            {fileName && <p style={{ fontSize: 13, color: T.txt3, marginBottom: 8 }}>📄 {fileName}</p>}

            {error && (
              <div style={{ background: T.redDim, borderRadius: 10, padding: 16, marginBottom: 12, border: `1px solid ${T.red}20` }}>
                <p style={{ color: T.red, fontSize: 13, margin: 0, fontWeight: 600 }}>⚠ {error}</p>
                <button onClick={() => { setStep(2); setError(""); setParsed([]); }} style={{ background: T.bg3, border: "none", color: T.txt2, padding: "6px 14px", borderRadius: 8, cursor: "pointer", fontSize: 12, marginTop: 8 }}>Intentar de nuevo</button>
              </div>
            )}

            {parsed.length > 0 && (
              <>
                <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                  <span style={{ background: T.greenDim, color: T.green, fontSize: 12, fontWeight: 600, padding: "4px 12px", borderRadius: 8 }}>✓ {parsed.length} registros detectados por IA</span>
                  <span style={{ background: T.purple + "15", color: T.purple, fontSize: 12, fontWeight: 600, padding: "4px 12px", borderRadius: 8 }}>🧠 Análisis automático</span>
                </div>

                <div style={{ overflowX: "auto", maxHeight: 350, borderRadius: 10, border: `1px solid ${T.border}`, marginBottom: 16 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr>{Object.keys(parsed[0]).filter((k) => !["id", "la", "link"].includes(k)).map((k) => (
                        <th key={k} style={{ padding: "8px 12px", color: T.txt3, borderBottom: `1px solid ${T.border}`, textAlign: "left", fontSize: 10, textTransform: "uppercase", position: "sticky", top: 0, background: T.bg2 }}>{k}</th>
                      ))}</tr>
                    </thead>
                    <tbody>{parsed.slice(0, 15).map((r, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${T.border}` }}>
                        {Object.entries(r).filter(([k]) => !["id", "la", "link"].includes(k)).map(([k, v]) => (
                          <td key={k} style={{ padding: "8px 12px", color: T.txt }}>{fmt(v)}</td>
                        ))}
                      </tr>
                    ))}</tbody>
                  </table>
                  {parsed.length > 15 && <p style={{ padding: 12, color: T.txt3, fontSize: 12, textAlign: "center" }}>...y {parsed.length - 15} más</p>}
                </div>

                <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                  <button onClick={() => { setStep(2); setParsed([]); setError(""); setFileName(""); }} style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.txt2, padding: "10px 20px", borderRadius: 10, cursor: "pointer", fontWeight: 600 }}>← Atrás</button>
                  <button onClick={handleConfirm} style={{ background: T.green, color: "#000", padding: "10px 24px", borderRadius: 10, cursor: "pointer", fontWeight: 700, border: "none" }}>
                    ✓ Importar {parsed.length} registros
                  </button>
                </div>
              </>
            )}

            {!error && parsed.length === 0 && !loading && (
              <div style={{ textAlign: "center", padding: 32, color: T.txt3 }}>
                <p>No se detectaron datos. Intenta con otro archivo.</p>
                <button onClick={() => { setStep(2); setError(""); }} style={{ background: T.bg3, border: "none", color: T.txt2, padding: "8px 16px", borderRadius: 8, cursor: "pointer", marginTop: 8 }}>Intentar de nuevo</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
