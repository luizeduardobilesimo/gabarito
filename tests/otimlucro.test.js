// UX v3 P3 — o otimizador não gera estudo com prejuízo quando existe alternativa lucrativa (pedido do Luiz).
// Caso real: assistente com lote 20 × 40 m, "Criciúma — Zona central" da biblioteca, padrão "Família" a R$ 12.000/m², terreno estimado
// em 12% do VGV → antes: 1 torre × 14 andares, 2 un/andar, 3 subsolos + 1 elevada, eficiência 36%, lucro −R$ 3,0 mi.
// Causa: vagas estimadas por área ÷ 28 m² (a garagem real desse lote rende metade), conferência que alternava subsolo/elevada até a
// torre deixar de caber, alturas só perto do máximo e terreno fora da conta durante a busca. Ver src/optim.js.
import { describe, it, expect } from 'vitest';
import { carregar } from './harness.js';

const A = carregar();
const assSt = (frente, fundo, preco, padrao = 'familia') => {
  const cid = A.cidadesLista().find(c => /Crici/.test(c.cidade));
  return A.assEstado(A.clone(A.DEF), { nome: 'T', lote: { modo: 'ret', frente, fundo }, regras: { id: cid.id }, produto: { padrao, preco: String(preco), terreno: '' } });
};
const OPTS = st => ({ ...A.clone(st.otim), obj: 'lucro', torres: true, tipologias: false, unidades: true, mc: false, terrenoPct: 0.12 });
/** aplica a opção como o assistente (terreno = 12% do VGV) e recalcula com o layout completo */
const aplica = (st, r) => { const s2 = A.clone(st); A.aplicarOtim(r, s2); s2.fin.terreno = A.assTerrenoEstimado(r.vgv); const m = A.compute(s2); return { s2, m, f: A.finance(s2, m) } };

