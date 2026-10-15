// 1.2 Unidades por dentro (cômodos) + escada pelo lance real quando o núcleo vai até a fachada
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { carregar, estado, cenarios } from './harness.js';
import { ROOT } from '../tools/bundle.mjs';

let A, st, m;
beforeAll(() => { A = carregar(); st = estado(A, {}); m = A.compute(st); });
const unidades = mm => mm.tipo.flatMap((l, ti) => l ? l.units.filter(u => !u.livre).map((u, ui) => ({ u, ti, ui })) : []);

describe('cômodos — critérios de pronto (exemplo padrão)', () => {
  it('todas as unidades do exemplo têm planta; as que não cabem num partido trazem o aviso com o motivo', () => {
    const us = unidades(m);
    expect(us.length).toBeGreaterThan(0);
    for (const { u, ti, ui } of us) {
      expect(u.com, `T${ti + 1} unidade ${ui + 1} sem cômodos`).toBeTruthy();
      const erros = u.com.alertas.filter(a => a.nivel === 'erro');
      if (u.com.ok) expect(erros, `T${ti + 1} ${u.nome}: ${erros.map(e => e.msg).join('; ')}`).toEqual([]);
      else { expect(u.com.semPartido).toBe(true); expect(u.com.aviso).toMatch(/^nenhum partido cabe nesta unidade: .*(frente|profundidade|não cabe|sem)/) }
      expect(u.com.partido).toMatch(/^cat-/);
      expect(u.com.nota).toBeGreaterThanOrEqual(0); expect(u.com.nota).toBeLessThanOrEqual(100);
    }
    // a unidade em L de 3 dorm. (sobra da escada, 8,6 m de frente útil) não comporta 3 dormitórios na fachada: é a única
    expect(m.comodos.validas).toBeGreaterThanOrEqual(m.comodos.unidades - 1);
    const ruim = us.find(x => !x.u.com.ok); if (ruim) expect(ruim.u.com.aviso).toMatch(/frente útil de 8,6 m/);
  });
  it('nenhum dormitório, suíte ou sala sem janela (≥ 1/6 do piso)', () => {
    for (const { u } of unidades(m)) for (const r of u.com.rooms.filter(r => ['sala', 'dorm', 'suite'].includes(r.k))) {
      expect(r.jan, `${u.nome} · ${r.longo} sem janela`).toBeGreaterThan(0);
      const piso = r.k === 'sala' && r.integ ? r.area + u.com.rooms.find(x => x.k === 'cozinha').area : r.area;
      expect(r.jan).toBeGreaterThanOrEqual(piso / st.comodos.jan.frac - 0.01);
    }
  });
  it('as áreas dos cômodos somam a área da unidade (sem sobra nem sobreposição)', () => {
    for (const { u } of unidades(m)) {
      const soma = u.com.rooms.reduce((s, r) => s + r.area, 0);
      expect(Math.abs(soma - u.area), `${u.nome}: ${soma.toFixed(2)} ≠ ${u.area.toFixed(2)}`).toBeLessThan(0.02);
      for (const r of u.com.rooms) expect(r.area).toBeGreaterThan(0.15);
    }
  });
  it('programa de cada tipologia: sala, cozinha, banheiro e o número de dormitórios do nome', () => {
    for (const { u } of unidades(m)) {
      const k = u.com.rooms.map(r => r.k), n = +(/(\d)/.exec(u.nome) || [0, 0])[1];
      expect(k).toContain('sala'); expect(k).toContain('cozinha');
      expect(k.filter(x => x === 'dorm' || x === 'suite').length).toBe(n);
      expect(k.some(x => x === 'banho' || x === 'bsuite')).toBe(true);
      expect(u.com.doors.some(d => d.k === 'entrada')).toBe(true);
    }
  });
  it('quadro de áreas por cômodo no PDF (HOOK.pdf)', async () => {
    const txt = [], rows = [];
    let y = 30;
    const doc = { setFontSize() {}, setTextColor() {}, setFont() {}, text: t => txt.push(String(t)) };
    const ctx = { doc, m, T: s => s, M: 14, PW: 210, mut: [0, 0, 0], ink: [0, 0, 0], h2: t => txt.push('H2:' + t), rows: l => rows.push(...l), newPage: () => { y = 24; txt.push('PAGE') }, y: () => y, setY: v => { y = v } };
    await A.comPdf(ctx);
    expect(txt).toContain('PAGE');
    expect(txt).toContain('H2:Quadro de áreas por cômodo');
    const tips = [...new Set(st.produto.mix.map(u => u.nome))];
    for (const t of tips) expect(txt.some(s => s.startsWith(t))).toBe(true);
    expect(rows.filter(r => r[0] === 'Total da unidade').length).toBe(tips.length);
    expect(rows.some(r => /Estar/.test(r[0]))).toBe(true);
    // e a página está registrada no relatório
    const ui = fs.readFileSync(path.join(ROOT, 'src', 'ui', 'comodos.js'), 'utf8');
    expect(ui).toMatch(/HOOK\.pdf\.push\(ctx=>comPdf\(ctx\)\)/);
  });
});

