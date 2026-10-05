// Estudos de referência: qualquer mudança em vagas, CA, altura ou lucro aparece aqui.
// Mudança intencional? Rode `node tools/gera-cenarios.mjs` e confira o diff dos JSON.
import { describe, it, expect } from 'vitest';
import { carregar, cenarios, estado } from './harness.js';

const perto = (v, alvo, tol) => Math.abs(v - alvo) <= Math.abs(alvo) * tol + 1e-9;
describe('estudos de referência', () => {
  for (const c of cenarios()) it(c.nome, () => {
    const A = carregar(); const st = estado(A, c.S); const m = A.compute(st); const f = A.finance(st, m);
    const e = c.esperado, t = c.tolerancia || {};
    expect(m.units).toBe(e.units);
    expect(m.vagasReq).toBe(e.vagasReq);
    expect(perto(m.vagas, e.vagas, t.vagas ?? 0.03), `vagas ${m.vagas} ≠ ${e.vagas}`).toBe(true);
    expect(perto(m.CA, e.CA, t.CA ?? 0.002), `CA ${m.CA} ≠ ${e.CA}`).toBe(true);
    expect(m.H).toBeCloseTo(e.H, 1);
    expect(perto(f.lucro, e.lucro, t.lucro ?? 0.01), `lucro ${Math.round(f.lucro)} ≠ ${e.lucro}`).toBe(true);
  });
});
