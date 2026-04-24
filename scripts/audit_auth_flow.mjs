import { chromium } from "playwright";

const URL = "https://finpathia.com/";
const TEST_EMAIL = `test${Date.now()}@finpathia-audit.com`;
const TEST_PASSWORD = "Test1234!";
const TEST_NAME = "Audit Bot";

console.log(`\n🔬 AUDIT LOGIN/LOGOUT — ${URL}\n`);
console.log(`Email de prueba: ${TEST_EMAIL}`);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();

const errors = [];
const consoleMsgs = [];
page.on("pageerror", e => errors.push({ where: phase, msg: e.message }));
page.on("console", m => { if (m.type() === "error") consoleMsgs.push({ where: phase, text: m.text().slice(0, 200) }); });

let phase = "init";

async function step(label, fn) {
  phase = label;
  console.log(`\n━━ ${label}`);
  const before = errors.length;
  try { await fn(); } catch (e) { console.log(`  ✗ ${e.message.slice(0, 150)}`); }
  const news = errors.slice(before);
  if (news.length) news.forEach(e => console.log(`  🔴 ${e.msg}`));
}

await step("1. Cargar landing", async () => {
  await page.goto(URL, { waitUntil: "networkidle", timeout: 15000 });
  await page.waitForTimeout(2000);
});

await step("2. Click 'Iniciar Sesión'", async () => {
  await page.getByText("Iniciar Sesión").first().click();
  await page.waitForTimeout(1500);
  const inputs = await page.locator("input").count();
  console.log(`  Inputs visibles: ${inputs}`);
});

await step("3. Cambiar a modo registro", async () => {
  // Busca link/botón de "Registrate" / "Crear cuenta"
  for (const label of ["Crear cuenta", "Registrate", "Registrarse", "Regístrate", "Crea tu cuenta"]) {
    const c = await page.getByText(label, { exact: false }).count();
    if (c > 0) {
      console.log(`  Encontrado: "${label}" (${c})`);
      await page.getByText(label, { exact: false }).first().click();
      await page.waitForTimeout(1000);
      break;
    }
  }
});

await step("4. Llenar formulario de registro", async () => {
  const nameFields = await page.locator('input[type="text"]').count();
  console.log(`  Campos texto: ${nameFields}`);
  if (nameFields > 0) await page.locator('input[type="text"]').first().fill(TEST_NAME);
  await page.locator('input[type="email"]').first().fill(TEST_EMAIL);
  await page.locator('input[type="password"]').first().fill(TEST_PASSWORD);
  await page.waitForTimeout(500);
});

await step("5. Submit registro", async () => {
  // Busca botón de crear/registrar
  for (const label of ["Crear cuenta", "Registrate", "Registrar", "Continuar"]) {
    const btn = page.getByRole("button", { name: new RegExp(label, "i") });
    const c = await btn.count();
    if (c > 0) {
      await btn.first().click();
      await page.waitForTimeout(4000);
      break;
    }
  }
  const bodyTxt = await page.evaluate(() => document.body.innerText.slice(0, 300));
  console.log(`  Post-submit: ${bodyTxt.replace(/\n/g, " | ").slice(0, 200)}`);
});

await step("6. ¿Entró al dashboard?", async () => {
  const dashText = await page.evaluate(() => {
    return {
      body: document.body.innerText.slice(0, 500),
      url: location.href,
      // Buscar elementos del sidebar
      sidebarBtns: Array.from(document.querySelectorAll("aside button, nav button")).map(b => b.innerText.slice(0, 40)).filter(Boolean).slice(0, 20),
    };
  });
  console.log(`  URL: ${dashText.url}`);
  console.log(`  Body snippet: ${dashText.body.replace(/\n/g, " | ").slice(0, 200)}`);
  console.log(`  Botones sidebar (${dashText.sidebarBtns.length}): ${dashText.sidebarBtns.join(" | ")}`);
});

await step("7. BUSCAR botón 'Cerrar sesión'", async () => {
  const variants = ["Cerrar sesión", "🚪 Cerrar sesión", "Logout", "Salir"];
  for (const v of variants) {
    const c = await page.getByText(v, { exact: false }).count();
    console.log(`  "${v}": ${c} ocurrencias`);
    if (c > 0) {
      // Ver si es clickeable
      const el = page.getByText(v, { exact: false }).first();
      const box = await el.boundingBox();
      console.log(`    Visible: ${box ? `sí (${Math.round(box.x)},${Math.round(box.y)}, ${Math.round(box.width)}x${Math.round(box.height)})` : "NO (posiblemente oculto)"}`);
    }
  }
});

await step("8. CLICK en 'Cerrar sesión'", async () => {
  const btn = page.getByText("Cerrar sesión", { exact: false }).first();
  const c = await page.getByText("Cerrar sesión", { exact: false }).count();
  if (c === 0) {
    console.log("  ✗ No se encontró botón 'Cerrar sesión'");
    return;
  }
  const box = await btn.boundingBox();
  if (!box) {
    console.log("  ✗ Botón encontrado pero NO VISIBLE (boundingBox nulo)");
    // Intentar scroll y check de nuevo
    await btn.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(500);
    const box2 = await btn.boundingBox();
    console.log(`  Reintento bounding: ${box2 ? "ahora visible" : "sigue oculto"}`);
  }
  try {
    await btn.click({ force: true, timeout: 5000 });
    await page.waitForTimeout(3000);
    const bodyAfter = await page.evaluate(() => document.body.innerText.slice(0, 300));
    console.log(`  Post-logout body: ${bodyAfter.replace(/\n/g, " | ").slice(0, 200)}`);
  } catch (e) {
    console.log(`  ✗ Click falló: ${e.message.slice(0, 150)}`);
  }
});

console.log(`\n\n═══ RESUMEN ═══`);
console.log(`Errores pageerror total: ${errors.length}`);
console.log(`Console errors: ${consoleMsgs.length}`);
if (errors.length) errors.forEach(e => console.log(`  [${e.where}] ${e.msg}`));
if (consoleMsgs.length) consoleMsgs.slice(0, 10).forEach(c => console.log(`  [${c.where}] ${c.text}`));

await browser.close();
