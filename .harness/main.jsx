import { createRoot } from "react-dom/client";
import { useState } from "react";
import MiFuturo10 from "../src/components/MiFuturo10.jsx";
const user = { inflacionPct: 6.3, trm: 4000,
  inv: [{ id: "pm", n: "Puerto Madero", tp: "Real Estate", va: 8700e6 }, { id: "orl", n: "Casa Orlando", tp: "Real Estate", va: 115000, moneda: "USD" }, { id: "lote", n: "Lote bodega Macarena", tp: "Lote", va: 410e6 }, { id: "loc", n: "Local Macarena", tp: "Local Comercial", va: 1100e6 }, { id: "rap", n: "Rapicredit fondeo", tp: "Fondo de Inversión", va: 3288e6 }, { id: "dis", n: "District Miami", tp: "Real Estate", va: 212000, moneda: "USD" }, { id: "ibkr", n: "IBKR", tp: "ETF", va: 126e6 }, { id: "cta", n: "Cash", tp: "Cash", va: 40e6 }, { id: "car", n: "Vehículos", tp: "Vehículo", va: 535e6 }],
  ingresos: [{ nombre: "Rapicredit", categoria: "Rendimientos", mensual: 57.5e6, activoId: "rap" }, { nombre: "Arriendo Puerto Madero", categoria: "Arriendo", mensual: 47.1e6, activoId: "pm" }, { nombre: "District", categoria: "Arriendo", mensual: 6.2e6, activoId: "dis" }, { nombre: "Fee distribuidores", categoria: "Honorarios", mensual: 13e6 }],
  gas: { Vida: [{ n: "Familia", m: 21e6 }, { n: "Vivienda", m: 19e6 }, { n: "Obligatorios", m: 35e6 }, { n: "Impuestos", m: 12e6 }] },
  deu: [{ id: "sl", n: "Saldo local", mt: 437e6, pg: 0, ts: 0, tipoInteres: "sin_interes", la: "loc" }, { id: "ford", n: "SUFI Ford", mt: 157e6, pg: 4.5e6, ts: 20 }, { id: "dh", n: "Hipoteca District", mt: 117500, pg: 1100, ts: 6, moneda: "USD", la: "dis" }] };
const base = { escenario: "base", norte: "rentas", decisiones: { pm: { accion: "vende" }, orl: { accion: "vende" } }, pagarDeudas: { ford: true, sl: true },
  futuros: { ingresos: [{ nombre: "Pensión Ana", mensual: 24e6, desde: 6, hasta: "" }, { nombre: "Pensión Santiago", mensual: 26e6, desde: 10, hasta: "" }, { nombre: "Renta local", mensual: 8e6, desde: 2, activoId: "loc", valorizacionNomPct: 6 }], activos: [] },
  nuevas: [{ preset: "custom", nombre: "BTG renta fija", monto: 5000e6, anio: 1, rendimientoNomPct: 10.5, tipo: "renta", fuente: "venta" }],
  reinversiones: [{ activoId: "lote", monto: 600e6, anio: 1, rentaMensual: 8e6, rentaDesdeMes: 5, fuente: "venta", valorizacionNomPct: 6 }, { activoId: "ibkr", monto: 1600e6, anio: 1, rendimientoNomPct: 22, pctRecibe: 0, fuente: "venta" }] };
base.nuevas[0].pctRecibe = 0;
const conquista = { ...base, nuevas: [{ preset: "custom", nombre: "BTG renta fija", monto: 2500e6, anio: 1, rendimientoNomPct: 10.5, tipo: "renta", fuente: "venta" }], reinversiones: [{ activoId: "lote", monto: 600e6, anio: 1, rentaMensual: 8e6, rentaDesdeMes: 5, fuente: "venta" }, { activoId: "ibkr", monto: 4000e6, anio: 1, rendimientoNomPct: 22, pctRecibe: 0, fuente: "venta" }] };
base.nuevas[0].pctRecibe = 0;
const q = new URLSearchParams(location.search);
const paso = Number(q.get("paso") || 0);
const cfg = q.get("cfg") ? JSON.parse(decodeURIComponent(q.get("cfg"))) : base;
function App() { const [g, setG] = useState({ borrador: cfg, escenarios: q.get("esc") ? [{ id: "e1", nombre: "Conservador + casa", config: base }, { id: "e2", nombre: "Conquista", config: conquista }] : [] }); return <MiFuturo10 user={user} guardado={g} onGuardar={setG} pasoInicial={paso} />; }
createRoot(document.getElementById("root")).render(<App />);
