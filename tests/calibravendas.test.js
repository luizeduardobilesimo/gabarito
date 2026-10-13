// Fase E: calibrar os prêmios da tabela de vendas com uma tabela real (src/calc/calibravendas.js + planilha.js)
import { describe, it, expect } from 'vitest';
import { carregar, estado } from './harness.js';

const A = carregar();
const rng = (s => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 })(12345);
const DIRS = ['N', 'NE', 'L', 'SE', 'S', 'SO', 'O', 'NO'];

/* tabela sintética gerada pelo próprio modelo (uniPrecos): 25 andares × 6 finais, duas tipologias, orientação, vista, ruído de ±1,5% */
function tabela({ ruido = 0.015, vista = false, cob = false, V: Vx = {} } = {}) {
  const V = { andarPct: 0.007, andarTeto: 0.10, solPct: 0, solPiso: -1, solTeto: 1, vistaPct: vista ? 0.05 : 0, cobPct: 0, manterMedia: false,
    orient: { N: 0.03, NE: 0.03, L: 0.01, SE: -0.015, S: -0.03, SO: -0.025, O: -0.01, NO: 0.015 }, ...Vx };
  const lista = [], fin = ['N', 'NE', 'L', 'SE', 'S', 'SO'];
  for (let a = 1; a <= 25; a++) for (let f = 0; f < 6; f++) {
    const dois = f % 2 === 0, area = dois ? 70 : 105;
    lista.push({ andar: a, final: f + 1, area, tipologia: dois ? '2 dorm.' : '3 dorm.', cob: false, sol: null, vista: vista ? 0.4 + ((a * 7 + f * 3) % 10) / 10 * 0.5 : null,
      fachadas: [{ dir: fin[(f + a) % 6], len: 10 }], fachadaLen: 10, base: area * (dois ? 10000 : 9000), premios: null, preco: 0 });
  }
  if (cob) for (let q = 0; q < 4; q++) lista.push({ andar: 26, final: q + 1, area: 160, tipologia: 'Cobertura', cob: true, sol: null, vista: null, fachadas: [{ dir: fin[q], len: 12 }], fachadaLen: 12, base: 160 * 14000, premios: null, preco: 0 });
  A.uniPrecos(lista, V);
  const linhas = lista.map((u, i) => {
    const rel = u.fachadas[0].dir, r = 1 + (rng() * 2 - 1) * ruido;
    return { linha: i + 2, id: `${u.andar}0${u.final}`, andar: u.andar, area: u.area, precoM2: u.precoM2 * r, preco: u.preco * r, final: String(u.final), orient: rel, tip: u.tipologia, vista: u.vista, cob: u.cob };
  });
  return { linhas, V };
}

describe('calibraPremios: recupera prêmios conhecidos', () => {
  const { linhas } = tabela();
  const r = A.calibraPremios(linhas);
  it('ajuste bom e prêmio por andar com teto', () => {
    expect(r.ok).toBe(true);
    expect(r.r2).toBeGreaterThan(0.9);
    expect(r.erroMedio).toBeLessThan(0.02);
    expect(Math.abs(r.andar.pct - 0.007)).toBeLessThan(0.0012);
    expect(r.andar.comTeto).toBe(true);
    expect(Math.abs(r.andar.teto - 0.10)).toBeLessThan(0.02);   // teto 10% (cai no andar ~15)
    expect(r.andar.K).toBeGreaterThan(11); expect(r.andar.K).toBeLessThan(18);
  });
  it('preço base por tipologia (1º andar, orientação média)', () => {
    const t2 = r.tipologias.find(t => t.nome === '2 dorm.'), t3 = r.tipologias.find(t => t.nome === '3 dorm.');
    // a base absorve a média ponderada das orientações da tabela (aqui ≈ -0,2%): dentro de 2,5% dos preços de entrada
    expect(Math.abs(t2.base / 10000 - 1)).toBeLessThan(0.025);
    expect(Math.abs(t3.base / 9000 - 1)).toBeLessThan(0.025);
    expect(t2.n).toBe(75);
  });
  it('prêmio por orientação (relativo: N−S = 6 pontos)', () => {
    expect(r.usouOrient).toBe(true);
    const o = d => r.orient[d].v;
    expect(Math.abs((o('N') - o('S')) - 0.06)).toBeLessThan(0.012);
    expect(Math.abs((o('NE') - o('SO')) - 0.055)).toBeLessThan(0.012);
    expect(Math.abs((o('L') - o('SE')) - 0.025)).toBeLessThan(0.012);
    expect(r.orient.O.v).toBeNull();                      // sem dado em O/NO: continua o atual
    expect(r.orient.O.n).toBe(0);
  });
  it('resíduos por andar e por linha', () => {
    expect(r.residuos.length).toBe(linhas.length);
    expect(r.porAndar.length).toBe(25);
    expect(Math.max(...r.porAndar.map(a => Math.abs(a.res)))).toBeLessThan(0.03);
  });
  it('compara com os prêmios atuais (erro maior quando os atuais estão errados)', () => {
    const st = estado(A, {}); st.venda.andarPct = 0.02; st.venda.andarTeto = 0.3;
    const r2 = A.calibraPremios(linhas, { atual: st.venda });
    expect(r2.erroAtual).toBeGreaterThan(r2.erroMedio * 1.5);
  });
});

