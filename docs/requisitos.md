# Requisitos do Poupee

Resumo do documento de Análise de Requisitos (G2 – PI), mantido aqui para consulta rápida
durante o desenvolvimento. A coluna **Situação** mostra o que já está implementado.

## Ator

**Usuário**: pessoa física que quer organizar as próprias finanças. Cria a conta, cadastra
categorias, registra despesas e receitas, marca contas como pagas e consulta o balanço.
Não há perfis administrativos.

## Requisitos funcionais

| ID | Requisito | Prioridade | Situação |
| --- | --- | --- | --- |
| RF001 | Cadastrar usuário (nome, e-mail, senha e confirmação) | Altíssima | API pronta (`POST /api/usuarios`); tela no protótipo |
| RF002 | Autenticar usuário (e-mail e senha) | Altíssima | API pronta (`POST /api/login`); tela no protótipo |
| RF003 | Cadastrar, alterar e excluir despesa (descrição, valor, vencimento, categoria, status) | Altíssima | API pronta; tela no protótipo |
| RF004 | Cadastrar, alterar e excluir receita (descrição, valor, recebimento, categoria) | Altíssima | API pronta; tela no protótipo |
| RF005 | Listar despesas com filtros por status, mês/ano e descrição, total filtrado e exportação CSV/PDF | Alta | Filtros na API; exportação no front |
| RF006 | Exibir balanço do período (saldo, saldo previsto, pendentes, gastos por categoria, recentes) | Altíssima | API pronta (`GET /api/balanco`); tela no protótipo |
| RF007 | Criar, alterar e excluir categorias (nome, cor, tipo), favoritar e reordenar | Alta | API pronta; tela no protótipo |
| RF008 | Alterar status da despesa (paga / a pagar) com um clique | Média | API pronta (`PATCH /api/transacoes/:id/status`) |

> Falta ligar as telas do protótipo à API: hoje o `script.js` ainda usa dados de exemplo em memória.

## Requisitos não funcionais

| ID | Requisito | Tipo |
| --- | --- | --- |
| RNF001 | Aplicação web, acessível por navegador moderno sem instalação | Obrigatório |
| RNF002 | Interface intuitiva; registrar um lançamento em poucos segundos | Obrigatório |
| RNF003 | Banco de dados relacional PostgreSQL com dados do usuário, categorias e lançamentos | Obrigatório |
| RNF004 | Identidade visual com laranja `#F2600C` como cor principal | Obrigatório |
| RNF005 | Senhas guardadas com hash; cada usuário só acessa os próprios dados | Obrigatório |
| RNF006 | Responsividade (computador, tablet e celular, menu recolhível) | Desejável |
| RNF007 | Tema claro e escuro, mantendo a preferência do usuário | Desejável |

## Regras de negócio

| ID | Regra | Onde é garantida |
| --- | --- | --- |
| RN001 | **Saldo do período** = receitas − despesas pagas. **Saldo previsto** = receitas − todas as despesas (inclui as a pagar). Sempre dentro do período (mês/ano) escolhido. | `backend/src/regras/balanco.js`, view `vw_balanco_mensal`, `script.js` |
| RN002 | Cada lançamento tem uma data de competência (vencimento da despesa, recebimento da receita), usada para agrupar por mês e ano | coluna `transacoes.data`, filtros da API |
| RN003 | Valor sempre maior que zero | API + `CHECK` no banco |
| RN004 | Todo lançamento precisa de uma categoria | API + `NOT NULL` / chave estrangeira |
| RN005 | A categoria precisa ser do mesmo tipo do lançamento (despesa ou receita) | API + triggers no banco |
| RN006 | Só despesas têm status (a pagar / paga); receitas são sempre consideradas recebidas | API |
| RN007 | Cada e-mail só pode ter uma conta | API + `UNIQUE` no banco |
| RN008 | Categoria com lançamentos não pode ser excluída | API + `ON DELETE RESTRICT` |

> **Correção na RN001.** O texto original dizia que o balanço é "receitas menos o total das
> despesas" e, na frase seguinte, que "o saldo previsto considera também as despesas ainda não
> pagas", o que deixava os dois saldos iguais. A versão acima é a que o sistema implementa.
> Veja [decisoes.md](decisoes.md).

## Casos de uso

| ID | Caso de uso | Relacionamentos |
| --- | --- | --- |
| UC001 | Cadastrar Usuário | ao criar a conta, o sistema cria as categorias padrão |
| UC002 | Autenticar Usuário | pré-condição dos demais casos de uso |
| UC003 | Cadastrar Despesa | estende Cadastrar Categoria quando a categoria não existe |
| UC004 | Cadastrar Receita | estende Cadastrar Categoria quando a categoria não existe |
| UC005 | Listar Despesas | estendido por Alterar Status da Despesa |
| UC006 | Exibir Balanço Financeiro | |
| UC007 | Cadastrar Categoria | |
| UC008 | Alterar Status da Despesa | estende Listar Despesas |

## Diagramas

- [BPMN do processo de controle financeiro](img/bpmn.png)
- [Diagrama de casos de uso](img/casos-de-uso.jpg)
- [Diagrama entidade-relacionamento](img/der.png)
