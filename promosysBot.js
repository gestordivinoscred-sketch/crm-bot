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

    // =========================
    // LOGIN
    // =========================
    console.log("🟡 Login...");

    await page.fill('input[placeholder="Digite seu nome de usuário"]', process.env.PROMOSYS_USER);
    await page.fill('input[placeholder="Digite sua senha"]', process.env.PROMOSYS_PASS);

    await page.click('text=Acessar o sistema');

    // =========================
    // FECHAR POPUP (RÁPIDO)
    // =========================
    console.log("🟡 Fechando popup...");

    await page.waitForTimeout(2000);

    await page.click('text=×').catch(() => {});
    await page.click('[class*="close"]').catch(() => {});

    await page.waitForTimeout(1000);

    console.log("🟢 Popup fechado");

    // =========================
    // VALIDAÇÃO (URL)
    // =========================
    await page.waitForURL('**/consulta/**', { timeout: 10000 });

    console.log("🟢 LOGIN OK");

    // =========================
    // ESCOLHER CONVÊNIO
    // =========================
    console.log("🔵 Selecionando INSS...");

    await page.click('text=INSS');

    await page.waitForTimeout(2000);

    // =========================
    // BUSCA CPF
    // =========================
    console.log("🟡 Buscando CPF...");

    await page.fill('#cpf', cpf);
    await page.click('input[value="cpf"]');

    await page.click('button:has-text("Consultar")');

    // ⏱️ espera resultado (ESSENCIAL)
    await page.waitForTimeout(15000);

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
