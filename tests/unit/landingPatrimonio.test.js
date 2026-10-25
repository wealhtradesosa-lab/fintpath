import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import { getConsent, setConsent, loadTrackers } from "../../src/lib/consent.js";
import { PLANES_TEXTO, FAQ } from "../../src/components/LandingPatrimonio.jsx";

const read = (p) => readFileSync(new URL("../../" + p, import.meta.url), "utf8");
const require = createRequire(import.meta.url);

const PROHIBIDAS = [
  "nivel de libertad", "libertad financiera", "simulador", "te faltan", "asesor ia", "coach",
  "impuesto", "renta", "salud financiera", "cancelar", "fin de la prueba", "end-to-end",
  "nadie puede leer", "sin registro", "cero tracking", "explorar sin cuenta", "demo",
  "garantiz", "rentabilidad", "ahorra",
];

describe("copy de /patrimonio", () => {
  const src = read("src/components/LandingPatrimonio.jsx").toLowerCase();
  const html = read("patrimonio.html").toLowerCase();
  it.each(PROHIBIDAS)("no aparece «%s»", (frase) => {
    // El comentario de cabecera del componente cita "demo" y "Explorar sin cuenta"; se excluye.
    const cuerpo = src.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
    expect(cuerpo.includes(frase)).toBe(false);
    expect(html.includes(frase)).toBe(false);
  });
  it("planes: precios de la brief", () => {
    expect(PLANES_TEXTO).toContain("16 USD");
    expect(PLANES_TEXTO).toContain("12 USD");
    expect(PLANES_TEXTO).toContain("27 USD");
    expect(PLANES_TEXTO).toContain("20 en anual");
    expect(FAQ).toHaveLength(4);
  });
  it("tiene los dos CTA y el login", () => {
    const s = read("src/components/LandingPatrimonio.jsx");
    expect(s).toContain('cta("hero")');
    expect(s).toContain('cta("final")');
    expect(s).toContain("Iniciar sesión");
    expect(s.match(/Datos ilustrativos/g).length).toBe(2);
  });
});

