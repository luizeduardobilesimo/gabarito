import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { carregar, estado } from './harness.js';

// Contexto urbano do OpenStreetMap (src/calc/contexto.js): vias, calçadas, água, mar, verde e edificações classificadas
const A = carregar();
const area = p => Math.abs(A.ctxSArea(p));
const FIX = JSON.parse(fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), 'fixtures', 'overpass-torres.json'), 'utf8'));
// fixture real: Torres (RS), perto da Praia Grande — consulta ctxOverpassQuery(-29.3362, -49.7222, 160, 320)
const LAT = -29.3362, LON = -49.7222, RB = 160, RC = 320, REF = A.geoRef(LAT, LON);

// fábrica de JSON do Overpass a partir de coordenadas locais (metros)
const ref0 = A.geoRef(-29, -49);
const nd = ([x, y]) => { if (x == null) return null; const [lat, lon] = A.geoDeLocal(x, y, ref0); return { lat, lon } };
let seqId = 1000;
const way = (pts, tags, ids) => ({ type: 'way', id: ++seqId, tags, nodes: ids || pts.map(() => ++seqId), geometry: pts.map(nd) });

describe('consulta Overpass do contexto', () => {
  const q = A.ctxOverpassQuery(LAT, LON, RB, RC);
  it('uma consulta só, com edificações, vias, água, costa e verde', () => {
    expect(q.startsWith('[out:json]')).toBe(true);
    expect((q.match(/\[out:json\]/g) || []).length).toBe(1);
    expect(q).toMatch(/way\["building"\]\(around:160,/);
    expect(q).toMatch(/way\["highway"\]\(around:320,/);
    expect(q).toMatch(/coastline/); expect(q).toMatch(/waterway/); expect(q).toMatch(/beach/); expect(q).toMatch(/park/); expect(q).toMatch(/parking/);
    expect(q).toMatch(/out geom\(-29\.\d+,-49\.\d+,-29\.\d+,-49\.\d+\);/);   // geometria cortada no quadrado da busca
  });
});

describe('Torres (fixture real do OSM)', () => {
  const t0 = performance.now();
  const d = A.ctxDeOverpass(FIX, REF, { raio: RC });
  const ms = performance.now() - t0;
  const lote = [[-10, -10], [10, -10], [10, 10], [-10, 10]];
  const ent = A.ctxEntornoOSM(FIX, REF, lote, { raio: RB });
  it('vias com largura e nome, calçadas, mar e praia', () => {
    expect(d.n.vias).toBeGreaterThan(30); expect(d.n.calcadas).toBeGreaterThan(50);
    expect(d.n.mar).toBeGreaterThanOrEqual(1); expect(d.n.areia).toBeGreaterThanOrEqual(1); expect(d.n.verde).toBeGreaterThanOrEqual(1);
    expect(d.vias.every(v => v.w >= 2 && v.w <= 40 && v.p.length >= 2)).toBe(true);
    expect(d.vias.some(v => v.n === 'Avenida Beira-Mar')).toBe(true);
    expect(d.vias.some(v => v.um === 1)).toBe(true);
  });
  it('tudo no sistema local, dentro do raio, polígonos anti-horários', () => {
    const todos = ['vias', 'calcadas', 'rios', 'agua', 'mar', 'areia', 'verde', 'pracas', 'estac'].flatMap(k => d[k]);
    expect(todos.every(it => it.p.every(q => Math.hypot(q[0], q[1]) <= RC * 1.07))).toBe(true);
    ['agua', 'mar', 'areia', 'verde', 'pracas', 'estac'].forEach(k => d[k].forEach(it => expect(A.ctxSArea(it.p)).toBeGreaterThan(0)));
  });
  it('o mar fica a leste (Atlântico) e não cobre o centro', () => {
    const m = d.mar[0].p, c = A.geoCentroide(m);
    expect(c[0]).toBeGreaterThan(150);
    expect(m.some(q => Math.hypot(q[0], q[1]) < 60)).toBe(false);
    expect(area(m)).toBeGreaterThan(5000); expect(area(m)).toBeLessThan(Math.PI * RC * RC * 0.5);
  });
  it('estudo leve e conversão rápida', () => {
    expect(A.ctxTamanho(d)).toBeLessThan(60000);
    expect(ms).toBeLessThan(1500);
  });
  it('edificações classificadas (casa, residencial, comercial, outro) e fora do lote', () => {
    expect(ent.length).toBeGreaterThan(20);
    const tipos = new Set(ent.map(e => e.tipo));
    ['casa', 'residencial', 'comercial'].forEach(t => expect(tipos.has(t)).toBe(true));
    ent.forEach(e => { expect(A.G.pip(A.geoCentroide(e.pts), lote)).toBe(false); expect(e.h).toBeGreaterThan(0) });
  });
});

describe('classificação das edificações', () => {
  it('pelo tipo do OSM e pela altura', () => {
    expect(A.ctxClasse({ building: 'house' }, 6, 120)).toBe('casa');
    expect(A.ctxClasse({ building: 'apartments' }, 30, 500)).toBe('residencial');
    expect(A.ctxClasse({ building: 'residential' }, 6, 150)).toBe('casa');
    expect(A.ctxClasse({ building: 'retail' }, 6, 300)).toBe('comercial');
    expect(A.ctxClasse({ building: 'yes', shop: 'bakery' }, 6, 300)).toBe('comercial');
    expect(A.ctxClasse({ building: 'yes' }, 6, 150)).toBe('casa');
    expect(A.ctxClasse({ building: 'yes' }, 15, 400)).toBe('outro');
    expect(A.ctxClasse({ building: 'school' }, 6, 900)).toBe('outro');
  });
});

describe('geometria', () => {
  it('linha com largura vira faixa (polígono)', () => {
    const f = A.ctxFaixa([[0, 0], [100, 0]], 8);
    expect(area(f)).toBeCloseTo(800, 6);
    const L = A.ctxFaixa([[0, 0], [50, 0], [50, 50]], 6);
    expect(area(L)).toBeGreaterThan(560); expect(area(L)).toBeLessThan(640);
  });
  it('recorte de linha no círculo marca entrada e saída na borda', () => {
    const p = A.ctxClipLinha([[-200, 0], [200, 0]], 100);
    expect(p.length).toBe(1); expect(p[0].ini).toBe(true); expect(p[0].fim).toBe(true);
    expect(p[0].pts[0][0]).toBeCloseTo(-100, 6); expect(p[0].pts[1][0]).toBeCloseTo(100, 6);
    const q = A.ctxClipLinha([[0, 0], [300, 0]], 100);
    expect(q[0].ini).toBe(false); expect(q[0].fim).toBe(true);
  });
  it('mar: costa reta em x = 50 (terra a oeste), mar a leste recortado no raio', () => {
    // linha da costa do OSM: terra à esquerda → no sentido sul→norte a terra fica a oeste
    const R = 100, mar = A.ctxMar([[[50, -300], [50, 300]]], R);
    expect(mar.length).toBe(1);
    const th = Math.acos(50 / R), seg = R * R * (th - Math.sin(th) * Math.cos(th));
    expect(area(mar[0])).toBeGreaterThan(seg * 0.97); expect(area(mar[0])).toBeLessThan(seg * 1.03);
    expect(A.geoCentroide(mar[0])[0]).toBeGreaterThan(50);
    // sentido contrário: o mar fica do outro lado
    const mar2 = A.ctxMar([[[50, 300], [50, -300]]], R);
    expect(A.geoCentroide(mar2[0])[0]).toBeLessThan(50);
  });
  it('anel com trecho desconhecido (fora do quadrado da consulta) é fechado pela borda', () => {
    const D = 100;   // lago de 80 × 160 m que sai pelo norte do quadrado: os pontos de fora vêm como null
    const seq = [[-40, 60], [40, 60], [40, 130], null, null, [-40, 130], [-40, 60]];
    const r = A.ctxFechaAnel(seq, D, [0, 140]);
    const clip = A.ctxClipConvexo(r, [[-D, -D], [D, -D], [D, D], [-D, D]]);
    expect(area(clip)).toBeCloseTo(80 * 40, 0);
  });
});

describe('conversão de vias, calçadas, água e relações', () => {
  const lat = -29, lon = -49;
  // cruzamento de duas ruas residenciais (calçada dos dois lados por padrão), nó comum no meio
  const J = 9001;
  const r1 = way([[-150, 0], [0, 0], [150, 0]], { highway: 'residential', name: 'Rua A' }, [9002, J, 9003]);
  const r2 = way([[0, -150], [0, 0], [0, 150]], { highway: 'residential', name: 'Rua B', oneway: 'yes', lanes: '2' }, [9004, J, 9005]);
  const sw = way([[30, 30], [80, 30]], { highway: 'footway', footway: 'sidewalk' });
  const rio = way([[-150, -80], [150, -80]], { waterway: 'stream' });
  const lago = way([[-100, 60], [-60, 60], [-60, 100], [-100, 100], [-100, 60]], { natural: 'water' });
  lago.nodes[4] = lago.nodes[0];
  const tunel = way([[-150, 40], [150, 40]], { highway: 'primary', tunnel: 'yes' });
  // relação multipolígono (parque) em duas metades, pelos ids dos nós
  const a1 = way([[60, -60], [120, -60], [120, -120]], {}, [7001, 7002, 7003]);
  const a2 = way([[120, -120], [60, -120], [60, -60]], {}, [7003, 7004, 7001]);
  const rel = { type: 'relation', id: 5, tags: { leisure: 'park', type: 'multipolygon' }, members: [{ type: 'way', ref: a1.id, role: 'outer' }, { type: 'way', ref: a2.id, role: 'outer' }] };
  const json = { elements: [r1, r2, sw, rio, lago, tunel, rel, a1, a2] };
  const d = A.ctxDeOverpass(json, A.geoRef(lat, lon), { raio: 200 });
  it('largura: padrão por tipo, faixas (lanes) e via em túnel fica de fora', () => {
    const a = d.vias.find(v => v.n === 'Rua A'), b = d.vias.find(v => v.n === 'Rua B');
    expect(a.w).toBe(7); expect(b.w).toBeCloseTo(6.4, 6); expect(b.um).toBe(1);
    expect(d.vias.some(v => v.t === 'primary')).toBe(false);
  });
  it('calçadas dos dois lados, abertas no cruzamento', () => {
    const ger = d.calcadas.filter(c => !c.k && c.p.length >= 2);
    expect(ger.length).toBeGreaterThanOrEqual(8 + 1);           // 2 ruas × 2 lados × 2 trechos + a calçada mapeada
    // nenhuma calçada atravessa a outra rua perto do cruzamento
    ger.forEach(c => c.p.forEach(q => expect(Math.abs(q[0]) < 3.4 && Math.abs(q[1]) < 3.4).toBe(false)));
    const lado = ger.filter(c => c.p.every(q => Math.abs(q[1] - (3.5 + 1.2)) < 0.2));
    expect(lado.length).toBe(2);                                  // a calçada norte da Rua A tem 2 trechos (cortada na Rua B)
    expect(Math.max(...lado.flatMap(c => c.p.map(q => q[0])).filter(x => x < 0))).toBeLessThan(-5);
  });
  it('rio (linha), lago (polígono) e relação montada pelos nós', () => {
    expect(d.rios.length).toBe(1); expect(d.rios[0].w).toBe(3);
    expect(d.agua.length).toBe(1); expect(area(d.agua[0].p)).toBeCloseTo(1600, -1);
    expect(d.verde.length).toBe(1); expect(area(d.verde[0].p)).toBeCloseTo(3600, -1);
  });
  it('gira junto com a planta (norte da planta a 90°)', () => {
    const g = A.ctxDeOverpass({ elements: [lago] }, A.geoRef(lat, lon), { raio: 200, norte: 90 });
    const c0 = A.geoCentroide(d.agua[0].p), c1 = A.geoCentroide(g.agua[0].p);
    expect(c1[0]).toBeCloseTo(c0[1], 0); expect(c1[1]).toBeCloseTo(-c0[0], 0);
  });
});

describe('estado, link e clima', () => {
  it('S.contexto existe com as camadas ligadas e sem dados', () => {
    const st = estado(A);
    expect(st.contexto.dados).toBe(null);
    expect(Object.values(st.contexto.camadas).every(Boolean)).toBe(true);
  });
  it('o link somente leitura deixa de fora um contexto grande', () => {
    const st = estado(A);
    st.contexto.dados = A.ctxDeOverpass(FIX, REF, { raio: RC });  // ~16 kB: cabe no link
    expect(A.verPayload(st).S.contexto.dados.vias.length).toBe(st.contexto.dados.vias.length);
    const vias = Array.from({ length: 2000 }, (_, i) => ({ p: [[i, 0], [i, 50], [i + 3, 90]], w: 7, t: 'residential' }));
    st.contexto.dados = { vias, n: { vias: vias.length } };          // cidade grande: fica de fora do link
    const big = A.verPayload(st);
    expect(big.S.contexto.dados).toBe(null);
    expect(st.contexto.dados).not.toBe(null);                      // o estudo em si não muda
  });
  it('água, ruas e verde não fazem sombra: só as edificações entram nos prismas do sol e do vento', () => {
    const st = estado(A);
    st.contexto.dados = A.ctxDeOverpass(FIX, REF, { raio: RC });
    st.entorno = A.ctxEntornoOSM(FIX, REF, st.lote.pts, { raio: RB });
    const m = A.compute(st);
    const viz = A.prisms(st, m).filter(p => !p.own);
    expect(viz.length).toBe(st.entorno.length);
  });
});

/* ---------- busca resiliente (sem rede: tudo injetado) ---------- */
describe('vector tile (MVT)', () => {
  it('codifica e decodifica linhas, polígonos, textos e números', () => {
    const buf = A.mvtCodifica({ transportation_name: { feats: [
      { tipo: 2, props: { name: 'Rua Ä', class: 'minor', n: 5, f: 1.5 }, geom: [[[10, 10], [20, -5], [100, 300]]] },
      { tipo: 3, props: {}, geom: [[[0, 0], [10, 0], [10, 10], [0, 0]]] }] }, outra: { feats: [{ tipo: 1, props: { a: 'b' }, geom: [[[7, 8]]] }] } });
    const r = A.mvtLer(buf);
    expect(Object.keys(r).sort()).toEqual(['outra', 'transportation_name']);
    expect(r.transportation_name.extent).toBe(4096);
    expect(r.transportation_name.feats[0]).toEqual({ tipo: 2, props: { name: 'Rua Ä', class: 'minor', n: 5, f: 1.5 }, geom: [[[10, 10], [20, -5], [100, 300]]] });
    expect(r.transportation_name.feats[1].geom).toEqual([[[0, 0], [10, 0], [10, 10], [0, 0]]]);
    expect(r.outra.feats[0].geom).toEqual([[[7, 8]]]);
    expect(Object.keys(A.mvtLer(buf, { camadas: ['outra'] }))).toEqual(['outra']);
  });
  it('tile truncado lança erro (a busca resiliente captura)', () => {
    const buf = A.mvtCodifica({ a: { feats: [{ tipo: 2, props: {}, geom: [[[1, 1], [50, 50]]] }] } });
    expect(() => A.mvtLer(buf.slice(0, buf.length - 3))).toThrow();
  });
});

describe('contexto: último resultado, consulta leve e tile', () => {
  const lat = -29.335, lon = -49.727, ref = A.geoRef(lat, lon);
  it('consulta leve: só vias e prédios, raio menor, tempo curto', () => {
    const q = A.ctxOverpassQueryLeve(lat, lon, 100, 200);
    expect(q).toMatch(/^\[out:json\]\[timeout:25\];/);
    expect(q).toMatch(/way\["building"\]\(around:100,/); expect(q).toMatch(/way\["highway"\]\(around:200,/);
    expect(q).not.toMatch(/waterway|natural|leisure|relation/);
    expect(q.length).toBeLessThan(A.ctxOverpassQuery(lat, lon, 150, 350).length / 2);
  });
  it('data em português e validade do contexto guardado', () => {
    expect(A.ctxQuandoBR('2026-10-05')).toBe('05/10/2026'); expect(A.ctxQuandoBR(undefined)).toBe('');
    const d = { vias: [], lat, lon, norte: 10 };
    expect(A.ctxDadosValem(d, lat, lon, 10)).toBe(true);
    expect(A.ctxDadosValem(d, lat + 0.001, lon, 10)).toBe(false);      // lote levado para outro lugar
    expect(A.ctxDadosValem(d, lat, lon, 40)).toBe(false);              // planta girada: as vias não casam mais
    expect(A.ctxDadosValem(null, lat, lon, 0)).toBe(false); expect(A.ctxDadosValem({ vias: [] }, lat, lon, 0)).toBe(false);
  });
  it('largura medida (tag width) é marcada; sem ela a largura é estimada', () => {
    const j = { elements: [way([[-100, 0], [100, 0]], { highway: 'residential', name: 'Rua M', width: '9' }), way([[0, -100], [0, 100]], { highway: 'residential', name: 'Rua E' })] };
    const d = A.ctxDeOverpass(j, ref0, { raio: 150 });
    expect(d.vias.find(v => v.n === 'Rua M')).toMatchObject({ w: 9, m: 1 });
    expect(d.vias.find(v => v.n === 'Rua E').m).toBeUndefined();
  });
  it('tiles que cobrem o lote e conversão das vias do tile para o sistema local', () => {
    const ts = A.ctxTilesCobrindo(lat, lon, 200, 14);
    expect(ts.length).toBeGreaterThanOrEqual(1); expect(ts.length).toBeLessThanOrEqual(4);
    expect(ts).toContainEqual({ z: 14, x: 5928, y: 9589 });
    // uma rua leste-oeste passando pelo ponto, no tile 5928/9589 (extent 4096)
    const p = A.ctxTileDe(lat, lon, 14), px = (p.x - 5928) * 4096, py = (p.y - 9589) * 4096;
    const mPorUn = 40075016.686 * Math.cos(lat * Math.PI / 180) / Math.pow(2, 14) / 4096;
    const tile = { z: 14, x: 5928, y: 9589, camadas: A.mvtLer(A.mvtCodifica({ transportation_name: { feats: [
      { tipo: 2, props: { name: 'Rua do Teste', class: 'minor' }, geom: [[[Math.round(px - 150 / mPorUn), Math.round(py)], [Math.round(px + 150 / mPorUn), Math.round(py)]]] },
      { tipo: 2, props: { name: 'Trilha', class: 'path' }, geom: [[[100, 100], [200, 200]]] }] } })) };
    const d = A.ctxDadosDeTiles([tile], ref, { raio: 200 });
    expect(d.vias.length).toBe(1);                                      // trilha ignorada
    const v = d.vias[0];
    expect(v.n).toBe('Rua do Teste'); expect(v.t).toBe('residential'); expect(v.w).toBe(7); expect(v.m).toBeUndefined();
    expect(Math.abs(v.p[0][1])).toBeLessThan(2); expect(Math.abs(v.p[1][1])).toBeLessThan(2);   // passa pela origem, a menos de 2 m
    expect(Math.abs(v.p[0][0] - v.p[1][0])).toBeGreaterThan(190);
    expect(d.n.vias).toBe(1);
  });
});

describe('ctxBuscaResiliente (completa → leve → tile → erro)', () => {
  const lat = -29.335, lon = -49.727;
  const jsonOk = { elements: [way([[-100, 0], [100, 0]], { highway: 'residential', name: 'Rua OK' })] };
  const p = A.ctxTileDe(lat, lon, 14);
  const tileBuf = A.mvtCodifica({ transportation_name: { feats: [{ tipo: 2, props: { name: 'Rua do Tile', class: 'tertiary' }, geom: [[[Math.round((p.x - 5928) * 4096) - 300, Math.round((p.y - 9589) * 4096)], [Math.round((p.x - 5928) * 4096) + 300, Math.round((p.y - 9589) * 4096)]]] }] } });
  const base = { lat, lon, raio: 150, raioCtx: 350, norte: 0 };
  const rodar = async (fj, ft) => { const est = [], q = []; const r = await A.ctxBuscaResiliente({ ...base, fetchJson: async (qq, o) => { q.push([qq, o && o.limite]); return fj(qq, q.length) }, fetchTile: ft, aoEstagio: n => est.push(n) }); return { r, est, q } };
  it('a completa funcionou: não tenta mais nada', async () => {
    const { r, est, q } = await rodar(() => jsonOk);
    expect(r.nivel).toBe('completa'); expect(r.json).toBe(jsonOk); expect(r.raioPred).toBe(150); expect(r.raioCtx).toBe(350);
    expect(est).toEqual(['completa']); expect(q.length).toBe(1); expect(q[0][0]).toMatch(/relation\["building"\]/);
  });
  it('a completa falha em todos os espelhos: tenta a leve, de raio menor', async () => {
    const { r, est, q } = await rodar((qq, n) => { if (n === 1) throw new Error('erro 504'); return jsonOk });
    expect(r.nivel).toBe('leve'); expect(r.raioPred).toBe(100); expect(r.raioCtx).toBe(200);
    expect(est).toEqual(['completa', 'leve']);
    expect(q[1][0]).toBe(A.ctxOverpassQueryLeve(lat, lon, 100, 200)); expect(q[1][1]).toBeLessThan(q[0][1]);
  });
  it('raios já pequenos não crescem na consulta leve', async () => {
    const r = await A.ctxBuscaResiliente({ ...base, raio: 60, raioCtx: 120, fetchJson: async (q) => { if (/relation/.test(q)) throw new Error('x'); return jsonOk } });
    expect(r.nivel).toBe('leve'); expect(r.raioPred).toBe(60); expect(r.raioCtx).toBe(120);
  });
  it('as duas falham: vias do tile vetorial (sem prédios e sem largura medida)', async () => {
    const { r, est } = await rodar(() => { throw new Error('sem conexão') }, async () => tileBuf);
    expect(est).toEqual(['completa', 'leve', 'tile']);
    expect(r.nivel).toBe('tile'); expect(r.dados.vias[0]).toMatchObject({ n: 'Rua do Tile', t: 'tertiary', w: 8 });
    expect(r.dados.vias[0].m).toBeUndefined(); expect(r.dados.n.vias).toBe(1);
  });
  it('tudo falha: devolve o erro (sem lançar) e a lista de falhas', async () => {
    const { r } = await rodar(() => { throw new Error('erro 504') }, async () => { throw new Error('tile fora do ar') });
    expect(r.erro).toBeTruthy(); expect(r.nivel).toBeUndefined(); expect(r.falhas.length).toBeGreaterThanOrEqual(3);
    expect(r.falhas[0]).toMatch(/^completa: /);
  });
  it('tile corrompido ou vazio não quebra a busca', async () => {
    const r1 = await rodar(() => { throw new Error('x') }, async () => new Uint8Array([1, 2, 3]));
    expect(r1.r.erro).toBeTruthy();
    const r2 = await rodar(() => { throw new Error('x') }, async () => A.mvtCodifica({ transportation_name: { feats: [] } }));
    expect(r2.r.erro).toBeTruthy();
  });
  it('sem função de tile: o erro vem depois da leve', async () => {
    const r = await rodar(() => { throw new Error('erro 429') });
    expect(r.r.erro).toBe('erro 429'); expect(r.est).toEqual(['completa', 'leve']);
  });
  it('a resposta vazia de um espelho (null) conta como falha e desce o degrau', async () => {
    const { r } = await rodar((q, n) => n === 1 ? null : jsonOk);
    expect(r.nivel).toBe('leve');
  });
});
