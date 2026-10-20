// FINPATHIA · Enlaces de la secuencia de prueba con UTMs.
// Todo enlace de estos correos lleva:
//   utm_source=email&utm_medium=lifecycle&utm_campaign=fp_trial_d{N}&utm_content={variante}
export const BASE_APP = "https://finpathia.com";

export function conUtm(url, { paso, utmContent }) {
  const u = new URL(url, BASE_APP);
  u.searchParams.set("utm_source", "email");
  u.searchParams.set("utm_medium", "lifecycle");
  u.searchParams.set("utm_campaign", `fp_trial_${paso}`);
  if (utmContent) u.searchParams.set("utm_content", utmContent);
  return u.toString();
}

// Destinos de los botones. `ir` lo lee App.jsx al cargar y abre esa sección.
export const DESTINOS = {
  nivel: "/?ir=dash",
  simulador: "/?ir=sim",
  patrimonio: "/?ir=inv",
  planes: "/?ir=price",
};
