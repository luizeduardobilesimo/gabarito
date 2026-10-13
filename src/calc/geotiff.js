/* ================= GeoTIFF de elevação (ANADEM e similares) → relevo do lote =================
   Funções puras (Node, Worker e página). A leitura de arquivos comprimidos usa a biblioteca `geotiff` (CDN, sob demanda,
   em src/ui/relevo.js); aqui fica o que dá para fazer sem ela: um leitor mínimo de TIFF clássico NÃO comprimido (tiras ou
   ladrilhos, 1 banda, 8/16/32/64 bits, inteiro ou ponto flutuante), o georreferenciamento e a amostragem no lote.
   gtAbrir(buffer)                       → {w,h,origem:[x0,y0],res:[dx,dy],crs,noData,ler(c0,r0,c1,r1)} (lança "compressão …" se vier comprimido)
   gtJanelaDoLote(arq, ref, centro, J)   → janela de pixels [c0,r0,c1,r1] que cobre o centro ± J/2 (a leitura de um arquivo grande lê só ela)
   gtAmostra(r, x, y)                    → cota por interpolação bilinear em coordenadas do CRS do arquivo (NaN fora ou sem dado)
   gtGrade(r, ref, pontos)               → [[E,N,cota]…] nos pontos da grade local (como relevoGrade para os tiles)
   relevoDeRaster(r, ref, centro, o)     → {planos, plano, principal, conf, origem, pixel} (mesmo formato de relevoAnalisa)
   O raster `r` = {w,h,data:Float32Array,origem:[x0,y0] (canto superior esquerdo do pixel 0,0),res:[dx,dy] (dy>0 desce),crs:{tipo:"geo"|"utm",zona,sul},noData}.
   CRS aceitos: geográfico (lat/lon, ex.: EPSG:4326/4674, o caso do ANADEM) e UTM (SIRGAS 2000, WGS84). */
