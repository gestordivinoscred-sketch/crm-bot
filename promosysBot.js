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
    await page.goto('https://sistemapromosys.com.br/', { waitUntil: 'networkidle' });

    // LOGIN
    await esperar(page, 'input[placeholder="Digite seu nome de usuário"]', 5000);
    await page.fill('input[placeholder="Digite seu nome de usuário"]', process.env.PROMOSYS_USER);
    await page.fill('input[placeholder="Digite sua senha"]', process.env.PROMOSYS_PASS);
    await page.click('text=Acessar o sistema');
    await page.waitForURL('**/consulta/**', { timeout: 10000 });

    // NAVEGAÇÃO
    await page.click('text=INSS', { force: true });
    await esperar(page, 'button:has-text("Consultar")', 5000);
    const input = page.locator('input:visible').first();
    await input.fill(cpf);
    await page.click('button:has-text("Consultar")');
    
    // Aguarda carregar os dados
    await esperar(page, 'text=Margem Total Disponível', 12000);

    // DADOS GERAIS
    const extrairDoTexto = await page.evaluate(() => {
      const corpo = document.body.innerText;
      const limpar = (v) => parseFloat(v.replace(/\./g, '').replace(',', '.')) || 0;
      return {
        nome: corpo.match(/Nome:\s*(.*)/)?.[1].split('\n')[0].trim() || "Não encontrado",
        margem: limpar(corpo.match(/Margem Total Disponível\s*R\$\s?([\d.,]+)/)?.[1] || "0"),
        rmc: limpar(corpo.match(/Margem Disponível RMC\s*R\$\s?([\d.,]+)/)?.[1] || "0"),
        rcc: limpar(corpo.match(/Margem Disponível RCC\s*R\$\s?([\d.,]+)/)?.[1] || "0")
      };
    });

    // EXTRAÇÃO DA TABELA (MAPEAMENTO DA DIVINOS CRED)
    const contratos = await page.evaluate(() => {
      const limparMoeda = (t) => {
        if (!t) return 0;
        let val = t.replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
        return parseFloat(val) || 0;
      };

      const tabelas = Array.from(document.querySelectorAll('table'));
      const tabelaReal = tabelas.find(t => t.innerText.includes('Quitação') && t.innerText.includes('Banco'));
      if (!tabelaReal) return [];

      const rows = Array.from(tabelaReal.querySelectorAll('tr')).filter(r => r.querySelectorAll('td').length >= 10);
      
      return rows.map(row => {
        const cols = row.querySelectorAll('td');
        const bancoNome = cols[1]?.innerText.trim();
        if (!bancoNome || bancoNome.includes("Banco")) return null;

        // Extrai apenas o número de parcelas restantes (ex: de "5/96 91 Restantes", pega "91")
        const pagasTotalTexto = cols[9]?.innerText || "";
        const matchRestantes = pagasTotalTexto.match(/(\d+)\s*Restantes/);
        const restantes = matchRestantes ? parseInt(matchRestantes[1]) : 0;

        return {
          banco: bancoNome,
          contrato: cols[2]?.innerText.trim(),
          taxa: cols[7]?.innerText.trim(), 
          valorParcela: limparMoeda(cols[8]?.innerText),
          parcelasRestantes: restantes,
          quitacao: limparMoeda(cols[10]?.innerText) || limparMoeda(cols[10]?.querySelector('input')?.value)
        };
      }).filter(c => c !== null);
    });

    await browser.close();

    // RETORNO FINAL
    return { 
      ...extrairDoTexto, 
      totalContratos: contratos.length, 
      contratos 
    };

  } catch (err) {
    console.error("❌ Erro no robô:", err.message);
    if (browser) await browser.close();
    return { 
      nome: "Erro", 
      margem: 0, 
      rmc: 0, 
      rcc: 0, 
      totalContratos: 0, 
      contratos: [] 
    };
  }
}

module.exports = { consultarPromosys };
