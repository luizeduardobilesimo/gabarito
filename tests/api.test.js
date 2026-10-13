// Servidor (funções da Vercel em api/): lançamento pela Rixel (PKCE + sessão do Gabarito), login direto (token ES256 +
// tool_contract), rotas de dados com dono e conflito de revisão. A Rixel é simulada com as assinaturas EXATAS das RPCs.
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { generateKeyPair, exportJWK, SignJWT, createLocalJWKSet } from 'jose';
import { config } from '../api/_lib/config.js';
import { criaVerificadorRixel } from '../api/_lib/jwt.js';
import { verificaAcesso, limpaCacheAcesso } from '../api/_lib/acesso.js';
import { validaClaims, statusAtivo, sha256b64url, sha256hex, pkceGera, lancarUrl, CHALLENGE_OK, VERIFIER_OK } from '../api/_lib/rixel.js';
import { criaBanco, filtrosQS } from '../api/_lib/banco.js';
import { criaRota as rotaEstudos } from '../api/estudos.js';
import { criaRota as rotaVersoes } from '../api/versoes.js';
import { criaRota as rotaRegras } from '../api/regras.js';
import { criaRota as rotaEu } from '../api/eu.js';
import { criaRota as rotaIniciar } from '../api/rixel/iniciar.js';
import { criaRota as rotaCallback } from '../api/rixel/callback.js';
import { criaRota as rotaSair } from '../api/rixel/sair.js';
import { bancoMemoria } from './apoio/banco-memoria.js';

const RIXEL = 'https://dolwuqozocfyrutcdbsa.supabase.co';
const ISS = RIXEL + '/auth/v1';
const TOOL = '7d1f0c2a-1111-4222-8333-944455556666';
const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222';

/* ---------- utilidades ---------- */
function resposta(status, corpo) { return { ok: status >= 200 && status < 300, status, text: async () => (corpo === undefined ? '' : JSON.stringify(corpo)), json: async () => corpo }; }
/** fetch falso: rotas por trecho da URL → (url, init, corpo) → [status, corpo] */
function fetchFalso(rotas) {
  const chamadas = [];
  const f = async (url, init = {}) => {
    const corpo = init.body ? JSON.parse(init.body) : null;
    chamadas.push({ url: String(url), init, corpo });
    for (const [trecho, fn] of Object.entries(rotas)) if (String(url).includes(trecho)) { const r = await fn(String(url), init, corpo); return resposta(r[0], r[1]); }
    return resposta(404, { message: 'sem rota' });
  };
  f.chamadas = chamadas;
  return f;
}
const cfgCom = env => config({ GABARITO_SUPABASE_SECRET_KEY: 'sb_secret_teste', ...env });
function chama(handler, { method = 'GET', query = {}, body, headers = {} } = {}) {
  return new Promise((ok, falha) => {
    const res = { statusCode: 200, cab: {}, setHeader(k, v) { this.cab[k.toLowerCase()] = v; }, end(txt) { ok({ status: this.statusCode, cab: this.cab, corpo: txt ? JSON.parse(txt) : null }); } };
    Promise.resolve(handler({ method, query, body, headers }, res)).catch(falha);
  });
}
const setCookies = r => [].concat(r.cab['set-cookie'] || []);
const valorCookie = (r, nome) => { const c = setCookies(r).find(x => x.startsWith(nome + '=')); return c == null ? null : decodeURIComponent(c.split(';')[0].slice(nome.length + 1)); };

/**
 * Rixel simulada com o contrato do protocolo de ferramentas:
 *  lanca(challenge) faz o papel do front da Rixel (issue_tool_code) e devolve o código;
 *  exchange_tool_code / product_access_status / refresh_product_session / revoke_product_session como RPCs anon.
 */
