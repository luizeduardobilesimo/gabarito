// Fase B item 2 — relevo: Terrarium, amostragem em tiles, plano robusto, confiança, cantos, pontos para a topografia e desnível.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { carregar, estado } from './harness.js';
import { ROOT } from '../tools/bundle.mjs';

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

/* ================= prévia do relevo no 3D, GeoTIFF (ANADEM) e página do PDF ================= */
// estado mínimo com relevo lido (S.relevo é criado pela interface; aqui montamos à mão)
function estadoRelevo({ gx = 0.06, gy = 0, cantos = null, norte = 0, nivel = 'alta', fonte = 'terrarium', aplicado = '', arquivo = '' } = {}) {
  const st = estado(A, {});
  st.lote.norte = norte;
  const centro = A.relevoParaENU(...A.relevoCentroide(st.lote.pts), norte);
  const plano = { z0: 30, cx: centro[0], cy: centro[1], gx, gy, pct: Math.hypot(gx, gy) * 100, azDesc: (Math.atan2(-gx, -gy) * 180 / Math.PI + 360) % 360, se: 0.002, janela: 160, n: 200, nTotal: 220, rms: 0.3 };
  st.relevo = { fonte, janela: 160, quando: '2026-10-08', origem: fonte === 'anadem' ? 'ANADEM' : 'Terrarium', plano, planos: [plano], conf: { nivel, motivo: 'direção e inclinação estáveis nas janelas' }, cantos: cantos || st.lote.pts.map(() => null), aplicado, sig: '', previa3d: true, arquivo };
  return st;
}

