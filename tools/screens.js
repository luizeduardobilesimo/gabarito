// Teste visual: abre o test.html, percorre as 7 etapas, salva capturas em shots/ e lista erros de JS.
// Uso:  npm i -D playwright three@0.128.0   →   node tools/screens.js [d|m]   (d = desktop, m = celular)
// O three.js é servido localmente para o teste não depender da CDN.
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..');
const THREE_DIR = path.join(ROOT, 'node_modules', 'three');
(async () => {
  const mode = process.argv[2] || 'd';
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: mode === 'm' ? { width: 400, height: 860 } : { width: 1440, height: 900 }, deviceScaleFactor: mode === 'm' ? 2 : 1 });
  await p.route(/three@0\.128\.0\/build\/three\.min\.js/, r => r.fulfill({ path: path.join(THREE_DIR, 'build/three.min.js'), contentType: 'application/javascript' }));
  await p.route(/OrbitControls\.js/, r => r.fulfill({ path: path.join(THREE_DIR, 'examples/js/controls/OrbitControls.js'), contentType: 'application/javascript' }));
  const errs = []; p.on('pageerror', e => errs.push('PE ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('CE ' + m.text()) });
  await p.goto('file://' + path.join(ROOT, 'test.html').replace(/\\/g, '/')); await p.waitForTimeout(2500);
  fs.mkdirSync(path.join(ROOT, 'shots'), { recursive: true });
  for (const s of ['terreno', 'regras', 'produto', 'viab', 'projeto', 'clima', 'cen']) {
    await p.click(`#rail [data-step=${s}]`); await p.waitForTimeout(900);
    await p.screenshot({ path: path.join(ROOT, 'shots', `${mode}-${s}.png`), fullPage: mode === 'm' });
  }
  console.log(errs.join('\n') || 'sem erros');
  await b.close();
})();
