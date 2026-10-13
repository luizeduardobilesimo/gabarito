// /api/saude — sinal de vida e o que está configurado (sem nenhum segredo). O app lê `config` para montar a tela de entrada.
import { config } from './_lib/config.js';
import { envia } from './_lib/http.js';

export default function handler(req, res) {
  const c = config();
  envia(res, 200, {
    ok: true, app: 'gabarito', hora: new Date().toISOString(),
    config: {
      banco: !!c.banco.chave,
      lancamento: !!c.toolId && !!c.banco.chave,   // "Entrar com a Rixel" pronto
      loginDireto: c.loginDireto,                   // formulário de e-mail e senha (caminho B)
      aberto: c.acessoAberto,
    },
  });
}
