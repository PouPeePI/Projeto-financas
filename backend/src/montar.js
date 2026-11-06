// Monta o app do Poupee a partir das variáveis de ambiente. Usado pelo
// servidor local (server.js) e pela função da Vercel (api/index.js na raiz).
//   - com DB_HOST definido: usa o MySQL
//   - sem DB_HOST (ou com memoria = true): usa dados de exemplo em memória
const { criarApp } = require('./app');

// Segredo fixo só pro modo demonstração (dados falsos, sem banco)
const SEGREDO_DEMO = 'poupee-modo-demonstracao';

async function montarApp({ env = process.env, memoria = false, connectionLimit } = {}) {
  const usarMemoria = memoria || !env.DB_HOST;
  let repos;

  if (usarMemoria) {
    const { criarRepositoriosMemoria } = require('./repositorios/memoria');
    const { popularExemplo } = require('./repositorios/exemplo');
    repos = criarRepositoriosMemoria();
    await popularExemplo(repos);
    console.log('Usando dados em memória. Login de exemplo: thiago@exemplo.com / 123456');
  } else {
    const { criarPool } = require('./repositorios/mysql/conexao');
    const { criarRepositoriosMysql } = require('./repositorios/mysql');
    const pool = criarPool(env, { connectionLimit });
    await pool.query('SELECT 1'); // falha cedo se o banco não estiver acessível
    repos = criarRepositoriosMysql(pool);
    console.log(`Conectado ao MySQL em ${env.DB_HOST}`);
  }

  let segredoJwt = env.JWT_SEGREDO;
  if (!segredoJwt && usarMemoria) {
    segredoJwt = SEGREDO_DEMO;
  } else if (!segredoJwt) {
    segredoJwt = require('crypto').randomBytes(32).toString('hex');
    console.warn('JWT_SEGREDO não definido: usando um segredo temporário (todo mundo precisa entrar de novo quando o servidor reiniciar)');
  }

  const modo = usarMemoria ? 'memoria' : 'mysql';
  return criarApp(repos, { origemPermitida: env.CORS_ORIGEM || '*', segredoJwt, modo });
}

module.exports = { montarApp };
