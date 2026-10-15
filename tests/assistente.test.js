// Assistente "Novo estudo" (UX v3 §3.1/§3.2): assEstado puro, exemplo, números digitados e o caminho do otimizador.
import { describe, it, expect } from 'vitest';
import { carregar, estado } from './harness.js';

const J = o => JSON.stringify(o);
const RESP = {
  nome: 'Rua das Palmeiras, 300',
  lote: { modo: 'ret', frente: 20, fundo: 40 },
  regras: { id: 'sc-criciuma-central' },
  produto: { padrao: 'familia', preco: '12.000', terreno: '' },
};

describe('assistente: assEstado', () => {
  const A = carregar();
  it('lote 20 × 40, regras da cidade, mix do padrão com o preço médio', () => {
    const base = A.clone(A.DEF), antes = J(base);
    const st = A.assEstado(base, RESP);
    expect(J(base)).toBe(antes);                                   // não muda a base
    expect(st.nome).toBe('Rua das Palmeiras, 300');
    expect(A.G.area(st.lote.pts)).toBeCloseTo(800, 6);
    expect(A.G.sArea(st.lote.pts)).toBeGreaterThan(0);              // anti-horário, como normalizeLote
    expect(J(st.lote.front)).toBe('[0]'); expect(st.lote.principal).toBe(0); expect(st.lote.rec.length).toBe(4);
    expect(st.lote.geo).toBe(false);
    expect(st.regras.cidade).toMatch(/Criciúma/); expect(st.regrasRef.id).toBe('sc-criciuma-central');
    expect(st.regras.caMax).toBe(4); expect(st.regras.hMax).toBe(60);
    const fam = A.MIX_PRESETS.familia.tips;
    expect(st.produto.mix.map(u => u.nome).sort().join()).toBe(fam.map(t => t.nome).sort().join());
    st.produto.mix.forEach(u => { const t = fam.find(x => x.nome === u.nome); expect(u.preco).toBe(Math.round(12000 * t.pf / 50) * 50); expect(u.area).toBe(t.area) });
    expect(st.produto.torres.length).toBe(1);
    expect(st.fin.terreno).toBe(0);                                  // sem preço: a tela estima depois do otimizador
    expect(st.guia.conf.preco).toBe(true); expect(st.guia.conf.custo).toBe(false); expect(st.guia.conf.regras).toBe(false);
    expect(A.assEhExemplo(st)).toBe(false);
  });
  it('números editados valem por cima da cidade; "Outra" com nome marca as regras como conferidas', () => {
    const st = A.assEstado(A.DEF, { regras: { id: 'sc-criciuma-central', caMax: '3,5', hMax: 45, toTorre: 40, recFrente: 5 } });
    expect(st.regras.caMax).toBe(3.5); expect(st.regras.hMax).toBe(45); expect(st.regras.toTorre).toBeCloseTo(0.4, 9); expect(st.regras.recFrente).toBe(5);
    expect(st.regras.caBas).toBeLessThanOrEqual(st.regras.caMax);
    const o = A.assEstado(A.DEF, { regras: { id: '', nome: 'Tubarão — ZR2', caMax: 2.5 } });
    expect(o.regras.cidade).toBe('Tubarão — ZR2'); expect(o.regrasRef.id).toBe(''); expect(o.guia.conf.regras).toBe(true);
    const n = A.assEstado(A.DEF, {});
    expect(J(n.regras)).toBe(J(A.DEF.regras)); expect(n.guia.conf.regras).toBe(false);
    expect(n.nome).toBe('Novo estudo');
  });
  it('preço do terreno informado marca o custo; padrões e sugestão de preço', () => {
    const st = A.assEstado(A.DEF, { produto: { padrao: 'alto', preco: '', terreno: 'R$ 5.000.000' } });
    expect(st.fin.terreno).toBe(5000000); expect(st.guia.conf.custo).toBe(true); expect(st.guia.conf.preco).toBe(false);
    const sug = A.assPrecoSugerido(st, 'alto');
    expect(sug % 500).toBe(0); expect(sug).toBeGreaterThan(A.assPrecoSugerido(st, 'familia'));
    expect(st.produto.mix.every(u => /suítes/.test(u.nome))).toBe(true);
    expect(st.produto.cob.on).toBe(true);
    const c = A.assEstado(A.DEF, { produto: { padrao: 'compacto', preco: 13000 } });
    expect(c.produto.cob.on).toBe(false); expect(c.produto.mix.some(u => u.nome === 'Studio')).toBe(true);
  });
  it('coordenadas viram lote posicionado; mapa e "desenhar depois" ficam com o lote provisório', () => {
    const txt = '-28.6775, -49.3697\n-28.6775, -49.3693\n-28.6779, -49.3693\n-28.6779, -49.3697';
    const st = A.assEstado(A.DEF, { lote: { modo: 'coord', texto: txt } });
    expect(st.lote.geo).toBe(true); expect(st.lote.lat).toBeCloseTo(-28.6777, 4);
    expect(A.G.area(st.lote.pts)).toBeGreaterThan(1000);
    expect(A.assLoteCoords('1, 2').erro).toBeTruthy();
    expect(A.assLoteCoords('').erro).toBeTruthy();
    for (const modo of ['mapa', 'depois']) { const p = A.assEstado(A.DEF, { lote: { modo } }); expect(J(p.lote.pts)).toBe(J(A.DEF.lote.pts)); expect(p.lote.geo).toBe(false) }
  });
  it('assNum: formatos brasileiros', () => {
    expect(A.assNum('12.000')).toBe(12000); expect(A.assNum('R$ 5.000.000')).toBe(5000000); expect(A.assNum('12,5')).toBe(12.5);
    expect(A.assNum('12000')).toBe(12000); expect(A.assNum('')).toBe(null); expect(A.assNum(null)).toBe(null); expect(A.assNum(7)).toBe(7);
    expect(A.assTerrenoEstimado(100e6)).toBe(12e6);
  });
});

