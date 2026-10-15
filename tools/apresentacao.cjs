// Teste de ponta a ponta do item 4.2 (apresentação, link somente leitura e PDF com a marca).
//   node tools/apresentacao.cjs [--html caminho/test.html] [--out pasta] [--fase 1,2,3,4]
// fase 1) editor: liga a marca, envia uma logo, copia o link somente leitura, apresenta dentro do editor e exporta dois PDFs (com e sem marca);
// fase 2) outro navegador, com um estudo PRÓPRIO salvo: abre o link, percorre a apresentação (botão, teclado, deslizar),
//         confere que não há campos editáveis e que o localStorage ficou exatamente como estava; link quebrado;
// fase 3) capturas desktop e celular, claro e escuro. Sai com código 1 se algo falhar ou houver erro de JS.
// Os contextos usam prefers-reduced-motion (a órbita 3D para): o WebGL por software do teste é lento demais com a câmera girando.
const { chromium } = require('playwright');
const { prepara, abre } = require('./pw-comum.cjs');
const path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..');
const THREE_DIR = path.join(ROOT, 'node_modules', 'three');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d };
const html = path.resolve(arg('--html', path.join(ROOT, 'test.html')));
const out = path.resolve(arg('--out', path.join(ROOT, 'shots', 'apresentacao')));
const fases = arg('--fase', '1,2,3,4').split(',');
fs.mkdirSync(out, { recursive: true });
const URL0 = 'file://' + html.split(path.sep).join('/');
const igual = (a, b) => { const o = x => JSON.stringify(Object.keys(x).sort().map(k => [k, x[k]])); return o(a) === o(b) };
let falhas = 0, pulos = 0; const erros = [];
const ok = (c, msg) => { console.log((c ? '  ok   ' : '  FALHOU ') + msg); if (!c) falhas++ };
const T = 120000;

async function novoContexto(b, { mobile = false, tema = 'light', semente = null, movimento = false } = {}) {
  const ctx = await b.newContext({ viewport: mobile ? { width: 400, height: 860 } : { width: 1440, height: 900 }, deviceScaleFactor: mobile ? 2 : 1, colorScheme: tema, hasTouch: mobile,
    reducedMotion: movimento ? 'no-preference' : 'reduce', permissions: ['clipboard-read', 'clipboard-write'] });
  await ctx.addInitScript(([t, sem]) => { try { localStorage.setItem('gabarito.tema', JSON.stringify(t)); if (sem) for (const k in sem) localStorage.setItem(k, sem[k]) } catch (e) {} }, [tema, semente]);
  return ctx;
}
async function abrir(ctx, url, rotulo) {
  const p = await ctx.newPage(); p.setDefaultTimeout(T);
  await prepara(p);
  p.on('pageerror', e => erros.push(`[${rotulo}] PE ${e.message}`));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR|fonts\.g/.test(m.text())) erros.push(`[${rotulo}] CE ${m.text().slice(0, 300)}`) });
  await p.goto(url, { waitUntil: 'domcontentloaded', timeout: T }); return p;
}
const passo = (p, n) => p.waitForFunction(n => document.getElementById('apStep').textContent.includes(n + ' de 5'), n, { timeout: 90000 }).then(() => true, () => false);
const pronta = p => p.waitForSelector('#ap:not([hidden]) #apSlide .aps', { timeout: T });
const ls = p => p.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k) } return o });
const arquivo = n => path.join(out, n);

const proprio = JSON.stringify({ v: 2, nome: 'Meu estudo privado', lote: { pts: [[0, 0], [20, 0], [20, 30], [0, 30]], front: [0], principal: 0, rec: [{}, {}, {}, {}] } });
const semente = { 'gabarito.v2': proprio, 'gabarito.step': JSON.stringify('viab'), 'gabarito.cenarios2': JSON.stringify([{ nome: 'Cenário dele', data: '01/01/2026', aprovado: false, S: {}, k: { units: 1, vgv: 1, margem: 0, tir: null } }]) };
const lerLink = () => fs.readFileSync(arquivo('link.txt'), 'utf8').trim();
const lerLogo = () => 'data:image/png;base64,' + fs.readFileSync(arquivo('logo-teste.png')).toString('base64');

