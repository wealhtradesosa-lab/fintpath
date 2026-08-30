import { useState, useMemo } from "react";
import { OBJETIVOS, VEHICULOS, CANASTAS_EXPLICADAS, diagnosticar, proyectar } from "../lib/norte.js";
import BarraComposicion from "./BarraComposicion";
import Disclaimer from "./Disclaimer";

/**
 * TuNorte — Objetivo patrimonial y diagnóstico contra él.
 *
 * 03-ago-2026 (Santiago: "que las personas puedan trazar su objetivo a 5 o 10
 * años para que la IA, analizando los datos presentes en la plataforma, dé un
 * diagnóstico y quede guardado como un dato, como una sección... FINPATHIA nos
 * da el norte").
 *
 * El motor (src/lib/norte.js) implementa el modelo de canastas de Chhabra.
 * Esta pantalla es la interfaz: elegir objetivo, ver la brecha, guardarlo.
 *
 * Decisión de diseño: el diagnóstico se calcula LOCALMENTE, sin IA. Es
 * aritmética —comparar dos distribuciones— y gastar cuota de IA en algo
 * determinista sería caro y menos confiable. La IA tiene sentido después, para
 * explicar el CÓMO cerrar la brecha, que sí requiere criterio.
 *
 * El norte se guarda dentro de los datos del usuario (u.norte), que ya se
 * sincronizan con Supabase. Se guarda también la FOTO de la distribución al
 * definirlo: sin ese punto de partida no hay forma de medir avance después.
 */

const fm = (v) => {
  const n = Math.round(Number(v) || 0);
  if (Math.abs(n) >= 1e9) return "$" + (n / 1e9).toFixed(1) + "B";
  if (Math.abs(n) >= 1e6) return "$" + (n / 1e6).toFixed(1) + "M";
  if (Math.abs(n) >= 1e3) return "$" + (n / 1e3).toFixed(0) + "K";
  return "$" + n.toLocaleString("es-CO");
};

