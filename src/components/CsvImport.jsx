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
  inversiones: {
    label: "Inversiones", icon: "📈", key: "inv",
    fields: [
      { key: "nombre", label: "Nombre / Activo", required: true, aliases: ["nombre", "activo", "activos", "name", "propiedad", "descripcion", "item"] },
      { key: "valor", label: "Valor Actual", aliases: ["valor", "value", "precio", "monto", "saldo", "total", "balance", "avaluo"] },
      { key: "ingreso", label: "Ingreso Mensual", aliases: ["ingreso", "income", "renta", "revenue", "entrada", "arriendo"] },
      { key: "gasto", label: "Gasto Mensual", aliases: ["gasto", "expense", "egreso", "salida", "costo operativo"] },
      { key: "ubicacion", label: "Ubicación", aliases: ["ubicacion", "ubicación", "ciudad", "city", "location", "lugar"] },
    ],
    build: (row) => ({
      n: String(row.nombre || "").trim(),
      ub: String(row.ubicacion || "").trim(),
      tp: "Real Estate",
      va: Math.abs(parseFloat(String(row.valor || 0).replace(/[,$]/g, ""))) || 0,
      vc: 0,
      ig: row.ingreso ? [{ c: "Ingreso", m: Math.abs(Number(row.ingreso)) || 0, t: "f" }] : [],
      gs: row.gasto ? [{ c: "Gasto", m: Math.abs(Number(row.gasto)) || 0, t: "f" }] : [],
    }),
  },
  ingresos: {
    label: "Ingresos", icon: "💰", key: "ingresos",
    fields: [
      { key: "nombre", label: "Nombre / Concepto", required: true, aliases: ["nombre", "concepto", "descripcion", "fuente", "item", "ingreso"] },
      { key: "mensual", label: "Monto Mensual", required: true, aliases: ["monto", "mensual", "valor", "amount", "total", "ingreso"] },
      { key: "categoria", label: "Categoría", aliases: ["categoria", "categoría", "tipo", "type", "grupo"] },
    ],
    build: (row) => ({
      nombre: String(row.nombre || "").trim(),
      categoria: String(row.categoria || "Otro").trim(),
      mensual: Math.abs(Number(row.mensual)) || 0,
      tipo: "fijo",
      fuente: "",
    }),
  },
  gastos: {
    label: "Gastos", icon: "💳", key: "gastos", isGastos: true,
    fields: [
      { key: "concepto", label: "Concepto", required: true, aliases: ["concepto", "nombre", "descripcion", "gasto", "item"] },
      { key: "monto", label: "Monto Mensual", required: true, aliases: ["monto", "mensual", "valor", "amount", "total", "gasto"] },
      { key: "categoria", label: "Categoría", aliases: ["categoria", "categoría", "tipo", "grupo"] },
    ],
    build: (row) => ({
      cat: String(row.categoria || row.concepto || "Otro").trim(),
      c: String(row.concepto || row.nombre || "").trim(),
      m: Math.abs(parseFloat(String(row.monto || row.valor || 0).replace(/[,$]/g, ""))) || 0,
      t: "f",
    }),
  },
  deudas: {
    label: "Deudas", icon: "📋", key: "deudas",
    fields: [
      { key: "nombre", label: "Nombre", required: true, aliases: ["nombre", "deuda", "descripcion", "item", "acreedor"] },
      { key: "saldo", label: "Saldo / Monto", aliases: ["saldo", "monto", "total", "balance", "deuda", "capital"] },
      { key: "cuota", label: "Cuota Mensual", aliases: ["cuota", "pago", "mensual", "payment"] },
      { key: "tasa", label: "Tasa %", aliases: ["tasa", "interes", "interés", "rate", "%"] },
    ],
    build: (row) => ({
      n: String(row.nombre || "").trim(),
      tp: "loan",
      mt: Math.abs(Number(row.saldo)) || 0,
      pg: Math.abs(Number(row.cuota)) || 0,
      ts: Number(row.tasa) || 0,
      la: null,
    }),
  },
  trading: {
    label: "Trading", icon: "💹", key: "ibkr",
    fields: [
      { key: "ticker", label: "Ticker", required: true, aliases: ["ticker", "symbol", "símbolo", "codigo", "código"] },
      { key: "nombre", label: "Nombre", aliases: ["nombre", "name", "empresa", "company", "descripcion"] },
      { key: "cantidad", label: "Cantidad", aliases: ["cantidad", "shares", "qty", "acciones", "unidades"] },
      { key: "costo", label: "Costo", aliases: ["costo", "cost", "precio compra", "avg", "promedio"] },
      { key: "precio", label: "Precio Actual", aliases: ["precio", "price", "actual", "cotizacion"] },
    ],
    build: (row) => ({
      tk: String(row.ticker || "").trim().toUpperCase(),
      n: String(row.nombre || "").trim(),
      sh: Number(row.cantidad) || 0,
      cb: Number(row.costo) || 0,
      pr: Number(row.precio) || 0,
      tg: 0,
    }),
  },
};

