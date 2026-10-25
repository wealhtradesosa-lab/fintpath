// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · COPY de la secuencia de prueba Pro (14 días)
//
// ESTE ES EL ÚNICO ARCHIVO QUE LA AGENCIA TIENE QUE EDITAR.
// Fuente: Agencia · Creativos, v3 «centrada en patrimonio»
// (copy_secuencia_trial_v3_patrimonio.md, 11-oct-2026). Texto literal.
// v3 reemplaza a la v2 (nivel y simulador) mientras el ángulo libertad está
// en pausa. Solo usa lo verificado por QA: patrimonio total y, por activo,
// su valor, su ganancia y la deuda vinculada. No menciona nivel, simulador,
// "te faltan", Asesor IA, coaches, impuestos, Salud financiera ni cancelar
// desde la app. La v2 y la v1 quedan en el historial de git de este archivo.
//
// d2 y d5 se dividen por accounts.activated_at = «primer activo cargado»
// (lo marca el servidor, ver netlify/functions/track-activation.cjs).
// d10 ya no se divide.
//
// Variables que se pueden usar dentro de los textos:
//   {nombre}        nombre de la persona. Si está vacío, ", {nombre}" se
//                   borra limpio ("Te quedan 4 días de Pro").
//   {n} {m}         conteos (registros y activos), NUNCA montos. Solo en d13 valor:
//                   si uno es 0 se omite esa parte; si ambos son 0, la frase.
//   {pro_mensual} {pro_anual} {familiar_mensual} {familiar_anual} {familiar_personas}
//                   salen de src/lib/plans.js (precios de Pro y Pro Familiar
//                   y cupo de Pro Familiar) para que el correo no se desfase del precio real.
//
// Prohibido en este archivo (spec final 11-oct): empujar el Asesor IA, los
// Coaches o Impuestos hasta que QA los apruebe y Luis dé el OK. También:
// montos del usuario, promesas de cifrado de
// extremo a extremo, asesoría tributaria, llamar a Finpathia plataforma
// para declarar.
// ═══════════════════════════════════════════════════════════════════════════

// Línea de marca: cierra TODOS los correos.
export const CIERRE_MARCA = "Transformamos la complejidad financiera en claridad para construir tranquilidad.";

// Ningún correo de la v3 menciona el Asesor IA (ni la v2 lo hacía).

export const TEXTO_BAJA = "Darme de baja de estos correos";

// destino: "patrimonio" (Patrimonio) o "planes" (Planes).
// "nivel" y "simulador" siguen en enlaces.mjs pero la v3 no los usa.
export const COPY = {
  // d2 y d5: se dividen por activated_at (¿ya cargó su primer activo?).
  d2_sin_activo: {
    asunto: "Tu patrimonio empieza con un activo",
    cuerpo: [
      "Carga tu primer activo, por ejemplo tu cuenta de ahorros, un CDT o tu apartamento, y Finpathia empieza a armar tu patrimonio total en un solo lugar.",
    ],
    cta: "Cargar mi primer activo",
    destino: "patrimonio",
  },
  d2_con_activo: {
    asunto: "Ya empezaste. ¿Qué más tienes?",
    cuerpo: [
      "Suma tus otras cuentas, inversiones, propiedades y deudas. Entre más completo, más claro ves cuánto vale lo que tienes y cuánta deuda tiene encima.",
    ],
    cta: "Completar mi patrimonio",
    destino: "patrimonio",
  },
  d5_sin_activo: {
    asunto: "¿Cuánto vale todo lo que tienes?",
    cuerpo: [
      "Tus cuentas, tu carro, tu CDT y tus deudas, juntos en una sola vista. Carga lo que tengas a la mano y mira tu patrimonio total.",
    ],
    cta: "Ver mi patrimonio",
    destino: "patrimonio",
  },
  d5_con_activo: {
    asunto: "Mira cuánto ha ganado cada activo",
    cuerpo: [
      "En Finpathia ves, activo por activo, cuánto vale, cuánto ha ganado y cuánta deuda tiene encima. Revisa los tuyos y completa los que falten.",
    ],
    cta: "Revisar mis activos",
    destino: "patrimonio",
  },
  d10: {
    asunto: "Te quedan 4 días de Pro, {nombre}",
    cuerpo: [
      "Aprovecha estos días para dejar tu patrimonio completo: mientras más real sea tu información, más preciso tu plan.",
    ],
    cta: "Completar mi patrimonio",
    destino: "patrimonio",
  },
  // d13: mismo cuerpo para las dos variantes. "valor" abre con la frase de
  // conteos. Si uno de los conteos es 0 se quita esa parte; si ambos son 0
  // (o no se conocen), la frase entera.
  d13_urgencia: {
    asunto: "Tu prueba Pro vence mañana",
    cuerpo: [
      "Mañana termina tu prueba Pro. Tus datos se quedan guardados y podrás verlos; para seguir agregando y editando necesitas un plan. En pesos: Básico {basico_cop} y Pro {pro_cop} al mes, o un solo pago al año con 2 meses gratis. En dólares: Pro {pro_mensual} USD/mes.",
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
      "Mañana termina tu prueba Pro. Tus datos se quedan guardados y podrás verlos; para seguir agregando y editando necesitas un plan. En pesos: Básico {basico_cop} y Pro {pro_cop} al mes, o un solo pago al año con 2 meses gratis. En dólares: Pro {pro_mensual} USD/mes.",
    ],
    cta: "Seguir con Pro",
    destino: "planes",
  },
  d16: {
    asunto: "Tu información sigue aquí",
    cuerpo: [
      "Tu cuenta está en modo consulta: todo lo que cargaste sigue guardado y lo puedes ver. Para seguir agregando y editando, elige un plan desde {basico_cop} al mes en pesos.",
    ],
    cta: "Activar Pro",
    destino: "planes",
  },
};
