// =====================================================================
// ESTADO DA APLICAÇÃO (carregado da API depois do login)
// =====================================================================
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const MESES_ABREV = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];

// Categorias do usuário — cada uma pertence a despesas ou receitas
const categorias = [];
// Lançamentos — despesas têm status (pagar/paga); receitas ficam sempre como recebidas
const transacoes = [];

// Filtro de período compartilhado entre Dashboard, Despesas e Receitas
const filtroPeriodo = { mes:'todos', ano:'todos' };
const filtroLista = { buscaDespesas:'', buscaReceitas:'', statusDespesas:'todas' };

let categoriaEditandoId = null; // null = criando categoria nova
let lancamentoEditandoId = null; // null = criando lançamento novo
let novoLancamentoTipo = 'despesa';

// =====================================================================
// COMUNICAÇÃO COM A API (back-end em backend/, mesma origem na Vercel)
// =====================================================================
// Aberto pelo Live Server ou direto do arquivo: a API roda em localhost:3000.
// Servido pela própria API (npm start) ou pela Vercel: mesmo endereço.
const API_BASE = (location.protocol === 'file:' || ['5500','5501'].includes(location.port))
  ? 'http://localhost:3000/api'
  : '/api';
const TOKEN_KEY = 'poupee_token';
let usuarioAtual = null;

function tokenSalvo(){ try{ return localStorage.getItem(TOKEN_KEY); }catch(e){ return null; } }

async function api(metodo, caminho, corpo){
  const headers = {};
  const token = tokenSalvo();
  if(token) headers.Authorization = `Bearer ${token}`;
  if(corpo !== undefined) headers['Content-Type'] = 'application/json';
  let resp;
  try{
    resp = await fetch(API_BASE + caminho, { method: metodo, headers, body: corpo === undefined ? undefined : JSON.stringify(corpo) });
  }catch(e){
    throw new Error('Não foi possível falar com o servidor. Verifique sua conexão.');
  }
  const texto = await resp.text();
  let dados = null;
  try{ dados = texto ? JSON.parse(texto) : null; }catch(e){ dados = null; }
  if(!resp.ok){
    // Token vencido ou inválido: volta pro login (menos na própria tela de login)
    if(resp.status === 401 && token){
      sairDaConta();
      showView('login');
    }
    const campos = dados && dados.campos ? Object.values(dados.campos) : [];
    const erro = new Error(campos[0] || (dados && dados.erro) || 'Algo deu errado. Tente de novo.');
    erro.status = resp.status;
    throw erro;
  }
  return dados;
}

// A API devolve ids numéricos; o front usa texto (data-* do HTML)
function categoriaDaApi(c){
  return { id:String(c.id), nome:c.nome, cor:c.cor, tipo:c.tipo, icone:c.icone, favorita:!!c.favorita, ordem:Number(c.ordem) || 0 };
}
function transacaoDaApi(t){
  return { id:String(t.id), tipo:t.tipo, descricao:t.descricao, valor:Number(t.valor), data:t.data, categoriaId:String(t.categoriaId), status:t.status };
}

// Busca categorias e lançamentos do usuário. Os filtros de período/busca
// são aplicados aqui no front sobre essa lista.
async function carregarDados(){
  const [cats, txs] = await Promise.all([api('GET', '/categorias'), api('GET', '/transacoes')]);
  categorias.splice(0, categorias.length, ...cats.map(categoriaDaApi));
  transacoes.splice(0, transacoes.length, ...txs.map(transacaoDaApi));
}

// Recarrega depois de criar/editar/excluir e redesenha a tela atual
async function recarregarERenderizar(){
  await carregarDados();
  popularSelectsPeriodo();
  renderDashboard();
  renderDespesas();
  renderReceitas();
  renderCategorias();
}

// Executa uma ação na API mostrando o erro num toast, se der errado
async function tentar(acao){
  try{ return await acao(); }
  catch(e){ toast(e.message, 'error'); return undefined; }
}

// =====================================================================
// HELPERS
// =====================================================================
function formatarMoeda(valor){
  return valor.toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
}
function parseDataLocal(str){
  const [ano,mes,dia] = str.split('-').map(Number);
  return new Date(ano, mes-1, dia);
}
function formatarDataCurta(str){
  const d = parseDataLocal(str);
  return `${String(d.getDate()).padStart(2,'0')} ${MESES_ABREV[d.getMonth()]}`;
}
const CATEGORIA_DESCONHECIDA = { id:'', nome:'Sem categoria', cor:'#6B6B66', icone:'📦' };
function categoriaPorId(id){ return categorias.find(c => c.id === id) || CATEGORIA_DESCONHECIDA; }

function toast(mensagem, tipo){
  const container = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = 'toast' + (tipo === 'error' ? ' error' : '');
  el.textContent = mensagem;
  container.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 250);
  }, 2600);
}

// Filtra transações pelo tipo + período selecionado (mês/ano) + busca + status (opcional)
function transacoesFiltradas(tipo, { busca = '', status = 'todas' } = {}){
  return transacoes.filter(t => {
    if(t.tipo !== tipo) return false;
    const d = parseDataLocal(t.data);
    if(filtroPeriodo.mes !== 'todos' && (d.getMonth()+1) !== Number(filtroPeriodo.mes)) return false;
    if(filtroPeriodo.ano !== 'todos' && d.getFullYear() !== Number(filtroPeriodo.ano)) return false;
    if(busca && !t.descricao.toLowerCase().includes(busca.toLowerCase())) return false;
    if(tipo === 'despesa' && status !== 'todas' && t.status !== status) return false;
    return true;
  }).sort((a,b) => parseDataLocal(b.data) - parseDataLocal(a.data));
}

