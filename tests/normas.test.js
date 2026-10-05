// Item 2.5 — normas automáticas (PRELIMINAR). Cada regra é uma função pura com a fonte citada.
import { describe, it, expect } from 'vitest';
import { carregar, estado } from './harness.js';

const A = carregar();
const R = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

describe('regras isoladas', () => {
  it('tipo de escada pela altura (A-2)', () => {
    expect(A.normaEscadaTipo(9)).toBe('NE');
    expect(A.normaEscadaTipo(12)).toBe('NE');
    expect(A.normaEscadaTipo(20)).toBe('EP');
    expect(A.normaEscadaTipo(30)).toBe('EP');
    expect(A.normaEscadaTipo(67.5)).toBe('PF');
    expect(A.normaEscadaOferecida('ep')).toBe('EP');
    expect(A.normaEscadaOferecida('pf_duto')).toBe('PF');
  });
  it('elevador de emergência só acima de 80 m', () => {
    expect(A.normaElevEmergObrig(67.5)).toBe(false);
    expect(A.normaElevEmergObrig(80)).toBe(false);
    expect(A.normaElevEmergObrig(85)).toBe(true);
  });
  it('população e larguras', () => {
    expect(A.normaDorms({ nome: '2 dorm.', area: 66 })).toBe(2);
    expect(A.normaDorms({ nome: '3 suítes', area: 125 })).toBe(3);
    expect(A.normaDorms({ nome: 'Studio', area: 30 })).toBe(1);
    expect(A.normaDorms({ nome: 'Apto', area: 90 })).toBe(3);
    expect(A.normaPopulacao([{ nome: '2 dorm.', qtd: 2 }, { nome: '3 dorm.', qtd: 2 }])).toBe(20);
    expect(A.normaLarguras(20).escada).toBeCloseTo(1.10, 6);
    expect(A.normaLarguras(100).escada).toBeCloseTo(1.65, 6); // 3 unidades de passagem
    expect(A.normaLarguras(130).acesso).toBeCloseTo(1.65, 6);
  });
  it('distância máxima, vagas especiais e corredor', () => {
    expect(A.normaDistLimite(1, false)).toBe(30);
    expect(A.normaDistLimite(2, false)).toBe(40);
    expect(A.normaDistLimite(1, true)).toBe(45);
    expect(A.normaVagasEsp(73)).toEqual({ pcd: 2, idoso: 4 });
    expect(A.normaVagasEsp(10)).toEqual({ pcd: 1, idoso: 1 });
    expect(A.normaVagasEsp(0)).toEqual({ pcd: 0, idoso: 0 });
    expect(A.normaCorredorMin(8)).toBe(1.2);
    expect(A.normaCorredorMin(25)).toBe(1.5);
  });
  it('todas as tabelas citam a fonte e são preliminares', () => {
    const T = A.NORMAS_TAB;
    expect(T.preliminar).toBe(true);
    for (const k of ['pop', 'escada', 'dist', 'elevEmerg', 'pcd', 'idoso', 'rota', 'corredor', 'adapt']) {
      expect(T[k].fonte.norma, k).toBeTruthy(); expect(T[k].fonte.item, k).toBeTruthy();
    }
    expect(A.NORMAS_AVISO).toMatch(/preliminar/i);
  });
});

