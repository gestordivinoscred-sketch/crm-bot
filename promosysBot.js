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
    // FECHAR POPUP + LIMPAR OVERLAY
    // =========================
    console.log("🟡 Fechando popup...");

    await page.waitForTimeout(1200);

    // tenta fechar no X
    await page.click('text=×').catch(() => {});
    await page.click('[class*="close"]').catch(() => {});

    // REMOVE overlay invisível (🔥 chave do problema)
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

    console.log("🟢 Popup realmente limpo");

    // =========================
    // VALIDA LOGIN
    // =========================
    await page.waitForURL('**/consulta/**', { timeout: 10000 });

    console.log("🟢 LOGIN OK");

    // =========================
    // CLICAR INSS (FORÇADO)
    // =========================
    console.log("🔵 Selecionando INSS...");

    await page.click('text=INSS', { force: true });

    await page.waitForTimeout(2000);

    // =========================
    // BUSCAR CPF
    // =========================
    console.log("🟡 Buscando CPF...");

    await page.fill('#cpf', cpf);
    await page.click('input[value="cpf"]', { force: true });

    await page.click('button:has-text("Consultar")', { force: true });

    // ⏱️ TEMPO REAL DO SISTEMA
    await page.waitForTimeout(15000);

    // =========================
    // CAPTURAR MARGEM
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
