// Eficiência real da planta: nas torres desenhadas (C1/C2/C3) e no contorno ocupado (C0) a privativa vendável deixa de ser
// área do andar × eficiência informada e passa a ser a soma das unidades desenhadas no pavimento tipo (blcPrivReal, src/calc/blocos.js).
import { describe, it, expect } from 'vitest';
import { carregar, estado } from './harness.js';

const A = carregar();
const RET = [[8, 12], [22, 12], [22, 40], [8, 40]];                       // 14 × 28 = 392 m²
/** estudo exemplo com UMA torre (12 pavimentos) desenhada com um formato pronto */
const exemplo = (formato) => {
  const st = estado(A, {}); st.produto.torres = [{ pav: 12 }];
  if (formato) { A.blcPersonaliza(st, 0); if (formato !== 'pers') A.blcAplicaFormato(st, 0, formato) }
  return st;
};
const somaUn = lay => lay.units.filter(u => !u.livre).reduce((s, u) => s + u.area, 0);
const run = st => { const m = A.compute(st), f = A.finance(st, m); return { m, f, t: m.T[0] } };

describe('eficiência real da planta — formas desenhadas', () => {
  for (const formato of ['U', 'patio', 'L']) {
    it(`${formato}: privativa = soma das unidades desenhadas; unidades, tabela de vendas e VGV coerentes`, () => {
      const st = exemplo(formato), { m, f, t } = run(st), mA = A.massing(st);
      expect(t.desenhada).toBe(true);
      const lay = m.tipo[0], un = somaUn(lay);
      if (formato === 'U') expect(lay.alas).toBeTruthy();                       // C3: pavimento por alas
      expect(t.privAndar).toBeCloseTo(un, 6);
      expect(t.eficReal).toBeCloseTo(un / t.A, 9); expect(t.eficInf).toBe(0.8);
      expect(t.priv).toBeCloseTo(t.tipoFloors * un + t.cobP, 6);
      expect(m.privRes).toBeCloseTo(t.priv, 6);
      expect(m.priv).toBeCloseTo(m.privRes + m.lojaPriv + m.sacBal, 6);
      expect(m.eficReal).toBeCloseTo(un / t.A, 9);
      // antes (área × eficiência informada) ≠ agora (desenho)
      expect(Math.abs(mA.privRes - m.privRes)).toBeGreaterThan(1);
      // mix e fator: quantidade desenhada por tipologia, unidades com o tamanho médio das desenhadas
      const nDes = lay.units.filter(u => !u.livre).length;
      expect(t.faixas[0].un).toBe(nDes); expect(t.r).toBeCloseTo(un / st.produto.mix.reduce((s, u, j) => s + u.area * t.faixas[0].qtd[j], 0), 9);
      expect(m.unitRows.reduce((s, u) => s + u.area, 0)).toBeCloseTo(m.privRes - t.cobP, 6);
      lay.units.filter(u => !u.livre).forEach(u => { const j = st.produto.mix.findIndex(x => x.nome === u.nome); expect(u.alvo).toBeCloseTo(st.produto.mix[j].area * t.r, 9) });
      // tabela de vendas: a soma das áreas é a privativa; todas casadas com a planta (sol calculado)
      const U = m.unidades.filter(u => !u.cob);
      expect(U.length).toBe(m.unitsRes - (t.hasCob ? st.produto.cob.qtd : 0));
      expect(U.reduce((s, u) => s + u.area, 0)).toBeCloseTo(m.privRes - t.cobP, 4);
      expect(U.every(u => u.sol)).toBe(true);
      // VGV do mix = Σ área × preço das tipologias (mesmo fator de reajuste do estudo automático)
      const vRes = m.unitRows.reduce((s, u) => s + u.area * u.preco, 0) + m.cobArea * st.produto.cob.preco;
      const s0 = exemplo(null), r0 = run(s0), v0 = r0.m.unitRows.reduce((s, u) => s + u.area * u.preco, 0) + r0.m.cobArea * s0.produto.cob.preco;
      const k0 = r0.f.vgv / (v0 + r0.m.lojaPriv * s0.fin.precoLoja), k = f.vgv / (vRes + m.lojaPriv * st.fin.precoLoja);
      expect(k).toBeCloseTo(k0, 6);
      // a saúde do negócio usa a privativa desenhada
      expect(f.saude.eficGlobal).toBeCloseTo(m.priv / m.constr, 9);
    });
  }
  it('U: o exemplo do Luiz — o desenho rende menos que área × 80%', () => {
    const { t } = run(exemplo('U'));
    expect(t.privAndar).toBeLessThan(t.A * 0.8);
    expect(t.eficReal).toBeGreaterThan(0.6); expect(t.eficReal).toBeLessThan(0.78);
  });
});

