// ═══════════════════════════════════════════════════════════════════════════
// Ahorro en Bitcoin (Colombia) — paso a paso.
//
// 04-nov-2026, primera vuelta (Santiago: "uno arranca como perdido"; "el
// resumen al final"; "si ya hizo su pensión, compararla sin hacerla otra vez"):
// preguntas en orden y nada se calcula antes de tener monto y años.
//
// 04-nov-2026, segunda vuelta (Santiago: "se perdió mucho en las proyecciones:
// lo que pasó con el BTC en los últimos 10 años y lo que se proyecta; cuántos
// BTC faltan por minar; los escenarios fijos no me gustan, que uno pueda decir
// 25 % o 30 %; poder retirar 10 % o 20 % y ver cuánto queda heredable; un
// comparativo claro de pensión vs BTC con lo que se hereda; guardar el
// escenario").
//   1 ¿Cuánto?  2 ¿Años?  3 ¿Cuánto crees que sube? (con la historia y la
//   oferta a la vista)  4 ¿Cuánto retirarías?  5 ¿Contra qué pensión?
//   → Resultado: cuánto tendrías, qué recibes y qué heredan, proyección año a
//   año y "Guardar escenario".
// Motor en lib/ahorroBTC.js. Respuestas y escenarios en u.ahorroBTC.
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useMemo } from "react";
import { fmtNumEs, fmtPctEs } from "../lib/formato.js";
import Disclaimer from "./Disclaimer";
import NumberInput from "./NumberInput";
import PageHeader from "./PageHeader.jsx";
import HistoriaBTC from "./infografia/HistoriaBTC.jsx";
import HerenciaPensionBTC from "./infografia/HerenciaPensionBTC.jsx";
import {
  simularAhorroBTC, pensionParaComparar, INFLACION_USD, cagrHistorico, ofertaBTC, alturaEstimada,
  proyeccionPrecio, simularRetiro, comparativoHerencia, HISTORICO_BTC, PROYECCIONES_ANALISTAS, cagrHacia,
} from "../lib/ahorroBTC.js";

const T = { card: "var(--fp-card)", bg3: "var(--fp-raised)", border: "rgba(var(--fp-ink),0.08)", txt: "var(--fp-txt)", txt2: "var(--fp-txt2)", txt3: "var(--fp-txt3)", green: "#00c805", red: "#ff5000", blue: "#3b82f6", orange: "#f59e0b" };
const PRECIO_RESPALDO = 77_647; // USD, cierre del 3-nov-2026 (Yahoo); solo si no se pudo traer el de hoy

const fC = (v) => {
  const a = Math.abs(v || 0);
  if (a >= 1e9) return "$" + fmtNumEs(v / 1e6, 0) + " MM";
  if (a >= 1e6) return "$" + fmtNumEs(v / 1e6, 1) + " MM";
  return "$" + Math.round(v || 0).toLocaleString("es-CO");
};
const fU = (v) => "US$" + Math.round(v || 0).toLocaleString("en-US");

