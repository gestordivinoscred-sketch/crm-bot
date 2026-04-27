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

    await esperar(page, 'input[placeholder="Digite seu nome de usuário"]', 3000);

    await page.fill(
      'input[placeholder="Digite seu nome de usuário"]',
      process.env.PROMOSYS_USER
    );

    await page.fill(
      'input[placeholder="Digite sua senha"]',
      process.env.PROMOSYS_PASS
    );

    await page.click('text=Acessar o sistema');

    await page.waitForURL('**/consulta/**', { timeout: 3000 });

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
// TIPO DE BUSCA
// =========================
await esperar(page, 'input[placeholder="CPF / Benefício"]', 5000);

// 👇 DEFINE SE É CPF OU TELEFONE (AUTOMÁTICO)
const isTelefone = cpf.length >= 10;

if (isTelefone) {
  console.log("📞 Buscando por TELEFONE...");
  await page.click('text=Telefone').catch(() => {});
} else {
  console.log("🆔 Buscando por CPF...");
  await page.click('text=CPF / Benefício').catch(() => {});
}

// limpa e preenche
await page.fill('input[placeholder="CPF / Benefício"]', '');
await page.fill('input[placeholder="CPF / Benefício"]', cpf);
    // =========================
    // RESULTADO
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
        return parseFloat(
          match[1].replace('.', '').replace(',', '.')
        );
      }

      return 0;
    }

    const margem = extrairValor("Margem Total Disponível");
    const rmc = extrairValor("Margem Disponível RMC");
    const rcc = extrairValor("Margem Disponível RCC");

    // =========================
    // CONTRATOS
    // =========================
    const linhas = texto
      .split("\n")
      .map(l => l.trim())
      .filter(Boolean);

    const contratos = [];
    let atual = null;

    for (const linha of linhas) {
const isBanco = /^\d+\s*-\s*/.test(linha) && linha.includes("BANCO");

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

      if (linha.includes("R$") && !linha.includes("Contrato")) {
        const match = linha.match(/R\$ ?([\d.,]+)/);

        if (match) {
          const valor = parseFloat(
            match[1].replace(/\./g, '').replace(',', '.')
          );

          if (valor < 10000) atual.valorParcela = valor;
        }
      }

      if (linha.includes("%")) {
        const match = linha.match(/([\d.,]+)%/);

        if (match) atual.taxa = match[1] + "%";
      }

      if (linha.includes("/") && linha.includes("-")) {
        const match = linha.match(/(\d+)\/(\d+)/);

        if (match) {
          atual.pagas = parseInt(match[1]);
          atual.total = parseInt(match[2]);
        }
      }
    }

    if (atual) contratos.push(atual);

    const totalContratos = contratos.length;
    const bancos = [...new Set(contratos.map(c => c.banco))];
    const parcelasAltas = contratos.filter(
      c => c.valorParcela > limiteParcela
    );

    console.log("💰 Margem:", margem);
    console.log("💳 RMC:", rmc);
    console.log("🏦 RCC:", rcc);
    console.log("📊 Contratos:", totalContratos);

    await browser.close();

    return {
      nome,
      margem,
      rmc,
      rcc,
      totalContratos,
      bancos,
      parcelasAltas
    };

  } catch (err) {
    await browser.close();

    console.log("❌ ERRO NO BOT:", err.message);

    return {
      nome: null,
      margem: 0,
      rmc: 0,
      rcc: 0,
      totalContratos: 0,
      bancos: [],
      parcelasAltas: []
    };
  }
}

module.exports = {
  consultarPromosys
};