describe("modal de registro en /patrimonio", () => {
  it("oculta E2E, Explorar sin cuenta y demo en esa ruta", () => {
    const app = read("src/App.jsx");
    expect(app).toContain("{!__enLandingPatrimonio&&<div style={{background:\"rgba(34,197,94,0.04)\"");
    expect(app).toContain("{!__enLandingPatrimonio&&!(aM===\"signup\"&&__norteLanding)&&<><div style={{marginTop:24");
  });
  it("el login de /patrimonio abre la pestaña Ingresar", () => {
    const app = read("src/App.jsx");
    expect(app).toMatch(/<LandingPatrimonio onLogin=\{\(\)=>\{sAM\("login"\)/);
    expect(app).toMatch(/onGetStarted=\{\(ctaId\)=>\{sAM\("signup"\)/);
  });
});

describe("ruta en netlify.toml", () => {
  const toml = read("netlify.toml");
  it("/patrimonio y /patrimonio/ van a patrimonio.html antes del fallback /*", () => {
    const iFallback = toml.indexOf('from = "/*"');
    for (const f of ['from = "/patrimonio"', 'from = "/patrimonio/"']) {
      const i = toml.indexOf(f);
      expect(i).toBeGreaterThan(-1);
      expect(i).toBeLessThan(iFallback);
    }
    expect(toml).toMatch(/from = "\/patrimonio"\s+to = "\/patrimonio\.html"\s+status = 200/);
  });
  it("patrimonio.html es entrada de vite", () => {
    expect(read("vite.config.js")).toContain("patrimonio.html");
  });
});

function fakeEnv(search, cookie = "") {
  const doc = { cookie };
  const win = { location: { search, pathname: "/patrimonio", protocol: "https:" } };
  // Un setter que acumula como el navegador (solo nombre=valor).
  let jar = cookie;
  Object.defineProperty(doc, "cookie", {
    get: () => jar,
    set: (v) => { const nv = v.split(";")[0]; const k = nv.split("=")[0]; jar = jar.split("; ").filter((c) => c && !c.startsWith(k + "=")).concat(nv).join("; "); doc.__raw = v; },
  });
  return { win, doc };
}
const attribution = read("public/patrimonio/attribution.js");
const correr = (env) => vm.runInNewContext(attribution, { window: env.win, document: env.doc, URLSearchParams, String, Date, encodeURIComponent });

describe("cookie de primer toque", () => {
  it("guarda utm_*, fbclid y gclid por 30 días", () => {
    const env = fakeEnv("?utm_source=meta&utm_medium=paid_social&utm_campaign=fp_patrimonio_2610&utm_content=patrimonio_reel_v4&fbclid=ABC&gclid=XYZ&otro=1");
    correr(env);
    expect(env.doc.__raw).toContain("max-age=2592000");
    const v = JSON.parse(decodeURIComponent(env.doc.cookie.split("=").slice(1).join("=")));
    expect(v).toMatchObject({ utm_source: "meta", utm_medium: "paid_social", utm_campaign: "fp_patrimonio_2610", utm_content: "patrimonio_reel_v4", fbclid: "ABC", gclid: "XYZ" });
    expect(v.otro).toBeUndefined();
  });
  it("primer toque: no pisa una cookie existente", () => {
    const env = fakeEnv("?utm_source=otro", "fp_ft=previo");
    correr(env);
    expect(env.doc.__raw).toBeUndefined();
  });
  it("sin parámetros no escribe nada", () => {
    const env = fakeEnv("");
    correr(env);
    expect(env.doc.__raw).toBeUndefined();
  });
  it("corre en <head> antes del script de autocuración", () => {
    const h = read("patrimonio.html");
    expect(h.indexOf("/patrimonio/attribution.js")).toBeGreaterThan(-1);
    expect(h.indexOf("/patrimonio/attribution.js")).toBeLessThan(h.indexOf("fp_autocura"));
  });
});

describe("auth-signup guarda el primer toque", () => {
  const { cleanFirstTouch } = require("../../netlify/functions/auth-signup.cjs");
  it("filtra claves y recorta", () => {
    const r = cleanFirstTouch({ utm_source: "meta", email: "a@b.co", utm_content: "x".repeat(500), ts: 5 });
    expect(r.utm_source).toBe("meta");
    expect(r.email).toBeUndefined();
    expect(r.utm_content.length).toBe(200);
  });
  it("sin datos válidos devuelve null", () => {
    expect(cleanFirstTouch(null)).toBeNull();
    expect(cleanFirstTouch({ foo: "bar" })).toBeNull();
  });
});

describe("consentimiento", () => {
  it("el HTML no incluye Pixel, GA4 ni Ads", () => {
    const h = read("patrimonio.html");
    for (const x of ["fbevents", "googletagmanager", "fbq(", "gtag(", "1637963763961269", "AW-613365221", "G-51CV6PWRLT"]) expect(h).not.toContain(x);
  });
  it("sin consentimiento no se carga nada; con él, sí", () => {
    const scripts = [];
    const doc = { cookie: "", createElement: () => ({}), head: { appendChild: (s) => scripts.push(s.src) } };
    const win = {};
    expect(getConsent(doc)).toBeNull();
    expect(scripts).toHaveLength(0);
    setConsent("denied", doc);
    expect(doc.cookie).toContain("fp_consent=denied");
    expect(scripts).toHaveLength(0);
    expect(loadTrackers(win, doc)).toBe(true);
    expect(scripts.some((s) => s.includes("fbevents.js"))).toBe(true);
    expect(scripts.some((s) => s.includes("googletagmanager.com/gtag/js"))).toBe(true);
    expect(loadTrackers(win, doc)).toBe(false);
  });
});