// =====================================================================
// MÁSCARA DE MOEDA (campo Valor do formulário)
// =====================================================================
const inputValor = document.getElementById('valor');
function aplicarMascaraMoeda(input){
  let digitos = input.value.replace(/\D/g,'');
  if(!digitos){ input.value = ''; return; }
  digitos = digitos.replace(/^0+(?=\d)/,'');
  const centavos = parseInt(digitos, 10);
  input.value = (centavos/100).toLocaleString('pt-BR', { minimumFractionDigits:2, maximumFractionDigits:2 });
}
function valorInputParaNumero(input){
  const limpo = input.value.replace(/\./g,'').replace(',', '.');
  const n = parseFloat(limpo);
  return isNaN(n) ? 0 : n;
}
inputValor.addEventListener('input', () => aplicarMascaraMoeda(inputValor));

// =====================================================================
// NAVEGAÇÃO ENTRE TELAS
// =====================================================================
const navButtons = document.querySelectorAll('[data-screen]');
const screenLinks = document.querySelectorAll('[data-screen-link]');
const screens = document.querySelectorAll('.screen');

function goTo(id){
  screens.forEach(s => s.classList.toggle('active', s.id === id));
  navButtons.forEach(b => b.classList.toggle('active', b.dataset.screen === id));
  if(id === 'dashboard') renderDashboard();
  if(id === 'despesas') renderDespesas();
  if(id === 'receitas') renderReceitas();
  if(id === 'categorias') renderCategorias();
}
navButtons.forEach(b => b.addEventListener('click', () => { goTo(b.dataset.screen); closeSidebar(); }));
screenLinks.forEach(b => b.addEventListener('click', () => {
  const destino = b.dataset.screenLink;
  if(destino === 'nova') abrirFormularioNovo(b.dataset.novoTipo || 'despesa');
  goTo(destino);
  closeSidebar();
}));
document.getElementById('fabNovo').addEventListener('click', () => { abrirFormularioNovo('despesa'); goTo('nova'); });

// =====================================================================
// TEMA CLARO/ESCURO
// =====================================================================
const root = document.documentElement;
const sunPath = '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>';
const moonPath = '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z"/>';
function syncThemeIcons(){
  const isDark = root.dataset.theme === 'dark';
  document.querySelectorAll('.theme-toggle svg').forEach(svg => {
    svg.innerHTML = isDark ? moonPath : sunPath;
  });
}
document.querySelectorAll('.theme-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    syncThemeIcons();
    atualizarGraficos();
    // Guarda a preferência na conta (se estiver logado)
    if(usuarioAtual) api('PUT', '/eu', { tema: root.dataset.theme }).catch(() => {});
  });
});

// =====================================================================
// LOGIN / CRIAR CONTA / LOGOUT / LANDING
// =====================================================================
const loginBtn = document.getElementById('loginBtn');
const signupBtn = document.getElementById('signupBtn');
const logoutBtn = document.getElementById('logoutBtn');

function showView(view){ document.body.dataset.view = view; }

function mostrarUsuario(usuario){
  usuarioAtual = usuario;
  const nome = usuario.nome || '';
  document.getElementById('usuarioNome').textContent = nome;
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  const iniciais = partes.length > 1 ? partes[0][0] + partes[partes.length-1][0] : (partes[0] || '?').slice(0,2);
  document.getElementById('usuarioIniciais').textContent = iniciais.toUpperCase();
  if(usuario.tema === 'dark' || usuario.tema === 'light'){
    root.dataset.theme = usuario.tema;
    syncThemeIcons();
  }
}

// Depois do login/cadastro: carrega os dados da conta e abre o app
async function entrarNoApp(sessao){
  try{ localStorage.setItem(TOKEN_KEY, sessao.token); }catch(e){}
  mostrarUsuario(sessao.usuario);
  await carregarDados();
  filtroPeriodo.mes = 'todos'; filtroPeriodo.ano = 'todos';
  popularSelectsPeriodo();
  onMudaPeriodo('todos', 'todos');
  showView('app');
  goTo('dashboard');
  iniciarOnboardingSePrimeiraVez();
}

function sairDaConta(){
  try{ localStorage.removeItem(TOKEN_KEY); }catch(e){}
  usuarioAtual = null;
  categorias.length = 0;
  transacoes.length = 0;
}

// Desabilita o botão enquanto a requisição está em andamento
async function comBotaoOcupado(botao, acao){
  if(botao.disabled) return;
  const textoOriginal = botao.textContent;
  botao.disabled = true;
  botao.textContent = 'Aguarde...';
  try{ await acao(); }
  catch(e){ toast(e.message, 'error'); }
  finally{ botao.disabled = false; botao.textContent = textoOriginal; }
}

