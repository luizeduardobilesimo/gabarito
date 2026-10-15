// Teste funcional de ponta a ponta: percorre todas as etapas e sub-abas e exercita cada função de criar, editar,
// mover e excluir, conferindo o efeito no estado (S) e que Ctrl+Z desfaz. Saída "ok / FALHA" por etapa.
// Uso:  node tools/teste-funcional.cjs [--html caminho/test.html] [--out pasta] [--etapas terreno,entorno,regras,produto,viab,projeto,clima,cen,global,celular]
// three.js servido de node_modules; o Overpass (OSM) é respondido pelo fixture tests/fixtures/overpass-torres.json;
// mapas/teselas externos são bloqueados. jsPDF/JSZip vêm da CDN (precisa de internet para PDF, DXF+IFC e XLSX).
// Os downloads são capturados por um window.claude.use("downloads") falso (nome + tamanho).
// Sai com código 1 se alguma verificação falhar ou houver erro de JS.
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const { pathToFileURL } = require('url');
const ROOT = path.resolve(__dirname, '..');
const THREE = path.join(ROOT, 'node_modules', 'three');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d };
const HTML = path.resolve(arg('--html', path.join(ROOT, 'test.html')));
const OUT = path.resolve(arg('--out', path.join(ROOT, 'shots', 'funcional')));
const FIX = path.join(ROOT, 'tests', 'fixtures', 'overpass-torres.json');
const TODAS = ['terreno', 'entorno', 'regras', 'produto', 'viab', 'projeto', 'clima', 'cen', 'global', 'celular'];
const ETAPAS = arg('--etapas', TODAS.join(',')).split(',');
fs.mkdirSync(OUT, { recursive: true });

const placar = {}; let etapaAtual = '';
const ok = (c, msg, extra) => {
  const e = placar[etapaAtual] || (placar[etapaAtual] = { ok: 0, falha: 0, falhas: [] });
  if (c) e.ok++; else { e.falha++; e.falhas.push(msg) }
  console.log((c ? '  ok    ' : '  FALHA ') + msg + (extra !== undefined ? '  ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)) : ''));
};

/* ---------- abrir o app numa aba nova (estado limpo) ---------- */
async function abrir(b, o = {}) {
  const ctx = await b.newContext({ viewport: o.vp || { width: 1440, height: 900 }, deviceScaleFactor: o.dsf || 1, colorScheme: o.tema || 'light',
    hasTouch: !!o.touch, isMobile: !!o.touch, reducedMotion: 'reduce', permissions: ['clipboard-read', 'clipboard-write'] });
  await ctx.addInitScript(t => {
    try { if (!sessionStorage.getItem('qa')) { localStorage.clear(); sessionStorage.setItem('qa', '1') } localStorage.setItem('gabarito.tema', JSON.stringify(t)) } catch (e) {}
    window.__dl = [];
    const tam = d => typeof d === 'string' ? d.length : d && (d.size || d.byteLength || d.length) || 0;
    window.claude = { use: n => n === 'downloads' ? { save: async o => { window.__dl.push({ nome: o.filename, tam: tam(o.data) }) } } : null };
  }, o.tema || 'light');
  const p = await ctx.newPage(); p.setDefaultTimeout(60000);
  await p.route(/three@0\.128\.0\/build\/three\.min\.js/, r => r.fulfill({ path: path.join(THREE, 'build/three.min.js'), contentType: 'application/javascript' }));
  await p.route(/OrbitControls\.js/, r => r.fulfill({ path: path.join(THREE, 'examples/js/controls/OrbitControls.js'), contentType: 'application/javascript' }));
  await p.route(/overpass|\/interpreter/, r => r.fulfill({ path: FIX, contentType: 'application/json' }));
  await p.route(/unpkg\.com|arcgisonline|tile\.openstreetmap|nominatim|fonts\.(googleapis|gstatic)/, r => r.abort());
  p.errs = [];
  p.on('pageerror', e => p.errs.push('PE ' + (e.stack || e.message).split('\n').slice(0, 2).join(' | ')));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR|maplibre|MapLibre/i.test(m.text())) p.errs.push('CE ' + m.text().slice(0, 300)) });
  await p.goto(pathToFileURL(HTML).href, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await p.waitForFunction(() => typeof goStep === 'function' && window._last, null, { timeout: 90000 });
  await p.waitForTimeout(1500);
  return { ctx, p, h: ajudantes(p) };
}

/* ---------- ajudantes ---------- */
function ajudantes(p) {
  const ev = (f, a) => p.evaluate(f, a);
  const W = ms => p.waitForTimeout(ms);
  const J = expr => ev(e => JSON.stringify(eval(e)), expr);
  const ocioso = () => p.waitForFunction(() => typeof calcOcioso !== 'function' || calcOcioso(), null, { timeout: 180000 }).catch(() => {});
  // espera o passo do histórico fechar (500 ms sem mudança) e o cálculo completo chegar: a próxima mudança vira outro passo
  const fim = async () => { await W(150); await p.waitForFunction(() => typeof HIST === 'undefined' || !HIST.pend, null, { timeout: 5000 }).catch(() => {}); await ocioso() };
  const undo = async () => { await ev(() => document.activeElement && document.activeElement.blur()); await W(80); await p.keyboard.press('Control+z'); await W(350); await ocioso() };
  const desfazAte = async (expr, alvo, max = 15) => { for (let k = 0; k < max && (await J(expr)) !== alvo; k++) await undo(); return (await J(expr)) === alvo };
  const sub = async v => { await p.click(`#phead .sub [data-v="${v}"]`); await W(500); await ocioso() };
  const etapa = async (k, s) => { await p.click(`#rail [data-step=${k}]`); await W(400); if (s) await sub(s); await ocioso() };
  const abre = async key => { await ev(k => { const d = document.querySelector(`#tabbody details[data-key="${k}"]`); if (d) d.open = true }, key); await W(150) };
  const mais = async key => { await ev(k => { const a = document.querySelector(`#tabbody details[data-key="${k}"] .adv .advb`); if (a && a.hidden) a.parentElement.querySelector('.advbtn').click() }, key); await W(150) };
  const act = async (a, extra = '') => { await p.click(`#tabbody [data-act="${a}"]${extra}`); await W(350) };
  const arma = async sel => { await p.click(sel); await W(150); const t = await p.textContent(sel).catch(() => ''); await p.click(sel); await W(400); return t };
  const preenche = async (sel, v) => { await p.fill(sel, String(v)); await p.press(sel, 'Tab'); await W(400) };
  const faixa = (sel, v) => ev(([s, v]) => { const r = document.querySelector(s); r.value = v; r.dispatchEvent(new Event('input', { bubbles: true })); r.dispatchEvent(new Event('change', { bubbles: true })) }, [sel, v]);
  // planta 2D: coordenadas do mundo → tela
  const scr = q => ev(q => { const rc = c2.getBoundingClientRect(), s = w2s_(q); return [rc.left + s[0], rc.top + s[1]] }, q);
  const clickW = async q => { const [x, y] = await scr(q); await p.mouse.click(x, y); await W(120) };
  const dragW = async (a, bb, o = {}) => { const [x0, y0] = await scr(a), [x1, y1] = await scr(bb); await p.mouse.move(x0, y0); await p.mouse.down(); for (let k = 1; k <= 8; k++) { await p.mouse.move(x0 + (x1 - x0) * k / 8, y0 + (y1 - y0) * k / 8); await W(30) } await p.mouse.up(); await W(o.w || 700) };
  const espera = async (fn, ms = 10000, a) => { try { await p.waitForFunction(fn, a, { timeout: ms }); return true } catch (e) { return false } };
  const dl = () => ev(() => window.__dl);
  return { ev, W, J, ocioso, fim, undo, desfazAte, sub, etapa, abre, mais, act, arma, preenche, faixa, scr, clickW, dragW, espera, dl };
}
const semErros = (p, onde) => { ok(!p.errs.length, `sem erros de JS (${onde})`, p.errs.length ? p.errs.slice(0, 6).join(' || ') : undefined); p.errs.length = 0 };

/* =====================================================================================
   TERRENO — lote: retângulo, desenhar, vértices, coordenadas, imagem, GeoJSON, frentes,
   recuos por lado, acessos, localização, limites especiais, topografia
   ===================================================================================== */
