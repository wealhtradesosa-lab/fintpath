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

// Smart column name matching
const COLUMN_ALIASES = {
  nombre: ["nombre", "activo", "activos", "name", "concepto", "descripcion", "descripción", "item", "fuente"],
  ubicacion: ["ubicacion", "ubicación", "ciudad", "city", "location", "lugar", "dirección", "direccion"],
  tipo: ["tipo", "type", "categoria", "categoría", "category", "clase"],
  valor_actual: ["valor", "valor_actual", "valor actual", "value", "precio", "monto", "saldo", "balance", "total"],
  valor_compra: ["valor_compra", "valor compra", "costo", "cost", "precio compra", "inversion", "inversión"],
  ingreso: ["ingreso", "ingreso mensual", "ingresos", "income", "renta", "mensual", "revenue"],
  gasto: ["gasto", "gasto mensual", "gastos", "expense", "egreso", "egresos"],
  neto: ["neto", "net", "utilidad", "ganancia", "profit", "resultado"],
  mensual: ["mensual", "monto", "monto_mensual", "monto mensual", "monthly", "valor", "amount"],
  tasa: ["tasa", "tasa_interes", "tasa interes", "rate", "interes", "interés", "%"],
  pago: ["pago", "cuota", "cuota_mensual", "cuota mensual", "payment"],
  saldo: ["saldo", "monto", "balance", "deuda", "debt", "total"],
  ticker: ["ticker", "symbol", "símbolo", "simbolo", "código", "codigo"],
  shares: ["cantidad", "shares", "qty", "acciones", "unidades"],
  precio: ["precio", "price", "precio_actual", "cotización"],
  costo: ["costo", "cost", "precio_compra", "avg cost", "costo_promedio"],
  target: ["objetivo", "target", "meta", "precio_objetivo"],
  sector: ["sector", "industry", "industria"],
  fuente: ["fuente", "source", "origen", "empresa", "company"],
  categoria: ["categoria", "categoría", "category", "tipo", "type", "grupo"],
};

function matchColumn(header, aliases) {
  const h = String(header).toLowerCase().trim();
  for (const [key, names] of Object.entries(aliases)) {
    if (names.some((n) => h === n || h.includes(n))) return key;
  }
  return null;
}

function cleanRows(rawData) {
  // 1. Find header row (first row with 3+ non-empty cells that contains text)
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rawData.length, 15); i++) {
    const row = rawData[i] || [];
    const nonEmpty = row.filter((v) => v !== null && v !== undefined && String(v).trim() !== "");
    const hasText = nonEmpty.some((v) => typeof v === "string" && v.length > 1 && isNaN(Number(v)));
    if (nonEmpty.length >= 2 && hasText) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) return { headers: [], rows: [] };

  // 2. Find first non-empty column
  let startCol = 0;
  const headerRow = rawData[headerIdx] || [];
  for (let c = 0; c < headerRow.length; c++) {
    if (headerRow[c] !== null && headerRow[c] !== undefined && String(headerRow[c]).trim() !== "") {
      startCol = c;
      break;
    }
  }

  // 3. Extract headers (trimmed, from startCol)
  const headers = headerRow.slice(startCol).map((h) => String(h || "").trim());

  // 4. Extract data rows (skip header, skip empty rows, skip "TOTAL" rows)
  const rows = [];
  for (let i = headerIdx + 1; i < rawData.length; i++) {
    const raw = (rawData[i] || []).slice(startCol);
    const nonEmpty = raw.filter((v) => v !== null && v !== undefined && String(v).trim() !== "");
    if (nonEmpty.length < 1) continue;
    // Skip total/summary rows
    const firstVal = String(raw[0] || "").toLowerCase().trim();
    if (firstVal === "total" || firstVal === "totales" || firstVal === "subtotal" || firstVal === "sum") continue;
    rows.push(raw);
  }

  return { headers, rows, startCol };
}

