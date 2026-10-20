// El producto habla de tú. Ni voseo ni promesas de optimización/uptime en el copy visible.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const VOSEO = [
  "aboná",
  "abrí",
  "abrís",
  "acabás",
  "accedés",
  "aceptás",
  "acortá",
  "activá",
  "activás",
  "agregá",
  "ahorrá",
  "ahorrás",
  "ajustá",
  "ajustás",
  "alquilás",
  "andá",
  "apartá",
  "aplicá",
  "aplicás",
  "aportá",
  "aportás",
  "aprobá",
  "aprovechás",
  "arrancás",
  "arreglá",
  "arrendás",
  "asegurá",
  "asigná",
  "asignás",
  "autorizás",
  "bajá",
  "borrás",
  "buscá",
  "cambiá",
  "cancelás",
  "capturá",
  "capturás",
  "cargá",
  "cargás",
  "caés",
  "centralizá",
  "centralizás",
  "coincidís",
  "compartí",
  "completá",
  "comprometés",
  "comprá",
  "comprás",
  "comés",
  "configurá",
  "confirmá",
  "confirmás",
  "conocés",
  "considerá",
  "considerás",
  "consultá",
  "consultás",
  "contactá",
  "contestá",
  "conversá",
  "convertí",
  "copiá",
  "corregí",
  "cotizás",
  "creá",
  "creás",
  "cumplís",
  "debés",
  "decidás",
  "declará",
  "declarás",
  "decís",
  "deducís",
  "dejá",
  "dejás",
  "desactivá",
  "descargá",
  "descartá",
  "desembolsás",
  "deslizá",
  "destinás",
  "devolvé",
  "editá",
  "elegí",
  "elegís",
  "eliminá",
  "eliminás",
  "empezá",
  "empleás",
  "encontrás",
  "entendés",
  "entrá",
  "entrás",
  "equilibrá",
  "escaneá",
  "escribinos",
  "escribí",
  "especificá",
  "esperá",
  "estabilizá",
  "excluí",
  "explorá",
  "exportá",
  "facturás",
  "ganás",
  "gastás",
  "hablá",
  "hablás",
  "hacé",
  "hacés",
  "ignorá",
  "importá",
  "indicanos",
  "indicá",
  "ingresá",
  "iniciá",
  "intentá",
  "invertí",
  "invertís",
  "liberás",
  "llegás",
  "llenás",
  "llevás",
  "lográs",
  "manejás",
  "mantené",
  "mantenés",
  "marcá",
  "mejorá",
  "mirá",
  "modificá",
  "movelo",
  "movés",
  "navegá",
  "necesitás",
  "obtenés",
  "otorgás",
  "pagás",
  "pedile",
  "pedí",
  "pegá",
  "perdés",
  "planeás",
  "planificá",
  "podés",
  "poné",
  "ponés",
  "preferís",
  "preguntá",
  "prendé",
  "presentá",
  "presentás",
  "prestás",
  "priorizá",
  "probá",
  "quedás",
  "querés",
  "recargá",
  "recibís",
  "reclasificá",
  "recordá",
  "recuperás",
  "reemplazá",
  "reescribís",
  "refinanciás",
  "registralo",
  "registrá",
  "registrás",
  "respondé",
  "retenés",
  "retirás",
  "revisá",
  "sabés",
  "sacá",
  "seguís",
  "seleccioná",
  "simulás",
  "solicitá",
  "sospechás",
  "subí",
  "subís",
  "sumalos",
  "sumá",
  "tené",
  "tenés",
  "terminás",
  "tocá",
  "tocás",
  "tomá",
  "trabajás",
  "transferís",
  "tributás",
  "usá",
  "usás",
  "validá",
  "vendé",
  "vendés",
  "venís",
  "verificá",
  "visualizá",
  "vivís",
  "volvé",
  "volvés",
];
const reVoseo = new RegExp("(?<![\\wáéíóúñ])(" + VOSEO.join("|") + ")(?![\\wáéíóúñ])", "i");
const reVos = /(?<![\wáéíóúñ])(vos|sos)(?![\wáéíóúñ])/i;

