// QA PR #56 v7: sS no truena sin window; App no escribe user_data con la tasa «cargando».
import { describe, it, expect } from "vitest";
import fs from "fs";
const src = fs.readFileSync(new URL("../../src/App.jsx", import.meta.url), "utf8");
describe("App: guardado y TRM", () => {
  it("el autosave no escribe mientras la tasa está cargando y corre al resolverse", () => {
    const m = src.match(/useEffect\(\(\)=>\{\n\s*if\(!u\)return;[\s\S]*?\},\[u,trmCarga\]\);/);
    expect(m).not.toBeNull();
    expect(m[0]).toMatch(/if\(trmCarga==="cargando"\)return;/);
  });
  it("/api/trm siempre con límite de tiempo", () => {
    expect(src).not.toMatch(/fetch\(['"]\/api\/trm['"]\)/);
    expect((src.match(/traerTrm\(\)/g) || []).length).toBeGreaterThanOrEqual(2);
  });
  it("sS usa window solo con guarda", () => {
    const sS = src.slice(src.indexOf("const sS=async"), src.indexOf("// 03-ago-2026 (Santiago: \"dólar a 4.200"));
    for (const l of sS.split("\n").filter((x) => /window\./.test(x))) expect(l).toMatch(/typeof window!=="undefined"/);
  });
});
