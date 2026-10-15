// Teste de ponta a ponta do editor de modelos de apartamento (docs/APTOS.md §4; src/ui/aptoeditor.js, src/ui/aptobiblioteca.js,
// src/calc/aptoeditor.js). Uso:  node tools/teste-aptoeditor.cjs [--html <build>/test.html] [--out <pasta de capturas>] [--rapido]
//  - abre pelo menu "…" do topo; desenha um 2 dorm. do zero com o mouse (ambientes, tipos), confere as portas deduzidas;
//  - erro proposital (dormitório vira closet) → validação acusa → clicar no problema destaca o ambiente → Ctrl+Z resolve;
//  - porta retirada/recolocada, divisa arrastada (as duas faces juntas), setas e Delete com desfazer;
//  - salvar, fechar, reabrir, duplicar, excluir e desfazer (barra e Ctrl+Z), começar de um partido (aviso de não salvo),
//    exportar e importar .json; tela inicial com o atalho;
//  - capturas (desktop 1440 claro e escuro, celular 400 claro e escuro) em --out. Sai com 1 se algo falhar ou houver erro de JS.
const { chromium } = require('playwright');
const { prepara, abre } = require('./pw-comum.cjs');
const path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d };
const html = path.resolve(arg('--html', path.join(ROOT, 'test.html')));
const out = path.resolve(arg('--out', path.join(ROOT, 'shots', 'aptoeditor')));
const rapido = process.argv.includes('--rapido');
fs.mkdirSync(out, { recursive: true });
let falhas = 0;
const ok = (c, msg) => { console.log((c ? '  ok   ' : '  FALHA ') + msg); if (!c) falhas++ };

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const combos = rapido ? [['d', 'light']] : [['d', 'light'], ['d', 'dark'], ['m', 'light'], ['m', 'dark']];
  for (const [md, th] of combos) {
    const tag = `${md}-${th}`, completo = tag === 'd-light';
    console.log(`[${tag}]`);
    const ctx = await b.newContext({ viewport: md === 'm' ? { width: 400, height: 860 } : { width: 1440, height: 900 }, deviceScaleFactor: md === 'm' ? 2 : 1, colorScheme: th, acceptDownloads: true });
    await ctx.addInitScript(t => { try { localStorage.setItem('gabarito.tema', JSON.stringify(t)); localStorage.removeItem('gabarito.aptos.biblioteca') } catch (e) {} }, th);
    const p = await ctx.newPage();
    await prepara(p);
    const errs = []; p.on('pageerror', e => errs.push('PE ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_|net::/.test(m.text())) errs.push('CE ' + m.text()) });
    await abre(p, html);
    const shot = n => p.screenshot({ path: path.join(out, `${tag}-${n}.png`) });
    const aberto = () => p.evaluate(() => !!document.getElementById('aptoEditor') && !document.getElementById('aptoEditor').hidden);
    const val = () => p.evaluate(() => AED_UI.val);
    const mod = () => p.evaluate(() => AED_UI.modelo);
    const bib = () => p.evaluate(() => aptoBiblioteca().length);
    const espera = (ms = 120) => p.waitForTimeout(ms);
    const pt = (x, y) => p.evaluate(([x, y]) => aptoEditorPonto(x, y), [x, y]);
    async function arrasta(x0, y0, x1, y1, mods = []) {
      const a = await pt(x0, y0), c = await pt(x1, y1);
      for (const k of mods) await p.keyboard.down(k);
      await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move((a.x + c.x) / 2, (a.y + c.y) / 2, { steps: 3 }); await p.mouse.move(c.x, c.y, { steps: 3 }); await p.mouse.up();
      for (const k of mods) await p.keyboard.up(k);
      await espera(60);
    }
    async function clica(x, y) { const a = await pt(x, y); await p.mouse.click(a.x, a.y); await espera(60) }
    async function desenha(k, [x, y, w, h]) { await p.selectOption('#aedKDes', k); await arrasta(x, y, x + w, y + h) }

    if (md === 'd') {
      // abre pelo menu "…" do topo
      await p.click('#maisBtn'); await espera(150);
      ok(await p.isVisible('#maisMenu [data-nv="aptos"]'), 'menu "…" tem "Modelos de apartamento"');
      await p.click('#maisMenu [data-nv="aptos"]'); await espera(400);
      ok(await aberto(), 'o editor abre em tela cheia');
      ok(await p.evaluate(() => document.querySelectorAll('#aptoEditor .btn.pri').length === 0), 'prancheta vazia: nada a salvar, nenhum botão primário');
      ok(await p.isVisible('#aptoEditor .aed-dica'), 'biblioteca vazia: prancheta com a dica para desenhar');
      if (completo) await shot('vazio');

      // propriedades: nome e medidas
      await p.fill('#aedNome', 'Meu 2 dorm. linear'); await p.press('#aedNome', 'Enter'); await espera();
      // 2 dorm. compacto, 7,90 × 7,00 (sala na ponta; dormitórios na fachada; circulação; cozinha, serviço e banho junto do corredor)
      await p.fill('[data-f="W"]', '7.9'); await p.press('[data-f="W"]', 'Enter'); await espera();
      await p.fill('[data-f="D"]', '7'); await p.press('[data-f="D"]', 'Enter'); await espera(200);
      let m = await mod();
      ok(m.nome === 'Meu 2 dorm. linear' && m.W === 7.9 && m.D === 7 && m.tipologia === '2d', `nome e medidas (${m.W} × ${m.D}, ${m.tipologia})`);

      // desenha do zero com o mouse
      await p.keyboard.press('r'); await espera();
      ok(await p.evaluate(() => AED_UI.ferr === 'des'), 'R liga a ferramenta Ambiente');
      await desenha('sala', [0, 0, 2.9, 7]);
      await desenha('dorm', [2.9, 0, 2.5, 3.3]);
      await desenha('dorm', [5.4, 0, 2.5, 3.3]);
      await desenha('circ', [2.9, 3.3, 5, 1.1]);
      let v = await val();
      ok(!v.ok && v.problemas.some(x => x.nivel === 'bad'), `no meio do desenho a validação lista o que falta (${v.problemas.length} itens)`);
      await desenha('cozinha', [2.9, 4.4, 2, 2.6]);
      await desenha('serv', [4.9, 4.4, 1.3, 2.6]);
      await desenha('banho', [6.2, 4.4, 1.7, 2.6]);
      m = await mod();
      ok(m.ambientes.length === 7, `7 ambientes desenhados (${m.ambientes.length})`);
      // a entrada (marcador âmbar no corredor) é arrastada para a sala
      { const a = await pt(m.entrada.x, 7), c = await pt(1.5, 7);
        await p.mouse.move(a.x, a.y - 13); await p.mouse.down(); await p.mouse.move(c.x, a.y - 13, { steps: 5 }); await p.mouse.up(); await espera();
        const e = (await mod()).entrada.x, k = await p.evaluate(() => aedSala0(AED_UI.modelo).k);
        ok(Math.abs(e - 1.5) < 0.051 && k === 'sala', `entrada arrastada para a sala (x = ${e})`) }
      ok(await p.evaluate(() => aedConfere(AED_UI.modelo).ok), 'os ambientes preenchem W × D sem sobrepor');
      ok(await p.evaluate(() => document.querySelectorAll('#aptoEditor .btn.pri').length === 1 && !!document.querySelector('#aptoEditor .btn.pri[data-ae="salvar"]')), 'um único botão primário: Salvar na biblioteca');
      v = await val();
      ok(v.ok && v.nota >= 80, `validação sem erro, nota ${Math.round(v.nota)} (${v.problemas.map(x => x.msg).join(' | ')})`);
      const portas = await p.evaluate(() => aedPortas(AED_UI.modelo).length);
      ok(portas === 7 && await p.evaluate(() => !Array.isArray(AED_UI.modelo.portas)), `portas deduzidas pela vizinhança (${portas})`);
      ok(await p.evaluate(() => document.querySelectorAll('#aptoEditor .aed-svg .fl').length >= 6), 'folhas das portas desenhadas');
      ok(await p.evaluate(() => document.querySelectorAll('#aptoEditor .aed-svg .jan').length >= 6), 'janelas na fachada desenhadas');
      ok(await p.evaluate(() => /CORREDOR/.test(document.querySelector('.aed-svg').textContent) && /FACHADA/.test(document.querySelector('.aed-svg').textContent)), 'fachada e corredor indicados');

      // erro proposital: o 2º dormitório vira closet → validação acusa → clicar no problema destaca → Ctrl+Z resolve
      await p.keyboard.press('v'); await espera();
      await clica(6.65, 1.6);
      const d2 = await p.evaluate(() => AED_UI.sel);
      ok(!!d2 && await p.evaluate(id => aedAcha(AED_UI.modelo, id).k === 'dorm', d2), 'clique seleciona o dormitório');
      await p.selectOption('#aedAk', 'closet'); await espera(200);
      v = await val();
      ok(!v.ok && v.problemas.some(x => x.nivel === 'bad' && (x.k === 'programa' || /Falta/.test(x.msg))), `erro proposital acusado: falta dormitório (${v.problemas.filter(x => x.nivel === 'bad').map(x => x.msg).join(' | ')})`);
      ok(await p.isVisible('.aed-pb'), 'problema na lista em linguagem simples');
      await p.click('.aed-pb[data-amb]'); await espera(150);
      ok(await p.evaluate(() => !!document.querySelector('.aed-svg .g.pisca')), 'clicar no problema destaca o ambiente no desenho');
      if (completo) await shot('erro');
      await p.keyboard.press('Control+z'); await espera(200);
      v = await val();
      ok(v.ok && await p.evaluate(id => aedAcha(AED_UI.modelo, id).k === 'dorm', d2), 'Ctrl+Z desfaz: validação limpa de novo');
      await p.keyboard.press('Control+Shift+z'); await espera(120);
      ok(await p.evaluate(id => aedAcha(AED_UI.modelo, id).k === 'closet', d2), 'Ctrl+Shift+Z refaz');
      await p.keyboard.press('Control+z'); await espera(120);

      // portas: tirar a da circulação deixa os quartos sem acesso; pôr de volta resolve
      await p.keyboard.press('p'); await espera();
      await clica(2.9, 3.85);
      v = await val();
      ok(!v.ok && v.problemas.some(x => /acesso|alcan|chega/i.test(x.msg)), `porta sala | circulação retirada: ambientes sem acesso (${v.problemas.filter(x => x.nivel === 'bad').length} erros)`);
      await clica(2.9, 3.85);
      v = await val();
      ok(v.ok, 'porta recolocada: acessos de volta');
      await p.keyboard.down('Shift'); await clica(2.9, 5.7); await p.keyboard.up('Shift');
      ok(await p.evaluate(() => (AED_UI.modelo.portas || []).some(q => q.tipo === 'vao')), 'Shift+clique troca a porta sala | cozinha por vão livre');
      ok(await p.evaluate(() => AED_UI.val.ok), 'vão livre conta como acesso');
      await p.click('[data-ae="portasAuto"]').catch(() => {}); await espera();
      ok(await p.evaluate(() => !Array.isArray(AED_UI.modelo.portas)), '"Deduzir de novo" volta às portas automáticas');
      await p.keyboard.press('v'); await espera();

      // dividir, unir (Shift+clique escolhe o segundo) e espelhar
      await clica(1.45, 5.2); await p.click('[data-ae="divH"]'); await espera();
      ok((await mod()).ambientes.length === 8, 'dividir: a sala vira dois ambientes');
      await p.keyboard.down('Shift'); await clica(1.45, 1.6); await p.keyboard.up('Shift');
      await p.click('[data-ae="unir"]'); await espera();
      m = await mod();
      ok(m.ambientes.length === 7 && m.ambientes.some(a => a.k === 'sala' && a.ret[3] === 7), 'unir: volta a ser uma sala só');
      await p.click('[data-ae="espelhar"]'); await espera();
      ok(Math.abs((await mod()).ambientes.find(a => a.k === 'sala').ret[0] - 5) < 1e-6 && Math.abs((await mod()).entrada.x - 6.4) < 1e-6, 'espelhar: sala e entrada do outro lado');
      await p.keyboard.press('Control+z'); await espera();
      ok(Math.abs((await mod()).ambientes.find(a => a.k === 'sala').ret[0]) < 1e-6, 'Ctrl+Z desfaz o espelhamento');

      // divisa compartilhada (entre os dois dormitórios): as duas faces andam juntas
      await arrasta(5.4, 1.5, 5.6, 1.5);
      m = await mod();
      const ds = m.ambientes.filter(a => a.k === 'dorm');
      ok(Math.abs(ds[0].ret[2] - 2.7) < 1e-6 && Math.abs(ds[1].ret[0] - 5.6) < 1e-6 && Math.abs(ds[1].ret[2] - 2.3) < 1e-6, `divisa arrastada: ${ds[0].ret[2]} | ${ds[1].ret[2]} m`);
      await p.keyboard.press('Control+z'); await espera();
      m = await mod();
      ok(Math.abs(m.ambientes.filter(a => a.k === 'dorm')[0].ret[2] - 2.5) < 1e-6, 'Ctrl+Z volta a divisa');

      // teclado: seta move 5 cm, Delete apaga, Ctrl+Z devolve
      await clica(1.45, 5.2);
      const sala = await p.evaluate(() => AED_UI.sel);
      await p.keyboard.press('ArrowUp'); await espera();
      ok(await p.evaluate(id => Math.abs(aedAcha(AED_UI.modelo, id).ret[1] - 0) < 1e-6, sala), 'seta não tira a sala da caixa (já encosta no corredor)');
      await clica(7.05, 5.7);
      const ban = await p.evaluate(() => AED_UI.sel);
      await p.keyboard.press('Delete'); await espera();
      ok(await p.evaluate(id => !aedAcha(AED_UI.modelo, id), ban), 'Delete apaga o ambiente selecionado');
      ok((await val()).problemas.some(x => x.k === 'sobra'), 'sobra acusada depois de apagar');
      await p.keyboard.press('Control+z'); await espera();
      ok(await p.evaluate(id => !!aedAcha(AED_UI.modelo, id), ban), 'Ctrl+Z devolve o ambiente');
      await clica(1.6, 6); await espera();
      if (completo) await shot('desenho');

      // salvar, fechar, reabrir
      ok(await p.isVisible('#aedSt') && /não salvas/.test(await p.textContent('#aedSt')), 'aviso de alterações não salvas no topo');
      await p.click('[data-ae="salvar"]'); await espera(200);
      ok(await bib() === 1 && /Salvo/.test(await p.textContent('#aedSt')), 'salvo na biblioteca (localStorage)');
      ok(await p.evaluate(() => { const l = JSON.parse(localStorage.getItem('gabarito.aptos.biblioteca')); return l.length === 1 && l[0].origem === 'usuario' && /^usr-/.test(l[0].id) }), 'gravado em gabarito.aptos.biblioteca no formato do §2');
      ok(await p.evaluate(() => !JSON.stringify(S).includes('Meu 2 dorm. linear')), 'nada gravado em S');
      await p.click('[data-ae="fechar"]'); await espera(250);
      ok(!(await aberto()), 'fechar sem alterações não pergunta nada');
      await p.evaluate(() => aptoEditorAbrir()); await espera(350);
      m = await mod();
      ok(m.nome === 'Meu 2 dorm. linear' && m.ambientes.length === 7, 'reaberto: o modelo salvo volta igual');
      ok(await p.$$eval('.aed-it', l => l.length) === 1, 'biblioteca lista o modelo com miniatura');

      // alteração não salva → fechar pergunta
      await clica(1.6, 6); await p.keyboard.press('ArrowRight'); await espera();
      await p.click('[data-ae="fechar"]'); await espera(200);
      ok(await p.isVisible('.aed-conf .aed-cx'), 'fechar com alteração não salva pede confirmação');
      await p.click('[data-cx="cancela"]'); await espera(120);
      ok(await aberto() && !(await p.isVisible('.aed-conf .aed-cx')), '"Continuar editando" mantém o editor aberto');
      await p.keyboard.press('Control+z'); await espera();
      ok(/Salvo/.test(await p.textContent('#aedSt')), 'desfazer até o estado salvo: volta a "Salvo"');

      // duplicar, excluir e desfazer
      await p.hover('.aed-it'); await p.click('.aed-it [data-ae="menu"]'); await espera(120);
      await p.click('.aed-menu [data-ae="duplicar"]'); await espera(200);
      ok(await bib() === 2 && await p.evaluate(() => aptoBiblioteca().some(m => /\(cópia\)/.test(m.nome))), 'duplicar cria a cópia');
      const idCopia = await p.evaluate(() => aptoBiblioteca().find(m => /\(cópia\)/.test(m.nome)).id);
      await p.click(`.aed-it[data-id="${idCopia}"] [data-ae="menu"]`); await espera(100);
      await p.click('.aed-menu [data-ae="excluir"]'); await espera(100);
      ok(await bib() === 2 && /Confirmar/.test(await p.textContent('.aed-menu .del')), 'excluir pede confirmação');
      await p.click('.aed-menu [data-ae="excluir"]'); await espera(150);
      ok(await bib() === 1, 'excluído');
      await p.click('.aed-snack [data-ae="desfaz"]'); await espera(150);
      ok(await bib() === 2, '"Desfazer" na barra devolve o modelo');
      await p.click(`.aed-it[data-id="${idCopia}"] [data-ae="menu"]`); await espera(100);
      await p.click('.aed-menu [data-ae="excluir"]'); await p.click('.aed-menu [data-ae="excluir"]'); await espera(150);
      ok(await bib() === 1, 'excluído de novo');
      await p.keyboard.press('Control+z'); await espera(150);
      ok(await bib() === 2, 'Ctrl+Z desfaz a exclusão');

      // começar de um partido do catálogo
      const nCat = await p.$$eval('.aed-pt', l => l.length);
      const temCat = await p.evaluate(() => typeof aptoCatalogo === 'function');
      ok(nCat > 0, `galeria de partidos (${nCat}${temCat ? ', catálogo do motor' : ', reserva do editor'})`);
      await p.selectOption('#aedTipCat', '2d'); await espera(120);
      const n2d = await p.$$eval('.aed-pt', l => l.length);
      ok(n2d > 0 && n2d <= nCat, `filtro por tipologia (${n2d} de 2 dorm.)`);
      await p.click('.aed-pt'); await espera(250);
      m = await mod();
      ok(m.origem === 'usuario' && m.ambientes.length > 0 && /não salvas/.test(await p.textContent('#aedSt')), `começou de “${m.nome}” como modelo novo, ainda não salvo`);
      v = await val();
      ok(typeof v.nota === 'number', `partido validado ao vivo (nota ${Math.round(v.nota)})`);
      ok(await p.$$eval('.aed-pv', l => l.length) >= 2, 'prévia em outras frentes');
      await p.click('.aed-it .aed-abre'); await espera(150);
      ok(await p.isVisible('.aed-conf .aed-cx'), 'trocar de modelo com alteração pergunta');
      await p.click('[data-cx="descarta"]'); await espera(200);
      ok(!(await p.evaluate(() => aedSujo())), 'descartar abre o modelo da biblioteca');

      // exportar e importar
      const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 10000 }), p.click('.aed-top [data-ae="exportar"]')]);
      const arq = path.join(out, 'modelo-exportado.json'); await dl.saveAs(arq);
      const ex = JSON.parse(fs.readFileSync(arq, 'utf8'));
      ok(ex.formato === 'gabarito.aptos' && ex.modelos.length === 1 && ex.modelos[0].ambientes.length > 0, `exportado ${dl.suggestedFilename()}`);
      ex.modelos[0].nome = 'Importado do arquivo';
      const n0 = await bib();
      await p.setInputFiles('#aedArq', { name: 'importar.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(ex)) }); await espera(350);
      ok(await bib() === n0 + 1 && (await mod()).nome === 'Importado do arquivo', 'importado: entra na biblioteca e abre');
      await p.setInputFiles('#aedArq', { name: 'ruim.json', mimeType: 'application/json', buffer: Buffer.from('{"W":1}') }); await espera(250);
      ok(await bib() === n0 + 1 && /recusado/.test(await p.textContent('.aed-snack')), 'arquivo inválido é recusado com motivo');

      // atalho na tela inicial
      await p.evaluate(() => aptoEditorFechar(true)); await espera(200);
      await p.evaluate(() => inicioAbrir()); await espera(500);
      const atalho = await p.$('#inicio [data-ia="aptos"]');
      ok(!!atalho, 'tela inicial tem o atalho "Modelos de apartamento"');
      if (atalho) { await atalho.click(); await espera(350); ok(await aberto(), 'o atalho abre o editor por cima da tela inicial'); await p.evaluate(() => aptoEditorFechar(true)); await espera(150) }
      await p.evaluate(() => inicioFechar());

      // capturas: editor com o modelo desenhado (claro/escuro)
      await p.evaluate(() => { const l = aptoBiblioteca(); aptoEditorAbrir({ modelo: l.find(m => m.nome === 'Meu 2 dorm. linear') || l[0] }) }); await espera(400);
      if (!completo) {
        // no escuro, o mesmo desenho a partir do zero por código
      }
      await clica(4.4, 1.7); await espera(150);
      await shot('editor');
    }
    if (md === 'd' && !completo) {
      // (o escuro reaproveita o fluxo acima; nada a mais)
    }
    if (md === 'm') {
      await p.evaluate(() => { aptoBibSalvar(aedCopia(aedPartidos()[0], 'Studio da empresa')); const b = aedPartidos().find(x => x.tipologia === '2d') || aedPartidos()[1]; aptoBibSalvar(aedCopia(b, '2 dorm. padrão')) });
      await p.evaluate(() => aptoEditorAbrir()); await espera(450);
      ok(await aberto(), 'celular: o editor abre');
      ok(await p.isVisible('.aed-aviso-cel') && !(await p.isVisible('.aed-mesa')), 'celular: só a biblioteca, com "desenhe no computador"');
      ok(await p.$$eval('.aed-it', l => l.length) === 2, 'celular: modelos com miniatura');
      await p.click('.aed-it .aed-abre'); await espera(200);
      ok(await p.isVisible('.aed-ver'), 'celular: tocar mostra a planta maior');
      const largo = await p.evaluate(() => document.getElementById('aptoEditor').scrollWidth <= innerWidth + 1 && document.querySelector('.aed-corpo').scrollWidth <= innerWidth + 1);
      ok(largo, 'celular: sem rolagem horizontal');
      await shot('editor');
      await p.evaluate(() => aptoEditorFechar(true));
    }
    ok(!errs.length, 'sem erros de JS' + (errs.length ? ': ' + errs.slice(0, 4).join(' | ') : ''));
    await ctx.close();
  }
  await b.close();
  console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
  process.exit(falhas ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1) });
