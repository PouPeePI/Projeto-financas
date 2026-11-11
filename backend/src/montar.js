// Monta o app do Poupee a partir das variáveis de ambiente. Usado pelo
// servidor local (server.js) e pela função da Vercel (api/index.js na raiz).
//   - com DATABASE_URL (Neon) ou DB_HOST definido: usa o PostgreSQL
//   - sem nenhum dos dois (ou com memoria = true): usa dados de exemplo em memória
const { criarApp } = require('./app');
const { temBancoConfigurado } = require('./repositorios/postgres/conexao');

// Segredo fixo só pro modo demonstração (dados falsos, sem banco)
const SEGREDO_DEMO = 'poupee-modo-demonstracao';

async function montarApp({ env = process.env, memoria = false, maxConexoes } = {}) {
  const usarMemoria = memoria || !temBancoConfigurado(env);
  let repos;

  if (usarMemoria) {
    const { criarRepositoriosMemoria } = require('./repositorios/memoria');
    const { popularExemplo } = require('./repositorios/exemplo');
    repos = criarRepositoriosMemoria();
    await popularExemplo(repos);
    console.log('Usando dados em memória. Login de exemplo: thiago@exemplo.com / 123456');
  } else {
    const { criarPool, prepararBanco } = require('./repositorios/postgres/conexao');
    const { criarRepositoriosPostgres } = require('./repositorios/postgres');
    const pool = criarPool(env, { max: maxConexoes });
    await prepararBanco(pool); // falha cedo se o banco não estiver acessível; cria as tabelas se estiver vazio
    repos = criarRepositoriosPostgres(pool);
    console.log('Conectado ao PostgreSQL');
  }

  let segredoJwt = env.JWT_SEGREDO;
  if (!segredoJwt && usarMemoria) {
    segredoJwt = SEGREDO_DEMO;
  } else if (!segredoJwt) {
    segredoJwt = require('crypto').randomBytes(32).toString('hex');
    console.warn('JWT_SEGREDO não definido: usando um segredo temporário (todo mundo precisa entrar de novo quando o servidor reiniciar)');
  }

  const modo = usarMemoria ? 'memoria' : 'postgres';
  return criarApp(repos, { origemPermitida: env.CORS_ORIGEM || '*', segredoJwt, modo });
}

module.exports = { montarApp };
