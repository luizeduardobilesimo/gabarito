// Dependências reais das rotas (montadas do ambiente uma vez por instância). Os testes passam as suas.
import { config } from './config.js';
import { criaBanco } from './banco.js';
import { criaVerificadorRixel } from './jwt.js';

let atual = null;
export function depsPadrao() {
  if (atual) return atual;
  const cfg = config();
  atual = {
    cfg,
    fetch: globalThis.fetch,
    banco: criaBanco({ url: cfg.banco.url, chave: cfg.banco.chave }),
    verifica: criaVerificadorRixel({ emissor: cfg.rixel.emissor, aud: cfg.rixel.aud, jwks: cfg.rixel.jwks }),
  };
  return atual;
}
