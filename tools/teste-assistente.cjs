// Teste de ponta a ponta do assistente "Novo estudo", da faixa do exemplo e do checklist (UX v3 §3, pacote P7).
// Uso:  node tools/teste-assistente.cjs [--html <build>/test.html] [--out <pasta de capturas>] [--rapido]
//  - com navigator.webdriver (Playwright) a 1ª visita NÃO abre nada sozinha; assAbrir() abre o assistente;
//  - 20 × 40 m, Criciúma, "Família" a R$ 12.000/m² → cai em Viabilidade com lucro calculado; Ctrl+Z volta ao exemplo;
//  - a faixa do exemplo some ao renomear; o anel do checklist abre o popover;
//  - capturas de cada passo (desktop 1440 e celular 400, claro e escuro) em --out. Sai com 1 se algo falhar ou houver erro de JS.
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..');
const THREE_DIR = path.join(ROOT, 'node_modules', 'three');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d };
const html = path.resolve(arg('--html', path.join(ROOT, 'test.html')));
const out = path.resolve(arg('--out', path.join(ROOT, 'shots', 'assistente')));
const rapido = process.argv.includes('--rapido');
fs.mkdirSync(out, { recursive: true });
let falhas = 0;
const ok = (c, msg) => { console.log((c ? '  ok   ' : '  FALHA ') + msg); if (!c) falhas++ };

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const combos = rapido ? [['d', 'light']] : [['d', 'light'], ['d', 'dark'], ['m', 'light'], ['m', 'dark']];
  for (const [md, th] of combos) {
    const tag = `${md}-${th}`, completo = tag === 'd-light' || tag === 'm-dark';
    console.log(`[${tag}]`);
    const ctx = await b.newContext({ viewport: md === 'm' ? { width: 400, height: 860 } : { width: 1440, height: 900 }, deviceScaleFactor: md === 'm' ? 2 : 1, colorScheme: th });
    await ctx.addInitScript(t => { try { localStorage.setItem('gabarito.tema', JSON.stringify(t)) } catch (e) {} }, th);
    const p = await ctx.newPage();
    await p.route(/three@0\.128\.0\/build\/three\.min\.js/, r => r.fulfill({ path: path.join(THREE_DIR, 'build/three.min.js'), contentType: 'application/javascript' }));
    await p.route(/OrbitControls\.js/, r => r.fulfill({ path: path.join(THREE_DIR, 'examples/js/controls/OrbitControls.js'), contentType: 'application/javascript' }));
    const errs = []; p.on('pageerror', e => errs.push('PE ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('CE ' + m.text()) });
    await p.goto('file://' + html.split(path.sep).join('/')); await p.waitForTimeout(2500);
    const shot = n => p.screenshot({ path: path.join(out, `${tag}-${n}.png`) });

    // 1ª visita com webdriver: nada abre sozinho (e a linha do main.js do P1 também não abre)
    await p.evaluate(() => typeof assInicio === 'function' && assInicio()); await p.waitForTimeout(700);
    ok(await p.evaluate(() => !document.getElementById('assWiz') || document.getElementById('assWiz').hidden), 'sem boas-vindas com navigator.webdriver');
    ok(await p.evaluate(() => { const e = document.getElementById('exBanner'); return !!e && !e.hidden }), 'faixa do estudo de exemplo visível');
    if (tag === 'd-light') {
      // anel do checklist (o P1 vai pôr no topo; aqui é colocado à mão) e popover
      await p.evaluate(() => { const pr = document.querySelector('.top .proj'); pr.insertAdjacentHTML('beforeend', progressoAnelHTML()) });
      await p.click('.top [data-prog-anel]'); await p.waitForTimeout(300);
      ok(await p.evaluate(() => !document.getElementById('progPop').hidden && document.querySelectorAll('#progPop .pp-i').length === 9), 'checklist abre com 9 itens');
      await shot('checklist');
      const pp = await p.evaluate(() => proximoPassoAtual());
      ok(!!(pp && pp.rotulo), `próximo passo: "${pp && pp.rotulo}" (${pp && pp.dica})`);
      await p.keyboard.press('Escape');
    }

    // assistente
    await p.evaluate(() => assAbrir()); await p.waitForTimeout(450);
    ok(await p.evaluate(() => !document.getElementById('assWiz').hidden), 'assAbrir() abre o assistente');
    await shot('1-terreno');
    await p.fill('#assN', 'Rua das Palmeiras, 300');
    await p.fill('#assF', '20'); await p.fill('#assP', '40');
    if (tag === 'd-light') {
      await p.click('[data-modo="coord"]'); await p.waitForTimeout(150); await p.fill('#assC', '-28.6775, -49.3697\n-28.6775, -49.3693\n-28.6779, -49.3693'); await shot('1b-coordenadas');
      await p.click('[data-modo="mapa"]'); await p.waitForTimeout(150); await shot('1c-mapa');
      await p.click('[data-modo="ret"]'); await p.waitForTimeout(150);
      await p.fill('#assF', '2'); await p.click('[data-a="seguir"]'); await p.waitForTimeout(150);
      ok(await p.$eval('.ass-body [role=alert]', e => /5 m/.test(e.textContent)).catch(() => false), 'frente pequena demais é recusada');
      await p.fill('#assF', '20');
    }
    await p.click('[data-a="seguir"]'); await p.waitForTimeout(300);
    const cid = await p.evaluate(() => (cidadesLista().find(c => /Crici/.test(c.cidade)) || cidadesLista()[0]).id);
    await p.selectOption('#assCid', cid); await p.waitForTimeout(250);
    ok(await p.$eval('#assR-caMax', e => e.value) === '4', 'cidade preenche o aproveitamento máximo');
    await shot('2-regras');
    if (tag === 'd-light') { await p.selectOption('#assCid', '__outra'); await p.waitForTimeout(200); await shot('2b-outra'); await p.selectOption('#assCid', cid); await p.waitForTimeout(200) }
    await p.click('[data-a="seguir"]'); await p.waitForTimeout(300);
    await p.click('[data-padrao="familia"]');
    await p.fill('#assPr', '12000');
    await shot('3-produto');
    if (!completo) { await p.click('[data-a="fechar"]'); await p.waitForTimeout(200); ok(await p.evaluate(() => document.getElementById('assWiz').hidden), 'cancelar fecha sem mudar o estudo'); }
    else {
      // comparação canônica (o desfazer pode reordenar as chaves de um objeto)
      await p.evaluate(() => { window._canon = o => JSON.stringify(o, (k, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map(x => [x, v[x]])) : v) });
      const antes = await p.evaluate(() => _canon(S));
      await p.click('[data-a="seguir"]'); await p.waitForTimeout(900); await shot('4-gerando');
      await p.waitForFunction(() => document.getElementById('assWiz').hidden, null, { timeout: 120000 });
      await p.evaluate(() => calcPronto()); await p.waitForTimeout(1500);
      const r = await p.evaluate(() => ({ tab: TAB, nome: S.nome, area: G.area(S.lote.pts), ref: S.regrasRef.id, lucro: window._last.f.lucro, vgv: window._last.f.vgv,
        un: window._last.m.units, conf: S.guia.conf, ex: assEhExemplo(S), feito: !document.getElementById('assFeito').hidden, banner: !!document.getElementById('exBanner') && !document.getElementById('exBanner').hidden,
        undo: HIST.undo.length, preco: S.produto.mix.map(u => u.preco) }));
      ok(r.tab === 'viab', `cai em Viabilidade (${r.tab})`);
      ok(r.nome === 'Rua das Palmeiras, 300' && Math.abs(r.area - 800) < 1e-6, `estudo "${r.nome}", lote ${r.area} m²`);
      ok(/crici/.test(r.ref), `regras de ${r.ref}`);
      ok(isFinite(r.lucro) && r.vgv > 0, `lucro calculado: R$ ${(r.lucro / 1e6).toFixed(2)} mi · VGV ${(r.vgv / 1e6).toFixed(1)} mi · ${r.un} unidades`);
      ok(r.preco.every(v => v >= 11000 && v <= 13000), `preços do mix a partir de R$ 12.000 (${r.preco.join(', ')})`);
      ok(r.conf.preco === true, 'preço conferido pelo assistente');
      ok(r.feito && !r.banner && !r.ex, 'cartão "O que fizemos" visível e sem faixa de exemplo');
      ok(r.undo === 1, `um único passo de desfazer (${r.undo})`);
      await shot('5-pronto');
      // Ctrl+Z volta tudo
      await p.click('#view', { position: { x: 30, y: 300 } }).catch(() => {}); await p.mouse.click(5, 5).catch(() => {});
      await p.evaluate(() => document.activeElement && document.activeElement.blur());
      await p.keyboard.press('Control+z'); await p.waitForTimeout(1200);
      const d = await p.evaluate(a => ({ igual: _canon(S) === a, ex: assEhExemplo(S), nome: S.nome, banner: !document.getElementById('exBanner').hidden, feito: document.getElementById('assFeito').hidden }), antes);
      ok(d.ex && d.banner, `Ctrl+Z volta ao exemplo (${d.nome}), faixa de volta`);
      ok(d.igual, 'estado idêntico ao de antes do assistente');
      ok(d.feito, 'cartão fecha ao desfazer');
      await p.keyboard.press('Control+Shift+z'); await p.waitForTimeout(900);
      ok(await p.evaluate(() => S.nome === 'Rua das Palmeiras, 300'), 'refazer devolve o estudo gerado');
    }
    // faixa some ao renomear
    await p.evaluate(() => { if (!assEhExemplo(S)) { histUndo() } });
    await p.waitForTimeout(500);
    await p.click('#projName', { clickCount: 3 }); await p.keyboard.type('Meu terreno');
    await p.waitForTimeout(200);
    ok(await p.evaluate(() => document.getElementById('exBanner').hidden), 'faixa do exemplo some ao renomear');
    if (tag === 'd-light') {
      await p.evaluate(() => { S.nome = DEF.nome; document.getElementById('projName').value = S.nome; assBanner() });
      await p.click('#exBanner [data-exb="base"]'); await p.waitForTimeout(200);
      ok(await p.evaluate(() => document.getElementById('exBanner').hidden && !assEhExemplo(S)), '"Usar como base" renomeia e tira a faixa');
    }
    console.log(errs.length ? '  erros de JS:\n    ' + errs.join('\n    ') : '  sem erros de JS');
    falhas += errs.length;
    await ctx.close();
  }
  await b.close();
  console.log(falhas ? `${falhas} falha(s)` : 'tudo certo');
  process.exit(falhas ? 1 : 0);
})();
