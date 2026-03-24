import { useState, useRef } from "react";
import * as XLSX from "xlsx";

const T = {
  bg2: "#18181b", bg3: "#1e1e24",
  card: "#111113", border: "rgba(255,255,255,0.06)",
  txt: "#fafafa", txt2: "#a1a1aa", txt3: "#71717a",
  green: "#22c55e", greenDim: "rgba(34,197,94,0.1)",
  red: "#ef4444", redDim: "rgba(239,68,68,0.08)",
  blue: "#3b82f6", orange: "#f97316",
};

const TEMPLATES = {
  inversiones: {
    label: "Inversiones", icon: "📈",
    headers: ["nombre", "ubicacion", "tipo", "valor_actual", "valor_compra"],
    example: [["Beach House", "Miami FL", "Real Estate", 599000, 460000], ["Index Fund", "Online", "Investment", 210000, 105000]],
    parse: (row) => ({ nombre: row[0] || "", ubi: row[1] || "", tipo: row[2] || "Other", va: Number(row[3]) || 0, vc: Number(row[4]) || 0, ingresos: [], gastos: [] }),
    key: "inv",
  },
  ingresos: {
    label: "Ingresos", icon: "💰",
    headers: ["nombre", "categoria", "monto_mensual", "tipo", "fuente"],
    example: [["Salario", "Salario", 8500, "fijo", "Empresa"], ["Freelance", "Freelance", 2400, "variable", "Clientes"]],
    parse: (row) => ({ nombre: row[0] || "", categoria: row[1] || "Otro", mensual: Number(row[2]) || 0, tipo: row[3] || "fijo", fuente: row[4] || "" }),
    key: "ingresos",
  },
  gastos: {
    label: "Gastos", icon: "💳",
    headers: ["categoria", "concepto", "monto_mensual", "tipo"],
    example: [["Vivienda", "Arriendo", 2800, "fijo"], ["Vivienda", "Luz", 211, "variable"], ["Educación", "Colegio", 763, "fijo"]],
    parse: (row) => ({ cat: row[0] || "Otro", c: row[1] || "", m: Number(row[2]) || 0, t: row[3] || "fijo" }),
    key: "gastos",
    isGastos: true,
  },
  deudas: {
    label: "Deudas", icon: "📋",
    headers: ["nombre", "tipo", "saldo", "cuota_mensual", "tasa_interes"],
    example: [["Hipoteca", "mortgage", 354000, 3486, 6.5], ["Tarjeta", "credit_card", 12000, 120, 15]],
    parse: (row) => ({ nombre: row[0] || "", tipo: row[1] || "loan", monto: Number(row[2]) || 0, pago: Number(row[3]) || 0, tasa: Number(row[4]) || 0, link: null }),
    key: "deudas",
  },
  trading: {
    label: "Trading", icon: "💹",
    headers: ["ticker", "nombre", "cantidad", "costo_promedio", "precio_actual", "precio_objetivo", "sector"],
    example: [["AAPL", "Apple", 25, 155, 198.5, 220, "Tech"], ["MSFT", "Microsoft", 15, 310, 430, 500, "Tech"]],
    parse: (row) => ({ ticker: row[0] || "", nombre: row[1] || "", shares: Number(row[2]) || 0, cost: Number(row[3]) || 0, precio: Number(row[4]) || 0, target: Number(row[5]) || 0, sector: row[6] || "" }),
    key: "ibkr",
  },
};

