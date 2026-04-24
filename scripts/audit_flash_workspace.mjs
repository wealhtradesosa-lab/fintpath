// audit_flash_workspace.mjs — Reproduce el escenario donde un usuario
// que es AMBAS cosas (asesor + cliente) intenta entrar como cliente.
// El bug (resuelto en commit 4332cea) hacía que se viera AdvisorWorkspace
// por 500ms-2s antes del dashboard cliente.
//
// Para usar este test, necesitás un usuario en producción que esté en:
//   1. supabase auth (registrado)
//   2. tabla advisors (marcado como asesor)
//
// Usage:
//   TEST_EMAIL=... TEST_PASSWORD=... node scripts/audit_flash_workspace.mjs
//
// Opcionalmente crea tu propio usuario de prueba con:
//   1. Registrarlo desde la UI
//   2. INSERT INTO advisors (id, email, advisor_plan, subscription_status) VALUES ...;
//   3. Correr este script
//   4. DELETE FROM advisors WHERE id = ...; (cleanup)

import { chromium } from "playwright";
const URL = process.env.URL || "https://finpathia.com/";
const EMAIL = process.env.TEST_EMAIL;
const PASSWORD = process.env.TEST_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.log("Uso: TEST_EMAIL=... TEST_PASSWORD=... node scripts/audit_flash_workspace.mjs");
  process.exit(1);
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const pageErrors = [];
page.on("pageerror", e => pageErrors.push(e.message));

console.log("🔬 TEST: Login CLIENTE con cuenta advisor+cliente");
console.log("URL:", URL, " | Email:", EMAIL);

await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForTimeout(5000);
await page.getByText("Iniciar Sesión").first().click();
await page.waitForTimeout(1500);
await page.locator('input[type="email"]').first().fill(EMAIL);
await page.locator('input[type="password"]').first().fill(PASSWORD);

const snapshots = [];
const startT = Date.now();
const intervalId = setInterval(async () => {
  try {
    const s = await page.evaluate(() => {
      const body = document.body.innerText.slice(0, 400);
      return {
        isWorkspace: body.includes("Mis clientes") || body.includes("Workspace") || body.includes("tus clientes"),
        isClientDash: body.includes("Dashboard") && body.includes("Ingresos") && body.includes("Patrimonio"),
        isLanding: body.includes("Iniciar Sesión") && body.includes("14 días gratis"),
      };
    });
    snapshots.push({ t: Date.now() - startT, ...s });
  } catch {}
}, 100);

await page.locator('button:has-text("Ingresar")').last().click();
await page.waitForTimeout(6000);
clearInterval(intervalId);

let firstWorkspace = -1, firstClientDash = -1;
snapshots.forEach(s => {
  if (s.isWorkspace && firstWorkspace === -1) firstWorkspace = s.t;
  if (s.isClientDash && firstClientDash === -1) firstClientDash = s.t;
});

console.log("\n═══ RESULTADO ═══");
console.log("Primer WorkspaceAsesor:", firstWorkspace === -1 ? "NUNCA ✅" : `t+${firstWorkspace}ms 🚨`);
console.log("Primer DashboardCliente:", firstClientDash === -1 ? "NUNCA 🚨" : `t+${firstClientDash}ms ✅`);
console.log("pageErrors:", pageErrors.length);
const flashReal = firstWorkspace !== -1 && (firstClientDash === -1 || firstWorkspace < firstClientDash);
console.log("\n🎯 FLASH:", flashReal ? "🚨 SÍ (bug presente)" : "✅ NO (fix funciona)");

await browser.close();
process.exit(flashReal || pageErrors.length > 0 ? 1 : 0);
