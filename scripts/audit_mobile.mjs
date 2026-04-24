import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
// iPhone 13 viewport
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)" });
const page = await context.newPage();
const TEST_EMAIL = `test${Date.now()}@audit.com`;
console.log("Mobile viewport 390x844, email:", TEST_EMAIL);

await page.goto("https://finpathia.com/", { waitUntil: "networkidle" });
await page.waitForTimeout(2000);

// Register
await page.getByText("Iniciar Sesión").first().click();
await page.waitForTimeout(1500);
await page.getByText("Regístrate", { exact: false }).first().click();
await page.waitForTimeout(1000);
await page.locator('input[type="text"]').first().fill("Mobile Test");
await page.locator('input[type="email"]').first().fill(TEST_EMAIL);
await page.locator('input[type="password"]').first().fill("Test1234!");
await page.getByRole("button", { name: /Crear cuenta|Registr/i }).first().click();
await page.waitForTimeout(4000);

const state = await page.evaluate(() => {
  const findLogout = () => {
    const all = Array.from(document.querySelectorAll("button, a"));
    return all.filter(b => /cerrar sesi|logout|salir/i.test(b.innerText)).map(b => ({
      text: b.innerText.slice(0, 50),
      visible: !!(b.offsetParent !== null && b.getClientRects().length),
      rect: b.getBoundingClientRect(),
    }));
  };
  return {
    bodyStart: document.body.innerText.slice(0, 300),
    logoutElements: findLogout(),
    sidebar: {
      exists: !!document.querySelector("aside"),
      visible: document.querySelector("aside") ? !!document.querySelector("aside").offsetParent : false,
    },
    buttonsWithEmoji: Array.from(document.querySelectorAll("button")).filter(b => /🚪|☰|⚙|👤/.test(b.innerText)).map(b => b.innerText.slice(0, 30)),
  };
});

console.log("\n📱 ESTADO MÓVIL POST-LOGIN:");
console.log("Body:", state.bodyStart.replace(/\n/g, " | ").slice(0, 200));
console.log("\n🚪 Elementos logout encontrados:", state.logoutElements.length);
state.logoutElements.forEach(e => console.log("  text:", e.text, "| visible:", e.visible, "| rect:", e.rect.width + "x" + e.rect.height, "pos", Math.round(e.rect.x) + "," + Math.round(e.rect.y)));
console.log("\n📐 Sidebar:", state.sidebar);
console.log("\n🔘 Botones con ícono navegación:", state.buttonsWithEmoji);

await browser.close();
