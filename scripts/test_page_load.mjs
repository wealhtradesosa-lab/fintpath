import { chromium } from "playwright";

const URL = process.argv[2] || "http://localhost:4173/";
const TIMEOUT_MS = 15000;

console.log(`\n🔬 Testeando carga de: ${URL}\n`);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

const consoleMessages = [];
const pageErrors = [];
const failedRequests = [];

page.on("console", msg => {
  consoleMessages.push({ type: msg.type(), text: msg.text() });
});
page.on("pageerror", err => {
  pageErrors.push({ message: err.message, stack: err.stack });
});
page.on("requestfailed", req => {
  failedRequests.push({ url: req.url(), failure: req.failure()?.errorText });
});

try {
  await page.goto(URL, { waitUntil: "networkidle", timeout: TIMEOUT_MS });
  console.log("✓ page.goto completó");
} catch (e) {
  console.log("✗ page.goto TIMEOUT o error:", e.message);
}

// Esperar a ver qué hay en pantalla
await page.waitForTimeout(5000);

// Evaluar contenido visible
const content = await page.evaluate(() => {
  return {
    title: document.title,
    bodyText: document.body?.innerText?.slice(0, 500) || "",
    rootHTML: document.getElementById("root")?.innerHTML?.slice(0, 500) || "(sin #root)",
    url: location.href,
  };
});

console.log("\n📄 CONTENIDO VISIBLE:");
console.log("  title:", content.title);
console.log("  body:", content.bodyText.replace(/\n/g, " | "));
console.log("  #root primeros 500 chars:", content.rootHTML.slice(0, 300));

console.log("\n📝 CONSOLE MESSAGES:");
if (consoleMessages.length === 0) console.log("  (ninguno)");
for (const m of consoleMessages.slice(0, 20)) {
  console.log(`  [${m.type}] ${m.text.slice(0, 200)}`);
}

console.log("\n🔴 PAGE ERRORS:");
if (pageErrors.length === 0) console.log("  ✅ ninguno");
for (const e of pageErrors) {
  console.log(`  ${e.message}`);
  if (e.stack) console.log(`    ${e.stack.split("\n").slice(0, 3).join("\n    ")}`);
}

console.log("\n🌐 FAILED REQUESTS:");
if (failedRequests.length === 0) console.log("  ✅ ninguno");
for (const r of failedRequests) console.log(`  ${r.url} — ${r.failure}`);

await browser.close();
process.exit(pageErrors.length > 0 ? 1 : 0);
