// Item 4.3 — conversões geográficas, GeoJSON da prefeitura → lote e Overpass (OSM) → entorno.
import { describe, it, expect } from 'vitest';
import { carregar } from './harness.js';

const A = carregar();

/* distância geodésica de referência (Vincenty, elipsoide WGS84) — independente do código testado */
function vincenty([lat1, lon1], [lat2, lon2]) {
  const a = 6378137, f = 1 / 298.257223563, b = a * (1 - f), r = Math.PI / 180;
  const L = (lon2 - lon1) * r, U1 = Math.atan((1 - f) * Math.tan(lat1 * r)), U2 = Math.atan((1 - f) * Math.tan(lat2 * r));
  const sU1 = Math.sin(U1), cU1 = Math.cos(U1), sU2 = Math.sin(U2), cU2 = Math.cos(U2);
  let l = L, lp, sS, cS, s, c2a, c2m;
  for (let i = 0; i < 200; i++) {
    const sl = Math.sin(l), cl = Math.cos(l);
    sS = Math.sqrt((cU2 * sl) ** 2 + (cU1 * sU2 - sU1 * cU2 * cl) ** 2); if (sS === 0) return 0;
    cS = sU1 * sU2 + cU1 * cU2 * cl; s = Math.atan2(sS, cS);
    const sa = cU1 * cU2 * sl / sS; c2a = 1 - sa * sa; c2m = c2a ? cS - 2 * sU1 * sU2 / c2a : 0;
    const C = f / 16 * c2a * (4 + f * (4 - 3 * c2a)); lp = l;
    l = L + (1 - C) * f * sa * (s + C * sS * (c2m + C * cS * (-1 + 2 * c2m * c2m)));
    if (Math.abs(l - lp) < 1e-13) break;
  }
  const u2 = c2a * (a * a - b * b) / (b * b), AA = 1 + u2 / 16384 * (4096 + u2 * (-768 + u2 * (320 - 175 * u2))), B = u2 / 1024 * (256 + u2 * (-128 + u2 * (74 - 47 * u2)));
  const ds = B * sS * (c2m + B / 4 * (cS * (-1 + 2 * c2m * c2m) - B / 6 * c2m * (-3 + 4 * sS * sS) * (-3 + 4 * c2m * c2m)));
  return b * AA * (s - ds);
}
// lote de ~50 m em Criciúma (centro), vértices em lat/lon
const LOTE_LL = [[-28.67760, -49.36990], [-28.67760, -49.36939], [-28.67715, -49.36939], [-28.67715, -49.36990]];

describe('lat/lon ↔ metros locais', () => {
  it('ida e volta sem perda (< 1 mm)', () => {
    const ref = A.geoRef(-28.6774, -49.3696);
    for (const [la, lo] of LOTE_LL) { const [x, y] = A.geoParaLocal(la, lo, ref), [la2, lo2] = A.geoDeLocal(x, y, ref); expect(Math.hypot(...A.geoParaLocal(la2, lo2, ref).map((v, i) => v - [x, y][i]))).toBeLessThan(1e-3) }
  });
  it('lote de 50 m: todos os lados e diagonais com erro < 0,5 m (na prática, milímetros)', () => {
    const lp = A.geoLoteDePares(LOTE_LL);
    expect(lp.pts.length).toBe(4);
    let maxErr = 0;
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
      // os pontos locais podem ter sido invertidos para ficar anti-horários: compara pela posição convertida de volta
      const ref = A.geoRef(lp.lat, lp.lon), pi = A.geoParaLocal(...LOTE_LL[i], ref), pj = A.geoParaLocal(...LOTE_LL[j], ref);
      const dLocal = Math.hypot(pi[0] - pj[0], pi[1] - pj[1]), dGeo = vincenty(LOTE_LL[i], LOTE_LL[j]);
      maxErr = Math.max(maxErr, Math.abs(dLocal - dGeo));
    }
    expect(maxErr).toBeLessThan(0.5); expect(maxErr).toBeLessThan(0.01);
    // dimensões ≈ 50 × 50 m e área coerente
    const d1 = vincenty(LOTE_LL[0], LOTE_LL[1]), d2 = vincenty(LOTE_LL[1], LOTE_LL[2]);
    expect(d1).toBeGreaterThan(45); expect(d1).toBeLessThan(55); expect(d2).toBeGreaterThan(45); expect(d2).toBeLessThan(55);
    expect(Math.abs(lp.area - d1 * d2)).toBeLessThan(0.5);
    // origem no centroide e polígono anti-horário
    const c = lp.pts.reduce((s, q) => [s[0] + q[0] / 4, s[1] + q[1] / 4], [0, 0]);
    expect(Math.hypot(...c)).toBeLessThan(0.01);
    expect(A.geoSArea(lp.pts)).toBeGreaterThan(0);
  });
  it('UTM: meridiano central (lon −51°, zona 22) no equador dá 500.000 / 10.000.000 e a ida e volta é exata', () => {
    const [E, N] = A.geoLatLonParaUtm(-1e-9, -51, 22);
    expect(Math.abs(E - 500000)).toBeLessThan(1e-3); expect(Math.abs(N - 10000000)).toBeLessThan(1e-3);
    const [e2, n2] = A.geoLatLonParaUtm(-28.6774, -49.3696);
    const [la, lo] = A.geoUtmParaLatLon(e2, n2, 22, true);
    expect(A.geoDist([la, lo], [-28.6774, -49.3696])).toBeLessThan(0.005);
    // ~1,6° do meridiano central: fator de escala ≈ 0,9999
    const [e3, n3] = A.geoLatLonParaUtm(-28.6774, -49.3686);
    const k = Math.hypot(e3 - e2, n3 - n2) / vincenty([-28.6774, -49.3696], [-28.6774, -49.3686]);
    expect(k).toBeGreaterThan(0.9996); expect(k).toBeLessThan(1.0004);
  });
});

