// Itens 0.3 / 0.4 / 4.1 (plataforma): diferenças do histórico (desfazer/refazer), serialização do modelo para o Web Worker
// e restauração exata de versões. Funções puras em src/calc/histdiff.js e src/calc/serial.js.
import { describe, it, expect } from 'vitest';
import { carregar, estado } from './harness.js';

const A = carregar();
const J = o => JSON.parse(JSON.stringify(o));

describe('histDiff / histPatch', () => {
  it('ida e volta em mudanças típicas do estado', () => {
    const a = estado(A);
    const b = J(a);
    b.produto.subsolos = 3;                              // número
    b.nome = 'Outro nome';                               // texto
    b.lote.pts[2] = [40, 55];                            // vértice arrastado
    b.lote.pts.push([10, 60]); b.lote.rec.push({});      // vértice novo (array muda de tamanho)
    b.estudo.off = { 's1:3': 1 }; b.estudo.vtipo = { 's1:4': 'pcd' };   // vagas marcadas
    b.estudo.rampa = { x: 3, y: 4, a: 90 };              // null → objeto
    delete b.cfd.semente;                                 // chave removida
    b.produto.torres.pop();                               // torre removida
    const fwd = A.histDiff(a, b), back = A.histDiff(b, a);
    expect(fwd.length).toBeGreaterThan(0);
    expect(A.histPatch(a, fwd)).toEqual(b);
    expect(A.histPatch(b, back)).toEqual(a);
    // não altera os originais
    expect(a.produto.subsolos).toBe(estado(A).produto.subsolos);
  });
  it('estados iguais não geram operações', () => {
    const a = estado(A);
    expect(A.histDiff(a, J(a))).toEqual([]);
  });
  it('diferenças são pequenas (não guardam o estado inteiro)', () => {
    const a = estado(A), b = J(a); b.fin.cub = 3300;
    const ops = A.histDiff(a, b);
    expect(ops).toEqual([{ p: ['fin', 'cub'], v: 3300 }]);
    expect(A.histSize(ops)).toBeLessThan(80);
  });
  it('pilha de 200 passos desfeitos e refeitos volta exatamente', () => {
    let cur = estado(A); const ini = J(cur), stack = [];
    for (let i = 0; i < 200; i++) {
      const nx = J(cur);
      if (i % 3 === 0) nx.produto.torres[0].pav = 4 + (i % 20);
      else if (i % 3 === 1) nx.lote.pts[1] = [34 + i * 0.01, i * 0.02];
      else nx.estudo.off['s1:' + i] = 1;
      stack.push({ fwd: A.histDiff(cur, nx), back: A.histDiff(nx, cur) }); cur = nx;
    }
    const fim = J(cur);
    for (let i = stack.length - 1; i >= 0; i--) cur = A.histPatch(cur, stack[i].back);
    expect(cur).toEqual(ini);
    for (const s of stack) cur = A.histPatch(cur, s.fwd);
    expect(cur).toEqual(fim);
  });
  it('histOverlay: a versão manda, inclusive arrays vazios e null', () => {
    const base = { a: 1, b: { c: [1, 2], d: 'x' }, novo: 5 }, snap = { a: 2, b: { c: [], e: null } };
    expect(A.histOverlay(J(base), snap)).toEqual({ a: 2, b: { c: [], d: 'x', e: null }, novo: 5 });
  });
});

describe('serialização do modelo (Worker → página)', () => {
  const m = A.compute(A.S);
  it('o modelo completo é clonável (structured clone)', () => {
    expect(A.serialProblemas(m)).toEqual([]);
    const c = structuredClone(m);
    expect(c.units).toBe(m.units);
    expect(c.vagas).toBe(m.vagas);
    // a malha de alcance da garagem continua typed array
    const k = Object.keys(c.gar)[0];
    expect(ArrayBuffer.isView(c.gar[k].reach)).toBe(true);
  });
  it('o financeiro calculado sobre o clone é idêntico', () => {
    const f1 = A.finance(A.S, m), f2 = A.finance(A.S, structuredClone(m));
    expect(f2.vgv).toBe(f1.vgv); expect(f2.lucro).toBe(f1.lucro); expect(f2.margem).toBe(f1.margem); expect(f2.tirA).toBe(f1.tirA);
  });
  it('serialLimpa tira funções, mantém ciclos e typed arrays', () => {
    const o = { n: 1, fn: () => 1, arr: [1, () => 2], t: new Int32Array([1, 2, 3]) }; o.eu = o;
    expect(A.serialProblemas(o).some(p => p.includes('fn'))).toBe(true);
    const l = A.serialLimpa(o);
    expect('fn' in l).toBe(false); expect(l.arr).toEqual([1, null]); expect(l.eu).toBe(l); expect(l.t[2]).toBe(3);
    expect(() => structuredClone(l)).not.toThrow();
  });
});

describe('versões: restaurar reproduz os números', () => {
  it('estado salvo → restaurado (padrões + versão por cima) dá os mesmos números', () => {
    const st = estado(A, { produto: { subsolos: 1, torres: [{ pav: 10 }] }, estudo: { off: { 's1:2': 1 } } });
    const m1 = A.compute(st), k1 = A.histNums(m1, A.finance(st, m1));
    const snap = J(st);
    const rest = A.histOverlay(A.merge(A.clone(A.DEF), J(snap)), J(snap));
    expect(rest).toEqual(snap);
    const m2 = A.compute(rest), k2 = A.histNums(m2, A.finance(rest, m2));
    expect(k2).toEqual(k1);
  });
  it('uma versão antiga sem campos novos ganha os padrões e abre', () => {
    const snap = J(estado(A)); delete snap.cfd; delete snap.produto.garTerOn;
    const rest = A.histOverlay(A.merge(A.clone(A.DEF), J(snap)), J(snap));
    expect(rest.cfd).toBeTruthy();
    expect(typeof rest.produto.garTerOn).toBe('boolean');
  });
});
