// Utilidades HTTP das funções da Vercel + autenticação comum a todas as rotas.
import { ErroToken } from './jwt.js';
import { verificaAcesso } from './acesso.js';
import { sessaoResolve, COOKIE_SESSAO } from './sessoes.js';

export class ErroHttp extends Error {
  constructor(status, corpo, cab = {}) { super((corpo && (corpo.motivo || corpo.erro)) || String(status)); this.status = status; this.corpo = corpo; this.cab = cab; }
}

export function envia(res, status, corpo, cab = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  for (const [k, v] of Object.entries(cab)) res.setHeader(k, v);
  res.end(corpo === undefined ? '' : JSON.stringify(corpo));
}
export function redireciona(res, url, cab = {}) {
  res.statusCode = 302; res.setHeader('Location', url); res.setHeader('Cache-Control', 'no-store');
  for (const [k, v] of Object.entries(cab)) res.setHeader(k, v);
  res.end('');
}

export async function corpoJSON(req) {
  const le = s => { try { return JSON.parse(s || '{}') } catch { throw new ErroHttp(400, { erro: 'json_invalido' }) } };
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') return le(req.body);
    if (Buffer.isBuffer(req.body)) return le(req.body.toString('utf8'));
    return req.body;
  }
  if (typeof req.on !== 'function') return {};
  return le(await new Promise((ok, falha) => { let s = ''; req.on('data', c => { s += c }); req.on('end', () => ok(s)); req.on('error', falha); }));
}

export function query(req) {
  if (req.query) return req.query;
  try { return Object.fromEntries(new URL(req.url, 'http://x').searchParams) } catch { return {} }
}

export function cookies(req) {
  const out = {}; const h = (req.headers && (req.headers.cookie || req.headers.Cookie)) || '';
  for (const p of String(h).split(';')) { const i = p.indexOf('='); if (i > 0) { try { out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()) } catch { /* cookie malformado */ } } }
  return out;
}
export function cookie(nome, valor, o = {}) {
  const partes = [`${nome}=${encodeURIComponent(valor)}`, `Path=${o.path || '/'}`, 'HttpOnly', 'Secure', `SameSite=${o.sameSite || 'Lax'}`];
  if (o.maxAge != null) partes.push(`Max-Age=${Math.floor(o.maxAge)}`);
  return partes.join('; ');
}

const cab = (req, k) => (req.headers && (req.headers[k] || req.headers[k.toLowerCase()])) || '';

/**
 * Autentica o pedido.
 *  - cookie `gab_sessao` (caminho A, principal) → sessão do Gabarito, reconferida na Rixel a cada 60 s.
 *  - `Authorization: Bearer <token do Auth da Rixel>` (caminho B, só com GABARITO_LOGIN_DIRETO=1).
 * Com `exigeAcesso` (padrão), quem não tem acesso recebe 403 com o motivo.
 * @returns {Promise<{sub:string,email:string,nome:string,tipo:string,token?:string,acesso:any}>}
 */
export async function autentica(req, deps, { exigeAcesso = true, escrita = false } = {}) {
  const auth = cab(req, 'authorization');
  let quem;
  if (/^Bearer\s+/i.test(auth)) {
    if (!deps.cfg.loginDireto) throw new ErroHttp(401, { erro: 'login_direto_desligado', motivo: 'Entre pela Rixel.' });
    const token = auth.replace(/^Bearer\s+/i, '').trim();
    try { const v = await deps.verifica(token); quem = { sub: v.sub, email: v.email, nome: '', tipo: 'rixel', token }; }
    catch (e) { throw new ErroHttp(401, { erro: e instanceof ErroToken ? e.motivo : 'invalido', motivo: e.message }); }
    quem.acesso = await verificaAcesso({ token, sub: quem.sub }, deps);
  } else {
    const c = cookies(req)[COOKIE_SESSAO];
    if (!c) throw new ErroHttp(401, { erro: 'sem_sessao', motivo: 'Entre com a sua conta da Rixel.' });
    // sessão por cookie: escrita exige o cabeçalho próprio (um site de fora não consegue mandá-lo sem CORS)
    if (escrita && cab(req, 'x-gabarito') !== '1') throw new ErroHttp(403, { erro: 'csrf', motivo: 'Pedido recusado.' });
    const s = await sessaoResolve(c, deps);
    quem = { sub: String(s.sub), email: '', nome: '', tipo: 'produto', acesso: { ok: true, plano: null, recursos: {}, motivo: '', via: 'lancamento' } };
  }
  if (exigeAcesso && !quem.acesso.ok) throw new ErroHttp(403, { erro: 'sem_acesso', motivo: quem.acesso.motivo });
  return quem;
}

/**
 * Monta o handler da Vercel a partir de {GET, POST, PUT, DELETE}. Cada função recebe (ctx) com
 * {req, res, q, corpo(), quem, deps} e devolve {status?, corpo}. `obterDeps` é chamada a cada pedido (os testes injetam as suas).
 */
export function rota(metodos, obterDeps, o = {}) {
  return async function handler(req, res) {
    const fn = metodos[req.method];
    if (!fn) return envia(res, 405, { erro: 'metodo' }, { Allow: Object.keys(metodos).join(', ') });
    try {
      const deps = await obterDeps();
      const quem = await autentica(req, deps, { exigeAcesso: o.exigeAcesso !== false, escrita: req.method !== 'GET' });
      if (!o.semBanco && !deps.banco) throw new ErroHttp(503, { erro: 'banco', motivo: 'Banco do Gabarito não configurado (GABARITO_SUPABASE_SECRET_KEY).' });
      const out = await fn({ req, res, q: query(req), corpo: () => corpoJSON(req), quem, deps });
      if (out === undefined) return;
      return envia(res, out.status || 200, out.corpo);
    } catch (e) {
      if (e instanceof ErroHttp) return envia(res, e.status, e.corpo, e.cab);
      console.error('[api]', (e && e.stack) || e);
      return envia(res, 500, { erro: 'interno', motivo: 'Erro no servidor.' });
    }
  };
}