describe('GeoJSON da prefeitura → lote', () => {
  it('Feature em lon/lat (WGS84)', () => {
    const gj = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { inscricao: '123' }, geometry: { type: 'Polygon', coordinates: [[...LOTE_LL.map(([la, lo]) => [lo, la]), [LOTE_LL[0][1], LOTE_LL[0][0]]]] } }] };
    const r = A.geoLerGeoJSON(JSON.stringify(gj));
    expect(r.erro).toBeUndefined(); expect(r.pares.length).toBe(4);
    const lp = A.geoLoteDePares(r.pares);
    expect(Math.abs(lp.area - 2480)).toBeLessThan(80);
  });
  it('UTM SIRGAS 2000 / 22S (crs EPSG:31982): o maior polígono vira o lote, com a área em metros reais', () => {
    const [E, N] = A.geoLatLonParaUtm(-28.6774, -49.3696, 22);
    const sq = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]];
    const gj = { type: 'FeatureCollection', crs: { type: 'name', properties: { name: 'urn:ogc:def:crs:EPSG::31982' } },
      features: [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [sq(E, N, 5, 5)] } }, { type: 'Feature', geometry: { type: 'MultiPolygon', coordinates: [[sq(E + 20, N, 30, 50)]] } }] };
    const r = A.geoLerGeoJSON(gj);
    expect(r.utm).toBe(true); expect(r.zona).toBe(22);
    const lp = A.geoLoteDePares(r.pares);
    expect(Math.abs(lp.area - 1500)).toBeLessThan(1.5); // 30 × 50 m na grade UTM (fator de escala ~0,9999)
    expect(A.geoDist([lp.lat, lp.lon], A.geoUtmParaLatLon(E + 35, N + 25, 22, true))).toBeLessThan(0.05);
  });
  it('arquivo inválido dá mensagem clara', () => {
    expect(A.geoLerGeoJSON('não é json').erro).toMatch(/GeoJSON/);
    expect(A.geoLerGeoJSON({ type: 'FeatureCollection', features: [] }).erro).toMatch(/polígono/);
  });
});

describe('Overpass (OpenStreetMap) → entorno', () => {
  const ref = A.geoRef(-28.6774, -49.3696);
  const box = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]].map(([px, py]) => { const [lat, lon] = A.geoDeLocal(px, py, ref); return { lat, lon } });
  const json = { elements: [
    { type: 'way', id: 1, tags: { building: 'yes', height: '15 m' }, geometry: box(30, 0, 12, 10) },
    { type: 'way', id: 2, tags: { building: 'apartments', 'building:levels': '4', name: 'Ed. Exemplo' }, geometry: box(-40, -5, 15, 20) },
    { type: 'way', id: 3, tags: { building: 'house' }, geometry: box(0, 40, 8, 8) },
    { type: 'way', id: 4, tags: { building: 'yes', 'building:levels': '10' }, geometry: box(-5, -5, 6, 6) }, // dentro do lote: sai
    { type: 'way', id: 5, tags: { building: 'yes', height: '9,5' }, geometry: box(400, 0, 10, 10) }, // longe: sai
    { type: 'relation', id: 6, tags: { building: 'yes', height: '30' }, members: [{ type: 'way', role: 'outer', geometry: box(0, -40, 20, 10) }, { type: 'way', role: 'inner', geometry: box(5, -38, 2, 2) }] },
  ] };
  const lote = [[-10, -10], [10, -10], [10, 10], [-10, 10]];
  const ent = A.geoEntornoDeOverpass(json, ref, lote, { raio: 150 });
  it('altura: height, building:levels × 3 m e padrão de 6 m (estimada)', () => {
    const by = id => ent.find(e => e.osm === id);
    expect(by('w1').h).toBe(15); expect(by('w2').h).toBe(12); expect(by('w2').nome).toBe('Ed. Exemplo');
    expect(by('w3').h).toBe(6); expect(by('w3').est).toBe(true);
    expect(by('r6.0').h).toBe(30);
  });
  it('tira prédios sobre o lote e fora do raio; ignora anéis internos', () => {
    expect(ent.map(e => e.osm).sort()).toEqual(['r6.0', 'w1', 'w2', 'w3']);
  });
  it('geometria em metros locais (erro < 0,5 m) e anti-horária', () => {
    const w1 = ent.find(e => e.osm === 'w1');
    const xs = w1.pts.map(q => q[0]), ys = w1.pts.map(q => q[1]);
    expect(Math.abs(Math.min(...xs) - 30)).toBeLessThan(0.5); expect(Math.abs(Math.max(...xs) - 42)).toBeLessThan(0.5);
    expect(Math.abs(Math.max(...ys) - 10)).toBeLessThan(0.5);
    ent.forEach(e => expect(A.geoSArea(e.pts)).toBeGreaterThan(0));
  });
  it('consulta Overpass bem formada', () => {
    const q = A.geoOverpassQuery(-28.6774, -49.3696, 150);
    expect(q).toMatch(/\[out:json\]/); expect(q).toMatch(/way\["building"\]\(around:150,-28\.6774,-49\.3696\)/); expect(q).toMatch(/out geom;$/);
  });
});
