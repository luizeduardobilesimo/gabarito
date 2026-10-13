// Caminho A — lançamento pela Rixel (protocolo de ferramentas da Rixel, tipo OAuth com PKCE).
//  1. /api/rixel/iniciar: o Gabarito gera o VERIFIER (fica num cookie HttpOnly de 5 min, com o state) e manda o CHALLENGE
//     (base64url sem '=' de sha256(verifier), 43 caracteres) para a página de lançamento da Rixel (RIXEL_LAUNCH_URL).
//  2. A Rixel (front, membro logado) chama issue_tool_code(p_tool, p_challenge, p_code_hash) e redireciona para o callback
//     cadastrado com ?code=… (state opcional — o endereço e os parâmetros da página de lançamento ainda não foram confirmados).
//  3. /api/rixel/callback: exchange_tool_code (anon, código de uso único, 60 s) → confere aud e tool_id → cria a sessão do
//     Gabarito (sessoes.js) → volta para o destino (/).
import { rixelRpc, validaClaims, pkceGera, aleatorio, sha256hex, lancarUrl, ErroRixel, VERIFIER_OK } from './rixel.js';
import { rixelMotivo } from './acesso.js';
import { cookie, cookies } from './http.js';
import { sessaoCria } from './sessoes.js';

export const COOKIE_PKCE = 'gab_pkce';
/** códigos de erro da página de lançamento da Rixel → [entrada, mensagem] (contrato confirmado em 13/10/2026) */
export const ERROS_RIXEL = {
  access_denied: ['sem_acesso', 'Sua conta da Rixel não inclui o Gabarito. Veja os planos na Rixel.'],
  integration_pending: ['indisponivel', 'O Gabarito ainda está sendo liberado na Rixel. Tente de novo mais tarde.'],
  too_many_requests: ['erro', 'Muitas tentativas de entrada seguidas. Aguarde um minuto e tente de novo.'],
  temporarily_unavailable: ['erro', 'A Rixel está indisponível agora. Tente de novo em instantes.'],
  invalid_redirect_uri: ['erro', 'A entrada pela Rixel está com a configuração errada. Avise o suporte.'],
  invalid_request: ['erro', 'Não foi possível concluir a entrada pela Rixel. Tente de novo.'],
};
const pronto = cfg => !!cfg.toolId;

/** 1) início: guarda verifier+state num cookie curto e devolve o endereço da Rixel */
export async function lancamentoInicio(deps) {
  const { cfg } = deps;
  if (!pronto(cfg)) return { url: cfg.appUrl + '/?entrada=desligada', cookies: [] };
  const { verifier, challenge } = await pkceGera(), state = aleatorio(18);
  return {
    url: lancarUrl(cfg.lancamento.launchUrl, { tool: cfg.toolId, challenge, state, redirect: cfg.lancamento.callback }),
    cookies: [cookie(COOKIE_PKCE, state + '.' + verifier, { maxAge: 300, path: '/api/rixel' })],
  };
}

/** 2) volta da Rixel: confere o state (se veio), troca o código e cria a sessão do Gabarito */
export async function lancamentoVolta(req, q, deps) {
  const { cfg } = deps, limpa = cookie(COOKIE_PKCE, '', { maxAge: 0, path: '/api/rixel' });
  const falha = (codigo, msg) => ({ url: cfg.appUrl + '/?entrada=' + codigo + (msg ? '&msg=' + encodeURIComponent(String(msg).slice(0, 140)) : ''), cookies: [limpa] });
  if (!pronto(cfg)) return falha('desligada');
  if (!deps.banco) return falha('erro', 'Banco do Gabarito não configurado.');
  const [state, verifier] = String(cookies(req)[COOKIE_PKCE] || '').split('.');
  // a Rixel recusou na página de lançamento: ?error=<codigo>&error_description=…&state=… (o texto dela não é repassado)
  if (q.error) {
    if (q.state != null && q.state !== '' && state && q.state !== state) return falha('estado');
    const e = ERROS_RIXEL[String(q.error)] || ERROS_RIXEL.invalid_request;
    return falha(e[0], e[1]);
  }
  const code = String(q.code || '');
  if (!code || code.length > 100) return falha('estado');
  if (!verifier || !VERIFIER_OK.test(verifier)) return falha('estado');      // cookie de 5 min sumiu ou outro navegador
  if (q.state != null && q.state !== '' && q.state !== state) return falha('estado');
  const refreshHash = await sha256hex(aleatorio(32));   // o token cru não é guardado: só o hash circula
  let claims;
  try {
    const j = await rixelRpc(cfg, 'exchange_tool_code', { p_code: code, p_verifier: verifier, p_audience: cfg.lancamento.audience, p_device_hash: null, p_device_name: null, p_refresh_hash: refreshHash }, { fetch: deps.fetch });
    claims = validaClaims(j, { audience: cfg.lancamento.audience, toolId: cfg.toolId });
  } catch (e) {
    if (e instanceof ErroRixel && e.recusa) return falha(/direito|integra/i.test(e.message) ? 'sem_acesso' : 'expirada', rixelMotivo(e));
    return falha('erro', 'A Rixel não respondeu. Tente de novo em instantes.');
  }
  if (!claims) return falha('erro', 'Resposta inesperada da Rixel.');
  const sess = await sessaoCria(deps, claims, refreshHash);
  return { url: cfg.lancamento.destino, cookies: [limpa, sess] };
}
