// Itens 3.1–3.3: orçamento paramétrico, CUB, curva de obra, recebimento detalhado, cenários, Monte Carlo e terreno.
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { carregar, estado, cenarios } from './harness.js';
vi.setConfig({ testTimeout: 180000, hookTimeout: 180000 });   // compute() completo com todos os módulos é lento

/* cópia fiel da finance() anterior aos itens 3.x — o padrão tem de reproduzir estes números exatamente */
function financeOriginal(st, m, adj = {}) {
  const F=st.fin, R=st.regras, P=st.produto, dp=adj.dp||0, dc=adj.dc||0;
  const eqA = m.tiposA + m.duplexA + m.hallA + m.lojaA + m.aticoA + (m.lzExtraA||0) + m.garA*F.eqGar + (m.sacBal||0)*0.5;
  const lazerC = (m.lzCusto||0)*(1+dc);
  const extraC = (m.custosExtra||[]).reduce((s,x)=>s+(+x.valor||0),0)*(1+dc);
  const obra = eqA*F.cub*F.fator*(1+dc) + lazerC + extraC;
  const vRes = m.vgvUnidades!=null ? m.vgvUnidades : m.unitRows.reduce((s,u)=>s+u.area*u.preco,0) + m.cobArea*P.cob.preco;
  const vLoja = m.lojaPriv*F.precoLoja;
  const vgvB = (vRes+vLoja)*(1+dp), permV = vgvB*F.permuta, vgv = vgvB-permV;
  const terreno=F.terreno, itbi=terreno*F.itbi, outorga=m.outA*R.outorgaRS;
  const terra = m.terra*st.lote.custoTerra*(1+dc);
  const projetos=obra*F.projetos, adm=obra*F.adm, conting=obra*F.conting;
  const launch=Math.round(F.prelanc), N=Math.max(1,Math.round(F.obra)), chaves=launch+N, V=Math.max(1,Math.round(F.venda));
  const T=Math.max(chaves, launch+V)+2;
  const z=()=>new Array(T).fill(0);
  const c={terreno:z(),outorga:z(),projetos:z(),obra:z(),terra:z(),mkt:z(),corret:z(),imp:z(),permFin:z(),juros:z(),receb:z(),finIn:z(),finOut:z()};
  const fI = mm => Math.pow(1+F.incc, mm/12);
  c.terreno[0] = terreno+itbi; c.outorga[Math.min(3,T-1)] = outorga;
  for(let k=0;k<Math.max(1,launch);k++) c.projetos[k] = projetos/Math.max(1,launch);
  for(let k=0;k<Math.min(3,N);k++) c.terra[launch+k] = terra/Math.min(3,N)*fI(launch+k);
  let wsum=0; const w=[]; for(let k=0;k<N;k++){ w[k]=Math.sin(Math.PI*(k+.5)/N); wsum+=w[k] }
  for(let k=0;k<N;k++) c.obra[launch+k] = (obra+adm+conting)*w[k]/wsum*fI(launch+k);
  const mStart=Math.max(0,launch-2), mLen=V+2; for(let k=0;k<mLen;k++) c.mkt[mStart+k] = vgv*F.mkt/mLen;
  const sold=[]; for(let k=0;k<V;k++) sold[k]=(k===0?F.vendaLanc:0)+(1-F.vendaLanc)/V;
  const soldCum=z(); let sc=0;
  for(let k=0;k<V;k++){
    const mth=launch+k, val=vgv*sold[k]*Math.pow(1+F.reaj, k/12); sc+=sold[k]; soldCum[mth]=sc;
    c.corret[mth] += val*F.corret;
    const corr = j => F.correcao ? Math.pow(1+F.incc,(j-mth)/12) : 1;
    if(mth<chaves){ const nP=chaves-mth; for(let j=0;j<nP;j++) c.receb[mth+j]+=val*F.entrada/nP*corr(mth+j); c.receb[chaves]+=val*(1-F.entrada)*corr(chaves) }
    else c.receb[mth]+=val;
  }
  for(let i=1;i<T;i++) if(!soldCum[i]) soldCum[i]=soldCum[i-1];
  for(let i=0;i<T;i++){ c.imp[i]=c.receb[i]*F.imp; c.permFin[i]=c.receb[i]*F.permutaFin }
  let saldo=0; const lim = F.finOn ? (obra+adm+conting)*F.finPct : 0, tm=Math.pow(1+F.finTaxa,1/12)-1; let liberado=0;
  if(F.finOn){
    for(let i=0;i<T;i++){
      c.juros[i]=saldo*tm;
      if(i<chaves && soldCum[i]>=F.finVendaMin && c.obra[i]>0){ const d=Math.min(c.obra[i]*F.finPct*1.0, lim-liberado); if(d>0){ c.finIn[i]=d; liberado+=d; saldo+=d } }
      if(i===chaves && saldo>0){ c.finOut[i]=saldo; saldo=0 }
    }
  }
  const cf=z();
  for(let i=0;i<T;i++) cf[i] = c.receb[i] + c.finIn[i] - c.terreno[i]-c.outorga[i]-c.projetos[i]-c.obra[i]-c.terra[i]-c.mkt[i]-c.corret[i]-c.imp[i]-c.permFin[i]-c.juros[i]-c.finOut[i];
  const sum=a=>a.reduce((s,v)=>s+v,0);
  const custo = sum(c.terreno)+sum(c.outorga)+sum(c.projetos)+sum(c.obra)+sum(c.terra)+sum(c.mkt)+sum(c.corret)+sum(c.imp)+sum(c.permFin)+sum(c.juros);
  const receita=sum(c.receb), lucro = receita - custo;
  const npv = r => cf.reduce((s,v,i)=>s+v/Math.pow(1+r,i),0);
  let tirM=null; { let lo=-0.5, hi=1; const a=npv(lo), b=npv(hi); if(a*b<0){ for(let i=0;i<100;i++){ const mid=(lo+hi)/2; (npv(lo)*npv(mid)<=0)? hi=mid : lo=mid } tirM=(lo+hi)/2 } }
  return { obra, receita, lucro, cf, tirA: tirM===null? null : Math.pow(1+tirM,12)-1, vpl: npv(Math.pow(1+F.tma,1/12)-1) };
}

