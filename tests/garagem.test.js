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
    // rende ao menos o mesmo que a rampa no lote estreito (núcleo compacto + depósito atrás dele: o arranjo das fileiras muda ±1 vaga)
    expect(m.vagasLay).toBeGreaterThanOrEqual(reta.vagasLay - 1);
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
    const { st, m } = calc({ ...L15({ rampaTipo: 'elevador' }), garagem: { ecEspera: 1, ecPico: 0.9, ecManobra: 120 } });
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
    expect(q.presa).toBeGreaterThanOrEqual(0);                            // presas só nas sobras (o núcleo compacto deixa menos sobras)
    expect(q.presa).toBeLessThanOrEqual(Math.floor(m.units * 0.05));      // limite de unidades que aceitam vaga presa
    expect(q.moto).toBeGreaterThan(0); expect(q.moto).toBeLessThanOrEqual(Math.ceil(m.units * 0.05));
    // bicicletário só nas sobras (o núcleo compacto deixa a garagem mais aproveitada): o que não cabe vira aviso
    expect(q.bici).toBe(m.biciLay.ok); expect(q.biciReq).toBe(Math.ceil(m.units * 0.3));
    if (q.bici < q.biciReq) expect(m.avisos.some(a => /^Bicicletário:/.test(a))).toBe(true);
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
