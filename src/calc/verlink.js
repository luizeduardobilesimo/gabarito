/* ================= link somente leitura: codificar / decodificar o estudo =================
   O estado S vira JSON → deflate (CompressionStream) → base64url, e viaja no hash da URL:  #ver=<token>
   Token: 1º caractere = formato ("z" deflate · "j" JSON puro, quando o navegador não comprime) + base64url.
   Sem DOM: roda em Node (testes) e no navegador. Depende só de TextEncoder/TextDecoder e CompressionStream/DecompressionStream.
   Com a nuvem (docs/BACKEND.md) o mesmo payload vira uma linha no banco e o link fica curto: #ver=<id>. */
const VER_MAX_BYTES = 6*1024*1024;      // teto do JSON descomprimido (proteção contra link malicioso)
const VER_LOGO_MAX = 9000;              // logo só entra no link se o data URL tiver até esse tamanho
const VER_CTX_MAX = 40000;              // contexto do OSM só entra no link até ~40 kB de JSON (comprime para ~10 kB)
const VER_ALFABETO = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function verB64uEnc(bytes){
  let s="", i=0; const A=VER_ALFABETO;
  for(; i+2<bytes.length; i+=3){ const n=(bytes[i]<<16)|(bytes[i+1]<<8)|bytes[i+2]; s+=A[n>>18&63]+A[n>>12&63]+A[n>>6&63]+A[n&63] }
  if(i+1===bytes.length){ const n=bytes[i]<<16; s+=A[n>>18&63]+A[n>>12&63] }
  else if(i+2===bytes.length){ const n=(bytes[i]<<16)|(bytes[i+1]<<8); s+=A[n>>18&63]+A[n>>12&63]+A[n>>6&63] }
  return s;
}
function verB64uDec(str){
  const s=String(str).replace(/=+$/,"").replace(/\+/g,"-").replace(/\//g,"_");
  if(!/^[A-Za-z0-9_-]*$/.test(s) || s.length%4===1) throw new Error("link inválido");
  const idx={}; for(let i=0;i<64;i++) idx[VER_ALFABETO[i]]=i;
  const out=new Uint8Array(Math.floor(s.length*3/4)); let o=0;
  for(let i=0;i<s.length;i+=4){
    const a=idx[s[i]], b=idx[s[i+1]], c=i+2<s.length?idx[s[i+2]]:-1, d=i+3<s.length?idx[s[i+3]]:-1;
    out[o++]=(a<<2)|(b>>4); if(c>=0) out[o++]=((b&15)<<4)|(c>>2); if(d>=0) out[o++]=((c&3)<<6)|d;
  }
  return out.subarray(0,o);
}
async function verLerStream(readable, limite){
  const rd=readable.getReader(), parts=[]; let total=0;
  for(;;){ const {done,value}=await rd.read(); if(done) break; total+=value.length; if(limite && total>limite){ try{ rd.cancel() }catch(e){} throw new Error("link grande demais") } parts.push(value) }
  const out=new Uint8Array(total); let o=0; parts.forEach(p=>{ out.set(p,o); o+=p.length }); return out;
}
async function verDeflate(bytes){
  const cs=new CompressionStream("deflate"), w=cs.writable.getWriter(); w.write(bytes); w.close();
  return verLerStream(cs.readable);
}
async function verInflate(bytes, limite){
  const ds=new DecompressionStream("deflate"), w=ds.writable.getWriter(); w.write(bytes).catch(()=>{}); w.close().catch(()=>{});
  return verLerStream(ds.readable, limite);
}
const verTemCompressao = ()=> typeof CompressionStream!=="undefined" && typeof DecompressionStream!=="undefined";

/** objeto → token */
async function verEncode(obj){
  const bytes=new TextEncoder().encode(JSON.stringify(obj));
  if(verTemCompressao()){ try{ return "z"+verB64uEnc(await verDeflate(bytes)) }catch(e){} }
  return "j"+verB64uEnc(bytes);
}
/** token → objeto (lança erro se o link estiver quebrado) */
async function verDecode(tok){
  tok=String(tok||"").trim();
  if(tok.length<2) throw new Error("link vazio");
  const f=tok[0], bytes=verB64uDec(tok.slice(1));
  let txt;
  if(f==="z"){ if(!verTemCompressao()) throw new Error("este navegador não abre links compactados"); txt=new TextDecoder().decode(await verInflate(bytes, VER_MAX_BYTES)) }
  else if(f==="j"){ if(bytes.length>VER_MAX_BYTES) throw new Error("link grande demais"); txt=new TextDecoder().decode(bytes) }
  else throw new Error("formato de link desconhecido");
  return JSON.parse(txt);
}

/** o que vai dentro do link: o estudo + (opcional) logo pequena */
function verPayload(st, logo){
  // contexto urbano do OSM (src/calc/contexto.js): grande demais para o link → vai sem as camadas do chão (as edificações ficam)
  if(st && st.contexto && st.contexto.dados && JSON.stringify(st.contexto.dados).length>VER_CTX_MAX) st={...st, contexto:{...st.contexto, dados:null}};
  const p={ a:"gabarito", v:1, t:new Date().toISOString().slice(0,10), S:st };
  if(logo && typeof logo.url==="string" && logo.url.length<=VER_LOGO_MAX) p.logo={ url:logo.url, w:+logo.w||0, h:+logo.h||0, o:!!logo.opaca };
  return p;
}
const verLogoOk = u => typeof u==="string" && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(u);
const verCorOk = c => typeof c==="string" && /^#[0-9a-fA-F]{6}$/.test(c);
/** valida o payload e devolve {S, logo}: S já mesclado com o padrão (migrações incluídas). Lança erro se não for um estudo do Gabarito. */
function verAbrir(p){
  if(!p || p.a!=="gabarito" || typeof p.S!=="object" || !p.S) throw new Error("o link não contém um estudo do Gabarito");
  const L=p.S.lote;
  if(!L || !Array.isArray(L.pts) || L.pts.length<3 || L.pts.length>400 || !L.pts.every(q=>Array.isArray(q) && q.length>=2 && isFinite(q[0]) && isFinite(q[1]))) throw new Error("estudo sem lote válido");
  const St=merge(clone(DEF), clone(p.S));
  if(St.marca){ if(!verCorOk(St.marca.cor)) St.marca.cor="#1d1d1f" }
  const logo = p.logo && verLogoOk(p.logo.url)? { url:p.logo.url, w:+p.logo.w||0, h:+p.logo.h||0, opaca:!!p.logo.o } : null;
  return { S:St, logo, data:String(p.t||"") };
}
/** "#ver=…&p=3" → {tok, passo} (ou null) */
function verDoHash(hash){
  const h=String(hash||"").replace(/^#/,""); if(!/(^|&)ver=/.test(h)) return null;
  const q={}; h.split("&").forEach(kv=>{ const i=kv.indexOf("="); if(i>0) q[kv.slice(0,i)]=kv.slice(i+1) });
  if(!q.ver) return null;
  return { tok:q.ver, passo: Math.max(0, (parseInt(q.p,10)||1)-1) };
}
const verUrl = (base, tok, passo) => String(base||"").split("#")[0] + "#ver=" + tok + (passo>0? "&p="+(passo+1) : "");
/** atalho: estado → URL somente leitura */
async function verCriar(base, st, logo){ return verUrl(base, await verEncode(verPayload(st, logo))) }