describe('otimizador: lucro antes de tudo', () => {
  it('20 × 40 em Criciúma, Família a R$ 12.000: acha a combinação com lucro (antes: −R$ 3,0 mi) e ela se reproduz', async () => {
    const st = assSt(20, 40, 12000);
    const r = await A.otimizar(OPTS(st), null, null, { st, m: {} });
    expect(r.res.length).toBeGreaterThan(0);
    const b = r.res[0];
    expect(b.lucro).toBeGreaterThan(0);
    expect(b.semLucro).toBeFalsy(); expect(r.semLucro).toBeUndefined();
    expect(b.efic).toBeGreaterThan(0.4);                         // antes 36%
    expect(r.terrenoPct).toBe(0.12); expect(b.terreno).toBe(A.assTerrenoEstimado(b.vgv));
    // ordem: nível (lucro > 0 / meta) e depois o objetivo
    for (let i = 1; i < r.res.length; i++) { const p = r.res[i - 1], q = r.res[i]; expect(p.nivel > q.nivel || (p.nivel === q.nivel && p.sc >= q.sc)).toBe(true) }
    // margem abaixo da meta de 25%: diz o preço que chega lá, e o preço é coerente (finance com dp)
    expect(r.fecha && r.fecha.precoMeta).toBeGreaterThan(r.fecha.precoAtual);
    const { s2, m, f } = aplica(st, b);
    expect(f.lucro).toBeGreaterThan(0);
    expect(Math.abs(m.vagas - b.vagas)).toBeLessThanOrEqual(Math.max(3, b.vagas * 0.25));   // a conferência é rápida (quick); o layout completo acha algumas a mais
    expect(m.vagas).toBeGreaterThanOrEqual(m.vagasReq);
    expect(s2.produto.torres[0].pav).toBe(b.pav);
  }, 240000);

  it('sem nenhuma combinação lucrativa: devolve a menos ruim marcada semLucro, com motivo e o preço que fecha a conta', async () => {
    const st = assSt(20, 40, 8000);
    const r = await A.otimizar(OPTS(st), null, null, { st, m: {} });
    expect(r.res.length).toBeGreaterThan(0);
    expect(r.res.every(x => !(x.lucro > 0))).toBe(true);
    expect(r.res[0].semLucro).toBe(true);
    const sl = r.semLucro;
    expect(sl && typeof sl.motivo).toBe('string'); expect(['preco', 'efic', 'terreno', 'custo']).toContain(sl.k);
    expect(sl.precoZero).toBeGreaterThan(sl.precoAtual); expect(sl.precoMeta).toBeGreaterThan(sl.precoZero);
    // o preço para margem 0 é o menor entre as opções; aplicado à opção indicada, a margem fica em ~0
    const q = sl.opcaoZero || 0, o = r.res[q], s2 = A.clone(st); A.aplicarOtim(o, s2);
    const m = A.compute(s2, { quick: true }), dp = sl.precoZero / A.basePrice(s2) - 1;
    const s3 = { ...s2, fin: { ...s2.fin } }; s3.fin.terreno = Math.round(0.12 * A.finance(s3, m, { noHooks: true, dp }).vgv / 1e4) * 1e4;
    expect(Math.abs(A.finance(s3, m, { noHooks: true, dp }).margemVGV)).toBeLessThan(0.005);
    const txt = A.otimFechaTxt(sl, true);
    expect(txt).toMatch(/^Nenhuma combinação dá lucro — /); expect(txt).toMatch(/R\$ [\d.]+\/m²/);
  }, 240000);

  it('lote pequeno demais para as vagas exigidas: nenhuma opção, com o motivo', async () => {
    const st = assSt(12, 30, 12000);
    const r = await A.otimizar(OPTS(st), null, null, { st, m: {} });
    expect(r.res).toEqual([]);
    expect(r.semOpcao && ['lote', 'vagas']).toContain(r.semOpcao.k);
    expect(r.semOpcao.motivo.length).toBeGreaterThan(10);
  }, 240000);

  it('calibração das vagas por tipo de pavimento (subsolo, elevada, térreo) a partir de um layout', () => {
    const st = A.clone(A.DEF), mv = st.regras.m2Vaga;
    const m = { subA: 28 * 20, embA: 28 * 10, gTer: 28 * 5, vf: { count: 3 }, gar: { s1: { count: 8 }, s2: { count: 12 }, g1: { count: 4 }, ter: { count: 5 } } };
    const c = A.otimVagasCal(st, m);
    expect(c.s).toBeCloseTo(20 / 40, 9); expect(c.g).toBeCloseTo(4 / 10, 9); expect(c.t).toBeCloseTo(1, 9); expect(c.vf).toBe(3);
    // sem elevada no layout: 0,8 × subsolo; sem layout: null (o otimizador calcula um)
    const c2 = A.otimVagasCal(st, { ...m, gar: { s1: { count: 10 } } });
    expect(c2.g).toBeCloseTo(0.8 * c2.s, 9); expect(c2.t).toBeCloseTo(c2.s, 9);
    expect(A.otimVagasCal(st, {})).toBeNull();
    const ms = { subA: 28 * 20, embA: 28 * 10, gTer: 0 }, s2 = A.clone(st); s2.produto.subsolos = 2; s2.produto.garAcima = 1;
    expect(A.otimVagasEst(ms, s2, c)).toBe(3 + Math.floor(2 * 20 * c.s + 10 * c.g));
    expect(mv).toBe(28);
  });

  it('nível da ordem: meta antes de lucro, lucro antes de prejuízo', () => {
    const L = [{ lucro: -1, margem: -0.1, sc: 9 }, { lucro: 5, margem: 0.1, sc: 5 }, { lucro: 3, margem: 0.3, sc: 3 }].map(x => ({ ...x, nivel: A.otimNivel(x, 0.25) }));
    expect(L.map(x => x.nivel)).toEqual([0, 1, 2]);
    expect(L.slice().sort(A.otimMelhor).map(x => x.lucro)).toEqual([3, 5, -1]);
  });
});
