// Fase A (docs/EVOLUCAO.md): indicadores da "Saúde do negócio" (src/calc/saude.js) e metas configuráveis (S.metas).
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { carregar, estado } from './harness.js';
vi.setConfig({ testTimeout: 180000, hookTimeout: 180000 });

let A, st, m, f, s;
beforeAll(async () => { A = carregar(); await new Promise(r => setTimeout(r, 20)); st = estado(A, {}); m = A.compute(st); f = A.finance(st, m); s = A.saudeNegocio(st, m, f) });

const mFalso = (o = {}) => ({ priv: 1000, privRes: 1000, constr: 2000, units: 20, unitsRes: 20, T: [{ pav: 12 }], lz: { c: 0, d: 0 }, ...o });
const stCom = (o = {}) => { const x = estado(A, o); return x };

describe('indicadores do estudo padrão', () => {
  it('eficiência global = privativa ÷ ATC (subsolos incluídos)', () => {
    expect(s.eficGlobal).toBeCloseTo(m.priv / m.constr, 10);
    expect(s.eficGlobal).toBeGreaterThan(0.3); expect(s.eficGlobal).toBeLessThan(0.7);
  });
  it('margem principal é s/ VGV e a margem s/ receita continua em f.margem', () => {
    expect(s.margemVGV).toBeCloseTo(f.lucro / f.vgv, 10);
    expect(f.margemVGV).toBeCloseTo(f.lucro / f.vgv, 10);
    expect(s.margemReceita).toBeCloseTo(f.margem, 12);
    expect(f.margemReceita).toBe(f.margem);
  });
  it('V/C principal contra CUB × fator e V/C contra o CUB puro', () => {
    const preco = f.vgvB / m.priv;
    expect(s.precoM2).toBeCloseTo(preco, 6);
    expect(s.vc).toBeCloseTo(preco / (st.fin.cub * st.fin.fator), 8);
    expect(s.vcCUB).toBeCloseTo(preco / st.fin.cub, 8);
    expect(s.vcCUB).toBeGreaterThan(s.vc);
  });
  it('estudo exemplo realista: terreno ≈ 15% do VGV e vagas atendidas', () => {
    expect(s.terrenoPctVGV).toBeGreaterThan(0.13); expect(s.terrenoPctVGV).toBeLessThanOrEqual(0.15);
    expect(m.vagas).toBeGreaterThanOrEqual(m.vagasReq);
    expect(s.nivel.terreno).toBe('ok');
  });
  it('custos indiretos e custo por m² de ATC', () => {
    const soft = f.projetos + f.adm + f.conting + f.corret + f.mkt + f.imp + f.itbi + f.outorga + f.juros;
    expect(s.softPctVGV).toBeCloseTo(soft / f.vgv, 10);
    expect(s.softPctVGV).toBeGreaterThan(0.1); expect(s.softPctVGV).toBeLessThan(0.3);
    expect(s.custoM2ATC).toBeCloseTo(f.obra / m.constr, 8);
  });
  it('TIR contra a TIR alvo e semáforos válidos', () => {
    expect(s.tirVsAlvo).toBeCloseTo(f.tirA - st.metas.tir.alvo, 10);
    for (const k of ['efic', 'margem', 'tir', 'vc', 'terreno', 'soft']) expect(['ruim', 'atencao', 'ok', 'otimo']).toContain(s.nivel[k]);
  });
  it('f.saude acompanha o finance (gancho) e é igual ao cálculo direto', () => {
    expect(f.saude).toBeTruthy();
    expect(f.saude.margemVGV).toBe(s.margemVGV); expect(f.saude.nivel).toEqual(s.nivel);
  });
  it('f.terreno continua preço+ITBI e agora há terrenoPreco e terrenoITBI', () => {
    expect(f.terrenoPreco).toBe(st.fin.terreno); expect(f.terrenoITBI).toBeCloseTo(st.fin.terreno * st.fin.itbi, 6);
    expect(f.terreno).toBeCloseTo(f.terrenoPreco + f.terrenoITBI, 6);
  });
  it('terreno máximo usa a margem alvo sobre o VGV', () => {
    const st2 = estado(A, {}); st2.fin.terreno = f.maxTerreno; const f2 = A.finance(st2, m);
    expect(f2.margemVGV).toBeCloseTo(st.fin.margemAlvo, 3);
  });
  it('resultado atravessa o clone estruturado (caminho do Worker / serial.js)', () => {
    expect(A.serialProblemas(s)).toEqual([]);
    expect(structuredClone(s).margemVGV).toBe(s.margemVGV);
    const mc = structuredClone(A.serialLimpa(m)); const s2 = A.saudeNegocio(st, mc, A.finance(st, mc));
    expect(s2.eficGlobal).toBeCloseTo(s.eficGlobal, 12); expect(s2.tipologia).toBe(s.tipologia);
  });
});

