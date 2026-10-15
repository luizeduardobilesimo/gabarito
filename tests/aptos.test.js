// Plantas de apartamento (docs/APTOS.md): regras (aptoregras.js), catálogo de partidos (aptocatalogo.js) e o gerador (comodos.js)
import { describe, it, expect, beforeAll } from 'vitest';
import { carregar, estado } from './harness.js';

let A, st;
beforeAll(() => { A = carregar(); st = estado(A, {}); });

/* modelo de teste: retângulos [x, y, w, h] (y = 0 na fachada), W × D pelo envelope */
function mk(tipologia, ambs, portas, extra = {}) {
  const ambientes = ambs.map(([id, k, x, y, w, h, o]) => ({ id, k, ret: [x, y, w, h], estica: 'xy', ...(o || {}) }));
  const W = Math.max(...ambientes.map(a => a.ret[0] + a.ret[2])), D = Math.max(...ambientes.map(a => a.ret[1] + a.ret[3]));
  return { id: 'teste', nome: 'teste', origem: 'usuario', tipologia, W, D, entrada: { x: extra.ex ?? 1.5 }, ambientes, portas, ...extra };
}
const valida = (mod, o = {}) => A.aptoAvalia(mod, mod.W, mod.D, o, st);
const temProb = (val, k, nivel, re) => val.problemas.some(p => p.k === k && (!nivel || p.nivel === nivel) && (!re || re.test(p.msg)));
const casos = m => {
  const lat = m.lateral || {};
  return [[m.W, m.D], [m.faixaW.min, m.faixaD.min], [m.faixaW.min, m.faixaD.max], [m.faixaW.max, m.faixaD.min], [m.faixaW.max, m.faixaD.max]].map(([w, d]) => ({ w, d, lat }));
};

/* 1 dorm. correto (base dos casos ruins): sala | dorm na fachada, cozinha + serviço atrás da sala, hall + banho atrás do dorm */
const base = () => [
  ['a1', 'sala', 0, 0, 3.2, 4.4], ['a2', 'cozinha', 0, 4.4, 3.2, 2.0], ['a3', 'dorm', 3.2, 0, 2.8, 3.3, { cama: 'casal' }],
  ['a4', 'circ', 3.2, 3.3, 1.25, 1.1], ['a5', 'serv', 3.2, 4.4, 1.25, 2.0], ['a6', 'banho', 4.45, 3.3, 1.55, 3.1]];
const portasBase = () => [{ a: 'entrada', b: 'a2' }, { a: 'a1', b: 'a2', tipo: 'integ' }, { a: 'a2', b: 'a5', tipo: 'vao' }, { a: 'a1', b: 'a4', tipo: 'vao' }, { a: 'a4', b: 'a3' }, { a: 'a4', b: 'a6' }];

