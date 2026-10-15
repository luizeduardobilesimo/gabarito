// Teste visual das plantas de apartamento (docs/APTOS.md): Projeto › Andares com a seção "Plantas das unidades" aberta e a
// planta tipo no palco, para estudos de forma diferente (exemplo, lote estreito, esquina, alas em L, studios/1 dorm.).
// Uso: node tools/aptos-capturas.cjs --html <build>/test.html --out <pasta> [--so exemplo,alasL] [--modo d|m|all] [--tema light|dark|both]
// Sai com código 1 se houver erro de JS. Escreve também <pasta>/resumo.json (nota, válidas e partidos por estudo).
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const { prepara, abre, ROOT } = require('./pw-comum.cjs');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d };
const cen = f => JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'cenarios', f), 'utf8')).S;
const MIXP = [{ nome: 'Studio', area: 32, qtd: 4, preco: 15000, sac: 0 }, { nome: '1 dorm.', area: 44, qtd: 4, preco: 14000, sac: 0 }];
const ESTUDOS = {
  exemplo: { S: {} },
  estreito: { S: cen('02-lote-estreito.json') },
  esquina: { S: cen('03-esquina.json') },
  alasL: { S: { lote: { pts: [[0, 0], [70, 0], [70, 90], [0, 90]], front: [0], principal: 0, rec: [{}, {}, {}, {}] },
      regras: { recFrente: 4, afMin: 3, afDiv: 8, toTorre: 1, toEmb: 1, hMax: 80, caMax: 20 },
      produto: { torres: [{ pav: 10 }], subsolos: 0, garAcima: 0, mix: [{ nome: '2 dorm.', area: 66, qtd: 6, preco: 10000, sac: 6 }, { nome: '3 dorm.', area: 92, qtd: 4, preco: 10000, sac: 8 }] } },
    forma: ['L', [[8, 8], [62, 8], [62, 82], [8, 82]], 1300] },
  compactos: { S: { produto: { mix: MIXP } } },
};
(async () => {
  const html = path.resolve(arg('--html', path.join(ROOT, 'test.html'))), out = path.resolve(arg('--out', path.join(ROOT, 'shots', 'aptos')));
  const so = arg('--so', ''), modo = arg('--modo', 'all'), tema = arg('--tema', 'both');
  const modos = modo === 'all' ? ['d', 'm'] : [modo], temas = tema === 'both' ? ['light', 'dark'] : [tema];
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const erros = [], resumo = {};
  for (const md of modos) for (const th of temas) {
    const ctx = await b.newContext({ viewport: md === 'm' ? { width: 400, height: 860 } : { width: 1440, height: 900 }, deviceScaleFactor: md === 'm' ? 2 : 1, colorScheme: th });
    await ctx.addInitScript(t => { try { localStorage.clear(); localStorage.setItem('gabarito.tema', JSON.stringify(t)) } catch (e) {} }, th);
    const p = await ctx.newPage(); await prepara(p);
    p.on('pageerror', e => erros.push(`${md}-${th}: PE ${e.message}`)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_|net::/.test(m.text())) erros.push(`${md}-${th}: CE ${m.text()}`) });
    await abre(p, html); await p.waitForTimeout(1200);
    for (const [nome, E] of Object.entries(ESTUDOS)) {
      if (so && !so.split(',').includes(nome)) continue;
      await p.evaluate(async ([E]) => {
        const novo = merge(clone(DEF), clone(E.S || {}));
        if (E.forma) novo.blocos = { modo: 'desenhada', torres: [{ blocos: [blcFormato(E.forma[0], E.forma[1], E.forma[2], { ala: 12.6 }).bloco] }] };
        Object.keys(novo).forEach(k => { S[k] = novo[k] });
        if (typeof inicioFechar === 'function') try { inicioFechar() } catch (e) {}
        goStep('projeto', 'tipo'); update();
        if (typeof calcPronto === 'function') await calcPronto();
        setView('tipo'); renderTab();
        const d = document.querySelector('#tabbody details[data-key="comodos"]'); if (d) d.open = true;
        if (typeof fit2d === 'function') fit2d();
      }, [E]);
      await p.waitForTimeout(1500);
      // resumo do cálculo completo (o barato, sem a repartição pelos partidos, pode aparecer antes)
      const r = await p.evaluate(() => { const m = window._last.m, R = m.comodos || {};
        return { nota: R.nota, validas: R.validas, unidades: R.unidades, notas: (m.tipo || []).map(l => l ? l.units.filter(u => u.com).map(u => `${u.nome} ${Math.round(u.com.nota)}${u.com.semPartido ? ' (sem partido)' : ''}`) : []),
          partidos: Object.values(R.porTipo || {}).map(T => `${T.nome}: ${T.partidoNome} (nota ${T.nota}, ${T.validas}/${T.n})`), avisos: (R.lista || []).filter(x => !x.ok).map(x => x.alertas[0] && x.alertas[0].msg) } });
      if (md === 'm' && th === 'light' || md === 'd') resumo[nome] = r;
      if (md === 'm') { await p.evaluate(() => { try { folhaSet('espiada') } catch (e) {} }); await p.waitForTimeout(500); await p.screenshot({ path: path.join(out, `${md}-${th}-${nome}-planta.png`) });
        await p.evaluate(() => { try { folhaSet('cheia') } catch (e) {} }); await p.waitForTimeout(500);
        await p.evaluate(() => { const d = document.querySelector('#tabbody details[data-key="comodos"]'); if (d) d.scrollIntoView({ block: 'start' }) }); await p.waitForTimeout(300);
        await p.screenshot({ path: path.join(out, `${md}-${th}-${nome}-painel.png`) }); await p.evaluate(() => { try { folhaSet('media') } catch (e) {} }) }
      else { await p.evaluate(() => { const d = document.querySelector('#tabbody details[data-key="comodos"]'); if (d) d.scrollIntoView({ block: 'start' }) }); await p.waitForTimeout(300);
        await p.screenshot({ path: path.join(out, `${md}-${th}-${nome}.png`) }) }
    }
    await ctx.close();
  }
  await b.close();
  fs.writeFileSync(path.join(out, 'resumo.json'), JSON.stringify(resumo, null, 1));
  console.log(JSON.stringify(resumo, null, 1));
  if (erros.length) { console.log('ERROS:\n' + [...new Set(erros)].join('\n')); process.exit(1) }
  console.log('ok — capturas em', out);
})();