describe('novos padrões', () => {
  it('eqGar 0,8 · TMA 15% · margem alvo 25% · TIR alvo 25%', () => {
    expect(A.DEF.fin.eqGar).toBe(0.8); expect(A.DEF.fin.tma).toBe(0.15); expect(A.DEF.fin.margemAlvo).toBe(0.25); expect(A.DEF.metas.tir.alvo).toBe(0.25);
  });
  it('todas as metas moram em S.metas, com a sugestão da colinha', () => {
    const M = A.DEF.metas;
    expect(M.margem.min).toBe(0.20); expect(M.vc.min).toBe(2.5); expect(M.vc.bom).toBe(3.5); expect(M.terreno.ok).toBe(0.15); expect(M.terreno.max).toBe(0.20);
    expect(M.soft.min).toBe(0.18); expect(M.soft.max).toBe(0.22); expect(M.imprev.min).toBe(0.05);
    expect(M.efic.subsolo).toEqual([0.50, 0.58]); expect(M.efic.pavDedicado).toEqual([0.55, 0.62]); expect(M.efic.lazer).toEqual([0.45, 0.52]); expect(M.efic.walkup).toEqual([0.65, 0.75]); expect(M.efic.studios).toEqual([0.60, 0.68]);
  });
  it('estudo antigo (sem metas) abre com as metas padrão e preserva o que já tinha', () => {
    const velho = estado(A, { fin: { tma: 0.12, margemAlvo: 0.15 } });
    expect(velho.fin.tma).toBe(0.12); expect(velho.fin.margemAlvo).toBe(0.15);
    expect(velho.metas.tir.alvo).toBe(0.25);
    const parcial = estado(A, { metas: { margem: { min: 0.1 } } });
    expect(parcial.metas.margem.min).toBe(0.1); expect(parcial.metas.margem.otimo).toBe(0.30); expect(parcial.metas.efic.walkup).toEqual([0.65, 0.75]);
  });
});

