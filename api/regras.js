// /api/regras — biblioteca de regras por cidade/zona (Repo.regras).
//   GET [?cidade=]     → publicadas + as do próprio usuário
//   GET ?id=           → uma regra (se publicada ou do usuário)
//   POST {id?,cidade,zona,params,lei,data,status} → cria/atualiza (só as suas; publicar só revisor — perfis.revisor)
//   DELETE ?id=        → só rascunho do próprio usuário (revisor apaga qualquer uma)
import { rota, ErroHttp } from './_lib/http.js';
import { depsPadrao } from './_lib/deps.js';
import { regraCliente, exigeId, ehUuid, nomeOk, agoraISO } from './_lib/dados.js';

const STATUS = ['rascunho', 'publicada', 'arquivada'];
async function ehRevisor(b, sub) {
  try { const [p] = await b.sel('perfis', { f: { id: sub }, cols: 'revisor' }); return !!(p && p.revisor); } catch { return false; }
}
const visivel = (r, sub) => r && (r.status === 'publicada' || r.autor === sub);

export function criaRota(obterDeps) {
  return rota({
    async GET({ q, quem, deps }) {
      const b = deps.banco, sub = quem.sub;
      if (q.id) {
        const [r] = await b.sel('cidades_regras', { f: { id: exigeId(q.id) } });
        if (!visivel(r, sub)) throw new ErroHttp(404, { erro: 'nao_encontrado' });
        return { corpo: regraCliente(r) };
      }
      const f = { $ou: [{ status: 'publicada' }, { autor: sub }] };
      if (q.cidade) f.cidade = String(q.cidade);
      const l = await b.sel('cidades_regras', { f, ordem: 'atualizado.desc' });
      return { corpo: l.map(regraCliente) };
    },
    async POST({ corpo, quem, deps }) {
      const b = deps.banco, sub = quem.sub, r = await corpo();
      if (!r || !r.cidade || !r.params || typeof r.params !== 'object') throw new ErroHttp(400, { erro: 'regra_invalida', motivo: 'Cidade e parâmetros são obrigatórios.' });
      const rev = await ehRevisor(b, sub);
      let status = STATUS.includes(r.status) ? r.status : 'rascunho';
      if (status !== 'rascunho' && !rev) status = 'rascunho';
      const dados = { cidade: nomeOk(r.cidade, ''), zona: nomeOk(r.zona, ''), params: r.params, lei: nomeOk(r.lei, ''), data_lei: nomeOk(r.data, ''), status, atualizado: agoraISO() };
      if (ehUuid(r.id)) {
        const [ja] = await b.sel('cidades_regras', { f: { id: r.id } });
        if (ja) {
          if (ja.autor !== sub && !rev) throw new ErroHttp(403, { erro: 'nao_e_sua', motivo: 'Só o autor ou um revisor muda esta regra.' });
          const [u] = await b.upd('cidades_regras', { id: r.id }, rev ? { ...dados, revisor: sub } : dados);
          return { corpo: regraCliente(u) };
        }
      }
      const [n] = await b.ins('cidades_regras', { ...(ehUuid(r.id) ? { id: r.id } : {}), ...dados, autor: sub });
      return { status: 201, corpo: regraCliente(n) };
    },
    async DELETE({ q, quem, deps }) {
      const b = deps.banco, sub = quem.sub, id = exigeId(q.id);
      if (await ehRevisor(b, sub)) await b.del('cidades_regras', { id });
      else await b.del('cidades_regras', { id, autor: sub, status: 'rascunho' });
      return { corpo: { ok: true } };
    },
  }, obterDeps);
}

export default criaRota(depsPadrao);