let A, st, m, f;
beforeAll(async () => { A = carregar(); await new Promise(r => setTimeout(r, 20)); st = estado(A, {}); m = A.compute(st); f = A.finance(st, m) });
const soma = a => a.reduce((s, v) => s + v, 0);
const REF = new Map();   // cada estudo de referência é calculado uma vez só (compute completo é lento)
const tick = () => new Promise(r => setTimeout(r, 20));   // devolve o laço de eventos ao vitest entre cálculos pesados
const ref = async c => { await tick(); if (!REF.has(c.arquivo)) { const s = estado(A, c.S); REF.set(c.arquivo, { B: A, s, mm: A.compute(s) }) } return REF.get(c.arquivo) };

describe('métricas de fluxo', () => {
  it('fluxo conhecido → TIR e VPL esperados', () => {
    const cf = new Array(13).fill(0); cf[0] = -100; cf[12] = 110;           // 10% em 12 meses
    const r = A.flxMetricas(cf, 0.10);
    expect(r.tirA).toBeCloseTo(0.10, 6);
    expect(Math.abs(r.vpl)).toBeLessThan(1e-6);                              // à própria TIR o VPL é zero
    expect(A.flxMetricas(cf, 0).vpl).toBeCloseTo(10, 9);                     // a 0% = soma
    const cf2 = [-1000, ...new Array(24).fill(50)];                          // anuidade
    const r2 = A.flxMetricas(cf2, 0.12), im = Math.pow(1 + r2.tirA, 1 / 12) - 1;
    expect(soma(cf2.map((v, i) => v / Math.pow(1 + im, i)))).toBeCloseTo(0, 4);
    expect(r2.exp).toBe(-1000);
  });
});

describe('padrão = números atuais', () => {
  it('exemplo: finance() idêntica à original com os padrões', () => {
    const o = financeOriginal(st, m);
    expect(f.lucro).toBe(o.lucro); expect(f.receita).toBe(o.receita); expect(f.obra).toBe(o.obra);
    expect(f.tirA).toBe(o.tirA); expect(f.vpl).toBe(o.vpl); expect(f.cf).toEqual(o.cf);
  });
  for (const c of cenarios()) it('referência: ' + c.nome, async () => {
    const { B, s, mm } = await ref(c); const a = B.finance(s, mm), o = financeOriginal(s, mm);
    expect(a.lucro).toBe(o.lucro); expect(a.tirA).toBe(o.tirA);
    // sensibilidade também igual
    expect(B.finance(s, mm, { dp: 0.1, dc: -0.1 }).lucro).toBe(financeOriginal(s, mm, { dp: 0.1, dc: -0.1 }).lucro);
  });
  it('com financiamento e permutas também igual', () => {
    const s = estado(A, { fin: { finOn: true, permuta: 0.1, permutaFin: 0.03, correcao: false } });
    expect(A.finance(s, m).lucro).toBe(financeOriginal(s, m).lucro);
  });
});