describe('cômodos — não mudam os números', () => {
  it('ligar/desligar os cômodos não muda áreas vendáveis, vagas nem lucro', () => {
    const B = carregar(); const s0 = estado(B, { comodos: { on: false } }); const m0 = B.compute(s0), f0 = B.finance(s0, m0);
    const s1 = estado(B, { comodos: { on: true } }); const m1 = B.compute(s1), f1 = B.finance(s1, m1);
    expect(m1.priv).toBeCloseTo(m0.priv, 6); expect(m1.vagas).toBe(m0.vagas); expect(m1.CA).toBeCloseTo(m0.CA, 9);
    expect(f1.lucro).toBeCloseTo(f0.lucro, 2); expect(m1.sacBal).toBeCloseTo(m0.sacBal, 6);
  });
  it('o resultado viaja pelo Worker (structured clone)', () => {
    const probs = A.serialProblemas ? A.serialProblemas(m.tipo) : [];
    expect(probs).toEqual([]);
    expect(() => structuredClone(m.tipo[0].units[0].com)).not.toThrow();
  });
});

describe('cômodos — funções puras', () => {
  it('modelo automático pelo nome e pela área', () => {
    expect(A.comModeloAuto('Studio', 30)).toBe('studio');
    expect(A.comModeloAuto('1 dorm.', 42)).toBe('1d');
    expect(A.comModeloAuto('1 suíte', 45)).toBe('1s');
    expect(A.comModeloAuto('2 dorm.', 50)).toBe('2d');
    expect(A.comModeloAuto('2 dorm.', 66)).toBe('2d1s');
    expect(A.comModeloAuto('3 dorm.', 92)).toBe('3d1s');
    expect(A.comModeloAuto('Tipo A', 70)).toBe('2d1s');
  });
  it('recuo por aresta (paredes) em meia-esquadria', () => {
    const q = [[0, 0], [4, 0], [4, 3], [0, 3]], r = A.comInset(q, 0.1);
    expect(A.G.area(r)).toBeCloseTo(3.8 * 2.8, 6);
    const r2 = A.comInset(q, i => (i === 0 ? 0.2 : 0.05));
    expect(A.G.area(r2)).toBeCloseTo((4 - 0.1) * (3 - 0.25), 6);
  });
  it('validação: unidade estreita demais não recebe planta absurda — aviso "nenhum partido cabe" com a frente mínima', () => {
    const B = carregar(); const s = estado(B, { lote: { pts: [[0, 0], [20, 0], [20, 40], [0, 40]], front: [0], rec: [{}, {}, {}, {}] }, produto: { torres: [{ pav: 10 }], subsolos: 2 } });
    const mm = B.compute(s); const al = unidades(mm).flatMap(({ u }) => u.com ? u.com.alertas : []);
    expect(al.some(a => a.nivel === 'erro' && /^nenhum partido cabe nesta unidade: frente de [\d,]+ m; os partidos de .+ pedem [\d,]+ m ou mais/.test(a.msg))).toBe(true);
  });
  it('edição manual: a linha da grade do partido move a divisão em todas as unidades da tipologia (e fixa o partido)', () => {
    const B = carregar(); const s = estado(B, {}); const m0 = B.compute(s);
    const alvo = unidades(m0).find(x => x.u.nome === '3 dorm.' && x.u.com.ok);
    const dv = alvo.u.com.divs.find(d => d.ax === 'x'), f0 = alvo.u.com.cortes[dv.id], novo = +(f0 + 0.02).toFixed(4);
    s.comodos.tipos = [{ nome: '3 dorm.', modelo: 'auto', partidos: [], partido: alvo.u.com.partido, cortes: { [dv.id]: novo }, sel: -1 }];
    const m1 = B.compute(s), u1 = m1.tipo[alvo.ti].units[alvo.ui];
    expect(u1.com.partido).toBe(alvo.u.com.partido);
    expect(u1.com.cortes[dv.id]).toBeCloseTo(novo, 3);
    for (const { u } of unidades(m1).filter(x => x.u.nome === '3 dorm.')) expect(u.com.partido).toBe(alvo.u.com.partido);
    expect(Math.abs(u1.com.rooms.reduce((a, r) => a + r.area, 0) - u1.area)).toBeLessThan(0.02);
    // e as áreas vendáveis não mudam
    expect(m1.priv).toBeCloseTo(m0.priv, 6);
  });
  it('variação salva com outro modelo é aplicada', () => {
    const B = carregar(); const s = estado(B, {});
    s.comodos.tipos = [{ nome: '2 dorm.', modelo: '2d', cortes: {}, sel: 0 }];
    s.comodos.variantes = [{ tipo: '2 dorm.', nome: 'Variação 1', modelo: '2d', cortes: {} }];
    const mm = B.compute(s);
    for (const { u } of unidades(mm).filter(x => x.u.nome === '2 dorm.')) { expect(u.com.modelo).toBe('2d'); expect(u.com.rooms.some(r => r.k === 'suite')).toBe(false) }
  });
  it('DXF por camada (paredes, portas, janelas, mobiliário, textos)', () => {
    const layers = new Set(); const d = { poly: l => layers.add(l), text: l => layers.add(l) };
    A.comDxf(d, m.tipo[0]);
    for (const l of ['PAREDES', 'PORTAS', 'JANELAS', 'MOBILIARIO', 'TEXTOS']) expect(layers.has(l), l).toBe(true);
    const w = A.comParedes(m.tipo[0].units[0]);
    expect(w.some(x => x.tipo === 'interna')).toBe(true); expect(w.some(x => x.tipo === 'fachada')).toBe(true);
  });
});

