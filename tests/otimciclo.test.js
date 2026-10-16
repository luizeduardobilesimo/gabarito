// Ciclo com o projeto real (pedido do Luiz: "estou tentando viabilizar um terreno e não está dando, e preciso mudar informações de etapas
// da frente"). O "Sugerir a melhor combinação" passa a escolher a garagem real (tipo de rampa, acesso, ângulo das vagas) pelo RESULTADO,
// olha o térreo e o lazer que não coube, refaz a 1ª com o cálculo completo e aplica tudo de uma vez; e "o que fecha a conta"
// (cicloEstudo) diz, para o estudo atual, o que muda o resultado. Ver src/calc/ciclo.js e a fase "ciclo" de otimizar (src/optim.js).
import { describe, it, expect } from 'vitest';
import { carregar } from './harness.js';

const A = carregar();
const cid = () => A.cidadesLista().find(c => /Crici/.test(c.cidade));
const assSt = (frente, fundo, preco, padrao = 'familia') =>
  A.assEstado(A.clone(A.DEF), { nome: 'T', lote: { modo: 'ret', frente, fundo }, regras: { id: cid().id }, produto: { padrao, preco: String(preco), terreno: '' } });
/* opções do assistente; tempo folgado nos testes (a máquina de teste roda tudo em paralelo; o orçamento padrão é testado à parte) */
const OPTS = (st, x = {}) => ({ ...A.clone(st.otim), obj: 'lucro', torres: true, tipologias: false, unidades: true, mc: false, terrenoPct: 0.12, tempoTotal: 60000, tempoCiclo: 25000, ...x });
const estrutura = (st, N, pav, sub, gac, rampa = 'reta') => { st.produto.mix = A.presetMix(st, 'atual', N); st.produto.torres = [{ pav }]; st.produto.subsolos = sub; st.produto.garAcima = gac; st.estudo.rampaTipo = rampa; return st };
const motor = st => A.otimMotor(st, { cal: A.otimVagasCal(st, A.compute(A.clone(st), { quick: true })) || { s: 0.6, g: 0.5, t: 0.6, vf: 0 }, fin: (s, m) => A.finance(s, m), score: f => f.lucro });
const sempre = { tem: () => true, parou: () => false, pausa: () => Promise.resolve() };

