// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · cron-trial-ending — DESACTIVADO (11-oct-2026)
//
// Reemplazado por la secuencia de la prueba (cron-lifecycle-trial.mjs).
// Motivos:
//   · Chocaba con los correos d10 y d13 de la secuencia (duplicados).
//   · Su plantilla "trial_ending" dice «cobramos el primer mes», que no es
//     cierto: la prueba no pide tarjeta.
//   · Leía trialEnd del blob y reescribía user_data.data completo.
// Se le quitó el schedule (ya no corre solo) y el handler no hace nada.
// La plantilla "trial_ending" de send-email.cjs queda intacta, sin uso.
// ═══════════════════════════════════════════════════════════════════════════
export default async () => {
  console.log("[cron-trial-ending] reemplazado por lifecycle (cron-lifecycle-trial): no hace nada");
};
