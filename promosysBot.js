const { chromium } = require('playwright');

async function esperar(page, selector, tempo) {
  try {
    await page.waitForSelector(selector, { timeout: tempo });
  } catch {
    console.log(`⚠️ Timeout em: ${selector}`);
  }
}

async function consultarPromosys(cpf, limiteParcela = 0) {
  const browser = await chromium.launch({ headless: true });

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

    await page.waitForURL('**/consulta/**', { timeout: 5000 });

    // =========================
    // POPUP
    // =========================
    console.log("🟡 Fechando popup...");

    await page.click('text=×').catch(() => {});
    await page.click('[class*="close"]').catch(() => {});

    // =========================
    // INSS
    // =========================
    console.log("🔵 Selecionando INSS...");

    await page.click('text=INSS', { force: true });
    await esperar(page, 'text=CONSULTA INSS', 3000);

    // =========================
    // BUSCA
    // =========================
    const isTelefone = cpf.length >= 10;

    if (isTelefone) {
      console.log("📞 Buscando por TELEFONE...");
      await page.click('text=TELEFONE');
    } else {
      console.log("🆔 Buscando por CPF...");
      await page.click('text=CPF / Benefício');
    }

    const input = page.locator('input:visible').first();
    await input.waitFor({ state: 'visible', timeout: 3000 });

    await input.fill('');
    await input.fill(cpf);

    await page.click('button:has-text("Consultar")');

    await esperar(page, 'text=Margem Total Disponível', 5000);

    // =========================
    // SCROLL
    // =========================
    await page.evaluate(async () => {
      await new Promise(resolve => {
        let total = 0;
        const step = 500;

        const timer = setInterval(() => {
          window.scrollBy(0, step);
          total += step;

          if (total >= document.body.scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 200);
      });
    });

    await page.waitForTimeout(1500);
    await page.evaluate(() => window.scrollTo(0, 0));

    // =========================
    // TEXTO
    // =========================
    const texto = await page.locator('body').innerText();

    // =========================
    // NOME
    // =========================
    let nome = "Não encontrado";
    const matchNome = texto.match(/Nome:\s*(.*)/);

    if (matchNome) {
      nome = matchNome[1].split('\n')[0].trim();
    }

    // =========================
    // VALORES
    // =========================
    function extrairValor(label) {
      const regex = new RegExp(label + "\\s*R\\$\\s?([\\d.,]+)");
      const match = texto.match(regex);

      if (match) {
        return parseFloat(match[1].replace(/\./g, '').replace(',', '.'));
      }

      return 0;
    }

    const margem = extrairValor("Margem Total Disponível");
    const rmc = extrairValor("Margem Disponível RMC");
    const rcc = extrairValor("Margem Disponível RCC");

    // =========================
    // CONTRATOS
    // =========================
    const linhas = texto.split("\n").map(l => l.trim()).filter(Boolean);

    const contratos = [];
    const bancos = [];

    let atual = null;
    let modo = "bancos";

    for (const linha of linhas) {

      if (linha.includes("R$") || /\d+\/\d+/.test(linha) || linha.includes("%")) {
        modo = "contratos";
      }

      // =========================
      // BANCOS
      // =========================
      if (modo === "bancos") {
        if (/^\d+\s*-\s*/.test(linha)) {
          bancos.push(linha);
        }
        continue;
      }

      // =========================
      // NOVO CONTRATO
      // =========================
      const isNovoContrato = /^\d{2,}-\d+\/\d+/.test(linha);

      if (isNovoContrato) {

        if (atual) {
          const existe = contratos.find(c => c.banco === atual.banco);
          if (!existe) contratos.push(atual);
        }

        atual = {
          banco: linha,
          valorParcela: 0,
          taxa: "",
          pagas: 0,
          total: 0,
          quitacao: 0
        };

        continue;
      }

      if (!atual) continue;

      // valor parcela
      if (linha.includes("R$")) {
        const match = linha.match(/R\$ ?([\d.,]+)/);

        if (match) {
          const valor = parseFloat(
            match[1].replace(/\./g, '').replace(',', '.')
          );

          if (valor < 10000) atual.valorParcela = valor;
        }
      }

      // taxa
      if (linha.includes("%")) {
        const match = linha.match(/([\d.,]+)%/);
        if (match) atual.taxa = match[1] + "%";
      }

      // parcelas
      if (/\d+\/\d+/.test(linha)) {
        const match = linha.match(/(\d+)\/(\d+)/);

        if (match) {
          atual.pagas = parseInt(match[1]);
          atual.total = parseInt(match[2]);
        }
      }
    }

    if (atual) {
      const existe = contratos.find(c => c.banco === atual.banco);
      if (!existe) contratos.push(atual);
    }

    // =========================
    // 🔥 QUITAÇÃO GLOBAL (CORRETO AGORA)
    // =========================
    console.log("🟣 Capturando quitação...");

    let quitacaoGlobal = 0;

    const inputs = await page.locator('input').all();

    for (const input of inputs) {
      try {
        const value = await input.inputValue();

        const parsed = parseFloat(
          value.replace(/\./g, '').replace(',', '.')
        );

        if (!isNaN(parsed) && parsed > 1000) {
          quitacaoGlobal = parsed;
        }

      } catch {}
    }

    // aplica UMA vez só (não duplica mais)
    contratos.forEach(c => {
      c.quitacao = quitacaoGlobal;
    });

    // =========================
    // FINAL
    // =========================
    await browser.close();

    return {
      nome,
      margem,
      rmc,
      rcc,
      totalContratos: contratos.length,
      bancos,
      contratos,
      parcelasAltas: contratos.filter(c => c.valorParcela > limiteParcela)
    };

  } catch (err) {

    await browser.close();

    console.log("❌ ERRO:", err.message);

    return {
      nome: null,
      margem: 0,
      rmc: 0,
      rcc: 0,
      totalContratos: 0,
      bancos: [],
      contratos: [],
      parcelasAltas: []
    };
  }
}

module.exports = {
  consultarPromosys
};
