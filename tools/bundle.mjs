// Empacotador único do Gabarito: concatena src/ → index.html e test.html.
// Ordem: núcleo de cálculo → src/calc/*.js → núcleo de interface → src/ui/*.js → main.js
// Uso:  node tools/bundle.mjs [--out pasta]      (sem --out grava na raiz do projeto)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
export const CORE_CALC = ['state.js', 'hooks.js', 'geom.js', 'layout.js', 'garagem.js', 'model.js', 'programa.js', 'finance.js', 'optim.js', 'clima.js'];
export const CORE_UI = ['plan2d.js', 'view3d.js', 'ui.js', 'steps.js', 'views.js', 'ai.js', 'export.js', 'wind3d.js'];
const dir = d => { const p = path.join(SRC, d); return fs.existsSync(p) ? fs.readdirSync(p).filter(f => f.endsWith('.js')).sort().map(f => d + '/' + f) : [] };

/** arquivos de cálculo puro (sem DOM) — também usados pelos testes e pelo Web Worker */
export const calcFiles = () => [...CORE_CALC, ...dir('calc')];
/** todos os arquivos na ordem de concatenação */
export const allFiles = () => [...calcFiles(), ...CORE_UI, ...dir('ui'), 'main.js'];
export const read = f => fs.readFileSync(path.join(SRC, f), 'utf8');
export const calcSource = () => '"use strict";\n' + calcFiles().map(f => `/* ---- ${f} ---- */\n` + read(f)).join('\n');

const LIBS = '<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js"></script>\n<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>\n';

export function bundle() {
  const shell = read('shell.html');
  const js = allFiles().map(f => read(f) + '\n').join('');
  // o código de cálculo vai também como texto, para o Web Worker (cálculo em segundo plano)
  const calc = '<script type="text/plain" id="calcSrc">' + calcSource().replace(/<\/script/gi, '<\/script') + '</script>\n';
  const out = shell + '\n' + calc + LIBS + '<script>\n"use strict";\n' + js + '</script>\n';
  const test = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>' + out + '</body></html>';
  return { out, test };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--out');
  const dest = i > 0 ? path.resolve(process.argv[i + 1]) : ROOT;
  fs.mkdirSync(dest, { recursive: true });
  const { out, test } = bundle();
  fs.writeFileSync(path.join(dest, 'index.html'), out);
  fs.writeFileSync(path.join(dest, 'test.html'), test);
  console.log(out.length, '→', dest);
}
