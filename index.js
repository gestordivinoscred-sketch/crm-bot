const express = require('express');
const app = express();

app.use(express.json());

// importa o robô
const { consultarPromosys } = require('./promosysBot');

// -----------------------------
// FUNÇÃO DE REGRA DE CRM
// -----------------------------
function montarResposta(cpf, margem) {

  const valor = Number(margem);

  if (valor > 0) {
    return {
      status: "ok",
      cpf,
      mensagem: `Cliente tem R$ ${valor.toFixed(2)} de margem`,
      tipo: "positiva",
      margem: valor
    };
  }

  if (valor < 0) {
    return {
      status: "ok",
      cpf,
      mensagem: `Cliente com margem negativa de R$ ${valor.toFixed(2)}`,
      tipo: "negativa",
      margem: valor
    };
  }

  return {
    status: "ok",
    cpf,
    mensagem: "Cliente sem margem",
    tipo: "zero",
    margem: 0
  };
}

// -----------------------------
// WEBHOOK (N8N / POSTMAN)
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

    // 🤖 CHAMA O ROBÔ REAL
    const margem = await consultarPromosys(cpf);

    const resposta = montarResposta(cpf, margem);

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
