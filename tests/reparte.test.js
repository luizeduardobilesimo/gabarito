// Repartição do pavimento tipo pelos partidos (src/calc/reparte.js + layout.js/blocos.js/alas.js) e as regras de sala que
// pegam a unidade "2 dorm. com sala de 8,5 m²" da revisão do Luiz (src/calc/aptoregras.js)
import { describe, it, expect, beforeAll } from 'vitest';
import { carregar, estado } from './harness.js';

let A, st, m;
beforeAll(() => { A = carregar(); st = estado(A, {}); m = A.compute(st); });

const mk = (tipologia, ambs, portas, extra = {}) => {
  const ambientes = ambs.map(([id, k, x, y, w, h, o]) => ({ id, k, ret: [x, y, w, h], estica: 'xy', ...(o || {}) }));
  const W = Math.max(...ambientes.map(a => a.ret[0] + a.ret[2])), D = Math.max(...ambientes.map(a => a.ret[1] + a.ret[3]));
  return { id: 't', nome: 't', origem: 'usuario', tipologia, W, D, entrada: { x: extra.ex ?? 1.5 }, ambientes, portas, ...extra };
};

describe('sala proporcional (regras)', () => {
  // 2 dormitórios: sala de 8,5 m² com cozinha integrada e um quarto de 13,8 m² (o caso da revisão)
  const ambs = [['a1', 'sala', 0, 0, 2.7, 3.15], ['a2', 'cozinha', 0, 3.15, 2.7, 2.35], ['a3', 'dorm', 2.7, 0, 4.2, 3.3, { cama: 'casal' }], ['a4', 'circ', 2.7, 3.3, 4.2, 1.1],
    ['a5', 'banho', 2.7, 4.4, 1.6, 2.6], ['a6', 'dorm', 4.3, 4.4, 2.6, 3.2], ['a7', 'serv', 0, 5.5, 2.7, 2.1]];
  const portas = [{ a: 'entrada', b: 'a2' }, { a: 'a1', b: 'a2', tipo: 'integ' }, { a: 'a2', b: 'a7' }, { a: 'a1', b: 'a4', tipo: 'vao' }, { a: 'a4', b: 'a3' }, { a: 'a4', b: 'a5' }, { a: 'a4', b: 'a6' }];
  it('a cozinha integrada não conta como sala e o mínimo depende do número de dormitórios', () => {
    const mod = mk('2d', ambs, portas, { ex: 1.2 }), { val } = A.aptoAvalia(mod, mod.W, mod.D, {}, st);
    const p = val.problemas.find(x => x.k === 'area' && /Estar/.test(x.msg));
    expect(p, val.problemas.map(x => x.msg).join('; ')).toBeTruthy();
    expect(p.nivel).toBe('bad'); expect(p.msg).toMatch(/mín\. 12,0 m² para 2 dormitórios/); expect(p.msg).not.toMatch(/com a cozinha/);
    expect(val.ok).toBe(false);
  });
  it('sala bem menor que o maior quarto é grave', () => {
    const mod = mk('2d', ambs, portas, { ex: 1.2 }), { val } = A.aptoAvalia(mod, mod.W, mod.D, {}, st);
    expect(val.problemas.some(x => x.k === 'sala' && x.nivel === 'bad' && /menor que dormitório/.test(x.msg))).toBe(true);
  });
  it('os mínimos de sala ficam em S.comodos.regras (editáveis) e o studio não pede mais que o mínimo geral', () => {
    expect(A.APTO_REGRAS.sala['3d1s']).toBeGreaterThan(A.APTO_REGRAS.sala['2d']);
    expect(A.APTO_REGRAS.sala.studio).toBe(0);
  });
});

