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

    // LIMPEZA DE POPUPS (Igual ao seu anterior)
    await page.evaluate(() => {
      document.querySelectorAll('div').forEach(el => {
        if (parseInt(window.getComputedStyle(el).zIndex) > 1000) el.remove();
      });
    });

    // NAVEGAÇÃO INSS (Voltando para a sua lógica original)
    await page.click('text=INSS', { force: true });
    await esperar(page, 'button:has-text("Consultar")', 5000);

    const isTelefone = cpf.replace(/\D/g, '').length >= 10;
    if (isTelefone) { 
      await page.click('text=TELEFONE'); 
    } else { 
      await page.click('text=CPF / Benefício'); 
    }

    // Pega o input exatamente como estava no seu código que funcionava
    const input = page.locator('input:visible').first();
    await input.fill(cpf);
    await page.click('button:has-text("Consultar")');

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

    // EXTRAÇÃO DA TABELA (COLUNAS LIMPAS)
    const contratos = await page.evaluate(() => {
      const limparMoeda = (t) => {
        if (!t) return 0;
        let val = t.replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
        return parseFloat(val) || 0;
      };

      const tabelas = Array.from(document.querySelectorAll('table'));
      const tabelaReal = tabelas.find(t => t.innerText.includes('Quitação') && t.innerText.includes('Banco'));
      if (!tabelaReal) return [];

      // Filtra as linhas da tabela
      const rows = Array.from(tabelaReal.querySelectorAll('tr')).filter(r => r.querySelectorAll('td').length >= 10);
      
      return rows.map(row => {
        const cols = row.querySelectorAll('td');
        const bancoNome = cols[1]?.innerText.trim();
        if (!bancoNome || bancoNome.includes("Banco")) return null;

        // Pega as parcelas restantes (ex: de "5/96 91 Restantes", pega "91")
        const pagasTexto = cols[9]?.innerText || "";
        const matchRestantes = pagasTexto.match(/(\d+)\s*Restantes/);
        const restantes = matchRestantes ? parseInt(matchRestantes[1]) : 0;

        return {
          banco: bancoNome,
          contrato: cols[2]?.innerText.trim(),
          taxa: cols[7]?.innerText.trim(), // Pula Averbação/Início/Final/ValorContrato
          valorParcela: limparMoeda(cols[8]?.innerText),
          parcelasRestantes: restantes,
          quitacao: limparMoeda(cols[10]?.innerText) || limparMoeda(cols[10]?.querySelector('input')?.value)
        };
      }).filter(c => c !== null);
    });

    await browser.close();
    return { ...extrairDoTexto, totalContratos: contratos.length, contratos };

  } catch (err) {
    console.error("❌ Erro fatal:", err.message);
    if (browser) await browser.close();
    return { nome: "Erro", margem: 0, rmc: 0, rcc: 0, totalContratos: 0, contratos: [] };
  }
}

module.exports = { consultarPromosys };
