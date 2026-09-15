import { useState, useMemo } from "react";
import Disclaimer from "./Disclaimer";
import { separarPorLimite } from "../lib/limitePlan.js";
import BloqueadosPorPlan from "./BloqueadosPorPlan";
import BarraComposicion from "./BarraComposicion";
import NumberInput from "./NumberInput";
import { C } from "../lib/designTokens.js";
import SimToggleInfo from "./SimToggleInfo";
import PageHeader from "./PageHeader";
import { exportInversionesExcel } from "../lib/excelExport.js";
import { exportPatrimonioPDF } from "../lib/pdfSectionExport.js";
import { useRole, guardEdit } from "../lib/RoleContext.jsx";
import { vaCOP, vcCOP } from "../lib/flowHelpers.js";

const T = {
  bg2: C.surface, bg3: "#1e1e24",
  card: "#111113", border: C.border,
  txt: "#fafafa", txt2: "#a1a1aa", txt3: "#71717a",
  green: "#22c55e", greenDim: "rgba(34,197,94,0.1)",
  red: "#ef4444", redDim: "rgba(239,68,68,0.08)",
  blue: "#3b82f6", orange: "#f97316", purple: "#a78bfa",
};
const _fm = (n) => "$" + Math.round(n||0).toLocaleString("en-US");
const pc = (n) => (n || 0).toFixed(1) + "%";

// Get name from item (handles multiple field formats)
const getName = (i) => i.n || i.nombre || i.name || "Sin nombre";
const getLoc = (i) => i.ub || i.ubicacion || i.location || "";
const getType = (i) => {
  let tp = String(i.tp || i.tipo || i.type || "").trim();
  if (!tp || !isNaN(Number(tp))) tp = "";
  const typeMap = {"Other":"Otro","Investment":"Fondo de Inversión","Income":"Otro","Trading":"Acciones","Renta Fija":"CDT","Lote":"Real Estate"};
  if (tp && typeMap[tp]) return typeMap[tp];
  const valid = ["Real Estate","Fondo de Inversión","CDT","Acciones","Crypto","Bodega","Vehículo","Local Comercial","Renta Fija","Negocio","Cash","Otro"];
  if (tp && valid.includes(tp)) return tp;
  const nm = ((i.n||i.nombre||"")+" "+(i.ub||"")).toLowerCase();
  if (/apart|apto|casa|lote|terreno|oficina|inmueble|propiedad|house|condo/i.test(nm)) return "Real Estate";
  if (/bodega/i.test(nm)) return "Bodega";
  if (/local/i.test(nm)) return "Local Comercial";
  if (/fondo|fiduci|fund/i.test(nm)) return "Fondo de Inversión";
  if (/cdt|renta fija|bonos/i.test(nm)) return "CDT";
  if (/accion|etf|portafolio|vti|spy|stock/i.test(nm)) return "Acciones";
  if (/btc|bitcoin|crypto|eth/i.test(nm)) return "Crypto";
  if (/vehic|carro|moto|auto/i.test(nm)) return "Vehículo";
  if (/negocio|empresa|sas/i.test(nm)) return "Negocio";
  if (/cash|ahorro|cuenta/i.test(nm)) return "Cash";
  if (/green|puerto|orlando|miami|backswing|district/i.test(nm)) return "Real Estate";
  return "Otro";
};
// 26-jul-2026: getVA devolvía el valor CRUDO, sin convertir moneda. Un activo
// cargado en USD se mostraba y se sumaba como si fueran pesos: el portafolio
// de USD 33.266 aparecía como $33.266 COP junto a inmuebles de miles de
// millones. La conversión ahora usa el mismo helper que el resto del motor.
// 26-jul-2026 — CRASH EN PRODUCCIÓN. Al agregar la conversión de moneda,
// getVA quedó usando `trm`, que es una PROP del componente — pero esta
// función vive a nivel de módulo, fuera de él. En ejecución lanzaba
// "trm is not defined" y la página de Patrimonio no cargaba.
// El build no lo detecta: es un error de runtime, no de sintaxis.
// Ahora la TRM se pasa como argumento, que es lo correcto para una función
// que no está dentro del componente.
const getVA = (i, trm) => vaCOP({ ...i, va: i.va ?? i.valor_actual ?? i.valor ?? 0 }, trm || 4200);
// 12-ago-2026 (Santiago): "si uno pone valor en dólares lo pasa a pesos en
// valor actual pero no en el de compra". Exacto: el 26-jul se arregló getVA
// para convertir moneda y getVC quedó devolviendo el número crudo. En un
// activo en USD el valor actual salía ×TRM y el de compra en dólares, así que
// la ganancia era el disparate de restar dólares a pesos (un activo de
// 460k→575k USD mostraba una "ganancia" de ~2.415 millones de pesos).
const getVC = (i, trm) => vcCOP({ ...i, vc: i.vc ?? i.valor_compra ?? i.costo ?? 0 }, trm || 4200);

// Valores SIN convertir, en la moneda en que el usuario los cargó. Son los
// que van al formulario: el form tiene su propio selector de moneda, así que
// prellenarlo con pesos convertidos y dejar el selector en USD hacía que al
// guardar se escribiera el monto en pesos con moneda USD — y al volver a
// abrirlo se multiplicaba por la TRM otra vez. Cada edición inflaba el activo
// ~4.200×, de forma silenciosa y permanente.
const getVArw = (i) => Number(i.va ?? i.valor_actual ?? i.valor ?? 0);
const getVCrw = (i) => Number(i.vc ?? i.valor_compra ?? i.costo ?? 0);

