import { chromium } from "playwright";

const URL = process.argv[2] || "https://finpathia.com/";
const EMAIL = process.env.TEST_EMAIL || "santiagososa1@me.com";
const PASSWORD = process.env.TEST_PASSWORD || "";

console.log(`\n🔬 AUDITORÍA COMPLETA de ${URL}\n`);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

const allErrors = [];
const allConsole = [];
page.on("pageerror", err => allErrors.push({ phase: "current", message: err.message, stack: err.stack?.split("\n").slice(0, 4).join(" | ") }));
page.on("console", msg => { if (msg.type() === "error" || msg.type() === "warning") allConsole.push({ type: msg.type(), text: msg.text().slice(0, 200) }); });

async function log(label, fn) {
  console.log(`\n━━━ ${label} ━━━`);
  const before = allErrors.length;
  try { await fn(); } catch (e) { console.log("  ✗ excepción:", e.message); }
  const newErrors = allErrors.slice(before);
  if (newErrors.length) {
    console.log(`  🔴 ${newErrors.length} error(es) durante esta fase:`);
    newErrors.forEach(e => { e.phase = label; console.log(`    ${e.message}`); });
  } else console.log("  ✅ sin errores");
}

// ═══ FASE 1: Carga inicial (landing) ═══
await log("Fase 1: Carga inicial", async () => {
  await page.goto(URL, { waitUntil: "networkidle", timeout: 15000 });
  await page.waitForTimeout(2000);
  const content = await page.evaluate(() => ({
    visible: document.body.innerText.slice(0, 200),
    hasLoading: document.body.innerText.includes("Cargando"),
    url: location.href,
  }));
  console.log("  URL:", content.url);
  console.log("  Visible:", content.visible.replace(/\n/g, " | ").slice(0, 150));
  console.log("  Aún cargando:", content.hasLoading);
});

// ═══ FASE 2: Buscar botón "Iniciar Sesión" ═══
await log("Fase 2: Abrir modal de login", async () => {
  const loginBtn = await page.getByText("Iniciar Sesión").first();
  const count = await page.getByText("Iniciar Sesión").count();
  console.log(`  Botones 'Iniciar Sesión': ${count}`);
  if (count > 0) {
    await loginBtn.click();
    await page.waitForTimeout(1500);
    const hasEmailInput = await page.locator('input[type="email"]').count();
    console.log(`  Input email tras click: ${hasEmailInput}`);
  }
});

// ═══ FASE 3: Intentar login ═══
if (PASSWORD) {
  await log("Fase 3: Login con credenciales", async () => {
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button:has-text("Iniciar sesión")');
    await page.waitForTimeout(4000);
    const text = await page.evaluate(() => document.body.innerText.slice(0, 300));
    console.log("  Post-login body:", text.replace(/\n/g, " | ").slice(0, 200));
  });

  // ═══ FASE 4: Buscar logout ═══
  await log("Fase 4: Buscar botón de logout/cerrar sesión", async () => {
    const searches = ["Cerrar sesión", "Logout", "Sign out", "Salir"];
    for (const s of searches) {
      const c = await page.getByText(s, { exact: false }).count();
      console.log(`  '${s}' → ${c} ocurrencias`);
    }
    // Buscar también iconos típicos de menú/sidebar
    const settingsCount = await page.locator('[title*="Cerrar" i], [title*="logout" i], [title*="salir" i]').count();
    console.log(`  Elementos con title de cerrar: ${settingsCount}`);
  });
}

// ═══ RESUMEN FINAL ═══
console.log("\n\n═══ RESUMEN AUDITORÍA ═══");
console.log(`Total pageerror: ${allErrors.length}`);
console.log(`Total console warnings/errors: ${allConsole.length}`);

if (allErrors.length) {
  console.log("\n🔴 ERRORES DETECTADOS:");
  allErrors.forEach(e => console.log(`  [${e.phase}] ${e.message}\n    ${e.stack || ""}`));
}
if (allConsole.length) {
  console.log("\n⚠ CONSOLE:");
  allConsole.slice(0, 10).forEach(c => console.log(`  [${c.type}] ${c.text}`));
}

await browser.close();
