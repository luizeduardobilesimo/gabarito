// Teste de ponta a ponta da edição do entorno (mouse e teclado reais, sem rede).
// Uso:  node tools/teste-entorno.cjs [--html caminho/test.html]
// Confere: selecionar, mover, redimensionar, pátio, apagar, desfazer, seleção por retângulo (Shift + arrastar).
const { chromium } = require('playwright');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d };
let falhas = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FALHA') + ' ' + m); if (!c) falhas++ };
(async () => {
  const html = path.resolve(arg('--html', path.join(ROOT, 'test.html')));
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const THREE = path.join(ROOT, 'node_modules', 'three');
  await p.route(/three@0\.128\.0\/build\/three\.min\.js/, r => r.fulfill({ path: path.join(THREE, 'build/three.min.js'), contentType: 'application/javascript' }));
  await p.route(/OrbitControls\.js/, r => r.fulfill({ path: path.join(THREE, 'examples/js/controls/OrbitControls.js'), contentType: 'application/javascript' }));
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + html.split(path.sep).join('/')); await p.waitForTimeout(2500);
  await p.evaluate(async () => {
    localStorage.clear(); S.entorno = [entNovo([60, 10], 24, 18, 30, 'A'), entNovo([-60, 10], 20, 20, 18, 'B'), entNovo([60, -50], 18, 18, 12, 'C')];
    goStep('terreno'); setView('impl'); await new Promise(r => setTimeout(r, 400)); entEnquadrar(); await new Promise(r => setTimeout(r, 400));
  });
  const px = (name) => p.evaluate(n => { const e = S.entorno.find(x => x.nome === n), c = w2s_(entCentro(e)), r = c2.getBoundingClientRect(); return [c[0] + r.left, c[1] + r.top] }, name);
  const est = () => p.evaluate(() => ({ n: S.entorno.length, sel: ENT.sel.size, bar: !document.getElementById('entBar')?.hidden && !!document.getElementById('entBar'), A: S.entorno.some(x => x.nome === 'A') ? entCentro(S.entorno.find(x => x.nome === 'A')) : null, areaA: S.entorno.some(x => x.nome === 'A') ? Math.abs(G.sArea(S.entorno.find(x => x.nome === 'A').pts)) : 0 }));

  // selecionar
  let a = await px('A'); await p.mouse.click(a[0], a[1]); let s = await est();
  ok(s.sel === 1 && s.bar, 'clique seleciona e mostra a barra');
  // mover
  const c0 = s.A; await p.mouse.move(a[0], a[1]); await p.mouse.down(); await p.mouse.move(a[0] - 40, a[1] + 30, { steps: 6 }); await p.mouse.up(); s = await est();
  ok(Math.hypot(s.A[0] - c0[0], s.A[1] - c0[1]) > 3, 'arrastar move a edificação');
  // redimensionar pelo quadrado do canto
  const h = await p.evaluate(() => { const e = entSelList()[0], q = w2s_(entEscalaPos(e)), r = c2.getBoundingClientRect(); return [q[0] + r.left, q[1] + r.top] });
  const a0 = s.areaA; await p.mouse.move(h[0], h[1]); await p.mouse.down(); await p.mouse.move(h[0] + 40, h[1] - 25, { steps: 6 }); await p.mouse.up(); s = await est();
  ok(s.areaA > a0 * 1.2, 'quadrado do canto redimensiona');
  // pátio pela barra
  await p.click('#entBar [data-act="entPatio"]');
  ok(await p.evaluate(() => entVazios(entSelList()[0]).length === 1 && document.querySelector('#entBar .chip') !== null), 'botão Pátio cria o vazio e mostra o chip');
  // apagar e desfazer
  await p.keyboard.press('Delete'); s = await est(); ok(s.n === 2 && s.sel === 0, 'Delete apaga');
  await p.keyboard.press('Control+z'); await p.waitForTimeout(400); s = await est(); ok(s.n === 3, 'Ctrl+Z desfaz o apagar');
  // seleção por retângulo
  await p.evaluate(() => entLimpaSel());
  // retângulo da esquerda para a direita, na altura dos centros de A e B (C fica de fora, abaixo)
  const r = await p.evaluate(() => { const rc = c2.getBoundingClientRect(), ys = ['A', 'B'].map(n => w2s_(entCentro(S.entorno.find(x => x.nome === n)))[1]), xs = ['A', 'B'].map(n => w2s_(entCentro(S.entorno.find(x => x.nome === n)))[0]);
    return [rc.left + Math.max(12, Math.min(...xs) - 120), rc.top + Math.min(rc.height - 12, Math.max(...ys) + 120), rc.left + Math.max(...xs) + 120, rc.top + Math.min(...ys) - 120] });
  await p.keyboard.down('Shift'); await p.mouse.move(r[0], r[1]); await p.mouse.down(); await p.mouse.move(r[2], r[3], { steps: 8 }); await p.mouse.up(); await p.keyboard.up('Shift');
  s = await est(); ok(s.sel === 2, `Shift + arrastar seleciona as duas dentro do retângulo (${s.sel})`);
  ok(errs.length === 0, 'sem erros de JS' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close(); process.exit(falhas ? 1 : 0);
})();
