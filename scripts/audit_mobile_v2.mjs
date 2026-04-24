import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)" });
const page = await context.newPage();
const TEST_EMAIL = `test${Date.now()}@audit.com`;
const errors = [];
page.on("pageerror", e => errors.push(e.message));

console.log("📱 MOBILE AUDIT — iPhone 390x844");
console.log("Email test:", TEST_EMAIL);

// Registrar
await page.goto("https://finpathia.com/", { waitUntil: "load", timeout: 60000 });
await page.waitForTimeout(2000);
await page.getByText("Iniciar Sesión").first().click();
await page.waitForTimeout(1500);
await page.getByText("Regístrate", { exact: false }).first().click();
await page.waitForTimeout(1000);
await page.locator('input[type="text"]').first().fill("Mobile Test");
await page.locator('input[type="email"]').first().fill(TEST_EMAIL);
await page.locator('input[type="password"]').first().fill("Test1234!");
await page.getByRole("button", { name: /Crear cuenta|Registr/i }).first().click();
await page.waitForTimeout(4000);
console.log("✓ 1. Registrado en mobile");

// Buscar el NUEVO botón 🚪 en el header (sin abrir sidebar)
const headerLogout = await page.evaluate(() => {
  // Buscar botones que sean 🚪 solo (el del header)
  const btns = Array.from(document.querySelectorAll('button'));
  const candidates = btns.filter(b => {
    const txt = b.innerText.trim();
    return txt === "🚪" || txt.startsWith("🚪 ") || txt === "🚪 Cerrar sesión";
  });
  return candidates.map(b => {
    const r = b.getBoundingClientRect();
    const parent = b.closest('header') ? 'header' : (b.closest('aside') ? 'aside' : 'otro');
    return {
      text: b.innerText.trim().slice(0, 40),
      parent,
      visible: !!(b.offsetParent !== null),
      rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      inViewport: r.x >= 0 && r.x < 390 && r.y >= 0 && r.y < 844,
    };
  });
});
console.log("\n🚪 Botones de logout encontrados SIN abrir sidebar:");
headerLogout.forEach(b => console.log("  ", JSON.stringify(b)));

// Click en el botón del header (el que es "🚪" solo)
const headerBtn = headerLogout.find(b => b.parent === 'header' && b.visible && b.inViewport);
if (headerBtn) {
  console.log("\n✓ 2. Botón 🚪 encontrado EN HEADER, visible en viewport");
  // Click
  await page.locator('header button[title*="Cerrar" i]').first().click();
  await page.waitForTimeout(3000);
  const after = await page.evaluate(() => ({
    body: document.body.innerText.slice(0, 200),
    url: location.href,
    localStorage: Object.keys(localStorage).filter(k => k.startsWith('fp3') || k.startsWith('sb-')),
  }));
  console.log("\n✓ 3. Post-logout:");
  console.log("    body:", after.body.replace(/\n/g, " | ").slice(0, 150));
  console.log("    localStorage fp3/sb-:", after.localStorage.length, "keys restantes (esperado: 0)");
  if (after.localStorage.length > 0) console.log("    keys:", after.localStorage);
} else {
  console.log("✗ NO hay botón 🚪 en el header visible");
}

console.log("\n═══ RESUMEN MOBILE ═══");
console.log("Errores:", errors.length);
errors.forEach(e => console.log("  🔴", e));
await browser.close();
