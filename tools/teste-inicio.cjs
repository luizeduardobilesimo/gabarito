// Teste de ponta a ponta da tela inicial "Meus estudos" (UX v3 §3.0, src/ui/inicio.js + src/calc/inicio.js).
// Uso:  node tools/teste-inicio.cjs [--html <build>/test.html] [--out <pasta de capturas>] [--rapido] [--sem-assistente]
//  - com navigator.webdriver nada abre sozinho (inicioDeveAbrir() = false); a tela é aberta com inicioAbrir();
//  - estado vazio (só o exemplo) → cria 2 estudos (pelo assistente na combinação desktop/claro, por estNovo nas outras) → pastas com
//    status, "6/9" e números (VGV, margem com o semáforo, unidades) → busca e filtro → abre um → volta → renomeia (Ctrl+Z desfaz) →
//    duplica (mesmos números) → exclui (armar/confirmar) e desfaz;
//  - capturas (desktop 1440 e celular 400, claro e escuro; cheia e vazia) em --out. Sai com 1 se algo falhar ou houver erro de JS.
const { chromium } = require('playwright');
const { prepara, abre } = require('./pw-comum.cjs');
const path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..');
const THREE_DIR = path.join(ROOT, 'node_modules', 'three');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d };
const html = path.resolve(arg('--html', path.join(ROOT, 'test.html')));
const out = path.resolve(arg('--out', path.join(ROOT, 'shots', 'inicio')));
const rapido = process.argv.includes('--rapido'), semAss = process.argv.includes('--sem-assistente');
fs.mkdirSync(out, { recursive: true });
let falhas = 0;
const ok = (c, msg) => { console.log((c ? '  ok   ' : '  FALHA ') + msg); if (!c) falhas++ };

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const combos = rapido ? [['d', 'light']] : [['d', 'light'], ['d', 'dark'], ['m', 'light'], ['m', 'dark']];
  for (const [md, th] of combos) {
    const tag = `${md}-${th}`, completo = tag === 'd-light';
    console.log(`[${tag}]`);
    const ctx = await b.newContext({ viewport: md === 'm' ? { width: 400, height: 860 } : { width: 1440, height: 900 }, deviceScaleFactor: md === 'm' ? 2 : 1, colorScheme: th });
    await ctx.addInitScript(t => { try { localStorage.setItem('gabarito.tema', JSON.stringify(t)) } catch (e) {} }, th);
    const p = await ctx.newPage();
    await prepara(p);
    const errs = []; p.on('pageerror', e => errs.push('PE ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('CE ' + m.text()) });
    await abre(p, html);
    await p.waitForFunction(() => typeof EST !== 'undefined' && EST.pronto, null, { timeout: 30000 });
    await p.evaluate(() => calcPronto()); await p.waitForTimeout(800);
    const shot = n => p.screenshot({ path: path.join(out, `${tag}-${n}.png`) });
    const aberta = () => p.evaluate(() => !!document.getElementById('inicio') && !document.getElementById('inicio').hidden);
    const pastas = () => p.$$eval('.ini-p:not(.sk)', l => l.length);

    // regra de abertura (pura) e webdriver
    ok(await p.evaluate(() => inicioDeveAbrir() === false), 'com navigator.webdriver a tela não abre sozinha');
    ok(await p.evaluate(() => inicioDeve({ total: 1, proprios: 0 }) && !inicioDeve({ total: 1, proprios: 1 }) && inicioDeve({ total: 3, proprios: 2 }) && !inicioDeve({ total: 3, proprios: 2, ver: true })), 'regra: 0 próprios ou mais de 1 estudo; nunca no #ver=');

    // estado vazio: só o exemplo
    await p.evaluate(() => inicioAbrir()); await p.waitForTimeout(700);
    ok(await aberta(), 'inicioAbrir() abre a tela');
    ok(await p.evaluate(() => !!document.querySelector('#inicio .ini-vazio')), 'só o exemplo: estado vazio com chamada');
    ok(await p.evaluate(() => document.querySelectorAll('#inicio .btn.pri').length === 1), 'um único botão primário (vazio)');
    await shot('vazia');
    await p.click('#inicio [data-ia="novo"]'); await p.waitForTimeout(400);
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    ok(await p.evaluate(() => document.getElementById('assWiz').hidden) && await aberta(), 'cancelar o assistente volta à tela inicial');
    await p.keyboard.press('Escape'); await p.waitForTimeout(250);
    ok(!(await aberta()), 'Esc volta ao estudo aberto');

    // dois estudos (pelo assistente, o exemplo intocado vira o 1º estudo: fica sem a pasta do exemplo)
    const viaAss = completo && !semAss, n0 = viaAss ? 2 : 3;
    if (viaAss) {
      await p.evaluate(() => inicioAbrir()); await p.waitForTimeout(500);
      await p.click('#inicio [data-ia="novo"]'); await p.waitForTimeout(450);
      ok(await p.evaluate(() => !document.getElementById('assWiz').hidden), '"Novo estudo" abre o assistente');
      await p.fill('#assN', 'Rua das Palmeiras, 300'); await p.fill('#assF', '22'); await p.fill('#assP', '42');
      await p.click('[data-a="seguir"]'); await p.waitForTimeout(300);
      const cid = await p.evaluate(() => (cidadesLista().find(c => /Crici/.test(c.cidade)) || cidadesLista()[0]).id);
      await p.selectOption('#assCid', cid); await p.waitForTimeout(200);
      await p.click('[data-a="seguir"]'); await p.waitForTimeout(300);
      await p.fill('#assPr', '12000');
      await p.click('[data-a="seguir"]');
      await p.waitForFunction(() => document.getElementById('assWiz').hidden, null, { timeout: 180000 });
      ok(!(await aberta()), 'estudo gerado: a tela inicial fecha');
      await p.evaluate(() => calcPronto()); await p.waitForTimeout(600); await p.evaluate(() => estGrava());
    } else {
      await p.evaluate(async () => {
        const st = clone(DEF); st.lote.pts = [[0, 0], [22, 0], [22, 42], [0, 42]]; st.lote.rec = [{}, {}, {}, {}]; st.lote.front = [0]; st.lote.principal = 0;
        cidadeAplicar(st, (cidadesLista().find(c => /Crici/.test(c.cidade)) || cidadesLista()[0]).id);
        st.guia.conf = { regras: false, preco: true, custo: true };
        await estNovo(st, 'Rua das Palmeiras, 300'); await calcPronto(); await estGrava();
      });
    }
    await p.evaluate(async () => {
      const st = clone(DEF); st.lote.pts = [[0, 0], [40, 0], [44, 30], [-2, 34]]; st.lote.rec = [{}, {}, {}, {}]; st.lote.front = [0, 1]; st.lote.principal = 0;
      cidadeAplicar(st, (cidadesLista().find(c => /Florian/.test(c.cidade)) || cidadesLista()[1]).id);
      await estNovo(st, 'Esquina Beira-Mar'); await calcPronto(); await estGrava();
    });

    // pastas
    await p.evaluate(() => inicioAbrir()); await p.waitForTimeout(900);
    ok(await aberta(), 'tela inicial aberta de novo');
    ok(await pastas() === n0, `${n0} pastas (2 estudos${viaAss ? '' : ' + exemplo'}): ${await pastas()}`);
    ok(await p.evaluate(() => document.querySelectorAll('#inicio .btn.pri').length === 1), 'um único botão primário (cheia)');
    const card = await p.$$eval('.ini-p', l => l.map(c => ({ nome: c.querySelector('.ini-abre') && c.querySelector('.ini-abre').textContent, st: c.querySelector('.ini-st').textContent, k: [...c.querySelectorAll('.ini-k dd')].map(d => d.textContent), dot: !!c.querySelector('.ini-k .dot'), svg: !!c.querySelector('.ini-fig svg polygon'), tab: c.querySelector('.ini-tab').textContent })));
    const pal = card.find(c => /Palmeiras/.test(c.nome)), esq = card.find(c => /Esquina/.test(c.nome)), ex = card.find(c => /Exemplo/.test(c.tab));
    ok(!!pal && /\d\/9/.test(pal.st) && /(Rascunho|Em andamento|Confiável)/.test(pal.st), `status na pasta: "${pal && pal.st}"`);
    ok(!!pal && /R\$/.test(pal.k[0]) && /%/.test(pal.k[1]) && /^\d/.test(pal.k[2]) && pal.dot, `números na pasta: ${pal && pal.k.join(' | ')}`);
    ok(!!esq && esq.svg && /R\$/.test(esq.k[0]), 'segunda pasta com miniatura e números');
    ok(viaAss ? !ex : !!ex, viaAss ? 'o exemplo virou o estudo do assistente' : 'exemplo marcado na aba da pasta');
    await shot('cheia');
    if (md === 'd') { await p.hover('.ini-p:nth-child(2)'); await p.waitForTimeout(300); await shot('hover') }

    // busca e filtro
    await p.fill('#iniQ', 'palmeiras'); await p.waitForTimeout(150);
    ok(await pastas() === 1, 'busca por nome');
    await p.fill('#iniQ', 'florianopolis'); await p.waitForTimeout(150);
    ok(await pastas() === 1, 'busca pela cidade sem acento');
    await p.fill('#iniQ', ''); await p.waitForTimeout(150);
    await p.click('[data-if="confiavel"]'); await p.waitForTimeout(150);
    const nConf = await pastas(), temNada = await p.$('.ini-nada');
    ok(nConf < n0 || !!temNada, 'filtro por status');
    await p.click('[data-if="todos"]'); await p.waitForTimeout(150);
    await p.selectOption('#iniOrd', 'nome'); await p.waitForTimeout(150);
    ok((await p.$$eval('.ini-abre', l => l.map(x => x.textContent)))[0] === 'Esquina Beira-Mar', 'ordenar por nome');
    await p.selectOption('#iniOrd', 'recentes'); await p.waitForTimeout(150);

    // abrir um estudo e voltar
    const idPal = await p.$eval('.ini-p:has(.ini-abre[title^="Rua das Palmeiras"])', e => e.dataset.id);
    await p.click(`.ini-p[data-id="${idPal}"]`); await p.waitForTimeout(400);
    await p.waitForFunction(() => document.getElementById('inicio').hidden, null, { timeout: 15000 });
    ok(await p.evaluate(id => EST.id === id && /Palmeiras/.test(S.nome), idPal), 'clicar na pasta abre o estudo');
    await p.evaluate(() => calcPronto());
    await p.evaluate(() => inicioAbrir()); await p.waitForTimeout(700);
    ok(await aberta() && await p.$(`.ini-p.on[data-id="${idPal}"]`) !== null, 'voltar com inicioAbrir(): pasta do aberto marcada');

    // renomear (o aberto) e desfazer com Ctrl+Z
    const menu = async id => { await p.click(`.ini-p[data-id="${id}"] .ini-mais`); await p.waitForTimeout(200) };
    await menu(idPal);
    ok(await p.$('.ini-menu [data-ia="renomear"]') !== null, 'menu "…" com as ações');
    if (completo) await shot('menu');
    await p.click('.ini-menu [data-ia="renomear"]'); await p.waitForTimeout(200);
    await p.fill('[data-ren]', 'Palmeiras 300 — torre única'); await p.keyboard.press('Enter'); await p.waitForTimeout(700);
    ok(await p.evaluate(async id => (await Repo.estudos.get(id)).nome === 'Palmeiras 300 — torre única' && S.nome === 'Palmeiras 300 — torre única' && document.getElementById('projName').value === S.nome, idPal), 'renomear grava no repositório e no estudo aberto');
    ok(await p.evaluate(() => !document.getElementById('iniSnack').hidden), 'barra "Desfazer" depois de renomear');
    await p.keyboard.press('Control+z'); await p.waitForTimeout(700);
    ok(await p.evaluate(async id => (await Repo.estudos.get(id)).nome === 'Rua das Palmeiras, 300', idPal), 'Ctrl+Z desfaz o renomear');
    // renomear outro (não aberto)
    const idEsq = await p.$eval('.ini-p:has(.ini-abre[title^="Esquina"])', e => e.dataset.id);
    await menu(idEsq); await p.click('.ini-menu [data-ia="renomear"]'); await p.waitForTimeout(200);
    await p.fill('[data-ren]', 'Esquina da Beira-Mar'); await p.keyboard.press('Enter'); await p.waitForTimeout(600);
    ok(await p.evaluate(async id => { const r = await Repo.estudos.get(id); return r.nome === 'Esquina da Beira-Mar' && r.S.nome === r.nome }, idEsq), 'renomear um estudo fechado');

    // duplicar
    const vgvEsq = await p.$eval(`.ini-p[data-id="${idEsq}"] .ini-k dd`, e => e.textContent);
    await menu(idEsq); await p.click('.ini-menu [data-ia="duplicar"]'); await p.waitForTimeout(900);
    ok(await pastas() === n0 + 1, 'duplicar cria uma pasta');
    const dup = await p.$$eval('.ini-p', l => l.map(c => ({ n: c.querySelector('.ini-abre').textContent, v: c.querySelector('.ini-k dd').textContent })).find(x => /\(cópia\)/.test(x.n)));
    ok(!!dup && dup.v === vgvEsq, `cópia com os mesmos números (${dup && dup.v} = ${vgvEsq})`);

    // excluir (armar, confirmar) e desfazer
    await menu(idEsq); await p.click('.ini-menu [data-ia="excluir"]'); await p.waitForTimeout(200);
    ok(await pastas() === n0 + 1 && /Confirmar/.test(await p.$eval('.ini-menu .del', e => e.textContent)), 'excluir pede confirmação');
    if (completo) await shot('excluir');
    await p.click('.ini-menu .del'); await p.waitForTimeout(900);
    ok(await pastas() === n0 && await p.evaluate(async id => !(await Repo.estudos.get(id)), idEsq), 'excluído do repositório');
    await shot('desfazer');
    await p.click('#iniSnack button'); await p.waitForTimeout(900);
    ok(await pastas() === n0 + 1 && await p.evaluate(async id => !!(await Repo.estudos.get(id)), idEsq), '"Desfazer" traz o estudo de volta');
    ok(await p.$(`.ini-p[data-id="${idEsq}"] .ini-k dd:not(.vz)`) !== null, 'o estudo volta com o resumo');

    // excluir o estudo aberto: abre outro por baixo; desfazer traz o registro de volta
    await menu(idPal); await p.click('.ini-menu [data-ia="excluir"]'); await p.waitForTimeout(150); await p.click('.ini-menu .del');
    await p.waitForFunction(() => /excluído/.test((document.getElementById('iniSnack') || {}).textContent || ''), null, { timeout: 30000 }).catch(() => {});
    ok(await p.evaluate(async id => EST.id && EST.id !== id && !(await Repo.estudos.get(id)) && document.querySelector('#inicio [data-ia="voltar"]') !== null, idPal), 'excluir o aberto abre outro estudo por baixo');
    await p.keyboard.press('Control+z');
    for (let i = 0; i < 30 && !(await p.evaluate(async id => !!(await Repo.estudos.get(id)), idPal)); i++) await p.waitForTimeout(500);
    ok(await p.evaluate(async id => !!(await Repo.estudos.get(id)), idPal), 'Ctrl+Z desfaz a exclusão');
    // teclado: a pasta é um botão alcançável e a tela fecha com Esc
    ok(await p.evaluate(() => { const b = document.querySelector('.ini-abre'); b.focus(); return document.activeElement === b }), 'pasta focável pelo teclado');
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    ok(!(await aberta()), 'Esc fecha a tela');
    await p.evaluate(() => inicioAbrir()); await p.waitForTimeout(500);
    if (md === 'm') { await p.evaluate(() => { document.getElementById('inicio').scrollTop = 99999 }); await p.waitForTimeout(250); await shot('cheia-fim') }

    ok(!errs.length, 'sem erros de JS' + (errs.length ? ': ' + errs.slice(0, 4).join(' | ') : ''));
    await ctx.close();
  }
  await b.close();
  console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo'); process.exit(falhas ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1) });