function rixelFalsa({ sub = A, aud = 'gabarito', tool = TOOL } = {}) {
  const codigos = new Map(), sessoes = new Map(); let n = 0;
  const R = { direito: true, codigos, sessoes, revogados: [] };
  R.lanca = async challenge => { if (!CHALLENGE_OK.test(challenge)) throw new Error('challenge inválido'); const code = 'cod-' + (++n); codigos.set(await sha256hex(code), { challenge, usado: false }); return code; };
  const claims = jti => ({ sub, aud, tool_id: tool, kind: 'web', jti, iat: 1, exp: 2, right_expires_at: null, device_hash: null, device_id: null, entitlements: [tool] });
  R.fetch = fetchFalso({
    '/rpc/exchange_tool_code': async (u, i, b) => {
      const c = codigos.get(await sha256hex(b.p_code));
      if (!c || c.usado || !VERIFIER_OK.test(b.p_verifier) || (await sha256b64url(b.p_verifier)) !== c.challenge) return [400, { message: 'Código inválido ou expirado' }];
      c.usado = true;
      if (!R.direito) return [400, { message: 'Direito revogado ou integração pendente' }];
      if (b.p_device_hash !== null || b.p_device_name !== null || !/^[0-9a-f]{64}$/.test(b.p_refresh_hash)) return [400, { message: 'parâmetros' }];
      const jti = 'jti-' + (++n); sessoes.set(b.p_refresh_hash, { jti, ativa: true }); return [200, claims(jti)];
    },
    '/rpc/product_access_status': (u, i, b) => { const s = [...sessoes.values()].find(x => x.jti === b.p_jti); return [200, { active: !!(s && s.ativa && R.direito && b.p_sub === sub && b.p_audience === aud) }]; },
    '/rpc/refresh_product_session': (u, i, b) => {
      const s = sessoes.get(b.p_refresh_hash);
      if (!s) return [400, { message: 'Sessão inválida' }];
      if (!R.direito) return [400, { message: 'Direito indisponível' }];
      sessoes.delete(b.p_refresh_hash); const jti = 'jti-' + (++n); sessoes.set(b.p_next_hash, { jti, ativa: true }); return [200, claims(jti)];
    },
    '/rpc/revoke_product_session': (u, i, b) => { R.revogados.push(b.p_refresh_hash); sessoes.delete(b.p_refresh_hash); return [200, null]; },
  });
  return R;
}

/* ---------- 1. token da Rixel (caminho B: ES256 + JWKS) ---------- */
describe('verificação do token da Rixel (login direto)', () => {
  let chave, outra, jwks, verifica;
  const assina = (k, claims = {}, o = {}) => new SignJWT({ role: 'authenticated', email: 'luiz@exemplo.com', ...claims }).setProtectedHeader({ alg: 'ES256', kid: 'k1' })
    .setIssuer(o.iss || ISS).setAudience(o.aud || 'authenticated').setSubject(o.sub || A).setIssuedAt().setExpirationTime(o.exp || '1h').sign(k.privateKey);
  beforeAll(async () => {
    chave = await generateKeyPair('ES256'); outra = await generateKeyPair('ES256');
    jwks = { keys: [{ ...(await exportJWK(chave.publicKey)), kid: 'k1', alg: 'ES256', use: 'sig' }] };
    verifica = criaVerificadorRixel({ emissor: ISS, aud: 'authenticated', chaves: createLocalJWKSet(jwks) });
  });
  it('token válido devolve o usuário', async () => {
    const v = await verifica(await assina(chave));
    expect(v.sub).toBe(A); expect(v.email).toBe('luiz@exemplo.com');
  });
  it('expirado, emissor errado, aud errado e assinatura de outra chave são recusados', async () => {
    await expect(verifica(await assina(chave, {}, { exp: Math.floor(Date.now() / 1000) - 120 }))).rejects.toMatchObject({ motivo: 'expirado' });
    await expect(verifica(await assina(chave, {}, { iss: 'https://outro.supabase.co/auth/v1' }))).rejects.toMatchObject({ motivo: 'claim' });
    await expect(verifica(await assina(chave, {}, { aud: 'anon' }))).rejects.toMatchObject({ motivo: 'claim' });
    await expect(verifica(await assina(outra))).rejects.toMatchObject({ motivo: 'invalido' });
  });
  it('lixo, anônimo e papel diferente são recusados', async () => {
    await expect(verifica('abc')).rejects.toMatchObject({ motivo: 'ausente' });
    await expect(verifica(await assina(chave, { is_anonymous: true }))).rejects.toMatchObject({ motivo: 'anonimo' });
    await expect(verifica(await assina(chave, { role: 'service_role' }))).rejects.toMatchObject({ motivo: 'papel' });
  });
  it('JWKS remoto simulado (fetch), com cache das chaves', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify(jwks), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', f);
    try {
      const vr = criaVerificadorRixel({ emissor: ISS, aud: 'authenticated', jwks: 'https://jwks.teste/auth/v1/.well-known/jwks.json' });
      expect((await vr(await assina(chave))).sub).toBe(A);
      expect((await vr(await assina(chave))).sub).toBe(A);
      expect(f).toHaveBeenCalledTimes(1);
    } finally { vi.unstubAllGlobals(); }
  });
});

