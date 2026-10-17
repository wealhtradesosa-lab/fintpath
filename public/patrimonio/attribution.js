/* Atribución de primer toque (/patrimonio). Script clásico y síncrono: corre en
   <head> ANTES de que cargue la app y antes de la recarga automática de 12 s
   (que reemplaza la URL y pierde la query). Guarda utm_* + fbclid + gclid en una
   cookie propia de primera parte por 30 días. Primer toque: si la cookie ya
   existe, no se pisa. No lee ni guarda datos personales. */
(function (w, d) {
  var KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "gclid"];
  var NAME = "fp_ft";
  try {
    if (d.cookie.indexOf(NAME + "=") !== -1) return;
    var q = w.location.search || "";
    var p = new URLSearchParams(q);
    var o = {};
    var n = 0;
    for (var i = 0; i < KEYS.length; i++) {
      var v = p.get(KEYS[i]);
      if (v) { o[KEYS[i]] = String(v).slice(0, 200); n++; }
    }
    if (!n) return;
    o.landing_path = w.location.pathname;
    o.ts = Date.now();
    d.cookie = NAME + "=" + encodeURIComponent(JSON.stringify(o)) +
      "; max-age=2592000; path=/; SameSite=Lax" + (w.location.protocol === "https:" ? "; Secure" : "");
  } catch (e) { /* nunca debe romper la página */ }
})(window, document);
