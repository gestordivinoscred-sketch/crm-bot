const { chromium } = require('playwright');

async function consultarPromosys(cpf) {

  const browser = await chromium.launch({
    headless: true
  });

  const page = await browser.newPage();

  try {

    console.log("🔵 Abrindo sistema...");

    await page.goto('https://sistemapromosys.com.br/', {
      waitUntil: 'networkidle'
    });

    await page.screenshot({ path: "01-inicial.png", fullPage: true });

    // =========================
    // LOGIN (GENÉRICO E FORTE)
    // =========================
    console.log("🟡 Preenchendo login...");

    await page.waitForSelector('input[type="text"]', { timeout: 15000 });
    await page.waitForSelector('input[type="password"]', { timeout: 15000 });

    await page.fill('input[type="text"]', process.env.PROMOSYS_USER);
    await page.fill('input[type="password"]', process.env.PROMOSYS_PASS);

    await page.waitForTimeout(2000);

    console.log("🟠 Clicando em acessar...");

    await page.click('text=Acessar o sistema');

    await page.screenshot({ path: "02-pos-login.png", fullPage: true });

    // =========================
    // VALIDA LOGIN
    // =========================
    await page.waitForSelector('text=ATENDIMENTO', { timeout: 15000 });

    console.log("🟢 LOGIN OK");

    await page.screenshot({ path: "03-logado.png", fullPage: true });

    await page.waitForTimeout(2000);

    // popup (se tiver)
    await page.click('button:has-text("Fechar")').catch(() => {});

    // =========================
    // NAVEGAÇÃO
    // =========================
    console.log("🔵 Indo para consulta...");

    await page.click('text=ATENDIMENTO');
    await page.click('text=INSS');
    await page.click('text=Consulta INSS');

    await page.screenshot({ path: "04-consulta.png", fullPage: true });

    // =========================
    // BUSCA CPF
    // =========================
    console.log("🟡 Buscando CPF...");

    await page.fill('#cpf', cpf);
    await page.click('input[value="cpf"]');

    await page.click('button:has-text("Consultar")');

    // espera carregar resultado
    await page.waitForTimeout(15000);

    await page.screenshot({ path: "05-resultado.png", fullPage: true });

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
