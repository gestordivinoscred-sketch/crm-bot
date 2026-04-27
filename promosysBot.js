const { chromium } = require('playwright');

async function esperar(page, selector, tempo) {
  try { await page.waitForSelector(selector, { timeout: tempo }); } catch { }
}

async function consultarPromosys(cpf, limiteParcela = 0, tipo = null) {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  try {
    await page.goto('https://sistemapromosys.com.br/', { waitUntil: 'networkidle' });

    // LOGIN
    await esperar(page, 'input[placeholder*="usuário"]', 5000);
    await page.fill('input[placeholder*="usuário"]', process.env.PROMOSYS_USER);
    await page.fill('input[placeholder*="senha"]', process.env.PROMOSYS_PASS);
    await page.click('text=Acessar o sistema');
    await page.waitForURL('**/consulta/**', { timeout: 10000 });

    // NAVEGAÇÃO
    await page.click('text=INSS', { force: true });
    await esperar(page, 'button:has-text("Consultar")', 5000);

    // LÓGICA DE DECISÃO (IA OU AUTOMÁTICO)
    if (tipo === 'telefone') {
      await page.click('text=TELEFONE');
    } else if (tipo === 'cpf') {
      await page.click('text=CPF / Benefício');
    } else {
      // Caso a IA esqueça de enviar o tipo, o robô tenta adivinhar:
      const clean = cpf.replace(/\D/g, '');
      if (clean.length >= 10 && clean.substring(2, 3) === "9") {
        await page.click('text=TELEFONE');
      } else {
        await page.click('text=CPF / Benefício');
      }
    }

    const input = page.locator('input:visible').first();
    await input.fill(cpf);
    await page.click('button:has-text("Consultar")');

    await esperar(page, 'text=Margem Total Disponível', 12000);

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
        if (!cols[1]?.innerText.trim() || cols[1]?.innerText.includes("Banco")) return null;
        const pText = cols[9]?.innerText || "";
        const m = pText.match(/(\d+)\s*Restantes/);
        return {
          banco: cols[1]?.innerText.trim(),
          contrato: cols[2]?.innerText.trim(),
          taxa: cols[7]?.innerText.trim(),
          valorParcela: limparMoeda(cols[8]?.innerText),
          parcelasRestantes: m ? parseInt(m[1]) : 0,
          quitacao: limparMoeda(cols[10]?.innerText) || limparMoeda(cols[10]?.querySelector('input')?.value)
        };
      }).filter(c => c !== null);
    });

    await browser.close();
    return { ...extrairDoTexto, totalContratos: contratos.length, contratos };
  } catch (err) {
    if (browser) await browser.close();
    throw err;
  }
}

module.exports = { consultarPromosys };
