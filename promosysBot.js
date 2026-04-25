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
    // LOGIN (3s)
    // =========================
    console.log("🟡 Login...");

    await esperar(page, 'input[placeholder="Digite seu nome de usuário"]', 3000);

    await page.fill('input[placeholder="Digite seu nome de usuário"]', process.env.PROMOSYS_USER);
    await page.fill('input[placeholder="Digite sua senha"]', process.env.PROMOSYS_PASS);

    await page.click('text=Acessar o sistema');

    await page.waitForURL('**/consulta/**', { timeout: 3000 });

    // =========================
    // POPUP (rápido)
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
    // INSS (5s)
    // =========================
    console.log("🔵 Selecionando INSS...");

    await page.click('text=INSS', { force: true });

    await esperar(page, 'text=CONSULTA INSS', 5000);

    // =========================
    // CPF (5s)
    // =========================
    console.log("🟡 Buscando CPF...");

    await esperar(page, 'input[placeholder="CPF / Benefício"]', 5000);

    await page.fill('input[placeholder="CPF / Benefício"]', cpf);

    await page.click('text=CPF / Benefício', { force: true });

    await page.click('button:has-text("Consultar")', { force: true });

    // =========================
    // RESULTADO (5s)
    // =========================
    await esperar(page, 'text=Margem Total Disponível', 5000);

    // =========================
    // CAPTURA DADOS
    // =========================
    console.log("🟠 Capturando dados...");

    const textoTopo = await page.locator('body').innerText();

    let nome = "Não encontrado";
    const matchNome = textoTopo.match(/Nome:\s*(.*)/);

    if (matchNome) {
      nome = matchNome[1].split('\n')[0].trim();
    }

    console.log("👤 Nome:", nome);

    await page.mouse.wheel(0, 2000);

    const texto = await page.locator('body').innerText();

    function extrairValor(label) {
      const regex = new RegExp(label + "\\s*R\\$\\s?([\\d.,]+)");
      const match = texto.match(regex);

      if (match) {
        return parseFloat(match[1].replace('.', '').replace(',', '.'));
      }

      return 0;
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
      nome: null,
      margem: 0,
      rmc: 0,
      rcc: 0
    };
  }
}

module.exports = { consultarPromosys };
