// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · COPY de la secuencia de prueba Pro (14 días)
//
// ESTE ES EL ÚNICO ARCHIVO QUE LA AGENCIA TIENE QUE EDITAR.
// Fuente: Agencia · Creativos, v2 «centrada en nivel y simulador»
// (copy_secuencia_trial_v2.md, 11-oct-2026). Texto literal.
// v2 reemplaza a la v1 mientras el Asesor IA no pase QA: ningún correo
// invita a usar el asesor. Cuando Luis apruebe el asesor se vuelve a la v1
// (ver historial de git de este archivo).
//
// Variables que se pueden usar dentro de los textos:
//   {nombre}        nombre de la persona. Si está vacío, ", {nombre}" se
//                   borra limpio ("Te quedan 4 días de Pro").
//   {n} {m}         conteos (registros y activos), NUNCA montos. Solo en d13 valor:
//                   si uno es 0 se omite esa parte; si ambos son 0, la frase.
//   {pro_mensual} {pro_anual} {familiar_personas}
//                   salen de src/lib/plans.js (precio de Pro y cupo de Pro
//                   Familiar) para que el correo no se desfase del precio real.
//
// Prohibido en este archivo: montos del usuario, promesas de cifrado de
// extremo a extremo, asesoría tributaria, llamar a Finpathia plataforma
// para declarar.
// ═══════════════════════════════════════════════════════════════════════════

// Línea de marca: cierra TODOS los correos.
export const CIERRE_MARCA = "Transformamos la complejidad financiera en claridad para construir tranquilidad.";

// Nota al pie de TODOS los correos.
export const NOTA_ASESOR = "Las respuestas del asesor son orientación, no recomendación de inversión.";

export const TEXTO_BAJA = "Darme de baja de estos correos";

// destino: "nivel" (Dashboard), "simulador", "patrimonio" o "planes" (Planes).
export const COPY = {
  d2_sin_activar: {
    asunto: "Tu nivel está a dos datos de distancia",
    cuerpo: [
      "Para ver tu nivel de libertad financiera solo necesitas esto: 1) carga tus ingresos del mes, 2) carga tus gastos, 3) Finpathia calcula tu nivel al instante.",
    ],
    cta: "Ver mi nivel",
    destino: "nivel",
  },
  d2_activado: {
    asunto: "Ya sabes tu nivel. ¿Qué te falta para el siguiente?",
    cuerpo: [
      "Abre el simulador y mira cuánto te falta cada mes para llegar a tu siguiente nivel, y qué cambia si ajustas tus ingresos o tus gastos.",
    ],
    cta: "Abrir el simulador",
    destino: "simulador",
  },
  // d5: una sola versión (ya no se divide por advisor_used).
  d5: {
    asunto: "Mira tu plata completa en una sola vista",
    cuerpo: [
      "Además de tu nivel, en Finpathia puedes cargar tus cuentas, inversiones, propiedades y deudas para ver tu patrimonio neto en un solo lugar. Entre más completo, más claro ves tu camino al siguiente nivel.",
    ],
    cta: "Completar mi patrimonio",
    destino: "patrimonio",
  },
  // d10: una sola versión.
  d10: {
    asunto: "Te quedan 4 días de Pro, {nombre}",
    cuerpo: [
      "Aprovecha estos días para usar el simulador y ver qué te acerca a tu siguiente nivel. Si administras la plata en familia, Pro Familiar suma hasta {familiar_personas} personas.",
    ],
    cta: "Abrir el simulador",
    destino: "simulador",
  },
  // d13: mismo cuerpo para las dos variantes; "valor" abre con la frase de
  // conteos. Si uno de los conteos es 0 se quita esa parte; si ambos son 0
  // (o no se conocen), la frase entera.
  d13_urgencia: {
    asunto: "Tu prueba Pro vence mañana",
    cuerpo: [
      "Mañana termina tu prueba Pro. Si no haces nada, pasas al plan gratis y conservas tus datos, tu nivel y el simulador. Pro suma los coaches, el plan de impuestos y el Asesor IA. Pro: {pro_mensual} USD/mes o {pro_anual} USD/mes en plan anual.",
    ],
    cta: "Seguir con Pro",
    destino: "planes",
  },
  d13_valor: {
    asunto: "Esto es lo que ya organizaste en Finpathia",
    apertura: {
      ambos: "Ya tienes {n} {registros} y {m} {activos} en Finpathia.",
      soloN: "Ya tienes {n} {registros} en Finpathia.",
      soloM: "Ya tienes {m} {activos} en Finpathia.",
    },
    cuerpo: [
      "Mañana termina tu prueba Pro. Si no haces nada, pasas al plan gratis y conservas tus datos, tu nivel y el simulador. Pro suma los coaches, el plan de impuestos y el Asesor IA. Pro: {pro_mensual} USD/mes o {pro_anual} USD/mes en plan anual.",
    ],
    cta: "Seguir con Pro",
    destino: "planes",
  },
  d16: {
    asunto: "Tu información sigue aquí",
    cuerpo: [
      "Estás en el plan gratis: conservas tus datos, tu nivel y el simulador. Cuando quieras las funciones Pro, actívalas en un clic.",
    ],
    cta: "Activar Pro",
    destino: "planes",
  },
};
