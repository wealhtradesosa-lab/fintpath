import { useMemo, useState } from "react";
import PageHeader from "./PageHeader";
import { C, Cα, F, R } from "../lib/designTokens";
import { calcularGananciaOcasional } from "../lib/gananciaOcasional.js";
import { NORMA_GO_VERIFICADA, FUENTES_GO, TABLA_ART73_AG } from "../lib/normaGananciaOcasional.js";
import { claseDeActivo } from "../lib/taxonomiaActivos.js";
import { fetchAuth } from "../lib/apiFetch";

/**
 * Optimizador de ganancia ocasional — venta de inmuebles (Colombia).
 *
 * 28-oct-2026 (Santiago): "uno llena unos campos: año de compra, valor en
 * escrituras y si está declarada… aquí en Colombia hay mucha confusión y la
 * gente no sabe qué se paga ni qué normas puede aplicar". Calculadora antes /
 * después, persona natural o empresa, con cada estrategia y su ahorro.
 * El cálculo vive en lib/gananciaOcasional.js (puro y testeado).
 */

const fm = (v) => "$" + Math.round(Number(v) || 0).toLocaleString("es-CO");
const fmMM = (v) => {
  const x = Number(v) || 0;
  if (Math.abs(x) >= 1e9) return "$" + (x / 1e6).toLocaleString("es-CO", { maximumFractionDigits: 0 }) + " MM";
  if (Math.abs(x) >= 1e6) return "$" + (x / 1e6).toLocaleString("es-CO", { maximumFractionDigits: 1 }) + " MM";
  return fm(x);
};
const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const hoy = new Date();

const card = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.lg, padding: 16 };
const inp = { width: "100%", boxSizing: "border-box", background: C.raised, border: `1px solid ${C.border}`, borderRadius: R.md, color: C.text, padding: "10px 12px", fontSize: 14, outline: "none" };

function Campo({ label, ayuda, children }) {
  return (
    <label style={{ display: "block", marginBottom: 12 }}>
      <div style={{ ...F.h3, marginBottom: 4 }}>{label}</div>
      {children}
      {ayuda && <div style={{ ...F.caption, marginTop: 4 }}>{ayuda}</div>}
    </label>
  );
}

function Plata({ value, onChange, placeholder }) {
  const txt = value ? Number(value).toLocaleString("es-CO") : "";
  return (
    <input inputMode="numeric" style={inp} placeholder={placeholder || "$0"} value={txt ? "$" + txt : ""}
      onChange={(ev) => { const d = ev.target.value.replace(/[^0-9]/g, ""); onChange(d ? Number(d) : ""); }} />
  );
}

function Opciones({ value, onChange, opciones }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {opciones.map(([v, l]) => (
        <button key={v} type="button" onClick={() => onChange(v)}
          style={{ flex: "1 1 auto", padding: "8px 10px", borderRadius: R.md, cursor: "pointer", fontSize: 13, fontWeight: 600,
            border: `1px solid ${value === v ? C.accent : C.border}`, background: value === v ? Cα.accent15 : C.raised, color: value === v ? C.text : C.muted }}>
          {l}
        </button>
      ))}
    </div>
  );
}

const ESTADO = {
  aplicada: { t: "✓ Aplicada", c: C.ok, bg: Cα.ok08 },
  posible: { t: "Puedes ganarla", c: C.warn, bg: Cα.warn08 },
  superada: { t: "Hay una mejor", c: C.subtle, bg: "transparent" },
  falta_dato: { t: "Falta un dato", c: C.accent, bg: Cα.accent08 },
  bloqueada: { t: "Bloqueada", c: C.danger, bg: Cα.danger08 },
  no_aplica: { t: "No aplica", c: C.subtle, bg: "transparent" },
  info: { t: "Bueno saber", c: C.accent, bg: Cα.accent08 },
  explorar: { t: "Para explorar", c: C.purple, bg: Cα.accent08 },
};

