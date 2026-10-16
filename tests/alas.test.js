// Fase C3 — pavimento tipo por alas (L, U, T, H, pátio), recuo que preserva o núcleo e pátio no IFC.
import { describe, it, expect } from 'vitest';
import { carregar, estado } from './harness.js';

const A = carregar();
const MIX = [{ nome: 'A', area: 70, qtd: 6, preco: 10000, sac: 8 }, { nome: 'B', area: 45, qtd: 6, preco: 10000, sac: 5 }];
const base = () => estado(A, {
  lote: { pts: [[0, 0], [70, 0], [70, 90], [0, 90]], front: [0], principal: 0, rec: [{}, {}, {}, {}] },
  regras: { recFrente: 4, afMin: 3, afDiv: 8, toTorre: 1, toEmb: 1, hMax: 80, caMax: 20 },
  produto: { torres: [{ pav: 10 }], subsolos: 0, garAcima: 0, peTerreo: 4.5, pe: 3, efic: 0.8, atico: false, garTerOn: false,
    cob: { on: false, qtd: 1, area: 100, preco: 1 }, mix: MIX.map(u => ({ ...u })), lazer: { hall: 0, itens: [] } },
});
const SLOT = [[8, 8], [62, 8], [62, 82], [8, 82]];
const comBloco = (b) => { const st = base(); st.blocos = { modo: 'desenhada', torres: [{ blocos: [b] }] }; return st };
const forma = (tipo, alvo = 1300, rot = 0) => comBloco(A.blcFormato(tipo, SLOT, alvo, { rot, ala: 12.6 }).bloco);
const calc = st => A.compute(st, { layouts: false });
const NOMES = { L: 'L', U: 'U', T: 'T', H: 'H', patio: 'pátio' };

/* fachada e corredor de uma unidade: sonda 0,1 m para fora de cada lado, a cada 0,2 m */
function bordas(u, lay, plate) {
  const P = u.poly, s = Math.sign(A.G.sArea(P)) || 1; let fac = 0, cor = 0;
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1e-6) continue;
    const n = s > 0 ? [(b[1] - a[1]) / L, -(b[0] - a[0]) / L] : [-(b[1] - a[1]) / L, (b[0] - a[0]) / L], k = Math.max(1, Math.round(L / 0.2));
    for (let j = 0; j < k; j++) { const t = (j + 0.5) / k, q = [a[0] + (b[0] - a[0]) * t + n[0] * 0.1, a[1] + (b[1] - a[1]) * t + n[1] * 0.1];
      if (!A.G.pip(q, plate)) fac += L / k; else if (A.G.pip(q, lay.corridor)) cor += L / k; }
  }
  return { fac, cor };
}

