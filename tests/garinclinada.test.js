// Garagem em lotes com lados inclinados (zonas inclinadas e cunhas, src/calc/garmod.js) e rótulos sempre na horizontal.
import { describe, it, expect } from 'vitest';
import { carregar, estado } from './harness.js';

const T = { timeout: 300000 };
const A = carregar();
const lote = (pts, front = [0]) => ({ pts, front, rec: pts.map(() => ({})) });
const gira = (pts, g) => { const a = g * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return pts.map(([x, y]) => [+(x * c - y * s).toFixed(4), +(x * s + y * c).toFixed(4)]) };
const RET = [[0, 0], [40, 0], [40, 50], [0, 50]], P = { torres: [{ pav: 12 }], subsolos: 2 };
const CASOS = {
  alinhado: { lote: lote(RET), produto: P },
  g20: { lote: lote(gira(RET, 20)), produto: P },
  g30: { lote: lote(gira(RET, 30)), produto: P },
  g45: { lote: lote(gira(RET, 45)), produto: P },
  trapezio: { lote: lote([[0, 0], [40, 0], [50, 45], [-5, 45]]), produto: P },
  paralelogramo: { lote: lote([[0, 0], [40, 0], [55, 45], [15, 45]]), produto: P },
  canto: { lote: lote([[0, 0], [40, 0], [40, 35], [25, 50], [0, 50]]), produto: P },
};
const calc = parcial => { const st = estado(A, parcial); return { st, m: A.compute(st) } };
const RES = Object.fromEntries(Object.entries(CASOS).map(([k, p]) => [k, calc(p)]));
const subs = m => Object.entries(m.gar).filter(([k]) => k[0] === 's');
const pisoDe = (m, k) => k === 'ter' ? m.ter.gar : m.vert.floors[k].poly;
const inter = (a, b) => A.garAreaInter(a, b);
const malhaOk = (m, k) => {
  const l = m.gar[k], vs = l.vagas.filter(v => v.tipo !== 'off' && v.tipo !== 'faixa');
  const R = A.rasterCheck(pisoDe(m, k), [...m.obst, ...l.blocks], vs, l.pillars, l.portals, l.aisle);
  return { conn: R.allConn, todas: R.okV.length === vs.length, n: vs.length };
};
const vagasSub = m => subs(m).reduce((s, [, l]) => s + l.count, 0);

describe('referencial do lote girado e paredes inclinadas', () => {
  it('lote girado 20°, 30° e 45°: o referencial segue o lote e rende como o alinhado', T, () => {
    const base = vagasSub(RES.alinhado.m);
    for (const k of ['g20', 'g30', 'g45']) {
      const { m } = RES[k], n = vagasSub(m);
      expect(n).toBeGreaterThanOrEqual(base - 4);                        // mesma área: ±2 vagas por subsolo
      for (const [, l] of subs(m)) {
        expect(l.met.m2v).toBeLessThanOrEqual(RES.alinhado.m.gar.s1.met.m2v + 2);
        // os corredores seguem o lote: o eixo principal é paralelo a um lado do lote (girado), não aos eixos x/y
        const lados = m.vert.floors.s1.poly.map((a, i, p) => { const b = p[(i + 1) % p.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); return [(b[0] - a[0]) / L, (b[1] - a[1]) / L] });
        expect(lados.some(d => Math.abs(d[0] * l.ux[1] - d[1] * l.ux[0]) < 0.02)).toBe(true);
      }
    }
  });
  it('paredes inclinadas detectadas pelo referencial (cunha de pelo menos meia vaga)', () => {
    const ws = A.gmParedesZ([[0, 0], [40, 0], [50, 45], [-5, 45]], [1, 0]);
    expect(ws.map(w => w.i).sort()).toEqual([1, 3]);
    expect(ws.every(w => w.graus > 3 && w.L >= 12)).toBe(true);
    expect(A.gmParedesZ(RET, [1, 0])).toEqual([]);                         // retângulo alinhado: nenhuma
    expect(A.gmParedesZ([[0, 0], [34, 0], [36, 52], [-1.5, 54]], [1, 0]).length).toBe(0);   // desvio de 2° (estudo exemplo): não
  });
  it('lotes inclinados: vagas, área por vaga e nota boas (sem perder para a malha reta)', T, () => {
    const meta = { trapezio: [50, 38.5], paralelogramo: [29, 56.5], canto: [40, 42.5] };
    for (const [k, [nMin, m2Max]] of Object.entries(meta)) for (const [, l] of subs(RES[k].m)) {
      expect(l.modelo).toBe('partido');
      expect(l.count).toBeGreaterThanOrEqual(nMin - 1);
      expect(l.met.m2v).toBeLessThanOrEqual(m2Max);
      expect(l.nota).toBeGreaterThanOrEqual(80);
    }
  });
});

