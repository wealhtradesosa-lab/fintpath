// 21-oct-2026 — Una sola gramática para toda la sección.
//
// Santiago, armando la lógica del paso 1: "uno normalmente tiene unos activos
// unas rentas, eso debería estar ahí lo que uno tiene hoy, y entonces uno
// debería poder decir qué ya no va más se vende o sale, y luego qué viene
// nuevo"… "y cuándo"… "y qué valor y cuánto renta".
//
// De ahí sale la rejilla: tres tiempos (tengo / ya no va / viene) por cuatro
// datos (qué es · cuándo · cuánto vale · cuánto renta). Lo que faltaba era el
// "hasta cuándo" de lo que ya se tiene: sin él, un ingreso que solo corre en
// diciembre se ve igual que uno de todo el año.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { baseDesdeUsuario, CANASTA_CORTO, CANASTA_LABEL, porQueCanasta } from "../../src/lib/caminos.js";

const miPlan = readFileSync(new URL("../../src/components/MiPlan.jsx", import.meta.url), "utf8");
const user = (ingresos, inv = []) => ({ trm: 4200, inv, ingresos, gas: {}, deu: [] });

describe("hasta cuándo: la celda que faltaba", () => {
  const conVentana = (desdeMes, hastaMes) => baseDesdeUsuario(user([{
    id: "x", nombre: "BTG", categoria: "Intereses bancarios", capital: 7000e6, tasa: 21,
    mensual: 122.5e6, frecuencia: "mensual", desdeMes, hastaMes,
  }])).posiciones.find((p) => p.soloIngreso);

  it("una renta de un solo mes trae su ventana", () => {
    expect(conVentana(12, 12).ventana).toMatchObject({ desde: 12, hasta: 12 });
  });

  it("una de varios meses también", () => {
    expect(conVentana(10, 12).ventana).toMatchObject({ desde: 10, hasta: 12 });
  });

  it("la de todo el año no tiene nada que avisar", () => {
    expect(conVentana(1, 12).ventana).toMatchObject({ desde: 1, hasta: 12 });
  });

  it("el arriendo de un inmueble también arrastra su ventana al activo", () => {
    const inv = [{ id: "a", n: "Local", tp: "Local Comercial", va: 1000e6 }];
    const ing = [{ id: "r", nombre: "Arriendo local", categoria: "Arriendo", mensual: 6e6, activoId: "a", frecuencia: "mensual", desdeMes: 3, hastaMes: 9 }];
    expect(baseDesdeUsuario(user(ing, inv)).posiciones[0].ventana).toMatchObject({ desde: 3, hasta: 9 });
  });
});

describe("la canasta se deduce de lo que produce, no se pregunta", () => {
  it("cada canasta tiene su línea en lenguaje común", () => {
    for (const k of ["proteccion", "rentas", "crecimiento", "uso"]) {
      expect(CANASTA_CORTO[k], k).toBeTruthy();
      expect(CANASTA_CORTO[k].length, k).toBeLessThan(60);
      expect(CANASTA_LABEL[k], k).toBeTruthy();
    }
  });

  it("la de Protección es la que ya estaba escrita para Tu Norte", () => {
    expect(CANASTA_CORTO.proteccion).toBe("Lo que te sostiene si todo sale mal");
  });

  it("dice por qué cayó donde cayó", () => {
    expect(porQueCanasta({ vivienda: true })).toBe("vives aquí");
    expect(porQueCanasta({ bolsillo: "sustento", renta: 5e6 })).toBe("te paga cada mes");
    expect(porQueCanasta({ bolsillo: "crecimiento" })).toBe("crece adentro, no te paga");
    expect(porQueCanasta({ bolsillo: "uso", vehiculo: true })).toBe("pierde valor con el uso");
  });

  it("si el usuario la corrigió, la pantalla lo dice en vez de explicar una deducción que ya no manda", () => {
    expect(miPlan).toContain('p.canasta ? "lo decidiste tú" : porQueCanasta(p)');
  });
});

describe("lo que viene se pregunta en el orden en que se piensa", () => {
  it("los movimientos están agrupados en los tres tiempos de la sección", () => {
    for (const g of ["Viene algo nuevo", "Ya no va", "Cambia algo que ya tengo"]) {
      expect(miPlan, g).toContain(`g: "${g}"`);
    }
  });

  it("arranca en «compro algo», no en vocabulario del motor", () => {
    expect(miPlan).toContain('useState({ tipo: "comprar"');
    expect(miPlan).not.toContain('useState({ tipo: "flujo_inicia_ingreso"');
  });

  it("los campos preguntan cuánto vale y cuánto renta, con esas palabras", () => {
    expect(miPlan).toContain("Cuánto vale (pesos)");
    expect(miPlan).toContain("Cuánto renta al mes (pesos)");
  });

  it("no se perdió ninguna capacidad: los ocho movimientos siguen ahí", () => {
    for (const v of ["comprar", "vender", "aportar", "revaluar", "flujo_inicia_ingreso", "flujo_inicia_gasto", "flujo_termina", "flujo_cambia"]) {
      expect(miPlan, v).toContain(`v: "${v}"`);
    }
  });
});