loginBtn.addEventListener('click', () => comBotaoOcupado(loginBtn, async () => {
  const email = document.getElementById('loginEmail').value.trim();
  const senha = document.getElementById('loginSenha').value;
  if(!email || !senha){ toast('Informe e-mail e senha', 'error'); return; }
  const sessao = await api('POST', '/login', { email, senha });
  document.getElementById('loginSenha').value = '';
  await entrarNoApp(sessao);
}));
signupBtn.addEventListener('click', () => comBotaoOcupado(signupBtn, async () => {
  const nome = document.getElementById('signupNome').value.trim();
  const email = document.getElementById('signupEmail').value.trim();
  const senha = document.getElementById('signupSenha').value;
  const confirmacaoSenha = document.getElementById('signupSenha2').value;
  const sessao = await api('POST', '/usuarios', { nome, email, senha, confirmacaoSenha });
  document.getElementById('signupSenha').value = '';
  document.getElementById('signupSenha2').value = '';
  toast('Conta criada! Bem-vindo(a) ao Poupee');
  await entrarNoApp(sessao);
}));
// Enter nos campos de senha também envia
document.getElementById('loginSenha').addEventListener('keydown', e => { if(e.key === 'Enter') loginBtn.click(); });
document.getElementById('signupSenha2').addEventListener('keydown', e => { if(e.key === 'Enter') signupBtn.click(); });
document.getElementById('forgotBtn').addEventListener('click', () => toast('Recuperação de senha ainda não disponível', 'error'));
logoutBtn.addEventListener('click', () => { sairDaConta(); showView('landing'); });

document.querySelectorAll('.js-goto-signup').forEach(el => {
  el.addEventListener('click', (e) => { e.preventDefault(); showView('signup'); });
});
document.querySelectorAll('.js-goto-login').forEach(el => {
  el.addEventListener('click', (e) => { e.preventDefault(); showView('login'); });
});

// Menu mobile (hambúrguer)
const hamburgerBtn = document.getElementById('hamburgerBtn');
const sidebar = document.querySelector('.sidebar');
const backdrop = document.getElementById('sidebarBackdrop');
function openSidebar(){ sidebar.classList.add('open'); backdrop.classList.add('show'); }
function closeSidebar(){ sidebar.classList.remove('open'); backdrop.classList.remove('show'); }
hamburgerBtn.addEventListener('click', openSidebar);
backdrop.addEventListener('click', closeSidebar);

// =====================================================================
// FILTRO DE PERÍODO (mês/ano) — usado no Dashboard, Despesas e Receitas
// =====================================================================
const selectMesPrincipal = document.getElementById('filtroMes');
const selectAnoPrincipal = document.getElementById('filtroAno');

function anosDisponiveis(){
  const anos = new Set(transacoes.map(t => parseDataLocal(t.data).getFullYear()));
  return Array.from(anos).sort();
}
function popularSelectsPeriodo(){
  const mesesHtml = '<option value="todos">Todos os meses</option>' +
    MESES.map((nome, i) => `<option value="${i+1}">${nome}</option>`).join('');
  const anosHtml = '<option value="todos">Todos os anos</option>' +
    anosDisponiveis().map(a => `<option value="${a}">${a}</option>`).join('');

  document.querySelectorAll('#filtroMes, .espelho-mes').forEach(sel => sel.innerHTML = mesesHtml);
  document.querySelectorAll('#filtroAno, .espelho-ano').forEach(sel => sel.innerHTML = anosHtml);
  sincronizarSelectsPeriodo();
}
function sincronizarSelectsPeriodo(){
  document.querySelectorAll('#filtroMes, .espelho-mes').forEach(sel => sel.value = filtroPeriodo.mes);
  document.querySelectorAll('#filtroAno, .espelho-ano').forEach(sel => sel.value = filtroPeriodo.ano);
}
function onMudaPeriodo(mes, ano){
  filtroPeriodo.mes = mes;
  filtroPeriodo.ano = ano;
  sincronizarSelectsPeriodo();
  const label = document.getElementById('dashboardPeriodoLabel');
  if(mes === 'todos' && ano === 'todos') label.textContent = 'Todos os períodos';
  else if(mes === 'todos') label.textContent = `Ano de ${ano}`;
  else if(ano === 'todos') label.textContent = `${MESES[Number(mes)-1]} (todos os anos)`;
  else label.textContent = `${MESES[Number(mes)-1]} de ${ano}`;
  renderDashboard();
  renderDespesas();
  renderReceitas();
}
document.querySelectorAll('#filtroMes, .espelho-mes').forEach(sel => {
  sel.addEventListener('change', () => onMudaPeriodo(sel.value, filtroPeriodo.ano));
});
document.querySelectorAll('#filtroAno, .espelho-ano').forEach(sel => {
  sel.addEventListener('change', () => onMudaPeriodo(filtroPeriodo.mes, sel.value));
});

// =====================================================================
// DASHBOARD
// =====================================================================
let chartSaldo = null;
let chartCategorias = null;

