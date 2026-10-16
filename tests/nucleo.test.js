// Núcleo de circulação vertical (src/calc/nucleo.js + layout.js coreBuild): partidos reais, validação com nota, contrato §0.
import { describe, it, expect } from 'vitest';
import { carregar, estado } from './harness.js';

const A = carregar();
const st0 = estado(A, {});
const nuc = (o) => A.coreBuild([1, 0], [0, 1], 0, 0, 1, 2.7, { corr: 1.6, _st: st0, ...o }).nucleo;
const clone = (x) => JSON.parse(JSON.stringify(x));
const ctxT = { pav: 12, H: 40.5, pop: 20, corr: 1.6, fachada: true };
const graves = (v) => v.problemas.filter((q) => q.nivel === 'bad').map((q) => q.msg);

describe('catálogo de partidos', () => {
  it('tem os partidos de mercado, com nome e quando usar', () => {
    const c = A.nucleoCatalogo();
    expect(c.length).toBeGreaterThanOrEqual(8);
    ['linear', 'linear-curto', 'u', 'l', 'pressurizada', 'balcao', 'duas', 'emergencia', 'baixo'].forEach((id) => expect(c.some((p) => p.id === id)).toBe(true));
    c.forEach((p) => { expect(p.nome).toBeTruthy(); expect(p.quando).toBeTruthy() });
  });
  it('degraus pela altura de piso a piso (Blondel 63–65)', () => {
    [2.88, 3.0, 3.06, 3.2].forEach((pe) => { const d = A.nucleoDegraus(pe); expect(d.e).toBeLessThanOrEqual(0.18 + 1e-9); expect(d.e).toBeGreaterThanOrEqual(0.16); expect(2 * d.e + d.p).toBeGreaterThanOrEqual(0.625); expect(2 * d.e + d.p).toBeLessThanOrEqual(0.655) });
  });
});

describe('partidos válidos nos tamanhos típicos', () => {
  const casos = [
    ['linear', { escTipo: 'pf_duto', nElev: 2 }],
    ['linear-curto', { escTipo: 'pf_duto', nElev: 1 }],
    ['u', { escTipo: 'pf_duto', nElev: 3 }],
    ['u', { escTipo: 'pf_duto', nElev: 4 }],
    ['pressurizada', { escTipo: 'pf_press', nElev: 2 }],
    ['balcao', { escTipo: 'pf_balcao', nElev: 2 }],
    ['duas', { escTipo: 'pf_duto', nElev: 2, nEsc: 2 }],
    ['emergencia', { escTipo: 'pf_duto', nElev: 2, emerg: true }],
    ['emergencia', { escTipo: 'pf_duto', nElev: 4, emerg: true }],
    ['baixo', { escTipo: 'ep', nElev: 1 }],
  ];
  casos.forEach(([id, o]) => it(`${id} (${JSON.stringify(o)})`, () => {
    const n = nuc(o);
    expect(n.partido).toBe(id);
    const ctx = id === 'baixo' ? { pav: 4, H: 16.5, pop: 20, corr: 1.6, fachada: true } : { ...ctxT, pav: o.nElev >= 4 ? 24 : 12, H: o.nElev >= 4 ? 76 : 40.5 };
    const v = A.nucleoValida(n, ctx);
    expect(graves(v)).toEqual([]);
    expect(v.nota).toBeGreaterThanOrEqual(85);
    // medidas reais: escada 1,20 m útil, antecâmara ≥ 1,80, caixas de elevador do catálogo
    expect(n.dim.escLarg).toBeGreaterThanOrEqual(1.2);
    expect(n.dim.patamar).toBeGreaterThanOrEqual(1.2);
    if (n.dim.ant && /pf/.test(o.escTipo) && id !== 'balcao') expect(Math.min(...n.dim.ant)).toBeGreaterThanOrEqual(1.8);
    // portas no contrato: todas na face do corredor, apontando para fora
    expect(n.portas.length).toBeGreaterThan(0);
    n.portas.forEach((p) => { expect(Math.abs(p.p[1])).toBeLessThan(1e-6); expect(p.dir[1]).toBeLessThan(0) });
    expect(n.prumadas.some((p) => p.k === 'escada')).toBe(true);
  }));
  it('núcleo é um retângulo sem sobreposição e sem sobra (linear)', () => {
    const n = nuc({ escTipo: 'pf_duto', nElev: 2 }), L = n.local;
    const soma = L.cells.reduce((s, c) => s + c.w * c.h, 0);
    expect(Math.abs(soma - L.L * L.D)).toBeLessThan(0.05);
    expect(A.nucleoHarmonia(L)).toEqual([]);
  });
  it('elevadores pelo tráfego: 4 pavimentos → 1, 12 → 2, 28 → 3 ou mais', () => {
    expect(A.nucleoElevNec({ pav: 4, H: 16.5, pop: 20 }).n).toBe(1);
    expect(A.nucleoElevNec({ pav: 12, H: 40.5, pop: 20 }).n).toBe(2);
    expect(A.nucleoElevNec({ pav: 28, H: 88.5, pop: 20 }).n).toBeGreaterThanOrEqual(3);
  });
});