describe('caminho real na malha', () => {
  it('distância pelo corredor até a escada', () => {
    // corredor de 20 × 1,6 m; escada na ponta esquerda; duas unidades acima do corredor
    const lay = { ux: [1, 0], vy: [0, 1], corridor: R(0, 0, 20, 1.6),
      coreParts: [{ kind: 'esc', poly: R(-3, 0, 0, 2.7) }],
      units: [{ nome: 'perto', poly: R(0, 1.6, 4, 8) }, { nome: 'longe', poly: R(16, 1.6, 20, 8) }] };
    const r = A.normaDistTipo(lay, 0.25);
    expect(r.pior.nome).toBe('longe');
    // porta no meio da testada (x ≈ 18) → ~18 m pelo corredor (a malha de 8 vizinhos erra para mais, pouco)
    expect(r.max).toBeGreaterThan(17.5); expect(r.max).toBeLessThan(19.5);
    expect(r.semAcesso).toEqual([]);
  });
  it('desvia de obstáculos: o caminho contorna em vez de atravessar', () => {
    // corredor em U: a unidade fica do outro lado de uma parede; o caminho tem de dar a volta
    const lay = { ux: [1, 0], vy: [0, 1], corridor: [[0, 0], [12, 0], [12, 10], [0, 10], [0, 8.4], [10.4, 8.4], [10.4, 1.6], [0, 1.6]],
      coreParts: [{ kind: 'esc', poly: R(-3, 0, 0, 1.6) }], units: [{ nome: 'fundo', poly: R(0, 10, 4, 14) }] };
    const r = A.normaDistTipo(lay, 0.25);
    expect(r.max).toBeGreaterThan(25); // reto seriam ~10 m
  });
  it('unidade sem ligação com o corredor é apontada', () => {
    const lay = { ux: [1, 0], vy: [0, 1], corridor: R(0, 0, 10, 1.6), coreParts: [{ kind: 'esc', poly: R(-3, 0, 0, 2.7) }],
      units: [{ nome: 'ilhada', poly: R(14, 4, 18, 8) }] };
    expect(A.normaDistTipo(lay).semAcesso).toEqual(['ilhada']);
  });
});

describe('estudos', () => {
  it('exemplo com 70 m: escada à prova de fumaça e distância a percorrer dentro do limite', () => {
    const B = carregar();
    const st = estado(B, { regras: { hMax: 80 }, produto: { torres: [{ pav: 22 }] } });
    const m = B.compute(st, { quick: true });
    expect(m.H).toBeCloseTo(70.5, 1);
    const antes = JSON.stringify([m.units, m.vagas, m.CA, m.H, m.priv]);
    const r = B.normasAvaliar(st, m);
    expect(JSON.stringify([m.units, m.vagas, m.CA, m.H, m.priv])).toBe(antes); // só leitura
    const it_ = id => r.itens.find(x => x.id === id);
    expect(r.h).toBeCloseTo(67.5, 1);
    expect(it_('escadaTipo').exigido).toMatch(/PF/);
    expect(it_('escadaTipo').status).toBe('ok');
    const d = Math.max(...r.dists.map(x => x.r.max));
    expect(d).toBeGreaterThan(3);
    expect(d).toBeLessThanOrEqual(30);
    expect(it_('distancia').status).not.toBe('bad');
    expect(it_('elevEmerg').status).toBe('ok'); // não obrigatório até 80 m
    expect(it_('escadas').status).toBe('ok');
    for (const x of r.itens) { expect(['ok', 'warn', 'bad', 'na']).toContain(x.status); expect(x.fonte.norma).toBeTruthy(); expect(x.preliminar).toBe(true) }
  }, 180000);
  it('escada EP não atende acima de 30 m; elevador de emergência acima de 80 m', () => {
    const B = carregar();
    const st = estado(B, { regras: { hMax: 100 }, produto: { torres: [{ pav: 28 }] }, estudo: { escTipo: 'ep' } });
    const m = B.compute(st, { quick: true });
    const r = B.normasAvaliar(st, m), it_ = id => r.itens.find(x => x.id === id);
    expect(r.h).toBeGreaterThan(80);
    expect(it_('escadaTipo').status).toBe('bad');
    expect(it_('elevEmerg').status).toBe('bad');
  }, 180000);
  it('exemplo padrão: rota acessível do acesso de pedestres ao hall; corredor estreito não atende', () => {
    const B = carregar(); const st = estado(B, {}); const m = B.compute(st, { quick: true });
    const rt = B.normaRotaTerreo(st, m);
    expect(rt.ok).toBe(true);
    expect(rt.torres.every(t => t.dist > 0)).toBe(true);
    const st2 = estado(B, { estudo: { corrTipo: 1.0 } }); const m2 = B.compute(st2, { quick: true });
    expect(B.normasAvaliar(st2, m2).itens.find(x => x.id === 'corredor').status).toBe('bad');
  }, 180000);
});
