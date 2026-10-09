// Fase B item 2 — relevo: Terrarium, amostragem em tiles, plano robusto, confiança, cantos, pontos para a topografia e desnível.
import { describe, it, expect } from 'vitest';
import { carregar, estado } from './harness.js';

const A = carregar();
const perto = (v, alvo, tol) => expect(Math.abs(v - alvo)).toBeLessThanOrEqual(tol);

/* gerador pseudoaleatório com semente (mulberry32) + normal (Box–Muller) */
function rng(seed) { let s = seed >>> 0; const u = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }; return { u, n: () => Math.sqrt(-2 * Math.log(1 - u())) * Math.cos(2 * Math.PI * u()) } }
/* plano z = z0 + gx·E + gy·N amostrado em grade de 10 m, com ruído e "prédios" (outliers) */
function amostras({ z0 = 20, gx = 0, gy = 0, J = 240, passo = 10, ruido = 0, pOut = 0, altOut = 12, seed = 1 }) {
  const r = rng(seed), out = [];
  for (let E = -J / 2; E <= J / 2 + 1e-9; E += passo) for (let N = -J / 2; N <= J / 2 + 1e-9; N += passo)
    out.push([E, N, z0 + gx * E + gy * N + ruido * r.n() + (r.u() < pOut ? altOut : 0)]);
  return out;
}

describe('Terrarium e tiles', () => {
  it('decodifica pixels conhecidos: R·256 + G + B/256 − 32768', () => {
    expect(A.relevoElev(128, 0, 0)).toBe(0);
    expect(A.relevoElev(128, 10, 128)).toBeCloseTo(10.5, 9);
    expect(A.relevoElev(127, 255, 0)).toBe(-1);
    expect(A.relevoElev(0, 0, 0)).toBe(-32768);
    const rgba = new Uint8ClampedArray([128, 5, 0, 255, 129, 0, 64, 255, 0, 0, 0, 0, 100, 100, 100, 255]);
    const d = A.relevoDecodifica(rgba, 2, 2);
    expect(d[0]).toBe(5); expect(d[1]).toBe(256.25); expect(Number.isNaN(d[2])).toBe(true); expect(d[3]).toBeCloseTo(100 * 256 + 100 + 100 / 256 - 32768, 4);
  });
  it('lat/lon ↔ tile', () => {
    const o = A.relevoTileXY(0, 0, 0); perto(o.x, 0.5, 1e-12); perto(o.y, 0.5, 1e-12);
    const t = A.relevoTileXY(-29.335, -49.727, 14), ll = A.relevoLatLonDeTile(t.x, t.y, 14);
    perto(ll[0], -29.335, 1e-9); perto(ll[1], -49.727, 1e-9);
    expect(Math.floor(t.x)).toBe(5928); // (−49,727 + 180)/360·2^14 = 5928,9
  });
  it('tiles necessários cobrem o raio (inclusive na divisa entre tiles)', () => {
    const t = A.relevoTilesPara(-29.335, -49.727, 200, 14);
    expect(t.length).toBeGreaterThanOrEqual(1); expect(t.length).toBeLessThanOrEqual(4);
    const lim = A.relevoLatLonDeTile(5930, 7100, 14), ts = A.relevoTilesPara(lim[0], lim[1], 100, 14);
    expect(ts.length).toBe(4);
  });
  /* DEM sintético: elevação linear nos pixels do Web Mercator (isotrópico), 2×2 tiles de 64 px */
  const W = 64, z = 14, bx = 0.35, by = -0.2;      // m por pixel em x (leste) e em y (pixel; y cresce para o sul)
  const dem = (gx, gy) => 50 + bx * gx + by * gy;
  function tilesSint(tx0, ty0) { const o = {}; for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { const d = new Float32Array(W * W); for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) d[y * W + x] = dem((tx0 + i) * W + x + 0.5, (ty0 + j) * W + y + 0.5); o[`${z}/${tx0 + i}/${ty0 + j}`] = { z, x: tx0 + i, y: ty0 + j, w: W, h: W, data: d } } return o }
  it('amostragem bilinear reproduz um plano, inclusive cruzando a divisa dos tiles', () => {
    const tx0 = 5929, ty0 = 7100, tiles = tilesSint(tx0, ty0);
    for (const [fx, fy] of [[0.3, 0.4], [0.5, 0.5], [0.99, 0.2], [1.01, 1.7], [1.5, 1.5], [0.05, 0.95]]) {
      const [lat, lon] = A.relevoLatLonDeTile(tx0 + fx, ty0 + fy, z), v = A.relevoAmostra(tiles, lat, lon, z);
      perto(v, dem((tx0 + fx) * W, (ty0 + fy) * W), 1e-3);
    }
    const [lat, lon] = A.relevoLatLonDeTile(tx0 - 0.5, ty0 + 0.5, z); expect(Number.isNaN(A.relevoAmostra(tiles, lat, lon, z))).toBe(true);
    const mapa = new Map(Object.entries(tiles)); perto(A.relevoAmostra(mapa, ...A.relevoLatLonDeTile(tx0 + 0.7, ty0 + 0.7, z), z), dem((tx0 + 0.7) * W, (ty0 + 0.7) * W), 1e-3);
  });
  it('grade + ajuste recuperam inclinação e SENTIDO (leste/norte) no Web Mercator', () => {
    const tx0 = 5929, ty0 = 7100, tiles = tilesSint(tx0, ty0), [lat, lon] = A.relevoLatLonDeTile(tx0 + 1, ty0 + 1, z), ref = A.geoRef(lat, lon);
    const pm = 40075016.686 * Math.cos(lat * Math.PI / 180) / (Math.pow(2, z) * W), pts = A.relevoPontosGrade([0, 0], 100, 10), am = A.relevoGrade(tiles, ref, pts, z);
    expect(am.length).toBe(pts.length);
    const pl = A.relevoAjustaPlano(am, { centro: [0, 0] });
    perto(pl.gx, bx / pm, 2e-3);      // sobe para leste
    perto(pl.gy, -by / pm, 2e-3);     // pixel y cresce para o sul → no norte a cota sobe 0,2/pm por metro
    perto(pl.z0, dem((tx0 + 1) * W, (ty0 + 1) * W), 0.05);
  });
});