describe('prévia do relevo no 3D', () => {
  it('sem relevo lido ou terreno plano não há prévia', () => {
    expect(A.relevoPrevia(estado(A, {}))).toBeNull();
    const st = estadoRelevo({ gx: 0.004, nivel: 'plano' });
    expect(A.relevoPrevia(st)).toBeNull();
  });
  it('plano de 6% que sobe para leste: cantos, curvas de nível e direção da descida', () => {
    const st = estadoRelevo({ gx: 0.06 }), pv = A.relevoPrevia(st);
    perto(pv.pct, 6, 1e-9); expect(pv.dirTxt).toBe('O');            // sobe para o leste → desce para o oeste
    expect(pv.dir[0]).toBeCloseTo(-1, 9); expect(Math.abs(pv.dir[1])).toBeLessThan(1e-9);
    // cantos relativos ao centro do lote: ±0,06 × meia largura da moldura
    const [x0, , x1] = pv.rect, zs = pv.cantos.map(c => c[2]);
    perto(Math.max(...zs), 0.06 * (x1 - pv.c[0]), 1e-9); perto(Math.min(...zs), 0.06 * (x0 - pv.c[0]), 1e-9);
    // curvas: todas dentro da moldura, sobre a reta g·(p−c)=h e com o passo da amplitude
    expect(pv.curvas.length).toBeGreaterThan(1);
    for (const c of pv.curvas) for (const [x, y] of [[c.seg[0], c.seg[1]], [c.seg[2], c.seg[3]]]) {
      expect(pv.g[0] * (x - pv.c[0]) + pv.g[1] * (y - pv.c[1])).toBeCloseTo(c.h, 6);
      expect(x).toBeGreaterThanOrEqual(pv.rect[0] - 1e-6); expect(x).toBeLessThanOrEqual(pv.rect[2] + 1e-6);
      expect(y).toBeGreaterThanOrEqual(pv.rect[1] - 1e-6); expect(y).toBeLessThanOrEqual(pv.rect[3] + 1e-6);
    }
    const hs = pv.curvas.map(c => c.h); for (let i = 1; i < hs.length; i++) perto(hs[i] - hs[i - 1], pv.passo, 1e-9);
    expect([0.5, 1, 2, 5]).toContain(pv.passo);
  });
  it('a direção respeita o norte do lote (planta girada)', () => {
    // mesmo gradiente ENU (sobe para o norte): com o lote girado 90°, a descida aponta para o outro lado na planta
    const a = A.relevoPrevia(estadoRelevo({ gx: 0, gy: 0.05, norte: 0 })), b = A.relevoPrevia(estadoRelevo({ gx: 0, gy: 0.05, norte: 90 }));
    expect(a.dirTxt).toBe('S'); expect(b.dirTxt).toBe('S');           // o texto é geográfico
    expect(Math.hypot(a.dir[0] - b.dir[0], a.dir[1] - b.dir[1])).toBeGreaterThan(1);   // mas o vetor na planta mudou
  });
  it('cotas dos cantos informadas (3 ou mais) viram o plano e a confiança é alta', () => {
    const st = estadoRelevo({ gx: 0, gy: 0, nivel: 'baixa' }), L = st.lote.pts;
    st.relevo.cantos = L.map(q => 100 + 0.1 * q[1]);                  // sobe 10% para o norte da planta
    const ef = A.relevoEfetivoDe(st); expect(ef.info).toBe(true); expect(ef.conf.nivel).toBe('alta');
    const pv = A.relevoPrevia(st); perto(pv.pct, 10, 1e-6); expect(pv.dir[1]).toBeLessThan(-0.99);
  });
  it('reta × retângulo', () => {
    expect(A.relevoRetaNoRetangulo([1, 0], [0, 0], 5, [0, 0, 10, 10])).toEqual([5, 0, 5, 10]);
    expect(A.relevoRetaNoRetangulo([1, 0], [0, 0], 50, [0, 0, 10, 10])).toBeNull();
    const d = A.relevoRetaNoRetangulo([1, 1], [0, 0], 0, [-5, -5, 5, 5]); expect(Math.abs(d[0] + d[2])).toBeLessThan(1e-9);
  });
  it('a interface registra o gancho do 3D e some com a topografia ligada', () => {
    const ui = fs.readFileSync(path.join(ROOT, 'src', 'ui', 'relevo.js'), 'utf8');
    expect(ui).toMatch(/HOOK\.draw3d\.push\(\(grp, m\)=>\{[\s\S]*?!m\.topo[\s\S]*?relevoPrevia\(S\)/);
    expect(ui).toMatch(/previa3d:true/); expect(ui).toMatch(/relevo\.previa3d/);
  });
});

/* ---------- GeoTIFF sintético (TIFF clássico não comprimido) ---------- */
function geraTiff({ w, h, f, bits = 32, tipo = 'f', tile = 0, le = true, epsg = 4326, projetado = false, origem, res, noData = null, comp = 1, pixelPonto = false }) {
  const bps = bits / 8, tw = tile || w, th = tile || h;
  const nTx = tile ? Math.ceil(w / tw) : 1, nTy = tile ? Math.ceil(h / th) : 1;
  const bufDados = []; const tilesBytes = [];
  const pxBytes = v => { const b = new DataView(new ArrayBuffer(bps)); if (tipo === 'f') (bits === 32 ? b.setFloat32(0, v, le) : b.setFloat64(0, v, le)); else if (tipo === 'i') (bits === 16 ? b.setInt16(0, Math.round(v), le) : b.setInt32(0, Math.round(v), le)); else (bits === 8 ? b.setUint8(0, Math.round(v)) : b.setUint16(0, Math.round(v), le)); return new Uint8Array(b.buffer) };
  for (let ty = 0; ty < nTy; ty++) for (let tx = 0; tx < nTx; tx++) {
    const rows = tile ? th : h, cols = tile ? tw : w, arr = new Uint8Array(rows * cols * bps);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const gr = ty * th + r, gc = tx * tw + c; const v = gr < h && gc < w ? f(gc, gr) : (noData ?? 0); arr.set(pxBytes(v), (r * cols + c) * bps) }
    tilesBytes.push(arr);
  }
  // layout: cabeçalho 8 bytes | dados | valores grandes | IFD
  const partes = []; let pos = 8; const offs = [], cnts = [];
  tilesBytes.forEach(a => { offs.push(pos); cnts.push(a.length); partes.push(a); pos += a.length });
  const extra = []; const reserva = (bytes) => { const o = pos; extra.push(bytes); pos += bytes.length; return o };
  const dbl = a => { const d = new DataView(new ArrayBuffer(8 * a.length)); a.forEach((v, i) => d.setFloat64(i * 8, v, le)); return new Uint8Array(d.buffer) };
  const sh = a => { const d = new DataView(new ArrayBuffer(2 * a.length)); a.forEach((v, i) => d.setUint16(i * 2, v, le)); return new Uint8Array(d.buffer) };
  const lg = a => { const d = new DataView(new ArrayBuffer(4 * a.length)); a.forEach((v, i) => d.setUint32(i * 4, v, le)); return new Uint8Array(d.buffer) };
  const ent = []; const E = (tag, tipoT, count, valor) => ent.push({ tag, tipoT, count, valor });   // valor: número (inline) ou Uint8Array
  E(256, 4, 1, w); E(257, 4, 1, h); E(258, 3, 1, bits); E(259, 3, 1, comp); E(262, 3, 1, 1); E(277, 3, 1, 1); E(284, 3, 1, 1); E(339, 3, 1, tipo === 'f' ? 3 : tipo === 'i' ? 2 : 1);
  if (tile) { E(322, 4, 1, tw); E(323, 4, 1, th); E(324, 4, offs.length, lg(offs)); E(325, 4, cnts.length, lg(cnts)) }
  else { E(273, 4, 1, offs[0]); E(278, 4, 1, h); E(279, 4, 1, cnts[0]) }
  E(33550, 12, 3, dbl([res[0], res[1], 0]));
  E(33922, 12, 6, dbl([0, 0, 0, origem[0], origem[1], 0]));
  const keys = projetado ? [1, 1, 0, 4, 1024, 0, 1, 1, 1025, 0, 1, pixelPonto ? 2 : 1, 3072, 0, 1, epsg, 2054, 0, 1, 9001] : [1, 1, 0, 3, 1024, 0, 1, 2, 1025, 0, 1, pixelPonto ? 2 : 1, 2048, 0, 1, epsg];
  E(34735, 3, keys.length, sh(keys));
  if (noData != null) { const s = String(noData) + '\0'; E(42113, 2, s.length, new Uint8Array([...s].map(ch => ch.charCodeAt(0)))) }
  ent.sort((a, b) => a.tag - b.tag);
  const tamTipo = { 2: 1, 3: 2, 4: 4, 12: 8 };
  ent.forEach(e => { if (e.valor instanceof Uint8Array && e.valor.length > 4) e.off = reserva(e.valor) });
  const ifdOff = pos, ifd = new DataView(new ArrayBuffer(2 + ent.length * 12 + 4)); ifd.setUint16(0, ent.length, le);
  ent.forEach((e, i) => { const p = 2 + i * 12; ifd.setUint16(p, e.tag, le); ifd.setUint16(p + 2, e.tipoT, le); ifd.setUint32(p + 4, e.count, le);
    if (e.off != null) ifd.setUint32(p + 8, e.off, le);
    else if (e.valor instanceof Uint8Array) { for (let k = 0; k < e.valor.length; k++) ifd.setUint8(p + 8 + k, e.valor[k]) }
    else if (tamTipo[e.tipoT] === 2) ifd.setUint16(p + 8, e.valor, le); else ifd.setUint32(p + 8, e.valor, le) });
  const total = ifdOff + ifd.byteLength, out = new Uint8Array(total), head = new DataView(out.buffer);
  out[0] = out[1] = le ? 0x49 : 0x4D; head.setUint16(2, 42, le); head.setUint32(4, ifdOff, le);
  let q = 8; partes.forEach(a => { out.set(a, q); q += a.length }); extra.forEach(a => { out.set(a, q); q += a.length });
  out.set(new Uint8Array(ifd.buffer), ifdOff);
  return out.buffer;
}
// raster 40 × 30 em grau (≈ 30 m): sobe 4% para o norte e 2% para o leste
function rasterSintetico(o = {}) {
  const lat0 = -29.335, lon0 = -49.727, px = 0.000277778, kx = 111320 * Math.cos(lat0 * Math.PI / 180), ky = 110574;
  const w = 40, h = 30, x0 = lon0 - w / 2 * px, y0 = lat0 + h / 2 * px;
  const g = (c, r) => 50 + 0.02 * ((x0 + (c + 0.5) * px - lon0) * kx) + 0.04 * (((y0 - (r + 0.5) * px) - lat0) * ky);
  return { lat0, lon0, px, w, h, x0, y0, g, buf: geraTiff({ w, h, f: g, origem: [x0, y0], res: [px, px], ...o }) };
}

describe('GeoTIFF — leitor mínimo e relevo do lote', () => {
  it('lê tiras e ladrilhos, little/big-endian, 16/32/64 bits, e a georreferência', () => {
    for (const o of [{ bits: 32 }, { bits: 64 }, { bits: 16, tipo: 'i' }, { bits: 32, tile: 16 }, { bits: 32, le: false }, { bits: 16, tipo: 'i', tile: 16, le: false }]) {
      const r = rasterSintetico(o), arq = A.gtAbrir(r.buf);
      expect([arq.w, arq.h]).toEqual([40, 30]); expect(arq.crs).toEqual({ tipo: 'geo', epsg: 4326 });
      perto(arq.origem[0], r.x0, 1e-9); perto(arq.origem[1], r.y0, 1e-9); perto(arq.res[0], r.px, 1e-9);
      const ex = arq.ler(0, 0, 40, 30), tol = o.tipo === 'i' ? 0.51 : 1e-3;
      expect(ex.w).toBe(40); expect(ex.h).toBe(30);
      for (const [c, rr] of [[0, 0], [39, 29], [17, 11], [31, 5]]) expect(Math.abs(ex.data[rr * 40 + c] - r.g(c, rr)), `${JSON.stringify(o)} @${c},${rr}`).toBeLessThan(tol);
      const j = arq.ler(10, 8, 20, 18); expect(j.w).toBe(10); expect(j.h).toBe(10);
      expect(Math.abs(j.data[0] - r.g(10, 8))).toBeLessThan(tol); expect(Math.abs(j.data[9 * 10 + 9] - r.g(19, 17))).toBeLessThan(tol);
    }
  });
  it('valor sem dado vira NaN', () => {
    const arq = A.gtAbrir(geraTiff({ w: 8, h: 8, f: (c, rr) => (c === 3 && rr === 4 ? -9999 : 10 + c), origem: [-50, -29], res: [0.001, 0.001], noData: -9999 }));
    const e = arq.ler(0, 0, 8, 8); expect(Number.isNaN(e.data[4 * 8 + 3])).toBe(true); expect(e.data[0]).toBe(10); expect(arq.noData).toBe(-9999);
  });
  it('recusa o que não consegue ler direito: comprimido, sem georreferência, não-TIFF', () => {
    expect(() => A.gtAbrir(rasterSintetico({ comp: 8 }).buf)).toThrow(/compress/);
    expect(() => A.gtAbrir(new TextEncoder().encode('isto não é um TIFF').buffer)).toThrow(/TIFF/);
    const sem = geraTiff({ w: 4, h: 4, f: () => 1, origem: [0, 0], res: [1, 1] }), dv = new DataView(sem);
    // apaga a etiqueta ModelPixelScale (33550) trocando-a por uma desconhecida → sem georreferência
    const n = dv.getUint16(dv.getUint32(4, true), true), ifd = dv.getUint32(4, true);
    for (let i = 0; i < n; i++) if (dv.getUint16(ifd + 2 + i * 12, true) === 33550) dv.setUint16(ifd + 2 + i * 12, 60000, true);
    expect(() => A.gtAbrir(sem)).toThrow(/georreferência/);
  });
  it('recupera a inclinação do lote (4% para o norte, 2% para o leste) com a janela lida só em volta dele', () => {
    const r = rasterSintetico({ bits: 32 }), arq = A.gtAbrir(r.buf), ref = A.geoRef(r.lat0, r.lon0), centro = [0, 0];
    const jan = A.gtJanelaDoLote(arq, ref, centro, 240), cr = arq.ler(...jan), raster = { ...arq, ...cr };
    expect(cr.w).toBeLessThan(40); expect(cr.w).toBeGreaterThan(4);
    const res = A.relevoDeRaster(raster, ref, centro, {});
    perto(res.plano.gx, 0.02, 2e-4); perto(res.plano.gy, 0.04, 2e-4);
    perto(res.plano.pct, Math.hypot(2, 4), 0.03); expect(A.relevoDirTexto(res.plano.azDesc)).toBe('SO');
    expect(res.conf.nivel).toBe('media'); expect(res.origem).toBe('ANADEM'); expect(res.planos.length).toBe(3);
    // a mesma conta com o raster inteiro dá o mesmo plano
    const todo = A.relevoDeRaster({ ...arq, ...arq.ler(0, 0, 40, 30) }, ref, centro, {}); perto(todo.plano.gx, res.plano.gx, 1e-6);
  });
  it('UTM (SIRGAS 2000, fuso 22S): mesmo plano com a amostragem em metros', () => {
    const lat0 = -29.335, lon0 = -49.727, ref = A.geoRef(lat0, lon0), c = A.geoLatLonParaUtm(lat0, lon0, 22), w = 60, h = 60, res = 30;
    const x0 = c[0] - w / 2 * res, y0 = c[1] + h / 2 * res;
    // plano no UTM: sobe 5% para o leste, desce 3% para o norte (UTM e a planta local têm convergência pequena aqui)
    const f = (cc, rr) => 40 + 0.05 * ((x0 + (cc + 0.5) * res) - c[0]) - 0.03 * ((y0 - (rr + 0.5) * res) - c[1]);
    const buf = geraTiff({ w, h, f, bits: 32, tile: 32, origem: [x0, y0], res: [res, res], epsg: 31982, projetado: true });
    const arq = A.gtAbrir(buf); expect(arq.crs).toMatchObject({ tipo: 'utm', zona: 22, sul: true });
    const r = A.relevoDeRaster({ ...arq, ...arq.ler(0, 0, w, h) }, ref, [0, 0], {});
    perto(r.plano.gx, 0.05, 3e-3); perto(r.plano.gy, -0.03, 3e-3);
  });
  it('arquivo que não cobre o lote ou cobre só uma parte avisa', () => {
    const r = rasterSintetico({}), arq = A.gtAbrir(r.buf), raster = { ...arq, ...arq.ler(0, 0, 40, 30) };
    expect(() => A.relevoDeRaster(raster, A.geoRef(r.lat0 + 1, r.lon0), [0, 0], {})).toThrow(/fora da área/);
    const borda = A.geoRef(r.lat0, r.lon0 + 0.00556 + 0.0009);        // centro ~90 m a leste da borda do arquivo: só a ponta oeste da janela é coberta
    expect(() => A.relevoDeRaster(raster, borda, [0, 0], {})).toThrow(/parte|fora/);
  });
  it('a interface lê o arquivo (leitor mínimo; biblioteca geotiff sob demanda, em versão fixa) e guarda a fonte', () => {
    const ui = fs.readFileSync(path.join(ROOT, 'src', 'ui', 'relevo.js'), 'utf8');
    expect(ui).toMatch(/geotiff@\d+\.\d+\.\d+\/dist-browser\/geotiff\.js/); expect(ui).toMatch(/gtAbrir\(buf\)/); expect(ui).toMatch(/relevoDeRaster\(/); expect(ui).toMatch(/R\.fonte="anadem"/);
    expect(Object.keys(A.RELEVO_JANELAS)).toContain('anadem');
  });
});

/* ---------- página do PDF: topografia e relevo ---------- */
describe('PDF — página de topografia e relevo', () => {
  const comTopo = (extra = {}) => { const st = estado(A, {}); st.topo.on = true; st.topo.pts = A.topoExemplo(st.lote.pts, A.frontDir(st)); st.topo.fonte = 'exemplo: terreno inclinado ≈ 11%'; Object.assign(st.topo, extra); const m = A.compute(st); return { st, m } };
  it('sem topografia nem relevo não há página', () => {
    const st = estado(A, {}), m = A.compute(st); expect(A.terrenoPdfDados(st, m)).toBeNull();
  });
  it('topografia: cota do térreo, corte e aterro, contenção e custos que fecham com o orçamento', () => {
    const { st, m } = comTopo(), d = A.terrenoPdfDados(st, m);
    expect(d.topo).toBeTruthy(); expect(d.relevo).toBeNull();
    const rot = d.topo.secoes.flatMap(s => s.linhas.map(l => l[0]));
    for (const k of ['Cota ótima do térreo', 'Cota do térreo adotada', 'Corte total', 'Aterro total', 'Total no custo da obra']) expect(rot, k).toContain(k);
    expect(d.topo.secoes.map(s => s.h)).toEqual(['Levantamento e cota do térreo', 'Movimento de terra', 'Contenção e lençol', 'Custos']);
    const t = m.topo; perto(d.topo.total, t.custos.terra + t.custos.contencao + t.custos.arrimo + t.custos.rebaix + t.custos.imperm, 1e-9);
    // o total é o que entra em custosExtra
    const somaExtra = m.custosExtra.filter(c => /^topo\./.test(c.k)).reduce((s, c) => s + c.valor, 0); perto(d.topo.total, somaExtra, 1e-6);
    const corte = d.topo.secoes[1].linhas.find(l => l[0] === 'Corte total')[1]; expect(corte).toContain(A.nf(t.terra.corte, 0));
    expect(d.topo.secoes[1].linhas.filter(l => /subsolo/.test(l[0])).length).toBe(t.terra.subs.length);
  });
  it('lençol freático e soleira fora da tolerância aparecem com o estado certo', () => {
    const { st, m } = comTopo({ naOn: true, naProf: 1 }), d = A.terrenoPdfDados(st, m);
    expect(d.topo.secoes[2].linhas.some(l => l[0] === 'Lençol freático')).toBe(true);
    const { st: s2, m: m2 } = comTopo({ cotaModo: 'manual', cotaTerreo: 140 }), d2 = A.terrenoPdfDados(s2, m2);
    expect(d2.topo.secoes[0].linhas.find(l => l[0] === 'Soleira × calçada')[2]).toBe('bad');
  });
  it('relevo sem topografia: inclinação, direção, confiança, fonte e o aviso de modelo de superfície (±3 m)', () => {
    const st = estadoRelevo({ gx: 0.05, gy: -0.02 }), m = A.compute(st), d = A.terrenoPdfDados(st, m);
    expect(d.topo).toBeNull(); expect(d.relevo).toBeTruthy();
    const L = Object.fromEntries(d.relevo.secoes[0].linhas.map(l => [l[0], l[1]]));
    expect(L['Inclinação']).toMatch(/5,4%/); expect(L['Direção da descida']).toMatch(/^para (O|NO)/); expect(L['Confiança']).toMatch(/alta/); expect(L['Fonte']).toMatch(/Terrarium.*janela 160 m.*08\/10\/2026/);
    expect(L['No estudo']).toMatch(/só leitura/); expect(d.relevo.aviso).toMatch(/SUPERFÍCIE/); expect(d.relevo.aviso).toMatch(/±3 m/);
    expect(d.relevo.previa && d.relevo.previa.curvas.length).toBeGreaterThan(0);
  });
  it('terreno plano: a página diz "praticamente plano" e não inventa direção', () => {
    const st = estadoRelevo({ gx: 0.003, nivel: 'plano' }), d = A.terrenoPdfDados(st, A.compute(st)), L = d.relevo.secoes[0].linhas.map(l => l[0]);
    expect(d.relevo.secoes[0].linhas[0][1]).toMatch(/praticamente plano/); expect(L).not.toContain('Direção da descida'); expect(d.relevo.previa).toBeNull();
  });
  it('topografia e relevo juntos; ANADEM e cotas dos cantos trocam o aviso', () => {
    const { st, m } = comTopo(); Object.assign(st, { relevo: estadoRelevo({ fonte: 'anadem', arquivo: 'anadem_s30w050.tif', aplicado: 'topo' }).relevo });
    const d = A.terrenoPdfDados(st, m); expect(d.topo && d.relevo).toBeTruthy(); expect(d.fontes).toBe('topografia e relevo');
    expect(d.relevo.aviso).toMatch(/ANADEM/); expect(d.relevo.secoes[0].linhas.find(l => l[0] === 'Fonte')[1]).toMatch(/anadem_s30w050\.tif/);
    expect(d.relevo.secoes[0].linhas.find(l => l[0] === 'No estudo')[1]).toMatch(/aplicado à topografia/);
    const sc = estadoRelevo({ gx: 0, gy: 0 }); sc.relevo.cantos = sc.lote.pts.map(q => 100 + 0.08 * q[0]);
    const dc = A.terrenoPdfDados(sc, A.compute(sc)); expect(dc.relevo.aviso).toMatch(/cotas informadas/); expect(dc.relevo.secoes[0].linhas.find(l => l[0] === 'Cotas informadas')).toBeTruthy();
  });
  it('a página está registrada em HOOK.pdf e só entra com dados', () => {
    const ui = fs.readFileSync(path.join(ROOT, 'src', 'ui', 'topografia.js'), 'utf8');
    expect(ui).toMatch(/HOOK\.pdf\.push\(async ctx=>\{\s*const dados=terrenoPdfDados\(S, ctx\.m\); if\(!dados\) return;/);
  });
});