describe('regras mantidas nos lotes inclinados e girados', () => {
  it('rota e manobra (malha de 0,5 m), nada sobre núcleo/rampa/patamar/corredor/faixa/pilar, sem problema grave', T, () => {
    for (const { m } of Object.values(RES)) for (const [k, l] of Object.entries(m.gar)) {
      const r = malhaOk(m, k); expect(r.conn).toBe(true); expect(r.todas).toBe(true);
      const proib = [...m.obst, ...l.blocks, ...l.landings, ...l.aisles.map(a => a.poly), ...l.peds.filter(p => p.poly).map(p => p.poly), ...l.pillars];
      l.vagas.filter(v => v.tipo !== 'off').forEach(v => proib.forEach(p => expect(inter(v.poly, p)).toBeLessThan(0.1)));
      expect(l.problemas.filter(p => p.nivel === 'bad')).toEqual([]);
      // vagas não se sobrepõem
      const vs = l.vagas.filter(v => v.tipo !== 'off');
      vs.forEach((v, i) => { for (let j = i + 1; j < vs.length; j++) expect(inter(v.poly, vs[j].poly)).toBeLessThan(0.05) });
    }
  });
  it('PCD com faixa de transferência de 1,20 m e faixa de pedestres até o hall', T, () => {
    for (const { m } of Object.values(RES)) for (const [, l] of subs(m)) {
      const pcd = l.vagas.filter(v => v.tipo === 'pcd'), fx = l.vagas.filter(v => v.tipo === 'faixa');
      expect(pcd.length).toBeGreaterThan(0);
      pcd.forEach(v => expect(fx.some(f => A.garToca(v.poly, f.poly))).toBe(true));
      expect(l.pcd.feitas).toBe(l.pcd.pedidas);
      expect(l.peds.length).toBeGreaterThan(0);
    }
  });
  it('subsolos do mesmo contorno com a mesma malha de pilares', T, () => {
    for (const { m } of Object.values(RES)) {
      const [a, b] = subs(m).map(([, l]) => l); if (!a || !b) continue;
      const c = l => l.pillars.map(p => A.G.centroid(p).map(v => v.toFixed(2)).join(',')).sort();
      expect(c(a)).toEqual(c(b)); expect(a.ux).toEqual(b.ux);
    }
  });
});

