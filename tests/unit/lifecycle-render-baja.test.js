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
  it("v2: 9 correos (d5 y d10 divididos por el simulador)", () => {
    expect(Object.keys(COPY).sort()).toEqual([
      "d10_con_simulador", "d10_sin_simulador", "d13_urgencia", "d13_valor", "d16",
      "d2_activado", "d2_sin_activar", "d5_con_simulador", "d5_sin_simulador",
    ]);
  });
  it("v2: ningún botón lleva al Asesor IA", () => {
    for (const clave of Object.keys(COPY)) {
      const c = armarCorreo({ clave, paso: pasoDe(clave), utmContent: utmDe(clave), urlBaja: URL_BAJA });
      expect(c.urlCta).not.toContain("ir=asesor");
      expect(c.html).not.toMatch(/Preguntarle a mi asesor|Abrir mi asesor|Seguir con mi asesor/);
    }
  });
  it("v2: destinos de los botones", () => {
    const dest = (clave) => new URL(armarCorreo({ clave, paso: pasoDe(clave), utmContent: utmDe(clave), urlBaja: URL_BAJA }).urlCta).searchParams.get("ir");
    expect(dest("d2_sin_activar")).toBe("dash");
    expect(dest("d2_activado")).toBe("sim");
    expect(dest("d5_sin_simulador")).toBe("sim");
    expect(dest("d5_con_simulador")).toBe("inv");
    expect(dest("d10_sin_simulador")).toBe("sim");
    expect(dest("d10_con_simulador")).toBe("price");
    expect(dest("d13_urgencia")).toBe("price");
    expect(dest("d13_valor")).toBe("price");
    expect(dest("d16")).toBe("price");
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
    const c = armarCorreo({ clave: "d13_urgencia", paso: "d13", utmContent: "urgencia", urlBaja: URL_BAJA });
    expect(c.texto).toContain(`Pro: ${pro.priceUSD.mensual} USD/mes o ${pro.priceUSD.anual} USD/mes en plan anual.`);
    const d10 = armarCorreo({ clave: "d10_sin_simulador", paso: "d10", utmContent: "d10_sin_simulador", urlBaja: URL_BAJA });
    expect(d10.texto).toContain("Pro Familiar suma hasta 10 personas.");
  });
  it("{nombre}: con nombre y sin nombre (se borra ', {nombre}' limpio)", () => {
    const con = armarCorreo({ clave: "d10_sin_simulador", paso: "d10", utmContent: "d10_sin_simulador", vars: { nombre: "Ana María Pérez" }, urlBaja: URL_BAJA });
    expect(con.asunto).toBe("Te quedan 4 días de Pro, Ana");
    const sin = armarCorreo({ clave: "d10_sin_simulador", paso: "d10", utmContent: "d10_sin_simulador", vars: { nombre: "  " }, urlBaja: URL_BAJA });
    expect(sin.asunto).toBe("Te quedan 4 días de Pro");
    expect(rellenar("Hola, {nombre}.", { nombre: "" })).toBe("Hola.");
  });
  it("nombre se escapa en HTML", () => {
    const c = armarCorreo({ clave: "d10_sin_simulador", paso: "d10", utmContent: "d10_sin_simulador", vars: { nombre: "<b>x" }, urlBaja: URL_BAJA });
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

describe("copy v2 literal (asuntos, CTA y cuerpos)", () => {
  const C = (clave, vars = {}) => armarCorreo({ clave, paso: pasoDe(clave), utmContent: utmDe(clave), vars, urlBaja: URL_BAJA });
  it("asuntos y CTA", () => {
    const esperado = {
      d2_sin_activar: ["Tu nivel está a dos datos de distancia", "Ver mi nivel"],
      d2_activado: ["Ya sabes tu nivel. ¿Qué te falta para el siguiente?", "Abrir el simulador"],
      d5_sin_simulador: ["¿Cuánto te falta para tu siguiente nivel?", "Abrir el simulador"],
      d5_con_simulador: ["Mira tu plata completa en una sola vista", "Completar mi patrimonio"],
      d10_sin_simulador: ["Te quedan 4 días de Pro, Ana", "Abrir el simulador"],
      d10_con_simulador: ["Te quedan 4 días de Pro, Ana", "Ver Pro Familiar"],
      d13_urgencia: ["Tu prueba Pro vence mañana", "Seguir con Pro"],
      d13_valor: ["Esto es lo que ya organizaste en Finpathia", "Seguir con Pro"],
      d16: ["Tu información sigue aquí", "Activar Pro"],
    };
    for (const [clave, [asunto, cta]] of Object.entries(esperado)) {
      const c = C(clave, { nombre: "Ana" });
      expect(c.asunto).toBe(asunto);
      expect(c.texto).toContain(`${cta}: `);
    }
  });
  it("cuerpos", () => {
    expect(C("d5_sin_simulador").texto.startsWith("Tu nivel es el punto de partida. El simulador te muestra cuánto te falta cada mes para llegar al siguiente, y qué cambia si ajustas tus ingresos o tus gastos.")).toBe(true);
    expect(C("d5_con_simulador").texto.startsWith("Ya usaste el simulador. Ahora carga tus cuentas, inversiones, propiedades y deudas para ver tu patrimonio neto en un solo lugar. Entre más completo, más claro ves tu camino al siguiente nivel.")).toBe(true);
    expect(C("d10_sin_simulador").texto.startsWith("Aprovecha estos días para abrir el simulador y ver qué te acerca a tu siguiente nivel. Si administras la plata en familia, Pro Familiar suma hasta 10 personas.")).toBe(true);
    expect(C("d10_con_simulador").texto.startsWith("Ya sabes cuánto te falta para tu siguiente nivel. Si administras la plata en familia, invita a los tuyos: con Pro Familiar hasta 10 personas ven y ordenan la plata juntos.")).toBe(true);
    expect(C("d13_urgencia").texto.startsWith("Mañana termina tu prueba Pro. Si no haces nada, pasas al plan gratis y conservas tus datos, tu nivel y el simulador. Pro suma los coaches, el plan de impuestos y el Asesor IA. Pro: 16 USD/mes o 12 USD/mes en plan anual.")).toBe(true);
    expect(C("d16").texto.startsWith("Estás en el plan gratis: conservas tus datos, tu nivel y el simulador. Cuando quieras las funciones Pro, actívalas en un clic.")).toBe(true);
    expect(C("d2_activado").texto.startsWith("Abre el simulador y mira cuánto te falta cada mes para llegar a tu siguiente nivel, y qué cambia si ajustas tus ingresos o tus gastos.")).toBe(true);
  });
});
