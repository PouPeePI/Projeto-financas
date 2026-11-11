// Testa a API de ponta a ponta. Roda sempre com o repositório em memória;
// com DB_TESTE=1 roda a mesma bateria contra um PostgreSQL de verdade
// (banco do .env; as tabelas são criadas se faltarem e ESVAZIADAS!).
require('dotenv').config({ quiet: true });
const test = require('node:test');
const assert = require('node:assert/strict');
const { criarApp } = require('../src/app');
const { criarRepositoriosMemoria } = require('../src/repositorios/memoria');
const { popularExemplo } = require('../src/repositorios/exemplo');

async function subir(repos) {
  const servidor = criarApp(repos, { segredoJwt: 'segredo-de-teste' }).listen(0);
  await new Promise(r => servidor.once('listening', r));
  const base = `http://127.0.0.1:${servidor.address().port}/api`;
  // `token` = quem está chamando; por padrão o usuário de exemplo (definido no before)
  const chamar = async (metodo, caminho, corpo, token = chamar.token) => {
    const resp = await fetch(base + caminho, {
      method: metodo,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
    const texto = await resp.text();
    return { status: resp.status, corpo: texto ? JSON.parse(texto) : null };
  };
  return { servidor, base, chamar };
}

function bateria(nome, prepararRepos) {
  test.describe(nome, () => {
    let servidor, base, chamar, finalizar, tokenOutro;
    const idCategoria = {};

    test.before(async () => {
      const preparo = await prepararRepos();
      finalizar = preparo.finalizar;
      await popularExemplo(preparo.repos);
      ({ servidor, base, chamar } = await subir(preparo.repos));
      const login = await chamar('POST', '/login', { email: 'thiago@exemplo.com', senha: '123456' });
      chamar.token = login.corpo.token;
      const outro = await chamar('POST', '/usuarios', { nome: 'Outra Pessoa', email: 'outra@teste.com', senha: 'segura123', confirmacaoSenha: 'segura123' });
      tokenOutro = outro.corpo.token;
      const { corpo } = await chamar('GET', '/categorias');
      for (const c of corpo) idCategoria[c.nome] = c.id;
    });
    test.after(async () => {
      servidor.close();
      if (finalizar) await finalizar();
    });

    test('exige login: sem token ou com token inválido dá 401', async () => {
      assert.equal((await chamar('GET', '/transacoes', undefined, null)).status, 401);
      assert.equal((await chamar('GET', '/transacoes', undefined, 'abc')).status, 401);
    });

    test('login com senha errada não revela se o e-mail existe', async () => {
      const errada = await chamar('POST', '/login', { email: 'thiago@exemplo.com', senha: 'xxxxxx' }, null);
      const inexistente = await chamar('POST', '/login', { email: 'ninguem@teste.com', senha: '123456' }, null);
      assert.equal(errada.status, 401);
      assert.equal(inexistente.status, 401);
      assert.equal(errada.corpo.erro, inexistente.corpo.erro);
    });

    test('criar conta: valida dados, e-mail único e já vem com categorias padrão', async () => {
      const invalida = await chamar('POST', '/usuarios', { nome: '', email: 'x', senha: '123', confirmacaoSenha: '1234' }, null);
      assert.equal(invalida.status, 400);
      assert.deepEqual(Object.keys(invalida.corpo.campos).sort(), ['email', 'nome', 'senha']);

      const senhas = await chamar('POST', '/usuarios', { nome: 'A', email: 'a@teste.com', senha: '123456', confirmacaoSenha: '654321' }, null);
      assert.equal(senhas.corpo.campos.confirmacaoSenha, 'As senhas não conferem');

      const repetido = await chamar('POST', '/usuarios', { nome: 'Outro', email: 'THIAGO@exemplo.com', senha: '123456' }, null);
      assert.equal(repetido.status, 409);

      const cats = await chamar('GET', '/categorias', undefined, tokenOutro);
      assert.equal(cats.corpo.length, 10);
      const eu = await chamar('GET', '/eu', undefined, tokenOutro);
      assert.equal(eu.corpo.email, 'outra@teste.com');
      assert.equal(eu.corpo.senhaHash, undefined);
    });

    test('guarda a preferência de tema', async () => {
      const r = await chamar('PUT', '/eu', { tema: 'dark' }, tokenOutro);
      assert.equal(r.corpo.tema, 'dark');
      assert.equal((await chamar('PUT', '/eu', { tema: 'azul' }, tokenOutro)).status, 400);
    });

    test('lista categorias por tipo', async () => {
      const r = await chamar('GET', '/categorias?tipo=receita');
      assert.deepEqual(r.corpo.map(c => c.nome), ['Renda Fixa', 'Renda Extra', 'Investimentos']);
    });

    test('balanço de agosto/2026 bate com o seed', async () => {
      const r = await chamar('GET', '/balanco?mes=8&ano=2026');
      assert.equal(r.status, 200);
      assert.equal(r.corpo.totalReceitas, 6120);
      assert.equal(r.corpo.totalDespesas, 554.5);
      assert.equal(r.corpo.saldoRealizado, 5565.5);
      assert.equal(r.corpo.saldoPrevisto, 5565.5);
      assert.equal(r.corpo.gastosPorCategoria[0].nome, 'Alimentação');
    });

    test('balanço de setembro/2026 separa pendentes', async () => {
      const r = await chamar('GET', '/balanco?mes=9&ano=2026');
      assert.equal(r.corpo.totalReceitas, 0);
      assert.equal(r.corpo.despesasPendentes, 1199.9);
      assert.equal(r.corpo.quantidadePendentes, 3);
      assert.equal(r.corpo.saldoRealizado, 0);
      assert.equal(r.corpo.saldoPrevisto, -1199.9);
    });

    test('filtra despesas por mês/ano e status, ordenadas da mais nova', async () => {
      const r = await chamar('GET', '/transacoes?tipo=despesa&mes=9&ano=2026&status=pagar');
      assert.deepEqual(r.corpo.map(t => t.descricao), ['Assinatura streaming', 'Combustível', 'Aluguel']);
      const busca = await chamar('GET', '/transacoes?busca=MERC');
      assert.deepEqual(busca.corpo.map(t => t.descricao), ['Mercado']);
    });

    test('CRUD completo de despesa', async () => {
      const criada = await chamar('POST', '/transacoes', {
        tipo: 'despesa', descricao: 'Conta de luz', valor: '187,35', data: '2026-10-10', categoriaId: idCategoria.Moradia,
      });
      assert.equal(criada.status, 201);
      assert.equal(criada.corpo.valor, 187.35);
      assert.equal(criada.corpo.status, 'pagar');

      const id = criada.corpo.id;
      const editada = await chamar('PUT', `/transacoes/${id}`, { valor: 190 });
      assert.equal(editada.corpo.valor, 190);
      assert.equal(editada.corpo.descricao, 'Conta de luz');

      const paga = await chamar('PATCH', `/transacoes/${id}/status`, { status: 'paga' });
      assert.equal(paga.corpo.status, 'paga');

      assert.equal((await chamar('DELETE', `/transacoes/${id}`)).status, 204);
      assert.equal((await chamar('GET', `/transacoes/${id}`)).status, 404);
    });

    test('recusa valor zero, data inválida e categoria de outro tipo', async () => {
      const zero = await chamar('POST', '/transacoes', { tipo: 'despesa', descricao: 'X', valor: 0, data: '2026-10-10', categoriaId: idCategoria.Moradia });
      assert.equal(zero.status, 400);
      assert.equal(zero.corpo.campos.valor, 'O valor precisa ser maior que zero');

      const data = await chamar('POST', '/transacoes', { tipo: 'despesa', descricao: 'X', valor: 5, data: '2026-02-30', categoriaId: idCategoria.Moradia });
      assert.equal(data.status, 400);

      const tipoErrado = await chamar('POST', '/transacoes', { tipo: 'despesa', descricao: 'X', valor: 5, data: '2026-10-10', categoriaId: idCategoria['Renda Fixa'] });
      assert.equal(tipoErrado.status, 400);
      assert.match(tipoErrado.corpo.erro, /categoria de despesa/);
    });

    test('receita sempre fica como paga e não aceita troca de status', async () => {
      const r = await chamar('POST', '/transacoes', { tipo: 'receita', descricao: 'Bônus', valor: 300, data: '2026-10-05', categoriaId: idCategoria['Renda Extra'], status: 'pagar' });
      assert.equal(r.corpo.status, 'paga');
      const s = await chamar('PATCH', `/transacoes/${r.corpo.id}/status`, { status: 'pagar' });
      assert.equal(s.status, 400);
      await chamar('DELETE', `/transacoes/${r.corpo.id}`);
    });

    test('um usuário não enxerga nem altera dados de outro', async () => {
      const lista = await chamar('GET', '/transacoes', undefined, tokenOutro);
      assert.deepEqual(lista.corpo, []);
      const alheia = await chamar('POST', '/transacoes', { tipo: 'despesa', descricao: 'X', valor: 5, data: '2026-10-10', categoriaId: idCategoria.Moradia }, tokenOutro);
      assert.equal(alheia.status, 400);
      const primeira = (await chamar('GET', '/transacoes')).corpo[0];
      assert.equal((await chamar('DELETE', `/transacoes/${primeira.id}`, undefined, tokenOutro)).status, 404);
    });

    test('categorias: nome único por tipo, não exclui nem muda tipo se estiver em uso', async () => {
      const dup = await chamar('POST', '/categorias', { nome: 'moradia', tipo: 'despesa' });
      assert.equal(dup.status, 409);

      const mudaTipo = await chamar('PUT', `/categorias/${idCategoria.Moradia}`, { tipo: 'receita' });
      assert.equal(mudaTipo.status, 409);

      const emUso = await chamar('DELETE', `/categorias/${idCategoria.Moradia}`);
      assert.equal(emUso.status, 409);

      const nova = await chamar('POST', '/categorias', { nome: 'Pets', tipo: 'despesa', cor: '#123abc' });
      assert.equal(nova.status, 201);
      assert.equal(nova.corpo.cor, '#123ABC');
      const renomeada = await chamar('PUT', `/categorias/${nova.corpo.id}`, { nome: 'Pet shop', favorita: true });
      assert.equal(renomeada.corpo.nome, 'Pet shop');
      assert.equal(renomeada.corpo.favorita, true);
      assert.equal((await chamar('DELETE', `/categorias/${nova.corpo.id}`)).status, 204);
    });

    test('JSON malformado e id inválido viram 400', async () => {
      const r = await fetch(`${base}/transacoes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${chamar.token}` }, body: '{nope',
      });
      assert.equal(r.status, 400);
      assert.equal((await chamar('GET', '/transacoes/abc')).status, 400);
    });
  });
}

bateria('API com repositório em memória', async () => ({ repos: criarRepositoriosMemoria() }));

if (process.env.DB_TESTE === '1') {
  bateria('API com PostgreSQL', async () => {
    const { criarPool, prepararBanco } = require('../src/repositorios/postgres/conexao');
    const { criarRepositoriosPostgres } = require('../src/repositorios/postgres');
    const pool = criarPool();
    await prepararBanco(pool);
    await pool.query('TRUNCATE transacoes, categorias, usuarios RESTART IDENTITY CASCADE');
    return { repos: criarRepositoriosPostgres(pool), finalizar: () => pool.end() };
  });
}
