// Auditoria do inspetor: para cada etapa/sub-aba, lista os cards (tipo, aberto, nº de campos, textos, botões), acha campos cortados,
// conta seções e botões primários (.btn.pri) visíveis e faz o inventário dos caminhos de estado (data-p / data-set) de cada tela.
// Uso: node tools/auditoria-ui.cjs --out <pasta> [--html test.html] [--w 1440] [--dup] [--inv arquivo.json] [--ref docs/aud-v2.json]
//   As etapas vêm de STEPS e as sub-abas de subsDe(k) (src/ui.js) — nada de lista fixa.
//   --dup  lista os data-p que aparecem em mais de uma tela (os espelhos permitidos de docs/UX-v3.md §4.6 vêm marcados e não contam como erro)
//   --inv  grava o inventário (caminhos por tela, abrindo seções e "Mais opções") nesse arquivo; sempre grava <out>/inventario.json
//   --ref  inventário de referência (padrão docs/aud-v2.json, gerado antes da reforma de UX v3): lista os caminhos que deixaram de ser alcançáveis
const { chromium } = require('playwright'); const path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..'); const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d };
// espelhos permitidos (docs/UX-v3.md §4.6): o mesmo data-p em mais de uma tela, de propósito
const ESPELHOS = [/^produto\.mix\.#\.preco$/, /^produto\.cob\.preco$/, /^mapa\.raio$/];
const SECOES_ESPELHO = ['entedit'];   // tudo o que fica dentro destas seções pode repetir
(async () => {
  const out = path.resolve(arg('--out', path.join(ROOT, 'shots', 'audit'))); fs.mkdirSync(out, { recursive: true });
  const html = path.resolve(arg('--html', path.join(ROOT, 'test.html'))), W = +arg('--w', 1440);
  const DUP = process.argv.includes('--dup'), INV = arg('--inv', ''), REF = path.resolve(ROOT, arg('--ref', 'docs/aud-v2.json'));
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: W, height: 900 } });
  const T = path.join(ROOT, 'node_modules', 'three');
  await p.route(/three@0\.128\.0\/build\/three\.min\.js/, r => r.fulfill({ path: path.join(T, 'build/three.min.js'), contentType: 'application/javascript' }));
  await p.route(/OrbitControls\.js/, r => r.fulfill({ path: path.join(T, 'examples/js/controls/OrbitControls.js'), contentType: 'application/javascript' }));
  await p.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('gabarito.tema', '"light"') } catch (e) {} });
  const erros = []; p.on('pageerror', e => erros.push(e.message));
  await p.goto('file://' + html.split(path.sep).join('/')); await p.waitForTimeout(3000);
  // etapas (STEPS) e sub-abas (subsDe) lidas da página
  const telas = await p.evaluate(() => {
    const ks = STEPS.map(s => s.k), l = [];
    for (const k of ks) {
      goStep(k);
      const subs = typeof subsDe === 'function' ? subsDe(k)
        : k === 'projeto' ? ['gar', 'tipo', 'andar'] : k === 'clima' ? ['sol', 'vento', 'v3d'] : (typeof SUBDEF !== 'undefined' && SUBDEF[k] ? SUBDEF[k].map(x => x[0]) : []);
      if (subs.length) subs.forEach(s => l.push([k, s])); else l.push([k]);
    }
    return l;
  });
  const rel = [], inv = {};
  for (const [k, sub] of telas) {
    await p.evaluate(([k, sub]) => {
      // troca só o inspetor (sem levar o palco para a vista da sub-aba, como irPara faria: o túnel 3D por software trava a auditoria)
      goStep(k); if (sub && k === 'projeto') { PSUB = sub; renderTab() } else if (sub && k === 'clima') { CSUB = sub; renderTab() } else if (sub) { SUBX[k] = sub; renderTab() }
    }, [k, sub]); await p.waitForTimeout(1500);
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
      // dentro de <details> fechado não é visível (o Chrome mantém caixas para o conteúdo recolhido: content-visibility)
      const vis = el => !el.closest('details:not([open])') && !el.closest('[hidden]') && !!(el.offsetParent || el.getClientRects().length);
      const painel = ['phead', 'tabbody', 'pfoot'].map(id => document.getElementById(id)).filter(Boolean);
      const pri = painel.flatMap(e => [...e.querySelectorAll('.btn.pri')]).filter(vis);
      const tot = { visiveis: [...TB.querySelectorAll('input:not([type=hidden]):not([type=file]), select, textarea')].filter(vis).length, campos: TB.querySelectorAll('input:not([type=hidden]), select, textarea').length, botoes: TB.querySelectorAll('button').length, textoChars: [...TB.querySelectorAll('.note, p')].reduce((s, n) => s + n.textContent.trim().length, 0), alturaPx: TB.scrollHeight,
        secoes: TB.querySelectorAll('details.card').length, res: TB.querySelectorAll('section.card.res').length, pri: pri.length, priTxt: pri.map(e => e.textContent.trim().slice(0, 30)) };
      return { cards, cort: [...new Set(cort)].slice(0, 25), tot, head: document.getElementById('phead').innerText.replace(/\s+/g, ' ').slice(0, 160) };
    });
    // captura do painel inteiro (estica o inspetor)
    const h = r.tot.alturaPx;
    await p.setViewportSize({ width: W, height: Math.min(6000, Math.max(900, h + 300)) }); await p.waitForTimeout(400);
    await p.locator('aside, #insp, .insp').first().screenshot({ path: path.join(out, `insp-${k}${sub ? '-' + sub : ''}.png`) }).catch(async () => { await p.screenshot({ path: path.join(out, `insp-${k}${sub ? '-' + sub : ''}.png`), clip: { x: 0, y: 0, width: 470, height: Math.min(6000, h + 300) } }).catch(e => console.error('sem captura de ' + k + (sub ? '/' + sub : '') + ': ' + e.message.split('\n')[0])) });
    await p.setViewportSize({ width: W, height: 900 });
    // inventário: todos os caminhos alcançáveis na tela (o conteúdo das seções fechadas já está no DOM; "Mais opções" é só escondido).
    // Índices do meio viram # (produto.mix.0.preco → produto.mix.#.preco). Não grava nada no navegador.
    const ps = await p.evaluate(secEsp => {
      const TB = document.getElementById('tabbody'), o = {};
      [...TB.querySelectorAll('[data-p], [data-set]')].forEach(e => {
        const c = (e.dataset.p || e.dataset.set).replace(/\.\d+\./g, '.#.'), sec = e.closest('details[data-key]'), esp = !!(sec && secEsp.includes(sec.dataset.key));
        o[c] = o[c] == null ? esp : (o[c] && esp);   // true = só aparece dentro de seção-espelho
      });
      return o;
    }, SECOES_ESPELHO);
    const tela = k + (sub ? '/' + sub : '');
    inv[tela] = ps;
    rel.push({ tela, ...r, caminhos: Object.keys(ps).length });
  }
  fs.writeFileSync(path.join(out, 'auditoria.json'), JSON.stringify(rel, null, 1));
  for (const r of rel) {
    console.log(`\n## ${r.tela} — ${r.tot.visiveis} campos visíveis de ${r.tot.campos} · ${r.tot.botoes} botões · ${r.tot.secoes} seções + ${r.tot.res} RES · ${r.tot.pri} .btn.pri visíve${r.tot.pri === 1 ? 'l' : 'is'}${r.tot.pri ? ' (' + r.tot.priTxt.join(' | ') + ')' : ''} · ${r.caminhos} caminhos · ${r.tot.textoChars} caracteres de texto · painel ${r.tot.alturaPx}px`);
    r.cards.forEach(c => console.log(`  - [${c.tipo}${c.tipo === 'recolhe' ? (c.aberto ? ' aberto' : ' fechado') : ''}] ${c.t}: ${c.campos} campos, ${c.botoes} botões, ${c.textoChars} chars/${c.notas} textos`));
    if (r.cort.length) console.log('  CORTES: ' + r.cort.join(' | '));
  }
  // totais (os números de docs/UX-v3.md §1)
  const porTela = {}; Object.entries(inv).forEach(([t, o]) => Object.keys(o).forEach(c => (porTela[c] = porTela[c] || []).push(t)));
  const etapas = [...new Set(telas.map(t => t[0]))];
  const soma = (l, f) => l.reduce((s, r) => s + f(r), 0);
  console.log(`\n# Totais: ${etapas.length} etapas · ${rel.length} telas · ${soma(rel, r => r.tot.secoes)} seções · ${Object.keys(porTela).length} caminhos de estado · ${soma(rel, r => r.tot.campos)} campos · ${soma(rel, r => r.tot.botoes)} botões`);
  console.log('  campos por etapa: ' + etapas.map(k => { const l = rel.filter(r => r.tela.split('/')[0] === k); return `${k} ${soma(l, r => r.tot.campos)}${l.length > 1 ? ' (' + l.map(r => r.tela.split('/')[1] + ' ' + r.tot.campos).join(', ') + ')' : ''}` }).join(' · '));
  const maisPri = rel.filter(r => r.tot.pri > 1); if (maisPri.length) console.log('  telas com mais de 1 .btn.pri visível: ' + maisPri.map(r => `${r.tela} (${r.tot.pri})`).join(', '));
  // duplicados entre telas
  const dups = Object.entries(porTela).filter(([, ts]) => ts.length > 1).map(([c, ts]) => ({ c, ts, espelho: ESPELHOS.some(re => re.test(c)) || ts.every(t => inv[t][c] === true) }));
  const erroDup = dups.filter(d => !d.espelho);
  console.log(`  data-p em mais de uma tela: ${dups.length} (${erroDup.length} fora dos espelhos permitidos)`);
  if (DUP) dups.forEach(d => console.log(`    ${d.espelho ? '(espelho) ' : ''}${d.c} → ${d.ts.join(', ')}`));
  // inventário
  const invObj = { gerado: new Date().toISOString(), html: path.relative(ROOT, html), largura: W, telas: Object.fromEntries(Object.entries(inv).map(([t, o]) => [t, Object.keys(o).sort()])), caminhos: Object.keys(porTela).sort() };
  fs.writeFileSync(path.join(out, 'inventario.json'), JSON.stringify(invObj, null, 1));
  if (INV) { fs.writeFileSync(path.resolve(INV), JSON.stringify(invObj, null, 1) + '\n'); console.log(`  inventário gravado em ${path.relative(ROOT, path.resolve(INV)) || INV}`) }
  else if (fs.existsSync(REF)) {
    const ref = JSON.parse(fs.readFileSync(REF, 'utf8')), falta = ref.caminhos.filter(c => !porTela[c]);
    console.log(`  inventário de referência (${path.relative(ROOT, REF)}): ${ref.caminhos.length} caminhos · ${falta.length ? falta.length + ' não alcançáveis agora: ' + falta.join(', ') : 'todos alcançáveis'}`);
  }
  if (erros.length) console.log('\nERROS DE JS: ' + [...new Set(erros)].join(' | '));
  await b.close();
})();