describe('regras (aptoValida) — §1', () => {
  it('círculo inscrito: exato no retângulo, certo no L, e desconta as paredes na validação', () => {
    expect(A.aptoCirculoInscrito([[0, 0], [3, 0], [3, 4], [0, 4]]).d).toBeCloseTo(3, 6);
    const L = [[0, 0], [4, 0], [4, 2], [2, 2], [2, 4], [0, 4]];       // L de braços com 2 m
    expect(A.aptoCirculoInscrito(L).d).toBeGreaterThan(1.95); expect(A.aptoCirculoInscrito(L).d).toBeLessThan(2.4);
    expect(A.aptoCirculoInscrito([]).d).toBe(0);
  });
  it('o 1 dorm. de referência passa sem problema grave', () => {
    const { val } = valida(mk('1d', base(), portasBase(), { ex: 2.2 }));
    expect(val.problemas.filter(p => p.nivel === 'bad'), val.problemas.map(p => p.msg).join('; ')).toEqual([]);
    expect(val.ok).toBe(true); expect(val.nota).toBeGreaterThanOrEqual(80);
  });
  it('dormitório com 1,80 m de largura: círculo inscrito abaixo do mínimo (grave)', () => {
    const b = base().map(r => r[0] === 'a3' ? ['a3', 'dorm', 3.2, 0, 1.8, 3.3] : r);
    const { val } = valida(mk('1d', b, portasBase(), { ex: 2.2 }));
    expect(temProb(val, 'circulo', 'bad', /Dormitório.*Ø 1,6/)).toBe(true);
    expect(val.ok).toBe(false);
  });
  it('quarto que só se alcança passando pelo banheiro (grave)', () => {
    const portas = [{ a: 'entrada', b: 'a2' }, { a: 'a1', b: 'a2', tipo: 'integ' }, { a: 'a2', b: 'a5', tipo: 'vao' }, { a: 'a1', b: 'a4', tipo: 'vao' }, { a: 'a4', b: 'a6' }, { a: 'a6', b: 'a3' }];
    const b = base().map(r => r[0] === 'a6' ? ['a6', 'banho', 4.45, 3.3, 1.55, 3.1] : r);
    // o banho encosta no dormitório pela borda y = 3,3 (x 4,45…6,0): a única porta do dormitório é pelo banho
    const { val } = valida(mk('1d', b, portas, { ex: 2.2 }));
    expect(temProb(val, 'passagem', 'bad', /Dormitório só é acessado passando por banheiro/)).toBe(true);
  });
  it('cozinha sem bancada: 1,40 × 1,60 m não cabe a bancada de 1,80 m (grave)', () => {
    const ambs = [['a1', 'sala', 0, 0, 3.6, 4.6], ['a2', 'cozinha', 0, 4.6, 1.4, 1.6], ['a7', 'serv', 1.4, 4.6, 2.2, 1.6], ['a3', 'dorm', 3.6, 0, 2.8, 3.3],
      ['a4', 'circ', 3.6, 3.3, 1.25, 1.3], ['a5', 'desp', 3.6, 4.6, 1.25, 1.6], ['a6', 'banho', 4.85, 3.3, 1.55, 2.9]];
    const portas = [{ a: 'entrada', b: 'a2' }, { a: 'a1', b: 'a2', tipo: 'vao' }, { a: 'a2', b: 'a7' }, { a: 'a1', b: 'a4', tipo: 'vao' }, { a: 'a4', b: 'a3' }, { a: 'a4', b: 'a6' }, { a: 'a4', b: 'a5' }];
    const { val } = valida(mk('1d', ambs, portas, { ex: 0.7 }));
    expect(temProb(val, 'movel', 'bad', /Cozinha: não cabe bancada/)).toBe(true);
    expect(temProb(val, 'circulo', null, /Cozinha/)).toBe(true);
  });
  it('banheiro da suíte acessado pela sala (grave) — e closet pela sala também', () => {
    // sala na profundidade toda; banho da suíte e closet atrás da suíte, encostados na sala
    const ambs = [['a1', 'sala', 0, 0, 3.6, 7.0], ['a4', 'suite', 3.6, 0, 3.6, 4.0, { cama: 'casal' }], ['a5', 'bsuite', 3.6, 4.0, 1.8, 3.0, { de: 'a4' }], ['a6', 'closet', 5.4, 4.0, 1.8, 3.0, { de: 'a4' }]];
    const ok = valida(mk('1s', ambs, [{ a: 'entrada', b: 'a1' }, { a: 'a1', b: 'a4' }, { a: 'a4', b: 'a5' }, { a: 'a4', b: 'a6', tipo: 'vao' }], { ex: 1.2 }));
    expect(ok.val.problemas.filter(p => p.k === 'passagem' || p.k === 'acesso')).toEqual([]);
    const ruim = valida(mk('1s', ambs, [{ a: 'entrada', b: 'a1' }, { a: 'a1', b: 'a4' }, { a: 'a1', b: 'a5' }, { a: 'a4', b: 'a6', tipo: 'vao' }], { ex: 1.2 }));
    expect(temProb(ruim.val, 'passagem', 'bad', /Banheiro da suíte acessado pela estar/)).toBe(true);
  });
  it('dormitório sem janela (no miolo) e "corredor-quarto" comprido demais', () => {
    // dormitório atrás da circulação, sem fachada
    const semJan = valida(mk('1d', [['a1', 'sala', 0, 0, 3.2, 7.0], ['a2', 'cozinha', 3.2, 0, 2.6, 2.4], ['a3', 'circ', 3.2, 2.4, 2.8, 1.1], ['a4', 'dorm', 3.2, 3.5, 2.8, 3.5], ['a5', 'banho', 6.0, 0, 1.6, 7.0]],
      [{ a: 'entrada', b: 'a1' }, { a: 'a1', b: 'a2', tipo: 'integ' }, { a: 'a1', b: 'a3', tipo: 'vao' }, { a: 'a3', b: 'a4' }, { a: 'a3', b: 'a5' }]));
    expect(temProb(semJan.val, 'janela', 'bad', /Dormitório: sem janela/)).toBe(true);
    // dormitório de 2,4 × 6,4 m
    const longo = valida(mk('1d', [['a1', 'sala', 0, 0, 3.2, 6.4], ['a2', 'dorm', 3.2, 0, 2.4, 6.4], ['a3', 'cozinha', 5.6, 0, 2.0, 3.2], ['a4', 'banho', 5.6, 3.2, 2.0, 3.2]], [{ a: 'entrada', b: 'a1' }, { a: 'a1', b: 'a2' }, { a: 'a1', b: 'a3' }, { a: 'a1', b: 'a4' }]));
    expect(temProb(longo.val, 'proporcao', 'bad', /Dormitório: comprido demais/)).toBe(true);
  });
  it('entrada pelo dormitório, dormitório aberto para a cozinha e porta estreita', () => {
    const v1 = valida(mk('1d', [['a1', 'sala', 0, 0, 3.4, 6.4], ['a2', 'dorm', 3.4, 0, 3.0, 6.4], ['a3', 'banho', 6.4, 0, 1.6, 6.4]], [{ a: 'entrada', b: 'a2' }, { a: 'a2', b: 'a1' }, { a: 'a1', b: 'a3' }], { ex: 4.8 }));
    expect(temProb(v1.val, 'entrada', 'bad', /a entrada cai em dormitório/)).toBe(true);
    const v2 = valida(mk('1d', [['a1', 'sala', 0, 0, 3.2, 4.4], ['a2', 'cozinha', 0, 4.4, 6.0, 2.0], ['a3', 'dorm', 3.2, 0, 2.8, 4.4]], [{ a: 'entrada', b: 'a2' }, { a: 'a1', b: 'a2', tipo: 'integ' }, { a: 'a2', b: 'a3' }], { ex: 1.0 }));
    expect(temProb(v2.val, 'passagem', 'bad', /Dormitório abre para a cozinha/)).toBe(true);
    const v3 = valida(mk('1d', base(), portasBase().map(p => p.b === 'a3' ? { ...p, w: 0.6 } : p), { ex: 2.2 }));
    expect(temProb(v3.val, 'porta', 'bad', /porta de 0,60 m para dormitório/)).toBe(true);
  });
  it('nota: 100 − 25 por grave − 6 por atenção − desvio de área; ok = nenhum grave', () => {
    const { val } = valida(mk('1d', base().map(r => r[0] === 'a3' ? ['a3', 'dorm', 3.2, 0, 1.8, 3.3] : r), portasBase(), { ex: 2.2 }));
    const bad = val.problemas.filter(p => p.nivel === 'bad').length, warn = val.problemas.filter(p => p.nivel === 'warn').length;
    expect(val.nota).toBeCloseTo(Math.max(0, 100 - 25 * bad - 6 * warn - val.desvio), 1);
    expect(val.ok).toBe(bad === 0);
  });
  it('aptoConfere aponta sobreposição, buraco e porta para ambiente que não existe', () => {
    expect(A.aptoConfere(A.aptoCatalogo()[0]).ok).toBe(true);
    const m = mk('1d', base(), portasBase()); m.ambientes[0].ret = [0, 0, 3.4, 4.4]; m.portas.push({ a: 'a1', b: 'zz' });
    const r = A.aptoConfere(m);
    expect(r.ok).toBe(false); expect(r.erros.join(' ')).toMatch(/se sobrepõem/); expect(r.erros.join(' ')).toMatch(/não existe: zz/);
  });
});

