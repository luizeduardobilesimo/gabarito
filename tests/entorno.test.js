import { describe, it, expect } from 'vitest';
import { carregar, estado } from './harness.js';

const A = carregar(), G = A.G;
const caixa = (x = 0, y = 0, w = 30, d = 20, h = 24) => A.entNovo([x, y], w, d, h);
const area = p => Math.abs(G.sArea(p));

describe('edição do entorno', () => {
  it('mover, escalar e girar preservam a forma', () => {
    const e = caixa(); const a0 = area(e.pts);
    A.entMove(e, 10, -5); expect(A.entCentro(e)[0]).toBeCloseTo(10, 6); expect(A.entCentro(e)[1]).toBeCloseTo(-5, 6); expect(area(e.pts)).toBeCloseTo(a0, 6);
    A.entEscala(e, 1.5); expect(area(e.pts)).toBeCloseTo(a0 * 2.25, 4);
    const c = A.entCentro(e); A.entGira(e, 90); expect(area(e.pts)).toBeCloseTo(a0 * 2.25, 4);
    expect(A.entCentro(e)[0]).toBeCloseTo(c[0], 6);
  });

  it('pátio: área líquida desconta o vazio e o polígono de sol tem o buraco', () => {
    const e = caixa(0, 0, 40, 30); const v = A.entPatio(e, 0.25);
    expect(v).toBeTruthy(); e.vazios = [v];
    expect(A.entVazios(e).length).toBe(1);
    expect(A.entArea(e)).toBeCloseTo(1200 - area(v), 4);
    expect(area(v) / 1200).toBeCloseTo(0.25, 1);
    const P = A.entPoly(e);
    expect(G.pip([0, 0], P)).toBe(false);        // dentro do pátio: vazio
    expect(G.pip([18, 13], P)).toBe(true);        // na parte construída
    expect(G.pip([30, 0], P)).toBe(false);        // fora do prédio
    expect(A.entHit(e, [0, 0])).toBe(false); expect(A.entHit(e, [18, 13])).toBe(true);
  });

  it('vazio que sai da edificação é ignorado', () => {
    const e = caixa(0, 0, 20, 20); e.vazios = [[[5, 5], [40, 5], [40, 12], [5, 12]]];
    expect(A.entVazios(e).length).toBe(0); expect(A.entPoly(e)).toBe(e.pts); expect(A.entArea(e)).toBeCloseTo(400, 6);
  });

  it('vários vazios e formato em L', () => {
    const L = { pts: [[0, 0], [40, 0], [40, 15], [15, 15], [15, 40], [0, 40]], h: 20 };
    const v = A.entPatio(L, 0.1); expect(v).toBeTruthy(); expect(A.entVazioOk(L, v)).toBe(true);
    const e = caixa(0, 0, 60, 40); e.vazios = [[[-20, -10], [-10, -10], [-10, 10], [-20, 10]], [[8, -8], [20, -8], [20, 8], [8, 8]]];
    expect(A.entVazios(e).length).toBe(2);
    const P = A.entPoly(e); expect(G.pip([-15, 0], P)).toBe(false); expect(G.pip([14, 0], P)).toBe(false); expect(G.pip([0, 0], P)).toBe(true);
  });

  it('duplicar copia sem id e seleção por retângulo usa o centro', () => {
    const e = caixa(); A.entId(e); const c = A.entDuplica(e);
    expect(c.id).toBeUndefined(); expect(c.pts).not.toBe(e.pts); expect(A.entCentro(c)[0]).toBeCloseTo(6, 6);
    const l = [caixa(0, 0), caixa(100, 0), caixa(-50, 50)];
    expect(A.entNoRetangulo(l, [-10, -10, 120, 10]).length).toBe(2);
    expect(A.entQualContem(l, [1, 1])).toBe(l[0]);
  });

  it('sombra: prédio com pátio deixa o sol passar no pátio (prismas usam o polígono com buraco)', () => {
    const st = estado(A, {}); st.entorno = [caixa(0, 60, 40, 30, 40)]; st.entorno[0].vazios = [A.entPatio(st.entorno[0], 0.3)];
    const m = A.compute(st, { quick: true });
    const pr = A.prisms(st, m).filter(p => !p.own);
    expect(pr.length).toBe(1);
    expect(G.pip([0, 60], pr[0].poly)).toBe(false);   // centro do pátio livre
    expect(G.pip([17, 73], pr[0].poly)).toBe(true);
  });
});