const MODULES = {
  inversiones: {
    label: "Inversiones", icon: "📈",
    templateHeaders: ["nombre", "ubicacion", "tipo", "valor_actual", "valor_compra", "ingreso_mensual", "gasto_mensual"],
    templateExample: [["Puerto Madero", "El Peñol", "Real Estate", 500000, 300000, 4000, 2000], ["Fondo Inversión", "Online", "Investment", 200000, 150000, 3000, 0]],
    buildItem: (row, colMap) => ({
      n: row[colMap.nombre] || row[0] || "",
      ub: row[colMap.ubicacion] || row[1] || "",
      tp: row[colMap.tipo] || "Real Estate",
      va: Number(row[colMap.valor_actual] ?? row[colMap.valor] ?? row[colMap.saldo]) || 0,
      vc: Number(row[colMap.valor_compra] ?? row[colMap.costo]) || 0,
      ig: row[colMap.ingreso] != null ? [{ c: "Ingreso", m: Number(row[colMap.ingreso]) || 0, t: "f" }] : [],
      gs: row[colMap.gasto] != null ? [{ c: "Gasto", m: Number(row[colMap.gasto]) || 0, t: "f" }] : [],
    }),
    key: "inv",
  },
  ingresos: {
    label: "Ingresos", icon: "💰",
    templateHeaders: ["nombre", "categoria", "monto_mensual", "tipo", "fuente"],
    templateExample: [["Salario", "Salario", 8500, "fijo", "Empresa"], ["Freelance", "Freelance", 2400, "variable", "Clientes"]],
    buildItem: (row, colMap) => ({
      nombre: row[colMap.nombre] || row[0] || "",
      categoria: row[colMap.categoria] || row[colMap.tipo] || "Otro",
      mensual: Number(row[colMap.mensual] ?? row[colMap.valor_actual] ?? row[colMap.valor] ?? row[2]) || 0,
      tipo: (row[colMap.tipo] || "fijo").toLowerCase().startsWith("v") ? "variable" : "fijo",
      fuente: row[colMap.fuente] || "",
    }),
    key: "ingresos",
  },
  gastos: {
    label: "Gastos", icon: "💳",
    templateHeaders: ["categoria", "concepto", "monto_mensual", "tipo"],
    templateExample: [["Vivienda", "Arriendo", 2800, "fijo"], ["Educación", "Colegio", 763, "fijo"]],
    buildItem: (row, colMap) => ({
      cat: row[colMap.categoria] || row[0] || "Otro",
      c: row[colMap.nombre] || row[1] || "",
      m: Number(row[colMap.mensual] ?? row[colMap.valor_actual] ?? row[2]) || 0,
      t: (row[colMap.tipo] || "f").toLowerCase().startsWith("v") ? "v" : "f",
    }),
    key: "gastos",
    isGastos: true,
  },
  deudas: {
    label: "Deudas", icon: "📋",
    templateHeaders: ["nombre", "tipo", "saldo", "cuota_mensual", "tasa_interes"],
    templateExample: [["Hipoteca", "mortgage", 354000, 3486, 6.5], ["Tarjeta", "credit_card", 12000, 120, 15]],
    buildItem: (row, colMap) => ({
      n: row[colMap.nombre] || row[0] || "",
      tp: row[colMap.tipo] || "loan",
      mt: Number(row[colMap.saldo] ?? row[colMap.valor_actual] ?? row[2]) || 0,
      pg: Number(row[colMap.pago] ?? row[3]) || 0,
      ts: Number(row[colMap.tasa] ?? row[4]) || 0,
      la: null,
    }),
    key: "deudas",
  },
  trading: {
    label: "Trading", icon: "💹",
    templateHeaders: ["ticker", "nombre", "cantidad", "costo_promedio", "precio_actual", "precio_objetivo", "sector"],
    templateExample: [["AAPL", "Apple", 25, 155, 198.5, 220, "Tech"]],
    buildItem: (row, colMap) => ({
      tk: row[colMap.ticker] || row[0] || "",
      n: row[colMap.nombre] || row[1] || "",
      sh: Number(row[colMap.shares] ?? row[2]) || 0,
      cb: Number(row[colMap.costo] ?? row[3]) || 0,
      pr: Number(row[colMap.precio] ?? row[4]) || 0,
      tg: Number(row[colMap.target] ?? row[5]) || 0,
    }),
    key: "ibkr",
  },
};

