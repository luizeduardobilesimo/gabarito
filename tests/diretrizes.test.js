// Diretrizes do produto (src/calc/diretrizes.js) — pedido do Luiz: "pode ser um estudo totalmente livre, onde só importam métricas e
// aproveitamento, ou a opção do usuário já limitar alguns critérios que ele precisa atender (padrão, quartos, área comum…). É muito
// diferente um Minha Casa Minha Vida de um alto padrão." O otimizador (e o ciclo, o assistente e o aplicar) obedece às diretrizes; quando
// nada as respeita, diz qual diretriz impede e quanto falta. No modo livre (padrão) nada muda.
import { describe, it, expect } from 'vitest';
import { carregar } from './harness.js';

const A = carregar();
const cid = () => A.cidadesLista().find(c => /Crici/.test(c.cidade));
/** estado do assistente novo: lote frente × fundo em Criciúma, padrão e diretrizes */
const novo = (frente, fundo, padrao, dir = {}, preco = '') => A.assEstado(A.clone(A.DEF), {
  nome: 'T', lote: { modo: 'ret', frente, fundo }, regras: { id: cid().id },
  produto: { padrao, preco: String(preco), terreno: '' }, diretrizes: { modo: 'diretrizes', subMax: -1, gacMax: -1, ...dir } });
const RAPIDO = st => ({ ...A.clone(st.otim), obj: 'lucro', torres: true, tipologias: true, unidades: true, mc: false, ciclo: false, terrenoPct: 0.12 });
const otim = (st, o = {}) => A.otimizar({ ...RAPIDO(st), ...o }, null, null, { st, m: {} });
const nUn = r => r.mix.reduce((s, u) => s + u.qtd, 0);
const areaMedia = mix => mix.reduce((s, u) => s + u.area * u.qtd, 0) / mix.reduce((s, u) => s + u.qtd, 0);

describe('modo livre: nada muda', () => {
  it('o padrão é livre e as funções não interferem', () => {
    const st = A.clone(A.DEF);
    expect(st.diretrizes.modo).toBe('livre');
    expect(A.dirEfetivas(st)).toBeNull(); expect(A.dirPrepara(A.clone(st))).toBeNull(); expect(A.dirEstadoOk(st)).toBe(true);
    expect(A.dirConfere(st, {})).toBeNull(); expect(A.dirAplicaFixos(st)).toEqual([]);
    expect(A.dirRampaOk(st, 'elevador')).toBe(true); expect(A.dirLazerObrig(st, 'Piscina')).toBe(false);
    // aplicarOtim no livre: só o que a opção traz
    const s2 = A.clone(st), antes = A.clone(s2);
    A.aplicarOtim({ nT: 2, pav: 12, mix: A.clone(st.produto.mix), sub: 2, gac: 0 }, s2);
    expect(s2.produto.garTerOn).toBe(antes.produto.garTerOn); expect(s2.produto.lazer.itens).toEqual(antes.produto.lazer.itens);
    // presets antigos intocados
    expect(A.presetMix(st, 'familia', 5)).toEqual(A.presetMix(A.clone(A.DEF), 'familia', 5));
    expect(A.presetNome('alto', st)).toBe('Alto padrão');
  });
  it('otimizar com o modo livre = otimizar sem diretrizes no estado (mesmas opções e números)', async () => {
    const st = A.clone(A.DEF), sem = A.clone(st); delete sem.diretrizes;
    const o = { ...A.clone(st.otim), obj: 'lucro', mc: false, ciclo: false };
    const [a, b] = [await A.otimizar(o, null, null, { st, m: {} }), await A.otimizar(o, null, null, { st: sem, m: {} })];
    const k = r => r.res.map(x => [x.key, Math.round(x.lucro), x.vagas, x.req]);
    expect(k(a)).toEqual(k(b)); expect(a.res.length).toBeGreaterThan(0);
    expect(a.dir).toBeUndefined(); expect(a.res.every(x => x.dir === undefined)).toBe(true);
  }, 240000);
});

