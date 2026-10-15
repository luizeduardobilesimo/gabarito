// Editor de modelos de apartamento (docs/APTOS.md §2 e §4): operações puras de src/calc/aptoeditor.js.
import { describe, it, expect } from 'vitest';
import { carregar } from './harness.js';

const A = carregar();
const soma = m => m.ambientes.reduce((s, a) => s + a.ret[2] * a.ret[3], 0);
const ach = (m, id) => m.ambientes.find(a => a.id === id);
/* 2 dorm. de 8,0 × 8,6 desenhado do zero, ambiente por ambiente */
function desenha2d() {
  let m = A.aedNovo({ tipologia: '2d', W: 8.0, D: 8.6, nome: 'Teste 2 dorm.' });
  const pôr = (k, r) => { const o = A.aedCria(m, r, k); m = o.m; return o.id };
  pôr('sala', [0, 0, 3.2, 8.6]); pôr('dorm', [3.2, 0, 2.4, 3.4]); pôr('dorm', [5.6, 0, 2.4, 3.4]); pôr('circ', [3.2, 3.4, 4.8, 1.0]);
  pôr('cozinha', [3.2, 4.4, 2.7, 4.2]); pôr('banho', [5.9, 4.4, 2.1, 1.6]); pôr('serv', [5.9, 6.0, 2.1, 2.6]);
  return A.aedEntrada(m, 2.4);
}

describe('modelo novo e normalização', () => {
  it('aedNovo: tipologia, medidas, faixas que contêm W e D, entrada no corredor, id de usuário', () => {
    const m = A.aedNovo({ tipologia: '2d1s' });
    expect(m.origem).toBe('usuario'); expect(m.id).toMatch(/^usr-/); expect(m.tipologia).toBe('2d1s');
    expect(m.faixaW.min).toBeLessThanOrEqual(m.W); expect(m.faixaW.max).toBeGreaterThanOrEqual(m.W);
    expect(m.entrada.lado).toBe('corredor'); expect(m.ambientes).toEqual([]);
  });
  it('aedNormaliza: recorta na caixa, ids únicos, tipo e estica válidos, portas que apontam para ambientes', () => {
    const n = A.aedNormaliza({ W: 6, D: 8, tipologia: 'xx', ambientes: [{ id: 'a', k: 'sala', ret: [-1, 0, 4, 9] }, { id: 'a', k: 'zz', ret: [3, 0, 3, 8], estica: 'q' }],
      portas: [{ a: 'entrada', b: 'a' }, { a: 'a', b: 'nada' }] });
    expect(n.tipologia).toBe('2d');
    expect(n.ambientes[0].ret).toEqual([0, 0, 3, 8]);
    expect(new Set(n.ambientes.map(a => a.id)).size).toBe(2);
    expect(n.ambientes[1].k).toBe('sala'); expect(n.ambientes[1].estica).toBe('xy');
    expect(n.portas).toEqual([{ a: 'entrada', b: 'a' }]);
  });
  it('ímã: grade de 5 cm e encosto nas bordas próximas', () => {
    expect(A.aedR(3.612)).toBe(3.6); expect(A.aedR(3.626)).toBe(3.65);
    expect(A.aedIma(3.18, [3.2, 5], 0.05)).toBe(3.2);
    expect(A.aedIma(3.1, [3.2], 0.05)).toBe(3.1);
  });
});

