const express = require('express');
const app = express();

app.use(express.json());

// importa o robô
const { consultarPromosys } = require('./promosysBot');

// -----------------------------
// WEBHOOK (N8N / POSTMAN / IA TOOL)
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

    // 🤖 CHAMA O ROBÔ (AGORA RETORNA OBJETO COMPLETO)
    const dados = await consultarPromosys(cpf);

    // -----------------------------
    // RESPOSTA FINAL PADRONIZADA
    // -----------------------------
    const resposta = {
      status: "ok",
      cpf,

      nome: dados.nome || "",
      margem: Number(dados.margem || 0),
      rmc: Number(dados.rmc || 0),
      rcc: Number(dados.rcc || 0),

      contratos: Number(dados.contratos || 0),
      bancos: dados.bancos || [],
      parcelasAltas: dados.parcelasAltas || [],

      // 👇 resposta já pronta pra IA (HUMANA)
      mensagem: gerarMensagemHumana(dados)
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
// 🧠 GERADOR DE TEXTO HUMANO (IA FRIENDLY)
// -----------------------------
function gerarMensagemHumana(dados) {

  const nome = dados.nome || "cliente";

  const margem = Number(dados.margem || 0);

  const temMargem = margem > 0;

  return `Este CPF pertence a ${nome}. ` +
    (temMargem
      ? `No momento, ele possui uma margem consignável de R$ ${margem}. `
      : `No momento, ele não possui margem consignável disponível. `) +

    `Não possui margem de cartão consignado (RMC) e não possui margem de cartão benefício (RCC). ` +

    `O cliente possui ${dados.contratos || 0} contratos ativos.`;
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
