import { chromium } from "playwright";

const BASE = "http://localhost:3000";

async function loginAs(page, email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => location.pathname === "/dashboard", { timeout: 20000 });
  await page.waitForLoadState("networkidle");
}

async function checkPage(page, path, expectText) {
  const resp = await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  const status = resp?.status();
  const bodyText = await page.textContent("body");
  const hasError = bodyText.includes("Application error") || bodyText.includes("500") && bodyText.includes("Internal Server Error");
  const ok = status && status < 400 && !hasError;
  console.log(`${ok ? "OK  " : "FAIL"} ${path} (status ${status})${expectText ? (bodyText.includes(expectText) ? "" : ` — texto esperado ausente: "${expectText}"`) : ""}`);
  if (!ok) {
    console.log("  --- trecho do body ---");
    console.log("  " + bodyText.slice(0, 300).replace(/\s+/g, " "));
  }
  return ok;
}

async function main() {
  const browser = await chromium.launch();
  let allOk = true;

  // ---------------- SDR (João Gabriel) ----------------
  {
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginAs(page, "joao.gabriel@grupotrivion.com", "trivion123");
    console.log("\n== Login SDR OK ==");

    for (const [path, text] of [
      ["/dashboard", "Prioridade agora"],
      ["/self-bookings", "Self Bookings"],
      ["/agenda", "Agenda"],
      ["/tasks", "Minhas Tarefas"],
      ["/leads", "Leads"],
      ["/no-shows", "Controle de No-Show"],
      ["/performance", "Performance"],
      ["/scripts", "Scripts"],
    ]) {
      allOk = (await checkPage(page, path, text)) && allOk;
    }

    // tenta abrir o primeiro lead da lista e testar uma ação real (registrar interação)
    await page.goto(`${BASE}/leads`, { waitUntil: "networkidle" });
    const firstLeadHref = await page.getAttribute("table tbody tr:first-child a", "href").catch(() => null);
    if (firstLeadHref) {
      await page.goto(`${BASE}${firstLeadHref}`, { waitUntil: "networkidle" });
      const leadPageOk = (await page.textContent("body")).includes("Central de Ações do SDR");
      console.log(`${leadPageOk ? "OK  " : "FAIL"} ${firstLeadHref} (detalhe do lead)`);
      allOk = leadPageOk && allOk;

      // acessos indevidos: /settings deve ser bloqueado para SDR (redireciona para /)
      const settingsResp = await page.goto(`${BASE}/settings`, { waitUntil: "networkidle" });
      const finalUrl = page.url();
      const blocked = !finalUrl.endsWith("/settings");
      console.log(`${blocked ? "OK  " : "FAIL"} /settings bloqueado para SDR (redirecionou para ${finalUrl})`);
      allOk = blocked && allOk;
    } else {
      console.log("FAIL nenhum lead encontrado na listagem");
      allOk = false;
    }

    await context.close();
  }

  // ---------------- Admin ----------------
  {
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginAs(page, "admin@grupotrivion.com", "trivion123");
    console.log("\n== Login Admin OK ==");

    for (const [path, text] of [
      ["/dashboard", "Visão geral da operação"],
      ["/reports", "Relatório Semanal"],
      ["/settings", "Configurações"],
      ["/settings/users", "Usuários"],
      ["/settings/rules", "Regras de Self Booking"],
      ["/settings/risk-score", "Score de Risco"],
      ["/settings/cadence", "Cadência de Confirmação"],
      ["/settings/goals", "Metas"],
      ["/settings/integrations", "Integrações"],
    ]) {
      allOk = (await checkPage(page, path, text)) && allOk;
    }

    // testa o simulador de sincronização (novo self booking) end-to-end via clique real
    await page.goto(`${BASE}/settings/integrations`, { waitUntil: "networkidle" });
    const buttons = await page.locator('button:has-text("Novo Self Booking")').count();
    console.log(`${buttons > 0 ? "OK  " : "FAIL"} botões do simulador presentes (${buttons})`);
    if (buttons > 0) {
      await page.locator('button:has-text("Novo Self Booking")').first().click();
      await page.waitForLoadState("networkidle");
      console.log("OK   clique no simulador executado sem erro");
    }

    await context.close();
  }

  await browser.close();
  console.log(allOk ? "\n✅ SMOKE TEST: TODAS AS PÁGINAS OK" : "\n❌ SMOKE TEST: HÁ FALHAS ACIMA");
  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
