// Carrega o código de cálculo (núcleo + src/calc) num contexto isolado do Node, sem navegador.
// Uso nos testes:  const A = carregar();  A.compute(A.S)  ·  A.finance(st, m)  ·  A.G.area(p)  (A.G = namespace de geometria do app)
// Cada chamada de carregar() cria um contexto novo (estado limpo).
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { calcSource, ROOT } from '../tools/bundle.mjs';

export function carregar(estado) {
  const store = new Map();
  if (estado) store.set('gabarito.v2', JSON.stringify(estado));
  const ctx = {
    console, Math, JSON, Date, performance: { now: () => Date.now() },
    localStorage: { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
    document: undefined, window: undefined, self: undefined,
    setTimeout, clearTimeout, structuredClone,
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(calcSource(), ctx, { filename: 'calc-bundle.js' });
  // as declarações const/let/function do script ficam no escopo global do contexto: o Proxy as resolve por nome
  return new Proxy({}, { get: (_, k) => typeof k === 'string' ? vm.runInContext(`typeof ${k}!=="undefined"? ${k} : undefined`, ctx) : undefined });
}

/** estudos de referência em tests/cenarios/*.json ({nome, S: estadoParcial, esperado}) */
export function cenarios() {
  const d = path.join(ROOT, 'tests', 'cenarios');
  return fs.existsSync(d) ? fs.readdirSync(d).filter(f => f.endsWith('.json')).sort().map(f => ({ arquivo: f, ...JSON.parse(fs.readFileSync(path.join(d, f), 'utf8')) })) : [];
}

/** monta um estado completo a partir do padrão + alterações parciais */
export function estado(G, parcial = {}) {
  const st = G.clone(G.DEF);
  return G.merge(st, G.clone(parcial));
}
