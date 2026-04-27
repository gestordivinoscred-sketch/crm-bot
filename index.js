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

    // 🤖 CHAMA O ROBÔ
    // O segundo parâmetro (0) é o limite para considerar uma parcela "alta"
    const dados = await consultarPromosys(cpf, 0);

    // 🔥 Calcula saldo total de quitação (Soma as quitações de todos os contratos capturados)
    const saldoQuitacaoTotal = (dados.contratos || []).reduce(
      (acc, c) => acc + (Number(c.quitacao) || 0),
      0
    );

    // -----------------------------
    // RESPOSTA ESTRUTURADA PARA O AGENTE DE IA
    // -----------------------------
    const resposta = {
      status: "ok",
      cpf,
      nome: dados.nome || "Não encontrado",
      
      // Valores financeiros garantidos como Números
      margem: Number(dados.margem || 0),
      rmc: Number(dados.rmc || 0),
      rcc: Number(dados.rcc || 0),

      contratosAtivos: dados.totalContratos || 0,
      saldoQuitacaoTotal: Number(saldoQuitacaoTotal.toFixed(2)),

      bancos: dados.bancos || [],
      parcelasAltas: dados.parcelasAltas || [],
      contratos: dados.contratos || [], // Array completo com banco, taxa, parcela e quitação

      // Texto de apoio para a IA processar rápido
      mensagem: gerarMensagemHumana({
        ...dados,
        saldoQuitacaoTotal
      })
    };

    console.log(`✅ Resultado enviado para o n8n: ${dados.nome}`);
    return res.json(resposta);

  } catch (err) {
    console.error("❌ Erro fatal no servidor:", err.message);
    return res.status(500).json({
      status: "erro",
      mensagem: "Erro ao processar a consulta no servidor",
      detalhe: err.message
    });
  }
});

// -----------------------------
// FORMATADOR DE RESUMO
// -----------------------------
function gerarMensagemHumana(dados) {
  const nome = dados.nome || "cliente";
  const margem = Number(dados.margem || 0);
  const contratos = dados.totalContratos || 0;
  const saldo = Number(dados.saldoQuitacaoTotal || 0);

  let msg = `Dados do cliente ${nome}: `;
  
  msg += (margem > 0) 
    ? `Margem disponível de R$ ${margem.toLocaleString('pt-BR')}. `
    : `Sem margem disponível. `;

  msg += `RMC: R$ ${dados.rmc}. RCC: R$ ${dados.rcc}. `;
  msg += `Identificamos ${contratos} contrato(s). `;

  if (saldo > 0) {
    msg += `Saldo total para quitação aproximado: R$ ${saldo.toLocaleString('pt-BR')}.`;
  }

  return msg;
}

// -----------------------------
// ROTA DE TESTE (HEALTH CHECK)
// -----------------------------
app.get('/status', (req, res) => {
  res.json({ 
    online: true, 
    empresa: "Divinos Cred",
    servico: "Consulta Automática Promosys" 
  });
});

// -----------------------------
// INICIALIZAÇÃO
// -----------------------------
const PORT = process.env.PORT || 3199;
app.listen(PORT, () => {
  console.log(`
  =========================================
  🚀 API DIVINOS CRED / PROMOSYS RODANDO NA PORTA ${PORT}
  🤖 Playwright: Ativo
  =========================================
  `);
});