function archivosTodos(dir) {
  const out = [];
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) out.push(...archivosTodos(p));
    else if (/\.(jsx?|cjs)$/.test(f)) out.push(p);
  }
  return out;
}
const sinComentarios = (s) => s.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l));

describe("tuteo, nunca voseo", () => {
  const todos = [...archivosTodos("src"), ...archivosTodos("netlify/functions")].filter((f) => !f.endsWith("taxCO.js"));
  it("src y netlify/functions no contienen voseo en líneas que no son comentarios", () => {
    const malas = [];
    for (const f of todos)
      for (const l of sinComentarios(readFileSync(f, "utf8")))
        if (reVoseo.test(l) || reVos.test(l)) malas.push(`${f}: ${l.trim().slice(0, 140)}`);
    expect(malas).toEqual([]);
  });
});

describe("copy sin promesas falsas (#38)", () => {
  const PROHIBIDAS = [
    /m[aá]s altos est[aá]ndares/i,
    /recomendaciones de optimizaci[oó]n/i,
    /99[.,]5 ?% ?uptime|apuntamos a 99/i,
    /optimizaci[oó]n tributaria/i,
    /optimizar impuestos/i,
    /Reglas de acceso \(RLS\)/,
    /cu[aá]nto puede optimizar/i,
    /con terceros para publicidad/i,
  ];
  const ARCHIVOS = ["LandingPage", "LandingTerminos", "LandingPrivacidad", "LandingAsesores"].map((n) => `src/components/${n}.jsx`);
  for (const f of ARCHIVOS)
    it(`${f} no contiene frases prohibidas`, () => {
      const malas = [];
      for (const l of sinComentarios(readFileSync(f, "utf8")))
        for (const re of PROHIBIDAS) if (re.test(l)) malas.push(`${re} → ${l.trim().slice(0, 140)}`);
      expect(malas).toEqual([]);
    });
  it("/terminos y la landing coinciden: no vendemos datos y Google/Meta solo miden anuncios con cookies aceptadas", () => {
    const t = readFileSync("src/components/LandingTerminos.jsx", "utf8");
    expect(t).toMatch(/No vendemos tus datos\. Usamos Google y Meta solo para medir nuestros anuncios, y únicamente si aceptas las cookies/);
  });
});

describe("sin claims de optimización tributaria en texto visible", () => {
  // Lo que se pinta o se manda a la IA. Identificadores (planOptimizacion, impOptimizado…) no cuentan.
  const reClaim = /(optimizar (impuestos?|tu impuesto|tu carga fiscal|la carga fiscal)|optimizaci[oó]n (tributaria|fiscal|de impuestos)|oportunidades de optimizaci[oó]n|recomendaciones de optimizaci[oó]n|palancas? de optimizaci[oó]n|(declaraci[oó]n|situaci[oó]n( fiscal)?) optimizada|Impuestos optimizados|Rebalanceo y Optimizaci[oó]n|Borrador, optimizaci[oó]n|Paso 2: Optimizaci[oó]n|titulo="Optimizaci[oó]n"|Tax Optimi[sz]|TAX OPTIMIZATION|formas (legales )?de (pagar menos|ahorrar impuestos)|Detectamos formas de pagar menos|Fechas clave para optimizar|ver detalle completo y optimizar)/i;
  const archivos = [...archivosTodos("src"), ...archivosTodos("netlify/functions")].filter((f) => !f.endsWith("taxCO.js") && !f.endsWith("TaxOptimizerUS.jsx"));
  it("no hay frases que prometan optimizar o ahorrar impuestos", () => {
    const malas = [];
    for (const f of archivos)
      for (const l of sinComentarios(readFileSync(f, "utf8")))
        if (reClaim.test(l)) malas.push(`${f}: ${l.trim().slice(0, 140)}`);
    expect(malas).toEqual([]);
  });
});
