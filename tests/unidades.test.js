// 1.1 — tabela de vendas: sol nas fachadas, vista, prêmios e preço por unidade
import { describe, it, expect } from 'vitest';
import { carregar, estado } from './harness.js';

const A = carregar();
// lote 30 (x) × 60 (y), norte para cima (+y): a planta tipo fica alongada no eixo norte–sul,
// (circulação a leste, unidades de canto nas pontas norte e sul e de meio voltadas para oeste)
const base = (extra = {}) => {
  const st = estado(A, {
    lote: { pts: [[0, 0], [30, 0], [30, 60], [0, 60]], front: [0], principal: 0, rec: [{}, {}, {}, {}], norte: 0, lat: -28.68 },
    produto: { torres: [{ pav: 10 }], subsolos: 0, garTerOn: false, mix: [{ nome: '2 dorm.', area: 70, qtd: 4, preco: 10000, sac: 0 }], cob: { on: false, qtd: 2, area: 150, preco: 12500 } },
  });
  st.entorno = [];
  Object.assign(st.venda, extra);
  return st;
};
const facing = (st, n, dt, mes) => A.uniSuns(st, mes, 21, dt).filter(s => s.dx * n[0] + s.dy * n[1] > 0.01).length * dt;

describe('1.1 sol nas fachadas', () => {
  it('prédio isolado: horas de sol conferem com a geometria solar (sem obstáculos, a fachada recebe sol sempre que está de frente para ele)', () => {
    const st = base(); const m = A.compute(st);
    const U = m.unidades.filter(u => u.sol);
    expect(U.length).toBe(m.units);
    const D = A.uniDias(st);
    for (const u of U) {
      for (const [k, mes] of [['inverno', D.inverno], ['equinocio', D.equinocio], ['verao', D.verao]]) {
        // horas em que ALGUMA fachada da unidade está de frente para o sol
        const suns = A.uniSuns(st, mes, 21, 0.25);
        const esperado = suns.filter(s => u.fachadas.some(f => s.dx * f.n[0] + s.dy * f.n[1] > 0.01)).length * 0.25;
        expect(u.sol[k]).toBeCloseTo(esperado, 6);
      }
    }
    // valores de referência na latitude −28,7°: fachada norte pega o dia quase todo; a sul quase nada no inverno
    const norte = U.find(u => u.fachadas.length === 1 && u.fachadas[0].dir === 'N') || U.find(u => u.fachadas.some(f => f.dir === 'N'));
    expect(norte.sol.inverno).toBeGreaterThan(9.5);
    expect(norte.sol.equinocio).toBeGreaterThan(11);
    expect(facing(st, [0, -1], 0.25, D.inverno)).toBe(0);           // fachada sul: zero no inverno
    expect(facing(st, [0, 1], 0.25, D.equinocio)).toBeGreaterThan(11.5); // fachada norte no equinócio: ~12 h
    const leste = facing(st, [1, 0], 0.25, D.equinocio);
    expect(leste).toBeGreaterThan(5.5); expect(leste).toBeLessThan(6.5); // fachada leste: meio dia
  });

  it('vizinho alto a oeste sombreia as unidades daquele lado (menos sol e desconto)', () => {
    const st0 = base({ modo: 'unidade' }); const m0 = A.compute(st0);
    const st1 = base({ modo: 'unidade' });
    st1.entorno = [{ nome: 'Torre vizinha', h: 90, pts: [[-23, 5], [-3, 5], [-3, 55], [-23, 55]] }];
    const m1 = A.compute(st1);
    const oeste = u => u.fachadas.length === 1 && u.fachadas[0].dir === 'O';
    const a0 = m0.unidades.find(u => oeste(u) && u.andar === 1), a1 = m1.unidades.find(u => u.id === a0.id);
    expect(a1.sol.media).toBeLessThan(a0.sol.media - 1);
    expect(a1.premios.sol).toBeLessThan(0);
    expect(a1.preco).toBeLessThan(a1.base);      // desconto em relação ao preço base do mix
    expect(a1.preco).toBeLessThan(a0.preco);
    expect(a1.vista).toBeLessThan(a0.vista);
  });
});