/* ---------- 2. verificaAcesso (caminho B: tool_contract) ---------- */
describe('verificaAcesso (login direto)', () => {
  beforeEach(() => limpaCacheAcesso());
  it('sem GABARITO_TOOL_ID nega com motivo claro, sem consultar a Rixel', async () => {
    const f = fetchFalso({});
    const r = await verificaAcesso({ token: 't', sub: A }, { cfg: cfgCom({ GABARITO_TOOL_ID: '' }), fetch: f });
    expect(r.ok).toBe(false); expect(r.motivo).toMatch(/ainda não configurado/); expect(f.chamadas.length).toBe(0);
  });
  it('acesso aberto (desenvolvimento) libera', async () => {
    expect(await verificaAcesso({ token: 't', sub: A }, { cfg: cfgCom({ GABARITO_ACESSO_ABERTO: '1' }) })).toMatchObject({ ok: true, via: 'aberto' });
  });
  it('tool_contract com sucesso libera (token do usuário, chave publicável) e fica em cache', async () => {
    const f = fetchFalso({ '/rpc/tool_contract': (u, i, b) => [b.p_tool === TOOL ? 200 : 400, { tool: TOOL }] });
    const cfg = cfgCom({ GABARITO_TOOL_ID: TOOL });
    expect(await verificaAcesso({ token: 'tok-usuario', sub: A }, { cfg, fetch: f })).toMatchObject({ ok: true, via: 'contrato', recursos: {} });
    const c = f.chamadas[0];
    expect(c.url).toBe(RIXEL + '/rest/v1/rpc/tool_contract'); expect(c.corpo).toEqual({ p_tool: TOOL });
    expect(c.init.headers.Authorization).toBe('Bearer tok-usuario'); expect(c.init.headers.apikey).toMatch(/^sb_publishable_/);
    await verificaAcesso({ token: 'tok-usuario', sub: A }, { cfg, fetch: f });
    expect(f.chamadas.length).toBe(1);
  });
  it("exceção 'Acesso indisponível' nega com motivo; falha de rede nega e não fica no cache", async () => {
    const cfg = cfgCom({ GABARITO_TOOL_ID: TOOL });
    const r = await verificaAcesso({ token: 't', sub: A }, { cfg, fetch: fetchFalso({ tool_contract: () => [400, { message: 'Acesso indisponível' }] }) });
    expect(r.ok).toBe(false); expect(r.motivo).toMatch(/plano da Rixel não inclui/);
    limpaCacheAcesso();
    const q = await verificaAcesso({ token: 't', sub: A }, { cfg, fetch: async () => { throw new TypeError('rede') } });
    expect(q).toMatchObject({ ok: false, falha: true });
    expect((await verificaAcesso({ token: 't', sub: A }, { cfg, fetch: fetchFalso({ tool_contract: () => [500, {}] }) })).ok).toBe(false);
    expect((await verificaAcesso({ token: 't', sub: A }, { cfg, fetch: fetchFalso({ tool_contract: () => [200, {}] }) })).ok).toBe(true);
  });
});

