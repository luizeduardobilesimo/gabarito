// Térreo, hall e áreas comuns (src/calc/comuns.js, docs/COMUNS.md §3): programa, adjacências, rota acessível, gás e lixo,
// nenhum ambiente sem acesso e nenhum ambiente solto no meio da circulação.
import { describe, it, expect } from 'vitest';
import { carregar, estado } from './harness.js';

const T = { timeout: 240000 };
const A = carregar();
const G = A.G;
const LZ = [
  { nome: 'Salão de festas', area: 90, local: 'terreo' }, { nome: 'Espaço gourmet', area: 45, local: 'terreo' }, { nome: 'Academia', area: 60, local: 'terreo' },
  { nome: 'Brinquedoteca', area: 35, local: 'terreo' }, { nome: 'Piscina', area: 70, local: 'emb', desc: true }, { nome: 'Deck / solário', area: 80, local: 'emb', desc: true },
  { nome: 'Playground', area: 50, local: 'emb', desc: true }];
const ret = (w, d) => ({ pts: [[0, 0], [w, 0], [w, d], [0, d]], front: [0], principal: 0, rec: [{}, {}, {}, {}], acessoPed: 0.3, acessoVei: 0.8 });
const CASOS = {
  exemplo: {},
  grande: { lote: ret(60, 75), produto: { torres: [{ pav: 16 }], subsolos: 1, garAcima: 0, lojaTerreo: 0, garTerOn: true, lazer: { hall: 0, itens: LZ } } },
  pequeno: { lote: ret(18, 36), produto: { torres: [{ pav: 10 }], subsolos: 1, garAcima: 0, lojaTerreo: 0, garTerOn: false, cob: { on: false, qtd: 1, area: 120, preco: 15000 },
    mix: [{ nome: '2 dorm.', area: 62, qtd: 2, preco: 12000, sac: 5 }], lazer: { hall: 0, itens: [{ nome: 'Espaço gourmet', area: 35, local: 'terreo' }, { nome: 'Academia', area: 30, local: 'terreo' }] } } },
};
const R = {};
const calc = k => R[k] || (R[k] = (() => { const st = estado(A, CASOS[k]); return { st, m: A.compute(st) } })());
const terreo = C => C.amb.filter(a => a.local === 'terreo' && !a.recuo);
const centro = p => G.centroid(p);
// ponto logo fora do meio de cada lado do retângulo (no referencial do térreo)
const ladosFora = (a, ux, vy, d = 0.25) => { const P = a.poly.map(q => [G.dot(q, ux), G.dot(q, vy)]), u0 = Math.min(...P.map(q => q[0])), u1 = Math.max(...P.map(q => q[0])), v0 = Math.min(...P.map(q => q[1])), v1 = Math.max(...P.map(q => q[1]));
  const W = (u, v) => [ux[0] * u + vy[0] * v, ux[1] * u + vy[1] * v], um = (u0 + u1) / 2, vm = (v0 + v1) / 2;
  return [W(u0 - d, vm), W(u1 + d, vm), W(um, v0 - d), W(um, v1 + d)] };

describe('programa realista do térreo', () => {
  it('o apoio do condomínio entra no programa (portaria, clausura, sanitários, funcionários, DML, lixo, gás, medidores)', T, () => {
    const { st, m } = calc('exemplo');
    const ks = A.comunsPrograma(st, m).map(a => a.k);
    for (const k of ['clausura', 'portaria', 'hall', 'wc', 'vest', 'copaf', 'dml', 'lixo', 'gas', 'medidores']) expect(ks).toContain(k);
    expect(ks).toContain('salao'); expect(ks).toContain('copa');   // salão vira salão + copa
  });
  it('no exemplo, o programa inteiro cabe no térreo e a nota é boa', T, () => {
    const { m } = calc('exemplo'), C = m.comuns;
    expect(C).toBeTruthy();
    expect(C.falta.filter(a => a.local === 'terreo')).toEqual([]);
    expect(C.nota).toBeGreaterThanOrEqual(75);
    expect(C.problemas.filter(p => p.nivel === 'bad')).toEqual([]);
  });
  it('lote grande e lote pequeno: cada ambiente com nome, área e mobiliário; o que não cabe vira aviso com motivo', T, () => {
    for (const k of ['grande', 'pequeno']) { const { m } = calc(k), C = m.comuns;
      expect(C.amb.length).toBeGreaterThan(8);
      C.amb.forEach(a => { expect(a.nome).toBeTruthy(); expect(a.area).toBeGreaterThan(0.5) });
      terreo(C).filter(a => !['clausura', 'hall'].includes(a.k)).forEach(a => expect((a.moveis || []).length, a.nome).toBeGreaterThan(0));
      C.falta.forEach(a => { expect(a.motivo).toBeTruthy(); expect(C.problemas.some(p => p.msg.startsWith(a.nome))).toBe(true) }) }
  });
  it('o que sobra vira estar ou área livre coberta (aberta para a circulação, com bancos) ou reserva técnica; ambiente reduzido cresce para o vão ao lado', T, () => {
    for (const k of ['exemplo', 'pequeno']) { const C = calc(k).m.comuns;
      (C.estar || []).forEach(e => { expect(['estar', 'pilotis', 'reserva']).toContain(e.k); expect(e.area).toBeGreaterThanOrEqual(4); if (e.k !== 'reserva') expect(e.moveis.length, `${k}: ${e.nome}`).toBeGreaterThan(0) }) }
    const gm = calc('exemplo').m.comuns.amb.find(a => a.k === 'gourmet'); expect(gm.area).toBeGreaterThan(gm.A * 0.9);
  });
  it('cálculo rápido (otimizador) não roda o planejador', T, () => {
    const st = estado(A, {}), m = A.compute(st, { quick: true, layouts: false });
    expect(m.comuns == null).toBe(true); expect(Array.isArray(m.lzLay.terreo)).toBe(true);
  });
});