describe('1.1 preço por unidade', () => {
  it('unidades de canto norte no topo têm o maior preço', () => {
    const st = base({ modo: 'unidade' }); const m = A.compute(st);
    const top = Math.max(...m.unidades.map(u => u.andar));
    const best = m.unidades.reduce((a, u) => u.preco > a.preco ? u : a);
    expect(best.andar).toBe(top);
    expect(best.fachadas.length).toBeGreaterThanOrEqual(2);                 // canto
    expect(best.fachadas.some(f => f.dir === 'N')).toBe(true);              // voltada para o norte
    // a outra ponta (canto sul) do mesmo andar vale menos
    const sul = m.unidades.filter(u => u.andar === top && u.fachadas.some(f => f.dir === 'S'));
    sul.forEach(u => expect(u.preco).toBeLessThan(best.preco));
  });

  it('soma das unidades = VGV (modo por unidade) e o modo médio não muda nada', () => {
    const st = base({ modo: 'unidade' }); const m = A.compute(st); const f = A.finance(st, m);
    const soma = m.unidades.reduce((s, u) => s + u.preco, 0);
    expect(m.vgvUnidades).toBeCloseTo(soma, 4);
    expect(f.vRes).toBeCloseTo(soma, 4);
    // modo médio: VGV pelo mix; a soma dos preços base bate com o mix
    const st2 = base(); const m2 = A.compute(st2); const f2 = A.finance(st2, m2);
    expect(m2.vgvUnidades).toBeUndefined();
    const mix = m2.unitRows.reduce((s, u) => s + u.area * u.preco, 0) + m2.cobArea * st2.produto.cob.preco;
    expect(f2.vRes).toBeCloseTo(mix, 4);
    expect(m2.unidades.reduce((s, u) => s + u.base, 0)).toBeCloseTo(mix, 4);
    // manter a média: redistribui sem mudar o total
    const st3 = base({ modo: 'unidade', manterMedia: true }); const m3 = A.compute(st3); const f3 = A.finance(st3, m3);
    expect(f3.vRes).toBeCloseTo(mix, 2);
  });

  it('estudo padrão (2 torres, coberturas, entorno vazio): coberturas e tipos somam o mix; VGV de referência intocado', () => {
    const st = estado(A, {}); const m = A.compute(st); const f = A.finance(st, m);
    expect(m.unidades.length).toBe(m.units);
    const mix = m.unitRows.reduce((s, u) => s + u.area * u.preco, 0) + m.cobArea * st.produto.cob.preco;
    expect(m.unidades.reduce((s, u) => s + u.base, 0)).toBeCloseTo(mix, 3);
    expect(f.vRes).toBeCloseTo(mix, 3);
    expect(m.unidades.filter(u => u.cob).length).toBe(m.cobN);
    expect(new Set(m.unidades.map(u => u.id)).size).toBe(m.unidades.length);
  });

  it('desempenho: cálculo em cache, rascunho ao arrastar e estimativa rápida para o otimizador', () => {
    const st = estado(A, {});
    const m = A.compute(st);
    console.log('unidades: cálculo completo', Math.round(m.unidadesMs), 'ms (vm do Node)');
    expect(m.unidadesMs).toBeGreaterThan(0);
    let t = Date.now(); A.unidadesCalc(st, m); const tCache = Date.now() - t;
    expect(tCache).toBeLessThan(500); // só prêmios e preço (geometria em cache)
    // rascunho (arrastando controles): mais grosso e mais rápido
    st.produto.torres[0].pav = 11; const mq = A.compute(st, { layouts: false });
    expect(mq.unidadesRascunho).toBe(true);
    // otimizador: nada de unidades no modo rápido; estimativa separada
    const mo = A.compute(st, { quick: true, layouts: false });
    expect(mo.unidades).toBeUndefined();
    t = Date.now(); const sm = A.unidadesSolMedio(st, mo); const tq = Date.now() - t;
    console.log('unidadesSolMedio', sm.toFixed(2), 'h em', tq, 'ms');
    const mf = A.compute(st); const real = mf.unidades.reduce((s, u) => s + u.sol.media, 0) / mf.unidades.length;
    expect(Math.abs(sm - real)).toBeLessThan(1.5);
    expect(A.unidadesSolMedio(st, mf)).toBeCloseTo(real, 6);
  });
});
