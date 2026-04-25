const { chromium } = require('playwright');

let browser;
let page;
let logado = false;

// =========================
// INIT / LOGIN ÚNICO
// =========================
async function init() {
  if (logado && page) return;

  console.log("🔐 Iniciando browser e login...");

  browser = await chromium.launch({ headless: true });

  page = await browser.newPage();

  await page.goto('https://sistemapromosys.com.br/', {
    waitUntil: 'domcontentloaded'
  });

  await page.fill('input[placeholder="Digite seu nome de usuário"]', process.env.PROMOSYS_USER);
  await page.fill('input[placeholder="Digite sua senha"]', process.env.PROMOSYS_PASS);

  await page.click('text=Acessar o sistema');

  await page.waitForURL('**/consulta/**', { timeout: 15000 });

  console.log("🟢 Login realizado");

  logado = true;
}

// =========================
// GARANTIR TELA CORRETA (🔥 NOVO)
// =========================
async function prepararConsulta() {

  console.log("🧭 Preparando tela de consulta...");

  await page.goto('https://sistemapromosys.com.br/consulta', {
    waitUntil: 'domcontentloaded'
  });

  await page.waitForTimeout(1000);

  // garante INSS ativo
  try {
    await page.click('text=INSS', { timeout: 5000 });
  } catch {}

  await page.waitForSelector('input[placeholder="CPF / Benefício"]', {
    timeout: 15000
  });

  console.log("🟢 Tela pronta");
}

// =========================
// CHECAR SESSÃO
// =========================
async function checkSession() {
  const url = page.url();

  if (url.includes("login") || url.includes("sistema")) {
    console.log("🔴 Sessão expirada, relogando...");
    logado = false;
    await init();
    await prepararConsulta(); // 🔥 ESSA É A CORREÇÃO
  }
}

// =========================
// FUNÇÃO PRINCIPAL
// =========================
async function consultarPromosys(cpf) {

  try {

    await init();
    await checkSession();

    // 🔥 GARANTE SEMPRE TELA CERTA
    await prepararConsulta();

    console.log("🔵 Consultando CPF:", cpf);

    await page.fill('input[placeholder="CPF / Benefício"]', cpf);

    await page.click('button:has-text("Consultar")', { force: true });

    console.log("🟠 Aguardando resultado...");

    await page.waitForTimeout(3000);

    const texto = await page.evaluate(() => document.body.innerText);

    let nome = "Não encontrado";

    const matchNome = texto.match(/Nome\s*[:\-]?\s*(.+)/i);
    if (matchNome) {
      nome = matchNome[1].split('\n')[0].trim();
    }

    function extrair(label) {
      const regex = new RegExp(label + ".*?([\\d.,]+)", "i");
      const match = texto.match(regex);

      if (!match) return 0;

      return parseFloat(
        match[1]
          .replace(/\./g, '')
          .replace(',', '.')
      );
    }

    const margem = extrair("Margem Total Disponível");
    const rmc = extrair("Margem Disponível RMC");
    const rcc = extrair("Margem Disponível RCC");

    console.log("👤 Nome:", nome);
    console.log("💰 Margem:", margem);
    console.log("💳 RMC:", rmc);
    console.log("🏦 RCC:", rcc);

    return { nome, margem, rmc, rcc };

  } catch (err) {

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
