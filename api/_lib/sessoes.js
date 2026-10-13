// Sessão do Gabarito (caminho A — lançamento pela Rixel).
// Depois da troca do código, o servidor cria a PRÓPRIA sessão: cookie HttpOnly; Secure; SameSite=Lax com um id opaco
// aleatório (256 bits). No banco do Gabarito fica só o HASH do id (tabela `sessoes`), com sub, jti, aud, o hash ATUAL do
// refresh da Rixel (o token cru nunca é guardado), criada, ultima_verificacao e expira.
// A cada pedido: resolve a sessão pelo cookie; se a última verificação tem mais de 60 s, chama product_access_status e,
// se não estiver ativo, refresh_product_session (gira o hash). Inativo = 401 e cookie apagado.
import { rixelRpc, validaClaims, statusAtivo, aleatorio, sha256hex, ErroRixel } from './rixel.js';
import { rixelMotivo } from './acesso.js';
import { ErroHttp, cookie } from './http.js';

export const COOKIE_SESSAO = 'gab_sessao';
export const apagaCookie = () => cookie(COOKIE_SESSAO, '', { maxAge: 0 });
const iso = ms => new Date(ms).toISOString();
const ms = v => (v ? Date.parse(v) : 0);

/** cria a sessão a partir das claims já validadas; devolve o Set-Cookie */
export async function sessaoCria(deps, claims, refreshHash) {
  const { cfg, banco } = deps, agora = (deps.agora || Date.now)();
  const id = aleatorio(32);
  await banco.ins('sessoes', [{ id_hash: await sha256hex(id), sub: claims.sub, jti: claims.jti, aud: claims.aud, refresh_hash: refreshHash, criada: iso(agora), ultima_verificacao: iso(agora), expira: iso(agora + cfg.sessao.dias * 86400000) }]);
  return cookie(COOKIE_SESSAO, id, { maxAge: cfg.sessao.dias * 86400 });
}

const recusa = (erro, motivo) => new ErroHttp(401, { erro, motivo }, { 'Set-Cookie': apagaCookie() });

/** resolve e (se preciso) reconfere a sessão; devolve a linha da sessão ou lança ErroHttp */
export async function sessaoResolve(id, deps) {
  const { cfg, banco } = deps, agora = (deps.agora || Date.now)();
  if (!banco) throw new ErroHttp(503, { erro: 'banco', motivo: 'Banco do Gabarito não configurado.' });
  const idHash = await sha256hex(String(id));
  const [s] = await banco.sel('sessoes', { f: { id_hash: idHash } });
  if (!s) throw recusa('sessao_expirada', 'A sua sessão terminou. Entre de novo pela Rixel.');
  if (ms(s.expira) < agora) { await banco.del('sessoes', { id_hash: idHash }); throw recusa('sessao_expirada', 'A sua sessão terminou. Entre de novo pela Rixel.'); }
  if (agora - ms(s.ultima_verificacao) <= cfg.sessao.verificaSeg * 1000) return s;
  const opts = { fetch: deps.fetch };
  try {
    const st = await rixelRpc(cfg, 'product_access_status', { p_jti: s.jti, p_audience: s.aud, p_sub: s.sub, p_device_hash: null }, opts);
    if (statusAtivo(st)) {
      await banco.upd('sessoes', { id_hash: idHash }, { ultima_verificacao: iso(agora) });
      return { ...s, ultima_verificacao: iso(agora) };
    }
    // inativo: tenta renovar (gira o hash do refresh). Se o direito acabou, a Rixel recusa.
    const prox = await sha256hex(aleatorio(32));
    const c = validaClaims(await rixelRpc(cfg, 'refresh_product_session', { p_refresh_hash: s.refresh_hash, p_next_hash: prox, p_audience: s.aud, p_device_hash: null }, opts), { audience: s.aud, toolId: cfg.toolId });
    if (!c || c.sub !== s.sub) throw new ErroRixel('refresh_product_session', 400, { message: 'Sessão inválida' });
    await banco.upd('sessoes', { id_hash: idHash, refresh_hash: s.refresh_hash }, { jti: c.jti, refresh_hash: prox, ultima_verificacao: iso(agora) });
    return { ...s, jti: c.jti, refresh_hash: prox, ultima_verificacao: iso(agora) };
  } catch (e) {
    if (e instanceof ErroHttp) throw e;
    if (e instanceof ErroRixel && e.recusa) {
      // outro pedido simultâneo pode ter girado o refresh primeiro: vale a sessão já renovada
      const [s2] = await banco.sel('sessoes', { f: { id_hash: idHash } });
      if (s2 && s2.refresh_hash !== s.refresh_hash && agora - ms(s2.ultima_verificacao) <= cfg.sessao.verificaSeg * 1000) return s2;
      await banco.del('sessoes', { id_hash: idHash });
      const semDireito = /direito|acesso indispon|integra/i.test(e.message);
      throw recusa(semDireito ? 'sem_acesso' : 'sessao_expirada', rixelMotivo(e));
    }
    // Rixel fora do ar: não derruba a sessão, mas também não libera (na dúvida, nega)
    throw new ErroHttp(503, { erro: 'rixel_indisponivel', motivo: 'Não foi possível confirmar seu acesso na Rixel agora. Tente de novo em instantes.' });
  }
}

/** Sair: revoga na Rixel (se der) e apaga a sessão e o cookie */
export async function sessaoEncerra(id, deps) {
  const { cfg, banco } = deps;
  if (!id || !banco) return;
  const idHash = await sha256hex(String(id));
  const [s] = await banco.sel('sessoes', { f: { id_hash: idHash } });
  if (!s) return;
  try { await rixelRpc(cfg, 'revoke_product_session', { p_refresh_hash: s.refresh_hash, p_audience: s.aud }, { fetch: deps.fetch }); } catch { /* Rixel fora: a sessão local sai mesmo assim */ }
  await banco.del('sessoes', { id_hash: idHash });
}
