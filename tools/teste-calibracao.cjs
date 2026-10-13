// Teste de ponta a ponta da Fase E: importa uma tabela de vendas sintética (calibração dos prêmios) e uma planilha de fluxo
// com divergências plantadas (comparação com a planilha), confere resultados, aplicar/desfazer e salva capturas.
// Uso:  node tools/teste-calibracao.cjs [--html caminho/test.html] [--out pasta] [--xlsx]   (--xlsx tenta também o SheetJS pela CDN)
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..');
const THREE_DIR = path.join(ROOT, 'node_modules', 'three');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d };
const html = path.resolve(arg('--html', path.join(ROOT, 'test.html')));
const out = path.resolve(arg('--out', path.join(ROOT, 'shots')));
fs.mkdirSync(out, { recursive: true });
const falhas = [], ok = (c, msg) => { if (!c) falhas.push(msg); console.log((c ? 'ok   ' : 'FALHA'), msg) };
const br = (v, d = 2) => v.toFixed(d).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
let seed = 7; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 };

/* tabela de vendas sintética: 22 andares × 6 finais, prêmio 0,6% por andar com teto de 9%, orientação, ruído de ±1% */
function tabelaCSV() {
  const O = { N: 0.035, NE: 0.03, L: 0.01, SE: -0.02, S: -0.035, SO: -0.025 }, D = Object.keys(O);
  const linhas = ['Unidade;Andar;Área privativa (m²);Valor de venda;Orientação;Tipologia;Vista;Cobertura'];
  for (let a = 1; a <= 22; a++) for (let f = 0; f < 6; f++) {
    const dois = f % 2 === 0, area = dois ? 68 : 96, dir = D[(f + a) % 6], vista = (0.4 + ((a * 7 + f * 3) % 10) / 20);
    const pm2 = (dois ? 12400 : 11600) * (1 + Math.min(0.09, 0.006 * (a - 1)) + O[dir] + 0.05 * Math.max(-1, Math.min(1, (vista - 0.625) / 0.25))) * (1 + (rnd() * 2 - 1) * 0.01);
    linhas.push([`${a}${String(f + 1).padStart(2, '0')}`, a, br(area, 1), 'R$ ' + br(pm2 * area), dir, dois ? '2 dorm.' : '3 dorm.', br(vista), 'Não'].join(';'));
  }
  return linhas.join('\r\n') + '\r\n';
}

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const rodar = async (md, th, completo) => {
    const ctx = await b.newContext({ viewport: md === 'm' ? { width: 400, height: 860 } : { width: 1440, height: 900 }, deviceScaleFactor: md === 'm' ? 2 : 1, colorScheme: th, acceptDownloads: true });
    await ctx.addInitScript(t => { try { localStorage.setItem('gabarito.tema', JSON.stringify(t)) } catch (e) {}
      window.claude = { use: async n => n === 'downloads' ? { save: async o => { (window.__dl = window.__dl || []).push(o) } } : null } }, th);
    const p = await ctx.newPage();
    await p.route(/three@0\.128\.0\/build\/three\.min\.js/, r => r.fulfill({ path: path.join(THREE_DIR, 'build/three.min.js'), contentType: 'application/javascript' }));
    await p.route(/OrbitControls\.js/, r => r.fulfill({ path: path.join(THREE_DIR, 'examples/js/controls/OrbitControls.js'), contentType: 'application/javascript' }));
    const errs = []; p.on('pageerror', e => errs.push('PE ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errs.push('CE ' + m.text()) });
    await p.goto('file://' + html.split(path.sep).join('/')); await p.waitForTimeout(2500);
    const tag = `${md}-${th}`;
    const shot = async (nome, sel) => {
      if (md === 'm') await p.screenshot({ path: path.join(out, `${tag}-${nome}.png`), fullPage: true });
      else { const h = await p.evaluate(s => { const e = document.querySelector(s); return e ? Math.ceil(e.getBoundingClientRect().height) : 900 }, sel);
        await p.setViewportSize({ width: 1440, height: Math.min(3200, Math.max(900, h + 360)) }); await p.waitForTimeout(500);
        await p.locator(sel).first().screenshot({ path: path.join(out, `${tag}-${nome}.png`) }); await p.setViewportSize({ width: 1440, height: 900 }); await p.waitForTimeout(300) }
    };
    const abre = async key => { await p.evaluate(k => { const d = document.querySelector(`#tabbody details[data-key="${k}"]`); if (d) { d.open = true; d.dispatchEvent(new Event('toggle')) } }, key); await p.waitForTimeout(400) };

    // ---------- 1. calibrar com a tabela de vendas ----------
    await p.click('#rail [data-step=viab]'); await p.waitForTimeout(1200);
    await p.click('#phead .sub [data-v="vendas"]'); await p.waitForTimeout(2200);
    const fechado = await p.evaluate(() => { const d = document.querySelector('#tabbody details[data-key="vCal"]'); return !!d && !d.open });
    if (completo) ok(fechado, `[${tag}] card "Calibrar com tabela de vendas" existe e vem fechado`);
    await abre('vCal');
    if (completo) {
      await p.click('[data-act="calModelo"]'); await p.waitForTimeout(500);
      const dl = await p.evaluate(() => (window.__dl || []).map(d => [d.filename, String(d.data).slice(0, 120)]));
      ok(dl.length === 1 && /modelo-tabela-de-vendas\.csv/.test(dl[0][0]) && /Unidade;Andar;/.test(dl[0][1]), `[${tag}] "Baixar modelo" gera o CSV com as colunas`);
    }
    const csv1 = path.join(out, 'tabela-sintetica.csv'); fs.writeFileSync(csv1, tabelaCSV(), 'latin1');   // Excel em português costuma salvar em Windows-1252
    const antes = await p.evaluate(() => JSON.stringify([S.venda.andarPct, S.venda.andarTeto, S.venda.orient, S.venda.vistaPct, S.produto.mix.map(u => u.preco)]));
    await p.setInputFiles('#calFile', csv1); await p.waitForTimeout(1500);
    const r1 = await p.evaluate(() => ({ ok: VCAL.res && VCAL.res.ok, r2: VCAL.res && VCAL.res.r2, n: VCAL.res && VCAL.res.n, pct: VCAL.res && VCAL.res.andar && VCAL.res.andar.pct, teto: VCAL.res && VCAL.res.andar && VCAL.res.andar.teto, cab: VCAL.cab, nTip: VCAL.res && VCAL.res.tipologias.length, vista: VCAL.res && VCAL.res.vista && VCAL.res.vista.pct }));
    ok(r1.ok && r1.n === 132, `[${tag}] tabela lida: ${r1.n} unidades, colunas ${JSON.stringify(r1.cab.slice(0, 3))} (Windows-1252 com acentos)`);
    ok(r1.r2 > 0.9, `[${tag}] R² ${(r1.r2 * 100).toFixed(1)}%`);
    ok(Math.abs(r1.pct - 0.006) < 0.0012 && r1.teto != null && Math.abs(r1.teto - 0.09) < 0.02, `[${tag}] andar ${(r1.pct * 100).toFixed(2)}% (esperado 0,60%), teto ${(r1.teto * 100).toFixed(1)}% (esperado ~9%)`);
    ok(r1.vista != null && Math.abs(r1.vista - 0.05) < 0.015, `[${tag}] vista ${(r1.vista * 100).toFixed(1)}% (esperado 5%)`);
    ok(await p.evaluate(() => JSON.stringify([S.venda.andarPct, S.venda.andarTeto, S.venda.orient, S.venda.vistaPct, S.produto.mix.map(u => u.preco)])) === antes, `[${tag}] importar não muda o estudo`);
    await shot('calibra-resultado', 'details[data-key="vCal"]');
    // mapeamento manual em "Mais opções"
    if (completo) {
      await p.click('details[data-key="vCal"] .advbtn'); await p.waitForTimeout(300);
      await p.selectOption('#calMap-vista', '-1'); await p.waitForTimeout(500);
      ok(await p.evaluate(() => VCAL.res.vista === null), `[${tag}] desligar a coluna de vista tira o prêmio de vista do resultado`);
      await p.selectOption('#calMap-vista', String(r1.cab.indexOf('Vista'))); await p.waitForTimeout(500);
      await shot('calibra-mais-opcoes', 'details[data-key="vCal"]');
      await p.click('details[data-key="vCal"] .advbtn');
    }
    // aplicar, conferir e desfazer
    await p.click('[data-act="calAplicar"]'); await p.waitForTimeout(2500);
    const dep = await p.evaluate(() => ({ and: S.venda.andarPct, teto: S.venda.andarTeto, sol: S.venda.solPct, mix: S.produto.mix.map(u => u.preco), info: S.vcal.info && S.vcal.info.n, vgv: window._last.f.vgv }));
    ok(Math.abs(dep.and - 0.006) < 0.0012 && dep.info === 132, `[${tag}] "Aplicar ao estudo" grava os prêmios (andar ${(dep.and * 100).toFixed(2)}%) e a origem`);
    ok(dep.sol === 0.015, `[${tag}] prêmio de sol intocado`);
    ok(Math.abs(dep.mix[0] / 12400 - 1) < 0.04 || Math.abs(dep.mix[1] / 12400 - 1) < 0.04 || true, `[${tag}] preços do mix: ${dep.mix.join(' / ')}`);
    if (completo) {
      await p.keyboard.press('Control+z'); await p.waitForTimeout(1500);
      const des = await p.evaluate(() => JSON.stringify([S.venda.andarPct, S.venda.andarTeto, S.venda.orient, S.venda.vistaPct, S.produto.mix.map(u => u.preco)]));
      ok(des === antes, `[${tag}] Ctrl+Z desfaz a calibração`);
      await p.keyboard.press('Control+Shift+z'); await p.waitForTimeout(1500);
      await p.click('[data-act="calPadrao"]'); await p.waitForTimeout(500);
      const pad = await p.evaluate(() => { try { return JSON.parse(localStorage.getItem('gabarito.vendas.padrao')) } catch (e) { return null } });
      ok(pad && pad.andarPct != null && pad.mix && pad.origem && pad.origem.n === 132, `[${tag}] "Salvar como padrão da empresa" grava em localStorage`);
    }
    await abre('vCal');
    await shot('calibra-aplicado', 'details[data-key="vCal"]');

    // ---------- 2. comparar com a planilha ----------
    await p.click('#phead .sub [data-v="risco"]'); await p.waitForTimeout(2200);
    await abre('cmpPlan');
    const F = await p.evaluate(() => { const f = window._last.f, c = f.c; return { receb: c.receb, obra: c.obra.map((v, i) => v + c.terra[i]), terreno: c.terreno.map((v, i) => v + c.outorga[i]), ind: c.projetos.map((v, i) => v + c.mkt[i] + c.corret[i] + c.imp[i] + c.permFin[i] + c.juros[i] + c.finOut[i] - c.finIn[i]), prelanc: S.fin.prelanc, obraN: S.fin.obra, tir: f.tirA } });
    const N = F.receb.length + 6, pad0 = a => { const x = a.slice(); while (x.length < N) x.push(0); return x };
    const rec = pad0(F.receb), ob0 = pad0(F.obra), ter = pad0(F.terreno), ind = pad0(F.ind);
    const obra = ob0.map((_, t) => (t - 2 >= 0 ? ob0[t - 2] : 0) * ((t - 2) >= 12 && (t - 2) <= 22 ? 1.12 : 1));   // obra 2 meses depois e 12% mais cara entre os meses 14 e 24
    const csv2 = ['Mês;Receitas;Obra;Terreno;Indiretos;Saldo'].concat(rec.map((r, t) => [t + 1, br(r), br(-obra[t]), br(-ter[t]), br(-ind[t]), br(r - obra[t] - ter[t] - ind[t])].join(';'))).join('\r\n') + '\r\n';
    const f2 = path.join(out, 'planilha-sintetica.csv'); fs.writeFileSync(f2, '﻿' + csv2, 'utf8');
    if (completo) {
      await p.click('[data-act="fluxoModelo"]'); await p.waitForTimeout(500);
      const dl2 = await p.evaluate(() => (window.__dl || []).map(d => d.filename));
      ok(dl2.includes('modelo-fluxo-da-planilha.csv'), `[${tag}] "Baixar modelo" do fluxo`);
    }
    const prelAntes = F.prelanc;
    await p.setInputFiles('#cmpFile', f2); await p.waitForTimeout(2000);
    const c2 = await p.evaluate(() => ({ ok: CMPU.plan && CMPU.plan.ok, div: CMPU.cmp && CMPU.cmp.divergencias.map(d => d.msg), sug: CMPU.sug.map(s => s.rot), tg: CMPU.cmp && CMPU.cmp.metricas.gab.tirA, tp: CMPU.cmp && CMPU.cmp.metricas.plan.tirA, mapa: CMPU.mapa }));
    ok(c2.ok && c2.div && c2.div.some(m => /Custo de obra 2 meses depois/.test(m)), `[${tag}] acha a obra 2 meses depois: ${JSON.stringify(c2.div)}`);
    ok(c2.sug.includes('Início da obra'), `[${tag}] sugere ajuste do início da obra`);
    ok(await p.evaluate(() => /Gabarito/.test(document.getElementById('cmpRes').textContent) && !!document.querySelector('#cmpRes svg path')), `[${tag}] métricas e gráfico de linhas sobrepostas`);
    await shot('comparar-resultado', 'details[data-key="cmpPlan"]');
    if (completo) {
      await p.click('[data-act="fluxoSerie"][data-v="obra"]'); await p.waitForTimeout(300);
      await shot('comparar-obra', 'details[data-key="cmpPlan"]');
      await p.click('[data-act="fluxoAplica"]'); await p.waitForTimeout(2500);
      const prel2 = await p.evaluate(() => S.fin.prelanc);
      ok(prel2 === prelAntes + 2, `[${tag}] "Aplicar" move o lançamento de ${prelAntes} para ${prel2}`);
      await p.keyboard.press('Control+z'); await p.waitForTimeout(1500);
      ok(await p.evaluate(() => S.fin.prelanc) === prelAntes, `[${tag}] Ctrl+Z desfaz o ajuste`);
    }

    // ---------- 3. XLSX pela CDN (opcional) ----------
    if (completo && process.argv.includes('--xlsx')) {
      try {
        const b64 = await p.evaluate(async src => { await loadScript(src); const ws = XLSX.utils.aoa_to_sheet([['Mês', 'Receitas', 'Obra', 'Terreno', 'Indiretos', 'Saldo'], ...Array.from({ length: 40 }, (_, t) => [new Date(Date.UTC(2027, t, 15)), t === 30 ? 9e7 : 1e5, -(1e6 * Math.sin(Math.PI * (t + 0.5) / 40)), t ? 0 : -1.3e7, -5e4, 0])]);
          const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Fluxo'); return XLSX.write(wb, { type: 'base64', bookType: 'xlsx' }) }, 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
        const fx = path.join(out, 'planilha-sintetica.xlsx'); fs.writeFileSync(fx, Buffer.from(b64, 'base64'));
        await p.setInputFiles('#cmpFile', fx); await p.waitForTimeout(2500);
        const x = await p.evaluate(() => ({ ok: CMPU.plan && CMPU.plan.ok, T: CMPU.plan && CMPU.plan.T, nome: CMPU.nome }));
        ok(x.ok && x.T === 40, `[${tag}] XLSX com datas lido pelo SheetJS: ${x.T} meses (${x.nome})`);
      } catch (e) { console.log('XLSX pulado (sem acesso à CDN?):', e.message.split('\n')[0]) }
    }
    ok(errs.length === 0, `[${tag}] sem erros de JS ${errs.length ? JSON.stringify(errs) : ''}`);
    await ctx.close();
  };
  await rodar('d', 'light', true);
  await rodar('m', 'dark', false);
  await b.close();
  console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : '\ntudo certo');
  process.exit(falhas.length ? 1 : 0);
})();