describe('eficiência real da planta — retângulo e "Personalizar"', () => {
  it('retângulo desenhado igual ao automático: privativa próxima da do automático (diferença = núcleo e corredor reais)', () => {
    const auto = run(exemplo(null)), ret = run(exemplo('ret'));
    expect(ret.t.A).toBeCloseTo(auto.t.A, 0);
    // automático: área × 80%; desenhado: o pavimento tipo do automático tem as mesmas unidades (~76% da área)
    expect(auto.t.priv).toBeCloseTo(auto.t.tipoFloors * auto.t.A * 0.8 + auto.t.cobP, 4);
    expect(ret.t.privAndar).toBeCloseTo(somaUn(ret.m.tipo[0]), 6);
    const rel = ret.m.privRes / auto.m.privRes;
    expect(rel).toBeGreaterThan(0.9); expect(rel).toBeLessThan(1);
    // a diferença é o que o pavimento tipo do automático já mostrava: unidades desenhadas ÷ área (Projeto › Tipo)
    expect(ret.t.eficReal).toBeCloseTo(somaUn(auto.m.tipo[0]) / auto.t.A, 2);
    expect(ret.m.constr).toBeCloseTo(auto.m.constr, 0);
  });
  it('"Personalizar" sem mudar a forma: a planta e as áreas construídas são as mesmas; a privativa cai ~5% (vale o desenho)', () => {
    const auto = run(exemplo(null)), pers = run(exemplo('pers'));
    expect(pers.t.plate).toEqual(auto.t.plate);
    expect(pers.m.constr).toBeCloseTo(auto.m.constr, 6); expect(pers.m.CA).toBeCloseTo(auto.m.CA, 9); expect(pers.m.units).toBe(auto.m.units);
    expect(pers.t.privAndar).toBeCloseTo(somaUn(auto.m.tipo[0]), 6);           // o mesmo pavimento tipo do automático
    const rel = pers.m.privRes / auto.m.privRes;
    expect(rel).toBeGreaterThan(0.92); expect(rel).toBeLessThan(0.98);
    expect(pers.f.vgv).toBeLessThan(auto.f.vgv);
    const R = A.blcResumo(exemplo('pers'), pers.m);
    expect(R.efic).toBeCloseTo(pers.t.eficReal, 9); expect(R.eficInf).toBe(0.8);       // o que a interface mostra: real × informada
  });
});