describe('calibraPremios: vista, cobertura e sem ruído', () => {
  it('recupera o prêmio de vista quando há dado', () => {
    const { linhas } = tabela({ vista: true, ruido: 0.004 });
    const r = A.calibraPremios(linhas);
    expect(r.vista).not.toBeNull();
    // vistaPct = ±5% para 0,25 de desvio da mediana
    expect(Math.abs(r.vista.pct - 0.05)).toBeLessThan(0.012);
  });
  it('sem vista na tabela: vista nula e aviso nenhum', () => {
    const { linhas } = tabela({ ruido: 0.004 });
    const r = A.calibraPremios(linhas);
    expect(r.vista).toBeNull();
  });
  it('cobertura vira grupo próprio: preço da cobertura e prêmio sobre as outras tipologias', () => {
    const { linhas } = tabela({ cob: true, ruido: 0.004 });
    const r = A.calibraPremios(linhas);
    expect(r.cob).not.toBeNull();
    expect(r.cob.n).toBe(4);
    expect(r.cob.base).toBeGreaterThan(11000);
    expect(r.cob.premio).toBeGreaterThan(0.2);
    expect(r.tipologias.some(t => t.nome === 'Cobertura')).toBe(false);
  });
  it('sem ruído: coeficientes quase exatos', () => {
    const { linhas } = tabela({ ruido: 0 });
    const r = A.calibraPremios(linhas);
    expect(r.r2).toBeGreaterThan(0.995);
    expect(Math.abs(r.andar.pct - 0.007)).toBeLessThan(0.0006);
  });
});

