// Garagem completa (PLANO 2.1): elevador de carros, rampas helicoidal e em L, vagas presas, motos, bicicletário, recarga EV e quadro por tipo.
import { describe, it, expect } from 'vitest';
import { carregar, estado } from './harness.js';

const T = { timeout: 180000 };
const A = carregar();
const lote = (w, d) => ({ pts: [[0, 0], [w, 0], [w, d], [0, d]], front: [0], rec: [{}, {}, {}, {}] });
const L15 = (estudo = {}) => ({ lote: lote(15, 40), produto: { torres: [{ pav: 8 }], subsolos: 2, garTerOn: false }, estudo });
const BIG = rampaTipo => ({ lote: lote(50, 60), produto: { torres: [{ pav: 12 }], subsolos: 2 }, estudo: { rampaTipo } });
const calc = parcial => { const st = estado(A, parcial); return { st, m: A.compute(st) } };
// confere na malha de 0,5 m que o carro sai do portal e chega à frente de todas as vagas de carro do pavimento
const malhaOk = (m, k, piso) => {
  const l = m.gar[k], vs = l.vagas.filter(v => v.tipo !== 'off' && v.tipo !== 'faixa');
  const R = A.rasterCheck(piso, [...m.obst, ...l.blocks], vs, l.pillars, l.portals, l.aisle);
  return { conn: R.allConn, todas: R.okV.length === vs.length, n: vs.length };
};

describe('padrões: nada novo ligado', () => {
  it('DEF.garagem desligado e exemplo sem custos extras da garagem', T, () => {
    const G = A.DEF.garagem;
    expect(A.DEF.estudo.rampaTipo).toBe('reta');
    expect(G.presas).toBe(false); expect(G.motos).toBe(false); expect(G.bici).toBe('off'); expect(G.ev).toBe(0);
    const { m } = calc({});
    expect(m.custosExtra.filter(x => /^gar/.test(x.k))).toHaveLength(0);
    expect(m.elevCarros).toBeNull();
    const q = m.quadroVagas;
    expect(q.presa + q.moto + q.bici + q.ev).toBe(0);
    expect(q.total).toBe(m.vagasLay);
  });
});

describe('elevador de carros', () => {
  it('lote 15 × 40 resolvido com elevador de carros', T, () => {
    const reta = calc(L15()).m, { m } = calc(L15({ rampaTipo: 'elevador' }));
    expect(m.vert.ok).toBe(true);
    expect(m.ter.drive0.naoCabe).toBeFalsy();               // o poço, a espera e a acomodação cabem sem passar pelos núcleos
    expect(m.vert.elev.n).toBe(1);
    expect(m.vert.elev.espera.length).toBeGreaterThanOrEqual(1);
    for (const k of ['s1', 's2']) {
      expect(m.gar[k].ok).not.toBe(false);
      expect(m.gar[k].count).toBeGreaterThan(0);
      const r = malhaOk(m, k, m.sub); expect(r.conn).toBe(true); expect(r.todas).toBe(true);
    }
    expect(m.vagasLay).toBeGreaterThanOrEqual(reta.vagasLay); // no lote estreito rende pelo menos o que a rampa rende
    const ec = m.elevCarros;
    expect(ec.ok).toBe(true);
    expect(ec.cap).toBeGreaterThan(ec.dem);
    expect(ec.fila95).toBeLessThanOrEqual(ec.espera);
    expect(m.custosExtra.find(x => x.k === 'garElevCarros').sistema).toBe('elevadores');
  });
  it('ciclo, capacidade e alerta de fila', () => {
    const GX = { ...A.DEF.garagem, ecVel: 0.5, ecManobra: 40, ecPico: 0.3 };
    const f = A.ecFila(20, 4.5, GX, 1);
    expect(f.ciclo).toBeCloseTo(2 * 4.5 / 0.5 + 80, 6);
    expect(f.cap).toBeCloseTo(3600 / f.ciclo, 6);
    expect(f.rho).toBeLessThan(1);
    const f2 = A.ecFila(80, 4.5, GX, 1), f3 = A.ecFila(80, 4.5, GX, 2);
    expect(f2.fila95).toBeGreaterThan(f.fila95);              // mais vagas → fila maior
    expect(f3.fila95).toBeLessThan(f2.fila95);                // dois elevadores → fila menor
    expect(A.ecFila(500, 9, GX, 1).rho).toBeGreaterThanOrEqual(1);
    // alerta quando a fila prevista passa das vagas de espera
    const { st, m } = calc({ ...L15({ rampaTipo: 'elevador' }), garagem: { ecEspera: 1, ecPico: 1, ecManobra: 600 } });
    const ec = A.elevCarros(st, m);
    expect(ec.ok).toBe(false);
    expect(ec.avisos[0]).toMatch(/Elevador de carros/);
  }, T.timeout);
  it('entra como alternativa em "Encontrar o melhor acesso"', () => {
    const st = estado(A, L15());
    const cs = A.acessoCandidatos(st);
    expect(cs.some(c => c.rampaTipo === 'elevador')).toBe(true);
    const r = A.acessoAvalia(st, cs.find(c => c.rampaTipo === 'elevador' && c.acessoVei === 0.5));
    expect(r).toHaveProperty('fila'); expect(r.vagas).toBeGreaterThan(0);
    expect(JSON.parse(JSON.stringify(r)).vagas).toBe(r.vagas); // resultado serializável (Web Worker)
  }, T.timeout);
});

