// Fase D — alavancas, potencial com eficiência global, otimizador pela margem s/ VGV (+ eficiência global e V/C na fronteira),
// m.hLim no potencial e no otimizador, e o tempo da fronteira de Pareto.
import { describe, it, expect } from 'vitest';
import { carregar, cenarios, estado } from './harness.js';

const A = carregar();
const linha = (r, k) => r.linhas.find(l => l.k === k);

describe('alavancas', () => {
  const st = estado(A, {}), m = A.compute(st), r = A.alavancasCalc(st, m);
  it('+preço, +eficiência, −obra e −terreno aumentam lucro, margem s/ VGV e TIR', () => {
    for (const k of ['preco', 'efic', 'obra', 'terreno']) {
      const l = linha(r, k); expect(l.ok, k).toBe(true);
      expect(l.d.lucro, k + ' lucro').toBeGreaterThan(0); expect(l.d.margem, k + ' margem').toBeGreaterThan(0); expect(l.d.tir, k + ' tir').toBeGreaterThan(0);
    }
  });
  it('ordem de grandeza: +5% de preço rende quase 5% do VGV em lucro; linhas ordenadas pelo ganho', () => {
    const f = A.finance(st, m, { noHooks: true }), p = linha(r, 'preco');
    expect(p.d.lucro / (f.vgvB * 0.05)).toBeGreaterThan(0.8); expect(p.d.lucro / (f.vgvB * 0.05)).toBeLessThan(1.15);
    expect(r.base.margem).toBeCloseTo(f.margemVGV, 12);
    const ok = r.linhas.filter(l => l.ok); for (let i = 1; i < ok.length; i++) expect(ok[i - 1].d.lucro).toBeGreaterThanOrEqual(ok[i].d.lucro);
    expect(r.linhas.map(l => l.ok)).toEqual([...r.linhas.map(l => l.ok)].sort((a, b) => b - a));   // as que não se aplicam vão para o fim
    expect(r.melhor).toBe(r.linhas[0]);
  });
  it('o passo é editável: +10% de preço rende cerca do dobro de +5%', () => {
    const s2 = A.clone(st); s2.alavancas.preco = 0.10; const p2 = linha(A.alavancasCalc(s2, m), 'preco');
    expect(p2.nome).toBe('+10% preço'); expect(p2.d.lucro / linha(r, 'preco').d.lucro).toBeGreaterThan(1.8); expect(p2.d.lucro / linha(r, 'preco').d.lucro).toBeLessThan(2.2);
  });
  it('+eficiência = mesma planta com unidades 5% maiores: igual a refazer o modelo com efic e áreas × 1,05', () => {
    const m0 = A.massing(st), rr = A.alavancasCalc(st, m0), e = linha(rr, 'efic');
    const s2 = A.clone(st); s2.produto.efic *= 1.05; s2.produto.mix.forEach(u => u.area *= 1.05);
    const m2 = A.massing(s2), f0 = A.finance(st, m0, { noHooks: true }), f2 = A.finance(s2, m2, { noHooks: true });
    expect(m2.constr).toBeCloseTo(m0.constr, 6);                    // a área construída não muda
    expect(m2.priv / m0.priv).toBeGreaterThan(1.04); expect(m2.priv / m0.priv).toBeLessThan(1.051);
    expect(e.d.lucro).toBeCloseTo(f2.lucro - f0.lucro, 0);
  });
  it('terreno zerado e eficiência no limite não se aplicam, com o motivo', () => {
    const s1 = A.clone(st); s1.fin.terreno = 0; s1.fin.permuta = 0; s1.fin.permutaFin = 0;
    const t = linha(A.alavancasCalc(s1, m), 'terreno'); expect(t.ok).toBe(false); expect(t.motivo).toMatch(/sem terreno/);
    const s2 = A.clone(st); s2.produto.efic = 0.95; const e = linha(A.alavancasCalc(s2, m), 'efic'); expect(e.ok).toBe(false); expect(e.motivo).toMatch(/limite/);
  });
  it('+1 pavimento: com folga de CA e gabarito vale (mais unidades); no limite diz por quê; não mexe no estado', () => {
    const roomy = estado(A, { regras: { caMax: 8, hMax: 90 }, produto: { torres: [{ pav: 8 }] } }), mr = A.massing(roomy);
    const antes = JSON.stringify(roomy), a = linha(A.alavancasCalc(roomy, mr), 'pav');
    expect(a.ok).toBe(true); expect(a.d.lucro).toBeGreaterThan(0); expect(a.desc).toMatch(/\+\d+ un/);
    expect(JSON.stringify(roomy)).toBe(antes);
    const lim = estado(A, { regras: { caMax: 8, hMax: 90 }, produto: { torres: [{ pav: 8 }] }, forma: { on: true, aero: true, soleira: 0 } }), P = lim.produto;
    lim.forma.aeroCota = P.peTerreo + P.garAcima * P.peGar + 8.5 * P.pe;     // cabe 8 pavimentos e não 9
    const b = linha(A.alavancasCalc(lim, A.massing(lim)), 'pav'); expect(b.ok).toBe(false); expect(b.motivo).toMatch(/gabarito/);
    const c = linha(r, 'pav'); expect(c.ok).toBe(false); expect(c.motivo).toMatch(/CA/);   // o estudo padrão já está no CA
  });
  it('vale com orçamento paramétrico e unidade a unidade (modelos completos)', () => {
    const sp = estado(A, { orc: { modo: 'param' } }), rp = A.alavancasCalc(sp, A.compute(sp, { quick: true }));
    expect(linha(rp, 'obra').d.lucro).toBeGreaterThan(0); expect(linha(rp, 'preco').d.lucro).toBeGreaterThan(0);
  });
});

