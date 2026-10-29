import { useMemo, useState } from "react";
import PageHeader from "./PageHeader";
import { C, Cα, F, R } from "../lib/designTokens";
import { planGananciaOcasional, PLAN_DEFAULT_USAR } from "../lib/planGananciaOcasional.js";
import { NORMA_GO_VERIFICADA } from "../lib/normaGananciaOcasional.js";
import { claseDeActivo } from "../lib/taxonomiaActivos.js";
import { exportGananciaOcasionalPDF, AVISO_LEGAL_GO } from "../lib/pdfSectionExport.js";

/**
 * Solucionador de ganancia ocasional — venta de inmuebles (Colombia).
 *
 * 28-oct-2026 (Santiago): "debería ser más un solucionador: vas a pagar tanto;
 * haz esto y ahorras tanto". Validado primero como prototipo en el chat.
 * Arriba cuatro datos; luego el veredicto (hoy → con tu plan → ahorro) con la
 * escalera de ahorro; luego el plan paso a paso: cada paso dice qué hacer, la
 * norma, cuánto ahorra, pide su dato ahí mismo y explica por qué se puede.
 * Solo aparecen los pasos que aplican al tipo de dueño. El cálculo vive en
 * lib/planGananciaOcasional.js (puro y testeado).
 */

const MM = (v) => {
  const x = (Number(v) || 0) / 1e6;
  return "$" + x.toLocaleString("es-CO", { maximumFractionDigits: Math.abs(x) >= 100 ? 0 : 1 }) + " MM";
};
const hoy = new Date();
const AÑOS = Array.from({ length: hoy.getFullYear() - 1954 }, (_, i) => hoy.getFullYear() - i);

const card = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.lg, padding: 16 };
const inp = { width: "100%", boxSizing: "border-box", background: C.raised, border: `1px solid ${C.border}`, borderRadius: R.md, color: C.text, padding: "10px 12px", fontSize: 14, outline: "none" };
const td = { padding: "5px 16px 5px 0", borderBottom: `1px solid ${C.border}` };

function Plata({ value, onChange, id }) {
  const txt = value ? Math.round(Number(value)).toLocaleString("es-CO") : "";
  return (
    <input id={id} inputMode="numeric" style={inp} placeholder="$0" value={txt ? "$" + txt : ""}
      onChange={(ev) => { const d = ev.target.value.replace(/[^0-9]/g, ""); onChange(d ? Number(d) : ""); }} />
  );
}

function Campo({ label, children }) {
  return (
    <label style={{ display: "grid", gap: 5, minWidth: 0 }}>
      <span style={{ ...F.caption, fontWeight: 600, color: C.muted }}>{label}</span>
      {children}
    </label>
  );
}

