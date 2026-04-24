const { chromium } = require('playwright');

async function consultarPromosys(cpf) {

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {

    // 1. login
    await page.goto('URL_PROMOSYS', { waitUntil: 'domcontentloaded' });

    await page.fill('#usuario', process.env.PROMOSYS_USER);
    await page.fill('#senha', process.env.PROMOSYS_PASS);

    await page.click('text=Acessar o sistema');

    // espera login estabilizar
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // 2. fechar popup (se existir)
    await page.click('button:has-text("Fechar")').catch(() => {});

    // 3. atendimento
    await page.click('text=ATENDIMENTO');
    await page.click('text=INSS');

    // 4. consulta
    await page.click('text=Consulta INSS');

    // 5. CPF
    await page.fill('#cpf', cpf);

    // tipo CPF/BENEFÍCIO
    await page.click('input[value="cpf"]');

    // 6. buscar
    await page.click('button:has-text("Consultar")');

    // ⏱️ espera carregamento da resposta (tela do cliente)
    await page.waitForTimeout(15000);

    // 7. captura margem
    const margem = await page.textContent('#margem').catch(() => null);

    await browser.close();

    // fallback seguro
    if (!margem) return 0;

    return margem;

  } catch (err) {

    await browser.close();
    console.log("Erro Promosys:", err);

    return 0;
  }
}

module.exports = { consultarPromosys };
