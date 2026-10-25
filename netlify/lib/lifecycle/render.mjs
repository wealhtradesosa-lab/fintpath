// FINPATHIA · Arma asunto + HTML + texto de un correo de la secuencia.
// Puro (sin red): recibe la clave, las variables y la URL de baja.
import { PLAN_BASE, PRECIOS_COP, fmtCOP } from "../../../src/lib/plans.js";
import { COPY, CIERRE_MARCA, TEXTO_BAJA } from "./copy.mjs";
import { conUtm, DESTINOS, BASE_APP } from "./enlaces.mjs";

const pro = PLAN_BASE.find((p) => p.name === "Pro");
const familiar = PLAN_BASE.find((p) => p.name === "Pro Familiar");
export const PRECIOS = {
  pro_mensual: pro?.priceUSD?.mensual ?? 16,
  pro_anual: pro?.priceUSD?.anual ?? 12,
  familiar_mensual: familiar?.priceUSD?.mensual ?? 27,
  familiar_anual: familiar?.priceUSD?.anual ?? 20,
  familiar_personas: familiar?.maxMembers ?? 10,
  basico_cop: fmtCOP(PRECIOS_COP["Básico"].mensual),
  pro_cop: fmtCOP(PRECIOS_COP["Pro"].mensual),
  pro_cop_anual: fmtCOP(PRECIOS_COP["Pro"].anual),
};

export const escaparHtml = (s) => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Reemplaza {variables}. Si {nombre} está vacío, borra ", {nombre}" limpio. */
export function rellenar(texto, vars) {
  let t = String(texto);
  const nombre = String(vars.nombre || "").trim();
  if (!nombre) t = t.replace(/,\s*\{nombre\}/g, "").replace(/\{nombre\}\s*/g, "");
  return t.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : m));
}

/** Primer nombre, sin espacios raros. */
export function primerNombre(nombre) {
  return String(nombre || "").trim().split(/\s+/)[0] || "";
}

/**
 * clave: "d2_sin_activo" … "d16"
 * paso: "d2" … "d16"; utmContent: variante para utm_content
 * vars: { nombre, conteos: {n, m} | null }
 * urlBaja: URL firmada para darse de baja
 */
export function armarCorreo({ clave, paso, utmContent, vars = {}, urlBaja }) {
  const c = COPY[clave];
  if (!c) throw new Error(`copy inexistente: ${clave}`);
  const v = { ...PRECIOS, nombre: primerNombre(vars.nombre) };

  const parrafos = [];
  if (c.apertura) {
    const k = vars.conteos;
    const n = Number(k?.n) || 0, m = Number(k?.m) || 0;
    const plantilla = n > 0 && m > 0 ? c.apertura.ambos : n > 0 ? c.apertura.soloN : m > 0 ? c.apertura.soloM : null;
    if (plantilla) {
      parrafos.push(rellenar(plantilla, {
        ...v, n, m,
        registros: n === 1 ? "registro" : "registros",
        activos: m === 1 ? "activo" : "activos",
      }));
    }
  }
  for (const p of c.cuerpo) parrafos.push(rellenar(p, v));

  const asunto = rellenar(c.asunto, v);
  const utm = { paso, utmContent };
  const urlCta = conUtm(DESTINOS[c.destino] || "/", utm);
  const urlBajaUtm = urlBaja ? conUtm(urlBaja, utm) : null;
  const urlInicio = conUtm(BASE_APP + "/", utm);

  const F = "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${escaparHtml(asunto)}</title></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:${F};color:#fafafa;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#0a0a0a;padding:40px 16px;"><tr><td align="center">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:#141418;border-radius:16px;border:1px solid rgba(255,255,255,0.08);">
<tr><td style="padding:28px 40px 20px;border-bottom:1px solid rgba(255,255,255,0.06);">
<a href="${escaparHtml(urlInicio)}" style="font-size:22px;font-weight:800;color:#22c55e;text-decoration:none;">FINPATHIA</a>
</td></tr>
<tr><td style="padding:28px 40px;">
${parrafos.map((p) => `<p style="font-size:15px;color:#d4d4d8;line-height:1.7;margin:0 0 16px;">${escaparHtml(p)}</p>`).join("\n")}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;"><tr><td style="background:#22c55e;border-radius:99px;">
<a href="${escaparHtml(urlCta)}" style="display:inline-block;padding:14px 32px;color:#000;text-decoration:none;font-weight:700;font-size:15px;">${escaparHtml(c.cta)}</a>
</td></tr></table>
<p style="font-size:14px;color:#a1a1aa;line-height:1.7;margin:28px 0 0;font-style:italic;">${escaparHtml(CIERRE_MARCA)}</p>
</td></tr>
<tr><td style="padding:20px 40px;border-top:1px solid rgba(255,255,255,0.06);font-size:12px;color:#71717a;line-height:1.6;">
${urlBajaUtm ? `<div><a href="${escaparHtml(urlBajaUtm)}" style="color:#a1a1aa;text-decoration:underline;">${escaparHtml(TEXTO_BAJA)}</a></div>` : ""}
</td></tr>
</table></td></tr></table></body></html>`;

  const texto = [
    ...parrafos, "",
    `${c.cta}: ${urlCta}`, "",
    CIERRE_MARCA, "",
    urlBajaUtm ? `${TEXTO_BAJA}: ${urlBajaUtm}` : "",
  ].join("\n");

  return { asunto, html, texto, urlCta, urlBaja: urlBajaUtm };
}
