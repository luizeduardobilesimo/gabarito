// Fase C0 — "Torre ocupa o contorno desenhado": o limite especial das torres vira a planta do andar tipo.
import { describe, it, expect } from 'vitest';
import { carregar, estado } from './harness.js';

const A = carregar();
// lote 30 × 50, frente em y=0; 10 pavimentos; afastamento lateral = max(3, H/8) ≈ 4,3 m → envelope x 4,3–25,7, y 4–45,7
const RET = [[8, 12], [22, 12], [22, 40], [8, 40]];                       // 14 × 28 = 392 m²
const ELE = [[6, 10], [24, 10], [24, 20], [14, 20], [14, 40], [6, 40]];   // L: 18×10 + 8×20 = 340 m²
const base = (custom = {}, regras = {}) => estado(A, {
  lote: { pts: [[0, 0], [30, 0], [30, 50], [0, 50]], front: [0], principal: 0, rec: [{}, {}, {}, {}] },
  regras: { recFrente: 4, afMin: 3, afDiv: 8, toTorre: 1, toEmb: 1, hMax: 80, caMax: 20, ...regras },
  produto: { torres: [{ pav: 10 }], subsolos: 0, garAcima: 0, peTerreo: 4.5, pe: 3, efic: 0.8, atico: false, garTerOn: false,
    cob: { on: false, qtd: 1, area: 100, preco: 1 }, mix: [{ nome: 'A', area: 100, qtd: 2, preco: 10000, sac: 0 }],
    lazer: { hall: 0, itens: [{ nome: 'Salão', area: 30, local: 'terreo' }] } },
  custom: { tor: RET, ...custom },
});

describe('C0 — desligado (padrão)', () => {
  it('DEF traz torOcupa desligado e estudo antigo sem a chave abre desligado', () => {
    expect(A.DEF.custom.torOcupa).toBe(false);
    const st = A.merge(A.clone(A.DEF), { custom: { tor: RET } });
    expect(st.custom.torOcupa).toBe(false);
    expect(st.custom.tor).toEqual(RET);
    expect(A.merge(A.clone(A.DEF), { custom: { tor: RET, torOcupa: true } }).custom.torOcupa).toBe(true);
  });
  it('com o limite desenhado mas desligado, o limite é só teto: a torre fica do tamanho do mix', () => {
    const m = A.massing(base());
    expect(m.torOcupa).toBe(false);
    expect(m.T[0].A).toBeCloseTo(200 / 0.8, 1);
    expect(m.T[0].r).toBe(1);
  });
});

describe('C0 — ligado', () => {
  it('retângulo: a planta é o contorno e as unidades crescem até preenchê-lo', () => {
    const m = A.massing(base({ torOcupa: true })), t = m.T[0];
    expect(m.torOcupa).toBe(true);
    expect(t.A).toBeCloseTo(392, 1);
    expect(t.r).toBeCloseTo(392 * 0.8 / 200, 6);
    expect(t.fit).toBe(true);
    expect(t.priv).toBeCloseTo(t.tipoFloors * 392 * 0.8, 1);
    expect(m.unitRows[0].area).toBeCloseTo(t.priv, 1);
  });
  it('contorno em L (não convexo): área da planta = contorno, e o pavimento tipo é desenhado', () => {
    const st = base({ tor: ELE, torOcupa: true }), m = A.compute(st, { layouts: false });
    expect(m.T[0].A).toBeCloseTo(340, 1);
    expect(A.G.area(m.T[0].plate)).toBeCloseTo(340, 1);
    expect(m.tipo[0] && m.tipo[0].units.length).toBeGreaterThan(0);
  });
  it('o contorno é recortado pelos recuos', () => {
    const fora = [[0, 0], [30, 0], [30, 50], [0, 50]];          // contorno = lote inteiro
    const m = A.massing(base({ tor: fora, torOcupa: true }));
    expect(m.T[0].A).toBeCloseTo(A.G.area(m.torAll), 1);
    expect(m.T[0].A).toBeLessThan(30 * 50 - 1);
  });
  it('acima da TO: a planta não encolhe e o estudo avisa', () => {
    const m = A.compute(base({ torOcupa: true }, { toTorre: 0.2 }), { layouts: false });
    expect(m.T[0].A).toBeCloseTo(392, 1);
    expect(m.avisos.some(a => /taxa de ocupação/.test(a))).toBe(true);
  });
  it('unidades muito maiores que o mix geram aviso; o "Ajustar mix" traz de volta ao tamanho do mix', () => {
    const st = base({ torOcupa: true }), m = A.compute(st, { layouts: false });
    expect(m.avisos.some(a => /Ajustar mix/.test(a))).toBe(true);
    const R = A.torOcupaResumo(st, m);
    const q = A.torreAjustaMix(st.produto.mix, R.priv);
    st.produto.mix[0].qtd = q[0];
    const m2 = A.compute(st, { layouts: false });
    expect(m2.T[0].A).toBeCloseTo(392, 1);                       // a planta continua sendo o contorno
    expect(m2.T[0].r).toBeGreaterThanOrEqual(1);
    expect(m2.T[0].r).toBeLessThan(1.35);                        // 313,6 m² ÷ 100 m² → 3 unidades de ~105 m²
    expect(m2.avisos.some(a => /Ajustar mix/.test(a))).toBe(false);
  });
});

