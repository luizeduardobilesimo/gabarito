import { describe, it, expect } from 'vitest';
import { carregar } from './harness.js';
// atenção: no app, "G" é o namespace da geometria (src/geom.js); aqui o contexto do app chama-se A
const A = carregar(), G = A.G;
const Q = [[0,0],[10,0],[10,20],[0,20]];
describe('geom', () => {
  it('área e perímetro do retângulo 10×20', () => { expect(G.area(Q)).toBeCloseTo(200, 6); expect(G.perimeter(Q)).toBeCloseTo(60, 6) });
  it('offset para dentro de 1 m reduz para 8×18', () => { const o = G.offsetPoly(Q, () => 1); expect(Math.abs(G.area(o))).toBeCloseTo(144, 1) });
  it('ponto dentro / fora', () => { expect(G.pip([5,5], Q)).toBe(true); expect(G.pip([15,5], Q)).toBe(false) });
});
