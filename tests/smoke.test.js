import { describe, it, expect } from 'vitest';
import { carregar } from './harness.js';

describe('núcleo carrega sem navegador', () => {
  it('compute + finance no exemplo padrão', () => {
    const A = carregar();
    const t0 = Date.now();
    const m = A.compute(A.S);
    const f = A.finance(A.S, m);
    console.log('exemplo:', { units: m.units, vagas: m.vagas, vagasReq: m.vagasReq, CA: +m.CA.toFixed(3), H: +m.H.toFixed(2), vgv: Math.round(f.vgv), lucro: Math.round(f.lucro), margem: +f.margem.toFixed(4), ms: Date.now() - t0 });
    expect(m.units).toBeGreaterThan(0);
    expect(Array.isArray(m.custosExtra)).toBe(true);
    expect(f.vgv).toBeGreaterThan(0);
  });
});
