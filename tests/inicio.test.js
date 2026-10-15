// Tela inicial "Meus estudos" (UX v3 §3.0): parte pura em src/calc/inicio.js (sem DOM).
import { describe, it, expect } from 'vitest';
import { carregar, estado } from './harness.js';

const A = carregar();

describe('inicioResumo', () => {
  it('com o cálculo: VGV, margem s/ VGV com semáforo, unidades, checklist e miniatura', () => {
    const st = estado(A, { nome: 'Meu estudo', lote: { pts: [[0, 0], [24, 0], [24, 44], [0, 44]], front: [0], rec: [{}, {}, {}, {}] } });
    const m = A.compute(st), f = A.finance(st, m), r = A.inicioResumo(st, m, f);
    const sd = A.saudeNegocio(st, m, f), pr = A.progressoResumo(st, m, f);
    expect(r.v).toBe(1);
    expect(r.vgv).toBeCloseTo(f.vgv, 6);
    expect(r.un).toBe(m.units);
    expect(r.margem).toBeCloseTo(sd.margemVGV, 9);
    expect(r.nivelMargem).toBe(sd.nivel.margem);
    expect(['ruim', 'atencao', 'ok', 'otimo']).toContain(r.nivelMargem);
    expect(r.feitos).toBe(pr.feitos); expect(r.total).toBe(9); expect(r.nivel).toBe(pr.nivel);
    expect(r.exemplo).toBe(false);
    expect(r.area).toBe(Math.round(24 * 44));
    expect(r.cidade).toBe('');                       // regras padrão: sem cidade
    expect(r.mini.l.length).toBe(4);
    expect(r.mini.t.length).toBe(m.T.length);
    expect(JSON.parse(JSON.stringify(r))).toEqual(r);  // vai para o IndexedDB e para a nuvem como JSON
    expect(JSON.stringify(r).length).toBeLessThan(2500);
  });
  it('segue a meta de margem do estudo (S.metas / fin.margemAlvo)', () => {
    const st = estado(A, {}), m = A.compute(st), f = A.finance(st, m);
    const r = A.inicioResumo(st, m, f);
    const st2 = A.clone(st); st2.fin.margemAlvo = Math.max(0, r.margem - 0.5); st2.metas.margem.min = 0; st2.metas.margem.otimo = Math.max(0, r.margem - 0.4);
    expect(A.inicioResumo(st2, m, f).nivelMargem).toBe('otimo');
  });
  it('sem o cálculo: números do resumo anterior; nome da cidade, exemplo e lote do estado', () => {
    const st = estado(A, {}), ant = { vgv: 1e7, margem: 0.2, nivelMargem: 'ok', un: 40, feitos: 3, total: 9, nivel: 'rascunho' };
    const r = A.inicioResumo(st, null, null, ant);
    expect(r.vgv).toBe(1e7); expect(r.un).toBe(40); expect(r.nivel).toBe('rascunho');
    expect(r.exemplo).toBe(true);
    expect(r.mini.l.length).toBe(st.lote.pts.length); expect(r.mini.t.length).toBe(0);
    const r0 = A.inicioResumo(st);
    expect(r0.vgv).toBe(null); expect(r0.margem).toBe(null); expect(r0.nivel).toBe(null);
  });
  it('cidade aplicada aparece no resumo', () => {
    const st = estado(A, {}), c = A.cidadesLista()[0];
    A.cidadeAplicar(st, c.id);
    expect(A.inicioResumo(st).cidade).toBe(st.regras.cidade);
  });
});