describe('leitura de tabelas: formato brasileiro, colunas e linhas inválidas', () => {
  const csv = `Unidade;Andar;Área privativa (m²);Valor;Orientação;Tipologia
101;1;"65,50";"R$ 654.000,00";Norte;2 dorm.
102;1;"65,50";"R$ 640.500,00";Sul;2 dorm.
201;2;"65,50";"R$ 660.000,00";Norte;2 dorm.
202;2;"65,50";"R$ 645.000,00";Sul;2 dorm.
301;3;"65,50";"R$ 666.000,00";Nascente;2 dorm.
302;3;"65,50";"R$ 650.000,00";Poente;2 dorm.
401;4;"65,50";"R$ 672.000,00";N/L;2 dorm.
402;4;"65,50";"R$ 655.000,00";SO;2 dorm.
`;
  it('números em formato brasileiro (R$ 1.234,56)', () => {
    expect(A.plaNum('R$ 1.234.567,89')).toBeCloseTo(1234567.89, 6);
    expect(A.plaNum('65,50')).toBe(65.5);
    expect(A.plaNum('1.234')).toBe(1234);
    expect(A.plaNum('65.500', { pontoDecimal: true })).toBe(65.5);
    expect(A.plaNum('(1.234,00)')).toBe(-1234);
    expect(A.plaNum('12%')).toBeCloseTo(0.12, 10);
    expect(A.plaNum('abc')).toBeNull();
    expect(A.plaNum('')).toBeNull();
  });
  it('separador ; e cabeçalho com acento: mapeia as colunas por nome', () => {
    const mat = A.plaCSV(csv), { cab, dados } = A.plaCabecalho(mat);
    const mapa = A.calibMapa(cab);
    expect(cab[0]).toBe('Unidade');
    expect(mapa.unidade).toBe(0); expect(mapa.andar).toBe(1); expect(mapa.area).toBe(2); expect(mapa.preco).toBe(3);
    expect(mapa.orient).toBe(4); expect(mapa.tipologia).toBe(5); expect(mapa.precoM2).toBe(-1);
    const { linhas, descartadas } = A.calibLinhas(dados, mapa);
    expect(descartadas.length).toBe(0);
    expect(linhas.length).toBe(8);
    expect(linhas[0].area).toBe(65.5);
    expect(linhas[0].precoM2).toBeCloseTo(654000 / 65.5, 6);
    expect(linhas.map(l => l.orient)).toEqual(['N', 'S', 'N', 'S', 'L', 'O', 'NE', 'SO']);
  });
  it('colunas faltando: só andar, área e preço (sem orientação e sem tipologia)', () => {
    const { linhas } = tabela({ ruido: 0.004 });
    const mat = [['Pav', 'Metragem', 'Preço de venda'], ...linhas.map(l => [String(l.andar), String(l.area).replace('.', ','), 'R$ ' + (l.precoM2 * l.area).toFixed(2).replace('.', ',')])];
    const { cab, dados } = A.plaCabecalho(mat), mapa = A.calibMapa(cab);
    expect(mapa.andar).toBe(0); expect(mapa.area).toBe(1); expect(mapa.preco).toBe(2);
    const l = A.calibLinhas(dados, mapa);
    expect(l.linhas.length).toBe(linhas.length);
    const r = A.calibraPremios(l.linhas);
    expect(r.ok).toBe(true);
    expect(r.usouOrient).toBe(false);
    expect(r.orient.N.v).toBeNull();
    expect(r.tipologias.map(t => t.nome)).toEqual(['Todas']);
    expect(r.andar.pct).toBeGreaterThan(0.004);
  });
  it('andar e final saem do número da unidade quando não há coluna de andar', () => {
    const mat = [['Apto', 'Área', 'Valor']];
    for (let a = 1; a <= 10; a++) for (const f of ['01', '02']) mat.push([`${a}${f}`, '60,0', String(Math.round(600000 * (1 + 0.006 * a)))]);
    const { cab, dados } = A.plaCabecalho(mat), mapa = A.calibMapa(cab);
    const { linhas } = A.calibLinhas(dados, mapa);
    expect(linhas.length).toBe(20);
    expect(linhas[2].andar).toBe(2); expect(linhas[2].final).toBe('01');
    const r = A.calibraPremios(linhas); expect(r.ok).toBe(true);
    expect(Math.abs(r.andar.pct - 0.006)).toBeLessThan(0.0012);
  });
  it('linhas inválidas são descartadas com o motivo (nunca quebram)', () => {
    const mat = [['Unidade', 'Andar', 'Área', 'Preço'],
      ['A1', '1', '60', '600000'], ['A2', '', '60', '610000'], ['A3', '2', '-5', '620000'], ['A4', '2', '60', ''], ['A5', 'x', '60', '630000'],
      ['', '', '', ''], ['B1', '3', '60', '640000'], ['B2', '3', '60', '12']];
    const { cab, dados } = A.plaCabecalho(mat), mapa = A.calibMapa(cab);
    const { linhas, descartadas } = A.calibLinhas(dados, mapa);
    expect(linhas.map(l => l.id)).toEqual(['A1', 'B1']);
    expect(descartadas.length).toBe(5);
    expect(descartadas.every(d => d.motivo && d.linha > 1)).toBe(true);
    const r = A.calibraPremios(linhas);   // 2 linhas válidas: não calibra
    expect(r.ok).toBe(false); expect(r.motivo).toMatch(/Poucas linhas/);
    expect(A.calibraPremios([]).ok).toBe(false);
    expect(A.calibraPremios(null).ok).toBe(false);
  });
  it('coluna de preço com valores pequenos é tratada como preço por m²', () => {
    const mat = [['Unidade', 'Andar', 'Área', 'Preço']];
    for (let a = 1; a <= 8; a++) mat.push([`${a}01`, String(a), '60', String(10000 + a * 70)]);
    const { cab, dados } = A.plaCabecalho(mat), mapa = A.calibMapa(cab);
    const r = A.calibLinhas(dados, mapa);
    expect(r.avisos.length).toBe(1);
    expect(r.linhas[0].precoM2).toBe(10070);
  });
  it('vista de 0 a 1 entra como está; outras escalas (1–5) são normalizadas', () => {
    const mk = vs => { const mat = [['Unidade', 'Andar', 'Área', 'Preço', 'Vista']]; vs.forEach((v, i) => mat.push([`A${i}`, String(i + 1), '60', '650000', v])); const h = A.plaCabecalho(mat); return A.calibLinhas(h.dados, A.calibMapa(h.cab)).linhas.map(l => l.vista) };
    expect(mk(['0,3', '0,5', '0,9'])).toEqual([0.3, 0.5, 0.9]);
    expect(mk(['1', '3', '5'])).toEqual([0, 0.5, 1]);
    expect(mk(['Livre', 'Parcial', 'Sem vista'])).toEqual([1, 0.5, 0]);
  });
  it('orientação em palavras e vista em texto', () => {
    expect(A.calibOrient('Norte')).toBe('N'); expect(A.calibOrient('nascente')).toBe('L'); expect(A.calibOrient('Poente')).toBe('O');
    expect(A.calibOrient('Sudoeste')).toBe('SO'); expect(A.calibOrient('N-L')).toBe('NE'); expect(A.calibOrient('N/S')).toBeNull(); expect(A.calibOrient('')).toBeNull();
  });
});

