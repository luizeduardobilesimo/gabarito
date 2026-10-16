// Capturas do térreo, do hall e das áreas comuns (docs/COMUNS.md §3): para cada estudo, a planta do térreo e a laje do
// embasamento no palco (Projeto › Andares, seção "Térreo e áreas comuns" aberta), mais um recorte ampliado do térreo.
// Uso: node tools/comuns-capturas.cjs --html <build>/test.html --out <pasta> [--so exemplo,pequeno] [--modo d|m|all] [--tema light|dark|both] [--zoom 0|1]
// Sai com código 1 se houver erro de JS. Escreve <pasta>/resumo.json (nota, problemas e ambientes por estudo).
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const { prepara, abre, ROOT } = require('./pw-comum.cjs');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d };
const cen = f => JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'cenarios', f), 'utf8')).S;
const LZ_CHEIO = [
  { nome: 'Salão de festas', area: 90, local: 'terreo' }, { nome: 'Espaço gourmet', area: 45, local: 'terreo' }, { nome: 'Academia', area: 60, local: 'terreo' },
  { nome: 'Brinquedoteca', area: 35, local: 'terreo' }, { nome: 'Coworking', area: 40, local: 'terreo' }, { nome: 'Lavanderia', area: 20, local: 'terreo' },
  { nome: 'Piscina', area: 70, local: 'emb', desc: true }, { nome: 'Deck / solário', area: 80, local: 'emb', desc: true },
  { nome: 'Playground', area: 50, local: 'emb', desc: true }, { nome: 'Pet place', area: 40, local: 'emb', desc: true }];
