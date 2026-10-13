// /api/versoes — versões dos estudos do usuário.
//   GET ?estudo=       → lista (sem o estado), mais recente primeiro
//   GET ?id=           → uma versão com o estado
//   POST {id?,estudoId,nome,auto,S,k} → cria (o banco guarda só as 30 automáticas mais novas por estudo)
//   DELETE ?id=
import { rota, ErroHttp } from './_lib/http.js';
import { depsPadrao } from './_lib/deps.js';
import { versaoCliente, versaoResumo, exigeId, exigeEstado, nomeOk, kOk, ehUuid } from './_lib/dados.js';

async function estudoDoDono(b, id, dono) {
  const [e] = await b.sel('estudos', { f: { id: exigeId(id), dono }, cols: 'id' });
  if (!e) throw new ErroHttp(404, { erro: 'estudo_nao_encontrado' });
}

export function criaRota(obterDeps) {
  return rota({
    async GET({ q, quem, deps }) {
      const b = deps.banco, dono = quem.sub;
      if (q.id) {
        const [r] = await b.sel('versoes', { f: { id: exigeId(q.id), dono } });
        if (!r) throw new ErroHttp(404, { erro: 'nao_encontrado' });
        return { corpo: versaoCliente(r) };
      }
      await estudoDoDono(b, q.estudo, dono);
      const l = await b.sel('versoes', { f: { estudo_id: q.estudo, dono }, cols: 'id,estudo_id,nome,auto,autor,criado,k', ordem: 'criado.desc' });
      return { corpo: l.map(versaoResumo) };
    },
    async POST({ corpo, quem, deps }) {
      const b = deps.banco, dono = quem.sub, v = await corpo();
      await estudoDoDono(b, v.estudoId, dono);
      const linha = { dono, estudo_id: v.estudoId, autor: nomeOk(v.autor || quem.nome || quem.email, ''), nome: nomeOk(v.nome, 'Versão'), auto: !!v.auto, estado: exigeEstado(v.S), k: kOk(v.k) };
      if (ehUuid(v.id)) {
        const [ja] = await b.sel('versoes', { f: { id: v.id }, cols: 'id,dono' });
        if (ja) { if (ja.dono !== dono) throw new ErroHttp(409, { erro: 'id_em_uso' }); const [r] = await b.sel('versoes', { f: { id: v.id, dono } }); return { corpo: versaoCliente(r) }; }
        linha.id = v.id;
      }
      const [r] = await b.ins('versoes', linha);
      return { status: 201, corpo: versaoCliente(r) };
    },
    async DELETE({ q, quem, deps }) {
      await deps.banco.del('versoes', { id: exigeId(q.id), dono: quem.sub });
      return { corpo: { ok: true } };
    },
  }, obterDeps);
}

export default criaRota(depsPadrao);