describe('desenhar, conferir e editar', () => {
  it('desenhado do zero, o 2 dorm. preenche W × D sem sobrepor e passa na validação', () => {
    const m = desenha2d(), c = A.aedConfere(m);
    expect(c.ok).toBe(true); expect(c.livre).toBeCloseTo(0, 6); expect(c.sobreposta).toBeCloseTo(0, 6);
    expect(soma(m)).toBeCloseTo(8 * 8.6, 6);
    const v = A.aedValidaMin(m);
    expect(v.problemas.filter(p => p.nivel === 'bad')).toEqual([]);
    expect(v.nota).toBeGreaterThanOrEqual(88);
  });
  it('ambiente desenhado por cima: quem fica coberto sai e quem sobra num retângulo encolhe', () => {
    let m = A.aedNovo({ W: 6, D: 6 });
    const a = A.aedCria(m, [0, 0, 6, 6], 'sala'); m = a.m;
    const b = A.aedCria(m, [0, 0, 6, 2], 'dorm'); m = b.m;
    expect(ach(m, a.id).ret).toEqual([0, 2, 6, 4]);
    const c = A.aedCria(m, [0, 0, 6.2, 2.1], 'suite'); m = c.m;
    expect(ach(m, b.id)).toBeUndefined();
    expect(A.aedConfere(m).ok).toBe(true);
    expect(A.aedCria(m, [1, 1, 0.3, 2], 'sala').id).toBeNull();     // menor que o mínimo
  });
  it('sobreposição e sobra são acusadas (e mostradas como sobras)', () => {
    let m = desenha2d();
    m = A.aedMove(m, ach(m, 'a6') ? 'a6' : m.ambientes[5].id, -0.5, 0);
    const c = A.aedConfere(m);
    expect(c.ok).toBe(false); expect(c.pares.length).toBeGreaterThan(0); expect(c.livre).toBeGreaterThan(0);
    expect(A.aedLivres(m).reduce((s, r) => s + r[2] * r[3], 0)).toBeCloseTo(c.livre, 6);
    const v = A.aedValidaMin(m);
    expect(v.problemas.some(p => p.k === 'sobrepoe' && p.nivel === 'bad')).toBe(true);
    expect(v.problemas.some(p => p.k === 'sobra')).toBe(true);
  });
  it('divisa compartilhada: as duas faces andam juntas e respeitam a medida mínima', () => {
    const m = desenha2d();
    const d = A.aedDivisas(m).find(x => x.eixo === 'x' && Math.abs(x.c - 5.6) < 1e-6);
    expect(d).toBeTruthy();
    const m2 = A.aedMoveDivisa(m, d, 5.73);
    const [d1, d2] = m.ambientes.filter(a => a.k === 'dorm').map(a => a.id);
    expect(ach(m2, d1).ret[2]).toBeCloseTo(2.55, 6); expect(ach(m2, d2).ret[0]).toBeCloseTo(5.75, 6);
    expect(A.aedConfere(m2).ok).toBe(true);
    const m3 = A.aedMoveDivisa(m, d, 100);
    expect(ach(m3, d2).ret[2]).toBeCloseTo(A.AED_MIN, 6);
    expect(m.ambientes.find(a => a.id === d1).ret[2]).toBe(2.4);          // o original não muda
  });
  it('a divisa sala | cozinha liga a sala aos três ambientes do lado de lá', () => {
    const m = desenha2d(), d = A.aedDivisas(m).find(x => x.eixo === 'x' && Math.abs(x.c - 3.2) < 1e-6);
    expect(d.menos.length).toBe(1); expect(d.mais.length).toBe(3);
  });
  it('dividir e unir (retângulo e ambiente em L)', () => {
    const m = desenha2d(), sala = m.ambientes[0].id;
    const dv = A.aedDivide(m, sala, 'y', 5.0);
    expect(ach(dv.m, sala).ret).toEqual([0, 0, 3.2, 5]); expect(ach(dv.m, dv.id).ret).toEqual([0, 5, 3.2, 3.6]);
    const un = A.aedUne(dv.m, sala, dv.id);
    expect(un.modo).toBe('ret'); expect(ach(un.m, sala).ret).toEqual([0, 0, 3.2, 8.6]); expect(un.m.ambientes.length).toBe(m.ambientes.length);
    const circ = m.ambientes.find(a => a.k === 'circ').id, banho = m.ambientes.find(a => a.k === 'banho').id;
    const l = A.aedUne(m, circ, banho);
    expect(l.modo).toBe('grupo'); expect(ach(l.m, circ).grupo).toBeTruthy(); expect(ach(l.m, circ).grupo).toBe(ach(l.m, banho).grupo);
    expect(A.aedUne(m, m.ambientes[1].id, m.ambientes[6].id).modo).toBeNull();
  });
  it('espelhar duas vezes volta ao original', () => {
    const m = desenha2d(), e = A.aedEspelha(m);
    expect(ach(e, m.ambientes[0].id).ret[0]).toBeCloseTo(8 - 3.2, 6);
    expect(e.entrada.x).toBeCloseTo(8 - 2.4, 6);
    expect(A.aedEspelha(e).ambientes).toEqual(m.ambientes);
  });
  it('trocar a medida: só as faixas que esticam mudam; ambientes fixos mantêm a medida', () => {
    const m = desenha2d(), m2 = A.aedMedidas(m, 9.0, 8.6);
    expect(m2.W).toBe(9); expect(A.aedConfere(m2).ok).toBe(true);
    const banho = m2.ambientes.find(a => a.k === 'banho'), serv = m2.ambientes.find(a => a.k === 'serv');
    expect(banho.ret[2]).toBeCloseTo(2.1, 6); expect(serv.ret[2]).toBeCloseTo(2.1, 6);
    expect(m2.faixaW.max).toBeGreaterThanOrEqual(9);
    const p = A.aedAplicaSimples(m, 7.4, 9.2);
    expect(p.W).toBe(7.4); expect(A.aedConfere(p).livre).toBeCloseTo(0, 6);
  });
});

