// Fase C + D — otimizador com torres desenhadas: a forma é do usuário e o otimizador só busca mix, pavimentos, subsolos e garagens;
// sol rápido (proxy da fronteira de Pareto) por faixa de andares; alavancas coerentes com a pilha de blocos.
import { describe, it, expect } from 'vitest';
import { carregar, estado } from './harness.js';

const A = carregar();
const OPTS = { obj: 'lucro', torres: true, tipologias: true, unidades: true, mc: true, paretoMax: 4, tempoMax: 3000 };
const RET = [[8, 12], [22, 12], [22, 40], [8, 40]];                       // 14 × 28 = 392 m²
const EMB = [[6, 8], [24, 8], [24, 44], [6, 44]];                         // 18 × 36 = 648 m²
const TOP = [[10, 16], [20, 16], [20, 36], [10, 36]];                     // 10 × 20 = 200 m²

/** estudo exemplo com UMA torre desenhada (formato pronto 'ret' ou 'L'), 12 pavimentos */
const desenhada = (formato, regras = {}) => {
  const st = estado(A, { regras });
  st.produto.torres = [{ pav: 12 }];
  A.blcPersonaliza(st, 0);
  expect(A.blcAplicaFormato(st, 0, formato)).toBeTruthy();
  return st;
};
/** lote 30 × 50 com a pilha de blocos dada (mix de 3 × 100 m²) */
const pilha = (blocos, pav = 12, regras = {}, ent = false) => {
  const st = estado(A, {
    lote: { pts: [[0, 0], [30, 0], [30, 50], [0, 50]], front: [0], principal: 0, rec: [{}, {}, {}, {}], lat: -27, norte: 0 },
    regras: { recFrente: 4, afMin: 3, afDiv: 8, toTorre: 1, toEmb: 1, hMax: 80, caMax: 20, ...regras },
    produto: { torres: [{ pav }], subsolos: 0, garAcima: 0, peTerreo: 4.5, pe: 3, efic: 0.8, atico: false, garTerOn: false,
      cob: { on: false, qtd: 1, area: 100, preco: 1 }, mix: [{ nome: 'A', area: 100, qtd: 3, preco: 12000, sac: 0 }],
      lazer: { hall: 0, itens: [{ nome: 'Salão', area: 30, local: 'terreo' }] } },
  });
  st.custom.tor = []; st.blocos = { modo: 'desenhada', torres: [{ blocos }] };
  if (ent) st.entorno = [{ pts: [[-30, 60], [60, 60], [60, 80], [-30, 80]], h: 60 }, { pts: [[32, 0], [50, 0], [50, 50], [32, 50]], h: 35 }];
  return st;
};
const todas = r => [...r.res, ...(r.pareto ? r.pareto.pts : []), ...(r.pts || [])];

/** confere uma opção aplicada a uma cópia do estudo: gabarito, CA, tamanho das unidades e aptoMin */
function confere(st0, r, tol) {
  const s2 = A.clone(st0); A.aplicarOtim(r, s2);
  // a 1ª opção vem do cálculo completo (fase "ciclo" do otimizar: os números dela são os do Projeto); as outras, do rápido
  const m = A.compute(s2, r.completo ? {} : { quick: true }), f = A.finance(s2, m);
  expect(s2.blocos).toEqual(st0.blocos);                                        // a forma não muda
  expect(s2.produto.torres.length).toBe(st0.produto.torres.length);             // nem o número de torres
  expect(m.H).toBeLessThanOrEqual((m.hLim ?? s2.regras.hMax) + 1e-6);
  expect(m.CA).toBeLessThanOrEqual(s2.regras.caMax + 1e-6);
  expect(m.minApto).toBeGreaterThanOrEqual(s2.regras.aptoMin);
  expect(m.T.every(t => t.fit)).toBe(true);
  expect(m.T.every(t => !t.blcIgn || !t.blcIgn.length)).toBe(true);             // nenhum bloco ficou de fora
  // eficiência real da planta: unidades até 2% menores que o mix contam como cabendo (BLC_FIT_TOL)
  m.T.forEach(t => { expect(t.r).toBeGreaterThanOrEqual(1 - A.BLC_FIT_TOL - 1e-6); expect(t.r).toBeLessThanOrEqual(1 + tol + 1e-6) });
  expect(A.otimDesvio(m)).toBeLessThanOrEqual(tol + 1e-6);
  return { s2, m, f };
}