describe('escada pelo lance real (núcleo encostado na fachada)', () => {
  it('a escada fica com 2 lances + parede e a sobra vai para a unidade vizinha', () => {
    for (const l of m.tipo) {
      const esc = l.coreParts.find(c => c.kind === 'esc');
      expect(esc.area).toBeCloseTo(5.8 * 2.7, 1);      // 5,8 m × (2 × 1,20 + 0,30)
      expect(l.escSobra).toBeGreaterThan(5);
      expect(l.coreA).toBeLessThan(A.G.area(l.core) - 5);
      // unidades + núcleo + corredor cobrem a laje sem sobreposição
      const soma = l.units.reduce((s, u) => s + u.area, 0) + A.G.area(l.coreOut) + A.G.area(l.corridor);
      const plate = A.G.area(m.T[m.tipo.indexOf(l)].plate);
      expect(Math.abs(soma - plate) / plate).toBeLessThan(0.01);
    }
  });
  it('desligado (sem núcleo na fachada) a escada fica igual', () => {
    const B = carregar(); const s = estado(B, { estudo: { fachada: false } }); const mm = B.compute(s);
    for (const l of mm.tipo) { expect(l.escSobra).toBe(0); expect(l.coreOut).toEqual(l.core) }
  });
  it('a garagem continua com a projeção do núcleo (vagas dos estudos de referência não mudam)', () => {
    const c = cenarios().find(x => x.arquivo.startsWith('01'));
    expect(m.vagas).toBe(c.esperado.vagas);
    for (const l of m.tipo) expect(A.G.area(l.core)).toBeGreaterThan(A.G.area(l.coreOut));
  });
});

describe('cômodos — robustez nos estudos de referência', () => {
  for (const c of cenarios()) it(`${c.nome}: cômodos somam a unidade e a validação roda`, () => {
    const B = carregar(); const s = estado(B, c.S); const mm = B.compute(s);
    for (const { u } of unidades(mm)) {
      if (!u.com) continue;
      expect(Math.abs(u.com.rooms.reduce((a, r) => a + r.area, 0) - u.area)).toBeLessThan(0.02);
      expect(Array.isArray(u.com.alertas)).toBe(true);
    }
    expect(mm.comodos.unidades).toBeGreaterThan(0);
  });
});

