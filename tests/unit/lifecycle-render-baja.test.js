// Copy, enlaces con UTM y token de baja de la secuencia de prueba.
import { describe, it, expect } from "vitest";
import { armarCorreo, rellenar, PRECIOS } from "../../netlify/lib/lifecycle/render.mjs";
import { COPY, CIERRE_MARCA } from "../../netlify/lib/lifecycle/copy.mjs";
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
  it("v3: 8 correos (d2 y d5 divididos por primer activo; d10 único)", () => {
    expect(Object.keys(COPY).sort()).toEqual([
      "d10", "d13_urgencia", "d13_valor", "d16",
      "d2_con_activo", "d2_sin_activo", "d5_con_activo", "d5_sin_activo",
    ]);
  });
  it("v3: no menciona nivel, simulador, 'te faltan', asesor, coaches, impuestos, Salud financiera ni cancelar", () => {
    const prohibido = /nivel|simulador|te falta|asesor|coach|impuesto|tributari|salud financiera|cancel/i;
    for (const clave of Object.keys(COPY)) {
      const c = armarCorreo({ clave, paso: pasoDe(clave), utmContent: utmDe(clave), vars: { nombre: "Ana", conteos: { n: 3, m: 2 } }, urlBaja: URL_BAJA });
      expect(c.asunto).not.toMatch(prohibido);
      expect(c.texto.replace(CIERRE_MARCA, "")).not.toMatch(prohibido);
    }
  });
  it("spec final: ningún asunto, cuerpo ni enlace empuja el asesor, los coaches o Impuestos", () => {
    const prohibido = /asesor|coach|impuesto|tributari|ir=(asesor|coach|tax)/i;
    for (const clave of Object.keys(COPY)) {
      const c = armarCorreo({ clave, paso: pasoDe(clave), utmContent: utmDe(clave), vars: { nombre: "Ana", conteos: { n: 3, m: 2 } }, urlBaja: URL_BAJA });
      expect(c.asunto).not.toMatch(prohibido);
      expect(c.texto).not.toMatch(prohibido);
      expect(c.html).not.toMatch(prohibido);
      const hrefs = [...c.html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
      for (const h of hrefs) expect(h).not.toMatch(prohibido);
    }
  });
  it("ningún botón lleva al Asesor IA", () => {
    for (const clave of Object.keys(COPY)) {
      const c = armarCorreo({ clave, paso: pasoDe(clave), utmContent: utmDe(clave), urlBaja: URL_BAJA });
      expect(c.urlCta).not.toContain("ir=asesor");
      expect(c.html).not.toMatch(/Preguntarle a mi asesor|Abrir mi asesor|Seguir con mi asesor/);
    }
  });
  it("v3: destinos de los botones", () => {
    const dest = (clave) => new URL(armarCorreo({ clave, paso: pasoDe(clave), utmContent: utmDe(clave), urlBaja: URL_BAJA }).urlCta).searchParams.get("ir");
    for (const k of ["d2_sin_activo", "d2_con_activo", "d5_sin_activo", "d5_con_activo", "d10"]) expect(dest(k)).toBe("inv");
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
    const fam = PLAN_BASE.find((p) => p.name === "Pro Familiar");
    expect(c.texto).toContain(`Pro Familiar: ${fam.priceUSD.mensual} USD/mes o ${fam.priceUSD.anual} USD/mes en plan anual.`);
    expect(c.texto).toContain(`hasta ${fam.maxMembers} personas de tu familia`);
    const v = armarCorreo({ clave: "d13_valor", paso: "d13", utmContent: "valor", vars: { conteos: { n: 2, m: 1 } }, urlBaja: URL_BAJA });
    expect(v.texto.startsWith("Ya tienes 2 registros y 1 activo en Finpathia.")).toBe(true);
    expect(v.texto).toContain("Con Pro Familiar compartes tu Finpathia con hasta 10 personas de tu familia. Pro: 16 USD/mes o 12 USD/mes en plan anual. Pro Familiar: 27 USD/mes o 20 USD/mes en plan anual.");
    const d10 = armarCorreo({ clave: "d10", paso: "d10", utmContent: "d10", urlBaja: URL_BAJA });
    expect(d10.texto).toContain("con Pro Familiar compartes tu Finpathia con hasta 10 personas de tu familia.");
  });
  it("{nombre}: con nombre y sin nombre (se borra ', {nombre}' limpio)", () => {
    const con = armarCorreo({ clave: "d10", paso: "d10", utmContent: "d10", vars: { nombre: "Ana María Pérez" }, urlBaja: URL_BAJA });
    expect(con.asunto).toBe("Te quedan 4 días de Pro, Ana");
    const sin = armarCorreo({ clave: "d10", paso: "d10", utmContent: "d10", vars: { nombre: "  " }, urlBaja: URL_BAJA });
    expect(sin.asunto).toBe("Te quedan 4 días de Pro");
    expect(rellenar("Hola, {nombre}.", { nombre: "" })).toBe("Hola.");
  });
  it("nombre se escapa en HTML", () => {
    const c = armarCorreo({ clave: "d10", paso: "d10", utmContent: "d10", vars: { nombre: "<b>x" }, urlBaja: URL_BAJA });
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

describe("copy v3 literal (copy_secuencia_trial_v3_patrimonio.md)", () => {
  const C = (clave, vars = {}) => armarCorreo({ clave, paso: pasoDe(clave), utmContent: utmDe(clave), vars, urlBaja: URL_BAJA });
  it("asuntos y CTA", () => {
    const esperado = {
      d2_sin_activo: ["Tu patrimonio empieza con un activo", "Cargar mi primer activo"],
      d2_con_activo: ["Ya empezaste. ¿Qué más tienes?", "Completar mi patrimonio"],
      d5_sin_activo: ["¿Cuánto vale todo lo que tienes?", "Ver mi patrimonio"],
      d5_con_activo: ["Mira cuánto ha ganado cada activo", "Revisar mis activos"],
      d10: ["Te quedan 4 días de Pro, Ana", "Completar mi patrimonio"],
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
    const cuerpos = {
      d2_sin_activo: "Carga tu primer activo, por ejemplo tu cuenta de ahorros, un CDT o tu apartamento, y Finpathia empieza a armar tu patrimonio total en un solo lugar.",
      d2_con_activo: "Suma tus otras cuentas, inversiones, propiedades y deudas. Entre más completo, más claro ves cuánto vale lo que tienes y cuánta deuda tiene encima.",
      d5_sin_activo: "Tus cuentas, tu carro, tu CDT y tus deudas, juntos en una sola vista. Carga lo que tengas a la mano y mira tu patrimonio total.",
      d5_con_activo: "En Finpathia ves, activo por activo, cuánto vale, cuánto ha ganado y cuánta deuda tiene encima. Revisa los tuyos y completa los que falten.",
      d10: "Aprovecha estos días para dejar tu patrimonio completo. Si administras la plata en familia, con Pro Familiar compartes tu Finpathia con hasta 10 personas de tu familia.",
      d13_urgencia: "Mañana termina tu prueba Pro. Si no haces nada, pasas al plan gratis y conservas tus datos. Con Pro Familiar compartes tu Finpathia con hasta 10 personas de tu familia. Pro: 16 USD/mes o 12 USD/mes en plan anual. Pro Familiar: 27 USD/mes o 20 USD/mes en plan anual.",
      d16: "Estás en el plan gratis y todo lo que cargaste sigue guardado. Cuando quieras las funciones Pro, actívalas en un clic.",
    };
    for (const [clave, cuerpo] of Object.entries(cuerpos)) expect(C(clave).texto.startsWith(cuerpo)).toBe(true);
    expect(C("d13_valor", { conteos: { n: 2, m: 1 } }).texto.startsWith("Ya tienes 2 registros y 1 activo en Finpathia.\n" + cuerpos.d13_urgencia)).toBe(true);
  });
});