export default function CsvImport({ onImport, onClose }) {
  const [step, setStep] = useState(1);
  const [module, setModule] = useState(null);
  const [parsed, setParsed] = useState([]);
  const [errors, setErrors] = useState([]);
  const [fileName, setFileName] = useState("");
  const fileRef = useRef();

  const downloadTemplate = (mod) => {
    const tpl = TEMPLATES[mod];
    const ws = XLSX.utils.aoa_to_sheet([tpl.headers, ...tpl.example]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, tpl.label);
    // Set column widths
    ws["!cols"] = tpl.headers.map(() => ({ wch: 18 }));
    XLSX.writeFile(wb, `finpath_${mod}_plantilla.xlsx`);
  };

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file || !module) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const tpl = TEMPLATES[module];
        let rawRows;

        if (file.name.endsWith(".csv") || file.name.endsWith(".txt")) {
          // Parse CSV
          const text = ev.target.result;
          const lines = text.trim().split("\n");
          const startIdx = lines[0].toLowerCase().includes(tpl.headers[0].toLowerCase()) ? 1 : 0;
          rawRows = lines.slice(startIdx).map((l) => l.split(",").map((v) => v.trim().replace(/^"|"$/g, "")));
        } else {
          // Parse Excel (.xlsx, .xls)
          const data = new Uint8Array(ev.target.result);
          const wb = XLSX.read(data, { type: "array" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
          // Skip header row if it matches template headers
          const first = (json[0] || []).map((v) => String(v).toLowerCase().trim());
          const isHeader = tpl.headers.some((h) => first.includes(h.toLowerCase()));
          rawRows = isHeader ? json.slice(1) : json;
        }

        const rows = [];
        const errs = [];
        rawRows.forEach((vals, i) => {
          if (!vals || vals.length < 2 || vals.every((v) => !v && v !== 0)) return; // skip empty rows
          try {
            const item = tpl.parse(vals);
            item.id = tpl.key[0] + Date.now() + "_" + i;
            rows.push(item);
          } catch {
            errs.push(`Fila ${i + 1}: error de formato`);
          }
        });
        setParsed(rows);
        setErrors(errs);
        setStep(3);
      } catch (err) {
        setErrors(["Error leyendo archivo: " + err.message]);
        setParsed([]);
        setStep(3);
      }
    };
    // Read as text for CSV, as array buffer for Excel
    if (file.name.endsWith(".csv") || file.name.endsWith(".txt")) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  };

  const handleConfirm = () => {
    if (!module || !parsed.length) return;
    const tpl = TEMPLATES[module];
    onImport(tpl.key, parsed, tpl.isGastos);
    onClose();
  };

  const fmt = (n) => typeof n === "number" && n > 100 ? "$" + Math.round(n).toLocaleString() : String(n);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 24, width: "100%", maxWidth: 720, maxHeight: "85vh", overflow: "auto", padding: 32 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h3 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: T.txt }}>📤 Importar desde Excel o CSV</h3>
          <button onClick={onClose} style={{ background: T.bg3, border: "none", color: T.txt3, cursor: "pointer", width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>

        {/* Step 1 */}
        {step === 1 && (
          <div>
            <p style={{ color: T.txt2, fontSize: 14, marginBottom: 20 }}>¿Qué datos quieres importar?</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {Object.entries(TEMPLATES).map(([key, tpl]) => (
                <button key={key} onClick={() => { setModule(key); setStep(2); }} style={{ padding: 20, borderRadius: 14, border: `1px solid ${T.border}`, background: T.card, cursor: "pointer", textAlign: "left", transition: "all 0.2s" }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>{tpl.icon}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.txt }}>{tpl.label}</div>
                  <div style={{ fontSize: 11, color: T.txt3, marginTop: 4 }}>{tpl.headers.join(", ")}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && module && (
          <div>
            <p style={{ color: T.txt2, fontSize: 14, marginBottom: 16 }}>
              Sube un archivo <strong style={{ color: T.green }}>Excel (.xlsx)</strong> o <strong style={{ color: T.blue }}>CSV</strong> con tus {TEMPLATES[module].label.toLowerCase()}
            </p>
            <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
              <button onClick={() => downloadTemplate(module)} style={{ background: T.green, border: "none", color: "#000", padding: "10px 18px", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
                📥 Descargar Plantilla Excel
              </button>
              <button onClick={() => setStep(1)} style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.txt3, padding: "10px 18px", borderRadius: 10, cursor: "pointer", fontSize: 13 }}>
                ← Cambiar módulo
              </button>
            </div>
            <div style={{ background: T.card, borderRadius: 14, padding: 14, marginBottom: 16, border: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 12, color: T.txt3, marginBottom: 8 }}>Columnas esperadas:</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {TEMPLATES[module].headers.map((h) => (
                  <span key={h} style={{ background: T.greenDim, color: T.green, fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 6 }}>{h}</span>
                ))}
              </div>
              <div style={{ fontSize: 11, color: T.txt3, marginTop: 8 }}>
                💡 <strong>Tip:</strong> Descarga la plantilla, llénala con tus datos y súbela. También acepta archivos CSV.
              </div>
            </div>
            <div onClick={() => fileRef.current?.click()} style={{ border: `2px dashed ${T.border}`, borderRadius: 16, padding: 48, textAlign: "center", cursor: "pointer" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
              <p style={{ color: T.txt2, margin: "0 0 4px", fontSize: 14 }}>Click para subir archivo</p>
              <p style={{ color: T.txt3, fontSize: 12 }}>.xlsx, .xls, .csv</p>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.txt" onChange={handleFile} style={{ display: "none" }} />
            </div>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <div>
            {fileName && <p style={{ fontSize: 13, color: T.txt3, marginBottom: 12 }}>📄 {fileName}</p>}
            <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
              <span style={{ background: T.greenDim, color: T.green, fontSize: 12, fontWeight: 600, padding: "4px 12px", borderRadius: 8 }}>✓ {parsed.length} registros</span>
              {errors.length > 0 && <span style={{ background: T.redDim, color: T.red, fontSize: 12, fontWeight: 600, padding: "4px 12px", borderRadius: 8 }}>⚠ {errors.length} errores</span>}
            </div>
            {errors.length > 0 && (
              <div style={{ background: T.redDim, borderRadius: 10, padding: 12, marginBottom: 12 }}>
                {errors.slice(0, 5).map((e, i) => <p key={i} style={{ color: T.red, fontSize: 12, margin: "3px 0" }}>{e}</p>)}
              </div>
            )}
            {parsed.length > 0 && (
              <div style={{ overflowX: "auto", maxHeight: 280, borderRadius: 10, border: `1px solid ${T.border}`, marginBottom: 16 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr>{Object.keys(parsed[0]).filter((k) => !["id", "ingresos", "gastos", "link"].includes(k)).map((k) => (
                      <th key={k} style={{ padding: "8px 12px", color: T.txt3, borderBottom: `1px solid ${T.border}`, textAlign: "left", fontSize: 10, textTransform: "uppercase", position: "sticky", top: 0, background: T.bg2 }}>{k}</th>
                    ))}</tr>
                  </thead>
                  <tbody>{parsed.slice(0, 10).map((r, i) => (
                    <tr key={i}>{Object.entries(r).filter(([k]) => !["id", "ingresos", "gastos", "link"].includes(k)).map(([k, v]) => (
                      <td key={k} style={{ padding: "8px 12px", color: T.txt, borderBottom: `1px solid ${T.border}` }}>{typeof v === "number" ? fmt(v) : String(v)}</td>
                    ))}</tr>
                  ))}</tbody>
                </table>
                {parsed.length > 10 && <p style={{ padding: 12, color: T.txt3, fontSize: 12, textAlign: "center" }}>...y {parsed.length - 10} más</p>}
              </div>
            )}
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button onClick={() => { setStep(2); setParsed([]); setErrors([]); setFileName(""); }} style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.txt2, padding: "10px 20px", borderRadius: 10, cursor: "pointer", fontWeight: 600 }}>← Atrás</button>
              <button onClick={handleConfirm} disabled={!parsed.length} style={{ background: T.green, color: "#000", padding: "10px 24px", borderRadius: 10, cursor: "pointer", fontWeight: 700, border: "none", opacity: parsed.length ? 1 : 0.4 }}>
                ✓ Importar {parsed.length} registros
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