describe('aplicar ao estudo e padrão da empresa', () => {
  it('só muda o que há dado; o sol e o resto ficam como estão', () => {
    const { linhas } = tabela({ ruido: 0.004 });
    const r = A.calibraPremios(linhas);
    const st = estado(A, { produto: { mix: [{ nome: '2 dorm.', area: 70, qtd: 4, preco: 8000, sac: 0 }, { nome: '3 dormitórios', area: 105, qtd: 2, preco: 8000, sac: 0 }] } });
    const antes = JSON.stringify(st.venda), sol = st.venda.solPct, vista = st.venda.vistaPct;
    const mud = A.calibAplicar(st, r);
    expect(mud.length).toBeGreaterThan(3);
    expect(st.venda.solPct).toBe(sol);
    expect(st.venda.vistaPct).toBe(vista);                 // sem vista na tabela: mantém
    expect(Math.abs(st.venda.andarPct - 0.007)).toBeLessThan(0.0012);
    expect(JSON.stringify(st.venda)).not.toBe(antes);
    expect(Math.abs(st.venda.orient.N - st.venda.orient.S - 0.06)).toBeLessThan(0.012);
    expect(st.venda.orient.O).toBe(-0.01);                 // O sem dado: preserva o atual
    expect(Math.abs(st.produto.mix[0].preco / 10000 - 1)).toBeLessThan(0.025);
    expect(Math.abs(st.produto.mix[1].preco / 9000 - 1)).toBeLessThan(0.025);   // "3 dormitórios" casa com "3 dorm."
    expect(A.calibSemMix(st, r)).toEqual([]);
  });
  it('tabela sem tipologia: escala o mix para o preço médio da tabela', () => {
    const mat = [['Andar', 'Área', 'Preço m2']];
    for (let a = 1; a <= 12; a++) for (let k = 0; k < 2; k++) mat.push([String(a), '70', String(Math.round(12000 * (1 + 0.005 * (a - 1))))]);
    const { cab, dados } = A.plaCabecalho(mat), mapa = A.calibMapa(cab);
    const r = A.calibraPremios(A.calibLinhas(dados, mapa).linhas);
    const st = estado(A, {});
    A.calibAplicar(st, r);
    const P = st.produto, tot = P.mix.reduce((s, u) => s + u.area * u.qtd, 0), med = P.mix.reduce((s, u) => s + u.preco * u.area * u.qtd, 0) / tot;
    expect(Math.abs(med / r.tipologias[0].base - 1)).toBeLessThan(0.01);
  });
  it('resultado inválido não altera o estudo', () => {
    const st = estado(A, {}), antes = JSON.stringify(st);
    expect(A.calibAplicar(st, { ok: false })).toEqual([]);
    expect(JSON.stringify(st)).toBe(antes);
  });
  it('padrão da empresa: salva, lê e aplica em outro estudo', () => {
    const { linhas } = tabela({ ruido: 0.004 });
    const r = A.calibraPremios(linhas), st = estado(A, {});
    A.calibAplicar(st, r);
    expect(A.vendaPadraoEmpresa()).toBeNull();
    expect(A.vendaSalvarPadrao(st, { n: r.n })).toBe(true);
    const p = A.vendaPadraoEmpresa();
    expect(p.andarPct).toBe(st.venda.andarPct);
    const st2 = estado(A, {});
    expect(st2.venda.andarPct).toBe(st.venda.andarPct);    // DEF.venda ganhou o padrão: vale para estudos novos
    st2.venda.andarPct = 0; expect(A.vendaAplicarPadrao(st2)).toBe(true);
    expect(st2.venda.andarPct).toBe(st.venda.andarPct);
  });
  it('modelo de arquivo: cabeçalho com as colunas mínimas e uma linha de exemplo que o próprio importador lê', () => {
    const mat = A.plaCSV(A.calibModeloCSV());
    expect(mat.length).toBe(2);
    const { cab, dados } = A.plaCabecalho(mat), mapa = A.calibMapa(cab);
    ['unidade', 'andar', 'area', 'preco', 'orient', 'tipologia', 'vista', 'cob'].forEach(k => expect(mapa[k]).toBeGreaterThanOrEqual(0));
    const { linhas } = A.calibLinhas(dados, mapa);
    expect(linhas.length).toBe(1);
    expect(linhas[0].area).toBe(65.5); expect(linhas[0].andar).toBe(12); expect(linhas[0].orient).toBe('NE'); expect(linhas[0].cob).toBe(false);
  });
});