describe('ajuste robusto do plano', () => {
  it('plano exato: z0, gx, gy, pct e azimute da descida', () => {
    const pl = A.relevoAjustaPlano(amostras({ z0: 30, gx: 0.06, gy: 0.08 }), { centro: [0, 0] });
    perto(pl.z0, 30, 1e-9); perto(pl.gx, 0.06, 1e-12); perto(pl.gy, 0.08, 1e-12); perto(pl.pct, 10, 1e-9);
    perto(pl.azDesc, 180 + Math.atan(0.06 / 0.08) * 180 / Math.PI, 1e-6); // sobe para NE → desce para SO (≈216,9°)
    expect(A.relevoDirTexto(pl.azDesc)).toBe('SO'); expect(pl.rms).toBeLessThan(1e-9);
  });
  it('sinais: sobe para o norte → desce para o sul; sobe para leste → desce para oeste', () => {
    const n = A.relevoAjustaPlano(amostras({ gy: 0.1 })), l = A.relevoAjustaPlano(amostras({ gx: 0.1 })), s = A.relevoAjustaPlano(amostras({ gy: -0.1 })), o = A.relevoAjustaPlano(amostras({ gx: -0.1 }));
    perto(n.azDesc, 180, 1e-6); perto(l.azDesc, 270, 1e-6); perto(s.azDesc, 0, 1e-6); perto(o.azDesc, 90, 1e-6);
    expect([n, l, s, o].map(p => A.relevoDirTexto(p.azDesc))).toEqual(['S', 'O', 'N', 'L']);
  });
  it('rejeita prédios/árvores (outliers de +12 m em 10% dos pontos) e mantém a inclinação', () => {
    for (let seed = 1; seed <= 8; seed++) {
      const am = amostras({ gx: -0.05, gy: -0.1, ruido: 1.0, pOut: 0.10, seed }), pl = A.relevoAjustaPlano(am, { centro: [0, 0], efetivo: 64 }), cru = A.relevoAjustaPlano(am, { centro: [0, 0], robusto: false });
      perto(pl.pct, Math.hypot(5, 10), 1.6); perto(pl.azDesc, A.relevoAjustaPlano(amostras({ gx: -0.05, gy: -0.1 })).azDesc, 12);
      expect(pl.n).toBeLessThan(pl.nTotal);
      expect(pl.rms).toBeLessThan(cru.rms);
    }
  });
  it('colinear ou poucos pontos → null', () => {
    expect(A.relevoAjustaPlano([[0, 0, 1], [1, 1, 2]])).toBeNull();
    expect(A.relevoAjustaPlano([[0, 0, 1], [1, 1, 2], [2, 2, 3]])).toBeNull();
  });
  it('o erro padrão cresce quando se informa poucas amostras independentes', () => {
    const am = amostras({ gx: 0.05, ruido: 2, seed: 3 }), a = A.relevoAjustaPlano(am, { centro: [0, 0] }), b = A.relevoAjustaPlano(am, { centro: [0, 0], efetivo: 16 });
    expect(b.se).toBeGreaterThan(a.se * 2);
  });
});

