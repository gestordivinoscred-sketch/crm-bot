const express = require('express');
const app = express();

app.use(express.json());

app.get('/', (req, res) => {
  res.send('API rodando 🚀');
});

app.post('/webhook', (req, res) => {
  res.json({
    status: "ok",
    mensagem: "CPF recebido",
    cpf: req.body.cpf
  });
});

app.listen(process.env.PORT || 3199);
