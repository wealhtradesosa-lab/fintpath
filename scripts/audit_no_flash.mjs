import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();

const TEST_EMAIL = `audit${Date.now()}@finpathia-test.com`;
const PASSWORD = "Test1234!";

console.log("🔬 TEST: Flash de AdvisorWorkspace en login como cliente");
console.log("Email:", TEST_EMAIL);

// Registrar cuenta de prueba
await page.goto("https://finpathia.com/", { waitUntil: "load", timeout: 60000 });
await page.waitForTimeout(2000);
await page.getByText("Iniciar Sesión").first().click();
await page.waitForTimeout(1000);
await page.getByText("Regístrate", { exact: false }).first().click();
await page.waitForTimeout(1000);
await page.locator('input[type="text"]').first().fill("Audit Bot");
await page.locator('input[type="email"]').first().fill(TEST_EMAIL);
await page.locator('input[type="password"]').first().fill(PASSWORD);

// Capturar snapshots durante login
const snapshots = [];
const captureEvery = async (ms, count) => {
  for (let i = 0; i < count; i++) {
    await page.waitForTimeout(ms);
    const s = await page.evaluate(() => {
      const body = document.body.innerText.slice(0, 200).replace(/\n/g, " | ");
      return {
        t: Date.now(),
        hasAdvisorHeader: body.includes("Viendo como asesor") || body.includes("mis clientes") || body.includes("Workspace"),
        hasPersonalDash: body.includes("Dashboard") && (body.includes("Ingresos") || body.includes("Patrimonio")),
        bodyStart: body.slice(0, 100),
      };
    });
    snapshots.push(s);
  }
};

// Click submit, capturar snapshots cada 100ms durante 5s
await page.getByRole("button", { name: /Crear cuenta|Registr/i }).first().click();
await captureEvery(150, 30); // 30 snapshots x 150ms = 4.5s

console.log("\n📸 Snapshots post-submit (cada 150ms):");
snapshots.forEach((s, i) => {
  const flags = [];
  if (s.hasAdvisorHeader) flags.push("🚨 FLASH ASESOR");
  if (s.hasPersonalDash) flags.push("✓ Dashboard Cliente");
  console.log(`  t+${(i+1)*150}ms: ${flags.join(" | ") || "(cargando)"} | ${s.bodyStart.slice(0, 50)}`);
});

const flashDetected = snapshots.some(s => s.hasAdvisorHeader);
const personalReached = snapshots.some(s => s.hasPersonalDash);

console.log("\n═══ RESULTADO ═══");
console.log("Flash de asesor detectado:", flashDetected ? "🚨 SÍ (bug persiste)" : "✅ NO (fix funciona)");
console.log("Dashboard personal alcanzado:", personalReached ? "✅ SÍ" : "🚨 NO");

await browser.close();
