// 2.4 — regras avançadas de forma: recuos progressivos, torres escalonadas, embasamento, soleira e aeródromo.
import { describe, it, expect } from 'vitest';
import { carregar, estado } from './harness.js';

const A = carregar();
const FX = [{ ate: 12, af: 2, div: 0 }, { ate: 0, af: 2, div: 6 }];   // até 12 m: 2 m; depois H/6
// caso conhecido: lote 30 × 50, frente em y=0 (recuo 4 m), uma torre de 10 pavimentos, sem cobertura/ático/duplex,
// torre ocupando todo o envelope (TO 100%, mix maior que o andar → a planta é o próprio envelope do 1º andar)
const base = (forma = {}) => estado(A, {
  lote: { pts: [[0, 0], [30, 0], [30, 50], [0, 50]], front: [0], principal: 0, rec: [{}, {}, {}, {}] },
  regras: { recFrente: 4, toTorre: 1, toEmb: 1, hMax: 80, caMax: 20 },
  produto: { torres: [{ pav: 10 }], subsolos: 0, garAcima: 0, peTerreo: 4.5, pe: 3, efic: 0.8, atico: false, garTerOn: false,
    cob: { on: false, qtd: 1, area: 100, preco: 1 }, mix: [{ nome: 'A', area: 100, qtd: 10, preco: 10000, sac: 0 }],
    lazer: { hall: 0, itens: [{ nome: 'Salão', area: 30, local: 'terreo' }] } },
  forma: { on: true, prog: true, escalonar: true, faixas: FX, ...forma },
});
const afEsperado = z => z <= 12 ? 2 : Math.max(2, z / 6);
const areaEnv = af => (30 - 2 * af) * (46 - af);   // largura 30−2·af, profundidade 50−4−af

describe('afastamento por faixas de altura', () => {
  it('formaAf segue as faixas (até 12 m: 2 m; depois H/6)', () => {
    const F = { faixas: FX };
    expect(A.formaAf(F, 7.5)).toBe(2);
    expect(A.formaAf(F, 12)).toBe(2);
    expect(A.formaAf(F, 13.5)).toBeCloseTo(2.25, 9);
    expect(A.formaAf(F, 34.5)).toBeCloseTo(5.75, 9);
  });
  it('padrão desligado: uma faixa só, áreas como na regra única', () => {
    const st = base({ on: false }), m = A.massing(st);
    expect(m.T[0].faixas.length).toBe(1);
    expect(m.env).toBeNull();
    expect(m.tiposA).toBeCloseTo(m.T[0].A * 10, 6);
    expect(m.hLim).toBe(80);
  });
});

