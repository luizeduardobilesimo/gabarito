/* ================= vector tile (MVT/protobuf) — decodificador mínimo, puro =================
   Serve de reserva quando o Overpass não responde: o tile vetorial do OpenFreeMap traz as vias com nome e classe.
   mvtLer(bytes, {camadas?}) → { camada: { extent, feats:[{tipo:1|2|3, props:{…}, geom:[[ [x,y]… ]…]}] } }
   (tipo 1 ponto, 2 linha, 3 polígono; coordenadas no espaço do tile, 0…extent, y para baixo).
   mvtCodifica(camadas) faz o caminho inverso (só para os testes). Sem DOM, sem rede. */
function mvtCampos(buf, ini, fim, cb){
  let p=ini;
  const vi=()=>{ let r=0, s=0, b; do{ b=buf[p++]; if(b===undefined) throw new Error("tile truncado"); r+=(b&127)*Math.pow(2,s); s+=7 }while(b&128); return r };
  while(p<fim){
    const tag=vi(), f=Math.floor(tag/8), w=tag%8;
    if(w===0){ const v=vi(); cb(f,w,v,0,0) }
    else if(w===2){ const l=vi(); cb(f,w,0,p,p+l); p+=l }
    else if(w===5){ cb(f,w,0,p,p+4); p+=4 }
    else if(w===1){ cb(f,w,0,p,p+8); p+=8 }
    else throw new Error("formato de tile inesperado");
  }
}
function mvtTexto(buf, a, b){ let s=""; for(let i=a;i<b;i++) s+=String.fromCharCode(buf[i]); try{ return decodeURIComponent(escape(s)) }catch(e){ return s } }
function mvtVarintes(buf, a, b){ const o=[]; let p=a; while(p<b){ let r=0, s=0, x; do{ x=buf[p++]; r+=(x&127)*Math.pow(2,s); s+=7 }while(x&128); o.push(r) } return o }
const mvtZz = v => (v%2) ? -(v+1)/2 : v/2;
function mvtGeometria(cmds, tipo){
  const partes=[]; let cur=null, x=0, y=0, i=0;
  while(i<cmds.length){
    const c=cmds[i++], id=c%8, n=Math.floor(c/8);
    if(id===1){ for(let k=0;k<n;k++){ x+=mvtZz(cmds[i++]); y+=mvtZz(cmds[i++]); if(tipo===1){ partes.push([[x,y]]) } else { cur=[[x,y]]; partes.push(cur) } } }
    else if(id===2){ for(let k=0;k<n;k++){ x+=mvtZz(cmds[i++]); y+=mvtZz(cmds[i++]); if(cur) cur.push([x,y]) } }
    else if(id===7){ if(cur && cur.length) cur.push(cur[0].slice()) }
    else break;
  }
  return partes;
}
function mvtLer(buf, o={}){
  const filtro=o.camadas? new Set(o.camadas) : null, out={};
  mvtCampos(buf, 0, buf.length, (f,w,v,a,b)=>{
    if(f!==3 || w!==2) return;
    let nome="", extent=4096; const keys=[], vals=[], feats=[];
    mvtCampos(buf, a, b, (f2,w2,v2,a2,b2)=>{ if(f2===1 && w2===2) nome=mvtTexto(buf,a2,b2); });
    if(filtro && !filtro.has(nome)) return;
    mvtCampos(buf, a, b, (f2,w2,v2,a2,b2)=>{
      if(f2===3 && w2===2) keys.push(mvtTexto(buf,a2,b2));
      else if(f2===5 && w2===0) extent=v2;
      else if(f2===4 && w2===2){ let val=null;
        mvtCampos(buf, a2, b2, (f3,w3,v3,a3,b3)=>{
          if(f3===1 && w3===2) val=mvtTexto(buf,a3,b3);
          else if(f3===2 && w3===5) val=new DataView(buf.buffer, buf.byteOffset+a3, 4).getFloat32(0,true);
          else if(f3===3 && w3===1) val=new DataView(buf.buffer, buf.byteOffset+a3, 8).getFloat64(0,true);
          else if(f3===4 && w3===0) val=v3;
          else if(f3===5 && w3===0) val=v3;
          else if(f3===6 && w3===0) val=mvtZz(v3);
          else if(f3===7 && w3===0) val=!!v3 });
        vals.push(val) }
      else if(f2===2 && w2===2){ let tipo=0, tags=[], geo=[];
        mvtCampos(buf, a2, b2, (f3,w3,v3,a3,b3)=>{
          if(f3===3 && w3===0) tipo=v3; else if(f3===2 && w3===2) tags=mvtVarintes(buf,a3,b3); else if(f3===4 && w3===2) geo=mvtVarintes(buf,a3,b3) });
        feats.push({tipo, tags, geo}) } });
    out[nome]={ extent, feats: feats.map(ft=>{ const props={}; for(let k=0;k+1<ft.tags.length;k+=2) props[keys[ft.tags[k]]]=vals[ft.tags[k+1]];
      return { tipo:ft.tipo, props, geom:mvtGeometria(ft.geo, ft.tipo) } }) };
  });
  return out;
}
/* codificador (testes): camadas = { nome: { extent?, feats:[{tipo, props, geom:[[ [x,y]… ]…]}] } } → Uint8Array */
function mvtCodifica(camadas){
  const bytes=[]; const push=(...a)=>a.forEach(x=>bytes.push(x));
  const vi=v=>{ const o=[]; while(v>=128){ o.push((v%128)|128); v=Math.floor(v/128) } o.push(v); return o };
  const zz=v=>v<0? -2*v-1 : 2*v;
  const campo=(f,w,dados)=>[...vi(f*8+w), ...dados];
  const len=(f,arr)=>campo(f,2,[...vi(arr.length), ...arr]);
  const str=s=>Array.from(unescape(encodeURIComponent(s))).map(c=>c.charCodeAt(0));
  const tile=[];
  Object.entries(camadas).forEach(([nome,L])=>{
    const keys=[], vals=[], kix=k=>{ let i=keys.indexOf(k); if(i<0){ i=keys.length; keys.push(k) } return i }, vix=v=>{ const t=typeof v==="string"? len(1,str(v)) : (Number.isInteger(v)? campo(4,0,vi(v)) : campo(3,1,[...new Uint8Array(new Float64Array([v]).buffer)]));
      const s=JSON.stringify(t); let i=vals.findIndex(x=>JSON.stringify(x)===s); if(i<0){ i=vals.length; vals.push(t) } return i };
    const feats=L.feats.map(ft=>{ const tags=[]; Object.entries(ft.props||{}).forEach(([k,v])=>{ tags.push(kix(k), vix(v)) });
      const cmds=[]; let x=0, y=0;
      ft.geom.forEach(parte=>{ let pts=parte; if(ft.tipo===3 && pts.length>1 && pts[0][0]===pts[pts.length-1][0] && pts[0][1]===pts[pts.length-1][1]) pts=pts.slice(0,-1);
        cmds.push(1+8, zz(pts[0][0]-x), zz(pts[0][1]-y)); x=pts[0][0]; y=pts[0][1];
        if(pts.length>1 && ft.tipo!==1){ cmds.push(2+8*(pts.length-1)); for(let i=1;i<pts.length;i++){ cmds.push(zz(pts[i][0]-x), zz(pts[i][1]-y)); x=pts[i][0]; y=pts[i][1] } }
        if(ft.tipo===3) cmds.push(7+8) });
      return len(2, [...len(2, tags.flatMap(vi)), ...campo(3,0,vi(ft.tipo)), ...len(4, cmds.flatMap(vi))]) });
    const corpo=[...len(1,str(nome)), ...feats.flat(), ...keys.flatMap(k=>len(3,str(k))), ...vals.flatMap(v=>len(4,v)), ...campo(5,0,vi(L.extent||4096)), ...campo(15,0,vi(2))];
    tile.push(...len(3,corpo)) });
  push(...tile);
  return Uint8Array.from(bytes);
}
