import pathlib
ROOT=pathlib.Path(__file__).resolve().parent
d=ROOT/'src'
shell=(d/'shell.html').read_text()
js=''.join((d/f).read_text()+'\n' for f in ['state.js','geom.js','layout.js','garagem.js','model.js','programa.js','finance.js','optim.js','clima.js','plan2d.js','view3d.js','ui.js','steps.js','views.js','ai.js','export.js','wind3d.js','main.js'])
out=shell+'\n<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js"></script>\n<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>\n<script>\n"use strict";\n'+js+'</script>\n'
(ROOT/'index.html').write_text(out)
(ROOT/'test.html').write_text('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>'+out+'</body></html>')
print(len(out))