describe('garagem real na escolha (tipo de rampa, acesso, ângulo)', () => {
  it('lote estreito (15 × 50): o elevador de carros ganha — fecha as vagas com um andar a mais e dá lucro onde a rampa reta não dá', async () => {
    const st = estrutura(assSt(15, 50, 13000), 3, 7, 1, 1); st.fin.terreno = 2000000;
    const M = motor(st), c0 = M.repara(M.avalia(A.clone(st)), 4);         // a combinação conferida com a rampa reta (como o otimizador fazia)
    const g = await A.cicloGarFinalista(M, c0, sempre);
    expect(g.melhor.g.rampaTipo).toBe('elevador');
    expect(M.nivelOk(g.melhor.c)).toBe(true);
    // neste lote a rampa reta só caberia passando pelo núcleo (regra dura, src/garagem.js verticalCruza): a combinação dela não vale,
    // e o elevador é a garagem que fecha as vagas; quando a reta vale, o elevador precisa render mais
    if (A.cicloGarOk(c0.m)) expect(g.melhor.c.f.lucro).toBeGreaterThan(c0.f.lucro); else expect(M.nivelOk(c0)).toBe(false);
    expect(g.melhor.c.st.produto.torres[0].pav).toBeGreaterThanOrEqual(c0.st.produto.torres[0].pav);
    // o elevador entra com o custo dele
    expect((g.melhor.c.m.custosExtra || []).some(x => x.k === 'garElevCarros')).toBe(true);
    // a comparação por tipo fica no resultado (para a tela)
    expect(g.info.tipos.map(x => x.g.rampaTipo)).toEqual(expect.arrayContaining(['elevador', 'reta']));
  }, 300000);

  it('lote largo (40 × 60): rampa ganha do elevador — mais vagas não pagam o elevador de carros', async () => {
    const st = estrutura(assSt(40, 60, 12000), 5, 18, 1, 0); st.fin.terreno = 9000000;
    const M = motor(st), c0 = M.repara(M.avalia(A.clone(st)), 2);
    const g = await A.cicloGarFinalista(M, c0, sempre);
    expect(g.melhor.g.rampaTipo).not.toBe('elevador');
    expect(M.nivelOk(g.melhor.c)).toBe(true);
    const el = g.info.tipos.find(x => x.g.rampaTipo === 'elevador');
    if (el) expect(el.lucro).toBeLessThan(g.melhor.c.f.lucro);
    expect(g.melhor.c.f.lucro).toBeGreaterThanOrEqual(c0.f.lucro - 1);   // nunca pior que a garagem do estudo
  }, 300000);

  it('ângulo e posição do acesso entram na triagem; nome e igualdade da garagem', () => {
    const st = A.clone(A.DEF), g = A.cicloGarDe(st);
    expect(g).toEqual({ rampaTipo: 'reta', acessoVei: st.lote.acessoVei, ladoVei: null, angulo: '90' });
    expect(A.cicloGarIgual(g, { ...g, acessoVei: g.acessoVei + 0.01 })).toBe(true);
    expect(A.cicloGarIgual(g, { ...g, angulo: '60' })).toBe(false);
    st.estudo.rampa = [[0, 0], [1, 1]];
    A.cicloGarPoe(st, { ...g, rampaTipo: 'elevador', acessoVei: 0.5, angulo: '45' });
    expect([st.estudo.rampaTipo, st.lote.acessoVei, st.estudo.angulo, st.estudo.rampa]).toEqual(['elevador', 0.5, '45', null]);
    expect(A.cicloGarNome(A.cicloGarDe(st), st)).toMatch(/^Elevador de carros · acesso a 50% da frente · vagas a 45°$/);
    expect(A.cicloTipos(st)).toEqual(expect.arrayContaining(['reta', 'helicoidal', 'L', 'elevador']));
  });
});

