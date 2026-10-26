// Ningún código del navegador guarda la contraseña del usuario en
// localStorage/sessionStorage. Hasta oct-2026 el login la copiaba en claro a
// "fp3_enc_key" para descifrar payloads legacy; ahora la llave vive solo en
// memoria y el módulo borra al cargar la que quedó en navegadores viejos.
// Detector tomado del PR #39 (santiago/eng, 12-oct-2026).
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

function archivos(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) archivos(p, out);
    else if (/\.(jsx?|mjs|cjs|tsx?)$/.test(n)) out.push(p);
  }
  return out;
}
const HTML = ["index.html", "pioneros.html"].filter((f) => existsSync(f));
const FUENTES = [
  ...archivos("src"),
  ...HTML,
  ...(existsSync("public") ? readdirSync("public").filter((n) => n.endsWith(".html")).map((n) => join("public", n)) : []),
];

// Extrae el VALOR de cada storage.setItem(k, v): todo lo que sigue a la primera
// coma de nivel superior. Mirar también la clave daba falsos positivos, porque
// en este repo "clave" nombra claves de storage (CLAVE_NORTE), no contraseñas.
function llamadasSetItem(src) {
  const res = [];
  const re = /(localStorage|sessionStorage|storage)\s*\.\s*setItem\s*\(/g;
  let m;
  while ((m = re.exec(src))) {
    let i = re.lastIndex, prof = 1, coma = -1;
    while (i < src.length && prof > 0) {
      const c = src[i];
      if (c === "(" || c === "[" || c === "{") prof++;
      else if (c === ")" || c === "]" || c === "}") prof--;
      else if (c === "," && prof === 1 && coma === -1) coma = i;
      i++;
    }
    const args = src.slice(re.lastIndex, i - 1);
    res.push(coma === -1 ? args : src.slice(coma + 1, i - 1));
  }
  return res;
}

const VALOR_PROHIBIDO = /\baF\.p\b|\baF\b(?!\.)|password|passwd|\bpwd\b|contrase|\bclave|enc_?key|resetNewPassword/i;

describe("la contraseña no se guarda en el navegador", () => {
  it("ningún setItem guarda una contraseña ni el formulario de login", () => {
    const malos = [];
    for (const f of FUENTES) {
      for (const args of llamadasSetItem(readFileSync(f, "utf8"))) {
        if (VALOR_PROHIBIDO.test(args)) malos.push(`${f}: setItem(${args.slice(0, 120)})`);
      }
    }
    expect(malos).toEqual([]);
  });

  it("fp3_enc_key solo aparece en la lista de claves a borrar", () => {
    // Sin número de línea: cualquier edición más arriba del archivo lo movería.
    const usos = [];
    for (const f of FUENTES) {
      readFileSync(f, "utf8").split("\n").forEach((l) => {
        if (/fp3_enc_key/.test(l) && !/^\s*\/\//.test(l)) usos.push(`${f}: ${l.trim()}`);
      });
    }
    expect(usos).toEqual(['src/App.jsx: const CLAVES_PROHIBIDAS=["fp3_enc_key"];']);
  });

  it("App.jsx borra la clave vieja de localStorage y sessionStorage al cargar el módulo", () => {
    const s = readFileSync("src/App.jsx", "utf8");
    expect(s).toMatch(/for\(const k of CLAVES_PROHIBIDAS\)\{localStorage\.removeItem\(k\);sessionStorage\.removeItem\(k\)\}/);
    // A nivel de módulo (antes del primer componente), no dentro de un efecto.
    expect(s.indexOf("CLAVES_PROHIBIDAS){localStorage.removeItem")).toBeLessThan(s.indexOf("function LoadingScreen"));
  });

  // El lector E2E se conserva a propósito: `E2E.encrypt` ya no se llama, pero
  // puede haber filas viejas con payload cifrado. Con la llave en memoria se
  // descifran durante la sesión del login y se reescriben planas al guardar.
  // Lo que NO debe volver es que la llave se persista.
  it("la llave de descifrado vive en memoria, no en storage", () => {
    const s = readFileSync("src/App.jsx", "utf8");
    expect(s).toMatch(/^let _encKey=null;$/m);
    expect(s).toMatch(/const encKey=_encKey;/);
    expect(s).not.toMatch(/setItem\("fp3_enc_key"/);
  });

  it("el detector sí atrapa el patrón viejo", () => {
    const viejo = 'setAuthUser(data.user);localStorage.setItem("fp3_enc_key",aF.p);';
    expect(llamadasSetItem(viejo).some((a) => VALOR_PROHIBIDO.test(a))).toBe(true);
    expect(llamadasSetItem('sessionStorage.setItem("x", JSON.stringify({password: p}))').some((a) => VALOR_PROHIBIDO.test(a))).toBe(true);
    expect(llamadasSetItem('localStorage.setItem("fp3_cur", c)').some((a) => VALOR_PROHIBIDO.test(a))).toBe(false);
  });
});