function renderDashboard(){
  const despesasPeriodo = transacoesFiltradas('despesa');
  const receitasPeriodo = transacoesFiltradas('receita');

  const totalReceitas = receitasPeriodo.reduce((s,t) => s + t.valor, 0);
  const totalDespesas = despesasPeriodo.reduce((s,t) => s + t.valor, 0);
  const pendentes = despesasPeriodo.filter(t => t.status === 'pagar');
  const totalPendente = pendentes.reduce((s,t) => s + t.valor, 0);
  // RN001: saldo do período = receitas − despesas já pagas;
  // saldo previsto = receitas − todas as despesas (inclui as que ainda vão ser pagas)
  const saldo = totalReceitas - (totalDespesas - totalPendente);
  const saldoPrevisto = totalReceitas - totalDespesas;

  document.getElementById('saldoPeriodo').textContent = formatarMoeda(saldo);
  document.getElementById('saldoPrevisto').lastChild.textContent = ' Saldo previsto: ' + formatarMoeda(saldoPrevisto);
  document.getElementById('statReceitas').textContent = formatarMoeda(totalReceitas);
  document.getElementById('statDespesas').textContent = formatarMoeda(totalDespesas);
  document.getElementById('statPendentesCount').textContent = pendentes.length;
  document.getElementById('statPendentesValor').textContent = formatarMoeda(totalPendente);

  // Lançamentos recentes (5 mais novos do período, despesas + receitas)
  const recentes = [...despesasPeriodo, ...receitasPeriodo]
    .sort((a,b) => parseDataLocal(b.data) - parseDataLocal(a.data))
    .slice(0,5);
  const listaRecentes = document.getElementById('txListRecentes');
  listaRecentes.innerHTML = recentes.length ? recentes.map(t => {
    const cat = categoriaPorId(t.categoriaId);
    const sinal = t.tipo === 'despesa' ? '-' : '+';
    const classe = t.tipo === 'despesa' ? 'out' : 'in';
    const detalhe = t.tipo === 'despesa'
      ? `${cat.nome} · ${t.status === 'paga' ? 'pago' : 'vence dia ' + parseDataLocal(t.data).getDate()}`
      : `${cat.nome} · recebido`;
    return `<div class="tx-row">
      <div class="tx-icon" style="background:${cat.cor}22">${cat.icone}</div>
      <div class="tx-info"><p class="t">${escapeHtml(t.descricao)}</p><p class="d">${escapeHtml(detalhe)}</p></div>
      <p class="tx-amount ${classe}">${sinal} ${formatarMoeda(t.valor)}</p>
    </div>`;
  }).join('') : '<p class="list-empty">Nada por aqui ainda neste período.</p>';

  atualizarGraficos(despesasPeriodo, receitasPeriodo);
}

function corVar(nomeVar){
  return getComputedStyle(document.documentElement).getPropertyValue(nomeVar).trim();
}

function atualizarGraficos(despesasPeriodo, receitasPeriodo){
  if(typeof Chart === 'undefined') return;
  despesasPeriodo = despesasPeriodo || transacoesFiltradas('despesa');
  receitasPeriodo = receitasPeriodo || transacoesFiltradas('receita');

  // Gráfico de evolução do saldo — soma acumulada por dia, na ordem cronológica
  const todasOrdenadas = [...despesasPeriodo, ...receitasPeriodo].sort((a,b) => parseDataLocal(a.data) - parseDataLocal(b.data));
  let acumulado = 0;
  const pontos = todasOrdenadas.map(t => {
    acumulado += t.tipo === 'receita' ? t.valor : -t.valor;
    return { x: formatarDataCurta(t.data), y: Math.round(acumulado*100)/100 };
  });
  const ctxSaldo = document.getElementById('chartEvolucaoSaldo').getContext('2d');
  const corPrimaria = corVar('--primary');
  if(chartSaldo) chartSaldo.destroy();
  chartSaldo = new Chart(ctxSaldo, {
    type:'line',
    data:{ labels: pontos.map(p => p.x), datasets:[{ data: pontos.map(p => p.y), borderColor: corPrimaria, backgroundColor: corPrimaria+'22', fill:true, tension:0.35, pointRadius:0, borderWidth:2 }] },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}, tooltip:{callbacks:{label:c => formatarMoeda(c.parsed.y)}}}, scales:{ x:{display:false}, y:{display:false} } }
  });

  // Gráfico de gastos por categoria — apenas despesas do período
  const porCategoria = {};
  despesasPeriodo.forEach(t => { porCategoria[t.categoriaId] = (porCategoria[t.categoriaId]||0) + t.valor; });
  const idsComGasto = Object.keys(porCategoria);
  const vazio = document.getElementById('chartCategoriasVazio');
  const canvasCat = document.getElementById('chartCategorias');
  if(!idsComGasto.length){
    vazio.hidden = false; canvasCat.hidden = true;
    if(chartCategorias){ chartCategorias.destroy(); chartCategorias = null; }
  }else{
    vazio.hidden = true; canvasCat.hidden = false;
    const ctxCat = canvasCat.getContext('2d');
    if(chartCategorias) chartCategorias.destroy();
    chartCategorias = new Chart(ctxCat, {
      type:'doughnut',
      data:{
        labels: idsComGasto.map(id => categoriaPorId(id).nome),
        datasets:[{ data: idsComGasto.map(id => porCategoria[id]), backgroundColor: idsComGasto.map(id => categoriaPorId(id).cor), borderWidth:0 }]
      },
      options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'bottom', labels:{ boxWidth:10, font:{size:11}, color: corVar('--text-muted') } }, tooltip:{callbacks:{label:c => `${c.label}: ${formatarMoeda(c.raw)}`}} } }
    });
  }
}

function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// =====================================================================
// DESPESAS
// =====================================================================
function renderDespesas(){
  const lista = transacoesFiltradas('despesa', { busca: filtroLista.buscaDespesas, status: filtroLista.statusDespesas });
  const total = lista.reduce((s,t) => s + t.valor, 0);
  document.getElementById('totalDespesas').textContent = formatarMoeda(total);

  const container = document.getElementById('listaDespesas');
  const vazio = document.getElementById('despesasVazio');
  vazio.hidden = lista.length > 0;
  container.innerHTML = lista.map(t => linhaDespesaHtml(t)).join('');

  container.querySelectorAll('[data-toggle-status]').forEach(el => {
    el.addEventListener('click', () => alternarStatus(el.dataset.toggleStatus));
  });
  container.querySelectorAll('[data-editar]').forEach(el => {
    el.addEventListener('click', () => { abrirFormularioEdicao(el.dataset.editar); goTo('nova'); });
  });
  container.querySelectorAll('[data-excluir]').forEach(el => {
    el.addEventListener('click', () => excluirLancamento(el.dataset.excluir));
  });
}