describe('3.1 orçamento paramétrico', () => {
  it('paramétrico a ±12% do método atual (todos os estudos de referência)', async () => {   // era ±10% com garagem 0,55; com eqGar 0,8 (Fase A) o CUB × fator sobe nos estudos com mais subsolo
    for (const c of cenarios()) {
      const { B, s, mm } = await ref(c);
      const atual = B.finance(s, mm).obra, sp = estado(B, { ...c.S, orc: { modo: 'param' } }), par = B.finance(sp, mm).obra;
      expect(Math.abs(par / atual - 1), c.nome).toBeLessThan(0.12);
    }
  });
  it('cada coeficiente é editável e mexe no total', () => {
    const base = A.orcCalc(st, m).total;
    for (const k of Object.keys(A.DEF.orc.coef)) {
      const s = estado(A, { orc: { coef: { [k]: A.DEF.orc.coef[k] * 1.5 } } });
      const o = A.orcCalc(s, m);
      if (k === 'cont' && !o.drivers.contArea) continue;
      expect(o.total, k).toBeGreaterThan(base);
    }
  });
  it('custos extras de outros módulos entram no sistema certo e na obra', () => {
    const mm = { ...m, custosExtra: [{ k: 't', nome: 'Transição', sistema: 'estrutura', valor: 500000 }, { k: 'ev', nome: 'Recarga EV', sistema: 'instalações', valor: 120000 }, { k: 'c', nome: 'Cortina', sistema: 'contenção', valor: 800000 }] };
    const o = A.orcCalc(st, mm), it = k => o.itens.find(i => i.k === k);
    expect(it('estr').extra).toBe(500000); expect(it('inst').extra).toBe(120000); expect(it('cont').extra).toBe(800000);
    expect(it('cont').param).toBe(0);                                         // contenção já calculada fora: não duplica
    const sp = estado(A, { orc: { modo: 'param' } });
    const contP = A.orcCalc(sp, m).itens.find(i => i.k === 'cont').param, K = A.orcCalc(sp, m).coef;
    expect(A.finance(sp, mm).obra - A.finance(sp, m).obra).toBeCloseTo(1420000 - contP * (1 + K.cant), 0);
  });
  it('fundação responde ao solo e fachada ao padrão', () => {
    const g = (o) => A.orcCalc(estado(A, { orc: o }), m).itens;
    expect(g({ solo: 'ruim' }).find(i => i.k === 'fund').total).toBeGreaterThan(g({ solo: 'bom' }).find(i => i.k === 'fund').total);
    expect(g({ fachada: 'vidro' }).find(i => i.k === 'fach').total).toBeGreaterThan(g({ fachada: 'textura' }).find(i => i.k === 'fach').total);
  });
  it('tabela CUB: embutida ilustrativa + importação CSV e JSON', () => {
    expect(A.cubValor(st, 'SC', 'R8-N')).toBe(3159);
    expect(A.cubLinha(st, 'SC').ilustrativo).toBe(true);
    const csv = A.cubParse('uf;padrao;valor;ref;fonte\nSC;R8-N;3.201,55;2026-10;Sinduscon-Grande Florianópolis\nSC;R16-A;3900\nXX;R8-N;1000');
    expect(csv.find(r => r.uf === 'SC').v['R8-N']).toBeCloseTo(3201.55, 2);
    const largo = A.cubParse('uf;ref;fonte;R8-N;R16-N\nPR;2026-10;Sinduscon-PR;2700,10;2600');
    expect(largo[0].v['R16-N']).toBe(2600); expect(largo[0].v['R8-N']).toBeCloseTo(2700.1, 2);
    const s = estado(A, { orc: { cubTab: csv } });
    expect(A.cubValor(s, 'SC', 'R8-N')).toBeCloseTo(3201.55, 2);
    expect(A.cubLinha(s, 'SC').ilustrativo).toBe(false);
    expect(A.cubValor(s, 'SC', 'R16-N')).toBeGreaterThan(0);                  // padrão ausente cai na embutida
    const js = A.cubParse(JSON.stringify({ RS: { 'R8-N': 3000, ref: '2026-10' } }));
    expect(js[0].uf).toBe('RS'); expect(js[0].v['R8-N']).toBe(3000);
  });
});