describe('zonas inclinadas (faixa no referencial da parede)', () => {
  // forçadas (S.garagem.zonas "sempre") para conferir a geometria mesmo quando a malha reta rende mais
  const Z = {};
  for (const k of ['trapezio', 'paralelogramo']) Z[k] = calc({ ...CASOS[k], garagem: { zonas: 'sempre' } });
  it('vagas da zona a 90° da parede, com as costas nela, e corredor paralelo a ela, ligado à rede', T, () => {
    let nZona = 0;
    for (const { m } of Object.values(Z)) for (const [k, l] of subs(m)) {
      expect(l.zonas.length).toBeGreaterThan(0);
      const r = malhaOk(m, k); expect(r.conn).toBe(true); expect(r.todas).toBe(true);
      const piso = pisoDe(m, k);
      l.zonas.forEach(z => {
        const a = piso[z.parede], b = piso[(z.parede + 1) % piso.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]), d = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
        const vz = l.vagas.filter(v => v.zona === z.parede);
        expect(Math.abs(d[0] * z.ux[1] - d[1] * z.ux[0])).toBeLessThan(1e-6);   // eixo da zona = direção da parede
        expect(vz.length).toBeGreaterThan(0);
      });
      l.vagas.filter(v => v.zona != null && v.tipo !== 'faixa').forEach(v => {
        nZona++;
        // a frente da vaga é perpendicular à parede da sua zona (vaga a 90° da parede)
        const z = l.zonas.find(x => x.parede === v.zona);
        expect(Math.abs(v.out[0] * z.ux[0] + v.out[1] * z.ux[1])).toBeLessThan(1e-6);
      });
      // o corredor da zona é uma peça da rede (aisles "Z") e há junção com a malha reta
      expect(l.aisles.some(a => a.o === 'Z')).toBe(true);
      expect(l.problemas.filter(p => p.nivel === 'bad')).toEqual([]);
    }
    expect(nZona).toBeGreaterThan(10);
  });
  it('pilares da zona alinhados a ela (lados paralelos à parede) e fora das vagas', T, () => {
    for (const { m } of Object.values(Z)) for (const [, l] of subs(m)) {
      const vz = l.vagas.filter(v => v.zona != null);
      l.pillars.forEach(p => vz.forEach(v => expect(inter(v.poly, p)).toBeLessThan(0.01)));
      const inclinados = l.pillars.filter(p => { const d = [p[1][0] - p[0][0], p[1][1] - p[0][1]], L = Math.hypot(...d); return l.zonas.some(z => Math.abs((d[0] * z.ux[1] - d[1] * z.ux[0]) / L) < 1e-6 || Math.abs((d[0] * z.ux[0] + d[1] * z.ux[1]) / L) < 1e-6) && Math.abs((d[0] * l.ux[1] - d[1] * l.ux[0]) / L) > 0.02 && Math.abs((d[0] * l.ux[0] + d[1] * l.ux[1]) / L) > 0.02 });
      expect(inclinados.length).toBeGreaterThan(0);
    }
  });
  it('"nunca" desliga as zonas e as cunhas continuam de frente para a circulação', T, () => {
    const { m } = calc({ ...CASOS.trapezio, garagem: { zonas: 'nunca' } });
    for (const [k, l] of subs(m)) {
      expect(l.zonas).toEqual([]);
      const r = malhaOk(m, k); expect(r.todas).toBe(true);
      l.vagas.filter(v => v.cunha != null).forEach(v => expect(v.ang).toBe(90));
    }
  });
});

describe('textos do desenho sempre na horizontal', () => {
  it('rótulos das vagas: ângulo 0, no centro e cabendo na largura horizontal da vaga (inclinada também)', T, () => {
    for (const k of ['g30', 'g45', 'paralelogramo']) {
      const l = RES[k].m.gar.s1, s = 22, med = (t, px) => t.length * px * 0.6;
      const rs = A.garRotulosVagas(l, s, med);
      expect(rs.length).toBeGreaterThan(l.count * 0.8);
      rs.forEach(r => {
        expect(r.ang).toBe(0);
        const v = l.vagas[r.i], w = med(r.t, r.tam) / s;                     // largura do texto em metros
        const iv = A.gmLineIv(v.poly, r.p[1]).find(([a, b]) => a <= r.p[0] && b >= r.p[0]);
        expect(iv).toBeTruthy();
        expect(Math.min(r.p[0] - iv[0], iv[1] - r.p[0]) * 2 + 0.1).toBeGreaterThanOrEqual(w);
        expect(r.tam).toBeLessThanOrEqual(9); expect(r.tam).toBeGreaterThanOrEqual(6);
      });
    }
    // vaga estreita e inclinada: reduz o texto em vez de girar; se não cabe nem com 6 px, some
    const v = { tipo: 'n', num: 123, poly: [[0, 0], [2.5, 0], [2.5, 5], [0, 5]].map(([x, y]) => [x * Math.cos(0.6) - y * Math.sin(0.6), x * Math.sin(0.6) + y * Math.cos(0.6)]) };
    v.c = A.G.centroid(v.poly);
    const r1 = A.garRotulosVagas({ modelo: 'partido', vagas: [v] }, 30, (t, px) => t.length * px * 0.6);
    expect(r1.length).toBe(1); expect(r1[0].ang).toBe(0); expect(r1[0].tam).toBeLessThanOrEqual(9);
    expect(A.garRotulosVagas({ modelo: 'partido', vagas: [v] }, 4, (t, px) => t.length * px * 0.6)).toEqual([]);
  });
});