describe('otimizar fecha o ciclo com o projeto real', () => {
  it('lote estreito: a sugestão traz o elevador, a 1ª vem do cálculo completo e aplicar reproduz vagas, lucro e margem', async () => {
    const st = assSt(15, 50, 13000);
    const r = await A.otimizar(OPTS(st), null, null, { st, m: {} });
    expect(r.res.length).toBeGreaterThan(0);
    const b = r.res[0];
    expect(b.garagem && b.garagem.rampaTipo).toBe('elevador');
    expect(b.completo).toBe(true);
    expect(b.lucro).toBeGreaterThan(0);
    // aplicar: tudo de uma vez (mix, andares, garagens, rampa, acesso, ângulo)
    const s2 = A.clone(st); A.aplicarOtim(b, s2); s2.fin.terreno = b.terreno;
    expect(A.cicloGarIgual(A.cicloGarDe(s2), b.garagem)).toBe(true);
    const m = A.compute(s2), f = A.finance(s2, m);
    expect(Math.abs(m.vagas - b.vagas)).toBeLessThanOrEqual(2);              // o layout completo tem busca com tempo: ± 2 vagas
    expect(m.vagas).toBeGreaterThanOrEqual(m.vagasReq);
    expect(Math.abs(f.lucro - b.lucro)).toBeLessThanOrEqual(Math.max(5e4, 0.01 * Math.abs(b.lucro)));
    expect(Math.abs(f.margemVGV - b.margem)).toBeLessThan(0.003);
    // lazer: o que não coube vira pendência e a alternativa enxuta é explícita — aplicar a opção NÃO mexe no lazer
    expect(b.pend.some(p => p.k === 'lazer')).toBe(true);
    expect(s2.produto.lazer.itens).toEqual(st.produto.lazer.itens);
    expect(b.enxuto && b.enxuto.dLucro).toBeGreaterThan(0);
    expect(b.enxuto.tira.length).toBeGreaterThan(0);
    const s3 = A.clone(st); A.aplicarOtim(b.enxuto, s3);
    expect(s3.produto.lazer.itens.map(x => x.nome)).not.toEqual(expect.arrayContaining(b.enxuto.tira));
    expect(s3.produto.lazer.itens.length).toBe(st.produto.lazer.itens.length - b.enxuto.tira.length);
    // o contrato continua: margem abaixo da meta → fecha com o preço que chega lá
    expect(r.fecha && r.fecha.precoMeta).toBeGreaterThan(r.fecha.precoAtual);
  }, 300000);

  it('lote largo: a sugestão não usa o elevador de carros e se reproduz no cálculo completo', async () => {
    const st = assSt(40, 60, 12000);
    const r = await A.otimizar(OPTS(st), null, null, { st, m: {} });
    const b = r.res[0];
    expect(b.garagem.rampaTipo).not.toBe('elevador');
    expect(b.completo).toBe(true);
    const s2 = A.clone(st); A.aplicarOtim(b, s2); s2.fin.terreno = b.terreno;
    const m = A.compute(s2), f = A.finance(s2, m);
    expect(Math.abs(m.vagas - b.vagas)).toBeLessThanOrEqual(Math.max(2, 0.03 * b.vagas));
    expect(m.vagas).toBeGreaterThanOrEqual(m.vagasReq);
    expect(Math.abs(f.lucro - b.lucro)).toBeLessThanOrEqual(Math.max(5e4, 0.01 * Math.abs(b.lucro)));
    expect(Math.abs(f.margemVGV - b.margem)).toBeLessThan(0.003);
  }, 300000);

  it('orçamento padrão de tempo (15 s + o cálculo completo da 1ª) e o ciclo desligável', async () => {
    const st = assSt(30, 50, 12000);
    const t0 = Date.now();
    const r = await A.otimizar(OPTS(st, { tempoTotal: undefined, tempoCiclo: undefined }), null, null, { st, m: {} });
    const ms = Date.now() - t0;
    console.log(`[otimciclo] 30 × 50 com o ciclo: ${(ms / 1000).toFixed(1)} s`);
    expect(r.res.length).toBeGreaterThan(0);
    expect(ms).toBeLessThan(45000);                                          // meta 15 s numa máquina livre; folga para a carga dos testes
    const r2 = await A.otimizar(OPTS(st, { ciclo: false }), null, null, { st, m: {} });
    expect(r2.res[0].completo).toBeUndefined();
    expect(r2.res[0].garagem).toEqual(A.cicloGarDe(st));                     // sem o ciclo, a garagem é a do estudo
  }, 300000);
});

describe('aplicar e desfazer de uma vez', () => {
  it('aplicarOtim grava o conjunto completo; um único passo de desfazer volta tudo', () => {
    const st = A.clone(A.DEF), antes = A.clone(st);
    const r = { nT: 1, pav: 12, sub: 1, gac: 1, mix: A.presetMix(st, 'atual', 4), garagem: { rampaTipo: 'helicoidal', acessoVei: 0.1, ladoVei: null, angulo: '60' } };
    A.aplicarOtim(r, st);
    expect([st.produto.torres.length, st.produto.torres[0].pav, st.produto.subsolos, st.produto.garAcima, st.estudo.rampaTipo, st.lote.acessoVei, st.estudo.angulo])
      .toEqual([1, 12, 1, 1, 'helicoidal', 0.1, '60']);
    expect(st.produto.lazer.itens).toEqual(antes.produto.lazer.itens);       // lazer só com r.lazer (alternativa enxuta escolhida)
    const desfaz = A.histDiff(st, antes);                                     // o histórico guarda uma diferença por mudança confirmada
    expect(A.histPatch(st, desfaz)).toEqual(antes);
    A.aplicarOtim({ ...r, lazer: [{ nome: 'Salão de festas', area: 90, local: 'terreo' }] }, st);
    expect(st.produto.lazer.itens.map(x => x.nome)).toEqual(['Salão de festas']);
  });

  it('cicloPatch/cicloAplica: só o que mudou, e a cópia reproduz o estado', () => {
    const a = A.clone(A.DEF), b = A.clone(a);
    b.estudo.rampaTipo = 'L'; b.produto.subsolos = 3; b.produto.lazer.itens = b.produto.lazer.itens.slice(0, 2);
    const p = A.cicloPatch(a, b);
    expect(p.map(x => x[0]).sort()).toEqual(['estudo.rampaTipo', 'produto.lazer.itens', 'produto.subsolos']);
    expect(A.cicloAplica(A.clone(a), p)).toEqual(b);
  });
});

