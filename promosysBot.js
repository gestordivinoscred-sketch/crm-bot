const { chromium } = require('playwright');

async function consultarPromosys(cpf) {

  const browser = await chromium.launch({
    headless: true
  });

  const page = await browser.newPage();

  try {

    console.log("🔵 Abrindo sistema...");

    await page.goto('https://sistemapromosys.com.br/', {
      waitUntil: 'domcontentloaded'
    });

    await page.screenshot({ path: "01-inicial.png", fullPage: true });

    // =========================
    // LOGIN (RÁPIDO)
    // =========================
    console.log("🟡 Login...");

    await page.fill('input[placeholder="Digite seu nome de usuário"]', process.env.PROMOSYS_USER);
    await page.fill('input[placeholder="Digite sua senha"]', process.env.PROMOSYS_PASS);

    await page.click('text=Acessar o sistema');

    await page.screenshot({ path: "02-pos-login.png", fullPage: true });

    // =========================
    // FECHAR POPUP (X REAL)
    // =========================
    console.log("🟡 Fechando popup...");

    await page.waitForTimeout(3000);

    // botão X (principal)
    await page.click('button:has-text("×")').catch(() => {});
    await page.click('text=×').catch(() => {});
    await page.locator('[class*="close"]').click().catch(() => {});

    await page.waitForTimeout(2000);

    await page.screenshot({ path: "03-pos-popup.png", fullPage: true });

    console.log("🟢 Popup tratado");

    // =========================
    // VALIDA LOGIN
    // =========================
    await page.waitForSelector('text=ATENDIMENTO', { timeout: 10000 });

    console.log("🟢 LOGIN OK");

    await page.screenshot({ path: "04-logado.png", fullPage: true });

    // =========================
    // NAVEGAÇÃO
    // =========================
    console.log("🔵 Indo para consulta...");

    await page.click('text=ATENDIMENTO');
    await page.click('text=INSS');
    await page.click('text=Consulta INSS');

    await page.screenshot({ path: "05-consulta.png", fullPage: true });

    // =========================
    // BUSCA CPF
    // =========================
    console.log("🟡 Buscando CPF...");

    await page.fill('#cpf', cpf);
    await page.click('input[value="cpf"]');

    await page.click('button:has-text("Consultar")');

    // ⏱️ mantém delay aqui (importante)
    await page.waitForTimeout(15000);

    await page.screenshot({ path: "06-resultado.png", fullPage: true });

    // =========================
    // CAPTURA MARGEM
    // =========================
    console.log("🟠 Capturando margem...");

    const margem = await page.textContent('#margem').catch(() => null);

    await browser.close();

    if (!margem) {
      console.log("⚠️ Margem não encontrada");
      return 0;
    }

    console.log("✅ Margem encontrada:", margem);

    return margem;

  } catch (err) {

    await browser.close();

    console.log("❌ ERRO NO BOT:", err.message);

    return 0;
  }
}

module.exports = { consultarPromosys };
