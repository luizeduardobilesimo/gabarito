# Mantido por compatibilidade: o empacotador de verdade é tools/bundle.mjs (o mesmo usado pelo Vite).
import pathlib, subprocess, sys
ROOT = pathlib.Path(__file__).resolve().parent
sys.exit(subprocess.call(["node", str(ROOT / "tools" / "bundle.mjs"), *sys.argv[1:]], cwd=ROOT))
