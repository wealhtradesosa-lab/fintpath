// ═══════════════════════════════════════════════════════════════════════════
// DECLARACION UPLOAD — Plan Tributario → tab "Declaración completa"
// ─────────────────────────────────────────────────────────────────────────
// Flujo:
//   1. Usuario elige un owner (natural o jurídica) y sube un PDF de su
//      declaración oficial DIAN.
//   2. Frontend llama POST /api/parse-declaration → Claude Sonnet 4 extrae
//      los renglones y devuelve JSON.
//   3. Mostramos preview editable (el usuario puede corregir números que
//      la IA haya leído mal antes de confirmar).
//   4. Al confirmar, guardamos en owner.declaracionAnterior y la lista de
//      alertas de normalize.js detecta automáticamente desajustes vs este
//      año (aportes voluntarios no capturados, descuentos perdidos, etc).
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useRef } from "react";
import NumberInput from "./NumberInput";
import { useRole, guardEdit } from "../lib/RoleContext.jsx";

const T = {
  bg: "#0c0c0f", bg2: "#141418", bg3: "#1e1e24",
  txt: "#e8eaed", txt2: "#b8bcc4", txt3: "#6b7280",
  border: "rgba(255,255,255,0.08)",
  green: "#22c55e", red: "#ef4444", orange: "#f59e0b", blue: "#3b82f6", purple: "#a78bfa",
};

const fm = (v) => "$" + Math.round(Number(v) || 0).toLocaleString("es-CO");

// Etiquetas humanas para los renglones más importantes. El resto se muestran
// crudos pero legibles.
const RENGLON_LABELS_F210 = {
  ingresosBrutos: "Ingresos brutos",
  ingresosNoConstitutivos: "Ingresos no constitutivos (aportes oblig.)",
  ingresosNetos: "Ingresos netos",
  rentaExenta25: "Renta exenta 25% laboral",
  deducIntereses: "Deducción intereses vivienda",
  deducMedicina: "Deducción medicina prepagada",
  deducDependientes: "Deducción dependientes",
  pvAFC: "Pensión voluntaria + AFC",
  patrimonioBruto: "Patrimonio bruto",
  deudas: "Deudas",
  patrimonioLiquido: "Patrimonio líquido",
  impuestoCalculado: "Impuesto calculado",
  retefuente: "Retención en la fuente practicada",
  saldoPagar: "Saldo a pagar",
  descDonaciones: "Descuento donaciones",
  descCTI: "Descuento CTI",
};

const RENGLON_LABELS_F110 = {
  ingresosBrutos: "Ingresos brutos",
  ingresosNoConstitutivos: "Ingresos no constitutivos",
  costosDeducciones: "Costos y deducciones",
  rentaLiquida: "Renta líquida",
  rentaExenta: "Renta exenta",
  rentaLiquidaGravable: "Renta líquida gravable",
  patrimonioBruto: "Patrimonio bruto",
  deudas: "Deudas",
  patrimonioLiquido: "Patrimonio líquido",
  impuestoCalculado: "Impuesto calculado",
  descICA: "Descuento 50% ICA (Art. 115)",
  descCree: "Descuento CREE",
  descDonaciones: "Descuento donaciones (Art. 257)",
  descCTI: "Descuento CTI (Art. 256)",
  impuestoNeto: "Impuesto neto",
  autorretencion: "Autorretención",
  saldoPagar: "Saldo a pagar",
};

