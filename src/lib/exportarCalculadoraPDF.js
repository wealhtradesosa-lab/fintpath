// ═══════════════════════════════════════════════════════════════════════════
// exportarCalculadoraPDF — PDF de lo que se ve en una calculadora (5-nov-2026)
//
// Santiago: "las secciones de las calculadoras deberían poder exportarse en
// PDF, por ejemplo la pensión o el ahorro en BTC".
//
// Cómo funciona: copia la sección tal como está en pantalla (con sus gráficas)
// a un iframe aparte, en modo claro y tamaño carta, y abre el diálogo de
// impresión, donde se elige "Guardar como PDF". Así el PDF es idéntico a lo que
// la persona ve, sin mantener un segundo diseño en jsPDF para cada calculadora.
//
// Lo que se cambia en la copia:
//   - Las casillas (input, select) se vuelven texto con el valor escrito: en el
//     PDF se lee qué datos se usaron. La hoja de impresión global (index.html)
//     ocultaba todos los inputs, por eso no se reutiliza.
//   - Los botones de acción (Abrir, Borrar, Guardar…) se quitan; los de opción
//     (Mensual, Anual, 6 %…) se dejan como texto para que se vea cuál se eligió.
//   - Lo marcado con data-no-print se quita.
//   - Arriba: título y fecha. Abajo: aviso de que es informativo y no es
//     asesoría financiera (regla de Santiago, 4-nov-2026).
// ═══════════════════════════════════════════════════════════════════════════

const ACCION = /^(abrir|abierto|borrar|guardar|exportar|cerrar|ocultar|ver |ver$|descargar|calcular|editar|eliminar|copiar|compartir|limpiar|reiniciar|imprimir|\+|×|✕)/i;

export const AVISO_CALCULADORA =
  "Documento informativo generado por FINPATHIA con los datos ingresados. No es asesoría financiera, tributaria ni legal: las cifras son estimaciones que dependen de supuestos y de la norma vigente a la fecha, y cualquier decisión requiere la revisión de un experto.";

function textoDe(el) {
  if (el.tagName === "SELECT") return el.options[el.selectedIndex]?.text || "";
  const t = (el.type || "").toLowerCase();
  if (t === "checkbox" || t === "radio") return el.checked ? "Sí" : "No";
  return el.value ?? "";
}

// Hojas de estilo de la app, sin los bloques @media print (los de index.html
// están pensados para el simulador y esconden casillas y tarjetas).
function cssDeLaApp(doc) {
  const partes = [], enlaces = [];
  for (const hoja of Array.from(doc.styleSheets)) {
    let reglas;
    try { reglas = hoja.cssRules; } catch { if (hoja.href) enlaces.push(hoja.href); continue; }
    for (const r of Array.from(reglas || [])) {
      if (r.type === 4 /* MEDIA_RULE */ && /print/i.test(r.media?.mediaText || "")) continue;
      partes.push(r.cssText);
    }
  }
  return { css: partes.join("\n"), enlaces };
}

export function prepararCopia(original) {
  const copia = original.cloneNode(true);
  copia.querySelectorAll("[data-no-print]").forEach((n) => n.remove());

  // Casillas → texto, emparejadas por orden con las originales (cloneNode no
  // copia el valor que la persona escribió, solo el atributo inicial).
  const orig = original.querySelectorAll("input, select, textarea");
  const cop = copia.querySelectorAll("input, select, textarea");
  cop.forEach((c, i) => {
    const o = orig[i];
    if (!o || o.closest("[data-no-print]")) { c.remove(); return; }
    const t = (o.type || "").toLowerCase();
    if (t === "hidden" || t === "file") { c.remove(); return; }
    const span = c.ownerDocument.createElement("span");
    span.className = "fpc-valor";
    span.textContent = textoDe(o) || "—";
    c.replaceWith(span);
  });

  copia.querySelectorAll("button").forEach((b) => {
    const t = (b.textContent || "").trim();
    if (!t || ACCION.test(t)) { b.remove(); return; }
    const span = b.ownerDocument.createElement("span");
    span.setAttribute("style", b.getAttribute("style") || "");
    span.className = "fpc-opcion";
    span.innerHTML = b.innerHTML;
    b.replaceWith(span);
  });
  return copia;
}

export function exportarCalculadoraPDF(original, { titulo = "FINPATHIA", subtitulo = "" } = {}) {
  if (!original || typeof document === "undefined") return;
  const fecha = new Date().toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
  const { css, enlaces } = cssDeLaApp(document);
  const copia = prepararCopia(original);

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(iframe);
  const w = iframe.contentWindow, d = w.document;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  d.open();
  d.write(`<!DOCTYPE html><html lang="es" data-tema="claro"><head><meta charset="utf-8"><title>${esc(titulo)} · FINPATHIA · ${esc(fecha)}</title>
${enlaces.map((h) => `<link rel="stylesheet" href="${esc(h)}">`).join("\n")}
<style>${css}</style>
<style>
  @page { size: letter portrait; margin: 12mm; }
  html, body { background: #fff !important; margin: 0; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; animation: none !important; transition: none !important; }
  body { font-family: Inter, system-ui, sans-serif; color: #0a0a0a; }
  .fpc-hoja { width: 860px; margin: 0 auto; zoom: 0.83; }
  .fpc-cab { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #00a804; padding-bottom: 10px; margin-bottom: 20px; }
  .fpc-marca { font-weight: 700; font-size: 15px; color: #00a804; letter-spacing: .02em; }
  .fpc-tit { font-size: 22px; font-weight: 600; margin-top: 2px; }
  .fpc-sub { font-size: 13px; color: #5c5f66; margin-top: 2px; }
  .fpc-fecha { font-size: 12px; color: #5c5f66; text-align: right; }
  .fpc-valor { font-weight: 600; font-variant-numeric: tabular-nums; padding: 2px 0; display: inline-block; min-width: 1ch; }
  .fpc-opcion { cursor: default !important; }
  .fpc-aviso { margin-top: 24px; padding-top: 10px; border-top: 1px solid #ececee; font-size: 11px; color: #5c5f66; line-height: 1.5; }
  [style*="overflow"] { overflow: visible !important; max-height: none !important; }
  [style*="position: sticky"], [style*="position: fixed"] { position: static !important; }
  [style*="border-radius"], svg, table, tr { break-inside: avoid; page-break-inside: avoid; }
  h1, h2, h3 { break-after: avoid; }
</style></head><body><div class="fp-app" style="background:#fff;color:#0a0a0a"><div class="fpc-hoja">
  <div class="fpc-cab"><div><div class="fpc-marca">FINPATHIA</div><div class="fpc-tit">${esc(titulo)}</div>${subtitulo ? `<div class="fpc-sub">${esc(subtitulo)}</div>` : ""}</div><div class="fpc-fecha">${esc(fecha)}</div></div>
  <div id="fpc-cuerpo"></div>
  <div class="fpc-aviso">${esc(AVISO_CALCULADORA)}</div>
</div></div></body></html>`);
  d.close();
  d.getElementById("fpc-cuerpo").appendChild(d.importNode(copia, true));

  const imprimir = () => {
    try { w.focus(); w.print(); } finally { setTimeout(() => iframe.remove(), 1500); }
  };
  const listo = d.fonts?.ready ? d.fonts.ready : Promise.resolve();
  Promise.race([listo, new Promise((r) => setTimeout(r, 1500))]).then(() => setTimeout(imprimir, 150));
}