function linhaDespesaHtml(t){
  const cat = categoriaPorId(t.categoriaId);
  const pago = t.status === 'paga';
  return `<div class="list-row" data-status="${t.status === 'paga' ? 'pagas' : 'pagar'}">
    <div class="row-icon" style="background:${cat.cor}22">${cat.icone}</div>
    <div><p class="row-title">${escapeHtml(t.descricao)}</p><p class="row-cat">${escapeHtml(cat.nome)}</p></div>
    <p class="row-date">${formatarDataCurta(t.data)}</p>
    <p class="row-value">${formatarMoeda(t.valor)}</p>
    <button class="status-toggle ${pago ? 'pago' : ''}" data-toggle-status="${t.id}" aria-label="Alternar status de pagamento" aria-pressed="${pago}" title="${pago ? 'Paga' : 'A pagar'}"><span class="knob"></span></button>
    <div class="row-actions">
      <button class="icon-btn" data-editar="${t.id}" aria-label="Editar"><svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
      <button class="icon-btn danger" data-excluir="${t.id}" aria-label="Excluir"><svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button>
    </div>
  </div>`;
}

async function alternarStatus(id){
  const t = transacoes.find(x => x.id === id);
  if(!t) return;
  const novoStatus = t.status === 'paga' ? 'pagar' : 'paga';
  await tentar(async () => {
    await api('PATCH', `/transacoes/${id}/status`, { status: novoStatus });
    toast(novoStatus === 'paga' ? 'Marcada como paga' : 'Marcada como a pagar');
    await recarregarERenderizar();
  });
}

async function excluirLancamento(id){
  const t = transacoes.find(x => x.id === id);
  if(!t) return;
  await tentar(async () => {
    await api('DELETE', `/transacoes/${id}`);
    toast('Lançamento excluído');
    await recarregarERenderizar();
  });
}

document.getElementById('buscaDespesas').addEventListener('input', (e) => { filtroLista.buscaDespesas = e.target.value; renderDespesas(); });
document.querySelectorAll('.filter-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.filter-tab').forEach(t => { t.classList.remove('active'); t.setAttribute('aria-pressed','false'); });
    tab.classList.add('active'); tab.setAttribute('aria-pressed','true');
    filtroLista.statusDespesas = tab.dataset.filter;
    renderDespesas();
  });
});

// =====================================================================
// RECEITAS
// =====================================================================
function renderReceitas(){
  const lista = transacoesFiltradas('receita', { busca: filtroLista.buscaReceitas });
  const total = lista.reduce((s,t) => s + t.valor, 0);
  document.getElementById('totalReceitas').textContent = formatarMoeda(total);

  const container = document.getElementById('listaReceitas');
  const vazio = document.getElementById('receitasVazio');
  vazio.hidden = lista.length > 0;
  container.innerHTML = lista.map(t => {
    const cat = categoriaPorId(t.categoriaId);
    return `<div class="list-row">
      <div class="row-icon" style="background:${cat.cor}22">${cat.icone}</div>
      <div><p class="row-title">${escapeHtml(t.descricao)}</p><p class="row-cat">${escapeHtml(cat.nome)}</p></div>
      <p class="row-date">${formatarDataCurta(t.data)}</p>
      <p class="row-value" style="color:var(--success)">${formatarMoeda(t.valor)}</p>
      <span class="badge paid"><span class="badge-dot"></span>${escapeHtml(cat.nome)}</span>
      <div class="row-actions">
        <button class="icon-btn" data-editar="${t.id}" aria-label="Editar"><svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
        <button class="icon-btn danger" data-excluir="${t.id}" aria-label="Excluir"><svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button>
      </div>
    </div>`;
  }).join('');

  container.querySelectorAll('[data-editar]').forEach(el => {
    el.addEventListener('click', () => { abrirFormularioEdicao(el.dataset.editar); goTo('nova'); });
  });
  container.querySelectorAll('[data-excluir]').forEach(el => {
    el.addEventListener('click', () => excluirLancamento(el.dataset.excluir));
  });
}
document.getElementById('buscaReceitas').addEventListener('input', (e) => { filtroLista.buscaReceitas = e.target.value; renderReceitas(); });

// =====================================================================
// FORMULÁRIO — NOVO LANÇAMENTO / EDIÇÃO
// =====================================================================
const tipoSegmented = document.getElementById('tipoSegmented');
const statusSegmented = document.getElementById('statusSegmented');
const campoStatus = document.getElementById('campoStatus');
const labelData = document.getElementById('labelData');
const catPicker = document.getElementById('catPicker');
const inputDescricao = document.getElementById('descricao');
const inputVencimento = document.getElementById('vencimento');
let categoriaSelecionadaId = null;

function renderCatPicker(tipo){
  const opcoes = categorias.filter(c => c.tipo === tipo);
  catPicker.innerHTML = opcoes.map(c => `<button type="button" class="cat-chip${c.id===categoriaSelecionadaId?' selected':''}" data-cat-id="${c.id}" aria-pressed="${c.id===categoriaSelecionadaId}"><span class="cat-dot" style="background:${c.cor}"></span>${escapeHtml(c.nome)}</button>`).join('');
  if(!opcoes.some(c => c.id === categoriaSelecionadaId)){
    categoriaSelecionadaId = opcoes[0] ? opcoes[0].id : null;
    if(categoriaSelecionadaId) renderCatPicker(tipo); // re-renderiza já com a seleção padrão marcada
    return;
  }
  catPicker.querySelectorAll('.cat-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      categoriaSelecionadaId = chip.dataset.catId;
      catPicker.querySelectorAll('.cat-chip').forEach(c => { c.classList.remove('selected'); c.setAttribute('aria-pressed','false'); });
      chip.classList.add('selected'); chip.setAttribute('aria-pressed','true');
    });
  });
}

