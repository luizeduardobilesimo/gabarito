// /api/rixel/iniciar — começa o lançamento pela Rixel (PKCE): cookie de 5 min com verifier+state e redireciona para a Rixel.
import { depsPadrao } from '../_lib/deps.js';
import { redireciona } from '../_lib/http.js';
import { lancamentoInicio } from '../_lib/lancamento.js';

export function criaRota(obterDeps) {
  return async function handler(req, res) {
    const r = await lancamentoInicio(await obterDeps());
    redireciona(res, r.url, r.cookies.length ? { 'Set-Cookie': r.cookies } : {});
  };
}

export default criaRota(depsPadrao);
