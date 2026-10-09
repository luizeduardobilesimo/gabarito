import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { carregar, estado } from './harness.js';

// Ruas → frentes (src/calc/frente.js): quais lados do lote dão para a rua, principal, esquina, acesso e regra por largura.
const A = carregar();
const FIX = JSON.parse(fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), 'fixtures', 'overpass-torres.json'), 'utf8'));
const REF = A.geoRef(-29.3362, -49.7222);
const TOR = A.ctxDeOverpass(FIX, REF, { raio: 320 });

const via = (p, w = 7, t = 'residential', n = 'Rua A', m) => Object.assign({ p, w, t }, n ? { n } : {}, m ? { m: 1 } : {});
const RET = [[0, 0], [20, 0], [20, 30], [0, 30]];   // anti-horário; aresta 0 = sul, 1 = leste, 2 = norte, 3 = oeste
const rua = (r, i) => r.find(x => x.i === i);
const sug = (lote, vias) => { const r = A.ruasDoLote(lote, vias); const s = A.sugereFrentes(lote, r); return { r, s, a: s.front.length ? A.sugereAcesso(lote, r, s) : null } };

describe('ruasDoLote — geometrias simples', () => {
  it('uma via paralela ao lado sul marca só esse lado, com nome, classe, largura e folga', () => {
    const r = A.ruasDoLote(RET, [via([[-40, -6], [60, -6]], 7)]);
    expect(r.map(x => !!x.rua)).toEqual([true, false, false, false]);
    const q = rua(r, 0).rua;
    expect(q.nome).toBe('Rua A'); expect(q.classe).toBe('residential'); expect(q.largura).toBe(7); expect(q.estimada).toBe(true);
    expect(q.dist).toBeCloseTo(2.5, 1);         // 6 m do eixo − 3,5 m de meia pista
    expect(q.cobertura).toBe(1);
  });
  it('largura medida (m) não é estimada', () => {
    expect(rua(A.ruasDoLote(RET, [via([[-40, -6], [60, -6]], 9, 'secondary', 'Av. B', true)]), 0).rua.estimada).toBe(false);
  });
  it('via dentro do lote, longe demais ou atrás do lote não conta', () => {
    expect(A.ruasDoLote(RET, [via([[-40, 15], [60, 15]])]).some(x => x.rua)).toBe(false);          // cortando o lote
    expect(A.ruasDoLote(RET, [via([[-40, -25], [60, -25]])]).some(x => x.rua)).toBe(false);        // 21,5 m da borda
  });
  it('tolerância configurável', () => {
    const v = [via([[-40, -13], [60, -13]], 7)];
    expect(A.ruasDoLote(RET, v, { tol: 12 })[0].rua).not.toBeNull();
    expect(A.ruasDoLote(RET, v, { tol: 8 })[0].rua).toBeNull();
  });
  it('exige paralelismo (< 20°)', () => {
    const t = ang => { const a = ang * Math.PI / 180; return [via([[10 - 40 * Math.cos(a), -6 - 40 * Math.sin(a)], [10 + 40 * Math.cos(a), -6 + 40 * Math.sin(a)]])] };
    expect(A.ruasDoLote(RET, t(10))[0].rua).not.toBeNull();
    expect(A.ruasDoLote(RET, t(35))[0].rua).toBeNull();
  });
  it('cobertura mínima de 50% da aresta', () => {
    // a via só passa pelos primeiros 8 m (40%) da aresta
    expect(A.ruasDoLote(RET, [via([[-30, -6], [8, -6]])])[0].rua).toBeNull();
    const ok = A.ruasDoLote(RET, [via([[-30, -6], [12, -6]])])[0].rua;      // 60%
    expect(ok.cobertura).toBeCloseTo(0.6, 2);
  });
  it('trechos da mesma rua (mesmo nome) somam a cobertura', () => {
    const r = A.ruasDoLote(RET, [via([[-30, -6], [8, -6]]), via([[8, -6], [50, -6]])]);
    expect(rua(r, 0).rua.cobertura).toBe(1);
  });
  it('duas vias no mesmo lado: vale a que cobre mais (e a mais próxima no empate)', () => {
    const r = A.ruasDoLote(RET, [via([[-30, -6], [50, -6]], 7, 'residential', 'Rua Perto'), via([[-30, -11], [50, -11]], 7, 'residential', 'Rua Longe')]);
    expect(rua(r, 0).rua.nome).toBe('Rua Perto'); expect(rua(r, 0).alt).toContain('Rua Longe');
  });
  it('contorno horário e lote girado dão o mesmo resultado', () => {
    const horario = RET.slice().reverse();
    const r = A.ruasDoLote(horario, [via([[-40, -6], [60, -6]])]);
    expect(r.filter(x => x.rua).length).toBe(1);
    const g = 33 * Math.PI / 180, rot = ([x, y]) => [x * Math.cos(g) - y * Math.sin(g), x * Math.sin(g) + y * Math.cos(g)];
    const rr = A.ruasDoLote(RET.map(rot), [via([[-40, -6], [60, -6]].map(rot))]);
    expect(rr.map(x => !!x.rua)).toEqual([true, false, false, false]);
  });
  it('sem vias: nenhuma frente', () => {
    const r = A.ruasDoLote(RET, []);
    expect(r.every(x => !x.rua)).toBe(true);
    expect(A.sugereFrentes(RET, r)).toMatchObject({ front: [], principal: null, tipo: 'nenhuma' });
  });
});