describe('C3 — planta por alas: L, U, T, H e pátio', () => {
  for (const tipo of ['L', 'U', 'T', 'H', 'patio']) {
    it(`${tipo}: corredor contínuo, núcleo no corredor, unidades com fachada e porta, áreas fecham, distância medida`, () => {
      for (const rot of [0, 1]) {
        const st = forma(tipo, 1300, rot), m = calc(st), t = m.T[0], lay = m.tipo[0];
        expect(lay.alas, `${tipo} rot ${rot}`).toBeTruthy();
        expect(lay.alas.forma).toBe(NOMES[tipo]);
        const un = lay.units.filter(u => !u.livre);
        expect(un.length).toBe(12);                                                   // todas as unidades do mix
        // cada unidade: ≥ 3 m de fachada (janela) e ≥ 1 m de corredor (porta)
        un.forEach(u => { const b = bordas(u, lay, t.plate); expect(b.fac).toBeGreaterThan(2.9); expect(b.cor).toBeGreaterThan(0.9) });
        // unidades não invadem o núcleo nem o corredor
        const enc = p => A.G.scaleToArea(p, A.G.area(p) * 0.97);
        un.forEach(u => { lay.coreParts.forEach(c => expect(A.G.polysOverlap(enc(u.poly), enc(c.poly))).toBe(false)) });
        // todas as unidades chegam à escada pelo corredor (corredor ligado ao núcleo), e a distância fica no limite da saída única
        const R = A.normaDistTipo(lay);
        expect(R.semAcesso).toEqual([]);
        expect(R.max).toBeLessThanOrEqual(30.5);
        expect(Math.abs(R.max - lay.alas.dist)).toBeLessThan(1.5);                    // a medida do layout (malha 0,5 m) bate com a das normas (0,25 m)
        // unidades + núcleo (+ escadas extras) + corredor + livre = área da planta
        const soma = un.reduce((s, u) => s + u.area, 0) + lay.coreA + A.G.area(lay.corridor) + lay.units.filter(u => u.livre).reduce((s, u) => s + u.area, 0);
        expect(Math.abs(soma - t.A) / t.A).toBeLessThan(0.005);
        // nada em cima de nada: a soma das peças não passa da planta
        expect(lay.alas.unA + lay.alas.coreA + lay.alas.corrA + lay.alas.livreA).toBeCloseTo(soma, 3);
      }
    });
  }
  it('o corredor dobra nos cantos e cruza nos nós (um polígono só; no pátio, um anel em volta do vazio)', () => {
    const L = calc(forma('L')).tipo[0], H = calc(forma('H')).tipo[0], P = calc(forma('patio')).tipo[0];
    expect(L.alas.alas).toBe(2); expect(L.corrAneis).toBe(null);
    expect(H.alas.alas).toBe(3);
    expect(P.alas.alas).toBe(4); expect(P.corrAneis.length).toBe(2);                 // borda + furo (sem a "ponte")
    expect(A.G.area(P.corrAneis[0]) - A.G.area(P.corrAneis[1])).toBeCloseTo(A.G.area(P.corridor), 3);
  });
  it('unidades de cada ala com o referencial da ala (cômodos desenhados na direção certa) e cômodos válidos', () => {
    const m = calc(forma('L')), lay = m.tipo[0], dirs = new Set(lay.units.filter(u => !u.livre).map(u => u.ux.map(v => Math.round(Math.abs(v) * 10)).join()));
    expect(dirs.size).toBe(2);                                                         // duas alas perpendiculares
    expect(m.comodos.unidades).toBe(12);
    expect(m.comodos.validas).toBeGreaterThanOrEqual(11);
  });
  it('sacadas na fachada da própria unidade', () => {
    const m = calc(forma('U')), lay = m.tipo[0], t = m.T[0];
    lay.units.filter(u => !u.livre && u.sac).forEach(u => {
      expect(u.sac.area).toBeGreaterThan(1);
      const c = A.G.centroid(u.sac.poly); expect(A.G.pip(c, u.poly)).toBe(true);
    });
    expect(m.sacA).toBeGreaterThan(0);
  });
  it('alas longas: escada extra na ponta da ala mais distante; desligada, o estudo avisa', () => {
    const st = forma('U'), lay = calc(st).tipo[0];
    expect(lay.alas.esc2).toBeGreaterThanOrEqual(1);
    expect(lay.alas.distSem).toBeGreaterThan(30); expect(lay.alas.dist).toBeLessThanOrEqual(30);
    expect(lay.coreExtra.length).toBe(lay.alas.esc2);
    expect(lay.coreParts.filter(c => c.kind === 'esc').length).toBe(1 + lay.alas.esc2);
    const m2 = A.compute(st, { layouts: false });
    expect(m2.obst.length).toBe(m2.cores.length + m2.lobbies.length + lay.alas.esc2);   // a escada extra desce: obstáculo nas garagens
    st.alas.esc2 = false; const m3 = calc(st);
    expect(m3.tipo[0].alas.esc2).toBe(0);
    expect(m3.avisos.some(a => /da escada \(limite 30 m\)/.test(a))).toBe(true);
  });
  it('forma girada (fora dos eixos) funciona no referencial do lado mais longo', () => {
    const b = A.blcFormato('L', SLOT, 1100, { ala: 12.6 }).bloco, c = [35, 45], a = 0.4;
    b.pts = b.pts.map(([x, y]) => [c[0] + (x - c[0]) * Math.cos(a) - (y - c[1]) * Math.sin(a), c[1] + (x - c[0]) * Math.sin(a) + (y - c[1]) * Math.cos(a)]);
    const m = calc(comBloco(b)), lay = m.tipo[0];
    expect(lay.alas && lay.alas.forma).toBe('L');
    expect(A.normaDistTipo(lay).semAcesso).toEqual([]);
  });
});

