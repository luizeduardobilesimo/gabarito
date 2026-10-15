// Teste visual: abre o app, percorre as etapas do trilho (#rail [data-step]) e as sub-abas de cada uma, salva capturas e lista erros de JS.
// Uso:  node tools/screens.cjs [d|m|all] [--theme light|dark|both] [--html caminho/test.html] [--out pasta] [--steps terreno,viab]
//   d = desktop 1440×900 · m = celular 400×860 · all = os dois, nos dois temas
//   No celular, cada tela sai duas vezes: com a folha na altura média (<nome>.png) e cheia (<nome>-cheia.png).
//   Em Projeto › Vento, também o túnel 3D (chave "Túnel 3D", ACT.vmodo): <…>-projeto-vento-v3d.png. Ao sair da sub-aba o túnel pausa
//   sozinho (cfdNoTunel, src/wind3d.js) — o teste confere isso em vez de pausar à força.
//   --steps aceita os nomes antigos (regras → terreno, clima → projeto).
// O three.js e a fonte vêm de cópias locais (tools/pw-comum.cjs). Sai com código 1 se houver erro de JS.
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const { prepara, abre, ROOT } = require('./pw-comum.cjs');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d };
const ALIAS = { regras: 'terreno', clima: 'projeto', cenarios: 'cen', entrega: 'cen', viabilidade: 'viab' };
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
    await prepara(p);
    const errs = []; p.on('pageerror', e => errs.push('PE ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('CE ' + m.text()) });
    await abre(p, html); await p.waitForTimeout(1500);
    const steps = stepsArg ? [...new Set(stepsArg.split(',').map(s => ALIAS[s] || s))] : await p.$$eval('#rail [data-step]', els => els.map(e => e.dataset.step));
    if (!steps.length) errs.push('nenhuma etapa em #rail [data-step]');
    const folha = n => p.evaluate(n => { try { if (typeof folhaSet === 'function') folhaSet(n) } catch (e) {} }, n);
    // captura: no desktop a página; no celular a folha média e a folha cheia
    const shot = async nome => {
      if (md !== 'm') return p.screenshot({ path: path.join(out, nome + '.png'), timeout: 120000 });
      await folha('media'); await p.waitForTimeout(450); await p.screenshot({ path: path.join(out, nome + '.png'), timeout: 120000 });
      await folha('cheia'); await p.waitForTimeout(450); await p.screenshot({ path: path.join(out, nome + '-cheia.png'), timeout: 120000 });
      await folha('media'); await p.waitForTimeout(300);
    };
    const subSel = (act, v) => `#phead .sub [data-act="${act}"]` + (v ? `[data-v="${v}"],#phead .sub [data-act="${act}"][data-k="${v}"]` : '');
    for (const s of steps) {
      await p.click(`#rail [data-step=${s}]`); await p.waitForTimeout(1500);
      // sub-abas: a captura da etapa é sempre a 1ª sub-aba (a última visitada fica guardada no navegador)
      const subs = await p.$$eval('#phead .sub [data-act]', els => els.map(e => [e.dataset.act, e.dataset.v || e.dataset.k || ''])).catch(() => []);
      if (subs.length && await p.$eval(subSel(...subs[0]), e => e.getAttribute('aria-pressed') !== 'true').catch(() => false)) { await p.click(subSel(...subs[0])); await p.waitForTimeout(2200) }
      try { await shot(`${md}-${th}-${s}`) } catch (e) { errs.push(`sem captura de ${s}: ${e.message.split('\n')[0]}`) }
      for (const [act, v] of subs.slice(1)) {
        // o 3D por software (swiftshader) leva 1–2 s para montar a vista da sub-aba
        try { await p.click(subSel(act, v), { timeout: 20000 }); await p.waitForTimeout(2200); await shot(`${md}-${th}-${s}-${v || act}`) } catch (e) { errs.push(`sem captura de ${s}/${v || act}: ${e.message.split('\n')[0]}`) }
        // Vento: o túnel 3D (chave no corpo)
        if (s === 'projeto' && v === 'vento' && await p.$('#tabbody [data-act="vmodo"][data-v="v3d"]')) {
          try {
            await p.click('#tabbody [data-act="vmodo"][data-v="v3d"]'); await p.waitForTimeout(4000);
            if (await p.evaluate(() => VIEW) !== 'v3d') errs.push('túnel 3D: o palco não foi para a vista v3d');
            await shot(`${md}-${th}-${s}-vento-v3d`);
            await p.click('#tabbody [data-act="vmodo"][data-v="vento"]', { timeout: 30000 }); await p.waitForTimeout(1200);
          } catch (e) { errs.push(`sem captura do túnel 3D: ${e.message.split('\n')[0]}`) }
        }
      }
      // fora da sub-aba do túnel ele precisa estar parado (o vigia do P4)
      const tun = await p.evaluate(() => typeof CFD !== 'undefined' && (CFD.running || VIEW === 'v3d') && !(TAB === 'projeto' && PSUB === 'vento' && CSUB === 'v3d')).catch(() => false);
      if (tun) { await p.waitForTimeout(1500); if (await p.evaluate(() => CFD.running || VIEW === 'v3d').catch(() => false)) errs.push(`túnel 3D ainda rodando fora da sub-aba (${s})`) }
    }
    console.log(`[${md}/${th}]`, errs.length ? '\n  ' + errs.join('\n  ') : 'sem erros');
    total += errs.length;
    await ctx.close();
  }
  await b.close();
  process.exit(total ? 1 : 0);
})();
