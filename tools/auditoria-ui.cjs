// Auditoria do inspetor: para cada etapa/sub-aba, lista os cards (tipo, aberto, nº de campos, textos, botões) e acha campos cortados.
// Uso: node tools/auditoria-ui.cjs --out <pasta> [--html test.html] [--w 1440]
const { chromium } = require('playwright'); const path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..'); const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d };
(async () => {
  const out = path.resolve(arg('--out', path.join(ROOT, 'shots', 'audit'))); fs.mkdirSync(out, { recursive: true });
  const html = path.resolve(arg('--html', path.join(ROOT, 'test.html'))), W = +arg('--w', 1440);
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: W, height: 900 } });
  const T = path.join(ROOT, 'node_modules', 'three');
  await p.route(/three@0\.128\.0\/build\/three\.min\.js/, r => r.fulfill({ path: path.join(T, 'build/three.min.js'), contentType: 'application/javascript' }));
  await p.route(/OrbitControls\.js/, r => r.fulfill({ path: path.join(T, 'examples/js/controls/OrbitControls.js'), contentType: 'application/javascript' }));
  await p.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('gabarito.tema', '"light"') } catch (e) {} });
  await p.goto('file://' + html.split(path.sep).join('/')); await p.waitForTimeout(3000);
  const telas = [];
  for (const k of ['terreno', 'regras', 'produto', 'viab', 'projeto', 'clima', 'cen']) {
    const subs = await p.evaluate(k => { goStep(k); return k === 'projeto' ? ['gar', 'tipo', 'andar'] : k === 'clima' ? ['sol', 'vento', 'v3d'] : (typeof SUBDEF !== 'undefined' && SUBDEF[k] ? SUBDEF[k].map(x => x[0]) : []) }, k);
    if (subs.length) subs.forEach(s => telas.push([k, s])); else telas.push([k]);
  }
  const rel = [];
  for (const [k, sub] of telas) {
    await p.evaluate(([k, sub]) => { goStep(k); if (sub && k === 'projeto') { PSUB = sub; renderTab() } else if (sub && k === 'clima') { CSUB = sub; renderTab() } else if (sub) { SUBX[k] = sub; renderTab() } }, [k, sub]); await p.waitForTimeout(1500);
    const r = await p.evaluate(() => {
      const TB = document.getElementById('tabbody'), pr = TB.getBoundingClientRect();
      const cards = [...TB.querySelectorAll(':scope > .card, :scope > details.card, :scope > section.card, :scope > div > .card')].map(c => {
        const t = (c.querySelector('summary span, .ch h2') || {}).textContent || '(sem título)';
        const notes = [...c.querySelectorAll('.note, p')].map(n => n.textContent.trim()).filter(Boolean);
        return { t: t.trim(), tipo: c.tagName === 'DETAILS' ? 'recolhe' : 'fixo', aberto: c.tagName === 'DETAILS' ? c.open : true,
          campos: c.querySelectorAll('input:not([type=hidden]), select, textarea').length, botoes: c.querySelectorAll('button').length,
          textoChars: notes.reduce((s, n) => s + n.length, 0), notas: notes.length };
      });
      // campos cortados: input/select mais estreitos que o conteúdo, rótulos com reticências ou elementos que vazam do painel
      const cort = [];
      TB.querySelectorAll('input[type=number], input.t, select').forEach(i => { const w = i.getBoundingClientRect().width; if (w > 0 && w < 52) cort.push('campo estreito ' + Math.round(w) + 'px: ' + (i.closest('.fld')?.querySelector('.fl')?.textContent || i.getAttribute('aria-label') || i.dataset.p || '?').trim().slice(0, 40)) });
      TB.querySelectorAll('select').forEach(s => { if (s.scrollWidth > s.clientWidth + 2) cort.push('select cortado: ' + (s.options[s.selectedIndex]?.text || '').slice(0, 50)) });
      TB.querySelectorAll('.fl, label, .seg button, .btn').forEach(l => { if (l.scrollWidth > l.clientWidth + 2 && getComputedStyle(l).overflow !== 'visible') cort.push('texto cortado: ' + l.textContent.trim().slice(0, 50)) });
      TB.querySelectorAll('*').forEach(e => { const q = e.getBoundingClientRect(); if (q.width && q.right > pr.right + 1 && !e.closest('.seg.scroll')) cort.push('vaza do painel: ' + (e.className || e.tagName) + ' ' + (e.textContent || '').trim().slice(0, 30)) });
      const vis = el => !!(el.offsetParent || el.getClientRects().length);
      const tot = { visiveis: [...TB.querySelectorAll('input:not([type=hidden]):not([type=file]), select, textarea')].filter(vis).length, campos: TB.querySelectorAll('input:not([type=hidden]), select, textarea').length, botoes: TB.querySelectorAll('button').length, textoChars: [...TB.querySelectorAll('.note, p')].reduce((s, n) => s + n.textContent.trim().length, 0), alturaPx: TB.scrollHeight };
      return { cards, cort: [...new Set(cort)].slice(0, 25), tot, head: document.getElementById('phead').innerText.replace(/\s+/g, ' ').slice(0, 160) };
    });
    // captura do painel inteiro (estica o inspetor)
    await p.evaluate(() => { document.querySelectorAll('#tabbody details.card').forEach(d => d.dataset.wasOpen = d.open) });
    const h = r.tot.alturaPx;
    await p.setViewportSize({ width: W, height: Math.min(6000, Math.max(900, h + 300)) }); await p.waitForTimeout(400);
    await p.locator('aside, #insp, .insp').first().screenshot({ path: path.join(out, `insp-${k}${sub ? '-' + sub : ''}.png`) }).catch(async () => { await p.screenshot({ path: path.join(out, `insp-${k}${sub ? '-' + sub : ''}.png`), clip: { x: 0, y: 0, width: 470, height: Math.min(6000, h + 300) } }) });
    await p.setViewportSize({ width: W, height: 900 });
    rel.push({ tela: k + (sub ? '/' + sub : ''), ...r });
  }
  fs.writeFileSync(path.join(out, 'auditoria.json'), JSON.stringify(rel, null, 1));
  for (const r of rel) {
    console.log(`\n## ${r.tela} — ${r.tot.campos} campos, ${r.tot.botoes} botões, ${r.tot.textoChars} caracteres de texto, painel ${r.tot.alturaPx}px`);
    r.cards.forEach(c => console.log(`  - [${c.tipo}${c.tipo === 'recolhe' ? (c.aberto ? ' aberto' : ' fechado') : ''}] ${c.t}: ${c.campos} campos, ${c.botoes} botões, ${c.textoChars} chars/${c.notas} textos`));
    if (r.cort.length) console.log('  CORTES: ' + r.cort.join(' | '));
  }
  await b.close();
})();
