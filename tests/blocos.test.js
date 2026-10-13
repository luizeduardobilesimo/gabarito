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