describe('eficiência real da planta — Ajustar mix, pilha de blocos e contorno ocupado', () => {
  it('"Ajustar mix" mira a área real para unidades: depois dele o mix cabe (r ≥ 1) e não propõe mais nada', () => {
    const st = exemplo('ret'), m = A.compute(st), R = A.blcResumo(st, m);
    expect(R.real).toBe(true); expect(R.util).toBeGreaterThanOrEqual(R.priv - 1e-9);
    expect(m.T[0].fit).toBe(false);                                            // 316 m² do mix não cabem nos ~300 m² desenhados
    expect(R.muda).toBe(true);
    st.produto.mix.forEach((u, j) => u.qtd = R.q[j]);
    expect(st.produto.mix.reduce((s, u) => s + u.area * u.qtd, 0)).toBeLessThanOrEqual(R.util + 1e-6);
    const m2 = A.compute(st);
    expect(m2.T[0].r).toBeGreaterThanOrEqual(1); expect(m2.T[0].fit).toBe(true);
    expect(A.blcResumo(st, m2).muda).toBe(false);
  });
  it('pilha de blocos: a quantidade dos outros blocos sai da eficiência real do bloco de referência', () => {
    const EMB = [[6, 8], [24, 8], [24, 44], [6, 44]];
    const st = estado(A, {
      lote: { pts: [[0, 0], [30, 0], [30, 50], [0, 50]], front: [0], principal: 0, rec: [{}, {}, {}, {}] },
      regras: { recFrente: 4, afMin: 3, afDiv: 8, toTorre: 1, toEmb: 1, hMax: 80, caMax: 20 },
      produto: { torres: [{ pav: 12 }], subsolos: 0, garAcima: 0, peTerreo: 4.5, pe: 3, efic: 0.8, atico: false, garTerOn: false,
        cob: { on: false, qtd: 1, area: 100, preco: 1 }, mix: [{ nome: 'A', area: 90, qtd: 3, preco: 10000, sac: 0 }],
        lazer: { hall: 0, itens: [{ nome: 'Salão', area: 30, local: 'terreo' }] } },
    });
    st.custom.tor = []; st.blocos = { modo: 'desenhada', torres: [{ blocos: [{ pts: EMB, de: 1 }, { pts: RET, de: 4 }] }] };
    const m = A.compute(st), t = m.T[0], [f0, f1] = t.faixas;
    expect(f1.plate).toBe(t.plate);                                             // referência: o tipo (9 andares)
    const ref = somaUn(m.tipo[0]), eRef = ref / 392, rRef = ref / (90 * f1.qtd[0]);
    const q0 = A.torreAjustaMix(st.produto.mix, 648 * eRef / rRef, 99)[0];
    expect(f0.qtd[0]).toBe(q0); expect(f0.lay.units.filter(u => !u.livre).length).toBe(q0);
    expect(f0.priv).toBeCloseTo(somaUn(f0.lay), 6);
    expect(Math.abs(f0.r - t.r)).toBeLessThan(0.25);                            // unidades do embasamento perto do tamanho das do tipo
  });
  it('contorno ocupado (C0): privativa = unidades desenhadas; o "Ajustar mix" do contorno também mira a área real', () => {
    const st = estado(A, {
      lote: { pts: [[0, 0], [30, 0], [30, 50], [0, 50]], front: [0], principal: 0, rec: [{}, {}, {}, {}] },
      regras: { recFrente: 4, afMin: 3, afDiv: 8, toTorre: 1, toEmb: 1, hMax: 80, caMax: 20 },
      produto: { torres: [{ pav: 10 }], subsolos: 0, garAcima: 0, peTerreo: 4.5, pe: 3, efic: 0.8, atico: false, garTerOn: false,
        cob: { on: false, qtd: 1, area: 100, preco: 1 }, mix: [{ nome: 'A', area: 100, qtd: 2, preco: 10000, sac: 0 }],
        lazer: { hall: 0, itens: [{ nome: 'Salão', area: 30, local: 'terreo' }] } },
      custom: { tor: RET, torOcupa: true },
    });
    const m = A.compute(st), t = m.T[0];
    expect(m.torOcupa).toBe(true);
    expect(t.privAndar).toBeCloseTo(somaUn(m.tipo[0]), 6);
    expect(t.r).toBeCloseTo(t.privAndar / 200, 9);
    expect(m.privRes).toBeCloseTo(t.tipoFloors * t.privAndar, 6);
    const R = A.torOcupaResumo(st, m);
    expect(R.real).toBe(true); expect(R.priv).toBeCloseTo(t.privAndar, 9);
    expect(R.q[0]).toBe(Math.floor(R.util / 100));
  });
});