describe('o otimizador obedece', () => {
  it('sem subsolo e sem garagem elevada: nenhuma opção com subsolo ou elevada (o reparo também respeita)', async () => {
    const st = novo(40, 60, 'medio', { subMax: 0, gacMax: 0 }, 10500);
    expect(st.produto.subsolos).toBe(0);
    const r = await otim(st);
    expect(r.res.length).toBeGreaterThan(0);
    r.res.forEach(x => { expect(x.sub).toBe(0); expect(x.gac).toBe(0); expect(x.dir).toBeTruthy(); expect(x.vagas).toBeGreaterThanOrEqual(x.req) });
    expect(r.dir.resumo).toMatch(/sem subsolo/);
    // aplicado, continua sem subsolo e confere com as diretrizes
    const s2 = A.clone(st); A.aplicarOtim(r.res[0], s2);
    expect(s2.produto.subsolos).toBe(0); expect(s2.produto.garAcima).toBe(0); expect(A.dirEstadoOk(s2)).toBe(true);
  }, 240000);

  it('até 1 subsolo e sem elevada: subsolos ≤ 1, garagem elevada 0', async () => {
    const st = novo(25, 45, 'medio', { subMax: 1, gacMax: 0 }, 10500);
    const r = await otim(st);
    expect(r.res.length + (r.semOpcao ? 1 : 0)).toBeGreaterThan(0);
    r.res.forEach(x => { expect(x.sub).toBeLessThanOrEqual(1); expect(x.gac).toBe(0) });
  }, 240000);

  it('tipologias restritas: o mix só tem as permitidas (e nas áreas da diretriz)', async () => {
    const st = novo(30, 50, 'medio', { tips: [2] }, 10500);
    const D = A.dirEfetivas(st); expect(D.tips).toEqual([2]);
    const r = await otim(st);
    expect(r.res.length).toBeGreaterThan(0);
    r.res.forEach(x => x.mix.forEach(u => { expect(A.dirTipDe(u)).toBe(2); expect(u.area).toBeGreaterThanOrEqual(D.area(2)[0]); expect(u.area).toBeLessThanOrEqual(D.area(2)[2]) }));
  }, 240000);

  it('pavimentos e unidades por andar dentro dos limites', async () => {
    const st = novo(35, 55, 'medio', { subMax: -1, gacMax: -1 }, 10500);
    Object.assign(st.diretrizes, { pavMin: 6, pavMax: 10, unMin: 3, unMax: 4 });
    const r = await otim(st);
    expect(r.res.length).toBeGreaterThan(0);
    r.res.forEach(x => { expect(x.pav).toBeGreaterThanOrEqual(6); expect(x.pav).toBeLessThanOrEqual(10); expect(nUn(x)).toBeGreaterThanOrEqual(3); expect(nUn(x)).toBeLessThanOrEqual(4) });
  }, 240000);

  it('lazer obrigatório fica (também no "lazer enxuto") e vagas por unidade acima da lei são garantidas', async () => {
    const st = novo(40, 60, 'alto', {}, 18000);
    const D = A.dirEfetivas(st); expect(D.vagasUn).toBe(2); expect(D.lazerObrig).toContain('Piscina');
    const lz = A.cicloLazerEnxuto(st, { lzLay: { miss: [], missIx: [] } });
    expect(lz ? lz.itens.map(x => x.nome) : st.produto.lazer.itens.map(x => x.nome)).toEqual(expect.arrayContaining(D.lazerObrig));
    const r = await otim(st);
    expect(r.res.length).toBeGreaterThan(0);
    r.res.forEach(x => expect(x.vagas).toBeGreaterThanOrEqual(Math.ceil(x.units * 2)));
    expect(A.cicloTipos({ ...st, produto: { ...st.produto, subsolos: 2 } })).toContain('elevador');
    const sem = A.clone(st); sem.diretrizes.elevCarros = false; sem.produto.subsolos = 2;
    expect(A.cicloTipos(sem)).not.toContain('elevador');
  }, 240000);
});

