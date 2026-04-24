import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)" });
const page = await context.newPage();
const TEST_EMAIL = `test${Date.now()}@audit.com`;

const errors = [];
page.on("pageerror", e => errors.push(e.message));

await page.goto("https://finpathia.com/", { waitUntil: "networkidle" });
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
console.log("✓ Logueado en mobile");

// Abrir sidebar con hamburger
await page.getByText("☰").first().click();
await page.waitForTimeout(1500);
const sidebarInfo = await page.evaluate(() => {
  const aside = document.querySelector("aside");
  if (!aside) return { exists: false };
  const rect = aside.getBoundingClientRect();
  const cs = window.getComputedStyle(aside);
  return {
    exists: true,
    rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
    position: cs.position, zIndex: cs.zIndex, display: cs.display, transform: cs.transform, left: cs.left,
    inViewport: rect.x < 390 && rect.x + rect.width > 0,
  };
});
console.log("Sidebar después de ☰:", JSON.stringify(sidebarInfo, null, 2));

const logoutBtn = page.getByText("Cerrar sesión", { exact: false }).first();
const c = await page.getByText("Cerrar sesión", { exact: false }).count();
console.log("Logout found:", c);

if (c > 0) {
  const btnInfo = await logoutBtn.evaluate(el => {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), visible: !!el.offsetParent };
  });
  console.log("Logout btn info:", btnInfo);

  // Intentar click sin force
  try {
    await logoutBtn.click({ timeout: 3000 });
    await page.waitForTimeout(3000);
    const after = await page.evaluate(() => document.body.innerText.slice(0, 200));
    console.log("Post-logout:", after.replace(/\n/g, " | ").slice(0, 180));
  } catch (e) {
    console.log("Click falló:", e.message.slice(0, 100));
    console.log("Intentando force click...");
    await logoutBtn.click({ force: true });
    await page.waitForTimeout(3000);
    const after = await page.evaluate(() => document.body.innerText.slice(0, 200));
    console.log("Post-force-click:", after.replace(/\n/g, " | ").slice(0, 180));
  }
}

if (errors.length) {
  console.log("\n🔴 ERRORES:");
  errors.forEach(e => console.log("  ", e));
}

await browser.close();
