// ═════════════════════════════════════════════════════════════════════════
// planEstado — estado de plan que se MUESTRA (menú, Planes, Mi cuenta, Config)
// Ejecutar: node tests/planEstado.test.mjs
// ═════════════════════════════════════════════════════════════════════════
import { estadoPlan, nuevoFinPrueba, finPruebaEfectiva, diasRestantes, diasDePrueba } from "../src/lib/planEstado.js";

const DIA = 86400000;
const assert = (cond, msg) => { if (!cond) throw new Error("FAIL: " + msg); console.log("  ✓", msg); };
const ahora = Date.parse("2026-09-26T19:30:00Z");

console.log("Cuenta nueva (cuentaNueva): plan free + trialEnd ISO exacto");
{
  const trialEnd = nuevoFinPrueba("nuevo@x.com", ahora);
  assert(Date.parse(trialEnd) - ahora === 14 * DIA, "trialEnd = ahora + 14 días exactos");
  const e = estadoPlan({ planGuardado: "free", trialEnd, ahora });
  assert(e.clave === "pro" && e.enPrueba && !e.pago, "gana la prueba sobre 'free'");
  assert(e.diasPrueba === 14, "quedan 14 días (no 13)");
  assert(e.etiqueta === "Pro · prueba — quedan 14 días", "etiqueta: " + e.etiqueta);
}

console.log("Fila del trigger handle_new_user (plan free, SIN trialEnd)");
{
  const creadoEn = new Date(ahora - 2 * 3600 * 1000).toISOString();
  const e = estadoPlan({ planGuardado: "free", creadoEn, email: "nuevo@x.com", ahora });
  assert(e.clave === "pro" && e.enPrueba, "se deriva la prueba de created_at");
  assert(e.diasPrueba === 14, "quedan 14 días");
  const vieja = estadoPlan({ planGuardado: "free", creadoEn: "2026-01-01T00:00:00Z", ahora });
  assert(vieja.clave === "free" && vieja.etiqueta === "Gratis", "cuenta vieja sin trialEnd → Gratis (sin prueba retroactiva)");
}

console.log("Formato viejo YYYY-MM-DD");
{
  const e = estadoPlan({ planGuardado: "free", trialEnd: "2026-10-01", ahora });
  assert(e.enPrueba && e.diasPrueba === 5, "vale hasta 00:00 UTC del día (5 días)");
  const v = estadoPlan({ planGuardado: "free", trialEnd: "2026-09-01", ahora });
  assert(v.clave === "free" && !v.enPrueba, "vencida → Gratis");
}

console.log("Planes pagos");
{
  const trialEnd = nuevoFinPrueba("a@b.co", ahora);
  assert(estadoPlan({ planGuardado: "basico", trialEnd, ahora }).clave === "pro", "básico en prueba → Pro · prueba (igual que el gating)");
  assert(estadoPlan({ planGuardado: "basico", trialEnd: "2026-01-01", ahora }).etiqueta === "Básico", "básico sin prueba → Básico");
  const pro = estadoPlan({ planGuardado: "pro", trialEnd, ahora });
  assert(pro.clave === "pro" && pro.pago && !pro.enPrueba, "Pro pagado → Pro");
  assert(estadoPlan({ planAccount: "pro_familiar", planGuardado: "free", ahora }).clave === "pro_familiar", "Pro Familiar desde accounts");
  assert(estadoPlan({ isAdmin: true, planGuardado: "free", ahora }).etiqueta === "Pro", "admin → Pro");
}

console.log("Helpers");
{
  assert(diasDePrueba("andres.isaza@grupogiesas.com") === 30, "invitado → 30 días");
  assert(diasRestantes(ahora + 1000, ahora) === 1, "último día → queda 1");
  assert(diasRestantes(ahora - 1, ahora) === 0, "vencida → 0");
  assert(finPruebaEfectiva({ trialEnd: "basura" }) === null, "trialEnd inválido y sin created_at → null");
}
console.log("OK planEstado");

console.log("Datos cifrados sin desbloquear (bloqueado)");
{
  const vieja = "2025-01-01T00:00:00Z";
  const b = estadoPlan({ bloqueado: true, planGuardado: null, creadoEn: vieja, ahora });
  assert(b.clave === "bloqueado" && b.bloqueado, "sin evidencia → 'bloqueado'");
  assert(b.clave !== "free" && !/Gratis/.test(b.etiqueta), "nunca 'free' ni 'Gratis': " + b.etiqueta);
  const pagado = estadoPlan({ bloqueado: true, planGuardado: "pro", creadoEn: vieja, ahora });
  assert(pagado.clave === "pro" && pagado.pago && pagado.etiqueta === "Pro", "columna plan=pro → Pro");
  const basico = estadoPlan({ bloqueado: true, planGuardado: "basico", creadoEn: vieja, ahora });
  assert(basico.etiqueta === "Básico", "columna plan=basico → Básico");
  const fam = estadoPlan({ bloqueado: true, planAccount: "pro_familiar", creadoEn: vieja, ahora });
  assert(fam.clave === "pro_familiar", "accounts pro_familiar → Pro Familiar");
  const reciente = estadoPlan({ bloqueado: true, creadoEn: new Date(ahora - DIA).toISOString(), ahora });
  assert(reciente.enPrueba && reciente.diasPrueba === 13, "cuenta reciente → prueba derivada de created_at");
  const free = estadoPlan({ bloqueado: true, planGuardado: "free", creadoEn: vieja, ahora });
  assert(free.clave === "bloqueado", "'free' por defecto no cuenta como evidencia");
}
console.log("OK bloqueado");
