// Função da Vercel: todas as requisições /api/... caem aqui (ver vercel.json)
// e são atendidas pelo mesmo app Express do back-end.
// Variáveis de ambiente (configuradas no painel da Vercel): DB_HOST, DB_PORT,
// DB_USER, DB_PASSWORD, DB_NAME, DB_SSL, DB_SSL_CA, JWT_SEGREDO.
// Sem DB_HOST, roda em modo demonstração (dados de exemplo em memória).
const { montarApp } = require('../backend/src/montar');

let appPronto = null;

module.exports = async (req, res) => {
  // O app é montado uma vez por instância e reaproveitado nas próximas chamadas
  if (!appPronto) {
    appPronto = montarApp({ connectionLimit: 2 }).catch(err => {
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
