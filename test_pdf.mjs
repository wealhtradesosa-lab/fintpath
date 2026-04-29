// Test funcional del módulo pdfExport (sin DOM)
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { generarBorradorF210 } from "./src/lib/borradorDeclaracionF210.js";
import { estimarImpuesto } from "./src/lib/taxCO.js";

const u = {
  trm: 4200,
  owners: [{ id: "own_1", name: "Santiago Sosa", type: "natural", fiscalProfile: { dependientes: { cantidad: 2 } } }],
  ingresos: [
    { owner: "own_1", categoria: "Salario", mensual: 25000000, fiscalCode: "LAB_SALARIO" },
    { owner: "own_1", mensual: 8000000, fiscalCode: "NOL_ARRIENDO_INMUEBLE" },
  ],
  gas: {}, deu: [], inv: [],
};
const est = estimarImpuesto(u);
const owner = u.owners[0];
const renglones = generarBorradorF210(u, owner, est, 2025);
console.log("Renglones generados:", renglones.length);

// Generar PDF
const doc = new jsPDF({ unit: "mm", format: "letter" });
doc.setFontSize(18);
doc.text("FINPATHIA - Test PDF", 14, 20);
doc.setFontSize(10);
doc.text(`Owner: ${owner.name}`, 14, 30);
doc.text(`Renglones: ${renglones.length}`, 14, 36);

const body = renglones.slice(0, 5).map(r => [
  String(r.numero),
  r.concepto.substring(0, 50),
  "$" + Math.round(r.valor || 0).toLocaleString("es-CO"),
]);
autoTable(doc, {
  startY: 45,
  head: [["#", "Concepto", "Valor"]],
  body,
  theme: "plain",
});

const pdfBuffer = doc.output("arraybuffer");
import("fs").then(fs => {
  fs.writeFileSync("/tmp/test_finpathia.pdf", Buffer.from(pdfBuffer));
  console.log("PDF generado en /tmp/test_finpathia.pdf");
  console.log("Tamaño:", fs.statSync("/tmp/test_finpathia.pdf").size, "bytes");
});
