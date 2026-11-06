// Pool de conexões com o MySQL. Configuração vem das variáveis de ambiente
// (veja backend/.env.example).
const mysql = require('mysql2/promise');

// DB_SSL=true liga TLS (obrigatório na maioria dos MySQL na nuvem).
// DB_SSL_CA recebe o certificado da CA em texto (PEM), quando o provedor fornece um.
function configSsl(env) {
  if (!['1', 'true', 'sim'].includes(String(env.DB_SSL || '').toLowerCase())) return undefined;
  const ssl = { minVersion: 'TLSv1.2', rejectUnauthorized: true };
  if (env.DB_SSL_CA) ssl.ca = env.DB_SSL_CA.replace(/\\n/g, '\n');
  return ssl;
}

function criarPool(env = process.env, { connectionLimit = 10 } = {}) {
  return mysql.createPool({
    host: env.DB_HOST || 'localhost',
    port: Number(env.DB_PORT || 3306),
    user: env.DB_USER || 'root',
    password: env.DB_PASSWORD || '',
    database: env.DB_NAME || 'poupee',
    connectionLimit,
    ssl: configSsl(env),
    dateStrings: ['DATE'], // devolve DATE como 'AAAA-MM-DD', sem fuso horário no meio
    decimalNumbers: false, // DECIMAL chega como texto e vira centavos no repositório
    charset: 'utf8mb4',
  });
}

module.exports = { criarPool };
