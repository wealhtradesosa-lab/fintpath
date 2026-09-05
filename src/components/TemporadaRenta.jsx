// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · TemporadaRenta.jsx
//
// POR QUÉ EXISTE
//   El landing mencionaba "impuestos" dos veces y "DIAN" una, escondidas en la
//   quinta tarjeta de una grilla de features. Mientras tanto la plataforma
//   tiene 17 componentes fiscales, incluido un flujo de declaración completo.
//   Se estaba vendiendo por la capa genérica (family office) y no por la única
//   que tiene urgencia, fecha límite y diferenciación real.
//
//   Entre el 12 de agosto y el 26 de octubre de 2026, cerca de siete millones
//   de colombianos deben presentar la declaración del año gravable 2025. Es el
//   único momento del año en que alguien busca activamente ayuda con esto.
//
// QUÉ HACE
//   Responde gratis y sin registro la primera pregunta que todos tienen:
//   "¿cuándo me toca?". Y ahí engancha con lo que la plataforma sí hace
//   distinto: mostrar qué palancas del ET no estás usando.
//
// SOBRE LAS FECHAS
//   Septiembre y octubre salen del calendario tributario oficial de la DIAN.
//   Para las terminaciones de agosto NO se muestra el día exacto: esa parte se
//   reconstruyó por inferencia de días hábiles y no se verificó contra la
//   fuente. Como esos plazos ya vencieron, el día puntual no cambia la acción
//   del usuario -- pero afirmar una fecha equivocada sí costaría credibilidad.
//   Se dice lo que se sabe y no más.
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from "react";
import { track } from "../lib/analytics";

// Calendario DIAN 2026 · personas naturales · año gravable 2025.
// Clave = los dos últimos dígitos de la cédula (sin dígito de verificación).
const CAL = {
  // Septiembre
  "27": "2026-09-01", "28": "2026-09-01", "29": "2026-09-02", "30": "2026-09-02",
  "31": "2026-09-03", "32": "2026-09-03", "33": "2026-09-04", "34": "2026-09-04",
  "35": "2026-09-07", "36": "2026-09-07", "37": "2026-09-08", "38": "2026-09-08",
  "39": "2026-09-09", "40": "2026-09-09", "41": "2026-09-10", "42": "2026-09-10",
  "43": "2026-09-11", "44": "2026-09-11", "45": "2026-09-14", "46": "2026-09-14",
  "47": "2026-09-15", "48": "2026-09-15", "49": "2026-09-16", "50": "2026-09-16",
  "51": "2026-09-17", "52": "2026-09-17", "53": "2026-09-18", "54": "2026-09-18",
  "55": "2026-09-21", "56": "2026-09-21", "57": "2026-09-22", "58": "2026-09-22",
  "59": "2026-09-23", "60": "2026-09-23", "61": "2026-09-24", "62": "2026-09-24",
  "63": "2026-09-25", "64": "2026-09-25", "65": "2026-09-28", "66": "2026-09-28",
  // Octubre
  "67": "2026-10-01", "68": "2026-10-01", "69": "2026-10-02", "70": "2026-10-02",
  "71": "2026-10-05", "72": "2026-10-05", "73": "2026-10-06", "74": "2026-10-06",
  "75": "2026-10-07", "76": "2026-10-07", "77": "2026-10-08", "78": "2026-10-08",
  "79": "2026-10-09", "80": "2026-10-09", "81": "2026-10-13", "82": "2026-10-13",
  "83": "2026-10-14", "84": "2026-10-14", "85": "2026-10-15", "86": "2026-10-15",
  "87": "2026-10-16", "88": "2026-10-16", "89": "2026-10-19", "90": "2026-10-19",
  "91": "2026-10-20", "92": "2026-10-20", "93": "2026-10-21", "94": "2026-10-21",
  "95": "2026-10-22", "96": "2026-10-22", "97": "2026-10-23", "98": "2026-10-23",
  "99": "2026-10-26", "00": "2026-10-26",
};

const MES = ["enero","febrero","marzo","abril","mayo","junio","julio",
             "agosto","septiembre","octubre","noviembre","diciembre"];

// Sanción mínima 2026. Aplica incluso cuando la declaración da $0 a pagar,
// que es la parte que casi nadie sabe.
const SANCION_MINIMA = 524000;