describe('C0 — duas torres', () => {
  it('contorno em L dividido em andares desiguais: avisa; o "Ajustar mix" só aparece se mudar algo', () => {
    const st = base({ tor: ELE, torOcupa: true });
    st.produto.torres = [{ pav: 10 }, { pav: 10 }];
    const m = A.compute(st, { layouts: false });
    expect(Math.abs(m.T[0].A - m.T[1].A)).toBeGreaterThan(20);
    expect(m.avisos.some(a => /tamanhos diferentes/.test(a))).toBe(true);
    const R = A.torOcupaResumo(st, m);
    st.produto.mix.forEach((u, j) => u.qtd = R.q[j]);
    const R2 = A.torOcupaResumo(st, A.compute(st, { layouts: false }));
    expect(R2.muda).toBe(false);                                  // aplicado uma vez, o ajuste não propõe mais nada
  });
});

/* ===================================== C1 — forma livre da torre ===================================== */
const desenhada = (blocos, extra = {}) => {
  const st = base({ tor: [] }, extra.regras);
  st.custom.tor = [];
  st.blocos = { modo: 'desenhada', torres: blocos.map(b => ({ blocos: b ? [b] : [] })) };
  if (extra.torres) st.produto.torres = extra.torres;
  return st;
};
const num = (A, st) => { const m = A.compute(st, { layouts: false }), f = A.finance(st, m); return { m, f } };

describe('C1 — estado e modo automático', () => {
  it('DEF traz blocos no modo automático; estudo antigo sem a chave abre automático', () => {
    expect(A.DEF.blocos).toEqual({ modo: 'auto', torres: [] });
    const st = A.merge(A.clone(A.DEF), { lote: A.DEF.lote });
    expect(st.blocos.modo).toBe('auto');
    const b = { pts: RET, de: 1 };
    const st2 = A.merge(A.clone(A.DEF), { blocos: { modo: 'desenhada', torres: [{ blocos: [b] }] } });
    expect(st2.blocos.torres[0].blocos[0].pts).toEqual(RET);
  });
  it('blocos guardados não mudam nada no modo automático (voltar para Automática não apaga os blocos)', () => {
    const st = estado(A, {}), ref = num(A, st);
    st.blocos = { modo: 'auto', torres: [{ blocos: [{ pts: RET, de: 1 }] }] };
    const r = num(A, st);
    expect(r.m.T[0].desenhada).toBeUndefined();
    expect(r.f.vgv).toBe(ref.f.vgv); expect(r.f.lucro).toBe(ref.f.lucro); expect(r.m.CA).toBe(ref.m.CA);
    expect(st.blocos.torres[0].blocos.length).toBe(1);
  });
});

describe('C1 — "Personalizar esta torre"', () => {
  it('copia a forma automática de cada torre: a forma e as áreas construídas não mudam; a privativa passa a ser a desenhada', () => {
    const st = estado(A, {}), ref = num(A, st);
    st.produto.torres.forEach((_, i) => A.blcPersonaliza(st, i));
    expect(st.blocos.modo).toBe('desenhada');
    const r = num(A, st), mA = A.massing(st);
    // o massing (antes do pavimento tipo) continua igual ao automático: área × eficiência informada
    mA.T.forEach((t, i) => { expect(t.desenhada).toBe(true); expect(t.plate).toEqual(ref.m.T[i].plate); expect(t.r).toBeCloseTo(ref.m.T[i].r, 9) });
    expect(mA.privRes).toBeCloseTo(ref.m.privRes, 6);
    // eficiência real da planta: a mesma planta, mas a privativa é a soma das unidades desenhadas no pavimento tipo
    r.m.T.forEach((t, i) => {
      const un = r.m.tipo[i].units.filter(u => !u.livre).reduce((s, u) => s + u.area, 0);
      expect(t.privAndar).toBeCloseTo(un, 6); expect(t.eficReal).toBeCloseTo(un / t.A, 9);
      expect(t.r).toBeCloseTo(un / ref.m.mixPriv, 9);
      expect(t.eficReal).toBeLessThan(st.produto.efic); expect(t.eficReal).toBeGreaterThan(0.7);   // núcleo + corredor de verdade: ~76%
    });
    expect(r.m.privRes).toBeCloseTo(r.m.T.reduce((s, t) => s + t.tipoFloors * t.privAndar + t.cobP, 0), 6);
    expect(r.m.privRes).toBeLessThan(ref.m.privRes); expect(r.m.privRes / ref.m.privRes).toBeGreaterThan(0.9);   // ~5% menos
    expect(r.f.vgv).toBeLessThan(ref.f.vgv);
    // área construída, CA, unidades e custo da obra não dependem da eficiência
    expect(r.m.units).toBe(ref.m.units); expect(r.m.CA).toBeCloseTo(ref.m.CA, 9); expect(r.m.constr).toBeCloseTo(ref.m.constr, 6);
    expect(r.m.avisos.filter(a => !ref.m.avisos.includes(a))).toEqual([]);   // nenhum aviso novo (o mix ainda ocupa ~105%)
  });
  it('o bloco é cópia (editar o bloco não mexe na forma automática)', () => {
    const st = estado(A, {}), m = A.massing(st), b = A.blcPersonaliza(st, 0);
    b.pts[0][0] += 1;
    expect(m.T[0].plate[0][0]).not.toBe(b.pts[0][0]);
  });
});