describe('semáforos leem S.metas', () => {
  const nv = (k, v, x) => A.saudeNivel(k, v, x || st);
  it('margem: abaixo do mínimo ruim, até a meta atenção, na meta ok, ótima', () => {
    expect(nv('margem', 0.19)).toBe('ruim'); expect(nv('margem', 0.22)).toBe('atencao'); expect(nv('margem', 0.26)).toBe('ok'); expect(nv('margem', 0.31)).toBe('otimo');
  });
  it('metas customizadas mudam o semáforo (margem, TIR, V/C, terreno, soft, eficiência)', () => {
    const x = estado(A, {});
    expect(nv('margem', 0.22, x)).toBe('atencao');
    x.fin.margemAlvo = 0.20; x.metas.margem.min = 0.15; expect(nv('margem', 0.22, x)).toBe('ok');
    x.fin.margemAlvo = 0.25; x.metas.margem.min = 0.23; expect(nv('margem', 0.22, x)).toBe('ruim');
    const y = estado(A, {});
    expect(nv('tir', 0.20, y)).toBe('atencao'); y.metas.tir.alvo = 0.18; expect(nv('tir', 0.20, y)).toBe('ok'); y.fin.tma = 0.22; expect(nv('tir', 0.20, y)).toBe('ruim');
    const z = estado(A, {});
    expect(nv('vc', 3.0, z)).toBe('ok'); z.metas.vc.min = 3.2; expect(nv('vc', 3.0, z)).toBe('atencao'); z.metas.vc.min = 2.0; z.metas.vc.ruim = 1.5; z.metas.vc.bom = 2.9; expect(nv('vc', 3.0, z)).toBe('otimo');
    expect(nv('terreno', 0.17, z)).toBe('atencao'); z.metas.terreno.ok = 0.18; expect(nv('terreno', 0.17, z)).toBe('ok'); z.metas.terreno.max = 0.16; z.metas.terreno.ok = 0.10; expect(nv('terreno', 0.17, z)).toBe('ruim');
    const w = estado(A, {});
    expect(nv('soft', 0.20, w)).toBe('ok'); expect(nv('soft', 0.24, w)).toBe('atencao'); expect(nv('soft', 0.30, w)).toBe('ruim'); w.metas.soft.max = 0.30; expect(nv('soft', 0.30, w)).toBe('ok');
    expect(A.saudeNivel('efic', 0.54, w, { faixa: [0.50, 0.58] })).toBe('ok');
  });
  it('eficiência: a faixa vem da tipologia e muda com S.metas.efic', () => {
    const x = estado(A, {});
    const faixa = x.metas.efic.subsolo;
    expect(A.saudeNivel('efic', 0.40, x, { faixa })).toBe('ruim');
    expect(A.saudeNivel('efic', 0.47, x, { faixa })).toBe('atencao');
    expect(A.saudeNivel('efic', 0.55, x, { faixa })).toBe('ok');
    expect(A.saudeNivel('efic', 0.60, x, { faixa })).toBe('otimo');
    x.metas.efic.subsolo = [0.40, 0.45]; expect(A.saudeNegocio(x, m, f).faixaEfic).toEqual([0.40, 0.45]);
    expect(A.saudeNegocio(x, m, f).nivel.efic).toBe('otimo');
  });
  it('mesmo resultado, metas diferentes → semáforos diferentes (ponta a ponta)', () => {
    const x = estado(A, {}); const fx = A.finance(x, m); const antes = A.saudeNegocio(x, m, fx);
    x.fin.margemAlvo = antes.margemVGV - 0.01; x.metas.margem.min = antes.margemVGV - 0.02; x.metas.margem.otimo = 9;
    expect(A.saudeNegocio(x, m, fx).nivel.margem).toBe('ok');
    x.fin.margemAlvo = antes.margemVGV + 0.05; x.metas.margem.min = antes.margemVGV + 0.02;
    expect(A.saudeNegocio(x, m, fx).nivel.margem).toBe('ruim');
  });
  it('sem TIR (fluxo nunca fecha) → ruim, sem quebrar', () => {
    expect(A.saudeNivel('tir', null, st)).toBe('ruim'); expect(A.saudeNivel('margem', NaN, st)).toBe('ruim');
  });
});

describe('permuta e terreno', () => {
  it('permuta física conta como terreno equivalente (sem terreno em dinheiro)', () => {
    const x = estado(A, { fin: { terreno: 0, permuta: 0.15 } }); const fx = A.finance(x, m); const sx = A.saudeNegocio(x, m, fx);
    expect(sx.terrenoPctVGV).toBeCloseTo(0.15, 6);
    expect(sx.avisos.some(a => a.k === 'permutaDupla')).toBe(false);
  });
  it('permuta + terreno em dinheiro: soma os dois e avisa a possível contagem dupla', () => {
    const x = estado(A, { fin: { permuta: 0.15 } }); const fx = A.finance(x, m); const sx = A.saudeNegocio(x, m, fx);
    expect(sx.terrenoPctVGV).toBeCloseTo(0.15 + x.fin.terreno / fx.vgvB, 6);
    expect(sx.avisos.map(a => a.k)).toContain('permutaDupla');
  });
  it('permuta financeira também entra no terreno', () => {
    const x = estado(A, { fin: { terreno: 0, permutaFin: 0.10 } }); const fx = A.finance(x, m); const sx = A.saudeNegocio(x, m, fx);
    expect(sx.terrenoPctVGV).toBeGreaterThan(0.08);
  });
  it('avisos: custo financeiro desligado e contingência baixa', () => {
    const k = s.avisos.map(a => a.k); expect(k).toContain('semFinanc'); expect(k).toContain('imprev');
    const x = estado(A, { fin: { finOn: true, conting: 0.07 } }); const sx = A.saudeNegocio(x, m, A.finance(x, m));
    expect(sx.avisos.map(a => a.k)).not.toContain('semFinanc'); expect(sx.avisos.map(a => a.k)).not.toContain('imprev');
  });
});