async function fase1(b) {
  console.log('\n[1] editor: marca, link e PDF');
  const ca = await novoContexto(b, { movimento: true });
  const A = await abrir(ca, URL0, 'editor'); await A.waitForTimeout(2500);
  await A.evaluate(() => { S.nome = 'Torre Aurora'; S.regras.cidade = 'Criciúma, SC'; update() });
  const dataUrl = await A.evaluate(() => { const c = document.createElement('canvas'); c.width = 360; c.height = 120; const g = c.getContext('2d');
    g.fillStyle = '#7a2e3b'; g.beginPath(); g.moveTo(10, 100); g.lineTo(60, 10); g.lineTo(110, 100); g.closePath(); g.fill(); g.fillStyle = '#e3a92b'; g.fillRect(56, 40, 8, 60);
    g.fillStyle = '#7a2e3b'; g.font = '700 46px sans-serif'; g.fillText('AURORA', 128, 72); g.font = '500 20px sans-serif'; g.fillText('INCORPORADORA', 130, 100); return c.toDataURL('image/png') });
  fs.writeFileSync(arquivo('logo-teste.png'), Buffer.from(dataUrl.split(',')[1], 'base64'));
  await A.click('#rail [data-step=cen]'); await A.waitForTimeout(600);
  await A.click('#phead [data-act=subx][data-v=entregar]'); await A.waitForTimeout(600);   // apresentação e marca ficam na sub-aba Entregar
  ok(await A.locator('#cardApres').count() === 1, 'card "Apresentar e compartilhar" na etapa Cenários');
  ok(await A.locator('#cardMarca').count() === 1, 'card "Marca no relatório (PDF)" na etapa Cenários');
  ok(await A.locator('#cardMarca input[data-p="marca.nome"]').count() === 0, 'com a marca desligada o card mostra só o interruptor');
  await A.evaluate(() => { document.getElementById('cardMarca').open = true }); await A.waitForTimeout(200);   // seção recolhida por padrão
  await A.locator('label.sw:has(input[data-p="marca.ativa"])').click(); await A.waitForTimeout(300);
  await A.fill('#f-marca-nome', 'Aurora Incorporadora'); await A.keyboard.press('Tab');
  await A.fill('#f-marca-rodape', 'Aurora Incorporadora · CRECI 00000-J · (48) 3000-0000'); await A.keyboard.press('Tab');
  await A.evaluate(() => { const a = document.querySelector('#cardMarca .advb'); if (a && a.hidden) document.querySelector('#cardMarca .advbtn').click() });   // título e subtítulo em "Mais opções"
  await A.fill('#f-marca-titulo', 'Torre Aurora — estudo de viabilidade'); await A.keyboard.press('Tab');
  await A.fill('#f-marca-subtitulo', 'Lançamento Criciúma · 2027'); await A.keyboard.press('Tab');
  await A.setInputFiles('#mkLogoIn', arquivo('logo-teste.png')); await A.waitForTimeout(900);
  await A.click('.mk-sw[aria-label="Vinho"]'); await A.waitForTimeout(300);
  const marca = await A.evaluate(() => ({ ...S.marca, logo: !!LS.get('gabarito.marca.logo'), emS: JSON.stringify(S).includes('data:image') }));
  ok(marca.ativa && marca.nome === 'Aurora Incorporadora' && marca.cor === '#7a2e3b' && marca.logo, 'marca gravada (nome, cor, logo no armazenamento separado)');
  ok(marca.emS === false, 'a logo NÃO vai dentro do estudo S');
  await A.locator('#cardMarca').scrollIntoViewIfNeeded();
  await A.screenshot({ path: arquivo('editor-cenarios-marca.png') });
  await A.click('[data-act=apLink]'); await A.waitForFunction(() => document.getElementById('apLinkOut')?.value.includes('#ver='));
  const link = await A.inputValue('#apLinkOut');
  ok(/#ver=z[A-Za-z0-9_-]+$/.test(link), `link somente leitura gerado (${link.length} caracteres)`);
  ok((await A.evaluate(() => navigator.clipboard.readText())) === link, 'link copiado para a área de transferência');
  fs.writeFileSync(arquivo('link.txt'), link);
  // apresentar dentro do editor
  const antes = await A.evaluate(() => JSON.stringify(S));
  await A.click('#apTop'); await pronta(A);
  ok(await A.locator('#ap').isVisible(), 'botão Apresentar abre a apresentação');
  ok(await A.evaluate(() => document.querySelector('.app').inert === true), 'editor fica inerte durante a apresentação');
  ok(await A.evaluate(() => document.querySelectorAll('#ap input,#ap textarea,#ap select,#ap [contenteditable]').length === 0), 'sem campos editáveis na apresentação');
  // maquete 3D animada: a câmera gira sozinha (contexto com movimento normal)
  const cam = () => A.evaluate(() => V3.cam.position.x.toFixed(3) + ',' + V3.cam.position.z.toFixed(3));
  const c0 = await cam(); await A.waitForFunction(c => (V3.cam.position.x.toFixed(3) + ',' + V3.cam.position.z.toFixed(3)) !== c, c0, { timeout: 60000 }).catch(() => {});
  ok(await cam() !== c0, 'maquete 3D com órbita lenta (a câmera gira sozinha)');
  await A.keyboard.press('ArrowRight'); await A.keyboard.press('ArrowRight');
  ok(await passo(A, 3), 'setas avançam os passos');
  await A.keyboard.press('Escape');
  await A.waitForFunction(() => !document.fullscreenElement, null, { timeout: 60000 }).catch(() => {});   // o 1º Esc sai da tela cheia do navegador
  if (await A.locator('#ap').isVisible()) await A.keyboard.press('Escape');
  ok(await A.locator('#ap').waitFor({ state: 'hidden', timeout: 60000 }).then(() => true, () => false), 'Esc sai da apresentação (modo editor)');
  ok(await A.evaluate(() => !document.querySelector('.app').inert && document.getElementById('c3d').parentElement.id === 'view'), 'editor e canvas 3D restaurados ao sair');
  ok(await A.evaluate(a => JSON.stringify(S) === a, antes), 'o estudo não mudou por apresentar');
  async function pdf(nome) {
    const b64 = await A.evaluate(async () => { let dados = null; window.saveFile = async (n, d) => { dados = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(d) }); return true };
      try { await exportPDF() } catch (e) { if (!window.jspdf) return 'sem-cdn'; throw e } return dados || (window.jspdf ? null : 'sem-cdn') });
    // sem acesso à CDN do jsPDF (ambiente de teste sem internet) o PDF não é testável: avisa e segue com as outras fases
    if (b64 === 'sem-cdn') { console.log('  PULADO PDF ' + nome + ' (jsPDF da CDN indisponível — sem internet)'); pulos++; return }
    if (!b64) { ok(false, 'PDF ' + nome + ' gerado (jsPDF não carregou? precisa de internet)'); return }
    fs.writeFileSync(arquivo(nome), Buffer.from(b64.split(',')[1], 'base64')); ok(true, `PDF ${nome} salvo (${Math.round(fs.statSync(arquivo(nome)).size / 1024)} KB)`);
  }
  await pdf('exemplo-marca.pdf');
  await A.evaluate(() => { S.marca.ativa = false });
  await pdf('exemplo-padrao.pdf');
  await ca.close();
}