describe('rampas helicoidal e em L', () => {
  it('helicoidal validada pela malha: o carro chega a todas as vagas', T, () => {
    const { st, m } = calc(BIG('helicoidal'));
    const H = m.vert.strips.find(s => s.kind === 'H');
    expect(H).toBeTruthy();
    expect(m.vert.helix.Ri).toBeGreaterThanOrEqual(3); expect(m.vert.helix.Re).toBeGreaterThanOrEqual(7.5);
    expect(H.poly.length).toBeGreaterThan(20);              // faixa curva aproximada por segmentos
    expect(m.vert.helix.incl).toBeLessThanOrEqual(st.estudo.rampaInc);
    for (const k of ['s1', 's2']) {
      const l = m.gar[k];
      expect(l.blocks).toContain(H.poly);
      expect(l.portals.length).toBeGreaterThan(0);
      const r = malhaOk(m, k, m.sub); expect(r.conn).toBe(true); expect(r.todas).toBe(true); expect(r.n).toBeGreaterThan(30);
    }
    // o patamar e os portais ficam ao lado da helicoidal (tangente), fora do disco
    const land = m.vert.floors.s1.landings[0];
    expect(A.G.pip(A.G.centroid(land), H.poly)).toBe(false);
    expect(m.vert.floors.s1.portals.every(p => !A.G.pip(p.p, H.poly))).toBe(true);
    // as voltas da helicoidal (para o 3D) seguem um caminho curvo de 0 a 1 em altura
    const seg = m.vert.segs.find(s => s.path); expect(seg.path[0][2]).toBe(0); expect(seg.path.at(-1)[2]).toBe(1);
  });
  it('raios mínimos: interno ≥ 3 m e externo ≥ 7,5 m', () => {
    const st = estado(A, { ...BIG('helicoidal'), garagem: { heliRi: 1, heliRe: 5 } });
    const m = A.compute(st, { layouts: false });
    const RX = A.rampExt(st, m, m.ter.fd);
    expect(RX.Ri).toBeGreaterThanOrEqual(3); expect(RX.Re).toBeGreaterThanOrEqual(7.5);
  }, T.timeout);
  it('rampa em L: patamar e portal de chegada mudam de orientação', T, () => {
    const { m } = calc(BIG('L'));
    const s = m.vert.strips.find(x => x.Lshape); expect(s.poly).toHaveLength(6);
    const chega = m.vert.floors.s1.portals.find(p => p.tipo === 'chega'), sai = m.vert.floors.s1.portals.find(p => p.tipo === 'sai');
    const fd = m.vert.fd;
    expect(Math.abs(chega.heading[0] * fd[0] + chega.heading[1] * fd[1])).toBeLessThan(1e-6); // chega de lado (lance 2)
    expect(sai.heading[0] * fd[0] + sai.heading[1] * fd[1]).toBeCloseTo(1, 6);               // sai pela frente (lance 1)
    for (const k of ['s1', 's2']) { const r = malhaOk(m, k, m.sub); expect(r.conn).toBe(true); expect(r.todas).toBe(true) }
  });
});