// Find the best column match for a field
function autoMatchColumn(headers, field) {
  for (let i = 0; i < headers.length; i++) {
    const h = String(headers[i]).toLowerCase().trim();
    if (field.aliases.some((a) => h === a || h.includes(a) || a.includes(h))) {
      return i;
    }
  }
  return -1;
}

export default function CsvImport({ onImport, onClose }) {
  const [step, setStep] = useState(1);
  const [module, setModule] = useState(null);
  const [headers, setHeaders] = useState([]); // detected column headers
  const [dataRows, setDataRows] = useState([]); // raw data rows (arrays)
  const [colMap, setColMap] = useState({}); // { fieldKey: colIndex }
  const [parsed, setParsed] = useState([]);
  const [fileName, setFileName] = useState("");
  const fileRef = useRef();

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file || !module) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        let allRows;
        if (file.name.endsWith(".csv") || file.name.endsWith(".txt")) {
          const text = typeof ev.target.result === "string" ? ev.target.result : "";
          allRows = text.trim().split("\n").map((l) => l.split(",").map((v) => v.trim().replace(/^"|"$/g, "")));
        } else {
          const wb = XLSX.read(new Uint8Array(ev.target.result), { type: "array" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          allRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
        }

        // Find header row: first row with 2+ non-empty text cells
        let headerIdx = -1;
        for (let i = 0; i < Math.min(allRows.length, 20); i++) {
          const row = allRows[i] || [];
          const textCells = row.filter((v) => v !== null && v !== undefined && String(v).trim() !== "" && isNaN(Number(String(v).replace(/,/g, ""))));
          if (textCells.length >= 1) { headerIdx = i; break; }
        }

        if (headerIdx < 0) {
          alert("No se encontraron headers en el archivo");
          return;
        }

        // Find first non-empty column
        const headerRow = allRows[headerIdx];
        let startCol = 0;
        for (let c = 0; c < headerRow.length; c++) {
          if (headerRow[c] !== null && headerRow[c] !== undefined && String(headerRow[c]).trim() !== "") {
            startCol = c;
            break;
          }
        }

        // Extract headers (from startCol)
        const hdrs = headerRow.slice(startCol).map((h) => String(h || "").trim()).filter((h) => h !== "");
        setHeaders(hdrs);

        // Extract data rows
        const dRows = [];
        for (let i = headerIdx + 1; i < allRows.length; i++) {
          const row = (allRows[i] || []).slice(startCol);
          // Skip empty rows
          const nonEmpty = row.filter((v) => v !== null && v !== undefined && String(v).trim() !== "");
          if (nonEmpty.length < 1) continue;
          // Skip total rows
          const first = String(row[0] || "").toLowerCase().trim();
          if (["total", "totales", "subtotal", "sum"].includes(first)) continue;
          dRows.push(row);
        }
        setDataRows(dRows);

        // Auto-map columns
        const mod = MODULES[module];
        const mapping = {};
        mod.fields.forEach((field) => {
          const idx = autoMatchColumn(hdrs, field);
          if (idx >= 0) mapping[field.key] = idx;
        });
        setColMap(mapping);

        // Build items with current mapping
        buildItems(dRows, mapping);
        setStep(3);
      } catch (err) {
        alert("Error leyendo archivo: " + err.message);
      }
    };

    if (file.name.endsWith(".csv") || file.name.endsWith(".txt")) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  };

  const buildItems = (rows, mapping) => {
    const mod = MODULES[module];
    const items = [];
    (rows || dataRows).forEach((row, i) => {
      const mapped = {};
      mod.fields.forEach((field) => {
        const colIdx = (mapping || colMap)[field.key];
        mapped[field.key] = colIdx >= 0 && colIdx < row.length ? row[colIdx] : "";
      });

      const item = mod.build(mapped);
      item.id = mod.key[0] + "_" + Date.now() + "_" + i;

      // Check if item has at least a name or a value
      const nameVal = item.n || item.nombre || item.tk || item.c || item.cat || "";
      const hasContent = nameVal.trim().length > 0 || Object.values(item).some((v) => typeof v === "number" && v > 0);
      if (hasContent) items.push(item);
    });
    setParsed(items);
  };

  const updateMapping = (fieldKey, colIdx) => {
    const newMap = { ...colMap, [fieldKey]: parseInt(colIdx) };
    setColMap(newMap);
    buildItems(dataRows, newMap);
  };

  const handleConfirm = () => {
    if (!module || !parsed.length) return;
    const mod = MODULES[module];
    onImport(mod.key, parsed, mod.isGastos);
    onClose();
  };

  const fm = (v) => {
    if (v === null || v === undefined || v === "") return "—";
    if (Array.isArray(v)) return v.length > 0 ? v.map((x) => "$" + Math.round(x.m).toLocaleString()).join(", ") : "—";
    if (typeof v === "number") return v >= 1e6 ? "$" + (v / 1e6).toFixed(1) + "M" : v > 100 ? "$" + Math.round(v).toLocaleString() : String(v);
    return String(v) || "—";
  };

  // Get display name from item
  const getName = (item) => item.n || item.nombre || item.tk || item.c || item.cat || "—";

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 24, width: "100%", maxWidth: 820, maxHeight: "85vh", overflow: "auto", padding: 32 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h3 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: T.txt }}>📤 Importar desde Excel</h3>
            <p style={{ fontSize: 12, color: T.txt3, margin: "4px 0 0" }}>Sube cualquier Excel — tú eliges qué columna es qué</p>
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
                  <div style={{ fontSize: 11, color: T.txt3, marginTop: 4 }}>{m.fields.map((f) => f.label).join(", ")}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Upload */}
        {step === 2 && module && (
          <div>
            <p style={{ color: T.txt2, fontSize: 14, marginBottom: 16 }}>
              Sube tu archivo de <strong style={{ color: T.green }}>{MODULES[module].label}</strong>
            </p>
            <button onClick={() => setStep(1)} style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.txt3, padding: "8px 16px", borderRadius: 10, cursor: "pointer", fontSize: 13, marginBottom: 16 }}>← Cambiar módulo</button>
            <div onClick={() => fileRef.current?.click()} style={{ border: `2px dashed ${T.green}40`, borderRadius: 16, padding: 48, textAlign: "center", cursor: "pointer" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
              <p style={{ color: T.txt2, margin: "0 0 4px", fontSize: 14 }}>Click para subir archivo</p>
              <p style={{ color: T.txt3, fontSize: 12 }}>.xlsx, .xls, .csv — cualquier formato de columnas</p>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.txt" onChange={handleFile} style={{ display: "none" }} />
            </div>
          </div>
        )}

        {/* Step 3: Map columns + Preview */}
        {step === 3 && module && (
          <div>
            <p style={{ fontSize: 13, color: T.txt3, marginBottom: 12 }}>📄 {fileName} — {dataRows.length} filas detectadas</p>

            {/* Column Mapper */}
            <div style={{ background: T.card, borderRadius: 14, padding: 16, marginBottom: 16, border: `1px solid ${T.green}20` }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.green, marginBottom: 12 }}>🔗 Mapeo de Columnas</div>
              <p style={{ fontSize: 12, color: T.txt3, marginBottom: 12 }}>Verifica que cada campo esté conectado a la columna correcta de tu Excel. Si no es correcta, cámbiala:</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                {MODULES[module].fields.map((field) => (
                  <div key={field.key} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: field.required ? T.green : T.txt3, textTransform: "uppercase" }}>
                      {field.label} {field.required && <span style={{ color: T.red }}>*</span>}
                    </label>
                    <select
                      value={colMap[field.key] ?? -1}
                      onChange={(e) => updateMapping(field.key, e.target.value)}
                      style={{ background: T.bg3, border: `1px solid ${colMap[field.key] >= 0 ? T.green + "40" : T.border}`, borderRadius: 8, padding: "8px 10px", color: T.txt, fontSize: 13, outline: "none" }}
                    >
                      <option value={-1}>— No asignada —</option>
                      {headers.map((h, i) => (
                        <option key={i} value={i}>📊 {h}</option>
                      ))}
                    </select>
                    {colMap[field.key] >= 0 && (
                      <span style={{ fontSize: 10, color: T.green }}>✓ → "{headers[colMap[field.key]]}"</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Preview */}
            {parsed.length > 0 ? (
              <>
                <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                  <span style={{ background: T.greenDim, color: T.green, fontSize: 12, fontWeight: 600, padding: "4px 12px", borderRadius: 8 }}>✓ {parsed.length} registros listos</span>
                </div>

                <div style={{ overflowX: "auto", maxHeight: 300, borderRadius: 10, border: `1px solid ${T.border}`, marginBottom: 16 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr>{Object.keys(parsed[0]).filter((k) => !["id", "la", "link"].includes(k)).map((k) => (
                        <th key={k} style={{ padding: "8px 12px", color: T.txt3, borderBottom: `1px solid ${T.border}`, textAlign: "left", fontSize: 10, textTransform: "uppercase", position: "sticky", top: 0, background: T.bg2 }}>{k}</th>
                      ))}</tr>
                    </thead>
                    <tbody>{parsed.slice(0, 12).map((r, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${T.border}` }}>
                        {Object.entries(r).filter(([k]) => !["id", "la", "link"].includes(k)).map(([k, v]) => (
                          <td key={k} style={{ padding: "8px 12px", color: T.txt, fontWeight: k === "n" || k === "nombre" || k === "tk" ? 700 : 400 }}>{fm(v)}</td>
                        ))}
                      </tr>
                    ))}</tbody>
                  </table>
                </div>

                <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                  <button onClick={() => { setStep(2); setParsed([]); setHeaders([]); setDataRows([]); setColMap({}); setFileName(""); }}
                    style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.txt2, padding: "10px 20px", borderRadius: 10, cursor: "pointer", fontWeight: 600 }}>← Otro archivo</button>
                  <button onClick={handleConfirm} style={{ background: T.green, color: "#000", padding: "10px 24px", borderRadius: 10, cursor: "pointer", fontWeight: 700, border: "none" }}>
                    ✓ Importar {parsed.length} registros
                  </button>
                </div>
              </>
            ) : (
              <div style={{ textAlign: "center", padding: 24, color: T.txt3 }}>
                <p>No se detectaron datos con el mapeo actual. Ajusta las columnas arriba.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