describe('confiança', () => {
  const analisa = (opts, seed) => A.relevoAnalisa(amostras({ ...opts, seed }), { centro: [0, 0], janelas: [100, 160, 240], principal: 160 });
  it('inclinação clara de ~15% com ruído de 2 m: confiança alta ou média e direção certa', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const r = analisa({ gx: -0.106, gy: -0.106, ruido: 2, pOut: 0.05 }, seed);   // sobe para SO... desce para NE
      expect(['alta', 'media']).toContain(r.conf.nivel);
      perto(r.plano.pct, 15, 3.5); perto(relevoDif(r.plano.azDesc, 45), 0, 20);
    }
  });
  it('terreno plano com ruído (σ = 2 m): nunca "alta" nem "média" (plano ou inconclusivo)', () => {
    const cont = { alta: 0, media: 0, baixa: 0, plano: 0 };
    for (let seed = 1; seed <= 60; seed++) cont[analisa({ ruido: 2, pOut: 0.08 }, seed).conf.nivel]++;
    expect(cont.alta + cont.media).toBe(0);
  });
  it('plano quase liso (ruído de 0,5 m): "plano"', () => {
    for (let seed = 1; seed <= 20; seed++) expect(analisa({ gy: 0.005, ruido: 0.5 }, seed).conf.nivel).toBe('plano');
  });
  it('direção que gira entre as janelas → baixa', () => {
    const base = { centro: [0, 0] }, mk = (J, az, pct) => ({ janela: J, pct, azDesc: az, se: 0.002, rms: 1, n: 100, nTotal: 120 });
    expect(A.relevoConfianca([mk(100, 10, 8), mk(160, 100, 8), mk(240, 190, 8)], 160, base).nivel).toBe('baixa');
    expect(A.relevoConfianca([mk(100, 200, 8), mk(160, 210, 8.5), mk(240, 205, 8)], 160, base).nivel).toBe('alta');
    expect(A.relevoConfianca([mk(100, 200, 4), mk(160, 210, 3.5), mk(240, 205, 4)], 160, base).nivel).toBe('media');
    expect(A.relevoConfianca([mk(100, 200, 1), mk(160, 210, 1.5), mk(240, 205, 1)], 160, base).nivel).toBe('plano');
    expect(A.relevoConfianca([mk(100, 200, 9), mk(160, 210, 1.2), mk(240, 205, 8)], 160, base).nivel).toBe('baixa');
  });
  it('inclinação dentro do erro → baixa', () => {
    const p = { janela: 160, pct: 4, azDesc: 90, se: 0.02, rms: 3, n: 100, nTotal: 120 };
    expect(A.relevoConfianca([p], 160).nivel).toBe('baixa');
  });
  it('resumo em uma linha', () => {
    const pl = { pct: 17.4, azDesc: 222 };
    expect(A.relevoResumo(pl, { nivel: 'media' })).toBe('inclinação 17% · desce para SO · confiança média');
    expect(A.relevoResumo({ pct: 0.8, azDesc: 10 }, { nivel: 'plano' })).toMatch(/praticamente plano/);
    expect(A.relevoResumo({ pct: 3.04, azDesc: 100 }, { nivel: 'baixa' })).toBe('inconclusivo · ≈ 3,0% para L · confiança baixa');
  });
});
function relevoDif(a, b) { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d }