async function fase2(b) {
  console.log('\n[2] link aberto em outro navegador');
  const link = lerLink();
  for (const tema of ['light', 'dark']) {
    const cb = await novoContexto(b, { tema, semente });
    const B = await abrir(cb, link, 'leitura-' + tema);
    await pronta(B); await B.waitForTimeout(1500);
    const snap0 = await ls(B);
    ok(await B.evaluate(() => document.documentElement.classList.contains('ap-ro')), `[${tema}] entrou direto no modo leitura`);
    ok((await B.textContent('#apSlide')).includes('Torre Aurora'), `[${tema}] mostra o estudo do link (Torre Aurora), não o salvo no navegador`);
    ok(await B.evaluate(() => document.querySelector('.app').inert === true), `[${tema}] o editor está inerte`);
    ok(await B.locator('#apSair').isHidden() && await B.locator('#apAbrir').isVisible(), `[${tema}] sem "Sair"; só "Abrir o Gabarito"`);
    ok((await B.innerHTML('#apBrand')).includes('<img') && (await B.textContent('#apBrand')).includes('Aurora Incorporadora'), `[${tema}] logo e nome da marca no topo`);
    for (let i = 0; i < 5; i++) {
      ok(await passo(B, i + 1), `[${tema}] no passo ${i + 1}`);
      await B.waitForTimeout(500);
      const pass = await B.evaluate(() => ({ editaveis: document.querySelectorAll('#ap input,#ap textarea,#ap select,#ap [contenteditable=""],#ap [contenteditable="true"]').length, passo: document.getElementById('apStep').textContent,
        livres: [...document.querySelectorAll('input,textarea,select')].filter(e => !e.closest('.app') && e.offsetParent !== null).length, erroSlide: !!document.querySelector('#apSlide h2')?.textContent.includes('Não foi possível') }));
      ok(pass.editaveis === 0 && pass.livres === 0, `[${tema}] passo ${i + 1}: sem campos editáveis (${pass.passo})`);
      ok(!pass.erroSlide, `[${tema}] passo ${i + 1}: montou sem erro`);
      if (i < 4) await B.keyboard.press(i % 2 ? 'Space' : 'ArrowRight');
    }
    await B.keyboard.press('ArrowLeft'); ok(await passo(B, 4), `[${tema}] seta esquerda volta`);
    await B.keyboard.press('Home'); ok(await passo(B, 1), `[${tema}] Home vai ao primeiro`);
    await B.keyboard.press('End'); ok(await passo(B, 5), `[${tema}] End vai ao último`);
    await B.click('#apNext'); ok(await passo(B, 1), `[${tema}] "Recomeçar" volta ao início`);
    await B.click('#apProg [data-ap="2"]'); ok(await passo(B, 3), `[${tema}] pontos de progresso levam ao passo`);
    await B.keyboard.press('Escape'); await B.waitForTimeout(400); ok(await B.locator('#ap').isVisible(), `[${tema}] Esc não sai do modo leitura`);
    await B.click('#apTema'); await B.waitForFunction(t => document.documentElement.getAttribute('data-theme') !== t, tema).catch(() => {}); await B.waitForTimeout(1200);
    ok((await B.evaluate(() => document.documentElement.getAttribute('data-theme'))) !== tema, `[${tema}] botão de tema funciona na apresentação`);
    const snap1 = await ls(B);
    ok(igual(snap0, { ...semente, 'gabarito.tema': JSON.stringify(tema) }), `[${tema}] localStorage = só o que o visitante já tinha`);
    ok(igual(snap1, snap0), `[${tema}] localStorage idêntico depois de percorrer tudo e trocar o tema`);
    ok(snap1['gabarito.v2'] === proprio && JSON.parse(snap1['gabarito.cenarios2'])[0].nome === 'Cenário dele', `[${tema}] estudo e cenários salvos do visitante intactos`);
    await cb.close();
  }
  { const cx = await novoContexto(b, { semente }); const X = await abrir(cx, URL0 + '#ver=zAAAAAAAAAAAA', 'quebrado');
    await X.waitForFunction(() => /Não consegui abrir/.test(document.getElementById('apMsg').textContent));
    ok(true, 'link quebrado mostra mensagem clara');
    ok(igual(await ls(X), { ...semente, 'gabarito.tema': JSON.stringify('light') }), 'link quebrado também não grava nada');
    await X.screenshot({ path: arquivo('link-quebrado.png') }); await cx.close() }
}