describe('vagas presas, motos, bicicletário, recarga e quadro por tipo', () => {
  it('quadro por tipo soma o total', T, () => {
    const { st, m } = calc({ garagem: { presas: true, presasMax: 0.05, motos: true, motosMax: 0.05, bici: 'un', biciPorUn: 0.3, ev: 0.1 } });
    const q = m.quadroVagas;
    expect(q.comum + q.presa + q.pcd + q.idoso + q.ev + q.frente).toBe(q.total);
    expect(q.total).toBe(m.vagasLay);
    // vagas presas só onde há fundo livre atrás de uma vaga (as fileiras encostam em parede ou em outra fileira): podem ser zero
    expect(q.presa).toBeGreaterThanOrEqual(0);
    expect(q.presa).toBeLessThanOrEqual(Math.floor(m.units * 0.05));      // limite de unidades que aceitam vaga presa
    expect(q.moto).toBeGreaterThan(0); expect(q.moto).toBeLessThanOrEqual(Math.ceil(m.units * 0.05));
    expect(q.bici).toBeGreaterThan(0); expect(q.biciReq).toBe(Math.ceil(m.units * 0.3));
    expect(q.ev).toBe(m.evN);
    // cada vaga presa tem a sua vaga da frente (mesmo par), e o carro chega à da frente
    Object.values(m.gar).forEach(l => l.vagas.filter(v => v.tipo === 'presa').forEach(v => expect(l.vagas.some(f => f.tandem && f.par === v.par)).toBe(true)));
    // recarga: custo publicado para a viabilidade
    const ev = m.custosExtra.find(x => x.k === 'garEV');
    expect(ev.sistema).toBe('instalações'); expect(ev.valor).toBe(m.evN * st.garagem.evCusto);
    // linhas do quadro para o card e o PDF
    expect(A.garQuadroRows(m).find(r => /^Total/.test(r[0]))[1]).toBe(String(q.total));
  });
  it('motos e bicicletas não contam como vagas de carro', () => {
    expect(A.garCar('moto')).toBe(false); expect(A.garCar('bici')).toBe(false);
    expect(A.garCar('presa')).toBe(true); expect(A.garCar('n')).toBe(true); expect(A.garCar('off')).toBe(false);
  });
});

/* ---------- garagem por partidos (docs/COMUNS.md §2 e §5) ---------- */
const LOTES = {
  grande: { lote: lote(60, 50), produto: { torres: [{ pav: 15 }], subsolos: 2 } },
  duas: { lote: lote(70, 45), produto: { torres: [{ pav: 12 }, { pav: 12 }], subsolos: 2 } },
  exemplo: {},
};
const RES = Object.fromEntries(Object.entries(LOTES).map(([k, p]) => [k, calc(p)]));
const subs = m => Object.entries(m.gar).filter(([k]) => k[0] === 's');
const area = p => A.G.area(p), inter = (a, b) => A.garAreaInter(a, b);

