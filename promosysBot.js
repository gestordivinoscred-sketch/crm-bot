const { chromium } = require('playwright');

async function consultarPromosys(cpf) {

  const browser = await chromium.launch({
    headless: true // 🔒 obrigatório no servidor
  });

  const page = await browser.newPage();

  try {

    console.log("🔵 Abrindo sistema...");

    await page.goto('URL_PROMOSYS', { waitUntil: 'networkidle' });

    // espera campos de login
    await page.waitForSelector('#usuario', { timeout: 15000 });
    await page.waitForSelector('#senha', { timeout: 15000 });

    console.log("🟡 Preenchendo login...");

    await page.fill('#usuario', process.env.PROMOSYS_USER);
    await page.fill('#senha', process.env.PROMOSYS_PASS);

    // pequeno delay só no botão
    await page.waitForTimeout(2000);

    console.log("🟠 Clicando em acessar...");

    await page.click('text=Acessar o sistema');

    // 🚨 AGORA A MÁGICA: valida login de verdade
    await page.waitForSelector('text=ATENDIMENTO', { timeout: 15000 });

    console.log("🟢 LOGIN OK - entrou no sistema");

    // pequena estabilidade
    await page.waitForTimeout(2000);

    // fecha popup se existir
    await page.click('button:has-text("Fechar")').catch(() => {});

    console.log("🔵 Navegando para consulta...");

    await page.click('text=ATENDIMENTO');
    await page.click('text=INSS');
    await page.click('text=Consulta INSS');

    console.log("🟡 Buscando CPF...");

    await page.fill('#cpf', cpf);
    await page.click('input[value="cpf"]');

    await page.click('button:has-text("Consultar")');

    // ⏱️ espera resultado carregar
    await page.waitForTimeout(15000);

    console.log("🟠 Capturando margem...");

    const margem = await page.textContent('#margem').catch(() => null);

    await browser.close();

    if (!margem) {
      console.log("⚠️ Margem não encontrada");
      return 0;
    }

    return margem;

  } catch (err) {

    await browser.close();

    console.log("❌ ERRO NO BOT:", err.message);

    return 0;
  }
}

module.exports = { consultarPromosys };
