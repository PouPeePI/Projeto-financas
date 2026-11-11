// =====================================================================
// FILTROS — período (mês/ano), tipo, status e busca por descrição.
// Mês e ano são independentes, igual ao protótipo: dá pra ver
// "Setembro de todos os anos" ou "o ano de 2026 inteiro".
// =====================================================================
const { ErroValidacao } = require('../erros');
const { TIPOS, STATUS_DESPESA } = require('./validacao');

// Lê os filtros da query string (?mes=9&ano=2026&tipo=despesa&status=pagar&busca=mer)
// "todos" ou vazio = sem filtro.
function lerFiltros(query = {}) {
  const erros = {};
  const filtros = {};
  const vazio = v => v === undefined || v === '' || v === 'todos' || v === 'todas';

  if (!vazio(query.mes)) {
    const mes = Number(query.mes);
    if (!Number.isInteger(mes) || mes < 1 || mes > 12) erros.mes = 'O mês precisa ser de 1 a 12';
    else filtros.mes = mes;
  }
  if (!vazio(query.ano)) {
    const ano = Number(query.ano);
    if (!Number.isInteger(ano) || ano < 1900 || ano > 2999) erros.ano = 'Ano inválido';
    else filtros.ano = ano;
  }
  if (!vazio(query.tipo)) {
    if (!TIPOS.includes(query.tipo)) erros.tipo = 'O tipo precisa ser "despesa" ou "receita"';
    else filtros.tipo = query.tipo;
  }
  if (!vazio(query.status)) {
    if (!STATUS_DESPESA.includes(query.status)) erros.status = 'O status precisa ser "pagar" ou "paga"';
    else filtros.status = query.status;
  }
  if (typeof query.busca === 'string' && query.busca.trim()) {
    filtros.busca = query.busca.trim();
  }

  if (Object.keys(erros).length) throw new ErroValidacao(erros);
  return filtros;
}

// Mesma regra do WHERE do PostgreSQL, usada pelo repositório em memória
function correspondeFiltros(t, filtros) {
  const [ano, mes] = t.data.split('-').map(Number);
  if (filtros.tipo && t.tipo !== filtros.tipo) return false;
  if (filtros.mes && mes !== filtros.mes) return false;
  if (filtros.ano && ano !== filtros.ano) return false;
  if (filtros.status && t.status !== filtros.status) return false;
  if (filtros.busca && !t.descricao.toLowerCase().includes(filtros.busca.toLowerCase())) return false;
  return true;
}

module.exports = { lerFiltros, correspondeFiltros };
