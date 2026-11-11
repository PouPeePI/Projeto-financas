// Função da Vercel: todas as requisições /api/... caem aqui (ver vercel.json)
// e são atendidas pelo mesmo app Express do back-end.
// Variáveis de ambiente (painel da Vercel): DATABASE_URL (a integração com o
// Neon cria sozinha) e JWT_SEGREDO.
// Sem DATABASE_URL, roda em modo demonstração (dados de exemplo em memória).
const { montarApp } = require('../backend/src/montar');

let appPronto = null;

module.exports = async (req, res) => {
  // O app é montado uma vez por instância e reaproveitado nas próximas chamadas
  if (!appPronto) {
    appPronto = montarApp({ maxConexoes: 2 }).catch(err => {
      appPronto = null; // tenta de novo na próxima requisição
      throw err;
    });
  }
  try {
    const app = await appPronto;
    return app(req, res);
  } catch (err) {
    console.error('Não foi possível iniciar a API:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ erro: 'Não foi possível conectar ao banco de dados' }));
  }
};
