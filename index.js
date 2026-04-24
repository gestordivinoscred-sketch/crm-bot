const express = require('express');
const app = express();

app.use(express.json());

/**
 * Função que monta a resposta do CRM
 */
function montarResposta(cpf, margem) {

  const valor = Number(margem);

  // margem positiva
  if (valor > 0) {
    return {
      status: "ok",
      cpf,
      mensagem: `Cliente tem R$ ${valor.toFixed(2)} de margem`,
      tipo: "positiva",
      margem: valor
    };
  }

  // margem negativa
  if (valor < 0) {
    return {
      status: "ok",
      cpf,
      mensagem: `Cliente com margem negativa de R$ ${valor.toFixed(2)}`,
      tipo: "negativa",
      margem: valor
    };
  }

  // zero
  return {
    status: "ok",
    cpf,
    mensagem: "Cliente sem margem",
    tipo: "zero",
    margem: 0
  };
}

/**
 * WEBHOOK principal (n8n / Postman)
 */
app.post('/webhook', async (req, res) => {

  const cpf = req.body.cpf;

  if (!cpf) {
    return res.status(400).json({
      status: "erro",
      mensagem: "CPF não enviado"
    });
  }

  // 🔴 POR ENQUANTO SIMULADO
  // depois isso vira Playwright no Promosys
  const margemSimulada = 350;

  const resposta = montarResposta(cpf, margemSimulada);

  return res.json(resposta);
});

/**
 * teste simples da API
 */
app.get('/', (req, res) => {
  res.send('API rodando 🚀');
});

/**
 * inicia servidor
 */
app.listen(process.env.PORT || 3000, () => {
  console.log('Servidor rodando 🚀');
});
