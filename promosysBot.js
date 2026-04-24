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
    // FECHAR POPUP + OVERLAY
    // =========================
    console.log("🟡 Fechando popup...");

    await page.waitForTimeout(1200);

    await page.click('text=×').catch(() => {});
    await page.click('[class*="close"]').catch(() => {});

    // remove overlay invisível
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

    await page.waitForTimeout(500);

    console.log("🟢 Popup limpo");

    // =========================
    // VALIDA LOGIN
    // =========================
    await page.waitForURL('**/consulta/**', { timeout: 10000 });

    console.log("🟢 LOGIN OK");

    // =========================
    // INSS
    // =========================
    console.log("🔵 Selecionando INSS...");

    await page.click('text=INSS', { force: true });

    await page.waitForSelector('text=CONSULTA INSS', { timeout: 15000 });

    // =========================
    // CPF
    // =========================
    console.log("🟡 Buscando CPF...");

    await page.waitForSelector('input[placeholder="CPF / Benefício"]', { timeout: 15000 });

    await page.fill('input[placeholder="CPF / Benefício"]', cpf);

    await page.click('text=CPF / Benefício', { force: true });

    await page.click('button:has-text("Consultar")', { force: true });

    // tempo real de carregamento
    await page.waitForTimeout(15000);

    // =========================
    // CAPTURA DADOS
    // =========================
    console.log("🟠 Capturando dados...");

    // pega topo (nome)
    const textoTopo = await page.locator('body').innerText();

    let nome = "Não encontrado";

    const matchNome = textoTopo.match(/Nome:\s*(.*)/);

    if (matchNome) {
      nome = matchNome[1].split('\n')[0].trim();
    }

    console.log("👤 Nome:", nome);

    // scroll até margens
    await page.mouse.wheel(0, 2000);
    await page.waitForTimeout(2000);

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