describe('casos ruins são detectados', () => {
  const base = () => clone(nuc({ escTipo: 'pf_duto', nElev: 2 }));
  const ks = (n, ctx = ctxT) => A.nucleoValida(n, ctx).problemas.map((q) => q.k);
  it('escada estreita', () => { const n = base(); const e = n.local.cells.find((c) => c.k === 'esc'); e.h = 2.3; n.local.p.larg = 1.0; expect(ks(n)).toContain('escLarg') });
  it('antecâmara rasa', () => { const n = base(); n.local.cells.find((c) => c.k === 'ant').h = 1.8; expect(ks(n)).toContain('antRasa') });
  it('porta de elevador na antecâmara', () => {
    const n = base(), a = n.local.cells.find((c) => c.k === 'ant');
    n.local.doors.push({ a: [a.u + a.w, 0.6], b: [a.u + a.w, 1.4], n: [-1, 0], tipo: 'elev', sw: 0, larg: 0.8 });
    expect(ks(n)).toContain('elevAnt');
  });
  it('hall diante dos elevadores menor que 1,50 m', () => { expect(ks(base(), { ...ctxT, corr: 1.2 })).toContain('hallElev') });
  it('escada PF sem dutos', () => { const n = base(); n.local.cells = n.local.cells.filter((c) => c.k !== 'duto'); expect(ks(n)).toContain('semDuto') });
  it('elevadores insuficientes', () => { const n = clone(nuc({ escTipo: 'pf_duto', nElev: 1 })); expect(ks(n, { ...ctxT, pav: 20, H: 64.5, pop: 40 })).toContain('elevN') });
  it('elevador de emergência obrigatório', () => { expect(ks(base(), { ...ctxT, emergObrig: true })).toContain('emerg') });
  it('núcleo desalinhado / serrilhado', () => {
    const n = base(), e = n.local.cells.find((c) => c.k === 'esc'); e.w -= 0.6; n.local.perfil = null;
    const k = ks(n); expect(k).toContain('desalinhado'); expect(k).toContain('buraco');
  });
  it('peça sem porta', () => { const n = base(); const lx = n.local.cells.find((c) => c.k === 'lixo'); n.local.doors = n.local.doors.filter((d) => !(d.tipo === 'servico' && Math.abs(d.a[1] - lx.v) < 0.01)); expect(ks(n)).toContain('semAcesso') });
});

describe('no estudo', () => {
  const m = A.compute(st0);
  it('exemplo: partido linear, nota ≥ 85 sem problema grave, mesmo núcleo em tipo, térreo e garagens', () => {
    m.tipo.forEach((l, i) => {
      expect(l.nucleo.partido).toBe('linear');
      expect(l.nucleo.nota).toBeGreaterThanOrEqual(85);
      expect(l.nucleo.problemas.filter((q) => q.nivel === 'bad')).toEqual([]);
      const cs = m.coreSets.find((c) => c.i === i);
      expect(cs.core).toBe(l.core); expect(cs.lobby).toBe(l.lobby);
      expect(l.coreA).toBeLessThan(50);   // núcleo compacto (antes ~56 m², com sobras)
      expect(l.nucleo.hallElev).toBe(l.lobby);
    });
  });
  it('o hall dos elevadores é um retângulo ≥ 1,50 m diante de todas as portas', () => {
    const l = m.tipo[0], [a, b] = A.G.extent(l.lobby, l.vy);
    expect(l.lobby.length).toBe(4); expect(b - a).toBeGreaterThanOrEqual(1.5);
    l.nucleo.portas.forEach((p) => { const q = [p.p[0] + p.dir[0] * 0.5, p.p[1] + p.dir[1] * 0.5]; expect(A.G.pip(q, l.lobby)).toBe(true) });
  });
  it('partido fixado pelo usuário vale', () => {
    const m2 = A.compute(estado(A, { nucleo: { partido: 'u' } }));
    expect(m2.tipo[0].nucleo.partido).toBe('u');
  });
});
