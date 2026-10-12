// El copy de privacidad y seguridad no puede prometer lo que el código no hace.
// Hoy los datos se guardan en Supabase sin cifrado del lado del cliente
// (E2E.encrypt no se llama en ninguna parte; 0 filas `_encrypted` en prod al
// 11-oct-2026), index.html carga Google Ads y Meta Pixel, y el PIN solo
// bloquea la pantalla.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";

const ARCHIVOS = [
  "src/App.jsx",
  "src/components/LandingPage.jsx",
  "src/components/HeroVariantB.jsx",
  "src/components/LandingPrivacidad.jsx",
  "src/components/LandingSeguridad.jsx",
  "src/components/LandingTerminos.jsx",
  "src/components/LandingAsesores.jsx",
  "src/components/AcceptInvite.jsx",
  "src/lib/plans.js",
  "index.html",
  "pioneros.html",
  "public/que-es-finpathia.html",
];

// Se buscan solo en texto visible: se ignoran líneas de comentario.
const PROHIBIDAS = [
  /end[- ]to[- ]end/i,
  /extremo a extremo(?! *[:.])/i, // se permite «No usamos cifrado de extremo a extremo:» / «...extremo.»
  /\bE2E\b(?![.=])/, // E2E.decrypt / const E2E= (código) sí; «Encriptación E2E» no
  /ni (finpathia|nosotros|nuestro equipo|nuestros desarrolladores) (puede|podemos|pueden)/i,
  /ni siquiera nuestro equipo/i,
  /solo t[uú] puedes acceder/i,
  /cero tracking|sin tracking|tracking de terceros/i,
  /sin registro obligatorio/i,
  /nunca salen de tu navegador/i,
  /AES-256/,
  /SOC ?2/,
  /f[ií]sicamente separad/i,
  /imposible interceptar/i,
  /99\.99/,
  /backups (autom[aá]ticos )?diarios/i,
  /no compartimos (tu )?informaci[oó]n con (terceros|anunciantes)/i,
  /Nadie puede ver tus datos sin el PIN/i,
  /cifrad[ao] con tu contrase[ñn]a|se encriptan con tu contrase[ñn]a/i,
  /Cumplimos con la Ley 1581/i,
];

function lineasVisibles(src) {
  return src
    .split("\n")
    .filter((l) => !/^\s*(\/\/|\*|\/\*|#)/.test(l))
    .filter((l) => !/^\s*\/\/ ═══ END-TO-END ENCRYPTION/.test(l));
}

describe("copy de privacidad honesto", () => {
  for (const f of ARCHIVOS) {
    it(`${f} no promete cifrado E2E, «ni Finpathia puede leer», cero tracking ni sin registro`, () => {
      const lineas = lineasVisibles(readFileSync(f, "utf8"));
      const malas = [];
      for (const l of lineas) for (const re of PROHIBIDAS) if (re.test(l)) malas.push(`${re} → ${l.trim().slice(0, 160)}`);
      expect(malas).toEqual([]);
    });
  }

  it("la copia vieja public/privacidad.html ya no existe y redirige a /privacidad", () => {
    expect(existsSync("public/privacidad.html")).toBe(false);
    const toml = readFileSync("netlify.toml", "utf8");
    expect(toml).toMatch(/from = "\/privacidad\.html"\s*\n\s*to = "\/privacidad"\s*\n\s*status = 301\s*\n\s*force = true/);
    expect(toml.indexOf('from = "/privacidad.html"')).toBeLessThan(toml.indexOf('from = "/*"'));
  });

  it("Privacidad declara Google Ads y Meta Pixel", () => {
    const s = readFileSync("src/components/LandingPrivacidad.jsx", "utf8");
    expect(s).toMatch(/Meta Pixel/);
    expect(s).toMatch(/Google Ads/);
  });

  it("el PIN no se presenta como cifrado", () => {
    const s = readFileSync("src/App.jsx", "utf8");
    expect(s).toContain("No cifra tus datos.");
  });
});