describe('repartição do pavimento tipo pelos partidos', () => {
  it('estudo exemplo: todas as unidades com planta válida e nota ≥ 75', () => {
    const us = m.tipo.flatMap(l => l.units.filter(u => !u.livre));
    expect(us.length).toBe(8);
    us.forEach(u => { expect(u.com.semPartido, `${u.nome}: ${u.com.aviso}`).toBe(false); expect(u.com.ok).toBe(true); expect(u.com.nota).toBeGreaterThanOrEqual(75) });
    expect(m.comodos.nota).toBeGreaterThanOrEqual(85);
  }, 60000);
  it('nenhuma unidade de 3 dormitórios em L junto do núcleo; a frente de cada unidade cabe num partido', () => {
    m.tipo.forEach(l => l.units.filter(u => !u.livre).forEach(u => {
      if (/3 dorm/.test(u.nome)) expect(u.poly.length, u.nome).toBeLessThanOrEqual(5);     // retângulo ou trapézio (lote inclinado), nunca em L
      const T = A.repTipo(st, u.nome, u.alvo);
      expect(T.mods.length).toBeGreaterThan(0);
    }));
  });
  it('o núcleo não muda de lugar (garagens e térreo iguais) e a área das unidades é a mesma do andar', () => {
    const s2 = estado(A, { estudo: { escadaLado: 'E' } }), m2 = A.compute(s2);
    m.tipo.forEach((l, i) => {
      expect(l.core).toEqual(m2.tipo[i].core); expect(l.lobby).toEqual(m2.tipo[i].lobby);
      const s = x => x.units.filter(u => !u.livre).reduce((a, u) => a + u.area, 0);
      expect(Math.abs(s(l) - s(m2.tipo[i]))).toBeLessThan(0.05);
    });
    expect(m.vagas).toBe(m2.vagas);
  }, 60000);
  it('ordem automática da escada: "auto" no padrão; "E"/"D" do usuário são respeitados', () => {
    expect(A.DEF.estudo.escadaLado).toBe('auto');
    expect(['E', 'D']).toContain(m.tipo[0].escAuto);
    const s2 = estado(A, { estudo: { escadaLado: 'E' } }), m2 = A.compute(s2, { layouts: false });
    expect(m2.tipo[0].escAuto).toBeUndefined();
  });
  it('custo: unidade dentro da faixa de um partido custa pouco; frente curta, em L ou fresta custa muito', () => {
    const T = A.repTipo(st, '2 dorm.', 66);
    const ok = A.repNotaGeo(T, 66, { A: 66, W: 8.8, D: 7.5, Ai: 66 }, false, false);
    const curta = A.repNotaGeo(T, 66, { A: 66, W: 6.2, D: 7.5, Ai: 46.5 }, false, false);
    const fresta = A.repNotaGeo(T, 66, { A: 30, W: 3.0, D: 7.5, Ai: 22.5 }, false, false);
    expect(ok).toBeLessThan(5); expect(curta).toBeGreaterThan(50); expect(fresta).toBeGreaterThan(curta);
    // unidade de ponta: o partido virado para a fachada lateral também conta
    expect(A.repFora(T, 5.9, 9.4, true)).toBeLessThan(A.repFora(T, 5.9, 9.4, false));
  });
  it('sem estado (chamada solta do tipoLayout) e no otimizador (quick) fica a repartição antiga, pela área', () => {
    const t = m.T[0], E = st.estudo, list = [];
    st.produto.mix.forEach(u => { for (let q = 0; q < u.qtd; q++) list.push({ nome: u.nome, alvo: u.area * t.r, sac: +u.sac || 0 }) });
    const o = { corr: E.corrTipo, profMin: E.profMin, nElev: 2, pos: E.nucleoPos, lado: E.nucleoLado, escada: 'E', planta: E.tipoPlanta, escTipo: E.escTipo, nEsc: E.nEsc, emerg: E.emerg, fachada: E.fachada };
    expect(A.tipoLayout(t.plate, list, o).rep).toBeNull();
    expect(A.tipoLayout(t.plate, list, { ...o, _st: st, _rap: true }).rep).toBeNull();
    expect(A.tipoLayout(t.plate, list, { ...o, _st: st }).rep).toBeTruthy();
  });
});

describe('galeria: cabe / não cabe por partido', () => {
  it('cada partido da tipologia tem nota (cabe) ou o motivo (o que pede a faixa)', () => {
    const T = m.comodos.porTipo['2 dorm.'];
    const ids = A.comPartidosDe(st, '2 dorm.', 66).map(x => x.mod.id);
    ids.forEach(id => expect(T.info[id], id).toBeTruthy());
    const nc = Object.values(T.info).filter(I => I.nota == null);
    expect(nc.length).toBeGreaterThan(0);
    nc.forEach(I => expect(I.motivo).toMatch(/^pede (frente|profundidade) [≥≤] \d/));
    Object.keys(T.usados).forEach(id => expect(T.notaUso[id]).toBeGreaterThanOrEqual(75));
  });
  it('unidade sem partido traz o motivo curto (rótulo na planta) e o DXF não desenha planta "só para caber"', () => {
    const s2 = estado(A, { lote: { pts: [[0, 0], [30, 0], [30, 30], [0, 30]], front: [0, 3], rec: [{}, {}, {}, {}] }, produto: { torres: [{ pav: 12 }] } });
    const m2 = A.compute(s2), sem = m2.tipo[0].units.filter(u => u.com && u.com.semPartido);
    expect(sem.length).toBeGreaterThan(0);
    sem.forEach(u => expect(u.com.motivo).toMatch(/\d m/));
    const linhas = [], d = { poly: (camada, pts) => linhas.push(camada), text: (camada, p, h, t) => linhas.push(t) };
    A.comDxf(d, { units: sem });
    expect(linhas.filter(x => x === 'PAREDES').length).toBe(sem.length);
    expect(linhas.filter(x => /SEM PARTIDO/.test(x)).length).toBe(sem.length);
  }, 60000);
});