describe('adjacências e acessos', () => {
  it('a copa encosta no salão de festas e abre para ele', T, () => {
    const { m } = calc('exemplo'), C = m.comuns, sal = C.amb.find(a => a.k === 'salao'), cp = C.amb.find(a => a.k === 'copa');
    expect(sal && cp).toBeTruthy();
    const [ux, vy] = C.eixos.terreo; expect(ladosFora(cp, ux, vy, 0.2).some(p => G.pip(p, sal.poly)) || ladosFora(sal, ux, vy, 0.2).some(p => G.pip(p, cp.poly))).toBe(true);
    expect((cp.portas || []).length).toBeGreaterThan(0);
  });
  it('nenhum ambiente coberto do térreo sem porta para a circulação', T, () => {
    for (const k of ['exemplo', 'grande', 'pequeno']) terreo(calc(k).m.comuns).filter(a => a.k !== 'hall').forEach(a => expect((a.portas || []).length, `${k}: ${a.nome}`).toBeGreaterThan(0));
  });
  it('rota acessível: do portão ao hall dos elevadores de cada torre e a cada ambiente, sem atravessar outro ambiente', T, () => {
    for (const k of ['exemplo', 'grande', 'pequeno']) { const { m } = calc(k), C = m.comuns;
      const torres = C.rota.filter(r => r.local === 'terreo' && r.amb == null);
      expect(torres.length, k).toBeGreaterThan(0); torres.forEach(r => { expect(r.sem, `${k}: ${r.para}`).toBeFalsy(); expect(r.pts.length).toBeGreaterThan(1) });
      terreo(C).forEach(a => { if (a.rotaOk === false) expect(a.par && C.amb.find(x => x.id === a.par && x.rotaOk !== false), `${k}: ${a.nome}`).toBeTruthy() });
      expect(C.problemas.filter(p => p.k === 'rota' && p.nivel === 'bad')).toEqual([]) }
  });
  it('nenhum ambiente solto no meio: cada um tem ao menos dois lados encostados em parede, núcleo, outro ambiente ou estar', T, () => {
    // (o estar / área livre coberta é um lugar de ficar, como um terraço: encostar nele não é "solto na circulação")
    for (const k of ['exemplo', 'grande', 'pequeno']) { const { m } = calc(k), C = m.comuns, [ux, vy] = C.eixos.terreo;
      const circ = [...(C.circ.terreo || []), ...(C.circ.hall || [])];
      terreo(C).filter(a => a.k !== 'hall').forEach(a => { const livres = ladosFora(a, ux, vy).filter(p => circ.some(c => G.pip(p, c))).length;
        expect(livres, `${k}: ${a.nome}`).toBeLessThanOrEqual(2) }) }
  });
});

describe('núcleo novo (lay.nucleo.portas, docs/COMUNS.md §0)', () => {
  it('com as portas do núcleo publicadas, a rota do hall termina na porta do elevador', T, () => {
    const st = estado(A, {}), m = A.compute(st), cs = m.coreSets[0], lob = cs.lobby, c = G.centroid(lob);
    cs.lay = { ...(cs.lay || {}), nucleo: { portas: [{ p: c, dir: [0, 1], larg: 0.9, tipo: 'elev' }, { p: [c[0] + 50, c[1]], dir: [0, 1], larg: 0.9, tipo: 'escada' }] } };
    const C = A.comunsCalc(st, m), r = C.rota.find(x => x.torre === cs.i && x.local === 'terreo');
    expect(r && r.pts.length > 1).toBe(true);
    const fim = r.pts[r.pts.length - 1]; expect(Math.hypot(fim[0] - c[0], fim[1] - c[1])).toBeLessThan(0.01);
  });
});

