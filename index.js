const express = require('express');
const app = express();

app.use(express.json());

app.post('/buscar', (req, res) => {
  const nome = req.body.nome;

  res.json({
    nome: nome,
    margem: "R$ 1000 (teste)"
  });
});

app.listen(3000, () => {
  console.log('Rodando na porta 3000');
});