// 14-sep-2026 — `rentaVinculadaMes` es el ingreso que llega desde la LISTA
// GLOBAL de ingresos vía activoId, en pesos y ya mensualizado.
// Hallazgo del día: la plataforma tenía DOS representaciones del mismo hecho
// -- ingreso anidado dentro del activo (15 activos lo usan) e ingreso en la
// lista global (160 registros) -- sin relación entre ellas. En vez de sumar
// una tercera, el vínculo nuevo alimenta este mismo cálculo: cap rate y
// cash-on-cash ya existían y se quedaban cortos porque solo veían una mitad.
function calcMetrics(inv, deudas, trm, rentaVinculadaMes = 0, gastoVinculadoMes = 0) {
  let ig = rentaVinculadaMes, gs = gastoVinculadoMes;
  if (inv.unidades || inv.un) {
    (inv.unidades || inv.un || []).forEach((u) => {
      (u.ingresos || u.ig || []).forEach((i) => { ig += i.m || 0; });
      (u.gastos || u.gs || []).forEach((g) => { gs += g.m || 0; });
    });
  } else {
    (inv.ingresos || inv.ig || []).forEach((i) => { ig += i.m || 0; });
    (inv.gastos || inv.gs || []).forEach((g) => { gs += g.m || 0; });
  }
  const va = getVA(inv, trm), vc = getVC(inv, trm);
  const noi = ig - gs;
  const linkedDebt = (deudas || []).filter((d) => (d.la || d.link) === inv.id);
  const debtTotal = linkedDebt.reduce((s, d) => s + (d.mt || d.monto || 0), 0);
  const debtPayment = linkedDebt.reduce((s, d) => s + (d.pg || d.pago || 0), 0);
  const equity = va - debtTotal;
  const roi = vc > 0 ? ((va - vc) / vc) * 100 : 0;
  const cap = va > 0 ? ((noi * 12) / va) * 100 : 0;
  const coc = equity > 0 ? (((noi - debtPayment) * 12) / equity) * 100 : 0;
  return { ig, gs, noi, roi, cap, coc, debtTotal, debtPayment, equity };
}