describe('portas, janelas e validação', () => {
  it('portas deduzidas: entrada na sala, dormitórios e banho pela circulação, serviço pela cozinha', () => {
    const m = desenha2d(), P = A.aedDeduzPortas(m), k = id => id === 'entrada' ? 'entrada' : ach(m, id).k;
    const par = P.map(p => k(p.a) + '>' + k(p.b));
    expect(par).toContain('entrada>sala'); expect(par).toContain('sala>circ'); expect(par).toContain('circ>dorm');
    expect(par).toContain('circ>banho'); expect(par).toContain('sala>cozinha'); expect(par).toContain('cozinha>serv');
    expect(P.length).toBe(m.ambientes.length);
    P.forEach(p => expect(A.aedPortaGeo(m, p)).toBeTruthy());
  });
  it('porta editada: tirar a da circulação deixa os dormitórios sem acesso; deduzir de novo resolve', () => {
    const m = desenha2d(), sala = m.ambientes.find(a => a.k === 'sala').id, circ = m.ambientes.find(a => a.k === 'circ').id;
    const sem = A.aedPortaAlterna(m, sala, circ);
    expect(Array.isArray(sem.portas)).toBe(true);
    const v = A.aedValidaMin(sem);
    expect(v.problemas.filter(p => p.k === 'acesso').length).toBeGreaterThanOrEqual(3);
    expect(v.ok).toBe(false);
    expect(A.aedValidaMin(A.aedPortasAuto(sem)).ok).toBe(true);
  });
  it('passagem proibida: circulação acessada só por dentro de um dormitório é acusada', () => {
    let m = desenha2d(); const circ = m.ambientes.find(a => a.k === 'circ').id, d1 = m.ambientes.find(a => a.k === 'dorm').id, sala = m.ambientes[0].id;
    m = A.aedPortaAlterna(m, sala, circ); m = A.aedPortaAlterna(m, sala, d1);     // a porta dormitório | circulação já existe
    const v = A.aedValidaMin(m);
    expect(v.problemas.some(p => p.k === 'passagem' && p.amb === circ)).toBe(true);
    expect(v.problemas.some(p => p.amb === d1)).toBe(false);
  });
  it('erros propositais: dormitório pequeno, sem janela e programa incompleto', () => {
    let m = desenha2d();
    const d2 = m.ambientes.filter(a => a.k === 'dorm')[1].id;
    m = A.aedTipo(m, d2, 'closet');
    const v = A.aedValidaMin(m);
    expect(v.problemas.some(p => p.k === 'programa' && /dormitório/.test(p.msg))).toBe(true);
    expect(v.nota).toBeLessThan(80);
    let n = desenha2d(); const d1 = n.ambientes.find(a => a.k === 'dorm').id, dv = A.aedDivide(n, d1, 'x', 4.4); n = dv.m;
    const w = A.aedValidaMin(n);
    expect(w.problemas.some(p => p.k === 'largura' && p.amb === d1)).toBe(true);
    const sj = A.aedValidaMin(A.aedNormaliza({ ...desenha2d(), ambientes: desenha2d().ambientes.map(a => a.k === 'dorm' && a.ret[0] > 5 ? { ...a, ret: [5.6, 4.4, 0.3, 0.3] } : a) }));
    expect(sj.ok).toBe(false);
  });
  it('tipo da passagem: porta → vão → correr → integrado → porta (vão conta como acesso)', () => {
    const m0 = desenha2d(), m = { ...m0, portas: A.aedDeduzPortas(m0) }, sala = m.ambientes[0].id, coz = m.ambientes.find(a => a.k === 'cozinha').id;   // portas explícitas (o motor pode deduzir "integrado")
    const tipos = []; let x = m;
    for (let i = 0; i < 4; i++) { x = A.aedPortaTipo(x, sala, coz); tipos.push(x.portas.find(p => [p.a, p.b].includes(coz) && [p.a, p.b].includes(sala)).tipo || 'porta') }
    expect(tipos).toEqual(['vao', 'correr', 'integ', 'porta']);
    const v = A.aedPortaTipo(m, sala, coz);
    expect(A.aedValidaMin(v).ok).toBe(true);
    expect(A.aedPortaGeo(v, v.portas.find(p => p.b === coz || p.a === coz)).tipo).toBe('vao');
    expect(A.aedPortaTipo(m, m.ambientes[1].id, m.ambientes[6].id)).toBe(m);   // sem porta: nada muda
  });
  it('banho da suíte e closet ganham a suíte dona (`de`) e os campos do motor são preservados', () => {
    let m = A.aedNovo({ tipologia: '1s', W: 6, D: 8 });
    const pôr = (k, r) => { const o = A.aedCria(m, r, k); m = o.m; return o.id };
    const s = pôr('suite', [0, 0, 3.4, 4]), b = pôr('bsuite', [3.4, 0, 1.6, 2.4]);
    expect(A.aedAcha(m, b).de).toBe(s);
    m = A.aedTipo(m, b, 'banho'); expect(A.aedAcha(m, b).de).toBeUndefined();
    const n = A.aedNormaliza({ W: 6, D: 8, ambientes: [{ id: 'a1', k: 'suite', ret: [0, 0, 3, 4], cama: 'casal' }, { id: 'a2', k: 'lavabo', ret: [3, 0, 1, 2], opc: 'lavabo', funde: 'a1' }, { id: 'a3', k: 'bsuite', ret: [3, 2, 1, 2], de: 'zz' }],
      portas: [{ a: 'a1', b: 'a3', tipo: 'correr', w: 0.9, pos: 'lo' }] });
    expect(n.ambientes[0].cama).toBe('casal'); expect(n.ambientes[1].funde).toBe('a1'); expect(n.ambientes[2].de).toBeUndefined();
    expect(n.portas[0]).toEqual({ a: 'a1', b: 'a3', tipo: 'correr', w: 0.9, pos: 'lo' });
  });
  it('janelas na fachada para sala e dormitórios, com vão ≥ 1/6 do piso', () => {
    const m = desenha2d(), J = A.aedJanelas(m);
    m.ambientes.filter(a => ['sala', 'dorm'].includes(a.k)).forEach(a => expect(J.some(j => j.a === a.id)).toBe(true));
    expect(J.some(j => ach(m, j.a).k === 'circ')).toBe(false);
  });
  it('nota: 100 − 25 por erro − 6 por alerta', () => {
    const r = A.aedNota([{ nivel: 'bad', msg: 'x' }, { nivel: 'warn', msg: 'y' }, { nivel: 'warn', msg: 'z' }]);
    expect(r.nota).toBe(100 - 25 - 12); expect(r.ok).toBe(false);
  });
  it('aedValida devolve o formato do aptoValida (com ou sem o motor de plantas)', () => {
    const r = A.aedValida(desenha2d(), A.DEF);
    expect(typeof r.nota).toBe('number'); expect(Array.isArray(r.problemas)).toBe(true); expect(['editor', 'regras']).toContain(r.fonte);
  });
});

