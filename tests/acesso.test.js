// Acesso de veículos por qualquer frente do lote (S.lote.ladoVei, src/calc/acesso.js): esquina e lote passante.
import { describe, it, expect } from 'vitest';
import { carregar, estado } from './harness.js';

const T = { timeout: 180000 };
const A = carregar();
const G = A.G;
const lote = (w, d, front, extra = {}) => ({ pts: [[0, 0], [w, 0], [w, d], [0, d]], front, principal: 0, rec: [{}, {}, {}, {}], ...extra });
const calc = parcial => { const st = estado(A, parcial); return { st, m: A.compute(st) } };
// área da interseção (os pedaços do térreo e as faixas são convexos nos lotes retangulares dos testes)
const inter = (a, b) => (a && b && a.length > 2 && b.length > 2) ? G.area(G.clipToPoly(a, b)) : 0;
// na malha de 0,5 m, o carro sai do portal e chega à frente de todas as vagas de carro do pavimento
const malhaOk = (m, k, piso, extra = []) => {
  const l = m.gar[k], vs = l.vagas.filter(v => v.tipo !== 'off' && v.tipo !== 'faixa');
  const R = A.rasterCheck(piso, [...m.obst, ...extra, ...l.blocks], vs, l.pillars, l.portals, l.aisle);
  return { conn: R.allConn, todas: R.okV.length === vs.length, n: vs.length };
};
// pedaços de pedestre do térreo: hall, lojas, passagem e caminhos até os núcleos
const pedestre = m => [...m.ter.hall, ...m.ter.lojas, ...m.ter.pass, ...m.ter.walk];
const veiculo = m => [...m.ter.drive, ...m.vert.strips.map(s => s.poly)];
const semCruzar = m => { let pior = 0; for (const p of pedestre(m)) for (const d of veiculo(m)) pior = Math.max(pior, inter(p, d), inter(d, p)); return pior };

describe('padrão: frente principal (nada muda)', () => {
  it('DEF.lote.ladoVei é null e o acesso fica na frente principal', T, () => {
    expect(A.DEF.lote.ladoVei).toBeNull();
    const { st, m } = calc({});
    expect(A.ladoVeiIdx(st)).toBe(0); expect(A.acLateral(st)).toBe(false);
    expect(m.acesso.edgeV).toBe(m.acesso.edge);
    expect(m.ter.vfd).toEqual(m.ter.fd); expect(m.vert.fd).toEqual(m.ter.fd);
  });
  it('ladoVei igual à principal ou fora das frentes dá o mesmo resultado do padrão', T, () => {
    const base = calc({ lote: lote(45, 45, [0, 1]), produto: { torres: [{ pav: 12 }], subsolos: 2 } }).m;
    for (const lv of [0, 2]) {   // 0 = a própria principal · 2 = fundos, que não é rua → cai na principal
      const { st, m } = calc({ lote: lote(45, 45, [0, 1], { ladoVei: lv }), produto: { torres: [{ pav: 12 }], subsolos: 2 } });
      expect(A.ladoVeiIdx(st)).toBe(0);
      expect(m.vagasLay).toBe(base.vagasLay);
      expect(m.ter.drive.map(p => p.map(q => q.map(v => +v.toFixed(6))))).toEqual(base.ter.drive.map(p => p.map(q => q.map(v => +v.toFixed(6)))));
    }
  });
});

describe('migração de estudos', () => {
  it('estudo antigo (sem ladoVei) abre com a frente principal; valores inválidos viram null', () => {
    const velho = JSON.parse(JSON.stringify(A.DEF)); delete velho.lote.ladoVei;
    expect(A.merge(A.clone(A.DEF), velho).lote.ladoVei).toBeNull();
    expect(A.merge(A.clone(A.DEF), { lote: { ladoVei: 1 } }).lote.ladoVei).toBe(1);
    expect(A.merge(A.clone(A.DEF), { lote: { ladoVei: '1' } }).lote.ladoVei).toBeNull();
    expect(A.merge(A.clone(A.DEF), { lote: { ladoVei: -1 } }).lote.ladoVei).toBeNull();
    expect(A.merge(A.clone(A.DEF), { lote: { ladoVei: null } }).lote.ladoVei).toBeNull();
  });
});