describe('otimizar para a forma desenhada', () => {
  for (const formato of ['ret', 'L']) {
    it(`torre ${formato === 'ret' ? 'retangular' : 'em L'}: não troca torres nem forma; unidades preenchem o bloco; aplicar reproduz os números`, async () => {
      const B = carregar(); const st = estado(B, {}); st.produto.torres = [{ pav: 12 }]; B.blcPersonaliza(st, 0); B.blcAplicaFormato(st, 0, formato);
      expect(B.otimFormaAtiva(st)).toBe(true);
      const m = B.compute(st, { quick: true }), antes = JSON.stringify(st), tol = st.otim.rTol;
      const r = await B.otimizar(OPTS, null, null, { st, m });
      expect(JSON.stringify(st)).toBe(antes);                                   // o estudo não é tocado
      expect(r.forma).toMatchObject({ on: true, torres: 1, desenhadas: 1 });
      expect(r.res.length).toBeGreaterThan(0);
      expect(r.pareto.pts.length).toBeGreaterThan(0);
      expect(r.pareto.criterios).toContain('dev');
      // mesmo com "Nº de torres" ligado: todas as combinações (estimadas e conferidas) têm 1 torre e o desvio dentro da tolerância
      for (const p of todas(r)) { expect(p.nT).toBe(1); expect(p.forma).toBe(true); expect(p.dev).toBeLessThanOrEqual(tol + 1e-9) }
      // vários tamanhos de unidades por andar (preenchendo o bloco), não só o do estudo
      expect(new Set(r.pts.map(p => p.pk + '|' + p.N)).size).toBeGreaterThan(1);
      // nenhuma opção aplicada: r perto de 1, gabarito, CA, aptoMin; "aplicar" reproduz lucro, unidades e vagas
      for (const p of [...r.res.slice(0, 3), ...r.pareto.pts.filter(p => p.fronteira).slice(0, 2)]) {
        const { m: m2, f: f2 } = confere(st, p, tol);
        expect(m2.units).toBe(p.units); expect(m2.vagas).toBe(p.vagas);
        expect(f2.lucro).toBeCloseTo(p.lucro, 0); expect(f2.margemVGV).toBeCloseTo(p.margem, 6);
        expect(m2.T[0].r).toBeLessThanOrEqual(1 + tol + 1e-6);
      }
      // resultado serializável (vai do Worker para a página)
      expect(() => JSON.parse(JSON.stringify(r))).not.toThrow();
    }, 300000);
  }

  it('a nota penaliza unidades fora do tamanho do mix: o mix que preenche a planta exatamente ganha do que obriga as unidades a crescer', () => {
    // planta de 395 m² (cabe 316 m² do mix a 80%): o mix atual preenche (r = 1); com +20 m² nas unidades r = 1,06
    const st = desenhada('ret'), m = A.massing(st);
    expect(m.T[0].r).toBeCloseTo(1, 6); expect(A.otimDesvio(m)).toBeCloseTo(0, 9);
    const s2 = A.clone(st); s2.produto.mix.forEach(u => { u.area -= 4 });
    const m2 = A.massing(s2);
    expect(m2.T[0].r).toBeGreaterThan(1.03); expect(A.otimDesvio(m2)).toBeCloseTo(m2.T[0].r - 1, 6);
  });

  it('quantidades por andar candidatas são as que preenchem o bloco de referência (r entre 1 e 1 + tolerância)', () => {
    const st = desenhada('L'), m = A.massing(st), A0 = m.T[0].A;
    for (const pk of ['atual', 'familia', 'alto']) {
      const Ns = A.otimNsForma(st, pk, [A0], 0.10, 4);
      Ns.filter(N => N !== 4).forEach(N => {
        const mp = A.presetMix(st, pk, N).reduce((s, u) => s + u.area * u.qtd, 0), r = A0 * st.produto.efic / mp;
        expect(r).toBeGreaterThanOrEqual(0.996); expect(r).toBeLessThanOrEqual(1 + 0.10 * 1.5 + 1e-9);
      });
      expect(Ns).toContain(4);                                                  // o nº de unidades atual sempre entra
    }
  });

  it('pilha de blocos: o último bloco estica, mas nunca abaixo do andar em que ele começa; respeita gabarito e CA', async () => {
    const st = pilha([{ pts: EMB, de: 1 }, { pts: RET, de: 4 }, { pts: TOP, de: 8 }], 12, { hMax: 60, caMax: 5 });
    st.produto.mix = [{ nome: 'A', area: 100, qtd: 3, preco: 12000, sac: 0 }];
    expect(A.otimPavMinForma(st)).toBe(8);
    const m = A.compute(st, { quick: true });
    const r = await A.otimizar({ ...OPTS, tipologias: false }, null, null, { st, m });
    expect(r.forma.pavMin).toBe(8);
    expect(todas(r).length).toBeGreaterThan(0);
    for (const p of todas(r)) { expect(p.pav).toBeGreaterThanOrEqual(8); expect(p.nT).toBe(1) }
    for (const p of r.res) { const { m: m2 } = confere(st, p, st.otim.rTol); expect(m2.H).toBeLessThanOrEqual(60 + 1e-6); expect(m2.T[0].faixas.length).toBe(3) }
    // gabarito mais baixo ainda → mais restrito: nenhum pavimento acima do que cabe
    const s2 = A.clone(st); s2.regras.hMax = 36;                               // 4,5 + 10 × 3 = 34,5
    const r2 = await A.otimizar({ ...OPTS, tipologias: false, mc: false }, null, null, { st: s2, m: A.compute(s2, { quick: true }) });
    r2.res.forEach(p => expect(p.pav).toBeLessThanOrEqual(10));
  }, 300000);

  it('forma desenhada que não comporta o mix: nenhuma opção (e o modo automático continua livre)', async () => {
    const st = desenhada('ret'); const b = st.blocos.torres[0].blocos[0];
    b.pts = b.pts.map(q => [q[0] / 3 + 8, q[1] / 3 + 8]);                       // planta pequena demais para qualquer preset
    const r = await A.otimizar({ ...OPTS, mc: false }, null, null, { st, m: A.compute(st, { quick: true }) });
    expect(r.forma.on).toBe(true); expect(r.res).toEqual([]);
  }, 300000);

  it('aplicar: troca só mix, pavimentos, subsolos e garagens; preserva os campos da torre e os blocos', () => {
    const st = desenhada('ret'); st.produto.torres[0].nome = 'Torre A';
    const antes = JSON.stringify(st.blocos);
    A.aplicarOtim({ forma: true, nT: 1, pav: 9, sub: 2, gac: 1, mix: [{ nome: 'X', area: 70, qtd: 4, preco: 9000, sac: 0 }] }, st);
    expect(st.produto.torres).toEqual([{ pav: 9, nome: 'Torre A' }]);
    expect(st.produto.subsolos).toBe(2); expect(st.produto.garAcima).toBe(1); expect(st.produto.mix[0].nome).toBe('X');
    expect(JSON.stringify(st.blocos)).toBe(antes);
    // opção do modo automático continua trocando a lista de torres inteira
    const s3 = estado(A, {}); A.aplicarOtim({ nT: 3, pav: 7, sub: 1, gac: 0, mix: s3.produto.mix }, s3);
    expect(s3.produto.torres).toEqual([{ pav: 7 }, { pav: 7 }, { pav: 7 }]);
  });
});