describe('catálogo de partidos — §3', () => {
  it('15+ partidos de mercado, ids únicos, modelo coerente (retângulos cobrem W × D) e todas as tipologias', () => {
    const cat = A.aptoCatalogo();
    expect(cat.length).toBeGreaterThanOrEqual(15);
    expect(new Set(cat.map(m => m.id)).size).toBe(cat.length);
    for (const m of cat) { const c = A.aptoConfere(m); expect(c.erros, m.id).toEqual([]); expect(m.faixaW.min).toBeLessThanOrEqual(m.W); expect(m.faixaW.max).toBeGreaterThanOrEqual(m.W); expect(m.faixaD.min).toBeLessThanOrEqual(m.D); expect(m.faixaD.max).toBeGreaterThanOrEqual(m.D) }
    for (const k of ['studio', '1d', '1s', '2d', '2d1s', '2s', '3d1s', '3s', '4d1s']) expect(cat.some(m => m.tipologia === k), k).toBe(true);
    expect(A.aptoCatalogo('2d1s').every(m => m.tipologia === '2d1s')).toBe(true);
  });
  for (const id of (carregar().aptoCatalogo().map(m => m.id))) it(`${id}: nota ≥ 80 e sem problema grave no desenho e nos 4 cantos da faixa`, () => {
    const m = A.aptoModelo(id, st);
    for (const { w, d, lat } of casos(m)) {
      const { planta, val } = A.aptoAvalia(m, w, d, { lateral: lat }, st);
      const msg = `${id} ${w}×${d}: nota ${val.nota} — ${val.problemas.map(p => `[${p.nivel}] ${p.msg}`).join('; ')}`;
      expect(val.ok, msg).toBe(true);
      expect(val.nota, msg).toBeGreaterThanOrEqual(80);
      expect(Math.abs(planta.ambientes.reduce((s, r) => s + r.area, 0) - w * d), msg).toBeLessThan(0.02);
      expect(planta.entrada, msg).toBeTruthy();
      // o programa da tipologia (dormitórios, suítes, banhos) está lá
      const prog = A.APTO_PROG[m.tipologia]; for (const [k, n] of Object.entries(prog)) expect(planta.ambientes.filter(r => r.k === k).length, `${msg} · ${k}`).toBeGreaterThanOrEqual(n);
    }
  });
  it('com sacada embutida (5 m²) os partidos continuam sem problema grave no desenho', () => {
    for (const m of A.aptoCatalogo()) {
      const { planta, val } = A.aptoAvalia(m, m.W, m.D, { sacada: { area: 5, prof: 1.6 }, lateral: m.lateral }, st);
      const sac = planta.ambientes.find(r => r.k === 'sacada');
      expect(sac, m.id).toBeTruthy(); expect(sac.area, m.id).toBeGreaterThan(4.5); expect(sac.area, m.id).toBeLessThanOrEqual(5.01);   // sala pequena demais: um pouco menor, sem esmagar
      expect(val.problemas.filter(p => p.nivel === 'bad'), `${m.id}: ${val.problemas.map(p => p.msg).join('; ')}`).toEqual([]);
    }
  });
});

