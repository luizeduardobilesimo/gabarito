// Link somente leitura (src/calc/verlink.js): codificar/decodificar o estado no hash da URL.
import { describe, it, expect } from 'vitest';
import vm from 'node:vm';
import { calcSource } from '../tools/bundle.mjs';

/** contexto isolado como o do harness, mas com as APIs de compressão do navegador (Node 18+) */
function carregarComCompressao({ comCompressao = true } = {}) {
  const store = new Map();
  const ctx = {
    console, Math, JSON, Date, performance: { now: () => Date.now() },
    localStorage: { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
    document: undefined, window: undefined, self: undefined, setTimeout, clearTimeout, structuredClone,
    TextEncoder, TextDecoder, Uint8Array,
  };
  if (comCompressao) { ctx.CompressionStream = CompressionStream; ctx.DecompressionStream = DecompressionStream; }
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(calcSource(), ctx, { filename: 'calc-bundle.js' });
  return new Proxy({}, { get: (_, k) => typeof k === 'string' ? vm.runInContext(`typeof ${k}!=="undefined"? ${k} : undefined`, ctx) : undefined });
}

describe('base64url', () => {
  const A = carregarComCompressao();
  it('ida e volta para qualquer tamanho de entrada', () => {
    for (let n = 0; n <= 40; n++) {
      const b = new Uint8Array(n).map((_, i) => (i * 37 + n * 11) & 255);
      const s = A.verB64uEnc(b);
      expect(s).toMatch(/^[A-Za-z0-9_-]*$/);
      expect(Array.from(A.verB64uDec(s))).toEqual(Array.from(b));
    }
  });
  it('concorda com o base64 do Node (trocando +/ por -_ e sem padding)', () => {
    const b = Uint8Array.from([251, 255, 190, 0, 1, 2, 250]);
    expect(A.verB64uEnc(b)).toBe(Buffer.from(b).toString('base64url'));
  });
  it('rejeita caracteres fora do alfabeto', () => {
    expect(() => A.verB64uDec('abc$')).toThrow();
    expect(() => A.verB64uDec('a')).toThrow();
  });
});

describe('codificar e decodificar o estado', () => {
  const A = carregarComCompressao();
  const estudo = () => {
    const st = A.clone(A.DEF);
    st.nome = 'Estudo Rua Ação, 120 — "teste" <b>';
    st.produto.torres = [{ pav: 14 }, { pav: 9 }, { pav: 6 }];
    st.produto.mix[0].nome = 'Studio ☀';
    st.entorno = [{ pts: [[0, 0], [10, 0], [10, 8]], h: 24.5, nome: 'Vizinho' }];
    return st;
  };

  it('o estudo volta idêntico depois de ida e volta', async () => {
    const st = estudo();
    const tok = await A.verEncode(A.verPayload(st));
    expect(tok[0]).toBe('z');
    expect(tok).toMatch(/^[A-Za-z0-9_-]+$/);
    const volta = await A.verDecode(tok);
    expect(volta.a).toBe('gabarito');
    expect(volta.S).toEqual(JSON.parse(JSON.stringify(st)));
  });

  it('o link do estudo padrão fica abaixo de 4,2 mil caracteres', async () => {
    // (era 4 mil; os pacotes de realismo — núcleo, garagem, térreo e áreas comuns — somaram opções ao estado: 3.992 → 4.032)
    const tok = await A.verEncode(A.verPayload(A.DEF));
    expect(tok.length).toBeLessThan(4200);
  });

  it('sem CompressionStream cai para JSON puro ("j") e ainda decodifica', async () => {
    const B = carregarComCompressao({ comCompressao: false });
    const tok = await B.verEncode(B.verPayload(B.DEF));
    expect(tok[0]).toBe('j');
    expect((await B.verDecode(tok)).S.nome).toBe(B.DEF.nome);
    // e um navegador com compressão abre o token "j"
    expect((await A.verDecode(tok)).S.nome).toBe(A.DEF.nome);
  });

  it('verCriar monta a URL com #ver= e troca o hash antigo', async () => {
    const url = await A.verCriar('file:///c:/x/index.html#ver=antigo&p=3', A.DEF);
    expect(url.startsWith('file:///c:/x/index.html#ver=z')).toBe(true);
    expect(url.split('#').length).toBe(2);
    const h = A.verDoHash('#' + url.split('#')[1]);
    expect((await A.verDecode(h.tok)).S.nome).toBe(A.DEF.nome);
  });

  it('verAbrir mescla com o padrão: campos que faltam voltam ao default', async () => {
    const parcial = { lote: A.clone(A.DEF.lote), nome: 'Parcial' };
    const r = A.verAbrir(await A.verDecode(await A.verEncode({ a: 'gabarito', v: 1, S: parcial })));
    expect(r.S.nome).toBe('Parcial');
    expect(r.S.regras.caMax).toBe(A.DEF.regras.caMax);
    expect(r.S.produto.torres.length).toBe(A.DEF.produto.torres.length);
  });

  it('verAbrir recusa o que não é estudo do Gabarito', () => {
    expect(() => A.verAbrir(null)).toThrow();
    expect(() => A.verAbrir({ a: 'outro', S: {} })).toThrow();
    expect(() => A.verAbrir({ a: 'gabarito', S: {} })).toThrow();
    expect(() => A.verAbrir({ a: 'gabarito', S: { lote: { pts: [[0, 0], [1, 1]] } } })).toThrow();
    expect(() => A.verAbrir({ a: 'gabarito', S: { lote: { pts: [[0, 0], [1, 'x'], [2, 2]] } } })).toThrow();
  });

  it('cor e logo vindas do link são validadas (nada de HTML/CSS injetado)', () => {
    const st = A.clone(A.DEF); st.marca = { ativa: true, cor: 'red;background:url(x)' };
    const ok = 'data:image/png;base64,iVBORw0KGgo=';
    const r = A.verAbrir({ a: 'gabarito', S: st, logo: { url: ok, w: 10, h: 5 } });
    expect(r.logo.url).toBe(ok);
    const ruim = A.verAbrir({ a: 'gabarito', S: st, logo: { url: 'javascript:alert(1)', w: 1, h: 1 } });
    expect(ruim.logo).toBe(null);
    expect(A.verAbrir({ a: 'gabarito', S: st, logo: { url: 'data:image/svg+xml;base64,PHN2Zz4=', w: 1, h: 1 } }).logo).toBe(null);
  });

  it('logo grande demais não entra no payload', () => {
    const grande = 'data:image/png;base64,' + 'A'.repeat(A.VER_LOGO_MAX + 10);
    expect(A.verPayload(A.DEF, { url: grande, w: 1, h: 1 }).logo).toBeUndefined();
    expect(A.verPayload(A.DEF, { url: 'data:image/png;base64,AAAA', w: 4, h: 2 }).logo.w).toBe(4);
  });
});

describe('hash e links inválidos', () => {
  const A = carregarComCompressao();
  it('verDoHash', () => {
    expect(A.verDoHash('')).toBe(null);
    expect(A.verDoHash('#outra=1')).toBe(null);
    expect(A.verDoHash('#ver=')).toBe(null);
    expect(A.verDoHash('#ver=zAbC')).toEqual({ tok: 'zAbC', passo: 0 });
    expect(A.verDoHash('#ver=zAbC&p=4')).toEqual({ tok: 'zAbC', passo: 3 });
    expect(A.verDoHash('#x=1&ver=jQQ&p=0')).toEqual({ tok: 'jQQ', passo: 0 });
  });
  it('token quebrado lança erro em vez de travar', async () => {
    await expect(A.verDecode('')).rejects.toThrow();
    await expect(A.verDecode('q123')).rejects.toThrow();        // formato desconhecido
    await expect(A.verDecode('z$$$$')).rejects.toThrow();       // alfabeto inválido
    await expect(A.verDecode('zAAAAAAAA')).rejects.toThrow();   // não é deflate
    const tok = await A.verEncode(A.verPayload(A.DEF));
    await expect(A.verDecode(tok.slice(0, Math.floor(tok.length / 2)))).rejects.toThrow();   // cortado
    await expect(A.verDecode('j' + A.verB64uEnc(new TextEncoder().encode('{nao json')))).rejects.toThrow();
  });
  it('protege contra link que descomprime para um tamanho absurdo', async () => {
    const lixo = new Uint8Array(A.VER_MAX_BYTES + 1024 * 1024);          // zeros: comprimem para quase nada
    const tok = 'z' + A.verB64uEnc(await A.verDeflate(lixo));
    expect(tok.length).toBeLessThan(20000);
    await expect(A.verDecode(tok)).rejects.toThrow(/grande/);
  });
});
