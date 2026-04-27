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

    await page.waitForURL('**/consulta/**', { timeout: 5000 });

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
    // CPF
    // =========================
    console.log("🟡 Buscando CPF...");

    await esperar(page, 'input[placeholder="CPF / Benefício"]', 5000);

    await page.fill('input[placeholder="CPF / Benefício"]', cpf);

    await page.click('button:has-text("Consultar")', { force: true });

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

    function extrairValor(label) {
      const regex = new RegExp(label + "\\s*R\\$\\s?([\\d.,]+)");
      const match = textoTopo.match(regex);

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
    // CONTRATOS (TABELA CORRETA)
    // =========================
    console.log("📊 Localizando tabela correta...");

    const tabela = page.locator('table:has-text("Banco")').first();

    await esperar(page, 'table:has-text("Banco") tbody tr', 5000);

    const contratosRaw = await tabela.$$eval('tbody tr', rows =>
      rows.map(row => {
        const cols = Array.from(row.querySelectorAll('td')).map(td =>
          td.innerText.trim()
        );

        return cols;
      })
    );

    const parseMoney = (valor) => {
      if (!valor) return 0;
      return parseFloat(
        valor.replace('R$', '').replace(/\./g, '').replace(',', '.')
      );
    };

    const contratos = contratosRaw.map(cols => {
      const matchParcelas = cols[8]?.match(/(\d+)\/(\d+)/);

      return {
        banco: cols[0] || "",
        contrato: cols[1] || "",
        averbacao: cols[2] || "",
        inicioDesconto: cols[3] || "",
        finalDesconto: cols[4] || "",
        valorContrato: parseMoney(cols[5]),
        taxa: cols[6] || "",
        valorParcela: parseMoney(cols[7]),
        pagas: matchParcelas ? parseInt(matchParcelas[1]) : 0,
        total: matchParcelas ? parseInt(matchParcelas[2]) : 0,
        quitacao: parseMoney(cols[9])
      };
    });

    // 🔥 FILTRO PRA LIMPAR SUJEIRA
    const contratosFiltrados = contratos.filter(c =>
      c.banco.includes("BANCO") &&
      c.contrato &&
      c.contrato.length > 5 &&
      c.valorParcela > 0
    );

    const totalContratos = contratosFiltrados.length;

    const bancos = [
      ...new Set(contratosFiltrados.map(c => c.banco))
    ];

    const parcelasAltas = contratosFiltrados.filter(
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
      parcelasAltas,
      contratos: contratosFiltrados
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
      parcelasAltas: [],
      contratos: []
    };
  }
}

module.exports = {
  consultarPromosys
};