describe('térreo e lazer', () => {
  it('lazer enxuto: tira o que não coube e os complementos; nada a tirar → null', () => {
    const st = A.clone(A.DEF);
    st.produto.lazer.itens = [{ nome: 'Salão de festas', area: 90, local: 'terreo' }, { nome: 'Cinema', area: 35, local: 'pav' }, { nome: 'Piscina', area: 70, local: 'emb', desc: true }, { nome: 'Sauna', area: 15, local: 'cob' }];
    const m = { lzLay: { miss: [{ nome: 'Piscina' }, { nome: 'Portaria', apoio: true }], missIx: [2] } };
    const e = A.cicloLazerEnxuto(st, m);
    expect(e.tira).toEqual(['Cinema', 'Piscina', 'Sauna']);
    expect(e.naoCoube).toEqual(['Piscina']);
    expect(e.itens.map(x => x.nome)).toEqual(['Salão de festas']);
    st.produto.lazer.itens = [st.produto.lazer.itens[0]];
    expect(A.cicloLazerEnxuto(st, { lzLay: { miss: [] } })).toBeNull();
  });

  it('pendências do projeto: lazer que não coube, rampa, elevador e faixa de veículos no hall', () => {
    const p = A.cicloPend({ lzLay: { miss: [{ nome: 'Piscina' }, { nome: 'Playground' }, { nome: 'DML', apoio: true }] }, vert: { ok: false }, elevCarros: { ok: false },
      comuns: { problemas: [{ k: 'veiculos', nivel: 'bad', msg: 'A faixa de veículos passa sobre o hall dos elevadores (8 m²) — mova o núcleo ou o acesso.' }] } });
    expect(p.map(x => x.k)).toEqual(['lazer', 'apoio', 'rampa', 'elevador', 'terreo']);
    expect(p[0]).toEqual({ k: 'lazer', grave: true, msg: 'Piscina e Playground não couberam' });
    expect(p[1].grave).toBe(false);
    expect(p[4].msg).toBe('A faixa de veículos passa sobre o hall dos elevadores (8 m²)');
  });
});

describe('o que fecha a conta (estudo atual)', () => {
  it('estudo abaixo da meta: cada linha melhora o lucro, fecha as vagas e o patch reproduz o número', async () => {
    const st = estrutura(assSt(20, 40, 12000), 2, 15, 3, 0); st.fin.terreno = 1500000;
    const m = A.compute(st), f = A.finance(st, m);
    expect(f.margemVGV).toBeLessThan(st.fin.margemAlvo);
    const r = await A.cicloEstudo(st, { tempo: 30000 }, null, { m });
    expect(r.linhas.length).toBeGreaterThan(0);
    expect(r.linhas.length).toBeLessThanOrEqual(4);
    for (let i = 1; i < r.linhas.length; i++) expect(r.linhas[i - 1].d.lucro).toBeGreaterThanOrEqual(r.linhas[i].d.lucro);
    for (const l of r.linhas) {
      expect(l.d.lucro).toBeGreaterThan(0); expect(l.vagas).toBeGreaterThanOrEqual(l.req);
      expect(['garagem', 'lazer', 'estrutura', 'unidades']).toContain(l.k);
      const s2 = A.cicloAplica(A.clone(st), l.patch), m2 = A.compute(s2, { quick: true }), f2 = A.finance(s2, m2);
      expect(Math.abs(f2.lucro - l.lucro)).toBeLessThan(1);
    }
    // o lazer que não coube no cálculo completo aparece como alternativa
    if (m.lzLay.miss.some(x => !x.apoio)) expect(r.linhas.some(l => l.k === 'lazer')).toBe(true);
  }, 300000);
});