describe('convivência com a garagem do térreo e com o núcleo real', () => {
  it('nenhum ambiente nem galeria sobre vaga ou corredor da garagem do térreo (garagem por partidos)', T, () => {
    for (const k of ['exemplo', 'grande']) { const { m } = calc(k), C = m.comuns, gt = m.gar && m.gar.ter; if (!gt) continue;
      const enc = p => G.scaleToArea(p, G.area(p) * 0.9);
      const obst = [...gt.vagas.filter(v => v.tipo !== 'off').map(v => v.poly), ...(gt.aisles || []).map(a => a.poly)];
      terreo(C).forEach(a => obst.forEach(o => expect(G.polysOverlap(enc(a.poly), enc(o)), `${k}: ${a.nome}`).toBe(false))) }
  });
  it('a rota acessível termina na porta do elevador publicada pelo núcleo (lay.nucleo.portas)', T, () => {
    const { m } = calc('exemplo'), C = m.comuns;
    m.coreSets.forEach(cs => { const ps = ((cs.lay.nucleo || {}).portas || []).filter(p => p.tipo === 'elev'); if (!ps.length) return;
      const r = C.rota.find(x => x.local === 'terreo' && x.torre === cs.i && !x.sem); expect(r, `torre ${cs.i + 1}`).toBeTruthy();
      const fim = r.pts[r.pts.length - 1]; expect(Math.min(...ps.map(p => Math.hypot(p.p[0] - fim[0], p.p[1] - fim[1])))).toBeLessThan(0.01) });
  });
  it('lote estreito (estudo de referência): com o hall dos elevadores invadido pela faixa de veículos, o programa cabe e o problema é grave e claro', T, () => {
    const st = estado(A, { lote: { pts: [[0, 0], [20, 0], [20, 40], [0, 40]], front: [0], rec: [{}, {}, {}, {}] }, produto: { torres: [{ pav: 10 }], subsolos: 2 } }), m = A.compute(st), C = m.comuns;
    expect(C.falta.filter(a => a.local === 'terreo' && a.k !== 'hall')).toEqual([]);
    expect(C.problemas.some(p => p.k === 'veiculos' && p.nivel === 'bad' && /hall dos elevadores/.test(p.msg))).toBe(true);
  });
  it('partido perimetral: cada ambiente coberto encosta as costas numa parede, no núcleo ou em outro ambiente', T, () => {
    for (const k of ['exemplo', 'grande']) { const { m } = calc(k), C = m.comuns, [ux, vy] = C.eixos.terreo; if (!['perimetro', 'galeria'].includes(C.partido)) continue;
      const circ = [...(C.circ.terreo || []), ...(C.circ.hall || [])];
      terreo(C).filter(a => !['hall', 'clausura', 'portaria'].includes(a.k)).forEach(a => { const livres = ladosFora(a, ux, vy).filter(p => circ.some(c => G.pip(p, c))).length;
        expect(livres, `${k}: ${a.nome}`).toBeLessThanOrEqual(2) }) }
  });
});

describe('gás, lixo e carro × pedestre', () => {
  it('abrigo de resíduos no recuo, junto ao alinhamento; central de gás fora do prédio', T, () => {
    for (const k of ['exemplo', 'grande']) { const { m } = calc(k), C = m.comuns;
      const lx = C.amb.find(a => a.k === 'lixo'), gs = C.amb.find(a => a.k === 'gas');
      expect(lx && lx.recuo, k).toBeTruthy(); expect(lx.dAl).toBeLessThanOrEqual(1.0);
      expect(gs && gs.recuo, k).toBeTruthy(); expect(G.pip(centro(gs.poly), m.emb)).toBe(false) }
  });
  it('a rota de pedestres não cruza a faixa de veículos', T, () => {
    for (const k of ['exemplo', 'grande', 'pequeno']) expect(calc(k).m.comuns.problemas.filter(p => p.k === 'veiculos' && p.nivel === 'bad'), k).toEqual([]);
  });
});

describe('laje do embasamento', () => {
  it('piscina com deck e solário, apoio encostado na torre, playground longe da água', T, () => {
    const { m } = calc('grande'), C = m.comuns, L = C.amb.filter(a => a.local === 'emb');
    const p = L.find(a => a.k === 'piscina'), ap = L.find(a => a.k === 'apoioPisc'), pg = L.find(a => a.k === 'playground');
    expect(p && ap && pg).toBeTruthy();
    expect(p.lamina.length).toBe(4); expect(p.deckA).toBeGreaterThan(30);
    expect(m.T.some(t => G.polysOverlap(G.scaleToArea(ap.poly, G.area(ap.poly) * 1.6), t.plate))).toBe(true);
    expect(A.cmnDistPolys(pg.poly, p.lamina)).toBeGreaterThanOrEqual(4);
    expect(L.every(a => a.rotaOk !== false)).toBe(true);
  });
});
