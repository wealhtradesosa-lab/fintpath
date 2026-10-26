// El 4200 no es una tasa: es el respaldo de cuando el efecto de TRM estaba
// muerto. Este test fija el único lugar donde está escrito con nombre y vigila
// que los módulos ya migrados no vuelvan a escribirlo a mano.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { TRM_PROVISIONAL, trmUsable } from "../../src/lib/trm.js";

const leer = (f) => readFileSync(new URL(`../../src/${f}`, import.meta.url), "utf8");
// Los que ya pasaron por el módulo. La lista crece a medida que se migran los
// 86 sitios que quedan (32 archivos) — ver el PR que introdujo src/lib/trm.js.
const MIGRADOS = [
  "lib/borradorDeclaracionF210.js",
  "lib/borradorDeclaracion.js",
  "lib/auditoriaDatos.js",
  "lib/contextoAsesor.js",
];

describe("la tasa de respaldo vive en un solo lugar", () => {
  it("trmUsable descarta el provisional, el cero y la basura", () => {
    expect(trmUsable(3950)).toBe(3950);
    expect(trmUsable(TRM_PROVISIONAL)).toBeNull();
    expect(trmUsable(0)).toBeNull();
    expect(trmUsable(-1)).toBeNull();
    expect(trmUsable(null)).toBeNull();
    expect(trmUsable("hola")).toBeNull();
    expect(trmUsable("3950")).toBe(3950);
  });

  it("los módulos migrados no escriben 4200 a mano", () => {
    for (const f of MIGRADOS) {
      const enCodigo = leer(f).split("\n")
        .filter((l) => l.includes("4200") && !l.trim().startsWith("//") && !l.trim().startsWith("*"));
      expect(enCodigo, f).toEqual([]);
    }
  });

  it("los módulos migrados toman la constante del módulo", () => {
    for (const f of MIGRADOS) {
      if (f === "lib/contextoAsesor.js") continue; // ese no inventa tasa: informa en US$
      expect(leer(f), f).toContain('from "./trm.js"');
    }
  });
});
