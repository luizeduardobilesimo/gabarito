// Servidor de desenvolvimento: `npm run dev` monta o app a partir de src/ a cada pedido e recarrega a página quando um arquivo muda.
// O build de entrega continua sendo o arquivo único (tools/bundle.mjs → index.html / dist/).
import { defineConfig } from 'vite';
import os from 'node:os';
import { bundle } from './tools/bundle.mjs';

const gabarito = () => ({
  name: 'gabarito-bundle',
  configureServer(server) {
    server.watcher.add('src');
    server.watcher.on('change', f => { if (/[\/]src[\/]/.test(f)) server.ws.send({ type: 'full-reload' }) });
    server.middlewares.use((req, res, next) => {
      if (req.url !== '/' && !req.url.startsWith('/?') && req.url !== '/index.html') return next();
      try { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(bundle().test.replace('<body>', '<body><script type="module" src="/@vite/client"></script>')) }
      catch (e) { res.statusCode = 500; res.end('<pre>' + String(e.stack || e) + '</pre>') }
    });
  }
});
export default defineConfig({ plugins: [gabarito()], server: { port: 5173, open: false }, test: {
  include: ['tests/**/*.test.js'], testTimeout: 60000, hookTimeout: 60000,
  // processos separados e no máximo (núcleos − 1) ao mesmo tempo: com a máquina carregada (Playwright rodando junto), workers demais
  // seguravam o processo principal e o Vitest acusava "Timeout calling onTaskUpdate" sem nenhum teste ter falhado
  pool: 'forks', maxWorkers: Math.max(1, Math.min(4, os.cpus().length - 1)), minWorkers: 1,
} });
