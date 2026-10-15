// Checklist "O que falta para o estudo ficar confiável" e próximo passo (UX v3 §3.3/§6.3): puros, sem DOM.
import { describe, it, expect } from 'vitest';
import { carregar, estado, cenarios } from './harness.js';

const ETAPAS = ['terreno', 'produto', 'viab', 'projeto', 'cen'];

describe('progressoItens', () => {
  const A = carregar();
  it('9 itens fixos, cada um com etapa do fluxo novo', () => {
    const st = estado(A, {}), m = A.compute(st), f = A.finance(st, m);
    const it = A.progressoItens(st, m, f);
    expect(it.map(i => i.k).join()).toBe('lote,ruas,regras,produto,vagas,preco,custo,garagem,normas');
    it.forEach(i => { expect(ETAPAS).toContain(i.etapa); expect(typeof i.nome).toBe('string'); expect(typeof i.dica).toBe('string') });
    const k = Object.fromEntries(it.map(i => [i.k, i.ok]));
    expect(k.lote).toBe(false);          // o exemplo não conta como lote informado
    expect(k.ruas).toBe(false);
    expect(k.regras).toBe(false);        // sem cidade e sem conferir
    expect(k.preco).toBe(false); expect(k.custo).toBe(false);
    expect(typeof k.produto).toBe('boolean'); expect(typeof k.vagas).toBe('boolean');
  });
  it('sem modelo: os itens que dependem do cálculo ficam null (não contam como feitos)', () => {
    const st = estado(A, {}), it = A.progressoItens(st);
    expect(it.find(i => i.k === 'produto').ok).toBe(null);
    expect(it.find(i => i.k === 'vagas').ok).toBe(null);
    expect(it.find(i => i.k === 'normas').ok).toBe(null);
    const r = A.progressoResumo(st);
    expect(r.total).toBe(9); expect(r.nivel).toBe('rascunho'); expect(r.pendentes.length).toBe(9 - r.feitos);
  });
  it('flags de S.guia.conf, regrasRef e lote posicionado marcam os itens', () => {
    const st = estado(A, { nome: 'Meu', lote: { pts: [[0, 0], [30, 0], [30, 50], [0, 50]], front: [0], rec: [{}, {}, {}, {}] }, guia: { conf: { regras: false, preco: true, custo: true } } });
    st.guia = { conf: { regras: false, preco: true, custo: true } };
    A.cidadeAplicar(st, 'sc-criciuma-central');
    const m = A.compute(st), f = A.finance(st, m), it = A.progressoItens(st, m, f), k = Object.fromEntries(it.map(i => [i.k, i.ok]));
    expect(k.lote).toBe(true); expect(k.ruas).toBe(true); expect(k.regras).toBe(true); expect(k.preco).toBe(true); expect(k.custo).toBe(true);
    const r = A.progressoResumo(st, m, f);
    expect(r.feitos).toBeGreaterThanOrEqual(5); expect(['em andamento', 'confiável']).toContain(r.nivel);
    expect(r.pct).toBeCloseTo(r.feitos / 9, 9);
  });
  it('produto fora das regras e vagas faltando aparecem na dica', () => {
    const st = estado(A, { produto: { torres: [{ pav: 40 }, { pav: 8 }], subsolos: 0, garAcima: 0, garTerOn: false } });
    const m = A.compute(st, { quick: true }), it = A.progressoItens(st, m);
    const p = it.find(i => i.k === 'produto'), v = it.find(i => i.k === 'vagas');
    expect(p.ok).toBe(false); expect(p.dica).toMatch(/altura/);
    expect(v.ok).toBe(false); expect(v.dica).toMatch(/faltam/);
  });
  it('garagem: vagas estimadas (usarLayout desligado) ficam pendentes', () => {
    const st = estado(A, { estudo: { usarLayout: false } }), m = A.compute(st, { quick: true });
    expect(A.progressoItens(st, m).find(i => i.k === 'garagem').ok).toBe(false);
  });
});

