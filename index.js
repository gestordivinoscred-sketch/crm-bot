const express = require('express');
const app = express();

app.use(express.json());

// Importa o robô atualizado
const { consultarPromosys } = require('./promosysBot');

// -----------------------------
// WEBHOOK PARA N8N
// -----------------------------
app.post('/webhook', async (req, res) => {
  const cpf = req.body.cpf;

  if (!cpf) {
    return res.status(400).json({
      status: "erro",
      mensagem: "CPF ou Telefone não enviado"
    });
  }

  try {
    console.log(`🚀 Iniciando consulta para: ${cpf}`);

    // 🤖 CHAMA O ROBÔ (Passando limite de parcela 0 por padrão)
    const dados = await consultarPromosys(cpf, 0);

    // 🔥 Calcula saldo total de quitação (Soma as quitações de todos os contratos)
    const saldoQuitacaoTotal = (dados.contratos || []).reduce(
      (acc, c) => acc + (Number(c.quitacao) || 0),
      0
    );

    // -----------------------------
    // RESPOSTA PADRONIZADA PARA O AGENTE DE IA
    // -----------------------------
    const resposta = {
      status: dados.nome === "Não encontrado" ? "aviso" : "ok",
      cpf,
      nome: dados.nome || "Não encontrado",
      
      // Valores financeiros convertidos para Number (ponto flutuante)
      margem: Number(dados.margem || 0),
      rmc: Number(dados.rmc || 0),
      rcc: Number(dados.rcc || 0),

      contratosAtivos: dados.totalContratos || 0,
      saldoQuitacaoTotal: Number(saldoQuitacaoTotal.toFixed(2)),

      bancos: dados.bancos || [],
      parcelasAltas: dados.parcelasAltas || [],
      contratos: dados.contratos || [],

      // Mensagem formatada para o Agente de IA ler rápido
      mensagem: gerarMensagemHumana({
        ...dados,
        saldoQuitacaoTotal
      })
    };

    console.log(`✅ Consulta finalizada para ${dados.nome}`);
    return res.json(resposta);

  } catch (err) {
    console.error("❌ Erro no Servidor:", err.message);
    return res.status(500).json({
      status: "erro",
      mensagem: "Erro interno ao processar consulta",
      detalhe: err.message
    });
  }
});

// -----------------------------
// GERADOR DE RESUMO (PARA A IA)
// -----------------------------
function gerarMensagemHumana(dados) {
  const nome = dados.nome || "cliente";
  const margem = Number(dados.margem || 0);
  const contratos = dados.totalContratos || 0;
  const saldo = Number(dados.saldoQuitacaoTotal || 0);

  let msg = `O cliente ${nome} foi localizado. `;
  
  if (margem > 0) {
    msg += `Possui margem livre de R$ ${margem.toLocaleString('pt-BR')}. `;
  } else {
    msg += `Não possui margem disponível no momento. `;
  }

  msg += `RMC: R$ ${dados.rmc}. RCC: R$ ${dados.rcc}. `;
  msg += `Total de ${contratos} contratos identificados. `;

  if (saldo > 0) {
    msg += `O valor total estimado para quitação de todos os contratos é de R$ ${saldo.toLocaleString('pt-BR')}.`;
  }

  return msg;
}

// -----------------------------
// ROTA DE SAÚDE (HEALTH CHECK)
// -----------------------------
app.get('/status', (req, res) => {
  res.json({ status: "online", motor: "Playwright", sistema: "Promosys" });
});

// -----------------------------
// SERVIDOR
// -----------------------------
const PORT = process.env.PORT || 3199;
app.listen(PORT, () => {
  console.log(`🚀 Servidor Divinos Cred rodando na porta ${PORT}`);
});