describe('importar e exportar', () => {
  it('exporta e importa de volta (ida e volta igual)', () => {
    const m = desenha2d(), txt = A.aedExporta([m]), o = JSON.parse(txt);
    expect(o.formato).toBe('gabarito.aptos'); expect(o.modelos.length).toBe(1);
    const r = A.aedImporta(txt);
    expect(r.ok).toBe(true); expect(r.modelos[0].ambientes).toEqual(m.ambientes); expect(r.modelos[0].W).toBe(8);
    expect(A.aedImporta(JSON.stringify(m)).modelos.length).toBe(1);             // um modelo solto
    expect(A.aedImporta(JSON.stringify([m, m])).modelos.length).toBe(2);         // uma lista
  });
  it('recusa o que não é modelo, com motivo', () => {
    expect(A.aedImporta('{oi').ok).toBe(false);
    const r = A.aedImporta(JSON.stringify({ W: 1, ambientes: 'x' }));
    expect(r.ok).toBe(false); expect(r.erros[0]).toMatch(/frente|ambientes/);
    expect(A.aedValidaEsquema({ W: 6, D: 8, ambientes: [{ k: 'quarto', ret: [0, 0, 1, 1] }] }).erros[0]).toMatch(/tipo desconhecido/);
    const misto = A.aedImporta(JSON.stringify({ modelos: [desenha2d(), { nome: 'ruim' }] }));
    expect(misto.ok).toBe(true); expect(misto.modelos.length).toBe(1); expect(misto.erros.length).toBe(1);
  });
  it('cópia de um partido do catálogo vira modelo do usuário com id novo e a origem guardada', () => {
    const p = A.aedPartidos()[0], c = A.aedCopia(p);
    expect(c.origem).toBe('usuario'); expect(c.id).not.toBe(p.id); expect(c.id).toMatch(/^usr-/);
    if (p.origem === 'catalogo') expect(c.base).toBe(p.id);
  });
});

describe('partidos de reserva e miniatura', () => {
  it('os partidos de reserva preenchem W × D e não têm erro', () => {
    A.aedPartidosBase().forEach(p => {
      expect(A.aedConfere(p).ok).toBe(true);
      expect(A.aedValidaMin(p).problemas.filter(x => x.nivel === 'bad')).toEqual([]);
    });
  });
  it('miniatura SVG: um retângulo por ambiente, fachada e entrada marcadas', () => {
    const m = desenha2d(), s = A.aedMiniSVG(m, { label: 'x' });
    expect((s.match(/class="aed-mk /g) || []).length).toBe(m.ambientes.length);
    expect(s).toContain('aed-mf'); expect(s).toContain('aed-me'); expect(s).toContain('aria-label="x"');
    expect(A.aedMiniSVG(null)).toBe('');
  });
});
