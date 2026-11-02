// 2-nov-2026 (Santiago: «el primer minuto engancha, pero debería llevarlo a
// llenar la plataforma»). Distingue las filas estimadas del primer minuto de
// los datos reales y arma el camino: cada sección real abre una herramienta.

// Filas que crea el primer minuto (itemsDesdeNorte). Las nuevas llevan
// `estimado: true`; las de antes del 2-nov se reconocen por el nombre.
const NOMBRES_ESTIMADOS = /\(estimado\)|^Mi ingreso mensual$|^Lo que me pagan mis activos$|^Mis gastos y cuotas del mes$|^Mis deudas$|^Lo que no puedo apagar|^El resto de mis gastos$|^Mis ahorros e inversiones$/;
export const esEstimado = (x) => !!x && (x.estimado === true || NOMBRES_ESTIMADOS.test(String(x.n || x.nombre || x.c || "")));

const reales = (lista) => (lista || []).filter((x) => x && !esEstimado(x));
const gastosPlanos = (gas) => Object.values(gas || {}).flat();

export function tieneEstimados(u) {
  if (!u) return false;
  return [...(u.inv || []), ...(u.ingresos || []), ...gastosPlanos(u.gas), ...(u.deu || [])].some(esEstimado);
}

/** Pasos para afinar el número. `hecho` solo cuenta datos reales. */
export function pasosAfinar(u) {
  const inv = reales(u?.inv).length > 0;
  const ing = reales(u?.ingresos).length > 0;
  const gas = reales(gastosPlanos(u?.gas)).length > 0;
  const tuvoDeudas = (u?.deu || []).length > 0;
  const deu = reales(u?.deu).length > 0;
  return [
    { id: "inv", hecho: inv, titulo: "Carga tus activos reales", detalle: "Cada propiedad, cuenta, fondo o inversión con su valor y lo que te renta.", abre: "Verás cuánto te rinde cada activo y cuál te hace perder plata." },
    { id: "ing", hecho: ing && gas, titulo: "Tus ingresos y gastos reales", detalle: "Lo que te entra y lo que pagas, cada cosa por su nombre.", abre: "Verás tu flujo mes a mes y en qué se te va la plata.", ir: ing ? "gas" : "ing" },
    { id: "deu", hecho: tuvoDeudas ? deu : true, opcional: !tuvoDeudas, titulo: "Tus deudas, una por una", detalle: tuvoDeudas ? "Con su saldo, su cuota y su tasa." : "Si no tienes, ya está listo.", abre: "Verás la fecha en que quedas libre de deudas y cuánto te ahorras abonando." },
  ];
}