describe('modo automático intocado', () => {
  it('sem torre desenhada: blcPrivReal não faz nada e o compute tem a privativa do massing', () => {
    const st = estado(A, {}), mA = A.massing(st), m = A.compute(st);
    expect(A.blcPrivReal(st, A.massing(st))).toBe(false);
    expect(m.eficReal).toBeUndefined(); expect(m.T.every(t => t.eficReal === undefined)).toBe(true);
    expect(m.privRes).toBeCloseTo(mA.privRes + m.sacBal, 9);
    expect(m.unitRows).toEqual(mA.unitRows); expect(m.minApto).toBe(mA.minApto);
  });
  it('blocos guardados no modo "auto" não mudam nada', () => {
    const st = estado(A, {}), r0 = run(st);
    const s2 = A.clone(st); A.blcPersonaliza(s2, 0); s2.blocos.modo = 'auto';
    const r1 = run(s2);
    expect(r1.m.privRes).toBe(r0.m.privRes); expect(r1.f.vgv).toBe(r0.f.vgv); expect(r1.f.lucro).toBe(r0.f.lucro);
  });
});

describe('otimizador: atalho coerente com o compute completo', () => {
  it('blcPrivEstimada (massing + um pavimento tipo por mix) dá a mesma privativa do compute; o memo reaplica igual', () => {
    for (const formato of ['ret', 'L', 'U']) {
      const st = exemplo(formato), memo = new Map();
      for (const [pk, N, pav] of [['atual', 4, 12], ['familia', 4, 16], ['alto', 2, 10], ['familia', 4, 11]]) {
        const s = A.clone(st); s.produto.mix = A.presetMix(st, pk, N); s.produto.torres = [{ pav }];
        const me = A.massing(s); A.blcPrivEstimada(s, me, memo);
        const mc = A.compute(s, { quick: true });
        expect(me.privRes).toBeCloseTo(mc.privRes - mc.sacBal, 6);
        expect(me.unitsRes).toBe(mc.unitsRes); expect(me.T[0].r).toBeCloseTo(mc.T[0].r, 9); expect(me.T[0].fit).toBe(mc.T[0].fit);
        expect(me.minApto).toBeCloseTo(mc.minApto, 9); expect(A.otimDesvio(me)).toBeCloseTo(A.otimDesvio(mc), 9);
        // segunda vez: do memo, sem layout
        const me2 = A.massing(s); expect(A.blcPrivEstimada(s, me2, memo)).toBe(true); expect(me2.tipo).toBeUndefined();
        expect(me2.privRes).toBeCloseTo(me.privRes, 9); expect(me2.T[0].r).toBeCloseTo(me.T[0].r, 12);
      }
    }
  });
  it('estimativa × conferência: o lucro estimado das opções fica perto do conferido com o compute', async () => {
    const st = exemplo('ret'), m = A.compute(st, { quick: true });
    const r = await A.otimizar({ obj: 'lucro', torres: true, tipologias: true, unidades: true, mc: true, paretoMax: 4, tempoMax: 3000 }, null, null, { st, m });
    expect(r.res.length).toBeGreaterThan(0);
    expect(r.pts.length).toBeGreaterThan(0);
    for (const p of r.pts) {
      const s2 = A.clone(st); A.aplicarOtim({ ...p, forma: true }, s2);
      const me = A.massing(s2); A.blcPrivEstimada(s2, me, new Map());
      const m2 = A.compute(s2, { quick: true }), f2 = A.finance(s2, m2);
      expect(me.privRes).toBeCloseTo(m2.privRes - m2.sacBal, 6);                 // privativa residencial idêntica
      expect(m2.units).toBe(p.units);
      // o resto da diferença é o térreo (lojas e hall), que o massing só estima — como no modo automático (~1–2%)
      expect(Math.abs(f2.vgv - p.vgv) / p.vgv).toBeLessThan(0.03);
    }
  }, 300000);
});