const ESTUDOS = {
  exemplo: { S: {} },
  pequeno: { S: { lote: { pts: [[0, 0], [18, 0], [18, 36], [0, 36]], front: [0], principal: 0, rec: [{}, {}, {}, {}], acessoPed: 0.3, acessoVei: 0.8 },
    produto: { torres: [{ pav: 10 }], subsolos: 1, garAcima: 0, lojaTerreo: 0, garTerOn: false, cob: { on: false, qtd: 1, area: 120, preco: 15000 },
      mix: [{ nome: '2 dorm.', area: 62, qtd: 2, preco: 12000, sac: 5 }],
      lazer: { hall: 0, itens: [{ nome: 'Espaço gourmet', area: 35, local: 'terreo' }, { nome: 'Academia', area: 30, local: 'terreo' }] } } } },
  grande: { S: { lote: { pts: [[0, 0], [60, 0], [60, 75], [0, 75]], front: [0], principal: 0, rec: [{}, {}, {}, {}], acessoPed: 0.3, acessoVei: 0.82 },
    produto: { torres: [{ pav: 16 }], subsolos: 1, garAcima: 0, lojaTerreo: 0, garTerOn: true, lazer: { hall: 0, itens: LZ_CHEIO } } } },
  duas: { S: { lote: { pts: [[0, 0], [48, 0], [48, 70], [0, 70]], front: [0], principal: 0, rec: [{}, {}, {}, {}], acessoPed: 0.25, acessoVei: 0.8 },
    produto: { torres: [{ pav: 14 }, { pav: 14 }], subsolos: 2, garAcima: 0, lojaTerreo: 0, garTerOn: true, lazer: { hall: 0, itens: LZ_CHEIO.slice(0, 9) } } } },
  esquina: { S: cen('03-esquina.json') },
  elevada: { S: { produto: { torres: [{ pav: 13 }, { pav: 13 }], subsolos: 0, garAcima: 3 } } },   // garagens elevadas: rampas que sobem saem do térreo
};
(async () => {
  const html = path.resolve(arg('--html', path.join(ROOT, 'test.html'))), out = path.resolve(arg('--out', path.join(ROOT, 'shots', 'comuns')));
  const so = arg('--so', ''), modo = arg('--modo', 'd'), tema = arg('--tema', 'light'), zoom = arg('--zoom', '1') !== '0';
  const modos = modo === 'all' ? ['d', 'm'] : [modo], temas = tema === 'both' ? ['light', 'dark'] : [tema];
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const erros = [], resumo = {};
  for (const md of modos) for (const th of temas) {
    const ctx = await b.newContext({ viewport: md === 'm' ? { width: 400, height: 860 } : { width: 1440, height: 900 }, deviceScaleFactor: md === 'm' ? 2 : 1, colorScheme: th });
    await ctx.addInitScript(t => { try { localStorage.clear(); localStorage.setItem('gabarito.tema', JSON.stringify(t)) } catch (e) {} }, th);
    const p = await ctx.newPage(); await prepara(p);
    p.on('pageerror', e => erros.push(`${md}-${th}: PE ${e.message}`)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_|net::/.test(m.text())) erros.push(`${md}-${th}: CE ${m.text()}`) });
    await abre(p, html); await p.waitForTimeout(1000);
    for (const [nome, E] of Object.entries(ESTUDOS)) {
      if (so && !so.split(',').includes(nome)) continue;
      await p.evaluate(async ([E]) => {
        const novo = merge(clone(DEF), clone(E.S || {}));
        Object.keys(novo).forEach(k => { S[k] = novo[k] });
        if (typeof inicioFechar === 'function') try { inicioFechar() } catch (e) {}
        goStep('projeto', 'tipo'); update();
        if (typeof calcPronto === 'function') await calcPronto();
        ANDAR = 'ter'; setView('andar'); renderTab();
        const d = document.querySelector('#tabbody details[data-key="comuns"]'); if (d) { d.open = true; d.scrollIntoView({ block: 'start' }) }
        if (typeof fit2d === 'function') fit2d();
      }, [E]);
      await p.waitForTimeout(1200);
      const r = await p.evaluate(() => { const m = window._last.m, C = m.comuns || {};
        return { nota: C.nota, problemas: (C.problemas || []).map(x => `${x.nivel}: ${x.msg}`), amb: (C.amb || []).map(a => `${a.nome} ${Math.round(a.area)} m²${a.local && a.local !== 'terreo' ? ' (' + a.local + ')' : ''}`),
          falta: (C.falta || []).map(x => x.nome + ': ' + x.motivo), lzCusto: Math.round(m.lzCusto || 0), hallA: Math.round(m.hallA || 0), gTer: Math.round(m.gTer || 0), vagas: m.vagas, avisos: m.avisos } });
      if (md === 'd' && th === 'light' || !resumo[nome]) resumo[nome] = r;
      const tag = `${md}-${th}-${nome}`;
      if (md === 'm') { await p.evaluate(() => { try { folhaSet('espiada') } catch (e) {} }); await p.waitForTimeout(500) }
      await p.screenshot({ path: path.join(out, `${tag}-terreo.png`) });
      if (zoom && md === 'd') {
        // recorte ampliado: a planta do embasamento enche o palco
        await p.evaluate(() => { const m = window._last.m, r = c2.getBoundingClientRect(); VS.andar = fitView([m.emb], r.width, r.height, 1.04); redraw2d() });
        await p.waitForTimeout(300); await p.locator('#c2d').screenshot({ path: path.join(out, `${tag}-terreo-zoom.png`) });
      }
      const temLaje = await p.evaluate(() => floorsList(window._last.m).some(f => f.key === 'lzemb'));
      if (temLaje) { await p.evaluate(() => { ANDAR = 'lzemb'; viewbarSegs(window._last.m); fit2d(); planLegend() }); await p.waitForTimeout(400);
        if (zoom && md === 'd') { await p.evaluate(() => { const m = window._last.m, r = c2.getBoundingClientRect(); VS.andar = fitView([m.emb], r.width, r.height, 1.06); redraw2d() }); await p.waitForTimeout(300) }
        await p.locator(md === 'd' ? '#c2d' : 'body').screenshot({ path: path.join(out, `${tag}-laje.png`) }) }
      if (md === 'd') { await p.evaluate(() => { ANDAR = 'ter'; viewbarSegs(window._last.m); fit2d() }); await p.waitForTimeout(200) }
    }
    await ctx.close();
  }
  await b.close();
  fs.writeFileSync(path.join(out, 'resumo.json'), JSON.stringify(resumo, null, 1));
  console.log(JSON.stringify(resumo, null, 1));
  if (erros.length) { console.log('ERROS:\n' + [...new Set(erros)].join('\n')); process.exit(1) }
  console.log('ok — capturas em', out);
})();
