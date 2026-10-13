// Fase E: comparar o fluxo do Gabarito com a planilha da empresa (src/calc/comparafluxo.js + planilha.js)
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { carregar, estado } from './harness.js';
vi.setConfig({ testTimeout: 180000, hookTimeout: 180000 });

let A, st, m, f, gl;
beforeAll(() => { A = carregar(); st = estado(A, {}); m = A.compute(st); f = A.finance(st, m); gl = A.comparaLinhasGab(f) });

/* planilha (objeto de comparaLer) a partir de séries; saldo = receita − custos */
const planDe = (L, T) => {
  const saldo = L.receita.map((v, t) => v - L.obra[t] - L.terreno[t] - L.indiretos[t]);
  return { ok: true, T: T ?? saldo.length, linhas: { ...L, saldo }, tem: {}, avisos: [] };
};
const copia = () => ({ receita: gl.receita.slice(), obra: gl.obra.slice(), terreno: gl.terreno.slice(), indiretos: gl.indiretos.slice() });
const desloca = (a, k) => a.map((_, t) => (t - k >= 0 ? a[t - k] : 0));
const aumenta = (n) => n + 6;     // folga de meses ao deslocar

describe('o recorte do Gabarito fecha com o fluxo', () => {
  it('receita − obra − terreno − indiretos = saldo (cf) em todos os meses', () => {
    gl.saldo.forEach((s, t) => expect(gl.receita[t] - gl.obra[t] - gl.terreno[t] - gl.indiretos[t]).toBeCloseTo(s, 4));
  });
  it('fecha também com plano empresário ligado (juros e financiamento no recorte de indiretos)', () => {
    const s2 = estado(A, { fin: { finOn: true } }), m2 = A.compute(s2), f2 = A.finance(s2, m2), g2 = A.comparaLinhasGab(f2);
    expect(f2.juros).toBeGreaterThan(0);
    g2.saldo.forEach((s, t) => expect(g2.receita[t] - g2.obra[t] - g2.terreno[t] - g2.indiretos[t]).toBeCloseTo(s, 4));
  });
});

describe('comparaFluxo: a planilha é o próprio fluxo do Gabarito', () => {
  it('diferença zero, nenhuma divergência, métricas iguais', () => {
    const c = A.comparaFluxo(planDe(copia()), f, { tma: st.fin.tma });
    expect(c.ok).toBe(true);
    expect(c.zero).toBe(true);
    expect(c.divergencias).toEqual([]);
    c.linhas.forEach(l => { expect(Math.max(...l.dif.map(Math.abs))).toBeLessThan(1e-6); expect(l.dTotal).toBeCloseTo(0, 4) });
    expect(c.metricas.plan.lucro).toBeCloseTo(c.metricas.gab.lucro, 3);
    expect(c.metricas.plan.vpl).toBeCloseTo(c.metricas.gab.vpl, 3);
    expect(c.metricas.plan.exp).toBeCloseTo(c.metricas.gab.exp, 3);
    expect(c.metricas.gab.tirA).toBeCloseTo(f.tirA, 8);
    expect(c.metricas.gab.vpl).toBeCloseTo(f.vpl, 3);
    expect(c.metricas.gab.exp).toBeCloseTo(f.exp, 3);
    expect(c.metricas.gab.lucro).toBeCloseTo(f.lucro, 3);
    expect(c.metricas.gab.pay).toBe(f.pay);
    expect(A.comparaSugestoes(c, st, f)).toEqual([]);
    c.acum.plan.forEach((v, t) => expect(v).toBeCloseTo(c.acum.gab[t], 4));
  });
  it('passando pelo CSV em formato brasileiro (centavos): diferença desprezível', () => {
    const cab = ['Mês', 'Receitas', 'Obra', 'Terreno', 'Indiretos', 'Saldo'], br = v => v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    const linhas = gl.saldo.map((s, t) => [String(t + 1), br(gl.receita[t]), '"-' + br(gl.obra[t]) + '"', '-' + br(gl.terreno[t]), '-' + br(gl.indiretos[t]), br(s)]);
    const csv = cab.join(';') + '\r\n' + linhas.map(l => l.join(';')).join('\r\n');
    const { cab: c0, dados } = A.plaCabecalho(A.plaCSV(csv)), mapa = A.comparaMapa(c0);
    expect(mapa.mes).toBe(0); expect(mapa.receita).toBe(1); expect(mapa.obra).toBe(2); expect(mapa.terreno).toBe(3); expect(mapa.indiretos).toBe(4); expect(mapa.saldo).toBe(5);
    const pl = A.comparaLer(dados, mapa);
    expect(pl.ok).toBe(true);
    const c = A.comparaFluxo(pl, f, { tma: st.fin.tma });
    expect(c.divergencias).toEqual([]);
    expect(Math.max(...c.linhas.map(l => Math.max(...l.dif.map(Math.abs))))).toBeLessThan(1);
    expect(Math.abs(c.metricas.plan.vpl - c.metricas.gab.vpl)).toBeLessThan(50);
  });
});

