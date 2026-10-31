// 31-oct-2026 — Historia del patrimonio en el servidor.
// Antes la foto mensual vivía en localStorage (fp3_snapshots): se perdía al
// cambiar de equipo y sumaba los activos en dólares como si fueran pesos.
// Ahora va dentro de los datos de la cuenta (data.historiaPatrimonio), un
// punto por mes: {k:"2026-10", d:"2026-10-31", nw, a, de}. El punto del mes en
// curso se reescribe en cada guardado, así queda el último valor del mes.

const MAX_MESES = 120;

const trmUtil = (d) => {
  const t = Number(d && d.trm);
  return Number.isFinite(t) && t > 0 ? t : null;
};

const tieneUSD = (d) =>
  (d.inv || []).some((i) => i && i.sim !== false && i.moneda === "USD") ||
  (d.deu || []).some((x) => x && x.sim !== false && x.moneda === "USD");

/** Foto del patrimonio hoy, en pesos. null si no se puede calcular bien. */
export const fotoPatrimonio = (d, trmValida) => {
  if (!d) return null;
  const trm = trmValida != null ? trmValida : trmUtil(d);
  if (tieneUSD(d) && !trm) return null; // sin TRM real, un activo en dólares falsearía el punto
  const f = (x) => (x && x.moneda === "USD" ? trm : 1);
  const a = (d.inv || []).reduce((s, i) => (i && i.sim !== false ? s + (Number(i.va) || 0) * f(i) : s), 0);
  const de = (d.deu || []).reduce((s, x) => (x && x.sim !== false ? s + (Number(x.mt) || 0) * f(x) : s), 0);
  if (a === 0 && de === 0) return null;
  return { a: Math.round(a), de: Math.round(de), nw: Math.round(a - de) };
};

const claveMes = (fecha) => fecha.getFullYear() + "-" + String(fecha.getMonth() + 1).padStart(2, "0");

/** Devuelve d con el punto de este mes puesto (o el mismo d si no cambia nada). */
export const registrarMes = (d, { trm, ahora = new Date() } = {}) => {
  const foto = fotoPatrimonio(d, trm);
  if (!foto) return d;
  const k = claveMes(ahora);
  const hist = Array.isArray(d.historiaPatrimonio) ? d.historiaPatrimonio : [];
  const prev = hist.find((p) => p.k === k);
  if (prev && prev.nw === foto.nw && prev.a === foto.a && prev.de === foto.de) return d;
  const punto = { k, d: ahora.toISOString().slice(0, 10), ...foto };
  const nueva = hist.filter((p) => p && p.k !== k).concat(punto).sort((x, y) => x.k.localeCompare(y.k));
  return { ...d, historiaPatrimonio: nueva.slice(-MAX_MESES) };
};

/** Cambio frente al punto anterior y frente a hace ~12 meses. */
export const resumenHistoria = (hist) => {
  const h = (Array.isArray(hist) ? hist : []).filter((p) => p && p.k).sort((x, y) => x.k.localeCompare(y.k));
  if (h.length < 2) return { puntos: h, mes: null, ano: null };
  const ult = h[h.length - 1];
  const ant = h[h.length - 2];
  const [y, m] = ult.k.split("-").map(Number);
  const kAno = (y - 1) + "-" + String(m).padStart(2, "0");
  const base = h.find((p) => p.k >= kAno) || h[0];
  return {
    puntos: h,
    mes: { desde: ant.k, cambio: ult.nw - ant.nw },
    ano: base.k === ult.k ? null : { desde: base.k, cambio: ult.nw - base.nw, pct: base.nw ? ((ult.nw - base.nw) / Math.abs(base.nw)) * 100 : null },
  };
};

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export const etiquetaMes = (k) => {
  const [y, m] = String(k).split("-").map(Number);
  return (MESES[m - 1] || "") + " " + String(y).slice(2);
};
