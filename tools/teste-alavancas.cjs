// Ponta a ponta da Fase D: card "Alavancas" (Viabilidade › Riscos), card "Potencial do terreno" (Produto) e o otimizador com
// eficiência global / V/C na fronteira de Pareto. Salva capturas e lista erros de JS.
// Uso:  node tools/teste-alavancas.cjs [--html caminho/test.html] [--out pasta] [--sem-otim]
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..');
const THREE_DIR = path.join(ROOT, 'node_modules', 'three');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d };
(async () => {
  const html = path.resolve(arg('--html', path.join(ROOT, 'test.html'))), out = path.resolve(arg('--out', path.join(ROOT, 'shots')));
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  let falhas = 0; const ok = (c, msg) => { if (!c) { falhas++; console.log('  FALHA:', msg) } else console.log('  ok:', msg) };
  for (const [md, th] of [['d', 'light'], ['m', 'light'], ['d', 'dark'], ['m', 'dark']]) {
    console.log(`[${md}/${th}]`);
    const ctx = await b.newContext({ viewport: md === 'm' ? { width: 400, height: 860 } : { width: 1440, height: 900 }, deviceScaleFactor: md === 'm' ? 2 : 1, colorScheme: th });
    await ctx.addInitScript(t => { try { localStorage.setItem('gabarito.tema', JSON.stringify(t)) } catch (e) {} }, th);
    const p = await ctx.newPage();
    await p.route(/three@0\.128\.0\/build\/three\.min\.js/, r => r.fulfill({ path: path.join(THREE_DIR, 'build/three.min.js'), contentType: 'application/javascript' }));
    await p.route(/OrbitControls\.js/, r => r.fulfill({ path: path.join(THREE_DIR, 'examples/js/controls/OrbitControls.js'), contentType: 'application/javascript' }));
    const errs = []; p.on('pageerror', e => errs.push('PE ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('CE ' + m.text()) });
    await p.goto('file://' + html.split(path.sep).join('/'), { timeout: 90000 }); await p.waitForTimeout(2500);
    const cap = async (nome, sel) => { const f = path.join(out, `alav-${md}-${th}-${nome}.png`); if (sel) { const el = await p.$(sel); if (el) { await el.scrollIntoViewIfNeeded(); await el.screenshot({ path: f }); return } } await p.screenshot({ path: f, fullPage: md === 'm' }) };

    // --- Viabilidade › Riscos › Alavancas
    await p.click('#rail [data-step=viab]'); await p.waitForTimeout(1200);
    await p.click('#phead .sub >> text=Riscos'); await p.waitForTimeout(1500);
    ok(await p.$('#tabbody details[data-key="alavancas"]') != null, 'seção Alavancas existe em Riscos · ' + await p.evaluate(() => typeof alavHTML + ' ' + location.href.slice(-60) + ' ' + curSub() + ' ' + [...document.querySelectorAll('#tabbody details')].map(d => d.dataset.key)));
    // UX v3 §4.3: "O que melhora o resultado" vem aberta, logo depois do RES; fechada, não calcula nada
    ok(await p.$eval('#tabbody details[data-key="alavancas"]', d => d.open && d.previousElementSibling && d.previousElementSibling.matches('section.card.res')), '"O que melhora o resultado" aberta, logo depois do RES');
    await p.click('#tabbody details[data-key="alavancas"] > summary'); await p.waitForTimeout(300);
    await p.evaluate(() => { ALAV_UI.sig = null; document.getElementById('alavBox').innerHTML = '<p class="note">Calculando…</p>'; update() }); await p.waitForTimeout(1500);
    ok(await p.$eval('#alavBox', e => /Calculando/.test(e.textContent)), 'nada é calculado enquanto fechada');
    await p.click('#tabbody details[data-key="alavancas"] > summary'); await p.waitForTimeout(1500);
    const linhas = await p.$$eval('#alavBox table.alav tr', trs => trs.slice(1).map(t => t.innerText.replace(/\s+/g, ' ')));
    ok(linhas.length === 5, `5 linhas (${linhas.length})`);
    console.log('   ', linhas.map(l => l.slice(0, 90)).join('\n    '));
    const lar = await p.evaluate(() => { const t = document.querySelector('#alavBox table.alav'), c = document.querySelector('#tabbody'); return [t.scrollWidth, t.clientWidth, c.clientWidth, document.documentElement.scrollWidth, innerWidth] });
    ok(lar[0] <= lar[1] + 1 && lar[3] <= lar[4] + 1, `sem rolagem horizontal (${lar.join('/')})`);
    ok(/maior efeito/.test(await p.$eval('#sum-alavancas', e => e.textContent)), 'resumo mostra a maior alavanca');
    await cap('riscos', '#tabbody details[data-key="alavancas"]');
    // mudar o passo em "Mais opções" recalcula
    await p.click('#tabbody details[data-key="alavancas"] .advbtn'); await p.waitForTimeout(300);
    await p.fill('#f-alavancas-preco', '10'); await p.dispatchEvent('#f-alavancas-preco', 'change'); await p.waitForTimeout(800);
    ok(await p.$$eval('#alavBox table.alav tr td:first-child b', bs => bs.some(b => /\+10% preço/.test(b.textContent))), 'passo do preço editável (+10% preço)');
    await cap('riscos-passos', '#tabbody details[data-key="alavancas"]');
    await p.fill('#f-alavancas-preco', '5'); await p.dispatchEvent('#f-alavancas-preco', 'change'); await p.waitForTimeout(500);

    // --- Produto › Potencial do terreno
    await p.click('#rail [data-step=produto]'); await p.waitForTimeout(1500);
    if (await p.$eval('#phead .sub [data-act]', e => e.getAttribute('aria-pressed') !== 'true').catch(() => false)) { await p.click('#phead .sub [data-act]'); await p.waitForTimeout(800) }
    const pot = await p.$eval('#pot', e => e.innerText.replace(/\s+/g, ' ')).catch(() => '');
    ok(/Privativo possível/.test(pot), 'card Potencial do terreno: ' + pot.slice(0, 70));
    const nota = await p.$eval('#potUso', e => e.innerText.replace(/\s+/g, ' ')).catch(() => '');
    ok(!/Só pelo andar/.test(nota), 'sem nota “só pelo andar” quando a diferença é pequena (< 2%)');
    await cap('potencial', '#tabbody section.res');
    // com a garagem entrando no CA, a conta só pelo andar superestima: a nota aparece
    await p.evaluate(() => { S.regras.ncGaragem = false; save(); renderTab() }); await p.waitForTimeout(1500);
    const nota2 = await p.$eval('#potUso', e => e.innerText.replace(/\s+/g, ' ')).catch(() => ''); ok(/Só pelo andar: [\d.]+ m² \(\+\d+%\)/.test(nota2), 'nota com garagem computável: ' + nota2.slice(-50));
    await cap('potencial-garagem', '#tabbody section.res');
    await p.evaluate(() => { S.regras.ncGaragem = true; save(); renderTab() }); await p.waitForTimeout(800);

    // --- Produto › Otimizar (eficiência global e V/C na fronteira)
    if (!process.argv.includes('--sem-otim') && md === 'd' && th === 'light') {
      await p.click('#phead .sub >> text=Otimizar'); await p.waitForTimeout(1200);
      ok(await p.$('#tabbody [data-act="otk2"][data-k="efic"]') != null && await p.$('#tabbody [data-act="otk2"][data-k="vc"]') != null, 'chips Eficiência global e V/C');
      await p.click('#tabbody [data-act="otk2"][data-k="efic"]'); await p.click('#tabbody [data-act="otk2"][data-k="vc"]'); await p.waitForTimeout(300);
      await cap('otim-chips', '#otCard');
      const t0 = Date.now(); await p.click('#tabbody [data-act="otim"]');
      await p.waitForFunction(() => typeof OTIM !== 'undefined' && OTIM && OTIM.pareto && !document.querySelector('#tabbody [data-act="otim"][disabled]'), null, { timeout: 120000 });
      console.log(`    otimizador na página: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
      await p.waitForTimeout(1500);
      const crit = await p.evaluate(() => OTIM.pareto.criterios); ok(crit.includes('efic') && crit.includes('vc'), 'critérios na fronteira: ' + crit.join(', '));
      const res = await p.$eval('#otRes', e => e.innerText.replace(/\s+/g, ' ')).catch(() => ''); ok(/Margem s\/ VGV/.test(res), 'resultados mostram Margem s/ VGV');
      await cap('otim-resultados', '#otRes');
      await cap('otim-pareto', '#pfCard');
    }
    ok(errs.length === 0, 'sem erros de JS' + (errs.length ? ': ' + errs.join(' | ') : ''));
    falhas += 0; await ctx.close();
  }
  await b.close(); console.log(falhas ? `${falhas} falha(s)` : 'tudo certo'); process.exit(falhas ? 1 : 0);
})();