describe('sugereFrentes e sugereAcesso', () => {
  const sul = via([[-40, -6], [60, -6]], 11, 'primary', 'Avenida Grande');
  const oeste = via([[-6, -40], [-6, 70]], 7, 'residential', 'Rua Pequena');
  const norte = via([[-40, 36], [60, 36]], 7, 'residential', 'Rua do Fundo');
  it('uma frente', () => {
    const { s, a } = sug(RET, [sul]);
    expect(s).toMatchObject({ front: [0], principal: 0, tipo: 'uma', esquina: false });
    expect(a).toMatchObject({ i: 0, igualPrincipal: true, pos: null });
  });
  it('esquina: principal na via de maior hierarquia, acesso na de menor, longe da esquina', () => {
    const { s, a } = sug(RET, [sul, oeste]);
    expect(s.front).toEqual([0, 3]); expect(s.esquina).toBe(true); expect(s.tipo).toBe('esquina');
    expect(s.principal).toBe(0);                  // avenida (primary) > rua local
    expect(a.i).toBe(3); expect(a.nome).toBe('Rua Pequena'); expect(a.igualPrincipal).toBe(false); expect(a.menor).toBe(true);
    expect(a.pos).toBe(0.2);                      // aresta 3 sobe de (0,30) a (0,0): a esquina fica no fim → entrada no começo
  });
  it('esquina com a mesma hierarquia: principal é a maior testada', () => {
    const lote = [[0, 0], [40, 0], [40, 20], [0, 20]];
    const s = A.sugereFrentes(lote, A.ruasDoLote(lote, [via([[-40, -6], [80, -6]], 7, 'residential', 'R1'), via([[-6, -40], [-6, 60]], 7, 'residential', 'R2')]));
    expect(s.principal).toBe(0);                  // 40 m contra 20 m
  });
  it('passante: duas ruas em lados opostos', () => {
    const { s } = sug(RET, [sul, norte]);
    expect(s.tipo).toBe('passante'); expect(s.esquina).toBe(false); expect(s.front).toEqual([0, 2]);
  });
  it('a mesma rua em dois lados (curva) não vira esquina', () => {
    const l = [[0, 0], [20, 0], [26, 28], [0, 30]];
    const r = A.ruasDoLote(l, [via([[-30, -6], [18, -6], [34, 4], [38, 32]], 7, 'residential', 'Rua Curva')]);
    const s = A.sugereFrentes(l, r);
    expect(s.esquina).toBe(false);
  });
  it('acesso: service/residential antes de primary', () => {
    const lote = RET, v = [via([[-40, -6], [60, -6]], 11, 'primary', 'Av.'), via([[-6, -40], [-6, 70]], 4.5, 'service', 'Servidão')];
    expect(sug(lote, v).a.classe).toBe('service');
  });
});