describe('comparaFluxo: divergências plantadas', () => {
  it('obra deslocada 2 meses: acha o deslocamento, sugere o início da obra e a TIR cai', () => {
    const L = copia(), T = L.obra.length + aumenta(0);
    const pad = a => { const r = a.slice(); while (r.length < T) r.push(0); return r };
    L.receita = pad(L.receita); L.terreno = pad(L.terreno); L.indiretos = pad(L.indiretos); L.obra = desloca(pad(L.obra), 2);
    const c = A.comparaFluxo(planDe(L), f, { tma: st.fin.tma });
    const d = c.divergencias.find(x => x.linha === 'obra' && x.tipo === 'desloca');
    expect(d).toBeTruthy();
    expect(d.meses).toBe(2);
    expect(d.msg).toMatch(/2 meses depois/);
    expect(c.divergencias[0].linha).toBe('obra');            // a maior divergência é a obra
    expect(c.metricas.plan.tirA).toBeGreaterThan(c.metricas.gab.tirA);      // gastar mais tarde melhora a TIR
    expect(c.metricas.plan.lucro).toBeCloseTo(c.metricas.gab.lucro, 0);     // e não muda o lucro nominal
    expect(c.divergencias.some(x => x.linha === 'obra' && x.tipo === 'total')).toBe(false);   // o total é igual
    const sug = A.comparaSugestoes(c, st, f), s = sug.find(x => x.k === 'prelanc');
    expect(s).toBeTruthy();
    expect(s.set).toEqual([['fin.prelanc', st.fin.prelanc + 2]]);
    const st2 = estado(A, {}); expect(A.comparaAplicar(st2, s)).toBe(1); expect(st2.fin.prelanc).toBe(st.fin.prelanc + 2);
  });
  it('obra 12% maior entre dois meses: acha a janela e o percentual', () => {
    const L = copia(), a = 8, b = 20;
    for (let t = a; t <= b; t++) L.obra[t] *= 1.12;
    const c = A.comparaFluxo(planDe(L), f, { tma: st.fin.tma });
    const j = c.divergencias.find(x => x.linha === 'obra' && x.tipo === 'janela');
    expect(j).toBeTruthy();
    expect(Math.abs(j.pct - 0.12)).toBeLessThan(0.01);
    expect(Math.abs(j.mes0 - a)).toBeLessThanOrEqual(4); expect(Math.abs(j.mes1 - b)).toBeLessThanOrEqual(4);   // só os meses de gasto relevante entram
    expect(j.msg).toMatch(/12% maior na planilha entre os meses/);
    expect(c.metricas.plan.lucro).toBeLessThan(c.metricas.gab.lucro);
    const nada = c.divergencias.filter(x => x.linha !== 'obra' && x.linha !== 'saldo');
    expect(nada).toEqual([]);
  });
  it('obra 8% mais cara em todos os meses: total e sugestão do fator de custo', () => {
    const L = copia(); L.obra = L.obra.map(v => v * 1.08);
    const c = A.comparaFluxo(planDe(L), f, { tma: st.fin.tma });
    const t = c.divergencias.find(x => x.linha === 'obra' && x.tipo === 'total');
    expect(t).toBeTruthy(); expect(t.pct).toBeCloseTo(0.08, 3);
    expect(c.divergencias.some(x => x.tipo === 'janela')).toBe(false);
    const s = A.comparaSugestoes(c, st, f).find(x => x.k === 'fator');
    expect(s.set[0][0]).toBe('fin.fator'); expect(s.set[0][1]).toBeCloseTo(st.fin.fator * 1.08, 3); expect(s.aprox).toBe(true);
  });
  it('obra deslocada 2 meses E 12% mais cara em um trecho: acha as duas coisas (a janela já alinhada)', () => {
    const L = copia(), T = L.obra.length + 6, pad = a => { const r = a.slice(); while (r.length < T) r.push(0); return r };
    L.receita = pad(L.receita); L.terreno = pad(L.terreno); L.indiretos = pad(L.indiretos);
    const base = desloca(pad(L.obra), 2); L.obra = base.map((v, t) => (t >= 14 && t <= 26 ? v * 1.12 : v));
    const c = A.comparaFluxo(planDe(L), f, { tma: st.fin.tma });
    expect(c.divergencias.some(x => x.linha === 'obra' && x.tipo === 'desloca' && x.meses === 2)).toBe(true);
    const j = c.divergencias.find(x => x.linha === 'obra' && x.tipo === 'janela');
    expect(j).toBeTruthy(); expect(Math.abs(j.pct - 0.12)).toBeLessThan(0.015); expect(j.msg).toMatch(/descontado o deslocamento/);
  });
  it('recebimento das chaves 2 meses depois', () => {
    const L = copia(), T = L.receita.length, ch = f.chaves;
    expect(L.receita[ch]).toBeGreaterThan(0.3 * L.receita.reduce((s, v) => s + v, 0));   // no recebimento simples o saldo entra nas chaves
    const r = L.receita.slice(); while (r.length < T + 4) r.push(0);
    const v = r[ch]; r[ch] = 0; r[ch + 2] += v; L.receita = r;
    const pad = a => { const x = a.slice(); while (x.length < T + 4) x.push(0); return x };
    L.obra = pad(L.obra); L.terreno = pad(L.terreno); L.indiretos = pad(L.indiretos);
    const c = A.comparaFluxo(planDe(L), f, { tma: st.fin.tma });
    const d = c.divergencias.find(x => x.linha === 'receita' && x.tipo === 'pico');
    expect(d).toBeTruthy(); expect(d.meses).toBe(2); expect(d.msg).toMatch(/2 meses depois/);
    expect(c.metricas.plan.tirA).toBeLessThan(c.metricas.gab.tirA);
    // recebimento simples: só informa (sem campo para aplicar)
    const sug = A.comparaSugestoes(c, st, f).find(x => x.k === 'repasse');
    expect(sug).toBeTruthy(); expect(sug.set).toBeNull();
    // com o recebimento detalhado, sugere o repasse
    const sd = estado(A, { flx: { receb: { modo: 'det' } } }), md = A.compute(sd), fd = A.finance(sd, md), gd = A.comparaLinhasGab(fd);
    const L2 = { receita: gd.receita.slice(), obra: gd.obra.slice(), terreno: gd.terreno.slice(), indiretos: gd.indiretos.slice() };
    const pk = L2.receita.indexOf(Math.max(...L2.receita)), N2 = L2.receita.length + 4; const pd = a => { const x = a.slice(); while (x.length < N2) x.push(0); return x };
    Object.keys(L2).forEach(k => L2[k] = pd(L2[k])); const vv = L2.receita[pk]; L2.receita[pk] = 0; L2.receita[pk + 3] += vv;
    const c2 = A.comparaFluxo(planDe(L2), fd, { tma: sd.fin.tma }), s2 = A.comparaSugestoes(c2, sd, fd).find(x => x.k === 'repasse');
    expect(c2.divergencias.some(x => x.tipo === 'pico' && x.meses === 3)).toBe(true);
    expect(s2.set).toEqual([['flx.receb.repasseMes', sd.flx.receb.repasseMes + 3]]);
  });
  it('terreno diferente: sugere o preço do terreno', () => {
    const L = copia(); L.terreno[0] *= 1.2;
    const c = A.comparaFluxo(planDe(L), f, { tma: st.fin.tma });
    expect(c.divergencias.some(x => x.linha === 'terreno' && x.tipo === 'total')).toBe(true);
    const s = A.comparaSugestoes(c, st, f).find(x => x.k === 'terreno');
    expect(s.set[0][1]).toBeGreaterThan(st.fin.terreno);
  });
  it('INCC maior na planilha: custo da obra cresce mais rápido ao longo dos meses', () => {
    const L = copia(); L.obra = L.obra.map((v, t) => v * Math.pow(1.03, (t - f.launch) / 12));   // +3 p.p. a.a. de correção a mais
    const c = A.comparaFluxo(planDe(L), f, { tma: st.fin.tma });
    const d = c.divergencias.find(x => x.tipo === 'incc');
    expect(d).toBeTruthy();
    expect(Math.abs(d.pp - 0.03)).toBeLessThan(0.006);
    const s = A.comparaSugestoes(c, st, f).find(x => x.k === 'incc');
    expect(Math.abs(s.set[0][1] - (st.fin.incc + 0.03))).toBeLessThan(0.006);
  });
  it('deslocar a planilha por fora (alinhar os meses) volta a dar diferença zero', () => {
    const L = copia(), T = L.obra.length + 5, pad = a => { const x = a.slice(); while (x.length < T) x.push(0); return x };
    const des = { receita: desloca(pad(L.receita), 3), obra: desloca(pad(L.obra), 3), terreno: desloca(pad(L.terreno), 3), indiretos: desloca(pad(L.indiretos), 3) };
    const c0 = A.comparaFluxo(planDe(des), f, { tma: st.fin.tma });
    expect(c0.zero).toBe(false);
    const c = A.comparaFluxo(planDe(des), f, { tma: st.fin.tma, desl: -3 });
    expect(c.zero).toBe(true);
    expect(c.divergencias).toEqual([]);
  });
});

