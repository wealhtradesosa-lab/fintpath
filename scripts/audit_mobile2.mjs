import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)" });
const page = await context.newPage();
const TEST_EMAIL = `test${Date.now()}@audit.com`;

await page.goto("https://finpathia.com/", { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
await page.getByText("Iniciar Sesión").first().click();
await page.waitForTimeout(1500);
await page.getByText("Regístrate", { exact: false }).first().click();
await page.waitForTimeout(1000);
await page.locator('input[type="text"]').first().fill("Mobile T");
await page.locator('input[type="email"]').first().fill(TEST_EMAIL);
await page.locator('input[type="password"]').first().fill("Test1234!");
await page.getByRole("button", { name: /Crear cuenta|Registr/i }).first().click();
await page.waitForTimeout(4000);

console.log("1. ENTRÓ al dashboard en mobile");

// Click en hamburguesa
const hamburger = page.getByText("☰").first();
const hc = await page.getByText("☰").count();
console.log("2. Botón ☰ encontrado:", hc);
if (hc > 0) {
  await hamburger.click();
  await page.waitForTimeout(1500);
  const after = await page.evaluate(() => {
    const findLogout = () => {
      const all = Array.from(document.querySelectorAll("button, a"));
      return all.filter(b => /cerrar sesi|logout|salir/i.test(b.innerText));
    };
    const logs = findLogout();
    return {
      sidebarExists: !!document.querySelector("aside"),
      sidebarVisible: document.querySelector("aside") ? !!document.querySelector("aside").offsetParent : false,
      logoutCount: logs.length,
      logoutVisible: logs.map(l => ({ text: l.innerText.slice(0,40), visible: !!(l.offsetParent !== null) })),
    };
  });
  console.log("3. Post-click en ☰:", JSON.stringify(after, null, 2));
}

await browser.close();
