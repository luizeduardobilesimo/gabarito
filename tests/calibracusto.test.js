// Fase E (custos): CUB por estado com mês e fonte, calibração do custo com obras reais (src/calc/calibracusto.js),
// soft costs que faltavam (src/calc/indiretos.js) e lucro após imprevistos (src/calc/saude.js).
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { carregar, estado } from './harness.js';
vi.setConfig({ testTimeout: 180000, hookTimeout: 180000 });

let A, st, m, f;
beforeAll(async () => { A = carregar(); await new Promise(r => setTimeout(r, 20)); st = estado(A, {}); m = A.compute(st); f = A.finance(st, m) });

/* gerador pseudoaleatório determinístico */
const rng = (seed) => () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296 };
/* obras sintéticas: custo = CUB × fator × (torre + lazer + eqGar × garagem) × (1 + ruído) */
function obrasSinteticas(n, { fator, eqGar, ruido = 0, seed = 7 }) {
  const r = rng(seed), obras = [];
  for (let i = 0; i < n; i++) {
    const torre = 4000 + r() * 9000, garagem = 800 + r() * 5000, lazer = 100 + r() * 700, cub = 2400 + r() * 500;
    const custo = cub * fator * (torre + lazer + eqGar * garagem) * (1 + (r() - 0.5) * 2 * ruido);
    obras.push({ nome: 'Obra ' + (i + 1), cub, priv: torre * 0.8, torre, garagem, lazer, custo });
  }
  return obras;
}

