# Registro de decisões

Decisões de projeto que mudam ou esclarecem o que está nos requisitos. Cada entrada diz
o que foi decidido, por quê e o que ainda falta.

## 1. Receitas fazem parte do sistema (22/10/2026)

**Problema:** a divisão de tarefas falava em "app de cadastro de despesas", mas o balanço
(RF006, RN001) depende das receitas.

**Decisão:** o sistema cadastra despesas **e** receitas, como já estava nos requisitos
(RF004, UC004), no protótipo e no banco.

## 2. Despesas e receitas na mesma tabela (22/10/2026)

**Problema:** circulou um modelo conceitual com entidades separadas (`Despesas`, `Receitas`,
`categoria_despesa` e `categoria_receita`), diferente do DER do documento (Figura 3) e do
`db/schema.sql`, que usam uma tabela só.

**Decisão:** fica o modelo do documento: `usuarios`, `categorias` e `transacoes`, com a coluna
`tipo` (`despesa` | `receita`) nas duas últimas.

**Por quê:**
- despesa e receita têm os mesmos campos (descrição, valor, data, categoria); só o `status` é exclusivo da despesa (RN006)
- o balanço (RN001) e o agrupamento por mês (RN002) viram uma consulta só, sem `UNION`
- a regra "categoria do mesmo tipo do lançamento" (RN005) é garantida por trigger
- é o que o protótipo, o banco e a API já usam

**A fazer (Pessoa 4):** refazer o modelo conceitual nesse formato. Corrigir também os nomes
`id_desoesa` → `id_despesa` e `dados_vencimento` → `data_vencimento`, se o diagrama antigo for mantido em algum lugar.

## 3. Fórmula do saldo (22/10/2026)

**Problema:** a RN001 dizia que o balanço é "receitas − total das despesas" e que o saldo
previsto "considera também as despesas ainda não pagas", o que deixa os dois saldos iguais.
O protótipo calculava o previsto como "receitas − despesas pendentes", ignorando as já pagas.

**Decisão:**
- **Saldo do período** = receitas − despesas **pagas** (o dinheiro que sobrou de fato)
- **Saldo previsto** = receitas − **todas** as despesas (o que vai sobrar depois de pagar as pendentes)

Aplicado na API (`saldoRealizado` e `saldoPrevisto`), na view `vw_balanco_mensal`
(`saldo_realizado` e `saldo_previsto`) e no `script.js`.

**A fazer (Pessoa 5):** atualizar o texto da RN001 no documento.

## 4. Login com token (22/10/2026)

**Decisão:** o back-end cria a conta com senha em hash bcrypt (RNF005), recusa e-mail repetido
(RN007), cria as categorias padrão (UC001) e devolve um token JWT válido por 7 dias. O front
manda o token no cabeçalho `Authorization: Bearer <token>`.

**Fora do escopo por enquanto:** "Esqueci minha senha" (UC002, cenário 3b), porque exige envio de e-mail.

## 5. Conta bancária (em aberto)

**Problema:** a conta bancária aparece no cronograma, mas não está nos requisitos, no DER
nem nos casos de uso.

**Recomendação:** cada usuário tem **uma** conta com um saldo inicial, que entra no cálculo do
saldo. Ter várias contas exigiria uma tabela `contas`, o campo `conta_id` em `transacoes` e mudanças
nas telas e nos filtros.

**A decidir pelo grupo** antes de implementar.

## 6. Hospedagem na Vercel

**Decisão:** front e API ficam no mesmo projeto da Vercel, publicado a partir da raiz do repositório.
O front é servido como arquivos estáticos e a API roda como função (`api/index.js`), usando o mesmo
código de `backend/`. Como os dois ficam no mesmo endereço, o front chama `/api` sem precisar de CORS.

**Banco:** veja a seção 7. Sem banco configurado, a API sobe em modo demonstração com os dados de exemplo
em memória, que podem sumir a qualquer momento.

**Favoritas e ordem das categorias** passam a ser salvas na conta (campos `favorita` e `ordem` da API),
e não mais no navegador.

## 7. PostgreSQL (Neon) no lugar do MySQL

**Decisão (2026-11-10):** o banco passa a ser PostgreSQL, hospedado no Neon. O grupo já usa o Neon em outros
projetos e ele se conecta à Vercel pela própria integração, que cria a variável `DATABASE_URL`.

**O que mudou:** `db/schema.sql` e `db/seed.sql` foram reescritos para PostgreSQL (mesmas tabelas, colunas,
restrições, triggers e view), o back-end usa o driver `pg` e o RNF003 passou a dizer PostgreSQL.
Os ENUMs do MySQL viraram `CHECK`, o nome da categoria continua único sem diferenciar maiúsculas
(índice em `lower(nome)`) e, num banco vazio, a API cria as tabelas e os dados de exemplo sozinha.