const GT_TIPOS = { 1:[1,"u8"], 2:[1,"a"], 3:[2,"u16"], 4:[4,"u32"], 5:[8,"r"], 6:[1,"i8"], 7:[1,"u8"], 8:[2,"i16"], 9:[4,"i32"], 10:[8,"sr"], 11:[4,"f32"], 12:[8,"f64"], 16:[8,"u64"] };
function gtAbrir(buf){
  const dv=new DataView(buf), b0=dv.getUint8(0), b1=dv.getUint8(1);
  const le = b0===0x49 && b1===0x49; if(!le && !(b0===0x4D && b1===0x4D)) throw new Error("não é um arquivo TIFF");
  const magia=dv.getUint16(2,le); if(magia===43) throw new Error("BigTIFF não é suportado sem a biblioteca (compressão/arquivo grande)"); if(magia!==42) throw new Error("não é um arquivo TIFF");
  const u16=o=>dv.getUint16(o,le), u32=o=>dv.getUint32(o,le), f64=o=>dv.getFloat64(o,le), tags={};
  const ifd=u32(4), n=u16(ifd);
  for(let i=0;i<n;i++){ const e=ifd+2+i*12, tag=u16(e), tipo=u16(e+2), cnt=u32(e+4), T=GT_TIPOS[tipo]; if(!T) continue;
    const bytes=T[0]*cnt, off= bytes<=4? e+8 : u32(e+8); if(off+bytes>buf.byteLength) continue;
    const v=[]; for(let k=0;k<cnt;k++){ const p=off+k*T[0];
      switch(T[1]){ case "u8": v.push(dv.getUint8(p)); break; case "i8": v.push(dv.getInt8(p)); break; case "a": v.push(dv.getUint8(p)); break;
        case "u16": v.push(dv.getUint16(p,le)); break; case "i16": v.push(dv.getInt16(p,le)); break; case "u32": v.push(dv.getUint32(p,le)); break; case "i32": v.push(dv.getInt32(p,le)); break;
        case "f32": v.push(dv.getFloat32(p,le)); break; case "f64": v.push(dv.getFloat64(p,le)); break; case "u64": v.push(Number(dv.getBigUint64(p,le))); break;
        case "r": v.push(u32(p)/(u32(p+4)||1)); break; case "sr": v.push(dv.getInt32(p,le)/(dv.getInt32(p+4,le)||1)); break } }
    tags[tag]= T[1]==="a"? String.fromCharCode(...v).replace(/\0+$/,"") : v }
  const g=(t,d)=> tags[t]!==undefined? tags[t][0] : d;
  const w=g(256), h=g(257), bits=g(258,8), comp=g(259,1), spp=g(277,1), sf=g(339,1), planar=g(284,1), pred=g(317,1);
  if(!w || !h) throw new Error("TIFF sem dimensões");
  if(comp!==1) throw new Error("compressão "+comp+" exige a biblioteca geotiff");
  if(pred!==1) throw new Error("compressão com predição exige a biblioteca geotiff");
  if(planar===2 && spp>1) throw new Error("bandas separadas não são suportadas");
  if(![8,16,32,64].includes(bits)) throw new Error("amostras de "+bits+" bits não são suportadas");
  const bps=bits/8, tiled=tags[322]!==undefined;
  const lerV = p=>{ if(sf===3){ return bits===32? dv.getFloat32(p,le) : bits===64? dv.getFloat64(p,le) : NaN }
    if(sf===2) return bits===8? dv.getInt8(p) : bits===16? dv.getInt16(p,le) : bits===32? dv.getInt32(p,le) : Number(dv.getBigInt64(p,le));
    return bits===8? dv.getUint8(p) : bits===16? dv.getUint16(p,le) : bits===32? dv.getUint32(p,le) : Number(dv.getBigUint64(p,le)) };
  // georreferência
  const keys={}; if(tags[34735]){ const K=tags[34735], nk=K[3]; for(let i=0;i<nk;i++){ const id=K[4+i*4], loc=K[5+i*4], val=K[7+i*4]; if(loc===0) keys[id]=val } }
  let origem=null, res=null;
  if(tags[33550] && tags[33922]){ const s=tags[33550], t=tags[33922]; res=[s[0], s[1]]; origem=[t[3]-t[0]*s[0], t[4]+t[1]*s[1]] }
  else if(tags[34264] && tags[34264].length>=16){ const a=tags[34264]; if(Math.abs(a[1])>1e-12 || Math.abs(a[4])>1e-12) throw new Error("imagem girada não é suportada"); res=[a[0], -a[5]]; origem=[a[3], a[7]] }
  if(!origem) throw new Error("o arquivo não tem georreferência (GeoTIFF)");
  if(keys[1025]===2){ origem=[origem[0]-res[0]/2, origem[1]+res[1]/2] }          // pixel = ponto: o valor está no centro
  let crs=null;
  if(keys[1024]===2 || (keys[2048] && !keys[3072])) crs={tipo:"geo", epsg:keys[2048]||4326};
  else if(keys[3072]){ const z=geoZonaDoCrs("EPSG:"+keys[3072]); if(z) crs={tipo:"utm", zona:z.zona, sul:z.sul, epsg:keys[3072]}; else throw new Error("sistema de coordenadas EPSG:"+keys[3072]+" não é suportado (use lat/lon ou UTM)") }
  else if(Math.abs(origem[0])<=360 && Math.abs(origem[1])<=90) crs={tipo:"geo", epsg:4326};
  else throw new Error("o arquivo não informa o sistema de coordenadas");
  let noData=NaN; if(typeof tags[42113]==="string"){ const v=parseFloat(tags[42113]); if(isFinite(v)) noData=v }
  const ler=(c0,r0,c1,r1)=>{ c0=Math.max(0,Math.floor(c0)); r0=Math.max(0,Math.floor(r0)); c1=Math.min(w,Math.ceil(c1)); r1=Math.min(h,Math.ceil(r1));
    const ww=c1-c0, hh=r1-r0; if(ww<1 || hh<1) return {w:0,h:0,data:new Float32Array(0),c0,r0};
    const out=new Float32Array(ww*hh).fill(NaN), put=(c,r,p)=>{ let v=lerV(p); if(v===noData || !isFinite(v) || v<-1e30 || v>1e30) v=NaN; out[(r-r0)*ww+(c-c0)]=v };
    if(tiled){ const tw=g(322), th=g(323), off=tags[324], tpr=Math.ceil(w/tw);
      for(let tr=Math.floor(r0/th); tr<=Math.floor((r1-1)/th); tr++) for(let tc=Math.floor(c0/tw); tc<=Math.floor((c1-1)/tw); tc++){ const base=off[tr*tpr+tc]; if(base==null) continue;
        for(let r=Math.max(r0,tr*th); r<Math.min(r1,(tr+1)*th, h); r++) for(let c=Math.max(c0,tc*tw); c<Math.min(c1,(tc+1)*tw, w); c++) put(c,r,base+(((r-tr*th)*tw)+(c-tc*tw))*bps*spp) } }
    else { const rps=Math.min(g(278,h), h), off=tags[273];
      for(let r=r0;r<r1;r++){ const s=Math.floor(r/rps), base=off[s]; if(base==null) continue; for(let c=c0;c<c1;c++) put(c,r,base+(((r-s*rps)*w)+c)*bps*spp) } }
    return {w:ww,h:hh,data:out,c0,r0};
  };
  return { w, h, origem, res, crs, noData, bits, ler };
}
/* coordenadas do CRS do arquivo para um ponto lat/lon */
function gtCoord(crs, lat, lon){ return crs.tipo==="utm"? geoLatLonParaUtm(lat, lon, crs.zona) : [lon, lat] }
/* janela de pixels (c0,r0,c1,r1) que cobre o quadrado centro ± J/2 (m); `centro` em metros locais, `ref` = geoRef do lote */
function gtJanelaDoLote(arq, ref, centro, J){
  const pts=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>{ const ll=geoDeLocal(centro[0]+a*J/2, centro[1]+b*J/2, ref), q=gtCoord(arq.crs, ll[0], ll[1]); return [(q[0]-arq.origem[0])/arq.res[0], (arq.origem[1]-q[1])/arq.res[1]] });
  return [Math.min(...pts.map(p=>p[0]))-2, Math.min(...pts.map(p=>p[1]))-2, Math.max(...pts.map(p=>p[0]))+2, Math.max(...pts.map(p=>p[1]))+2];
}
/* interpolação bilinear; x,y no CRS do raster. Os centros dos pixels ficam a meio pixel da borda */
function gtAmostra(r, x, y){
  const dx=r.res[0], dy=r.res[1], u=(x-r.origem[0])/dx-0.5, v=(r.origem[1]-y)/dy-0.5, c=Math.floor(u), l=Math.floor(v), fu=u-c, fv=v-l;
  const at=(cc,ll)=>{ const j=cc-(r.c0||0), i=ll-(r.r0||0); return j>=0 && j<r.w && i>=0 && i<r.h? r.data[i*r.w+j] : NaN };
  const a=at(c,l), b=at(c+1,l), d=at(c,l+1), e=at(c+1,l+1);
  if(fu<1e-9 && fv<1e-9) return a; if(fv<1e-9) return isFinite(a)&&isFinite(b)? a+(b-a)*fu : NaN; if(fu<1e-9) return isFinite(a)&&isFinite(d)? a+(d-a)*fv : NaN;
  if(!(isFinite(a)&&isFinite(b)&&isFinite(d)&&isFinite(e))) return NaN;
  return (a*(1-fu)+b*fu)*(1-fv) + (d*(1-fu)+e*fu)*fv;
}
function gtGrade(r, ref, pontos){
  const out=[]; pontos.forEach(p=>{ const ll=geoDeLocal(p[0], p[1], ref), q=gtCoord(r.crs, ll[0], ll[1]), z=gtAmostra(r, q[0], q[1]); if(isFinite(z)) out.push([p[0], p[1], z]) });
  return out;
}
/* tamanho do pixel em metros (médio entre as duas direções) */
function gtPixelM(r, lat){ return r.crs.tipo==="utm"? (r.res[0]+r.res[1])/2 : (r.res[0]*111320*Math.cos((lat||0)*Math.PI/180) + r.res[1]*110574)/2 }
/* plano do relevo a partir de um raster já lido (ANADEM etc.), centrado em `centro` (m locais) */
function relevoDeRaster(r, ref, centro, o={}){
  const jan=o.janelas || RELEVO_JANELAS.anadem, J=Math.max(...jan), px=gtPixelM(r, ref.lat0), passo=o.passo || Math.max(10, px/3);
  const am=gtGrade(r, ref, relevoPontosGrade(centro, J, passo));
  const pontos=Math.pow(Math.round(J/passo)+1, 2);
  if(am.length<Math.max(40, pontos*0.4)) throw new Error(am.length? "o arquivo cobre só parte do entorno do lote" : "fora da área do arquivo");
  return { ...relevoAnalisa(am, {centro, janelas:jan, principal:o.principal, pixel:Math.max(px, 5)}), origem:"ANADEM", pixel:px, n:am.length };
}