describe('C3 — o que continua no motor de antes (tipoLayout)', () => {
  const RET = [[15, 15], [45, 15], [45, 35], [15, 35]];
  it('planta retangular desenhada: layout idêntico ao tipoLayout', () => {
    const st = comBloco({ pts: RET, de: 1 }), m = calc(st), t = m.T[0], E = st.estudo, P = st.produto;
    const r0 = A.massing(st).T[0].r;   // fator antes da eficiência real (o compute desenha com ele e só depois ajusta t.r)
    const list = []; P.mix.forEach(u => { for (let q = 0; q < u.qtd; q++) list.push({ nome: u.nome, alvo: u.area * r0, sac: +u.sac || 0 }) });
    const nAuto = (t.units > 60 || t.H > 45) ? 3 : (t.H > 12 ? 2 : 1);
    const ref = A.tipoLayout(t.plate, list, { corr: E.corrTipo, profMin: E.profMin, nElev: +E.elevadores || nAuto, pos: E.nucleoPos, lado: E.nucleoLado, escada: E.escadaLado, planta: E.tipoPlanta,
      escTipo: E.escTipo, nEsc: E.nEsc, emerg: E.emerg, fachada: E.fachada, sacTipo: P.sacTipo, sacProf: P.sacProf, _st: st, _pav: t.pav, _H: t.H, _nElevAuto: !(+E.elevadores), _areaFixa: true });   // a repartição pelos partidos (reparte.js) também
    const lay = m.tipo[0];
    expect(lay.alas).toBeUndefined();
    // (a repartição pelos partidos depende da área-alvo, que a eficiência real ajusta depois: os cortes podem andar centímetros)
    expect(lay.units.map(u => u.nome)).toEqual(ref.units.map(u => u.nome));
    lay.units.forEach((u, i) => expect(Math.abs(u.area - ref.units[i].area)).toBeLessThan(1.5));
    expect(lay.core).toEqual(ref.core); expect(lay.corridor).toEqual(ref.corridor);
  });
  it('quase retangular (recorte pequeno) e lados inclinados seguem no tipoLayout', () => {
    const quase = [[15, 15], [45, 15], [45, 33], [41, 33], [41, 35], [15, 35]];
    expect(calc(comBloco({ pts: quase, de: 1 })).tipo[0].alas).toBeUndefined();
    const trap = [[15, 15], [45, 15], [40, 35], [20, 35]];
    expect(calc(comBloco({ pts: trap, de: 1 })).tipo[0].alas).toBeUndefined();
    expect(A.alasDetecta(trap, null, null)).toBe(null);
  });
  it('modo automático e estudo exemplo: nada muda (sem layout por ala)', () => {
    const m = calc(estado(A, {}));
    m.tipo.forEach(l => { expect(l.alas).toBeUndefined(); expect(l.alasFalha).toBeUndefined() });
  });
  it('U com alas de 6 m: o núcleo vai para a base (antes caía no vão); alas de 4 m: aproximado, com aviso', () => {
    const U = { pts: [[5, 5], [25, 5], [25, 45], [19, 45], [19, 13], [11, 13], [11, 45], [5, 45]], de: 1 };
    const st = comBloco(U); st.produto.mix = [{ nome: 'A', area: 60, qtd: 6, preco: 10000, sac: 0 }];
    const m = calc(st);
    expect(m.tipo[0].alas.forma).toBe('U'); expect(m.blc[0].nucleo).toBe(true);
    expect(m.avisos.some(a => /núcleo/.test(a))).toBe(false);
    const U4 = { pts: [[5, 5], [25, 5], [25, 45], [21, 45], [21, 9], [9, 9], [9, 45], [5, 45]], de: 1 };
    const s4 = comBloco(U4); s4.produto.mix = st.produto.mix; const m4 = calc(s4);
    expect(m4.tipo[0].alas).toBeUndefined();
    expect(m4.tipo[0].alasFalha).toMatch(/núcleo não cabe/);
    expect(m4.avisos.some(a => /pavimento tipo ficou aproximado/.test(a))).toBe(true);
    s4.alas.on = false; expect(calc(s4).tipo[0].alasFalha).toBeUndefined();          // desligado: o pavimento aproximado de antes, sem aviso de alas
  });
});

