// 1.4 — impacto de vizinhança: horas de sol que o empreendimento tira do entorno
import { describe, it, expect } from 'vitest';
import { carregar, estado } from './harness.js';

const A = carregar();
const LAT = -28.68;

// cálculo manual independente: posição do sol (fórmula NOAA simplificada) e teste raio × caixa (método das placas)
function sol(mes, dia, hora) {
  const lat = LAT * Math.PI / 180, n = Math.floor((Date.UTC(2026, mes - 1, dia) - Date.UTC(2026, 0, 0)) / 864e5);
  const dec = 23.44 * Math.PI / 180 * Math.sin(2 * Math.PI * (284 + n) / 365), H = (hora - 12) * 15 * Math.PI / 180;
  const alt = Math.asin(Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(H));
  const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(lat) - Math.tan(dec) * Math.cos(lat)) + Math.PI; // a partir do norte, horário
  return { alt, x: Math.sin(az) * Math.cos(alt), y: Math.cos(az) * Math.cos(alt), z: Math.sin(alt) }; // norte = +y, leste = +x
}
function raioCaixa(p, d, b) { // b = [x0,y0,z0,x1,y1,z1]
  let t0 = 1e-6, t1 = Infinity;
  for (let k = 0; k < 3; k++) {
    if (Math.abs(d[k]) < 1e-12) { if (p[k] < b[k] || p[k] > b[k + 3]) return false; continue }
    let a = (b[k] - p[k]) / d[k], c = (b[k + 3] - p[k]) / d[k]; if (a > c) [a, c] = [c, a];
    t0 = Math.max(t0, a); t1 = Math.min(t1, c); if (t0 > t1) return false;
  }
  return true;
}
const box = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

describe('1.4 impacto de vizinhança', () => {
  // prédio alto (40 m) e um vizinho baixo (6 m) 12 m ao sul; outro vizinho ao norte
  const st = estado(A, { lote: { pts: box(-12, -2, 12, 22), front: [0], principal: 0, rec: [{}, {}, {}, {}], norte: 0, lat: LAT } });
  st.entorno = [
    { nome: 'Casa ao sul', h: 6, pts: box(-15, -30, 15, -12) },
    { nome: 'Casa ao norte', h: 6, pts: box(-15, 32, 15, 50) },
  ];
  const torre = box(-10, 0, 10, 20);
  const PR = [
    { poly: torre, z0: 0, z1: 40, own: true },
    ...st.entorno.map(e => ({ poly: e.pts, z0: 0, z1: e.h, own: false })),
  ];
  const r = A.vizCalc(st, null, { prisms: PR, mapa: true });

  it('vizinho ao sul perde sol no inverno e a perda bate com o cálculo manual', () => {
    const sul = r.vizinhos.find(v => v.nome === 'Casa ao sul');
    expect(sul.perdaInv).toBeGreaterThan(0.5);
    expect(sul.areaAfetada).toBeGreaterThan(0);
    // ponto da fachada norte da casa (y = −12), no meio (x ≈ 0), a 1,5 m de altura
    const pt = sul.amostras.filter(a => a.n[1] > 0.9).reduce((b, a) => (Math.abs(a.x) + Math.abs(a.z - 1.5) < Math.abs(b.x) + Math.abs(b.z - 1.5) ? a : b));
    let manual = 0;
    for (let h = 4 + 0.125; h < 20; h += 0.25) {
      const s = sol(6, 21, h); if (s.alt <= 0.005) continue;
      if (s.y <= 0.01 * Math.hypot(s.x, s.y)) continue;          // sol de costas para a fachada norte
      if (raioCaixa([pt.x, pt.y, pt.z], [s.x, s.y, s.z], [-10, 0, 0, 10, 20, 40])) manual += 0.25;
    }
    console.log('perda no ponto (21/jun):', pt.perda[5], 'h · manual:', manual, 'h');
    expect(manual).toBeGreaterThan(2);
    expect(Math.abs(pt.perda[5] - manual)).toBeLessThanOrEqual(0.25);
    // no verão o sol do meio-dia passa por cima: perda bem menor que no inverno
    expect(sul.perdaMes[11]).toBeLessThan(sul.perdaInv);
  });

  it('vizinho ao norte não perde sol no inverno (a sombra vai para o sul)', () => {
    const norte = r.vizinhos.find(v => v.nome === 'Casa ao norte');
    expect(norte.perdaInv).toBeLessThan(0.05);
    expect(norte.perdaMes[5]).toBeLessThan(0.05);
  });

  it('mapa de horas perdidas no chão: sombra ao sul, nada no lote', () => {
    const M = r.mapa; expect(M).toBeTruthy();
    const at = (x, y) => M.data[Math.floor((y - M.y0) / M.cs) * M.nx + Math.floor((x - M.x0) / M.cs)];
    expect(at(0, -8)).toBeGreaterThan(3);        // logo ao sul da torre
    expect(at(0, 28)).toBeLessThan(0.3);         // ao norte
    expect(Number.isNaN(at(0, 10))).toBe(true);  // dentro do lote
    expect(M.max).toBeGreaterThan(3);
  });

  it('desligado não calcula nada; ligado entra no modelo', () => {
    const s0 = estado(A, {}); s0.entorno = st.entorno.map(e => ({ ...e, pts: e.pts.map(q => [q[0] + 17, q[1]]) }));
    const m0 = A.compute(s0); expect(m0.viz).toBeUndefined();
    s0.vizinhanca.on = true; const m1 = A.compute(s0);
    expect(m1.viz.vizinhos.length).toBe(2);
    console.log('vizinhança: cálculo completo', Math.round(m1.viz.ms), 'ms (vm do Node)');
    expect(A.vizCalc(s0, m1)).toBe(m1.viz);                         // segunda chamada: cache, sem recalcular
    const t = Date.now(); A.vizCalc(s0, m1); expect(Date.now() - t).toBeLessThan(50);
    // trocar o mês do mapa não refaz as fachadas (só o mapa)
    s0.vizinhanca.mes = 12; const r12 = A.vizCalc(s0, m1);
    expect(r12.vizinhos).toBe(m1.viz.vizinhos); expect(r12.mapa.mes).toBe(12);
    // arrastando controles (rápido): devolve o último resultado, marcado como antigo
    s0.vizinhanca.mes = 3; expect(A.vizCalc(s0, m1, { fast: true }).stale).toBe(true);
  });
});
