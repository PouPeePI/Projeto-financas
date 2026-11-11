// Pool de conexões com o PostgreSQL (ex.: Neon). Configuração vem das
// variáveis de ambiente (veja backend/.env.example):
//   - DATABASE_URL: endereço completo, como o Neon e a Vercel fornecem
//     (postgresql://usuario:senha@host/banco?sslmode=require)
//   - ou DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME (Postgres local)
const fs = require('fs');
const path = require('path');
const { Pool, types } = require('pg');

// DATE chega como texto 'AAAA-MM-DD' (sem fuso horário no meio);
// NUMERIC já chega como texto e vira centavos no repositório
types.setTypeParser(1082, v => v);

// Endereço do banco: DATABASE_URL ou o equivalente da integração Neon/Vercel
function urlDoBanco(env = process.env) {
  return env.DATABASE_URL || env.POSTGRES_URL || null;
}

function temBancoConfigurado(env = process.env) {
  return Boolean(urlDoBanco(env) || env.DB_HOST);
}

function criarPool(env = process.env, { max = 10 } = {}) {
  const url = urlDoBanco(env);
  if (url) return new Pool({ connectionString: url, max });
  return new Pool({
    host: env.DB_HOST || 'localhost',
    port: Number(env.DB_PORT || 5432),
    user: env.DB_USER || 'postgres',
    password: env.DB_PASSWORD || '',
    database: env.DB_NAME || 'poupee',
    max,
  });
}

// Num banco vazio (ex.: Neon recém-criado), cria as tabelas de db/schema.sql
// e os dados de exemplo de db/seed.sql. O lock evita que duas instâncias
// da Vercel façam isso ao mesmo tempo. (Caminhos escritos por extenso para
// a Vercel perceber que precisa levar os .sql junto com a função.)
async function prepararBanco(pool) {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    await cliente.query('SELECT pg_advisory_xact_lock(7234001)');
    const { rows } = await cliente.query("SELECT to_regclass('public.usuarios') AS tabela");
    if (!rows[0].tabela) {
      await cliente.query(fs.readFileSync(path.join(__dirname, '../../../../db/schema.sql'), 'utf8'));
      await cliente.query(fs.readFileSync(path.join(__dirname, '../../../../db/seed.sql'), 'utf8'));
      console.log('Banco vazio: tabelas e dados de exemplo criados');
    }
    await cliente.query('COMMIT');
  } catch (err) {
    await cliente.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    cliente.release();
  }
}

module.exports = { criarPool, prepararBanco, temBancoConfigurado };