describe('tipologia detectada', () => {
  const base = () => estado(A, {});
  it('studios · sem elevador · muito lazer · garagem em pavimento · subsolo', () => {
    expect(A.saudeTipologia(base(), mFalso({ privRes: 600, unitsRes: 20 }))).toBe('studios');
    expect(A.saudeTipologia(base(), mFalso({ T: [{ pav: 4 }] }))).toBe('walkup');
    expect(A.saudeTipologia(base(), mFalso({ lz: { c: 100, d: 40 } }))).toBe('lazer');          // 140 ÷ 2.000 = 7%
    const g = base(); g.produto.garAcima = 1; g.produto.subsolos = 0; expect(A.saudeTipologia(g, mFalso())).toBe('pavDedicado');
    const g2 = base(); g2.produto.subsolos = 0; g2.produto.garAcima = 0; expect(A.saudeTipologia(g2, mFalso())).toBe('pavDedicado');
    const sub = base(); sub.produto.subsolos = 2; expect(A.saudeTipologia(sub, mFalso())).toBe('subsolo');
    expect(A.saudeTipologia(sub, m)).toBe('subsolo');
  });
  it('os limites da detecção também são metas', () => {
    const x = base(); x.metas.deteccao.walkupPav = 12; expect(A.saudeTipologia(x, mFalso({ T: [{ pav: 12 }] }))).toBe('walkup');
    x.metas.deteccao.walkupPav = 4; x.metas.deteccao.lazerPct = 0.02; expect(A.saudeTipologia(x, mFalso({ lz: { c: 100, d: 0 } }))).toBe('lazer');
  });
  it('prioridade: studios vence sem elevador', () => {
    expect(A.saudeTipologia(base(), mFalso({ T: [{ pav: 3 }], privRes: 500, unitsRes: 20 }))).toBe('studios');
  });
});

describe('robustez', () => {
  it('sem divisão por zero com modelo vazio', () => {
    const x = estado(A, {}); const mv = mFalso({ priv: 0, privRes: 0, constr: 0, units: 0, unitsRes: 0, T: [] });
    const fv = { vgv: 0, vgvB: 0, lucro: 0, margem: 0, tirA: null, obra: 0, eqA: 0, terrenoPreco: 0 };
    const r = A.saudeNegocio(x, mv, fv);
    for (const k of ['eficGlobal', 'margemVGV', 'vc', 'vcCUB', 'terrenoPctVGV', 'softPctVGV', 'custoM2ATC']) expect(Number.isFinite(r[k])).toBe(true);
    expect(r.tirVsAlvo).toBeNull(); expect(r.nivel.tir).toBe('ruim');
  });
  it('CUB zero não gera Infinity', () => {
    const x = estado(A, {}); x.fin.cub = 0; const r = A.saudeNegocio(x, m, A.finance(x, m));
    expect(Number.isFinite(r.vc)).toBe(true); expect(Number.isFinite(r.vcCUB)).toBe(true);
  });
  it('orçamento paramétrico: o fator vem do custo calculado', () => {
    const x = estado(A, {}); x.orc.modo = 'param'; const fx = A.finance(x, m); const r = A.saudeNegocio(x, m, fx);
    expect(Number.isFinite(r.vc)).toBe(true); expect(r.vc).toBeGreaterThan(0);
  });
});

describe('padrão da empresa (localStorage gabarito.metas.padrao)', () => {
  it('salvar, restaurar sugeridas e voltar ao padrão da empresa', () => {
    const B = carregar(); const x = estado(B, {});
    expect(B.saudePadraoEmpresa()).toBeNull();
    x.metas.margem.min = 0.12; x.metas.efic.walkup = [0.6, 0.7]; x.fin.margemAlvo = 0.18; x.fin.tma = 0.11;
    expect(B.saudeSalvarPadrao(x)).toBe(true);
    expect(B.saudePadraoEmpresa().metas.margem.min).toBe(0.12);
    expect(B.DEF.metas.margem.min).toBe(0.12); expect(B.DEF.fin.tma).toBe(0.11);           // estudos novos herdam
    expect(estado(B, {}).metas.margem.min).toBe(0.12);
    B.saudeAplicarSugeridas(x);
    expect(x.metas.margem.min).toBe(0.20); expect(x.metas.efic.walkup).toEqual([0.65, 0.75]); expect(x.fin.tma).toBe(0.15); expect(x.fin.margemAlvo).toBe(0.25);
    expect(B.saudeAplicarPadrao(x)).toBe(true);
    expect(x.metas.margem.min).toBe(0.12); expect(x.metas.efic.walkup).toEqual([0.6, 0.7]); expect(x.fin.tma).toBe(0.11); expect(x.fin.margemAlvo).toBe(0.18);
  });
});