function setTipoFormulario(tipo){
  novoLancamentoTipo = tipo;
  tipoSegmented.querySelectorAll('button').forEach(b => {
    const ativo = b.dataset.type === tipo;
    b.classList.toggle('active', ativo);
    b.setAttribute('aria-pressed', ativo);
  });
  campoStatus.hidden = tipo === 'receita';
  labelData.textContent = tipo === 'despesa' ? 'Data de vencimento' : 'Data de recebimento';
  renderCatPicker(tipo);
}
tipoSegmented.querySelectorAll('button').forEach(btn => {
  btn.addEventListener('click', () => { categoriaSelecionadaId = null; setTipoFormulario(btn.dataset.type); });
});

statusSegmented.querySelectorAll('button').forEach(btn => {
  btn.addEventListener('click', () => {
    statusSegmented.querySelectorAll('button').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed','false'); });
    btn.classList.add('active'); btn.setAttribute('aria-pressed','true');
  });
});

function abrirFormularioNovo(tipo){
  lancamentoEditandoId = null;
  document.getElementById('novaTitulo').textContent = 'Novo lançamento';
  inputDescricao.value = '';
  inputValor.value = '';
  inputVencimento.value = '';
  categoriaSelecionadaId = null;
  setTipoFormulario(tipo);
  statusSegmented.querySelectorAll('button').forEach(b => {
    const ativo = b.dataset.statusOpt === 'pagar';
    b.classList.toggle('active', ativo); b.setAttribute('aria-pressed', ativo);
  });
}

function abrirFormularioEdicao(id){
  const t = transacoes.find(x => x.id === id);
  if(!t) return;
  lancamentoEditandoId = id;
  document.getElementById('novaTitulo').textContent = 'Editar lançamento';
  inputDescricao.value = t.descricao;
  inputValor.value = t.valor.toLocaleString('pt-BR', { minimumFractionDigits:2, maximumFractionDigits:2 });
  inputVencimento.value = t.data;
  categoriaSelecionadaId = t.categoriaId;
  setTipoFormulario(t.tipo);
  statusSegmented.querySelectorAll('button').forEach(b => {
    const ativo = b.dataset.statusOpt === (t.status === 'paga' ? 'paga' : 'pagar');
    b.classList.toggle('active', ativo); b.setAttribute('aria-pressed', ativo);
  });
}

document.getElementById('btnCancelarLancamento').addEventListener('click', () => {
  goTo(novoLancamentoTipo === 'despesa' ? 'despesas' : 'receitas');
});

const btnSalvarLancamento = document.getElementById('btnSalvarLancamento');
btnSalvarLancamento.addEventListener('click', () => comBotaoOcupado(btnSalvarLancamento, async () => {
  const descricao = inputDescricao.value.trim();
  const valor = valorInputParaNumero(inputValor);
  const data = inputVencimento.value;

  if(!descricao){ toast('Informe uma descrição', 'error'); return; }
  if(!valor || valor <= 0){ toast('O valor precisa ser maior que zero', 'error'); return; }
  if(!data){ toast('Informe a data', 'error'); return; }
  if(!categoriaSelecionadaId){ toast('Escolha uma categoria', 'error'); return; }

  const statusAtivo = statusSegmented.querySelector('button.active');
  const status = novoLancamentoTipo === 'despesa' ? (statusAtivo ? statusAtivo.dataset.statusOpt : 'pagar') : 'paga';

  const corpo = { tipo: novoLancamentoTipo, descricao, valor, data, categoriaId: Number(categoriaSelecionadaId), status };
  if(lancamentoEditandoId){
    await api('PUT', `/transacoes/${lancamentoEditandoId}`, corpo);
    toast('Lançamento atualizado com sucesso');
  }else{
    await api('POST', '/transacoes', corpo);
    toast('Lançamento salvo com sucesso');
  }
  await recarregarERenderizar();
  goTo(novoLancamentoTipo === 'despesa' ? 'despesas' : 'receitas');
}));

// =====================================================================
// CATEGORIAS — customização, favoritos e reordenação (drag-and-drop)
// =====================================================================
const catGrid = document.getElementById('catGrid');
const catEditCard = document.getElementById('catEditCard');
const catEditTipoSegmented = document.getElementById('catEditTipoSegmented');
const catEditNome = document.getElementById('catEditNome');
const catEditCor = document.getElementById('catEditCor');
let catEditTipo = 'despesa';

function renderCategorias(){
  const ordenadas = categoriasOrdenadas();
  catGrid.innerHTML = ordenadas.map(c => {
    const lancamentosCat = transacoes.filter(t => t.categoriaId === c.id);
    const totalGasto = lancamentosCat.reduce((s,t) => s + t.valor, 0);
    const favorita = c.favorita;
    return `<div class="cat-card" draggable="true" data-cat-card="${c.id}">
      <div class="swatch" style="background:${c.cor}"></div>
      <div class="cat-info">
        <p class="name">${escapeHtml(c.nome)}</p>
        <p class="count">${lancamentosCat.length} lançamento${lancamentosCat.length===1?'':'s'}</p>
        <p class="cat-gasto">${formatarMoeda(totalGasto)}</p>
      </div>
      <div class="cat-actions">
        <button class="cat-fav-btn${favorita?' active':''}" data-favoritar="${c.id}" aria-label="Favoritar"><svg viewBox="0 0 24 24" stroke-width="2" stroke-linejoin="round"><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.9L12 17.8 5.8 21.1 7 14.2l-5-4.9 6.9-1Z"/></svg></button>
        <button class="cat-edit-btn" data-editar-cat="${c.id}" aria-label="Editar categoria"><svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
      </div>
    </div>`;
  }).join('') + `<button type="button" class="cat-card add" id="btnNovaCategoria">
      <svg width="18" height="18" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" fill="none"><path d="M12 5v14M5 12h14"/></svg>
      Nova categoria
    </button>`;

  catGrid.querySelectorAll('[data-favoritar]').forEach(el => {
    el.addEventListener('click', (e) => { e.stopPropagation(); alternarFavorita(el.dataset.favoritar); });
  });
  catGrid.querySelectorAll('[data-editar-cat]').forEach(el => {
    el.addEventListener('click', (e) => { e.stopPropagation(); abrirEdicaoCategoria(el.dataset.editarCat); });
  });
  document.getElementById('btnNovaCategoria').addEventListener('click', () => abrirEdicaoCategoria(null));

  ativarDragDropCategorias();
}