describe('potencial do terreno com eficiência global', () => {
  it('nunca passa do cálculo antigo (só pela eficiência do andar) nos estudos de referência', () => {
    for (const c of cenarios()) {
      const s = estado(A, c.S), m = A.compute(s, { quick: true }), po = A.potencial(s, m);
      expect(po.priv, c.nome).toBeLessThanOrEqual(po.priv0 + 1e-6); expect(po.priv, c.nome).toBeGreaterThan(0);
      expect(po.eficGlobal).toBeCloseTo(m.priv / m.constr, 12);
    }
  });
  it('garagem computável pesa: o potencial cai bem abaixo do cálculo antigo', () => {
    const s = estado(A, { regras: { ncGaragem: false } }), m = A.compute(s, { quick: true }), po = A.potencial(s, m);
    expect(po.priv / po.priv0).toBeLessThan(0.8); expect(po.uso.priv).toBeGreaterThan(1);
  });
  it('respeita m.hLim (plano do aeródromo), não só R.hMax', () => {
    const s = estado(A, { forma: { on: true, aero: true, aeroCota: 36, soleira: 0 } }), m = A.compute(s, { quick: true }), po = A.potencial(s, m);
    const hEmb = s.produto.peTerreo + s.produto.garAcima * s.produto.peGar;
    expect(m.hLim).toBe(36); expect(po.hLim).toBe(36); expect(po.pavH).toBe(Math.floor((36 - hEmb) / s.produto.pe));
    const livre = A.potencial(estado(A, {}), A.compute(estado(A, {}), { quick: true }));
    expect(po.pavH).toBeLessThan(livre.pavH); expect(po.uso.h).toBeCloseTo(m.H / 36, 12);
  });
});

