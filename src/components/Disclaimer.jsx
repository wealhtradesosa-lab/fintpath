/**
 * Disclaimer — Aviso legal para los módulos que muestran cifras.
 *
 * 03-ago-2026 (Santiago: "dónde ubicamos muy buenos y completos disclaimers,
 * esto no es una asesoría financiera ni una recomendación, simplemente es una
 * serie de ejercicios para ver escenarios").
 *
 * Contexto: FINPATHIA muestra impuestos estimados, proyecciones de pensión,
 * comparaciones contra Bitcoin y recomendaciones del asesor IA. Todo eso puede
 * leerse como consejo profesional, y no lo es: Anthropic no es asesor
 * financiero ni contador, y Santiago tampoco está registrado como tal.
 *
 * Por qué un componente y no texto suelto en cada pantalla:
 *  · un disclaimer que cambia de redacción según la pantalla se lee como
 *    descuido y pierde fuerza legal;
 *  · si mañana hay que ajustarlo —por un abogado, por una jurisdicción nueva—
 *    se cambia en un solo lugar;
 *  · obliga a declarar el TIPO de contenido, y cada tipo tiene su riesgo:
 *    una proyección a 20 años no es lo mismo que un impuesto estimado.
 *
 * `variante` cambia el énfasis, no la sustancia. La frase "no constituye
 * asesoría" está en todas.
 */

const TEXTOS = {
  es: {
    general: {
      t: "Esto es un ejercicio de escenarios, no una asesoría",
      p: "FINPATHIA es una herramienta de organización y simulación financiera. Los resultados que ves son cálculos sobre los datos que vos cargaste, bajo los supuestos que elegiste. No constituyen asesoría financiera, tributaria, contable ni legal, ni una recomendación de compra o venta de ningún activo. Antes de tomar decisiones, consultá con un profesional habilitado que conozca tu situación completa. FINPATHIA no audita ni verifica los datos que cargás: si un dato de entrada está mal, el resultado también lo estará. Cada persona es responsable de las decisiones que toma y de sus resultados; esta herramienta es un insumo para pensar, no un consejo a seguir.",
    },
    fiscal: {
      t: "Estimación, no declaración",
      p: "Este cálculo es una estimación basada en la normativa vigente y en los datos que cargaste. No reemplaza la liquidación de un contador ni constituye asesoría tributaria. La responsabilidad de tu declaración es tuya y de tu contador: verificá cada cifra con un profesional antes de presentarla ante la autoridad fiscal.",
    },
    proyeccion: {
      t: "Una proyección no es un pronóstico",
      p: "Los resultados dependen enteramente de los supuestos que elegiste — rendimientos, plazos, inflación. Rentabilidades pasadas no garantizan rentabilidades futuras. Ningún activo tiene retorno asegurado y los mercados pueden caer de forma prolongada. Este ejercicio sirve para comparar escenarios, no para predecir cuánto vas a tener.",
    },
    cripto: {
      t: "Bitcoin es un activo de altísimo riesgo",
      p: "Bitcoin ha caído más del 70% en varias ocasiones y puede volver a hacerlo. Esta comparación usa una tasa de crecimiento que vos elegiste: no es una predicción ni una recomendación de invertir. No inviertas dinero que no puedas permitirte perder, y considerá el tratamiento fiscal de las ganancias en tu jurisdicción.",
    },
    ia: {
      t: "Generado por IA — verificalo",
      p: "Este análisis lo produce un modelo de inteligencia artificial a partir de tus datos. Puede contener errores, omisiones o interpretaciones incorrectas de la normativa. No constituye asesoría profesional. Tratalo como un punto de partida para tu propia investigación o para una conversación con tu asesor, nunca como una conclusión definitiva.",
    },
  },
  en: {
    general: {
      t: "This is a scenario exercise, not advice",
      p: "FINPATHIA is a financial organization and simulation tool. The results you see are calculations based on the data you entered and the assumptions you chose. They do not constitute financial, tax, accounting or legal advice, nor a recommendation to buy or sell any asset. Consult a licensed professional who knows your full situation before making decisions. FINPATHIA does not audit or verify the data you enter: if an input is wrong, the output will be wrong too. Each person is responsible for their own decisions and their outcomes; this tool is an input for thinking, not advice to follow.",
    },
    fiscal: {
      t: "An estimate, not a filing",
      p: "This is an estimate based on current rules and the data you entered. It does not replace a preparer's work and is not tax advice. Your return is your responsibility and your accountant's: verify every figure with a professional before filing.",
    },
    proyeccion: {
      t: "A projection is not a forecast",
      p: "Results depend entirely on the assumptions you chose — returns, timeframes, inflation. Past performance does not guarantee future results. No asset has a guaranteed return and markets can decline for extended periods. This exercise is for comparing scenarios, not for predicting what you will have.",
    },
    cripto: {
      t: "Bitcoin is an extremely high-risk asset",
      p: "Bitcoin has dropped more than 70% on several occasions and can do so again. This comparison uses a growth rate you selected: it is not a prediction nor a recommendation to invest. Never invest money you can't afford to lose, and consider how gains are taxed in your jurisdiction.",
    },
    ia: {
      t: "AI-generated — verify it",
      p: "This analysis is produced by an AI model from your data. It may contain errors, omissions or incorrect readings of the rules. It is not professional advice. Treat it as a starting point for your own research or a conversation with your advisor, never as a final conclusion.",
    },
  },
};

export default function Disclaimer({ variante = "general", idioma = "es", T = {}, compacto = false }) {
  const txt = (TEXTOS[idioma] || TEXTOS.es)[variante] || TEXTOS.es.general;
  const tx3 = T.txt3 || T.tx3 || "#71717a";
  const tx2 = T.txt2 || T.tx2 || "#a1a1aa";
  const border = T.border || "rgba(255,255,255,0.06)";

  // Compacto: una línea al pie, para pantallas donde el bloque completo
  // interrumpiría la lectura. El texto largo sigue disponible al pasar el cursor.
  if (compacto) {
    return (
      <div title={txt.p} style={{ fontSize: 10.5, color: tx3, marginTop: 12,
                                  lineHeight: 1.5, fontStyle: "italic" }}>
        ⚠️ {txt.t}. {idioma === "en"
          ? "Not financial, tax or legal advice."
          : "No constituye asesoría financiera, tributaria ni legal."}
      </div>
    );
  }

  return (
    <div style={{ marginTop: 16, padding: "13px 15px", borderRadius: 10,
                  border: `1px dashed ${border}`, background: "rgba(255,255,255,0.015)" }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: tx2, marginBottom: 5 }}>
        ⚠️ {txt.t}
      </div>
      <div style={{ fontSize: 10.5, color: tx3, lineHeight: 1.65 }}>
        {txt.p}
      </div>
    </div>
  );
}
