// /api/rixel/callback?code=…[&state=…] — volta do lançamento pela Rixel (URL cadastrada na Rixel exatamente assim, sem query).
import { depsPadrao } from '../_lib/deps.js';
import { redireciona, query } from '../_lib/http.js';
import { lancamentoVolta } from '../_lib/lancamento.js';

export function criaRota(obterDeps) {
  return async function handler(req, res) {
    const deps = await obterDeps();
    let r;
    try { r = await lancamentoVolta(req, query(req), deps); }
    catch (e) { console.error('[rixel/callback]', e && e.message); r = { url: deps.cfg.appUrl + '/?entrada=erro', cookies: [] }; }
    redireciona(res, r.url, r.cookies.length ? { 'Set-Cookie': r.cookies } : {});
  };
}

export default criaRota(depsPadrao);
