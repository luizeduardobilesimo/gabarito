// Teste visual: abre o app, percorre as etapas do trilho (#rail [data-step]) e as sub-abas de cada uma, salva capturas e lista erros de JS.
// Uso:  node tools/screens.cjs [d|m|all] [--theme light|dark|both] [--html caminho/test.html] [--out pasta] [--steps terreno,viab]
//   d = desktop 1440×900 · m = celular 400×860 · all = os dois, nos dois temas
// O three.js é servido de node_modules (o teste não depende da CDN). Sai com código 1 se houver erro de JS.
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..');
const THREE_DIR = path.join(ROOT, 'node_modules', 'three');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d };
(async () => {
  const mode = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'd';
  const themeArg = arg('--theme', mode === 'all' ? 'both' : 'light');
  const html = path.resolve(arg('--html', path.join(ROOT, 'test.html')));
  const out = path.resolve(arg('--out', path.join(ROOT, 'shots')));
  const stepsArg = arg('--steps', '');   // sem --steps: as etapas que o trilho mostra (lidas da página)
  const modes = mode === 'all' ? ['d', 'm'] : [mode];
  const themes = themeArg === 'both' ? ['light', 'dark'] : [themeArg];
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  let total = 0;
  for (const md of modes) for (const th of themes) {
    const ctx = await b.newContext({ viewport: md === 'm' ? { width: 400, height: 860 } : { width: 1440, height: 900 }, deviceScaleFactor: md === 'm' ? 2 : 1, colorScheme: th });
    await ctx.addInitScript(t => { try { localStorage.setItem('gabarito.tema', JSON.stringify(t)) } catch (e) {} }, th);
    const p = await ctx.newPage();
    await p.route(/three@0\.128\.0\/build\/three\.min\.js/, r => r.fulfill({ path: path.join(THREE_DIR, 'build/three.min.js'), contentType: 'application/javascript' }));
    await p.route(/OrbitControls\.js/, r => r.fulfill({ path: path.join(THREE_DIR, 'examples/js/controls/OrbitControls.js'), contentType: 'application/javascript' }));
    const errs = []; p.on('pageerror', e => errs.push('PE ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('CE ' + m.text()) });
    await p.goto('file://' + html.split(path.sep).join('/')); await p.waitForTimeout(2500);
    const steps = stepsArg ? stepsArg.split(',') : await p.$$eval('#rail [data-step]', els => els.map(e => e.dataset.step));
    if (!steps.length) errs.push('nenhuma etapa em #rail [data-step]');
    for (const s of steps) {
      // o túnel de vento 3D (aberto na etapa anterior) segue simulando e animando por software e trava as capturas seguintes:
      // pausa e volta o palco para o 3D comum antes de trocar de etapa
      await p.evaluate(() => { try { if (typeof CFD !== 'undefined' && CFD.running) cfdPause(); if (VIEW === 'v3d') setView('3d') } catch (e) {} });
      await p.click(`#rail [data-step=${s}]`); await p.waitForTimeout(1500);
      // sub-abas: a captura da etapa é sempre a 1ª sub-aba (a última visitada fica guardada no navegador)
      const subs = await p.$$eval('#phead .sub [data-act]', els => els.map(e => [e.dataset.act, e.dataset.v || e.dataset.k || ''])).catch(() => []);
      const subSel = (act, v) => `#phead .sub [data-act="${act}"]` + (v ? `[data-v="${v}"],#phead .sub [data-act="${act}"][data-k="${v}"]` : '');
      if (subs.length && await p.$eval(subSel(...subs[0]), e => e.getAttribute('aria-pressed') !== 'true').catch(() => false)) { await p.click(subSel(...subs[0])); await p.waitForTimeout(2200) }
      try { await p.screenshot({ path: path.join(out, `${md}-${th}-${s}.png`), fullPage: md === 'm', timeout: 120000 }) } catch (e) { errs.push(`sem captura de ${s}: ${e.message.split('\n')[0]}`) }
      for (const [act, v] of subs.slice(1)) {
        // o 3D por software (swiftshader) leva 1–2 s para montar a vista da sub-aba
        try { await p.click(subSel(act, v), { timeout: 20000 }); await p.waitForTimeout(2200); await p.evaluate(() => { try { if (typeof CFD !== 'undefined' && CFD.running) cfdPause() } catch (e) {} }); await p.screenshot({ path: path.join(out, `${md}-${th}-${s}-${v || act}.png`), fullPage: md === 'm', timeout: 120000 }) } catch (e) { errs.push(`sem captura de ${s}/${v || act}: ${e.message.split('\n')[0]}`) }
      }
    }
    console.log(`[${md}/${th}]`, errs.length ? '\n  ' + errs.join('\n  ') : 'sem erros');
    total += errs.length;
    await ctx.close();
  }
  await b.close();
  process.exit(total ? 1 : 0);
})();
