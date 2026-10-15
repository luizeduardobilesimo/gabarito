// Comum aos testes com Playwright (tools/*.cjs): bibliotecas locais, fonte em cache e "app pronto".
//   prepara(page|context)  three.js r128 e OrbitControls de node_modules (o teste não depende da CDN) e a fonte do Google
//                          (DM Sans) servida de um cache local em node_modules/.cache/gabarito-fontes. Na 1ª vez a fonte vem
//                          da rede com limite de 5 s; sem rede, o CSS sai vazio e o app usa a fonte reserva — a fonte nunca
//                          segura o carregamento da página.
//   abre(page, html|url, {timeout})  page.goto com waitUntil "domcontentloaded" e espera o app pronto (appPronto).
//   appPronto(page)        espera STEPS, o trilho (#rail [data-step]) e o primeiro cálculo (window._last).
const path = require('path'), fs = require('fs'), { pathToFileURL } = require('url');
const ROOT = path.resolve(__dirname, '..');
const THREE_DIR = path.join(ROOT, 'node_modules', 'three');
const CACHE = path.join(ROOT, 'node_modules', '.cache', 'gabarito-fontes');
const nomeCache = u => u.replace(/^https?:\/\//, '').replace(/[^a-z0-9.]+/gi, '_').slice(-180);
async function daRede(route, arq, tipo) {
  try {
    if (fs.existsSync(arq)) return route.fulfill({ path: arq, contentType: tipo, headers: { 'access-control-allow-origin': '*' } });
    const r = await route.fetch({ timeout: 5000 });
    if (!r.ok()) throw new Error('HTTP ' + r.status());
    const corpo = await r.body(); fs.mkdirSync(CACHE, { recursive: true }); fs.writeFileSync(arq, corpo);
    return route.fulfill({ body: corpo, contentType: tipo, headers: { 'access-control-allow-origin': '*' } });
  } catch (e) {
    return tipo === 'text/css' ? route.fulfill({ body: '', contentType: 'text/css' }).catch(() => {}) : route.abort().catch(() => {});
  }
}
async function prepara(alvo, { fontes = true } = {}) {
  await alvo.route(/three@0\.128\.0\/build\/three\.min\.js/, r => r.fulfill({ path: path.join(THREE_DIR, 'build/three.min.js'), contentType: 'application/javascript' }));
  await alvo.route(/OrbitControls\.js/, r => r.fulfill({ path: path.join(THREE_DIR, 'examples/js/controls/OrbitControls.js'), contentType: 'application/javascript' }));
  if (fontes) {
    await alvo.route(/fonts\.googleapis\.com/, r => daRede(r, path.join(CACHE, nomeCache(r.request().url()) + '.css'), 'text/css'));
    await alvo.route(/fonts\.gstatic\.com/, r => daRede(r, path.join(CACHE, nomeCache(r.request().url())), 'font/woff2'));
  } else await alvo.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
}
async function appPronto(p, timeout = 90000) {
  await p.waitForFunction(() => typeof STEPS !== 'undefined' && !!document.querySelector('#rail [data-step]') && !!window._last, null, { timeout, polling: 200 });
  await p.waitForTimeout(300);
}
async function abre(p, alvo, { timeout = 90000, pronto = true } = {}) {
  const url = /^(https?|file):/.test(alvo) ? alvo : pathToFileURL(path.resolve(alvo)).href;
  await p.goto(url, { waitUntil: 'domcontentloaded', timeout });
  if (pronto) await appPronto(p, timeout);
}
module.exports = { prepara, abre, appPronto, ROOT, THREE_DIR };