export default function OptimizadorGananciaOcasional({ u }) {
  const owners = u?.owners || [];
  const inmuebles = useMemo(() => (u?.inv || []).filter((i) => claseDeActivo(i.tp || i.tipo).clase === "inmueble"), [u]);
  const [f, setF] = useState({
    titular: "natural", tipo: "urbano", anoCompra: "", mesCompra: "", anoVenta: hoy.getFullYear(), mesVenta: hoy.getMonth() + 1,
    valorEscritura: "", costoDeclarado: "", enRenta: "si", avaluoAnterior: "", avaluoActual: "", mejoras: "", valorizacion: "",
    depreciacion: "", precioVenta: "", esVivienda: false, afc: "tal_vez",
  });
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }));
  const [ia, setIa] = useState({ cargando: false, texto: "", error: "" });

  const traer = (id) => {
    const i = inmuebles.find((x) => String(x.id ?? x.n ?? x.nombre) === id);
    if (!i) return;
    const ow = owners.find((o) => o.id === i.owner);
    const jur = ow?.type === "juridica";
    setF((p) => ({
      ...p, titular: jur ? "juridica" : "natural",
      precioVenta: Number(i.va) || p.precioVenta,
      valorEscritura: Number(i.vc ?? i.valor_compra) || p.valorEscritura,
      costoDeclarado: jur ? (Number(i.vc ?? i.valor_compra) || "") : "",
      esVivienda: !jur && /HABITACIONAL/.test(i.fiscalCode || ""),
    }));
  };

  const r = useMemo(() => calcularGananciaOcasional(f), [f]);
  const listo = Number(f.precioVenta) > 0 && (Number(f.valorEscritura) > 0 || Number(f.costoDeclarado) > 0) && Number(f.anoCompra) > 1900;
  const jur = f.titular === "juridica";

  const pedirIA = async () => {
    setIa({ cargando: true, texto: "", error: "" });
    const caso = [
      `Titular: ${jur ? "sociedad (persona jurídica)" : "persona natural"}. Inmueble ${f.tipo}.`,
      `Compra: ${f.mesCompra ? MESES[f.mesCompra - 1] + " " : ""}${f.anoCompra}, escritura ${fm(f.valorEscritura)}${jur && f.costoDeclarado ? `, costo fiscal declarado ${fm(f.costoDeclarado)}` : ""}.`,
      `Venta prevista: ${MESES[(f.mesVenta || 1) - 1]} ${f.anoVenta} por ${fm(f.precioVenta)}. En renta: ${f.enRenta}. Avalúo catastral año anterior: ${fm(f.avaluoAnterior)}.`,
      `Mejoras ${fm(f.mejoras)}, valorización ${fm(f.valorizacion)}${jur ? `, depreciación ${fm(f.depreciacion)}` : ""}. ${!jur ? `Es su vivienda: ${f.esVivienda ? "sí" : "no"}. AFC: ${f.afc}.` : ""}`,
      `Cálculo de FINPATHIA: sin optimizar ${fm(r.antes.total)}, optimizado ${fm(r.despues.total)} (costo usado ${fm(r.despues.costo)} vía ${r.mejor?.norma || "-"}).`,
    ].join("\n");
    const pregunta = `Eres experto en tributación colombiana (ganancia ocasional, Estatuto Tributario vigente 2026). Para este caso de venta de inmueble, diseña las estrategias LEGALES adicionales para pagar el mínimo impuesto, cada una con la norma que la sustenta, el ahorro estimado en pesos y los riesgos. Si algo es ilegal o riesgoso (abuso, simulación), dilo claro. Termina con las preguntas que debe llevarle a su contador. Responde en español, conciso y en viñetas.\n\n${caso}`;
    try {
      const res = await fetchAuth("/api/ai-chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: pregunta }], financialContext: "", jurisdiction: "CO" }),
      });
      const t = await res.text();
      let d; try { d = JSON.parse(t); } catch { d = { error: res.status >= 500 ? "La IA tardó demasiado. Intenta de nuevo." : "No pude leer la respuesta." }; }
      if (d.error) setIa({ cargando: false, texto: "", error: d.mensaje || d.error });
      else setIa({ cargando: false, texto: d.reply || "", error: "" });
    } catch (e) {
      setIa({ cargando: false, texto: "", error: "Error de conexión: " + e.message });
    }
  };

  const años = [];
  for (let a = hoy.getFullYear(); a >= 1950; a--) años.push(a);
  const estOrden = ["aplicada", "posible", "falta_dato", "bloqueada", "explorar", "info", "superada", "no_aplica"];
  const estrategias = [...r.estrategias].sort((a, b) => estOrden.indexOf(a.estado) - estOrden.indexOf(b.estado));
  const posibleExtra = r.estrategias.filter((s) => s.estado === "posible").reduce((s, x) => s + (x.ahorro || 0), 0);

  return (
    <div>
      <PageHeader label="Impuestos · venta de inmueble" title="¿Cuánto pago si vendo?" accent="vendo" compact
        subtitle="Llena lo que sabes de tu inmueble. Te mostramos lo que paga la mayoría y lo mínimo que puedes pagar aplicando bien la norma." />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16, alignItems: "start" }}>
        {/* ── Formulario ── */}
        <div style={card}>
          {inmuebles.length > 0 && (
            <Campo label="Trae uno de tus inmuebles" ayuda="Llenamos lo que ya tienes en Patrimonio. Revisa y completa.">
              <select style={inp} defaultValue="" onChange={(ev) => traer(ev.target.value)}>
                <option value="" disabled>Elegir…</option>
                {inmuebles.map((i) => { const k = String(i.id ?? i.n ?? i.nombre); return <option key={k} value={k}>{i.n || i.nombre || "Inmueble"}</option>; })}
              </select>
            </Campo>
          )}
          <Campo label="¿A nombre de quién está la escritura?">
            <Opciones value={f.titular} onChange={set("titular")} opciones={[["natural", "👤 Mío (persona)"], ["juridica", "🏢 De una empresa"]]} />
          </Campo>
          <Campo label="Tipo de inmueble">
            <Opciones value={f.tipo} onChange={set("tipo")} opciones={[["urbano", "Urbano"], ["rural_agro", "Rural agropecuario"], ["rural_otro", "Rural (otro)"]]} />
          </Campo>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Campo label="Año de compra">
              <select style={inp} value={f.anoCompra} onChange={(ev) => set("anoCompra")(Number(ev.target.value))}>
                <option value="">Año…</option>{años.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </Campo>
            <Campo label="Mes (opcional)">
              <select style={inp} value={f.mesCompra} onChange={(ev) => set("mesCompra")(Number(ev.target.value) || "")}>
                <option value="">—</option>{MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </Campo>
          </div>
          <Campo label="Valor en la escritura de compra" ayuda="El que dice la escritura, no lo que crees que pagaste.">
            <Plata value={f.valorEscritura} onChange={set("valorEscritura")} />
          </Campo>
          {jur && (
            <Campo label="Costo fiscal en la declaración de la empresa" ayuda="Lo tiene tu contador (F-110 o balance fiscal). Si no lo sabes, déjalo vacío.">
              <Plata value={f.costoDeclarado} onChange={set("costoDeclarado")} />
            </Campo>
          )}
          <Campo label={jur ? "¿Está en la declaración de renta de la empresa?" : "¿Está en tu declaración de renta?"}>
            <Opciones value={f.enRenta} onChange={set("enRenta")} opciones={[["si", "Sí"], ["no", "No"], ["nose", "No sé"]]} />
          </Campo>
          <Campo label={`Avalúo catastral ${f.anoVenta - 1}`} ayuda="Está en la factura del predial de ese año.">
            <Plata value={f.avaluoAnterior} onChange={set("avaluoAnterior")} />
          </Campo>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Campo label="Mejoras con factura"><Plata value={f.mejoras} onChange={set("mejoras")} /></Campo>
            <Campo label="Valorización pagada"><Plata value={f.valorizacion} onChange={set("valorizacion")} /></Campo>
          </div>
          {jur && (
            <Campo label="Depreciación que la empresa ya descontó" ayuda="Pregúntale al contador. Si no la depreciaron, 0.">
              <Plata value={f.depreciacion} onChange={set("depreciacion")} />
            </Campo>
          )}
          <div style={{ height: 1, background: C.border, margin: "8px 0 14px" }} />
          <Campo label="¿En cuánto la vas a vender?"><Plata value={f.precioVenta} onChange={set("precioVenta")} /></Campo>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Campo label="Año de venta">
              <select style={inp} value={f.anoVenta} onChange={(ev) => set("anoVenta")(Number(ev.target.value))}>
                {[hoy.getFullYear(), hoy.getFullYear() + 1, hoy.getFullYear() + 2].map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </Campo>
            <Campo label="Mes de venta">
              <select style={inp} value={f.mesVenta} onChange={(ev) => set("mesVenta")(Number(ev.target.value))}>
                {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </Campo>
          </div>
          {f.mesVenta >= 10 && (
            <Campo label={`Avalúo catastral ${f.anoVenta} (opcional)`} ayuda="Si es mayor, puede convenirte escriturar en enero.">
              <Plata value={f.avaluoActual} onChange={set("avaluoActual")} />
            </Campo>
          )}
          {!jur && (
            <>
              <Campo label="¿Es la casa o apartamento donde vives?">
                <Opciones value={f.esVivienda ? "si" : "no"} onChange={(v) => set("esVivienda")(v === "si")} opciones={[["si", "Sí, vivo ahí"], ["no", "No"]]} />
              </Campo>
              {f.esVivienda && (
                <Campo label="¿Vas a poner el dinero en una cuenta AFC o pagar el crédito de esta casa?" ayuda="Con esto, las primeras 5.000 UVT de la ganancia no pagan impuesto.">
                  <Opciones value={f.afc} onChange={set("afc")} opciones={[["si", "Sí, todo"], ["tal_vez", "Tal vez"], ["no", "No"]]} />
                </Campo>
              )}
            </>
          )}
        </div>

        {/* ── Resultado ── */}
        <div style={{ display: "grid", gap: 16 }}>
          {!listo ? (
            <div style={{ ...card, textAlign: "center", padding: 32 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🏠</div>
              <div style={F.h2}>Llena año de compra, valor de escritura y precio de venta</div>
              <div style={{ ...F.body, marginTop: 6 }}>Con esos tres datos ya te mostramos cuánto pagarías y cuánto puedes ahorrar.</div>
            </div>
          ) : (
            <>
              <div style={{ ...card, borderColor: r.ahorro > 0 ? Cα.ok25 : C.border }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <div style={F.label}>Sin optimizar</div>
                    <div style={{ ...F.monoXl, color: C.danger, marginTop: 4, textDecoration: r.ahorro > 0 ? "line-through" : "none", opacity: r.ahorro > 0 ? 0.7 : 1 }}>{fmMM(r.antes.total)}</div>
                    <div style={F.caption}>Costo: {fmMM(r.antes.costo)}</div>
                  </div>
                  <div>
                    <div style={F.label}>Con la norma bien aplicada</div>
                    <div style={{ ...F.monoXl, color: C.text, marginTop: 4 }}>{fmMM(r.despues.total)}</div>
                    <div style={F.caption}>Costo: {fmMM(r.despues.costo)}{r.mejor ? ` · ${r.mejor.norma}` : ""}</div>
                  </div>
                </div>
                {r.ahorro > 0 && (
                  <div style={{ marginTop: 14, padding: 12, borderRadius: R.md, background: Cα.ok08, border: `1px solid ${Cα.ok25}` }}>
                    <div style={{ ...F.h2, color: C.ok }}>Pagarías {fmMM(r.ahorro)} menos</div>
                    <div style={F.caption}>{fm(r.ahorro)} de diferencia, estimada, solo aplicando normas vigentes. Confírmala con tu contador.</div>
                  </div>
                )}
                {posibleExtra > 0 && (
                  <div style={{ marginTop: 10, padding: 12, borderRadius: R.md, background: Cα.warn08, border: `1px solid ${Cα.warn25}` }}>
                    <div style={{ ...F.h3, color: C.warn }}>Y podría bajar hasta {fmMM(posibleExtra)} más</div>
                    <div style={F.caption}>Mira abajo las estrategias marcadas «Puedes ganarla».</div>
                  </div>
                )}
                <div style={{ ...F.caption, marginTop: 12 }}>
                  {r.esGO
                    ? `Ganancia ocasional: ${fmMM(r.despues.utilidad)} de utilidad${r.despues.exento ? `, ${fmMM(r.despues.exento)} exentos` : ""}, al 15%.`
                    : `Tienes el inmueble hace menos de 2 años: la utilidad se paga como renta ${jur ? "de la empresa (35%)" : "normal (hasta 39%; mostramos el mínimo, sin tus otros ingresos)"}.`}
                  {r.despues.impRecaptura > 0 ? ` Incluye ${fmMM(r.despues.impRecaptura)} por depreciación recuperada (35%).` : ""}
                </div>
              </div>

              {r.alertas.length > 0 && (
                <div style={{ ...card, borderColor: Cα.warn25 }}>
                  <div style={{ ...F.h3, marginBottom: 8 }}>⚠️ Antes de firmar</div>
                  {r.alertas.map((a, i) => <div key={i} style={{ ...F.body, marginBottom: 6 }}>• {a}</div>)}
                </div>
              )}

              <div style={card}>
                <div style={{ ...F.h2, marginBottom: 4 }}>Tu costo fiscal: la ley te deja elegir el mayor</div>
                <div style={{ ...F.caption, marginBottom: 12 }}>Mientras más alto el costo, menor la ganancia y menor el impuesto.</div>
                {r.vias.map((v) => (
                  <div key={v.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "10px 12px", marginBottom: 6, borderRadius: R.md,
                    background: v.gana ? Cα.ok08 : C.raised, border: `1px solid ${v.gana ? Cα.ok25 : C.border}`, opacity: v.valida ? 1 : 0.55 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ ...F.h3, color: v.gana ? C.ok : C.text }}>{v.gana ? "✓ " : ""}{v.nombre}</div>
                      <div style={F.caption}>{v.norma}{v.nota ? ` · ${v.nota}` : ""}</div>
                    </div>
                    <div style={{ ...F.mono, color: v.valida ? C.text : C.subtle, whiteSpace: "nowrap" }}>{v.valida ? fmMM(v.valor) : "—"}</div>
                  </div>
                ))}
              </div>

              <div style={card}>
                <div style={{ ...F.h2, marginBottom: 12 }}>Estrategias para tu caso</div>
                {estrategias.map((s) => {
                  const e = ESTADO[s.estado] || ESTADO.info;
                  return (
                    <div key={s.id} style={{ padding: 12, marginBottom: 8, borderRadius: R.md, background: e.bg, border: `1px solid ${C.border}`, opacity: s.estado === "no_aplica" || s.estado === "superada" ? 0.7 : 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                        <div style={{ ...F.h3, flex: "1 1 200px" }}>{s.titulo}</div>
                        {s.ahorro > 0 && <div style={{ ...F.mono, color: s.estado === "aplicada" ? C.ok : C.warn }}>−{fmMM(s.ahorro)}</div>}
                      </div>
                      <div style={{ display: "flex", gap: 8, margin: "4px 0 6px", flexWrap: "wrap" }}>
                        <span style={{ ...F.label, color: e.c }}>{e.t}</span>
                        <span style={F.label}>{s.norma}</span>
                      </div>
                      <div style={F.body}>{s.detalle}</div>
                    </div>
                  );
                })}
              </div>

              <div style={card}>
                <div style={{ ...F.h2, marginBottom: 6 }}>🤖 Diseña más estrategias con la IA</div>
                <div style={{ ...F.caption, marginBottom: 10 }}>La IA revisa tu caso completo y propone otras vías legales, con la norma y el riesgo de cada una, más las preguntas para tu contador.</div>
                <button type="button" onClick={pedirIA} disabled={ia.cargando}
                  style={{ width: "100%", padding: "12px 14px", borderRadius: R.md, border: "none", cursor: ia.cargando ? "wait" : "pointer", background: C.accent, color: C.text, fontWeight: 700, fontSize: 14 }}>
                  {ia.cargando ? "Analizando tu caso…" : "Analizar mi caso"}
                </button>
                {ia.error && <div style={{ ...F.body, color: C.danger, marginTop: 10 }}>{ia.error}</div>}
                {ia.texto && <div style={{ ...F.body, color: C.text, marginTop: 12, whiteSpace: "pre-wrap" }}>{ia.texto}</div>}
              </div>
            </>
          )}

          <div style={card}>
            <div style={{ ...F.h2, marginBottom: 10 }}>Lo que la gente cree… y no funciona</div>
            {r.mitos.map((m) => (
              <div key={m.mito} style={{ marginBottom: 10 }}>
                <div style={{ ...F.h3, color: C.danger }}>✗ {m.mito}</div>
                <div style={F.body}>{m.realidad}</div>
              </div>
            ))}
          </div>

          <details style={card}>
            <summary style={{ ...F.h3, cursor: "pointer" }}>📚 Normas que usa esta calculadora · verificadas el {NORMA_GO_VERIFICADA.split("-").reverse().join("/")}</summary>
            <div style={{ marginTop: 10 }}>
              {FUENTES_GO.map((x) => (
                <div key={x.norma} style={{ ...F.body, marginBottom: 6 }}><b style={{ color: C.text }}>{x.norma}:</b> {x.que}</div>
              ))}
              <div style={{ ...F.caption, marginTop: 8 }}>
                UVT {r.anoVenta}: {fm(r.uvt)}. Tabla del Art. 73 del año gravable {TABLA_ART73_AG}; para ventas de {TABLA_ART73_AG + 1} el factor real será un poco mayor (te mostramos el resultado conservador).
                Esto es una estimación para planear: confírmala con tu contador antes de firmar.
              </div>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