describe('assistente: exemplo', () => {
  const A = carregar();
  it('o padrão é o exemplo; renomear ou mudar o lote deixa de ser', () => {
    expect(A.assEhExemplo(estado(A, {}))).toBe(true);
    expect(A.assEhExemplo(A.S)).toBe(true);
    expect(A.assEhExemplo(estado(A, { nome: 'Meu estudo' }))).toBe(false);
    expect(A.assEhExemplo(estado(A, { lote: { pts: [[0, 0], [20, 0], [20, 40], [0, 40]] } }))).toBe(false);
  });
});

describe('assistente: do estado ao resultado (otimizador + viabilidade)', () => {
  it('20 × 40, Criciúma, Família a R$ 12.000 → combinação válida e lucro calculado', async () => {
    const A = carregar();
    const st = A.assEstado(A.DEF, RESP);
    const r = await A.otimizar({ ...A.clone(st.otim), obj: 'lucro', tipologias: false, mc: false }, null, null, { st, m: {} });
    expect(r.res.length).toBeGreaterThan(0);
    const best = r.res[0], fin = A.clone(st);
    A.aplicarOtim(best, fin);
    fin.fin.terreno = A.assTerrenoEstimado(best.vgv);
    const m = A.compute(fin), f = A.finance(fin, m);
    expect(m.CA).toBeLessThanOrEqual(fin.regras.caMax + 1e-6); expect(m.H).toBeLessThanOrEqual(fin.regras.hMax + 1e-6);
    expect(m.vagas).toBeGreaterThanOrEqual(m.vagasReq);
    expect(isFinite(f.lucro)).toBe(true); expect(f.vgv).toBeGreaterThan(0);
    expect(fin.fin.terreno).toBeGreaterThan(0);
  }, 60000);
});
