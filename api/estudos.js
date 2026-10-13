// /api/estudos — estudos do usuário (dono = sub da Rixel). Controle de conflito por `rev`.
//   GET                → lista (sem o estado), mais recente primeiro
//   GET ?id=           → um estudo com o estado (S)
//   POST {id?,nome,S,k}            → cria
//   PUT ?id= {nome,S,k,rev}        → grava só se `rev` = revisão no banco; senão 409 {erro:"conflito", atual}
//   DELETE ?id=        → apaga (as versões caem em cascata)
import { rota, ErroHttp } from './_lib/http.js';
import { depsPadrao } from './_lib/deps.js';
import { estudoCliente, estudoResumo, exigeId, exigeEstado, nomeOk, kOk, ehUuid, agoraISO } from './_lib/dados.js';

const RESUMO = 'id,dono,nome,k,rev,criado,atualizado';

export function criaRota(obterDeps) {
  return rota({
    async GET({ q, quem, deps }) {
      const b = deps.banco, dono = quem.sub;
      if (q.id) {
        const [r] = await b.sel('estudos', { f: { id: exigeId(q.id), dono } });
        if (!r) throw new ErroHttp(404, { erro: 'nao_encontrado' });
        return { corpo: estudoCliente(r) };
      }
      const l = await b.sel('estudos', { f: { dono }, cols: RESUMO, ordem: 'atualizado.desc' });
      return { corpo: l.map(estudoResumo) };
    },
    async POST({ corpo, quem, deps }) {
      const b = deps.banco, dono = quem.sub, e = await corpo();
      const S = exigeEstado(e.S);
      const linha = { dono, nome: nomeOk(e.nome, 'Estudo'), estado: S, k: kOk(e.k), rev: 1 };
      if (ehUuid(e.id)) {
        const [ja] = await b.sel('estudos', { f: { id: e.id }, cols: 'id,dono' });
        if (ja) throw new ErroHttp(409, { erro: 'id_em_uso', motivo: 'Este estudo já existe.' });
        linha.id = e.id;
      }
      const [r] = await b.ins('estudos', linha);
      return { status: 201, corpo: estudoCliente(r) };
    },
    async PUT({ q, corpo, quem, deps }) {
      const b = deps.banco, dono = quem.sub, id = exigeId(q.id), e = await corpo();
      const S = exigeEstado(e.S), rev = Number(e.rev);
      if (!Number.isInteger(rev) || rev < 1) throw new ErroHttp(400, { erro: 'rev', motivo: 'Revisão ausente.' });
      // atualização condicional: só passa se ninguém gravou depois da revisão que o cliente conhece
      const [r] = await b.upd('estudos', { id, dono, rev }, { nome: nomeOk(e.nome, 'Estudo'), estado: S, k: kOk(e.k), rev: rev + 1, atualizado: agoraISO() });
      if (r) return { corpo: estudoCliente(r) };
      const [atual] = await b.sel('estudos', { f: { id, dono } });
      if (!atual) throw new ErroHttp(404, { erro: 'nao_encontrado' });
      throw new ErroHttp(409, { erro: 'conflito', motivo: 'O estudo foi alterado em outro aparelho.', atual: estudoCliente(atual) });
    },
    async DELETE({ q, quem, deps }) {
      await deps.banco.del('estudos', { id: exigeId(q.id), dono: quem.sub });
      return { corpo: { ok: true } };
    },
  }, obterDeps);
}

export default criaRota(depsPadrao);