describe('miniatura', () => {
  it('normaliza no maior lado = 100 e põe a frente embaixo', () => {
    const st = estado(A, { lote: { pts: [[0, 0], [20, 0], [20, 50], [0, 50]], front: [0], rec: [{}, {}, {}, {}] } });
    const mi = A.inicioMini(st, null);
    expect(mi.h).toBe(100); expect(mi.w).toBe(40);
    expect(mi.fr).toEqual([0]);
    expect(mi.l[0]).toEqual([0, 100]); expect(mi.l[1]).toEqual([40, 100]);   // aresta da frente (y=0 no mundo) embaixo
    expect(mi.l[2]).toEqual([40, 0]);
  });
  it('SVG com lote, frente, sombras e torres (cores no CSS)', () => {
    const st = estado(A, {}), m = A.compute(st);
    const svg = A.inicioMiniSVG(A.inicioMini(st, m), { label: 'Lote "A" & torres' });
    expect(svg.startsWith('<svg')).toBe(true);
    expect((svg.match(/class="ini-t"/g) || []).length).toBe(m.T.length);
    expect((svg.match(/class="ini-s"/g) || []).length).toBe(m.T.length);
    expect(svg).toContain('class="ini-l"'); expect(svg).toContain('class="ini-f"');
    expect(svg).toContain('aria-label="Lote &quot;A&quot; &amp; torres"');
    expect(svg).not.toMatch(/fill="#|stroke="#/);
    expect(A.inicioMiniSVG(null)).toContain('vazio');
  });
});

describe('registros, lista e abertura', () => {
  const r = (id, nome, at, res) => ({ id, nome, atualizado: at, ...(res ? { k: { units: 1, resumo: res } } : {}) });
  const L = [
    r('a', 'Rua das Palmeiras', '2026-10-10T10:00:00Z', { nivel: 'em andamento', margem: 0.18, cidade: 'Criciúma', exemplo: false }),
    r('b', 'Ébano Residencial', '2026-10-14T10:00:00Z', { nivel: 'confiável', margem: 0.31, cidade: 'Florianópolis', exemplo: false }),
    r('c', 'Estudo Rua Exemplo, 120', '2026-10-12T10:00:00Z', { nivel: 'rascunho', margem: 0.215, exemplo: true }),
    r('d', 'Antigo sem resumo', '2026-09-01T10:00:00Z', null),
  ];
  it('resumo vem de rec.resumo ou de rec.k.resumo (nuvem)', () => {
    expect(A.inicioDoRegistro(L[0]).cidade).toBe('Criciúma');
    expect(A.inicioDoRegistro({ resumo: { vgv: 2 }, k: { resumo: { vgv: 1 } } }).vgv).toBe(2);
    expect(A.inicioDoRegistro(L[3])).toBe(null);
    expect(A.inicioStatus(L[0])).toBe('andamento'); expect(A.inicioStatus(L[1])).toBe('confiavel'); expect(A.inicioStatus(L[3])).toBe(null);
  });
  it('exemplo pelo resumo ou, sem resumo, pelo nome', () => {
    expect(A.inicioEhExemplo(L[2])).toBe(true); expect(A.inicioEhExemplo(L[0])).toBe(false);
    expect(A.inicioEhExemplo({ nome: A.DEF.nome })).toBe(true);
  });
  it('busca sem acento por nome e cidade, filtro por status, ordem', () => {
    expect(A.inicioLista(L, { q: 'ebano' }).map(e => e.id)).toEqual(['b']);
    expect(A.inicioLista(L, { q: 'florianopolis' }).map(e => e.id)).toEqual(['b']);
    expect(A.inicioLista(L, { q: 'rua' }).map(e => e.id)).toEqual(['c', 'a']);
    expect(A.inicioLista(L, { status: 'rascunho' }).map(e => e.id)).toEqual(['c']);
    expect(A.inicioLista(L, {}).map(e => e.id)).toEqual(['b', 'c', 'a', 'd']);
    expect(A.inicioLista(L, { ordem: 'nome' }).map(e => e.id)).toEqual(['d', 'b', 'c', 'a']);
    expect(A.inicioLista(L, { ordem: 'margem' }).map(e => e.id)).toEqual(['b', 'c', 'a', 'd']);
    expect(L.map(e => e.id)).toEqual(['a', 'b', 'c', 'd']);   // não muda a lista recebida
  });
  it('abre ao iniciar com 0 estudos próprios ou mais de 1; nunca com webdriver ou #ver=; preferência por cima', () => {
    expect(A.inicioDeve({ total: 0, proprios: 0 })).toBe(true);
    expect(A.inicioDeve({ total: 1, proprios: 0 })).toBe(true);
    expect(A.inicioDeve({ total: 1, proprios: 1 })).toBe(false);
    expect(A.inicioDeve({ total: 2, proprios: 1 })).toBe(true);
    expect(A.inicioDeve({ total: 2, proprios: 2, webdriver: true })).toBe(false);
    expect(A.inicioDeve({ total: 2, proprios: 2, ver: true })).toBe(false);
    expect(A.inicioDeve({ total: 2, proprios: 2, pref: 'nunca' })).toBe(false);
    expect(A.inicioDeve({ total: 1, proprios: 1, pref: 'sempre' })).toBe(true);
    expect(A.inicioDeve({ total: 1, proprios: 1, pref: 'sempre', ver: true })).toBe(false);
  });
  it('"editado há"', () => {
    const agora = Date.parse('2026-10-15T15:00:00');
    const h = s => new Date(agora - s * 1000).toISOString();
    expect(A.inicioTempo(h(20), agora)).toBe('agora');
    expect(A.inicioTempo(h(5 * 60), agora)).toBe('há 5 min');
    expect(A.inicioTempo(h(3 * 3600), agora)).toBe('há 3 h');
    expect(A.inicioTempo(new Date(Date.parse('2026-10-14T20:00:00')).toISOString(), agora)).toBe('ontem');
    expect(A.inicioTempo(new Date(Date.parse('2026-10-11T12:00:00')).toISOString(), agora)).toBe('há 4 dias');
    expect(A.inicioTempo(new Date(Date.parse('2026-09-02T12:00:00')).toISOString(), agora)).toBe('2 set');
    expect(A.inicioTempo(new Date(Date.parse('2025-09-02T12:00:00')).toISOString(), agora)).toBe('2 set 2025');
    expect(A.inicioTempo('', agora)).toBe('');
  });
});