describe('MCMV × alto padrão no mesmo lote', () => {
  it('produtos coerentes e diferentes (áreas, lazer, vagas, custo, preço)', async () => {
    const ec = novo(30, 50, 'economico', {}), al = novo(30, 50, 'alto', {});
    const [re, ra] = [await otim(ec), await otim(al)];
    expect(re.res.length).toBeGreaterThan(0); expect(ra.res.length).toBeGreaterThan(0);
    const e = re.res[0], a = ra.res[0];
    // áreas
    expect(areaMedia(e.mix)).toBeLessThan(50); expect(areaMedia(a.mix)).toBeGreaterThan(120);
    e.mix.forEach(u => expect([1, 2]).toContain(A.dirTipDe(u))); a.mix.forEach(u => expect([3, 4]).toContain(A.dirTipDe(u)));
    // teto do MCMV (faixa 3: R$ 350 mil por unidade)
    e.mix.forEach(u => expect(u.area * u.preco).toBeLessThanOrEqual(350000));
    // lazer, vagas, custo e preço
    const lzA = s => s.produto.lazer.itens.reduce((t, x) => t + x.area, 0);
    expect(lzA(al)).toBeGreaterThan(3 * lzA(ec));
    expect(a.vagas).toBeGreaterThanOrEqual(2 * a.units); expect(e.req).toBeLessThan(1.5 * e.units + 10);
    expect(ec.fin.cub * ec.fin.fator).toBeLessThan(0.7 * al.fin.cub * al.fin.fator);
    expect(A.basePrice(ec)).toBeLessThan(0.5 * A.basePrice(al));
    expect(nUn(e)).toBeGreaterThan(nUn(a)); expect(ec.fin.eqGar).toBeLessThan(al.fin.eqGar);
    expect(ec.orc.padrao).toBe('R8-B'); expect(al.orc.padrao).toBe('R16-A');
    expect(al.produto.cob.on).toBe(true); expect(ec.produto.cob.on).toBe(false);
  }, 300000);
});

describe('diretriz impossível: diz qual diretriz impede e quanto falta', () => {
  it('sem subsolo, sem elevada e sem garagem no térreo, 2 vagas por unidade', async () => {
    const st = novo(20, 40, 'medio', { subMax: 0, gacMax: 0 }, 10500);
    Object.assign(st.diretrizes, { garTerreo: 'nao', vagasUn: 2 });
    const r = await otim(st);
    expect(r.res).toEqual([]);
    expect(r.semOpcao.diretriz).toBeTruthy(); expect(r.semOpcao.k).toBe('vagas');
    expect(r.semOpcao.motivo).toMatch(/^sem subsolo e sem garagem elevada, a garagem comporta \d+ das \d+ vagas exigidas/);
    expect(r.semOpcao.motivo).toMatch(/permitir \d subsolo/); expect(r.semOpcao.motivo).toMatch(/2 por unidade, pela diretriz/);
    expect(r.semOpcao.vagas).toBeLessThan(r.semOpcao.req);
  }, 240000);
  it('teto do MCMV que nenhuma tipologia comporta: o preço que cabe', async () => {
    const st = novo(30, 50, 'economico', {}, 9000);
    st.diretrizes.faixa = 'f12';
    const r = await otim(st);
    expect(r.res).toEqual([]); expect(r.semOpcao.diretriz).toBe('teto');
    expect(r.semOpcao.motivo).toMatch(/teto de R\$ 264 mil/); expect(r.semOpcao.motivo).toMatch(/reduza o preço para até R\$ [\d.]+\/m²/);
  }, 120000);
  it('sem tipologia permitida, mínimo acima do máximo', () => {
    const st = novo(30, 50, 'medio', {});
    st.diretrizes.tips = [9]; expect(A.dirPrepara(A.clone(st)).pre.diretriz).toBe('tipologias');
    st.diretrizes.tips = [2]; Object.assign(st.diretrizes, { pavMin: 12, pavMax: 8 }); expect(A.dirPrepara(A.clone(st)).pre.diretriz).toBe('pavimentos');
  });
});

