// =====================================================================
// REPOSITÓRIOS POSTGRESQL — única parte do back-end que escreve SQL.
// Tabelas definidas em db/schema.sql (Pessoa 4). Toda consulta filtra
// por usuario_id, então um usuário nunca enxerga dado de outro.
// =====================================================================
const { valorParaCentavos } = require('../../regras/validacao');

const linhaParaUsuario = r => ({
  id: r.id,
  nome: r.nome,
  email: r.email,
  senhaHash: r.senha_hash,
  tema: r.tema,
  criadoEm: r.criado_em,
});

const linhaParaCategoria = r => ({
  id: r.id,
  usuarioId: r.usuario_id,
  nome: r.nome,
  cor: r.cor,
  icone: r.icone,
  tipo: r.tipo,
  favorita: Boolean(r.favorita),
  ordem: r.ordem,
});

const linhaParaTransacao = r => ({
  id: r.id,
  usuarioId: r.usuario_id,
  categoriaId: r.categoria_id,
  tipo: r.tipo,
  descricao: r.descricao,
  valorCentavos: valorParaCentavos(r.valor),
  data: r.data,
  status: r.status,
});

const centavosParaDecimal = c => (c / 100).toFixed(2);

// Monta o WHERE dos filtros ($1, $2... são os parâmetros, na ordem de `params`).
// Com ano informado usa intervalo de datas, que aproveita o índice idx_transacoes_usuario_data.
function whereFiltros(usuarioId, filtros) {
  const condicoes = [];
  const params = [];
  const p = valor => { params.push(valor); return `$${params.length}`; };

  condicoes.push(`usuario_id = ${p(usuarioId)}`);
  if (filtros.tipo) condicoes.push(`tipo = ${p(filtros.tipo)}`);
  if (filtros.ano && filtros.mes) {
    const inicio = p(`${filtros.ano}-${String(filtros.mes).padStart(2, '0')}-01`);
    condicoes.push(`data >= ${inicio}::date AND data < (${inicio}::date + INTERVAL '1 month')`);
  } else if (filtros.ano) {
    condicoes.push(`data >= ${p(`${filtros.ano}-01-01`)}::date AND data < ${p(`${filtros.ano + 1}-01-01`)}::date`);
  } else if (filtros.mes) {
    condicoes.push(`EXTRACT(MONTH FROM data) = ${p(filtros.mes)}`);
  }
  if (filtros.status) condicoes.push(`status = ${p(filtros.status)}`);
  if (filtros.busca) condicoes.push(`descricao ILIKE ${p(`%${filtros.busca.replace(/[\\%_]/g, '\\$&')}%`)}`);
  return { sql: condicoes.join(' AND '), params };
}

// UPDATE só das colunas enviadas: devolve "a = $1, b = $2" e os valores na mesma ordem
function setParcial(d, colunas, converter = (k, v) => v) {
  const campos = Object.keys(d).filter(k => colunas[k]);
  return {
    total: campos.length,
    sql: campos.map((k, i) => `${colunas[k]} = $${i + 1}`).join(', '),
    valores: campos.map(k => converter(k, d[k])),
  };
}

