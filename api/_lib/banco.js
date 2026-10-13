// Cliente mínimo do PostgREST do projeto Supabase do GABARITO, usado SÓ no servidor com a chave secreta
// (GABARITO_SUPABASE_SECRET_KEY). Todas as tabelas têm RLS ligado e nenhuma política pública: só esta chave lê/grava.
// Filtros: {col: valor} = igual · {col: {in:[…]}} · {col: {is:null}} · {$ou: [{col:valor}, …]} (OU de igualdades).
// A mesma interface tem uma versão em memória nos testes (tests/apoio/banco-memoria.js).

const q = v => {   // valor dentro de in.(…) / or=(…): aspas quando necessário
  const s = String(v);
  return /[,()".\s:]/.test(s) ? '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"' : s;
};
/** filtros → parâmetros da URL do PostgREST */
export function filtrosQS(f = {}) {
  const p = [];
  for (const [k, v] of Object.entries(f)) {
    if (v === undefined) continue;
    if (k === '$ou') { p.push('or=' + encodeURIComponent('(' + v.map(o => Object.entries(o).map(([c, x]) => `${c}.eq.${q(x)}`).join(',')).join(',') + ')')); continue; }
    if (v && typeof v === 'object' && Array.isArray(v.in)) p.push(`${encodeURIComponent(k)}=in.(${encodeURIComponent(v.in.map(q).join(','))})`);
    else if (v && typeof v === 'object' && 'is' in v) p.push(`${encodeURIComponent(k)}=is.${v.is === null ? 'null' : v.is}`);
    else p.push(`${encodeURIComponent(k)}=eq.${encodeURIComponent(String(v))}`);
  }
  return p;
}

export function criaBanco({ url, chave, fetch: f = globalThis.fetch }) {
  if (!url || !chave) return null;
  const base = String(url).replace(/\/+$/, '') + '/rest/v1/';
  const cab = extra => {
    const h = { apikey: chave, 'Content-Type': 'application/json', Accept: 'application/json', ...extra };
    if (/^eyJ/.test(chave)) h.Authorization = 'Bearer ' + chave;   // chave service_role antiga (JWT)
    return h;
  };
  async function pede(metodo, tabela, qs, corpo, prefer) {
    const r = await f(base + tabela + (qs.length ? '?' + qs.join('&') : ''), { method: metodo, headers: cab(prefer ? { Prefer: prefer } : {}), body: corpo === undefined ? undefined : JSON.stringify(corpo) });
    const txt = await r.text();
    let j = null; try { j = txt ? JSON.parse(txt) : null } catch { j = txt }
    if (!r.ok) { const e = new Error(`banco ${metodo} ${tabela}: HTTP ${r.status} ${j && j.message ? j.message : ''}`.trim()); e.status = r.status; e.corpo = j; throw e; }
    return j;
  }
  return {
    tipo: 'postgrest',
    sel: (tabela, { f: filtros, cols = '*', ordem, limite } = {}) => {
      const qs = ['select=' + encodeURIComponent(cols), ...filtrosQS(filtros)];
      if (ordem) qs.push('order=' + encodeURIComponent(ordem));
      if (limite) qs.push('limit=' + limite);
      return pede('GET', tabela, qs).then(r => r || []);
    },
    ins: (tabela, linhas) => pede('POST', tabela, [], linhas, 'return=representation').then(r => r || []),
    upd: (tabela, filtros, dados) => pede('PATCH', tabela, filtrosQS(filtros), dados, 'return=representation').then(r => r || []),
    del: (tabela, filtros) => pede('DELETE', tabela, filtrosQS(filtros), undefined, 'return=representation').then(r => r || []),
  };
}
