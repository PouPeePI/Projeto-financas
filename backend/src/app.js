// =====================================================================
// API REST do Poupee. Recebe os repositórios por parâmetro: em produção
// são os do PostgreSQL, nos testes são os em memória.
// =====================================================================
const express = require('express');
const { ErroApp, ErroValidacao } = require('./erros');
const { criarServicoCategorias } = require('./servicos/categorias');
const { criarServicoTransacoes } = require('./servicos/transacoes');
const { criarServicoBalanco } = require('./servicos/balanco');
const { criarServicoUsuarios } = require('./servicos/usuarios');

function idDaRota(req) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new ErroValidacao({ id: 'Id inválido' });
  return id;
}

// Repassa erro de função async pro tratador de erros do Express
const rota = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

// Erros que o PostgreSQL pode devolver mesmo com a validação do back-end
// (ex.: duas requisições ao mesmo tempo criando a mesma categoria).
// Códigos em https://www.postgresql.org/docs/current/errcodes-appendix.html
function traduzirErroBanco(err) {
  if (err.code === '23505') return { status: 409, erro: 'Esse registro já existe' };
  if (err.code === '23503') {
    // DELETE de algo que ainda é usado x INSERT/UPDATE apontando pra algo que não existe
    if (/still referenced|ainda é referenciad/i.test(err.detail || '')) return { status: 409, erro: 'Registro em uso por outros lançamentos' };
    return { status: 400, erro: 'Categoria ou usuário inexistente' };
  }
  if (err.code === '23514') return { status: 400, erro: 'Valor fora das regras do banco de dados' };
  if (err.code === 'P0001') return { status: 400, erro: err.message }; // RAISE EXCEPTION dos triggers
  return null;
}

function criarApp(repos, { origemPermitida = '*', segredoJwt, modo = 'postgres' }) {
  if (!segredoJwt) throw new Error('criarApp precisa de segredoJwt');
  const usuarios = criarServicoUsuarios(repos, { segredoJwt });
  const categorias = criarServicoCategorias(repos);
  const transacoes = criarServicoTransacoes(repos);
  const balanco = criarServicoBalanco(repos);

  const app = express();
  app.use(express.json());

  // CORS: o front pode rodar separado (Live Server); na Vercel fica no mesmo endereço
  app.use((req, res, next) => {
    res.set('Access-Control-Allow-Origin', origemPermitida);
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  // modo: 'postgres' ou 'memoria' (demonstração, sem banco: os dados podem sumir)
  app.get('/api/saude', (req, res) => res.json({ ok: true, modo }));

  // ---------- Conta (rotas abertas) ----------
  app.post('/api/usuarios', rota(async (req, res) => {
    res.status(201).json(await usuarios.cadastrar(req.body));
  }));
  app.post('/api/login', rota(async (req, res) => {
    res.json(await usuarios.entrar(req.body));
  }));

  // Daqui pra baixo tudo exige "Authorization: Bearer <token>"
  const api = express.Router();
  api.use((req, res, next) => {
    const [esquema, token] = (req.get('Authorization') || '').split(' ');
    const conferir = esquema === 'Bearer' && token ? usuarios.usuarioDoToken(token) : Promise.resolve(null);
    conferir.then(id => {
      if (!id) throw new ErroApp('Sessão expirada ou inválida. Entre novamente.', 401);
      req.usuarioId = id;
      next();
    }).catch(next);
  });

  api.get('/eu', rota(async (req, res) => {
    res.json(await usuarios.obter(req.usuarioId));
  }));
  api.put('/eu', rota(async (req, res) => {
    res.json(await usuarios.atualizar(req.usuarioId, req.body));
  }));

  // ---------- Categorias ----------
  api.get('/categorias', rota(async (req, res) => {
    res.json(await categorias.listar(req.usuarioId, { tipo: req.query.tipo }));
  }));
  api.get('/categorias/:id', rota(async (req, res) => {
    res.json(await categorias.obter(req.usuarioId, idDaRota(req)));
  }));
  api.post('/categorias', rota(async (req, res) => {
    res.status(201).json(await categorias.criar(req.usuarioId, req.body));
  }));
  api.put('/categorias/:id', rota(async (req, res) => {
    res.json(await categorias.atualizar(req.usuarioId, idDaRota(req), req.body));
  }));
  api.delete('/categorias/:id', rota(async (req, res) => {
    await categorias.excluir(req.usuarioId, idDaRota(req));
    res.sendStatus(204);
  }));

  // ---------- Lançamentos (despesas e receitas) ----------
  // GET /api/transacoes?tipo=despesa&mes=9&ano=2026&status=pagar&busca=mercado
  api.get('/transacoes', rota(async (req, res) => {
    res.json(await transacoes.listar(req.usuarioId, req.query));
  }));
  api.get('/transacoes/:id', rota(async (req, res) => {
    res.json(await transacoes.obter(req.usuarioId, idDaRota(req)));
  }));
  api.post('/transacoes', rota(async (req, res) => {
    res.status(201).json(await transacoes.criar(req.usuarioId, req.body));
  }));
  api.put('/transacoes/:id', rota(async (req, res) => {
    res.json(await transacoes.atualizar(req.usuarioId, idDaRota(req), req.body));
  }));
  api.patch('/transacoes/:id/status', rota(async (req, res) => {
    res.json(await transacoes.alterarStatus(req.usuarioId, idDaRota(req), (req.body || {}).status));
  }));
  api.delete('/transacoes/:id', rota(async (req, res) => {
    await transacoes.excluir(req.usuarioId, idDaRota(req));
    res.sendStatus(204);
  }));

  // ---------- Balanço ----------
  // GET /api/balanco?mes=9&ano=2026
  api.get('/balanco', rota(async (req, res) => {
    res.json(await balanco.calcular(req.usuarioId, req.query));
  }));

  app.use('/api', api);

  app.use((req, res) => res.status(404).json({ erro: 'Rota não encontrada' }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof ErroApp) {
      return res.status(err.status).json({ erro: err.message, ...(err.campos ? { campos: err.campos } : {}) });
    }
    if (err.type === 'entity.parse.failed') return res.status(400).json({ erro: 'JSON inválido' });
    const doBanco = traduzirErroBanco(err);
    if (doBanco) return res.status(doBanco.status).json({ erro: doBanco.erro });
    console.error(err);
    res.status(500).json({ erro: 'Erro interno no servidor' });
  });

  return app;
}

module.exports = { criarApp };
