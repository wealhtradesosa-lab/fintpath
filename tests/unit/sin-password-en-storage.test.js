// Ningún código del navegador guarda la contraseña del usuario en
// localStorage/sessionStorage. Hasta oct-2026 el login la copiaba en claro a
// "fp3_enc_key" para un descifrado E2E que no se usaba.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function archivos(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) archivos(p, out);
    else if (/\.(jsx?|mjs|cjs|tsx?)$/.test(n)) out.push(p);
  }
  return out;
}
const FUENTES = [...archivos("src"), "index.html", "pioneros.html", ...readdirSync("public").filter((n) => n.endsWith(".html")).map((n) => join("public", n))];

// Extrae el segundo argumento de cada storage.setItem(k, v) (aprox.: hasta el
// paréntesis que cierra la llamada, con anidación simple).
function llamadasSetItem(src) {
  const res = [];
  const re = /(localStorage|sessionStorage|storage)\s*\.\s*setItem\s*\(/g;
  let m;
  while ((m = re.exec(src))) {
    let i = re.lastIndex, prof = 1;
    while (i < src.length && prof > 0) {
      if (src[i] === "(") prof++;
      else if (src[i] === ")") prof--;
      i++;
    }
    res.push(src.slice(re.lastIndex, i - 1));
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

  it("nadie lee ni escribe fp3_enc_key salvo la limpieza al cargar", () => {
    const usos = [];
    for (const f of FUENTES) {
      readFileSync(f, "utf8").split("\n").forEach((l, i) => {
        if (/fp3_enc_key/.test(l) && !/^\s*\/\//.test(l)) usos.push(`${f}:${i + 1}: ${l.trim()}`);
      });
    }
    expect(usos).toEqual(['src/App.jsx:' + usos[0]?.split(":")[1] + ': const CLAVES_PROHIBIDAS=["fp3_enc_key"];']);
  });

  it("App.jsx borra fp3_enc_key de localStorage y sessionStorage al cargar el módulo", () => {
    const s = readFileSync("src/App.jsx", "utf8");
    expect(s).toMatch(/for\(const k of CLAVES_PROHIBIDAS\)\{localStorage\.removeItem\(k\);sessionStorage\.removeItem\(k\)\}/);
    // Debe estar a nivel de módulo (antes del primer componente), no dentro de un efecto.
    expect(s.indexOf("CLAVES_PROHIBIDAS){localStorage.removeItem")).toBeLessThan(s.indexOf("function LoadingScreen"));
  });

  it("ya no queda el descifrado E2E que dependía de la clave guardada", () => {
    const s = readFileSync("src/App.jsx", "utf8");
    expect(/E2E\.(decrypt|encrypt)|const E2E=/.test(s)).toBe(false);
  });

  it("el detector sí atrapa el patrón viejo", () => {
    const viejo = 'setAuthUser(data.user);localStorage.setItem("fp3_enc_key",aF.p);';
    expect(llamadasSetItem(viejo).some((a) => VALOR_PROHIBIDO.test(a))).toBe(true);
    expect(llamadasSetItem('sessionStorage.setItem("x", JSON.stringify({password: p}))').some((a) => VALOR_PROHIBIDO.test(a))).toBe(true);
    expect(llamadasSetItem('localStorage.setItem("fp3_cur", c)').some((a) => VALOR_PROHIBIDO.test(a))).toBe(false);
  });
});
