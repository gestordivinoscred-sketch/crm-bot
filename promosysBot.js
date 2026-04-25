const { chromium } = require('playwright');

async function esperar(page, selector, tempo) {
  try {
    await page.waitForSelector(selector, { timeout: tempo });
  } catch {
    console.log(`⚠️ Timeout em: ${selector}`);
  }
}

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

    await esperar(page, 'input[placeholder="Digite seu nome de usuário"]', 5000);

    await page.fill(
      'input[placeholder="Digite seu nome de usuário"]',
      process.env.PROMOSYS_USER
    );

    await page.fill(
      'input[placeholder="Digite sua senha"]',
      process.env.PROMOSYS_PASS
    );

    await page.click('text=Acessar o sistema');

    await page.waitForURL('**/consulta/**', { timeout: 8000 });

    // =========================
    // POPUP
    // =========================
    console.log("🟡 Fechando popup...");

    await page.click('text=×').catch(() => {});
    await page.click('[class*="close"]').catch(() => {});

    await page.evaluate(() => {
      document.querySelectorAll('div').forEach(el => {
        const style = window.getComputedStyle(el);
        if (
          (style.position === 'fixed' || style.position === 'absolute') &&
          parseInt(style.zIndex) > 1000
        ) {
          el.remove();
        }
      });
    });

    console.log("🟢 Popup limpo");

    // =========================
    // INSS
    // =========================
    console.log("🔵 Selecionando INSS...");

    await page.click('text=INSS', { force: true });

    await esperar(page, 'text=CONSULTA INSS', 5000);

    // =========================
    // CPF
    // =========================
    console.log("🟡 Inserindo CPF...");

    await esperar(page, 'input[placeholder="CPF / Benefício"]', 5000);

    await page.fill('input[placeholder="CPF / Benefício"]', cpf);

    await page.click('button:has-text("Consultar")', { force: true });

    // =========================
    // RESULTADO
    // =========================
    console.log("🟠 Aguardando resultado...");

    await esperar(page, 'text=Margem Total Disponível', 8000);

    await page.waitForTimeout(2000);

    // =========================
    // CAPTURA TEXTO REAL (CORRIGIDO)
    // =========================
    const texto = await page.evaluate(() => document.body.innerText);

    // =========================
    // EXTRAÇÃO NOME (mais robusta)
    // =========================
    let nome = "Não encontrado";

    const matchNome = texto.match(/Nome[:\s]+([A-Za-zÀ-ÿ\s]+)/i);
    if (matchNome) {
      nome = matchNome[1].trim().split('\n')[0];
    }

    console.log("👤 Nome:", nome);

    // =========================
    // FUNÇÃO VALORES (corrigida)
    // =========================
    function extrairValor(label) {
      const regex = new RegExp(label + "\\s*R?\\$?\\s*([\\d.,]+)", "i");
      const match = texto.match(regex);

      if (!match) return 0;

      return parseFloat(
        match[1]
          .replace(/\./g, '')
          .replace(',', '.')
      );
    }

    const margem = extrairValor("Margem Total Disponível");
    const rmc = extrairValor("Margem Disponível RMC");
    const rcc = extrairValor("Margem Disponível RCC");

    console.log("💰 Margem:", margem);
    console.log("💳 RMC:", rmc);
    console.log("🏦 RCC:", rcc);

    await browser.close();

    return {
      nome,
      margem,
      rmc,
      rcc
    };

  } catch (err) {

    await browser.close();

    console.log("❌ ERRO NO BOT:", err.message);

    return {
      nome: "",
      margem: 0,
      rmc: 0,
      rcc: 0
    };
  }
}

module.exports = { consultarPromosys };