describe('lote de esquina 30 × 30, carro pela rua lateral (L2)', () => {
  const P = { lote: lote(30, 30, [0, 1], { ladoVei: 1, acessoVei: 0.85 }), produto: { torres: [{ pav: 10 }], subsolos: 1 } };
  it('rampa e faixa encostadas na lateral, rampa 5 m depois do alinhamento, malha ok, nada sobre o hall', T, () => {
    const { st, m } = calc(P);
    expect(m.acesso.edge).toBe(0); expect(m.acesso.edgeV).toBe(1);
    expect(m.acesso.vei[0]).toBeCloseTo(30, 6);                     // o ponto do acesso está no lado L2 (x = 30)
    expect(m.ter.vfd[0]).toBeCloseTo(-1, 6);                       // entra para dentro pela lateral
    expect(m.ter.drive0.naoCabe).toBeFalsy();
    // faixa encostada no lado L2: o acesso começa no alinhamento do embasamento desse lado e o trecho no recuo chega à divisa
    const embX = Math.max(...m.emb.map(q => q[0]));
    expect(Math.max(...m.ter.drive[0].map(q => q[0]))).toBeCloseTo(embX, 4);
    expect(Math.max(...m.ter.driveRua[0].map(q => q[0]))).toBeCloseTo(30, 4);
    // rampa: começa ≥ 5 m depois do alinhamento da lateral (x ≤ 25) e fica dentro do subsolo
    const s = m.vert.strips.find(x => x.id === 'DA');
    expect(Math.max(...s.poly.map(q => q[0]))).toBeLessThanOrEqual(25 + 1e-6);
    expect(G.polyInPoly(s.poly, m.sub)).toBe(true);
    // lojas, hall e pedestres na frente principal; vagas na frente também
    expect(m.ter.lojas.length).toBeGreaterThan(0);
    expect(m.vf.count).toBeGreaterThan(0);
    m.vf.vagas.forEach(v => expect(Math.max(...v.poly.map(q => q[1]))).toBeLessThan(6));
    // nada de veículo sobre o que é de pedestre, nem rampa sobre núcleo
    expect(semCruzar(m)).toBeLessThan(0.05);
    m.cores.forEach(c => veiculo(m).forEach(d => expect(inter(c, d)).toBeLessThan(0.05)));
    // malha do subsolo: o carro chega a todas as vagas
    const r = malhaOk(m, 's1', m.sub); expect(r.conn).toBe(true); expect(r.todas).toBe(true); expect(r.n).toBeGreaterThan(5);
    expect(m.vert.ok).toBe(true);
    expect(m.avisos.some(a => /não cabem/.test(a))).toBe(false);
    expect(A.acLateral(st)).toBe(true);
  });
});

