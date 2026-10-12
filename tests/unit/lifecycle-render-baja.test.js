// Copy, enlaces con UTM y token de baja de la secuencia de prueba.
import { describe, it, expect } from "vitest";
import { armarCorreo, rellenar, PRECIOS } from "../../netlify/lib/lifecycle/render.mjs";
import { COPY, CIERRE_MARCA, NOTA_ASESOR } from "../../netlify/lib/lifecycle/copy.mjs";
import { firmarTokenBaja, verificarTokenBaja } from "../../netlify/lib/lifecycle/tokenBaja.mjs";
import { PLAN_BASE } from "../../src/lib/plans.js";

const ID = "0f8a2c1e-1234-4abc-9def-0123456789ab";
const URL_BAJA = "https://finpathia.com/api/email-unsubscribe?t=abc";
const pasoDe = (clave) => clave.split("_")[0];
const utmDe = (clave) => (clave.startsWith("d13_") ? clave.slice(4) : clave);

describe("token de baja", () => {
  it("firma y verifica", () => {
    const t = firmarTokenBaja(ID, "secreto-1");
    expect(verificarTokenBaja(t, "secreto-1")).toBe(ID);
  });
  it("rechaza secreto distinto, token alterado o vacío", () => {
    const t = firmarTokenBaja(ID, "secreto-1");
    expect(verificarTokenBaja(t, "otro")).toBe(null);
    const otro = firmarTokenBaja("0f8a2c1e-1234-4abc-9def-0123456789ac", "secreto-1");
    expect(verificarTokenBaja(t.split(".")[0] + "." + otro.split(".")[1], "secreto-1")).toBe(null);
    expect(verificarTokenBaja("", "secreto-1")).toBe(null);
    expect(verificarTokenBaja("basura", "secreto-1")).toBe(null);
    expect(verificarTokenBaja(t, "")).toBe(null);
  });
  it("sin secreto no firma", () => {
    expect(firmarTokenBaja(ID, "")).toBe(null);
  });
});

describe("correos", () => {
  it("hay 9 correos", () => {
    expect(Object.keys(COPY).sort()).toEqual([
      "d10_con_asesor", "d10_sin_asesor", "d13_urgencia", "d13_valor", "d16",
      "d2_activado", "d2_sin_activar", "d5_con_asesor", "d5_sin_asesor",
    ]);
  });
  for (const clave of Object.keys(COPY)) {
    it(`${clave}: UTMs en todos los enlaces, cierre de marca, nota y baja`, () => {
      const c = armarCorreo({ clave, paso: pasoDe(clave), utmContent: utmDe(clave), vars: { nombre: "Ana" }, urlBaja: URL_BAJA });
      const hrefs = [...c.html.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, "&"));
      expect(hrefs.length).toBeGreaterThanOrEqual(3);
      for (const h of hrefs) {
        const u = new URL(h);
        expect(u.searchParams.get("utm_source")).toBe("email");
        expect(u.searchParams.get("utm_medium")).toBe("lifecycle");
        expect(u.searchParams.get("utm_campaign")).toBe(`fp_trial_${pasoDe(clave)}`);
        expect(u.searchParams.get("utm_content")).toBe(utmDe(clave));
      }
      expect(c.html).toContain(CIERRE_MARCA);
      expect(c.html).toContain(NOTA_ASESOR);
      expect(c.html).toContain("Darme de baja");
      expect(c.texto).toContain(CIERRE_MARCA);
      expect(c.html).not.toMatch(/extremo a extremo|E2E|declarar tu renta/i);
      expect(c.asunto).not.toMatch(/\{\w+\}/);
      expect(c.html).not.toMatch(/\{\w+\}/);
    });
  }
  it("precios salen de plans.js", () => {
    const pro = PLAN_BASE.find((p) => p.name === "Pro");
    expect(PRECIOS.pro_mensual).toBe(pro.priceUSD.mensual);
    expect(PRECIOS.pro_anual).toBe(pro.priceUSD.anual);
    const c = armarCorreo({ clave: "d10_con_asesor", paso: "d10", utmContent: "d10_con_asesor", urlBaja: URL_BAJA });
    expect(c.texto).toContain(`Pro: ${pro.priceUSD.mensual} USD/mes o ${pro.priceUSD.anual} USD/mes en plan anual.`);
    expect(c.texto).toContain("Pro Familiar suma hasta 10 personas.");
  });
  it("{nombre}: con nombre y sin nombre (se borra ', {nombre}' limpio)", () => {
    const con = armarCorreo({ clave: "d10_sin_asesor", paso: "d10", utmContent: "d10_sin_asesor", vars: { nombre: "Ana María Pérez" }, urlBaja: URL_BAJA });
    expect(con.asunto).toBe("Te quedan 4 días de Pro, Ana");
    const sin = armarCorreo({ clave: "d10_sin_asesor", paso: "d10", utmContent: "d10_sin_asesor", vars: { nombre: "  " }, urlBaja: URL_BAJA });
    expect(sin.asunto).toBe("Te quedan 4 días de Pro");
    expect(rellenar("Hola, {nombre}.", { nombre: "" })).toBe("Hola.");
  });
  it("nombre se escapa en HTML", () => {
    const c = armarCorreo({ clave: "d10_sin_asesor", paso: "d10", utmContent: "d10_sin_asesor", vars: { nombre: "<b>x" }, urlBaja: URL_BAJA });
    expect(c.html).not.toContain("<b>x");
  });
  it("d13 valor: abre con conteos solo si se conocen y no son cero", () => {
    const k = (conteos) => armarCorreo({ clave: "d13_valor", paso: "d13", utmContent: "valor", vars: { conteos }, urlBaja: URL_BAJA });
    expect(k({ n: 5, m: 2 }).texto.startsWith("Ya tienes 5 registros y 2 activos en Finpathia.")).toBe(true);
    expect(k({ n: 1, m: 1 }).texto.startsWith("Ya tienes 1 registro y 1 activo en Finpathia.")).toBe(true);
    expect(k({ n: 4, m: 0 }).texto.startsWith("Ya tienes 4 registros en Finpathia.")).toBe(true);
    expect(k({ n: 0, m: 3 }).texto.startsWith("Ya tienes 3 activos en Finpathia.")).toBe(true);
    for (const c of [null, { n: 0, m: 0 }]) {
      const r = k(c);
      expect(r.texto).not.toContain("Ya tienes");
      expect(r.texto.startsWith("Mañana termina tu prueba Pro.")).toBe(true);
      expect(r.asunto).toBe("Esto es lo que ya organizaste en Finpathia");
    }
  });
  it("d13 urgencia nunca lleva la frase de conteos", () => {
    const c = armarCorreo({ clave: "d13_urgencia", paso: "d13", utmContent: "urgencia", vars: { conteos: { n: 3, m: 3 } }, urlBaja: URL_BAJA });
    expect(c.asunto).toBe("Tu prueba Pro vence mañana");
    expect(c.texto).not.toContain("Ya tienes");
  });
});
