// Item 2.3 — topografia: Delaunay, superfície, corte/aterro por seções, cota ótima, contenção, lençol, importação e custos no modelo.
import { describe, it, expect } from 'vitest';
import { carregar, estado } from './harness.js';

const A = carregar();
const perto = (v, alvo, tol = 1e-6) => expect(Math.abs(v - alvo)).toBeLessThanOrEqual(tol * Math.max(1, Math.abs(alvo)));

// plano inclinado de volume analítico conhecido: z = 100 + 0,1·y (sobe 4 m da frente y=0 aos fundos y=40)
const zPlano = (x, y) => 100 + 0.1 * y;
const grade = (f, x0, x1, y0, y1, s) => { const o = []; for (let x = x0; x <= x1 + 1e-9; x += s) for (let y = y0; y <= y1 + 1e-9; y += s) o.push([x, y, f(x, y)]); return o };
const LOTE = [[0, 0], [20, 0], [20, 40], [0, 40]];
const PTS = grade(zPlano, -10, 30, -10, 50, 5);

/* conferência "à mão" pelo método das seções (áreas médias), seções transversais a cada 1 m */
function porSecoes(c, nSub = 0, pe = 3, sub = null) {
  const largura = 20, dy = 1; let corte = 0, aterro = 0; const camadas = Array(nSub).fill(0);
  const sec = y => {
    const z = zPlano(0, y);
    const aCorte = largura * Math.max(0, z - c);
    const aAterro = (sub ? 0 : largura) * Math.max(0, c - z);
    const aCam = camadas.map((_, i) => { const top = c - i * pe, bot = c - (i + 1) * pe; return largura * Math.min(pe, Math.max(0, Math.min(z, top) - bot)) });
    return { aCorte, aAterro, aCam };
  };
  for (let y = 0; y < 40; y += dy) {
    const s0 = sec(y), s1 = sec(y + dy);
    corte += (s0.aCorte + s1.aCorte) / 2 * dy; aterro += (s0.aAterro + s1.aAterro) / 2 * dy;
    s0.aCam.forEach((a, i) => camadas[i] += (a + s1.aCam[i]) / 2 * dy);
  }
  return { corte, aterro, camadas };
}

describe('triangulação de Delaunay', () => {
  it('grade regular: 2(n−1)² triângulos e área total do retângulo', () => {
    const P = grade(() => 0, 0, 40, 0, 40, 5).map(q => [q[0], q[1]]); // 9×9
    const T = A.topoDelaunay(P);
    expect(T.length).toBe(2 * 8 * 8);
    const area = T.reduce((s, [a, b, c]) => s + Math.abs((P[b][0] - P[a][0]) * (P[c][1] - P[a][1]) - (P[b][1] - P[a][1]) * (P[c][0] - P[a][0])) / 2, 0);
    perto(area, 1600, 1e-9);
  });
  it('pontos aleatórios: nenhum ponto dentro do circuncírculo de outro triângulo', () => {
    let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const P = Array.from({ length: 300 }, () => [rnd() * 100, rnd() * 60]);
    const T = A.topoDelaunay(P);
    expect(T.length).toBeGreaterThan(500);
    let viol = 0;
    for (const [a, b, c] of T) {
      const [ax, ay] = P[a], [bx, by] = P[b], [cx, cy] = P[c], D = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
      const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / D;
      const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / D;
      const r2 = (ax - ux) ** 2 + (ay - uy) ** 2;
      P.forEach((q, i) => { if (i !== a && i !== b && i !== c && (q[0] - ux) ** 2 + (q[1] - uy) ** 2 < r2 * (1 - 1e-9)) viol++ });
    }
    expect(viol).toBe(0);
  });
});

