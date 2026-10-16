// Capturas da garagem (Projeto › Garagem) em lotes de referência, para revisar o desenho como projetista.
// Uso: node tools/garagem-capturas.cjs --html <build>/test.html --out <pasta> [--casos exemplo,grande] [--tema light|dark|both] [--celular]
// Para cada caso e cada pavimento de garagem salva <caso>-<pav>-<tema>.png (palco inteiro, painel com o RES da garagem)
// e imprime vagas, m²/vaga, nota e partido de cada pavimento. Sai com código 1 se houver erro de JS.
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const { prepara, abre, ROOT } = require('./pw-comum.cjs');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d };
const lote = (pts, front = [0]) => ({ pts, front, rec: pts.map(() => ({})) });
const gira = (pts, g) => { const a = g * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return pts.map(([x, y]) => [+(x * c - y * s).toFixed(4), +(x * s + y * c).toFixed(4)]) };
const CASOS = {
  exemplo: {},
  grande: { nome: 'Lote grande 60 × 50', lote: lote([[0, 0], [60, 0], [60, 50], [0, 50]]), produto: { torres: [{ pav: 15 }], subsolos: 2 } },
  estreito: { nome: 'Lote estreito 18 × 50', lote: lote([[0, 0], [18, 0], [18, 50], [0, 50]]), produto: { torres: [{ pav: 10 }], subsolos: 2 } },
  trapezio: { nome: 'Lote em trapézio', lote: lote([[0, 0], [40, 0], [50, 45], [-5, 45]]), produto: { torres: [{ pav: 12 }], subsolos: 2 } },
  esquina: { nome: 'Lote de esquina 35 × 40', lote: lote([[0, 0], [35, 0], [35, 40], [0, 40]], [0, 3]), produto: { torres: [{ pav: 12 }], subsolos: 2 } },
  duas: { nome: 'Duas torres 70 × 45', lote: lote([[0, 0], [70, 0], [70, 45], [0, 45]]), produto: { torres: [{ pav: 12 }, { pav: 12 }], subsolos: 2 } },
  // lados inclinados: as vagas acompanham a parede (zonas inclinadas) e o referencial segue o lote girado
  girado30: { nome: 'Retângulo 40 × 50 girado 30°', lote: lote(gira([[0, 0], [40, 0], [40, 50], [0, 50]], 30)), produto: { torres: [{ pav: 12 }], subsolos: 2 } },
  paralelogramo: { nome: 'Paralelogramo', lote: lote([[0, 0], [40, 0], [55, 45], [15, 45]]), produto: { torres: [{ pav: 12 }], subsolos: 2 } },
  losango: { nome: 'Losango', lote: lote([[0, 0], [40, -25], [80, 0], [40, 25]]), produto: { torres: [{ pav: 12 }], subsolos: 2 } },
  canto: { nome: 'Canto cortado a 45°', lote: lote([[0, 0], [40, 0], [40, 35], [25, 50], [0, 50]]), produto: { torres: [{ pav: 12 }], subsolos: 2 } },
  quadrilatero: { nome: 'Quadrilátero irregular', lote: lote([[0, 0], [42, 0], [48, 40], [2, 46]]), produto: { torres: [{ pav: 12 }], subsolos: 2 } },
  pentagono: { nome: 'Pentágono irregular', lote: lote([[0, 0], [36, -6], [50, 30], [20, 50], [-6, 30]]), produto: { torres: [{ pav: 12 }], subsolos: 2 } },
};
(async () => {
  const html = path.resolve(arg('--html', path.join(ROOT, 'test.html'))), out = path.resolve(arg('--out', path.join(ROOT, 'shots-garagem')));
  const casos = arg('--casos', Object.keys(CASOS).join(',')).split(','), temaA = arg('--tema', 'light'), temas = temaA === 'both' ? ['light', 'dark'] : [temaA];
  const cel = process.argv.includes('--celular');
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const errs = [];
  for (const tema of temas) for (const caso of casos) {
    const ctx = await b.newContext({ viewport: cel ? { width: 400, height: 860 } : { width: 1440, height: 900 }, deviceScaleFactor: cel ? 2 : 1, colorScheme: tema });
    await ctx.addInitScript(([t, st]) => { try { localStorage.setItem('gabarito.tema', JSON.stringify(t)); if (st) localStorage.setItem('gabarito.v2', JSON.stringify(st)); localStorage.setItem('gabarito.step', 'projeto'); localStorage.setItem('gabarito.psub', 'gar') } catch (e) {} }, [tema, Object.keys(CASOS[caso]).length ? CASOS[caso] : null]);
    const p = await ctx.newPage(); await prepara(p);
    p.on('pageerror', e => errs.push(caso + ' PE ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(caso + ' CE ' + m.text()) });
    await abre(p, html); await p.waitForTimeout(800);
    await p.evaluate(() => { goStep('projeto', 'gar'); setView('gar') });
    await p.waitForFunction(() => window._last && window._last.m && window._last.m.gar && Object.values(window._last.m.gar).every(l => !l || l.grid !== undefined), null, { timeout: 120000 }).catch(() => {});
    await p.waitForTimeout(2500);
    const pav = await p.evaluate(() => Object.keys(window._last.m.gar));
    for (const k of pav) {
      await p.evaluate(k => { FLOOR = k; setView('gar'); if (typeof fit2d === 'function') fit2d() }, k); await p.waitForTimeout(700);
      const info = await p.evaluate(k => { const l = window._last.m.gar[k]; return l ? `${l.count} vg · ${l.met ? (l.met.m2v).toFixed(1) + ' m²/vg' : ''} · nota ${l.nota ?? '-'} · ${l.partido || ''}` : '' }, k);
      console.log(`${caso} ${k} ${tema}: ${info}`);
      await p.screenshot({ path: path.join(out, `${caso}-${k}-${tema}${cel ? '-cel' : ''}.png`) });
    }
    await ctx.close();
  }
  await b.close();
  if (errs.length) { console.log('ERROS:\n' + errs.join('\n')); process.exit(1) }
})();