describe('leitura da planilha: meses, sinais e colunas', () => {
  it('meses em datas (jan/27) e custos negativos', () => {
    const mat = [['Competência', 'Recebimentos', 'Custo de obra', 'Saldo'], ['jan/27', '0', '-100', '-100'], ['fev/27', '50', '-120', '-70'], ['mar/27', '400', '-20', '380'], ['abr/27', '10', '0', '10']];
    const { cab, dados } = A.plaCabecalho(mat), mapa = A.comparaMapa(cab);
    expect(mapa.mes).toBe(0); expect(mapa.receita).toBe(1); expect(mapa.obra).toBe(2); expect(mapa.saldo).toBe(3);
    const p = A.comparaLer(dados, mapa);
    expect(p.ok).toBe(true); expect(p.T).toBe(4);
    expect(p.linhas.obra).toEqual([100, 120, 20, 0]);       // custos negativos viram positivos
    expect(p.linhas.saldo).toEqual([-100, -70, 380, 10]);
    expect(p.tem.terreno).toBe(false);
  });
  it('mês numérico começando em 1 vira mês 0; sem saldo calcula receitas − custos', () => {
    const mat = [['Mês', 'Receitas', 'Obra', 'Despesas'], ['1', '0', '10', '1'], ['2', '30', '10', '1'], ['3', '30', '0', '1']];
    const { cab, dados } = A.plaCabecalho(mat), mapa = A.comparaMapa(cab);
    expect(mapa.indiretos).toBe(3);
    const p = A.comparaLer(dados, mapa);
    expect(p.saldoCalculado).toBe(true);
    expect(p.linhas.saldo).toEqual([-11, 19, 29]);
  });
  it('só o saldo acumulado: converte para mensal', () => {
    const mat = [['Mês', 'Saldo acumulado'], ['0', '-100'], ['1', '-150'], ['2', '-120']];
    const { cab, dados } = A.plaCabecalho(mat), mapa = A.comparaMapa(cab);
    expect(mapa.acum).toBe(1); expect(mapa.saldo).toBe(-1);
    expect(A.comparaLer(dados, mapa).linhas.saldo).toEqual([-100, -50, 30]);
  });
  it('sem coluna de saldo nem receitas: recusa com motivo; planilha vazia não quebra', () => {
    const p = A.comparaLer([['1', '2']], { mes: 0, saldo: -1, acum: -1, receita: -1, obra: -1, terreno: -1, indiretos: -1 });
    expect(p.ok).toBe(false); expect(p.motivo).toMatch(/saldo/);
    expect(A.comparaLer([], { saldo: 0 }).ok).toBe(false);
    expect(A.comparaFluxo({ ok: false, motivo: 'x' }, f).ok).toBe(false);
  });
  it('planilha mais curta ou mais longa que o Gabarito, só com o saldo: compara o saldo', () => {
    const sal = gl.saldo.slice(0, 30).concat([0, 0]);
    const p = { ok: true, T: sal.length, linhas: { saldo: sal }, tem: {}, avisos: [] };
    const c = A.comparaFluxo(p, f, { tma: st.fin.tma });
    expect(c.ok).toBe(true);
    expect(c.linhas.map(l => l.k)).toEqual(['saldo']);
    expect(c.N).toBe(Math.max(gl.saldo.length, sal.length));
  });
  it('modelo de arquivo: o próprio importador lê as colunas', () => {
    const mat = A.plaCSV(A.comparaModeloCSV());
    expect(mat.length).toBe(2);
    const { cab, dados } = A.plaCabecalho(mat), mapa = A.comparaMapa(cab);
    ['mes', 'receita', 'obra', 'terreno', 'indiretos', 'saldo'].forEach(k => expect(mapa[k]).toBeGreaterThanOrEqual(0));
    const p = A.comparaLer(dados, mapa);
    expect(p.ok).toBe(true); expect(p.linhas.terreno[0]).toBe(13500000); expect(p.linhas.saldo[0]).toBe(-13680000);
  });
});
