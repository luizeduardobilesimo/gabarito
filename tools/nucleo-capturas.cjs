// Teste visual do núcleo de circulação vertical (docs/COMUNS.md §1): Projeto › Andares com a seção "Núcleo de circulação"
// aberta e o palco com zoom no núcleo — pavimento tipo, térreo e 1º subsolo — para o exemplo e variações
// (baixo sem elevador de emergência, alto > 60 m, 2 escadas, pressurizada, balcão).
// Uso: node tools/nucleo-capturas.cjs --html <build>/test.html --out <pasta> [--so exemplo,alto] [--tema light|dark|both] [--modo d|m|all]
// Sai com código 1 se houver erro de JS. Escreve <pasta>/resumo.json (partido, nota e problemas de cada núcleo).
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const { prepara, abre, ROOT } = require('./pw-comum.cjs');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d };
const ESTUDOS = {
  exemplo: {},
  baixo: { produto: { torres: [{ pav: 4 }], subsolos: 1 }, estudo: { escTipo: 'ep', emerg: false } },
  alto: { regras: { hMax: 120, caMax: 8 }, produto: { torres: [{ pav: 28 }] }, estudo: { emerg: true } },
  u: { estudo: { elevadores: 3 } },
  l: { nucleo: { partido: 'l' } },
  duas: { produto: { torres: [{ pav: 16 }] }, estudo: { nEsc: 2 } },
  press: { estudo: { escTipo: 'pf_press' } },
  balcao: { estudo: { escTipo: 'pf_balcao' } },
};
(async () => {
  const html = path.resolve(arg('--html', path.join(ROOT, 'test.html'))), out = path.resolve(arg('--out', path.join(ROOT, 'shots', 'nucleo')));
  const so = arg('--so', ''), tema = arg('--tema', 'both'), modo = arg('--modo', 'd');
  const temas = tema === 'both' ? ['light', 'dark'] : [tema], modos = modo === 'all' ? ['d', 'm'] : [modo];
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const erros = [], resumo = {};
  for (const md of modos) for (const th of temas) {
    const ctx = await b.newContext({ viewport: md === 'm' ? { width: 400, height: 860 } : { width: 1440, height: 900 }, deviceScaleFactor: md === 'm' ? 2 : 1.5, colorScheme: th });
    await ctx.addInitScript(t => { try { localStorage.clear(); localStorage.setItem('gabarito.tema', JSON.stringify(t)) } catch (e) {} }, th);
    const p = await ctx.newPage(); await prepara(p);
    p.on('pageerror', e => erros.push(`${th}: PE ${e.message}`)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_|net::/.test(m.text())) erros.push(`${th}: CE ${m.text()}`) });
    await abre(p, html); await p.waitForTimeout(1000);
    for (const [nome, E] of Object.entries(ESTUDOS)) {
      if (so && !so.split(',').includes(nome)) continue;
      await p.evaluate(async ([E]) => {
        const novo = merge(clone(DEF), clone(E));
        Object.keys(novo).forEach(k => { S[k] = novo[k] });
        if (typeof inicioFechar === 'function') try { inicioFechar() } catch (e) {}
        goStep('projeto', 'tipo'); update();
        if (typeof calcPronto === 'function') await calcPronto();
        setView('tipo'); renderTab();
        const d = document.querySelector('#tabbody details[data-key="nucleo"]'); if (d) { d.open = true; d.scrollIntoView({ block: 'start' }) }
      }, [E]);
      await p.waitForTimeout(1200);
      const r = await p.evaluate(() => { const m = window._last.m;
        return (m.tipo || []).map((l, i) => l && l.nucleo ? { torre: i + 1, partido: l.nucleo.partidoNome || l.nucleo.partido, nota: l.nucleo.nota, area: Math.round(l.coreA * 10) / 10,
          dim: l.nucleo.dim, problemas: (l.nucleo.problemas || []).map(q => `${q.nivel}: ${q.msg}`) } : { torre: i + 1, area: l && Math.round(l.coreA * 10) / 10 }) });
      if (th === temas[0] && md === modos[0]) resumo[nome] = r;
      // zoom no núcleo da torre 1: tipo, térreo (vista andar) e subsolo 1 (garagem)
      const zoom = async (vista, extra) => {
        await p.evaluate(([vista, extra]) => {
          if (extra && extra.andar) ANDAR = extra.andar; if (extra && extra.floor) FLOOR = extra.floor;
          setView(vista); const m = window._last.m, cs = (m.coreSets || [])[0]; if (!cs) return;
          const pts = [...cs.core, ...(cs.lobby || [])], r = c2.getBoundingClientRect();
          const v = fitView([pts], r.width, r.height, 1.7); VS[VIEW] = v; redraw2d();
        }, [vista, extra]);
        await p.waitForTimeout(400);
      };
      if (md === 'm') { await p.evaluate(() => { try { folhaSet('espiada') } catch (e) {} }); await p.waitForTimeout(400) }
      await zoom('tipo'); await p.screenshot({ path: path.join(out, `${md}-${th}-${nome}-tipo.png`) });
      if (md === 'd') {
        await zoom('andar', { andar: 'ter' }); await p.screenshot({ path: path.join(out, `${md}-${th}-${nome}-terreo.png`) });
        await zoom('gar', { floor: 's1' }); await p.screenshot({ path: path.join(out, `${md}-${th}-${nome}-s1.png`) });
      } else { await p.evaluate(() => { try { folhaSet('cheia') } catch (e) {} ; const d = document.querySelector('#tabbody details[data-key="nucleo"]'); if (d) d.scrollIntoView({ block: 'start' }) }); await p.waitForTimeout(400);
        await p.screenshot({ path: path.join(out, `${md}-${th}-${nome}-painel.png`) }); await p.evaluate(() => { try { folhaSet('media') } catch (e) {} }) }
    }
    await ctx.close();
  }
  await b.close();
  fs.writeFileSync(path.join(out, 'resumo.json'), JSON.stringify(resumo, null, 1));
  console.log(JSON.stringify(resumo, null, 1));
  if (erros.length) { console.log('ERROS:\n' + [...new Set(erros)].join('\n')); process.exit(1) }
  console.log('ok — capturas em', out);
})();
