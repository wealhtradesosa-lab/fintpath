// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · COPY de la secuencia de prueba Pro (14 días)
//
// ESTE ES EL ÚNICO ARCHIVO QUE LA AGENCIA TIENE QUE EDITAR.
// Fuente: Agencia · Creativos, grupo Agencia Marketing, 11-oct-2026
// (copy_secuencia_trial.md). Texto literal, salvo lo marcado como AJUSTE.
//
// Variables que se pueden usar dentro de los textos:
//   {nombre}        nombre de la persona. Si está vacío, ", {nombre}" se
//                   borra limpio ("Te quedan 4 días de Pro").
//   {n} {m}         conteos (registros y activos), NUNCA montos. Solo en d13 valor.
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

// destino: "nivel" (Dashboard), "asesor" (Asesor IA) o "planes" (Planes).
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
      "Tu Asesor IA ya conoce tus números. Pregúntale qué cambio te acerca más al siguiente nivel.",
    ],
    cta: "Preguntarle a mi asesor",
    destino: "asesor",
  },
  d5_sin_asesor: {
    asunto: "3 preguntas para hacerle a tu asesor hoy",
    cuerpo: [
      "Tu Asesor IA responde sobre tus propios números. Prueba con una: ¿Qué gasto me está frenando para subir de nivel? ¿Qué deuda me conviene pagar primero? ¿Cuántos meses de gastos debería tener ahorrados?",
    ],
    cta: "Abrir mi asesor",
    destino: "asesor",
  },
  d5_con_asesor: {
    asunto: "Otra pregunta que vale la pena",
    cuerpo: [
      "Ya hablaste con tu asesor. Prueba ahora: ¿Cómo voy frente a mi meta de este año? Y si quieres ir más a fondo en un tema, los Coaches IA te acompañan paso a paso.",
    ],
    cta: "Seguir con mi asesor",
    destino: "asesor",
  },
  d10_sin_asesor: {
    asunto: "Te quedan 4 días de Pro, {nombre}",
    cuerpo: [
      "Ya viste tu nivel. Ahora pregúntale a tu Asesor IA qué hacer para subir al siguiente: entiende tus números y te orienta. Si administras la plata en familia, Pro Familiar suma hasta {familiar_personas} personas.",
    ],
    cta: "Preguntarle a mi asesor",
    destino: "asesor",
  },
  d10_con_asesor: {
    asunto: "Lo que pierdes el día 14",
    cuerpo: [
      "En 4 días termina tu prueba. Tus datos, tu nivel y el simulador se quedan contigo en el plan gratis. Lo que se va es tu Asesor IA, los coaches y el plan de impuestos. Pro: {pro_mensual} USD/mes o {pro_anual} USD/mes en plan anual. Pro Familiar suma hasta {familiar_personas} personas.",
    ],
    cta: "Seguir con Pro",
    destino: "planes",
  },
  // d13: mismo cuerpo para las dos variantes; "valor" abre con la frase de
  // conteos (AJUSTE: se omite si los conteos no se conocen o son cero, y
  // usa singular con 1: "1 cuenta", "1 activo").
  d13_urgencia: {
    asunto: "Tu prueba Pro vence mañana",
    cuerpo: [
      "Mañana termina tu prueba Pro. Si no haces nada, pasas al plan gratis y conservas tus datos, tu nivel y el simulador. Lo que se queda en Pro es el Asesor IA, los coaches y el plan de impuestos. Pro: {pro_mensual} USD/mes o {pro_anual} USD/mes en plan anual.",
    ],
    cta: "Seguir con mi asesor",
    destino: "asesor",
  },
  d13_valor: {
    asunto: "Esto es lo que ya organizaste en Finpathia",
    apertura: "Ya cargaste {n} {cuentas} y {m} {activos}.",
    cuerpo: [
      "Mañana termina tu prueba Pro. Si no haces nada, pasas al plan gratis y conservas tus datos, tu nivel y el simulador. Lo que se queda en Pro es el Asesor IA, los coaches y el plan de impuestos. Pro: {pro_mensual} USD/mes o {pro_anual} USD/mes en plan anual.",
    ],
    cta: "Seguir con mi asesor",
    destino: "asesor",
  },
  d16: {
    asunto: "Tu información sigue aquí",
    cuerpo: [
      "Estás en el plan gratis: conservas tus datos, tu nivel y el simulador. El Asesor IA, los coaches y el plan de impuestos son Pro. Cuando quieras volver a preguntarle a tu asesor, actívalo en un clic.",
    ],
    cta: "Activar Pro",
    destino: "planes",
  },
};