export default function TuNorte({ user, totales = {}, T = {}, onGuardar, onReclasificar, isEN = false }) {
  const L = isEN ? "en" : "es";
  const tx = T.txt || T.tx || "#fafafa";
  const tx2 = T.txt2 || T.tx2 || "#a1a1aa";
  const tx3 = T.txt3 || T.tx3 || "#71717a";
  const card = T.card || "#111113";
  const bg3 = T.bg3 || "#27272a";
  const border = T.border || "rgba(255,255,255,0.06)";
  const gn = T.gn || T.green || "#22c55e";

  const guardado = user?.norte || null;
  const [objetivo, setObjetivo] = useState(guardado?.objetivo || null);
  const [horizonte, setHorizonte] = useState(guardado?.horizonte || 10);
  const [editando, setEditando] = useState(!guardado);
  // 25-ago-2026 (Santiago: "uno no sabe qué activo de uno está en qué").
  // El motor ya devolvia diag.detalle con los activos de cada canasta, pero la
  // pantalla nunca lo mostraba: se veia "45% / 35% / 20%" sin forma de saber
  // de donde salia ni de verificarlo. Un porcentaje sin trazabilidad no es
  // accionable -- no se puede corregir lo que no se sabe que esta adentro.
  const [canastaAbierta, setCanastaAbierta] = useState(null);

  const diag = useMemo(() => diagnosticar({
    inversiones: user?.inv || [],
    objetivo: objetivo || "equilibrio",
    trm: user?.trm || 1,
    totales,
  }), [user, objetivo, totales]);

  const PAL_CANASTA = { proteccion: "#3b82f6", mercado: "#22c55e", aspiracion: "#f97316" };
  const NOM_CANASTA = isEN
    ? { proteccion: "Protection", mercado: "Market", aspiracion: "Aspiration" }
    : { proteccion: "Protección", mercado: "Mercado", aspiracion: "Aspiración" };

  const guardar = () => {
    if (!objetivo) return;
    // La foto inicial es lo que permite medir avance: sin punto de partida,
    // "vas mejor" no significa nada.
    onGuardar?.({
      objetivo, horizonte,
      definidoEn: new Date().toISOString(),
      fotoInicial: diag.vacio ? null : { pct: diag.pct, total: diag.total },
    });
    setEditando(false);
  };

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px", color: tx }}>
          🧭 {isEN ? "Your North" : "Tu Norte"}
        </h2>
        <p style={{ color: tx3, fontSize: 12, margin: 0 }}>
          {isEN
            ? "Where you're headed, and how far you are from it."
            : "Hacia dónde vas, y qué tan lejos estás."}
        </p>
      </div>

      {/* 03-ago-2026 (Santiago: "no entiendo estos términos protección, mercado,
          aspiración"). Los nombres vienen del marco de Chhabra y se conservan,
          pero sin explicarlos la sección entera es jerga. Va ARRIBA de todo:
          hay que entender el vocabulario antes de elegir un objetivo. */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))",
                    gap: 10, marginBottom: 20 }}>
        {["proteccion", "mercado", "aspiracion"].map((k) => {
          const e = CANASTAS_EXPLICADAS[k][L];
          return (
            <div key={k} style={{ background: card, border: `1px solid ${border}`,
                  borderRadius: 12, padding: "14px 16px", borderTop: `3px solid ${PAL_CANASTA[k]}` }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: tx, marginBottom: 3 }}>{e.nombre}</div>
              <div style={{ fontSize: 11.5, color: PAL_CANASTA[k], fontWeight: 600, marginBottom: 7 }}>
                {e.corto}
              </div>
              <div style={{ fontSize: 11, color: tx3, lineHeight: 1.6, marginBottom: 8 }}>{e.largo}</div>
              <div style={{ fontSize: 10.5, color: tx2, fontFamily: "monospace",
                            paddingTop: 7, borderTop: `1px solid ${border}` }}>
                {isEN ? "Assumed: " : "Se asume: "}{e.retorno}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Elegir objetivo ── */}
      {editando && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: tx2, marginBottom: 10 }}>
            {isEN ? "1 · What are you after?" : "1 · ¿Qué querés lograr?"}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 10, marginBottom: 18 }}>
            {Object.values(OBJETIVOS).map((o) => {
              const sel = objetivo === o.id;
              return (
                <button key={o.id} onClick={() => setObjetivo(o.id)}
                  style={{ background: sel ? "rgba(34,197,94,0.10)" : card,
                    border: `1px solid ${sel ? gn : border}`, borderRadius: 12,
                    padding: "14px 16px", cursor: "pointer", textAlign: "left", color: tx }}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
                    {o.emoji} {o[L].nombre}
                  </div>
                  <div style={{ fontSize: 11.5, color: tx3, lineHeight: 1.5, marginBottom: 8 }}>
                    {o[L].desc}
                  </div>
                  <div style={{ display: "flex", gap: 4, height: 6, borderRadius: 3, overflow: "hidden" }}>
                    {["proteccion", "mercado", "aspiracion"].map((c) => (
                      <div key={c} style={{ flex: o.mix[c], background: PAL_CANASTA[c], opacity: sel ? 1 : 0.45 }} />
                    ))}
                  </div>
                  <div style={{ fontSize: 10, color: tx3, marginTop: 5, fontFamily: "monospace" }}>
                    {o.mix.proteccion}% · {o.mix.mercado}% · {o.mix.aspiracion}%
                  </div>
                </button>
              );
            })}
          </div>

          {objetivo && (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, color: tx2, marginBottom: 10 }}>
                {isEN ? "2 · In how long?" : "2 · ¿En cuánto tiempo?"}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
                {[5, 10, 15, 20].map((h) => (
                  <button key={h} onClick={() => setHorizonte(h)}
                    style={{ flex: "1 1 80px", background: horizonte === h ? "rgba(34,197,94,0.12)" : bg3,
                      border: `1px solid ${horizonte === h ? gn : border}`, borderRadius: 10,
                      padding: "10px 12px", cursor: "pointer", color: tx, fontWeight: 700, fontSize: 13 }}>
                    {h} {isEN ? "years" : "años"}
                  </button>
                ))}
              </div>
              <button onClick={guardar}
                style={{ background: gn, color: "#000", border: "none", padding: "11px 22px",
                  borderRadius: 10, cursor: "pointer", fontWeight: 800, fontSize: 13.5 }}>
                {isEN ? "Set my north" : "Fijar mi norte"}
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Diagnóstico ── */}
      {objetivo && !diag.vacio && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 16 }}>
          <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 16, padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 10, color: tx3, fontWeight: 700, letterSpacing: "0.08em" }}>
                  {isEN ? "YOUR NORTH" : "TU NORTE"}
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: tx, marginTop: 2 }}>
                  {diag.objetivo.emoji} {diag.objetivo[L].nombre}
                </div>
                <div style={{ fontSize: 11, color: tx3, marginTop: 2 }}>
                  {isEN ? `${horizonte}-year horizon` : `Horizonte de ${horizonte} años`}
                </div>
              </div>
              {!editando && (
                <button onClick={() => setEditando(true)}
                  // 03-ago-2026 (Santiago: "el botón cambiar de norte casi no se
                  // ve, por qué no lo ponemos verde"). Estaba en gris tenue sobre
                  // fondo oscuro: parecía deshabilitado. Es la acción principal de
                  // esa tarjeta —cambiar de objetivo— así que debe verse como tal.
                  style={{ background: "rgba(34,197,94,0.12)", border: `1px solid ${gn}`, borderRadius: 8,
                    padding: "7px 14px", cursor: "pointer", color: gn, fontSize: 12, fontWeight: 700 }}>
                  {isEN ? "Change" : "Cambiar"}
                </button>
              )}
            </div>

            <div style={{ fontSize: 11, color: tx3, marginBottom: 6, fontWeight: 600 }}>
              {isEN ? "WHERE YOU ARE TODAY" : "DÓNDE ESTÁS HOY"}
            </div>
            <BarraComposicion
              datos={["proteccion", "mercado", "aspiracion"].map((c) => ({ name: NOM_CANASTA[c], value: diag.porCanasta[c] }))}
              total={diag.total}
              paleta={[PAL_CANASTA.proteccion, PAL_CANASTA.mercado, PAL_CANASTA.aspiracion]}
              T={{ ...T, tx: tx, tx2, tx3, card, border }} altura={44} />

            {/* 03-ago-2026 (Santiago: "aquí no debería mostrar el cómo estoy y
                a dónde debería ir? solo veo el actual"). Faltaba la barra del
                OBJETIVO debajo de la actual: sin las dos juntas no se ve la
                brecha, que es el punto de la sección. */}
            <div style={{ fontSize: 11, color: tx3, margin: "14px 0 6px", fontWeight: 600 }}>
              {isEN ? "WHERE YOU SHOULD BE" : "DÓNDE DEBERÍAS ESTAR"}
            </div>
            <div style={{ display: "flex", height: 44, borderRadius: 8, overflow: "hidden", gap: 2 }}>
              {["proteccion", "mercado", "aspiracion"].map((c) => (
                <div key={c} style={{ flex: diag.objetivo.mix[c], background: PAL_CANASTA[c],
                      opacity: 0.55, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#0a0a0a", fontFamily: "monospace" }}>
                    {diag.objetivo.mix[c]}%
                  </span>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 14 }}>
              {["proteccion", "mercado", "aspiracion"].map((c) => {
                const b = diag.brechas.find((x) => x.canasta === c);
                const items = (diag.detalle?.[c] || []).slice().sort((x, y) => y.valor - x.valor);
                const abierta = canastaAbierta === c;
                return (
                  <div key={c} style={{ borderBottom: `1px solid ${border}` }}>
                  <div onClick={() => setCanastaAbierta(abierta ? null : c)}
                       style={{ display: "flex", justifyContent: "space-between",
                        gap: 10, flexWrap: "wrap", padding: "9px 0", cursor: items.length ? "pointer" : "default" }}>
                    <span style={{ fontSize: 12.5, color: tx2, display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 3, background: PAL_CANASTA[c] }} />
                      {NOM_CANASTA[c]}
                      {/* 30-ago-2026: Santiago no encontraba donde hacer clic.
                          La flechita gris suelta no se leia como boton: sin
                          fondo, sin borde y sin verbo, parecia decoracion.
                          Ahora es una pastilla con el color de la canasta y
                          dice que hace. */}
                      {items.length > 0 && (
                        <span style={{ fontSize: 10.5, fontWeight: 600,
                              color: abierta ? "#fff" : PAL_CANASTA[c],
                              background: abierta ? PAL_CANASTA[c] : `${PAL_CANASTA[c]}22`,
                              border: `1px solid ${PAL_CANASTA[c]}55`,
                              padding: "3px 9px", borderRadius: 100, whiteSpace: "nowrap" }}>
                          {abierta
                            ? (isEN ? "▾ Hide" : "▾ Ocultar")
                            : (isEN ? `▸ See ${items.length} assets` : `▸ Ver mis ${items.length} activos`)}
                        </span>
                      )}
                    </span>
                    <span style={{ fontSize: 12.5, fontFamily: "monospace", color: tx }}>
                      {b.actual.toFixed(0)}%
                      <span style={{ color: tx3 }}> → {b.objetivo}%</span>
                      {/* 03-ago-2026 (Santiago: "uno no sabe si debe sumar o restar
                          esos números para saber qué le falta o qué sobra"). Un
                          "+53" suelto no dice nada: el signo puede leerse al revés.
                          Ahora va la palabra y el MONTO, que es lo accionable. */}
                      {Math.abs(b.puntos) >= 5 && (
                        <span style={{ color: b.puntos > 0 ? "#f97316" : "#3b82f6",
                                       marginLeft: 8, fontWeight: 700, fontSize: 11.5 }}>
                          {b.puntos > 0
                            ? (isEN ? `${fm(Math.abs(b.monto))} too much` : `sobran ${fm(Math.abs(b.monto))}`)
                            : (isEN ? `${fm(Math.abs(b.monto))} short`    : `faltan ${fm(Math.abs(b.monto))}`)}
                        </span>
                      )}
                    </span>
                  </div>

                  {/* El detalle: que activo concreto esta en esta canasta y
                      cuanto pesa. Sin esto el porcentaje es un dato que el
                      usuario no puede ni verificar ni corregir. */}
                  {abierta && (
                    <div style={{ padding: "4px 0 12px 16px" }}>
                      {items.length === 0 ? (
                        <div style={{ fontSize: 11.5, color: tx3, fontStyle: "italic" }}>
                          {isEN ? "No assets in this basket." : "No tenés activos en esta canasta."}
                        </div>
                      ) : items.map((it, idx) => {
                        const totalPat = diag.porCanasta.proteccion + diag.porCanasta.mercado + diag.porCanasta.aspiracion;
                        return (
                        <div key={it.id || idx} style={{ padding: "8px 0",
                              borderBottom: idx < items.length - 1 ? `1px solid ${border}` : "none" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12 }}>
                            <span style={{ color: tx2, fontWeight: 500 }}>{it.nombre}</span>
                            <span style={{ fontFamily: "monospace", color: tx3, whiteSpace: "nowrap" }}>
                              {fm(it.valor)}
                              <span style={{ marginLeft: 8, color: PAL_CANASTA[c] }}>
                                {totalPat > 0 ? ((it.valor / totalPat) * 100).toFixed(1) : "0.0"}%
                              </span>
                            </span>
                          </div>

                          {/* POR QUE quedo aca. Sin el criterio a la vista el
                              usuario no puede juzgar si la clasificacion esta
                              bien, y una mezcla mal clasificada se ve igual de
                              creible que una correcta. */}
                          <div style={{ fontSize: 10.5, color: it.inferido ? "#f97316" : tx3,
                                marginTop: 3, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <span>{it.inferido ? "⚠️ " : ""}{it.motivo}</span>
                            {it.manual && <span style={{ color: "#22c55e" }}>✓</span>}
                          </div>

                          {/* Reclasificar. El mapa de tipos es una heuristica
                              sobre una etiqueta elegida para otra cosa: un
                              "Real Estate" puede ser la casa donde vivis o un
                              lote especulativo. Solo vos sabes cual. */}
                          {onReclasificar && it.id && (
                            <div style={{ display: "flex", gap: 5, marginTop: 6, flexWrap: "wrap" }}>
                              {["proteccion", "mercado", "aspiracion"].map((dest) => (
                                <button key={dest}
                                  onClick={() => onReclasificar(it.id, dest === c ? null : dest)}
                                  disabled={dest === c}
                                  style={{
                                    fontSize: 10, padding: "3px 9px", borderRadius: 100,
                                    cursor: dest === c ? "default" : "pointer",
                                    background: dest === c ? PAL_CANASTA[dest] : "transparent",
                                    color: dest === c ? "#fff" : tx3,
                                    border: `1px solid ${dest === c ? PAL_CANASTA[dest] : border}`,
                                    fontWeight: dest === c ? 700 : 500,
                                  }}>
                                  {NOM_CANASTA[dest]}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );})}
                    </div>
                  )}
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 16, padding: 20 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: tx, marginBottom: 12 }}>
              {isEN ? "What the numbers say" : "Lo que dicen tus números"}
            </div>
            {diag.hallazgos.length === 0 ? (
              <div style={{ fontSize: 12.5, color: tx3, lineHeight: 1.6 }}>
                {isEN
                  ? "Your distribution is close to your target. Keep it up."
                  : "Tu distribución está cerca de tu objetivo. Vas bien."}
              </div>
            ) : diag.hallazgos.map((h, i) => (
              <div key={i} style={{ marginBottom: 14, paddingBottom: 14,
                    borderBottom: i < diag.hallazgos.length - 1 ? `1px solid ${border}` : "none" }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: tx, marginBottom: 3 }}>
                  {h.tono === "riesgo" ? "⚠️" : h.tono === "logro" ? "✅" : "→"} {h.titulo}
                </div>
                <div style={{ fontSize: 11.5, color: tx3, lineHeight: 1.6 }}>{h.detalle}</div>
              </div>
            ))}

            {guardado?.fotoInicial && (
              <div style={{ marginTop: 6, padding: "11px 13px", background: bg3, borderRadius: 10 }}>
                <div style={{ fontSize: 10.5, color: tx3, marginBottom: 4 }}>
                  {isEN ? "SINCE YOU SET YOUR NORTH" : "DESDE QUE FIJASTE TU NORTE"}
                </div>
                <div style={{ fontSize: 11.5, color: tx2, fontFamily: "monospace" }}>
                  {fm(guardado.fotoInicial.total)} → {fm(diag.total)}
                  {diag.total !== guardado.fotoInicial.total && (
                    <span style={{ color: diag.total > guardado.fotoInicial.total ? gn : "#ef4444", marginLeft: 8, fontWeight: 700 }}>
                      {diag.total > guardado.fotoInicial.total ? "+" : ""}
                      {(((diag.total - guardado.fotoInicial.total) / guardado.fotoInicial.total) * 100).toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {objetivo && diag.vacio && (
        <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 16, padding: 32, textAlign: "center" }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>📊</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: tx2, marginBottom: 6 }}>
            {isEN ? "No assets loaded yet" : "Todavía no cargaste activos"}
          </div>
          <div style={{ fontSize: 12.5, color: tx3 }}>
            {isEN
              ? "Add your assets to see how they compare against your goal."
              : "Cargá tu patrimonio para ver cómo se compara con tu objetivo."}
          </div>
        </div>
      )}

      {/* 03-ago-2026 (Santiago: "podrían estos escenarios de norte mostrar cómo
          afectaría el crecimiento o pérdida de patrimonio en el horizonte de
          tiempo elegido").
          SE MUESTRAN TRES ESCENARIOS, no uno: proyectar a 10 años con un solo
          número es una promesa disfrazada de cálculo. El adverso es el que
          informa una decisión; el esperado solo entusiasma. */}
      {objetivo && !diag.vacio && (() => {
        const proy = proyectar({ total: diag.total, mix: diag.objetivo.mix, anios: horizonte });
        const hoy = diag.total;
        const esc = [
          { k: "adverso",   es: "Si sale mal",   en: "If it goes badly",  col: "#ef4444", v: proy.adverso.final },
          { k: "esperado",  es: "Escenario base", en: "Base case",         col: gn,        v: proy.esperado.final },
          { k: "favorable", es: "Si sale bien",  en: "If it goes well",   col: "#3b82f6", v: proy.favorable.final },
        ];
        return (
          <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 16, padding: 20, marginTop: 16 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: tx, marginBottom: 3 }}>
              {isEN ? `Your wealth in ${horizonte} years` : `Tu patrimonio en ${horizonte} años`}
            </div>
            <div style={{ fontSize: 11.5, color: tx3, marginBottom: 16, lineHeight: 1.5 }}>
              {isEN
                ? `From ${fm(hoy)} today, with this goal's mix. Real returns, after inflation.`
                : `Desde ${fm(hoy)} hoy, con la mezcla de este objetivo. Retornos reales, ya descontada la inflación.`}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 14 }}>
              {esc.map((e) => {
                const veces = hoy > 0 ? e.v / hoy : 0;
                return (
                  <div key={e.k} style={{ background: bg3, borderRadius: 12, padding: "14px 16px",
                        borderTop: `3px solid ${e.col}` }}>
                    <div style={{ fontSize: 10.5, color: tx3, fontWeight: 600, marginBottom: 5 }}>
                      {isEN ? e.en : e.es}
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: e.col, fontFamily: "monospace" }}>
                      {fm(e.v)}
                    </div>
                    <div style={{ fontSize: 10.5, color: tx3, marginTop: 3 }}>
                      {veces >= 1 ? `${veces.toFixed(1)}× ${isEN ? "your wealth today" : "tu patrimonio de hoy"}`
                                  : `${((1 - veces) * 100).toFixed(0)}% ${isEN ? "less than today" : "menos que hoy"}`}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ padding: "11px 13px", background: "rgba(239,68,68,0.06)",
                          border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10 }}>
              <div style={{ fontSize: 11.5, color: tx2, lineHeight: 1.6 }}>
                {isEN ? (
                  <><strong style={{ color: tx }}>How this is calculated:</strong> each bucket has a reference annual return — protection 1.5%, market 7%, aspiration 12%, all after inflation. Your mix averages <strong style={{ color: tx }}>{(proy.retornoEsperado * 100).toFixed(1)}% a year</strong>.
                  The three numbers are one standard deviation apart — markets don't move in straight lines,
                  and the bad scenario is as possible as the good one.</>
                ) : (
                  <><strong style={{ color: tx }}>Cómo se calcula:</strong> cada canasta tiene un retorno anual de referencia — protección 1,5%, mercado 7%, aspiración 12%, todos ya descontada la inflación. Tu mezcla promedia <strong style={{ color: tx }}>{(proy.retornoEsperado * 100).toFixed(1)}% anual</strong>.
                  Los tres números están a una desviación estándar de distancia — los mercados no se mueven en línea recta,
                  y el escenario malo es tan posible como el bueno.</>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* 03-ago-2026 (Santiago: "si uno quiere el norte de crecer con algo de
          renta, cómo debería dividir las inversiones: X en real estate, X en
          fondos, acciones"). Las canastas son abstractas; esto las baja a
          vehículos concretos con el monto que le correspondería a cada uno.
          Son referencias de COMPOSICIÓN —qué tipo de activo cumple cada
          función— no recomendaciones de compra. */}
      {objetivo && !diag.vacio && (
        <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 16, padding: 20, marginTop: 16 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: tx, marginBottom: 3 }}>
            {isEN ? "How this goal splits your wealth" : "Cómo se reparte tu patrimonio con este norte"}
          </div>
          <div style={{ fontSize: 11.5, color: tx3, marginBottom: 14, lineHeight: 1.5 }}>
            {isEN
              ? `Reference composition for ${fm(diag.total)}. These are types of assets that serve each purpose — not specific recommendations.`
              : `Composición de referencia para ${fm(diag.total)}. Son tipos de activo que cumplen cada función, no recomendaciones concretas.`}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
            {["proteccion", "mercado", "aspiracion"].map((cn) => {
              const montoCanasta = diag.total * (diag.objetivo.mix[cn] / 100);
              const actual = diag.porCanasta[cn];
              const dif = actual - montoCanasta;
              return (
                <div key={cn} style={{ background: bg3, borderRadius: 12, padding: "14px 16px",
                      borderTop: `3px solid ${PAL_CANASTA[cn]}` }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: tx, marginBottom: 2 }}>
                    {NOM_CANASTA[cn]} · {diag.objetivo.mix[cn]}%
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: PAL_CANASTA[cn],
                                fontFamily: "monospace", marginBottom: 3 }}>
                    {fm(montoCanasta)}
                  </div>
                  <div style={{ fontSize: 10.5, color: tx3, marginBottom: 10 }}>
                    {isEN ? "you have" : "tenés"} {fm(actual)}
                    <span style={{ color: Math.abs(dif) < diag.total * 0.05 ? tx3 : (dif > 0 ? "#f97316" : "#3b82f6"),
                                   fontWeight: 700, marginLeft: 5 }}>
                      {dif > 0 ? "+" : ""}{fm(dif)}
                    </span>
                  </div>
                  {VEHICULOS[cn].map((v, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 8,
                          flexWrap: "wrap", padding: "5px 0", fontSize: 11 }}>
                      <span style={{ color: tx2, flex: "1 1 auto", minWidth: 0 }}>{v[L]}</span>
                      <span style={{ color: tx3, fontFamily: "monospace", flexShrink: 0 }}>
                        {fm(montoCanasta * (v.peso / 100))}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 03-ago-2026 (Santiago: "casi que clasificar el patrimonio según ese
          nuevo norte e informar cuáles no cumplen"). Elegir un objetivo y ver
          dos barras no era un norte: faltaba el activo por activo.
          Se muestra QUÉ canasta ocupa cada uno y si aporta al objetivo, pero
          NO se dice "vendé esto": recomendar operaciones concretas es asesoría
          de inversión. Es la diferencia entre un mapa y un chofer. */}
      {objetivo && !diag.vacio && diag.evaluados?.length > 0 && (
        <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 16, padding: 20, marginTop: 16 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: tx, marginBottom: 3 }}>
            {isEN ? "Your assets against your north" : "Tus activos frente a tu norte"}
          </div>
          <div style={{ fontSize: 11.5, color: tx3, marginBottom: 14, lineHeight: 1.5 }}>
            {isEN
              ? "Which ones move you toward your goal and which ones pull away. This is a map, not an instruction — decisions are yours and your advisor's."
              : "Cuáles te acercan a tu objetivo y cuáles no. Esto es un mapa, no una instrucción: las decisiones son tuyas y de tu asesor."}
          </div>

          {["revisar", "aporta", "alineado"].map((est) => {
            const grupo = diag.evaluados.filter((a) => a.estado === est);
            if (!grupo.length) return null;
            const cfg = {
              revisar:  { ic: "⚠️", col: "#f97316", es: "Conviene revisar", en: "Worth reviewing" },
              aporta:   { ic: "✅", col: gn,        es: "Aportan a tu norte", en: "Moving you forward" },
              alineado: { ic: "·",  col: tx3,       es: "En línea", en: "On track" },
            }[est];
            return (
              <div key={est} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10.5, fontWeight: 800, color: cfg.col,
                              letterSpacing: "0.06em", marginBottom: 8 }}>
                  {cfg.ic} {(isEN ? cfg.en : cfg.es).toUpperCase()} · {grupo.length}
                </div>
                {grupo.map((a, i) => (
                  <div key={i} style={{ padding: "10px 12px", background: bg3, borderRadius: 9,
                        marginBottom: 6, borderLeft: `3px solid ${cfg.col}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between",
                          gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: tx }}>{a.nombre}</span>
                      <span style={{ fontSize: 12.5, fontFamily: "monospace", color: cfg.col, fontWeight: 700 }}>
                        {fm(a.valor)}
                        <span style={{ color: tx3, fontWeight: 500, marginLeft: 6 }}>{a.peso.toFixed(0)}%</span>
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: tx3, marginTop: 4, lineHeight: 1.55 }}>{a.razon}</div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* 03-ago-2026 (Santiago: "poner algún crédito o texto que diga de quién
          es esta metodología, para darle peso"). Citar la fuente no es adorno:
          diferencia un marco reconocido de una regla inventada, y el usuario
          puede ir a verificarlo. */}
      <div style={{ marginTop: 18, padding: "13px 15px", borderRadius: 10,
                    background: bg3, border: `1px solid ${border}` }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: tx3, letterSpacing: "0.06em", marginBottom: 5 }}>
          {isEN ? "ABOUT THIS METHODOLOGY" : "SOBRE ESTA METODOLOGÍA"}
        </div>
        <div style={{ fontSize: 11.5, color: tx2, lineHeight: 1.65 }}>
          {isEN ? (
            <>
              The three-bucket framework comes from <strong style={{ color: tx }}>Ashvin B. Chhabra</strong>,
              former Chief Investment Officer at Merrill Lynch Wealth Management, in his
              paper <em>"Beyond Markowitz: A Comprehensive Wealth Allocation Framework for
              Individual Investors"</em> (Journal of Wealth Management, Vol. 7 No. 4, 2005),
              later expanded in <em>The Aspirational Investor</em> (2015). His central
              conclusion: <strong style={{ color: tx }}>risk allocation should precede asset
              allocation</strong>. Wealth gets organized by purpose — personal, market and
              aspirational risk — instead of optimizing one portfolio for volatility alone.
            </>
          ) : (
            <>
              El modelo de tres canastas es de <strong style={{ color: tx }}>Ashvin B. Chhabra</strong>,
              ex Director de Inversiones de Merrill Lynch Wealth Management, en su paper
              <em>"Beyond Markowitz: A Comprehensive Wealth Allocation Framework for
              Individual Investors"</em> (Journal of Wealth Management, Vol. 7 N.º 4, 2005),
              ampliado luego en el libro <em>The Aspirational Investor</em> (2015). Su
              conclusión central: <strong style={{ color: tx }}>la asignación de riesgo debe
              preceder a la de activos</strong>. El patrimonio se organiza por propósito
              —riesgo personal, de mercado y aspiracional— en vez de optimizar un solo
              portafolio por volatilidad.
            </>
          )}
        </div>
      </div>

      <Disclaimer variante="general" idioma={L} T={T} />
    </div>
  );
}