function criarRepositoriosPostgres(pool) {
  const consultar = async (sql, params) => (await pool.query(sql, params)).rows;

  const usuarios = {
    async criar(d) {
      const [r] = await consultar(
        'INSERT INTO usuarios (nome, email, senha_hash) VALUES ($1, $2, $3) RETURNING *',
        [d.nome, d.email, d.senhaHash],
      );
      return linhaParaUsuario(r);
    },
    async buscarPorId(id) {
      const linhas = await consultar('SELECT * FROM usuarios WHERE id = $1', [id]);
      return linhas.length ? linhaParaUsuario(linhas[0]) : null;
    },
    async buscarPorEmail(email) {
      const linhas = await consultar('SELECT * FROM usuarios WHERE email = $1', [email]);
      return linhas.length ? linhaParaUsuario(linhas[0]) : null;
    },
    async atualizar(id, d) {
      const { total, sql, valores } = setParcial(d, { nome: 'nome', tema: 'tema', senhaHash: 'senha_hash' });
      if (total) await consultar(`UPDATE usuarios SET ${sql} WHERE id = $${total + 1}`, [...valores, id]);
      return usuarios.buscarPorId(id);
    },
  };

  const categorias = {
    async listar(usuarioId, { tipo } = {}) {
      const linhas = tipo
        ? await consultar('SELECT * FROM categorias WHERE usuario_id = $1 AND tipo = $2 ORDER BY ordem, id', [usuarioId, tipo])
        : await consultar('SELECT * FROM categorias WHERE usuario_id = $1 ORDER BY ordem, id', [usuarioId]);
      return linhas.map(linhaParaCategoria);
    },
    async buscarPorId(usuarioId, id) {
      const linhas = await consultar('SELECT * FROM categorias WHERE usuario_id = $1 AND id = $2', [usuarioId, id]);
      return linhas.length ? linhaParaCategoria(linhas[0]) : null;
    },
    async buscarPorNome(usuarioId, nome, tipo) {
      // compara sem diferenciar maiúscula/minúscula (mesma regra do índice único)
      const linhas = await consultar(
        'SELECT * FROM categorias WHERE usuario_id = $1 AND lower(nome) = lower($2) AND tipo = $3',
        [usuarioId, nome, tipo],
      );
      return linhas.length ? linhaParaCategoria(linhas[0]) : null;
    },
    async criar(usuarioId, d) {
      const [r] = await consultar(
        'INSERT INTO categorias (usuario_id, nome, cor, icone, tipo, favorita, ordem) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
        [usuarioId, d.nome, d.cor, d.icone, d.tipo, Boolean(d.favorita), d.ordem || 0],
      );
      return linhaParaCategoria(r);
    },
    async atualizar(usuarioId, id, d) {
      const colunas = { nome: 'nome', cor: 'cor', icone: 'icone', tipo: 'tipo', favorita: 'favorita', ordem: 'ordem' };
      const { total, sql, valores } = setParcial(d, colunas);
      if (total) {
        await consultar(
          `UPDATE categorias SET ${sql} WHERE usuario_id = $${total + 1} AND id = $${total + 2}`,
          [...valores, usuarioId, id],
        );
      }
      return categorias.buscarPorId(usuarioId, id);
    },
    async excluir(usuarioId, id) {
      const r = await pool.query('DELETE FROM categorias WHERE usuario_id = $1 AND id = $2', [usuarioId, id]);
      return r.rowCount > 0;
    },
    async contarTransacoes(usuarioId, id) {
      const linhas = await consultar(
        'SELECT COUNT(*) AS total FROM transacoes WHERE usuario_id = $1 AND categoria_id = $2',
        [usuarioId, id],
      );
      return Number(linhas[0].total);
    },
  };

  const transacoes = {
    async listar(usuarioId, filtros = {}) {
      const { sql, params } = whereFiltros(usuarioId, filtros);
      const linhas = await consultar(`SELECT * FROM transacoes WHERE ${sql} ORDER BY data DESC, id DESC`, params);
      return linhas.map(linhaParaTransacao);
    },
    async buscarPorId(usuarioId, id) {
      const linhas = await consultar('SELECT * FROM transacoes WHERE usuario_id = $1 AND id = $2', [usuarioId, id]);
      return linhas.length ? linhaParaTransacao(linhas[0]) : null;
    },
    async criar(usuarioId, d) {
      const [r] = await consultar(
        'INSERT INTO transacoes (usuario_id, categoria_id, tipo, descricao, valor, data, status) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
        [usuarioId, d.categoriaId, d.tipo, d.descricao, centavosParaDecimal(d.valorCentavos), d.data, d.status],
      );
      return linhaParaTransacao(r);
    },
    async atualizar(usuarioId, id, d) {
      const colunas = { categoriaId: 'categoria_id', tipo: 'tipo', descricao: 'descricao', valorCentavos: 'valor', data: 'data', status: 'status' };
      const { total, sql, valores } = setParcial(d, colunas, (k, v) => (k === 'valorCentavos' ? centavosParaDecimal(v) : v));
      if (total) {
        await consultar(
          `UPDATE transacoes SET ${sql} WHERE usuario_id = $${total + 1} AND id = $${total + 2}`,
          [...valores, usuarioId, id],
        );
      }
      return transacoes.buscarPorId(usuarioId, id);
    },
    async excluir(usuarioId, id) {
      const r = await pool.query('DELETE FROM transacoes WHERE usuario_id = $1 AND id = $2', [usuarioId, id]);
      return r.rowCount > 0;
    },
  };

  return { usuarios, categorias, transacoes };
}

module.exports = { criarRepositoriosPostgres, whereFiltros };