describe('3.2 curva de obra', () => {
  for (const modo of ['s', 'sis']) it(`curva ${modo} soma o total da obra`, () => {
    const s = estado(A, { fin: { incc: 0 }, flx: { curva: { modo, ini: 0.05, pico: 0.4, fim: 0.95 } } });
    const a = A.finance(s, m);
    expect(soma(a.c.obra)).toBeCloseTo(a.obra + a.adm + a.conting, 2);
    const N = s.fin.obra, w = A.flxCurva(s, m, N, null).w;
    expect(soma(w)).toBeCloseTo(1, 10);
    // acumulado em S: começa devagar, termina devagar
    expect(w[0]).toBeLessThan(Math.max(...w) / 2); expect(w[N - 1]).toBeLessThan(Math.max(...w) / 2);
    if (modo === 'sis') expect(soma(a.c.obraSis.map(x => soma(x.v)))).toBeCloseTo(a.obra + a.adm + a.conting, 2);
  });
  it('pico da curva S no lugar pedido', () => {
    const w = A.flxForma(30, 0, 1, 0.3), k = w.indexOf(Math.max(...w));
    expect(Math.abs((k + 0.5) / 30 - 0.3)).toBeLessThan(0.05);
  });
});

describe('3.2 recebimento detalhado', () => {
  const base = { fin: { incc: 0, reaj: 0 }, flx: { receb: { modo: 'det', ipca: 0, ato: 0.1, mensais: 0.2, interm: 0.1, chaves: 0.05, pos: 0.05, posN: 12, repasseMes: 2 } } };
  it('sem correção, recebimentos somam o VGV', () => {
    const a = A.finance(estado(A, base), m);
    expect(a.receita).toBeCloseTo(a.vgv, 2);
    expect(soma(a.c.vendas)).toBeCloseTo(a.vgv, 2);
  });
  it('recebimentos somam o VGV menos os distratos', () => {
    const s = estado(A, { ...base, flx: { receb: { ...base.flx.receb, distrato: 0.1, distratoMes: 12, retencao: 0.25 } } });
    const a = A.finance(s, m);
    expect(a.distratoV).toBeGreaterThan(0);
    expect(a.receita).toBeCloseTo(a.vgv - a.distratoV, 2);
    expect(a.distrato.refund).toBeGreaterThan(0);
  });
  it('INCC até as chaves e IPCA depois aumentam a receita', () => {
    const s0 = estado(A, base), s1 = estado(A, { ...base, fin: { incc: 0.06, reaj: 0 } }), s2 = estado(A, { ...base, flx: { receb: { ...base.flx.receb, ipca: 0.05 } } });
    const r0 = A.finance(s0, m).receita;
    expect(A.finance(s1, m).receita).toBeGreaterThan(r0); expect(A.finance(s2, m).receita).toBeGreaterThan(r0);
  });
  it('repasse = o que falta para 100%', () => {
    expect(A.flxRepasse(base.flx.receb)).toBeCloseTo(0.5, 10);
  });
});

describe('3.2 cenários, tornado e Monte Carlo', () => {
  it('pessimista < base < otimista', () => {
    const c = A.flxCenarios(st, m, f);
    expect(c[0].f.lucro).toBeLessThan(c[1].f.lucro); expect(c[1].f.lucro).toBeLessThan(c[2].f.lucro);
    expect(c[1].f.lucro).toBe(f.lucro);
  });
  it('tornado ordenado pelo impacto, preço e custo no topo', () => {
    const t = A.flxTornado(st, m, null, 'margem');
    for (let i = 1; i < t.vars.length; i++) expect(t.vars[i - 1].d).toBeGreaterThanOrEqual(t.vars[i].d);
    expect(['preco', 'custo']).toContain(t.vars[0].k);
    t.vars.forEach(v => expect(v.lo.margem).toBeLessThanOrEqual(v.hi.margem + 1e-12));
    const tt = A.flxTornado(st, m, null, 'tir'); tt.vars.forEach(v => expect(v.lo.tir ?? -1).toBeLessThanOrEqual((v.hi.tir ?? -1) + 1e-12));
  });
  it('Monte Carlo: P10 ≤ P50 ≤ P90 e reprodutível', () => {
    const r = A.flxMonteCarlo(st, m, 200, 3), r2 = A.flxMonteCarlo(st, m, 200, 3);
    expect(r.tir[0]).toBeLessThanOrEqual(r.tir[1]); expect(r.tir[1]).toBeLessThanOrEqual(r.tir[2]);
    expect(r.lucro[0]).toBeLessThanOrEqual(r.lucro[1]); expect(r.lucro[1]).toBeLessThanOrEqual(r.lucro[2]);
    expect(r.lucro).toEqual(r2.lucro);
  });
});

