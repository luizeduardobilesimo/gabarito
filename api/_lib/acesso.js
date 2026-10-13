// QUEM PODE ABRIR O GABARITO — decide a RIXEL (plano, ferramenta avulsa, organização), nunca o Gabarito.
//  (A) Caminho principal — lançamento pela Rixel: a troca do código (exchange_tool_code) só dá certo para quem tem o direito,
//      e cada pedido reconfere com product_access_status (a cada 60 s; ver sessoes.js).
//  (B) Login direto por e-mail e senha (GABARITO_LOGIN_DIRETO=1, desligado por padrão): rpc tool_contract(p_tool) com o token
//      do próprio usuário — sucesso = pode abrir; exceção ('Acesso indisponível') = não pode.
// Padrão seguro: sem GABARITO_TOOL_ID, com erro de rede ou resposta inesperada → NEGA, com o motivo.
// GABARITO_ACESSO_ABERTO=1 (só desenvolvimento/preview, só caminho B) libera qualquer usuário autenticado.
// Não há limites por plano dentro do Gabarito (as claims não trazem o plano): `recursos` vai sempre vazio = tudo liberado.
import { rixelRpc, rixelSelect, ErroRixel } from './rixel.js';

const CACHE = new Map();
export const limpaCacheAcesso = () => CACHE.clear();
const nega = (motivo, extra = {}) => ({ ok: false, plano: null, recursos: {}, motivo, via: '', ...extra });

/**
 * Caminho B: a pessoa (token do Auth da Rixel já verificado) pode abrir o Gabarito?
 * @param {{token:string, sub:string}} a
 * @param {{cfg:any, fetch?:Function, agora?:()=>number}} deps
 * @returns {Promise<{ok:boolean, plano:null, recursos:Object, motivo:string, via:string, falha?:boolean}>}
 */
export async function verificaAcesso(a, deps) {
  const { cfg } = deps, agora = deps.agora || Date.now;
  const c = CACHE.get(a.sub);
  if (c && c.ate > agora()) return c.r;
  const r = await decide(a, deps);
  if (!r.falha) CACHE.set(a.sub, { ate: agora() + cfg.acessoCacheSeg * 1000, r });   // falha de rede não fica no cache
  return r;
}

async function decide(a, { cfg, fetch }) {
  if (cfg.acessoAberto) return { ok: true, plano: null, recursos: {}, motivo: '', via: 'aberto' };
  if (!cfg.toolId) return nega('Acesso ainda não configurado (falta GABARITO_TOOL_ID na Vercel).');
  if (!a.token) return nega('Sem sessão.');
  try {
    await rixelRpc(cfg, 'tool_contract', { p_tool: cfg.toolId }, { token: a.token, fetch });
    return { ok: true, plano: null, recursos: {}, motivo: '', via: 'contrato' };
  } catch (e) {
    if (e instanceof ErroRixel && e.recusa) return nega(rixelMotivo(e));
    return nega('Não foi possível confirmar seu acesso na Rixel agora. Tente de novo em instantes.', { falha: true });
  }
}

/** mensagem amigável a partir da exceção da Rixel ('Acesso indisponível', 'Direito indisponível'…) */
export function rixelMotivo(e) {
  const m = String((e && e.message) || '');
  if (/acesso indispon|direito (indispon|revogado)|integra..o pendente/i.test(m)) return 'O seu plano da Rixel não inclui o Gabarito (ou ele ainda não foi liberado).';
  if (/c.digo inv.lido|expirad/i.test(m)) return 'O link de entrada expirou. Entre de novo pela Rixel.';
  if (/sess.o inv.lida/i.test(m)) return 'A sua sessão terminou. Entre de novo pela Rixel.';
  return 'A Rixel não liberou o acesso.';
}

/** nome e foto do perfil na Rixel (profiles.full_name), se o RLS deixar o usuário ler; senão null (só caminho B) */
export async function perfilRixel(cfg, token, sub, fetch) {
  if (!token) return null;
  try {
    const l = await rixelSelect(cfg, 'profiles', `id=eq.${encodeURIComponent(sub)}&select=*`, { token, fetch });
    const p = Array.isArray(l) ? l[0] : null;
    return p ? { nome: p.full_name || '', avatar: p.avatar_url || '' } : null;
  } catch { return null }
}