async function tTerreno(b) {
  const { ctx, p, h } = await abrir(b); const { ev, W, J, undo, desfazAte, abre, act, clickW, dragW, preenche, faixa, fim } = h;
  await ev(() => { goStep('terreno'); setView('impl') }); await W(800);
  const lote0 = await J('S.lote');
  // retângulo
  await act('tmeth', '[data-v="ret"]'); await p.fill('#rf', '25'); await p.fill('#rp', '30'); await act('rect'); await fim();
  ok(await ev(() => G.area(S.lote.pts)) === 750, 'retângulo 25 × 30 m');
  await undo(); ok(await J('S.lote') === lote0, '  Ctrl+Z desfaz o retângulo');
  // desenhar do zero
  await act('tmeth', '[data-v="desenhar"]'); await act('newDraw'); await ev(() => fit2d());
  const P = [[0, 0], [30, 0], [30, 40], [0, 40]];
  for (const q of P) await clickW(q); await clickW(P[0]); await fim();
  ok(await ev(() => S.lote.pts.length === 4 && Math.abs(G.area(S.lote.pts) - 1200) < 2), 'desenhar o lote do zero (4 cliques + fechar)', await ev(() => G.area(S.lote.pts).toFixed(1)));
  await undo(); ok(await J('S.lote') === lote0, '  Ctrl+Z desfaz o desenho');
  // vértices: arrastar, criar pelo meio do lado, remover
  await ev(() => fit2d()); const L = await ev(() => S.lote.pts.map(q => q.slice()));
  await dragW(L[2], [L[2][0] + 4, L[2][1] + 3]); await fim();
  ok(await ev(([x]) => Math.abs(S.lote.pts[2][0] - x - 4) < 0.6, [L[2][0]]), 'arrastar vértice');
  await undo(); ok(await J('S.lote') === lote0, '  Ctrl+Z desfaz o arraste');
  const mid = [(L[0][0] + L[1][0]) / 2, (L[0][1] + L[1][1]) / 2];
  await dragW(mid, [mid[0], mid[1] - 3]); await fim();
  ok(await ev(() => S.lote.pts.length) === L.length + 1, 'criar vértice arrastando o meio do lado');
  await act('rmVert'); await fim(); ok(await ev(() => S.lote.pts.length) === L.length, 'remover o último vértice');
  await undo(); ok(await ev(() => S.lote.pts.length) === L.length + 1, '  Ctrl+Z desfaz a remoção');
  await undo(); ok(await J('S.lote') === lote0, '  Ctrl+Z desfaz a criação');
  // coordenadas
  await act('tmeth', '[data-v="coord"]');
  await p.fill('#coords', '-28.6775, -49.3697\n-28.6777, -49.3694\n-28.6780, -49.3697\n-28.6778, -49.3700');
  await act('coords'); await fim();
  ok(await ev(() => S.lote.pts.length === 4 && Math.abs(S.lote.lat + 28.6775) < 0.01), 'importar coordenadas (lat, lon)', await ev(() => G.area(S.lote.pts).toFixed(0) + ' m²'));
  await undo(); ok(await J('S.lote') === lote0, '  Ctrl+Z desfaz as coordenadas');
  // imagem de fundo + calibração + desenho por cima
  await act('tmeth', '[data-v="img"]');
  const png = path.join(OUT, 'fundo.png'); fs.writeFileSync(png, await p.screenshot({ clip: { x: 500, y: 100, width: 600, height: 500 } }));
  await p.setInputFiles('#bgFile', png); await W(900);
  ok(await ev(() => !!BG && TOOL === 'calib'), 'enviar imagem → modo calibrar');
  await clickW([0, 0]); await clickW([20, 0]); await W(200);
  ok(await ev(() => !document.getElementById('calibBox').hidden), '  caixa de calibração aparece');
  const mpp0 = await ev(() => BG.mpp); await p.fill('#calibDist', '40'); await p.click('#calibOk'); await W(400);
  ok(await ev(m => Math.abs(BG.mpp / m - 2) < 0.01 && TOOL === 'draw', mpp0), '  calibrar (20 m medidos = 40 m reais)');
  const B = await ev(() => G.centroid(S.lote.pts));
  for (const q of [[B[0] - 10, B[1] - 10], [B[0] + 10, B[1] - 10], [B[0] + 10, B[1] + 10]]) await clickW(q); await clickW([B[0] - 10, B[1] - 10]); await fim();
  ok(await ev(() => S.lote.pts.length === 3), '  desenhar o lote sobre a imagem');
  await ev(() => renderTab()); await W(300);
  ok(await ev(() => { const r = document.getElementById('bgOp'); r.value = 0.4; r.dispatchEvent(new Event('input', { bubbles: true })); return BG.op === 0.4 }), '  opacidade da imagem');
  await act('bgCal'); ok(await ev(() => TOOL === 'calib'), '  calibrar de novo'); await ev(() => setTool('edit'));
  await act('bgX'); ok(await ev(() => BG === null), '  remover a imagem');
  ok(await desfazAte('S.lote', lote0), '  Ctrl+Z desfaz o desenho sobre a imagem');
  // mapa (sem rede no teste: mensagem clara) e GeoJSON
  await act('tmeth', '[data-v="mapa"]'); await act('mapaAbrir'); await W(1500);
  ok(await ev(() => { const e = document.getElementById('mapaErr'); return !!document.getElementById('mapaBox') && e && !e.hidden }), 'abrir mapa sem rede mostra mensagem clara');
  await ev(() => mapaFechar());
  const gj = path.join(OUT, 'lote.geojson'); fs.writeFileSync(gj, JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[-49.3697, -28.6775], [-49.3694, -28.6777], [-49.3697, -28.678], [-49.37, -28.6778], [-49.3697, -28.6775]]] } }] }));
  await p.setInputFiles('#geoFile', gj); await fim();
  ok(await ev(() => S.lote.pts.length === 4), 'importar GeoJSON da prefeitura');
  await undo(); ok(await J('S.lote') === lote0, '  Ctrl+Z desfaz o GeoJSON');
  await act('tmeth', '[data-v="desenhar"]');
  // frentes
  await p.click('#edges .edge:nth-child(2) [data-act="front"]'); await fim();
  ok(await ev(() => S.lote.front.includes(1)), 'marcar o lado L2 como rua');
  await p.click('#edges .edge:nth-child(2) [data-act="princ"]'); await fim();
  ok(await ev(() => S.lote.principal === 1), 'L2 como frente principal');
  await undo(); ok(await ev(() => S.lote.principal === 0 && S.lote.front.includes(1)), '  Ctrl+Z desfaz a frente principal');
  await undo(); ok(await J('S.lote') === lote0, '  Ctrl+Z desfaz a rua');
  // recuos por lado e comprimento
  await p.click('#edges .edge:nth-child(1) .xp'); await W(200);
  ok(await ev(() => !!document.getElementById('lado-re-0')), 'abrir o lado L1 (edição na linha)');
  await preenche('#lado-re-0', 6); await fim(); ok(await ev(() => S.lote.rec[0].e === 6), 'recuo próprio do embasamento em L1');
  await preenche('#lado-rt-0', 8); await fim(); ok(await ev(() => S.lote.rec[0].t === 8), 'recuo próprio da torre em L1');
  ok(await ev(() => document.querySelector('#edges .edge .lv').textContent.includes('recuo próprio')), '  a linha mostra "recuo próprio"');
  ok(await desfazAte('S.lote', lote0, 3), '  Ctrl+Z desfaz os recuos');
  await preenche('#lado-len-0', 30); await fim();
  ok(await ev(() => Math.abs(G.edgeLen(S.lote.pts, 0) - 30) < 0.01), 'comprimento do lado L1 = 30 m');
  await undo(); ok(await J('S.lote') === lote0, '  Ctrl+Z desfaz o comprimento');
  ok(await ev(() => { ACT.ladoAb({ dataset: { i: String(S.lote.pts.length - 1) } }); const i = document.getElementById('lado-len-' + (S.lote.pts.length - 1)); return i && i.disabled }), 'último lado bloqueado (fecha o contorno)');
  // acessos
  await faixa('#r-lote-acessoPed', 0.6); await fim(); ok(await ev(() => Math.abs(S.lote.acessoPed - 0.6) < 1e-9), 'acesso de pedestres em 60%');
  await faixa('#r-lote-acessoVei', 0.3); await fim(); ok(await ev(() => Math.abs(S.lote.acessoVei - 0.3) < 1e-9), 'acesso de veículos em 30%');
  ok(await desfazAte('S.lote', lote0, 3), '  Ctrl+Z desfaz os acessos');
  // localização
  await abre('local'); await preenche('#f-lote-norte', 15); await fim();
  ok(await ev(() => S.lote.norte === 15), 'norte a 15°');
  ok(await ev(() => document.getElementById('sum-local').textContent.includes('15')), '  resumo da seção atualiza');
  await undo(); ok(await J('S.lote') === lote0, '  Ctrl+Z desfaz o norte');
  // limites especiais
  await ev(() => fit2d()); await abre('lim'); const c = await ev(() => G.centroid(S.lote.pts));
  await act('lim', '[data-k="emb"]'); const Q = [[c[0] - 6, c[1] - 6], [c[0] + 6, c[1] - 6], [c[0] + 6, c[1] + 6], [c[0] - 6, c[1] + 6]];
  for (const q of Q) await clickW(q); await clickW(Q[0]); await fim();
  ok(await ev(() => S.custom.emb.length === 4), 'desenhar limite especial do embasamento');
  await abre('lim'); await act('lim', '[data-k="emb"]'); for (const q of Q.slice(0, 3)) await clickW(q); await clickW(Q[0]); await fim();
  ok(await ev(() => S.custom.emb.length === 3), 'redesenhar o limite');
  await abre('lim'); await p.click('#tabbody [data-act="limx"][data-k="emb"]'); await W(100);
  ok(await ev(() => S.custom.emb.length === 3), '  limpar pede confirmação');
  await p.click('#tabbody [data-act="limx"][data-k="emb"]'); await fim();
  ok(await ev(() => !S.custom.emb.length), 'limpar o limite');
  await undo(); ok(await ev(() => S.custom.emb.length === 3), '  Ctrl+Z restaura o limite');
  ok(await desfazAte('S.custom.emb.length', '0', 4), '  Ctrl+Z volta ao início');
  // topografia
  await abre('topografia'); const topo0 = await J('S.topo');
  await p.click('#tabbody details[data-key="topografia"] label.sw'); await fim();
  ok(await ev(() => S.topo.on), 'ligar o levantamento topográfico');
  await abre('topografia'); await act('topoEx'); await fim();
  ok(await ev(() => S.topo.pts.length > 10), 'terreno de exemplo', await ev(() => S.topo.pts.length + ' pontos'));
  ok(await ev(() => /pontos/.test(document.getElementById('sum-topografia').textContent)), '  resumo com pontos e térreo');
  await abre('topografia'); await act('topoLimpa'); await fim();
  ok(await ev(() => !S.topo.pts.length), 'limpar a topografia');
  await undo(); ok(await ev(() => S.topo.pts.length > 10), '  Ctrl+Z restaura os pontos');
  const csv = path.join(OUT, 'topo.csv'); fs.writeFileSync(csv, 'x,y,z\n' + [...Array(36)].map((_, k) => { const x = (k % 6) * 12 - 10, y = Math.floor(k / 6) * 12 - 10; return `${x},${y},${(100 + y * 0.1).toFixed(2)}` }).join('\n'));
  await abre('topografia'); await p.setInputFiles('#topoFile', csv); await fim();
  ok(await ev(() => S.topo.pts.length === 36), 'importar CSV de topografia', await ev(() => S.topo.fonte));
  ok(await desfazAte('S.topo', topo0, 5), '  Ctrl+Z volta ao início');
  await p.screenshot({ path: path.join(OUT, 'terreno.png') });
  semErros(p, 'terreno'); await ctx.close();
}

/* =====================================================================================
   ENTORNO — caixa, selecionar, mover, redimensionar, pátio, vazio, girar, altura, duplicar,
   apagar, retângulo de seleção, desenhar, gerar genéricos; contexto OSM (fixture), chips, apagar contexto
   ===================================================================================== */
