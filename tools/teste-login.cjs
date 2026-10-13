// Teste visual da entrada pela Rixel (app web): abre o build --web como se fosse https://gabarito.rixel.com.br, com a CSP do
// vercel.json e a API simulada, percorre os estados da tela (redirecionando, entrar, sem acesso, sessão expirada, login direto)
// e o app liberado (conta no topo, estudos na "nuvem"), em desktop e celular, claro e escuro. Sai com código 1 se houver erro
// de JS ou violação de CSP.
// Uso:  node tools/bundle.mjs --out <pasta>/web --web
//       node tools/teste-login.cjs --html <pasta>/web/index.html --out <pasta>/shots-login
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..');
const THREE_DIR = path.join(ROOT, 'node_modules', 'three');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d };
const html = path.resolve(arg('--html', path.join(ROOT, 'dist', 'index.html')));
const out = path.resolve(arg('--out', path.join(ROOT, 'shots', 'login')));
const ORIGEM = 'https://gabarito.rixel.com.br';
const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
const CSP = vercel.headers[0].headers.find(h => h.key === 'Content-Security-Policy').value;
const A = '11111111-1111-4111-8111-111111111111';

/** API simulada: `eu` decide o cenário */
function api(cen) {
  const estudos = new Map(), versoes = new Map(); let n = 0;
  cen.estudos = estudos;
  const saude = { ok: true, config: { banco: true, lancamento: true, loginDireto: !!cen.loginDireto, aberto: false } };
  const json = (r, status, corpo) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(corpo) });
  return async (route) => {
    const u = new URL(route.request().url()), m = route.request().method(), p = u.pathname;
    if (p === '/api/saude') return json(route, 200, saude);
    if (p === '/api/rixel/iniciar') { cen.iniciou = true; return route.fulfill({ status: 204, body: '' }); }   // 204: o navegador fica na página ("redirecionando")
    if (p === '/api/rixel/sair') return json(route, 200, { ok: true });
    if (p === '/api/eu') return cen.eu ? json(route, 200, cen.eu) : json(route, 401, cen.erro || { erro: 'sem_sessao' });
    if (p === '/api/estudos') {
      const id = u.searchParams.get('id');
      if (m === 'GET') return id ? (estudos.has(id) ? json(route, 200, estudos.get(id)) : json(route, 404, { erro: 'nao_encontrado' })) : json(route, 200, [...estudos.values()].map(e => { const x = { ...e }; delete x.S; return x }));
      const b = JSON.parse(route.request().postData() || '{}'), agora = new Date().toISOString();
      if (m === 'POST') { const e = { ...b, id: b.id || 'e' + (++n), rev: 1, dono: A, criado: agora, atualizado: agora }; estudos.set(e.id, e); return json(route, 201, e); }
      if (m === 'PUT') { const e = { ...estudos.get(id), ...b, rev: b.rev + 1, atualizado: agora }; estudos.set(id, e); return json(route, 200, e); }
      if (m === 'DELETE') { estudos.delete(id); return json(route, 200, { ok: true }); }
    }
    if (p === '/api/versoes') {
      if (m === 'GET') return json(route, 200, u.searchParams.get('id') ? versoes.get(u.searchParams.get('id')) : []);
      const b = JSON.parse(route.request().postData() || '{}'); versoes.set(b.id, b); return json(route, 201, { ...b, criado: new Date().toISOString() });
    }
    return json(route, 404, { erro: 'sem rota' });
  };
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const pagina = fs.readFileSync(html, 'utf8');
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  let total = 0;
  const cenarios = [
    { nome: 'redirecionando', url: '/', espera: () => /Levando você para a Rixel/.test((document.querySelector('.auth-roda') || {}).textContent || '') },
    { nome: 'entrar', url: '/?entrada=expirada', espera: () => !!document.querySelector('[data-auth="rixel"]') },
    { nome: 'sem-acesso', url: '/', erro: { erro: 'sem_acesso', motivo: 'O seu plano da Rixel não inclui o Gabarito (ou ele ainda não foi liberado).' }, espera: () => /Sem acesso/.test(document.body.textContent) },
    { nome: 'expirada', url: '/', erro: { erro: 'sessao_expirada', motivo: 'A sua sessão terminou. Entre de novo pela Rixel.' }, espera: () => /Sua sessão terminou/.test(document.body.textContent) },
    { nome: 'login-direto', url: '/?saiu=1', loginDireto: true, so: ['d-light', 'm-dark'], espera: () => !!document.querySelector('form[data-auth="login"]') },
    { nome: 'app', url: '/', eu: { usuario: { id: A, email: 'luiz@exemplo.com', nome: 'Luiz Bilésimo', entrada: 'produto' }, acesso: { ok: true, plano: null, recursos: {}, motivo: '', via: 'lancamento' }, nuvem: true },
      espera: () => !document.querySelector('.auth:not([hidden])') && !!document.getElementById('authConta') },
  ];
  for (const md of ['d', 'm']) for (const th of ['light', 'dark']) {
    for (const c0 of cenarios) {
      if (c0.so && !c0.so.includes(md + '-' + th)) continue;
      const cen = { ...c0 };
      const ctx = await b.newContext({ viewport: md === 'm' ? { width: 400, height: 860 } : { width: 1440, height: 900 }, deviceScaleFactor: md === 'm' ? 2 : 1, colorScheme: th });
      await ctx.addInitScript(t => { try { localStorage.setItem('gabarito.tema', JSON.stringify(t)) } catch (e) {} }, th);
      const p = await ctx.newPage();
      const errs = [];
      p.on('pageerror', e => errs.push('PE ' + e.message));
      p.on('console', m => { const t = m.text(); if (m.type() === 'error' && !/status of 40[134]/.test(t)) errs.push('CE ' + t) });
      await p.route(/three@0\.128\.0\/build\/three\.min\.js/, r => r.fulfill({ path: path.join(THREE_DIR, 'build/three.min.js'), contentType: 'application/javascript' }));
      await p.route(/OrbitControls\.js/, r => r.fulfill({ path: path.join(THREE_DIR, 'examples/js/controls/OrbitControls.js'), contentType: 'application/javascript' }));
      const rotaApi = api(cen);
      await p.route(ORIGEM + '/**', r => {
        const u = new URL(r.request().url());
        if (u.pathname.startsWith('/api/')) return rotaApi(r);
        return r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', headers: { 'Content-Security-Policy': CSP }, body: pagina });
      });
      await p.goto(ORIGEM + cen.url, { waitUntil: 'commit' });
      try { await p.waitForFunction(cen.espera, null, { timeout: 15000 }) } catch (e) { errs.push(`estado "${cen.nome}" não apareceu`) }
      await p.waitForTimeout(cen.nome === 'app' ? 2500 : 600);
      if (cen.nome === 'redirecionando' && !cen.iniciou) errs.push('não foi para /api/rixel/iniciar sozinho');
      if (cen.nome === 'app') {
        const urlOk = await p.evaluate(() => location.pathname);
        if (urlOk !== '/') errs.push('url mudou: ' + urlOk);
        await p.click('#authContaBtn'); await p.waitForTimeout(300);
        const modo = await p.evaluate(() => Repo.modo());
        if (modo !== 'nuvem') errs.push('Repo não está na nuvem: ' + modo);
        if (!cen.estudos.size) errs.push('o estudo aberto não foi enviado para a nuvem');
      }
      await p.screenshot({ path: path.join(out, `${md}-${th}-${cen.nome}.png`) });
      if (cen.nome === 'app') {
        const aside = await p.evaluate(() => { goStep('cen'); return (document.querySelector('#tabbody .card .aside') || {}).textContent || '' });
        if (!/sua conta/.test(aside)) errs.push('etapa Cenários não mostra "salvo na sua conta": ' + aside);
      }
      console.log(`[${md}/${th}] ${cen.nome}:`, errs.length ? '\n  ' + errs.join('\n  ') : 'ok');
      total += errs.length;
      await ctx.close();
    }
  }
  await b.close();
  process.exit(total ? 1 : 0);
})();