/* ---------- 3. contrato e PKCE ---------- */
describe('PKCE e leitura das claims', () => {
  it('challenge de 43 caracteres a partir de um verifier conhecido (RFC 7636)', async () => {
    const c = await sha256b64url('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk');
    expect(c).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'); expect(c).toMatch(CHALLENGE_OK);
    const p = await pkceGera();
    expect(p.verifier).toMatch(VERIFIER_OK); expect(p.challenge).toMatch(CHALLENGE_OK); expect(p.challenge).toBe(await sha256b64url(p.verifier));
    expect(await sha256hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
  it('claims: exige sub uuid, jti, aud e tool_id certos', () => {
    const ok = { sub: A, aud: 'gabarito', tool_id: TOOL, jti: 'j1', exp: 1 };
    expect(validaClaims(ok, { audience: 'gabarito', toolId: TOOL })).toMatchObject({ sub: A, jti: 'j1', aud: 'gabarito' });
    expect(validaClaims([ok], { audience: 'gabarito', toolId: TOOL })).not.toBeNull();
    expect(validaClaims({ ...ok, aud: 'outro' }, { audience: 'gabarito', toolId: TOOL })).toBeNull();
    expect(validaClaims({ ...ok, tool_id: 'outra' }, { audience: 'gabarito', toolId: TOOL })).toBeNull();
    expect(validaClaims({ ...ok, sub: 'x' }, { audience: 'gabarito', toolId: TOOL })).toBeNull();
    expect(validaClaims({ ...ok, jti: '' }, { audience: 'gabarito', toolId: TOOL })).toBeNull();
    expect(validaClaims('lixo', { audience: 'gabarito' })).toBeNull();
  });
  it('product_access_status: só {active:true} libera', () => {
    expect(statusAtivo({ active: true })).toBe(true);
    expect(statusAtivo([{ active: true }])).toBe(true);
    expect(statusAtivo({ active: false })).toBe(false);
    expect(statusAtivo({ active: 'true' })).toBe(false);
    expect(statusAtivo(null)).toBe(false);
  });
  it('modelo do endereço de lançamento', () => {
    expect(lancarUrl('https://r/x?t={tool}&s={state}', { tool: 'a b', state: 's&1' })).toBe('https://r/x?t=a%20b&s=s%261');
  });
});

/* ---------- 4. lançamento pela Rixel, ponta a ponta ---------- */
describe('lançamento pela Rixel (caminho principal)', () => {
  const env = { GABARITO_TOOL_ID: TOOL, RIXEL_LAUNCH_URL: 'https://rixel.com.br/lancar?tool={tool}&challenge={challenge}&state={state}' };
  let rx, banco, deps, relogio;
  beforeEach(() => {
    rx = rixelFalsa(); banco = bancoMemoria(); relogio = Date.parse('2026-10-13T12:00:00Z');
    deps = { cfg: cfgCom(env), banco, fetch: rx.fetch, agora: () => relogio, verifica: async () => { throw new Error('não usado') } };
  });
  /** ida (iniciar) + Rixel (gera o código para o challenge) + volta (callback) → cookie da sessão */
  async function entra(o = {}) {
    const ini = await chama(rotaIniciar(() => deps));
    expect(ini.status).toBe(302);
    const u = new URL(ini.cab.location);
    const pk = valorCookie(ini, 'gab_pkce');
    expect(setCookies(ini)[0]).toMatch(/HttpOnly; Secure; SameSite=Lax; Max-Age=300/);
    const code = await rx.lanca(u.searchParams.get('challenge'));
    const q = { code, ...(o.semState ? {} : { state: o.state || u.searchParams.get('state') }) };
    const v = await chama(rotaCallback(() => deps), { query: q, headers: { cookie: 'gab_pkce=' + encodeURIComponent(pk) } });
    return { ini, u, pk, code, v, sessao: valorCookie(v, 'gab_sessao') };
  }
  it('desligado com GABARITO_TOOL_ID vazio: volta para o app', async () => {
    deps.cfg = cfgCom({ GABARITO_TOOL_ID: '' });
    const r = await chama(rotaIniciar(() => deps));
    expect(r.cab.location).toBe('https://gabarito.rixel.com.br/?entrada=desligada');
  });
  it('padrões confirmados pela Rixel: id da ferramenta e página de lançamento (slug no caminho, redirect_uri = callback)', async () => {
    deps.cfg = cfgCom({});
    expect(deps.cfg.toolId).toBe('8e7150bc-bade-4cbb-8efe-47606a299af2');
    const u = new URL((await chama(rotaIniciar(() => deps))).cab.location);
    expect(u.origin + u.pathname).toBe('https://www.rixel.com.br/ferramentas/gabarito/abrir');
    expect(u.searchParams.get('challenge')).toMatch(CHALLENGE_OK);
    expect(u.searchParams.get('redirect_uri')).toBe('https://gabarito.rixel.com.br/api/rixel/callback');
    expect(u.searchParams.get('state')).toMatch(/^[A-Za-z0-9_-]{24}$/);
  });
  it('erros da página de lançamento viram mensagens nossas (sem repassar o texto da Rixel) e não criam sessão', async () => {
    const ini = await chama(rotaIniciar(() => deps)), pk = valorCookie(ini, 'gab_pkce'), st = new URL(ini.cab.location).searchParams.get('state');
    const volta = q => chama(rotaCallback(() => deps), { query: { state: st, error_description: '<b>x</b>', ...q }, headers: { cookie: 'gab_pkce=' + encodeURIComponent(pk) } });
    expect((await volta({ error: 'access_denied' })).cab.location).toMatch(/entrada=sem_acesso&msg=/);
    expect((await volta({ error: 'integration_pending' })).cab.location).toMatch(/entrada=indisponivel/);
    for (const e of ['too_many_requests', 'temporarily_unavailable', 'invalid_redirect_uri', 'invalid_request', 'outro']) {
      const loc = (await volta({ error: e })).cab.location;
      expect(loc).toMatch(/entrada=erro&msg=/); expect(loc).not.toContain('%3Cb%3E');
    }
    expect((await volta({ error: 'access_denied', state: 'outro' })).cab.location).toMatch(/entrada=estado/);
    expect(banco.T.sessoes.length).toBe(0);
  });
  it('ida e volta: challenge de 43 caracteres, troca anon com device null, sessão opaca guardada só como hash', async () => {
    const { u, pk, v, sessao } = await entra();
    expect(u.origin + u.pathname).toBe('https://rixel.com.br/lancar'); expect(u.searchParams.get('tool')).toBe(TOOL);
    const [, verifier] = pk.split('.');
    expect(u.searchParams.get('challenge')).toBe(await sha256b64url(verifier));
    expect(v.status).toBe(302); expect(v.cab.location).toBe('https://gabarito.rixel.com.br/');
    expect(sessao).toMatch(/^[A-Za-z0-9_-]{43}$/);   // 256 bits
    expect(setCookies(v).find(c => c.startsWith('gab_sessao='))).toMatch(/HttpOnly; Secure; SameSite=Lax/);
    const troca = rx.fetch.chamadas.find(c => c.url.endsWith('/rpc/exchange_tool_code'));
    expect(troca.init.headers.Authorization).toBeUndefined(); expect(troca.init.headers.apikey).toMatch(/^sb_publishable_/);
    expect(troca.corpo).toMatchObject({ p_verifier: verifier, p_audience: 'gabarito', p_device_hash: null, p_device_name: null });
    expect(banco.T.sessoes.length).toBe(1);
    const s = banco.T.sessoes[0];
    expect(s.id_hash).toBe(await sha256hex(sessao)); expect(JSON.stringify(s)).not.toContain(sessao);
    expect(s.refresh_hash).toBe(troca.corpo.p_refresh_hash); expect(s).toMatchObject({ sub: A, aud: 'gabarito' });
    // a sessão autentica as rotas; escrita exige o cabeçalho X-Gabarito
    const est = rotaEstudos(() => deps), ck = { cookie: 'gab_sessao=' + sessao };
    expect((await chama(est, { headers: ck })).status).toBe(200);
    expect((await chama(est, { method: 'POST', headers: ck, body: { nome: 'x', S: { a: 1 } } })).status).toBe(403);
    expect((await chama(est, { method: 'POST', headers: { ...ck, 'x-gabarito': '1' }, body: { nome: 'x', S: { a: 1 } } })).corpo.dono).toBe(A);
  });
  it('state é opcional, mas se vier tem de bater; sem o cookie do verifier não entra', async () => {
    expect((await entra({ semState: true })).v.cab.location).toBe('https://gabarito.rixel.com.br/');
    expect((await entra({ state: 'outro' })).v.cab.location).toMatch(/entrada=estado/);
    const r = await chama(rotaCallback(() => deps), { query: { code: 'cod-1' } });
    expect(r.cab.location).toMatch(/entrada=estado/);
  });
  it('código de uso único: repetir a volta falha', async () => {
    const { pk, code, ini } = await entra();
    const u = new URL(ini.cab.location);
    const de_novo = await chama(rotaCallback(() => deps), { query: { code, state: u.searchParams.get('state') }, headers: { cookie: 'gab_pkce=' + encodeURIComponent(pk) } });
    expect(de_novo.cab.location).toMatch(/entrada=expirada/);
    expect(banco.T.sessoes.length).toBe(1);
  });
  it('sem direito na troca: volta com o motivo e sem sessão', async () => {
    rx.direito = false;
    const { v } = await entra();
    expect(v.cab.location).toMatch(/entrada=sem_acesso&msg=/);
    expect(valorCookie(v, 'gab_sessao')).toBeNull(); expect(banco.T.sessoes.length).toBe(0);
  });
  it('reconfere a cada 60 s: ativo segue; inativo derruba a sessão (401, cookie apagado)', async () => {
    const { sessao } = await entra();
    const eu = rotaEu(() => deps), ck = { cookie: 'gab_sessao=' + sessao };
    const conta = () => rx.fetch.chamadas.filter(c => c.url.endsWith('/rpc/product_access_status')).length;
    expect((await chama(eu, { headers: ck })).status).toBe(200); expect(conta()).toBe(0);      // verificada há < 60 s
    relogio += 61000;
    expect((await chama(eu, { headers: ck })).corpo.acesso.ok).toBe(true); expect(conta()).toBe(1);
    expect((await chama(eu, { headers: ck })).status).toBe(200); expect(conta()).toBe(1);      // cache de 60 s
    rx.direito = false; relogio += 61000;
    const r = await chama(eu, { headers: ck });
    expect(r.status).toBe(401); expect(r.corpo.erro).toBe('sessao_expirada');
    expect(setCookies(r)[0]).toMatch(/^gab_sessao=; .*Max-Age=0/);
    expect(banco.T.sessoes.length).toBe(0);
    expect((await chama(eu, { headers: ck })).corpo.erro).toBe('sessao_expirada');
  });
  it('status inativo encerra a sessão sem tentar renovar (o refresh da Rixel não estende os 30 dias)', async () => {
    const { sessao } = await entra();
    for (const s of rx.sessoes.values()) s.ativa = false;
    relogio += 61000;
    const r = await chama(rotaEu(() => deps), { headers: { cookie: 'gab_sessao=' + sessao } });
    expect(r.status).toBe(401); expect(r.corpo.erro).toBe('sessao_expirada');
    expect(rx.fetch.chamadas.some(c => c.url.endsWith('/rpc/refresh_product_session'))).toBe(false);
    expect(banco.T.sessoes.length).toBe(0);
  });
  it('Rixel fora do ar: não libera (503) mas não derruba a sessão', async () => {
    const { sessao } = await entra();
    relogio += 61000; deps.fetch = async () => { throw new TypeError('rede') };
    const r = await chama(rotaEu(() => deps), { headers: { cookie: 'gab_sessao=' + sessao } });
    expect(r.status).toBe(503); expect(banco.T.sessoes.length).toBe(1);
  });
  it('Sair revoga na Rixel, apaga a sessão e o cookie', async () => {
    const { sessao } = await entra();
    const hash = banco.T.sessoes[0].refresh_hash;
    const r = await chama(rotaSair(() => deps), { method: 'POST', headers: { cookie: 'gab_sessao=' + sessao } });
    expect(r.status).toBe(200); expect(setCookies(r)[0]).toMatch(/Max-Age=0/);
    expect(rx.revogados).toEqual([hash]); expect(banco.T.sessoes.length).toBe(0);
    expect((await chama(rotaEu(() => deps), { headers: { cookie: 'gab_sessao=' + sessao } })).status).toBe(401);
  });
  it('login direto desligado por padrão: Bearer é recusado', async () => {
    const r = await chama(rotaEu(() => deps), { headers: { authorization: 'Bearer x.y.z' } });
    expect(r.status).toBe(401); expect(r.corpo.erro).toBe('login_direto_desligado');
  });
});

/* ---------- 5. rotas de dados ---------- */
describe('rotas /api/estudos, /api/versoes, /api/regras, /api/eu (login direto)', () => {
  let banco, deps, est, ver, reg, eu;
  const tok = { 'tok-A': { sub: A, email: 'a@x.com' }, 'tok-B': { sub: B, email: 'b@x.com' } };
  const H = t => ({ authorization: 'Bearer ' + t });
  const S = { nome: 'Teste', lote: { pts: [[0, 0], [20, 0], [20, 30]] } };
  beforeEach(() => {
    limpaCacheAcesso();
    banco = bancoMemoria();
    deps = { cfg: cfgCom({ GABARITO_LOGIN_DIRETO: '1', GABARITO_ACESSO_ABERTO: '1' }), banco, fetch: fetchFalso({ '/rest/v1/profiles': () => [200, [{ full_name: 'Ana' }]] }),
      verifica: async t => { if (!tok[t]) throw new Error('x'); return tok[t]; } };
    est = rotaEstudos(() => deps); ver = rotaVersoes(() => deps); reg = rotaRegras(() => deps); eu = rotaEu(() => deps);
  });
  it('sem sessão → 401; token inválido → 401', async () => {
    expect((await chama(est)).status).toBe(401);
    expect((await chama(est, { headers: H('lixo') })).status).toBe(401);
  });
  it('cada dono só vê, muda e apaga o que é dele', async () => {
    const c = await chama(est, { method: 'POST', headers: H('tok-A'), body: { nome: 'Lote A', S, k: { units: 10 } } });
    expect(c.status).toBe(201); const id = c.corpo.id;
    expect(c.corpo).toMatchObject({ nome: 'Lote A', rev: 1, dono: A, S });
    const l = (await chama(est, { headers: H('tok-A') })).corpo;
    expect(l.map(e => e.id)).toEqual([id]); expect(l[0].S).toBeUndefined();   // lista sem o estado
    expect((await chama(est, { headers: H('tok-B') })).corpo).toEqual([]);
    expect((await chama(est, { headers: H('tok-B'), query: { id } })).status).toBe(404);
    expect((await chama(est, { method: 'PUT', headers: H('tok-B'), query: { id }, body: { nome: 'x', S, rev: 1 } })).status).toBe(404);
    await chama(est, { method: 'DELETE', headers: H('tok-B'), query: { id } });
    expect(banco.T.estudos.length).toBe(1);
    expect((await chama(est, { method: 'POST', headers: H('tok-B'), body: { id, nome: 'x', S } })).status).toBe(409);   // não "toma" o id
    expect((await chama(est, { method: 'DELETE', headers: H('tok-A'), query: { id } })).status).toBe(200);
    expect(banco.T.estudos.length).toBe(0);
  });
  it('conflito de rev: a gravação com rev velho recebe 409 com o estado atual', async () => {
    const { corpo: e } = await chama(est, { method: 'POST', headers: H('tok-A'), body: { nome: 'E', S } });
    const p1 = await chama(est, { method: 'PUT', headers: H('tok-A'), query: { id: e.id }, body: { nome: 'E1', S: { ...S, x: 1 }, rev: 1 } });
    expect(p1.status).toBe(200); expect(p1.corpo.rev).toBe(2);
    const p2 = await chama(est, { method: 'PUT', headers: H('tok-A'), query: { id: e.id }, body: { nome: 'E2', S: { ...S, x: 2 }, rev: 1 } });
    expect(p2.status).toBe(409); expect(p2.corpo.erro).toBe('conflito'); expect(p2.corpo.atual).toMatchObject({ rev: 2, nome: 'E1' });
    const p3 = await chama(est, { method: 'PUT', headers: H('tok-A'), query: { id: e.id }, body: { nome: 'E2', S, rev: 2 } });
    expect(p3.corpo).toMatchObject({ rev: 3, nome: 'E2' });
    expect((await chama(est, { method: 'PUT', headers: H('tok-A'), query: { id: e.id }, body: { nome: 'E', S } })).status).toBe(400);
  });
  it('validação: id e estado', async () => {
    expect((await chama(est, { headers: H('tok-A'), query: { id: '1; drop table' } })).status).toBe(400);
    expect((await chama(est, { method: 'POST', headers: H('tok-A'), body: { nome: 'x' } })).status).toBe(400);
  });
  it('sem acesso na Rixel → 403 com o motivo; /api/eu responde mesmo assim', async () => {
    deps.cfg = cfgCom({ GABARITO_LOGIN_DIRETO: '1', GABARITO_TOOL_ID: '' });
    const r = await chama(est, { headers: H('tok-A') });
    expect(r.status).toBe(403); expect(r.corpo.erro).toBe('sem_acesso'); expect(r.corpo.motivo).toMatch(/configurado/);
    const e = await chama(eu, { headers: H('tok-A') });
    expect(e.status).toBe(200); expect(e.corpo.acesso.ok).toBe(false); expect(e.corpo.usuario).toMatchObject({ id: A, nome: 'Ana' });
  });
  it('versões: só no estudo do dono; caem junto com o estudo', async () => {
    const { corpo: e } = await chama(est, { method: 'POST', headers: H('tok-A'), body: { nome: 'E', S } });
    const v = await chama(ver, { method: 'POST', headers: H('tok-A'), body: { estudoId: e.id, nome: 'V1', auto: false, S, k: { margem: 0.2 } } });
    expect(v.status).toBe(201); expect(v.corpo).toMatchObject({ estudoId: e.id, nome: 'V1', autor: 'a@x.com' });
    expect((await chama(ver, { method: 'POST', headers: H('tok-B'), body: { estudoId: e.id, nome: 'X', S } })).status).toBe(404);
    expect((await chama(ver, { headers: H('tok-B'), query: { estudo: e.id } })).status).toBe(404);
    expect((await chama(ver, { headers: H('tok-B'), query: { id: v.corpo.id } })).status).toBe(404);
    const l = await chama(ver, { headers: H('tok-A'), query: { estudo: e.id } });
    expect(l.corpo.length).toBe(1); expect(l.corpo[0].S).toBeUndefined();
    await chama(est, { method: 'DELETE', headers: H('tok-A'), query: { id: e.id } });
    expect(banco.T.versoes.length).toBe(0);
  });
  it('regras: rascunho só do autor; publicar só revisor', async () => {
    const r = await chama(reg, { method: 'POST', headers: H('tok-A'), body: { cidade: 'Criciúma', zona: 'ZR1', params: { ca: 2 }, status: 'publicada' } });
    expect(r.status).toBe(201); expect(r.corpo.status).toBe('rascunho');
    expect((await chama(reg, { headers: H('tok-B') })).corpo).toEqual([]);
    expect((await chama(reg, { headers: H('tok-A') })).corpo.length).toBe(1);
    banco.T.perfis.push({ id: B, revisor: true });
    const p = await chama(reg, { method: 'POST', headers: H('tok-B'), body: { id: r.corpo.id, cidade: 'Criciúma', zona: 'ZR1', params: { ca: 2 }, status: 'publicada' } });
    expect(p.corpo.status).toBe('publicada');
    expect((await chama(reg, { headers: H('tok-A'), query: { cidade: 'Criciúma' } })).corpo.length).toBe(1);
    await chama(reg, { method: 'DELETE', headers: H('tok-A'), query: { id: r.corpo.id } });   // não é rascunho: fica
    expect(banco.T.cidades_regras.length).toBe(1);
  });
});

/* ---------- 6. cliente PostgREST ---------- */
describe('cliente do banco (PostgREST)', () => {
  it('monta filtros e manda a chave secreta só no apikey', async () => {
    expect(filtrosQS({ id: 'x', dono: A, rev: 2 })).toEqual(['id=eq.x', `dono=eq.${A}`, 'rev=eq.2']);
    expect(filtrosQS({ plano_id: { in: ['a', 'b c'] }, revoked_at: { is: null } })).toEqual(['plano_id=in.(a%2C%22b%20c%22)', 'revoked_at=is.null']);
    expect(decodeURIComponent(filtrosQS({ $ou: [{ status: 'publicada' }, { autor: A }] })[0])).toBe(`or=(status.eq.publicada,autor.eq.${A})`);
    const f = fetchFalso({ '/rest/v1/estudos': () => [200, [{ id: 1 }]] });
    const b = criaBanco({ url: 'https://cjeyxafuajbvuxrbufkq.supabase.co', chave: 'sb_secret_x', fetch: f });
    await b.upd('estudos', { id: 'i', rev: 1 }, { nome: 'n' });
    const c = f.chamadas[0];
    expect(c.url).toBe('https://cjeyxafuajbvuxrbufkq.supabase.co/rest/v1/estudos?id=eq.i&rev=eq.1');
    expect(c.init.method).toBe('PATCH'); expect(c.init.headers.apikey).toBe('sb_secret_x'); expect(c.init.headers.Authorization).toBeUndefined();
    expect(c.init.headers.Prefer).toBe('return=representation');
    expect(criaBanco({ url: 'x', chave: '' })).toBeNull();
  });
});