describe('cotas dos cantos', () => {
  const lote = [[0, 0], [20, 0], [20, 40], [0, 40]];
  it('plano exato por 4 cantos e por 3 cantos', () => {
    const z = (x, y) => 12 + 0.05 * x + 0.1 * y, cot = lote.map(q => z(...q));
    const p4 = A.relevoPlanoDeCantos(lote, cot), p3 = A.relevoPlanoDeCantos(lote, [cot[0], null, cot[2], cot[3]]);
    for (const p of [p4, p3]) { perto(p.gx, 0.05, 1e-9); perto(p.gy, 0.1, 1e-9); expect(p.fonte).toBe('cantos'); perto(A.relevoZ(p, 10, 20), z(10, 20), 1e-9) }
    perto(p4.pct, Math.hypot(5, 10), 1e-9);
    expect(A.relevoPlanoDeCantos(lote, [10, null, 12, null])).toBeNull();
  });
  it('com a planta girada (norte ≠ 0) o azimute continua sendo o verdadeiro', () => {
    // norte = 90°: o norte verdadeiro aponta para a direita da planta (+x). Cota sobe 10% para a direita da planta ⇒ sobe para o norte ⇒ desce para o sul
    const p = A.relevoPlanoDeCantos(lote, lote.map(q => 0.1 * q[0]), { norte: 90 });
    perto(p.pct, 10, 1e-9); perto(p.azDesc, 180, 1e-6);
  });
  it('plano efetivo: um canto corrigido tomba o plano do modelo; sem cantos devolve o modelo', () => {
    const base = A.relevoAjustaPlano(amostras({ z0: 10, gy: 0.1 }), { centro: [10, 20] });
    expect(A.relevoPlanoEfetivo(lote, [null, null, null, null], base).plano).toBe(base);
    expect(A.relevoPlanoEfetivo(lote, [], null)).toBeNull();
    const zb = A.relevoCotasDosCantos(base, lote, 0), e = A.relevoPlanoEfetivo(lote, [zb[0] + 3, null, null, null], base);
    expect(e.nInformados).toBe(1); expect(e.plano.fonte).toBe('cantos');
    expect(A.relevoZ(e.plano, 0, 0)).toBeGreaterThan(zb[0] + 0.8); expect(e.residuoMax).toBeLessThan(3);
    const todos = A.relevoPlanoEfetivo(lote, zb.map(v => v + 1), base); perto(todos.residuoMax, 0, 1e-9); perto(todos.plano.pct, base.pct, 1e-9);
    const sem = A.relevoPlanoEfetivo(lote, [5, 6, null, null], null); expect(sem).toBeNull();
    const tres = A.relevoPlanoEfetivo(lote, [5, 5, 9, null], null); perto(A.relevoZ(tres.plano, 0, 40), 9, 1e-9);
  });
});