describe('torre escalonada — caso conhecido', () => {
  const st = base(), m = A.massing(st), t = m.T[0];
  const zs = Array.from({ length: 10 }, (_, j) => 4.5 + 3 * (j + 1));   // topo de cada andar
  it('planta de cada andar = envelope da sua cota', () => {
    const porAndar = [];
    t.faixas.forEach(f => { for (let k = f.de; k <= f.ate; k++) porAndar[k - 1] = f.A });
    zs.forEach((z, j) => expect(porAndar[j]).toBeCloseTo(areaEnv(afEsperado(z)), 4));
    expect(t.faixas[0]).toMatchObject({ de: 1, ate: 2, n: 2 });   // 7,5 e 10,5 m: mesma faixa (2 m)
    expect(t.faixas.length).toBe(9);
    expect(t.plate).toBe(t.faixas[0].plate);                       // planta típica = a da base
  });
  it('área dos pavimentos e CA recalculados por faixa', () => {
    const tipos = zs.reduce((s, z) => s + areaEnv(afEsperado(z)), 0);
    expect(m.tiposA).toBeCloseTo(tipos, 3);
    const R = st.regras;
    expect(m.CA * m.A).toBeCloseTo((m.tiposA + m.duplexA) * (1 - R.ncTipo) + m.lojaA + (R.ncTerreo ? 0 : m.hallA + m.lzExtraA), 6);
    expect(10 * areaEnv(2) - m.tiposA).toBeGreaterThan(500);   // o escalonamento tira área da torre reta de 2 m
    const reta = A.massing(base({ escalonar: false }));        // torre reta presa ao recuo do topo: menos ainda
    expect(reta.CA).toBeLessThan(m.CA);
  });
  it('mix por faixa: andar que encolhe mais que rMin perde unidade', () => {
    const f1 = t.faixas[0], f2 = t.faixas[1];
    expect(f1.qtd).toEqual([10]);                         // r = 1144·0,8/1000 = 0,915 ≥ 0,9
    expect(f2.qtd).toEqual([9]);                          // 1115,6·0,8/1000 = 0,89 < 0,9 → 9 unidades
    expect(f2.r).toBeCloseTo(Math.min(1, areaEnv(2.25) * 0.8 / 900), 6);
    const un = t.faixas.reduce((s, f) => s + f.n * f.qtd[0], 0);
    expect(m.units).toBe(un);
    expect(m.unitRows[0].n).toBe(un);
  });
  it('envelope empilhado por cota (desenho 3D)', () => {
    expect(m.env.length).toBeGreaterThan(5);
    m.env.forEach(e => {
      expect(e.af).toBeCloseTo(afEsperado(e.z1 - 1e-9 > 12 ? e.z1 : e.z1), 6);
      expect(A.G.area(e.poly)).toBeCloseTo(areaEnv(e.af), 3);
    });
    for (let i = 1; i < m.env.length; i++) {
      expect(m.env[i].z0).toBeCloseTo(m.env[i - 1].z1, 9);
      expect(A.G.area(m.env[i].poly)).toBeLessThan(A.G.area(m.env[i - 1].poly));
    }
  });
  it('torre reta: todos os andares presos ao recuo do topo', () => {
    const r = A.massing(base({ escalonar: false }));
    expect(r.T[0].faixas.length).toBe(1);
    expect(r.T[0].A).toBeCloseTo(areaEnv(afEsperado(34.5)), 3);
    expect(r.tiposA).toBeCloseTo(10 * areaEnv(5.75), 3);
  });
});

describe('embasamento, soleira e aeródromo', () => {
  it('plano do aeródromo limita a altura (cota − soleira)', () => {
    const st = base({ aero: true, aeroCota: 30, soleira: 1 }), m = A.massing(st);
    expect(m.hLim).toBe(29);
    expect(A.status(m, st).h).toBe('bad');                 // 34,5 m > 29 m
    expect(A.maxPav(st)).toBe(8);                          // 4,5 + 8·3 = 28,5 ≤ 29
    const c = A.compute(st);
    expect(c.avisos.some(a => /aeródromo/.test(a))).toBe(true);
  });
  it('altura máxima do embasamento', () => {
    const st = base({ hEmbMax: 4 }), m = A.compute(st);
    expect(A.status(m, st).h).toBe('bad');
    expect(m.avisos.some(a => /embasamento/.test(a))).toBe(true);
    const ok = base({ hEmbMax: 6 });
    expect(A.status(A.massing(ok), ok).h).toBe('ok');
  });
});

describe('escalonamento x núcleo', () => {
  it('andar recuado que corta o núcleo gera alerta (torre alta no exemplo)', () => {
    const st = estado(A, { forma: { on: true, faixas: [{ ate: 12, af: 2, div: 0 }, { ate: 0, af: 2, div: 5 }] }, produto: { torres: [{ pav: 16 }, { pav: 8 }] } });
    const m = A.compute(st, { layouts: false });
    const t = m.T[0];
    expect(t.faixas.length).toBeGreaterThan(1);
    expect(t.nucleoFora).toBeGreaterThan(1);
    expect(m.avisos.some(a => /corta o núcleo/.test(a))).toBe(true);
  });
});