describe('proximoPasso', () => {
  const A = carregar();
  const st = estado(A, {}), m = A.compute(st), f = A.finance(st, m);
  it('nunca vazio, em todas as etapas e sub-abas (inclusive os nomes antigos)', () => {
    const casos = [['terreno'], ['regras'], ['produto'], ['viab', 'res'], ['viab', 'prem'], ['viab', 'risco'], ['viab', 'vendas'], ['projeto', 'gar'], ['projeto', 'tipo'], ['projeto', 'andar'],
      ['projeto', 'sol'], ['projeto', 'vento'], ['clima', 'sol'], ['clima', 'v3d'], ['cen'], ['xyz']];
    for (const [t, s] of casos) {
      const p = A.proximoPasso(st, m, f, t, s);
      expect(p.rotulo, t + '/' + s).toBeTruthy(); expect(ETAPAS).toContain(p.etapa);
      expect(p.dica.length).toBeGreaterThan(0); expect(p.dica.length).toBeLessThanOrEqual(60);
    }
    expect(A.proximoPasso(st, null, null, 'terreno').rotulo).toBeTruthy();   // sem cálculo também
  });
  it('resolve a pendência da etapa antes de avançar', () => {
    const t = A.proximoPasso(st, m, f, 'terreno');
    expect(t.rotulo).toBe('Desenhar o lote'); expect(t.etapa).toBe('terreno'); expect(t.sec).toBe('contorno');
    const v = A.proximoPasso(st, m, f, 'viab', 'res');
    expect(v.act).toBeUndefined(); expect(v.rotulo).toMatch(/Conferir o preço/); expect(v.campo).toBe('produto.mix.0.preco'); expect(v.sec).toBe('essencial');   // leva ao campo: nada de confirmar à distância
    const ok = estado(A, { nome: 'X', lote: { pts: [[0, 0], [34, 0], [36, 52], [-1.5, 55]] } });
    ok.guia = { conf: { regras: true, preco: true, custo: true } };
    const m2 = A.compute(ok), f2 = A.finance(ok, m2);
    expect(A.proximoPasso(ok, m2, f2, 'terreno').rotulo).toMatch(/produto/i);
    expect(A.proximoPasso(ok, m2, f2, 'viab', 'res').rotulo).toMatch(/projeto/i);
    expect(A.proximoPasso(ok, m2, f2, 'cen').act).toBe('progPdf');
    expect(A.proximoPasso(ok, m2, f2, 'projeto', 'sol').sub).toBe('vento');
  });
  it('vagas faltando → adicionar subsolo', () => {
    const s2 = estado(A, { nome: 'X', produto: { subsolos: 0, garAcima: 0, garTerOn: false, torres: [{ pav: 12 }, { pav: 8 }] }, lote: { pts: [[0, 0], [34, 0], [36, 52], [-1.5, 55]] } });
    s2.regrasRef.id = 'x';
    const m2 = A.compute(s2, { quick: true }), p = A.proximoPasso(s2, m2, null, 'produto');
    const it = A.progressoItens(s2, m2), pOk = it.find(i => i.k === 'produto').ok, vOk = it.find(i => i.k === 'vagas').ok;
    expect(vOk).toBe(false);
    if (pOk === true) expect(p.act).toBe('progSubsolo');
    expect(p.rotulo).toBeTruthy();
  });
});

describe('estudos de referência não mudam com o checklist', () => {
  it('compute/finance ignoram S.guia', () => {
    const A = carregar();
    for (const c of cenarios()) {
      const st = estado(A, c.S), m = A.compute(st), f = A.finance(st, m);
      const st2 = estado(A, c.S); st2.guia = { conf: { regras: true, preco: true, custo: true } };
      const m2 = A.compute(st2), f2 = A.finance(st2, m2);
      expect(f2.lucro).toBe(f.lucro); expect(m2.units).toBe(m.units);
      A.progressoItens(st, m, f); A.proximoPasso(st, m, f, 'viab', 'res');
    }
  }, 120000);
});
