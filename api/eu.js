// /api/eu — quem está logado e se pode usar: {usuario, acesso:{ok, plano, recursos, motivo, via}, nuvem}
// Responde 200 mesmo quando a pessoa NÃO tem acesso no login direto (a tela mostra o motivo);
// no lançamento pela Rixel, sessão sem direito já volta 401 (cookie apagado) com o motivo.
import { rota } from './_lib/http.js';
import { depsPadrao } from './_lib/deps.js';
import { perfilRixel } from './_lib/acesso.js';

export function criaRota(obterDeps) {
  return rota({
    async GET({ quem, deps }) {
      const perfil = quem.tipo === 'rixel' ? await perfilRixel(deps.cfg, quem.token, quem.sub, deps.fetch) : null;
      const a = quem.acesso;
      return { corpo: {
        usuario: { id: quem.sub, email: quem.email || '', nome: (perfil && perfil.nome) || quem.nome || '', avatar: (perfil && perfil.avatar) || '', entrada: quem.tipo },
        acesso: { ok: a.ok, plano: a.plano || null, recursos: a.recursos || {}, motivo: a.motivo || '', via: a.via || '' },
        nuvem: !!deps.banco,
      } };
    },
  }, obterDeps, { exigeAcesso: false, semBanco: true });
}

export default criaRota(depsPadrao);
