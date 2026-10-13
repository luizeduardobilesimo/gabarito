// Conversa com a Rixel (projeto Supabase da comunidade): RPCs do protocolo de ferramentas e PKCE.
// Contrato (lido das funções da Rixel, 13/10/2026):
//   issue_tool_code(p_tool, p_challenge, p_code_hash)          — chamado pelo FRONT da Rixel (membro logado); não pelo Gabarito
//   exchange_tool_code(p_code, p_verifier, p_audience, p_device_hash, p_device_name, p_refresh_hash)   — anon
//      → {sub, aud, tool_id, kind, jti, iat, exp, right_expires_at, device_hash, device_id, entitlements:[tool_id]}
//   product_access_status(p_jti, p_audience, p_sub, p_device_hash)  — anon → {active: bool}
//   refresh_product_session(p_refresh_hash, p_next_hash, p_audience, p_device_hash) — anon → mesmas claims da troca
//   revoke_product_session(p_refresh_hash, p_audience)              — anon
//   tool_contract(p_tool)  — authenticated (caminho B): sucesso = pode abrir; exceção 'Acesso indisponível' = não pode
// Ferramenta web: device_hash e device_name vão null. As respostas NÃO são assinadas: valem porque vêm da Rixel por HTTPS,
// chamadas pelo SERVIDOR do Gabarito. Nunca aceitar essas claims vindas do navegador.

export class ErroRixel extends Error {
  constructor(nome, status, corpo) {
    super((corpo && (corpo.message || corpo.msg || corpo.error_description)) || `Rixel ${nome}: HTTP ${status}`);
    this.status = status; this.corpo = corpo; this.rpc = nome;
  }
  /** a Rixel respondeu com uma exceção da função (não é falha de rede/servidor) */
  get recusa() { return this.status >= 400 && this.status < 500; }
}

/** chamada a uma RPC da Rixel (PostgREST). Sem `token` = anon (chave publicável); com `token` = o próprio usuário */
export async function rixelRpc(cfg, nome, args, o = {}) {
  const f = o.fetch || globalThis.fetch;
  const h = { apikey: cfg.rixel.chavePublica, 'Content-Type': 'application/json', Accept: 'application/json' };
  if (o.token) h.Authorization = 'Bearer ' + o.token;
  const r = await f(`${cfg.rixel.url}/rest/v1/rpc/${encodeURIComponent(nome)}`, { method: 'POST', headers: h, body: JSON.stringify(args || {}) });
  const txt = await r.text();
  let corpo = null; try { corpo = txt ? JSON.parse(txt) : null } catch { corpo = txt }
  if (!r.ok) throw new ErroRixel(nome, r.status, corpo);
  return corpo;
}

/** leitura de uma tabela da Rixel com o token do usuário (o RLS de lá decide o que ele vê) */
export async function rixelSelect(cfg, tabela, query, o = {}) {
  const f = o.fetch || globalThis.fetch;
  const r = await f(`${cfg.rixel.url}/rest/v1/${tabela}?${query}`, { headers: { apikey: cfg.rixel.chavePublica, Authorization: 'Bearer ' + o.token, Accept: 'application/json' } });
  if (!r.ok) throw new ErroRixel(tabela, r.status, null);
  return r.json();
}

const ehObj = v => v && typeof v === 'object' && !Array.isArray(v);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const desembrulha = j => (Array.isArray(j) && j.length === 1 ? j[0] : j);

/**
 * Confere as claims devolvidas por exchange_tool_code / refresh_product_session.
 * Exige sub (uuid), jti, aud = a nossa audience e (se configurado) tool_id = GABARITO_TOOL_ID. Senão null.
 */
export function validaClaims(json, { audience, toolId }) {
  const j = desembrulha(json);
  if (!ehObj(j)) return null;
  if (typeof j.sub !== 'string' || !UUID.test(j.sub)) return null;
  if (j.jti == null || String(j.jti) === '') return null;
  if (String(j.aud) !== String(audience)) return null;
  if (toolId && String(j.tool_id) !== String(toolId)) return null;
  return { sub: j.sub, jti: String(j.jti), aud: String(j.aud), toolId: j.tool_id ? String(j.tool_id) : '', exp: j.exp ?? null, direitoAte: j.right_expires_at ?? null };
}
/** product_access_status → true só com {active:true} */
export const statusAtivo = json => { const j = desembrulha(json); return !!ehObj(j) && j.active === true; };

/* ---- PKCE e hashes ---- */
const b64url = buf => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const aleatorio = (n = 32) => b64url(globalThis.crypto.getRandomValues(new Uint8Array(n)));
export async function sha256b64url(s) { return b64url(await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))); }
export async function sha256hex(s) { return Buffer.from(await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))).toString('hex'); }
export const VERIFIER_OK = /^[A-Za-z0-9._~-]{43,128}$/;
export const CHALLENGE_OK = /^[A-Za-z0-9_-]{43}$/;
/** verifier de 64 caracteres base64url e challenge = base64url(sha256(verifier)) sem '=' (43 caracteres) */
export async function pkceGera() { const verifier = aleatorio(48); return { verifier, challenge: await sha256b64url(verifier) }; }
/** monta o endereço de lançamento na Rixel a partir do modelo (RIXEL_LAUNCH_URL): {tool} {challenge} {state} {redirect} */
export function lancarUrl(modelo, v) {
  return String(modelo).replace(/\{(tool|challenge|state|redirect)\}/g, (_, k) => encodeURIComponent(v[k] || ''));
}
