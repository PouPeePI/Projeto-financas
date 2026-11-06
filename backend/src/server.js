// Sobe a API localmente. Usa o MySQL do .env; com --memoria (npm run dev:memoria),
// ou sem DB_HOST no .env, roda sem banco (dados de exemplo, perdidos ao reiniciar).
// Também serve o front (index.html, script.js, styles.css da raiz do repositório),
// então dá pra abrir http://localhost:3000 direto.
require('dotenv').config({ quiet: true });
const path = require('path');
const express = require('express');
const { montarApp } = require('./montar');

async function iniciar() {
  const porta = Number(process.env.PORT || 3000);
  const app = await montarApp({ memoria: process.argv.includes('--memoria') });

  const raiz = path.join(__dirname, '..', '..');
  const site = express();
  for (const arquivo of ['index.html', 'script.js', 'styles.css']) {
    site.get(arquivo === 'index.html' ? '/' : `/${arquivo}`, (req, res) => res.sendFile(path.join(raiz, arquivo)));
  }
  site.use(app); // rotas /api/...

  site.listen(porta, () => console.log(`Poupee em http://localhost:${porta} (API em /api)`));
}

iniciar().catch(err => {
  console.error('Não foi possível iniciar a API:', err.message);
  process.exit(1);
});
