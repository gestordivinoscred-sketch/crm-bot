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
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  try {
    console.log("🔵 Abrindo sistema...");
    await page.goto('https://sistemapromosys.com.br/', {
      waitUntil: 'networkidle'
    });

    // =========================
    // LOGIN
    // =========================
    console.log("🟡 Fazendo Login...");
    await esperar(page, 'input[placeholder="Digite seu nome de usuário"]', 5000);

    await page.fill('input[placeholder="Digite seu nome de usuário"]', process.env.PROMOSYS_USER);
    await page.fill('input[placeholder="Digite sua senha"]', process.env.PROMOSYS_PASS);
    await page.click('text=Acessar o sistema');

    await page.waitForURL('**/consulta/**', { timeout: 10000 });

    // =========================
    // LIMPEZA DE POPUPS
    // =========================
    console.log("🟡 Limpando interface...");
    await page.evaluate(() => {
      document.querySelectorAll('div').forEach(el => {
        const style = window.getComputedStyle(el);
        if (parseInt(style.zIndex) > 1000) el.remove();
      });
    });

    // =========================
    // NAVEGAÇÃO ATÉ INSS
    // =========================
    await page.click('text=INSS', { force: true });
    await esperar(page, 'button:has-text("Consultar")', 5000);

    // TIPO DE BUSCA (CPF ou Telefone)
    const isTelefone = cpf.replace(/\D/g, '').length >= 10;
    if (isTelefone) {
      await page.click('text=TELEFONE');
    } else {
      await page.click('text=CPF / Benefício');
    }

    const input = page.locator('input:visible').first();
    await input.fill(cpf);
    await page.click('button:has-text("Consultar")');

    // Aguarda os dados carregarem
    await esperar(page, 'text=Margem Total Disponível', 10000);

    // =========================
    // CAPTURA DADOS GERAIS
    // =========================
    console.log("🟠 Capturando Margens e Nome...");
    
    const extrairDoTexto = await page.evaluate(() => {
      const corpo = document.body.innerText;
      const limpar = (v) => parseFloat(v.replace(/\./g, '').replace(',', '.')) || 0;
      
      const nomeMatch = corpo.match(/Nome:\s*(.*)/);
      const margemMatch = corpo.match(/Margem Total Disponível\s*R\$\s?([\d.,]+)/);
      const rmcMatch = corpo.match(/Margem Disponível RMC\s*R\$\s?([\d.,]+)/);
      const rccMatch = corpo.match(/Margem Disponível RCC\s*R\$\s?([\d.,]+)/);

      return {
        nome: nomeMatch ? nomeMatch[1].split('\n')[0].trim() : "Não encontrado",
        margem: margemMatch ? limpar(margemMatch[1]) : 0,
        rmc: rmcMatch ? limpar(rmcMatch[1]) : 0,
        rcc: rccMatch ? limpar(rccMatch[1]) : 0
      };
    });

    // =========================
    // EXTRAÇÃO DA TABELA DE CONTRATOS
    // =========================
    console.log("📊 Extraindo Tabela de Contratos...");
    
    const contratos = await page.evaluate(() => {
      // Procura a tabela que contém os contratos (geralmente a que tem "Averbação" ou "Quitação")
      const rows = Array.from(document.querySelectorAll('table tr')).slice(1);
      
      const limparMoeda = (t) => {
        if (!t) return 0;
        let val = t.replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
        return parseFloat(val) || 0;
      };

      return rows.map(row => {
        const cols = row.querySelectorAll('td');
        if (cols.length < 9) return null;

        return {
          banco: cols[0]?.innerText.trim(),
          contrato: cols[1]?.innerText.trim(),
          valorContrato: limparMoeda(cols[5]?.innerText),
          taxa: cols[6]?.innerText.trim(),
          valorParcela: limparMoeda(cols[7]?.innerText),
          pagas: parseInt(cols[8]?.innerText.split('/')[0]) || 0,
          total: parseInt(cols[8]?.innerText.split('/')[1]) || 0,
          quitacao: limparMoeda(cols[9]?.innerText) || limparMoeda(cols[9]?.querySelector('input')?.value)
        };
      }).filter(c => c !== null && c.banco !== "");
    });

    await browser.close();

    // Organiza os bancos únicos e parcelas altas
    const bancosUnicos = [...new Set(contratos.map(c => c.banco))];
    const parcelasAltas = contratos.filter(c => c.valorParcela > limiteParcela);

    return {
      ...extrairDoTexto,
      totalContratos: contratos.length,
      bancos: bancosUnicos,
      parcelasAltas,
      contratos // Retorna a lista completa para o index.js
    };

  } catch (err) {
    console.log("❌ ERRO NO BOT:", err.message);
    if (browser) await browser.close();
    return {
      nome: "Erro na consulta",
      margem: 0, rmc: 0, rcc: 0,
      totalContratos: 0, bancos: [], parcelasAltas: [], contratos: []
    };
  }
}

module.exports = { consultarPromosys };