describe('aplicação do partido (aptoAplica) — §2', () => {
  it('estica por faixas: ambientes fixos mantêm a medida; os que esticam absorvem a diferença', () => {
    const m = A.aptoModelo('cat-2d-linear');
    const p0 = A.aptoAplica(m, m.W, m.D), p1 = A.aptoAplica(m, m.W + 1, m.D + 0.5);
    const banho = pl => pl.ambientes.find(r => r.k === 'banho'), circ = pl => pl.ambientes.find(r => r.k === 'circ');
    const bb = r => A.aptoBBox(r.poly);
    expect(bb(banho(p1))[2] - bb(banho(p1))[0]).toBeCloseTo(bb(banho(p0))[2] - bb(banho(p0))[0], 6);   // banho: largura fixa
    expect(bb(circ(p1))[3] - bb(circ(p1))[1]).toBeCloseTo(1.1, 6);                                      // circulação: 1,10 m
    expect(p1.ambientes.reduce((s, r) => s + r.area, 0)).toBeCloseTo((m.W + 1) * (m.D + 0.5), 4);
  });
  it('espelhar troca os lados (a entrada vai junto)', () => {
    const m = A.aptoModelo('cat-2d1s-ponta'), a = A.aptoAplica(m, m.W, m.D), b = A.aptoAplica(m, m.W, m.D, { espelhar: true });
    const sala = pl => A.aptoBBox(pl.ambientes.find(r => r.k === 'sala').poly);
    expect(sala(a)[0]).toBeCloseTo(0, 6); expect(sala(b)[2]).toBeCloseTo(m.W, 6);
    expect((a.entrada.p0[0] + b.entrada.p0[0] + a.entrada.p1[0] + b.entrada.p1[0]) / 2).toBeCloseTo(m.W, 1);
  });
  it('unidade em L ("inscrito"): o partido vai no maior retângulo e as sobras viram extensão do vizinho', () => {
    const m = A.aptoModelo('cat-2d-compacto');
    const L = [[0, 0], [13.8, 0], [13.8, 2.6], [8.0, 2.6], [8.0, 7.6], [0, 7.6]];
    const pl = A.aptoAplica(m, 13.8, 7.6, { contorno: L, encaixe: 'inscrito' });
    expect(pl.ambientes.reduce((s, r) => s + r.area, 0)).toBeCloseTo(A.G.area(L), 2);
    expect(pl.ambientes.every(r => r.poly.length >= 4)).toBe(true);
    expect(pl.grade.R[2] - pl.grade.R[0]).toBeCloseTo(8.0, 6);
  });
  it('sacada embutida: na frente da sala; varanda corrida só quando o quarto fica com o fundo mínimo; nada esmagado', () => {
    const fundo = { sala: 2.9, suite: 2.9, dorm: 2.7 };
    const confere = (id, area) => {
      const m = A.aptoModelo(id), p = A.aptoAplica(m, m.W, m.D, { sacada: { area, prof: 1.6 } }), sac = p.ambientes.find(r => r.k === 'sacada'), bb = A.aptoBBox(sac.poly);
      expect(bb[1]).toBeCloseTo(0, 6); expect(sac.area).toBeLessThanOrEqual(area + 0.01);
      // quem fica atrás da sacada mantém o fundo mínimo (antes a varanda corrida deixava um quarto de 5 m²)
      p.ambientes.filter(r => fundo[r.k]).forEach(r => { const b = A.aptoBBox(r.poly); if (Math.min(b[2], bb[2]) - Math.max(b[0], bb[0]) < 0.3 || Math.abs(b[1] - bb[3]) > 0.01) return; expect(b[3] - bb[3], `${id} ${r.k}`).toBeGreaterThanOrEqual(fundo[r.k] - 0.01) });
      return { p, sac, bb };
    };
    const lin = confere('cat-2d-linear', 9);          // sala de 3,6 m: a sacada inteira na frente dela (varanda gourmet até 2,6 m)
    expect(lin.sac.area).toBeCloseTo(9, 1); expect(lin.bb[3] - lin.bb[1]).toBeLessThanOrEqual(2.61);
    const var1 = confere('cat-1s-varanda', 9);        // partido de varanda corrida (sala + suíte)
    expect(var1.sac.area).toBeCloseTo(9, 1); expect(var1.p.portas.filter(x => x.k === 'pj').length).toBeGreaterThanOrEqual(2);
    const canto = confere('cat-2d-canto', 9);         // sala estreita e quarto raso: não leva 9 m² sem esmagar — fica menor
    expect(canto.sac.area).toBeLessThan(9); expect(canto.sac.area).toBeGreaterThan(5);
  });
  it('lavabo opcional: ligado é um ambiente; desligado funde no vizinho', () => {
    const m = A.aptoModelo('cat-3d1s-larga');
    expect(A.aptoAplica(m, m.W, m.D, { lavabo: true }).ambientes.some(r => r.k === 'lavabo')).toBe(true);
    const sem = A.aptoAplica(m, m.W, m.D, {}); expect(sem.ambientes.some(r => r.k === 'lavabo')).toBe(false);
    expect(sem.ambientes.reduce((s, r) => s + r.area, 0)).toBeCloseTo(m.W * m.D, 4);
  });
  it('miniatura SVG: classes por zona, sem NaN, e destaque dos ambientes com problema', () => {
    const svg = A.aptoMiniSVG(A.aptoModelo('cat-3d1s-central'), { w: 120 });
    expect(svg).toMatch(/^<svg class="apto-mini"/); expect(svg).toMatch(/am-social/); expect(svg).toMatch(/am-molhada/); expect(svg).not.toMatch(/NaN|undefined/);
    const { planta, val } = valida(mk('1d', base().map(r => r[0] === 'a3' ? ['a3', 'dorm', 3.2, 0, 1.8, 3.3] : r), portasBase(), { ex: 2.2 }));
    expect(A.aptoMiniSVG(planta, { val })).toMatch(/am-bad/);
    expect(A.aptoMiniCss()).toMatch(/var\(--/);
  });
});

/* gerador: unidade retangular de teste (fachada em y = 0, corredor atrás), com fachada lateral opcional */
function unidade(B, s, nome, W, D, { lateral = false, area } = {}) {
  const P = [[0, 0], [W, 0], [W, D], [0, D]];
  const plate = lateral ? [[-3, 0], [W, 0], [W, D + 1.6], [-3, D + 1.6]] : [[-3, 0], [W + 3, 0], [W + 3, D + 1.6], [-3, D + 1.6]];
  const ctx = { plate, corridor: [[-3, D], [W + 3, D], [W + 3, D + 1.6], [-3, D + 1.6]], core: [], sig: `${nome}|${W}|${D}|${lateral}` };
  const u = { poly: P, fac: 'min', alvo: area || W * D, nome, area: W * D, sac: null };
  const L = B.comUnidade(u, { ux: [1, 0], vy: [0, 1] }, s, ctx); u.com = B.comExporta(L);
  return { L, u };
}
describe('gerador por partidos (comodos.js)', () => {
  it('2 dorm. de 9,4 × 7,0 m: escolhe um partido de 2 dormitórios com nota ≥ 90 e planta válida', () => {
    const B = carregar(), s = estado(B, {});
    const { u } = unidade(B, s, '2 dorm.', 9.4, 7.0, { area: 66 });
    expect(u.com.ok).toBe(true); expect(u.com.nota).toBeGreaterThanOrEqual(90);
    expect(u.com.partido).toMatch(/^cat-2d/);
    expect(u.com.rooms.filter(r => r.k === 'dorm' || r.k === 'suite').length).toBe(2);
    expect(u.com.doors.some(d => d.k === 'entrada')).toBe(true);
  });
  it('unidade de ponta estreita (7,1 m) com fachada lateral: o partido "de canto" usa a janela lateral', () => {
    const B = carregar(), s = estado(B, {});
    const { u } = unidade(B, s, '2 dorm.', 7.1, 7.6, { lateral: true, area: 54 });
    expect(u.com.ok, u.com.alertas.map(a => a.msg).join('; ')).toBe(true);
    expect(u.com.partido).toBe('cat-2d-canto');
    // o dormitório dos fundos tem janela (pela lateral)
    const fundos = u.com.rooms.filter(r => r.k === 'dorm').sort((a, b) => b.c[1] - a.c[1])[0];
    expect(fundos.jan).toBeGreaterThan(0);
    // sem a fachada lateral, a mesma unidade não tem partido que caiba (e diz por quê)
    const { u: v } = unidade(B, estado(B, {}), '2 dorm.', 7.1, 7.6, { lateral: false, area: 54 });
    expect(v.com.ok).toBe(false); expect(v.com.aviso).toMatch(/nenhum partido cabe/);
  });
  it('frente estreita demais: mostra a menos ruim, marcada, com a frente mínima', () => {
    const B = carregar(), s = estado(B, {});
    const { u } = unidade(B, s, '3 dorm.', 7.0, 8.0, { area: 92 });
    expect(u.com.semPartido).toBe(true);
    expect(u.com.aviso).toMatch(/frente de 7,0 m; os partidos de 3 dorm\. \(1 suíte\) pedem 10,6 m ou mais/);
    expect(u.com.alertas[0].nivel).toBe('erro');
  });
  it('partidos marcados na tipologia (S.comodos.tipos[i].partidos) e modelo do usuário copiado em S.comodos.modelos', () => {
    const B = carregar(), s = estado(B, {});
    s.comodos.tipos = [{ nome: '2 dorm.', modelo: 'auto', partidos: ['cat-2d-central'], cortes: {}, sel: -1 }];
    expect(unidade(B, s, '2 dorm.', 9.4, 7.0).u.com.partido).toBe('cat-2d-central');
    const meu = { ...B.aptoModelo('cat-2d-linear'), id: 'usr-teste', nome: 'Meu 2 dorm.', origem: 'usuario' };
    const s2 = estado(B, {}); s2.comodos.modelos = [meu]; s2.comodos.tipos = [{ nome: '2 dorm.', modelo: 'auto', partidos: ['usr-teste'], cortes: {}, sel: -1 }];
    const { u } = unidade(B, s2, '2 dorm.', 9.4, 7.0);
    expect(u.com.partido).toBe('usr-teste'); expect(u.com.partidoNome).toBe('Meu 2 dorm.'); expect(u.com.ok).toBe(true);
  });
  it('mobiliário desenhado sai das posições validadas (cama, sofá, bancada, louças)', () => {
    const B = carregar(), s = estado(B, {});
    const { u } = unidade(B, s, '2 dorm.', 9.4, 7.0, { area: 66 });
    const ks = new Set(u.com.movel.map(f => f.k));
    for (const k of ['cama', 'sofa', 'mesa', 'bancada', 'vaso']) expect(ks.has(k), k).toBe(true);
    expect(u.com.movel.every(f => (f.pts || [f.c]).every(p => p.every(Number.isFinite)))).toBe(true);
  });
  it('o resumo por tipologia traz a nota de cada partido na unidade real', () => {
    const B = carregar(), s = estado(B, {}), m = B.compute(s);
    const T = m.comodos.porTipo['2 dorm.'];
    expect(T.nota).toBeGreaterThan(0); expect(Object.keys(T.notas).length).toBeGreaterThan(0);
    expect(Object.keys(T.usados).every(id => T.notas[id] != null)).toBe(true);
    expect(m.comodos.nota).toBeGreaterThan(70);
  }, 60000);
});
