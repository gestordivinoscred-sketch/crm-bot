const { chromium } = require('playwright');

async function consultarPromosys(cpf) {

  const browser = await chromium.launch({
    headless: true // invisível no servidor
  });

  const page = await browser.newPage();

  // 1. entrar no sistema
  await page.goto('URL_DO_PROMOSYS_LOGIN');

  // 2. login (AJUSTAR SELETOR REAL)
  await page.fill('#usuario', 'SEU_LOGIN');
  await page.fill('#senha', 'SUA_SENHA');
  await page.click('button[type="submit"]');

  // 3. esperar carregar
  await page.waitForTimeout(3000);

  // 4. buscar CPF (AJUSTAR DEPOIS)
  await page.fill('#cpf', cpf);
  await page.click('#buscar');

  await page.waitForTimeout(2000);

  // 5. capturar margem (AJUSTAR SELETOR REAL)
  const margemTexto = await page.textContent('#margem');

  await browser.close();

  return margemTexto;
}

module.exports = { consultarPromosys };
