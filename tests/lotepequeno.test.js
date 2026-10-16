// Lote pequeno de esquina (25 × 30 m, caso real de um usuário, sem dados pessoais): rampas nunca passam pelo núcleo,
// a garagem diz por que não cabe, o subsolo aproveita a faixa atrás do núcleo e o otimizador acha combinações com uma
// circulação que funciona (src/garagem.js verticalCruza/driveLayout, src/optim.js otimGarValida).
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { carregar, estado } from './harness.js';

const A = carregar(), G = A.G, T = 600000;
const FIX = JSON.parse(fs.readFileSync(new URL('./fixtures/lote-25x30-esquina.json', import.meta.url), 'utf8'));
const lote = (w, d, front = [0]) => ({ pts: [[0, 0], [w, 0], [w, d], [0, d]], front, rec: [{}, {}, {}, {}] });
const comMod = (base, mod) => { const p = JSON.parse(JSON.stringify(base)); for (const [k, v] of Object.entries(mod)) { const ks = k.split('.'); let o = p; ks.slice(0, -1).forEach(x => { o[x] = o[x] || {}; o = o[x] }); o[ks.at(-1)] = v } return p };
const CASOS = {
  real: FIX,
  estreito: { lote: lote(18, 50), produto: { torres: [{ pav: 10 }], subsolos: 2 } },
  pequeno: { lote: lote(22, 30), produto: { torres: [{ pav: 10 }], subsolos: 1 } },          // núcleo no meio do lote
  esquina: { lote: lote(35, 40, [0, 3]), produto: { torres: [{ pav: 12 }], subsolos: 2 } },
};
// área de rampas, patamares, espera do elevador de carros e faixa de acesso do térreo sobre núcleo, hall dos elevadores e depósito
const ob = m => (m.obst || []).filter(p => p && p.length > 2);
const inter = (p, m) => ob(m).reduce((s, o) => s + A.garAreaInter(p, o), 0);
const cruza = m => {
  const V = m.vert || {}; let r = 0, f = 0;
  (V.strips || []).forEach(s => r += inter(s.poly, m));
  Object.values(V.floors || {}).forEach(fl => (fl.landings || []).forEach(p => r += inter(p, m)));
  if (V.elev) (V.elev.espera || []).forEach(p => r += inter(p, m));
  ((m.ter || {}).drive || []).forEach(p => f += inter(p, m));
  return { r, f };
};
const okDe = m => m.vert.ok && Object.values(m.gar || {}).every(l => !l || l.ok !== false);
const calc = (parcial, opt) => { const st = estado(A, parcial); return { st, m: A.compute(st, opt) } };

describe('regra dura: nenhuma rampa passa pelo núcleo', () => {
  it('todo candidato do "Encontrar o melhor acesso" que sai ok não cruza núcleo, hall nem depósito; o que cruza fica marcado', T, () => {
    for (const [nome, parcial] of Object.entries(CASOS)) {
      const st = estado(A, parcial);
      // no caso real todos os candidatos; nos outros, as pontas e o meio de cada lado (o resto repete a mesma lógica)
      const cs = A.acessoCandidatos(st).filter(c => nome === 'real' || c.atual || [0.1, 0.4, 0.9, 0.5].includes(c.acessoVei));
      let nOk = 0;
      for (const c of cs) {
        const s = A.clone(st); s.lote.acessoVei = c.acessoVei; s.estudo.rampaTipo = c.rampaTipo; s.estudo.rampa = null; if (c.ladoVei !== undefined) s.lote.ladoVei = c.ladoVei;
        const m = A.compute(s, { quick: true }), z = cruza(m), ok = okDe(m);
        if (ok) { nOk++; expect(z.r, `${nome} ${c.rampaTipo} ${c.acessoVei} lado ${c.lado}: rampa × núcleo`).toBeLessThan(0.1); expect(z.f, `${nome} ${c.rampaTipo} ${c.acessoVei}: faixa × núcleo`).toBeLessThan(0.1); expect(m.ter.driveCruza).toBeFalsy() }
        // desenho: rampa que cruza nunca aparece "por cima" sem a marca (o desenho a mostra só tracejada)
        m.vert.strips.forEach(sp => { if (inter(sp.poly, m) > 0.1) { expect(sp.cruza).toBe(true); expect(m.vert.ok).toBe(false) } });
        // o pátio de entrada, a faixa até a garagem do térreo e a faixa da helicoidal (o que o carro usa) passando pelo núcleo invalidam
        if (m.ter.driveCruza) expect(m.vert.ok).toBe(false);
      }
      expect(nOk, `${nome}: ao menos uma circulação válida`).toBeGreaterThan(0);
    }
  });
  it('caso real: rampa reta para a garagem elevada não cabe — diz quanto pede e quanto tem, sem desenhar a rampa sobre o núcleo', T, () => {
    const { m } = calc(FIX);
    expect(m.vert.ok).toBe(false);
    expect(m.vert.warn.some(w => /sobe às garagens elevadas precisa de 25,5 m/.test(w) && /elevador de carros/.test(w))).toBe(true);
    const z = cruza(m); expect(z.r).toBeLessThan(0.1); expect(z.f).toBeLessThan(0.1);
  });
  it('helicoidal que só caberia sobre o núcleo: inválida, com o motivo, marcada para o desenho e fora do 3D', T, () => {
    const { m } = calc(comMod(FIX, { 'estudo.rampaTipo': 'helicoidal' }), { quick: true });
    expect(m.vert.ok).toBe(false);
    expect(m.vert.warn[0]).toMatch(/helicoidal não cabe sem passar pelo núcleo/);
    expect(m.vert.strips.filter(s => s.kind === 'H').every(s => s.cruza)).toBe(true);
    expect(m.vert.segs.every(sg => sg.cruza)).toBe(true);
    expect(A.cicloGarOk(m)).toBe(false);
    expect(A.acessoAvalia(A.merge(A.clone(A.DEF), A.clone(FIX)), { acessoVei: 0.75, rampaTipo: 'helicoidal' }).ok).toBe(false);
  });
});