const T = { bg2:"#141418", bg3:"#1e1e24", border:"rgba(255,255,255,0.08)",
  txt:"#fafafa", txt2:"#a1a1aa", txt3:"#71717a", green:"#22c55e",
  orange:"#f97316", red:"#ef4444", blue:"#3b82f6" };

export default function TemporadaRenta({ onEmpezar }) {
  const [digitos, setDigitos] = useState("");

  // 01-sep-2026 — Esta sección se le estaba mostrando a TODO visitante, incluido
  // uno de Estados Unidos: el landing se renderiza antes del login, así que no
  // existe todavía la jurisdicción de la cuenta. Alguien en Miami entraba y lo
  // primero que veía era el calendario de la DIAN.
  //
  // El idioma del navegador es el único dato disponible antes de que la persona
  // se registre. No es perfecto -- un colombiano con el navegador en inglés no
  // va a ver esto -- pero el error en esa dirección solo esconde una sección,
  // mientras que el error contrario le habla a alguien de un país que no es el
  // suyo. Entre las dos equivocaciones posibles, se elige la barata.
  const idioma = typeof navigator !== "undefined"
    ? (navigator.language || "es").toLowerCase() : "es";
  if (idioma.startsWith("en")) return null;

  // 04-sep-2026 — La sección se publicó sin ninguna medición, así que no había
  // forma de saber si alguien la usaba. Sin esto no se puede responder la
  // pregunta que importa: ¿la gente que consulta su fecha termina registrándose?
  const [yaMedido, setYaMedido] = useState(false);

  const limpio = digitos.replace(/\D/g, "").slice(0, 2);
  const completo = limpio.length === 2;
  const fechaISO = completo ? CAL[limpio] : null;
  // Terminaciones 01–26: vencieron en agosto. No se muestra el día porque esa
  // parte del calendario no está verificada contra la fuente oficial.
  const vencioEnAgosto = completo && !fechaISO;

  let dias = null, texto = null;
  if (fechaISO) {
    const f = new Date(fechaISO + "T23:59:59-05:00");
    dias = Math.ceil((f - new Date()) / 86400000);
    texto = `${f.getDate()} de ${MES[f.getMonth()]} de ${f.getFullYear()}`;
  }

  // Se mide UNA vez por sesión, cuando completa los dos dígitos. Si se midiera
  // en cada tecla, un solo usuario generaría decenas de eventos y el número
  // dejaría de significar personas.
  if (completo && !yaMedido) {
    setYaMedido(true);
    try {
      track("renta_fecha_consultada", {
        vencido: vencioEnAgosto || (dias != null && dias < 0),
        dias_restantes: dias == null ? null : Math.max(dias, -1),
      });
    } catch (e) { /* nunca romper la pantalla por un evento de analítica */ }
  }

  const color = vencioEnAgosto ? T.red
    : dias == null ? T.txt
    : dias < 0 ? T.red : dias <= 15 ? T.orange : T.green;

  return (
    <div style={{ background: T.bg2, border: `1px solid ${T.border}`,
      borderRadius: 18, padding: "28px 24px", maxWidth: 620, margin: "0 auto" }}>

      {/* NOTA PARA SANTIAGO: los textos de abajo son funcionales, escritos
          para que la herramienta se entienda. La voz de la marca es tuya --
          reemplazá lo que quieras sin tocar la lógica. */}
      <div style={{ fontSize: 11, color: T.orange, fontWeight: 700,
        letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 8 }}>
        Declaración de renta 2026
      </div>

      <h3 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em",
        margin: "0 0 8px", color: T.txt, lineHeight: 1.25 }}>
        ¿Cuándo te toca declarar?
      </h3>
      <p style={{ fontSize: 14, color: T.txt2, margin: "0 0 20px", lineHeight: 1.6 }}>
        Escribí los dos últimos dígitos de tu cédula. No pedimos el número completo,
        ni tu nombre, ni tu correo: la cuenta se hace en tu navegador.
      </p>

      <input
        value={digitos}
        onChange={(e) => setDigitos(e.target.value)}
        inputMode="numeric"
        maxLength={2}
        placeholder="Ej: 47"
        style={{ width: 130, fontSize: 30, fontWeight: 800, textAlign: "center",
          padding: "12px 0", borderRadius: 12, background: T.bg3,
          border: `2px solid ${completo ? color : T.border}`, color: T.txt,
          letterSpacing: "4px", outline: "none" }}
      />

      {completo && (
        <div style={{ marginTop: 20, padding: 18, background: T.bg3,
          borderRadius: 12, borderLeft: `3px solid ${color}` }}>
          {vencioEnAgosto ? (
            <>
              <div style={{ fontSize: 17, fontWeight: 800, color: T.red, marginBottom: 6 }}>
                Tu plazo venció en agosto
              </div>
              <div style={{ fontSize: 13, color: T.txt2, lineHeight: 1.6 }}>
                Las cédulas terminadas en {limpio} vencieron en agosto de 2026.
                Si no presentaste, la sanción mínima es de{" "}
                <strong style={{ color: T.txt }}>
                  ${SANCION_MINIMA.toLocaleString("es-CO")}
                </strong>{" "}
                y corre incluso si tu declaración da cero a pagar. Sigue creciendo
                por cada mes de retraso, así que conviene presentarla ya.
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 20, fontWeight: 800, color: T.txt, marginBottom: 4 }}>
                {texto}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color, marginBottom: 8 }}>
                {dias < 0
                  ? `Venció hace ${Math.abs(dias)} ${Math.abs(dias) === 1 ? "día" : "días"}`
                  : dias === 0 ? "Es hoy"
                  : `Te quedan ${dias} ${dias === 1 ? "día" : "días"}`}
              </div>
              <div style={{ fontSize: 12.5, color: T.txt2, lineHeight: 1.6 }}>
                Esa es la fecha máxima para presentar y pagar. La sanción mínima
                por presentar tarde es de ${SANCION_MINIMA.toLocaleString("es-CO")},
                y aplica incluso si tu declaración da cero a pagar.
              </div>
            </>
          )}

          <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 13, color: T.txt2, lineHeight: 1.6, marginBottom: 12 }}>
              Saber la fecha es lo fácil. La pregunta que cuesta plata es otra:{" "}
              <strong style={{ color: T.txt }}>
                ¿estás usando las deducciones a las que tenés derecho?
              </strong>{" "}
              FINPATHIA calcula tu declaración con las palancas del Estatuto
              Tributario y te muestra cuáles estás dejando sobre la mesa.
            </div>
            <button
              onClick={() => {
                // 05-sep-2026 — Persistimos intención (sin dígitos de cédula) para
                // atribuir signup_completed a este embudo, y pasamos source al
                // padre para que abra el modal en modo signup (como /pioneros).
                try {
                  track("renta_cta_click", { dias_restantes: dias });
                  sessionStorage.setItem("fp3_signup_intent", JSON.stringify({
                    source: "renta",
                    intent: "declaracion",
                    dias_restantes: dias == null ? null : dias,
                  }));
                } catch (e) { /* nunca romper la pantalla por analítica */ }
                onEmpezar && onEmpezar({ source: "renta", dias_restantes: dias });
              }}
              style={{ background: T.green, color: "#000", border: "none",
                padding: "13px 26px", borderRadius: 100, cursor: "pointer",
                fontWeight: 800, fontSize: 14 }}>
              Calcular mi declaración gratis
            </button>
          </div>
        </div>
      )}

      {/* 04-sep-2026 — Aviso reforzado. Esta sección es la única que se le
          muestra a gente SIN cuenta, y entrega dos cosas de peso legal: una
          fecha de vencimiento y un monto de sanción. Alguien podría dejar de
          declarar confiando en lo que acá diga. El aviso tiene que ser
          explícito sobre quién responde por la decisión. */}
      <div style={{ fontSize: 10.5, color: T.txt3, marginTop: 16, lineHeight: 1.6 }}>
        <strong style={{ color: T.txt2 }}>Aviso.</strong> Fechas tomadas del calendario
        tributario de la DIAN para personas naturales, año gravable 2025. Esta herramienta
        es informativa y no constituye asesoría tributaria, contable ni legal. No verifica
        tu situación particular: no sabe si estás obligado a declarar, ni bajo qué régimen,
        ni qué otros plazos te aplican. Confirmá siempre tu fecha y tu obligación en{" "}
        <a href="https://www.dian.gov.co" target="_blank" rel="noopener noreferrer"
           style={{ color: T.green }}>dian.gov.co</a>{" "}
        o con tu contador. La responsabilidad de presentar tu declaración a tiempo es tuya.
      </div>
    </div>
  );
}