describe('lote de esquina 45 × 45 com garagem no térreo, carro pela lateral', () => {
  const P = { lote: lote(45, 45, [0, 1], { ladoVei: 1 }), produto: { torres: [{ pav: 12 }], subsolos: 2 } };
  it('pátio de entrada → garagem do térreo e rampas, tudo pela malha e sem cruzar o hall', T, () => {
    const { m } = calc(P);
    expect(m.ter.drive0.naoCabe).toBeFalsy(); expect(m.ter.semFaixa).toBeFalsy();
    expect(m.ter.lanes).toBeTruthy(); expect(m.ter.driveEnd).toBeTruthy();
    expect(G.pip(m.ter.driveEnd, m.ter.gar)).toBe(true);               // o portal de entrada fica dentro da garagem do térreo
    expect(m.ter.driveHead).toEqual(m.ter.vfd);
    for (const k of ['ter', 's1', 's2']) { expect(m.gar[k].ok).not.toBe(false); expect(m.gar[k].count).toBeGreaterThan(0) }
    expect(malhaOk(m, 'ter', m.ter.gar, m.ter.colsGar)).toMatchObject({ conn: true, todas: true });
    for (const k of ['s1', 's2']) expect(malhaOk(m, k, m.sub)).toMatchObject({ conn: true, todas: true });
    // nenhuma vaga do térreo sobre o hall nem sobre o acesso
    const pd = pedestre(m);
    m.gar.ter.vagas.forEach(v => { pd.forEach(p => expect(inter(v.poly, p)).toBeLessThan(0.05)); m.ter.drive.forEach(d => expect(inter(v.poly, d)).toBeLessThan(0.05)) });
    expect(semCruzar(m)).toBeLessThan(0.05);
    // a rampa começa 5 m depois do alinhamento da lateral
    m.vert.strips.forEach(s => expect(Math.max(...s.poly.map(q => q[0]))).toBeLessThanOrEqual(40 + 1e-6));
  });
});

describe('lote passante 25 × 50, carro pelos fundos (L3)', () => {
  const P = { lote: lote(25, 50, [0, 2], { ladoVei: 2 }), produto: { torres: [{ pav: 10 }], subsolos: 1 } };
  it('acesso e rampa a partir dos fundos, pedestres e lojas na frente', T, () => {
    const { m } = calc(P);
    expect(m.acesso.edgeV).toBe(2); expect(m.acesso.vei[1]).toBeCloseTo(50, 6);
    expect(m.ter.vfd[1]).toBeCloseTo(-1, 6);
    expect(m.ter.drive0.naoCabe).toBeFalsy();
    const embY = Math.max(...m.emb.map(q => q[1]));
    expect(Math.max(...m.ter.drive[0].map(q => q[1]))).toBeCloseTo(embY, 4);
    const s = m.vert.strips.find(x => x.id === 'DA');
    expect(Math.max(...s.poly.map(q => q[1]))).toBeLessThanOrEqual(45 + 1e-6);   // 5 m depois do alinhamento dos fundos
    expect(Math.min(...m.ter.lojas.flat().map(q => q[1]))).toBeLessThan(10);    // lojas continuam na frente principal
    expect(semCruzar(m)).toBeLessThan(0.05);
    expect(malhaOk(m, 's1', m.sub)).toMatchObject({ conn: true, todas: true });
  });
});

describe('Encontrar o melhor acesso', () => {
  it('testa também os outros lados na rua e diz de qual lado é cada candidato', T, () => {
    const st1 = estado(A, { lote: lote(45, 45, [0]), produto: { torres: [{ pav: 12 }], subsolos: 2 } });
    const c1 = A.acessoCandidatos(st1);
    expect(c1.every(c => c.lado === 0 && c.ladoVei === null)).toBe(true);
    expect(c1.filter(c => !c.atual).length).toBe(6 * 4 + 3);            // um lado só: posições × 4 tipos de rampa (reta, alternada, helicoidal, L) + elevador
    const st2 = estado(A, { lote: lote(45, 45, [0, 1]), produto: { torres: [{ pav: 12 }], subsolos: 2 } });
    const c2 = A.acessoCandidatos(st2);
    expect(c2.filter(c => c.lado === 1).length).toBe(6 * 4 + 3);
    expect(c2.filter(c => c.lado === 1).every(c => c.ladoVei === 1)).toBe(true);
    const lat = c2.find(c => c.lado === 1 && c.rampaTipo === 'reta' && c.acessoVei === 0.9);
    const r = A.acessoAvalia(st2, lat);
    expect(r.vagas).toBeGreaterThan(0); expect(r.ok).toBe(true);
    expect(st2.lote.ladoVei).toBeNull();                               // avaliar não muda o estudo
  });
  it('o candidato "Atual" guarda o lado em uso', () => {
    const st = estado(A, { lote: lote(45, 45, [0, 1], { ladoVei: 1, acessoVei: 0.33 }), produto: { torres: [{ pav: 12 }], subsolos: 2 } });
    const at = A.acessoCandidatos(st).find(c => c.atual);
    expect(at).toMatchObject({ lado: 1, ladoVei: 1, acessoVei: 0.33 });
  });
});