describe('superfície e volumes (plano inclinado, conferido por seções)', () => {
  const sf = A.topoSuperficie(PTS, LOTE);
  it('interpola o plano exatamente, inclusive fora dos dados (moldura extrapolada)', () => {
    for (const [x, y] of [[3.3, 7.1], [17.2, 39.9], [10, 20], [-15, 55]]) perto(A.topoZ(sf, x, y), zPlano(x, y), 1e-9);
  });
  it('sem subsolo, térreo na cota 102: corte = aterro = 400 m³ (analítico e por seções)', () => {
    const t = A.topoTerra(sf, LOTE, [], 102, 0, 3), s = porSecoes(102);
    perto(t.corte, 400, 1e-9); perto(t.aterro, 400, 1e-9);
    perto(s.corte, 400, 1e-9); perto(s.aterro, 400, 1e-9);
  });
  it('sem subsolo, cota 101: corte 900 m³ e aterro 100 m³', () => {
    const t = A.topoTerra(sf, LOTE, [], 101, 0, 3), s = porSecoes(101);
    perto(t.corte, 900, 1e-9); perto(t.aterro, 100, 1e-9); perto(s.corte, t.corte, 1e-9); perto(s.aterro, t.aterro, 1e-9);
  });
  it('dois subsolos (pé-direito 3 m) na projeção do lote, cota 101: 2.300 + 2.400 m³ de escavação e nenhum aterro', () => {
    const t = A.topoTerra(sf, LOTE, LOTE, 101, 2, 3), s = porSecoes(101, 2, 3, LOTE);
    perto(t.subs[0].vol, 2300, 1e-9); perto(t.subs[1].vol, 2400, 1e-9);
    perto(s.camadas[0], 2300, 1e-9); perto(s.camadas[1], 2400, 1e-9);
    perto(t.platCorte, 900, 1e-9); perto(t.aterro, 0, 1e-9);
    perto(t.corte, 900 + 2300 + 2400, 1e-9);
  });
  it('cota ótima: 102 sem restrição; 101 com a soleira a no máximo 1 m da calçada (100)', () => {
    perto(A.topoCotaOtima(sf, LOTE, [], 0, 3, 102, 5).c, 102, 1e-3);
    const o = A.topoCotaOtima(sf, LOTE, [], 0, 3, 100, 1);
    perto(o.c, 101, 1e-3); perto(o.v, 1000, 1e-3);
  });
  it('contenção: perímetro do subsolo × (terreno ou platô − fundo) = 870 m²', () => {
    // fundo = 101 − 2×3 = 95; frente 20×6 = 120; fundos 20×9 = 180; laterais 2×285 = 570
    const c = A.topoContencao(sf, LOTE, LOTE, 101, 2, 3);
    perto(c.area, 870, 1e-9); perto(c.per, 120, 1e-9); perto(c.fundo, 95, 1e-12); perto(c.hMax, 9, 1e-9);
  });
  it('arrimo do platô sem subsolo: |terreno − platô| no perímetro do lote', () => {
    // c = 102, min 0: frente 20×2 = 40, fundos 20×2 = 40, laterais 2×∫|0,1y−2| = 2×40 = 80 → 160 m²
    const c = A.topoContencao(sf, LOTE, [], 102, 0, 3, { min: 0 });
    perto(c.arrimo, 160, 1e-9); expect(c.area).toBe(0);
  });
  it('curvas de nível do plano: retas y = constante a cada 1 m', () => {
    const cv = A.topoCurvas(sf, 1);
    const c102 = cv.find(l => Math.abs(l.z - 102) < 1e-9);
    expect(c102).toBeTruthy();
    c102.segs.forEach(s => { perto(s[1], 20, 1e-9); perto(s[3], 20, 1e-9) });
    expect(cv.find(l => Math.abs(l.z - 100) < 1e-9).mestra).toBe(true); expect(cv.find(l => Math.abs(l.z - 101) < 1e-9).mestra).toBe(false);
  });
});

describe('importação', () => {
  it('CSV x,y,z com cabeçalho e separador ;', () => {
    const r = A.topoImportar('ponto;x;y;cota\n1;0;0;100\n2;10;0;100,5\n3;0;10;101\n4;10;10;101,5', 'lev.csv', {});
    expect(r.pts.length).toBe(4); expect(r.pts[1]).toEqual([10, 0, 100.5]);
  });
  it('CSV x y z sem cabeçalho (espaços) e com número do ponto', () => {
    const r = A.topoImportar('1 0 0 50\n2 5 0 51\n3 0 5 52\n4 5 5 53', 'a.txt', {});
    expect(r.pts.map(q => q[2])).toEqual([50, 51, 52, 53]);
  });
  it('CSV lat,lon,z: converte para metros locais em relação à origem do lote', () => {
    const r = A.topoImportar('lat,lon,z\n-28.68,-49.37,10\n-28.6801,-49.37,11\n-28.68,-49.3699,12', 'p.csv', { lat: -28.68, lon: -49.37 });
    expect(r.modo).toBe('latlon');
    perto(r.pts[0][0], 0, 1e-9); perto(r.pts[1][1], -11.09, 0.002); perto(r.pts[2][0], 9.77, 0.003);
  });
  it('KML com altitude (pontos e linha)', () => {
    const kml = '<kml><Placemark><Point><coordinates>-49.37,-28.68,12.5</coordinates></Point></Placemark><Placemark><LineString><coordinates>-49.3701,-28.6801,13 -49.3699,-28.6799,14</coordinates></LineString></Placemark></kml>';
    const r = A.topoImportar(kml, 'x.kml', { lat: -28.68, lon: -49.37 });
    expect(r.pts.length).toBe(3); expect(r.pts.map(q => q[2])).toEqual([12.5, 13, 14]);
  });
  it('DXF: POINT, LWPOLYLINE com elevação (código 38) e POLYLINE/VERTEX 3D', () => {
    const g = (...a) => a.join('\n');
    const dxf = g('0', 'SECTION', '2', 'ENTITIES',
      '0', 'POINT', '8', 'COTAS', '10', '1', '20', '2', '30', '101.5',
      '0', 'LWPOLYLINE', '8', 'CURVAS', '38', '100', '90', '2', '10', '0', '20', '0', '10', '6', '20', '0',
      '0', 'POLYLINE', '8', 'C', '66', '1', '10', '0', '20', '0', '30', '0',
      '0', 'VERTEX', '10', '0', '20', '10', '30', '103', '0', 'VERTEX', '10', '4', '20', '10', '30', '103', '0', 'SEQEND',
      '0', 'ENDSEC', '0', 'EOF');
    const r = A.topoImportar(dxf, 'lev.dxf', {});
    expect(r.pts.some(q => q[2] === 101.5)).toBe(true);
    expect(r.pts.filter(q => q[2] === 100).length).toBeGreaterThanOrEqual(3); // linha de 6 m adensada a cada 2 m
    expect(r.pts.filter(q => q[2] === 103).length).toBeGreaterThanOrEqual(2);
  });
  it('coordenadas UTM (SIRGAS 2000 / 22S) caem no lugar certo', () => {
    const [E, N] = A.geoLatLonParaUtm(-28.68, -49.37, 22);
    const r = A.topoImportar(`${E},${N},10\n${E + 10},${N},11\n${E},${N + 10},12`, 'u.csv', { lat: -28.68, lon: -49.37 });
    expect(r.modo).toBe('utm'); expect(Math.hypot(r.pts[0][0], r.pts[0][1])).toBeLessThan(0.01);
    perto(Math.hypot(r.pts[1][0] - r.pts[0][0], r.pts[1][1] - r.pts[0][1]), 10, 0.002); // fator de escala UTM ≈ 1
  });
});