describe('3.3 terreno', () => {
  let r;
  beforeAll(() => { r = A.terAltCalc(st, m) });
  it('à vista reproduz o estudo base (terreno nas premissas)', () => {
    expect(r.alts.vista.lucro).toBeCloseTo(f.lucro, 0);
    expect(r.alts.vista.vpl).toBeCloseTo(f.vpl, 0);
    expect(r.alts.vista.terrTot).toBe(st.fin.terreno);
  });
  it('todas as alternativas têm fluxo do terreneiro e VPL dos dois lados', () => {
    for (const k of ['vista', 'parc', 'fis', 'fin', 'spe']) {
      const a = r.alts[k]; expect(a.terrTot, k).toBeGreaterThan(0); expect(isFinite(a.vpl)).toBe(true); expect(isFinite(a.terrVPL)).toBe(true);
      expect(soma(a.terr)).toBeCloseTo(a.terrTot, 4);
    }
    expect(r.alts.parc.terrVPL).toBeLessThan(r.alts.parc.terrTot);           // dinheiro no tempo
  });
  it('ponto de indiferença coerente', () => {
    const I = r.ind, F = st.fin;
    // incorporador: com o % de indiferença, o VPL da permuta física iguala o da compra à vista
    const s = { ...st, fin: { ...F, terreno: 0, permuta: I.fis.inc, permutaFin: 0 } }, fp = A.finance(s, m, { noHooks: true });
    const cf = fp.cf.slice(); cf[0] -= r.P * F.itbi;
    expect(A.flxMetricas(cf, F.tma).vpl).toBeCloseTo(r.alts.vista.vpl, -4);  // ± R$ 5 mil
    const s2 = { ...st, fin: { ...F, terreno: 0, permuta: 0, permutaFin: I.fin.inc } }, ff = A.finance(s2, m, { noHooks: true });
    const cf2 = ff.cf.slice(); cf2[0] -= r.P * F.itbi;
    expect(A.flxMetricas(cf2, F.tma).vpl).toBeCloseTo(r.alts.vista.vpl, -4);
    // terreneiro: com o % dele, o VPL recebido iguala o preço à vista
    const st2 = estado(A, { terAlt: { permF: I.fis.terr, permFin: I.fin.terr } }), r2 = A.terAltCalc(st2, m);
    expect(r2.alts.fis.terrVPL / r.P).toBeCloseTo(1, 6);
    expect(r2.alts.fin.terrVPL / r.P).toBeCloseTo(1, 6);
    // preço maior → % maior
    const r3 = A.terAltCalc(estado(A, { terAlt: { preco: st.fin.terreno * 1.5 } }), m);
    expect(r3.ind.fis.inc).toBeGreaterThan(I.fis.inc); expect(r3.ind.fis.terr).toBeGreaterThan(I.fis.terr);
  });
  it('permuta física por unidades escolhidas da tabela de vendas', () => {
    const us = [{ id: 'T1-101', preco: 700000, area: 66 }, { id: 'T1-102', preco: 900000, area: 92 }];
    const s = estado(A, { terAlt: { unidades: ['T1-101', 'T1-102'] } }), rr = A.terAltCalc(s, { ...m, unidades: us });
    expect(rr.alts.fis.porUnid).toBe(true); expect(rr.alts.fis.valor).toBe(1600000);
  });
  it('SPE: terreneiro recebe a participação do lucro sem custo de terreno', () => {
    const s = r.alts.spe, base = r.f0.cf.reduce((a, v) => a + v, 0) - r.itbi;
    expect(s.terrTot).toBeCloseTo(st.terAlt.speS * base, -2);
  });
});