describe('modo automático inalterado', () => {
  it('blocos guardados mas modo "auto": o otimizador varia torres como sempre e não marca forma', async () => {
    const B = carregar(); const st = estado(B, {}), m = B.compute(st);
    // sem a fase "ciclo" (tem orçamento de tempo: duas rodadas podem conferir garagens diferentes); aqui só importa que os blocos guardados não mudam nada
    const ref = await B.otimizar({ obj: 'lucro', torres: true, tipologias: false, unidades: true, mc: false, ciclo: false }, null, null, { st, m });
    const s2 = B.clone(st); B.blcPersonaliza(s2, 0); s2.blocos.modo = 'auto';
    expect(B.otimFormaAtiva(s2)).toBe(false);
    const r = await B.otimizar({ obj: 'lucro', torres: true, tipologias: false, unidades: true, mc: false, ciclo: false }, null, null, { st: s2, m: B.compute(s2) });
    const key = x => [x.nT, x.pk, x.N, x.pav, x.sub, x.gac, Math.round(x.lucro)].join(',');
    expect(r.forma).toBeUndefined();
    expect(r.res.map(key)).toEqual(ref.res.map(key));
    expect(new Set(r.res.map(x => x.nT)).size).toBeGreaterThanOrEqual(1);
    expect(r.res.every(x => x.forma === undefined && x.dev === undefined)).toBe(true);
    const mc = await B.otimizar({ obj: 'lucro', torres: false, tipologias: false, unidades: true, mc: true, paretoMax: 2 }, null, null, { st, m });
    expect(mc.pareto.criterios).toEqual(['lucro', 'sol', 'vagas']);
  }, 300000);
});