const In = ({ l, value, onChange, type, placeholder, options }) => (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: T.txt3, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>{l}</label>
      {options
        ? <select value={value || ""} onChange={(e) => onChange(e.target.value)} style={{ width: "100%", background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", color: T.txt, fontSize: 14, outline: "none" }}>{options.map((o) => <option key={o.v!=null?o.v:o} value={o.v!=null?o.v:o}>{o.l!=null?o.l:o}</option>)}</select>
        : type === "number"
          ? <NumberInput value={value ?? ""} onChange={(v) => onChange(v === "" ? "" : String(v))} placeholder={placeholder} style={{ width: "100%", background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", color: T.txt, fontSize: 14, outline: "none" }} />
          : <input type={type || "text"} value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ width: "100%", background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", color: T.txt, fontSize: 14, outline: "none" }} />
      }
    </div>
  );

export default function InversionesModule({ inversiones, owners, deudas, onUpdate, fmt, onImport, user, trm, plan, onUpgrade, onCrearIngreso}) {
  // ── 14-sep-2026 · Rentabilidad por activo ────────────────────────────────
  // Primer uso del vínculo ingreso → activo. Antes un activo era solo un valor
  // de compra y uno actual: la plataforma no sabía si producía algo. Con el
  // vínculo se puede calcular el yield -- ingreso anual sobre valor actual --
  // y, más importante, señalar los activos que no generan ningún ingreso.
  // Un activo improductivo no es necesariamente un error (una casa de recreo,
  // un lote en valorización), pero el usuario debería verlo y decidirlo, no
  // ignorarlo por omisión del modelo.
  const rentaPorActivo = useMemo(() => {
    const mapa = {};
    const TRM = trm || 4200;
    (user?.ingresos || []).forEach((ing) => {
      const id = ing?.activoId;
      if (!id || ing.sim === false) return;
      const mensualCop = (Number(ing.mensual) || 0) * (ing.moneda === "USD" ? TRM : 1);
      // Se cuentan los meses de vigencia: un arriendo de 3 meses no rinde igual
      // que uno de 12, y anualizar el mensual los igualaría en falso.
      const desde = Number(ing.desdeMes) || 1;
      const hasta = Number(ing.hastaMes) || 12;
      const meses = Math.max(0, Math.min(12, hasta) - Math.max(1, desde) + 1);
      mapa[id] = (mapa[id] || 0) + mensualCop * meses;
    });
    return mapa;
  }, [user, trm]);

  // 14-sep-2026 — Simétrico del anterior: gastos que el usuario marcó como
  // pertenecientes a un activo. Sin esto el cap rate quedaría bruto (renta sin
  // descontar predial, administración ni seguros) y sobreestimaría todo.
  const gastoPorActivo = useMemo(() => {
    const mapa = {};
    const TRM = trm || 4200;
    Object.values(user?.gastos || {}).forEach((items) => {
      (items || []).forEach((g) => {
        const id = g?.activoId;
        if (!id || g.sim === false) return;
        const mensualCop = (Number(g.m) || 0) * (g.moneda === "USD" ? TRM : 1);
        const desde = Number(g.desdeMes) || 1;
        const hasta = Number(g.hastaMes) || 12;
        const meses = Math.max(0, Math.min(12, hasta) - Math.max(1, desde) + 1);
        mapa[id] = (mapa[id] || 0) + mensualCop * meses;
      });
    });
    return mapa;
  }, [user, trm]);

  const fm = fmt || _fm;
  // Fase 3 commit 6: gating reader.
  const { role } = useRole();
  // V4.9 - edit fix
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ nombre: "", ubicacion: "", tipo: "Real Estate", va: "", vc: "", tasa: "", owner: "", moneda: "COP" });
  const [selected, setSelected] = useState(new Set());

  const items = inversiones || [];
  const activos = items.filter((i) => i.sim !== false);
  // 26-jul-2026 — Límite del plan gratuito (7 por sección).
  // OJO: `activos` sigue completo, así que totalValor, rendimiento y todo lo
  // que alimenta al dashboard incluye los bloqueados. El límite quita ACCESO
  // al detalle, no falsea los números. Ver src/lib/limitePlan.js.
  const { visibles: itemsVisibles, bloqueados, hayLimite } = separarPorLimite(items, plan);
  const montoBloqueado = bloqueados.reduce((s, i) => s + getVA(i, trm), 0);
  // 26-jul-2026 (Santiago: "lo mismo pasa con patrimonio, organícelo por
  // tipologías"). Mismo patrón que Gastos, Ingresos y Deudas: marcadores
  // {__cat} intercalados en los datos, que el render dibuja como encabezado.
  // Acá el criterio es el TIPO DE ACTIVO y el subtotal es el VALOR: la
  // pregunta en patrimonio es en qué está puesta la plata — la misma que
  // responde la alerta de concentración del dashboard.
  const conEncabezados = (lista) => {
    const porTipo = {};
    lista.forEach(i => { const k = getType(i) || "Sin tipo"; (porTipo[k] = porTipo[k] || []).push(i); });
    const grupos = Object.entries(porTipo)
      .map(([tipo, its]) => ({ tipo, items: its,
        sub: its.filter(i => i.sim !== false).reduce((s, i) => s + getVA(i, trm), 0) }))
      .sort((a, b) => b.sub - a.sub);
    const tot = grupos.reduce((s, g) => s + g.sub, 0);
    return grupos.flatMap(gr => [
      { __cat: gr.tipo, __sub: gr.sub, __n: gr.items.length,
        __pct: tot > 0 ? (gr.sub / tot) * 100 : 0, id: "__h_" + gr.tipo },
      ...gr.items,
    ]);
  };
  const totalValor = activos.reduce((s, i) => s + getVA(i, trm), 0)
  // 26-jul-2026 (Santiago): mismo trío en los cuatro módulos de "Mi dinero" —
  // stock · flujo mensual · flujo anual — para que el ojo busque siempre en el
  // mismo lugar. Acá el flujo es lo que RINDE el patrimonio: se veía cuánto
  // vale, no cuánto produce, que es la otra mitad del dato.
  // Solo suma activos con tasa cargada: una propiedad sin rendimiento
  // declarado no rinde 0%, simplemente no se sabe, y no se inventa.
  const rendimientoAnual = activos.reduce((s, i) => s + getVA(i, trm) * ((Number(i.tasa) || 0) / 100), 0);

  const toggleSel = (id) => setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected(selected.size === items.length ? new Set() : new Set(items.map((i) => i.id)));

  const deleteSelected = () => {
    if (!guardEdit(role)) return;
    if (!selected.size || !confirm(`¿Eliminar ${selected.size} activo(s)?`)) return;
    onUpdate(items.filter((i) => !selected.has(i.id)));
    setSelected(new Set());
  };

  const openEdit = (inv) => {
    setForm({
      nombre: String(getName(inv) || ""),
      ubicacion: String(getLoc(inv) || ""),
      tipo: String(getType(inv) || "Real Estate"),
      fiscalCode: inv.fiscalCode || "INV_INMUEBLE_HABITACIONAL",
      pctTerreno: inv.pctTerreno != null ? String(inv.pctTerreno) : "",
      va: String(getVArw(inv) || ""),
      vc: String(getVCrw(inv) || ""),
      tasa: String(inv.tasa || ""),
      owner: inv.owner || "",
      moneda: inv.moneda || "COP",
    });
    setEditId(inv.id);
    setShowForm(true);
  };

  const openAdd = () => {
    setForm({ nombre: "", ubicacion: "", tipo: "Real Estate", fiscalCode: "INV_INMUEBLE_HABITACIONAL", pctTerreno: "", va: "", vc: "", tasa: "", owner: "", moneda: "COP" });
    setEditId(null);
    setShowForm(true);
  };

  const handleSave = () => {
    if (!guardEdit(role)) return;
    const va = Math.abs(parseFloat(form.va)) || 0;
    const tasa = parseFloat(form.tasa) || 0;
    // ALERTA ANTI-TYPO (20-jul-2026, Santiago): Puerto Madero quedó guardado
    // con $11.7M en vez de $11.7B → "ganancia" de −$4.5B. Si el valor actual
    // implica una pérdida >90% vs el costo, casi siempre faltan ceros.
    const vcCheck = Math.abs(parseFloat(form.vc)) || 0;
    if (va > 0 && vcCheck > 0 && va < vcCheck * 0.1) {
      const ok = window.confirm(
        `⚠️ REVISÁ LOS CEROS\n\nValor actual: $${va.toLocaleString("es-CO")}\nCosto de compra: $${vcCheck.toLocaleString("es-CO")}\n\nEsto implica una pérdida del ${(100 - (va / vcCheck) * 100).toFixed(0)}%. Si el activo vale MÁS de lo que costó, probablemente faltan ceros en el Valor Actual (tip: usá el shortcut "11700m" = $11.700.000.000).\n\n¿Guardar así de todas formas?`
      );
      if (!ok) return;
    }
    const ingresoCalc = tasa > 0 ? Math.round((va * tasa / 100) / 12) : 0;
    const updated = {
      n: String(form.nombre || "").trim(),
      nombre: String(form.nombre || "").trim(),
      name: String(form.nombre || "").trim(),
      ub: String(form.ubicacion || "").trim(),
      ubicacion: String(form.ubicacion || "").trim(),
      tp: form.tipo || "Other",
      owner: form.owner || "",
      tipo: form.tipo || "Other",
      va,
      vc: Math.abs(parseFloat(form.vc)) || 0,
      moneda: form.moneda || "COP",
      tasa,
      fiscalCode: form.fiscalCode || undefined,
      pctTerreno: form.pctTerreno !== "" && form.pctTerreno != null ? Math.max(0, Math.min(100, parseFloat(form.pctTerreno))) : undefined,
    };
    // Store income directly on investment so coaches can read it
    if (editId) {
      onUpdate(items.map((i) => {
        if (i.id !== editId) return i;
        return { ...i, ...updated };
      }));
    } else {
      updated.id = "i_" + Date.now();
      updated.ig = [];
      updated.gs = [];
      onUpdate([...items, updated]);
    }
    setShowForm(false);
    setEditId(null);
    setForm({ nombre: "", ubicacion: "", tipo: "Real Estate", fiscalCode: "INV_INMUEBLE_HABITACIONAL", pctTerreno: "", va: "", vc: "", tasa: "", owner: "", moneda: "COP" });
  };

  // Set de IDs de inversiones sin propietario asignado, para badges en rows.
  const inversionesSinOwnerIds = new Set((inversiones || []).filter(i => !i.owner || i.owner === "").map(i => i.id));

  return (
    <div>
      <PageHeader
        label="Inversiones"
        title="Portafolio"
        subtitle={`${activos.length}${activos.length !== items.length ? ` de ${items.length}` : ""} activo${activos.length !== 1 ? "s" : ""} · Valor total: ${fm(totalValor)}`}
        rightSlot={<>
          {selected.size > 0 && (
            <button onClick={deleteSelected} style={{ background: T.redDim, border: `1px solid ${T.red}30`, color: T.red, padding: "8px 16px", borderRadius: 100, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
              🗑️ Eliminar ({selected.size})
            </button>
          )}
          {onImport && <button onClick={onImport}
            title="Cargar activos desde una tabla de Excel"
            style={{ background: "rgba(59,130,246,0.12)", color: "#3b82f6", border: "1px solid rgba(59,130,246,0.25)", padding: "10px 18px", borderRadius: 100, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
            ⬆️ Subir Excel
          </button>}
          <button onClick={() => exportInversionesExcel(activos, owners, trm)}
            title="Descarga XLSX con activos + resumen por tipo + resumen por propietario fiscal"
            style={{ background: "transparent", color: "#e4e4e7", border: "1px solid rgba(255,255,255,0.15)", padding: "10px 18px", borderRadius: 100, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
            ⬇️ Bajar Excel
          </button>
          <button onClick={() => exportPatrimonioPDF(activos, owners, trm)}
            title="Bajar PDF: valor, ganancia y concentración por tipo"
            style={{ background: "transparent", color: "#e4e4e7", border: "1px solid rgba(255,255,255,0.15)", padding: "10px 18px", borderRadius: 100, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
            ⬇️ Bajar PDF
          </button>
          <button onClick={openAdd} style={{ background: T.green, color: "#000", border: "none", padding: "10px 22px", borderRadius: 100, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>+ Agregar</button>
        </>}
      />

      {/* Banner contextual: inversiones sin propietario asignado.
          Sin owner las rentas/dividendos no se atribuyen a un contribuyente
          específico para el cálculo de Impuestos. */}
      {(() => {
        if (!user) return null;
        const sinOwner = (inversiones || []).filter(i => !i.owner || i.owner === "");
        if (sinOwner.length === 0) return null;
        return (
          <div style={{ marginBottom: 16, padding: "12px 14px", background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 14 }}>⚠️</span>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b", flex: 1 }}>
                {sinOwner.length} inversi{sinOwner.length !== 1 ? "ones" : "ón"} sin propietario asignado
              </div>
            </div>
            <div style={{ fontSize: 11, color: T.txt3, marginBottom: 10, lineHeight: 1.5 }}>
              Sin propietario, los rendimientos y dividendos no se atribuyen a un contribuyente para el cálculo de Impuestos.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {sinOwner.slice(0, 6).map((inv, idx) => (
                <div key={"fw_" + idx} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "rgba(0,0,0,0.2)", border: "1px solid " + T.border, borderRadius: 8 }}>
                  <span style={{ width: 6, height: 6, borderRadius: 3, background: "#ef4444", flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: T.txt, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {inv.n || "(sin nombre)"} <span style={{ color: T.txt3, fontWeight: 400, fontFamily: "monospace" }}>· valor {fm(inv.v || 0)}</span>
                    </div>
                    <div style={{ fontSize: 10, color: T.txt3, lineHeight: 1.4, marginTop: 2 }}>Asignale un propietario para atribuir los rendimientos correctamente</div>
                  </div>
                  <button onClick={() => openEdit(inv)} style={{ padding: "5px 10px", background: T.bg3, border: "1px solid " + T.border, borderRadius: 6, color: "#22c55e", cursor: "pointer", fontSize: 10, fontWeight: 600, flexShrink: 0 }}>
                    Editar →
                  </button>
                </div>
              ))}
              {sinOwner.length > 6 && (
                <div style={{ fontSize: 10, color: T.txt3, textAlign: "center", padding: "4px 0" }}>+ {sinOwner.length - 6} más</div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Banner explicando toggle sim (Commit 8.8) */}
      <SimToggleInfo total={items.length} activos={activos.length} moduloNombre="una inversión" />

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 20 }}>
        {[
          { l: "Patrimonio Total", v: fm(totalValor), c: T.green },
          { l: "Rinde al mes", v: rendimientoAnual > 0 ? fm(rendimientoAnual / 12) : "—", c: T.blue },
          { l: "Rinde al año", v: rendimientoAnual > 0 ? fm(rendimientoAnual) : "—", c: T.purple },
          
          { l: "Activos", v: activos.length, c: T.txt },
        ].map((m) => (
          <div key={m.l} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "16px 20px" }}>
            <div style={{ fontSize: 10, color: T.txt3, textTransform: "uppercase", fontWeight: 600 }}>{m.l}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: m.c, marginTop: 4 }}>{m.v}</div>
          </div>
        ))}
      </div>

      {/* 26-jul-2026 (Santiago): barra de composición por tipo de activo,
          el mismo componente de las otras tres secciones. En patrimonio esta
          lectura es especialmente útil: es la misma que alimenta la alerta de
          concentración del dashboard, así que el usuario ve acá el porqué de
          esa advertencia. */}
      {(() => {
        const grupos = {};
        activos.forEach(i => { const k = getType(i) || "Sin tipo"; grupos[k] = (grupos[k] || 0) + getVA(i, trm); });
        const datos = Object.entries(grupos).map(([name, value]) => ({ name, value })).filter(d => d.value > 0);
        if (datos.length < 2) return null;
        const tot = datos.reduce((s, d) => s + d.value, 0);
        const PAL = ["#22c55e","#3b82f6","#f59e0b","#a78bfa","#ec4899","#06b6d4","#eab308","#f97316"];
        return (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: T.txt3, marginBottom: 6, fontWeight: 600 }}>EN QUÉ ESTÁ TU PATRIMONIO</div>
            <BarraComposicion datos={datos} total={tot} paleta={PAL} T={T} altura={44} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: "7px 16px", marginTop: 8 }}>
              {[...datos].sort((a,b)=>b.value-a.value).map((d, i) => (
                <span key={d.name} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: T.txt2 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: PAL[i % PAL.length], flexShrink: 0 }} />
                  {d.name} <strong style={{ fontFamily: "monospace" }}>{((d.value/tot)*100).toFixed(0)}%</strong>
                </span>
              ))}
            </div>
          </div>
        );
      })()}
      {/* Table */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ padding: "12px", width: 40, borderBottom: `1px solid ${T.border}` }}>
                  <input type="checkbox" checked={items.length > 0 && selected.size === items.length} onChange={toggleAll}
                    style={{ accentColor: T.green, cursor: "pointer", width: 16, height: 16 }} />
                </th>
                {["Inversión", "Tipo", "Valor", "Ganancia", "Deuda", "On/Off", ""].map((h) => (
                  <th key={h} style={{ padding: "12px 14px", textAlign: h === "Inversión" || h === "" ? "left" : "right", color: T.txt3, fontWeight: 600, fontSize: 10, textTransform: "uppercase", borderBottom: `1px solid ${T.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 0 }}>
                    <div style={{padding:"40px 32px",textAlign:"center"}}>
                      <div style={{fontSize:40,marginBottom:12}}>🏦</div>
                      <h3 style={{fontSize:18,fontWeight:700,margin:"0 0 8px",color:"#fafafa"}}>Agrega tu patrimonio</h3>
                      <p style={{fontSize:13,color:"#71717a",maxWidth:420,margin:"0 auto 20px",lineHeight:1.6}}>Propiedades, fondos de inversión, CDTs, acciones, crypto, vehículos, cuentas de ahorro. Incluye el <strong style={{color:"#a1a1aa"}}>valor actual</strong> de cada activo.</p>
                      <div style={{display:"flex",gap:10,justifyContent:"center",marginBottom:24}}>
                        <button onClick={openAdd} style={{background:"#22c55e",color:"#000",border:"none",padding:"12px 24px",borderRadius:10,cursor:"pointer",fontWeight:700,fontSize:14}}>+ Agregar activo</button>
                        {onImport&&<button onClick={onImport} style={{background:"rgba(59,130,246,0.1)",color:"#3b82f6",border:"1px solid rgba(59,130,246,0.2)",padding:"12px 24px",borderRadius:10,cursor:"pointer",fontWeight:700,fontSize:14}}>⬆️ Subir tabla Excel de activos</button>}
                      </div>
                      <div style={{background:"#1e1e24",borderRadius:12,padding:"16px 20px",maxWidth:400,margin:"0 auto",textAlign:"left"}}>
                        <div style={{fontSize:11,fontWeight:700,color:"#71717a",marginBottom:8,textTransform:"uppercase",letterSpacing:1}}>Ejemplo de Excel para importar</div>
                        <table style={{width:"100%",fontSize:11,color:"#a1a1aa"}}>
                          <thead><tr style={{borderBottom:"1px solid rgba(255,255,255,0.06)"}}><th style={{padding:"4px 8px",textAlign:"left",color:"#71717a"}}>Activo</th><th style={{textAlign:"right",padding:"4px 8px",color:"#71717a"}}>Valor actual</th><th style={{padding:"4px 8px",color:"#71717a"}}>Tipo</th></tr></thead>
                          <tbody>
                            <tr><td style={{padding:"4px 8px"}}>Apto Bogotá</td><td style={{textAlign:"right",padding:"4px 8px"}}>$850,000,000</td><td style={{padding:"4px 8px"}}>Real Estate</td></tr>
                            <tr><td style={{padding:"4px 8px"}}>Fondo Bancolombia</td><td style={{textAlign:"right",padding:"4px 8px"}}>$120,000,000</td><td style={{padding:"4px 8px"}}>Fondo</td></tr>
                            <tr><td style={{padding:"4px 8px"}}>ETF VTI</td><td style={{textAlign:"right",padding:"4px 8px"}}>$45,000,000</td><td style={{padding:"4px 8px"}}>Acciones</td></tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </td></tr>
              ) : conEncabezados(itemsVisibles).map((inv) => {
                if (inv.__cat) return (
                  <tr key={inv.id} style={{ background: T.bg2 }}>
                    <td colSpan={8} style={{ padding: "9px 14px", borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: T.txt2 }}>
                          {inv.__cat} <span style={{ color: T.txt3, fontWeight: 500 }}>· {inv.__n}</span>
                        </span>
                        <span style={{ fontSize: 12.5, fontWeight: 800, color: T.green, fontFamily: "monospace" }}>
                          {fm(inv.__sub)}
                          <span style={{ color: T.txt3, fontWeight: 500, marginLeft: 6 }}>{inv.__pct.toFixed(0)}%</span>
                        </span>
                      </div>
                    </td>
                  </tr>
                );
                // La renta vinculada viene anualizada; calcMetrics trabaja en
                // mensual (multiplica por 12 para el cap rate), así que se divide.
                const m = calcMetrics(inv, deudas, trm, (rentaPorActivo[inv.id] || 0) / 12, (gastoPorActivo[inv.id] || 0) / 12);
                const name = getName(inv);
                const loc = getLoc(inv);
                const tipo = getType(inv);
                const va = getVA(inv, trm);
                return (
                  <tr key={inv.id} style={{ borderBottom: `1px solid ${T.border}`, background: selected.has(inv.id) ? T.greenDim : "transparent" }}>
                    <td style={{ padding: "10px 12px" }}>
                      <input type="checkbox" checked={selected.has(inv.id)} onChange={() => toggleSel(inv.id)}
                        style={{ accentColor: T.green, cursor: "pointer", width: 16, height: 16 }} />
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                        {inversionesSinOwnerIds.has(inv.id) && (
                          <span
                            onClick={() => openEdit(inv)}
                            title="Sin propietario asignado — los rendimientos no se atribuyen al cálculo de Impuestos"
                            style={{ fontSize: 13, cursor: "pointer", color: "#ef4444", flexShrink: 0 }}
                          >⚠️</span>
                        )}
                        <span>{name}</span>
                      </div>
                      <div style={{ fontSize: 11, color: T.txt3 }}>{[loc, tipo, inv.tasa ? inv.tasa + "% anual" : ""].filter(Boolean).join(" • ")}</div>
                      {(()=>{
                        if(!inv.owner || inv.owner==="") return null;
                        if(inv.owner==="na") return <div style={{fontSize:9,color:"#71717a",marginTop:2}}>🌐 N/A</div>;
                        if(inv.owner==="own_1") return <div style={{fontSize:9,color:"#71717a",marginTop:2}}>👤 Personal</div>;
                        const ow=(owners||[]).find(o=>o.id===inv.owner);
                        return ow ? <div style={{fontSize:9,color:"#71717a",marginTop:2}}>{ow.type==="juridica"?"🏢":"👤"} {ow.name}</div> : null;
                      })()}
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: 11, color: T.txt3 }}>{tipo}</td>
                    <td style={{ padding: "12px 14px", textAlign: "right", fontWeight: 700 }}>{fm(va)}</td>
                    <td style={{ padding: "12px 14px", textAlign: "right", fontWeight: 600, color: (va-getVC(inv, trm)) >= 0 ? T.green : T.red }}>{fm(va-getVC(inv, trm))}</td>
                    <td style={{ padding: "12px 14px", textAlign: "right", color: m.debtTotal > 0 ? T.red : T.txt3 }}>{m.debtTotal>0?fm(m.debtTotal):"-"}</td>
                    <td style={{ padding: "12px 14px", textAlign: "center" }}>
                      <button onClick={() => { if (!guardEdit(role)) return; onUpdate(items.map(x => x.id === inv.id ? {...x, sim: !(inv.sim!==false)} : x)); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: "2px 6px" }} title={inv.sim===false?"Mostrar en simulador":"Ocultar del simulador"}>{inv.sim===false?"⬜":"✅"}</button>
                    </td>
                    <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}><div style={{display:"flex",alignItems:"center",gap:4}}>
                      <button onClick={() => openEdit(inv)} style={{ background: T.bg3, border: "none", padding: "5px 8px", borderRadius: 6, cursor: "pointer", color: T.txt2, fontSize: 11 }}>✏️</button>
                      <button onClick={() => { if (!guardEdit(role)) return; if (confirm("¿Eliminar?")) onUpdate(items.filter((i) => i.id !== inv.id)); }}
                        style={{ background: T.redDim, border: "none", padding: "5px 8px", borderRadius: 6, cursor: "pointer", color: T.red, fontSize: 11 }}>🗑️</button>
                    </div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {/* 26-jul-2026: los bloqueados van DEBAJO de la tabla, con su monto
            visible. Que se vea cuánto hay del otro lado del candado es
            deliberado: un candado que no deja ver qué protege no motiva, y
            además el usuario merece saber que sus totales incluyen algo que
            no está viendo en detalle. */}
        {hayLimite && (
          <BloqueadosPorPlan
            cantidad={bloqueados.length}
            monto={montoBloqueado}
            fmt={fm}
            T={T}
            onUpgrade={onUpgrade}
            que="activos"
          />
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div onClick={() => setShowForm(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 20, width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto", padding: 32 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{editId ? "Editar Activo" : "Agregar Activo"}</h3>
              <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", color: T.txt3, cursor: "pointer", fontSize: 18 }}>✕</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ gridColumn: "1/-1" }}>
                <In l="Nombre" value={form.nombre} onChange={(v) => setForm((p) => ({ ...p, nombre: v }))} placeholder="Ej: Apartamento, Fondo, Acciones, Terreno" />
              </div>
              <In l="Ubicación" value={form.ubicacion} onChange={(v) => setForm((p) => ({ ...p, ubicacion: v }))} placeholder="Miami, FL" />
              <In l="Propietario fiscal (opcional)" value={form.owner} onChange={(v) => setForm((p) => ({ ...p, owner: v }))} options={[{v:"",l:"— Sin asignar (no calcula impuesto)"},{v:"own_1",l:"👤 Personal"},{v:"na",l:"🌐 N/A — No aplica (exterior)"},...(owners||[]).filter(o=>o.id!=="own_1").map(o=>({v:o.id,l:(o.type==="juridica"?"🏢 ":"👤 ")+o.name}))]} />
              <In l="Tipo" value={form.tipo} onChange={(v) => setForm((p) => ({ ...p, tipo: v }))} options={["Real Estate", "Fondo de Inversión", "CDT", "Acciones", "Crypto", "Bodega", "Lote", "Vehículo", "Local Comercial", "Renta Fija", "Negocio", "Cash", "Otro"]} />
              {["Real Estate", "Bodega", "Lote", "Local Comercial"].includes(form.tipo) && (
                <div style={{ gridColumn: "1/-1", background: "rgba(249,115,22,0.04)", border: "1px solid rgba(249,115,22,0.2)", borderRadius: 10, padding: "12px 14px" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#f97316", marginBottom: 8 }}>🏠 ¿Cómo usás este inmueble? (define si depreciación aplica)</div>
                  <select value={form.fiscalCode || "INV_INMUEBLE_HABITACIONAL"} onChange={(e) => setForm((p) => ({ ...p, fiscalCode: e.target.value }))}
                    style={{ width: "100%", background: T.bg3, border: "1px solid " + T.border, color: T.txt, padding: "10px 12px", borderRadius: 8, fontSize: 13, outline: "none", cursor: "pointer", marginBottom: 10 }}>
                    <option value="INV_INMUEBLE_HABITACIONAL">Habitacional — donde vivo (no se deprecia)</option>
                    <option value="INV_INMUEBLE_ARRENDADO">Arrendado — genera renta (deprecia construcción 2.22%/año Art. 137)</option>
                    <option value="INV_INMUEBLE_COMERCIAL_PROPIO">Uso propio comercial (deprecia construcción)</option>
                    <option value="INV_INMUEBLE_VACANTE">Vacante — sin uso productivo (no deprecia)</option>
                  </select>
                  <label style={{ fontSize: 10, fontWeight: 600, color: "#a1a1aa", display: "block", marginBottom: 4 }}>% del valor que es terreno (no depreciable)</label>
                  <input type="number" min="0" max="100" value={form.pctTerreno ?? ""} onChange={(e) => setForm((p) => ({ ...p, pctTerreno: e.target.value }))} placeholder="Default: 30 (urbanos)"
                    style={{ width: "100%", background: T.bg3, border: "1px solid " + T.border, color: T.txt, padding: "8px 10px", borderRadius: 6, fontSize: 12, outline: "none" }} />
                  <div style={{ fontSize: 10, color: "#71717a", marginTop: 4, lineHeight: 1.5 }}>Solo la construcción se deprecia fiscalmente (Art. 131 ET). El terreno no. Típico urbano: 30%. Si es una finca o lote con poca construcción, puede ser 80%+.</div>
                </div>
              )}
              <In l="Moneda del valor" value={form.moneda || "COP"} onChange={(v) => setForm((p) => ({ ...p, moneda: v }))} options={[{v:"COP",l:"🇨🇴 COP (pesos)"},{v:"USD",l:"🇺🇸 USD (se convierte a la TRM)"}]} />
              <In l="Valor Actual" value={form.va} onChange={(v) => setForm((p) => ({ ...p, va: v }))} type="number" placeholder="0" />
              <In l="Valor Compra" value={form.vc} onChange={(v) => setForm((p) => ({ ...p, vc: v }))} type="number" placeholder="0" />
              {/* ALERTA ANTI-TYPO (20-jul-2026, Santiago): Puerto Madero quedó
                  con valor $11.7M vs costo $4.5B → ganancia -$4.5B por ceros
                  faltantes. Si el valor actual es <10% del costo, avisamos. */}
              {(() => {
                const vaN = Math.abs(parseFloat(form.va)) || 0;
                const vcN = Math.abs(parseFloat(form.vc)) || 0;
                if (vaN > 0 && vcN > 0 && vaN < vcN * 0.1) {
                  const perdidaPct = ((1 - vaN / vcN) * 100).toFixed(0);
                  return (
                    <div style={{ gridColumn: "1/-1", background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.35)", borderRadius: 8, padding: "8px 12px", fontSize: 11, color: "#f97316", lineHeight: 1.5 }}>
                      ⚠️ <strong>Revisá los ceros:</strong> el valor actual (${vaN.toLocaleString("es-CO")}) es {perdidaPct}% menor que lo que costó (${vcN.toLocaleString("es-CO")}). Si es correcto, ignorá este aviso — pero si el activo vale ${(vaN/1e6).toFixed(1)} millones y costó ${(vcN/1e9).toFixed(1)} mil millones, probablemente faltan ceros en el valor actual.
                    </div>
                  );
                }
                return null;
              })()}
              <div style={{gridColumn:"1/-1",background:T.bg3,borderRadius:12,padding:"14px 16px"}}>
                <div style={{fontSize:11,fontWeight:700,color:T.txt2,marginBottom:10}}>💰 ¿Este activo genera ingreso?</div>

                {/* 14-sep-2026 — A diferencia del campo único de gastos, que se
                    retiró porque lo usaba 1 de 187 activos, estos campos SÍ se
                    usan: 50 de 187 tienen % de rendimiento. Así que no se
                    quitan.
                    Lo que faltaba era distinguir la ESTIMACIÓN del ingreso
                    REGISTRADO. Escribir aquí un rendimiento no crea un ingreso
                    — eso fue justamente lo que confundió a Santiago ("me dijo
                    que sí lo añadía y no lo añadió"). Ahora el bloque muestra
                    primero lo que de verdad está registrado y vinculado, y deja
                    los campos como lo que son: una calculadora. */}
                {(() => {
                  const anual = (typeof rentaPorActivo !== "undefined" && editId)
                    ? (rentaPorActivo[editId] || 0) : 0;
                  if (!anual) return null;
                  return (
                    <div style={{ marginBottom: 10, padding: "9px 11px", borderRadius: 9,
                          background: T.greenDim || "rgba(34,197,94,0.10)",
                          border: "1px solid rgba(34,197,94,0.28)" }}>
                      <div style={{ fontSize: 11.5, color: T.txt2, lineHeight: 1.55 }}>
                        Ingresos ya registrados para este activo:{" "}
                        <strong style={{ color: T.green }}>
                          ${Math.round(anual / 12).toLocaleString("es-CO")}/mes
                        </strong>{" "}
                        <span style={{ color: T.txt3 }}>
                          (${Math.round(anual).toLocaleString("es-CO")} al año)
                        </span>
                      </div>
                      <div style={{ fontSize: 10, color: T.txt3, marginTop: 3 }}>
                        Es lo que cuenta para tu flujo de caja y tu rentabilidad.
                      </div>
                    </div>
                  );
                })()}
                <div style={{display:"flex",gap:8}}>
                  <div style={{flex:1}}><In l="Renta mensual ($)" value={form.renta} onChange={(v) => {
                    const va=parseFloat(form.va)||0;
                    const newTasa=va>0&&v?((parseFloat(v)*12/va)*100).toFixed(1):"";
                    setForm((p) => ({ ...p, renta: v, tasa: newTasa }));
                  }} type="number" placeholder="Ej: 4200000" /></div>
                  <div style={{flex:1}}><In l="% Rendimiento anual" value={form.tasa} onChange={(v) => {
                    const va=parseFloat(form.va)||0;
                    const newRenta=va>0&&v?Math.round(va*parseFloat(v)/100/12):"";
                    setForm((p) => ({ ...p, tasa: v, renta: String(newRenta) }));
                  }} type="number" placeholder="Ej: 12" /></div>
                </div>
                <div style={{fontSize:10,color:T.txt3,marginTop:6,lineHeight:1.5}}>
                  Estimación: escribí uno y el otro se calcula solo. Estos campos
                  NO crean el ingreso — sirven para dimensionarlo. Para que cuente
                  en tu flujo, registralo con el botón de abajo o desde la sección
                  de Ingresos.
                </div>
                {/* 14-sep-2026 (Santiago: "poner en una sola casilla todos los
                    gastos que tiene esa propiedad es poco práctico").
                    Tenía razón, y los datos lo confirman: de 187 activos
                    cargados, UNO solo usaba este campo. Nadie puede meter
                    predial, administración, seguros y mantenimiento en una
                    casilla y después acordarse de qué se compone el número, ni
                    actualizar uno sin recalcular a mano los otros.
                    Los gastos ahora se cargan uno por uno en su sección y se
                    vinculan al activo. Acá solo se muestra el resultado. */}
                <div style={{ marginTop: 10, padding: "11px 13px", borderRadius: 10,
                      background: T.bg3, border: "1px solid " + T.border }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.txt3,
                        letterSpacing: 0.3, textTransform: "uppercase", marginBottom: 6 }}>
                    Gastos de este activo
                  </div>
                  {(() => {
                    const anual = (typeof gastoPorActivo !== "undefined" && editId)
                      ? (gastoPorActivo[editId] || 0) : 0;
                    // El valor viejo del campo único se sigue mostrando si
                    // existe: es dato real del usuario y borrarlo de la vista
                    // sin avisar sería peor que la duplicación que corregimos.
                    const legacy = Number(form.gastosMes) || 0;
                    if (!anual && !legacy) {
                      return (
                        <div style={{ fontSize: 11, color: T.txt3, lineHeight: 1.55 }}>
                          Sin gastos vinculados. Cargalos en <strong style={{ color: T.txt2 }}>Gastos</strong>{" "}
                          y elegí este activo en “Activo al que pertenece”: predial,
                          administración, seguros y mantenimiento como registros
                          separados, cada uno con su propia vigencia.
                        </div>
                      );
                    }
                    return (
                      <div style={{ fontSize: 12, color: T.txt2, lineHeight: 1.6 }}>
                        {anual > 0 && (
                          <div>
                            Vinculados desde Gastos:{" "}
                            <strong style={{ color: T.txt }}>
                              ${Math.round(anual / 12).toLocaleString("es-CO")}/mes
                            </strong>{" "}
                            <span style={{ color: T.txt3 }}>
                              (${Math.round(anual).toLocaleString("es-CO")} al año)
                            </span>
                          </div>
                        )}
                        {legacy > 0 && (
                          <div style={{ marginTop: 5, fontSize: 11, color: "#f97316" }}>
                            Además hay ${legacy.toLocaleString("es-CO")}/mes cargados en el
                            campo antiguo. Conviene pasarlos a Gastos como registros
                            separados para saber de qué se componen.
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
              {false && <div style={{ gridColumn: "1/-1", background: T.blue + "10", borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 12, color: T.blue }}>💡 Si este activo genera renta mensual (arriendo, dividendos, rendimientos), ponla en el módulo de <strong>Ingresos</strong>. Aquí solo va el valor del activo.</div>
              </div>}
              {/* 14-sep-2026 — Antes el bloque solo aparecía si había % de
                  rendimiento. Quien escribía la renta mensual directamente (8
                  activos en la base) no veía nada y se quedaba sin forma de
                  registrarla. Ahora basta con cualquiera de los dos: los campos
                  están enlazados, así que escribir uno completa el otro. */}
              {((parseFloat(form.tasa) > 0 && parseFloat(form.va) > 0) || parseFloat(form.renta) > 0) && (
                <div style={{ gridColumn: "1/-1", background: T.greenDim, borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 12, color: T.green, fontWeight: 600 }}>💰 Este activo generaría:</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: T.green, marginTop: 4 }}>
                    {"$" + Math.round((parseFloat(form.va) * parseFloat(form.tasa) / 100) / 12).toLocaleString("es-CO") + "/mes"}
                  </div>
                  <div style={{ fontSize: 11, color: T.txt3, marginTop: 2 }}>
                    = {"$" + Math.round(parseFloat(form.va) * parseFloat(form.tasa) / 100).toLocaleString("es-CO") + "/año"} ({form.tasa}% de {"$" + Math.round(parseFloat(form.va)).toLocaleString("es-CO")})
                  </div>
                  {/* 14-sep-2026 (Santiago: "un activo dije que también
                      rentaba, me dijo que sí lo añadía como rendimiento y no lo
                      añadió"). Tenía razón. El bloque mostraba la cifra, decía
                      "este activo generaría $X/mes" y después pedía ir a
                      cargarlo a mano en otro módulo. Ese texto se leía como
                      confirmación, no como instrucción -- y el módulo no tenía
                      forma de crear el ingreso: solo recibía onUpdate para
                      activos.
                      Ahora lo crea de verdad, y queda vinculado al activo por
                      activoId, que es lo que permite calcular su rendimiento. */}
                  {onCrearIngreso ? (
                    <button
                      type="button"
                      onClick={() => {
                        // Si el usuario escribió la renta, esa manda: es un
                        // dato suyo, no una derivación del porcentaje.
                        const mensual = parseFloat(form.renta) > 0
                          ? Math.round(parseFloat(form.renta))
                          : Math.round((parseFloat(form.va) * parseFloat(form.tasa) / 100) / 12);
                        if (!(mensual > 0)) return;
                        const nombreActivo = form.nombre || form.n || "activo";
                        onCrearIngreso({
                          id: `ing_${Date.now()}`,
                          nombre: `Rendimiento — ${nombreActivo}`,
                          categoria: "Rentas de capital",
                          fiscalCode: "CAP_RENDIMIENTO_GENERICO",
                          mensual,
                          tipo: "fijo",
                          frecuencia: "mensual",
                          // Hereda la moneda del activo: un activo en dólares
                          // genera renta en dólares, y guardarla como pesos
                          // multiplicaría el error por la TRM.
                          moneda: form.moneda || "COP",
                          owner: form.owner || "",
                          // El vínculo es el punto: sin él la renta existiría
                          // suelta y el activo seguiría figurando improductivo.
                          // El id del activo vive en editId, no en el form
                          // (openEdit lo guarda aparte).
                          activoId: editId || "",
                          sim: true,
                        });
                        alert(`Ingreso creado: Rendimiento — ${nombreActivo}. Queda vinculado a este activo y podés ajustarlo en el módulo de Ingresos.`);
                      }}
                      style={{ marginTop: 8, padding: "8px 14px", borderRadius: 9,
                        background: T.green, color: "#0a0a0a", border: "none",
                        cursor: "pointer", fontSize: 12, fontWeight: 800 }}>
                      + Registrar este rendimiento como ingreso
                    </button>
                  ) : (
                    <div style={{ fontSize: 11, color: T.blue, marginTop: 6, fontWeight: 600 }}>
                      👉 Agregá este ingreso en el módulo de Ingresos con categoría "Rendimiento"
                    </div>
                  )}
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 20 }}>
              <button onClick={() => setShowForm(false)} style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.txt2, padding: "10px 20px", borderRadius: 10, cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
              <button onClick={handleSave} style={{ background: T.green, color: "#000", border: "none", padding: "10px 24px", borderRadius: 10, cursor: "pointer", fontWeight: 700 }}>{editId ? "Guardar" : "Agregar"}</button>
            </div>
          </div>
        </div>
      )}
    
    <Disclaimer variante="general" idioma="es" T={T} compacto />
  </div>
  );
}
