// Biblioteca de regras por cidade (valores ILUSTRATIVOS): aplicar, desfazer, salvar localmente, fontes externas.
import { describe, it, expect } from 'vitest';
import { carregar, estado } from './harness.js';

describe('cidades', () => {
  const A = carregar();
  it('registros base: cidade, zona, lei, data, só campos conhecidos e marcados como ilustrativos', () => {
    const l = A.cidadesLista().filter(c => c.origem === 'base');
    for (const c of ['Criciúma', 'Florianópolis', 'Balneário Camboriú', 'Joinville', 'Curitiba', 'Porto Alegre', 'São Paulo']) expect(l.some(x => x.cidade === c), c).toBe(true);
    for (const c of l) {
      expect(c.ilustrativo).toBe(true);
      expect(c.lei).toBeTruthy(); expect(c.data).toBeTruthy(); expect(c.zona).toMatch(/exemplo/);
      for (const [k, v] of Object.entries(c.regras)) { expect(A.CIDADES_CAMPOS, k).toContain(k); expect(typeof v, k).toBe(typeof A.DEF.regras[k]) }
      expect(c.regras.caMax).toBeGreaterThanOrEqual(c.regras.caBas);
      expect(c.regras.toEmb).toBeLessThanOrEqual(1);
    }
    expect(A.CIDADES_AVISO).toMatch(/ilustrativo/i);
  });
  it('aplicar preenche S.regras e desfazer volta exatamente', () => {
    const st = estado(A, {}); const antes = JSON.stringify(st.regras);
    const und = A.cidadeAplicar(st, 'sc-florianopolis-mista');
    expect(st.regras.caMax).toBe(3); expect(st.regras.hMax).toBe(42);
    expect(st.regras.cidade).toMatch(/Florianópolis/);
    expect(st.regras.m2Vaga).toBe(A.DEF.regras.m2Vaga); // campos que a zona não define ficam como estavam
    expect(st.regrasRef.lei).toMatch(/482/); expect(st.regrasRef.ilustrativo).toBe(true);
    A.cidadeDesfazer(st, und);
    expect(JSON.stringify(st.regras)).toBe(antes);
    expect(st.regrasRef.id).toBe('');
  });
  it('as regras aplicadas valem no estudo (status lê S.regras)', () => {
    const B = carregar(); const st = estado(B, { produto: { torres: [{ pav: 20 }] } });
    expect(B.status(B.massing(st), st).h).toBe('ok');
    B.cidadeAplicar(st, 'pr-curitiba-residencial');
    expect(st.regras.hMax).toBe(45);
    expect(B.status(B.massing(st), st).h).toBe('bad'); // 20 pavimentos passam da altura do exemplo
  });
  it('biblioteca local (formato antigo e novo) e fonte externa', () => {
    const B = carregar();
    B.LS.set('gabarito.cidades', [{ nome: 'Antiga', regras: { caMax: 2.5 } }]);
    B.cidadeSalvarLocal({ nome: 'Tubarão — ZR2', cidade: 'Tubarão', zona: 'ZR2', lei: 'LC 1/2000', data: '2000', fonte: 'ia', regras: { caMax: 3.2, hMax: 30 } });
    const loc = B.cidadesLista().filter(c => c.origem === 'local');
    expect(loc.map(c => c.cidade)).toEqual(['Antiga', 'Tubarão']);
    const st = estado(B, {}); B.cidadeAplicar(st, loc[1].id);
    expect(st.regras.caMax).toBe(3.2); expect(st.regras.cidade).toBe('Tubarão — ZR2');
    B.cidadesRegistrarFonte({ id: 'nuvem', nome: 'Banco', listar: () => [{ id: 'n:1', cidade: 'Lages', zona: 'Z1', lei: 'x', data: '2020', regras: { caMax: 2 } }] });
    expect(B.cidadeAcha('n:1').fonteNome).toBe('Banco');
  });
});