describe('regra por largura da via (opcional, ilustrativa)', () => {
  const tab = [{ ate: 7, rec: 4 }, { ate: 12, rec: 5 }, { ate: 99, rec: 6 }];
  it('escolhe a faixa pela largura', () => {
    expect(A.regraPorLargura(6, tab)).toEqual({ rec: 4, ate: 7 });
    expect(A.regraPorLargura(7, tab).rec).toBe(4);
    expect(A.regraPorLargura(9.5, tab).rec).toBe(5);
    expect(A.regraPorLargura(30, tab).rec).toBe(6);
    expect(A.regraPorLargura(150, tab).rec).toBe(6);     // acima da última faixa: vale a última
    expect(A.regraPorLargura(8, [])).toBeNull();
    expect(A.regraPorLargura(0, tab)).toBeNull();
  });
  it('vem desligada e com tabela no estado padrão', () => {
    const st = estado(A);
    expect(st.frentes.regra.on).toBe(false); expect(st.frentes.regra.tab.length).toBeGreaterThan(1); expect(st.frentes.sug).toBeNull();
  });
});

/* ---- Torres (OSM real): lotes sintéticos encostados nas vias reais ---- */
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]], add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k];
const un = v => { const l = Math.hypot(v[0], v[1]); return [v[0] / l, v[1] / l] };
const seg = (nome, i = 0) => { let k = 0; for (const v of TOR.vias) { if (v.n !== nome) continue; for (let j = 0; j < v.p.length - 1; j++) { if (Math.hypot(...sub(v.p[j + 1], v.p[j])) > 40 && k++ >= i) return { a: v.p[j], b: v.p[j + 1], w: v.w, t: v.t } } } throw new Error('sem trecho ' + nome) };
/* lote ao lado do trecho: borda 'calc' m além da pista, frente 'f' ao longo da via, fundo 'p' para o lado escolhido */
function loteAoLado(s, lado, f, p, t = 0.5, calc = 3) {
  const u = un(sub(s.b, s.a)), n = [-u[1] * lado, u[0] * lado], L = Math.hypot(...sub(s.b, s.a)), base = add(add(s.a, u, L * t - f / 2), n, s.w / 2 + calc);
  const pts = [base, add(base, u, f), add(add(base, u, f), n, p), add(base, n, p)];
  return A.G.sArea(pts) < 0 ? pts.reverse() : pts;
}
/* lote de esquina: quadrante entre as direções uA e uB que saem do cruzamento P, a calc m das pistas */
function loteEsquina(P, A1, B1, f, p, calc = 3) {
  const uA = un(A1.d), uB = un(B1.d), nA = (uB[0] * -uA[1] + uB[1] * uA[0]) > 0 ? [-uA[1], uA[0]] : [uA[1], -uA[0]], nB = (uA[0] * -uB[1] + uA[1] * uB[0]) > 0 ? [-uB[1], uB[0]] : [uB[1], -uB[0]];
  const oA = A1.w / 2 + calc, oB = B1.w / 2 + calc, det = nA[0] * nB[1] - nA[1] * nB[0];
  const C = add(P, [(oA * nB[1] - oB * nA[1]) / det, (nA[0] * oB - nB[0] * oA) / det]);
  const pts = [C, add(C, uA, f), add(add(C, uA, f), uB, p), add(C, uB, p)];
  return A.G.sArea(pts) < 0 ? pts.reverse() : pts;
}
const nomes = (r) => r.filter(x => x.rua).map(x => `${x.i}:${x.rua.nome}`);