async function fase4(b) {
  console.log('\n[4] celular: passo inicial e deslizar');
  const link = lerLink();
  { // passo inicial pelo link e deslizar no celular
    const cm = await novoContexto(b, { mobile: true, semente });
    const M = await abrir(cm, link + '&p=3', 'celular'); await pronta(M);
    ok(await passo(M, 3), '[celular] &p=3 abre no passo 3');
    await M.waitForTimeout(800);
    const bx = await M.locator('#apMain').boundingBox(), y = bx.y + 40;   // na faixa do título (a tabela que rola de lado fica com o gesto dela)
    await M.mouse.move(bx.x + 300, y); await M.mouse.down(); await M.mouse.move(bx.x + 120, y + 4, { steps: 3 }); await M.mouse.up();
    ok(await passo(M, 4), '[celular] deslizar para a esquerda avança');
    await M.mouse.move(bx.x + 100, y); await M.mouse.down(); await M.mouse.move(bx.x + 300, y + 4, { steps: 3 }); await M.mouse.up();
    ok(await passo(M, 3), '[celular] deslizar para a direita volta');
    ok(await M.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), '[celular] sem rolagem horizontal da página');
    await cm.close();
  }
}

async function fase3(b) {
  console.log('\n[3] capturas');
  const link = lerLink(), logo = lerLogo();
  for (const mobile of [false, true]) for (const tema of ['light', 'dark']) {
    const cz = await novoContexto(b, { mobile, tema, semente });
    const Z = await abrir(cz, link, `captura-${mobile ? 'm' : 'd'}-${tema}`); await pronta(Z); await Z.waitForTimeout(1500);
    for (let i = 0; i < 5; i++) { await passo(Z, i + 1); await Z.waitForTimeout(1200); await Z.screenshot({ path: arquivo(`${mobile ? 'm' : 'd'}-${tema}-passo${i + 1}.png`) }); if (i < 4) await Z.click('#apNext') }
    await cz.close();
  }
  for (const mobile of [false, true]) for (const tema of ['light', 'dark']) {
    const ce = await novoContexto(b, { mobile, tema });
    const E = await abrir(ce, URL0, 'editor-cap'); await E.waitForTimeout(1500);
    await E.evaluate(([lg]) => { S.marca.ativa = true; S.marca.nome = 'Aurora Incorporadora'; S.marca.cor = '#7a2e3b'; S.marca.rodape = 'CRECI 00000-J · (48) 3000-0000'; LS.set('gabarito.marca.logo', { url: lg, w: 360, h: 120, opaca: false }); LS.set('gabarito.step', 'cen'); LS.set('gabarito.subx', { cen: 'entregar' }); LS.set('gabarito.v2', S) }, [logo]);
    await E.reload({ waitUntil: 'domcontentloaded' }); await E.waitForSelector('#cardMarca'); await E.waitForTimeout(1200);
    await E.locator('#cardApres').scrollIntoViewIfNeeded(); await E.screenshot({ path: arquivo(`${mobile ? 'm' : 'd'}-${tema}-cenarios.png`) });
    await E.screenshot({ path: arquivo(`${mobile ? 'm' : 'd'}-${tema}-topo.png`), clip: { x: 0, y: 0, width: mobile ? 400 : 1440, height: 70 } });
    await ce.close();
  }
}

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  try { if (fases.includes('1')) await fase1(b); if (fases.includes('2')) await fase2(b); if (fases.includes('3')) await fase3(b); if (fases.includes('4')) await fase4(b) } finally { await b.close() }
  console.log('\nErros de JS:', erros.length ? '\n  ' + erros.join('\n  ') : 'nenhum');
  console.log((falhas ? `\n${falhas} verificação(ões) falharam` : '\ntudo certo') + (pulos ? ` · ${pulos} PDF(s) pulado(s) sem a CDN` : ''));
  process.exit(falhas || erros.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1) });
