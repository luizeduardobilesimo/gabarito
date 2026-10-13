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
  it('copia a forma automática de cada torre sem mudar nenhum número do estudo exemplo', () => {
    const st = estado(A, {}), ref = num(A, st);
    st.produto.torres.forEach((_, i) => A.blcPersonaliza(st, i));
    expect(st.blocos.modo).toBe('desenhada');
    const r = num(A, st);
    r.m.T.forEach((t, i) => { expect(t.desenhada).toBe(true); expect(t.plate).toEqual(ref.m.T[i].plate); expect(t.r).toBeCloseTo(ref.m.T[i].r, 9) });
    ['vgv', 'lucro', 'custoObra', 'margem'].forEach(k => { if (ref.f[k] != null) expect(r.f[k]).toBeCloseTo(ref.f[k], 4) });
    expect(r.m.units).toBe(ref.m.units); expect(r.m.CA).toBeCloseTo(ref.m.CA, 9); expect(r.m.constr).toBeCloseTo(ref.m.constr, 6);
    expect(r.m.avisos.filter(a => !ref.m.avisos.includes(a))).toEqual([]);   // nenhum aviso novo
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
    expect(t.r).toBeCloseTo(340 * 0.8 / 200, 9);
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
    const mix6 = st => { st.produto.mix = [{ nome: 'A', area: 60, qtd: 6, preco: 10000, sac: 0 }]; return st };
    const m = A.compute(mix6(desenhada([U])), { layouts: false });
    expect(m.T[0].desenhada).toBe(true);
    expect(m.blc[0].nucleo).toBe(false);
    expect(m.avisos.some(a => /núcleo/.test(a))).toBe(true);
    const mR = A.compute(mix6(desenhada([{ pts: RET, de: 1 }])), { layouts: false });
    expect(mR.blc[0].nucleo).toBe(true);
    expect(mR.avisos.some(a => /núcleo/.test(a))).toBe(false);
  });
  it('“o mix ocupa X% do pavimento” e o Ajustar mix', () => {
    const st = desenhada([{ pts: RET, de: 1 }]), m = A.compute(st, { layouts: false });
    expect(m.avisos.some(a => /O mix ocupa 64% do pavimento/.test(a))).toBe(true);   // 200 ÷ (392 × 0,8)
    const R = A.blcResumo(st, m);
    expect(R.muda).toBe(true);
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
