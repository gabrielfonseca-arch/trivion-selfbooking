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

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await loginAs(page, "joao.gabriel@grupotrivion.com", "trivion123");

  // 1) Confirmar reunião: vai para self-bookings sem confirmação, abre o primeiro lead
  await page.goto(`${BASE}/self-bookings?filtro=sem_confirmacao`, { waitUntil: "networkidle" });
  const leadHref = await page.getAttribute("table tbody tr:first-child a", "href");
  console.log("Lead alvo:", leadHref);
  await page.goto(`${BASE}${leadHref}`, { waitUntil: "networkidle" });

  const beforeStatus = await page.locator("text=Aguardando confirmação, text=Agendado").first().isVisible().catch(() => false);
  console.log("Status antes (não confirmado visível):", beforeStatus);

  const confirmBtn = page.locator('button:has-text("Confirmar reunião")');
  if (await confirmBtn.count()) {
    await confirmBtn.click();
    await page.waitForLoadState("networkidle");
    const nowConfirmed = await page.locator("text=Confirmado").first().isVisible().catch(() => false);
    console.log(`${nowConfirmed ? "OK  " : "FAIL"} reunião passou para status Confirmado após clique`);
  } else {
    console.log("SKIP nenhum botão 'Confirmar reunião' disponível neste lead");
  }

  // 2) Registrar interação (observação)
  await page.locator('summary:has-text("Registrar interação")').click();
  const interactionDetails = page.locator('details:has(summary:has-text("Registrar interação"))');
  await interactionDetails.locator('input[name="type"]').fill("Teste automatizado");
  await interactionDetails.locator('textarea[name="note"]').fill("Teste automatizado: observação registrada via smoke test.");
  await interactionDetails.locator('button[type="submit"]').click();
  await page.waitForLoadState("networkidle");
  const timelineHasNote = await page.locator("text=Teste automatizado: observação registrada").first().isVisible().catch(() => false);
  console.log(`${timelineHasNote ? "OK  " : "FAIL"} interação registrada aparece na timeline`);

  // 3) No-show + recuperação: busca um lead com reunião em aberto para marcar no-show
  await page.goto(`${BASE}/self-bookings?filtro=confirmados`, { waitUntil: "networkidle" });
  const confirmedHref = await page.getAttribute("table tbody tr:first-child a", "href").catch(() => null);
  if (confirmedHref) {
    await page.goto(`${BASE}${confirmedHref}`, { waitUntil: "networkidle" });
    const noShowSummary = page.locator('summary:has-text("No-show")');
    if (await noShowSummary.count()) {
      await noShowSummary.click();
      const noShowDetails = page.locator('details:has(summary:has-text("No-show"))');
      await noShowDetails.locator('select[name="reason"]').selectOption("nao_respondeu");
      await noShowDetails.locator('button[type="submit"]').click();
      await page.waitForLoadState("networkidle");
      const noShowVisible = await page.locator("text=No-show").first().isVisible().catch(() => false);
      console.log(`${noShowVisible ? "OK  " : "FAIL"} status No-show registrado`);

      const recoveryBtn = page.locator('button:has-text("Registrar nova tentativa")');
      if (await recoveryBtn.count()) {
        await recoveryBtn.click();
        await page.waitForLoadState("networkidle");
        console.log("OK   tentativa de recuperação registrada");
        const recoveredBtn = page.locator('button:has-text("Marcar como recuperado")');
        if (await recoveredBtn.count()) {
          await recoveredBtn.click();
          await page.waitForLoadState("networkidle");
          const recoveredVisible = await page.locator("text=Recuperado").first().isVisible().catch(() => false);
          console.log(`${recoveredVisible ? "OK  " : "FAIL"} lead marcado como recuperado`);
        }
      }
    } else {
      console.log("SKIP sem botão de No-show disponível neste lead");
    }
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
