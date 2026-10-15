// Teste de ponta a ponta dos itens 0.3 / 0.4 / 4.1 (plataforma): Web Worker, desfazer/refazer, versões e estudos.
// Uso:  node tools/teste-plataforma.cjs [--html caminho/test.html] [--out pasta-de-capturas]
// Sai com código 1 se alguma verificação falhar ou houver erro de JS.
const { chromium } = require('playwright');
const { prepara, abre } = require('./pw-comum.cjs');
const path = require('path'), fs = require('fs');
const { pathToFileURL } = require('url');
const ROOT = path.resolve(__dirname, '..');
const THREE = path.join(ROOT, 'node_modules', 'three');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d };
const HTML = path.resolve(arg('--html', path.join(ROOT, 'test.html')));
const OUT = arg('--out', null);
let falhas = 0;
const ok = (cond, msg, extra) => { console.log((cond ? '  ok   ' : '  FALHA ') + msg + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')); if (!cond) falhas++ };

async function abrir(b, o = {}) {
  const ctx = await b.newContext({ viewport: o.viewport || { width: 1440, height: 900 }, colorScheme: o.tema || 'light' });
  if (o.init) await ctx.addInitScript(o.init);
  const p = await ctx.newPage();
  await prepara(p);
  p.errs = []; p.on('pageerror', e => p.errs.push('PE ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) p.errs.push('CE ' + m.text()) });
  await p.goto(pathToFileURL(HTML).href, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof CALC !== 'undefined' && window._last, null, { timeout: 30000 });
  return p;
}
const ocioso = p => p.waitForFunction(() => calcOcioso(), null, { timeout: 120000 });
const nums = p => p.evaluate(() => histNums(window._last.m, window._last.f));
const step = async (p, k) => { await p.click(`#rail [data-step=${k}]`); await p.waitForTimeout(250); await ocioso(p) };
/* mede travamentos da página: maior intervalo entre quadros (rAF) durante fn() */
async function travamento(p, fn) {
  await p.evaluate(() => { window.__gaps = []; let t = performance.now(); window.__raf = true; const f = () => { const n = performance.now(); window.__gaps.push(n - t); t = n; if (window.__raf) requestAnimationFrame(f) }; requestAnimationFrame(f) });
  await fn();
  return p.evaluate(() => { window.__raf = false; const g = window.__gaps.slice(1); return { max: Math.round(Math.max(0, ...g)), quadros: g.length } });
}

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const p = await abrir(b);

  console.log('0.3 — cálculo em segundo plano');
  ok(await p.evaluate(() => CALC.estado === 'ok' || CALC.estado === 'iniciando'), 'Worker criado a partir de #calcSrc', await p.evaluate(() => CALC.estado));
  const tIni = Date.now(); await ocioso(p);
  ok(await p.evaluate(() => CALC.estado === 'ok'), 'Worker respondeu', { ms: Date.now() - tIni });
  ok(await p.evaluate(() => !!window._last.m.gar && Object.keys(window._last.m.gar).length > 0), 'resultado completo (com garagens) chegou do Worker');
  // o resultado do Worker é igual ao cálculo na página
  const igual = await p.evaluate(() => { const a = histNums(window._last.m, window._last.f), m = compute(S), b = histNums(m, finance(S, m)); return { a, b, eq: JSON.stringify(a) === JSON.stringify(b) } });
  ok(igual.eq, 'números do Worker = números do cálculo na página', igual.eq ? igual.a : igual);
  // arrastar um slider: a página não trava
  await step(p, 'produto');
  await p.evaluate(() => { SUBX.produto = 'prod'; renderTab(); const d = document.querySelector('#tabbody details[data-key="pr-emb"]'); if (d) { d.open = true; const a = d.querySelector('.adv .advb'); if (a && a.hidden) d.querySelector('.adv .advbtn').click() } }); await p.waitForTimeout(200);   // o slider de lojas fica em "Garagem e térreo" › Mais opções (UX v3)
  const sl = await p.$('#tabbody input[type=range][data-fx="upd"]');
  if (sl) {
    const box = await sl.boundingBox();
    const t = await travamento(p, async () => {
      await p.mouse.move(box.x + 4, box.y + box.height / 2); await p.mouse.down();
      for (let i = 0; i <= 30; i++) { await p.mouse.move(box.x + 4 + (box.width - 8) * i / 30, box.y + box.height / 2); await p.waitForTimeout(16) }
      await p.mouse.up(); await p.waitForTimeout(200);
    });
    ok(t.max < 250, 'arrastar slider sem travar (maior intervalo entre quadros)', t);
    const t2 = await travamento(p, () => ocioso(p));
    ok(t2.max < 250, 'cálculo completo depois do arraste sem travar a página', t2);
  } else ok(false, 'slider encontrado na etapa Produto');
  ok(await p.evaluate(() => document.getElementById('kpis').classList.contains('busy')) === false, 'indicador "calculando…" some quando termina');

  // otimizador: cancelar e rodar até o fim (sub-aba Otimizar da etapa Produto)
  await p.evaluate(() => { SUBX.produto = 'otim'; renderTab() }); await p.waitForTimeout(200);
  await p.click('#tabbody [data-act="otim"]');
  await p.waitForSelector('#tabbody [data-act="calcCancel"]', { timeout: 15000 });
  const tOt = await travamento(p, () => p.waitForTimeout(1500));
  ok(tOt.max < 250, 'otimizador rodando sem travar a página', tOt);
  await p.click('#tabbody [data-act="calcCancel"]'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => !OTRUN && !CALC.jobAtivo), 'otimizador cancelado');
  await p.click('#tabbody [data-act="otim"]');
  await p.waitForFunction(() => !OTRUN && OTIM, null, { timeout: 240000 });
  ok(await p.evaluate(() => Array.isArray(OTIM.res)), 'otimizador terminou no Worker', await p.evaluate(() => ({ opcoes: OTIM.res.length, testadas: OTIM.testadas, s: Math.round(OTIM.ms / 1000) })));
  await p.evaluate(() => { SUBX.produto = 'prod'; LS.set('gabarito.subx', SUBX) });   // volta à sub-aba Produto (a de campos) para os testes seguintes

  // melhor acesso: cancelar e rodar até o fim
  await p.evaluate(() => goStep('projeto', 'gar')); await p.waitForTimeout(400); await ocioso(p);
  await p.click('#tabbody [data-act="acessoStudy"]');
  await p.waitForSelector('#rsCancel', { timeout: 15000 });
  const tAc = await travamento(p, () => p.waitForTimeout(1500));
  ok(tAc.max < 250, 'melhor acesso rodando sem travar a página', tAc);
  await p.click('#rsCancel'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => !CALC.jobAtivo && RS === null), 'melhor acesso cancelado');
  await p.click('#tabbody [data-act="acessoStudy"]');
  await p.waitForFunction(() => !CALC.jobAtivo && RS && RS.list.length && /analisadas/.test(document.getElementById('rsStat').textContent), null, { timeout: 240000 });
  ok(await p.evaluate(() => RS.list.filter(c => c.fino).length > 0), 'melhor acesso terminou no Worker', await p.evaluate(() => RS.list.slice(0, 3).map(c => [c.acessoVei, c.rampaTipo, c.vagas])));

  console.log('0.4 — desfazer / refazer');
  await p.evaluate(() => histCommit());
  // em todas as etapas: muda o primeiro campo numérico e desfaz
  // UX v3: 5 etapas; Projeto em duas sub-abas (Garagem e Sol, que absorveram Regras › Projeto e Clima)
  for (const k of ['terreno', 'produto', 'viab', 'projeto:gar', 'projeto:sol']) {
    if (k.includes(':')) { await p.evaluate(([e, s]) => goStep(e, s), k.split(':')); await p.waitForTimeout(400); await ocioso(p) } else await step(p, k);
    // interface v2: campos ficam em sub-abas e seções recolhidas — vai à sub-aba de premissas e abre as seções
    await p.evaluate(k => { if (k === 'viab') { SUBX.viab = 'prem'; renderTab() } document.querySelectorAll('#tabbody details.sec').forEach(d => d.open = true) }, k); await p.waitForTimeout(200);
    const antes = await p.evaluate(() => { histCommit(); return JSON.stringify(S) }), n0 = await p.evaluate(() => HIST.undo.length);
    const campo = p.locator('#tabbody input[type=number][data-p]:not([disabled]):visible').first();
    const faixa = p.locator('#tabbody input[type=range][data-p]:visible').first();
    let cp;
    if (await campo.count()) {
      cp = await campo.getAttribute('data-p');
      await campo.click({ clickCount: 3 }); await campo.type(String((+(await campo.inputValue()) || 0) + 1)); await campo.press('Tab');
    } else if (await faixa.count()) {
      // slider: arrasta com o mouse (vira um passo só, ao soltar)
      cp = await faixa.getAttribute('data-p'); const bx = await faixa.boundingBox();
      await p.mouse.move(bx.x + bx.width * 0.2, bx.y + bx.height / 2); await p.mouse.down();
      for (let i = 1; i <= 8; i++) { await p.mouse.move(bx.x + bx.width * (0.2 + i * 0.07), bx.y + bx.height / 2); await p.waitForTimeout(20) }
      await p.mouse.up();
    } else { ok(false, `campo editável na etapa ${k}`); continue }
    await p.waitForTimeout(700);
    const mudou = await p.evaluate(a => JSON.stringify(S) !== a, antes), passos = await p.evaluate(() => { histCommit(); return HIST.undo.length }) - n0;
    await p.evaluate(() => document.activeElement && document.activeElement.blur());
    await p.keyboard.press('Control+z'); await p.waitForTimeout(300);
    const volta = await p.evaluate(a => JSON.stringify(S) === a, antes);
    await p.keyboard.press('Control+Shift+z'); await p.waitForTimeout(300);
    const refaz = await p.evaluate(a => JSON.stringify(S) !== a, antes);
    ok(mudou && passos === 1 && volta && refaz, `etapa ${k}: mudar ${cp} (1 passo), desfazer e refazer`, { mudou, passos, volta, refaz });
    await p.keyboard.press('Control+z'); await p.waitForTimeout(200);
  }
  // arrastar um vértice do lote na planta
  await step(p, 'terreno'); await p.evaluate(() => setView('impl')); await p.waitForTimeout(400);
  const antesV = await p.evaluate(() => JSON.stringify(S.lote.pts));
  const sc = await p.evaluate(() => { const r = c2.getBoundingClientRect(), q = w2s_(S.lote.pts[2]); return [r.left + q[0], r.top + q[1]] });
  await p.mouse.move(sc[0], sc[1]); await p.mouse.down();
  for (let i = 1; i <= 10; i++) { await p.mouse.move(sc[0] + i * 3, sc[1] + i * 2); await p.waitForTimeout(16) }
  await p.mouse.up(); await p.waitForTimeout(800);
  const depoisV = await p.evaluate(() => JSON.stringify(S.lote.pts));
  const passos = await p.evaluate(() => HIST.undo.length);
  await p.click('#undoBtn'); await p.waitForTimeout(300);
  ok(depoisV !== antesV && await p.evaluate(a => JSON.stringify(S.lote.pts) === a, antesV), 'arrastar vértice na planta e desfazer (botão do topo)', { passos });
  await p.click('#redoBtn'); await p.waitForTimeout(300);
  ok(await p.evaluate(a => JSON.stringify(S.lote.pts) === a, depoisV), 'refazer o arraste (botão do topo)');
  await p.click('#undoBtn'); await ocioso(p);
  // marcar uma vaga na planta da garagem
  await p.evaluate(() => goStep('projeto', 'gar')); await p.waitForTimeout(400); await ocioso(p);
  const vg = await p.evaluate(() => { const lay = window._last.m.gar[FLOOR]; const v = lay && lay.vagas.find(v => v.tipo !== 'off' && v.tipo !== 'faixa'); if (!v) return null; const c = G.centroid(v.poly), q = w2s_(c), r = c2.getBoundingClientRect(); return { x: r.left + q[0], y: r.top + q[1], key: v.key } });
  if (vg) {
    const antesO = await p.evaluate(() => JSON.stringify([S.estudo.off, S.estudo.vtipo]));
    await p.mouse.click(vg.x, vg.y); await p.waitForTimeout(800);
    const marcou = await p.evaluate(a => JSON.stringify([S.estudo.off, S.estudo.vtipo]) !== a, antesO);
    await p.keyboard.press('Control+z'); await p.waitForTimeout(300);
    ok(marcou && await p.evaluate(a => JSON.stringify([S.estudo.off, S.estudo.vtipo]) === a, antesO), 'marcar vaga na planta e desfazer', vg.key);
  } else ok(false, 'vaga encontrada na planta da garagem');
  await ocioso(p);

  console.log('0.4 / 4.1 — versões e estudos');
  await p.evaluate(() => { SUBX.cen = 'estudos' }); await step(p, 'cen'); await p.evaluate(() => document.querySelectorAll('#tabbody details.sec').forEach(d => { d.open = true })); await p.waitForTimeout(200);   // Estudos e Versões vêm fechadas
  await p.waitForFunction(() => EST.pronto, null, { timeout: 15000 });
  ok(await p.evaluate(() => EST.lista.length >= 1 && !!LS.get('gabarito.v2')), 'estudo atual migrado para o repositório (gabarito.v2 mantido)', await p.evaluate(() => ({ estudos: EST.lista.length, modo: Repo.modo() })));
  await p.fill('#vsNome', 'Base do teste'); await p.click('[data-act="vsSalvar"]');
  await p.waitForFunction(() => EST.versoes.some(v => v.nome === 'Base do teste'), null, { timeout: 30000 });
  const vBase = await p.evaluate(() => EST.versoes.find(v => v.nome === 'Base do teste'));
  const kBase = await nums(p);
  // muda bastante coisa
  await p.evaluate(() => { S.produto.subsolos = 1; S.produto.torres = [{ pav: 6 }]; S.fin.cub = 3500; S.lote.acessoVei = 0.3; update() }); await ocioso(p);
  const kMud = await nums(p);
  ok(kMud.vgv !== kBase.vgv || kMud.units !== kBase.units, 'estudo alterado', { antes: kBase.units, depois: kMud.units });
  await p.click(`[data-act="vsRest"][data-id="${vBase.id}"]`); await p.waitForTimeout(400); await ocioso(p);
  const kRest = await nums(p);
  ok(JSON.stringify(kRest) === JSON.stringify(vBase.k), 'restaurar versão reproduz exatamente os números', { salvo: vBase.k.vgv, restaurado: kRest.vgv, units: kRest.units });
  ok(await p.evaluate(() => EST.versoes.some(v => v.nome === 'Antes de restaurar')), 'estado anterior guardado como versão automática antes de restaurar');
  await p.keyboard.press('Control+z'); await p.waitForTimeout(300); await ocioso(p);
  ok(JSON.stringify(await nums(p)) === JSON.stringify(kMud), 'Ctrl+Z desfaz a restauração');
  await p.keyboard.press('Control+Shift+z'); await ocioso(p);
  // salvamento automático (intervalo encurtado para o teste)
  const nAntes = await p.evaluate(() => EST.versoes.length);
  await p.evaluate(async () => { EST.autoMin = 0; HIST.mudou = true; estAuto(); });
  await p.waitForFunction(n => EST.versoes.length > n, nAntes, { timeout: 30000 });
  ok(true, 'versão automática criada');
  // comparar
  await p.click(`#vsBox [data-act="vsCmp"][data-id="${vBase.id}"]`); await p.waitForTimeout(300);
  ok(await p.evaluate(() => !document.getElementById('cmpSec').hidden && document.querySelectorAll('#cmpBox th').length === 3), 'comparar versão com o atual');
  await p.click('[data-act="cmpLimpa"]'); await p.waitForTimeout(200);
  if (OUT) { fs.mkdirSync(OUT, { recursive: true }); await p.screenshot({ path: path.join(OUT, 'plataforma-cen.png') }) }
  // estudos: novo, duplicar, abrir, excluir
  const id0 = await p.evaluate(() => EST.id), nome0 = await p.evaluate(() => S.nome);
  await p.evaluate(() => ACT.estNovoVazio()); await p.waitForFunction(id => EST.id !== id, id0, { timeout: 15000 }); await ocioso(p);
  ok(await p.evaluate(() => S.nome === 'Novo estudo' && HIST.undo.length === 0), 'novo estudo criado e aberto (histórico zerado)');
  await p.click(`[data-act="estAbrir"][data-id="${id0}"]`); await p.waitForFunction(id => EST.id === id, id0, { timeout: 15000 }); await ocioso(p);
  ok(await p.evaluate(n => S.nome === n, nome0) && JSON.stringify(await nums(p)) === JSON.stringify(kRest), 'reabrir o primeiro estudo devolve o estado e os números');
  const n1 = await p.evaluate(() => EST.lista.length);
  await p.click(`#estBox .lrow.on [data-act="estDup"]`); await p.waitForFunction(n => EST.lista.length === n + 1, n1, { timeout: 15000 });
  ok(true, 'estudo duplicado');
  const outro = await p.evaluate(() => EST.lista.find(e => e.id !== EST.id && e.nome === 'Novo estudo').id);
  await p.click(`[data-act="estDel"][data-id="${outro}"]`); await p.click(`[data-act="estDel"][data-id="${outro}"]`);
  await p.waitForFunction(id => !EST.lista.some(e => e.id === id), outro, { timeout: 15000 });
  ok(true, 'estudo excluído (com confirmação)');
  // recarregar: tudo continua lá
  const idAtual = await p.evaluate(() => EST.id), nEst = await p.evaluate(() => EST.lista.length);
  await p.waitForTimeout(1700);
  await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForFunction(() => typeof EST !== 'undefined' && EST.pronto, null, { timeout: 30000 }); await ocioso(p);
  ok(await p.evaluate(([id, n]) => EST.id === id && EST.lista.length === n, [idAtual, nEst]), 'depois de recarregar: mesmo estudo aberto e mesma lista (IndexedDB)');
  ok(JSON.stringify(await nums(p)) === JSON.stringify(kRest), 'depois de recarregar: mesmos números');
  ok(!p.errs.length, 'sem erros de JS', p.errs.slice(0, 5));

  console.log('0.3 — volta para a página sem Worker');
  const q = await abrir(b, { init: () => { try { localStorage.setItem('gabarito.worker', 'false') } catch (e) {} } });
  ok(await q.evaluate(() => CALC.estado === 'falhou' && !!window._last.m.gar), 'sem Worker: cálculo completo na página', await q.evaluate(() => CALC.estado));
  await q.evaluate(() => goStep('produto')); await q.waitForTimeout(300);
  await q.click('#tabbody [data-act="otim"]');
  await q.waitForFunction(() => !OTRUN && OTIM, null, { timeout: 240000 });
  ok(true, 'otimizador na página (sem Worker)');
  ok(!q.errs.length, 'sem erros de JS (sem Worker)', q.errs.slice(0, 5));

  await b.close();
  console.log(falhas ? `\n${falhas} verificação(ões) falharam` : '\ntudo certo');
  process.exit(falhas ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1) });
