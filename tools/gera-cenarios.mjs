// Gera/atualiza os resultados esperados dos estudos de referência (tests/cenarios/*.json).
// Rode SÓ quando uma mudança de resultado for intencional:  node tools/gera-cenarios.mjs
import fs from 'node:fs';
import path from 'node:path';
import { carregar, estado } from '../tests/harness.js';
import { ROOT } from './bundle.mjs';
const D = path.join(ROOT, 'tests', 'cenarios');
const BASE = {
  '01-exemplo.json': { nome: 'Exemplo padrão', S: {} },
  '02-lote-estreito.json': { nome: 'Lote estreito 20×40', S: { lote: { pts: [[0,0],[20,0],[20,40],[0,40]], front: [0], rec: [{},{},{},{}] }, produto: { torres: [{ pav: 10 }], subsolos: 2 } } },
  '03-esquina.json': { nome: 'Lote de esquina 30×30', S: { lote: { pts: [[0,0],[30,0],[30,30],[0,30]], front: [0, 3], rec: [{},{},{},{}] }, produto: { torres: [{ pav: 12 }] } } },
  '04-tres-subsolos-alternados.json': { nome: '3 subsolos, rampas alternadas', S: { produto: { subsolos: 3 }, estudo: { rampaTipo: 'alternada' } } },
  '05-subsolo-e-garagem-elevada.json': { nome: '1 subsolo + 1 garagem elevada', S: { produto: { subsolos: 1, garAcima: 1 } } },
};
const resumo = (m, f) => ({
  units: m.units, vagas: m.vagas, vagasReq: m.vagasReq, CA: +m.CA.toFixed(4), H: +m.H.toFixed(2), priv: Math.round(m.priv),
  vagasPorPav: Object.fromEntries(Object.entries(m.gar || {}).filter(([, l]) => l).map(([k, l]) => [k, l.count])),
  vgv: Math.round(f.vgv), custo: Math.round(f.custo), lucro: Math.round(f.lucro), margem: +f.margem.toFixed(5),
});
fs.mkdirSync(D, { recursive: true });
for (const [arq, c] of Object.entries(BASE)) {
  const G = carregar(); const st = estado(G, c.S); const m = G.compute(st); const f = G.finance(st, m);
  const out = { ...c, esperado: resumo(m, f), tolerancia: { vagas: 0.03, CA: 0.002, lucro: 0.01 } };
  fs.writeFileSync(path.join(D, arq), JSON.stringify(out, null, 1));
  console.log(arq, JSON.stringify(out.esperado));
}
