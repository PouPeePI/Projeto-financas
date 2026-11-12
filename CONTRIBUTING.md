# Como contribuir

Guia rápido de Git/GitHub para todo o time usar no dia a dia.

> Antes de abrir um PR com mudanças no back-end, rode `npm test` dentro de `backend/`. O GitHub também roda os testes automaticamente em cada PR.

## 1. Baixar o projeto na sua máquina

Isso só precisa ser feito uma vez:

```bash
git clone https://github.com/PouPeePI/Projeto-financas.git
cd Projeto-financas
```

## 2. Criar sua branch

Antes de começar a mexer em qualquer coisa, crie uma branch com o nome da tarefa que você vai fazer:

```bash
git checkout -b feature/nome-da-tarefa
```

Exemplo:
```bash
git checkout -b feature/tela-login
```

Nunca trabalhe direto na `main`.

## 3. Salvar suas alterações (commit)

Depois de mexer nos arquivos:

```bash
git add .
git commit -m "explica o que você fez"
```

## 4. Enviar sua branch para o GitHub

```bash
git push origin feature/nome-da-tarefa
```

## 5. Abrir um Pull Request (pedir para juntar seu código)

1. Entre no repositório pelo site do GitHub.
2. Vai aparecer um botão **"Compare & pull request"** — clique nele.
3. Escreva um título e uma breve descrição do que você fez.
4. Clique em **"Create pull request"**.
5. Espera alguém do time revisar e aprovar antes do merge.

## 6. Atualizar seu código com o que o time já fez (pull)

Faça isso sempre no início do dia, ou antes de criar uma nova branch:

```bash
git checkout main
git pull origin main
```

Se você já estiver numa branch e quiser trazer as atualizações da `main` pra ela:

```bash
git pull origin main
```

## Resumo do fluxo

1. `git pull origin main` → atualiza seu código
2. `git checkout -b feature/nome-da-tarefa` → cria sua branch
3. Trabalha, `git add .`, `git commit -m "..."`
4. `git push origin feature/nome-da-tarefa` → envia pro GitHub
5. Abre o Pull Request no site
6. Espera aprovação e merge

## Onde registrar decisões

Mudou alguma regra, campo do banco ou requisito? Anote em [docs/decisoes.md](docs/decisoes.md)
com a data, o que mudou e por quê.