describe('CUB por estado: mês de referência e fonte', () => {
  it('SC, RS, PR, SP, MG têm o boletim completo com mês e fonte; os valores são os publicados', () => {
    for (const uf of ['SC', 'RS', 'PR', 'SP', 'MG']) {
      const r = A.cubLinha(st, uf);
      expect(r.ilustrativo, uf).toBe(false);
      expect(r.ref, uf).toMatch(/^2026-\d{2}$/);
      expect(r.fonte.length, uf).toBeGreaterThan(5);
      expect(r.url, uf).toMatch(/^https:\/\//);
      expect(r.est, uf).toEqual([]);
      for (const p of ['R1-B', 'R1-N', 'R1-A', 'PP-4-B', 'PP-4-N', 'R8-B', 'R8-N', 'R8-A', 'R16-N', 'R16-A', 'PIS']) expect(r.v[p], uf + ' ' + p).toBeGreaterThan(1000);
    }
    expect(A.cubValor(st, 'SC', 'R8-N')).toBeCloseTo(2800.40, 2);
    expect(A.cubValor(st, 'RS', 'R8-N')).toBeCloseTo(2943.73, 2);
    expect(A.cubValor(st, 'PR', 'R8-N')).toBeCloseTo(2738.93, 2);
    expect(A.cubValor(st, 'SP', 'R8-N')).toBeCloseTo(2238.58, 2);
    expect(A.cubValor(st, 'MG', 'R8-N')).toBeCloseTo(2561.78, 2);
  });
  it('estados só com o R8-N publicado estimam os outros padrões (e dizem isso); sem boletim fica ilustrativo', () => {
    const rj = A.cubLinha(st, 'RJ');
    expect(rj.ilustrativo).toBe(false); expect(rj.v['R8-N']).toBeCloseTo(2476.31, 2); expect(rj.est).toContain('R16-N'); expect(rj.est).not.toContain('R8-N');
    expect(A.cubDescricao(st, 'RJ', 'R16-N')).toMatch(/estimado/);
    expect(A.cubDescricao(st, 'RJ', 'R8-N')).not.toMatch(/estimado|ilustrativo/);
    const es = A.cubLinha(st, 'ES');
    expect(es.ilustrativo).toBe(true); expect(A.cubDescricao(st, 'ES', 'R8-N')).toMatch(/ilustrativo/);
  });
  it('descrição no formato "CUB <UF> <padrão> · <mês/ano> · <fonte>"', () => {
    expect(A.cubDescricao(st, 'SC', 'R8-N')).toMatch(/^CUB SC R8-N · ago\/2026 · Sinduscon Grande Florianópolis/);
    expect(A.cubDescricao(st, 'PR', 'R16-N')).toMatch(/^CUB PR R16-N · set\/2026 · Sinduscon-PR$/);
    expect(A.cubRefTxt('2026-09')).toBe('set/2026'); expect(A.cubRefTxt('texto livre')).toBe('texto livre');
  });
  it('a tabela tem versão com data', () => { expect(A.CUB_VERSAO).toMatch(/^\d{4}-\d{2}-\d{2}$/) });
  it('seguir a tabela do estado: desligado não mexe; ligado troca o CUB pelo do estado e padrão', () => {
    const s0 = estado(A, {}); expect(A.cubSincroniza(s0)).toBe(false); expect(s0.fin.cub).toBe(3159);
    const s1 = estado(A, { orc: { cubAuto: true, uf: 'PR', padrao: 'R16-N' } });
    expect(A.cubSincroniza(s1)).toBe(true); expect(s1.fin.cub).toBeCloseTo(2657.44, 2);
    expect(A.cubSincroniza(s1)).toBe(false);                       // já está em dia
    s1.orc.uf = 'RS'; s1.orc.padrao = 'R8-N'; A.cubSincroniza(s1); expect(s1.fin.cub).toBeCloseTo(2943.73, 2);
  });
  it('estado sugerido pela zona escolhida em Regras', () => {
    const c = A.cidadesLista().find(x => x.uf === 'PR');
    const s1 = estado(A, { regrasRef: { id: c.id } });
    expect(A.cubUfSugerida(s1)).toBe('PR');
    s1.orc.uf = 'PR'; expect(A.cubUfSugerida(s1)).toBeNull();
    expect(A.cubUfSugerida(estado(A, {}))).toBeNull();
  });
  it('importação continua valendo por cima da tabela embutida e tira o aviso de estimado', () => {
    const csv = A.cubParse('uf;padrao;valor;ref;fonte\nRJ;R16-N;2400,00;2026-10;Sinduscon-RJ');
    const s1 = estado(A, { orc: { cubTab: csv } });
    expect(A.cubValor(s1, 'RJ', 'R16-N')).toBe(2400);
    expect(A.cubLinha(s1, 'RJ').est).not.toContain('R16-N'); expect(A.cubLinha(s1, 'RJ').est).toContain('R1-N');
  });
});

describe('ccalCusto', () => {
  it('recupera fator e peso da garagem de obras sintéticas sem ruído', () => {
    const obras = obrasSinteticas(5, { fator: 1.31, eqGar: 0.72 });
    const r = A.ccalCusto(obras, o => o.cub);
    expect(r.modo).toBe('fator+garagem'); expect(r.n).toBe(5);
    expect(r.fator).toBeCloseTo(1.31, 4); expect(r.eqGar).toBeCloseTo(0.72, 4);
    expect(r.r2).toBeCloseTo(1, 6); expect(r.erroMedio).toBeLessThan(1e-6);
  });
  it('com ruído de ±2% recupera dentro de 5%', () => {
    for (const seed of [3, 11, 29]) {
      const r = A.ccalCusto(obrasSinteticas(8, { fator: 1.28, eqGar: 0.65, ruido: 0.02, seed }), o => o.cub);
      expect(Math.abs(r.fator / 1.28 - 1), 'fator seed ' + seed).toBeLessThan(0.05);
      expect(Math.abs(r.eqGar / 0.65 - 1), 'eqGar seed ' + seed).toBeLessThan(0.12);
      expect(r.r2).toBeGreaterThan(0.97); expect(r.erros.length).toBe(8);
      expect(r.erroMedio).toBeLessThan(0.03);
    }
  });
  it('uma obra só ajusta o fator e deixa o peso da garagem como está', () => {
    const [o] = obrasSinteticas(1, { fator: 1.4, eqGar: 0.8 });
    const r = A.ccalCusto([o], x => x.cub, { eqGar: 0.8, fator: 1.2 });
    expect(r.modo).toBe('fator'); expect(r.eqGar).toBe(0.8); expect(r.fator).toBeCloseTo(1.4, 6); expect(r.r2).toBeNull();
    expect(r.avisos.join(' ')).toMatch(/uma obra/i);
  });
  it('garagem proporcional à torre: não separa, ajusta só o fator e avisa', () => {
    const obras = [1, 2, 3].map(k => ({ nome: 'O' + k, torre: 4000 * k, garagem: 1000 * k, lazer: 0, cub: 2500, custo: 2500 * 1.3 * (4000 * k + 0.8 * 1000 * k) }));
    const r = A.ccalCusto(obras, o => o.cub, { eqGar: 0.8 });
    expect(r.modo).toBe('fator'); expect(r.fator).toBeCloseTo(1.3, 4); expect(r.avisos.join(' ')).toMatch(/proporcional/);
  });
  it('peso da garagem fora do limite trava e refaz o fator; fora da faixa da NBR só avisa', () => {
    const lim = A.ccalCusto(obrasSinteticas(5, { fator: 1.2, eqGar: 1.6 }), o => o.cub);
    expect(lim.eqGar).toBeCloseTo(A.CCAL_FAIXAS.eqGar.max, 6); expect(lim.avisos.join(' ')).toMatch(/limite/);
    const nbr = A.ccalCusto(obrasSinteticas(5, { fator: 1.2, eqGar: 0.4 }), o => o.cub);
    expect(nbr.eqGar).toBeCloseTo(0.4, 4); expect(nbr.avisos.join(' ')).toMatch(/NBR 12\.721/);
  });
  it('obras sem custo, área ou CUB entram em "ignoradas"; o CUB vem da tabela do estado e padrão por cubDe', () => {
    const obras = [{ nome: 'sem custo', torre: 1000, cub: 2500 }, { nome: 'sem área', custo: 1e6, cub: 2500 }, { nome: 'sem cub', torre: 1000, custo: 1e6 },
      { nome: 'boa', torre: 5000, garagem: 1000, custo: 2800.4 * 1.3 * (5000 + 0.8 * 1000), uf: 'SC', padrao: 'R8-N' }];
    const r = A.ccalCusto(obras, o => o.cub > 0 ? o.cub : A.cubValor(st, o.uf, o.padrao));
    expect(r.ignoradas.map(i => i.nome)).toEqual(['sem custo', 'sem área', 'sem cub']);
    expect(r.erros.map(e => e.nome)).toEqual(['boa']); expect(r.erros[0].cub).toBeCloseTo(2800.4, 2);
  });
  it('aplica ao estudo: fator sempre, eqGar só quando foi ajustado', () => {
    const s1 = estado(A, {}), r = A.ccalCusto(obrasSinteticas(4, { fator: 1.33, eqGar: 0.7 }), o => o.cub);
    const mud = A.ccalAplica(s1, r); expect(s1.fin.fator).toBeCloseTo(1.33, 3); expect(s1.fin.eqGar).toBeCloseTo(0.7, 3); expect(mud.fator[0]).toBe(1.2);
    const s2 = estado(A, {}), r1 = A.ccalCusto([obrasSinteticas(1, { fator: 1.5, eqGar: 0.8 })[0]], o => o.cub, { eqGar: 0.8 });
    A.ccalAplica(s2, r1); expect(s2.fin.fator).toBeCloseTo(1.5, 3); expect(s2.fin.eqGar).toBe(0.8);
  });
  it('a obra do estudo, calibrada com o próprio custo, devolve o fator usado', () => {
    // o estudo padrão vira "obra real": o custo sai do CUB × fator do próprio estudo
    const torre = m.tiposA + m.duplexA + m.hallA + m.lojaA + m.aticoA + (m.sacBal || 0) * 0.5, lazer = m.lzExtraA || 0;
    const custo = st.fin.cub * st.fin.fator * (torre + lazer + st.fin.eqGar * m.garA);
    const r = A.ccalCusto([{ nome: 'estudo', torre, lazer, garagem: m.garA, custo, cub: st.fin.cub }], o => o.cub, { eqGar: st.fin.eqGar });
    expect(r.fator).toBeCloseTo(st.fin.fator, 6);
  });
  it('modo paramétrico: escala os 3 coeficientes de maior peso até bater com CUB × fator calibrado', () => {
    const sp = estado(A, { orc: { modo: 'param' } }), mp = A.compute(sp);
    const res = { modo: 'fator+garagem', fator: 1.35, eqGar: 0.75 };
    const p = A.ccalParam(sp, mp, res);
    expect(p.chaves.length).toBe(3); expect(p.s).toBeGreaterThanOrEqual(0.5); expect(p.s).toBeLessThanOrEqual(2);
    const s2 = estado(A, { orc: { modo: 'param', coef: p.coef } }); const o2 = A.orcCalc(s2, mp);
    expect(o2.direto).toBeCloseTo(p.alvo, -2);
  });
  it('importação CSV com cabeçalhos livres e meses em vários formatos', () => {
    const o = A.ccalParse('Obra;Mês/Ano;Estado;Padrão;CUB;Área privativa;Área da torre;Garagem/subsolo;Lazer coberto;Custo realizado\nEd. A;03/2025;sc;R8N;2.650,00;5.200;8.400;3.100;450;32.500.000');
    expect(o.length).toBe(1);
    expect(o[0]).toMatchObject({ nome: 'Ed. A', ref: '2025-03', uf: 'SC', padrao: 'R8-N', cub: 2650, priv: 5200, torre: 8400, garagem: 3100, lazer: 450, custo: 32500000 });
    expect(A.ccalRef('mar/2026')).toBe('2026-03'); expect(A.ccalRef('2026-3')).toBe('2026-03');
    expect(A.ccalParse(A.CCAL_MODELO_CSV).length).toBe(1);
    expect(A.ccalParse('a;b\n1;2')).toEqual([]);
  });
});

describe('custos indiretos que faltavam', () => {
  it('desligados (padrão): números idênticos e nenhum item', () => {
    expect(f.soft).toBe(0); expect(f.softItens).toEqual([]); expect(A.softLigado(st)).toBe(false);
    expect(f.c.soft.every(v => v === 0)).toBe(true);
  });
  it('"usar sugeridos" liga todos e eles somam no total, no fluxo e na Saúde', () => {
    const s1 = estado(A, {}); A.softSugeridos(s1);
    expect(A.softLigado(s1)).toBe(true);
    const f1 = A.finance(s1, m);
    expect(f1.softItens.length).toBe(6);
    expect(f1.soft).toBeGreaterThan(0);
    expect(f1.soft).toBeCloseTo(f1.softItens.reduce((a, i) => a + i.valor, 0), 4);
    expect(f1.c.soft.reduce((a, v) => a + v, 0)).toBeCloseTo(f1.soft, 4);
    expect(f1.custo - f.custo).toBeCloseTo(f1.soft, 2);                       // o custo total sobe exatamente o que os itens somam
    expect(f.lucro - f1.lucro).toBeCloseTo(f1.soft, 2);
    expect(f1.saude.softPctVGV).toBeGreaterThan(f.saude.softPctVGV);
    expect(f1.saude.soft - f.saude.soft).toBeCloseTo(f1.soft, 2);
    expect(f1.cf.length).toBe(f.cf.length + A.SOFT_POS_MESES);              // a assistência pós-obra estende o fluxo
  });
  it('cada item é a base × percentual, no mês certo', () => {
    const base = { registro: 0.01, seguros: 0, iptu: 0, juridico: 0, pos: 0, gestao: 0 };
    let s1 = estado(A, { soft: base }); let f1 = A.finance(s1, m);
    expect(f1.soft).toBeCloseTo(f1.vgv * 0.01, 2);
    expect(f1.c.soft[f1.launch - 1]).toBeCloseTo(f1.vgv * 0.005, 2); expect(f1.c.soft[f1.chaves]).toBeCloseTo(f1.vgv * 0.005, 2);
    s1 = estado(A, { fin: { incc: 0 }, soft: { ...base, registro: 0, seguros: 0.02, pos: 0.03 } }); f1 = A.finance(s1, m);
    expect(f1.softItens.find(i => i.k === 'seguros').valor).toBeCloseTo(f1.obra * 0.02, 2);
    expect(f1.softItens.find(i => i.k === 'pos').valor).toBeCloseTo(f1.obra * 0.03, 2);
    expect(f1.c.soft.slice(0, f1.chaves).reduce((a, v) => a + v, 0)).toBeCloseTo(f1.obra * 0.02, 2);                 // seguros durante a obra
    expect(f1.c.soft.slice(f1.chaves).reduce((a, v) => a + v, 0)).toBeCloseTo(f1.obra * 0.03, 2);                    // pós-obra depois das chaves
    s1 = estado(A, { soft: { ...base, registro: 0, iptu: 0.012 } }); f1 = A.finance(s1, m);
    expect(f1.soft).toBeCloseTo(s1.fin.terreno * 0.012 * (f1.chaves / 12), 2);
  });
  it('as faixas e os sugeridos estão em tabela e os sugeridos ficam dentro das faixas', () => {
    for (const k of Object.keys(A.SOFT_SUGERIDOS)) {
      const [a, b] = A.SOFT_FAIXAS[k]; expect(A.SOFT_SUGERIDOS[k], k).toBeGreaterThanOrEqual(a); expect(A.SOFT_SUGERIDOS[k], k).toBeLessThanOrEqual(b);
    }
  });
});

describe('lucro após imprevistos (informativo)', () => {
  it('não muda o lucro principal; desconta a diferença até a meta de imprevistos', () => {
    const M = st.metas.imprev, ob = f.obra * (f.obraTot / (f.obra + f.adm + f.conting));
    expect(f.imprevistos.min.meta).toBe(M.min); expect(f.imprevistos.max.meta).toBe(M.max);
    expect(f.imprevistos.min.extra).toBeCloseTo(Math.max(0, M.min - st.fin.conting) * ob, 2);
    expect(f.imprevistos.min.lucro).toBeCloseTo(f.lucro - f.imprevistos.min.extra, 2);
    expect(f.imprevistos.max.lucro).toBeLessThan(f.imprevistos.min.lucro);
    expect(f.lucro).toBeCloseTo(A.finance(st, m).lucro, 6);
  });
  it('contingência já acima da meta: nada a descontar', () => {
    const s1 = estado(A, { fin: { conting: 0.12 } }), f1 = A.finance(s1, m);
    expect(f1.imprevistos.min.extra).toBe(0); expect(f1.imprevistos.max.extra).toBe(0); expect(f1.imprevistos.max.lucro).toBe(f1.lucro);
  });
  it('as metas vêm de S.metas', () => {
    const s1 = estado(A, { metas: { imprev: { min: 0.08, max: 0.15 } } }), f1 = A.finance(s1, m);
    expect(f1.imprevistos.min.meta).toBe(0.08); expect(f1.imprevistos.max.extra).toBeGreaterThan(f1.imprevistos.min.extra);
  });
});
