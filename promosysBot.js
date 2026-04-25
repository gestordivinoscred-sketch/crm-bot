const { chromium } = require('playwright');

async function esperar(page, selector, tempo) {
  try {
    await page.waitForSelector(selector, { timeout: tempo });
  } catch {
    console.log(`⚠️ Timeout em: ${selector}`);
  }
}

async function consultarPromosys(cpf, limiteParcela = 50) {

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

    await page.fill('input[placeholder="Digite seu nome de usuário"]', process.env.PROMOSYS_USER);
    await page.fill('input[placeholder="Digite sua senha"]', process.env.PROMOSYS_PASS);

    await page.click('text=Acessar o sistema');

    await page.waitForURL('**/consulta/**', { timeout: 10000 });

    // =========================
    // POPUP
    // =========================
    console.log("🟡 Fechando popup...");

    await page.click('text=×').catch(() => {});
    await page.click('[class*="close"]').catch(() => {});

    console.log("🟢 Popup limpo");

    // =========================
    // INSS
    // =========================
    console.log("🔵 Selecionando INSS...");

    await page.click('text=INSS', { force: true });

    await esperar(page, 'input[placeholder="CPF / Benefício"]', 10000);

    // =========================
    // CPF
    // =========================
    console.log("🟡 Buscando CPF...");

    await page.fill('input[placeholder="CPF / Benefício"]', cpf);

    await page.click('button:has-text("Consultar")', { force: true });

    // =========================
    // RESULTADO
    // =========================
    console.log("🟠 Aguardando resultado...");

    await page.waitForTimeout(3000);

    // pega DOM uma vez só (mais rápido e estável)
    const texto = await page.evaluate(() => document.body.innerText);

    // =========================
    // NOME (mais seguro)
    // =========================
    let nome = "Não encontrado";

    const matchNome = texto.match(/Nome\s*[:\-]?\s*(.+)/i);
    if (matchNome) {
      nome = matchNome[1].split('\n')[0].trim();
    }

    // =========================
    // MARGENS
    // =========================
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

    // =========================
    // CONTRATOS (ROBUSTO)
    // =========================
    const linhas = texto.split("\n").map(l => l.trim()).filter(Boolean);

    const contratos = [];
    let atual = null;

    for (const linha of linhas) {

      const isBanco = /^\d+\s*-\s*/.test(linha);

      if (isBanco) {
        if (atual) contratos.push(atual);

        atual = {
          banco: linha,
          valorParcela: 0,
          taxa: "",
          pagas: 0,
          total: 0
        };
      }

      if (!atual) continue;

      // parcela
      const matchParcela = linha.match(/R\$ ?([\d.,]+)/);
      if (matchParcela && linha.includes("R$")) {
        const valor = parseFloat(matchParcela[1].replace(/\./g, '').replace(',', '.'));

        if (valor > 0 && valor < 10000) {
          atual.valorParcela = valor;
        }
      }

      // taxa
      const matchTaxa = linha.match(/([\d.,]+)%/);
      if (matchTaxa) {
        atual.taxa = matchTaxa[1] + "%";
      }

      // pagas / total
      const matchPagas = linha.match(/(\d+)\/(\d+)/);
      if (matchPagas) {
        atual.pagas = Number(matchPagas[1]);
        atual.total = Number(matchPagas[2]);
      }
    }

    if (atual) contratos.push(atual);

    // =========================
    // FILTROS INTELIGENTES
    // =========================
    const totalContratos = contratos.length;
    const bancos = [...new Set(contratos.map(c => c.banco))];
    const parcelasAltas = contratos.filter(c => c.valorParcela > limiteParcela);

    console.log("👤 Nome:", nome);
    console.log("💰 Margem:", margem);
    console.log("📊 Contratos:", totalContratos);

    await browser.close();

    // =========================
    // RETORNO LIMPO PRA IA
    // =========================
    return {
      nome,
      margem,
      rmc,
      rcc,
      contratos: totalContratos,
      bancos,
      parcelasAltas
    };

  } catch (err) {

    await browser.close();

    console.log("❌ ERRO NO BOT:", err.message);

    return {
      nome: "",
      margem: 0,
      rmc: 0,
      rcc: 0,
      contratos: 0,
      bancos: [],
      parcelasAltas: []
    };
  }
}

module.exports = { consultarPromosys };
