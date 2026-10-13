// Navegador: repositório na nuvem (src/ui/repo-nuvem.js sobre o RepoLocal) contra as rotas reais da API com banco em memória,
// e as partes puras de src/ui/auth.js (modo do app, pode/limite, leitura da volta do servidor).
import { describe, it, expect, beforeEach } from 'vitest';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../tools/bundle.mjs';
import { config } from '../api/_lib/config.js';
import { limpaCacheAcesso } from '../api/_lib/acesso.js';
import { criaRota as rotaEstudos } from '../api/estudos.js';
import { criaRota as rotaVersoes } from '../api/versoes.js';
import { bancoMemoria } from './apoio/banco-memoria.js';

const A = '11111111-1111-4111-8111-111111111111';
const ler = f => fs.readFileSync(path.join(ROOT, 'src', f), 'utf8');

/** contexto de "navegador" com localStorage próprio, LS (de state.js) e os arquivos pedidos */
function navegador(arquivos) {
  const store = new Map();
  const ctx = {
    console, JSON, Math, Date, Promise, URLSearchParams, setTimeout, clearTimeout, crypto: globalThis.crypto,
    localStorage: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(`const LS={get(k){try{const v=localStorage.getItem(k);return v?JSON.parse(v):null}catch(e){return null}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};`, ctx);
  vm.runInContext(arquivos.map(ler).join('\n'), ctx);
  const g = new Proxy({}, { get: (_, k) => vm.runInContext(`typeof ${k}!=="undefined"? ${k} : undefined`, ctx) });
  return { g, store, ctx };
}

/** servidor: as rotas reais (login direto ligado, acesso aberto) com banco em memória; `rede.off` simula sem internet */
function servidor() {
  const banco = bancoMemoria(), rede = { off: false };
  const deps = { cfg: config({ GABARITO_SUPABASE_SECRET_KEY: 'x', GABARITO_LOGIN_DIRETO: '1', GABARITO_ACESSO_ABERTO: '1' }), banco, verifica: async () => ({ sub: A, email: 'a@x.com' }) };
  const rotas = { '/api/estudos': rotaEstudos(() => deps), '/api/versoes': rotaVersoes(() => deps) };
  const api = async (metodo, caminho, corpo) => {
    if (rede.off) throw new TypeError('Failed to fetch');
    const u = new URL(caminho, 'https://gabarito.rixel.com.br');
    const r = await new Promise(ok => {
      const res = { statusCode: 200, setHeader() {}, end(t) { ok({ status: this.statusCode, corpo: t ? JSON.parse(t) : null }) } };
      rotas[u.pathname]({ method: metodo, query: Object.fromEntries(u.searchParams), body: corpo === undefined ? undefined : JSON.parse(JSON.stringify(corpo)), headers: { authorization: 'Bearer t' } }, res);
    });
    if (r.status >= 400) { const e = new Error(r.corpo && r.corpo.motivo || 'HTTP ' + r.status); e.status = r.status; e.corpo = r.corpo; throw e; }
    return r.corpo;
  };
  return { banco, rede, api };
}
function aparelho(srv) {
  const n = navegador(['ui/repo.js', 'ui/repo-nuvem.js']);
  const avisos = [];
  const R = n.g.repoNuvem(n.g.RepoLocal, srv.api, { dono: A, autor: 'Ana', avisa: m => avisos.push(m), agenda: () => 0 });
  return { R, local: n.g.RepoLocal, avisos, n };
}

describe('repositório na nuvem', () => {
  let srv;
  beforeEach(() => { limpaCacheAcesso(); srv = servidor(); });

  it('grava local primeiro e sincroniza; a lista mostra o que já foi para a nuvem', async () => {
    const { R, local } = aparelho(srv);
    expect(R.modo()).toBe('nuvem'); expect(await R.pronto()).toBe('nuvem');
    const e = await R.estudos.put({ nome: 'Lote 1', S: { nome: 'Lote 1', a: 1 }, k: { units: 10 } });
    expect((await local.bruto.um('estudos', e.id)).nuvem).toMatchObject({ pendente: true, rev: 0 });
    expect(srv.banco.T.estudos.length).toBe(0);
    expect(await R.sincroniza()).toBe(0);
    expect(srv.banco.T.estudos[0]).toMatchObject({ id: e.id, nome: 'Lote 1', rev: 1, dono: A });
    expect((await local.bruto.um('estudos', e.id)).nuvem).toMatchObject({ pendente: false, rev: 1 });
    // segunda gravação vai como PUT com a revisão conhecida
    await R.estudos.put({ id: e.id, nome: 'Lote 1b', S: { a: 2 } }); await R.sincroniza();
    expect(srv.banco.T.estudos[0]).toMatchObject({ nome: 'Lote 1b', rev: 2 });
    const l = await R.estudos.list();
    expect(l.map(x => x.nome)).toEqual(['Lote 1b']); expect(l[0].S).toBeUndefined();
    expect((await R.estudos.get(e.id)).S).toEqual({ a: 2 });
  });

  it('sem internet: guarda na fila, lista o local e envia quando a rede volta', async () => {
    const { R } = aparelho(srv);
    srv.rede.off = true;
    const e = await R.estudos.put({ nome: 'Offline', S: { x: 1 } });
    expect(await R.sincroniza()).toBe(1);
    expect((await R.estudos.list()).map(x => x.id)).toEqual([e.id]);
    expect((await R.estudos.get(e.id)).S).toEqual({ x: 1 });
    srv.rede.off = false;
    expect(await R.sincroniza()).toBe(0);
    expect(srv.banco.T.estudos.map(x => x.id)).toEqual([e.id]);
  });

  it('conflito entre aparelhos: vale a última gravação e a versão do outro aparelho vira uma versão', async () => {
    const d1 = aparelho(srv), d2 = aparelho(srv);
    const e = await d1.R.estudos.put({ nome: 'E', S: { v: 0 } }); await d1.R.sincroniza();
    await d2.R.estudos.get(e.id);                                   // aparelho 2 abre (rev 1)
    await d1.R.estudos.put({ id: e.id, nome: 'E', S: { v: 1 } }); await d1.R.sincroniza();   // nuvem: rev 2
    await d2.R.estudos.put({ id: e.id, nome: 'E', S: { v: 2 } }); await d2.R.sincroniza();   // conflito
    expect(srv.banco.T.estudos[0]).toMatchObject({ estado: { v: 2 }, rev: 3 });
    const vs = srv.banco.T.versoes;
    expect(vs.length).toBe(1); expect(vs[0].nome).toMatch(/^Conflito — outro aparelho/); expect(vs[0].estado).toEqual({ v: 1 }); expect(vs[0].auto).toBe(true);
    expect(d2.avisos.length).toBe(1);
    expect((await d2.local.bruto.um('estudos', e.id)).nuvem).toMatchObject({ rev: 3, pendente: false });
  });

  it('versões: a versão criada antes do estudo subir espera por ele; listar junta nuvem e pendentes', async () => {
    const { R } = aparelho(srv);
    const e = await R.estudos.put({ nome: 'E', S: { a: 1 } });
    const v = await R.versoes.put({ estudoId: e.id, nome: 'V1', S: { a: 1 }, k: { margem: 0.2 } });
    expect(v.autor).toBe('Ana');
    expect((await R.versoes.list(e.id)).map(x => x.nome)).toEqual(['V1']);
    await R.sincroniza();
    expect(srv.banco.T.versoes.map(x => x.id)).toEqual([v.id]);
    expect((await R.versoes.get(v.id)).S).toEqual({ a: 1 });
    await R.versoes.remove(v.id); await R.sincroniza();
    expect(srv.banco.T.versoes.length).toBe(0);
  });

  it('excluir vai para a nuvem; estudo apagado em outro aparelho some do cache', async () => {
    const d1 = aparelho(srv), d2 = aparelho(srv);
    const a = await d1.R.estudos.put({ nome: 'A', S: {} }), b = await d1.R.estudos.put({ nome: 'B', S: {} }); await d1.R.sincroniza();
    expect((await d2.R.estudos.list()).length).toBe(2);
    await d2.R.estudos.get(a.id);
    await d1.R.estudos.remove(a.id); await d1.R.sincroniza();
    expect(srv.banco.T.estudos.map(x => x.id)).toEqual([b.id]);
    expect((await d2.R.estudos.list()).map(x => x.id)).toEqual([b.id]);
    expect(await d2.local.bruto.um('estudos', a.id)).toBeNull();
  });

  it('registros só deste navegador (sem `nuvem`) não aparecem na lista da conta', async () => {
    const { R, local } = aparelho(srv);
    await local.estudos.put({ nome: 'Só aqui', S: {} });
    expect(await R.estudos.list()).toEqual([]);
    expect((await local.estudos.list()).filter(e => !e.nuvem).length).toBe(1);
  });
});

describe('auth.js (partes puras)', () => {
  const { g } = navegador(['ui/auth.js']);
  it('modo: app web só nos hosts da Rixel/Vercel ou localhost com ?nuvem=1; link somente leitura é público', () => {
    const m = (href) => { const u = new URL(href); return g.authModoDe({ protocol: u.protocol, hostname: u.hostname, search: u.search, hash: u.hash }); };
    expect(m('https://gabarito.rixel.com.br/')).toBe('nuvem');
    expect(m('https://gabarito-git-main-luiz.vercel.app/')).toBe('nuvem');
    expect(m('https://gabarito.rixel.com.br/#ver=abc')).toBe('local');
    expect(m('https://claude.ai/artifact/x')).toBe('local');
    expect(m('http://localhost:5173/')).toBe('local');
    expect(m('http://localhost:5173/?nuvem=1')).toBe('nuvem');
    expect(g.authModoDe({ protocol: 'file:', hostname: '', search: '', hash: '' })).toBe('local');
    expect(m('https://rixel.com.br.evil.com/')).toBe('local');
  });
  it('pode/limite: tudo liberado (a Rixel decide o acesso; ponto único para limites futuros)', () => {
    expect(g.pode('pdf')).toBe(true); expect(g.pode('qualquer')).toBe(true);
    expect(g.limite('estudos_max')).toBe(Infinity);
  });
  it('lê a volta do servidor e o retorno da recuperação de senha', () => {
    expect(g.authLeUrl('?entrada=sem_acesso&msg=Sem%20plano', '')).toMatchObject({ entrada: 'sem_acesso', msg: 'Sem plano', saiu: false, recuperacao: null });
    expect(g.authLeUrl('?saiu=1', '').saiu).toBe(true);
    expect(g.authLeUrl('', '#access_token=t1&refresh_token=r1&type=recovery').recuperacao).toEqual({ token: 't1', refresh: 'r1' });
    expect(g.authLeUrl('', '#access_token=t1&type=signup').recuperacao).toBeNull();
  });
});
