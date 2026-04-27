const express = require('express');
const app = express();

app.use(express.json());

// importa o robô
const { consultarPromosys } = require('./promosysBot');

// -----------------------------
// WEBHOOK
// -----------------------------
app.post('/webhook', async (req, res) => {

  const cpf = req.body.cpf;

  if (!cpf) {
    return res.status(400).json({
      status: "erro",
      mensagem: "CPF não enviado"
    });
  }

  try {

    // 🤖 CHAMA O ROBÔ
    const dados = await consultarPromosys(cpf);

    // 🔥 calcula saldo total de quitação
    const saldoQuitacaoTotal = (dados.contratos || []).reduce(
      (acc, c) => acc + (c.quitacao || 0),
      0
    );

    // -----------------------------
    // RESPOSTA PADRONIZADA
    // -----------------------------
    const resposta = {
      status: "ok",
      cpf,

      nome: dados.nome || "",
      margem: Number(dados.margem || 0),
      rmc: Number(dados.rmc || 0),
      rcc: Number(dados.rcc || 0),

      contratosAtivos: dados.totalContratos || 0,

      saldoQuitacaoTotal,

      bancos: dados.bancos || [],
      parcelasAltas: dados.parcelasAltas || [],

      contratos: dados.contratos || [],

      mensagem: gerarMensagemHumana({
        ...dados,
        saldoQuitacaoTotal
      })
    };

    return res.json(resposta);

  } catch (err) {

    return res.status(500).json({
      status: "erro",
      mensagem: "Erro ao consultar sistema",
      detalhe: err.message
    });
  }
});

// -----------------------------
// MENSAGEM HUMANA
// -----------------------------
function gerarMensagemHumana(dados) {

  const nome = dados.nome || "cliente";
  const margem = Number(dados.margem || 0);
  const contratos = dados.totalContratos || 0;
  const saldo = Number(dados.saldoQuitacaoTotal || 0);

  return `Este CPF pertence a ${nome}. ` +
    (margem > 0
      ? `Possui margem consignável de R$ ${margem}. `
      : `Não possui margem consignável disponível. `) +

    `RMC: R$ ${dados.rmc || 0}. RCC: R$ ${dados.rcc || 0}. ` +

    `Possui ${contratos} contratos ativos. ` +

    (saldo > 0
      ? `Saldo total para quitação aproximado: R$ ${saldo}.`
      : ``);
}

// -----------------------------
// TESTE PLAYWRIGHT
// -----------------------------
app.get('/test-browser', async (req, res) => {

  try {
    const { chromium } = require('playwright');

    const browser = await chromium.launch({
      headless: true
    });

    await browser.close();

    return res.json({
      status: "ok",
      mensagem: "Playwright funcionando no Coolify 🚀"
    });

  } catch (err) {

    return res.status(500).json({
      status: "erro",
      mensagem: err.message
    });
  }
});

// -----------------------------
// SERVIDOR
// -----------------------------
app.listen(process.env.PORT || 3199, () => {
  console.log('API rodando 🚀');
});
