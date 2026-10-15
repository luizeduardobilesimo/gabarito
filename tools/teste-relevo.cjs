// Teste de ponta a ponta do relevo (Fase B, item 2) — USA A REDE (AWS Terrain Tiles, Terrarium).
// Uso:  node tools/teste-relevo.cjs [--html caminho/test.html | --url http://localhost:5173] [--out pasta-das-capturas]
// Confere em Torres (SC): Morro do Farol (≈ 20% descendo para o sul/sudoeste, confiança alta ou média) e centro (plano ou inconclusivo),
// o bloqueio sem lote georreferenciado, a mensagem sem rede, "Usar na topografia", "Só como desnível" (sinal), cotas dos cantos e Ctrl+Z.
const { chromium } = require('playwright');
const { prepara } = require('./pw-comum.cjs');
const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d };
let falhas = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FALHA') + ' ' + m); if (!c) falhas++ };
(async () => {
  const url = arg('--url', null), html = path.resolve(arg('--html', path.join(ROOT, 'test.html'))), out = arg('--out', null);
  if (out) fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const THREE = path.join(ROOT, 'node_modules', 'three');
  await prepara(p);
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errs.push(m.text()) });
  await p.goto(url || ('file://' + html.split(path.sep).join('/')), { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2500);
  const lote = (lat, lon, geo) => p.evaluate(([la, lo, g]) => { const d = 0.0002; aplicarLoteGeo([[la - d, lo - d * 0.6], [la - d, lo + d * 0.6], [la + d, lo + d * 0.6], [la + d, lo - d * 0.6]], 'teste'); S.lote.geo = g; S.topo.on = false; S.topo.pts = []; S.topo.fonte = ''; S.lote.desnivel = 0; S.relevo.plano = null; S.relevo.planos = []; S.relevo.conf = null; S.relevo.aplicado = ''; goStep('terreno'); setView('impl') }, [lat, lon, geo]);
  const abre = () => p.evaluate(() => { const d = document.querySelector('details[data-key="topografia"]'); if (d) { d.open = true; d.scrollIntoView() } });
  const busca = async () => { await abre(); await p.click('#relevoBtn'); await p.waitForFunction(() => !REL.busy, null, { timeout: 40000 }); await p.waitForTimeout(500) };
  const est = () => p.evaluate(() => { const R = S.relevo, ef = relevoEf(); return { pct: ef && ef.plano.pct, az: ef && ef.plano.azDesc, nivel: ef && ef.conf && ef.conf.nivel, linha: ef ? relevoLinha(ef) : '', topo: S.topo.on, fonte: S.topo.fonte, npts: S.topo.pts.length, desn: S.lote.desnivel, msg: (document.getElementById('relevoMsg') || {}).innerText || '', dis: document.getElementById('relevoBtn') && document.getElementById('relevoBtn').disabled } });

  // 1. sem georreferência: botão bloqueado e mensagem curta
  await lote(-29.346252, -49.729369, false); await abre(); let s = await est();
  ok(s.dis === true && /Posicione o lote no mapa/.test(s.msg), 'sem S.lote.geo o botão fica bloqueado com a mensagem: ' + s.msg);

  // 2. sem rede: mensagem clara e botão volta
  await lote(-29.346252, -49.729369, true); await p.evaluate(() => { REL.tiles = {}; REL.ordem = [] });
  await p.route(/elevation-tiles-prod/, r => r.abort()); await busca(); s = await est();
  ok(/Sem acesso ao serviço de relevo/.test(s.msg) && s.dis === false && s.pct == null, 'sem rede: mensagem de bloqueio e botão liberado');
  await p.unroute(/elevation-tiles-prod/);

  // 3. Morro do Farol
  await busca(); s = await est(); console.log('     Farol:', s.linha);
  ok(s.pct > 12 && s.pct < 30, `Farol: inclinação ≈ 20% (${s.pct && s.pct.toFixed(1)})`);
  ok(s.az > 170 && s.az < 250, `Farol: desce para o sul/sudoeste (${s.az && s.az.toFixed(0)}°)`);
  ok(s.nivel === 'alta' || s.nivel === 'media', 'Farol: confiança alta ou média (' + s.nivel + ')');
  if (out) await p.screenshot({ path: path.join(out, 'relevo-farol-card.png') });

  // 4. usar na topografia + desfazer
  await p.click('#relevoRes [data-act="relevoUsa"]'); await p.waitForTimeout(900); s = await est();
  ok(s.topo === true && /Terrarium \(plano ajustado\)/.test(s.fonte) && s.npts > 20, `aplicar liga a topografia (${s.fonte}, ${s.npts} pontos)`);
  const t = await p.evaluate(() => { const m = window._last.m; return m.topo ? { corte: m.topo.terra.corte, aterro: m.topo.terra.aterro, c: m.topo.c } : null });
  ok(t && t.corte > 20 && t.aterro > 20, 'corte e aterro reais calculados: ' + JSON.stringify(t));
  await p.evaluate(() => { setView('impl') }); await p.waitForTimeout(500); if (out) await p.screenshot({ path: path.join(out, 'relevo-farol-2d.png') });
  await p.evaluate(() => { document.activeElement && document.activeElement.blur() }); await p.keyboard.press('Control+z'); await p.waitForTimeout(900); s = await est();
  ok(s.topo === false && s.npts === 0, 'Ctrl+Z desfaz a aplicação na topografia');
  await p.keyboard.press('Control+Shift+z'); await p.waitForTimeout(900); s = await est(); ok(s.topo === true, 'Ctrl+Shift+Z refaz');
  await p.evaluate(() => { setView('3d') }); await p.waitForTimeout(1200); if (out) await p.screenshot({ path: path.join(out, 'relevo-farol-3d.png') });
  await p.evaluate(() => { setView('impl') });

  // 5. só como desnível: sinal conferido de forma independente
  await abre(); await p.click('#relevoRes [data-act="relevoDesn"]'); await p.waitForTimeout(700); s = await est();
  const esperado = await p.evaluate(() => { const ef = relevoEf(), a = ef.plano.azDesc * Math.PI / 180, desc = [Math.sin(a), Math.cos(a)], fd = frontDir(S), sobe = -(desc[0] * fd[0] + desc[1] * fd[1]); return sobe });
  ok(Math.abs(s.desn) > 1 && Math.sign(s.desn) === Math.sign(esperado) && s.topo === false, `desnível ${s.desn} m com o sinal certo (${esperado.toFixed(2)}) e topografia desligada`);

  // 6. cotas dos cantos: o plano passa a valer (Mais opções)
  if (await p.getAttribute('#relevoBox .advbtn', 'aria-expanded') !== 'true') await p.click('#relevoBox .advbtn');
  await p.evaluate(() => { const ef = relevoEf(), z = relevoCotasDosCantos(ef.plano, S.lote.pts, S.lote.norte); window.__z = z });
  for (let i = 0; i < 4; i++) { const v = await p.evaluate(i => { const q = S.lote.pts[i]; return +(60 + 0.1 * q[0] + 0.02 * q[1]).toFixed(2) }, i); await p.fill('#rc' + i, String(v)); await p.dispatchEvent('#rc' + i, 'change') }
  await p.waitForTimeout(500); s = await est();
  ok(Math.abs(s.pct - Math.hypot(10, 2)) < 0.2 && /cotas informadas/.test(s.linha), `4 cotas digitadas: plano 10,2% e "cotas informadas" (${s.linha})`);
  await p.keyboard.press('Control+z'); await p.waitForTimeout(900);
  await p.click('#relevoRes [data-act="relevoLimpa"]').catch(() => {}); await p.waitForTimeout(500);

  // 7. centro de Torres (plano): nada de "alta/média"
  await lote(-29.335, -49.727, true); await busca(); s = await est(); console.log('     Centro:', s.linha);
  ok(s.nivel === 'plano' || s.nivel === 'baixa', 'centro de Torres: plano ou inconclusivo (' + s.nivel + ')');
  ok(/praticamente plano|inconclusivo/.test(s.linha), 'texto: ' + s.linha);
  if (out) await p.screenshot({ path: path.join(out, 'relevo-centro.png') });

  // 8. Open-Meteo (reserva)
  await lote(-29.346252, -49.729369, true); await p.evaluate(() => { S.relevo.fonte = 'openmeteo'; S.relevo.janela = 240 }); await busca(); s = await est(); console.log('     Open-Meteo:', s.linha || s.msg);
  ok(s.pct > 8, 'Open-Meteo no Farol: inclinação clara (' + (s.pct && s.pct.toFixed(1)) + '%)');

  ok(errs.length === 0, 'sem erros de JS' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close(); process.exit(falhas ? 1 : 0);
})();