describe('C3 — pilha de blocos com alas', () => {
  it('bloco recuado em L acima do bloco tipo em L: mesmo núcleo, corredor nas mesmas linhas, unidades com fachada', () => {
    const b0 = A.blcFormato('L', SLOT, 1300, { ala: 12.6 }).bloco, st = comBloco(b0); st.produto.torres[0].pav = 14;
    const m0 = calc(st), ref = m0.tipo[0];
    st.blocos.torres[0].blocos.push({ ...b0, pts: b0.pts.map(q => [...q]), de: 11 });
    const nb = A.blcRecua(st, 0, 1, 2, { nucleos: [ref.core, ...ref.coreExtra] });
    expect(nb).toBeTruthy(); expect(nb.preservados).toBeGreaterThan(0);
    const m = calc(st), t = m.T[0], f = t.faixas.find(x => x.de === 11);
    expect(f.nucleoCortado).toBe(false);
    expect(f.lay.alas).toBeTruthy(); expect(f.lay.core).toBe(m.tipo[0].core);
    const mesma = (a, b) => a.some(v => b.some(r => Math.abs(r - v) < 1e-6));              // o corredor sobe alinhado ao do bloco tipo
    expect(mesma(f.lay.alas.pv, m.tipo[0].alas.pv)).toBe(true); expect(mesma(f.lay.alas.pu, m.tipo[0].alas.pu)).toBe(true);
    const un = f.lay.units.filter(u => !u.livre); expect(un.length).toBeGreaterThan(0);
    un.forEach(u => { const b = bordas(u, f.lay, f.plate); expect(b.fac).toBeGreaterThan(2.9); expect(b.cor).toBeGreaterThan(0.9) });
    expect(A.normaDistTipo(f.lay).semAcesso).toEqual([]);
    expect(A.torreLayAndar(m, 0, 12)).toBe(f.lay);
  });
});