export default function CsvImport({ onImport, onClose }) {
  const [step, setStep] = useState(1);
  const [module, setModule] = useState(null);
  const [rawHeaders, setRawHeaders] = useState([]);
  const [rawRows, setRawRows] = useState([]);
  const [parsed, setParsed] = useState([]);
  const [colMap, setColMap] = useState({});
  const [fileName, setFileName] = useState("");
  const [errors, setErrors] = useState([]);
  const fileRef = useRef();

  const downloadTemplate = (mod) => {
    const m = MODULES[mod];
    const ws = XLSX.utils.aoa_to_sheet([m.templateHeaders, ...m.templateExample]);
    ws["!cols"] = m.templateHeaders.map(() => ({ wch: 20 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, m.label);
    XLSX.writeFile(wb, `finpath_${mod}_plantilla.xlsx`);
  };

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file || !module) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        let rawData;
        if (file.name.endsWith(".csv") || file.name.endsWith(".txt")) {
          const lines = ev.target.result.trim().split("\n");
          rawData = lines.map((l) => l.split(",").map((v) => v.trim().replace(/^"|"$/g, "")));
        } else {
          const data = new Uint8Array(ev.target.result);
          const wb = XLSX.read(data, { type: "array" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          rawData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: true });
        }

        const { headers, rows } = cleanRows(rawData);
        setRawHeaders(headers);
        setRawRows(rows);

        // Auto-map columns
        const cMap = {};
        headers.forEach((h, i) => {
          const match = matchColumn(h, COLUMN_ALIASES);
          if (match) cMap[match] = i;
        });
        setColMap(cMap);

        // Build items
        const m = MODULES[module];
        const items = [];
        const errs = [];
        rows.forEach((row, idx) => {
          try {
            const item = m.buildItem(row, cMap);
            item.id = m.key[0] + "_" + Date.now() + "_" + idx;
            // Validate: must have at least a name or a value
            const hasName = item.n || item.nombre || item.tk || item.cat || item.c;
            const hasValue = item.va || item.vc || item.mensual || item.mt || item.m || item.sh;
            if (hasName || hasValue) items.push(item);
            else errs.push(`Fila ${idx + 1}: sin datos válidos`);
          } catch {
            errs.push(`Fila ${idx + 1}: error de formato`);
          }
        });
        setParsed(items);
        setErrors(errs);
        setStep(3);
      } catch (err) {
        setErrors(["Error leyendo archivo: " + err.message]);
        setStep(3);
      }
    };
    file.name.endsWith(".csv") || file.name.endsWith(".txt") ? reader.readAsText(file) : reader.readAsArrayBuffer(file);
  };

  const handleConfirm = () => {
    if (!module || !parsed.length) return;
    const m = MODULES[module];
    onImport(m.key, parsed, m.isGastos);
    onClose();
  };

  const fmt = (v) => typeof v === "number" ? (v >= 1e6 ? "$" + (v / 1e6).toFixed(1) + "M" : v > 100 ? "$" + Math.round(v).toLocaleString() : v) : String(v || "");
  const displayKey = (item) => item.n || item.nombre || item.tk || item.cat || item.c || "—";

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 24, width: "100%", maxWidth: 780, maxHeight: "85vh", overflow: "auto", padding: 32 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h3 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: T.txt }}>📤 Importar desde Excel o CSV</h3>
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
                  <div style={{ fontSize: 11, color: T.txt3, marginTop: 4 }}>{m.templateHeaders.slice(0, 4).join(", ")}</div>
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
            <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
              <button onClick={() => downloadTemplate(module)} style={{ background: T.green, border: "none", color: "#000", padding: "10px 18px", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 700 }}>📥 Descargar Plantilla</button>
              <button onClick={() => setStep(1)} style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.txt3, padding: "10px 18px", borderRadius: 10, cursor: "pointer", fontSize: 13 }}>← Cambiar</button>
            </div>
            <div style={{ background: T.card, borderRadius: 14, padding: 14, marginBottom: 16, border: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 12, color: T.txt2, marginBottom: 4 }}>💡 <strong>El sistema detecta automáticamente</strong> las columnas de tu Excel</div>
              <div style={{ fontSize: 11, color: T.txt3 }}>No importa si tus columnas no empiezan en A o si el header no está en la fila 1. FINPATH busca y mapea automáticamente.</div>
            </div>
            <div onClick={() => fileRef.current?.click()} style={{ border: `2px dashed ${T.border}`, borderRadius: 16, padding: 48, textAlign: "center", cursor: "pointer" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
              <p style={{ color: T.txt2, margin: "0 0 4px", fontSize: 14 }}>Click para subir archivo</p>
              <p style={{ color: T.txt3, fontSize: 12 }}>.xlsx, .xls, .csv</p>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.txt" onChange={handleFile} style={{ display: "none" }} />
            </div>
          </div>
        )}

        {/* Step 3: Preview */}
        {step === 3 && (
          <div>
            {fileName && <p style={{ fontSize: 13, color: T.txt3, marginBottom: 8 }}>📄 {fileName}</p>}

            {/* Column mapping display */}
            {Object.keys(colMap).length > 0 && (
              <div style={{ background: T.card, borderRadius: 10, padding: 12, marginBottom: 12, border: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 11, color: T.txt3, marginBottom: 6 }}>Columnas detectadas:</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {Object.entries(colMap).map(([key, idx]) => (
                    <span key={key} style={{ background: T.greenDim, color: T.green, fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 6 }}>
                      {key} → "{rawHeaders[idx]}"
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
              <span style={{ background: T.greenDim, color: T.green, fontSize: 12, fontWeight: 600, padding: "4px 12px", borderRadius: 8 }}>✓ {parsed.length} registros</span>
              {errors.length > 0 && <span style={{ background: T.redDim, color: T.red, fontSize: 12, fontWeight: 600, padding: "4px 12px", borderRadius: 8 }}>⚠ {errors.length} omitidos</span>}
            </div>

            {parsed.length > 0 && (
              <div style={{ overflowX: "auto", maxHeight: 300, borderRadius: 10, border: `1px solid ${T.border}`, marginBottom: 16 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr>{Object.keys(parsed[0]).filter((k) => !["id", "la", "link"].includes(k)).map((k) => (
                      <th key={k} style={{ padding: "8px 12px", color: T.txt3, borderBottom: `1px solid ${T.border}`, textAlign: "left", fontSize: 10, textTransform: "uppercase", position: "sticky", top: 0, background: T.bg2 }}>{k}</th>
                    ))}</tr>
                  </thead>
                  <tbody>{parsed.slice(0, 12).map((r, i) => (
                    <tr key={i}>{Object.entries(r).filter(([k]) => !["id", "la", "link"].includes(k)).map(([k, v]) => (
                      <td key={k} style={{ padding: "8px 12px", color: T.txt, borderBottom: `1px solid ${T.border}` }}>
                        {Array.isArray(v) ? (v.length > 0 ? v.map((x) => x.c + ": $" + x.m).join(", ") : "—") : fmt(v)}
                      </td>
                    ))}</tr>
                  ))}</tbody>
                </table>
                {parsed.length > 12 && <p style={{ padding: 12, color: T.txt3, fontSize: 12, textAlign: "center" }}>...y {parsed.length - 12} más</p>}
              </div>
            )}

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button onClick={() => { setStep(2); setParsed([]); setErrors([]); setFileName(""); setRawHeaders([]); setRawRows([]); setColMap({}); }}
                style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.txt2, padding: "10px 20px", borderRadius: 10, cursor: "pointer", fontWeight: 600 }}>← Atrás</button>
              <button onClick={handleConfirm} disabled={!parsed.length}
                style={{ background: T.green, color: "#000", padding: "10px 24px", borderRadius: 10, cursor: "pointer", fontWeight: 700, border: "none", opacity: parsed.length ? 1 : 0.4 }}>
                ✓ Importar {parsed.length} registros
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
