// Conversão entre as linhas do banco do Gabarito e os objetos da interface Repo do navegador (docs/BACKEND.md).
import { ErroHttp } from './http.js';

export const LIMITE_ESTADO = 3.5 * 1024 * 1024;   // a Vercel aceita até 4,5 MB por pedido

export const estudoCliente = r => r && ({ id: r.id, nome: r.nome, S: r.estado, k: r.k ?? null, rev: r.rev, criado: r.criado, atualizado: r.atualizado, dono: r.dono });
export const estudoResumo = r => { const o = estudoCliente(r); delete o.S; return o; };
export const versaoCliente = r => r && ({ id: r.id, estudoId: r.estudo_id, nome: r.nome, auto: !!r.auto, autor: r.autor || '', criado: r.criado, S: r.estado, k: r.k ?? null });
export const versaoResumo = r => { const o = versaoCliente(r); delete o.S; return o; };
export const regraCliente = r => r && ({ id: r.id, cidade: r.cidade, zona: r.zona, params: r.params, lei: r.lei || '', data: r.data_lei || '', status: r.status, autor: r.autor, criado: r.criado, atualizado: r.atualizado });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const ehUuid = s => typeof s === 'string' && UUID.test(s);
export function exigeId(id) { if (!ehUuid(id)) throw new ErroHttp(400, { erro: 'id_invalido', motivo: 'Identificador inválido.' }); return id; }
export function exigeEstado(S) {
  if (!S || typeof S !== 'object' || Array.isArray(S)) throw new ErroHttp(400, { erro: 'estado_invalido', motivo: 'Estado do estudo ausente.' });
  if (JSON.stringify(S).length > LIMITE_ESTADO) throw new ErroHttp(413, { erro: 'grande', motivo: 'Estudo grande demais para a nuvem.' });
  return S;
}
export const nomeOk = (s, padrao) => String(s == null || s === '' ? padrao : s).slice(0, 200);
export const kOk = k => (k && typeof k === 'object' && !Array.isArray(k) ? k : null);
export const agoraISO = () => new Date().toISOString();
