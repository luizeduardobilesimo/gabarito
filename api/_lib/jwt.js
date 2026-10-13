// Verificação do token de acesso do Supabase da Rixel (ES256, JWKS público) — usado SÓ no caminho B (login direto,
// desligado por padrão). O caminho principal (lançamento pela Rixel) não tem JWT: usa a sessão opaca do Gabarito.
import { jwtVerify, createRemoteJWKSet } from 'jose';

export class ErroToken extends Error {
  constructor(motivo, msg) { super(msg || motivo); this.motivo = motivo; }
}

const CONJUNTOS = new Map();   // cache das chaves por URL (vive enquanto a instância da função estiver quente)
/** conjunto de chaves remoto, com cache (10 min) e espera mínima entre novas buscas (30 s) */
export function jwksRemoto(url) {
  if (!CONJUNTOS.has(url)) CONJUNTOS.set(url, createRemoteJWKSet(new URL(url), { cacheMaxAge: 10 * 60 * 1000, cooldownDuration: 30 * 1000 }));
  return CONJUNTOS.get(url);
}

/**
 * Cria a função que verifica o token da Rixel.
 * @param {{emissor:string, aud:string, jwks?:string, chaves?:any}} o  `chaves` (função do jose) substitui o JWKS remoto nos testes
 */
export function criaVerificadorRixel(o) {
  const chaves = o.chaves || jwksRemoto(o.jwks);
  return async function verifica(token) {
    if (!token || typeof token !== 'string' || token.split('.').length !== 3) throw new ErroToken('ausente', 'Sem token de acesso.');
    let r;
    try {
      r = await jwtVerify(token, chaves, { issuer: o.emissor, audience: o.aud, algorithms: ['ES256'], clockTolerance: 30 });
    } catch (e) {
      const c = e && e.code;
      if (c === 'ERR_JWT_EXPIRED') throw new ErroToken('expirado', 'Sessão expirada.');
      if (c === 'ERR_JWT_CLAIM_VALIDATION_FAILED') throw new ErroToken('claim', 'Token de outro emissor ou público.');
      throw new ErroToken('invalido', 'Token inválido.');
    }
    const p = r.payload;
    if (!p.sub) throw new ErroToken('invalido', 'Token sem usuário.');
    if (p.is_anonymous === true) throw new ErroToken('anonimo', 'Usuário anônimo não tem acesso.');
    if (p.role && p.role !== 'authenticated') throw new ErroToken('papel', 'Papel não autorizado.');
    return { sub: String(p.sub), email: p.email || '', payload: p };
  };
}