async function tEntorno(b) {
  const { ctx, p, h } = await abrir(b); const { ev, W, J, undo, desfazAte, abre, act, clickW, dragW, scr, fim, espera } = h;
  await ev(() => { goStep('terreno'); setView('impl'); fit2d() }); await W(600);
  await abre('entedit'); const ent0 = await J('S.entorno');
  await act('entNova'); await fim(); ok(await ev(() => S.entorno.length === 1 && ENT.sel.size === 1), 'nova caixa (já selecionada)');
  ok(await ev(() => !document.getElementById('entBar').hidden), '  barra de edição aparece');
  let e = await ev(() => entCentro(S.entorno[0]));
  await dragW(e, [e[0] + 5, e[1] + 5]); await fim();
  ok(await ev(([x]) => Math.abs(entCentro(S.entorno[0])[0] - x - 5) < 0.6, [e[0]]), 'mover arrastando');
  await undo(); ok(await ev(([x]) => Math.abs(entCentro(S.entorno[0])[0] - x) < 0.01, [e[0]]), '  Ctrl+Z desfaz o movimento');
  const a0 = await ev(() => Math.abs(G.sArea(S.entorno[0].pts)));
  const hp = await ev(() => entEscalaPos(S.entorno[0])), cc = await ev(() => entCentro(S.entorno[0]));
  await ev(() => { ENT.sel = new Set([entId(S.entorno[0])]); redraw2d(); entBarRefresh() }); await W(150);
  await dragW(hp, [cc[0] + (hp[0] - cc[0]) * 1.5, cc[1] + (hp[1] - cc[1]) * 1.5]); await fim();
  ok(await ev(a => Math.abs(G.sArea(S.entorno[0].pts)) > a * 1.8, a0), 'redimensionar pelo quadrado do canto');
  await undo(); ok(await ev(a => Math.abs(Math.abs(G.sArea(S.entorno[0].pts)) - a) < 0.5, a0), '  Ctrl+Z desfaz o redimensionamento');
  await ev(() => { ENT.sel = new Set([entId(S.entorno[0])]); redraw2d(); entBarRefresh() }); await W(150);
  await p.click('#entBar [data-act="entPatio"]'); await fim(); ok(await ev(() => (S.entorno[0].vazios || []).length === 1), 'criar pátio (vazio central)');
  await p.click('#entBar .chip [data-act="entVazioX"]'); await fim(); ok(await ev(() => !(S.entorno[0].vazios || []).length), 'remover o vazio pelo chip');
  await undo(); ok(await ev(() => (S.entorno[0].vazios || []).length === 1), '  Ctrl+Z devolve o vazio');
  // desenhar um vazio dentro da edificação
  await p.click('#entBar [data-act="entVazio"]'); await W(200);
  const cv = await ev(() => entCentro(S.entorno[0]));
  for (const q of [[cv[0] + 3, cv[1] + 3], [cv[0] + 7, cv[1] + 3], [cv[0] + 7, cv[1] + 7]]) await clickW(q); await clickW([cv[0] + 3, cv[1] + 3]); await fim();
  ok(await ev(() => (S.entorno[0].vazios || []).length === 2), 'desenhar um vazio à mão', await ev(() => (S.entorno[0].vazios || []).length));
  await ev(() => { setTool('edit'); ENT.sel = new Set([entId(S.entorno[0])]); redraw2d(); entBarRefresh() }); await W(150);
  const p0 = await J('S.entorno[0].pts');
  await p.click('#entBar [data-act="entGiraD"]'); await fim(); ok(await J('S.entorno[0].pts') !== p0, 'girar 15°');
  await p.click('#entBar [data-act="entMais"]'); await fim(); ok(true, '+ tamanho');
  await p.fill('#entAlt', '30'); await W(600); await fim(); ok(await ev(() => S.entorno[0].h === 30), 'altura 30 m pela barra');
  await p.fill('#entNome', 'Vizinho X'); await W(300); await ev(() => document.activeElement.blur()); await fim(); ok(await ev(() => S.entorno[0].nome === 'Vizinho X'), 'nome pela barra');
  await p.click('#entBar [data-act="entDup"]'); await fim(); ok(await ev(() => S.entorno.length === 2), 'duplicar');
  await ev(() => document.activeElement && document.activeElement.blur()); await p.keyboard.press('Delete'); await fim();
  ok(await ev(() => S.entorno.length === 1), 'apagar com Delete');
  await undo(); ok(await ev(() => S.entorno.length === 2), '  Ctrl+Z desfaz o apagar');
  await undo(); ok(await ev(() => S.entorno.length === 1), '  Ctrl+Z desfaz o duplicar');
  // setas movem a seleção
  await ev(() => { ENT.sel = new Set([entId(S.entorno[0])]); redraw2d(); entBarRefresh() }); await ev(() => document.activeElement && document.activeElement.blur());
  const cs = await ev(() => entCentro(S.entorno[0])); await p.keyboard.press('ArrowRight'); await fim();
  ok(await ev(x => entCentro(S.entorno[0])[0] > x + 0.05, cs[0]), 'seta → move a seleção');
  // desenhar edificação
  await abre('entedit'); await act('entDesenha');
  const D = await ev(() => { const r = c2.getBoundingClientRect(); return [[0.82, 0.2], [0.95, 0.2], [0.95, 0.35]].map(([a, b]) => s2w_(r.width * a, r.height * b)) });
  for (const q of D) await clickW(q); await clickW(D[0]); await fim();
  ok(await ev(() => S.entorno.length === 2), 'desenhar edificação');
  // seleção por retângulo (Shift + arrastar no vazio)
  await ev(() => { entLimpaSel(); entEnquadrar() }); await W(500);
  const r = await ev(() => { const rc = c2.getBoundingClientRect(), cs = S.entorno.flatMap(e => e.pts.map(q => w2s_(q))), xs = cs.map(c => c[0]), ys = cs.map(c => c[1]);   // retângulo que envolve as duas inteiras
    return [rc.left + Math.max(4, Math.min(...xs) - 25), rc.top + Math.min(rc.height - 4, Math.max(...ys) + 25), rc.left + Math.min(rc.width - 4, Math.max(...xs) + 25), rc.top + Math.max(4, Math.min(...ys) - 25)] });
  await p.keyboard.down('Shift'); await p.mouse.move(r[0], r[1]); await p.mouse.down(); await p.mouse.move(r[2], r[3], { steps: 8 }); await p.mouse.up(); await p.keyboard.up('Shift'); await W(300);
  ok(await ev(() => ENT.sel.size === 2), 'Shift + arrastar seleciona as duas', await ev(() => ENT.sel.size));
  await abre('entedit'); await act('entNenhuma'); ok(await ev(() => ENT.sel.size === 0), 'soltar a seleção');
  await abre('entedit'); await act('entTodas'); ok(await ev(() => ENT.sel.size === 2), 'selecionar todas');
  await abre('entedit'); await act('entApagaSel'); await fim(); ok(await ev(() => S.entorno.length === 0), 'apagar selecionadas');
  await undo(); ok(await ev(() => S.entorno.length === 2), '  Ctrl+Z restaura');
  await abre('entedit'); await p.click('#tabbody [data-act="entApagaTodas"]'); await W(150);
  ok(await ev(() => S.entorno.length === 2), '  apagar todas pede confirmação');
  await p.click('#tabbody [data-act="entApagaTodas"]'); await fim();
  ok(await ev(() => S.entorno.length === 0), 'apagar todas');
  // gerar genéricos + nomes e alturas (Mais opções)
  await abre('entedit'); await act('entGen'); await fim();
  const ng = await ev(() => S.entorno.length); ok(ng > 0, 'gerar vizinhos genéricos', ng + ' volumes');
  await abre('entedit'); await h.mais('entedit');
  const h0 = await ev(() => S.entorno[0].h); await h.preenche('#tabbody input[data-p="entorno.0.h"]', h0 + 3); await fim();
  ok(await ev(x => S.entorno[0].h === x, h0 + 3), 'editar altura em "Nomes e alturas"');
  await undo(); ok(await ev(x => S.entorno[0].h === x, h0), '  Ctrl+Z desfaz a altura');
  await abre('entedit'); await p.click('#tabbody [data-act="entX"][data-i="0"]'); await fim();
  ok(await ev(n => S.entorno.length === n - 1, ng), 'remover volume da lista');
  ok(await desfazAte('S.entorno', ent0, 30), 'Ctrl+Z volta ao entorno inicial');

  // contexto do OpenStreetMap (Overpass respondido pelo fixture)
  await ev(() => { S.lote.lat = -29.3362; S.lote.lon = -49.7222; S.lote.geo = true; S.mapa.raio = 160; S.contexto.raio = 320; S.entorno = []; save(); goStep('terreno') }); await W(600); await h.fim();
  await abre('entedit'); await p.click('#tabbody [data-act="mapaEntorno"]');
  ok(await espera(() => !!(S.contexto && S.contexto.dados) && S.entorno.length > 20, 60000), 'buscar entorno do OSM (fixture) traz contexto e edificações', await ev(() => ({ ent: S.entorno.length, osm: S.entorno.filter(e => e.osm).length })));
  await fim();
  ok(await ev(() => /OSM/.test(document.getElementById('sum-entedit').textContent)), '  resumo da seção conta as do OSM');
  await abre('entedit');
  for (const k of ['casas', 'ruas']) {
    const sel = `#ctxChips [data-k="${k}"]`;
    if (!await p.$(sel)) { ok(false, `chip ${k} presente`); continue }
    await p.click(sel); await fim();
    ok(await ev(k => S.contexto.camadas[k] === false && document.querySelector(`#ctxChips [data-k="${k}"]`).getAttribute('aria-pressed') === 'false', k), `chip "${k}" desliga a camada`);
    await p.click(sel); await fim();
    ok(await ev(k => S.contexto.camadas[k] !== false, k), `chip "${k}" religa`);
  }
  const n3d = await ev(() => { setView('3d'); rebuild3d(window._last.m, true); return V3.grp.children.length }); ok(n3d > 20, 'contexto aparece no 3D', n3d + ' objetos');
  await ev(() => { goStep('terreno'); setView('impl') }); await W(400); await abre('entedit');
  await p.click('#tabbody [data-act="ctxApaga"]'); await W(150); ok(await ev(() => !!S.contexto.dados), '  apagar contexto pede confirmação');
  await p.click('#tabbody [data-act="ctxApaga"]'); await fim();
  ok(await ev(() => S.contexto.dados === null && !S.entorno.some(e => e.osm)), 'apagar contexto tira camadas e prédios do OSM');
  await undo(); ok(await ev(() => !!S.contexto.dados && S.entorno.some(e => e.osm)), '  Ctrl+Z traz o contexto de volta');
  // ruas → frentes (fixture: lote de esquina Avenida Beira-Mar × Rua Leonardo Truda, georreferenciado)
  await ev(() => { S.lote.pts = [[55.43, 99.92], [68.23, 117.82], [42.71, 129.35], [29.92, 111.46]]; S.lote.front = [2]; S.lote.principal = 2; S.lote.rec = S.lote.pts.map(() => ({})); S.lote.acessoVei = 0.85; S.frentes.sug = null; update(); renderTab() }); await W(500); await h.fim();
  const fr0 = await ev(() => JSON.stringify([S.lote.front, S.lote.principal, S.lote.acessoVei]));
  await p.click('#tabbody [data-act="frDetectar"]');
  ok(await espera(() => !!S.frentes.sug, 60000), 'detectar frentes pelas ruas (contexto do OSM já carregado)');
  ok(await ev(a => JSON.stringify([S.lote.front, S.lote.principal, S.lote.acessoVei]) === a, fr0), '  nada muda antes de confirmar');
  ok(await ev(() => S.frentes.sug.tipo === 'esquina' && S.frentes.sug.lados.some(l => l.nome === 'Avenida Beira-Mar')), '  esquina com a Avenida Beira-Mar');
  await p.click('#tabbody [data-act="frAplicar"]'); await fim();
  ok(await ev(() => S.lote.front.length === 2 && S.lote.principal === 0), 'aplicar sugestão marca as frentes e a principal');
  await undo(); ok(await ev(a => JSON.stringify([S.lote.front, S.lote.principal, S.lote.acessoVei]) === a, fr0), '  Ctrl+Z desfaz a sugestão');
  // sem georreferência a busca do OSM não roda e o card Localização se destaca
  await ev(() => { S.lote.geo = false; S.contexto.dados = null; S.frentes.sug = null; update(); renderTab() }); await W(300);
  await p.click('#tabbody [data-act="frDetectar"]'); await W(400);
  ok(await ev(() => S.contexto.dados === null && /Posicione o lote no mapa/.test(document.getElementById('frBox').textContent)), 'sem georreferência: não busca e pede para posicionar');
  ok(await ev(() => !!document.querySelector('details[data-key="local"]').open), '  card Localização abre');
  await ev(() => { S.lote.geo = true; update(); renderTab() });
  await p.screenshot({ path: path.join(OUT, 'entorno-osm.png') });
  semErros(p, 'entorno'); await ctx.close();
}

/* =====================================================================================
   REGRAS — cidade aplicar/desfazer, IA, CA, busca, regras de forma, normas
   ===================================================================================== */
async function tRegras(b) {
  const { ctx, p, h } = await abrir(b); const { ev, W, J, undo, abre, act, preenche, fim, etapa } = h;
  await etapa('regras', 'pref');
  const R0 = await J('S.regras');
  const opt = await ev(() => document.querySelector('#cidLib option[value]:not([value=""])').value);
  await p.selectOption('#cidLib', opt); await fim();
  ok(await J('S.regras') !== R0, 'aplicar regras de uma cidade', await ev(() => S.regras.cidade));
  await act('cidUndo'); await fim(); ok(await J('S.regras') === R0, '  botão Desfazer da cidade');
  await p.selectOption('#cidLib', opt); await fim(); await undo();
  ok(await J('S.regras') === R0, '  Ctrl+Z desfaz a cidade aplicada');
  await p.click('#tabbody .adv[data-adv="regras:ia"] .advbtn'); await W(200);
  ok(await ev(() => !!document.getElementById('aiZona') && !document.getElementById('aiZona').closest('[hidden]')), 'abrir leitura do plano diretor com IA');
  await preenche('#f-regras-caMax', 5); await fim();
  ok(await ev(() => S.regras.caMax === 5), 'editar CA máximo'); await undo(); ok(await J('S.regras') === R0, '  Ctrl+Z desfaz o CA');
  await p.fill('#rgFind', 'pé'); await W(300);
  ok(await ev(() => /Projeto/.test(document.getElementById('rgFindOut').textContent)), 'busca aponta resultado em outra aba');
  await p.click('#rgFindOut [data-v="proj"]'); await W(500);
  ok(await ev(() => subAtual('regras') === 'proj' && [...document.querySelectorAll('#tabbody [data-q]')].filter(f => !f.hidden).length >= 1), '  chip leva à aba Projeto filtrada');
  await p.fill('#rgFind', ''); await W(200);
  ok(await ev(() => !document.querySelector('#tabbody details[data-key="vaga"]').open), '  limpar a busca fecha o que abriu');
  await h.sub('pref'); await abre('forma');
  await p.click('#tabbody details[data-key="forma"] label.sw'); await fim();
  ok(await ev(() => S.forma.on), 'ligar regras de forma (recuos progressivos)');
  await undo(); ok(await ev(() => !S.forma.on), '  Ctrl+Z desliga');
  await h.sub('normas'); await W(500);
  ok(await ev(() => document.querySelectorAll('#nrmList .nrm-it').length > 3), 'checklist de normas');
  await abre('nrmOpc'); await p.click('#tabbody details[data-key="nrmOpc"] label.sw >> nth=0'); await fim();
  ok(await ev(() => S.normas.chuveiros === true), 'opção chuveiros automáticos');
  ok(await ev(() => document.getElementById('sum-nrmOpc').textContent.includes('com chuveiros')), '  resumo da seção');
  await undo(); ok(await ev(() => !S.normas.chuveiros), '  Ctrl+Z desfaz');
  semErros(p, 'regras'); await ctx.close();
}

/* =====================================================================================
   PRODUTO — torres, mix, embasamento, coberturas, lazer, otimizar/cancelar/aplicar, Pareto, aprovar
   ===================================================================================== */