describe('no modelo: custos e ausência de dupla contagem', () => {
  it('desligada (padrão): nada muda — desnível simples e nenhum custo de topografia', () => {
    const st = estado(A, { lote: { desnivel: 2 } }), m = A.compute(st);
    expect(m.topo).toBeUndefined();
    perto(m.terra, m.subA * st.produto.subsolos * st.produto.peGar + m.A * 2 * 0.25, 1e-9);
    expect(m.custosExtra.filter(c => String(c.k).startsWith('topo.')).length).toBe(0);
  });
  it('terreno inclinado de exemplo: volumes coerentes, custos em m.custosExtra e m.terra zerado', () => {
    const st = estado(A, { lote: { desnivel: 2 } });
    st.topo.on = true; st.topo.pts = A.topoExemplo(st.lote.pts, A.frontDir(st));
    st.topo.naOn = true; st.topo.naProf = 3;
    const m = A.compute(st), f = A.finance(st, m), t = m.topo;
    expect(t).toBeTruthy();
    expect(m.terra).toBe(0); // substitui o desnível simples (sem contar em dobro)
    expect(Math.abs(t.c - t.calc)).toBeLessThanOrEqual(st.topo.soleiraTol + 1e-6);
    // escavação dos subsolos ≈ área do subsolo × pé-direito (terreno acima do platô na maior parte)
    t.terra.subs.forEach(s => { expect(s.vol).toBeGreaterThan(m.subA * st.produto.peGar * 0.85); expect(s.vol).toBeLessThanOrEqual(m.subA * st.produto.peGar + 1e-6) });
    expect(t.terra.corte).toBeGreaterThan(t.terra.escav);
    expect(t.cont.area).toBeGreaterThan(t.cont.per * st.produto.subsolos * st.produto.peGar * 0.99);
    const sis = new Set(m.custosExtra.filter(c => String(c.k).startsWith('topo.')).map(c => c.sistema));
    expect([...sis].sort()).toEqual(['contenção', 'impermeabilização', 'movimento de terra']);
    const soma = m.custosExtra.reduce((s, c) => s + c.valor, 0);
    perto(f.extraC, soma, 1e-9); expect(f.terra).toBe(0);
    perto(m.custosExtra.find(c => c.k === 'topo.contencao').valor, t.cont.area * 1500, 1e-9);
  });
  it('cota manual e tolerância respeitadas', () => {
    const st = estado(A, {}); st.topo.on = true; st.topo.pts = A.topoExemplo(st.lote.pts, A.frontDir(st));
    st.topo.cotaModo = 'manual'; st.topo.cotaTerreo = 101.25;
    expect(A.compute(st).topo.c).toBe(101.25);
  });
  it('rápido o bastante para o otimizador e para arrastar controles (cache por assinatura)', () => {
    const st = estado(A, {}); st.topo.on = true; st.topo.pts = A.topoExemplo(st.lote.pts, A.frontDir(st));
    const m = A.compute(st, { quick: true, layouts: false });
    // mudança que não mexe no lote nem no subsolo: tudo vem do cache
    let t0 = performance.now(); for (let i = 0; i < 10; i++) A.topoCalc(st, m); expect((performance.now() - t0) / 10).toBeLessThan(40);
    // cota ótima recalculada do zero (outra tolerância): ainda rápida
    t0 = performance.now(); st.topo.soleiraTol = 0.8; A.topoCalc(st, m); expect(performance.now() - t0).toBeLessThan(300);
  });
});