describe('C1 — massing da torre desenhada', () => {
  it('planta = bloco (L), não encolhida pelos recuos; unidades crescem com o fator r', () => {
    const st = desenhada([{ pts: ELE, de: 1 }]), m = A.compute(st, { layouts: false }), t = m.T[0];
    expect(t.desenhada).toBe(true);
    expect(t.A).toBeCloseTo(340, 6);                                    // x de 6 a 24 passa do afastamento (4,3 m) e não é cortado
    expect(A.massing(st).T[0].r).toBeCloseTo(340 * 0.8 / 200, 9);              // antes do pavimento tipo: área × eficiência
    const un = m.tipo[0].units.filter(u => !u.livre).reduce((s, u) => s + u.area, 0);
    expect(t.r).toBeCloseTo(un / 200, 9);                                       // depois: unidades desenhadas ÷ mix
    expect(m.tiposA).toBeCloseTo(340 * 10, 6);
    expect(m.avisos.some(a => /sobre os recuos/.test(a))).toBe(false);   // 6 m > 4,3 m: dentro do envelope
    const st2 = desenhada([{ pts: [[2, 10], [24, 10], [24, 30], [2, 30]], de: 1 }]), m2 = A.compute(st2, { layouts: false });
    expect(m2.T[0].A).toBeCloseTo(22 * 20, 6);
    expect(m2.avisos.some(a => /sobre os recuos/.test(a))).toBe(true);
    expect(m2.blc[0].foraRecuo).toBeGreaterThan(40);
  });
  it('fora do lote: recorta na divisa e avisa', () => {
    const st = desenhada([{ pts: [[20, 10], [40, 10], [40, 30], [20, 30]], de: 1 }]), m = A.compute(st, { layouts: false });
    expect(m.T[0].A).toBeCloseTo(10 * 20, 6);
    expect(m.avisos.some(a => /para fora do lote/.test(a))).toBe(true);
  });
  it('torre sem bloco segue automática; o total de andares continua no stepper (Máx funciona)', () => {
    const st = desenhada([null, { pts: [[6, 30], [24, 30], [24, 44], [6, 44]], de: 1 }], { torres: [{ pav: 10 }, { pav: 10 }] });
    const m = A.massing(st);
    expect(m.T[0].desenhada).toBeUndefined();
    expect(m.T[1].desenhada).toBe(true);
    expect(m.T[1].A).toBeCloseTo(18 * 14, 6);
    st.regras.hMax = 30; expect(A.maxPav(st)).toBe(8);                 // 4,5 + 8 × 3 = 28,5 m
  });
  it('pátio: vazio desconta a área; planta com ponte (pip fora no vazio) e perímetro com a borda interna', () => {
    const b = { pts: [[6, 10], [24, 10], [24, 40], [6, 40]], vazios: [[[11, 18], [19, 18], [19, 32], [11, 32]]], de: 1 };
    const st = desenhada([b]), m = A.massing(st), t = m.T[0];
    expect(t.A).toBeCloseTo(18 * 30 - 8 * 14, 6);
    expect(t.oco.vazios.length).toBe(1);
    expect(A.G.pip([15, 25], t.plate)).toBe(false);
    expect(A.G.pip([8, 25], t.plate)).toBe(true);
    expect(A.blcPerim(t, t.plate)).toBeCloseTo(2 * (18 + 30) + 2 * (8 + 14), 6);
  });
});

describe('C1 — avisos automáticos', () => {
  it('distância entre torres menor que a regra e sobreposição', () => {
    const st = desenhada([{ pts: [[6, 8], [24, 8], [24, 22], [6, 22]], de: 1 }, { pts: [[6, 26], [24, 26], [24, 40], [6, 40]], de: 1 }], { torres: [{ pav: 10 }, { pav: 10 }] });
    const m = A.compute(st, { layouts: false });
    expect(m.avisos.some(a => /ficam a 4,0 m/.test(a))).toBe(true);
    st.blocos.torres[1].blocos[0].pts = [[6, 20], [24, 20], [24, 40], [6, 40]];
    expect(A.compute(st, { layouts: false }).avisos.some(a => /se sobrepõem/.test(a))).toBe(true);
  });
  it('CA, TO e gabarito acima da regra viram aviso (a forma não encolhe)', () => {
    const st = desenhada([{ pts: RET, de: 1 }], { regras: { caMax: 1, toTorre: 0.2, hMax: 20 } });
    const m = A.compute(st, { layouts: false });
    expect(m.T[0].A).toBeCloseTo(392, 6);
    expect(m.avisos.some(a => /o CA fica em/.test(a))).toBe(true);
    expect(m.avisos.some(a => /taxa de ocupação/.test(a))).toBe(true);
    expect(m.avisos.some(a => /gabarito/.test(a))).toBe(true);
  });
  it('balanço: torre além da projeção do embasamento', () => {
    const st = desenhada([{ pts: RET, de: 1 }], { regras: { toEmb: 0.15 } });
    const m = A.compute(st, { layouts: false });
    expect(m.avisos.some(a => /projeção do embasamento/.test(a))).toBe(true);
  });
  it('núcleo num vão da forma (U aberto) avisa; retângulo cheio não', () => {
    // U com as alas ao longo do eixo maior: o núcleo (no meio da planta, junto ao corredor) cai no vão
    const U = { pts: [[5, 5], [25, 5], [25, 45], [19, 45], [19, 13], [11, 13], [11, 45], [5, 45]], de: 1 };
    // C3: com o layout por ala (padrão) o núcleo vai para a base do U — aqui vale o pavimento tipo aproximado (S.alas.on = false)
    const mix6 = st => { st.produto.mix = [{ nome: 'A', area: 60, qtd: 6, preco: 10000, sac: 0 }]; st.alas.on = false; return st };
    const m = A.compute(mix6(desenhada([U])), { layouts: false });
    expect(m.T[0].desenhada).toBe(true);
    expect(m.blc[0].nucleo).toBe(false);
    expect(m.avisos.some(a => /núcleo/.test(a))).toBe(true);
    const mR = A.compute(mix6(desenhada([{ pts: RET, de: 1 }])), { layouts: false });
    expect(mR.blc[0].nucleo).toBe(true);
    expect(mR.avisos.some(a => /núcleo/.test(a))).toBe(false);
  });
  it('“o mix ocupa X% do pavimento” e o Ajustar mix', () => {
    const st = desenhada([{ pts: RET, de: 1 }]), m = A.compute(st, { layouts: false }), t = m.T[0];
    // eficiência real da planta: 200 ÷ unidades desenhadas (≈ 302 m², 77% de 392) — não 200 ÷ (392 × 0,8) = 64%
    expect(m.avisos.some(a => a.includes(`O mix ocupa ${Math.round(200 / t.privAndar * 100)}% do pavimento`))).toBe(true);
    const R = A.blcResumo(st, m);
    expect(R.real).toBe(true); expect(R.priv).toBeCloseTo(t.privAndar, 9); expect(R.efic).toBeCloseTo(t.eficReal, 9); expect(R.eficInf).toBe(0.8);
    expect(R.muda).toBe(true); expect(R.q[0]).toBe(Math.floor(R.util / 100));      // "Ajustar mix" mira a área real para unidades
    st.produto.mix[0].qtd = R.q[0];
    const m2 = A.compute(st, { layouts: false });
    expect(m2.avisos.some(a => /O mix ocupa/.test(a))).toBe(false);
    expect(A.blcResumo(st, m2).muda).toBe(false);
  });
});

