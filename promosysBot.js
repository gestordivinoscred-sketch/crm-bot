const { chromium } = require('playwright');

async function esperar(page, selector, tempo) {
  try {
    await page.waitForSelector(selector, { timeout: tempo });
  } catch {
    console.log(`⚠️ Timeout em: ${selector}`);
  }
}

async function consultarPromosys(cpf, limiteParcela = 0) {
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

    await esperar(page, 'input[placeholder="Digite seu nome de usuário"]', 2000);

    await page.fill(
      'input[placeholder="Digite seu nome de usuário"]',
      process.env.PROMOSYS_USER
    );

    await page.fill(
      'input[placeholder="Digite sua senha"]',
      process.env.PROMOSYS_PASS
    );

    await page.click('text=Acessar o sistema');

    await page.waitForURL('**/consulta/**', { timeout: 2000 });

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
    await esperar(page, 'text=CONSULTA INSS', 3000);

    // =========================
    // TIPO DE BUSCA
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

    await esperar(page, 'text=Margem Total Disponível', 3000);

    // =========================
    // CAPTURA
    // =========================
    console.log("🟠 Capturando dados...");

    const texto = await page.locator('body').innerText();

    const textoTopo = texto;

    let nome = "Não encontrado";
    const matchNome = textoTopo.match(/Nome:\s*(.*)/);
    if (matchNome) {
      nome = matchNome[1].split('\n')[0].trim();
    }

    console.log("👤 Nome:", nome);

    // =========================
    // SCROLL
    // =========================
    await page.evaluate(async () => {
      await new Promise(resolve => {
        let totalHeight = 0;
        const distance = 500;

        const timer = setInterval(() => {
          window.scrollBy(0, distance);
          totalHeight += distance;

          if (totalHeight >= document.body.scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 200);
      });
    });

    await page.waitForTimeout(1500);
    await page.evaluate(() => window.scrollTo(0, 0));

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
    // PARSER INTELIGENTE
    // =========================
    const linhas = texto.split("\n").map(l => l.trim()).filter(Boolean);

    const bancos = [];
    const contratos = [];

    let atual = null;
    let modo = "inicio";

    for (const linha of linhas) {

      // Detecta início da área de contratos
      if (linha.includes("R$") || linha.includes("%") || linha.includes("/")) {
        modo = "contratos";
      }

      // =========================
      // BANCOS (RESUMO)
      // =========================
      if (modo === "inicio") {
        const isBanco = /^\d+\s*-\s*.*BANCO|QI|FACTA|CREDITO|SCD/i.test(linha);

        if (isBanco) {
          bancos.push(linha);
        }
        continue;
      }

      // =========================
      // CONTRATOS DETALHADOS
      // =========================
      const isNovoContrato = /^\d{2,}-\d+\/\d+/.test(linha);

      if (isNovoContrato) {
        if (atual) contratos.push(atual);

        atual = {
          banco: linha,
          valorParcela: 0,
          taxa: "",
          pagas: 0,
          total: 0
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

      // parcelas pagas / total
      if (linha.includes("/") && /\d+\/\d+/.test(linha)) {
        const match = linha.match(/(\d+)\/(\d+)/);

        if (match) {
          atual.pagas = parseInt(match[1]);
          atual.total = parseInt(match[2]);
        }
      }
    }

    if (atual) contratos.push(atual);

    // =========================
    // FINALIZAÇÃO
    // =========================
    const totalContratos = contratos.length;
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
      contratos,
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
      contratos: [],
      parcelasAltas: []
    };
  }
}

module.exports = {
  consultarPromosys
};