/* ---------- novos modelos: 2 suítes, 4 dormitórios, lavabo ---------- */
// unidade retangular de teste: fachada em y=0, corredor atrás (y=D)
function unidadeRet(B, st, modelo, area, { D = 7.5, lavabo = false } = {}) {
  st.comodos.tipos = [{ nome: 'X', modelo, cortes: {}, sel: -1, lavabo }];
  const W = area / D, P = [[0, 0], [W, 0], [W, D], [0, D]];
  const ctx = { plate: [[0, 0], [W, 0], [W, D + 1.5], [0, D + 1.5]], corridor: [[0, D], [W, D], [W, D + 1.5], [0, D + 1.5]], core: [], sig: `${modelo}|${D}|${area}|${lavabo}` };
  const u = { poly: P, fac: 'min', alvo: area * 0.85, nome: 'X', area, sac: null };
  const L = B.comUnidade(u, { ux: [1, 0], vy: [0, 1] }, st, ctx);
  u.com = B.comExporta(L);
  return { L, u, c: u.com, area };
}
const kinds = c => c.rooms.map(r => r.k);
const ligacoes = c => c.doors.filter(d => d.from != null).map(d => [c.rooms[d.from].k, c.rooms[d.into].k, d.k]);

describe('cômodos — novos modelos (2 suítes, 4 dormitórios, lavabo)', () => {
  it('modelo automático: "2 suítes" → 2s e 4 dormitórios → 4d1s; os antigos não mudam', () => {
    expect(A.comModeloAuto('2 suítes', 80)).toBe('2s');
    expect(A.comModeloAuto('2 dorm. 2 suítes', 80)).toBe('2s');
    expect(A.comModeloAuto('4 dorm.', 120)).toBe('4d1s');
    expect(A.comModeloAuto('3 dorm.', 92)).toBe('3d1s');
    expect(A.comModeloAuto('2 dorm.', 66)).toBe('2d1s');
    expect(Object.keys(A.COM_MODELOS)).toEqual(expect.arrayContaining(['2s', '4d1s']));
  });
  for (const [modelo, area] of [['2s', 80], ['2s', 92], ['4d1s', 120], ['4d1s', 130]]) it(`${modelo} em ${area} m²: válido, soma a unidade e cumpre o programa`, () => {
    const B = carregar(), st = estado(B, {});
    const { c, u } = unidadeRet(B, st, modelo, area);
    expect(c.modelo).toBe(modelo);
    expect(c.alertas.filter(a => a.nivel === 'erro'), c.alertas.map(a => a.msg).join('; ')).toEqual([]);
    expect(Math.abs(c.rooms.reduce((s, r) => s + r.area, 0) - u.area)).toBeLessThan(0.02);
    const k = kinds(c), n = x => k.filter(y => y === x).length;
    expect(n('sala')).toBe(1); expect(n('cozinha')).toBe(1); expect(n('serv')).toBe(1);
    if (modelo === '2s') { expect(n('suite')).toBe(2); expect(n('bsuite')).toBe(2); expect(n('dorm')).toBe(0); expect(n('banho')).toBe(0); expect(n('lavabo')).toBe(1) }
    else { expect(n('dorm')).toBe(3); expect(n('suite')).toBe(1); expect(n('banho')).toBe(2); expect(n('bsuite')).toBe(1) }
    // dormitórios e suítes na fachada, com janela de 1/6 do piso
    for (const r of c.rooms.filter(r => ['dorm', 'suite', 'sala'].includes(r.k))) { expect(r.jan, r.longo).toBeGreaterThan(0); expect(r.bordas.some(b => b.c === 'fachada'), `${r.longo} na fachada`).toBe(true) }
  });
  it('2 suítes: o banheiro de cada suíte abre para a própria suíte e o lavabo para a sala', () => {
    const B = carregar(), st = estado(B, {});
    const { c } = unidadeRet(B, st, '2s', 80);
    const lig = ligacoes(c);
    // dois banheiros de suíte, cada um ligado a uma suíte distinta e SÓ a ela
    const bs = c.rooms.map((r, i) => [r, i]).filter(([r]) => r.k === 'bsuite').map(([, i]) => i);
    expect(bs.length).toBe(2);
    const vizinhos = bs.map(i => c.doors.filter(d => d.from != null && (d.from === i || d.into === i)).map(d => c.rooms[d.from === i ? d.into : d.from].k));
    for (const v of vizinhos) expect(v).toEqual(['suite']);
    const donos = bs.map(i => c.doors.find(d => d.from != null && (d.from === i || d.into === i))).map(d => (c.rooms[d.from].k === 'suite' ? d.from : d.into));
    expect(new Set(donos).size).toBe(2);
    expect(lig.some(([a, b]) => a === 'sala' && b === 'lavabo')).toBe(true);
    // as duas suítes saem da sala (social central) ou da circulação — nenhuma passa por dentro da outra
    expect(lig.filter(([a, b]) => (a === 'circ' || a === 'sala') && b === 'suite').length).toBe(2);
    // cozinha junto da área de serviço
    expect(lig.some(([a, b]) => a === 'cozinha' && b === 'serv')).toBe(true);
  });
  it('4 dormitórios: três dormitórios + suíte saem da circulação; banheiros sociais pela circulação', () => {
    const B = carregar(), st = estado(B, {});
    const { c } = unidadeRet(B, st, '4d1s', 110);
    const lig = ligacoes(c);
    expect(lig.filter(([a, b]) => a === 'circ' && b === 'dorm').length).toBe(3);
    expect(lig.filter(([a, b]) => a === 'circ' && b === 'banho').length).toBe(2);
    expect(lig.some(([a, b]) => a === 'suite' && b === 'bsuite')).toBe(true);
    expect(c.rooms.filter(r => r.k === 'banho').map(r => r.longo)).toEqual(['Banheiro 1', 'Banheiro 2']);
  });
  it('lavabo é opcional nos modelos de 3 dormitórios ou mais (desligado por padrão)', () => {
    const B = carregar();
    for (const [modelo, area] of [['3d1s', 100], ['4d1s', 120]]) {
      const sem = unidadeRet(B, estado(B, {}), modelo, area), com = unidadeRet(B, estado(B, {}), modelo, area, { lavabo: true });
      expect(kinds(sem.c)).not.toContain('lavabo');
      expect(kinds(com.c)).toContain('lavabo');
      expect(com.c.alertas.filter(a => a.nivel === 'erro'), com.c.alertas.map(a => a.msg).join('; ')).toEqual([]);
      expect(Math.abs(com.c.rooms.reduce((s, r) => s + r.area, 0) - com.u.area)).toBeLessThan(0.02);
      const lav = com.c.rooms.findIndex(r => r.k === 'lavabo');
      // perto da sala/entrada: porta da sala e sem janela própria (duto), dentro do mínimo de referência
      expect(ligacoes(com.c).some(([a, b]) => a === 'sala' && b === 'lavabo')).toBe(true);
      expect(com.c.rooms[lav].area).toBeGreaterThanOrEqual(st.comodos.min.lavabo.a - 0.05);
      expect(com.c.rooms[lav].larg).toBeGreaterThanOrEqual(st.comodos.min.lavabo.l - 0.05);
    }
    // modelos menores ignoram a opção
    const pequeno = unidadeRet(B, estado(B, {}), '2d1s', 70, { lavabo: true });
    expect(kinds(pequeno.c)).not.toContain('lavabo');
  });
  it('lavabo ligado no estado completo aparece nas unidades de 3 dormitórios (e desligado não muda nada)', () => {
    const B = carregar(); const s0 = estado(B, {}), m0 = B.compute(s0);
    expect(unidades(m0).every(({ u }) => !kinds(u.com).includes('lavabo'))).toBe(true);
    const s1 = estado(B, {}); s1.comodos.tipos = [{ nome: '3 dorm.', modelo: 'auto', cortes: {}, sel: -1, lavabo: true }];
    const m1 = B.compute(s1);
    const tres = unidades(m1).filter(x => x.u.nome === '3 dorm.' && !x.u.com.semPartido);
    for (const { u } of tres) { expect(u.com.alertas.filter(a => a.nivel === 'erro')).toEqual([]); expect(Math.abs(u.com.rooms.reduce((a, r) => a + r.area, 0) - u.area)).toBeLessThan(0.02) }
    expect(tres.some(({ u }) => kinds(u.com).includes('lavabo'))).toBe(true);
    expect(m1.priv).toBeCloseTo(m0.priv, 6);
  }, 120000);
  it('mínimos do lavabo existem e estudos antigos (sem a chave) a recebem na migração', () => {
    expect(st.comodos.min.lavabo).toEqual({ a: 1.2, l: 0.9 });
    const B = carregar({ comodos: { min: { sala: { a: 11, l: 2.6 } } } });
    expect(B.S.comodos.min.lavabo.a).toBe(1.2); expect(B.S.comodos.min.sala.a).toBe(11);
  });
});