describe('Torres (fixture real do OSM)', () => {
  it('lote com uma frente na Rua Saldanha da Gama (dos dois lados da rua)', () => {
    const s = seg('Rua Saldanha da Gama', 1);
    [1, -1].forEach(lado => {
      const lote = loteAoLado(s, lado, 18, 14);
      const r = A.ruasDoLote(lote, TOR.vias);
      const fr = r.filter(x => x.rua);
      expect(fr.length).toBe(1);
      expect(fr[0].rua.nome).toBe('Rua Saldanha da Gama'); expect(fr[0].rua.classe).toBe('residential');
      expect(fr[0].rua.cobertura).toBeGreaterThan(0.9); expect(fr[0].rua.estimada).toBe(true);
      expect(fr[0].rua.dist).toBeGreaterThan(0.5); expect(fr[0].rua.dist).toBeLessThan(6);
      expect(A.sugereFrentes(lote, r)).toMatchObject({ tipo: 'uma', esquina: false });
    });
  });
  it('lote de esquina: Avenida Beira-Mar × Rua Leonardo Truda', () => {
    const P = [56.9, 89.6];
    // do cruzamento: Beira-Mar para nordeste e para sudoeste; Leonardo Truda para oeste
    const bm = d => ({ d, w: 8.4 }), lt = { d: [-188, 85], w: 11.6 };
    [[bm([128, 179])], [bm([-46, -63])]].forEach(([b]) => {
      const lote = loteEsquina(P, b, lt, 22, 28);
      const r = A.ruasDoLote(lote, TOR.vias), s = A.sugereFrentes(lote, r);
      const ns = nomes(r).map(x => x.split(':')[1]);
      expect(ns).toContain('Avenida Beira-Mar'); expect(ns).toContain('Rua Leonardo Truda');
      expect(s.esquina).toBe(true); expect(s.tipo).toBe('esquina'); expect(s.front.length).toBe(2);
      const pr = r.find(x => x.i === s.principal).rua;
      expect(pr.nome).toBe('Avenida Beira-Mar');                  // tertiary > residential
      const a = A.sugereAcesso(lote, r, s);
      expect(a.nome).toBe('Rua Leonardo Truda'); expect(a.igualPrincipal).toBe(false);
      expect([0.2, 0.8]).toContain(a.pos);
    });
  });
  it('lote no meio da quadra, longe de qualquer via: sem frente', () => {
    // procura um ponto a mais de 40 m de todas as vias, dentro do raio
    let ach = null;
    for (let x = -200; x <= 200 && !ach; x += 10) for (let y = -200; y <= 200 && !ach; y += 10) {
      if (Math.hypot(x, y) > 250) continue;
      const ok = TOR.vias.every(v => v.p.every((q, i) => { const b = v.p[i + 1]; if (!b) return Math.hypot(q[0] - x, q[1] - y) > 40; for (let k = 0; k <= 1; k += 0.1) if (Math.hypot(q[0] + (b[0] - q[0]) * k - x, q[1] + (b[1] - q[1]) * k - y) <= 40) return false; return true }));
      if (ok) ach = [x, y];
    }
    expect(ach).not.toBeNull();
    const lote = [[ach[0] - 10, ach[1] - 15], [ach[0] + 10, ach[1] - 15], [ach[0] + 10, ach[1] + 15], [ach[0] - 10, ach[1] + 15]];
    const r = A.ruasDoLote(lote, TOR.vias);
    expect(r.every(x => !x.rua)).toBe(true);
    expect(A.sugereFrentes(lote, r).tipo).toBe('nenhuma');
  });
  it('Avenida Silva Jardim (tertiary 5,5 m): trecho reto de 90 m', () => {
    const s = seg('Avenida Silva Jardim', 2);
    const lote = loteAoLado(s, 1, 15, 25, 0.5, 2.5);
    const q = A.ruasDoLote(lote, TOR.vias).filter(x => x.rua);
    expect(q.length).toBe(1); expect(q[0].rua.nome).toBe('Avenida Silva Jardim'); expect(q[0].rua.hier).toBeGreaterThan(2);
  });
});