describe('C1 — formatos prontos', () => {
  const slot = [[4, 6], [28, 6], [28, 46], [4, 46]];   // 24 × 40
  for (const [tipo] of [['ret'], ['L'], ['U'], ['T'], ['H'], ['patio']]) {
    it(`${tipo}: área pedida e dentro da faixa da torre (nas 4 rotações)`, () => {
      for (let rot = 0; rot < 4; rot++) {
        const r = A.blcFormato(tipo, slot, 560, { rot });
        const b = r.bloco, area = A.G.area(b.pts) - (b.vazios || []).reduce((s, v) => s + A.G.area(v), 0);
        expect(Math.abs(area - 560)).toBeLessThan(1);
        expect(A.G.area(A.G.clipToPoly(b.pts, slot))).toBeCloseTo(A.G.area(b.pts), 6);
        expect(b.tipo).toBe(tipo);
        if (tipo === 'patio') expect(b.vazios.length).toBe(1);
        if (tipo !== 'ret' && tipo !== 'patio') expect(b.pts.length).toBeGreaterThan(5);
      }
    });
  }
  it('alvo maior que a faixa: ocupa a faixa toda e marca "curto"', () => {
    const r = A.blcFormato('ret', slot, 2000);
    expect(r.curto).toBe(true);
    expect(r.A).toBeCloseTo(24 * 40, 6);
  });
  it('aplicar formato na torre: área atual mantida; clicar de novo gira 90°', () => {
    const st = base({ tor: [] }); st.custom.tor = [];
    const A0 = A.massing(st).T[0].A, slot = A.blcAutoPlanta(st, 0).slot;
    for (const tipo of ['ret', 'L', 'U', 'T', 'H', 'patio']) {
      const r = A.blcAplicaFormato(st, 0, tipo);
      expect(st.blocos.modo).toBe('desenhada');
      const m = A.massing(st);
      expect(m.T[0].desenhada).toBe(true);
      expect(r.curto).toBe(false);
      expect(Math.abs(m.T[0].A - A0)).toBeLessThan(1.5);
      expect(A.G.area(A.G.clipToPoly(r.bloco.pts, slot))).toBeCloseTo(A.G.area(r.bloco.pts), 6);
    }
    A.blcAplicaFormato(st, 0, 'L'); expect(st.blocos.torres[0].blocos[0].rot).toBe(0);
    A.blcAplicaFormato(st, 0, 'L'); expect(st.blocos.torres[0].blocos[0].rot).toBe(1);
  });
  it('faixa apertada (estudo exemplo, 2 torres): o formato fica na faixa e avisa que não chegou à área', () => {
    const st = estado(A, {}), A0 = A.massing(st).T[0].A;
    const r = A.blcAplicaFormato(st, 0, 'U');
    expect(r.curto).toBe(true);
    expect(r.A).toBeLessThan(A0);
    expect(A.massing(st).T[0].A).toBeCloseTo(r.A, 6);
  });
});

