// Mede o otimizador com a fronteira de Pareto (Fase D.5).
//   node tools/bench-otim.mjs [--so-mc] [--obj margem] [--entorno N] [--forma ret|L] [--dump arquivo.json]
//   padrão: torres + tipologias + unidades, multicritério (o caso mais pesado da interface).
//   Mostra o tempo de parede e o tempo de CPU (este quase não oscila quando a máquina está ocupada).
import fs from 'node:fs';
import { carregar, estado } from '../tests/harness.js';

const arg = process.argv.slice(2), val = k => { const i = arg.indexOf(k); return i >= 0 ? arg[i + 1] : null };
const A = carregar(); const st = estado(A, {});
// --entorno N: cerca o lote com N prédios (caixas de 14×14 m, 6–40 m de altura) — como um estudo com o entorno do OSM
const nEnt = +(val('--entorno') || 0);
if (nEnt) { const L = st.lote.pts, cx = L.reduce((s, q) => s + q[0], 0) / L.length, cy = L.reduce((s, q) => s + q[1], 0) / L.length; const e = []; let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = -12; i <= 12 && e.length < nEnt; i++) for (let j = -12; j <= 12 && e.length < nEnt; j++) { const x = cx + i * 30, y = cy + j * 30; if (Math.hypot(i, j) < 2.2) continue; e.push({ pts: [[x, y], [x + 14, y], [x + 14, y + 14], [x, y + 14]], h: Math.round(6 + rnd() * 34) }); }
  st.entorno = e; }
// --forma ret|L: torres desenhadas (Fase C) — o otimizador busca só mix, pavimentos, subsolos e garagens para a forma fixa
if (val('--forma')) st.produto.torres.forEach((_, i) => { A.blcPersonaliza(st, i); A.blcAplicaFormato(st, i, val('--forma')); });
const m = A.compute(st);
const opts = { obj: val('--obj') || 'lucro', torres: true, tipologias: true, unidades: true, mc: !arg.includes('--so-mc'), paretoMax: 8 };
const c0 = process.cpuUsage(), t0 = Date.now();
const r = await A.otimizar(opts, null, null, { st, m });
const ms = Date.now() - t0, c1 = process.cpuUsage(c0), cpu = Math.round((c1.user + c1.system) / 1000);
const key = x => [x.nT, x.pk, x.N, x.pav, x.sub, x.gac].join('|');
const resumo = { ms, cpu, testadas: r.testadas, melhores: r.res.length, pontos: r.pts ? r.pts.length : 0, pareto: r.pareto ? r.pareto.pts.length : 0, fronteira: r.pareto ? r.pareto.pts.filter(p => p.fronteira).length : 0, criterios: r.pareto && r.pareto.criterios };
console.log(JSON.stringify({ ...resumo, top: r.res.slice(0, 3).map(x => [key(x), Math.round(x.lucro / 1e3), +(x.margem * 100).toFixed(2)].join(',')) }));
if (val('--dump')) fs.writeFileSync(val('--dump'), JSON.stringify({ res: r.res.map(x => [key(x), Math.round(x.lucro)]), pareto: r.pareto ? r.pareto.pts.map(x => [key(x), Math.round(x.lucro), !!x.fronteira]) : [], pts: (r.pts || []).map(x => [key(x), Math.round(x.lucro)]) }, null, 1));