describe('saída para o estudo', () => {
  const lote = [[0, 0], [20, 0], [20, 40], [0, 40]], fd = [0, 1];       // frente em y=0; fd aponta para os fundos (+y)
  const plano = (gx, gy) => ({ z0: 30, cx: 10, cy: 20, gx, gy, pct: Math.hypot(gx, gy) * 100, azDesc: 0 });
  it('desnível: positivo quando sobe da frente para os fundos (mesmo sinal do 3D)', () => {
    perto(A.relevoParaDesnivel(plano(0, 0.1), lote, fd), 4, 1e-9);
    perto(A.relevoParaDesnivel(plano(0, -0.1), lote, fd), -4, 1e-9);
    perto(A.relevoParaDesnivel(plano(0.2, 0), lote, fd), 0, 1e-9);                     // inclinação lateral não é desnível frente→fundos
    perto(A.relevoParaDesnivel(plano(0.05, 0.05), lote, [Math.SQRT1_2, Math.SQRT1_2]) , 0.0707107 * (20 * Math.SQRT1_2 + 40 * Math.SQRT1_2) * 1, 1e-4);
  });
  it('desnível com a planta girada', () => {
    // norte = 90°: +E aponta para +x da planta? (east = [cos, −sin] = [0, −1]; north = [sin, cos] = [1, 0]) → sobe 10% para o norte = para +x da planta
    const pl = { z0: 30, cx: 0, cy: 0, gx: 0, gy: 0.1, pct: 10, azDesc: 180 };
    perto(A.relevoParaDesnivel(pl, lote, [1, 0], { norte: 90 }), 0.1 * 20, 1e-9);
    perto(A.relevoParaDesnivel(pl, lote, [0, 1], { norte: 90 }), 0, 1e-9);
  });
  it('pontos para S.topo: a superfície passa pelo plano em qualquer ponto do lote', () => {
    for (const norte of [0, 35]) {
      const pl = plano(0.04, 0.09), pts = A.relevoParaTopo(pl, lote, { norte });
      expect(pts.length).toBeGreaterThan(30); expect(pts.length).toBeLessThan(3000);
      const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]); expect(Math.min(...xs)).toBeLessThanOrEqual(-19.99); expect(Math.max(...ys)).toBeGreaterThanOrEqual(59.99);
      pts.forEach(p => expect(p).toHaveLength(3));
      const sf = A.topoSuperficie(pts, lote);
      for (const [x, y] of [[1, 1], [10, 20], [19, 39], [5, 35]]) { const e = A.relevoParaENU(x, y, norte); perto(A.topoZ(sf, x, y), A.relevoZ(pl, e[0], e[1]), 2e-3) }
    }
  });
  it('alimenta a topografia: corte e aterro reais, no mesmo sinal do desnível (cota ótima no meio)', () => {
    const st = estado(A, {}); st.topo.on = true; st.topo.pts = A.relevoParaTopo(plano(0, 0.1), st.lote.pts.map(q => q), { norte: 0 });
    const m = A.compute(st, { layouts: false, quick: true }); expect(m.topo).toBeTruthy(); expect(m.terra).toBe(0);
    expect(m.topo.terra.corte).toBeGreaterThan(50); expect(m.topo.terra.aterro).toBeGreaterThan(50);
    // o mesmo plano, sem topografia, vira só o desnível simples
    const st2 = estado(A, {}); st2.lote.desnivel = A.relevoParaDesnivel(plano(0, 0.1), st2.lote.pts, A.frontDir(st2));
    expect(Math.abs(st2.lote.desnivel)).toBeGreaterThan(1); expect(A.compute(st2).terra).toBeGreaterThan(0);
  });
  it('Open-Meteo: URL com até 100 pontos e leitura do JSON', () => {
    const ref = A.geoRef(-29.335, -49.727), pts = A.relevoPontosGrade([0, 0], 320, 40);
    expect(pts.length).toBe(81);
    const u = A.relevoOpenMeteoUrl(ref, pts), q = new URL(u);
    expect(q.hostname).toBe('api.open-meteo.com'); expect(q.searchParams.get('latitude').split(',').length).toBe(81); expect(q.searchParams.get('longitude').split(',').length).toBe(81);
    expect(A.relevoOpenMeteoLer({ elevation: pts.map((_, i) => i) }, pts)).toHaveLength(81);
    expect(A.relevoOpenMeteoLer({ elevation: [1] }, pts)).toEqual([]);
    expect(A.relevoOpenMeteoLer({ elevation: pts.map(() => null) }, pts)).toEqual([]);
  });
});
