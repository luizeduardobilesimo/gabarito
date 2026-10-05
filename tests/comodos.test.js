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
  it('todas as unidades do exemplo têm cômodos válidos', () => {
    const us = unidades(m);
    expect(us.length).toBeGreaterThan(0);
    for (const { u, ti, ui } of us) {
      expect(u.com, `T${ti + 1} unidade ${ui + 1} sem cômodos`).toBeTruthy();
      const erros = u.com.alertas.filter(a => a.nivel === 'erro');
      expect(erros, `T${ti + 1} ${u.nome}: ${erros.map(e => e.msg).join('; ')}`).toEqual([]);
      expect(u.com.ok).toBe(true);
    }
    expect(m.comodos.validas).toBe(m.comodos.unidades);
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
  it('validação: unidade estreita demais gera alertas (dorm. sem largura)', () => {
    const B = carregar(); const s = estado(B, { lote: { pts: [[0, 0], [20, 0], [20, 40], [0, 40]], front: [0], rec: [{}, {}, {}, {}] }, produto: { torres: [{ pav: 10 }], subsolos: 2 } });
    const mm = B.compute(s); const al = unidades(mm).flatMap(({ u }) => u.com ? u.com.alertas : []);
    expect(al.some(a => /largura|m²/.test(a.msg))).toBe(true);
  });
  it('edição manual: o corte da tipologia move a divisão em todas as unidades dela', () => {
    const B = carregar(); const s = estado(B, {}); const m0 = B.compute(s);
    const alvo = unidades(m0).find(x => x.u.nome === '3 dorm.');
    const f1 = alvo.u.com.cortes.f1, novo = +(f1 + 0.05).toFixed(3);
    s.comodos.tipos = [{ nome: '3 dorm.', modelo: 'auto', cortes: { f1: novo }, sel: -1 }];
    const m1 = B.compute(s);
    // a unidade arrastada fica exatamente no corte; as outras da tipologia vão na mesma direção (até o limite de 1,5 m por cômodo)
    expect(m1.tipo[alvo.ti].units[alvo.ui].com.cortes.f1).toBeCloseTo(novo, 3);
    for (const { u, ti, ui } of unidades(m1).filter(x => x.u.nome === '3 dorm.')) expect(u.com.cortes.f1).toBeGreaterThanOrEqual(m0.tipo[ti].units[ui].com.cortes.f1 - 1e-6);
    const sala0 = alvo.u.com.rooms.find(r => r.k === 'sala').area, u1 = m1.tipo[alvo.ti].units[alvo.ui];
    expect(u1.com.rooms.find(r => r.k === 'sala').area).toBeGreaterThan(sala0);
    expect(Math.abs(u1.com.rooms.reduce((a, r) => a + r.area, 0) - u1.area)).toBeLessThan(0.02);
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