function Check({ checked, onChange, children }) {
  return (
    <label style={{ ...F.h3, display: "inline-flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
      <input type="checkbox" checked={checked} onChange={(ev) => onChange(ev.target.checked)} style={{ width: 18, height: 18, accentColor: C.ok }} /> {children}
    </label>
  );
}

function Nota({ paso }) {
  if (!paso.porque && !paso.formula) return null;
  return (
    <details style={{ marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${C.border}` }}>
      <summary style={{ ...F.h3, color: C.accent, cursor: "pointer" }}>{paso.formula ? "Ver la fórmula y por qué se puede" : "Por qué se puede y qué guardar"}</summary>
      <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
        {paso.porque && <div style={F.body}><b style={{ color: C.text }}>Por qué: </b>{paso.porque}</div>}
        {paso.formula && (
          <>
            <div style={F.body}>
              <b style={{ color: C.text }}>Fórmula: </b>costo × (1 + % de cada año), desde {paso.formula.desde} hasta {paso.formula.hasta}.{" "}
              <span style={{ ...F.mono, fontSize: 13 }}>{MM(paso.formula.costo)} × {paso.formula.factor.toLocaleString("es-CO", { maximumFractionDigits: 4 })} = {MM(paso.formula.resultado)}</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", minWidth: 280, fontSize: 13 }}>
                <thead>
                  <tr>{["Año", "% del decreto", "Costo al cierre"].map((h) => <th key={h} style={{ ...td, textAlign: "left", color: C.subtle }}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {paso.formula.filas.map((fl) => (
                    <tr key={fl.ano}>
                      <td style={{ ...td, color: C.muted }}>{fl.ano}</td>
                      <td style={{ ...td, color: C.muted }}>{fl.pct.toLocaleString("es-CO")}%</td>
                      <td style={{ ...td, color: C.text, fontVariantNumeric: "tabular-nums" }}>{MM(fl.costo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={F.caption}>El % del año de la venta sale por decreto el año siguiente, antes de declarar, y sube el costo un poco más (no está incluido: resultado conservador). Si parte del costo son mejoras de otros años, cada parte se reajusta desde su propio año.</div>
          </>
        )}
        {paso.ejemplo && <div style={{ ...F.body, padding: 10, borderRadius: R.md, background: Cα.ok08 }}><b style={{ color: C.text }}>Ejemplo: </b>{paso.ejemplo}</div>}
        {paso.soporte && <div style={F.body}><b style={{ color: C.text }}>Soporte que debes guardar: </b>{paso.soporte}</div>}
        {paso.ojo && <div style={F.body}><b style={{ color: C.text }}>Ojo: </b>{paso.ojo}</div>}
      </div>
    </details>
  );
}

const ETIQUETA_BARRA = { factor: "Factor DIAN", reajuste: "Reajuste", mejoras: "Mejoras", avaluo: "Avalúo", enero: "Firmar en enero", perdidas: "Pérdidas", vivienda: "Vivienda" };

function Escalera({ r }) {
  const items = [{ l: "Hoy", v: r.hoy, t: "total" }];
  r.pasos.filter((p) => p.on && p.ahorro > 0 && !p.info).forEach((p) => items.push({ l: ETIQUETA_BARRA[p.id] || p.id, v: p.ahorro, t: "paso" }));
  items.push({ l: "Con tu plan", v: r.final, t: "total" });
  const W = 900, H = 240, top = 26, bot = 36, gap = 14;
  const max = Math.max(r.hoy, 1), n = items.length, bw = (W - gap * (n - 1)) / n;
  const y = (v) => top + (H - top - bot) * (1 - v / max);
  let run = r.hoy;
  return (
    <div style={{ overflowX: "auto" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ display: "block", width: "100%", minWidth: 520, height: "auto" }} role="img" aria-label="Escalera de ahorro">
        <line x1="0" x2={W} y1={H - bot} y2={H - bot} stroke={C.border} />
        {items.map((it, i) => {
          const x = i * (bw + gap);
          let y0, y1, fill;
          if (it.t === "total") { y0 = y(it.v); y1 = H - bot; fill = i === 0 ? C.danger : C.text; }
          else { y0 = y(run); y1 = y(run - it.v); run -= it.v; fill = C.ok; }
          return (
            <g key={i}>
              <rect x={x} y={y0} width={bw} height={Math.max(2, y1 - y0)} rx="5" fill={fill} opacity={it.t === "total" && i > 0 ? 0.85 : 1} />
              <text x={x + bw / 2} y={Math.max(14, y0 - 8)} textAnchor="middle" fontSize="14" fontWeight="700" fill={it.t === "paso" ? C.ok : C.text} style={{ fontFamily: "ui-monospace, Menlo, monospace" }}>{it.t === "paso" ? "−" : ""}{MM(it.v)}</text>
              <text x={x + bw / 2} y={H - bot + 22} textAnchor="middle" fontSize="13" fill={C.subtle}>{it.l}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function OptimizadorGananciaOcasional({ u }) {
  const owners = u?.owners || [];
  const inmuebles = useMemo(() => (u?.inv || []).filter((i) => claseDeActivo(i.tp || i.tipo).clase === "inmueble"), [u]);
  const [f, setF] = useState({
    titular: "natural", tipo: "urbano", anoCompra: "", costo: "", venta: "", anoVenta: hoy.getFullYear(),
    avaluoAnterior: "", avaluoSiguiente: "", mejoras: "", perdidas: "", reajusteContador: "",
    vivienda: false, afc: false, usar: { ...PLAN_DEFAULT_USAR },
  });
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }));
  const setUsar = (id, v) => setF((p) => ({ ...p, usar: { ...p.usar, [id]: v } }));
  const jur = f.titular === "juridica";

  const traer = (id) => {
    const i = inmuebles.find((x) => String(x.id ?? x.n ?? x.nombre) === id);
    if (!i) return;
    const ow = owners.find((o) => o.id === i.owner);
    setF((p) => ({
      ...p, titular: ow?.type === "juridica" ? "juridica" : "natural",
      venta: Number(i.va) || p.venta, costo: Number(i.vc ?? i.valor_compra) || p.costo,
      vivienda: ow?.type !== "juridica" && /HABITACIONAL/.test(i.fiscalCode || ""), reajusteContador: "",
    }));
  };

  const listo = Number(f.venta) > 0 && Number(f.costo) > 0 && Number(f.anoCompra) > 1900;
  const r = useMemo(() => (listo ? planGananciaOcasional(f) : null), [f, listo]);
  const etiquetaCampo = {
    avaluoAnterior: `Avalúo catastral ${f.anoVenta - 1}`, avaluoSiguiente: `Avalúo catastral ${f.anoVenta}`,
    mejoras: "Mejoras con factura", perdidas: "Pérdida del otro activo", reajusteContador: "Costo reajustado",
  };

  return (
    <div>
      <PageHeader label="Herramientas · venta de inmueble" title="¿Cuánto pago si vendo, y cómo pago menos?" accent="pago menos" compact
        subtitle="Cuatro datos y te armamos el plan: cada paso dice qué hacer, qué norma lo permite y cuánto te ahorra. Marca los que vas a hacer y mira cómo baja el impuesto." />

      <div style={{ ...card, marginBottom: 16 }}>
        {inmuebles.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <Campo label="Trae uno de tus inmuebles">
              <select id="go-traer" style={inp} defaultValue="" onChange={(ev) => traer(ev.target.value)}>
                <option value="" disabled>Elegir…</option>
                {inmuebles.map((i) => { const k = String(i.id ?? i.n ?? i.nombre); return <option key={k} value={k}>{i.n || i.nombre || "Inmueble"}</option>; })}
              </select>
            </Campo>
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
          <Campo label="¿A nombre de quién está?">
            <div style={{ display: "flex", gap: 6 }}>
              {[["natural", "👤 A mi nombre"], ["juridica", "🏢 Empresa"]].map(([v, l]) => (
                <button key={v} type="button" onClick={() => set("titular")(v)}
                  style={{ flex: 1, padding: "9px 8px", borderRadius: R.md, cursor: "pointer", fontWeight: 600, fontSize: 13,
                    border: `1px solid ${f.titular === v ? C.accent : C.border}`, background: f.titular === v ? Cα.accent15 : C.raised, color: f.titular === v ? C.text : C.muted }}>{l}</button>
              ))}
            </div>
          </Campo>
          <Campo label={jur ? "Año de compra o construcción" : "Año de compra"}>
            <select id="go-ano" style={inp} value={f.anoCompra} onChange={(ev) => set("anoCompra")(Number(ev.target.value))}>
              <option value="">Año…</option>{AÑOS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </Campo>
          <Campo label={jur ? "Costo fiscal declarado" : "Valor en la escritura de compra"}><Plata id="go-costo" value={f.costo} onChange={set("costo")} /></Campo>
          <Campo label="Precio de venta"><Plata id="go-venta" value={f.venta} onChange={set("venta")} /></Campo>
          <Campo label="¿En qué año firmas la escritura?">
            <select id="go-anoventa" style={inp} value={f.anoVenta} onChange={(ev) => set("anoVenta")(Number(ev.target.value))}>
              {[0, 1, 2].map((d) => hoy.getFullYear() + d).map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </Campo>
        </div>
      </div>

      {!r ? (
        <div style={{ ...card, display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
          <span style={{ fontSize: 28 }}>🧮</span>
          <div>
            <div style={F.h3}>Completa año, costo y precio de venta</div>
            <div style={F.caption}>Con esos datos te mostramos cuánto pagarías hoy y el plan para pagar menos.</div>
          </div>
        </div>
      ) : (
        <>
          <div style={{ ...card, marginBottom: 16, borderColor: r.ahorro > 0 ? Cα.ok25 : C.border }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, alignItems: "end", marginBottom: 14 }}>
              <div>
                <div style={F.label}>Hoy pagarías</div>
                <div style={{ ...F.monoXl, color: C.danger, marginTop: 4 }}>{MM(r.hoy)}</div>
                <div style={F.caption}>{r.esGO ? `(${MM(f.venta)} − ${MM(f.costo)}) × 15%` : "Menos de 2 años: se paga como renta normal, no al 15%."}</div>
              </div>
              <div>
                <div style={F.label}>Con tu plan</div>
                <div style={{ ...F.monoXl, color: C.text, marginTop: 4 }}>{MM(r.final)}</div>
                <div style={F.caption}>Costo usado: {MM(r.costoFinal)}</div>
              </div>
              <div>
                <div style={F.label}>Te ahorras</div>
                <div style={{ ...F.monoXl, color: C.ok, marginTop: 4 }}>{MM(r.ahorro)}</div>
                <div style={F.caption}>{r.hoy ? `${Math.round((r.ahorro / r.hoy) * 100)}% menos de impuesto` : ""}</div>
              </div>
            </div>
            <Escalera r={r} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
              <div style={{ ...F.caption, flex: "1 1 260px" }}>Estimación para planear, no es asesoría tributaria. Todo debe validarse con un contador o asesor tributario.</div>
              <button type="button" onClick={() => exportGananciaOcasionalPDF(r, f)}
                style={{ padding: "9px 14px", borderRadius: R.md, border: `1px solid ${C.border}`, background: C.raised, color: C.text, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                📄 Descargar PDF para tu contador
              </button>
            </div>
          </div>

          <div style={{ ...F.label, margin: "0 0 10px" }}>Tu plan, paso a paso</div>
          <div style={{ ...card, marginBottom: 12, ...F.body }}>
            <b style={{ color: C.text }}>Cómo se combinan: </b>
            el <b style={{ color: C.text }}>{jur ? "reajuste" : "factor DIAN"}</b> y las <b style={{ color: C.text }}>mejoras</b> se suman entre sí y forman tu costo por compra ({MM(r.caminoCompra)}).
            El <b style={{ color: C.text }}>avalúo catastral</b> es la alternativa: se usa el mayor de los dos, nunca los dos juntos.
            Las <b style={{ color: C.text }}>pérdidas</b> de otros activos vendidos el mismo año{jur ? " y el dividendo no gravado" : " y la exención de vivienda"} se aplican aparte, encima de lo anterior.
          </div>

          <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
            {r.pasos.map((p, i) => {
              const apagado = !p.info && p.ok && !p.on;
              const gris = !p.ok && !p.info;
              return (
                <div key={p.id} style={{ ...card, display: "grid", gridTemplateColumns: "auto minmax(0,1fr) auto", gap: 14, opacity: apagado ? 0.65 : 1 }}>
                  <div style={{ width: 30, height: 30, borderRadius: R.pill, display: "grid", placeItems: "center", fontWeight: 800, fontSize: 14,
                    background: gris ? C.raised : Cα.ok15, color: gris ? C.subtle : C.ok }}>{i + 1}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={F.label}>{p.norma}</div>
                    <div style={{ ...F.h2, marginTop: 2 }}>{p.titulo}</div>
                    <div style={{ ...F.body, marginTop: 4 }}>{p.texto}</div>
                    {(p.campos || []).length > 0 && (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginTop: 10 }}>
                        {p.campos.map((k) => (
                          <Campo key={k} label={etiquetaCampo[k]}>
                            <Plata id={`go-${k}`} value={p.valores?.[k] != null && !f[k] ? p.valores[k] : f[k]} onChange={set(k)} />
                          </Campo>
                        ))}
                      </div>
                    )}
                    {p.checks && (
                      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 10 }}>
                        <Check checked={f.vivienda} onChange={set("vivienda")}>Vivo ahí</Check>
                        <Check checked={f.afc} onChange={set("afc")}>Todo irá a AFC o al crédito</Check>
                      </div>
                    )}
                    {p.ok && !p.info && (
                      <div style={{ marginTop: 10 }}><Check checked={!!p.on} onChange={(v) => setUsar(p.id, v)}>Lo voy a hacer</Check></div>
                    )}
                    <Nota paso={p} />
                  </div>
                  <div style={{ textAlign: "right", minWidth: 96 }}>
                    <div style={{ ...F.mono, color: p.info || p.ahorro > 0 ? C.ok : C.subtle }}>{p.info ? "✓" : p.ahorro > 0 ? `−${MM(p.ahorro)}` : "$0"}</div>
                    <div style={F.caption}>{p.info ? "sin costo" : "de ahorro"}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* 28-oct-2026 (Santiago): "de acuerdo a la fecha de escritura puede tener más
          oportunidades… los cambios de año es bueno aprovecharlos". */}
      <div style={{ ...card, marginBottom: 12, borderColor: Cα.accent25 }}>
        <div style={{ ...F.h2, marginBottom: 4 }}>📅 La fecha de la escritura también ahorra</div>
        <div style={{ ...F.caption, marginBottom: 10 }}>El año en que firmas cambia qué valores cuentan. Si tienes margen para escoger la fecha, planéala con tiempo.</div>
        <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 8, ...F.body }}>
          <li><b style={{ color: C.text }}>Cada enero cambia el avalúo que cuenta.</b> Firmas en {f.anoVenta} → cuenta el avalúo {f.anoVenta - 1}. Firmas en enero de {f.anoVenta + 1} → cuenta el avalúo {f.anoVenta}. Compara los dos recibos del predial: si el nuevo es mayor, esperar unas semanas puede bajar el impuesto (Art. 72).</li>
          <li><b style={{ color: C.text }}>Subir el avalúo se planea con un año de anticipación.</b> Donde el predial se declara (como Bogotá) puedes declarar un autoavalúo mayor; en otras ciudades se le pide al catastro una autoestimación. Ese valor cuenta para ventas del año siguiente, no del mismo año, y sube el predial. Un avalúo comercial de perito no sirve.</li>
          <li><b style={{ color: C.text }}>Cada año suma un reajuste más.</b> El costo por compra se reajusta con el porcentaje del año de la venta (Art. 70 para empresas, factor del Art. 73 para personas), así que vender un año después también sube un poco el costo.</li>
          <li><b style={{ color: C.text }}>Los 2 años cambian la tarifa.</b> Si te falta poco para cumplir 2 años con el inmueble, esperar a cumplirlos pasa de renta normal (hasta 39% o 35%) a ganancia ocasional (15%). Cuenta desde la fecha de la escritura de compra.</li>
          <li><b style={{ color: C.text }}>Junta las pérdidas en el mismo año.</b> Si vas a vender otro activo que perdió valor, hazlo el mismo año de esta escritura para restarlo.</li>
        </ul>
        <div style={{ ...F.caption, marginTop: 10 }}>Lo que define el año es la escritura, no la promesa de compraventa. Si recibes anticipos antes, confirma con tu contador cuándo se reconoce el ingreso.</div>
      </div>

      <div style={{ ...card, marginBottom: 12 }}>
        <div style={{ ...F.label, marginBottom: 8 }}>Antes de firmar</div>
        <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6, ...F.body }}>
          <li><b style={{ color: C.text }}>Tarifa:</b> 15% para personas y empresas si el inmueble se tuvo 2 años o más (Arts. 300, 313 y 314). Con menos de 2 años es renta normal: hasta 39% en personas y 35% en empresas.</li>
          <li><b style={{ color: C.text }}>Precio real:</b> se escritura por lo que realmente se paga, bajo juramento de que no hubo pagos por fuera; el precio no puede ser menor que el costo ni que el avalúo catastral (Art. 90).</li>
          <li><b style={{ color: C.text }}>Sin maniobras:</b> partir la venta, escindir una empresa o mover el inmueble solo para pagar menos puede ser abuso tributario (Art. 869), y la DIAN lo recalcula.</li>
          {jur && <li><b style={{ color: C.text }}>Empresas grandes:</b> subir el costo de los activos sube el patrimonio; revisa el impuesto temporal al patrimonio de empresas (Decreto 0173 de 2026).</li>}
          <li><b style={{ color: C.text }}>Soportes:</b> guarda escrituras, predial, facturas y el cálculo de cada paso mientras la declaración pueda ser revisada (en general 3 años; más si hay pérdidas).</li>
        </ul>
      </div>
      <div style={{ ...card, marginBottom: 12, borderColor: Cα.warn25 }}>
        <div style={{ ...F.label, marginBottom: 6, color: C.warn }}>Aviso legal</div>
        <div style={F.body}>{AVISO_LEGAL_GO}</div>
      </div>
      <div style={F.caption}>
        Normas verificadas el {NORMA_GO_VERIFICADA.split("-").reverse().join("/")}: Arts. 49, 69, 70, 72, 73, 90, 300, 311-1, 313, 314 y 869 del Estatuto Tributario; reajustes del Art. 70 por decreto de cada año (2025: Decreto 449 de 2026). Es una estimación para planear: confírmala con tu contador antes de firmar.
      </div>
    </div>
  );
}
