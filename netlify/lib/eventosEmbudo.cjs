// FINPATHIA · Eventos de embudo que marca el navegador con sesión verificada
// (los recibe track-activation). Cada uno se registra UNA vez por persona en
// su columna de accounts (solo si está vacía) y se emite por GA4 MP.
// Puro: sin red, para poder probarlo.
const EVENTOS = {
  // Primer ingreso + primer egreso cargados (ya hay nivel de libertad).
  activation: "activated_at",
  // Primera vez que abre el simulador (página "sim" o "simf").
  simulator_used: "simulator_first_used_at",
};

/** body.event → { evento, columna } o null si no es un evento permitido. Sin event = activation. */
function resolverEvento(body) {
  const ev = body && body.event != null ? String(body.event) : "activation";
  return Object.prototype.hasOwnProperty.call(EVENTOS, ev) ? { evento: ev, columna: EVENTOS[ev] } : null;
}

module.exports = { EVENTOS, resolverEvento };