describe('frenteDetectar e frenteAplicar', () => {
  const montar = (lote, vias, extra = {}) => { const st = estado(A, { lote: { pts: lote, front: [2], principal: 2, rec: lote.map(() => ({})), acessoVei: 0.85 }, ...extra }); st.contexto.dados = { vias, lat: 1, lon: 1 }; return st };
  const sul = via([[-40, -6], [60, -6]], 11, 'primary', 'Avenida Grande', true), oeste = via([[-6, -40], [-6, 70]], 7, 'residential', 'Rua Pequena');
  it('detecta, guarda a proposta e só vale para o contorno em que foi feita', () => {
    const st = montar(RET, [sul, oeste]);
    const p = A.frenteDetectar(st, { quando: '2026-10-08' });
    expect(p.front).toEqual([0, 3]); expect(p.principal).toBe(0); expect(p.tipo).toBe('esquina');
    expect(p.lados.map(l => [l.i, l.nome, l.larg, l.est])).toEqual([[0, 'Avenida Grande', 11, false], [3, 'Rua Pequena', 7, true]]);
    expect(p.acesso.nome).toBe('Rua Pequena');
    st.frentes.sug = p;
    expect(A.frenteValida(st)).toBe(true);
    st.lote.pts[1] = [24, 0];
    expect(A.frenteValida(st)).toBe(false);
  });
  it('sem contexto: proposta vazia sinaliza semVia', () => {
    const st = estado(A); const p = A.frenteDetectar(st);
    expect(p.semVia).toBe(true); expect(p.front).toEqual([]);
  });
  it('aplicar muda frentes, principal e a posição do acesso; nada além disso (regra desligada)', () => {
    const st = montar(RET, [sul, oeste]), antes = JSON.parse(JSON.stringify(st.lote));
    const p = A.frenteDetectar(st); const r = A.frenteAplicar(st, p);
    expect(st.lote.front).toEqual([0, 3]); expect(st.lote.principal).toBe(0);
    expect(st.lote.acessoVei).toBe(0.8);                      // aresta 0 vai de oeste a leste, a esquina (oeste) é no começo → afasta
    expect(st.lote.rec).toEqual(antes.rec); expect(st.lote.pts).toEqual(antes.pts);
    expect(r.antes.front).toEqual([2]); expect(r.recs).toEqual([]);
  });
  it('principal escolhido pelo usuário (ex.: a rua do acesso) é respeitado se for frente', () => {
    const st = montar(RET, [sul, oeste]); A.frenteAplicar(st, A.frenteDetectar(st), { principal: 3 });
    expect(st.lote.principal).toBe(3);
  });
  it('regra por largura ligada: recuo próprio nas frentes pela largura (editável)', () => {
    const st = montar(RET, [sul, oeste]); st.frentes.regra.on = true;
    const p = A.frenteDetectar(st); p.lados.find(l => l.i === 3).larg = 13;      // o usuário corrige a largura
    const r = A.frenteAplicar(st, p);
    expect(st.lote.rec[0]).toMatchObject({ e: 5, t: 5 });    // 11 m → até 12 m → 5
    expect(st.lote.rec[3]).toMatchObject({ e: 6, t: 6 });    // 13 m → acima de 12 → 6
    expect(st.lote.rec[1]).toEqual({}); expect(r.recs.length).toBe(2);
  });
  it('o cálculo usa a nova frente: recuo frontal só nas frentes marcadas', () => {
    const st = montar(RET, [sul, oeste], { regras: { recFrente: 6, recEmb: 0 } });
    const m0 = A.compute(st);
    A.frenteAplicar(st, A.frenteDetectar(st));
    const m1 = A.compute(st);
    const minX = m => Math.min(...m.emb.map(q => q[0])), minY = m => Math.min(...m.emb.map(q => q[1]));
    expect(minY(m1)).toBeGreaterThan(minY(m0) - 1e-6 + 1);   // frente sul agora recua 6 m
    expect(minX(m1)).toBeGreaterThan(minX(m0) + 1);          // e a frente oeste também
    expect(m1.acesso.edge).toBe(0);
  });
});

describe('georreferência do lote (S.lote.geo)', () => {
  it('estudo novo não está posicionado', () => {
    expect(estado(A).lote.geo).toBe(false);
  });
  it('estudo antigo (sem o campo): posicionado só se já tinha coordenadas, contexto ou prédios do OSM', () => {
    const mig = o => A.merge(A.clone(A.DEF), A.clone(o)).lote.geo;
    expect(mig({ lote: { lat: -28.68, lon: -49.37 } })).toBe(false);                 // origem padrão (Criciúma)
    expect(mig({ nome: 'x' })).toBe(false);
    expect(mig({ lote: { lat: -29.335, lon: -49.727 } })).toBe(true);                // coordenadas próprias
    expect(mig({ contexto: { dados: { vias: [] } } })).toBe(true);                   // já havia busca do OSM
    expect(mig({ entorno: [{ pts: [[0, 0], [1, 0], [1, 1]], h: 6, osm: '1' }] })).toBe(true);
    expect(mig({ entorno: [{ pts: [[0, 0], [1, 0], [1, 1]], h: 6 }] })).toBe(false); // desenhado à mão não conta
  });
  it('quando o campo existe, vale o que está gravado', () => {
    const mig = o => A.merge(A.clone(A.DEF), A.clone(o)).lote.geo;
    expect(mig({ lote: { geo: true, lat: -28.68, lon: -49.37 } })).toBe(true);
    expect(mig({ lote: { geo: false, lat: -29.335, lon: -49.727 } })).toBe(false);
  });
});