// Ordem salva na conta (campo `ordem`); empate desempata pelo id
function categoriasOrdenadas(){
  return [...categorias].sort((a,b) => (a.ordem - b.ordem) || (Number(a.id) - Number(b.id)));
}

async function alternarFavorita(id){
  const c = categoriaPorId(id);
  await tentar(async () => {
    await api('PUT', `/categorias/${id}`, { favorita: !c.favorita });
    await recarregarERenderizar();
  });
}

function abrirEdicaoCategoria(id){
  categoriaEditandoId = id;
  catEditCard.hidden = false;
  if(id){
    const c = categoriaPorId(id);
    catEditNome.value = c.nome;
    catEditCor.value = c.cor;
    catEditTipo = c.tipo;
  }else{
    catEditNome.value = '';
    catEditCor.value = '#F2600C';
    catEditTipo = 'despesa';
  }
  catEditTipoSegmented.querySelectorAll('button').forEach(b => {
    const ativo = b.dataset.catTipo === catEditTipo;
    b.classList.toggle('active', ativo); b.setAttribute('aria-pressed', ativo);
  });
  catEditNome.focus();
}
catEditTipoSegmented.querySelectorAll('button').forEach(btn => {
  btn.addEventListener('click', () => {
    catEditTipo = btn.dataset.catTipo;
    catEditTipoSegmented.querySelectorAll('button').forEach(b => { b.classList.toggle('active', b===btn); b.setAttribute('aria-pressed', b===btn); });
  });
});
document.getElementById('catEditCancelar').addEventListener('click', () => { catEditCard.hidden = true; });
const btnCatEditSalvar = document.getElementById('catEditSalvar');
btnCatEditSalvar.addEventListener('click', () => comBotaoOcupado(btnCatEditSalvar, async () => {
  const nome = catEditNome.value.trim();
  if(!nome){ toast('Dê um nome pra categoria', 'error'); return; }
  const cor = catEditCor.value.toUpperCase();
  if(categoriaEditandoId){
    const atual = categoriaPorId(categoriaEditandoId);
    const mudancas = { nome, cor };
    if(catEditTipo !== atual.tipo) mudancas.tipo = catEditTipo;
    await api('PUT', `/categorias/${categoriaEditandoId}`, mudancas);
    toast('Categoria atualizada');
  }else{
    const ultimaOrdem = categorias.reduce((m,c) => Math.max(m, c.ordem), 0);
    await api('POST', '/categorias', { nome, cor, tipo: catEditTipo, icone:'🏷️', ordem: ultimaOrdem + 1 });
    toast('Categoria criada');
  }
  catEditCard.hidden = true;
  await recarregarERenderizar();
}));

// Grava a nova ordem na conta: só manda as categorias que mudaram de posição
async function salvarOrdemCategorias(ordemIds){
  const mudaram = ordemIds
    .map((id, i) => ({ id, ordem: i + 1 }))
    .filter(({ id, ordem }) => categoriaPorId(id).ordem !== ordem);
  mudaram.forEach(({ id, ordem }) => { categoriaPorId(id).ordem = ordem; });
  renderCategorias(); // mostra a nova ordem na hora
  await tentar(async () => {
    await Promise.all(mudaram.map(({ id, ordem }) => api('PUT', `/categorias/${id}`, { ordem })));
  });
  await tentar(recarregarERenderizar);
}

// Drag-and-drop nativo pra reordenar os cartões de categoria
function ativarDragDropCategorias(){
  let idArrastando = null;
  catGrid.querySelectorAll('[data-cat-card]').forEach(card => {
    card.addEventListener('dragstart', () => { idArrastando = card.dataset.catCard; card.classList.add('dragging'); });
    card.addEventListener('dragend', () => { card.classList.remove('dragging'); catGrid.querySelectorAll('.cat-card').forEach(c => c.classList.remove('drag-over')); });
    card.addEventListener('dragover', (e) => { e.preventDefault(); card.classList.add('drag-over'); });
    card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
    card.addEventListener('drop', (e) => {
      e.preventDefault();
      card.classList.remove('drag-over');
      const idAlvo = card.dataset.catCard;
      if(!idArrastando || idArrastando === idAlvo) return;
      const ordem = categoriasOrdenadas().map(c => c.id);
      const de = ordem.indexOf(idArrastando);
      const para = ordem.indexOf(idAlvo);
      ordem.splice(de,1);
      ordem.splice(para,0,idArrastando);
      salvarOrdemCategorias(ordem);
    });
  });
}

