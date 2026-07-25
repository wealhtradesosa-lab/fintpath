import { useState } from "react";

/**
 * HallazgosProactivos — Lo que ve tu family office, en tarjetas.
 *
 * 25-jul-2026, rediseño pedido por Santiago: "más corto, más desde el dato en
 * números, muy gráfico más que textos largos... y pueden ser varias cards, lo
 * bueno y lo malo".
 *
 * La versión anterior eran párrafos numerados: había que LEER para entender.
 * Ahora manda la cifra —lo primero que el ojo agarra— y el texto queda como
 * apoyo. El detalle y el respaldo viven a un clic, para que la vista principal
 * no acumule ruido.
 *
 * Silencio deliberado: sin hallazgos, no renderiza nada.
 */
export default function HallazgosProactivos({ hallazgos, T, onIr, onDescartar }) {
  const [abierta, setAbierta] = useState(null);

  const alertas = hallazgos?.alertas || [];
  const buenas = hallazgos?.buenas || [];
  if (!alertas.length && !buenas.length) return null;

  const COLOR = { oportunidad: "#22c55e", riesgo: "#eab308", bueno: "#3b82f6" };

  const Tarjeta = ({ h, compacta }) => {
    const c = COLOR[h.tono] || T.tx2;
    const abierto = abierta === h.id;
    return (
      <div
        onClick={() => setAbierta(abierto ? null : h.id)}
        style={{
          background: T.bg3,
          border: `1px solid ${abierto ? c + "55" : T.border}`,
          borderRadius: 12,
          padding: compacta ? "12px 14px" : "14px 16px",
          cursor: "pointer",
          transition: "border-color .15s ease",
          minWidth: 0,
        }}
      >
        {/* La cifra manda: es lo primero que el ojo agarra */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: compacta ? 24 : 30, fontWeight: 800, color: c, lineHeight: 1 }}>
            {h.metrica ?? "\u2022"}
          </span>
          <span style={{ fontSize: 11, color: T.tx3, fontWeight: 600 }}>{h.unidad}</span>
        </div>

        <div style={{ fontSize: 12.5, fontWeight: 700, color: T.tx, marginTop: 7, lineHeight: 1.3 }}>
          {h.titulo}
        </div>

        {abierto && (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 12, color: T.tx2, lineHeight: 1.55 }}>{h.detalle}</div>
            <div style={{ fontSize: 10.5, color: T.tx3, marginTop: 8, lineHeight: 1.5 }}>
              <strong style={{ color: T.tx2 }}>De dónde sale:</strong> {h.base}
            </div>
            <div style={{ display: "flex", gap: 14, marginTop: 10, flexWrap: "wrap" }}>
              {h.accion && (
                <button
                  onClick={(e) => { e.stopPropagation(); onIr && onIr(h.accion.pagina); }}
                  style={{ background: "transparent", border: "none", padding: 0, color: c, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                >
                  {h.accion.label} &rarr;
                </button>
              )}
              {!h.bueno && (
                <button
                  onClick={(e) => { e.stopPropagation(); onDescartar && onDescartar(h.id); }}
                  style={{ background: "transparent", border: "none", padding: 0, color: T.tx3, fontSize: 12, cursor: "pointer" }}
                >
                  Ya lo s&eacute;
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "16px 18px", marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
        <span style={{ fontSize: 16 }}>&#129302;</span>
        <div style={{ fontSize: 14.5, fontWeight: 800, color: T.tx }}>
          Tu family office analiz&oacute; tus n&uacute;meros
        </div>
      </div>
      <div style={{ fontSize: 11, color: T.tx3, marginBottom: 14 }}>
        Toc&aacute; cualquier tarjeta para ver el detalle
      </div>

      {alertas.length > 0 && (
        <>
          <div style={{ fontSize: 10, fontWeight: 700, color: T.tx3, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
            Para mirar
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10, marginBottom: buenas.length ? 16 : 0 }}>
            {alertas.map((h) => <Tarjeta key={h.id} h={h} />)}
          </div>
        </>
      )}

      {buenas.length > 0 && (
        <>
          <div style={{ fontSize: 10, fontWeight: 700, color: T.tx3, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
            Vas bien ac&aacute;
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
            {buenas.map((h) => <Tarjeta key={h.id} h={h} compacta />)}
          </div>
        </>
      )}
    </div>
  );
}
