import { useState, useMemo } from "react";
import { OBJETIVOS, diagnosticar } from "../lib/norte.js";
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

export default function TuNorte({ user, totales = {}, T = {}, onGuardar, isEN = false }) {
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
                  style={{ background: "transparent", border: `1px solid ${border}`, borderRadius: 8,
                    padding: "6px 12px", cursor: "pointer", color: tx3, fontSize: 11.5 }}>
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

            <div style={{ marginTop: 14 }}>
              {["proteccion", "mercado", "aspiracion"].map((c) => {
                const b = diag.brechas.find((x) => x.canasta === c);
                return (
                  <div key={c} style={{ display: "flex", justifyContent: "space-between",
                        gap: 10, flexWrap: "wrap", padding: "9px 0", borderBottom: `1px solid ${border}` }}>
                    <span style={{ fontSize: 12.5, color: tx2, display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 3, background: PAL_CANASTA[c] }} />
                      {NOM_CANASTA[c]}
                    </span>
                    <span style={{ fontSize: 12.5, fontFamily: "monospace", color: tx }}>
                      {b.actual.toFixed(0)}%
                      <span style={{ color: tx3 }}> → {b.objetivo}%</span>
                      {Math.abs(b.puntos) >= 5 && (
                        <span style={{ color: b.puntos > 0 ? "#f97316" : "#3b82f6", marginLeft: 8, fontWeight: 700 }}>
                          {b.puntos > 0 ? "+" : ""}{b.puntos.toFixed(0)}
                        </span>
                      )}
                    </span>
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

      <Disclaimer variante="general" idioma={L} T={T} />
    </div>
  );
}