describe('Fase 0 — faixas lidas por sol, orçamento, unidades e export', () => {
  const FX = [{ ate: 12, af: 2, div: 0 }, { ate: 0, af: 2, div: 6 }];
  const esc = () => estado(A, {
    lote: { pts: [[0, 0], [30, 0], [30, 50], [0, 50]], front: [0], principal: 0, rec: [{}, {}, {}, {}] },
    regras: { recFrente: 4, toTorre: 1, toEmb: 1, hMax: 80, caMax: 20 },
    produto: { torres: [{ pav: 10 }], subsolos: 0, garAcima: 0, peTerreo: 4.5, pe: 3, efic: 0.8, atico: false, garTerOn: false,
      cob: { on: false, qtd: 1, area: 100, preco: 1 }, mix: [{ nome: 'A', area: 100, qtd: 10, preco: 10000, sac: 0 }],
      lazer: { hall: 0, itens: [{ nome: 'Salão', area: 30, local: 'terreo' }] } },
    forma: { on: true, prog: true, escalonar: true, faixas: FX },
  });
  it('prismas (sol, vento, vizinhança): um por faixa, empilhados até o topo', () => {
    const st = esc(), m = A.massing(st), t = m.T[0];
    const pr = A.prisms(st, m).filter(p => p.own && p.poly !== m.emb);
    expect(pr.length).toBe(t.faixas.length);
    expect(pr[0].z0).toBeCloseTo(m.hEmb, 9); expect(pr[pr.length - 1].z1).toBeCloseTo(t.H, 9);
    for (let k = 1; k < pr.length; k++) { expect(pr[k].z0).toBeCloseTo(pr[k - 1].z1, 9); expect(A.G.area(pr[k].poly)).toBeLessThan(A.G.area(pr[k - 1].poly)) }
    const reta = estado(A, {}), mr = A.massing(reta);
    expect(A.prisms(reta, mr).filter(p => p.own).length).toBe(1 + mr.T.length);   // sem escalonar: um prisma por torre
  });
  it('orçamento: fachada pela planta de cada faixa', () => {
    const st = esc(), m = A.compute(st, { layouts: false }), t = m.T[0];
    const d = A.orcDrivers(st, m), emb = A.G.perimeter(m.emb) * m.hEmb;
    const esperado = t.faixas.reduce((s, f, k) => s + A.G.perimeter(f.plate) * ((k === t.faixas.length - 1 ? t.H : f.z1) - (k ? f.z0 : m.hEmb)), 0);
    expect(d.fachA - emb).toBeCloseTo(esperado, 6);
    expect(d.fachA - emb).toBeLessThan(A.G.perimeter(t.plate) * (t.H - m.hEmb));
  });
  it('unidades: a tabela segue o mix de cada faixa (andar recuado perde unidade)', () => {
    const st = esc(), m = A.compute(st, { layouts: false }), t = m.T[0];
    const U = m.unidades.filter(u => !u.cob);
    expect(U.length).toBe(m.units);
    const f2 = t.faixas[1];
    expect(U.filter(u => u.andar === f2.de).length).toBe(f2.un);
    expect(U.find(u => u.andar === f2.de).area).toBeCloseTo(100 * f2.r, 6);
    expect(U.filter(u => u.andar === f2.de && u.sol).length).toBeGreaterThan(0);   // casadas com a planta recortada
  });
  it('planta por andar (export IFC/DXF)', () => {
    const st = esc(), t = A.massing(st).T[0];
    const f = t.faixas[t.faixas.length - 1];
    expect(A.torrePlantaAndar(t, 1)).toBe(t.plate);
    expect(A.torrePlantaAndar(t, f.ate)).toBe(f.plate);
  });
});

/* ===================================== C2 — pilha de blocos ===================================== */
// lote 30 × 50, 12 pavimentos (H = 4,5 + 36 = 40,5 m → afastamento 5,06 m): embasamento largo 1º–3º, tipo 4º–10º, cobertura recuada 11º–12º
const EMB = [[6, 8], [24, 8], [24, 44], [6, 44]];          // 18 × 36 = 648 m²
const TOP = [[10, 16], [20, 16], [20, 36], [10, 36]];      // 10 × 20 = 200 m²
const pilha = (blocos, pav = 12, extra = {}) => { const st = desenhada([null], extra); st.produto.torres = [{ pav }]; st.blocos.torres = [{ blocos }]; return st };
const tres = () => pilha([{ pts: EMB, de: 1 }, { pts: RET, de: 4 }, { pts: TOP, de: 11 }]);

describe('C2 — um bloco continua igual ao C1', () => {
  it('bloco acima do total de andares é ignorado (com aviso) e os números ficam os do bloco único', () => {
    const s1 = pilha([{ pts: RET, de: 1 }]), r1 = num(A, s1);
    const s2 = pilha([{ pts: RET, de: 1 }, { pts: TOP, de: 15 }]), r2 = num(A, s2);
    expect(r1.m.T[0].faixas.length).toBe(1);
    expect(r2.m.T[0].faixas.length).toBe(1);
    expect(r2.m.tiposA).toBeCloseTo(r1.m.tiposA, 9); expect(r2.m.units).toBe(r1.m.units); expect(r2.f.vgv).toBeCloseTo(r1.f.vgv, 4);
    expect(r2.m.avisos.some(a => /começa no 15º andar e a torre tem 12/.test(a))).toBe(true);
    expect(r1.m.T[0].Aproj).toBeCloseTo(392, 9);
  });
});