describe('o melhor acesso de cada tipo de rampa', () => {
  const C = (rampaTipo, vagas, ok = true, extra = {}) => ({ rampaTipo, vagas, ok, acessoVei: 0.5, lado: 0, ...extra });
  it('todos os tipos de rampa entram como candidatos (elevador, retas, alternadas, helicoidal e em L)', T, () => {
    const st = estado(A, { lote: lote(45, 45, [0]), produto: { torres: [{ pav: 12 }], subsolos: 2 } });
    expect([...new Set(A.acessoCandidatos(st).map(c => c.rampaTipo))].sort()).toEqual(['L', 'alternada', 'elevador', 'helicoidal', 'reta']);
    const st1 = estado(A, { lote: lote(45, 45, [0]), produto: { torres: [{ pav: 12 }], subsolos: 1 } });
    expect(A.acessoCandidatos(st1).some(c => c.rampaTipo === 'alternada')).toBe(false); // com um só pavimento a tesoura não muda nada
  });
  it('a lista final traz o melhor de cada tipo, e o elevador não leva tudo só por existir', () => {
    const l = [C('elevador', 90), C('elevador', 80), C('reta', 70), C('reta', 60), C('alternada', 65), C('helicoidal', 50, false), C('L', 40, false)];
    const r = A.acessoMelhorPorTipo(l);
    expect(r.map(c => [c.rampaTipo, c.vagas])).toEqual([['elevador', 90], ['reta', 70], ['alternada', 65], ['helicoidal', 50], ['L', 40]].map(([t, v]) => [t, v]));
    expect(r).toHaveLength(5);                                               // uma por tipo
    // sem pendências vence quem tem mais vagas com pendências
    expect(A.acessoMelhorPorTipo([C('reta', 99, false), C('reta', 50, true)])[0].vagas).toBe(50);
  });
  it('onde há opções confirmadas (cálculo completo) só elas competem naquele tipo; as melhores de cada tipo vão para a confirmação', () => {
    const l = [C('reta', 80), C('reta', 70, true, { fino: true }), C('elevador', 90)];
    expect(A.acessoMelhorPorTipo(l).find(c => c.rampaTipo === 'reta').vagas).toBe(70);
    const top = A.acessoTopoPorTipo([C('reta', 80), C('reta', 70), C('reta', 60), C('elevador', 90), C('elevador', 85), C('L', 10)], 2);
    expect(top.map(c => [c.rampaTipo, c.vagas])).toEqual([['elevador', 90], ['elevador', 85], ['reta', 80], ['reta', 70], ['L', 10]]);
  });
});

describe('funções puras', () => {
  it('acSubRect tira o retângulo e devolve só o que sobra', () => {
    const q = [[0, 0], [10, 0], [10, 10], [0, 10]];
    const r = A.acSubRect(q, [1, 0], [0, 1], 4, 6, -1, 5);
    expect(r.reduce((s, p) => s + G.area(p), 0)).toBeCloseTo(100 - 2 * 5, 6);   // a parte do retângulo dentro do quadrado: 2 × 5
    r.forEach(p => expect(inter(p, [[4, -1], [6, -1], [6, 5], [4, 5]])).toBeLessThan(1e-9));
  });
  it('acLadosRua põe a principal primeiro', () => {
    const st = estado(A, { lote: { ...lote(30, 30, [1, 3]), principal: 3 } });
    expect(A.acLadosRua(st)).toEqual([3, 1]);
  });
});
