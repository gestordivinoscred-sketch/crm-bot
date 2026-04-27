const express = require('express');
const app = express();
app.use(express.json());

const { consultarPromosys } = require('./promosysBot');

app.post('/webhook', async (req, res) => {
  const cpf = req.body.cpf;
  const tipo = req.body.tipo; // IA enviará 'cpf' ou 'telefone'

  if (!cpf) {
    return res.status(400).json({ status: "erro", mensagem: "CPF ou Telefone não enviado" });
  }

  try {
    console.log(`🚀 Iniciando consulta para: ${cpf} | Tipo: ${tipo || 'Auto'}`);

    // Passamos o tipo para o robô
    const dados = await consultarPromosys(cpf, 0, tipo);

    const saldoQuitacaoTotal = (dados.contratos || []).reduce(
      (acc, c) => acc + (Number(c.quitacao) || 0),
      0
    );

    const resposta = {
      status: "ok",
      cpf,
      nome: dados.nome || "Não encontrado",
      margem: Number(dados.margem || 0),
      rmc: Number(dados.rmc || 0),
      rcc: Number(dados.rcc || 0),
      contratosAtivos: dados.totalContratos || 0,
      saldoQuitacaoTotal: Number(saldoQuitacaoTotal.toFixed(2)),
      contratos: dados.contratos || [],
      mensagem: gerarMensagemHumana({ ...dados, saldoQuitacaoTotal })
    };

    return res.json(resposta);
  } catch (err) {
    console.error("❌ Erro fatal:", err.message);
    return res.status(500).json({ status: "erro", mensagem: "Erro interno no servidor" });
  }
});

function gerarMensagemHumana(dados) {
  const nome = dados.nome || "cliente";
  const margem = Number(dados.margem || 0);
  const contratos = dados.totalContratos || 0;
  const saldo = Number(dados.saldoQuitacaoTotal || 0);
  let msg = `Dados do cliente ${nome}: `;
  msg += (margem > 0) ? `Margem de R$ ${margem.toLocaleString('pt-BR')}. ` : `Sem margem. `;
  msg += `Contratos: ${contratos}. Saldo Quitação: R$ ${saldo.toLocaleString('pt-BR')}.`;
  return msg;
}

const PORT = process.env.PORT || 3199;
app.listen(PORT, () => console.log(`🚀 API DIVINOS CRED NA PORTA ${PORT}`));
