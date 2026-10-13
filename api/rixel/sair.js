// /api/rixel/sair (POST) — encerra a sessão do lançamento: revoke_product_session na Rixel, apaga a sessão e o cookie.
import { depsPadrao } from '../_lib/deps.js';
import { envia, cookies } from '../_lib/http.js';
import { sessaoEncerra, apagaCookie, COOKIE_SESSAO } from '../_lib/sessoes.js';

export function criaRota(obterDeps) {
  return async function handler(req, res) {
    if (req.method !== 'POST') return envia(res, 405, { erro: 'metodo' }, { Allow: 'POST' });
    try { await sessaoEncerra(cookies(req)[COOKIE_SESSAO], await obterDeps()); }
    catch (e) { console.error('[rixel/sair]', e && e.message); }
    envia(res, 200, { ok: true }, { 'Set-Cookie': apagaCookie() });
  };
}

export default criaRota(depsPadrao);