describe('C2 — pilha de 3 blocos: áreas por faixa conferidas à mão', () => {
  it('faixas, bloco de referência, mix por faixa, CA, privativa, unidades e VGV', () => {
    const st = tres(), { m, f } = num(A, st), t = m.T[0], mA = A.massing(st), tA = mA.T[0];
    // faixas: 1º–3º (648), 4º–10º (392, referência: mais andares tipo), 11º–12º (200)
    expect(t.faixas.map(x => [x.de, x.ate, x.n])).toEqual([[1, 3, 3], [4, 10, 7], [11, 12, 2]]);
    expect(t.faixas.map(x => x.A)).toEqual([648, 392, 200]);
    expect(t.blcRef).toBe(1); expect(t.A).toBeCloseTo(392, 9); expect(t.plate).toBe(t.faixas[1].plate);
    // massing (antes do pavimento tipo), área × eficiência informada: referência 2 un. de 100 m² com fator 392 × 0,8 ÷ 200 = 1,568 (C1).
    // Embasamento: 518,4 ÷ 1,568 = 330,6 → 3 un. → fator 1,728. Cobertura recuada: 160 ÷ 1,568 = 102 → 1 un. → fator 1,6
    expect(tA.faixas.map(x => x.qtd[0])).toEqual([3, 2, 1]);
    expect(tA.faixas[1].r).toBeCloseTo(1.568, 9); expect(tA.faixas[0].r).toBeCloseTo(1.728, 9); expect(tA.faixas[2].r).toBeCloseTo(1.6, 9);
    expect(mA.privRes).toBeCloseTo((648 * 3 + 392 * 7 + 200 * 2) * 0.8, 6);        // 4.070,4 m² (área × eficiência em cada faixa)
    // compute (eficiência real da planta): privativa de cada faixa = unidades desenhadas no layout dela
    const lay = x => x.lay || m.tipo[0], un = x => lay(x).units.filter(u => !u.livre);
    t.faixas.forEach(x => { expect(x.priv).toBeCloseTo(un(x).reduce((s, u) => s + u.area, 0), 6); expect(x.qtd[0]).toBe(un(x).length);
      expect(x.r).toBeCloseTo(x.priv / (100 * x.qtd[0]), 9); expect(x.eficReal).toBeCloseTo(x.priv / x.A, 9) });
    expect(t.faixas[1].qtd[0]).toBe(2);
    expect(m.tiposA).toBeCloseTo(648 * 3 + 392 * 7 + 200 * 2, 6);                 // 5.088 m² (área construída não muda)
    const priv = t.faixas.reduce((s, x) => s + x.nTipo * x.priv, 0), nUn = t.faixas.reduce((s, x) => s + x.nTipo * x.qtd[0], 0);
    expect(m.privRes).toBeCloseTo(priv, 6); expect(m.privRes).toBeLessThan(mA.privRes);
    expect(m.units).toBe(nUn); expect(m.unitRows[0].n).toBe(nUn); expect(m.unitRows[0].area).toBeCloseTo(priv, 6);
    expect(m.eficReal).toBeCloseTo(priv / m.tiposA, 9);
    const R = st.regras, comp = m.tiposA * (1 - R.ncTipo) + m.lojaA + (R.ncTerreo ? 0 : m.hallA + m.lzExtraA) + (R.ncGaragem ? 0 : m.garA);
    expect(m.CA).toBeCloseTo(comp / m.A, 9);
    expect(t.Aproj).toBeCloseTo(648, 9);                                            // TO pela maior projeção
    // VGV = privativa de cada faixa × preço (mesmo fator de reajuste/permuta do estudo com um bloco)
    const s1 = pilha([{ pts: RET, de: 1 }]), r1 = num(A, s1), F = st.fin;
    const k = r1.f.vgv / (r1.m.unitRows[0].area * 10000 + r1.m.lojaPriv * F.precoLoja);
    expect(f.vgv).toBeCloseTo(k * (priv * 10000 + m.lojaPriv * F.precoLoja), 2);
  });
  it('TO acima da regra é medida pela maior projeção da pilha', () => {
    const st = tres(); st.regras.toTorre = 0.4;                                     // 600 m² < 648
    const m = A.compute(st, { layouts: false });
    expect(m.avisos.some(a => /As torres ocupam 648 m²/.test(a))).toBe(true);
  });
  it('o último bloco estica com o stepper; o Máx continua funcionando', () => {
    const st = tres(); st.produto.torres[0].pav = 15;
    const t = A.massing(st).T[0];
    expect(t.faixas[2].ate).toBe(15); expect(t.faixas[2].n).toBe(5);
    expect(t.Atot).toBeCloseTo(648 * 3 + 392 * 7 + 200 * 5, 6);
    st.regras.hMax = 30; expect(A.maxPav(st)).toBe(8);                             // 4,5 + 8 × 3 = 28,5 m (o bloco de cima fica de fora)
    st.produto.torres[0].pav = 8; expect(A.massing(st).T[0].faixas.length).toBe(2);
  });
});

