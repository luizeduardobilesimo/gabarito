// Item 1.3 — otimizador com vários critérios: fronteira de Pareto e "aplicar um ponto reproduz os números mostrados".
import { describe, it, expect } from 'vitest';
import { carregar, estado } from './harness.js';

const A = carregar();
const C = A.PARETO_CRIT;
const crit = [C.lucro, C.sol, C.vagas];

describe('fronteira de Pareto', () => {
  // conjunto conhecido (lucro, sol, vagas/exigidas)
  const P = [
    { id: 'a', lucro: 10, sol: 3, vagas: 50, req: 50 },   // fronteira
    { id: 'b', lucro: 12, sol: 2, vagas: 50, req: 50 },   // fronteira (mais lucro entre os que atendem as vagas)
    { id: 'c', lucro: 9, sol: 2.5, vagas: 50, req: 50 },  // dominado por a
    { id: 'd', lucro: 15, sol: 1, vagas: 40, req: 50 },   // fronteira (mais lucro de todos, mas não atende as vagas)
    { id: 'e', lucro: 8, sol: 4, vagas: 30, req: 50 },    // fronteira (melhor sol)
    { id: 'f', lucro: 8, sol: 3.9, vagas: 30, req: 50 },  // dominado por e
    { id: 'g', lucro: 12, sol: 2, vagas: 50, req: 50 },   // empate exato com b: ninguém domina → fronteira
    { id: 'h', lucro: 11, sol: NaN, vagas: 50, req: 50 }, // sol ausente = pior; dominado por b
  ];
  it('acha exatamente os não dominados', () => {
    const f = A.paretoFronteira(P, crit).map(i => P[i].id).sort();
    expect(f).toEqual(['a', 'b', 'd', 'e', 'g']);
  });
  it('dominância: melhor em um e não pior nos outros', () => {
    expect(A.paretoDomina(P[0], P[2], crit)).toBe(true);
    expect(A.paretoDomina(P[2], P[0], crit)).toBe(false);
    expect(A.paretoDomina(P[1], P[6], crit)).toBe(false); // empate
    expect(A.paretoDomina(P[1], P[3], crit)).toBe(false); // troca: menos lucro, mais vagas
  });
  it('tolerância de empate no sol (0,05 h)', () => {
    const Q = [{ lucro: 10, sol: 3.00, vagas: 1, req: 1 }, { lucro: 9, sol: 3.04, vagas: 1, req: 1 }];
    expect(A.paretoFronteira(Q, crit)).toEqual([0]);
  });
  it('critério "menor é melhor" (custo da malha)', () => {
    const Q = [{ lucro: 10, malhaCusto: 5 }, { lucro: 10, malhaCusto: 4 }];
    expect(A.paretoFronteira(Q, [C.lucro, C.malha])).toEqual([1]);
  });
  it('camadas e filtros', () => {
    const r = A.paretoCamadas(P, crit);
    expect(r[0]).toBe(0); expect(r[2]).toBe(1); expect(r[5]).toBe(1);
    const fl = P.filter(p => A.paretoFiltra(p, { vagas: true, solMin: 3 })).map(p => p.id);
    expect(fl).toEqual(['a']);
  });
  it('espalha pontos ao longo do lucro com os extremos', () => {
    const L = Array.from({ length: 20 }, (_, i) => ({ lucro: i }));
    const s = A.paretoEspalha(L, 5).map(p => p.lucro);
    expect(s[0]).toBe(0); expect(s.at(-1)).toBe(19); expect(s.length).toBe(5);
  });
});

describe('otimizar() com vários critérios', () => {
  const opts = { obj: 'lucro', torres: false, tipologias: false, unidades: true, paretoMax: 4 };
  it('objetivo lucro: o multicritério não muda as melhores opções; aplicar um ponto reproduz os números', async () => {
    const B = carregar(); const st = estado(B, {}); const m = B.compute(st);
    // sem a fase "ciclo" (garagem real, cálculo completo da 1ª): ela tem orçamento de tempo, que muda com a carga da máquina e com a
    // reserva da fronteira — aqui o que se confere é só que a fronteira não muda as melhores (o ciclo é testado em otimciclo.test.js)
    const so = await B.otimizar({ ...opts, mc: false, ciclo: false }, null, null, { st, m });
    const mc = await B.otimizar({ ...opts, mc: true, ciclo: false }, null, null, { st, m });
    const key = r => [r.nT, r.pk, r.N, r.pav, r.sub, r.gac, Math.round(r.lucro), r.vagas].join(',');
    expect(mc.res.map(key)).toEqual(so.res.map(key));
    expect(so.pareto).toBeUndefined();
    // resultado serializável (vai do Worker para a página)
    expect(() => JSON.parse(JSON.stringify(mc))).not.toThrow();
    expect(mc.pareto.pts.length).toBeGreaterThan(0);
    expect(mc.pareto.criterios).toEqual(['lucro', 'sol', 'vagas']);
    expect(mc.pareto.pts.some(p => p.fronteira)).toBe(true);
    // a marcação de fronteira é a de paretoFronteira sobre os pontos conferidos
    const fr = B.paretoFronteira(mc.pareto.pts, [B.PARETO_CRIT.lucro, B.PARETO_CRIT.sol, B.PARETO_CRIT.vagas]);
    expect(mc.pareto.pts.map(p => !!p.fronteira)).toEqual(mc.pareto.pts.map((_, i) => fr.includes(i)));
    // aplicar um ponto reproduz os números mostrados
    for (const p of mc.pareto.pts.filter(p => p.fronteira).slice(0, 2)) {
      const s2 = estado(B, {}); B.aplicarOtim(p, s2);
      const m2 = B.compute(s2, { quick: true }), f2 = B.finance(s2, m2);
      expect(m2.units).toBe(p.units);
      expect(m2.vagas).toBe(p.vagas);
      expect(f2.lucro).toBeCloseTo(p.lucro, 0);
      expect(f2.margemVGV).toBeCloseTo(p.margem, 6); expect(f2.margem).toBeCloseTo(p.margemReceita, 6);   // margem = s/ VGV (Fase D)
      expect(B.otimSol(s2, m2, true).h).toBeCloseTo(p.sol, 6);
      // na tela o cálculo é o completo: mesmo lucro
      const m3 = B.compute(s2), f3 = B.finance(s2, m3);
      expect(Math.abs(f3.lucro - p.lucro) / Math.abs(p.lucro)).toBeLessThan(0.005);
    }
  }, 300000);
  it('proxy de sol: mais sombra com vizinhos altos', () => {
    const B = carregar(); const st = estado(B, {}); const m = B.massing(st);
    const s0 = B.otimSolProxy(st, m);
    expect(s0).toBeGreaterThan(0); expect(s0).toBeLessThan(13);
    st.entorno = [30, -30, 0].flatMap(dx => [0, 60, -60].map(dy => ({ pts: m.T[0].plate.map(q => [q[0] + dx, q[1] + dy]), h: 200 }))).filter((_, i) => i !== 6);
    expect(B.otimSolProxy(st, m)).toBeLessThan(s0);
  });
});