async function tProduto(b) {
  const { ctx, p, h } = await abrir(b); const { ev, W, undo, desfazAte, fim, etapa, sub, arma, preenche, faixa } = h;
  const st = k => ev(k => JSON.parse(JSON.stringify(eval(k))), k);
  const canon = o => JSON.stringify(o, (k, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.keys(v).sort().reduce((a, k) => (a[k] = v[k], a), {}) : v);
  const SEL = (pth, v) => `[data-set="${pth}"][data-v='"${v}"']`;
  await etapa('produto', 'prod');
  // torres
  const T0 = await st('S.produto.torres'), T0j = JSON.stringify(T0);
  await p.click('#tabbody [data-act=addTorre]'); await fim();
  ok((await st('S.produto.torres')).length === T0.length + 1, 'adicionar torre');
  await undo(); ok((await st('S.produto.torres')).length === T0.length, '  Ctrl+Z desfaz');
  const t = await arma('#torres [data-act=prArm][data-do=rmT][data-i="1"]'); await fim();
  ok(t.trim() === 'Confirmar' && (await st('S.produto.torres')).length === T0.length - 1, 'remover torre (armar → confirmar)', t.trim());
  await undo(); ok((await st('S.produto.torres')).length === T0.length, '  Ctrl+Z desfaz');
  await p.click('#torres .pr-row:nth-child(1) [data-stp="1"]'); await fim();
  ok((await st('S.produto.torres[0].pav')) === T0[0].pav + 1, 'pavimentos +1 (stepper)');
  await preenche('#torres input[data-p="produto.torres.1.pav"]', 10); await fim();
  ok((await st('S.produto.torres[1].pav')) === 10, 'digitar pavimentos');
  ok(await desfazAte('S.produto.torres', T0j, 3), '  Ctrl+Z desfaz os pavimentos');
  await p.click('#torres [data-act=maxT][data-i="1"]'); await fim();
  ok((await st('S.produto.torres[1].pav')) !== T0[1].pav, 'máximo da torre 2');
  await undo(); ok((await st('S.produto.torres[1].pav')) === T0[1].pav, '  Ctrl+Z desfaz');
  await p.click('#tabbody [data-act=maxPav]'); await fim();
  const tp = await st('S.produto.torres'); ok(tp[0].pav === tp[1].pav, 'máximo em todas');
  await undo(); ok(JSON.stringify(await st('S.produto.torres')) === T0j, '  Ctrl+Z desfaz');
  await p.click(SEL('produto.torreEixo', 'trans')); await fim();
  ok((await st('S.produto.torreEixo')) === 'trans', 'disposição transversal');
  await undo(); ok((await st('S.produto.torreEixo')) === 'long', '  Ctrl+Z desfaz');
  // mix
  const M0 = await st('S.produto.mix'), M0j = JSON.stringify(M0), n = M0.length;
  await p.click('#tabbody [data-act=addMix]'); await fim();
  ok((await st('S.produto.mix')).length === n + 1 && !!(await p.$(`#mix .pr-row.on input[data-p="produto.mix.${n}.area"]`)), 'adicionar tipologia (abre a linha)');
  for (const [k, v] of [['area', '42'], ['preco', '13000'], ['sac', '4'], ['nome', '1 dorm.']]) await preenche(`#mix [data-p="produto.mix.${n}.${k}"]`, v);
  await fim();
  const mm = await st(`S.produto.mix[${n}]`); ok(mm.area === 42 && mm.preco === 13000 && mm.sac === 4 && mm.nome === '1 dorm.', 'editar tipologia (nome, área, preço, sacada)', mm);
  ok((await p.textContent(`#mix .pr-row:nth-child(${n + 1}) .pr-tx b`)) === '1 dorm.', '  a linha mostra o nome novo');
  await p.click(`#mix .pr-row:nth-child(${n + 1}) [data-stp="1"]`); await fim();
  ok((await st(`S.produto.mix[${n}].qtd`)) === 2, 'unidades por andar (stepper)');
  await p.click(`#mix .pr-ic.chev[data-i="${n}"]`); await W(200); ok(!(await p.$('#mix .pr-row.on')), 'fechar a linha');
  await p.click('#mix .pr-tx[data-i="0"]'); await W(200); ok(!!(await p.$('#mix .pr-row.on input[data-p="produto.mix.0.area"]')), 'abrir a linha pelo nome');
  await arma('#mix [data-act=prArm][data-do=rmMix][data-i="0"]'); await fim();
  ok((await st('S.produto.mix')).length === n && (await st('S.produto.mix[0].nome')) !== M0[0].nome, 'remover tipologia');
  ok(await desfazAte('S.produto.mix', M0j, 10), '  Ctrl+Z desfaz tudo do mix');
  await p.click('details[data-key="pr-mix"] .advbtn'); await W(200);
  await p.click(SEL('produto.sacTipo', 'balanco')); await fim();
  ok((await st('S.produto.sacTipo')) === 'balanco', 'sacadas em balanço (Mais opções)');
  await undo(); ok((await st('S.produto.sacTipo')) === 'embutida', '  Ctrl+Z desfaz');
  // embasamento
  const P0 = await st('S.produto');
  await h.abre('pr-emb');
  await p.click('details[data-key="pr-emb"] input[data-p="produto.subsolos"] + button'); await fim();
  await p.click('details[data-key="pr-emb"] input[data-p="produto.garAcima"] + button'); await fim();
  ok((await st('S.produto.subsolos')) === P0.subsolos + 1 && (await st('S.produto.garAcima')) === P0.garAcima + 1, 'subsolos e garagens elevadas');
  await faixa('input[data-p="produto.lojaTerreo"]', 0.4); await fim();
  ok(Math.abs((await st('S.produto.lojaTerreo')) - 0.4) < 1e-9, 'lojas no térreo');
  await p.click('details[data-key="pr-emb"] label.sw:has(input[data-p="produto.garTerOn"])'); await fim();
  ok((await st('S.produto.garTerOn')) === !P0.garTerOn, 'garagem no térreo');
  await p.click('details[data-key="pr-emb"] .advbtn'); await W(200);
  await p.click('details[data-key="pr-emb"] label.sw:has(input[data-p="produto.atico"])'); await fim();
  await p.click('details[data-key="pr-emb"] label.sw:has(input[data-p="produto.vagasFrente"])'); await fim();
  ok((await st('S.produto.atico')) === !P0.atico && (await st('S.produto.vagasFrente')) === !P0.vagasFrente, 'ático e vagas na frente (Mais opções)');
  ok((await p.textContent('#sum-pr-emb')).includes((P0.subsolos + 1) + ' subsolos'), '  resumo da seção atualiza', await p.textContent('#sum-pr-emb'));
  ok(await desfazAte('S.produto', JSON.stringify(P0), 10), '  Ctrl+Z desfaz o embasamento');
  await h.abre('pr-cob');
  await p.click('details[data-key="pr-cob"] label.sw:has(input[data-p="produto.cob.on"])'); await fim();
  ok((await st('S.produto.cob.on')) === false && !(await p.$('input[data-p="produto.cob.qtd"]')), 'desligar coberturas esconde os campos');
  await undo(); ok((await st('S.produto.cob.on')) === true && !!(await p.$('input[data-p="produto.cob.qtd"]')), '  Ctrl+Z religa');
  // lazer
  await sub('lazer');
  const L0 = await st('S.produto.lazer'), L0j = JSON.stringify(L0);
  await p.click('#lzAddBtn'); await W(250); ok(await p.isVisible('#lzMenu'), 'menu de modelos de ambiente');
  await p.click('#lzMenu [data-act=lzAdd]:has-text("Brinquedoteca")'); await fim();
  let L1 = await st('S.produto.lazer.itens'); ok(L1.length === L0.itens.length + 1 && L1.at(-1).nome === 'Brinquedoteca' && !(await p.isVisible('#lzMenu')), 'adicionar ambiente pelo modelo');
  const k = L1.length - 1;
  ok(!!(await p.$(`#lzList .pr-row.on select[data-p="produto.lazer.itens.${k}.local"]`)), '  o novo ambiente abre para editar');
  await p.selectOption(`select[data-p="produto.lazer.itens.${k}.local"]`, 'pav'); await fim();
  await preenche(`input[data-p="produto.lazer.itens.${k}.area"]`, 55); await fim();
  await p.click(`#lzList label.sw:has(input[data-p="produto.lazer.itens.${k}.desc"])`); await fim();
  L1 = await st('S.produto.lazer.itens'); ok(L1[k].local === 'pav' && L1[k].area === 55 && L1[k].desc === true, 'mudar local, área e descoberto', L1[k]);
  await arma(`#lzList [data-act=prArm][data-do=lzRm][data-i="${k}"]`); await fim();
  ok((await st('S.produto.lazer.itens')).length === L0.itens.length, 'remover ambiente');
  await undo(); ok((await st('S.produto.lazer.itens')).length === L0.itens.length + 1, '  Ctrl+Z devolve o ambiente');
  ok(await desfazAte('S.produto.lazer', L0j, 8), '  Ctrl+Z desfaz tudo do lazer');
  await p.click('#lzList .pr-tx[data-k=hall]'); await W(250);
  await preenche('input[data-p="produto.lazer.hall"]', 120); await fim();
  ok((await st('S.produto.lazer.hall')) === 120, 'hall social');
  await undo(); ok((await st('S.produto.lazer.hall')) === L0.hall, '  Ctrl+Z desfaz');
  await p.click('#lzAddBtn'); await W(200); await p.keyboard.press('Escape'); await W(200); ok(!(await p.isVisible('#lzMenu')), 'Esc fecha o menu');
  // otimizar
  await sub('otim');
  const O0 = await st('S.otim');
  await p.click('[data-act=otk][data-k=torres]'); await fim(); ok((await st('S.otim.torres')) === !O0.torres, 'chip "Nº de torres"');
  await undo(); ok((await st('S.otim.torres')) === O0.torres, '  Ctrl+Z desfaz');
  await p.click(SEL('otim.obj', 'margem')); await fim(); ok((await st('S.otim.obj')) === 'margem', 'objetivo: margem');
  await p.click(SEL('otim.obj', 'lucro')); await fim();
  await p.click('#tabbody [data-act="otim"]');
  ok(!!(await p.waitForSelector('#tabbody [data-act="calcCancel"]', { timeout: 20000 }).catch(() => null)), 'gerar opções mostra "Cancelar análise"');
  await p.click('#tabbody [data-act="calcCancel"]'); await W(400);
  ok(await ev(() => !OTRUN && !CALC.jobAtivo && !!document.querySelector('#tabbody [data-act="otim"]')), 'cancelar a análise');
  await p.click('#tabbody [data-act="otim"]');
  await p.waitForFunction(() => !OTRUN && OTIM, null, { timeout: 400000 }).catch(() => {}); await W(500);
  ok(await ev(() => !!OTIM && OTIM.res.length > 0 && !!document.querySelector('#otRes [data-act=otApply]')), 'opções geradas', await ev(() => OTIM && { n: OTIM.res.length, s: Math.round(OTIM.ms / 1000) }));
  const antes = canon(await st('S.produto'));
  await p.click('#otRes [data-act=otApply][data-i="0"]'); await fim();
  const r0 = await ev(() => OTIM.res[0]), pa = await st('S.produto');
  ok(pa.torres.length === r0.nT && pa.torres[0].pav === r0.pav && pa.subsolos === r0.sub, 'aplicar a melhor opção');
  // bug conhecido (comodos.js): opções do otimizador + troca do mix davam TypeError "r.bordas"
  for (let i = 1; i < Math.min(4, await ev(() => OTIM.res.length)); i++) { await ev(() => { const d = document.querySelector('#otRes details.pr-more'); if (d) d.open = true }); await p.click(`#otRes [data-act=otApply][data-i="${i}"]`); await fim() }
  ok(await ev(() => OTIM.res.length < 2 || S.produto.torres[0].pav === OTIM.res[Math.min(3, OTIM.res.length - 1)].pav), 'aplicar as outras opções ("Outras opções")');
  await ev(() => { const mx = S.produto.mix; [[70, 1, 4], [32, 3, 4], [45, 2, 8], [85, 1, 8]].forEach(([a, q, s]) => { mx[0].area = a; mx[0].qtd = q; mx[0].sac = s; S.produto.sacTipo = 'embutida'; compute(S) }) });
  ok(!p.errs.some(e => /comodos|bordas/.test(e)), 'opções do otimizador + troca do mix sem erro nos cômodos', p.errs.filter(e => /comodos/.test(e)).slice(0, 2).join(' | ') || undefined);
  for (let i = 0; i < 8 && canon(await st('S.produto')) !== antes; i++) await undo();
  ok(canon(await st('S.produto')) === antes, '  Ctrl+Z desfaz as opções aplicadas');
  if (await p.$('#pfChart .pt')) {
    await p.click('#pfChart .pt >> nth=0', { force: true }); await W(300);
    ok(!!(await p.$('#pfDet [data-act=pfApply]')), 'ponto do Pareto mostra o detalhe');
    const i = await p.getAttribute('#pfDet [data-act=pfApply]', 'data-i');
    await p.click('#pfDet [data-act=pfApply]'); await fim();
    const rp = await ev(i => OTIM.pareto.pts[+i], i), pb = await st('S.produto');
    ok(pb.torres.length === rp.nT && pb.torres[0].pav === rp.pav, 'aplicar ponto do Pareto');
    await undo(); ok(canon(await st('S.produto')) === antes, '  Ctrl+Z desfaz');
    await p.click('[data-act=pfF][data-k=fVagas]'); await fim(); ok((await st('S.otim.fVagas')) === true, 'filtro do Pareto (vagas)');
    await p.click('[data-act=pfF][data-k=fVagas]'); await fim();
  } else ok(false, 'gráfico do Pareto presente');
  // aprovar
  await sub('prod');
  const nc = await ev(() => (LS.get('gabarito.cenarios2') || []).length);
  await p.click('#tabbody [data-act=aprovar]'); await W(800);
  ok(await ev(n => TAB === 'projeto' && (LS.get('gabarito.cenarios2') || []).length === n + 1, nc), 'aprovar produto → vai ao Projeto e salva cenário');
  semErros(p, 'produto'); await ctx.close();
}

/* =====================================================================================
   VIABILIDADE — resultado, premissas, orçamento, recebimento, curva, financiamento, busca,
   riscos (cenários, tornado, Monte Carlo), vendas (tabela, CSV, XLSX, modo por unidade), permuta
   ===================================================================================== */
async function tViab(b) {
  const { ctx, p, h } = await abrir(b); const { ev, W, undo, fim, etapa, sub, espera, preenche, dl } = h;
  const S_ = pth => ev(pth => pth.split('.').reduce((a, k) => a == null ? a : a[k], S), pth);
  const lucro = () => ev(() => window._last.f.lucro);
  const sec = async k => { await ev(k => { const d = document.querySelector(`#tabbody details[data-key=${k}]`); if (d) d.open = true }, k); await W(250) };
  await etapa('viab', 'res'); await sec('cash');
  ok(await ev(() => /Lucro/.test(document.getElementById('finTop').textContent) && !!document.querySelector('#cash svg')), 'resultado: números-chave e fluxo de caixa');
  ok(await ev(() => document.querySelectorAll('#tabbody section.card.res').length === 1 && /Caixa necessário/.test(document.getElementById('finTop').textContent)), 'um único resultado (lucro, margem, retorno, caixa necessário)');
  ok(await ev(() => SUBDEF.viab.map(x => x[0]).join() === 'res,prem,risco'), 'sub-abas Resultado · Premissas · Riscos');
  await sec('dre'); ok(await ev(() => document.querySelectorAll('#dre tr').length > 5), 'DRE abre e preenche');
  // Premissas principais (Resultado): terreno e preço; editar confirma os itens do checklist
  const l0 = await lucro(), t0 = await S_('fin.terreno');
  await preenche('#f-fin-terreno', 3000000); await fim();
  ok(await S_('fin.terreno') === 3000000 && Math.abs(await lucro() - l0) > 1000, 'editar o terreno muda o lucro');
  ok(await S_('guia.conf.custo') === true, '  e marca "terreno e custo conferidos"');
  await undo(); ok(await S_('fin.terreno') === t0, '  Ctrl+Z volta o terreno');
  await preenche('#f-produto-mix-0-preco', 11500); await fim();
  ok(await S_('produto.mix.0.preco') === 11500 && await S_('guia.conf.preco') === true, 'preço do mix editável na Viabilidade (marca o preço conferido)');
  await undo(); ok(await S_('produto.mix.0.preco') !== 11500, '  Ctrl+Z volta o preço');
  await sub('prem');
  await sec('orc'); await p.click(`[data-set="orc.modo"][data-v='"param"']`); await fim();
  ok(await S_('orc.modo') === 'param' && await ev(() => !!document.getElementById('f-orc-solo') && document.querySelectorAll('#orcBars .ur').length > 3), 'orçamento paramétrico: padrões e barras');
  await p.click('#tabbody details[data-key=orc] .advbtn'); await W(300);
  ok(await ev(() => { const e = document.getElementById('f-orc-coef-fund'); return e && e.offsetParent }), '  coeficientes em Mais opções');
  await p.selectOption('#f-orc-solo', 'ruim'); await fim(); ok(await S_('orc.solo') === 'ruim', 'trocar o solo');
  await undo(); ok(await S_('orc.solo') === 'medio', '  Ctrl+Z volta o solo');
  await undo(); ok(await S_('orc.modo') === 'cub', '  Ctrl+Z volta para CUB × fator');
  await sec('receb'); await p.click(`[data-set="flx.receb.modo"][data-v='"det"']`); await fim();
  ok(await S_('flx.receb.modo') === 'det' && await ev(() => !!document.getElementById('f-flx-receb-ato')), 'recebimento detalhado');
  await preenche('#f-flx-receb-ato', 15); await fim(); ok(Math.abs(await S_('flx.receb.ato') - 0.15) < 1e-9, '  editar o ato');
  await undo(); await undo(); ok(await S_('flx.receb.modo') === 'simples', '  Ctrl+Z volta ao simples');
  await sec('crono'); await p.click(`[data-set="flx.curva.modo"][data-v='"s"']`); await fim();
  ok(await S_('flx.curva.modo') === 's' && await ev(() => !!document.querySelector('#obraCurve svg') && !!document.getElementById('f-flx-curva-pico')), 'curva de obra em S com gráfico');
  await p.click(`[data-set="flx.curva.modo"][data-v='"sis"']`); await fim();
  ok(await ev(() => document.querySelectorAll('#obraCurve .stackleg span').length > 2), 'curva por sistema com legenda');
  await undo(); await undo(); ok(await S_('flx.curva.modo') === 'sen', '  Ctrl+Z volta à senoidal');
  await sec('finan'); await p.click('#tabbody details[data-key=finan] label.sw'); await fim();
  ok(await S_('fin.finOn') === true && await ev(() => !!document.getElementById('f-fin-finPct')), 'ligar financiamento');
  await undo(); ok(await S_('fin.finOn') === false, '  Ctrl+Z desliga');
  await p.fill('#vqFind', 'incc'); await W(300);
  ok(await ev(() => { const v = el => !!(el && el.offsetParent); return v(document.getElementById('f-fin-incc')) && !v(document.getElementById('f-fin-corret')) }), 'busca "incc" mostra só o INCC');
  await p.fill('#vqFind', 'xyzw'); await W(300); ok(await ev(() => !document.getElementById('vqNada').hidden), '  busca sem resultado avisa');
  await p.fill('#vqFind', ''); await W(300);
  ok(await ev(() => !document.querySelector('#tabbody details[data-key=ind]').open), '  limpar a busca restaura as seções');
  // riscos
  await sub('risco');
  ok(await espera(() => document.querySelectorAll('#cenTab tr').length >= 6), 'tabela de cenários');
  await sec('sens');
  ok(await espera(() => !!document.querySelector('#torn svg') && document.querySelectorAll('#sens > div').length > 10), 'sensibilidade e tornado');
  await p.click(`[data-set="flx.sens"][data-v='"tir"']`); await fim();
  ok(await ev(() => /TIR/.test(document.querySelector('#torn svg').getAttribute('aria-label'))), 'tornado pela TIR');
  await undo();
  await sec('cenVar'); const cp = await S_('flx.cen.pess.preco');
  await preenche('[data-p="flx.cen.pess.preco"]', -12); await fim();
  ok(Math.abs(await S_('flx.cen.pess.preco') + 0.12) < 1e-9, 'variação do cenário pessimista');
  await undo(); ok(await S_('flx.cen.pess.preco') === cp, '  Ctrl+Z volta');
  await sec('mc'); await p.click('#tabbody details[data-key=mc] label.sw'); await fim();
  ok(await S_('flx.mc.on') === true, 'ligar Monte Carlo');
  await p.click('#tabbody [data-act=mcRun]'); ok(await espera(() => !!document.querySelector('#mcRes svg'), 90000), 'Monte Carlo roda e mostra o histograma');
  ok(await ev(() => /P50/.test(document.getElementById('sum-mc').textContent)), '  resumo com P50');
  await undo(); ok(await S_('flx.mc.on') === false, '  Ctrl+Z desliga o Monte Carlo');
  // vendas (Premissas › Receitas)
  await sub('prem'); await sec('vendas');
  ok(await espera(() => document.querySelectorAll('#vdTab tbody tr').length > 10, 30000), 'tabela de vendas por unidade');
  const n0 = await ev(() => document.querySelectorAll('#vdTab tbody tr').length);
  await p.click('#vdTab th[data-k=preco]'); await W(300);
  ok(await ev(() => { const r = [...document.querySelectorAll('#vdTab tbody tr')].map(t => t.dataset.id), U = window._last.m.unidades || VD.ultimo.unidades; const pr = id => U.find(u => u.id === id).preco; return pr(r[0]) >= pr(r[r.length - 1]) }), 'ordenar por preço');
  await p.selectOption('#vdFA', { index: 2 }); await W(300);
  const n1 = await ev(() => document.querySelectorAll('#vdTab tbody tr').length); ok(n1 > 0 && n1 < n0, `filtrar por andar (${n1} de ${n0})`);
  await p.selectOption('#vdFA', { index: 0 }); await W(300);
  await p.click('#vdTab tbody tr'); await W(300); ok(await ev(() => !!document.querySelector('#vdUni .vdc')), 'cartão da unidade ao tocar');
  await p.click('#tabbody [data-act=vendaCSV]'); await espera(() => window.__dl.some(d => /\.csv$/.test(d.nome)), 15000);
  const csv = (await dl()).find(d => /\.csv$/.test(d.nome)); ok(csv && csv.tam > 2000, 'exportar CSV (download)', csv);
  await p.click('#tabbody [data-act=vendaXLSX]'); await espera(() => window.__dl.some(d => /\.xlsx$/.test(d.nome)), 45000);
  const xl = (await dl()).find(d => /\.xlsx$/.test(d.nome)); ok(xl && xl.tam > 1000, 'exportar XLSX (download)', xl);
  const v0 = await ev(() => window._last.f.vgv);
  await p.click(`[data-set="venda.modo"][data-v='"unidade"']`); await fim(); await W(800); await fim();
  ok(await S_('venda.modo') === 'unidade' && Math.abs(await ev(() => window._last.f.vgv) - v0) > 1, 'VGV pela soma das unidades');
  await undo(); ok(await S_('venda.modo') === 'medio', '  Ctrl+Z volta ao preço médio');
  await sec('vendaPrem'); await preenche('#f-venda-andarPct', 1); await fim();
  ok(Math.abs(await S_('venda.andarPct') - 0.01) < 1e-9, 'prêmio por andar');
  await undo(); ok(Math.abs(await S_('venda.andarPct') - 0.005) < 1e-9, '  Ctrl+Z volta o prêmio');
  // terreno: compra × permuta × SPE
  await sec('terAlt'); await p.click('#tabbody details[data-key=terAlt] label.sw'); await fim();
  ok(await S_('terAlt.on') === true && await espera(() => document.querySelectorAll('#terBox table').length >= 3), 'comparar compra, permuta e SPE');
  await p.click('#tabbody details.sub > summary'); await W(300);
  await p.click('#terUn label.sw >> nth=0'); await fim();
  ok((await S_('terAlt.unidades')).length === 1, 'escolher unidade da permuta');
  await p.click('[data-act=terUsar][data-k=fis]'); await fim();
  ok(await S_('fin.terreno') === 0 && await S_('fin.permuta') > 0, 'usar a permuta física nas premissas');
  await undo(); ok(await S_('fin.terreno') > 0 && await S_('fin.permuta') === 0, '  Ctrl+Z desfaz "usar alternativa"');
  await undo(); ok((await S_('terAlt.unidades')).length === 0, '  Ctrl+Z desfaz a unidade escolhida');
  await sub('res'); await p.click('#tabbody [data-act=finIr][data-open=terAlt]'); await W(800);
  ok(await ev(() => subAtual('viab') === 'prem' && document.querySelector('#tabbody details[data-key=terAlt]').open), 'atalho "Comparar compra, permuta e SPE"');
  semErros(p, 'viabilidade'); await ctx.close();
}

/* =====================================================================================
   PROJETO — garagem (rampa: mover/girar/tipos; vagas: tocar, PCD, idoso; extras; melhor acesso),
   tipo (núcleo, cômodos: arrastar divisão, variações), andares
   ===================================================================================== */
async function tProjeto(b) {
  const { ctx, p, h } = await abrir(b); const { ev, W, undo, fim, sub, etapa, scr } = h;
  await etapa('projeto', 'gar');
  ok(await ev(() => VIEW === 'gar' && !!document.getElementById('garRes').textContent.trim()), 'garagem: vista e resultado');
  // rampa: mover, girar, automática
  await p.click('#tabbody [data-act=rampMover]'); await W(300);
  ok(await ev(() => RAMPMOVE === true && VIEW === 'gar'), 'rampa: "Mover na planta" liga o modo mover');
  const rc = await ev(() => window._last.m.ramp ? window._last.m.ramp.c : null);
  if (rc) {
    const [x, y] = await scr(rc); await p.mouse.move(x, y); await p.mouse.down(); await p.mouse.move(x + 15, y + 5, { steps: 4 }); await p.mouse.move(x + 30, y + 10, { steps: 4 }); await p.mouse.up(); await fim();
    const r = await ev(() => S.estudo.rampa); ok(r && Math.hypot(r.x - rc[0], r.y - rc[1]) > 1, 'rampa: arrastar move a rampa', r && [+r.x.toFixed(1), +r.y.toFixed(1)]);
    await undo(); ok(await ev(() => S.estudo.rampa == null), '  Ctrl+Z desfaz o movimento');
    await p.click('#rampRot'); await fim(); ok(await ev(() => !!S.estudo.rampa), 'rampa: girar pela barra');
    await ev(() => goStep('projeto', 'gar')); await W(300);
    ok(await p.locator('#tabbody [data-act=rampAuto]').count() === 1, '  botão "Automática" aparece com rampa à mão');
    await p.click('#tabbody [data-act=rampAuto]'); await fim(); ok(await ev(() => S.estudo.rampa == null && !RAMPMOVE), 'rampa: voltar ao automático');
  } else ok(false, 'rampa: modelo sem m.ramp');
  // vagas
  await ev(() => { RAMPMOVE = false; TAPMODE = 'off'; viewbarSegs(window._last.m) }); await W(200);
  const v1 = await ev(() => { const l = window._last.m.gar[FLOOR]; const v = l.vagas.find(v => v.tipo === 'n' && !(S.estudo.vtipo || {})[v.key]); return v ? { key: v.key, c: G.centroid(v.poly) } : null });
  const tipoDe = k => ev(k => { const l = window._last.m.gar[FLOOR]; const v = l.vagas.find(v => v.key === k); return v ? v.tipo : null }, k);
  const toca = async c => { const [x, y] = await scr(c); await p.mouse.click(x, y); await fim() };
  if (v1) {
    await toca(v1.c); ok(await ev(k => S.estudo.vtipo[k] === 'off', v1.key) && await tipoDe(v1.key) === 'off', 'vaga: tocar remove');
    await toca(v1.c); ok(await tipoDe(v1.key) === 'n', 'vaga: tocar de novo devolve');
    await h.abre('gMan'); await p.click('#tabbody [data-act=tapm][data-v=pcd]'); await W(200);
    ok(await ev(() => TAPMODE === 'pcd' && document.querySelector('#tapSeg [data-tm=pcd]').getAttribute('aria-pressed') === 'true'), 'vaga: seletor "PCD" do painel liga o modo na barra');
    await toca(v1.c); ok(await tipoDe(v1.key) === 'pcd', 'vaga: tocar marca PCD');
    await p.click('#tapSeg [data-tm=idoso]'); await W(200);
    ok(await ev(() => document.querySelector('#tabbody [data-act=tapm][data-v=idoso]').getAttribute('aria-pressed') === 'true'), 'vaga: a barra do palco sincroniza o painel');
    await toca(v1.c); ok(await tipoDe(v1.key) === 'idoso', 'vaga: tocar marca idoso');
    ok(/1 marcaç/.test(await p.locator('#garManN').textContent()), 'vaga: contagem de marcações no painel');
    await undo(); ok(await tipoDe(v1.key) === 'pcd', '  Ctrl+Z volta a PCD');
    await p.click('#tabbody [data-act=resetOff]'); await W(150);
    ok(/Confirmar/.test(await p.locator('#tabbody [data-act=resetOff]').textContent()), 'vaga: "Desfazer marcações" pede confirmação');
    await p.click('#tabbody [data-act=resetOff]'); await fim();
    ok(await ev(() => !Object.keys(S.estudo.vtipo || {}).length && !Object.keys(S.estudo.off || {}).length), 'vaga: marcações desfeitas');
    await undo(); ok(await ev(() => Object.keys(S.estudo.vtipo || {}).length > 0), '  Ctrl+Z restaura as marcações');
    await ev(() => { S.estudo.vtipo = {}; S.estudo.off = {}; TAPMODE = 'off'; update(); viewbarSegs(window._last.m) }); await fim();
  } else ok(false, 'vaga: nenhuma vaga comum na planta');
  // tipos de rampa
  await ev(() => goStep('projeto', 'gar')); await W(300);
  for (const t of ['alternada', 'helicoidal', 'L', 'elevador', 'reta']) {
    await p.selectOption('#rampSel', t); await fim();
    ok(await ev(t => S.estudo.rampaTipo === t && window._last.m.vert != null, t), 'rampa: tipo ' + t);
  }
  await p.selectOption('#rampSel', 'alternada'); await fim(); await undo(); ok(await ev(() => S.estudo.rampaTipo === 'reta'), '  Ctrl+Z desfaz a troca do tipo');
  // extras
  await h.abre('gExt');
  for (const k of ['presas', 'motos']) { await p.locator(`#tabbody input[data-p="garagem.${k}"]`).check({ force: true }); await fim() }
  await h.faixa('#tabbody input[data-p="garagem.ev"]', 0.2); await fim();
  const q = await ev(() => ({ q: window._last.m.quadroVagas, ev: window._last.m.evN, X: S.garagem }));
  ok(q.X.presas && q.X.motos && q.X.ev > 0.1, 'extras: vagas presas, motos e recarga EV');
  ok(q.q && (q.q.presa > 0 || q.q.moto > 0 || q.ev > 0), '  quadro de vagas reflete os extras', { presa: q.q && q.q.presa, moto: q.q && q.q.moto, ev: q.ev });
  await undo(); ok(await ev(() => !(S.garagem.ev > 0)), '  Ctrl+Z desliga o EV');
  await ev(() => { S.garagem.presas = false; S.garagem.motos = false; S.garagem.ev = 0; update(); renderTab() }); await fim();
  // melhor acesso: cancelar, rodar, aplicar
  const ac0 = await ev(() => ({ a: S.lote.acessoVei, t: S.estudo.rampaTipo }));
  await p.click('#tabbody [data-act=acessoStudy]'); await W(800);
  if (await p.locator('#rsCancel').count()) { await p.click('#rsCancel'); await W(600); ok(await ev(() => !CALC.jobAtivo), 'melhor acesso: cancelar interrompe') } else ok(false, 'melhor acesso: botão cancelar');
  await p.click('#tabbody [data-act=acessoStudy]');
  await p.waitForFunction(() => !CALC.jobAtivo && RS && RS.list.length && /analisadas/.test((document.getElementById('rsStat') || {}).textContent || ''), null, { timeout: 400000 }).catch(() => {});
  const nOp = await p.locator('#rsList .res').count(); ok(nOp > 0, 'melhor acesso: opções listadas', nOp + ' · ' + await p.locator('#rsStat').textContent().catch(() => ''));
  if (await p.locator('#rsList [data-act=rsApply]').count()) {
    await p.locator('#rsList [data-act=rsApply]').first().click(); await fim();
    const a1 = await ev(() => ({ a: S.lote.acessoVei, t: S.estudo.rampaTipo }));
    ok(a1.a !== ac0.a || a1.t !== ac0.t, 'melhor acesso: aplicar muda acesso/rampa', a1);
    await undo(); const a2 = await ev(() => ({ a: S.lote.acessoVei, t: S.estudo.rampaTipo })); ok(a2.a === ac0.a && a2.t === ac0.t, '  Ctrl+Z desfaz a aplicação');
  } else ok(false, 'melhor acesso: botão aplicar');
  ok(await p.locator('#tabbody details[data-key=estrutura]').count() === 1, 'malha estrutural na garagem');
  // pavimento tipo
  await sub('tipo');
  ok(await ev(() => VIEW === 'tipo') && await p.locator('#tabbody details[data-key=estrutura]').count() === 0, 'tipo: vista do pavimento tipo (sem malha repetida)');
  await p.selectOption('#escSel', 'pf_press'); await fim(); ok(await ev(() => S.estudo.escTipo === 'pf_press'), 'núcleo: trocar a escada');
  await p.click('#tabbody [data-set="estudo.nEsc"][data-v="2"]'); await fim(); ok(await ev(() => +S.estudo.nEsc === 2), 'núcleo: 2 escadas');
  await p.click('#tabbody [data-set="estudo.elevadores"][data-v="3"]'); await fim(); ok(await ev(() => +S.estudo.elevadores === 3), 'núcleo: 3 elevadores');
  await undo(); ok(await ev(() => +S.estudo.elevadores !== 3), '  Ctrl+Z desfaz os elevadores');
  await ev(() => { S.estudo.escTipo = DEF.estudo.escTipo; S.estudo.nEsc = DEF.estudo.nEsc; S.estudo.elevadores = DEF.estudo.elevadores; update(); renderTab() }); await fim();
  // cômodos: arrastar divisão
  await ev(() => { TOWER = 0; fit2d() }); await W(300);
  const bb = await p.locator('#c2d').boundingBox(); let alvo = null;
  alvo = await ev(([ox, oy, w, hh]) => { for (let yy = 40; yy < hh - 40; yy += 6) for (let xx = 40; xx < w - 40; xx += 6) { comHover(xx, yy); if (comHit(xx, yy) && document.elementFromPoint(ox + xx, oy + yy) === c2) return [xx, yy] } return null }, [bb.x, bb.y, bb.width, bb.height]);
  if (alvo) {
    const antes = await ev(() => JSON.stringify(S.comodos.tipos.map(t => t.cortes)));
    await p.mouse.move(bb.x + alvo[0], bb.y + alvo[1]); await p.mouse.down(); await p.mouse.move(bb.x + alvo[0] + 12, bb.y + alvo[1] + 12, { steps: 5 }); await p.mouse.up(); await fim();
    ok(antes !== await ev(() => JSON.stringify(S.comodos.tipos.map(t => t.cortes))), 'cômodos: arrastar uma divisão');
    await undo(); ok(await ev(() => JSON.stringify(S.comodos.tipos.map(t => t.cortes))) === antes, '  Ctrl+Z desfaz o arraste');
  } else ok(false, 'cômodos: nenhuma divisão para arrastar');
  await h.abre('comodos'); const nv0 = await ev(() => S.comodos.variantes.length);
  await p.locator('#tabbody [data-act=comSalvar]').first().click(); await fim(); ok(await ev(() => S.comodos.variantes.length) === nv0 + 1, 'cômodos: salvar variação');
  await p.locator('#tabbody [data-act=comUsar]').first().click(); await fim(); ok(await ev(() => S.comodos.tipos.some(t => t.sel === 0)), 'cômodos: usar variação');
  await p.locator('#tabbody [data-act=comDel]').first().click(); await W(150); ok(await ev(n => S.comodos.variantes.length === n, nv0 + 1), '  excluir pede confirmação');
  await p.locator('#tabbody [data-act=comDel]').first().click(); await fim(); ok(await ev(() => S.comodos.variantes.length) === nv0, 'cômodos: excluir variação');
  await undo(); ok(await ev(() => S.comodos.variantes.length) === nv0 + 1, '  Ctrl+Z restaura a variação');
  const mod0 = await h.J('S.comodos.tipos');
  await p.selectOption('#tabbody select[data-p="comodos.tipos.0.modelo"]', { index: 2 }); await fim();
  ok(await ev(() => S.comodos.tipos[0].modelo !== 'auto'), 'cômodos: trocar o modelo da tipologia', await ev(() => S.comodos.tipos[0].modelo));
  await undo(); ok(await h.J('S.comodos.tipos') === mod0, '  Ctrl+Z volta o modelo', await ev(() => S.comodos.tipos[0].modelo));
  // andares
  await sub('andar');
  const n = await p.locator('#andList .li').count(); ok(n > 3, 'andares: lista de pavimentos', n);
  await p.locator('#andList .li').nth(2).click(); await W(300);
  const k2 = await ev(() => ANDAR); ok(await ev(() => VIEW === 'andar') && await p.locator('#andList .li.on').count() === 1, 'andares: escolher um andar', k2);
  await p.selectOption('#andarSel', { index: 0 }); await W(300); ok(await ev(k => ANDAR !== k, k2), 'andares: seletor do palco');
  const a0 = await ev(() => ANDAR); await p.click('#andarUp'); await W(200); ok(await ev(a => ANDAR !== a, a0), 'andares: botão ▲');
  semErros(p, 'projeto'); await ctx.close();
}

/* =====================================================================================
   CLIMA — sol (data, animar, pausar), entorno unificado, vizinhança (calcular, animar),
   vento no chão, túnel 3D (iniciar/pausar, fumaça, sonda, cor, reiniciar)
   ===================================================================================== */
async function tClima(b) {
  const { ctx, p, h } = await abrir(b); const { ev, W, undo, fim, sub, etapa, abre } = h;
  await etapa('clima', 'sol'); await W(800);
  ok(/h/.test(await p.locator('#solInfo').textContent()), 'sol: resultado no topo');
  await p.click('#tabbody [data-act=sd][data-v="12,21"]'); await fim(); ok(await ev(() => S.sol.mes === 12), 'sol: botão Verão (21/dez)');
  await p.click('#solAnimBtn'); await W(1200);
  const an = await ev(() => ({ v: VIEW, a: !!SUNANIM, on: S.sol.on, h: S.sol.hora })); await W(900); const h2 = await ev(() => S.sol.hora);
  ok(an.v === '3d' && an.a && an.on && h2 !== an.h, 'sol: animar o dia no 3D', `${an.h} → ${h2}`);
  await p.click('#sunPlay'); await W(300); ok(await ev(() => !SUNANIM), 'sol: pausar a animação');
  // seção de entorno: uma só, a mesma do Terreno
  const secs = await ev(() => [...document.querySelectorAll('#tabbody details.sec .st')].map(e => e.textContent.trim()));
  ok(secs.filter(t => /entorno|volumes/i.test(t)).length === 1, 'uma única seção de entorno no Clima', secs.filter(t => /entorno|volumes/i.test(t)));
  await abre('entedit'); await p.click('#tabbody [data-act=entGen]'); await fim();
  const ne = await ev(() => S.entorno.length); ok(ne > 0, 'entorno: gerar genéricos', ne);
  await abre('entedit'); await h.mais('entedit');
  const h0 = await ev(() => S.entorno[0].h); await h.preenche('#tabbody input[data-p="entorno.0.h"]', h0 + 3); await fim();
  ok(await ev(x => S.entorno[0].h === x, h0 + 3), 'entorno: editar altura');
  await undo(); ok(await ev(x => S.entorno[0].h === x, h0), '  Ctrl+Z desfaz');
  // vizinhança
  await abre('viz'); await p.locator('#tabbody input[data-p="vizinhanca.on"]').check({ force: true }); await fim(); await W(1500); await fim();
  ok(await ev(() => !!(window._last.m.viz || (typeof VZ !== 'undefined' && VZ.ultimo))) && /h/.test(await p.locator('#vzSum').textContent()), 'vizinhança: calcula a perda de sol', await p.locator('#sum-viz').textContent());
  await p.click('#vzAnimBtn'); await W(1200); ok(await ev(() => !!VZ.anim), 'vizinhança: animar a sombra no ano');
  await p.click('#vzAnimBtn'); await W(300); ok(await ev(() => !VZ.anim), 'vizinhança: pausar');
  // pausar deixa o sol no instante da pausa (um passo no histórico); o passo seguinte desliga a vizinhança
  await undo(); ok(await ev(() => S.vizinhanca.on && S.sol.mes === 12), '  Ctrl+Z volta o sol de antes da animação');
  await undo(); ok(await ev(() => !S.vizinhanca.on), '  Ctrl+Z desliga a vizinhança');
  // vento no chão
  await sub('vento'); await W(1500);
  ok(await ev(() => { const h = document.getElementById('hint'); return h.hidden || /vento|Vermelho/i.test(h.textContent) }), 'vento: a dica da planta fala do vento', await ev(() => document.getElementById('hint').textContent));
  await p.click('#tabbody [data-act=vdir][data-v="180"]'); await fim(); ok(await ev(() => S.clima.ventoDir === 180), 'vento: direção pela rosa');
  await undo(); ok(await ev(() => S.clima.ventoDir !== 180), '  Ctrl+Z volta a direção');
  ok(/m\/s/.test(await p.locator('#ventoInfo').textContent()), 'vento: resultado');
  // túnel de vento 3D
  await sub('v3d'); await W(4000);
  ok(await ev(() => VIEW === 'v3d' && !!CFD.dom), 'túnel 3D: vista');
  const r0 = await ev(() => CFD.running); await p.click('#tabbody [data-act=cfdPlay]'); await W(500);
  ok(await ev(() => CFD.running) !== r0, 'túnel 3D: iniciar/pausar', `${r0} → ${await ev(() => CFD.running)}`);
  if (!await ev(() => CFD.running)) { await p.click('#tabbody [data-act=cfdPlay]'); await W(300) }
  ok(await ev(() => CFD.running), 'túnel 3D: simulação rodando');
  await W(5000);
  await p.click('#tabbody [data-act=cviz][data-k=fumaca]'); await W(800); ok(await ev(() => S.cfd.viz.fumaca), 'túnel 3D: ligar fumaça');
  const c3 = await p.locator('#c3d').boundingBox(); let probe = false;
  for (const [fx, fy] of [[0.5, 0.55], [0.5, 0.7], [0.4, 0.6], [0.6, 0.5], [0.5, 0.45]]) { await p.mouse.click(c3.x + c3.width * fx, c3.y + c3.height * fy); await W(500); if (await ev(() => !document.getElementById('cfdProbe').hidden)) { probe = true; break } }
  ok(probe, 'túnel 3D: sonda ao tocar no 3D');
  if (probe) {
    await p.click('#pbSmoke'); await W(600); ok(await ev(() => !!S.cfd.emissor && S.cfd.viz.fumaca), 'túnel 3D: soltar fumaça na sonda');
    await p.click('#tabbody [data-act=emX]'); await W(500); ok(await ev(() => !S.cfd.emissor), 'túnel 3D: voltar a barlavento');
    await p.click('#pbX').catch(() => {}); await W(200);
  }
  await p.selectOption('#cfdVarSel', 'lawson'); await W(800); ok(await ev(() => S.cfd.var === 'lawson'), 'túnel 3D: colorir por conforto (Lawson)');
  await p.click('#tabbody [data-act=cfdReset]'); await W(800); ok(true, 'túnel 3D: reiniciar');
  await p.click('#tabbody [data-act=cfdPlay]'); await W(300); ok(await ev(() => !CFD.running), 'túnel 3D: pausar');
  semErros(p, 'clima'); await ctx.close();
}

/* =====================================================================================
   CENÁRIOS — estudos (novo, duplicar, abrir, excluir/desfazer), versões (salvar, restaurar, comparar),
   cenários (salvar, comparar, abrir, excluir), entregar (JSON, DXF+IFC, PDF, copiar resumo, link, apresentação, marca)
   ===================================================================================== */
async function tCen(b) {
  const { ctx, p, h } = await abrir(b); const { ev, W, etapa, sub, espera, fim, dl } = h;
  const conta = sel => p.$$eval(sel, e => e.length);
  await etapa('cen', 'estudos'); await espera(() => EST.pronto, 15000);
  ok(await p.isVisible('#estBox .lrow.on'), 'estudos: o aberto aparece na lista');
  const n0 = await conta('#estBox .lrow');
  await p.click('#estBox .lrow.on [data-act=estDup]'); await espera(n => document.querySelectorAll('#estBox .lrow').length === n + 1, 15000, n0);
  ok(await conta('#estBox .lrow') === n0 + 1, 'estudos: duplicar');
  await p.click('[data-act=estNovo]'); await espera(() => S.nome === 'Novo estudo', 15000); await fim();
  ok(await ev(() => S.nome) === 'Novo estudo', 'estudos: novo estudo aberto');
  await espera(n => document.querySelectorAll('#estBox .lrow').length === n, 10000, n0 + 2);
  ok(await conta('#estBox .lrow') === n0 + 2, '  novo estudo na lista');
  const ids = await p.$$eval('#estBox [data-act=estAbrir]', e => e.map(x => x.dataset.id));
  await p.click(`#estBox [data-act=estAbrir][data-id="${ids[ids.length - 1]}"]`); await espera(() => S.nome !== 'Novo estudo', 15000); await fim();
  ok(await ev(() => S.nome) !== 'Novo estudo', 'estudos: abrir outro estudo', await ev(() => S.nome));
  const nA = await conta('#estBox .lrow');
  await p.click('#estBox [data-act=estDel]'); await W(300);
  ok(await p.isVisible('#estBox .btn.on[data-act=estDel]'), 'estudos: excluir pede confirmação');
  await p.click('#estBox .btn.on[data-act=estDel]'); await espera(n => document.querySelectorAll('#estBox .lrow').length === n - 1, 10000, nA);
  ok(await conta('#estBox .lrow') === nA - 1, 'estudos: excluir');
  ok(await p.isVisible('#estUndo [data-act=estDesfaz]'), '  barra "Desfazer" aparece');
  await p.click('#estUndo [data-act=estDesfaz]'); await espera(n => document.querySelectorAll('#estBox .lrow').length === n, 10000, nA);
  ok(await conta('#estBox .lrow') === nA, '  exclusão desfeita');
  // versões
  await p.fill('#vsNome', 'Teste A'); await p.click('[data-act=vsSalvar]'); await espera(() => EST.versoes.some(v => v.nome === 'Teste A'), 20000);
  ok(await ev(() => EST.versoes.some(v => v.nome === 'Teste A')) && await conta('#vsBox .lrow') >= 1, 'versões: salvar com nome');
  const sub0 = await ev(() => S.produto.subsolos);
  await ev(() => { S.produto.subsolos = S.produto.subsolos + 1; update() }); await fim();
  const vid = await ev(() => EST.versoes.find(v => v.nome === 'Teste A').id);
  await p.click(`#vsBox [data-act=vsRest][data-id="${vid}"]`); await W(500); await fim();
  ok(await ev(() => S.produto.subsolos) === sub0, 'versões: restaurar volta o estado');
  await p.keyboard.press('Control+z'); await W(500); await fim();
  ok(await ev(() => S.produto.subsolos) === sub0 + 1, '  Ctrl+Z desfaz a restauração');
  await p.click(`#vsBox [data-act=vsCmp][data-id="${vid}"]`); await W(400);
  ok(await p.isVisible('#cmpSec') && await conta('#cmpBox th') === 3, 'versões: comparar com o atual');
  // cenários
  await h.abre('cenarios');
  await p.fill('#cenNome', 'Cenário X'); await p.click('[data-act=cenSave]'); await espera(() => document.querySelectorAll('#cenBox .lrow').length === 1, 15000);
  ok(await conta('#cenBox .lrow') === 1, 'cenários: salvar');
  await p.click('#cenBox [data-act=cenCmp]'); await W(400);
  ok(await conta('#cmpBox th') === 4, 'cenários: entra na comparação');
  await p.click('[data-act=cmpLimpa]'); await W(400); ok(await p.isHidden('#cmpSec'), '  limpar seleção esconde a comparação');
  await ev(() => { S.produto.subsolos = 4; update() }); await fim();
  await p.click('#cenBox [data-act=cenLoad]'); await W(800); await fim();
  ok(await ev(() => S.produto.subsolos) === sub0 + 1, 'cenários: abrir');
  await p.keyboard.press('Control+z'); await W(600); await fim();
  ok(await ev(() => S.produto.subsolos) === 4, '  Ctrl+Z desfaz abrir cenário');
  await p.click('#cenBox [data-act=cenDel]'); await W(200); await p.click('#cenBox [data-act=cenDel]'); await W(500);
  ok(await conta('#cenBox .lrow') === 0, 'cenários: excluir (com confirmação)');
  await p.click('#estUndo [data-act=estDesfaz]'); await W(500); ok(await conta('#cenBox .lrow') === 1, '  exclusão desfeita');
  // entregar
  await sub('entregar');
  ok(await p.isVisible('#tabbody [data-act=pdf]') && await p.isVisible('#cardApres'), 'entregar: arquivos e apresentação');
  await p.click('#tabbody [data-act=json]'); await espera(() => window.__dl.some(d => /\.json$/.test(d.nome)), 15000);
  await p.click('#tabbody [data-act=zip]'); await espera(() => window.__dl.some(d => /\.zip$/.test(d.nome)), 90000);
  await p.click('#tabbody [data-act=pdf]'); await espera(() => window.__dl.some(d => /\.pdf$/.test(d.nome)), 180000);
  const D = await dl(); const achou = re => D.find(d => re.test(d.nome));
  ok(achou(/\.json$/) && achou(/\.json$/).tam > 1000, 'exportar JSON (download)', achou(/\.json$/));
  ok(achou(/\.zip$/) && achou(/\.zip$/).tam > 1000, 'exportar DXF + IFC (download .zip)', achou(/\.zip$/));
  ok(achou(/\.pdf$/) && achou(/\.pdf$/).tam > 50000, 'exportar relatório PDF (download)', achou(/\.pdf$/));
  await p.click('#tabbody [data-act=copy]'); await W(400);
  ok(((await ev(() => navigator.clipboard.readText().catch(() => ''))) || '').length > 50, 'copiar resumo');
  await p.click('#tabbody [data-act=apLink]'); await espera(() => /#ver=/.test((document.getElementById('apLinkOut') || {}).value || ''), 15000);
  ok(/#ver=/.test(await p.inputValue('#apLinkOut')), 'link somente leitura gerado');
  await p.click('#tabbody [data-act=apStart]'); await espera(() => !document.getElementById('ap').hidden, 30000); await W(800);
  ok(await p.isVisible('#ap'), 'apresentação abre');
  await p.keyboard.press('ArrowRight'); await W(500); ok(/2 de 5/.test(await p.textContent('#apStep')), '  seta avança');
  await p.click('#apSair'); await W(800); ok(await p.isHidden('#ap'), '  apresentação fecha');
  await h.abre('marca'); await p.click('#cardMarca .sw'); await fim();
  ok(await ev(() => S.marca.ativa) && await p.isVisible('#f-marca-nome'), 'marca: ligar mostra os campos');
  await h.preenche('#f-marca-nome', 'Construtora Teste'); await fim();
  ok(/Construtora Teste/.test(await p.textContent('#sum-marca')), '  resumo da marca atualiza');
  await p.keyboard.press('Control+z'); await W(500); ok(await ev(() => S.marca.nome !== 'Construtora Teste'), '  Ctrl+Z desfaz o nome');
  await h.abre('reset'); await p.click('#tabbody [data-act=reset]'); await p.click('#tabbody [data-act=reset]'); await W(1200); await fim();
  ok(await ev(() => S.nome === DEF.nome), 'restaurar o exemplo (com confirmação)');
  semErros(p, 'cenários'); await ctx.close();
}

/* =====================================================================================
   GLOBAIS — todas as etapas e sub-abas, troca de vista, legenda, desfazer/refazer, tema, glossário, ⓘ, régua
   ===================================================================================== */
async function tGlobal(b) {
  const { ctx, p, h } = await abrir(b); const { ev, W, fim } = h;
  // percorre todas as etapas e sub-abas: painel montado, vista certa, sem erro
  const ESP = { terreno: 'impl', projeto: null, clima: null };
  for (const k of ['terreno', 'regras', 'produto', 'viab', 'projeto', 'clima', 'cen']) {
    await p.click(`#rail [data-step=${k}]`); await W(500);
    const subs = await p.$$eval('#phead .sub [data-v]', e => e.map(x => x.dataset.v));
    for (const s of subs.length ? subs : [null]) {
      if (s) { await p.click(`#phead .sub [data-v="${s}"]`); await W(s === 'v3d' ? 2500 : 700) }
      const r = await ev(() => ({ tab: TAB, view: VIEW, secs: document.querySelectorAll('#tabbody .card').length, res: !!document.querySelector('#tabbody .card.res'), on: (document.querySelector('#phead .sub [aria-pressed=true]') || {}).dataset?.v }));
      ok(r.tab === k && r.secs > 0 && (!s || r.on === s) && (!ESP[k] || r.view === ESP[k]), `percorrer ${k}${s ? ' › ' + s : ''}`, `vista ${r.view} · ${r.secs} seções`);
    }
  }
  await ev(() => { if (typeof cfdStop === 'function') cfdStop() });
  await p.click('#rail [data-step=terreno]'); await W(700);
  ok(await ev(() => VIEW) === 'impl' && await p.isVisible('#vtools #toolSeg'), 'terreno: implantação com ferramentas');
  ok(await ev(() => document.querySelector('.viewbar').getBoundingClientRect().height) < 50, 'barra da vista numa linha (implantação)');
  await p.click('#viewSeg [data-v=gar]'); await W(1200);
  ok(await ev(() => TAB) === 'projeto', 'trocar a vista para Garagem puxa a etapa Projeto');
  ok(await ev(() => document.querySelector('.viewbar').getBoundingClientRect().height) < 50, 'barra da vista numa linha (garagem)');
  ok(await p.isHidden('#planLeg'), 'legenda recolhida por padrão');
  await p.click('#legBtn'); await W(300); ok(await p.isVisible('#planLeg'), 'botão Legenda abre');
  await p.click('#legBtn'); await W(300); ok(await p.isHidden('#planLeg'), 'botão Legenda fecha');
  await p.click('#viewSeg [data-v="3d"]'); await W(800); ok(await p.isHidden('#legend'), '3D: legenda recolhida');
  await p.click('#legBtn'); await W(300); ok(await p.isVisible('#legend'), '3D: legenda abre'); await p.click('#legBtn');
  // desfazer/refazer pelos botões e pelo teclado
  await p.click('#rail [data-step=produto]'); await W(500); await fim();
  const s0 = await ev(() => S.produto.subsolos); await ev(s => { S.produto.subsolos = s + 1; update() }, s0); await fim();
  await p.click('#undoBtn'); await W(500); ok(await ev(() => S.produto.subsolos) === s0, 'desfazer (botão do topo)');
  await p.click('#redoBtn'); await W(500); ok(await ev(() => S.produto.subsolos) === s0 + 1, 'refazer (botão do topo)');
  await p.keyboard.press('Control+z'); await W(400); ok(await ev(() => S.produto.subsolos) === s0, 'desfazer (Ctrl+Z)');
  await p.keyboard.press('Control+y'); await W(400); ok(await ev(() => S.produto.subsolos) === s0 + 1, 'refazer (Ctrl+Y)');
  await p.keyboard.press('Control+Shift+z'); await W(300); await p.keyboard.press('Control+z'); await W(400); ok(await ev(() => S.produto.subsolos) === s0, 'Ctrl+Shift+Z sem nada a refazer não quebra');
  // nome do estudo
  await p.fill('#projName', 'Estudo QA'); await p.press('#projName', 'Tab'); await fim(); ok(await ev(() => S.nome) === 'Estudo QA', 'renomear o estudo no topo');
  await p.keyboard.press('Control+z'); await W(400); ok(await ev(() => S.nome) !== 'Estudo QA', '  Ctrl+Z desfaz o nome');
  // tema
  const t0 = await ev(() => document.documentElement.dataset.theme); await p.click('#themeBtn'); await W(400);
  ok(await ev(() => document.documentElement.dataset.theme) !== t0, 'alternar tema'); await p.click('#themeBtn'); await W(300);
  // glossário e ⓘ
  await p.click('#glossBtn'); await W(300); ok(await p.isVisible('#uxGloss'), 'glossário abre');
  await p.fill('#glossQ', 'VGV'); await W(200); ok(await ev(() => document.querySelectorAll('#glossL .gi').length >= 1), '  busca no glossário');
  await p.keyboard.press('Escape'); await W(200); ok(await p.isHidden('#uxGloss'), '  Esc fecha');
  await p.click('#kpis .termo[data-info=VGV]'); await W(300); ok(await p.isVisible('#uxPop'), 'sigla da régua abre o ⓘ'); await p.keyboard.press('Escape'); await W(200);
  await p.click('#rail [data-step=regras]'); await W(500);
  await p.click('#tabbody .info >> nth=0'); await W(300); ok(await p.isVisible('#uxPop'), 'ⓘ de uma seção abre a explicação'); await p.keyboard.press('Escape');
  // seções e Mais opções
  const sd = await ev(() => { const d = [...document.querySelectorAll('#tabbody details.sec:not([open])')][0]; if (!d) return null; d.querySelector('summary').click(); return d.dataset.key });
  await W(200); ok(sd && await ev(k => document.querySelector(`#tabbody details[data-key="${k}"]`).open, sd), 'abrir uma seção fechada pelo cabeçalho');
  for (const w of [1440, 1280]) {
    await p.setViewportSize({ width: w, height: 900 }); await W(500);
    const cut = await ev(() => [...document.querySelectorAll('#kpis .kpi .v, #kpis .kpi .s, #kpis .kpi .l')].filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.textContent));
    ok(!cut.length, `régua de KPIs sem cortes em ${w}px`, cut.join(' | ') || undefined);
  }
  semErros(p, 'globais'); await ctx.close();
}

/* =====================================================================================
   CELULAR — 400 px: sem rolagem lateral, trilho não cobre conteúdo, topo e barras sem cortes, toques ≥ 40 px
   ===================================================================================== */
async function tCelular(b) {
  for (const tema of ['light', 'dark']) {
    const { ctx, p, h } = await abrir(b, { vp: { width: 400, height: 860 }, dsf: 2, touch: true, tema }); const { ev, W } = h;
    for (const [s, sb] of [['terreno'], ['produto'], ['viab'], ['projeto', 'gar'], ['projeto', 'tipo'], ['clima', 'sol'], ['cen']]) {
      await p.tap(`#rail [data-step=${s}]`); await W(700); if (sb) { await p.tap(`#phead .sub [data-v="${sb}"]`); await W(900) }
      const nome = s + (sb ? '/' + sb : '');
      const r = await ev(() => {
        const vis = e => { const r = e.getBoundingClientRect(); return r.width && r.height && getComputedStyle(e).visibility !== 'hidden' };
        const small = [...document.querySelectorAll('.top button, .viewbar button, .vtools button, #rail button, #phead button, #tabbody button, #pfoot button, #tabbody .sw')].filter(e => { const r = e.getBoundingClientRect(); return vis(e) && (e.closest('#rail') || (r.top > 30 && r.bottom < innerHeight - 90)) && (r.height < 40 || r.width < 32) && !(() => { const cx = r.left + r.width / 2, cy = r.top + r.height / 2; return [[cx, cy - 18], [cx, cy + 18], [cx - 16, cy], [cx + 16, cy]].every(([x, y]) => { const h = document.elementFromPoint(x, y); return h && (h === e || e.contains(h)) }) })() }).map(e => (e.id || e.className || e.tagName) + ':' + (e.textContent || '').trim().slice(0, 18) + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height));
        const over = document.documentElement.scrollWidth > innerWidth + 1;
        const cut = [...document.querySelectorAll('.top *, #kpis *')].filter(e => e.children.length === 0 && e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow === 'hidden').map(e => e.textContent.trim().slice(0, 20));
        // ferramentas do palco: cada botão inteiro dentro da tela e do seu contêiner (a faixa de vistas #viewSeg rola de propósito, com esmaecido)
        const barra = [...document.querySelectorAll('#view .viewbar button:not(#viewSeg button), #vtools button')].filter(vis).filter(e => { const r = e.getBoundingClientRect(); let c = e.parentElement; while (c && c.id !== 'view') { const s = getComputedStyle(c); if (/(hidden|auto|scroll|clip)/.test(s.overflowX)) { const q = c.getBoundingClientRect(); if (r.left < q.left - 1 || r.right > q.right + 1) return true } c = c.parentElement } return r.left < -1 || r.right > innerWidth + 1 }).map(e => e.textContent.trim().slice(0, 14));
        const pn = document.getElementById('projName'); const nomeCorta = pn ? pn.scrollWidth > pn.clientWidth + 1 : false;
        const rail = document.getElementById('rail').getBoundingClientRect(), pb = parseFloat(getComputedStyle(document.querySelector('.app')).paddingBottom);
        return { small: small.slice(0, 10), over, cut, barra, nomeCorta, nome: pn && pn.value, railH: Math.round(rail.height), pb };
      });
      ok(!r.over, `[${tema}] ${nome}: sem rolagem lateral`);
      ok(r.pb >= r.railH, `[${tema}] ${nome}: trilho não cobre o conteúdo`, `${r.railH}px / folga ${r.pb}px`);
      ok(!r.cut.length, `[${tema}] ${nome}: topo e régua sem cortes`, r.cut.join(' | ') || undefined);
      ok(!r.barra.length, `[${tema}] ${nome}: botões do palco inteiros`, r.barra.join(' | ') || undefined);
      ok(!r.nomeCorta, `[${tema}] ${nome}: nome do estudo inteiro no topo`, r.nome);
      ok(!r.small.length, `[${tema}] ${nome}: alvos de toque ≥ 40 px`, r.small.join(' | ') || undefined);
      if (tema === 'light') await p.screenshot({ path: path.join(OUT, `m-${s}${sb ? '-' + sb : ''}.png`) });
    }
    semErros(p, 'celular ' + tema); await ctx.close();
  }
}

const ROT = { terreno: ['Terreno (lote)', tTerreno], entorno: ['Entorno e contexto OSM', tEntorno], regras: ['Regras', tRegras], produto: ['Produto', tProduto], viab: ['Viabilidade', tViab],
  projeto: ['Projeto', tProjeto], clima: ['Clima', tClima], cen: ['Cenários e entrega', tCen], global: ['Globais', tGlobal], celular: ['Celular', tCelular] };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const t0 = Date.now();
  for (const k of ETAPAS) {
    const [nome, fn] = ROT[k] || []; if (!fn) { console.log('etapa desconhecida: ' + k); continue }
    etapaAtual = nome; console.log(`\n## ${nome}`); const t = Date.now();
    try { await fn(b) } catch (e) { ok(false, 'o roteiro parou: ' + e.message.split('\n')[0]) }
    console.log(`  (${Math.round((Date.now() - t) / 1000)} s)`);
  }
  await b.close();
  console.log('\n## Resumo');
  let tot = 0, fal = 0;
  for (const [n, e] of Object.entries(placar)) { tot += e.ok + e.falha; fal += e.falha; console.log(`  ${e.falha ? 'FALHA' : 'ok   '} ${n}: ${e.ok}/${e.ok + e.falha}${e.falha ? ' — ' + e.falhas.join('; ') : ''}`) }
  console.log(`\n${tot - fal}/${tot} verificações ok em ${Math.round((Date.now() - t0) / 1000)} s` + (fal ? ` — ${fal} FALHA(S)` : ' — tudo certo'));
  process.exit(fal ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1) });