describe('aplicar e desfazer', () => {
  it('aplicarOtim grava o que é fixo pelas diretrizes (térreo, coberturas, lazer obrigatório)', () => {
    const st = A.clone(A.DEF); st.diretrizes.modo = 'diretrizes';
    Object.assign(st.diretrizes, { garTerreo: 'nao', cob: 'nao', lojas: 'nao', lazerObrig: ['Salão de festas', 'Brinquedoteca'] });
    A.aplicarOtim({ nT: 1, pav: 10, mix: A.clone(st.produto.mix), sub: 1, gac: 0 }, st);
    expect(st.produto.garTerOn).toBe(false); expect(st.produto.cob.on).toBe(false); expect(st.produto.lojaTerreo).toBe(0);
    expect(st.produto.lazer.itens.map(x => x.nome)).toContain('Brinquedoteca');
    const c = A.dirConfere(st, null); expect(c.falhas.filter(x => ['terreo', 'cob', 'lojas', 'lazer'].includes(x.k))).toEqual([]);
  });
  it('escolher um padrão muda mix, lazer, CUB e vagas num passo só — e o desfazer volta exatamente', () => {
    const antes = A.clone(A.DEF), st = A.clone(antes);
    const mud = A.dirAplicaPadrao(st, 'alto');
    expect(mud.length).toBeGreaterThanOrEqual(5); expect(mud.join(' ')).toMatch(/Unidades:.*suítes/); expect(mud.join(' ')).toMatch(/CUB R16-A/);
    expect(st.produto.mix.every(u => [3, 4].includes(A.dirTipDe(u)))).toBe(true);
    expect(st.diretrizes.vagasUn).toBe(2); expect(st.orc.padrao).toBe('R16-A');
    // o desfazer do app guarda a diferença entre os estados (src/calc/histdiff.js): voltar = aplicar a diferença inversa
    const volta = A.histDiff(st, antes);
    expect(A.histEq(A.histPatch(st, volta), antes)).toBe(true);
    // garagem (depende do lugar) não muda com o padrão
    expect(st.produto.subsolos).toBe(antes.produto.subsolos); expect(st.diretrizes.subMax).toBe(antes.diretrizes.subMax);
  });
  it('MCMV: área limitada pelo teto e pela menor unidade da lei; texto do resumo', () => {
    const st = A.clone(A.DEF); A.dirAplicaPadrao(st, 'economico'); st.diretrizes.modo = 'diretrizes';
    const D = A.dirEfetivas(st);
    st.produto.mix.forEach(u => { expect(u.area).toBeGreaterThanOrEqual(st.regras.aptoMin); expect(u.area * u.preco).toBeLessThanOrEqual(D.teto) });
    expect(A.dirResumo(st)).toMatch(/^Econômico · 1 e 2 dorm\./);
    expect(A.dirTipDe({ nome: '3 dorm. (1 suíte)' })).toBe(3); expect(A.dirTipDe({ nome: '2 suítes' })).toBe(2); expect(A.dirTipDe({ nome: 'Studio' })).toBe(0);
  });
});

describe('tempo', () => {
  it('otimizador completo (fronteira, ciclo e cálculo completo) com diretrizes dentro de ~15 s', async () => {
    const st = novo(30, 50, 'medioAlto', { subMax: 2, gacMax: 0 }, 13500), livre = A.clone(st); livre.diretrizes.modo = 'livre';
    const o = { ...A.clone(st.otim), obj: 'lucro', terrenoPct: 0.12 };
    let t0 = Date.now(); const r = await A.otimizar(o, null, null, { st, m: {} }); const ms = Date.now() - t0;
    t0 = Date.now(); await A.otimizar(o, null, null, { st: livre, m: {} }); const msL = Date.now() - t0;
    console.log(`[diretrizes] otimizador completo: ${(ms / 1000).toFixed(1)} s com diretrizes · ${(msL / 1000).toFixed(1)} s livre · ${r.testadas} combinações · ${r.res.length} opções`);
    expect(r.res.length).toBeGreaterThan(0); r.res.forEach(x => { expect(x.sub).toBeLessThanOrEqual(2); expect(x.gac).toBe(0) });
    // a meta é a do otimizador (15 s numa máquina livre); com a máquina carregada, compara com o modo livre medido junto
    expect(ms).toBeLessThan(Math.max(17000, 1.3 * msL));
  }, 180000);
});