// =====================================================================
// EXPORTAÇÃO — CSV e PDF, direto pelo navegador
// =====================================================================
function baixarArquivo(nome, conteudo, mime){
  const blob = new Blob([conteudo], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nome;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function exportarCsv(tipo){
  const lista = tipo === 'despesa'
    ? transacoesFiltradas('despesa', { busca: filtroLista.buscaDespesas, status: filtroLista.statusDespesas })
    : transacoesFiltradas('receita', { busca: filtroLista.buscaReceitas });
  if(!lista.length){ toast('Não há lançamentos pra exportar', 'error'); return; }
  const cabecalho = tipo === 'despesa' ? ['Descrição','Vencimento','Valor','Categoria','Status'] : ['Descrição','Recebido em','Valor','Categoria'];
  const linhas = lista.map(t => {
    const cat = categoriaPorId(t.categoriaId);
    const base = [t.descricao, t.data, t.valor.toFixed(2).replace('.', ','), cat.nome];
    if(tipo === 'despesa') base.push(t.status === 'paga' ? 'Paga' : 'A pagar');
    return base.map(campo => `"${String(campo).replace(/"/g,'""')}"`).join(';');
  });
  const csv = '\uFEFF' + cabecalho.join(';') + '\n' + linhas.join('\n');
  baixarArquivo(`${tipo === 'despesa' ? 'despesas' : 'receitas'}.csv`, csv, 'text/csv;charset=utf-8;');
  toast('CSV exportado');
}

function exportarPdf(tipo){
  if(typeof window.jspdf === 'undefined'){ toast('Não foi possível gerar o PDF', 'error'); return; }
  const lista = tipo === 'despesa'
    ? transacoesFiltradas('despesa', { busca: filtroLista.buscaDespesas, status: filtroLista.statusDespesas })
    : transacoesFiltradas('receita', { busca: filtroLista.buscaReceitas });
  if(!lista.length){ toast('Não há lançamentos pra exportar', 'error'); return; }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const titulo = tipo === 'despesa' ? 'Despesas — Poupee' : 'Receitas — Poupee';
  doc.setFontSize(16); doc.text(titulo, 14, 18);
  doc.setFontSize(10); doc.setTextColor(110);
  doc.text(`Exportado em ${new Date().toLocaleDateString('pt-BR')}`, 14, 25);

  let y = 36;
  doc.setFontSize(11); doc.setTextColor(20);
  lista.forEach(t => {
    const cat = categoriaPorId(t.categoriaId);
    const statusTxt = tipo === 'despesa' ? (t.status === 'paga' ? ' · Paga' : ' · A pagar') : '';
    doc.text(`${formatarDataCurta(t.data)}  ${t.descricao} (${cat.nome})${statusTxt}`, 14, y);
    doc.text(formatarMoeda(t.valor), 180, y, { align:'right' });
    y += 8;
    if(y > 280){ doc.addPage(); y = 20; }
  });
  const total = lista.reduce((s,t) => s + t.valor, 0);
  doc.setFontSize(12);
  doc.text(`Total: ${formatarMoeda(total)}`, 180, y + 6, { align:'right' });

  doc.save(`${tipo === 'despesa' ? 'despesas' : 'receitas'}.pdf`);
  toast('PDF exportado');
}

document.getElementById('btnExportCsvDespesas').addEventListener('click', () => exportarCsv('despesa'));
document.getElementById('btnExportPdfDespesas').addEventListener('click', () => exportarPdf('despesa'));
document.getElementById('btnExportCsvReceitas').addEventListener('click', () => exportarCsv('receita'));
document.getElementById('btnExportPdfReceitas').addEventListener('click', () => exportarPdf('receita'));

// =====================================================================
// ONBOARDING — tour interativo no primeiro acesso (Driver.js)
// =====================================================================
function iniciarOnboardingSePrimeiraVez(){
  if(localStorage.getItem('poupee_onboarded') === '1') return;
  if(typeof window.driver === 'undefined') return;

  const driverObj = window.driver.js.driver({
    showProgress: true,
    nextBtnText: 'Próximo',
    prevBtnText: 'Voltar',
    doneBtnText: 'Concluir',
    steps: [
      { element: '[data-tour="dashboard"]', popover: { title: 'Visão geral', description: 'Aqui você vê o saldo, receitas, despesas e contas pendentes do período selecionado.' } },
      { element: '[data-tour="periodo"]', popover: { title: 'Filtro de período', description: 'Escolha o mês e o ano pra ver só os lançamentos daquele período.' } },
      { element: '[data-tour="novo-lancamento"]', popover: { title: 'Novo lançamento', description: 'Cadastre despesas e receitas rapidamente por aqui — ou pelo botão flutuante no celular.' } },
      { element: '[data-tour="graficos"]', popover: { title: 'Gráficos', description: 'Acompanhe a evolução do saldo e os gastos por categoria em tempo real.' } },
      { element: '[data-tour="categorias"]', popover: { title: 'Categorias', description: 'Personalize nome e cor das categorias, marque favoritas e arraste pra reordenar.' } },
    ]
  });
  driverObj.drive();
  localStorage.setItem('poupee_onboarded', '1');
}

// =====================================================================
// INICIALIZAÇÃO
// =====================================================================
popularSelectsPeriodo();
setTipoFormulario('despesa');

// Já tinha entrado antes? Usa o token salvo pra voltar direto pro app.
(async function retomarSessao(){
  if(!tokenSalvo()) return;
  try{
    const usuario = await api('GET', '/eu');
    await entrarNoApp({ token: tokenSalvo(), usuario });
  }catch(e){
    if(e.status !== 401) toast(e.message, 'error');
  }
})();