describe('C2 — edição da pilha (puras)', () => {
  it('"+ Bloco": cópia do de cima, começando no meio da faixa de cima; faixa de um andar não divide', () => {
    const st = pilha([{ pts: RET, de: 1, tipo: 'ret' }], 17);
    const nb = A.blcMaisBloco(st, 0);
    expect(nb.de).toBe(10); expect(nb.pts).toEqual(RET); expect(nb.pts).not.toBe(st.blocos.torres[0].blocos[0].pts);
    expect(A.blcMaisBloco(st, 0).de).toBe(14);                                      // 10º–17º → 14º
    const t = A.massing(st).T[0];
    expect(t.faixas.map(f => [f.de, f.ate])).toEqual([[1, 9], [10, 13], [14, 17]]);
    const st2 = pilha([{ pts: RET, de: 1 }, { pts: TOP, de: 12 }], 12);
    expect(A.blcMaisBloco(st2, 0)).toBe(null);
  });
  it('"Copiar do de baixo" copia o contorno e mantém o andar inicial', () => {
    const st = tres(), c = A.blcCopiaBaixo(st, 0, 2), L = st.blocos.torres[0].blocos;
    expect(c.pts).toEqual(RET); expect(c.de).toBe(11); expect(L[2].pts).not.toBe(L[1].pts);
    expect(A.blcCopiaBaixo(st, 0, 0)).toBe(null);
  });
  it('"Recuar X m": retângulo e L recuados em todas as fachadas; recuo grande demais devolve null', () => {
    const st = pilha([{ pts: EMB, de: 1 }, { pts: EMB, de: 4 }]);
    const nb = A.blcRecua(st, 0, 1, 3, { todas: true });   // C3: o padrão preserva a fachada do núcleo (tests/alas.test.js)
    expect(A.G.area(nb.pts)).toBeCloseTo(12 * 30, 6); expect(nb.de).toBe(4);
    expect(A.blcFora(nb.pts, EMB)).toBeCloseTo(0, 6);
    const off = A.blcOffset(ELE, 2);
    expect(A.G.area(off)).toBeCloseTo(14 * 6 + 4 * 20, 6);                          // ala de 10 → 6 e ala de 8 → 4
    [[8, 12], [22, 12], [22, 18], [12, 18], [12, 38], [8, 38]].forEach((q, k) => { expect(off[k][0]).toBeCloseTo(q[0], 9); expect(off[k][1]).toBeCloseTo(q[1], 9) });
    expect(A.blcOffset(ELE, 5)).toBe(null);                                          // a ala de 8 m some
    expect(A.blcRecua(st, 0, 1, 20, { todas: true })).toBe(null);
  });
  it('apagar bloco: o de baixo estica até o próximo; o 1º apagado passa o andar inicial ao seguinte', () => {
    const st = tres(); A.blcApagaBloco(st, 0, 1);
    expect(A.massing(st).T[0].faixas.map(f => [f.de, f.ate])).toEqual([[1, 10], [11, 12]]);
    A.blcApagaBloco(st, 0, 0); expect(st.blocos.torres[0].blocos[0].de).toBe(1);
  });
  it('formato pronto num bloco de cima fica dentro do bloco de baixo e mantém o andar inicial', () => {
    const st = tres(), r = A.blcAplicaFormato(st, 0, 'L', 2), L = st.blocos.torres[0].blocos;
    expect(L.length).toBe(3); expect(L[2].de).toBe(11); expect(L[2].tipo).toBe('L');
    expect(Math.abs(r.A - 200)).toBeLessThan(1);
    expect(A.blcAreaFora(L[2].pts, RET)).toBeLessThan(0.5);
  });
});

describe('C2 — núcleo contínuo e avisos por bloco', () => {
  it('o mesmo núcleo em todas as faixas; layout por área nos blocos fora da referência', () => {
    const st = tres(), m = A.compute(st, { layouts: false }), t = m.T[0], ref = m.tipo[0];
    const f0 = t.faixas[0];
    expect(f0.lay.core).toBe(ref.core); expect(f0.lay.coreParts).toBe(ref.coreParts);
    expect(A.torreLayAndar(m, 0, 2)).toBe(f0.lay); expect(A.torreLayAndar(m, 0, 5)).toBe(ref);
    const un = f0.lay.units.filter(u => !u.livre);
    expect(un.length).toBe(3); un.forEach(u => expect(u.alvo).toBeCloseTo(100 * f0.r, 9));
    expect(A.blcDentro(ref.core, f0.plate)).toBe(1);
    f0.lay.units.forEach(u => expect(A.G.polysOverlap(A.G.scaleToArea(u.poly, A.G.area(u.poly) * 0.98), ref.core)).toBe(false));
  });
  it('núcleo cortado: aviso no bloco que não contém o núcleo inteiro; bloco que contém, sem aviso', () => {
    const m = A.compute(tres(), { layouts: false });
    expect(m.T[0].faixas[2].nucleoCortado).toBe(true);
    expect(m.blc[0].bl.find(b => b.k === 2).nucleo).toBe(false);
    expect(m.avisos.some(a => /bloco 11º–12º corta o núcleo/.test(a))).toBe(true);
    const st = tres(); st.blocos.torres[0].blocos[2].pts = [[12, 20], [22, 20], [22, 40], [12, 40]];   // 10 × 20 junto à fachada do núcleo
    const m2 = A.compute(st, { layouts: false });
    expect(m2.avisos.some(a => /corta o núcleo/.test(a))).toBe(false);
    const st3 = tres(); st3.blocos.torres[0].blocos[2].pts = RET.map(q => [...q]);   // cópia do tipo: nunca "corta"
    expect(A.compute(st3, { layouts: false }).avisos.some(a => /corta o núcleo/.test(a))).toBe(false);
  });
  it('balanço medido sobre o bloco de baixo (retângulo e L)', () => {
    const big = [[6, 12], [24, 12], [24, 40], [6, 40]];                                // 18 × 28 sobre 14 × 28 → 2 × 4 × 28 = 112 m²
    const m = A.compute(pilha([{ pts: RET, de: 1 }, { pts: big, de: 6 }]), { layouts: false });
    expect(m.blc[0].bl[1].bal).toBeCloseTo(112, 6);
    expect(m.avisos.some(a => /bloco 6º–12º avança 112 m² além do bloco de baixo/.test(a))).toBe(true);
    // bloco de baixo em L (côncavo): amostragem
    const sq = [[6, 10], [24, 10], [24, 40], [6, 40]];                                 // 540 m² sobre a L de 340 → 200 m²
    const mL = A.compute(pilha([{ pts: ELE, de: 1 }, { pts: sq, de: 6 }]), { layouts: false });
    expect(Math.abs(mL.blc[0].bl[1].bal - 200)).toBeLessThan(4);
  });
  it('recuos progressivos (2.4): cada bloco é conferido com o envelope da sua cota', () => {
    const FX = [{ ate: 12, af: 2, div: 0 }, { ate: 0, af: 2, div: 6 }];
    const W = [[3, 8], [27, 8], [27, 44], [3, 44]];                                    // 3 m das divisas: vale embaixo (≈ 2,25 m), não no topo (6,75 m)
    const s1 = pilha([{ pts: W, de: 1 }, { pts: RET, de: 4 }], 12, {}); s1.forma = { ...s1.forma, on: true, prog: true, escalonar: true, faixas: FX };
    const m1 = A.compute(s1, { layouts: false });
    expect(m1.blc[0].bl[0].foraRecuo).toBeCloseTo(0, 6);
    expect(m1.avisos.some(a => /sobre os recuos/.test(a))).toBe(false);
    const s2 = pilha([{ pts: W, de: 1 }], 12); s2.forma = { ...s2.forma, on: true, prog: true, escalonar: true, faixas: FX };
    const m2 = A.compute(s2, { layouts: false });
    expect(m2.blc[0].foraRecuo).toBeGreaterThan(50);
    expect(m2.avisos.some(a => /sobre os recuos/.test(a))).toBe(true);
  });
});

