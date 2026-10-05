// 2.2 — malha estrutural coordenada: pilares da torre × garagem, transições e malhas candidatas.
import { describe, it, expect } from 'vitest';
import { carregar, estado } from './harness.js';

const A = carregar();
const st = estado(A, { estrutura: { on: true } });
const m = A.compute(st);
const e = m.estr;
const pilaresDiretos = () => e.torres.flatMap(t => t.pts.filter(p => p.st === 'direto'));
// pilar "dentro" de uma vaga = sobreposição real (5 mm de folga para encostos)
const dentro = (pil, vaga) => A.G.polysOverlap(A.G.scaleToArea(pil, Math.pow(Math.sqrt(A.G.area(pil)) - 0.01, 2)), vaga);

describe('malha estrutural — padrão', () => {
  it('desligada por padrão: nada muda no modelo', () => {
    const m0 = A.compute(estado(A, {}));
    expect(A.DEF.estrutura.on).toBe(false);
    expect(m0.estr).toBeUndefined();
    expect((m0.custosExtra || []).some(x => x.sistema === 'estrutura')).toBe(false);
  });
});

describe('malha estrutural — estudo de exemplo', () => {
  it('gera pilares nas paredes de cada torre', () => {
    expect(e.nPil).toBeGreaterThan(20);
    e.torres.forEach(t => expect(t.pts.length).toBeGreaterThan(8));
    // todo pilar dentro da laje da torre
    e.torres.forEach(tw => tw.pts.forEach(p => p.poly.forEach(q => expect(A.G.pip(q, m.T[tw.i].plate)).toBe(true))));
  });
  it('nenhuma vaga com pilar dentro (pilares da garagem e pilares contínuos da torre)', () => {
    let n = 0;
    for (const [, l] of Object.entries(m.gar)) {
      const vagas = l.vagas.filter(v => v.tipo !== 'off');
      const pil = [...l.pillars, ...pilaresDiretos().map(p => p.poly)];
      pil.forEach(p => vagas.forEach(v => { if (dentro(p, v.poly)) n++ }));
    }
    expect(n).toBe(0);
  });
  it('transição = pilar que cai em vaga/corredor/rampa/acesso; contínuo não conflita em nenhum pavimento', () => {
    const pisos = A.estrPisos(st, m), h = e.sec / 2;
    e.torres.flatMap(t => t.pts).forEach(p => {
      const q = A.G.scaleToArea(p.poly, Math.pow(e.sec - 0.01, 2));
      const conf = pisos.map(pi => A.estrConflito(pi, q, p.c, h, m.obst)).filter(Boolean);
      if (p.st === 'direto') expect(conf).toEqual([]);
      else { expect(p.conf.length).toBeGreaterThan(0); expect(p.kT).toBeTruthy(); expect(p.vao).toBeGreaterThanOrEqual(3) }
    });
  });
  it('nº e custo das transições publicados (custo no orçamento só com a opção ligada)', () => {
    const trans = e.torres.flatMap(t => t.pts).filter(p => p.st === 'transicao');
    expect(e.nTrans).toBe(trans.length);
    expect(e.custo).toBeCloseTo(trans.reduce((s, p) => s + p.custo, 0), 6);
    if (e.nTrans) {
      const x = m.custosExtra.find(c => c.k === 'estr-transicao');
      expect(x).toMatchObject({ sistema: 'estrutura' });
      expect(x.valor).toBeCloseTo(e.custo, 6);
      expect(m.avisos.some(a => /transição/.test(a))).toBe(true);
      const sem = A.compute(estado(A, { estrutura: { on: true, custo: false } }));
      expect(sem.custosExtra.some(c => c.k === 'estr-transicao')).toBe(false);
      expect(sem.estr.nTrans).toBe(e.nTrans);
      const f1 = A.finance(st, m), f0 = A.finance(estado(A, { estrutura: { on: true, custo: false } }), sem);
      expect(f1.lucro).toBeLessThan(f0.lucro);
    }
  });
  it('casada com a garagem não tem mais transições que a malha sem coordenação', () => {
    const p = A.estrCalc(st, m, { malha: 'paredes' });
    expect(e.nTrans).toBeLessThanOrEqual(p.nTrans);
    expect(p.nDesloc).toBe(0);
  });
  it('vigas de transição: custo = vão × R$/m × (0,5 + pav/20)', () => {
    e.torres.forEach(tw => tw.pts.filter(p => p.st === 'transicao').forEach(p =>
      expect(p.custo).toBeCloseTo(p.vao * st.estrutura.custoM * (0.5 + m.T[tw.i].pav / 20), 6)));
  });
});

describe('malhas candidatas (para o otimizador)', () => {
  it('estruturaMalhas devolve 2 (rápido) ou 3 malhas com nº e custo de transições', () => {
    const r2 = A.estruturaMalhas(st, m, { alt: false });
    expect(r2.map(x => x.id)).toEqual(['casada', 'paredes']);
    const r3 = A.estruturaMalhas(st, m);
    expect(r3.length).toBe(3);
    expect(r3[2].porModulo).toBe(2);
    expect(r3[2].passo).toBeCloseTo(2 * st.estudo.vagaL + st.estudo.pilar, 6);
    r3.forEach(x => { expect(x.nTrans).toBeGreaterThanOrEqual(0); expect(typeof x.custo).toBe('number'); expect(x.vagas).toBeGreaterThan(0) });
  }, 60000);
});