const Paso = ({ n, titulo, listo, children }) => (
  <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20, marginBottom: 12 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
      <span style={{ width: 24, height: 24, borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, background: listo ? T.green : T.bg3, color: listo ? "#fff" : T.txt2, flexShrink: 0 }}>{listo ? "✓" : n}</span>
      <span style={{ fontSize: 16, fontWeight: 700, color: T.txt }}>{titulo}</span>
    </div>
    {children}
  </div>
);
const Chip = ({ activo, onClick, children, sub }) => (
  <button type="button" onClick={onClick} style={{ flex: "1 1 120px", textAlign: "left", background: activo ? "rgba(245,158,11,0.12)" : T.bg3, border: `1px solid ${activo ? T.orange : T.border}`, borderRadius: 10, padding: "10px 12px", cursor: "pointer", color: T.txt }}>
    <div style={{ fontSize: 14, fontWeight: 700 }}>{children}</div>
    {sub && <div style={{ fontSize: 12, color: T.txt3, marginTop: 2 }}>{sub}</div>}
  </button>
);
const inputSt = { width: "100%", maxWidth: 320, background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 12px", color: T.txt, fontSize: 16 };
const Pct = ({ value, onChange, placeholder }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
    <NumberInput value={value} onChange={(v) => onChange(v === "" ? "" : Number(v))} placeholder={placeholder} style={{ ...inputSt, maxWidth: 140 }} />
    <span style={{ fontSize: 14, color: T.txt2 }}>% al año</span>
  </div>
);

export default function PensionBTC({ trm: pTrm, guardado, onGuardar, pensiones = {}, owners = [], irAPensiones }) {
  // Compatibilidad: antes u.ahorroBTC eran las respuestas sueltas; ahora { borrador, escenarios }.
  const g0 = guardado || {};
  const g = g0.borrador || (g0.escenarios ? {} : g0);
  const escenariosGuardados = Array.isArray(g0.escenarios) ? g0.escenarios : [];

  const guardadas = Object.entries(pensiones || {})
    .filter(([, v]) => v?.resultado?.neta > 0)
    .map(([id, v]) => ({ id, nombre: (owners || []).find((o) => o.id === id)?.name || v.nombre || "Tú", neta: v.resultado.neta, edadPension: v.resultado.edadPension }));

  const [frecuencia, setFrecuencia] = useState(g.frecuencia || "mensual");
  const [monto, setMonto] = useState(g.monto || "");
  const [años, setAños] = useState(g.años || "");
  const [cagr, setCagr] = useState(g.cagr ?? "");
  const [retiroPct, setRetiroPct] = useState(g.retiroPct ?? 4);
  // 4-nov-2026 (Santiago: "que uno pueda calcular hasta qué edad va a vivir:
  // 80, 90, 100 años"). Los años de retiro salen de la edad de hoy, los años de
  // ahorro y la edad hasta la que se calcula. La edad se toma de Pensiones si
  // está guardada.
  const edadGuardada = Math.floor(Object.values(pensiones || {}).find((v) => v?.datos?.edad)?.datos?.edad || 0) || "";
  const [edadHoy, setEdadHoy] = useState(g.edadHoy || edadGuardada);
  const [hastaEdad, setHastaEdad] = useState(g.hastaEdad || 90);
  const [pensionFuente, setPensionFuente] = useState(g.pensionFuente || (guardadas[0] ? "calc:" + guardadas[0].id : ""));
  const [pensionManual, setPensionManual] = useState(g.pensionManual || "");
  const [precio, setPrecio] = useState(null);
  const [altura, setAltura] = useState(null);
  const [verProyeccion, setVerProyeccion] = useState(false);
  const [nombreEsc, setNombreEsc] = useState("");
  const trm = pTrm || 4200;

  // Precio de hoy (misma función de precios del portafolio) y altura de bloque (mempool.space).
  useEffect(() => {
    let vivo = true;
    fetch("/api/stock-price?tickers=BTC").then((r) => r.json()).then((d) => { const p = d?.prices?.BTC?.price; if (vivo && p > 0) setPrecio(p); }).catch(() => {});
    fetch("https://mempool.space/api/blocks/tip/height").then((r) => r.text()).then((t) => { const h = parseInt(t, 10); if (vivo && h > 800_000) setAltura(h); }).catch(() => {});
    return () => { vivo = false; };
  }, []);
  const precioHoy = precio || PRECIO_RESPALDO;
  const oferta = useMemo(() => ofertaBTC(altura || alturaEstimada()), [altura]);

  const edadRetiro = Number(edadHoy) > 0 ? Number(edadHoy) + (Number(años) || 0) : null;
  const añosRetiro = edadRetiro ? Math.max(1, Number(hastaEdad) - edadRetiro) : 25;
  // 4-nov-2026 (Santiago: "¿cómo ponemos valores del dinero de hoy y proyectado
  // en el tiempo con X inflación proyectada?"). Todo se calcula en pesos de hoy;
  // con la inflación que el usuario escribe se muestra también en pesos de cada año.
  const [inflacionCOP, setInflacionCOP] = useState(g.inflacionCOP ?? 4);
  const infN = Number(inflacionCOP) || 0;
  const aPesosDe = (valorHoy, añosAdelante) => valorHoy * Math.pow(1 + infN / 100, añosAdelante);
  const añoHoy = new Date().getFullYear();
  const datos = { frecuencia, monto, años, cagr, retiroPct, edadHoy, hastaEdad, pensionFuente, pensionManual, inflacionCOP };
  const guardar = (extra = {}) => onGuardar && onGuardar({ borrador: datos, escenarios: escenariosGuardados, ...extra });
  useEffect(() => {
    if (!onGuardar) return;
    if (JSON.stringify(g) === JSON.stringify({ ...g, ...datos }) && g0.borrador) return;
    const t = setTimeout(() => guardar(), 600);
    return () => clearTimeout(t);
  }, [JSON.stringify(datos)]); // eslint-disable-line react-hooks/exhaustive-deps

  const montoN = Number(monto) || 0;
  const añosN = Number(años) || 0;
  const cagrN = cagr === "" ? null : Number(cagr);
  const listo1 = montoN > 0, listo2 = añosN > 0, listo3 = cagrN != null && cagrN >= 0, listo4 = Number(retiroPct) > 0;
  const r = useMemo(() => (listo3 ? simularAhorroBTC({ frecuencia, monto: montoN, años: añosN, precioHoy, trm, cagr: cagrN, retiroPct: Number(retiroPct) || 4 }) : null),
    [frecuencia, montoN, añosN, precioHoy, trm, cagrN, retiroPct]); // eslint-disable-line react-hooks/exhaustive-deps
  const elegida = guardadas.find((p) => "calc:" + p.id === pensionFuente);
  const pension = pensionParaComparar({ fuente: elegida ? "calculada" : pensionFuente, calculada: elegida, manual: pensionManual });
  const listo5 = pensionFuente === "ninguna" || !!pension;
  const retiro = useMemo(() => (r ? simularRetiro({ capital: r.valorCOPHoy, retiroPct: Number(retiroPct) || 4, años: añosRetiro, cagr: cagrN }) : null), [r, retiroPct, añosRetiro, cagrN]);
  const comp = retiro ? comparativoHerencia({ pensionMes: pension?.mesada || 0, añosVida: añosRetiro, retiro }) : null;
  const proy = useMemo(() => (r ? proyeccionPrecio({ precioHoy, cagr: cagrN, años: añosN }) : []), [r, precioHoy, cagrN, añosN]);

  const c10 = cagrHistorico(10), c5 = cagrHistorico(5);
  const textoFrecuencia = frecuencia === "mensual" ? "cada mes" : frecuencia === "anual" ? "cada año" : "una sola vez";

  const guardarEscenario = () => {
    if (!r) return;
    const nombre = nombreEsc.trim() || `${fC(montoN)} ${textoFrecuencia} · ${añosN} años · ${fmtNumEs(cagrN, 0)} %`;
    const nuevo = { id: "b" + Date.now(), nombre, fecha: new Date().toISOString().slice(0, 10), datos,
      resultado: { valor: Math.round(r.valorCOPHoy), btc: r.btc, retiroMes: Math.round(retiro.retiroMes), heredable: Math.round(retiro.capitalFinal), invertido: r.invertido } };
    guardar({ escenarios: [nuevo, ...escenariosGuardados].slice(0, 20) });
    setNombreEsc("");
  };
  const abrir = (e) => {
    const d = e.datos || {};
    setFrecuencia(d.frecuencia || "mensual"); setMonto(d.monto || ""); setAños(d.años || ""); setCagr(d.cagr ?? "");
    setRetiroPct(d.retiroPct ?? 4); setInflacionCOP(d.inflacionCOP ?? 4); if (d.edadHoy) setEdadHoy(d.edadHoy); setHastaEdad(d.hastaEdad || 90); setPensionFuente(d.pensionFuente || ""); setPensionManual(d.pensionManual || "");
  };
  const borrar = (id) => guardar({ escenarios: escenariosGuardados.filter((e) => e.id !== id) });

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      <PageHeader label="Bitcoin" title="Ahorro en Bitcoin" subtitle="Cuánto podrías tener si ahorras en bitcoin, cuánto podrías retirar y qué quedaría para los tuyos." />

      {escenariosGuardados.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: T.txt3, marginBottom: 8 }}>Tus escenarios guardados</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {escenariosGuardados.map((e) => (
              <div key={e.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 12px", minWidth: 200, flex: "1 1 200px" }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.txt }}>{e.nombre}</div>
                <div style={{ fontSize: 12, color: T.txt3, marginTop: 2 }}>{fC(e.resultado?.valor)} · retiras {fC(e.resultado?.retiroMes)}/mes · heredan {fC(e.resultado?.heredable)}</div>
                <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                  <button type="button" onClick={() => abrir(e)} style={{ background: "none", border: 0, padding: 0, color: T.blue, cursor: "pointer", fontSize: 13 }}>Abrir</button>
                  <button type="button" onClick={() => borrar(e.id)} style={{ background: "none", border: 0, padding: 0, color: T.txt3, cursor: "pointer", fontSize: 13 }}>Borrar</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ fontSize: 14, color: T.txt2, lineHeight: 1.6, marginBottom: 16 }}>
        Responde cinco preguntas. El resultado aparece al final, en pesos de hoy.
      </div>

      <Paso n={1} titulo="¿Cuánto vas a poner?" listo={listo1}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <Chip activo={frecuencia === "mensual"} onClick={() => setFrecuencia("mensual")}>Cada mes</Chip>
          <Chip activo={frecuencia === "anual"} onClick={() => setFrecuencia("anual")}>Una vez al año</Chip>
          <Chip activo={frecuencia === "unico"} onClick={() => setFrecuencia("unico")}>Una sola vez</Chip>
        </div>
        <div style={{ fontSize: 13, color: T.txt3, marginBottom: 6 }}>Monto en pesos, {textoFrecuencia}</div>
        <NumberInput value={monto} onChange={(v) => setMonto(v === "" ? "" : v)} placeholder="Ej. 1.000.000" style={inputSt} />
      </Paso>

      {listo1 && (
        <Paso n={2} titulo={frecuencia === "unico" ? "¿Cuántos años lo dejas quieto?" : "¿Por cuántos años?"} listo={listo2}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            {[5, 10, 15, 20].map((a) => <Chip key={a} activo={añosN === a} onClick={() => setAños(a)}>{a} años</Chip>)}
          </div>
          <NumberInput value={años} onChange={(v) => setAños(v === "" ? "" : Math.min(40, Number(v)))} placeholder="Otro número de años" style={{ ...inputSt, maxWidth: 200 }} />
        </Paso>
      )}

      {listo1 && listo2 && <>
        <HistoriaBTC precioHoy={precioHoy} oferta={oferta} fuentePrecio={precio ? "precio de hoy en vivo" : "precio de referencia del 3-nov-2026"} />
        <Paso n={3} titulo="¿Cuánto crees que va a subir al año?" listo={listo3}>
          {/* 4-nov-2026 (Santiago: "uno puede elegir el promedio pasado o el futuro
              proyectado; ese también debería estar, y con qué fuente"). */}
          <div style={{ fontSize: 13, fontWeight: 600, color: T.txt2, marginBottom: 8 }}>Según lo que pasó</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            <Chip activo={cagrN === Math.round(c10)} onClick={() => setCagr(Math.round(c10))} sub={`${fmtNumEs(c10, 0)} % al año (${HISTORICO_BTC.at(-11).año}–${HISTORICO_BTC.at(-1).año})`}>Últimos 10 años</Chip>
            <Chip activo={cagrN === Math.round(c5)} onClick={() => setCagr(Math.round(c5))} sub={`${fmtNumEs(c5, 0)} % al año (${HISTORICO_BTC.at(-6).año}–${HISTORICO_BTC.at(-1).año})`}>Últimos 5 años</Chip>
            <Chip activo={cagrN === 10} onClick={() => setCagr(10)} sub="10 % al año">Prudente</Chip>
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.txt2, marginBottom: 8 }}>Según lo que proyectan los analistas (precio en 2030)</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            {PROYECCIONES_ANALISTAS.map((p) => {
              const c = cagrHacia({ precioHoy, precio: p.precio, año: p.año });
              if (c == null) return null;
              return <Chip key={p.id} activo={cagrN === Math.round(c)} onClick={() => setCagr(Math.round(c))} sub={`${fU(p.precio)} en ${p.año} → ${fmtNumEs(c, 0)} % al año`}>{p.fuente}</Chip>;
            })}
          </div>
          <div style={{ fontSize: 12, color: T.txt3, lineHeight: 1.6, marginBottom: 16 }}>
            Metas de terceros, no de FINPATHIA, calculadas desde el precio de hoy ({fU(precioHoy)}). Fuentes:{" "}
            {PROYECCIONES_ANALISTAS.filter((p, i, a) => a.findIndex((x) => x.url === p.url) === i).map((p, i) => (
              <span key={p.id}>{i ? " · " : ""}<a href={p.url} target="_blank" rel="noopener noreferrer" style={{ color: T.txt2 }}>{p.fuente.split(" · ")[0]} ({p.detalle})</a></span>
            ))}.
            {añosN > 4 && <> Ojo: apuntan a 2030; usar ese crecimiento por {añosN} años lo extiende más allá de lo que ellos proyectan.</>}
          </div>
          <div style={{ fontSize: 13, color: T.txt3, marginBottom: 6 }}>O escribe el tuyo</div>
          <Pct value={cagr} onChange={setCagr} placeholder="Ej. 25" />
          {cagrN > 40 && <div style={{ fontSize: 12, color: T.orange, marginTop: 8, lineHeight: 1.5 }}>Más de 40 % al año por muchos años da precios que el mundo difícilmente puede pagar. Úsalo como escenario extremo.</div>}
          <div style={{ fontSize: 12, color: T.txt3, marginTop: 8 }}>En dólares. El resultado se trae a pesos de hoy descontando {fmtPctEs(INFLACION_USD, 0)} de inflación del dólar.</div>
        </Paso>
      </>}

      {listo1 && listo2 && listo3 && (
        <Paso n={4} titulo="¿Cuánto retirarías al año para vivir?" listo={listo4}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            {[{ v: 4, s: "Regla del 4 %: suele cuidar el capital" }, { v: 6 }, { v: 10 }, { v: 20 }].map((o) => (
              <Chip key={o.v} activo={Number(retiroPct) === o.v} onClick={() => setRetiroPct(o.v)} sub={o.s}>{o.v} %</Chip>
            ))}
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div>
              <div style={{ fontSize: 13, color: T.txt3, marginBottom: 6 }}>Porcentaje del capital</div>
              <Pct value={retiroPct} onChange={setRetiroPct} placeholder="4" />
            </div>
            <div>
              <div style={{ fontSize: 13, color: T.txt3, marginBottom: 6 }}>¿Qué edad tienes hoy?</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <NumberInput value={edadHoy} onChange={(v) => setEdadHoy(v === "" ? "" : Math.min(100, Number(v)))} placeholder="Ej. 45" style={{ ...inputSt, maxWidth: 100 }} />
                <span style={{ fontSize: 14, color: T.txt2 }}>años</span>
              </div>
            </div>
          </div>
          <div style={{ fontSize: 13, color: T.txt3, margin: "14px 0 6px" }}>¿Hasta qué edad calculamos?</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[80, 90, 100].map((e) => <Chip key={e} activo={Number(hastaEdad) === e} onClick={() => setHastaEdad(e)}>{e} años</Chip>)}
          </div>
          {edadRetiro && (
            <div style={{ fontSize: 14, color: T.txt, marginTop: 12, lineHeight: 1.5 }}>
              Dejas de ahorrar a los <strong>{edadRetiro}</strong> y calculamos el retiro hasta los <strong>{hastaEdad}</strong>: <strong>{añosRetiro} años</strong> retirando.
              {Number(hastaEdad) <= edadRetiro && <span style={{ color: T.orange }}> Sube la edad: ya pasaste de los {hastaEdad} al terminar de ahorrar.</span>}
            </div>
          )}
          <div style={{ fontSize: 12, color: T.txt3, marginTop: 8, lineHeight: 1.5 }}>Retiras ese porcentaje del capital con que empiezas, en pesos fijos cada mes; lo demás sigue invertido. Con 4 % el capital suele durar; con 10 % o 20 % puede acabarse.</div>
        </Paso>
      )}

      {listo1 && listo2 && listo3 && listo4 && (
        <Paso n={5} titulo="¿Contra qué pensión lo comparas?" listo={listo5}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            {guardadas.map((p) => (
              <Chip key={p.id} activo={pensionFuente === "calc:" + p.id} onClick={() => setPensionFuente("calc:" + p.id)} sub={fC(p.neta) + " al mes · a los " + p.edadPension}>{guardadas.length > 1 ? "La de " + p.nombre : "La que ya calculé"}</Chip>
            ))}
            <Chip activo={pensionFuente === "manual"} onClick={() => setPensionFuente("manual")} sub="Ya estoy pensionado o la conozco">Escribirla</Chip>
            <Chip activo={pensionFuente === "ninguna"} onClick={() => setPensionFuente("ninguna")} sub="Solo quiero ver el ahorro">No comparar</Chip>
          </div>
          {pensionFuente === "manual" && <>
            <div style={{ fontSize: 13, color: T.txt3, marginBottom: 6 }}>Mesada neta al mes, en pesos de hoy</div>
            <NumberInput value={pensionManual} onChange={(v) => setPensionManual(v === "" ? "" : v)} placeholder="Ej. 8.000.000" style={inputSt} />
          </>}
          {guardadas.length === 0 && irAPensiones && (
            <div style={{ fontSize: 12, color: T.txt3, marginTop: 10 }}>
              ¿No sabes cuánto sería tu pensión? <button type="button" onClick={irAPensiones} style={{ background: "none", border: 0, padding: 0, color: T.blue, cursor: "pointer", fontSize: 12, textDecoration: "underline" }}>Calcúlala en Pensiones</button> y aquí aparece sola.
            </div>
          )}
        </Paso>
      )}

      {/* ═══ RESULTADO — al final ═══ */}
      {r && listo4 && listo5 && (
        <div style={{ marginTop: 24 }}>
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 24, marginBottom: 12 }}>
            <div style={{ fontSize: 14, color: T.txt2 }}>Pones {fC(r.invertido)} en {añosN} años y, si sube {fmtPctEs(cagrN, 0)} al año, terminas con</div>
            <div style={{ fontSize: 48, fontWeight: 700, color: T.txt, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>{fC(r.valorCOPHoy)}</div>
            <div style={{ fontSize: 14, color: T.txt2 }}>{fmtNumEs(r.btc, 4)} BTC · {fmtNumEs(r.multiplo, 1)} veces lo que pusiste · <strong style={{ color: T.txt }}>en pesos de hoy</strong></div>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 14, padding: "12px 14px", background: T.bg3, borderRadius: 10, fontSize: 14, color: T.txt2 }}>
              <span>En pesos de {añoHoy + añosN}, con inflación de</span>
              <NumberInput value={inflacionCOP} onChange={(v) => setInflacionCOP(v === "" ? "" : Math.min(30, Number(v)))} style={{ width: 64, background: "var(--fp-card)", border: `1px solid ${T.border}`, borderRadius: 8, padding: "4px 8px", color: T.txt, fontSize: 14, textAlign: "right" }} />
              <span>% al año, serían</span>
              <strong style={{ color: T.txt, fontSize: 16, fontVariantNumeric: "tabular-nums" }}>{fC(aPesosDe(r.valorCOPHoy, añosN))}</strong>
              <span style={{ fontSize: 12, color: T.txt3, flexBasis: "100%" }}>Es la misma plata: los pesos de {añoHoy + añosN} valen menos. Para comparar con lo de hoy, mira la cifra grande.</span>
            </div>
            <div style={{ fontSize: 13, color: T.txt3, marginTop: 10 }}>Si el bitcoin cae 50 % justo ese año, tendrías {fC(r.valorCOPHoy * 0.5)}. Ha pasado varias veces.</div>
            {r.irreal && <div style={{ fontSize: 12, color: T.red, marginTop: 10 }}>Ojo: con este crecimiento el bitcoin valdría más que una cuarta parte de toda la riqueza del mundo. Tómalo con pinzas.</div>}
          </div>

          <HerenciaPensionBTC comp={comp} retiro={retiro} retiroPct={Number(retiroPct)} añosRetiro={añosRetiro} edadRetiro={edadRetiro} hastaEdad={edadRetiro ? Number(hastaEdad) : null} fm={fC}
            nombrePension={elegida ? (guardadas.length > 1 ? "Pensión de " + elegida.nombre : "Tu pensión") : "Tu pensión"} />

          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 20, marginBottom: 12 }}>
            <button type="button" onClick={() => setVerProyeccion((v) => !v)} style={{ background: "none", border: 0, padding: 0, color: T.txt, cursor: "pointer", fontSize: 16, fontWeight: 600 }}>
              {verProyeccion ? "▾" : "▸"} Lo que se proyecta, año por año
            </button>
            {verProyeccion && (
              <div style={{ overflowX: "auto", marginTop: 12 }}>
                <table style={{ width: "100%", minWidth: 560, borderCollapse: "collapse", fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
                  <thead><tr>{["Año", "Precio del BTC", "Tus BTC", "Lo que vale en pesos de hoy", `En pesos de ese año (${fmtNumEs(infN, 1)} % inflación)`].map((h, i) => <th key={h} style={{ textAlign: i ? "right" : "left", padding: "6px 8px", color: T.txt3, fontWeight: 500, fontSize: 12, borderBottom: `1px solid ${T.border}` }}>{h}</th>)}</tr></thead>
                  <tbody>{proy.map((p, i) => (
                    <tr key={p.año} style={{ borderBottom: `1px solid ${T.border}` }}>
                      <td style={{ padding: "8px" }}>{p.año}</td>
                      <td style={{ padding: "8px", textAlign: "right" }}>{fU(p.precio)}</td>
                      <td style={{ padding: "8px", textAlign: "right", color: T.txt2 }}>{fmtNumEs(r.serie[i]?.btc || 0, 4)}</td>
                      <td style={{ padding: "8px", textAlign: "right", fontWeight: 600 }}>{fC(r.serie[i]?.valorCOPHoy || 0)}</td>
                      <td style={{ padding: "8px", textAlign: "right", color: T.txt2 }}>{fC(aPesosDe(r.serie[i]?.valorCOPHoy || 0, i + 1))}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </div>

          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 20, marginBottom: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <input value={nombreEsc} onChange={(e) => setNombreEsc(e.target.value)} placeholder="Nombre del escenario (opcional)" style={{ ...inputSt, maxWidth: 360, fontSize: 14 }} />
            <button type="button" onClick={guardarEscenario} disabled={!onGuardar} style={{ padding: "10px 18px", borderRadius: 999, border: 0, background: T.txt, color: "var(--fp-bg)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Guardar escenario</button>
          </div>
        </div>
      )}

      <div style={{ fontSize: 12, color: T.txt3, lineHeight: 1.6, margin: "16px 0 8px" }}>Informativo, no es asesoría financiera. Antes de invertir o dejar de cotizar, valídalo con un experto.</div>
      <Disclaimer variante="cripto" idioma="es" T={T} />
    </div>
  );
}