export default function DeclaracionUpload({ owners, onSaveToOwner, isPro, onUpsell }) {
  // Fase 3 commit 8: gating reader. Mismo patrón que CsvImport — el flujo
  // de upload + parse no se gateamos (lectura/preview); guard solo en
  // handleConfirm donde se persiste a través de onSaveToOwner.
  const { role } = useRole();
  const [selectedOwnerId, setSelectedOwnerId] = useState(owners[0]?.id || "");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [parsed, setParsed] = useState(null); // { tipo, anoGravable, renglones, confianza, ... }
  const [editedRenglones, setEditedRenglones] = useState({});
  const fileInputRef = useRef(null);

  const selectedOwner = owners.find((o) => o.id === selectedOwnerId);

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.type !== "application/pdf") {
      setError("Por favor subí un archivo PDF.");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setError("El archivo excede 5MB. Para archivos grandes, escaneá a menor resolución.");
      return;
    }
    setError("");
    setFile(f);
    setParsed(null);
  };

  const handleParse = async () => {
    if (!isPro) { onUpsell?.(); return; }
    if (!file) { setError("Elegí un archivo primero."); return; }
    if (!selectedOwnerId) { setError("Elegí a qué propietario fiscal corresponde esta declaración."); return; }

    setUploading(true);
    setError("");
    setParsed(null);
    try {
      const base64 = await fileToBase64(file);
      const tipoHint = selectedOwner?.type === "juridica" ? "F110" : "F210";
      const r = await fetch("/api/parse-declaration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdf: base64, tipoHint }),
      });
      const j = await r.json();
      if (!r.ok || !j.success) {
        setError(j.error || "No pudimos interpretar el PDF. Probá con un escaneo más claro.");
        setUploading(false);
        return;
      }
      setParsed(j.data);
      setEditedRenglones({ ...j.data.renglones });
    } catch (e) {
      setError("Error de red: " + (e.message || "intentá de nuevo"));
    } finally {
      setUploading(false);
    }
  };

  const handleConfirm = () => {
    if (!guardEdit(role)) return;
    if (!parsed || !selectedOwner) return;

    // Commit 5.5: hard block. anoGravable debe estar entre currentYear-5 y currentYear-1.
    const ano = Number(parsed.anoGravable) || 0;
    const currentYear = new Date().getFullYear();
    const minAno = currentYear - 5;
    const maxAno = currentYear - 1;
    if (ano < minAno || ano > maxAno) {
      setError(`Año gravable ${ano || "no detectado"} fuera de rango permitido (${minAno}–${maxAno}). Si el año está mal, corregilo arriba antes de guardar.`);
      return;
    }

    // Commit 5.5: si el array tiene 3 y el año no existe, avisar que se descarta el más viejo.
    const existentes = selectedOwner.declaraciones || [];
    const yaExisteMismoAno = existentes.some(d => Number(d?.anoGravable) === ano);
    if (!yaExisteMismoAno && existentes.length >= 3) {
      const masVieja = [...existentes].sort((a, b) => (Number(a?.anoGravable) || 0) - (Number(b?.anoGravable) || 0))[0];
      const ok = window.confirm(
        `Ya tenés 3 declaraciones guardadas para ${selectedOwner.name}. Se descartará la más vieja (año ${masVieja?.anoGravable || "?"}) para guardar esta nueva (año ${ano}).\n\n¿Continuar?`
      );
      if (!ok) return;
    }
    if (yaExisteMismoAno) {
      const ok = window.confirm(
        `Ya tenés una declaración cargada del año ${ano} para ${selectedOwner.name}. Se reemplazará por la nueva.\n\n¿Continuar?`
      );
      if (!ok) return;
    }

    const cleaned = {};
    Object.keys(editedRenglones).forEach((k) => {
      cleaned[k] = Number(editedRenglones[k]) || 0;
    });
    const payload = {
      tipo: parsed.tipo,
      anoGravable: ano,
      renglones: cleaned,
      capturadoEl: new Date().toISOString(),
      fuenteCaptura: "upload_pdf_ia",
    };
    onSaveToOwner(selectedOwner.id, payload);
    setFile(null);
    setParsed(null);
    setEditedRenglones({});
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const labels = parsed?.tipo === "F110" ? RENGLON_LABELS_F110 : RENGLON_LABELS_F210;
  // Commit 5.5: mostrar lista de declaraciones ya guardadas (hasta 3)
  const declaracionesGuardadas = selectedOwner?.declaraciones || [];

  return (
    <div style={{ maxWidth: 820, margin: "0 auto", padding: "16px" }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: T.txt, marginBottom: 6 }}>
          📋 Declaración oficial DIAN
        </div>
        <div style={{ fontSize: 13, color: T.txt2, lineHeight: 1.6 }}>
          Subí el PDF de tu declaración de renta presentada en la DIAN. La IA extrae los renglones principales
          y los guarda en el perfil del propietario fiscal, para que el sistema detecte automáticamente si te
          estás olvidando de aportes o descuentos que sí capturaste el año pasado.
        </div>
      </div>

      {/* Pro gate */}
      {!isPro && (
        <div style={{ padding: 16, background: "rgba(168,139,250,0.08)", border: "1px solid rgba(168,139,250,0.3)", borderRadius: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.purple, marginBottom: 4 }}>🔒 Feature del plan Pro</div>
          <div style={{ fontSize: 12, color: T.txt2, lineHeight: 1.5, marginBottom: 10 }}>
            La extracción automática de declaraciones requiere el plan Pro. Con el plan gratuito podés capturar
            manualmente los renglones desde el perfil del owner.
          </div>
          <button onClick={onUpsell} style={{ padding: "8px 14px", background: T.purple, border: "none", borderRadius: 8, color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            Ver planes →
          </button>
        </div>
      )}

      {/* Paso 1: elegir owner */}
      <div style={{ background: T.bg2, borderRadius: 12, padding: 16, border: "1px solid " + T.border, marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.txt3, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
          1. ¿De qué propietario fiscal es esta declaración?
        </div>
        <select
          value={selectedOwnerId}
          onChange={(e) => setSelectedOwnerId(e.target.value)}
          disabled={!isPro}
          style={{ width: "100%", background: T.bg3, border: "1px solid " + T.border, color: T.txt, padding: "10px 12px", borderRadius: 8, fontSize: 13, outline: "none", cursor: isPro ? "pointer" : "not-allowed" }}
        >
          {owners.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name} ({o.type === "juridica" ? "Jurídica · F-110" : "Natural · F-210"})
            </option>
          ))}
        </select>
        {declaracionesGuardadas.length > 0 && (
          <div style={{ marginTop: 8, fontSize: 10, color: T.txt3, lineHeight: 1.5 }}>
            📚 Declaraciones guardadas para este owner ({declaracionesGuardadas.length}/3):{" "}
            {declaracionesGuardadas
              .map((d) => d?.anoGravable)
              .filter(Boolean)
              .sort((a, b) => b - a)
              .map((y) => (
                <span key={y} style={{ display: "inline-block", padding: "2px 8px", background: T.bg3, borderRadius: 4, marginRight: 4, fontWeight: 600, color: T.txt2, fontFamily: "monospace" }}>
                  {y}
                </span>
              ))}
            {declaracionesGuardadas.length >= 3 && (
              <span style={{ color: T.orange, marginLeft: 4 }}>· Al subir una nueva se descarta la más vieja.</span>
            )}
          </div>
        )}
      </div>

      {/* Paso 2: subir PDF */}
      <div style={{ background: T.bg2, borderRadius: 12, padding: 16, border: "1px solid " + T.border, marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.txt3, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
          2. Subí el PDF de la declaración
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
          disabled={!isPro}
          style={{ display: "block", width: "100%", fontSize: 12, color: T.txt2 }}
        />
        <div style={{ fontSize: 10, color: T.txt3, marginTop: 6, lineHeight: 1.5 }}>
          Formatos aceptados: PDF hasta 5MB. Funciona mejor con PDFs nativos de MUISCA (no escaneos). La IA es <strong>Claude Sonnet 4</strong>; los datos no se guardan en Anthropic más allá del tiempo de proceso.
        </div>
        {file && (
          <div style={{ marginTop: 10, fontSize: 12, color: T.green }}>
            ✓ {file.name} · {(file.size / 1024).toFixed(0)} KB
          </div>
        )}
        {error && <div style={{ marginTop: 10, fontSize: 12, color: T.red }}>❌ {error}</div>}

        <button
          onClick={handleParse}
          disabled={!file || uploading || !isPro}
          style={{
            marginTop: 14, width: "100%", padding: "12px 20px",
            background: !file || !isPro ? T.bg3 : uploading ? T.txt3 : T.blue,
            border: "none", borderRadius: 8, color: "white",
            fontSize: 13, fontWeight: 700,
            cursor: !file || uploading || !isPro ? "not-allowed" : "pointer",
            opacity: !file || !isPro ? 0.5 : 1,
          }}
        >
          {uploading ? "🔍 Analizando con IA (15-30 seg)…" : "🔍 Extraer datos con IA"}
        </button>
      </div>

      {/* Paso 3: preview editable */}
      {parsed && (
        <div style={{ background: T.bg2, borderRadius: 12, padding: 16, border: "2px solid " + T.green, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.txt3, textTransform: "uppercase", letterSpacing: 0.5 }}>
                3. Verificá los datos extraídos
              </div>
              <div style={{ fontSize: 13, color: T.txt, marginTop: 4, fontWeight: 600 }}>
                Formulario {parsed.tipo} · Año gravable {parsed.anoGravable || "?"} · Confianza{" "}
                <span style={{ color: parsed.confianza === "alta" ? T.green : parsed.confianza === "media" ? T.orange : T.red }}>
                  {parsed.confianza || "?"}
                </span>
              </div>
            </div>
          </div>

          {parsed.confianza === "baja" && (
            <div style={{ padding: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, marginBottom: 10, fontSize: 11, color: T.txt2 }}>
              ⚠️ La IA marcó la lectura como <strong>baja confianza</strong>. Revisá cada campo y corregí los que no coincidan con tu declaración antes de guardar.
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {Object.keys(labels).map((k) => (
              <div key={k} style={{ padding: "8px 10px", background: T.bg3, borderRadius: 6 }}>
                <div style={{ fontSize: 10, color: T.txt3, marginBottom: 3 }}>{labels[k]}</div>
                <NumberInput
                  value={editedRenglones[k] ?? ""}
                  onChange={(v) => setEditedRenglones((p) => ({ ...p, [k]: v === "" ? "" : String(v) }))}
                  style={{ width: "100%", background: "transparent", border: "none", color: T.txt, fontSize: 13, fontFamily: "monospace", outline: "none", padding: 0 }}
                />
                <div style={{ fontSize: 9, color: T.txt3, marginTop: 2 }}>{fm(editedRenglones[k])}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button
              onClick={() => { setParsed(null); setEditedRenglones({}); }}
              style={{ padding: "10px 16px", background: T.bg3, border: "1px solid " + T.border, borderRadius: 8, color: T.txt2, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
            >
              Descartar
            </button>
            <button
              onClick={handleConfirm}
              style={{ flex: 1, padding: "10px 16px", background: T.green, border: "none", borderRadius: 8, color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
            >
              💾 Guardar en {selectedOwner?.name}
            </button>
          </div>
        </div>
      )}

      {/* Info: declaraciones ya guardadas */}
      <div style={{ fontSize: 11, color: T.txt3, padding: 12, background: T.bg3, borderRadius: 8, lineHeight: 1.6 }}>
        💡 <strong>¿Qué pasa después?</strong> Los datos se guardan en el perfil del propietario fiscal. El sistema usa esa información para <strong>detectar desajustes</strong> contra tu situación actual —por ejemplo, si el año pasado aportaste a pensión voluntaria pero este año no registraste aportes, aparece una alerta en el Plan Tributario.
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Helper: PDF → base64 (sin prefijo data:)
// ─────────────────────────────────────────────────────────────────────────
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("No se pudo leer el archivo"));
        return;
      }
      const base64 = result.split(",")[1] || "";
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error || new Error("Error leyendo archivo"));
    reader.readAsDataURL(file);
  });
}