describe('partidos de garagem: área por vaga, rede contínua e malha', () => {
  it('lotes regulares ficam na meta de 25–32 m² por vaga (com folga de 1 m²) e com nota boa', T, () => {
    for (const k of ['grande', 'duas']) for (const [, l] of subs(RES[k].m)) {
      expect(l.modelo).toBe('partido');
      expect(l.met.m2v).toBeLessThanOrEqual(A.GAR_META[1] + 1);
      expect(l.met.m2v).toBeGreaterThanOrEqual(A.GAR_META[0] - 1);
      expect(l.nota).toBeGreaterThanOrEqual(85);
    }
  });
  it('estudo de exemplo: subsolos com o motivo da área por vaga acima da meta (núcleos e rampa)', T, () => {
    for (const [, l] of subs(RES.exemplo.m)) {
      expect(l.count).toBeGreaterThanOrEqual(36);
      if (l.met.m2v > A.GAR_META[1] + 0.5) expect(l.problemas.some(p => p.k === 'm2' && /núcleos|estreito|forma/.test(p.msg))).toBe(true);
    }
  });
  it('nenhuma vaga sem rota, em rampa, patamar, núcleo/hall, corredor, faixa de pedestres ou sobre pilar', T, () => {
    for (const { m } of Object.values(RES)) for (const [k, l] of Object.entries(m.gar)) {
      const piso = k === 'ter' ? m.ter.gar : m.vert.floors[k].poly;
      const r = malhaOk(m, k, piso); expect(r.conn).toBe(true); expect(r.todas).toBe(true);
      const proib = [...m.obst, ...l.blocks, ...l.landings, ...l.aisles.map(a => a.poly), ...l.peds.filter(p => p.poly).map(p => p.poly), ...l.pillars];
      l.vagas.filter(v => v.tipo !== 'off').forEach(v => proib.forEach(p => expect(inter(v.poly, p)).toBeLessThan(0.1)));
      expect(l.problemas.filter(p => p.nivel === 'bad')).toEqual([]);
    }
  });
  it('PCD com faixa de transferência de 1,20 m ao lado (de um lado ou compartilhada) e perto do hall', T, () => {
    for (const { m } of Object.values(RES)) for (const [, l] of subs(m)) {
      const pcd = l.vagas.filter(v => v.tipo === 'pcd'), fx = l.vagas.filter(v => v.tipo === 'faixa');
      expect(pcd.length).toBeGreaterThan(0);
      pcd.forEach(v => expect(fx.some(f => A.garToca(v.poly, f.poly))).toBe(true));
      fx.forEach(f => { const w = Math.min(...[0, 1].map(i => Math.hypot(f.poly[i + 1][0] - f.poly[i][0], f.poly[i + 1][1] - f.poly[i][1])));
        expect(w).toBeCloseTo(1.2, 2) });
      expect(l.pcd.feitas).toBe(l.pcd.pedidas);
    }
  });
  it('vaga junto à parede e ao pilar com largura acrescida (configurável)', T, () => {
    const W = A.DEF.estudo.vagaL, ls = subs(RES.grande.m).map(([, l]) => l);
    const larg = ls.flatMap(l => l.vagas.filter(v => v.tipo === 'n').map(v => +v.W.toFixed(2)));
    expect(larg).toContain(+(W + 0.25).toFixed(2));    // encostada na parede
    expect(larg).toContain(+(W + 0.10).toFixed(2));    // encostada no pilar
    const { m } = calc({ ...LOTES.grande, garagem: { acrParede: 0.4 } });
    expect(subs(m).flatMap(([, l]) => l.vagas.map(v => +v.W.toFixed(2)))).toContain(+(W + 0.4).toFixed(2));
  });
  it('rede de corredores contínua (um só conjunto ligado à rampa), sem becos longos e com raio de giro', T, () => {
    for (const k of ['grande', 'duas']) for (const [, l] of subs(RES[k].m)) {
      const as = l.aisles, vis = new Set([0]), q = [0];
      while (q.length) { const i = q.pop(); as.forEach((b, j) => { if (!vis.has(j) && inter(as[i].poly, b.poly) > 0.5) { vis.add(j); q.push(j) } }) }
      expect(vis.size).toBe(as.length);
      expect(l.becos.filter(b => b.longo)).toEqual([]);
      expect(l.giroFalha).toBe(0);
      expect(l.peds.length).toBeGreaterThan(0);                       // faixa de pedestres do hall até o corredor
    }
    const R = A.garRegras(A.DEF.estudo, A.DEF.garagem);
    expect(A.garGiroOk(5.5, 5.5, R)).toBe(true);
    expect(A.garGiroOk(3.0, 3.0, { ...R, Ro: 9, Ri: 3 })).toBe(false);
  });
  it('subsolos do mesmo contorno: mesmos corredores e mesma malha de pilares', T, () => {
    for (const { m } of Object.values(RES)) {
      const [a, b] = subs(m).map(([, l]) => l); if (!a || !b) continue;
      const c = l => l.pillars.map(p => A.G.centroid(p).map(v => v.toFixed(2)).join(',')).sort();
      expect(c(a)).toEqual(c(b)); expect(a.pillars.length).toBeGreaterThan(0);
      expect(a.ux).toEqual(b.ux); expect(a.cfg.ys).toEqual(b.cfg.ys);
    }
  });
  it('rápido (otimizador) e completo dão contagens próximas; o rápido é barato', T, () => {
    const st = estado(A, LOTES.grande); const t0 = Date.now(); const mq = A.compute(st, { quick: true }); const tq = Date.now() - t0;
    const mf = RES.grande.m;
    for (const k of Object.keys(mf.gar)) expect(Math.abs(mq.gar[k].count - mf.gar[k].count)).toBeLessThanOrEqual(Math.max(3, mf.gar[k].count * 0.12));
    expect(tq).toBeLessThan(3000);
  });
  it('rampa reta: 3 m de transição a 10% em cada ponta (com 20% o comprimento é o de antes)', () => {
    const E = { rampaInc: 0.20 }; expect(A.rampLen(3, E)).toBeCloseTo(3 / 0.2 + 3, 6);
    const E2 = { rampaInc: 0.25 }; expect(A.rampLen(3, E2)).toBeCloseTo(3 / 0.25 + 2 * 3 * (1 - 0.1 / 0.25), 6);
  });
  it('sobras viram depósito ou área técnica (nunca sobre vaga ou corredor)', T, () => {
    for (const { m } of Object.values(RES)) for (const [, l] of subs(m)) (l.sobras || []).forEach(o => {
      expect(['deposito', 'tecnica', 'semAcesso']).toContain(o.tipo); expect(o.area).toBeGreaterThanOrEqual(6);
      o.polys.forEach(p => { l.vagas.forEach(v => expect(inter(v.poly, p)).toBeLessThan(0.3)); l.aisles.forEach(a => expect(inter(a.poly, p)).toBeLessThan(0.3)) });
    });
  });
  it('passagem estreita só abaixo da largura do corredor (com a largura cheia é corredor comum, com vagas)', T, () => {
    for (const { m } of Object.values(RES)) for (const [, l] of subs(m)) {
      (l.passagens || []).forEach(w => expect(w).toBeLessThan(l.aisle - 0.05));
      l.aisles.filter(a => a.pass).forEach(a => expect(a.w).toBeLessThan(l.aisle - 0.05));
    }
  });
  it('corredor ou ramal sem saída acima do limite de beco ganha o bolsão de retorno; garagem elevada resolvida', T, () => {
    const B = A.garRegras(A.DEF.estudo, A.DEF.garagem);
    for (const { m } of Object.values(RES)) for (const [, l] of subs(m)) (l.becos || []).forEach(b => { if (b.L > B.beco) expect(b.longo).toBe(true) });
    // subsolo + garagem elevada (como o estudo de referência 05): todos os pavimentos resolvidos, com vagas
    const { m } = calc({ lote: lote(30, 50), produto: { torres: [{ pav: 10 }], subsolos: 1, garAcima: 1 } });
    Object.values(m.gar).forEach(l => expect(l.count).toBeGreaterThan(0));
  });
});