describe('C3 — "Recuar X m" preserva a fachada do núcleo', () => {
  it('estudo exemplo: recuar 3 m o bloco de cima NÃO corta o núcleo; "todas as fachadas" corta (e avisa)', () => {
    const st = estado(A, {}); A.blcPersonaliza(st, 0); A.blcMaisBloco(st, 0);
    const base0 = st.blocos.torres[0].blocos[0];
    const nb = A.blcRecua(st, 0, 1, 3);                                                // padrão: calcula o núcleo atual
    expect(nb.preservados).toBeGreaterThanOrEqual(1);
    expect(A.G.area(nb.pts)).toBeLessThan(A.G.area(base0.pts) - 50);
    const m = calc(st), f = m.T[0].faixas.find(x => x.bk === 1);
    expect(f.nucleoCortado).toBe(false);
    expect(m.avisos.some(a => /corta o núcleo/.test(a))).toBe(false);
    expect(A.blcFora(m.tipo[0].core, nb.pts)).toBeLessThan(0.01);                     // o núcleo inteiro dentro do bloco recuado
    const s2 = estado(A, {}); A.blcPersonaliza(s2, 0); A.blcMaisBloco(s2, 0); A.blcRecua(s2, 0, 1, 3, { todas: true });
    expect(calc(s2).avisos.some(a => /corta o núcleo/.test(a))).toBe(true);
    const s3 = estado(A, {}); A.blcPersonaliza(s3, 0); A.blcMaisBloco(s3, 0); s3.alas.recuaTodas = true; A.blcRecua(s3, 0, 1, 3);
    expect(calc(s3).avisos.some(a => /corta o núcleo/.test(a))).toBe(true);           // "Mais opções › recuar todas as fachadas"
  });
  it('blcOffset por lado: lados com recuos diferentes ganham um dente; recuo zero mantém o lado', () => {
    const R = [[0, 0], [20, 0], [20, 10], [0, 10]];
    const o = A.blcOffset(R, j => j === 2 ? 0 : 2);                                   // o lado de cima (y = 10) fica
    expect(A.G.area(o)).toBeCloseTo(16 * 8, 6);
    expect(Math.max(...o.map(q => q[1]))).toBeCloseTo(10, 9);
    const Lf = [[0, 0], [20, 0], [20, 10], [10, 10], [10, 20], [0, 20]];
    const o2 = A.blcOffset(Lf, j => j === 3 ? 0 : 1);                                 // lado interno horizontal (y = 10, x 10→20) preservado
    expect(o2).toBeTruthy(); expect(A.G.area(o2)).toBeLessThan(A.G.area(Lf));
  });
  it('lados colineares ao lado do núcleo também ficam (a fachada segue reta)', () => {
    const P = [[0, 0], [10, 0], [20, 0], [20, 10], [0, 10]];                         // a fachada de baixo em dois trechos
    const k = A.blcLadosNucleo(P, () => 3, [[[4, 0.5], [7, 0.5], [7, 3], [4, 3]]]);   // só o trecho 0 corta o núcleo; o 1 é colinear
    expect([...k].sort()).toEqual([0, 1]);
  });
});

describe('C3 — pátio no IFC e no DXF', () => {
  it('perfil com vazio (IfcArbitraryProfileDefWithVoids) e sem vazio (perfil fechado de sempre)', () => {
    const L = []; const add = s => { L.push(s); return '#' + L.length }, f = v => (+v).toFixed(2);
    A.blcIfcPerfil(add, f, [[0, 0], [30, 0], [30, 20], [0, 20]], [[[10, 5], [20, 5], [20, 15], [10, 15]]]);
    const txt = L.join('\n');
    expect(txt).toMatch(/IFCARBITRARYPROFILEDEFWITHVOIDS\(\.AREA\.,\$,#\d+,\(#\d+\)\)/);
    expect(L.filter(s => s.startsWith('IFCPOLYLINE')).length).toBe(2);                 // borda e vazio separados (sem a "ponte")
    const L2 = []; A.blcIfcPerfil(s => { L2.push(s); return '#' + L2.length }, f, [[0, 0], [1, 0], [1, 1]], []);
    expect(L2[L2.length - 1]).toMatch(/^IFCARBITRARYCLOSEDPROFILEDEF/);
  });
  it('planta do andar com pátio: borda e vazios do bloco (torre e pilha)', () => {
    const st = forma('patio'), m = A.massing(st), t = m.T[0];
    const an = A.blcAnelAndar(t, 3);
    expect(an.vazios.length).toBe(1);
    expect(A.G.area(an.pts) - A.G.area(an.vazios[0])).toBeCloseTo(t.A, 6);
    st.produto.torres[0].pav = 12;
    st.blocos.torres[0].blocos.push({ pts: [[20, 20], [50, 20], [50, 60], [20, 60]], de: 11 });
    const t2 = A.massing(st).T[0];
    expect(A.blcAnelAndar(t2, 2).vazios.length).toBe(1); expect(A.blcAnelAndar(t2, 12)).toBe(null);
  });
});