describe('C2 — sol, orçamento, unidades e IFC por faixa com a pilha', () => {
  it('prismas: um por bloco, empilhados até o topo', () => {
    const st = tres(), m = A.massing(st), t = m.T[0], pr = A.prisms(st, m).filter(p => p.own && p.poly !== m.emb);
    expect(pr.length).toBe(3);
    expect(pr.map(p => A.G.area(p.poly))).toEqual([648, 392, 200]);
    expect(pr[0].z0).toBeCloseTo(m.hEmb, 9); expect(pr[1].z0).toBeCloseTo(m.hEmb + 9, 9); expect(pr[2].z0).toBeCloseTo(m.hEmb + 30, 9); expect(pr[2].z1).toBeCloseTo(t.H, 9);
  });
  it('orçamento: fachada e carga somando por bloco', () => {
    const st = tres(), m = A.compute(st, { layouts: false }), d = A.orcDrivers(st, m), emb = A.G.perimeter(m.emb) * m.hEmb;
    expect(d.fachA - emb).toBeCloseTo(2 * (18 + 36) * 9 + 2 * (14 + 28) * 21 + 2 * (10 + 20) * 6, 6);
    const s1 = pilha([{ pts: RET, de: 1 }]), d1 = A.orcDrivers(s1, A.compute(s1, { layouts: false }));
    expect(d.carga - d1.carga).toBeCloseTo(5088 - 392 * 12, 6);
  });
  it('unidades (tabela de vendas e sol): cada andar segue o mix e a planta do seu bloco', () => {
    const m = A.compute(tres(), { layouts: false }), U = m.unidades.filter(u => !u.cob), [f0, , f2] = m.T[0].faixas;
    expect(U.length).toBe(m.units);
    // eficiência real da planta: cada unidade com o tamanho médio das desenhadas no seu bloco; a tabela soma a privativa
    expect(U.filter(u => u.andar === 1).length).toBe(f0.qtd[0]); expect(U.find(u => u.andar === 1).area).toBeCloseTo(100 * f0.r, 6);
    expect(U.filter(u => u.andar === 12).length).toBe(f2.qtd[0]); expect(U.find(u => u.andar === 12).area).toBeCloseTo(100 * f2.r, 6);
    expect(U.reduce((s, u) => s + u.area, 0)).toBeCloseTo(m.privRes, 6);
    expect(U.filter(u => u.andar === 1 && u.sol).length).toBe(f0.qtd[0]);          // casadas com o layout do bloco
  });
  it('planta e layout por andar (IFC/DXF)', () => {
    const m = A.compute(tres(), { layouts: false }), t = m.T[0];
    expect(A.torrePlantaAndar(t, 2)).toBe(t.faixas[0].plate); expect(A.torrePlantaAndar(t, 7)).toBe(t.plate); expect(A.torrePlantaAndar(t, 12)).toBe(t.faixas[2].plate);
    expect(A.torreLayAndar(m, 0, 12)).toBe(t.faixas[2].lay);
    expect(A.serialProblemas(m)).toEqual([]);                                        // o modelo continua clonável (Worker)
  });
});

describe('torreAjustaMix', () => {
  const mix = [{ area: 50, qtd: 4 }, { area: 80, qtd: 2 }];   // 360 m²
  it('mantém a proporção e não passa do alvo', () => {
    const q = A.torreAjustaMix(mix, 720);
    expect(q).toEqual([8, 4]);
    const q2 = A.torreAjustaMix(mix, 500);
    const area = q2[0] * 50 + q2[1] * 80;
    expect(area).toBeLessThanOrEqual(500);
    expect(500 - area).toBeLessThan(50);                         // não sobra espaço para outra unidade
  });
  it('tipologia usada fica com ao menos 1 unidade; tipologia zerada continua zerada', () => {
    expect(A.torreAjustaMix([{ area: 50, qtd: 4 }, { area: 80, qtd: 0 }], 60)).toEqual([1, 0]);
    expect(A.torreAjustaMix(mix, 100)).toEqual([1, 1]);          // 130 m² > 100, mas o mínimo é 1 de cada
  });
  it('alvo inválido devolve o mix atual', () => {
    expect(A.torreAjustaMix(mix, 0)).toEqual([4, 2]);
  });
});
