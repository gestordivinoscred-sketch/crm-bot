const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('API rodando 🚀');
});

app.listen(3199, () => {
  console.log('Servidor rodando na porta 3199');
});

app.post('/webhook', (req, res) => {
  res.json({
    status: "ok",
    mensagem: "CPF recebido",
    cpf: req.body.cpf
  });
});
