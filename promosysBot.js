const { chromium } = require('playwright');

async function consultarPromosys(cpf) {

  const browser = await chromium.launch({
    headless: false,   // 👀 deixa visível pra você ver o robô
    slowMo: 200        // 🐢 desacelera ações
  });

  const page = await browser.newPage();

  try {

    // 1. abre sistema
    await page.goto('URL_PROMOSYS', { waitUntil: 'networkidle' });

    // espera login aparecer
    await page.waitForSelector('#usuario', { timeout: 15000 });
    await page.waitForSelector('#senha', { timeout: 15000 });

    // preenche login
    await page.fill('#usuario', process.env.PROMOSYS_USER);
    await page.fill('#senha', process.env.PROMOSYS_PASS);

    // 🟡 delay só antes do botão acessar
    await page.waitForTimeout(2000);

    // login
    await page.click('text=Acessar o sistema');

    // espera entrar no sistema
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // 2. fecha popup se existir
    await page.click('button:has-text("Fechar")').catch(() => {});

    // 3. navegação
    await page.click('text=ATENDIMENTO');
    await page.click('text=INSS');

    // 4. consulta CPF
    await page.fill('#cpf', cpf);
    await page.click('input[value="cpf"]');

    // 5. busca
    await page.click('button:has-text("Consultar")');

    // ⏱ espera resultado carregar
    await page.waitForTimeout(15000);

    // 6. captura margem (ajustar depois se necessário)
    const margem = await page.textContent('#margem').catch(() => null);

    await browser.close();

    if (!margem) return 0;

    return margem;

  } catch (err) {

    await browser.close();
    console.log("Erro Promosys:", err);

    return 0;
  }
}

module.exports = { consultarPromosys };