/* ---------- portas recortam as paredes (DXF e IFC) ---------- */
describe('cômodos — vãos de porta nas paredes', () => {
  const u0 = () => m.tipo[0].units.find(x => !x.livre);
  const segs = pls => pls.flatMap(pts => pts.slice(1).map((p, i) => [pts[i], p]));
  const distSeg = (p, [a, b]) => { const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)); return Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dy * t) };
  it('todo vão (porta, passagem, entrada, porta-janela) cai numa parede', () => {
    for (const { u } of unidades(m)) {
      const vs = A.comVaos(u), ws = A.comParedes(u);
      expect(vs.length).toBe(u.com.doors.length);
      expect(ws.orfas.map(v => v.k), `${u.nome}: vãos sem parede`).toEqual([]);
      expect(ws.reduce((s, w) => s + w.vaos.length, 0)).toBe(vs.length);
      for (const v of vs) expect(v.w).toBeGreaterThan(0.5);
    }
  });
  it('paredes internas não se repetem: trechos que se encostam viram uma parede só', () => {
    for (const { u } of unidades(m)) {
      const ws = A.comParedes(u).filter(w => w.tipo === 'interna');
      for (let i = 0; i < ws.length; i++) for (let j = i + 1; j < ws.length; j++) {
        const a = ws[i], b = ws[j], cr = Math.abs((a.b[0] - a.a[0]) * (b.b[1] - b.a[1]) - (a.b[1] - a.a[1]) * (b.b[0] - b.a[0])) / (a.len * b.len);
        if (cr > 2e-3) continue;      // não paralelas
        const off = Math.abs((b.a[0] - a.a[0]) * a.n[0] + (b.a[1] - a.a[1]) * a.n[1]); if (off > 0.03) continue;   // não colineares
        const d = [(a.b[0] - a.a[0]) / a.len, (a.b[1] - a.a[1]) / a.len], pb = [b.a, b.b].map(q => (q[0] - a.a[0]) * d[0] + (q[1] - a.a[1]) * d[1]).sort((x, y) => x - y);
        expect(Math.min(a.len, pb[1]) - Math.max(0, pb[0]), `${u.nome}: paredes ${i}/${j} sobrepostas`).toBeLessThan(0.05);
      }
    }
  });
  it('a parede sem os vãos perde exatamente a largura das portas', () => {
    const ws = A.comParedes(u0()).filter(w => w.vaos.length);
    expect(ws.length).toBeGreaterThan(0);
    for (const w of ws) {
      const sobra = A.comParedeRecortada(w), comp = sobra.reduce((s, r) => s + Math.hypot(r[1][0] - r[0][0], r[1][1] - r[0][1]), 0), vao = w.vaos.reduce((s, x) => s + (x.s1 - x.s0), 0);
      expect(comp).toBeCloseTo(w.len - vao, 1);
    }
  });
  it('DXF: as faces das paredes são interrompidas no vão (e as ombreiras fecham o corte)', () => {
    const pl = {}; const d = { poly: (l, pts, c, ab) => { (pl[l] = pl[l] || []).push({ pts, ab: !!ab }) }, text() {} };
    const u = u0(); A.comDxf(d, { units: [u] });
    const faces = pl.PAREDES.filter(p => p.pts.length > 2 || Math.hypot(p.pts[1][0] - p.pts[0][0], p.pts[1][1] - p.pts[0][1]) > 0.2);
    const S = segs(faces.map(p => p.pts));
    let n = 0;
    for (const v of A.comVaos(u)) for (const o of [v.o0 + 0.01, v.o1 - 0.01]) {
      const mid = [(v.p0[0] + v.p1[0]) / 2 + v.n[0] * o, (v.p0[1] + v.p1[1]) / 2 + v.n[1] * o];
      expect(Math.min(...S.map(s => distSeg(mid, s))), `${u.nome}: parede contínua sob ${v.k}`).toBeGreaterThan(0.15); n++;
    }
    expect(n).toBeGreaterThan(10);
    // contornos abertos onde há vão; ombreiras (2 pontos, aberta) nas pontas
    expect(pl.PAREDES.some(p => p.ab && p.pts.length > 2)).toBe(true);
    expect(pl.PAREDES.filter(p => p.pts.length === 2).length).toBeGreaterThanOrEqual(2 * A.comVaos(u).length);
    // a folha e o arco continuam na camada das portas, e o arco é aberto
    expect(pl.PORTAS.some(p => p.ab && p.pts.length > 3)).toBe(true);
  });
  it('contorno sem vão sai inteiro e fechado', () => {
    const q = [[0, 0], [4, 0], [4, 3], [0, 3]];
    expect(A.comCortaContorno(q, [])).toEqual([{ pts: q, aberta: false }]);
    // vão no meio da aresta de baixo → uma polilinha aberta que começa e termina ao lado do vão
    const v = { p0: [1.5, 0], p1: [2.5, 0], n: [0, 1], o0: -0.06, o1: 0.06 };
    const r = A.comCortaContorno(q, [v]);
    expect(r.length).toBe(1); expect(r[0].aberta).toBe(true);
    const pts = r[0].pts; expect(pts[0]).toEqual([2.5, 0]); expect(pts[pts.length - 1]).toEqual([1.5, 0]);
    expect(pts.length).toBe(6);
  });
  it('IFC: IfcOpeningElement + IfcRelVoidsElement por vão e IfcDoor + IfcRelFillsElement por porta', () => {
    const L = []; let id = 0;
    const B = { add: s => { id++; L.push(`#${id}=${s};`); return '#' + id }, lp: () => '#lp', solid: () => '#sol', str: s => `'${s}'`, guid: () => 'GUID', st: { p: '#p', els: [] }, cod: 'T1-0101' };
    const u = u0(), nd = A.comIfcParedes(u, B), vs = A.comVaos(u);
    expect(nd).toBe(vs.length);
    const cnt = re => L.filter(l => re.test(l)).length, comFolha = vs.filter(v => v.k === 'porta' || v.k === 'entrada' || v.k === 'pj').length;
    expect(cnt(/IFCOPENINGELEMENT/)).toBe(vs.length); expect(cnt(/IFCRELVOIDSELEMENT/)).toBe(vs.length);
    expect(cnt(/IFCDOOR\(/)).toBe(comFolha); expect(cnt(/IFCRELFILLSELEMENT/)).toBe(comFolha);
    expect(comFolha).toBeLessThan(vs.length);           // passagens ficam só com a abertura
    // cada vão aponta para uma parede e cada porta preenche uma abertura que existe
    const walls = new Set(L.filter(l => /IFCWALL\(/.test(l)).map(l => l.split('=')[0]));
    for (const l of L.filter(l => /IFCRELVOIDSELEMENT/.test(l))) { const [, w, o] = /,(#\d+),(#\d+)\)/.exec(l); expect(walls.has(w)).toBe(true); expect(L.some(x => x.startsWith(o + '=IFCOPENINGELEMENT'))).toBe(true) }
    for (const l of L.filter(l => /IFCRELFILLSELEMENT/.test(l))) { const [, o, d] = /,(#\d+),(#\d+)\)/.exec(l); expect(L.some(x => x.startsWith(o + '=IFCOPENINGELEMENT'))).toBe(true); expect(L.some(x => x.startsWith(d + '=IFCDOOR('))).toBe(true) }
    // reais com ponto (formato STEP) e as portas dentro do pavimento
    expect(L.filter(l => /IFCDOOR\(/.test(l)).every(l => /,\$,\d+\.\d*,\d+\.\d*,\.DOOR\.,\.[A-Z_]+\.,\$\);$/.test(l))).toBe(true);
    expect(B.st.els.length).toBe(L.filter(l => /IFCWALL\(|IFCDOOR\(/.test(l)).length);
  });
  it('export.js usa os vãos: DXF aceita contorno aberto e o IFC chama comIfcParedes', () => {
    const ex = fs.readFileSync(path.join(ROOT, 'src', 'export.js'), 'utf8');
    expect(ex).toMatch(/poly\(layer, pts, color=7, aberta=false\)/); expect(ex).toMatch(/pts\.length>2&&!aberta\?1:0/);
    expect(ex).toMatch(/comIfcParedes\(u,\{add,lp,solid,str,guid:ifcGuid,st,cod\}\)/);
  });
});