describe('sol rápido por faixa de andares', () => {
  const rank = a => { const o = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]), r = []; o.forEach(([, i], k) => r[i] = k); return r };
  const spearman = (a, b) => { const ra = rank(a), rb = rank(b), n = a.length, mm = (n - 1) / 2; let sa = 0, sb = 0, sab = 0; for (let i = 0; i < n; i++) { sa += (ra[i] - mm) ** 2; sb += (rb[i] - mm) ** 2; sab += (ra[i] - mm) * (rb[i] - mm) } return sab / Math.sqrt(sa * sb) };
  const soPelaBase = m => ({ ...m, T: m.T.map(t => ({ ...t, faixas: [] })) });          // o que o proxy fazia: só a planta de referência

  it('pilha de blocos: o proxy usa a planta de cada faixa (difere do proxy só pela base)', () => {
    const st = pilha([{ pts: EMB, de: 1 }, { pts: RET, de: 4 }, { pts: TOP, de: 8 }], 12, {}, true), m = A.massing(st);
    expect(m.T[0].faixas.length).toBe(3);
    const novo = A.otimSolProxy(st, m), velho = A.otimSolProxy(st, soPelaBase(m));
    expect(novo).toBeGreaterThan(0); expect(novo).toBeLessThan(13);
    expect(Math.abs(novo - velho)).toBeGreaterThan(0.05);
  });
  it('torre de uma faixa só: o proxy é o mesmo de antes (modo automático e C1 inalterados)', () => {
    const st = estado(A, {}), m = A.massing(st);
    expect(A.otimSolProxy(st, m)).toBe(A.otimSolProxy(st, soPelaBase(m)));
    const s1 = pilha([{ pts: RET, de: 1 }], 12, {}, true), m1 = A.massing(s1);
    expect(A.otimSolProxy(s1, m1)).toBe(A.otimSolProxy(s1, soPelaBase(m1)));
  });
  it('um vizinho baixo ao norte sombreia o bloco de baixo: o proxy por faixa enxerga, a planta só da base não', () => {
    // 12 m < início do 2º bloco (13,5 m): só as fachadas do 1º bloco (RET, 1º–3º) ficam na sombra
    const bl = [{ pts: RET, de: 1 }, { pts: TOP, de: 4 }];
    const com = h => { const st = pilha(bl, 12, {}, false); st.entorno = h ? [{ pts: [[-10, 54], [40, 54], [40, 66], [-10, 66]], h }] : []; return st };
    const v = h => { const st = com(h), mq = A.compute(st, { quick: true }); return { novo: A.otimSolProxy(st, mq), velho: A.otimSolProxy(st, soPelaBase(mq)) } };
    const a0 = v(0), a12 = v(12);
    expect(a12.novo).toBeLessThan(a0.novo - 0.01);
    expect(a12.velho).toBeCloseTo(a0.velho, 9);
  });
  it('acompanha o sol completo das unidades quando o vizinho sobe (mesma ordem, nunca aumenta)', () => {
    const bl = [{ pts: RET, de: 1 }, { pts: TOP, de: 4 }], hs = [0, 12, 20, 30, 45, 60, 90], novo = [], full = [];
    hs.forEach(h => { const st = pilha(bl, 12, {}, false); st.entorno = h ? [{ pts: [[-10, 54], [40, 54], [40, 66], [-10, 66]], h }] : [];
      novo.push(A.otimSolProxy(st, A.compute(st, { quick: true }))); full.push(A.unidadesSolMedio(st, A.compute(st))) });
    for (let i = 1; i < hs.length; i++) { expect(novo[i]).toBeLessThanOrEqual(novo[i - 1] + 1e-9); expect(full[i]).toBeLessThanOrEqual(full[i - 1] + 1e-9) }
    expect(novo[0] - novo[hs.length - 1]).toBeGreaterThan(1); expect(full[0] - full[hs.length - 1]).toBeGreaterThan(1);
    expect(spearman(novo, full)).toBeGreaterThan(0.9);
  }, 120000);
  it('sol rápido das unidades (otimizador) lê a planta de cada faixa e fica perto do completo', () => {
    const st = pilha([{ pts: EMB, de: 1 }, { pts: RET, de: 4 }, { pts: TOP, de: 8 }], 12, {}, true), mq = A.compute(st, { quick: true }), mf = A.compute(st);
    const rap = A.unidadesSolMedio(st, mq), full = A.unidadesSolMedio(st, mf), base = A.unidadesSolMedio(st, soPelaBase(mq));
    expect(Math.abs(rap - full)).toBeLessThan(0.25);
    expect(Math.abs(rap - full)).toBeLessThan(Math.abs(base - full));
  });
});