describe('otimizador: margem s/ VGV, hLim, eficiência global e V/C', () => {
  const opts = { torres: false, tipologias: true, unidades: false, paretoMax: 3 };    // 4 combinações (uma por tipologia): rápido
  it('objetivo margem ordena pela margem s/ VGV (a convenção da Fase A)', async () => {
    const B = A, st = estado(B, {}), m = B.compute(st);
    expect(B.OBJ.margem[0]).toBe('Margem s/ VGV');
    const o = await B.otimizar({ ...opts, obj: 'margem', mc: false }, null, null, { st, m });
    expect(o.res.length).toBeGreaterThan(1);
    for (let i = 1; i < o.res.length; i++) expect(o.res[i - 1].margem).toBeGreaterThanOrEqual(o.res[i].margem);
    const r0 = o.res[0], s2 = estado(B, {}); B.aplicarOtim(r0, s2);
    const m2 = B.compute(s2, { quick: true }), f2 = B.finance(s2, m2);
    expect(f2.margemVGV).toBeCloseTo(r0.margem, 8); expect(r0.margemReceita).toBeCloseTo(f2.margem, 8);
    expect(Math.abs(r0.margem - r0.margemReceita)).toBeGreaterThan(1e-4);     // são margens diferentes
  }, 120000);
  it('maxPavFast com teto dá o mesmo que a bisseção original em 1..80', () => {
    const B = A, base = estado(B, {});
    const ref = st => { const ok = n => { const m = B.massing(st, { pav: n }); return m.H <= (m.hLim ?? st.regras.hMax) + 1e-6 && m.CA <= st.regras.caMax + 1e-6 && m.T.every(t => t.A > 1) };
      if (!ok(1)) return 0; let lo = 1, hi = 80; while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (ok(mid)) lo = mid; else hi = mid - 1 } return lo };
    for (const [pk, N, nT] of [['atual', 3, 1], ['alto', 2, 2], ['compacto', 6, 1], ['familia', 4, 3]]) for (const [sub, gac] of [[0, 0], [1, 0], [2, 1], [0, 3], [4, 2]]) {
      const st = B.clone(base); st.produto.mix = B.presetMix(base, pk, N); st.produto.subsolos = sub; st.produto.garAcima = gac; st.produto.torres = Array.from({ length: nT }, () => ({ pav: 4 }));
      const teto = Math.floor((B.hLimDe(st) + 1e-6 - (st.produto.peTerreo + gac * st.produto.peGar)) / st.produto.pe);
      expect(B.maxPavFast(st, teto), `${pk} N${N} ${nT}T ${sub}/${gac}`).toBe(ref(st));
      expect(B.maxPavFast(st), `sem teto ${pk} ${sub}/${gac}`).toBe(ref(st));
    }
  }, 120000);
  it('respeita m.hLim: nenhuma opção passa do plano do aeródromo', async () => {
    const B = A, st = estado(B, { forma: { on: true, aero: true, aeroCota: 25, soleira: 0 } }), m = B.compute(st);
    const o = await B.otimizar({ ...opts, mc: true }, null, null, { st, m });
    expect(o.res.length).toBeGreaterThan(0);
    for (const r of [...o.res, ...o.pareto.pts]) expect(r.H, r.key).toBeLessThanOrEqual(25 + 1e-6);
    const livre = await B.otimizar({ ...opts, mc: false }, null, null, { st: estado(B, {}), m: B.compute(estado(B, {})) });
    expect(Math.max(...livre.res.map(r => r.H))).toBeGreaterThan(25);       // sem o plano passa (o teste não é vazio)
  }, 240000);
  it('eficiência global e V/C entram na fronteira só quando pedidos, com valores em todos os pontos', async () => {
    const B = A, st = estado(B, {}), m = B.compute(st);
    const a = await B.otimizar({ ...opts, mc: true }, null, null, { st, m });
    expect(a.pareto.criterios).toEqual(['lucro', 'sol', 'vagas']);
    const b = await B.otimizar({ ...opts, mc: true, efic: true, vc: true }, null, null, { st, m });
    expect(b.pareto.criterios).toEqual(['lucro', 'sol', 'vagas', 'efic', 'vc']);
    for (const p of [...b.pareto.pts, ...b.pts]) { expect(p.efic, p.key).toBeGreaterThan(0); expect(p.efic).toBeLessThan(1); expect(p.vc, p.key).toBeGreaterThan(0) }
    const marca = pts => pts.map(p => [p.key, !!p.fronteira]);
    // mais critérios nunca tiram da fronteira quem já estava nela (sobre os mesmos pontos)
    const C = B.PARETO_CRIT, P = b.pareto.pts, f3 = new Set(B.paretoFronteira(P, [C.lucro, C.sol, C.vagas]).map(i => P[i].key)), f5 = new Set(B.paretoFronteira(P, [C.lucro, C.sol, C.vagas, C.efic, C.vc]).map(i => P[i].key));
    for (const k of f3) expect(f5.has(k)).toBe(true);
    expect(marca(b.pareto.pts).filter(x => x[1]).length).toBe(f5.size);
  }, 240000);
  it('paretoPrioridade: extremos primeiro, depois o meio', () => {
    const l = [5, 1, 9, 3, 7, 2, 8].map(v => ({ lucro: v })), o = A.paretoPrioridade(l, 'lucro').map(p => p.lucro);
    expect(o.slice(0, 2)).toEqual([1, 9]); expect(o.length).toBe(7); expect([...o].sort((a, b) => a - b)).toEqual([1, 2, 3, 5, 7, 8, 9]);
    expect(A.paretoPrioridade([], 'lucro')).toEqual([]); expect(A.paretoPrioridade([{ lucro: 1 }], 'lucro').length).toBe(1);
  });
  it('sol do proxy: as caixas do entorno prontas dão o mesmo número que calculá-las na hora', () => {
    const B = A, st = estado(B, {});
    const L = st.lote.pts, cx = L.reduce((s, q) => s + q[0], 0) / L.length, cy = L.reduce((s, q) => s + q[1], 0) / L.length, e = []; let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = -8; i <= 8; i++) for (let j = -8; j <= 8; j++) { const x = cx + i * 30, y = cy + j * 30; if (Math.hypot(i, j) < 2.2) continue; e.push({ pts: [[x, y], [x + 14, y], [x + 14, y + 14], [x, y + 14]], h: Math.round(6 + rnd() * 34) }) }
    st.entorno = e; const m = B.massing(st), pr = B.otimEntorno(st);
    expect(B.otimSolProxy(st, m, pr)).toBeCloseTo(B.otimSolProxy(st, m), 12);
    expect(B.otimSolProxy(st, m)).toBeGreaterThan(0.5); expect(B.otimSolProxy(st, m)).toBeLessThan(13);
    // sem prédios no entorno o proxy continua dando o valor de antes (12 raios do solstício, torre isolada)
    expect(B.otimSolProxy(estado(B, {}), B.massing(estado(B, {})))).toBeCloseTo(B.otimSolProxy(estado(B, {}), B.massing(estado(B, {})), []), 12);
  });
  it('fronteira de Pareto completa (torres + tipologias + unidades): mesmas melhores opções de antes e tempo medido (meta ≤ 15 s)', async () => {
    const B = A, st = estado(B, {}), m = B.compute(st), t0 = Date.now();
    const o = await B.otimizar({ obj: 'lucro', torres: true, tipologias: true, unidades: true, mc: true, paretoMax: 8 }, null, null, { st, m });
    const dt = (Date.now() - t0) / 1000;
    console.log(`fronteira de Pareto: ${dt.toFixed(1)} s · ${o.testadas} combinações · ${o.pts.length} estimadas · ${o.pareto.pts.length} conferidas, ${o.pareto.pts.filter(p => p.fronteira).length} na fronteira`);
    // UX v3 P3 (mudança intencional): vagas calibradas por pavimento no layout real, alturas limitadas pelo que cabe (e mais baixas),
    // conferência que sobe/desce andares e subsolos com o layout real e ordem "lucro > 0 e margem ≥ meta" antes do objetivo.
    // As três melhores de antes continuam, com o mesmo lucro; entra uma melhor (2 torres × 11 pav, 1 subsolo: R$ 38,5 mi > 35,2 mi).
    // Antes: ['1|alto|3|15|1|0', '1|alto|4|11|1|0', '2|alto|2|11|0|2', '1|alto|2|20|1|0', '2|atual|4|10|2|0'] · [35211511, 34629825, 33727734, 33328450, 19748241]
    expect(o.res.map(r => B.otimKey(r))).toEqual(['2|alto|2|11|1|0', '1|alto|4|11|0|1', '1|alto|3|15|1|0', '1|alto|2|20|1|0', '2|alto|1|20|1|0']);
    // Núcleo compacto (docs/COMUNS.md §1, mudança intencional): a faixa atrás do núcleo fica livre nas garagens (mais vagas por pavimento).
    // Antes do núcleo: ['2|alto|2|11|1|0', '1|alto|3|15|1|0', '1|alto|4|11|1|0', '1|alto|2|20|1|0', '2|alto|1|19|1|0'] · [38457714, 35211511, 34629825, 33328450, 22836944]
    expect(o.res.map(r => Math.round(r.lucro))).toEqual([38783963, 35717524, 35328222, 33412691, 25488123]);
    expect(o.pareto.pts.length).toBeGreaterThan(5); expect(o.pareto.pts.some(p => p.fronteira)).toBe(true);
    expect(dt).toBeLessThan(30);        // a meta é ≤ 15 s numa máquina livre; o teto do teste é folgado para não oscilar com a carga
  }, 300000);
});