describe('subsolo do lote pequeno', () => {
  it('a faixa atrás do núcleo (depósito no térreo) é piso nos subsolos e nas elevadas; no térreo continua obstáculo', T, () => {
    const { m } = calc(comMod(FIX, { 'estudo.rampaTipo': 'elevador', 'lote.acessoVei': 0.5 }));
    const fundo = m.coreSets.flatMap(c => c.lay.coreFundo || []);
    expect(fundo.length).toBeGreaterThan(0);
    fundo.forEach(p => { expect(m.obst).toContain(p); expect(m.obstGar).not.toContain(p) });
    expect(okDe(m)).toBe(true);
    // elevador de carros no meio da frente: o subsolo e a garagem elevada rendem o que o lote comporta
    expect(m.gar.s1.count).toBeGreaterThanOrEqual(8);
    expect(m.gar.g1.count).toBeGreaterThanOrEqual(6);
    // vagas nunca sobre núcleo/hall (obstáculos da garagem), rampa ou patamar
    for (const [k, l] of Object.entries(m.gar)) {
      const proib = [...(k === 'ter' ? m.obst : m.obstGar), ...l.blocks, ...l.landings];
      l.vagas.filter(v => v.tipo !== 'off').forEach(v => proib.forEach(p => expect(A.garAreaInter(v.poly, p)).toBeLessThan(0.1)));
    }
  });
  it('rampa reta com um subsolo só: a rampa encosta fora do núcleo e o subsolo funciona', T, () => {
    const { m } = calc(comMod(FIX, { 'produto.garAcima': 0, 'lote.acessoVei': 0.1 }));
    expect(okDe(m)).toBe(true);
    expect(cruza(m).r).toBeLessThan(0.1);
    expect(m.gar.s1.count).toBeGreaterThanOrEqual(5);
  });
});

describe('otimizador no lote pequeno', () => {
  it('calibração não usa layout com circulação inválida', T, () => {
    const st = estado(A, FIX), m = A.compute(st, { quick: true });
    expect(m.vert.ok).toBe(false);
    expect(A.otimVagasCal(st, m)).toBe(null);
  });
  it('acha combinações com uma circulação que funciona (troca a rampa reta) e todas fecham as vagas', T, async () => {
    const st = estado(A, FIX), m = A.compute(st, { quick: true });
    const o = await A.otimizar({ ...A.clone(FIX.otim), mc: false }, null, null, { st, m });
    expect(o.semOpcao).toBeUndefined();
    expect(o.res.length).toBeGreaterThan(0);
    expect(o.garTroca && o.garTroca.de.rampaTipo).toBe('reta');
    // conferidas com o cálculo rápido; a 1ª, refeita com o completo, marca as vagas que faltarem (vagasFalta)
    for (const r of o.res) if (!r.vagasFalta) expect(r.vagas).toBeGreaterThanOrEqual(r.req);
    // a melhor, aplicada, tem circulação válida
    const s = A.clone(st); A.aplicarOtim(o.res[0], s); const m2 = A.compute(s, { quick: true });
    expect(m2.vert.ok).toBe(true);
    expect(cruza(m2).r).toBeLessThan(0.1);
  });
});
