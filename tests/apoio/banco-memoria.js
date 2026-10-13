// Banco em memória com a mesma interface de api/_lib/banco.js (sel/ins/upd/del + filtros), para testar as rotas.
// Reproduz o que o esquema faz sozinho: ids, datas, versões em cascata ao apagar o estudo.
import { randomUUID } from 'node:crypto';

const copia = o => JSON.parse(JSON.stringify(o));
function casa(linha, f = {}) {
  return Object.entries(f).every(([k, v]) => {
    if (v === undefined) return true;
    if (k === '$ou') return v.some(o => Object.entries(o).every(([c, x]) => String(linha[c]) === String(x)));
    if (v && typeof v === 'object' && Array.isArray(v.in)) return v.in.map(String).includes(String(linha[k]));
    if (v && typeof v === 'object' && 'is' in v) return linha[k] === v.is || (v.is === null && linha[k] == null);
    return String(linha[k]) === String(v);
  });
}
const colsDe = (l, cols) => cols === '*' ? copia(l) : Object.fromEntries(cols.split(',').map(c => [c, l[c] === undefined ? null : copia(l[c])]));

export function bancoMemoria(inicial = {}) {
  const T = { estudos: [], versoes: [], cidades_regras: [], perfis: [], sessoes: [], ...copia(inicial) };
  const tab = n => (T[n] = T[n] || []);
  const agora = () => new Date().toISOString();
  return {
    tipo: 'memoria', T,
    async sel(n, { f, cols = '*', ordem, limite } = {}) {
      let l = tab(n).filter(r => casa(r, f));
      if (ordem) { const [c, dir] = ordem.split('.'); l = l.slice().sort((a, b) => String(a[c]).localeCompare(String(b[c])) * (dir === 'desc' ? -1 : 1)); }
      if (limite) l = l.slice(0, limite);
      return l.map(r => colsDe(r, cols));
    },
    async ins(n, linhas) {
      const out = [];
      for (const x of [].concat(linhas)) {
        const r = { id: randomUUID(), criado: agora(), atualizado: agora(), ...copia(x) };
        if (tab(n).some(o => o.id === r.id)) { const e = new Error('duplicate key'); e.status = 409; throw e; }
        tab(n).push(r); out.push(copia(r));
      }
      return out;
    },
    async upd(n, f, dados) {
      const out = [];
      for (const r of tab(n)) if (casa(r, f)) { Object.assign(r, copia(dados)); out.push(copia(r)); }
      return out;
    },
    async del(n, f) {
      const fora = tab(n).filter(r => casa(r, f));
      T[n] = tab(n).filter(r => !casa(r, f));
      if (n === 'estudos') { const ids = fora.map(r => r.id); T.versoes = T.versoes.filter(v => !ids.includes(v.estudo_id)); }
      return fora.map(copia);
    },
  };
}