describe('alavancas e potencial com a forma desenhada', () => {
  const lin = (r, k) => r.linhas.find(l => l.k === k);
  it('+1 pavimento estica o último bloco: unidades e área privativa a mais são as do último bloco', () => {
    const st = pilha([{ pts: RET, de: 1 }, { pts: TOP, de: 7 }], 10), m = A.compute(st);
    const mB = A.massing(st), s2 = A.clone(st); s2.produto.torres[0].pav += 1; const m2 = A.massing(s2);
    const fx = mB.T[0].faixas[1];
    expect(m2.T[0].faixas[1].n).toBe(fx.n + 1);                                  // só o bloco de cima ganhou um andar
    expect(m2.T[0].faixas[0].n).toBe(mB.T[0].faixas[0].n);
    expect(m2.priv - mB.priv).toBeCloseTo(fx.priv, 6); expect(m2.units - mB.units).toBe(fx.un);
    const a = lin(A.alavancasCalc(st, m), 'pav');
    expect(a.ok).toBe(true); expect(a.desc).toContain(`+${fx.un} un`);
    expect(a.d.lucro).toBeGreaterThan(0);
    // o andar a mais vem do bloco de cima (200 m²), bem menos que o do bloco de referência (392 m²)
    const um = pilha([{ pts: RET, de: 1 }], 10), b = lin(A.alavancasCalc(um, A.compute(um)), 'pav');
    expect(b.d.lucro).toBeGreaterThan(a.d.lucro);
  });
  it('+1 pavimento no limite: gabarito e CA seguem valendo com a forma desenhada', () => {
    const st = pilha([{ pts: RET, de: 1 }, { pts: TOP, de: 7 }], 10, { hMax: 34.5 });                // 4,5 + 10 × 3 = 34,5 m
    const a = lin(A.alavancasCalc(st, A.compute(st)), 'pav'); expect(a.ok).toBe(false); expect(a.motivo).toMatch(/gabarito/);
    const s2 = pilha([{ pts: RET, de: 1 }, { pts: TOP, de: 7 }], 10, { caMax: A.massing(pilha([{ pts: RET, de: 1 }, { pts: TOP, de: 7 }], 10)).CA + 1e-6 });
    const c = lin(A.alavancasCalc(s2, A.compute(s2)), 'pav'); expect(c.ok).toBe(false); expect(c.motivo).toMatch(/CA/);
  });
  it('+eficiência: as unidades crescem 5% sem mudar a área construída (igual a refazer o modelo)', () => {
    const st = pilha([{ pts: EMB, de: 1 }, { pts: RET, de: 4 }, { pts: TOP, de: 8 }], 12), m = A.massing(st), e = lin(A.alavancasCalc(st, m), 'efic');
    expect(e.ok).toBe(true);
    const f0 = A.finance(st, m, { noHooks: true });
    const mv = { ...m, unitRows: m.unitRows.map(u => ({ ...u, area: u.area * 1.05 })) }, fv = A.finance(st, mv, { noHooks: true });
    expect(e.d.lucro).toBeCloseTo(fv.lucro - f0.lucro, 0);
    expect(e.d.lucro).toBeGreaterThan(0); expect(e.d.margem).toBeGreaterThan(0);
  });
  it('potencial: os andares que ainda cabem no gabarito são do último bloco (não do bloco de referência)', () => {
    const st = pilha([{ pts: RET, de: 1 }, { pts: TOP, de: 7 }], 10, { caMax: 20 }), m = A.compute(st), p = A.potencial(st, m);
    const t = m.T[0];
    expect(t.Atop).toBeLessThan(t.A);
    expect(p.limita).toBe('altura');
    expect(p.atc).toBeCloseTo(m.constr + Math.max(0, p.pavH - t.pav) * t.Atop, 6);
    const um = pilha([{ pts: RET, de: 1 }], 10, { caMax: 20 }), mu = A.compute(um), pu = A.potencial(um, mu);
    expect(pu.atc).toBeCloseTo(mu.constr + Math.max(0, pu.pavH - 10) * mu.T[0].A, 6);   // um bloco: como antes
  });
});
